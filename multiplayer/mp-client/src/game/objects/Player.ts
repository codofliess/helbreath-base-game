import type { Scene } from 'phaser';
import { GameObject, GameObjectState } from './GameObject';
import { Direction, getDistance, getDirectionOffset, getNextDirection, convertPixelPosToWorldPos, toDirection, worldCellCenterPixelX, worldCellCenterPixelY } from '../../utils/CoordinateUtils';
import type { HBMap } from '../assets/HBMap';
import type { Monster } from './Monster';
import { ShadowManager } from '../../utils/ShadowManager';
import {
    DEFAULT_PLAYER_ATTACK_RANGE,
    FLOATING_TEXT_DEPTH,
    HIGH_DEPTH,
    PLAYER_HEALTH_BAR_HEIGHT,
    PLAYER_HEALTH_BAR_WIDTH,
} from '../../Config';
import {
    OLYMPIA_CHAT_COLORS,
    OLYMPIA_FLOATING_TEXT_COLORS,
    OLYMPIA_PHASER_FONT,
    olympiaPhaserOutlinedTextStyle,
} from '../../constants/OlympiaTypography';
import { TILE_SIZE } from '../assets/HBMap';
import { CriticalStrikeProjectile } from '../effects/CriticalStrikeProjectile';
import { ArrowProjectile } from '../effects/ArrowProjectile';
import { StormBringerEffect } from '../effects/StormBringerEffect';
import { drawEffect, drawEffectAtPixelCoords } from '../../utils/EffectUtils';
import { computeOtherPlayerSpatialConfig } from '../../utils/SpatialAudioUtils';
import {
    EFFECT_RESURRECTION,
    EFFECT_CASTING_CIRCLE,
    EFFECT_SPARKLE,
    EFFECT_FOOTSTEPS_DRY,
    EFFECT_WET_SPLASH,
    EFFECT_BERSERK,
    EFFECT_DEFENSE_SHIELD_BUFF,
    EFFECT_PROTECTION_FROM_ARROWS_BUFF,
    EFFECT_PROTECTION_RING,
    EFFECT_ABSOLUTE_MAGIC_PROTECTION_BUFF,
    EFFECT_UNKNOWN_SMALL_RECOVERY_1,
    EFFECT_UNKNOWN_SMALL_RECOVERY_2,
} from '../../constants/Effects';
import { getEffectByKey } from '../../constants/Effects';
import { Effect as VisualEffect } from '../effects/Effect';
import { SoundManager } from '../../utils/SoundManager';
import { mapDialogStore } from '../../ui/store/MapDialog.store';
import { playerDialogStore } from '../../ui/store/PlayerDialog.store';
import { PLAYER_RUNNING, PLAYER_WALKING, PLAYER_MELEE_ATTACK, PLAYER_TAKE_UNARMED_DAMAGE, PLAYER_CAST, SPELL_CAST_FAILED, MALE_CRITICAL_ATTACK, FEMALE_CRITICAL_ATTACK, MALE_DEATH, FEMALE_DEATH, MALE_RESET_POSITION, FEMALE_RESET_POSITION } from '../../constants/SoundFileNames';
import { EventBus } from '../EventBus';
import { PLAYER_POSITION_CHANGED, TILE_OCCUPANCY_REAPPLY_REQUESTED, OUT_UI_PLAYER_DIED, OUT_UI_CAST_STARTED, OUT_UI_CAST_READY, OUT_UI_CAST_REMOVED, PLAYER_CAST_ANIMATION_STARTED, PLAYER_CONFIRM_SPELL_TARGET, EQUIP_ITEM, IN_UI_CHANGE_GENDER, IN_UI_CHANGE_SKIN_COLOR, IN_UI_CHANGE_UNDERWEAR_COLOR, IN_UI_CHANGE_HAIR_STYLE, SYSTEM_LOG_APPEND } from '../../constants/EventNames';
import { AttackType, Gender, MonsterAttackType, SkinColor, TemporaryEffectType } from '../../Types';
import { calculateAnimationDuration, calculateFrameRateFromDuration } from '../../utils/AnimationUtils';
import { FloatingText, formatOlympiaSpellAnnounce } from '../effects/FloatingText';
import { ItemTypes, ItemEffect, WeaponType, RING_SLOT_LEFT, RING_SLOT_RIGHT, getItemById, hasEquippedItemEffect, type Effect, type EquipmentSlot, type InventoryItem, type Item } from '../../constants/Items';
import { getInventoryManager, getNetworkManager, setPlayerPosition } from '../../utils/RegistryUtils';
import { getSpellById } from '../../constants/Spells';
import { DEFAULT_GEAR, GearConfig, PlayerAppearanceManager, type PlayerAppearanceAnimationConfig, PlayerState } from '../../utils/PlayerAppearanceManager';
import { PlayerMovementManager, type PendingSyncCommand } from '../../utils/PlayerMovementManager';
import { PlayerRangedCombatManager } from '../../utils/PlayerRangedCombatManager';

/** Olympia chat bubble above head (~10 s). */
const CHAT_OVERHEAD_DURATION_MS = 10_000;
const CHAT_OVERHEAD_FADE_MS = 1_500;
const CHAT_OVERHEAD_MAX_CHARS = 56;

type CombatTarget = Monster | Player;

/**
 * Olympia-style continuous status FX under the feet while a buff is active.
 * Keys map TemporaryEffectType → Effects.ts sprite (effect9 sheet for most protects/DS).
 */
const STATUS_FOOT_EFFECT_BY_TYPE: Partial<Record<TemporaryEffectType, string>> = {
    [TemporaryEffectType.Berserk]: EFFECT_BERSERK,
    [TemporaryEffectType.DefenseShield]: EFFECT_DEFENSE_SHIELD_BUFF,
    [TemporaryEffectType.GreatDefenseShield]: EFFECT_DEFENSE_SHIELD_BUFF,
    [TemporaryEffectType.ProtectFromArrow]: EFFECT_PROTECTION_FROM_ARROWS_BUFF,
    [TemporaryEffectType.ProtectFromMagic]: EFFECT_PROTECTION_RING,
    [TemporaryEffectType.AbsoluteMagicProtect]: EFFECT_ABSOLUTE_MAGIC_PROTECTION_BUFF,
    [TemporaryEffectType.Haste]: EFFECT_UNKNOWN_SMALL_RECOVERY_1,
    // Exp Tablet: visible underfoot ring (Olympia-style status FX while +200% EXP is active).
    [TemporaryEffectType.ExpBoost]: EFFECT_UNKNOWN_SMALL_RECOVERY_2,
};

function isMonsterCombatTarget(target: CombatTarget): target is Monster {
    return 'getMonsterId' in target && typeof target.getMonsterId === 'function';
}

function attackTypeFromNetworkValue(value: number): AttackType {
    if (
        value === AttackType.NoInterrupt ||
        value === AttackType.Interrupt ||
        value === AttackType.Stun ||
        value === AttackType.Knockback
    ) {
        return value;
    }
    console.warn('[Player] Invalid remote attack attackType', value);
    return AttackType.Stun;
}

/**
 * Represents the player character in the game.
 * Extends GameObject with combat (melee, bow, spell casting), movement (run, walk, dash),
 * equipment via PlayerAppearanceManager/InventoryManager, health/damage, and appearance
 * customization (gender, skin color, hair, underwear). Listens to EventBus for equip and
 * appearance changes.
 */

export class Player extends GameObject {
    private readonly appearanceManager: PlayerAppearanceManager;
    private readonly isLocalPlayer: boolean;
    private readonly movement = new PlayerMovementManager();
    private readonly rangedCombat = new PlayerRangedCombatManager();

    /** Handler for EQUIP_ITEM - stored for cleanup on destroy */
    private equipItemHandler?: (payload: { itemType: string; itemId?: number; itemUid: string; effectOverrides?: Effect[] }) => void;

    /** Handler for IN_UI_CHANGE_GENDER - stored for cleanup on destroy */
    private genderChangeHandler?: (gender: Gender) => void;
    /** Handler for IN_UI_CHANGE_SKIN_COLOR - stored for cleanup on destroy */
    private skinColorChangeHandler?: (skinColor: SkinColor) => void;
    /** Handler for IN_UI_CHANGE_UNDERWEAR_COLOR - stored for cleanup on destroy */
    private underwearColorChangeHandler?: (index: number) => void;
    /** Handler for IN_UI_CHANGE_HAIR_STYLE - stored for cleanup on destroy */
    private hairStyleChangeHandler?: (index: number) => void;

    /** Current animation state */
    private currentState: PlayerState;

    /** Attack mode: when true, idle uses combat stance; when false, idle uses peace stance */
    private attackMode: boolean = true;

    /** Run mode: when true, run at full speed; when false, walk at half speed */
    private runMode: boolean = true;

    /** Attack range in cells (Chebyshev distance) */
    private attackRange: number = DEFAULT_PLAYER_ATTACK_RANGE;

    /** Attack type - whether damage interrupts the target */
    private attackType: AttackType = AttackType.Stun;

    /** Attack animation frame rate (frames per second); default matches ~600 ms full swing. */
    private attackSpeed: number = calculateFrameRateFromDuration(8, 600);

    /** Arrow travel speed (px/s) from InitialGameWorldState; matches ranged hit timing. */
    private arrowSpeedPxPerSec = 1000;

    /** Full pickup animation duration (ms) from InitialGameWorldState; overwrites the default when the scene applies world state. */
    private playerPickupAnimationMs = 400;

    /** Duration for the current synced pickup animation. */
    private remotePickupAnimationDurationMs: number | undefined = undefined;

    /** Full bow stance animation duration (ms) from InitialGameWorldState. */
    private playerBowAnimationDurationMs = 400;

    /** Duration for the current synced bow stance animation. */
    private remoteBowStanceAnimationDurationMs: number | undefined = undefined;


    /** Previous attack FPS restored after a synced attack animation. */
    private remoteAttackSpeedBackup: number | undefined = undefined;

    /**
     * Cast animation / bar duration (ms). Local: from `setCastDurationMs` (Player dialog / `InitialGameWorldState`).
     * Remote: default `1200` when not observing a cast; each `queueRemoteSpellCastStart` overwrites from server `cast_speed_ms`, then resets to `1200` when leaving Cast/CastReady.
     */
    private castSpeed: number = 1200;

    /** Casting circle effect instance (created when entering Cast state) */
    private castingCircleEffect: ReturnType<typeof drawEffect> | undefined = undefined;

    /** SoundManager instance for playing sound effects */
    private readonly soundManager: SoundManager;

    /** When true, the next state switch skips its sound side effects. */
    private suppressNextStateSound = false;

    /** Monster or player targeted for attack when out of range (pathfind towards on release) */
    private attackTarget: CombatTarget | undefined = undefined;
    private playerId: string | undefined = undefined;
    /** Remote: server `PlayerEnteredRange.character_name` for UI hover. */
    private characterName = '';
    /** Citizenship for Olympia DrawObjectName hover: aresden | elvine | traveler. */
    private citizenshipSide = 'traveler';
    private activeSpellName: string | undefined = undefined;

    /** Olympia `name: text` overhead while chatting (Parity P1.3). */
    private chatOverheadText: Phaser.GameObjects.Text | undefined = undefined;
    private chatOverheadExpiresAtMs = 0;

    /** When true, player is dashing: moving with attack animation instead of run animation */
    private dashMode: boolean = false;
    /** Dash flag to apply on the next deferred movement step once this sprite is aligned. */
    private queuedDashModeForNextMove: boolean | undefined = undefined;

    /** Pending spell ID when cast is commanded from UI (targeting or CastReady) */
    private pendingSpellId: number | undefined = undefined;

    /** Queued spell cast when player is moving - executed when reaching next cell */
    private queuedCastSpellId: number | undefined = undefined;
    private pendingUseCastAnimation = true;
    private queuedCastUseAnimation = true;


    /**
     * Local player only: wall-clock time (ms, Date.now()) after which movement requests are allowed again.
     * Matches the interrupt-stunlock deadline without relying on frame delta or TakeDamage* state.
     * 0 means no movement stunlock from this mechanism.
     */
    private localPlayerMovementStunlockUntilUnixMs = 0;

    /** Frame rate for idle animations (always 10 FPS) */
    private readonly IDLE_FRAME_RATE: number = 10;

    /** Number of frames in running animation (standard for all player animations) */
    private readonly RUNNING_FRAME_COUNT: number = 8;

    /** Whether the player is dead (in Die state) */
    private dead: boolean = false;

    /** Whether this player is visually disconnected due to a temporary disconnect. */
    public disconnected = false;

    /** Health bar graphics - 30px wide, 2 cells above player when alive */
    private healthBarGraphics: Phaser.GameObjects.Graphics;

    /** World-space skull above opposing-city enemies (Olympia FOE/PK cue; no PK proto field yet). */
    private enemySkullMarker: Phaser.GameObjects.Text | undefined;

    /** Accumulator for STAR_TWINKLE spawn interval (ms). Spawns sparkles above player when equipped. */
    private starTwinkleAccumulatorMs: number = 0;

    /** Per-player equipped items used for passive/effect checks so remote players do not read the local inventory manager. */
    private equippedItemsForEffects: Partial<Record<EquipmentSlot, InventoryItem>> = {};

    /** Looping Olympia status FX under feet (Defense Shield, PFA, AMP, Berserk, …). */
    private readonly statusFootEffects = new Map<number, VisualEffect>();

    /** Start offset for the current course-correction step. */
    private correctionStartOffsetX: number | undefined = undefined;
    private correctionStartOffsetY: number | undefined = undefined;
    private correctionDurationMs: number | undefined = undefined;

    /** Timestamp (ms) when paralysis ends. Movement commands are blocked until then. */
    private paralysisUntil: number | undefined = undefined;

    /** When set, TakeDamage states stretch animation to this duration from the damage packet. */
    private takeDamageAnimationDurationMs: number | undefined = undefined;

    /**
     * When TakeDamage / TakeDamageOnMove begins (`performance.now()` ms).
     * Keeps those states from exiting on the first frame the primary asset reports not playing
     * before the stretched take-damage clip has started (jarring when the stun duration is short).
     */
    private takeDamageVisualEnteredAtMs = 0;

    /**
     * Creates a new Player instance.
     *
     * @param scene - The Phaser scene to add the player to
     * @param worldX - X coordinate in world map position
     * @param worldY - Y coordinate in world map position
     * @param direction - Facing for directional sprites; for remote players use `PlayerEnteredRange.direction` (0–7, CoordinateUtils.Direction).
     * @param soundManager - SoundManager instance for playing sound effects
     * @param map - HBMap instance for collision checking
     * @param gear - Initial gear config; resolved from local inventory or remote visible equipment when not provided
     * @param movementSpeedMs - Per-tile step duration in ms (server or dialog); clamped 100–1000 like {@link setMovementSpeed}.
     */
    constructor(
        scene: Scene,
        worldX: number,
        worldY: number,
        direction: Direction = Direction.NorthEast,
        soundManager: SoundManager,
        map: HBMap,
        gear: GearConfig = DEFAULT_GEAR,
        movementSpeedMs: number,
        isLocalPlayer: boolean = true,
        initialVisibleEquippedItems: Partial<
            Record<ItemTypes, { itemId: number; effectOverrides?: Effect[]; itemColor?: number }>
        > = {},
        remoteAppearance?: { gender: Gender; skinColor: SkinColor; underwearColorIndex: number; hairStyleIndex: number },
    ) {
        // Local: Player dialog store (server sync via OUT_UI). Remote: server snapshot.
        const initialGender =
            !isLocalPlayer && remoteAppearance !== undefined ? remoteAppearance.gender : playerDialogStore.state.gender;
        const initialSkinColor =
            !isLocalPlayer && remoteAppearance !== undefined ? remoteAppearance.skinColor : playerDialogStore.state.skinColor;
        const initialGear: GearConfig = {
            ...gear,
            human: PlayerAppearanceManager.getHumanSpriteName(initialGender, initialSkinColor),
            underwearColorIndex:
                !isLocalPlayer && remoteAppearance !== undefined
                    ? remoteAppearance.underwearColorIndex
                    : playerDialogStore.state.underwearColorIndex,
            hairStyleIndex:
                !isLocalPlayer && remoteAppearance !== undefined
                    ? remoteAppearance.hairStyleIndex
                    : playerDialogStore.state.hairStyleIndex,
        };
        const resolvedGear = PlayerAppearanceManager.resolveGearFromEquippedItems(
            initialGear,
            isLocalPlayer ? getInventoryManager(scene.game).equippedItems : initialVisibleEquippedItems,
            initialGender,
        );
        const { configs: assetConfigs, assetIndices } = PlayerAppearanceManager.buildAssetConfigs(
            direction,
            PlayerState.IdlePeaceMode,
            resolvedGear,
        );

        // Add animation frame change callback to the weapon asset for attack damage/sound/arrows.
        const weaponConfig = assetIndices.weaponAssetIndex >= 0 ? assetConfigs[assetIndices.weaponAssetIndex] : undefined;
        if (weaponConfig) {
            weaponConfig.onAnimationFrameChange = (relativeFrameIndex: number) =>
                this.onWeaponAnimationFrameChange(relativeFrameIndex);
        }

        const clampedMovementSpeedMs = Phaser.Math.Clamp(movementSpeedMs, 100, 1000);
        super(scene, {
            x: worldX,
            y: worldY,
            assets: assetConfigs,
            soundManager,
            map,
            movementSpeedMs: clampedMovementSpeedMs,
            stunlockDurationMs: 0,
        });

        this.isLocalPlayer = isLocalPlayer;
        if (!isLocalPlayer) {
            this.autoSwitchToIdle = false;
        }
        this.appearanceManager = new PlayerAppearanceManager(
            this.assets,
            initialGender,
            resolvedGear,
            assetIndices,
            scene,
            () => this.switchPlayerState(this.currentState, true),
        );
        this.soundManager = soundManager;
        this.hp = 1000;
        this.maxHp = 1000;

        this.direction = direction;
        this.currentState = PlayerState.IdlePeaceMode;

        // Create shadow manager
        const initialShadowSpriteSheetIndex = this.appearanceManager.getShadowSpriteSheetIndex(PlayerState.IdlePeaceMode, direction);
        this.shadowManager = new ShadowManager({
            scene,
            shadowSpriteName: this.appearanceManager.getHumanSpriteName(),
            shadowSpriteSheetIndex: initialShadowSpriteSheetIndex,
            worldX,
            worldY,
            frameRate: this.IDLE_FRAME_RATE,
        });

        // Center the player in the initial cell
        this.updatePixelPosition();

        // Create health bar (20px wide, 2 cells above player when alive)
        this.healthBarGraphics = this.scene.add.graphics().setVisible(false);

        if (this.isLocalPlayer) {
            // Listen for gender change from UI
            this.genderChangeHandler = (gender: Gender) => {
                this.applyAppearanceChange(gender, playerDialogStore.state.skinColor);
            };
            EventBus.on(IN_UI_CHANGE_GENDER, this.genderChangeHandler);

            // Listen for skin color change from UI
            this.skinColorChangeHandler = (skinColor: SkinColor) => {
                this.applyAppearanceChange(playerDialogStore.state.gender, skinColor);
            };
            EventBus.on(IN_UI_CHANGE_SKIN_COLOR, this.skinColorChangeHandler);

            // Listen for underwear color change from UI
            this.underwearColorChangeHandler = (underwearColorIndex: number) => {
                this.applyAppearanceChange(
                    playerDialogStore.state.gender,
                    playerDialogStore.state.skinColor,
                    underwearColorIndex,
                );
            };
            EventBus.on(IN_UI_CHANGE_UNDERWEAR_COLOR, this.underwearColorChangeHandler);

            // Listen for hair style change from UI
            this.hairStyleChangeHandler = (hairStyleIndex: number) => {
                this.applyAppearanceChange(
                    playerDialogStore.state.gender,
                    playerDialogStore.state.skinColor,
                    undefined,
                    hairStyleIndex,
                );
            };
            EventBus.on(IN_UI_CHANGE_HAIR_STYLE, this.hairStyleChangeHandler);

            // Listen for equip events from InventoryManager
            const equipItemHandler = (payload: { itemType: string; itemId?: number; itemUid: string; effectOverrides?: Effect[] }) => {
                if (this.isEquipmentSlotKey(payload.itemType)) {
                    this.syncTrackedEquippedItem(payload.itemType, payload.itemId, payload.itemUid, payload.effectOverrides);
                }
                if (payload.itemType === ItemTypes.WEAPON ||
                    payload.itemType === ItemTypes.SHIELD ||
                    payload.itemType === ItemTypes.ARMOR ||
                    payload.itemType === ItemTypes.HAUBERK ||
                    payload.itemType === ItemTypes.LEGGINGS ||
                    payload.itemType === ItemTypes.BOOTS ||
                    payload.itemType === ItemTypes.HELMET ||
                    payload.itemType === ItemTypes.CAPE ||
                    payload.itemType === ItemTypes.ACCESSORY) {
                    this.onEquipItem(payload.itemType, payload.itemId, payload.effectOverrides);
                }
            };
            this.equipItemHandler = equipItemHandler;
            EventBus.on(EQUIP_ITEM, equipItemHandler);

            const equipped = getInventoryManager(scene.game).equippedItems;
            for (const [slot, item] of Object.entries(equipped)) {
                if (item && this.isEquipmentSlotKey(slot)) {
                    this.syncTrackedEquippedItem(slot, item.itemId, item.itemUid, item.effectOverrides);
                }
            }
            this.onEquipItem(ItemTypes.WEAPON, equipped[ItemTypes.WEAPON]?.itemId, equipped[ItemTypes.WEAPON]?.effectOverrides, equipped[ItemTypes.WEAPON]?.itemColor);
            this.onEquipItem(ItemTypes.SHIELD, equipped[ItemTypes.SHIELD]?.itemId, equipped[ItemTypes.SHIELD]?.effectOverrides, equipped[ItemTypes.SHIELD]?.itemColor);
            this.onEquipItem(ItemTypes.ARMOR, equipped[ItemTypes.ARMOR]?.itemId, equipped[ItemTypes.ARMOR]?.effectOverrides, equipped[ItemTypes.ARMOR]?.itemColor);
            this.onEquipItem(ItemTypes.HAUBERK, equipped[ItemTypes.HAUBERK]?.itemId, equipped[ItemTypes.HAUBERK]?.effectOverrides, equipped[ItemTypes.HAUBERK]?.itemColor);
            this.onEquipItem(ItemTypes.LEGGINGS, equipped[ItemTypes.LEGGINGS]?.itemId, equipped[ItemTypes.LEGGINGS]?.effectOverrides, equipped[ItemTypes.LEGGINGS]?.itemColor);
            this.onEquipItem(ItemTypes.BOOTS, equipped[ItemTypes.BOOTS]?.itemId, equipped[ItemTypes.BOOTS]?.effectOverrides, equipped[ItemTypes.BOOTS]?.itemColor);
            this.onEquipItem(ItemTypes.HELMET, equipped[ItemTypes.HELMET]?.itemId, equipped[ItemTypes.HELMET]?.effectOverrides, equipped[ItemTypes.HELMET]?.itemColor);
            this.onEquipItem(ItemTypes.CAPE, equipped[ItemTypes.CAPE]?.itemId, equipped[ItemTypes.CAPE]?.effectOverrides, equipped[ItemTypes.CAPE]?.itemColor);
            this.onEquipItem(ItemTypes.ACCESSORY, equipped[ItemTypes.ACCESSORY]?.itemId, equipped[ItemTypes.ACCESSORY]?.effectOverrides, equipped[ItemTypes.ACCESSORY]?.itemColor);
        } else {
            this.onEquipItem(ItemTypes.WEAPON, initialVisibleEquippedItems[ItemTypes.WEAPON]?.itemId, initialVisibleEquippedItems[ItemTypes.WEAPON]?.effectOverrides, initialVisibleEquippedItems[ItemTypes.WEAPON]?.itemColor);
            this.onEquipItem(ItemTypes.SHIELD, initialVisibleEquippedItems[ItemTypes.SHIELD]?.itemId, initialVisibleEquippedItems[ItemTypes.SHIELD]?.effectOverrides, initialVisibleEquippedItems[ItemTypes.SHIELD]?.itemColor);
            this.onEquipItem(ItemTypes.ARMOR, initialVisibleEquippedItems[ItemTypes.ARMOR]?.itemId, initialVisibleEquippedItems[ItemTypes.ARMOR]?.effectOverrides, initialVisibleEquippedItems[ItemTypes.ARMOR]?.itemColor);
            this.onEquipItem(ItemTypes.HAUBERK, initialVisibleEquippedItems[ItemTypes.HAUBERK]?.itemId, initialVisibleEquippedItems[ItemTypes.HAUBERK]?.effectOverrides, initialVisibleEquippedItems[ItemTypes.HAUBERK]?.itemColor);
            this.onEquipItem(ItemTypes.LEGGINGS, initialVisibleEquippedItems[ItemTypes.LEGGINGS]?.itemId, initialVisibleEquippedItems[ItemTypes.LEGGINGS]?.effectOverrides, initialVisibleEquippedItems[ItemTypes.LEGGINGS]?.itemColor);
            this.onEquipItem(ItemTypes.BOOTS, initialVisibleEquippedItems[ItemTypes.BOOTS]?.itemId, initialVisibleEquippedItems[ItemTypes.BOOTS]?.effectOverrides, initialVisibleEquippedItems[ItemTypes.BOOTS]?.itemColor);
            this.onEquipItem(ItemTypes.HELMET, initialVisibleEquippedItems[ItemTypes.HELMET]?.itemId, initialVisibleEquippedItems[ItemTypes.HELMET]?.effectOverrides, initialVisibleEquippedItems[ItemTypes.HELMET]?.itemColor);
            this.onEquipItem(ItemTypes.CAPE, initialVisibleEquippedItems[ItemTypes.CAPE]?.itemId, initialVisibleEquippedItems[ItemTypes.CAPE]?.effectOverrides, initialVisibleEquippedItems[ItemTypes.CAPE]?.itemColor);
            this.onEquipItem(ItemTypes.ACCESSORY, initialVisibleEquippedItems[ItemTypes.ACCESSORY]?.itemId, initialVisibleEquippedItems[ItemTypes.ACCESSORY]?.effectOverrides, initialVisibleEquippedItems[ItemTypes.ACCESSORY]?.itemColor);
            for (const [slot, item] of Object.entries(initialVisibleEquippedItems)) {
                if (item && this.isEquipmentSlotKey(slot)) {
                    this.syncTrackedEquippedItem(slot, item.itemId, '', item.effectOverrides);
                }
            }
        }
    }

    private onEquipItem(
        itemType: ItemTypes,
        itemId: number | undefined,
        effectOverrides?: Effect[],
        itemColor?: number,
    ): void {
        this.appearanceManager.handleEquip(itemType, itemId, effectOverrides, itemColor);
        this.switchPlayerState(this.currentState, true);
        this.updatePixelPosition();
    }

    public setRemoteVisibleEquippedItem(
        itemType: ItemTypes,
        itemId: number | undefined,
        effectOverrides?: Effect[],
        itemColor?: number,
    ): void {
        if (this.isLocalPlayer) {
            return;
        }
        if (!this.isEquipmentSlotKey(itemType)) {
            return;
        }

        this.syncTrackedEquippedItem(itemType, itemId, this.equippedItemsForEffects[itemType]?.itemUid ?? '', effectOverrides);
        this.onEquipItem(itemType, itemId, effectOverrides, itemColor);
    }

    private isEquipmentSlotKey(value: string): value is EquipmentSlot {
        return value === ItemTypes.WEAPON ||
            value === ItemTypes.SHIELD ||
            value === ItemTypes.ARMOR ||
            value === ItemTypes.HAUBERK ||
            value === ItemTypes.LEGGINGS ||
            value === ItemTypes.HELMET ||
            value === ItemTypes.CAPE ||
            value === ItemTypes.BOOTS ||
            value === ItemTypes.ACCESSORY ||
            value === ItemTypes.NECKLACE ||
            value === RING_SLOT_LEFT ||
            value === RING_SLOT_RIGHT;
    }

    private syncTrackedEquippedItem(slot: EquipmentSlot, itemId: number | undefined, itemUid: string, effectOverrides?: Effect[]): void {
        if (itemId === undefined) {
            this.equippedItemsForEffects[slot] = undefined;
            return;
        }

        this.equippedItemsForEffects[slot] = {
            itemId,
            itemUid,
            ...(effectOverrides?.length && { effectOverrides }),
        };
    }

    private getTrackedWeaponDef(): Item | undefined {
        const equippedWeapon = this.equippedItemsForEffects[ItemTypes.WEAPON];
        return equippedWeapon ? getItemById(equippedWeapon.itemId) : undefined;
    }

    private applyAppearanceChange(gender: Gender, skinColor: SkinColor, underwearColorIndex?: number, hairStyleIndex?: number): void {
        const inventoryManager = getInventoryManager(this.scene.game);
        this.appearanceManager.applyAppearanceChange(gender, skinColor, inventoryManager.equippedItems, this.currentState, this.direction, this.shadowManager, underwearColorIndex, hairStyleIndex);
        this.switchPlayerState(this.currentState, true);
    }

    private getEquippedItemsForRemoteAppearance(): Partial<
        Record<ItemTypes, { itemId: number; effectOverrides?: Effect[]; itemColor?: number }>
    > {
        const out: Partial<Record<ItemTypes, { itemId: number; effectOverrides?: Effect[]; itemColor?: number }>> = {};
        for (const slot of Object.values(ItemTypes)) {
            if (!this.isEquipmentSlotKey(slot)) {
                continue;
            }
            const item = this.equippedItemsForEffects[slot];
            if (item) {
                out[slot] = {
                    itemId: item.itemId,
                    effectOverrides: item.effectOverrides,
                    itemColor: item.itemColor,
                };
            }
        }
        return out;
    }

    /** Remote players: apply server-driven gender/skin/hair/underwear without touching local persistence. */
    public applyAppearance(
        gender: Gender,
        skinColor: SkinColor,
        underwearColorIndex: number,
        hairStyleIndex: number,
    ): void {
        if (this.isLocalPlayer) {
            return;
        }
        const uw = Math.max(0, Math.min(7, underwearColorIndex));
        const hair = Math.max(0, Math.min(7, hairStyleIndex));
        this.appearanceManager.applyAppearanceChange(
            gender,
            skinColor,
            this.getEquippedItemsForRemoteAppearance(),
            this.currentState,
            this.direction,
            this.shadowManager,
            uw,
            hair,
        );
        this.switchPlayerState(this.currentState, true);
    }

    protected override updateDepth(): void {
        // Visual Y (worldY + offsetY/TILE) so feet aren't buried mid-step when walking north.
        this.appearanceManager.updateDepth(this.getVisualWorldY(), this.direction, this.currentState);
    }

    protected override updatePixelPosition(): void {
        const finalPixelX = this.getAnimatedPixelX();
        const finalPixelY = this.getAnimatedPixelY();
        this.updateDepth();
        const ghostConfig = this.getGhostConfig();
        this.appearanceManager.updateAssetPositions(finalPixelX, finalPixelY, ghostConfig);
        this.updateShadowPosition();
        this.updateShadowDepth();
        this.updateChatOverheadPosition();
        this.updateStatusFootEffectPositions();
    }

    /**
     * Local player: movement stunlock uses wall clock against the armed deadline only (no ping-variance subtraction).
     * Other players: packet playback drives their actions, so the client does not block on stunlock.
     */
    protected override isStunlocked(): boolean {
        if (!this.isLocalPlayer) {
            return false;
        }
        const until = this.localPlayerMovementStunlockUntilUnixMs;
        return until > 0 && Date.now() < until;
    }

    private armLocalPlayerMovementStunlockFromNow(durationMs: number): void {
        if (!this.isLocalPlayer || durationMs <= 0) {
            return;
        }
        //const halfPingMs = Math.round((nm?.getLatestPing() ?? 0) / 2);
        //const nextUntil = Date.now() + durationMs + MOVEMENT_STUNLOCK_CLIENT_BUFFER_MS + halfPingMs;
        const nextUntil = Date.now() + durationMs;
        this.localPlayerMovementStunlockUntilUnixMs = Math.max(this.localPlayerMovementStunlockUntilUnixMs, nextUntil);
    }

    /**
     * Remote players keep delta stunlock for animation completion; local player uses wall clock only (see {@link isStunlocked}).
     */
    protected override updateStunlock(delta: number): void {
        if (this.isLocalPlayer) {
            if (this.localPlayerMovementStunlockUntilUnixMs > 0 && Date.now() >= this.localPlayerMovementStunlockUntilUnixMs) {
                this.localPlayerMovementStunlockUntilUnixMs = 0;
                this.onStunlockComplete();
            }
            return;
        }
        super.updateStunlock(delta);
    }

    /**
     * Returns ghost config while dashing and moving (trail behind sprite).
     */
    private getGhostConfig(): { enabled: boolean; offsetX: number; offsetY: number } | undefined {
        const showGhost = this.dashMode;
        if (!showGhost || !this.moving || (!this.isInMovementState() && !this.dashMode)) {
            return undefined;
        }
        const [dx, dy] = getDirectionOffset(this.direction);
        const progress = Math.min(this.movementElapsedTime / this.activeStepDurationMs, 1);
        const ghostDistance = 16 * (1 - progress);
        return {
            enabled: true,
            offsetX: -dx * ghostDistance,
            offsetY: -dy * ghostDistance,
        };
    }

    /**
     * Updates sound effects based on the player's state.
     * Movement sounds continue playing during direction changes; only stop when actually leaving movement.
     * Other players: no walking sounds; running sounds play spatially relative to self player.
     */
    private updateSound(newState: PlayerState): void {
        switch (newState) {
            case PlayerState.Run:
            case PlayerState.WalkPeaceMode:
            case PlayerState.WalkCombatMode: {
                if (!this.isLocalPlayer && (newState === PlayerState.WalkPeaceMode || newState === PlayerState.WalkCombatMode)) {
                    this.stopMovementSounds();
                    break;
                }
                const wasInMovementState = this.isInMovementState();
                const movementTypeChanged = wasInMovementState && (
                    (this.currentState === PlayerState.Run) !== (newState === PlayerState.Run)
                );
                if (!wasInMovementState || movementTypeChanged) {
                    this.stopMovementSounds();
                }
                // Always refresh loop timing (SoundTracker updates rate when interval unchanged but ms changed).
                // Needed for same-state movement steps (Run→Run / walk→walk) after step duration or run/walk toggle.
                this.playMovementLoopSoundFromMovementConfig();
                break;
            }
            case PlayerState.Cast:
                this.stopMovementSounds();
                // Play cast sound with duration matching castSpeed (in milliseconds)
                // Track by state so it can be stopped when casting is cancelled
                if (!this.isLocalPlayer) {
                    const spatialConfig = computeOtherPlayerSpatialConfig(
                        this.scene.game,
                        this.worldX,
                        this.worldY,
                        this.offsetX,
                        this.offsetY,
                        TILE_SIZE,
                    );
                    this.soundTracker.playOnce(PLAYER_CAST, this.castSpeed, spatialConfig, PlayerState.Cast);
                } else {
                    this.soundTracker.playOnce(PLAYER_CAST, this.castSpeed, undefined, PlayerState.Cast);
                }
                break;
            case PlayerState.MeleeAttack:
            case PlayerState.BowAttack:
            case PlayerState.BowStance:
            case PlayerState.IdlePeaceMode:
            case PlayerState.IdleCombatMode:
            case PlayerState.TakeDamage:
            case PlayerState.TakeDamageOnMove:
            case PlayerState.TakeDamageWithKnockback:
            case PlayerState.CastReady:
            case PlayerState.PickUp:
                this.stopMovementSounds();
                break;
            case PlayerState.Die: {
                const deathSound = this.getGender() === Gender.FEMALE ? FEMALE_DEATH : MALE_DEATH;
                if (!this.isLocalPlayer) {
                    const spatialConfig = computeOtherPlayerSpatialConfig(
                        this.scene.game,
                        this.worldX,
                        this.worldY,
                        this.offsetX,
                        this.offsetY,
                        TILE_SIZE,
                    );
                    this.soundTracker.playOnce(deathSound, undefined, spatialConfig);
                } else {
                    this.soundTracker.playOnce(deathSound);
                }
                break;
            }
            default:
                this.soundTracker.stopAllSounds();
        }
    }

    /**
     * Stops run and walk sounds.
     */
    private stopMovementSounds(): void {
        this.soundTracker.stopSound(PlayerState.Run);
        this.soundTracker.stopSound(PlayerState.WalkPeaceMode);
    }

    /**
     * Starts or refreshes the run/walk loop sound from {@link getMovementConfig} (e.g. after tile duration changes while already moving).
     * When a loop is already tracked, {@link SoundTracker.playInLoop} updates playback rate to match the new interval.
     */
    private playMovementLoopSoundFromMovementConfig(): void {
        const config = this.getMovementConfig();
        if (!this.isLocalPlayer && (config.state === PlayerState.WalkPeaceMode || config.state === PlayerState.WalkCombatMode)) {
            return;
        }
        const soundStateKey = config.state === PlayerState.Run ? PlayerState.Run : PlayerState.WalkPeaceMode;
        if (!this.isLocalPlayer && config.state === PlayerState.Run) {
            const spatialConfig = computeOtherPlayerSpatialConfig(
                this.scene.game,
                this.worldX,
                this.worldY,
                this.offsetX,
                this.offsetY,
                TILE_SIZE,
            );
            this.soundTracker.playInLoop(soundStateKey, config.soundKey, config.soundIntervalMs, spatialConfig);
        } else {
            this.soundTracker.playInLoop(soundStateKey, config.soundKey, config.soundIntervalMs);
        }
    }

    /**
     * Switches the player's animation state.
     * Updates all assets to use the new sprite sheet index corresponding to the state.
     */
    private switchPlayerState(newState: PlayerState, forceUpdate: boolean = false): void {
        if (this.currentState === newState && !forceUpdate) {
            return;
        }

        if (this.suppressNextStateSound) {
            this.suppressNextStateSound = false;
            this.stopMovementSounds();
        } else {
            this.updateSound(newState);
        }

        const previousState = this.currentState;

        if (previousState === PlayerState.BowAttack && newState !== PlayerState.BowAttack) {
            this.cancelPendingBowArrowSpawn();
        }

        if (!this.isLocalPlayer &&
            (previousState === PlayerState.MeleeAttack || previousState === PlayerState.BowAttack) &&
            newState !== PlayerState.MeleeAttack && newState !== PlayerState.BowAttack &&
            this.remoteAttackSpeedBackup !== undefined) {
            this.attackSpeed = this.remoteAttackSpeedBackup;
            this.remoteAttackSpeedBackup = undefined;
        }

        if (!this.isLocalPlayer &&
            (previousState === PlayerState.Cast || previousState === PlayerState.CastReady) &&
            newState !== PlayerState.Cast && newState !== PlayerState.CastReady) {
            this.castSpeed = 1200;
        }

        this.currentState = newState;

        if (newState === PlayerState.TakeDamage || newState === PlayerState.TakeDamageOnMove) {
            this.takeDamageVisualEnteredAtMs = performance.now();
        }

        if (newState !== PlayerState.TakeDamage && newState !== PlayerState.TakeDamageOnMove && newState !== PlayerState.TakeDamageWithKnockback) {
            this.takeDamageAnimationDurationMs = undefined;
        }

        if (previousState === PlayerState.PickUp && newState !== PlayerState.PickUp) {
            this.remotePickupAnimationDurationMs = undefined;
        }

        if (previousState === PlayerState.BowStance && newState !== PlayerState.BowStance) {
            this.remoteBowStanceAnimationDurationMs = undefined;
        }

        // Create casting circle effect when entering Cast state
        if (newState === PlayerState.Cast && previousState !== PlayerState.Cast) {
            this.createCastingCircleEffect();
            // Create floating text with spell name in green color
            this.createSpellNameFloatingText();
        }

        // Destroy casting circle effect when leaving Cast state
        if (previousState === PlayerState.Cast && newState !== PlayerState.Cast) {
            this.destroyCastingCircleEffect();
        }

        const stepMsForAnim = this.moving ? this.activeStepDurationMs : this.movementSpeedMs;
        const effectiveAttackSpeed = (this.dashMode && newState === PlayerState.MeleeAttack)
            ? calculateFrameRateFromDuration(this.RUNNING_FRAME_COUNT, stepMsForAnim)
            : this.attackSpeed;
        const appearanceAnimConfig: PlayerAppearanceAnimationConfig = {
            movementSpeedMs: stepMsForAnim,
            attackSpeed: effectiveAttackSpeed,
            castSpeed: this.castSpeed,
            idleFrameRate: this.IDLE_FRAME_RATE,
        };
        if (this.takeDamageAnimationDurationMs !== undefined) {
            appearanceAnimConfig.takeDamageAnimationDurationMs = this.takeDamageAnimationDurationMs;
        }
        if (newState === PlayerState.PickUp) {
            if (this.isLocalPlayer) {
                appearanceAnimConfig.pickupAnimationDurationMs = this.playerPickupAnimationMs;
            } else if (this.remotePickupAnimationDurationMs !== undefined) {
                appearanceAnimConfig.pickupAnimationDurationMs = this.remotePickupAnimationDurationMs;
            }
        }
        if (newState === PlayerState.BowStance) {
            if (this.isLocalPlayer) {
                appearanceAnimConfig.bowStanceAnimationDurationMs = this.playerBowAnimationDurationMs;
            } else if (this.remoteBowStanceAnimationDurationMs !== undefined) {
                appearanceAnimConfig.bowStanceAnimationDurationMs = this.remoteBowStanceAnimationDurationMs;
            }
        }
        this.appearanceManager.applyStateAppearance(newState, this.direction, appearanceAnimConfig);

        if (newState === PlayerState.Run || previousState === PlayerState.Run ||
            newState === PlayerState.MeleeAttack || previousState === PlayerState.MeleeAttack ||
            newState === PlayerState.BowAttack || previousState === PlayerState.BowAttack) {
            this.updateDepth();
        }
        this.appearanceManager.updateShadow(this.shadowManager, this.currentState, this.direction, appearanceAnimConfig);
    }

    /**
     * Called when the weapon asset's animation reaches a new frame (via onAnimationFrameChange callback).
     * At frame 2 (melee): attack sound, crit VFX, Storm Bringer; damage lands from `monster_take_damage`.
     * Bow release is timed at half swing via {@link scheduleBowArrowSpawn}.
     */
    private onWeaponAnimationFrameChange(relativeFrameIndex: number): void {
        if (this.currentState === PlayerState.MeleeAttack && relativeFrameIndex === 2) {
            // Always play regular attack sound
            this.soundTracker.playOnce(PLAYER_MELEE_ATTACK, calculateAnimationDuration(this.RUNNING_FRAME_COUNT, this.attackSpeed));
            // Play critical attack sound only for Knockback (melee or bow)
            const shouldPlayCriticalSound = this.attackType === AttackType.Knockback;
            if (shouldPlayCriticalSound && this.attackTarget) {
                const criticalSound = this.getGender() === Gender.FEMALE ? FEMALE_CRITICAL_ATTACK : MALE_CRITICAL_ATTACK;
                if (this.isLocalPlayer) {
                    this.soundTracker.playOnce(criticalSound);
                } else {
                    const spatialConfig = computeOtherPlayerSpatialConfig(
                        this.scene.game,
                        this.worldX,
                        this.worldY,
                        this.offsetX,
                        this.offsetY,
                        TILE_SIZE,
                    );
                    this.soundTracker.playOnce(criticalSound, undefined, spatialConfig);
                }
            }
            // Create critical strike projectile for melee knockback only
            if (this.attackType === AttackType.Knockback && this.attackTarget) {
                const sourcePixelX = this.getAnimatedPixelX();
                const sourcePixelY = this.getAnimatedPixelY() - TILE_SIZE;
                const targetPixelX = this.attackTarget.getAnimatedPixelX();
                const targetPixelY = this.attackTarget.getAnimatedPixelY() - this.attackTarget.getHeight() / 2;
                new CriticalStrikeProjectile(this.scene, {
                    sourcePixelX: sourcePixelX,
                    sourcePixelY: sourcePixelY,
                    targetPixelX: targetPixelX,
                    targetPixelY: targetPixelY,
                });
            }
            // Storm Bringer effect: create homing projectile when equipped weapon has STORM_BRINGER (melee only)
            const weaponDef = this.getTrackedWeaponDef();
            const equippedWeapon = this.equippedItemsForEffects[ItemTypes.WEAPON];
            if (equippedWeapon && this.attackTarget) {
                if (weaponDef?.effects?.some((e) => e.effect === ItemEffect.STORM_BRINGER)) {
                    new StormBringerEffect(this.scene, {
                        originPixelX: this.getAnimatedPixelX(),
                        originPixelY: this.getAnimatedPixelY(),
                        target: this.attackTarget,
                        speed: 500,
                    });
                }
            }
            // Melee damage is applied by `monster_take_damage`; bow damage uses the same path (rangedAttack + scheduled delay).
        }
    }

    private cancelPendingBowArrowSpawn(): void {
        this.rangedCombat.cancelPendingBowArrowSpawn();
    }

    /**
     * Bow: release sound and arrow VFX at half attack animation duration; damage lands through `monster_take_damage` just like melee.
     */
    private scheduleBowArrowSpawn(): void {
        this.cancelPendingBowArrowSpawn();
        const halfMs = calculateAnimationDuration(this.RUNNING_FRAME_COUNT, this.attackSpeed) / 2;
        this.rangedCombat.pendingBowArrowTimer = this.scene.time.delayedCall(halfMs, () => {
            this.rangedCombat.pendingBowArrowTimer = undefined;
            if (this.currentState !== PlayerState.BowAttack || !this.attackTarget) {
                return;
            }
            const weaponDef = this.getTrackedWeaponDef();
            if (weaponDef?.weaponType !== WeaponType.BOW) {
                return;
            }
            const target = this.attackTarget;
            const attackSoundDuration = calculateAnimationDuration(this.RUNNING_FRAME_COUNT, this.attackSpeed);
            this.soundTracker.playOnce(PLAYER_MELEE_ATTACK, attackSoundDuration);
            if (this.attackType === AttackType.Knockback) {
                const criticalSound = this.getGender() === Gender.FEMALE ? FEMALE_CRITICAL_ATTACK : MALE_CRITICAL_ATTACK;
                this.soundTracker.playOnce(criticalSound);
            }
            new ArrowProjectile(this.scene, {
                originPixelX: this.getAnimatedPixelX(),
                originPixelY: this.getAnimatedPixelY(),
                target,
                speed: this.arrowSpeedPxPerSec,
            });
        });
    }

    /**
     * Player reset/snap/course correction can clear a tile another actor still uses (one boolean per tile).
     * GameWorld re-applies monster and all player cells on HBMap.
     */
    private emitTileOccupancyReapplyRequested(): void {
        EventBus.emit(TILE_OCCUPANCY_REAPPLY_REQUESTED);
    }

    /**
     * Authoritative snap from server admin teleport (no reset-position sound, no stunlock).
     * Matches reset/cancel cleanup so movement, casting, and tile occupancy stay consistent.
     */
    public applyTeleport(x: number, y: number): void {
        this.cancelPendingBowArrowSpawn();
        this.attackTarget = undefined;
        this.dashMode = false;
        this.queuedDashModeForNextMove = undefined;
        this.correctionStartOffsetX = undefined;
        this.correctionStartOffsetY = undefined;
        this.correctionDurationMs = undefined;
        this.clearSpellState();
        if (this.currentState === PlayerState.Cast) {
            this.soundTracker.stopSound(PlayerState.Cast);
        }
        EventBus.emit(OUT_UI_CAST_REMOVED);
        this.stopMovementSounds();
        this.cancelMovement();
        this.pendingStunlockAfterMovement = false;
        this.movement.pendingSyncCommands = [];
        this.moving = false;
        this.offsetX = 0;
        this.offsetY = 0;
        this.destinationX = -1;
        this.destinationY = -1;
        this.moveReady = true;
        this.markCurrentTileFree();
        this.worldX = x;
        this.worldY = y;
        this.markCurrentTileOccupied();
        this.switchToIdle();
        this.updatePixelPosition();
        this.onPositionChanged(this.worldX, this.worldY);
        this.emitTileOccupancyReapplyRequested();
    }

    /**
     * Resets whatever state the player is in, switches to idle mode, moves to the given world
     * coordinates, and plays the reset position sound (C12 for male, C13 for female).
     * When reset-position sends remaining stunlock ms (e.g. stunlock movement violation), applies TakeDamage
     * animation and take-damage sound for that duration and stunlock so input stays blocked.
     */
    public resetPosition(x: number, y: number, remainingStunlockMs?: number): void {
        this.cancelPendingBowArrowSpawn();
        this.attackTarget = undefined;
        this.dashMode = false;
        this.queuedDashModeForNextMove = undefined;
        this.correctionStartOffsetX = undefined;
        this.correctionStartOffsetY = undefined;
        this.correctionDurationMs = undefined;
        this.clearSpellState();
        if (this.currentState === PlayerState.Cast) {
            this.soundTracker.stopSound(PlayerState.Cast);
        }
        EventBus.emit(OUT_UI_CAST_REMOVED);
        this.stopMovementSounds();
        this.cancelMovement();
        this.pendingStunlockAfterMovement = false;
        this.movement.pendingSyncCommands = [];
        this.moving = false;
        this.offsetX = 0;
        this.offsetY = 0;
        this.destinationX = -1;
        this.destinationY = -1;
        this.moveReady = true;
        this.markCurrentTileFree();
        this.worldX = x;
        this.worldY = y;
        this.markCurrentTileOccupied();
        this.switchToIdle();
        this.updatePixelPosition();
        this.onPositionChanged(this.worldX, this.worldY);
        this.emitTileOccupancyReapplyRequested();
        const resetSound = this.getGender() === Gender.FEMALE ? FEMALE_RESET_POSITION : MALE_RESET_POSITION;
        this.soundTracker.playOnce(resetSound);

        if (remainingStunlockMs !== undefined && remainingStunlockMs > 0) {
            // if (this.isLocalPlayer) {
            //     this.soundTracker.playOnce(PLAYER_TAKE_UNARMED_DAMAGE);
            // } else {
            //     const spatialConfig = this.calculateOtherPlayerSpatialConfig();
            //     this.soundTracker.playOnce(PLAYER_TAKE_UNARMED_DAMAGE, undefined, spatialConfig);
            // }
            this.applyInterruptDamageVisualAndStunlock(remainingStunlockMs);
        }
    }

    public startMovementStep(curX: number, curY: number, destX: number, destY: number, dashAttack: boolean): void {
        if (this.dead) {
            return;
        }

        this.movement.pendingRemoteIdleSwitchMs = undefined;
        const startPixelX = worldCellCenterPixelX(curX);
        const startPixelY = worldCellCenterPixelY(curY);
        const currentPixelX = this.getAnimatedPixelX();
        const currentPixelY = this.getAnimatedPixelY();
        const pixelDelta = Phaser.Math.Distance.Between(currentPixelX, currentPixelY, startPixelX, startPixelY);
        const isPixelPerfect = currentPixelX === startPixelX && currentPixelY === startPixelY;
        if (pixelDelta > TILE_SIZE) {
            this.snapToWorldPosition(curX, curY);
        } else if (!isPixelPerfect) {
            this.setOrReplaceDeferredMovement({ type: 'movementStep', curX, curY, destX, destY, dashAttack });
            return;
        }

        const direction = getNextDirection(curX, curY, destX, destY);
        if (direction === Direction.None) {
            return;
        }

        this.clearDeferredMovements();
        this.destinationX = destX;
        this.destinationY = destY;
        this.isDirectMovementMode = false;
        this.dashMode = dashAttack;
        super.move(direction);
    }

    /**
     * Remote players: instant move to authoritative cell (e.g. server teleport) without walk/run animation.
     */
    public snapRemoteToAuthoritativeCell(x: number, y: number): void {
        if (this.dead) {
            return;
        }
        this.snapToWorldPosition(x, y);
    }

    private snapToWorldPosition(x: number, y: number): void {
        this.attackTarget = undefined;
        this.dashMode = false;
        this.queuedDashModeForNextMove = undefined;
        this.correctionStartOffsetX = undefined;
        this.correctionStartOffsetY = undefined;
        this.correctionDurationMs = undefined;
        this.clearSpellState();
        this.movement.pendingSyncCommands = [];
        this.movement.pendingRemoteIdleSwitchMs = undefined;
        if (this.currentState === PlayerState.Cast) {
            this.soundTracker.stopSound(PlayerState.Cast);
        }
        this.stopMovementSounds();
        this.moving = false;
        this.moveReady = true;
        this.offsetX = 0;
        this.offsetY = 0;
        this.destinationX = -1;
        this.destinationY = -1;
        this.markCurrentTileFree();
        this.worldX = x;
        this.worldY = y;
        this.markCurrentTileOccupied();
        this.switchToIdle();
        this.updatePixelPosition();
        this.emitTileOccupancyReapplyRequested();
    }

    /**
     * Remote players: if the sprite is not at the center of the packet cell (e.g. mid-move lerp),
     * snap before playing attack so melee/bow origin matches the latest position.
     */
    private snapRemoteToAttackCellIfNeeded(worldX: number, worldY: number): void {
        const centerX = worldCellCenterPixelX(worldX);
        const centerY = worldCellCenterPixelY(worldY);
        if (this.getAnimatedPixelX() === centerX && this.getAnimatedPixelY() === centerY) {
            return;
        }
        this.snapToWorldPosition(worldX, worldY);
    }

    /**
     * Adjusts course to the corrected destination from the packet.
     * Cancels current state (attack, cast, etc.), then redirects movement from the current
     * pixel position towards the corrected cell without jumping. Recalculates offset and
     * direction from the current position.
     */
    public adjustCourse(curX: number, curY: number, destX: number, destY: number): void {
        if (this.dead) {
            return;
        }
        const isStillEnRouteToBlockedCell =
            this.moving &&
            getDistance(curX, curY, this.worldX, this.worldY) === 1 &&
            (this.offsetX !== 0 || this.offsetY !== 0);

        if (!isStillEnRouteToBlockedCell) {
            this.resetPosition(curX, curY);
            this.startCourseCorrectionStep(
                worldCellCenterPixelX(curX),
                worldCellCenterPixelY(curY),
                curX,
                curY,
                destX,
                destY
            );
            return;
        }

        const px = this.getAnimatedPixelX();
        const py = this.getAnimatedPixelY();
        this.correctionStartOffsetX = undefined;
        this.correctionStartOffsetY = undefined;

        this.attackTarget = undefined;
        this.dashMode = false;
        this.queuedDashModeForNextMove = undefined;
        this.clearSpellState();
        if (this.currentState === PlayerState.Cast) {
            this.soundTracker.stopSound(PlayerState.Cast);
        }
        EventBus.emit(OUT_UI_CAST_REMOVED);
        this.stopMovementSounds();
        this.cancelMovement();
        this.destinationX = -1;
        this.destinationY = -1;
        this.moveReady = false;
        this.switchToIdle();

        this.startCourseCorrectionStep(
            px,
            py,
            convertPixelPosToWorldPos(px),
            convertPixelPosToWorldPos(py),
            destX,
            destY
        );
    }

    private startCourseCorrectionStep(
        startPixelX: number,
        startPixelY: number,
        fromCellX: number,
        fromCellY: number,
        destX: number,
        destY: number
    ): void {
        const direction = getNextDirection(fromCellX, fromCellY, destX, destY);
        if (direction === Direction.None) {
            this.map.setTileOccupied(this.worldX, this.worldY, false);
            this.worldX = fromCellX;
            this.worldY = fromCellY;
            this.offsetX = 0;
            this.offsetY = 0;
            this.correctionStartOffsetX = undefined;
            this.correctionStartOffsetY = undefined;
            this.correctionDurationMs = undefined;
            // Critical: without this, moveReady stays false forever and all future walks hang.
            this.moving = false;
            this.moveReady = true;
            this.destinationX = -1;
            this.destinationY = -1;
            this.dashMode = false;
            this.map.setTileOccupied(fromCellX, fromCellY, true);
            this.switchToIdle();
            this.updatePixelPosition();
            this.emitTileOccupancyReapplyRequested();
            return;
        }

        const [dx, dy] = getDirectionOffset(direction);
        const nextCellX = fromCellX + dx;
        const nextCellY = fromCellY + dy;
        const nextCenterX = worldCellCenterPixelX(nextCellX);
        const nextCenterY = worldCellCenterPixelY(nextCellY);

        // Occupy the cell we are stepping into (next), not the final dest — marking dest early
        // leaves the intermediate cell free and the far cell permanently blocked for pathfinding.
        this.map.setTileOccupied(this.worldX, this.worldY, false);
        this.map.setTileOccupied(nextCellX, nextCellY, true);

        this.worldX = nextCellX;
        this.worldY = nextCellY;
        this.direction = direction;
        this.destinationX = destX;
        this.destinationY = destY;
        this.moving = true;
        this.moveReady = false;

        this.offsetX = startPixelX - nextCenterX;
        this.offsetY = startPixelY - nextCenterY;
        this.correctionStartOffsetX = this.offsetX;
        this.correctionStartOffsetY = this.offsetY;
        const remainingDistanceRatio = Math.max(Math.abs(this.offsetX), Math.abs(this.offsetY)) / TILE_SIZE;
        this.correctionDurationMs = Math.max(1, remainingDistanceRatio * this.activeStepDurationMs);
        this.movementElapsedTime = 0;
        this.switchToMovement(true);
        this.updatePixelPosition();
        this.emitTileOccupancyReapplyRequested();
    }

    /**
     * Switches to idle state based on attack mode.
     * When attackMode is true: IdleCombatMode. When false: IdlePeaceMode.
     */
    public switchToIdle(): void {
        const idleState = this.attackMode ? PlayerState.IdleCombatMode : PlayerState.IdlePeaceMode;
        this.switchPlayerState(idleState, true);
    }

    /**
     * Sets attack mode (true = combat stance when idle, false = peace stance).
     * If currently in an idle state, updates the displayed stance immediately.
     */
    public setAttackMode(enabled: boolean): void {
        this.attackMode = enabled;
        if (this.currentState === PlayerState.IdlePeaceMode || this.currentState === PlayerState.IdleCombatMode) {
            this.switchToIdle();
        } else if (this.isInMovementState()) {
            this.switchToMovement(true);
        }
    }

    /**
     * Switches to movement state (Run, WalkPeaceMode, or WalkCombatMode).
     * Determines state, speed, sound, and animation based on runMode and attackMode.
     */
    public switchToMovement(forceUpdate: boolean = false): void {
        const config = this.getMovementConfig();
        this.switchPlayerState(config.state, forceUpdate);
    }

    /**
     * Returns true when in a movement state (Run, WalkPeaceMode, WalkCombatMode).
     */
    private isInMovementState(): boolean {
        return this.currentState === PlayerState.Run ||
            this.currentState === PlayerState.WalkPeaceMode ||
            this.currentState === PlayerState.WalkCombatMode;
    }

    /**
     * Gets movement config: state, duration, frame rate, sound key, and sound interval.
     * Sprite frame rate uses the active step duration while mid-move so the cycle finishes at cell arrival.
     * Footstep loop interval uses {@link movementSpeedMs} so run/walk toggles and speed changes apply immediately.
     */
    private getMovementConfig(): {
        state: PlayerState;
        movementSpeedMs: number;
        frameRate: number;
        soundKey: string;
        soundIntervalMs: number;
    } {
        const stepMsForAnim = this.moving ? this.activeStepDurationMs : this.movementSpeedMs;
        const frameRate = calculateFrameRateFromDuration(this.RUNNING_FRAME_COUNT, stepMsForAnim);
        const soundFrameRate = calculateFrameRateFromDuration(this.RUNNING_FRAME_COUNT, this.movementSpeedMs);
        const soundIntervalMs = calculateAnimationDuration(this.RUNNING_FRAME_COUNT, soundFrameRate) / 2;
        if (this.runMode) {
            return {
                state: PlayerState.Run,
                movementSpeedMs: stepMsForAnim,
                frameRate,
                soundKey: PLAYER_RUNNING,
                soundIntervalMs,
            };
        }
        const walkState = this.attackMode ? PlayerState.WalkCombatMode : PlayerState.WalkPeaceMode;
        return {
            state: walkState,
            movementSpeedMs: stepMsForAnim,
            frameRate,
            soundKey: PLAYER_WALKING,
            soundIntervalMs,
        };
    }

    /**
     * Sets run mode (true = run, false = walk at half speed).
     * If currently in a movement state, updates immediately.
     */
    public setRunMode(enabled: boolean): void {
        this.runMode = enabled;
        if (this.isInMovementState()) {
            this.switchToMovement(true);
        }
    }

    /**
     * Sets run/walk mode and effective per-tile duration together (UI toggle, server movement-state sync).
     * Single refresh avoids transient mismatch if {@link setMovementSpeed} and {@link setRunMode} run separately.
     */
    public setRunModeAndMovementSpeed(enabled: boolean, effectiveMovementSpeedMs: number): void {
        const clampedMs = Phaser.Math.Clamp(effectiveMovementSpeedMs, 100, 1000);
        this.runMode = enabled;
        this.movementSpeedMs = clampedMs;
        if (this.isInMovementState()) {
            this.switchToMovement(true);
        }
    }

    /**
     * Checks if the player is currently in attack state.
     */
    public isAttacking(): boolean {
        return this.currentState === PlayerState.MeleeAttack || this.currentState === PlayerState.BowAttack;
    }

    /**
     * Returns true when the player is in BowStance state (peace mode bow pose, no damage).
     */
    public isInBowStance(): boolean {
        return this.currentState === PlayerState.BowStance;
    }

    /**
     * Returns true when the player is in Cast state (spell cast animation playing).
     */
    public isCasting(): boolean {
        return this.currentState === PlayerState.Cast;
    }

    /**
     * Returns true when the player is in CastReady state (cast animation done, waiting for left click to target).
     */
    public isCastReady(): boolean {
        return this.currentState === PlayerState.CastReady;
    }

    /**
     * Sets the paralysis end timestamp. Movement commands are blocked until this time.
     */
    public setParalysisUntil(timestampMs: number): void {
        this.paralysisUntil = timestampMs;
    }

    /**
     * Returns true when the player is paralyzed (anti-cheat packet timer or spell HOLDOBJECT temporary effect).
     * Movement commands are blocked until the effect ends.
     */
    public isParalyzed(): boolean {
        if (this.hasTemporaryEffect(TemporaryEffectType.Paralyze)) {
            return true;
        }
        if (this.paralysisUntil === undefined) {
            return false;
        }
        return Date.now() < this.paralysisUntil;
    }

    /**
     * Returns true when a spell is pending (either in Cast, CastReady, or queued while moving).
     */
    public hasPendingSpell(): boolean {
        return this.pendingSpellId !== undefined || this.queuedCastSpellId !== undefined;
    }

    /**
     * Hard-stop pathing so cast never “finishes the walk” to the aim cell.
     * Snaps mid-tile offset to the current grid cell (Olympia: cast freezes feet).
     */
    public hardStopForCast(): void {
        this.cancelMovement();
        this.attackTarget = undefined;
        this.queuedDashModeForNextMove = undefined;
        this.dashMode = false;
        if (this.moving || this.offsetX !== 0 || this.offsetY !== 0) {
            this.moving = false;
            this.offsetX = 0;
            this.offsetY = 0;
            this.moveReady = true;
            this.movementElapsedTime = 0;
            this.destinationX = -1;
            this.destinationY = -1;
            this.updatePixelPosition();
        }
        if (this.isLocalPlayer) {
            this.movement.pendingSyncCommands = this.movement.pendingSyncCommands.filter(
                (c) => c.type !== 'idleDirection' && c.type !== 'movementStep',
            );
        }
    }

    /**
     * Called when cast is commanded from UI (Olympia magic book).
     * Always stops movement immediately and starts cast (no finish-the-walk).
     */
    public requestCast(spellId: number, useCastAnimation = true): void {
        if (this.dead || this.hasPendingSpell()) {
            return;
        }
        if (this.hasTemporaryEffect(TemporaryEffectType.Inhibition)) {
            return;
        }
        const spellConfig = getSpellById(spellId);
        if (!spellConfig) {
            return;
        }
        this.activeSpellName = spellConfig.name;
        // Drop any queued walk-to-cast; cast now.
        this.queuedCastSpellId = undefined;
        this.hardStopForCast();
        this.pendingSpellId = spellId;
        this.pendingUseCastAnimation = useCastAnimation;
        if (useCastAnimation) {
            this.switchPlayerState(PlayerState.Cast, true);
            this.emitCastStarted(spellId);
        } else {
            EventBus.emit(OUT_UI_CAST_READY);
            if (spellConfig.targetType === 'self') {
                this.tryAutoConfirmSelfSpell();
            }
        }
    }

    /** Self-target spells (Recall, Heal, shields…) fire immediately without a ground click. */
    private tryAutoConfirmSelfSpell(): void {
        if (this.pendingSpellId === undefined) {
            return;
        }
        const spellConfig = getSpellById(this.pendingSpellId);
        if (spellConfig?.targetType !== 'self') {
            return;
        }
        const spellId = this.pendingSpellId;
        this.pendingSpellId = undefined;
        this.pendingUseCastAnimation = false;
        if (this.currentState === PlayerState.CastReady || this.currentState === PlayerState.Cast) {
            this.switchToIdle();
        }
        this.activeSpellName = undefined;
        const originPixelX = this.getAnimatedPixelX();
        const originPixelY = this.getAnimatedPixelY();
        EventBus.emit(PLAYER_CONFIRM_SPELL_TARGET, {
            spellId,
            originPixelX,
            originPixelY,
            targetPixelX: originPixelX,
            targetPixelY: originPixelY,
        });
        EventBus.emit(OUT_UI_CAST_REMOVED);
    }

    /**
     * Called when left click occurs in CastReady. Confirms spell target and emits
     * PLAYER_CONFIRM_SPELL_TARGET. Returns true if handled.
     */
    public onLeftClickAt(cursorPixelX: number, cursorPixelY: number): boolean {
        if (this.pendingSpellId === undefined) {
            return false;
        }
        if (this.pendingUseCastAnimation && this.currentState !== PlayerState.CastReady) {
            return false;
        }
        // Confirming aim must never path-run to the click cell.
        this.hardStopForCast();
        const spellId = this.pendingSpellId;
        this.pendingSpellId = undefined;
        this.pendingUseCastAnimation = false;
        if (this.currentState === PlayerState.CastReady) {
            this.switchToIdle();
        }
        this.activeSpellName = undefined;
        
        // Turn player towards the spell target direction (same logic as right-click in idle mode)
        const originPixelX = this.getAnimatedPixelX();
        const originPixelY = this.getAnimatedPixelY();
        const targetWorldX = convertPixelPosToWorldPos(cursorPixelX);
        const targetWorldY = convertPixelPosToWorldPos(cursorPixelY);
        
        const direction = getNextDirection(
            this.worldX,
            this.worldY,
            targetWorldX,
            targetWorldY
        );
        
        // Turn player towards cursor direction
        if (direction !== Direction.None) {
            this.turnTowardsDirection(direction);
        }
        
        EventBus.emit(PLAYER_CONFIRM_SPELL_TARGET, {
            spellId,
            originPixelX,
            originPixelY,
            targetPixelX: cursorPixelX,
            targetPixelY: cursorPixelY,
        });
        EventBus.emit(OUT_UI_CAST_REMOVED);
        return true;
    }

    /**
     * Self only: server rejected the cast request (arrived before minimum interval after cast start).
     */
    public onSpellCastRejected(): void {
        if (!this.isLocalPlayer) {
            return;
        }

        new FloatingText(this.scene, {
            text: 'Cast failed!',
            x: this.getAnimatedPixelX(),
            y: this.getAnimatedPixelY() - 3 * TILE_SIZE + 20,
            fontSize: 16,
            color: OLYMPIA_FLOATING_TEXT_COLORS.castFailed,
            bold: true,
            horizontalOffset: -2,
            upwardTravelPxPerSec: 30,
            totalDurationMs: 2000,
            fadeDurationMs: 1000,
        });
        this.soundTracker.playOnceUntracked(SPELL_CAST_FAILED);

        if (!this.hasPendingSpell()) {
            return;
        }
        this.clearSpellState();
        if (this.currentState === PlayerState.Cast || this.currentState === PlayerState.CastReady) {
            if (this.currentState === PlayerState.Cast) {
                this.soundTracker.stopSound(PlayerState.Cast);
            }
            this.switchToIdle();
        }
        EventBus.emit(OUT_UI_CAST_REMOVED);
    }

    /**
     * Called when right click occurs. Cancels pending or queued spell. Returns true if handled.
     */
    public onRightClick(): boolean {
        if (!this.hasPendingSpell()) {
            return false;
        }
        this.clearSpellState();
        if (this.currentState === PlayerState.Cast || this.currentState === PlayerState.CastReady) {
            // Stop cast sound if currently casting
            if (this.currentState === PlayerState.Cast) {
                this.soundTracker.stopSound(PlayerState.Cast);
            }
            this.switchToIdle();
        }
        if (this.isLocalPlayer) {
            getNetworkManager(this.scene.game)?.sendSpellCastCancelRequest();
        }
        EventBus.emit(OUT_UI_CAST_REMOVED);
        return true;
    }

    /**
     * Cancels pending or queued spell without notifying the server.
     * Used on shutdown and when the server already confirmed cancel (self).
     */
    public cancelPendingCast(): void {
        if (!this.hasPendingSpell() &&
            this.currentState !== PlayerState.Cast &&
            this.currentState !== PlayerState.CastReady) {
            return;
        }
        this.clearSpellState();
        if (this.currentState === PlayerState.Cast || this.currentState === PlayerState.CastReady) {
            if (this.currentState === PlayerState.Cast) {
                this.soundTracker.stopSound(PlayerState.Cast);
            }
            this.switchToIdle();
        }
        EventBus.emit(OUT_UI_CAST_REMOVED);
    }

    public queueRemoteSpellCastStart(spellName: string, castSpeedMs: number): void {
        if (this.isLocalPlayer) {
            return;
        }
        this.activeSpellName = spellName;
        this.castSpeed = Phaser.Math.Clamp(castSpeedMs, 200, 2000);
        this.snapRemoteToAttackCellIfNeeded(this.worldX, this.worldY);
        this.switchPlayerState(PlayerState.Cast, true);
        this.updatePixelPosition();
    }

    public clearRemoteSpellCast(): void {
        if (this.isLocalPlayer) {
            return;
        }
        this.activeSpellName = undefined;
        if (this.currentState === PlayerState.Cast || this.currentState === PlayerState.CastReady) {
            if (this.currentState === PlayerState.Cast) {
                this.soundTracker.stopSound(PlayerState.Cast);
            }
            this.switchToIdle();
            this.updatePixelPosition();
        }
    }

    /**
     * Self: floating damage text only (HP comes from world-state and `hp_updated`). Others: subtract HP, death, and floating text.
     */
    public override acceptDamage(damage: number): void {
        const originY = this.getAnimatedPixelY() - 3 * TILE_SIZE + 10;
        if (this.isLocalPlayer) {
            this.createDamageFloatingText(damage, originY, { kind: 'taken' });
            return;
        }
        this.hp -= damage;
        if (this.hp < 1) {
            this.announceDeath();
        }
        this.createDamageFloatingText(damage, originY, { kind: 'dealt' });
    }

    /**
     * Self HP from InitialGameWorldState or `hp_updated`.
     * Green Olympia heal floats when HP rises after the character is already alive in-world.
     */
    public setHp(hp: number, maxHp: number): void {
        const previousHp = this.hp;
        this.hp = hp;
        this.maxHp = maxHp;
        if (this.isLocalPlayer) {
            if (previousHp > 0 && hp > previousHp) {
                const originY = this.getAnimatedPixelY() - 3 * TILE_SIZE + 10;
                this.createDamageFloatingText(hp - previousHp, originY, { kind: 'heal' });
            }
            this.updateHealthBar();
        }
    }

    /**
     * Monster damage packet: for self, HP comes from `hp_updated`; take-damage sound and interrupt/stun visuals happen here.
     * {@link MonsterAttackType.Interrupt} uses the same animation as stun but never applies stunlock (`0` ms in the packet).
     * {@link MonsterAttackType.Knockback} applies stunlock timing like stun plus knockback interpolation toward dest when fields are present.
     */
    public applyMonsterDamage(
        damage: number,
        attackType: number,
        stunDurationMs: number,
        knockbackDurationMs?: number,
        destX?: number,
        destY?: number,
        knockbackFromX?: number,
        knockbackFromY?: number,
    ): void {
        if (this.dead) {
            return;
        }

        if (attackType !== MonsterAttackType.NoInterrupt) {
            this.cancelPickupAndBowStanceFromMonsterInterrupt();
        }

        this.acceptDamage(damage);
        if (this.dead) {
            return;
        }

        const hasKnockback =
            attackType === MonsterAttackType.Knockback &&
            knockbackDurationMs !== undefined &&
            knockbackDurationMs > 0 &&
            destX !== undefined &&
            destY !== undefined;

        const hasStunlockStun = attackType === MonsterAttackType.Stun && stunDurationMs > 0;
        const playsInterruptAnimation = attackType === MonsterAttackType.Interrupt || hasStunlockStun;

        if (hasKnockback) {
            if (this.isLocalPlayer) {
                this.soundTracker.playOnce(PLAYER_TAKE_UNARMED_DAMAGE);
            } else {
                const spatialConfig = computeOtherPlayerSpatialConfig(
                    this.scene.game,
                    this.worldX,
                    this.worldY,
                    this.offsetX,
                    this.offsetY,
                    TILE_SIZE,
                );
                this.soundTracker.playOnce(PLAYER_TAKE_UNARMED_DAMAGE, undefined, spatialConfig);
            }
            this.applyMonsterKnockback(stunDurationMs, knockbackDurationMs, destX, destY, knockbackFromX, knockbackFromY);
            return;
        }

        if (playsInterruptAnimation) {
            if (this.isLocalPlayer) {
                this.soundTracker.playOnce(PLAYER_TAKE_UNARMED_DAMAGE);
            } else {
                const spatialConfig = computeOtherPlayerSpatialConfig(
                    this.scene.game,
                    this.worldX,
                    this.worldY,
                    this.offsetX,
                    this.offsetY,
                    TILE_SIZE,
                );
                this.soundTracker.playOnce(PLAYER_TAKE_UNARMED_DAMAGE, undefined, spatialConfig);
            }
            if (attackType === MonsterAttackType.Interrupt) {
                this.applyInterruptDamage(0);
            } else {
                this.applyInterruptDamage(stunDurationMs);
            }
        }
    }

    /**
     * Knockback hit: stunlock and take-damage animation use `stunDurationMs`; knockback interpolation uses `knockbackDurationMs`.
     */
    private applyMonsterKnockback(
        stunDurationMs: number,
        knockbackDurationMs: number,
        destX: number,
        destY: number,
        knockbackFromX?: number,
        knockbackFromY?: number,
    ): void {
        this.interruptDamageFromSpellsAndTarget();
        this.stunlockDurationMs = stunDurationMs;
        this.takeDamageAnimationDurationMs = stunDurationMs > 0 ? stunDurationMs : undefined;
        this.armLocalPlayerMovementStunlockFromNow(stunDurationMs);
        const facingFromX =
            knockbackFromX !== undefined && knockbackFromY !== undefined ? knockbackFromX : this.worldX;
        const facingFromY =
            knockbackFromX !== undefined && knockbackFromY !== undefined ? knockbackFromY : this.worldY;
        const knockbackFacing = getNextDirection(facingFromX, facingFromY, destX, destY);
        if (knockbackFacing !== Direction.None) {
            this.direction = knockbackFacing;
        }
        this.applyKnockbackMovement(destX, destY, knockbackDurationMs, knockbackFromX, knockbackFromY);
        this.switchPlayerState(PlayerState.TakeDamageWithKnockback, true);
        this.emitTileOccupancyReapplyRequested();
    }

    /**
     * Overrides GameObject.announceDeath. Remote-only HP path; local lethal damage uses {@link applyDeath}.
     */
    protected override announceDeath(): void {
        this.enterDeathState();
    }

    /**
     * Death: frees tile, enters Die state, and opens the death dialog for self only.
     * @param killerName Optional PvP killer display name from the server attribution window.
     */
    public applyDeath(killerName?: string): void {
        if (!this.dead) {
            this.enterDeathState();
        }
        if (this.isLocalPlayer) {
            EventBus.emit(OUT_UI_PLAYER_DIED, { killerName: killerName?.trim() || undefined });
        }
    }

    public applySpawnedDeathState(): void {
        if (this.dead) {
            return;
        }
        this.enterDeathState(true);
    }

    private enterDeathState(skipAnimationAndSound: boolean = false): void {
        if (this.dead) {
            return;
        }
        this.clearTemporaryEffects();
        this.dead = true;
        this.localPlayerMovementStunlockUntilUnixMs = 0;
        this.attackTarget = undefined;
        this.dashMode = false;
        this.queuedDashModeForNextMove = undefined;
        this.soundTracker.stopAllSounds();
        this.cancelMovement();
        this.markCurrentTileFree();
        if (this.shadowManager) {
            this.shadowManager.destroy();
            this.shadowManager = undefined;
        }
        if (skipAnimationAndSound) {
            this.suppressNextStateSound = true;
        }
        this.switchPlayerState(PlayerState.Die, true);
        if (skipAnimationAndSound) {
            this.setCurrentStateToFinalFrame();
        }
    }

    private setCurrentStateToFinalFrame(): void {
        for (const asset of this.assets) {
            const frames = asset.sprite.anims.currentAnim?.frames;
            if (!frames || frames.length === 0) {
                continue;
            }
            asset.sprite.anims.setCurrentFrame(frames[frames.length - 1]);
            asset.sprite.anims.stop();
        }
    }

    /**
     * Returns true if the player is in dead state.
     */
    public isDead(): boolean {
        return this.dead;
    }

    public getGender(): Gender {
        return this.appearanceManager.getGender();
    }

    /** Live map layers for F5 paper-doll (exact same sprites as world). */
    public getVisibleSpritesForPaperDoll(): Array<{ sprite: import('phaser').GameObjects.Sprite; spriteName: string }> {
        return this.appearanceManager.getVisibleSpritesForCapture();
    }

    public getHairStyleIndex(): number {
        return this.appearanceManager.getHairStyleIndex();
    }

    public getUnderwearColorIndex(): number {
        return this.appearanceManager.getUnderwearColorIndex();
    }

    public getHumanSpriteName(): string {
        return this.appearanceManager.getHumanSpriteName();
    }

    /**
     * Resurrection: restores position, HP, shadow, idle state, and resurrection VFX.
     * Always applies even if the local dead flag was desynced (stuck corpse bug).
     */
    public applyResurrect(x: number, y: number, hp: number, maxHp: number): void {
        this.dead = false;
        this.setHp(hp, maxHp);
        this.worldX = x;
        this.worldY = y;
        this.updatePixelPosition();
        this.onPositionChanged(this.worldX, this.worldY);
        this.markCurrentTileOccupied();

        this.clearSpellState();

        const initialShadowSpriteSheetIndex = this.appearanceManager.getShadowSpriteSheetIndex(PlayerState.IdlePeaceMode, this.direction);
        this.shadowManager = new ShadowManager({
            scene: this.scene,
            shadowSpriteName: this.appearanceManager.getHumanSpriteName(),
            shadowSpriteSheetIndex: initialShadowSpriteSheetIndex,
            worldX: this.worldX,
            worldY: this.worldY,
            frameRate: this.IDLE_FRAME_RATE,
        });

        this.switchToIdle();

        drawEffect(this.scene, this.worldX, this.worldY, EFFECT_RESURRECTION);
    }

    /**
     * Drops queued remote pickup/bow stance and exits those states when interrupting monster damage arrives (`AttackType` is not `NoInterrupt`).
     */
    private cancelPickupAndBowStanceFromMonsterInterrupt(): void {
        this.movement.pendingSyncCommands = this.movement.pendingSyncCommands.filter((c) => c.type !== 'pickup' && c.type !== 'bowStance');
        if (this.currentState === PlayerState.PickUp) {
            this.remotePickupAnimationDurationMs = undefined;
            this.switchToIdle();
        } else if (this.currentState === PlayerState.BowStance) {
            this.remoteBowStanceAnimationDurationMs = undefined;
            this.attackTarget = undefined;
            this.switchToIdle();
        }
    }

    /**
     * Cancels attack target and pending spell/cast UI when damage interrupts the player.
     */
    private interruptDamageFromSpellsAndTarget(): void {
        this.attackTarget = undefined;

        if (this.hasPendingSpell()) {
            this.clearSpellState();
            if (this.currentState === PlayerState.Cast) {
                this.soundTracker.stopSound(PlayerState.Cast);
            }
            EventBus.emit(OUT_UI_CAST_REMOVED);
        }
    }

    /**
     * Sets stunlock duration for visuals, stretches take-damage animation to match, and switches to TakeDamage or TakeDamageOnMove.
     * Local player: arms movement stunlock deadline (wall clock + buffer); remote players use delta stunlock via GameObject hooks only when not local.
     */
    private applyInterruptDamageVisualAndStunlock(stunDurationMs: number): void {
        this.stunlockDurationMs = stunDurationMs;
        this.takeDamageAnimationDurationMs = stunDurationMs > 0 ? stunDurationMs : undefined;
        if (this.moving) {
            this.switchPlayerState(PlayerState.TakeDamageOnMove, true);
        } else {
            this.switchPlayerState(PlayerState.TakeDamage, true);
            if (stunDurationMs > 0 && !this.isLocalPlayer) {
                this.startStunlock();
            }
        }
        this.armLocalPlayerMovementStunlockFromNow(stunDurationMs);
    }

    /**
     * Packet-driven interrupt/stunlock (sound already played by caller). Does not cancel in-flight movement interpolation.
     */
    private applyInterruptDamage(stunDurationMs: number): void {
        this.interruptDamageFromSpellsAndTarget();
        this.applyInterruptDamageVisualAndStunlock(stunDurationMs);
    }

    /**
     * Gets the attack range in cells.
     */
    public getAttackRange(): number {
        return this.attackRange;
    }

    /**
     * Sets the attack speed from slider value (1-100).
     * Maps to attack animation FPS: 5 (min) to 30 (max).
     */
    public setAttackSpeed(sliderValue: number): void {
        const clampedValue = Phaser.Math.Clamp(sliderValue, 1, 100);
        this.attackSpeed = 5 + (clampedValue / 100) * (30 - 5);
        // Derive swing ms from FPS so hold-gate and packet lock stay in sync.
        this.attackSwingDurationMs = Math.max(
            200,
            Math.round((this.RUNNING_FRAME_COUNT / Math.max(1, this.attackSpeed)) * 1000),
        );
    }

    /**
     * Sets melee animation rate from the full-swing duration in ms (matches `InitialGameWorldState.attack_speed_ms`).
     */
    public setAttackSpeedFromDurationMs(durationMs: number): void {
        const ms = Phaser.Math.Clamp(durationMs, 200, 2000);
        this.attackSwingDurationMs = ms;
        this.attackSpeed = calculateFrameRateFromDuration(this.RUNNING_FRAME_COUNT, ms);
    }

    /** `arrow_speed_px_per_sec` from InitialGameWorldState. */
    public setArrowSpeedPxPerSec(pxPerSec: number): void {
        this.arrowSpeedPxPerSec = Phaser.Math.Clamp(pxPerSec, 1, 1_000_000);
    }

    /**
     * Plays another player's attack from a snapshot (melee or bow). Bow spawns a cosmetic arrow at half swing when the target monster exists in the scene.
     * `attack_type` drives knockback crit sound and melee {@link CriticalStrikeProjectile} via {@link onWeaponAnimationFrameChange}.
     */
    public playRemoteAttack(
        arrowSpeedPxPerSec: number,
        data: {
            direction: number;
            attackSpeedMs: number;
            ranged: boolean;
            target?: CombatTarget;
            worldX: number;
            worldY: number;
            attackType: number;
        },
    ): void {
        if (this.isLocalPlayer) {
            return;
        }
        this.cancelPendingBowArrowSpawn();
        this.snapRemoteToAttackCellIfNeeded(data.worldX, data.worldY);
        this.direction = toDirection(data.direction);
        if (this.remoteAttackSpeedBackup === undefined) {
            this.remoteAttackSpeedBackup = this.attackSpeed;
        }
        this.setAttackSpeedFromDurationMs(data.attackSpeedMs);
        this.attackType = attackTypeFromNetworkValue(data.attackType);
        if (data.target) {
            this.attackTarget = data.target;
        }
        if (data.ranged) {
            this.switchPlayerState(PlayerState.BowAttack, true);
            if (data.target) {
                const target = data.target;
                const attackTypeForBow = data.attackType;
                const halfMs = calculateAnimationDuration(this.RUNNING_FRAME_COUNT, this.attackSpeed) / 2;
                this.rangedCombat.pendingBowArrowTimer = this.scene.time.delayedCall(halfMs, () => {
                    this.rangedCombat.pendingBowArrowTimer = undefined;
                    if (this.currentState !== PlayerState.BowAttack) {
                        return;
                    }
                    if (attackTypeForBow === AttackType.Knockback) {
                        const criticalSound = this.getGender() === Gender.FEMALE ? FEMALE_CRITICAL_ATTACK : MALE_CRITICAL_ATTACK;
                        const spatialConfig = computeOtherPlayerSpatialConfig(
                            this.scene.game,
                            this.worldX,
                            this.worldY,
                            this.offsetX,
                            this.offsetY,
                            TILE_SIZE,
                        );
                        this.soundTracker.playOnce(criticalSound, undefined, spatialConfig);
                    }
                    new ArrowProjectile(this.scene, {
                        originPixelX: this.getAnimatedPixelX(),
                        originPixelY: this.getAnimatedPixelY(),
                        target,
                        speed: arrowSpeedPxPerSec,
                        onReachDestination: () => {
                            /* Cosmetic only; combat resolves from packets. */
                        },
                    });
                });
            }
        } else {
            this.switchPlayerState(PlayerState.MeleeAttack, true);
        }
        this.updatePixelPosition();
    }

    /**
     * Sets the attack range in cells (1-30).
     */
    public setAttackRange(range: number): void {
        this.attackRange = Phaser.Math.Clamp(range, 1, 30);
    }

    /**
     * Enables or disables spawn protection (green glow on the base body sprite only). Berserk overlay can show at the same time.
     */
    public setSpawnProtectionEffect(enabled: boolean): void {
        this.appearanceManager.setSpawnProtectionEffect(enabled);
        this.appearanceManager.getHumanBodyAsset()?.setSpawnProtectionGlow(enabled);
    }

    /** True while server spawn protection is active (not a valid PvP target for others). */
    public hasSpawnProtection(): boolean {
        return this.appearanceManager.hasSpawnProtectionEffect();
    }

    /**
     * Sets or clears the disconnected visual state for remote players.
     */
    public setDisconnected(disconnected: boolean): void {
        this.disconnected = disconnected;
        this.appearanceManager.setDisconnectedEffect(disconnected);
    }

    /**
     * Sets the attack type (NoInterrupt, Stun, or Knockback).
     */
    public setAttackType(attackType: AttackType): void {
        this.attackType = attackType;
    }

    public setPlayerId(playerId: string): void {
        this.playerId = playerId;
    }

    public getPlayerId(): string | undefined {
        return this.playerId;
    }

    public isLocalCharacter(): boolean {
        return this.isLocalPlayer;
    }

    public hasInvisibilityBuff(): boolean {
        return this.hasTemporaryEffect(TemporaryEffectType.Invisibility);
    }

    protected override onTemporaryEffectsChanged(): void {
        this.applyInvisibilityBuffIfPresent();
        this.appearanceManager.setChilledEffect(this.hasTemporaryEffect(TemporaryEffectType.Chill));
        this.appearanceManager.setBerserkEffect(this.hasTemporaryEffect(TemporaryEffectType.Berserk));
        if (this.isLocalPlayer && this.hasTemporaryEffect(TemporaryEffectType.Paralyze)) {
            this.cancelMovement();
        }
        this.syncStatusFootEffects();
    }

    /**
     * Olympia: active buffs show a looping status shadow/ring at the character's feet
     * (Defense Shield, PFA, PFM, AMP, Berserk, Haste).
     */
    private syncStatusFootEffects(): void {
        // Remote invisibility: no status silhouette under a hidden body.
        if (!this.isLocalPlayer && this.hasInvisibilityBuff()) {
            this.destroyStatusFootEffects();
            return;
        }
        const wanted = new Set<number>();
        for (const [typeKey, effectKey] of Object.entries(STATUS_FOOT_EFFECT_BY_TYPE)) {
            const effectType = Number(typeKey);
            if (!this.hasTemporaryEffect(effectType)) {
                continue;
            }
            wanted.add(effectType);
            if (this.statusFootEffects.has(effectType)) {
                continue;
            }
            const fx = drawEffectAtPixelCoords(
                this.scene,
                this.getAnimatedPixelX(),
                this.getAnimatedPixelY(),
                effectKey,
                {
                    infiniteLoop: true,
                    // Under body layers, above carpets/map objects (ENTITY 50, STATUS_FOOT 40).
                    depthOffset: 40,
                    playerWorldY: this.worldY,
                },
            );
            if (fx) {
                this.statusFootEffects.set(effectType, fx);
            }
        }
        for (const [effectType, fx] of [...this.statusFootEffects.entries()]) {
            if (!wanted.has(effectType)) {
                fx.destroy();
                this.statusFootEffects.delete(effectType);
            }
        }
    }

    private updateStatusFootEffectPositions(): void {
        if (this.statusFootEffects.size === 0) {
            return;
        }
        const px = this.getAnimatedPixelX();
        const py = this.getAnimatedPixelY();
        for (const fx of this.statusFootEffects.values()) {
            fx.setPosition(px, py);
        }
    }

    private destroyStatusFootEffects(): void {
        for (const fx of this.statusFootEffects.values()) {
            fx.destroy();
        }
        this.statusFootEffects.clear();
    }

    private applyInvisibilityBuffIfPresent(): void {
        const inv = this.hasInvisibilityBuff();
        if (this.isLocalPlayer) {
            this.appearanceManager.setInvisibilityLocalHalfOpacity(inv);
            this.appearanceManager.setInvisibilityRemoteHidden(false);
        } else {
            this.appearanceManager.setInvisibilityLocalHalfOpacity(false);
            this.appearanceManager.setInvisibilityRemoteHidden(inv);
            // Fully hide FOE markers / chat bubbles on remote invi (sprites alone left silhouettes).
            if (inv) {
                this.clearEnemySkullMarker();
                this.clearChatOverhead();
            }
        }
        if (this.shadowManager) {
            if (!this.isLocalPlayer && inv) {
                this.shadowManager.setAlpha(0);
            } else {
                this.shadowManager.setAlpha(1);
            }
        }
    }

    public setCharacterName(name: string): void {
        this.characterName = name.trim();
    }

    public getCharacterName(): string {
        return this.characterName;
    }

    /**
     * Shows Olympia-style chat overhead above this player (`Name: message`, ~10 s).
     * Replaces any prior overhead from the same speaker. Color follows chat channel.
     */
    public showChatOverhead(message: string, color: string = OLYMPIA_CHAT_COLORS.normal): void {
        const trimmed = message.trim();
        if (!trimmed) {
            return;
        }
        const name = this.characterName.trim() || '???';
        const body =
            trimmed.length > CHAT_OVERHEAD_MAX_CHARS
                ? `${trimmed.slice(0, CHAT_OVERHEAD_MAX_CHARS - 1)}…`
                : trimmed;
        const label = `${name}: ${body}`;

        this.clearChatOverhead();
        this.chatOverheadText = this.scene.add.text(
            this.getAnimatedPixelX(),
            this.getAnimatedPixelY() - 3 * TILE_SIZE,
            label,
            olympiaPhaserOutlinedTextStyle(color, {
                fontSize: '13px',
                fontStyle: 'bold',
                wordWrap: { width: 220 },
                align: 'center',
            }),
        );
        this.chatOverheadText.setOrigin(0.5, 1);
        this.chatOverheadText.setDepth(FLOATING_TEXT_DEPTH);
        this.chatOverheadExpiresAtMs = this.scene.time.now + CHAT_OVERHEAD_DURATION_MS;
    }

    /** Sets citizenship side used by player hover affiliation / FOE coloring. */
    public setCitizenshipSide(side: string): void {
        const normalized = side.trim().toLowerCase();
        if (normalized === 'aresden' || normalized === 'elvine') {
            this.citizenshipSide = normalized;
            return;
        }
        this.citizenshipSide = 'traveler';
    }

    public getCitizenshipSide(): string {
        return this.citizenshipSide;
    }

    /**
     * Gets the current attack target (monster or player to pathfind towards when out of range).
     */
    public getAttackTarget(): CombatTarget | undefined {
        return this.attackTarget;
    }

    /**
     * Clears the attack target (e.g., when target monster dies).
     */
    public clearAttackTarget(): void {
        this.attackTarget = undefined;
    }

    /**
     * Standstill attack (Olympia right-click): cancel pathfinding and strike only if already in range.
     * Does not store an out-of-range chase target.
     */
    public attackStandstill(target: CombatTarget): void {
        if (this.dead ||
            target.isDead() ||
            this.isAttacking() ||
            this.isInBowStance() ||
            this.isCastReady() ||
            this.currentState === PlayerState.TakeDamage ||
            this.currentState === PlayerState.TakeDamageOnMove ||
            this.currentState === PlayerState.TakeDamageWithKnockback ||
            this.isStunlocked()) {
            return;
        }

        this.cancelMovement();
        this.attackTarget = undefined;

        const distance = getDistance(this.worldX, this.worldY, target.getWorldX(), target.getWorldY());
        if (distance > this.attackRange) {
            const face = getNextDirection(this.worldX, this.worldY, target.getWorldX(), target.getWorldY());
            if (face !== Direction.None && face !== this.direction) {
                this.direction = face;
                this.updateDepth();
                this.switchToIdle();
            }
            return;
        }

        if (this.attackMode) {
            this.startAttack(target);
        } else {
            this.startBowStance(target);
        }
    }

    /**
     * Attempts to attack the specified monster.
     * When moving between cells: stores target so attack triggers when reaching next cell.
     * When in attack state or bow stance: rejects (no new commands).
     * When at cell and in range: switches to attack state (combat mode) or bow stance (peace mode).
     *
     * @param target - The monster or player to attack
     */
    public attack(target: CombatTarget): void {
        if (this.dead ||
            target.isDead() ||
            this.isAttacking() ||
            this.isInBowStance() ||
            this.isCastReady() ||
            this.currentState === PlayerState.TakeDamage ||
            this.currentState === PlayerState.TakeDamageOnMove ||
            this.currentState === PlayerState.TakeDamageWithKnockback ||
            this.isStunlocked()) {
            return;
        }
        if (this.moving) {
            // Store target - processMovement will check range when we reach the next cell
            this.attackTarget = target;
            return;
        }

        const distance = getDistance(this.worldX, this.worldY, target.getWorldX(), target.getWorldY());

        if (distance <= this.attackRange) {
            if (this.attackMode) {
                this.startAttack(target);
            } else {
                this.startBowStance(target);
            }
        } else {
            this.attackTarget = target;
        }
    }

    /**
     * Authoritative swing length (ms). Matches server AttackSpeedMs when applied via
     * {@link setAttackSpeedFromDurationMs}; derived from Phaser frame rate otherwise.
     */
    private attackSwingDurationMs = 600;

    /** Local hard lock: no second attack packet until this timestamp (performance.now). */
    private localAttackLockUntilMs = 0;

    /**
     * Full melee/bow swing duration in ms — used by input hold auto-repeat and packet gate.
     */
    public getAttackSwingDurationMs(): number {
        return Math.max(200, this.attackSwingDurationMs);
    }

    private canStartLocalAttackNow(): boolean {
        if (!this.isLocalPlayer) {
            return true;
        }
        return performance.now() >= this.localAttackLockUntilMs;
    }

    private armLocalAttackLock(): void {
        if (!this.isLocalPlayer) {
            return;
        }
        // Full weapon swing interval — matches server AttackSpeedMs / TryBeginAttackRequest.
        this.localAttackLockUntilMs = performance.now() + this.getAttackSwingDurationMs();
    }

    /**
     * Starts the melee attack animation facing the monster.
     */
    private startAttack(target: CombatTarget): void {
        if (this.dead) {
            return;
        }
        // Already swinging: never stack a second packet/anim.
        if (this.isAttacking()) {
            return;
        }
        // Even hold cadence: one packet per full weapon swing duration.
        if (!this.canStartLocalAttackNow()) {
            return;
        }

        this.cancelMovement();
        this.attackTarget = target;

        // Clear movement state when switching to attack; startAttack can be called from
        // processMovement() when reaching a cell (isMoving still true in that path). If we
        // don't clear it, after attack ends super.update() will run the movement block and
        // animate from the adjacent cell into the current cell.
        this.moving = false;
        this.offsetX = 0;
        this.offsetY = 0;

        const attackDirection = getNextDirection(this.worldX, this.worldY, target.getWorldX(), target.getWorldY());
        if (attackDirection !== Direction.None && attackDirection !== this.direction) {
            this.direction = attackDirection;
            this.updateDepth();
        }

        const weaponDef = this.getTrackedWeaponDef();
        const attackState = weaponDef?.weaponType === WeaponType.BOW ? PlayerState.BowAttack : PlayerState.MeleeAttack;
        this.switchPlayerState(attackState, true);
        // Arm lock only after we actually enter attack (so rejected paths don't burn cadence).
        this.armLocalAttackLock();
        if (this.isLocalPlayer && !this.dead) {
            const ranged = weaponDef?.weaponType === WeaponType.BOW;
            if (isMonsterCombatTarget(target)) {
                getNetworkManager(this.scene.game)?.sendPlayerAttackedMonster(target.getMonsterId(), ranged, this.attackType);
            } else {
                const targetPlayerId = target.getPlayerId();
                if (targetPlayerId) {
                    getNetworkManager(this.scene.game)?.sendPlayerAttackedPlayer(targetPlayerId, ranged, this.attackType);
                }
            }
        }
        if (weaponDef?.weaponType === WeaponType.BOW) {
            this.scheduleBowArrowSpawn();
        }
        // Refresh sprite positions after state switch; different animation frames use different
        // pivot offsets which can cause a visual jump if base position isn't synced
        this.updatePixelPosition();
    }

    /**
     * Starts the bow stance animation facing the monster (peace mode only).
     * No damage is delivered; armaments are hidden during the animation.
     */
    private startBowStance(target: CombatTarget): void {
        this.cancelMovement();
        this.attackTarget = target;

        this.moving = false;
        this.offsetX = 0;
        this.offsetY = 0;

        const attackDirection = getNextDirection(this.worldX, this.worldY, target.getWorldX(), target.getWorldY());
        if (attackDirection !== Direction.None && attackDirection !== this.direction) {
            this.direction = attackDirection;
            this.updateDepth();
        }

        if (this.isLocalPlayer) {
            getNetworkManager(this.scene.game)?.sendPlayerBowStanceRequested(this.direction);
        }

        this.switchPlayerState(PlayerState.BowStance, true);
        this.updatePixelPosition();
    }

    /**
     * Switches to PickUp state when the player clicks on their current cell.
     * Plays the pickup animation once at idle speed, then returns to idle.
     * Repeated clicks on the same cell will trigger PickUp again (looping).
     * Armaments are hidden during PickUp (no animations for them) and restored when returning to idle.
     * @param maxItems Ground-stack items to request (1 normal; up to 9 when Ctrl is held).
     */
    public requestPickUp(maxItems: number = 1): void {
        if (this.dead ||
            this.isAttacking() ||
            this.isInBowStance() ||
            this.isCasting() ||
            this.isCastReady() ||
            this.currentState === PlayerState.PickUp ||
            this.currentState === PlayerState.TakeDamageOnMove ||
            this.currentState === PlayerState.TakeDamageWithKnockback ||
            this.isStunlocked() ||
            this.moving) {
            return;
        }
        this.cancelMovement();
        if (this.isLocalPlayer) {
            const clampedMaxItems = Math.max(1, Math.min(9, Math.floor(maxItems)));
            getNetworkManager(this.scene.game)?.sendPlayerPickupRequested(this.direction);
            getNetworkManager(this.scene.game)?.sendPlayerItemPickupRequested(clampedMaxItems);
        }
        this.switchPlayerState(PlayerState.PickUp, true);
    }

    /** Local: pickup duration from InitialGameWorldState. */
    public setPlayerPickupAnimationMs(ms: number): void {
        this.playerPickupAnimationMs = ms;
    }

    /** Local: bow stance duration from InitialGameWorldState. */
    public setPlayerBowAnimationDurationMs(ms: number): void {
        this.playerBowAnimationDurationMs = ms;
    }

    /** Remote: enqueue a pickup animation to play when idle and not blocked by other states. */
    public queueRemotePickup(directionValue: number, animationTimeMs: number): void {
        if (this.isLocalPlayer) {
            return;
        }
        this.movement.pendingSyncCommands.push({ type: 'pickup', direction: directionValue, animationTimeMs });
    }

    /** Remote: enqueue a bow stance animation to play when idle and not blocked by other states. */
    public queueRemoteBowStance(directionValue: number, animationTimeMs: number): void {
        if (this.isLocalPlayer) {
            return;
        }
        this.movement.pendingSyncCommands.push({ type: 'bowStance', direction: directionValue, animationTimeMs });
    }

    /**
     * Turns the player to face the specified direction without moving.
     * Only allowed when idle (IdlePeaceMode or IdleCombatMode); blocked when in take damage, stunlock, or other states.
     * Returns true when the facing value changed (used to avoid spamming idle-direction packets while the mouse is held).
     */
    public turnTowardsDirection(direction: Direction): boolean {
        if (this.dead ||
            (this.currentState !== PlayerState.IdlePeaceMode && this.currentState !== PlayerState.IdleCombatMode) ||
            direction === Direction.None ||
            this.isStunlocked()) {
            return false;
        }

        if (this.direction !== direction) {
            this.direction = direction;
            this.updateDepth();
            this.switchToIdle();
            return true;
        }
        return false;
    }

    /** Local player: defer idle facing + packet send until movement has fully stopped. */
    public queueLocalIdleDirectionForWhenStopped(direction: Direction): void {
        if (!this.isLocalPlayer || direction === Direction.None) {
            return;
        }
        this.movement.pendingSyncCommands.push({ type: 'idleDirection', direction });
    }

    /** Remote: idle facing arrived while still moving; applied when movement stops. */
    public queueIdleFacingForWhenAligned(directionValue: number): void {
        if (this.isLocalPlayer) {
            return;
        }
        this.movement.pendingSyncCommands.push({ type: 'idleDirection', direction: directionValue });
    }

    private setOrReplaceDeferredMovement(step: Extract<PendingSyncCommand, { type: 'movementStep' }>): void {
        const idx = this.movement.pendingSyncCommands.findIndex((c) => c.type === 'movementStep');
        if (idx >= 0) {
            this.movement.pendingSyncCommands[idx] = step;
        } else {
            this.movement.pendingSyncCommands.unshift(step);
        }
    }

    private clearDeferredMovements(): void {
        this.movement.pendingSyncCommands = this.movement.pendingSyncCommands.filter((c) => c.type !== 'movementStep');
    }

    private drainLocalPendingIdleDirectionsWhenIdleAndStopped(): void {
        if (!this.isLocalPlayer || this.dead || this.moving) {
            return;
        }
        if (
            (this.currentState !== PlayerState.IdlePeaceMode && this.currentState !== PlayerState.IdleCombatMode) ||
            this.isStunlocked()
        ) {
            return;
        }
        while (this.movement.pendingSyncCommands.length > 0) {
            const head = this.movement.pendingSyncCommands[0];
            if (head.type !== 'idleDirection') {
                break;
            }
            this.movement.pendingSyncCommands.shift();
            const d = toDirection(head.direction);
            if (d !== Direction.None) {
                this.turnTowardsDirection(d);
                getNetworkManager(this.scene.game)?.requestChangePlayerIdleDirection(head.direction);
            }
        }
    }

    private drainRemotePendingCommandsWhenStopped(): void {
        if (this.isLocalPlayer || this.dead || this.moving) {
            return;
        }
        while (this.movement.pendingSyncCommands.length > 0) {
            const head = this.movement.pendingSyncCommands[0];
            if (head.type === 'idleDirection') {
                this.movement.pendingSyncCommands.shift();
                const rd = toDirection(head.direction);
                if (rd !== Direction.None) {
                    this.applyIdleFacing(rd);
                }
                continue;
            }
            if (head.type === 'pickup') {
                if (!this.canApplyRemotePickupNow()) {
                    break;
                }
                this.movement.pendingSyncCommands.shift();
                this.applyRemotePickup(head.direction, head.animationTimeMs);
                continue;
            }
            if (head.type === 'bowStance') {
                if (!this.canApplyRemoteBowStanceNow()) {
                    break;
                }
                this.movement.pendingSyncCommands.shift();
                this.applyRemoteBowStance(head.direction, head.animationTimeMs);
                continue;
            }
            break;
        }
    }

    private canApplyRemotePickupNow(): boolean {
        return (
            !this.dead &&
            !this.isAttacking() &&
            !this.isInBowStance() &&
            !this.isCasting() &&
            !this.isCastReady() &&
            this.currentState !== PlayerState.PickUp &&
            this.currentState !== PlayerState.TakeDamageOnMove &&
            this.currentState !== PlayerState.TakeDamageWithKnockback &&
            !this.isStunlocked()
        );
    }

    private applyRemotePickup(directionValue: number, animationTimeMs: number): void {
        const rd = toDirection(directionValue);
        if (rd !== Direction.None && rd !== this.direction) {
            this.direction = rd;
            this.updateDepth();
        }
        this.remotePickupAnimationDurationMs = animationTimeMs;
        this.switchPlayerState(PlayerState.PickUp, true);
        this.updatePixelPosition();
    }

    private canApplyRemoteBowStanceNow(): boolean {
        return (
            !this.dead &&
            !this.isAttacking() &&
            !this.isInBowStance() &&
            !this.isCasting() &&
            !this.isCastReady() &&
            this.currentState !== PlayerState.PickUp &&
            this.currentState !== PlayerState.TakeDamageOnMove &&
            this.currentState !== PlayerState.TakeDamageWithKnockback &&
            !this.isStunlocked()
        );
    }

    private applyRemoteBowStance(directionValue: number, animationTimeMs: number): void {
        const rd = toDirection(directionValue);
        if (rd !== Direction.None && rd !== this.direction) {
            this.direction = rd;
            this.updateDepth();
        }
        this.remoteBowStanceAnimationDurationMs = animationTimeMs;
        this.switchPlayerState(PlayerState.BowStance, true);
        this.updatePixelPosition();
    }

    /** Remote: apply idle facing from a packet (any non-local state). */
    public applyIdleFacing(direction: Direction): void {
        if (this.isLocalPlayer || direction === Direction.None) {
            return;
        }
        if (this.direction === direction) {
            return;
        }
        this.direction = direction;
        this.updateDepth();
        if (this.currentState === PlayerState.IdlePeaceMode || this.currentState === PlayerState.IdleCombatMode) {
            this.switchToIdle();
        } else {
            this.switchPlayerState(this.currentState, true);
        }
        this.updatePixelPosition();
    }

    /**
     * Overrides move to send `request_movement` before moving to the next cell.
     */
    protected override move(direction: Direction): void {
        if (this.dead) {
            return;
        }
        if (this.isLocalPlayer && this.isParalyzed()) {
            return;
        }
        if (this.isLocalPlayer && this.isStunlocked()) {
            return;
        }
        const [dx, dy] = getDirectionOffset(direction);
        const nextX = this.worldX + dx;
        const nextY = this.worldY + dy;
        if (this.isLocalPlayer) {
            const dashAttackMonsterId =
                this.dashMode && this.attackTarget && isMonsterCombatTarget(this.attackTarget)
                    ? this.attackTarget.getMonsterId()
                    : undefined;
            const dashAttackPlayerId =
                this.dashMode && this.attackTarget && !isMonsterCombatTarget(this.attackTarget)
                    ? this.attackTarget.getPlayerId()
                    : undefined;
            getNetworkManager(this.scene.game)?.requestMovement(this.worldX, this.worldY, nextX, nextY, {
                dashAttack: dashAttackMonsterId !== undefined || dashAttackPlayerId !== undefined,
                monsterId: dashAttackMonsterId,
                playerId: dashAttackPlayerId,
                attackType: dashAttackMonsterId !== undefined || dashAttackPlayerId !== undefined ? this.attackType : undefined,
            });
        }
        super.move(direction);
    }

    /**
     * Overrides beforeMove to enter dash mode when moving one cell toward attack target in run mode.
     */
    protected override beforeMove(direction: Direction): boolean {
        if (!this.isLocalPlayer && this.queuedDashModeForNextMove !== undefined) {
            this.dashMode = this.queuedDashModeForNextMove;
            this.queuedDashModeForNextMove = undefined;
            return false;
        }
        if (this.attackTarget?.isDead()) {
            this.attackTarget = undefined;
            return false;
        }
        if (!this.attackTarget || !this.attackMode || !this.runMode || !playerDialogStore.state.allowDashAttack) {
            return false;
        }
        const weaponDef = this.getTrackedWeaponDef();
        if (weaponDef?.weaponType === WeaponType.BOW) {
            return false;
        }
        // Do not arm dashMode if move will be rejected (paralysis / stunlock).
        if (this.isLocalPlayer && (this.isParalyzed() || this.isStunlocked())) {
            return false;
        }
        const distance = getDistance(this.worldX, this.worldY, this.attackTarget.getWorldX(), this.attackTarget.getWorldY());
        if (distance !== this.attackRange + 1) {
            return false;
        }
        this.dashMode = true;
        this.move(direction);
        // move() may abort without starting a step — clear dash so processMovement does not wipe destination.
        if (!this.moving) {
            this.dashMode = false;
            return false;
        }
        return true;
    }

    /**
     * Overrides processMovement to check attack range when reaching a cell.
     * If attack target is in range, attack instead of moving.
     */
    protected override processMovement(): void {
        if (this.dead) {
            return;
        }
        if (this.isLocalPlayer && this.isStunlocked()) {
            return;
        }
        if (this.dashMode) {
            this.dashMode = false;
            const hasQueuedRemoteStep =
                !this.isLocalPlayer &&
                this.destinationX !== -1 &&
                this.destinationY !== -1 &&
                (this.worldX !== this.destinationX || this.worldY !== this.destinationY);
            if (hasQueuedRemoteStep) {
                super.processMovement();
                return;
            }
            this.attackTarget = undefined;
            this.destinationX = -1;
            this.destinationY = -1;
            this.isDirectMovementMode = false;
            this.moving = false;
            this.moveReady = true;
            this.offsetX = 0;
            this.offsetY = 0;
            return;
        }
        if (this.attackTarget?.isDead()) {
            this.attackTarget = undefined;
        }
        if (this.attackTarget &&
            this.currentState !== PlayerState.TakeDamage &&
            this.currentState !== PlayerState.TakeDamageOnMove &&
            this.currentState !== PlayerState.TakeDamageWithKnockback &&
            !this.isStunlocked()) {
            const distance = getDistance(this.worldX, this.worldY, this.attackTarget.getWorldX(), this.attackTarget.getWorldY());
            if (distance <= this.attackRange) {
                if (this.attackMode) {
                    this.startAttack(this.attackTarget);
                } else {
                    this.startBowStance(this.attackTarget);
                }
                return;
            }
        }
        super.processMovement();
    }

    /**
     * Ends melee/bow swing so the player can walk away (flee after slime packs).
     * Does not clear paralysis / cast-ready / take-damage locks.
     */
    private interruptAttackForMovement(): void {
        if (!this.isAttacking() && !this.isInBowStance()) {
            return;
        }
        this.attackTarget = undefined;
        this.dashMode = false;
        this.cancelPendingBowArrowSpawn();
        this.switchToIdle();
    }

    /** Accumulators for stuck-movement recovery (local only). */
    private stuckMoveReadyMs = 0;
    private stuckAttackAnimMs = 0;

    /**
     * Unsticks local movement when combat leaves flags inconsistent:
     * - moveReady false while not interpolating a step
     * - attack/bow anim state that never finishes (can kill but not walk)
     * - dashMode latched without moving
     */
    private recoverLocalMovementLocks(delta: number): void {
        if (this.dashMode && !this.moving) {
            this.dashMode = false;
        }

        if (!this.moving && !this.moveReady) {
            this.stuckMoveReadyMs += delta;
            if (this.stuckMoveReadyMs > 250) {
                this.moveReady = true;
                this.stuckMoveReadyMs = 0;
            }
        } else {
            this.stuckMoveReadyMs = 0;
        }

        // Only force-end hung attack anims. Normal completion is handled in update() via
        // isPrimaryAssetAnimationPlaying — early force-idle caused double swings (next hold frame).
        if (this.isAttacking() || this.isInBowStance()) {
            this.stuckAttackAnimMs += delta;
            if (this.stuckAttackAnimMs > 2200) {
                this.attackTarget = undefined;
                this.dashMode = false;
                this.cancelPendingBowArrowSpawn();
                this.switchToIdle();
                this.moveReady = true;
                this.stuckAttackAnimMs = 0;
            }
        } else {
            this.stuckAttackAnimMs = 0;
        }

        // Expired anti-cheat paralysis should never leave residual walk block.
        if (this.paralysisUntil !== undefined && Date.now() >= this.paralysisUntil) {
            this.paralysisUntil = undefined;
        }
    }

    /**
     * Overrides setDestination: attack animations no longer hard-block walking.
     * Click-to-move interrupts the swing (Olympia-style flee).
     */
    public override setDestination(
        destinationX: number,
        destinationY: number,
        useDirectMovement: boolean = false,
        cameraCenterPixelX?: number,
        cameraCenterPixelY?: number,
        cursorPixelX?: number,
        cursorPixelY?: number
    ): void {
        if (this.isParalyzed() ||
            this.dead ||
            this.isCasting() ||
            this.isCastReady() ||
            this.currentState === PlayerState.PickUp ||
            this.currentState === PlayerState.TakeDamageOnMove ||
            this.currentState === PlayerState.TakeDamageWithKnockback ||
            this.isStunlocked()) {
            return;
        }
        // Allow click-to-move to break out of a stuck/held attack loop.
        if (this.isAttacking() || this.isInBowStance()) {
            this.interruptAttackForMovement();
        }
        this.attackTarget = undefined;
        super.setDestination(destinationX, destinationY, useDirectMovement, cameraCenterPixelX, cameraCenterPixelY, cursorPixelX, cursorPixelY);
    }

    /**
     * Cancels path; attack swings are interrupted so cancel is never a no-op while MeleeAttack.
     */
    public override cancelMovement(): void {
        if (this.isAttacking() || this.isInBowStance()) {
            this.interruptAttackForMovement();
        }
        super.cancelMovement();
        if (this.isLocalPlayer) {
            this.movement.pendingSyncCommands = this.movement.pendingSyncCommands.filter((c) => c.type !== 'idleDirection');
        }
    }

    /**
     * Overrides update to handle attack and take damage animation completion.
     */
    public override update(delta: number): void {
        this.tickChatOverhead();
        if (this.dead) {
            this.healthBarGraphics.setVisible(false);
            this.clearEnemySkullMarker();
            this.destroyStatusFootEffects();
            const accessoryAssetIndex = this.appearanceManager.getAccessoryAssetIndex();
            if (accessoryAssetIndex >= 0 &&
                this.appearanceManager.hasAccessory() &&
                this.assets[accessoryAssetIndex].sprite.visible &&
                !this.assets[accessoryAssetIndex].isAnimationPlaying()) {
                this.assets[accessoryAssetIndex].setVisible(false);
            }
            return;
        }
        this.updateHealthBar();
        this.updateEnemySkullMarkerPosition();
        this.updateStarTwinkle(delta);

        // Recovery: never leave local player unable to walk while still able to fight.
        if (this.isLocalPlayer) {
            this.recoverLocalMovementLocks(delta);
        }

        if ((this.currentState === PlayerState.MeleeAttack || this.currentState === PlayerState.BowAttack) && !this.dashMode) {
            if (!this.isPrimaryAssetAnimationPlaying()) {
                this.attackTarget = undefined;
                this.switchToIdle();
            }
            return;
        }

        if (this.currentState === PlayerState.BowStance && !this.isPrimaryAssetAnimationPlaying()) {
            this.attackTarget = undefined;
            this.switchToIdle();
            return;
        }

        if (this.currentState === PlayerState.PickUp && !this.isPrimaryAssetAnimationPlaying()) {
            this.switchToIdle();
            return;
        }

        if (this.currentState === PlayerState.Cast && !this.isPrimaryAssetAnimationPlaying()) {
            this.switchPlayerState(PlayerState.CastReady);
            if (this.isLocalPlayer) {
                EventBus.emit(OUT_UI_CAST_READY);
            }
            return;
        }

        if (this.currentState === PlayerState.TakeDamage || this.currentState === PlayerState.TakeDamageOnMove) {
            const minDwellMs = this.takeDamageAnimationDurationMs ?? 0;
            const elapsedMs = performance.now() - this.takeDamageVisualEnteredAtMs;
            const dwellSatisfied = minDwellMs <= 0 ? true : elapsedMs >= minDwellMs;
            const animationDone = !this.isPrimaryAssetAnimationPlaying();
            const canLeaveTakeDamageVisual =
                dwellSatisfied && (minDwellMs > 0 ? true : animationDone);
            if (canLeaveTakeDamageVisual) {
                if (this.moving) {
                    if (this.stunlockDurationMs > 0 && !this.isLocalPlayer) {
                        this.setPendingStunlockAfterMovement();
                    }
                    this.switchToMovement(true);
                } else {
                    this.switchToIdle();
                }
            }
        }

        if (this.currentState === PlayerState.TakeDamageWithKnockback && this.isKnockbackActive()) {
            this.updateKnockbackVisual(delta);
        }

        if (this.currentState === PlayerState.TakeDamageWithKnockback &&
            !this.isKnockbackActive() && !this.isPrimaryAssetAnimationPlaying()) {
            if (!this.isLocalPlayer && this.stunlockElapsedMs < 0 && this.stunlockDurationMs > 0) {
                this.startStunlock();
            }
            this.switchToIdle();
        }

        if (!this.updateCourseCorrectionMovement(delta)) {
            // GameObject.update overwrites offsetX/Y every frame while isMoving; that destroys knockback slide offsets.
            const knockbackSlideActive =
                this.currentState === PlayerState.TakeDamageWithKnockback && this.isKnockbackActive();
            if (!knockbackSlideActive) {
                super.update(delta);
            }
        }

        this.drainLocalPendingIdleDirectionsWhenIdleAndStopped();
        this.drainRemotePendingCommandsWhenStopped();

        if (!this.isLocalPlayer &&
            !this.moving &&
            this.isInMovementState() &&
            this.movement.pendingRemoteIdleSwitchMs !== undefined) {
            this.movement.pendingRemoteIdleSwitchMs = Math.max(0, this.movement.pendingRemoteIdleSwitchMs - delta);
            if (this.movement.pendingRemoteIdleSwitchMs === 0) {
                this.movement.pendingRemoteIdleSwitchMs = undefined;
                this.switchToIdle();
            }
        }

        this.updateStunlock(delta);
    }

    /**
     * Ticks the redirected movement step from the player's current pixel position.
     * This keeps the sideways offset intact until the corrected cell is reached.
     */
    private updateCourseCorrectionMovement(delta: number): boolean {
        if (!this.moving || this.correctionStartOffsetX === undefined || this.correctionStartOffsetY === undefined) {
            return false;
        }

        this.movementElapsedTime += delta;
        const correctionDurationMs = this.correctionDurationMs ?? this.activeStepDurationMs;
        const progress = Math.min(this.movementElapsedTime / correctionDurationMs, 1.0);
        this.offsetX = this.correctionStartOffsetX * (1 - progress);
        this.offsetY = this.correctionStartOffsetY * (1 - progress);
        this.updatePixelPosition();

        if (progress < 1.0) {
            return true;
        }

        this.moveReady = true;
        this.movementElapsedTime = 0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.correctionStartOffsetX = undefined;
        this.correctionStartOffsetY = undefined;
        this.correctionDurationMs = undefined;

        const shouldPause = this.shouldPauseMovementWhenCellReached();
        this.onCellReached();

        if (this.destinationX === -1 || this.destinationY === -1) {
            this.moving = false;
            this.switchState(GameObjectState.Idle);
            this.updatePixelPosition();
        } else if (this.worldX === this.destinationX && this.worldY === this.destinationY) {
            this.moving = false;
            this.destinationX = -1;
            this.destinationY = -1;
            this.isPrevMoveBlocked = false;
            this.prevMoveX = -1;
            this.prevMoveY = -1;
            if (this.autoSwitchToIdle) {
                this.switchState(GameObjectState.Idle);
            }
            this.updatePixelPosition();
        } else if (shouldPause) {
            this.moving = false;
            this.switchState(GameObjectState.Idle);
            this.updatePixelPosition();
        } else {
            this.processMovement();
            this.updatePixelPosition();
        }

        return true;
    }

    /**
     * When STAR_TWINKLE is equipped, spawns random sparkles above the player at intervals.
     */
    private updateStarTwinkle(delta: number): void {
        if (!hasEquippedItemEffect(this.equippedItemsForEffects, ItemEffect.STAR_TWINKLE)) {
            this.starTwinkleAccumulatorMs = 0;
            return;
        }
        this.starTwinkleAccumulatorMs += delta;
        const nextIntervalMs = 150 + Phaser.Math.FloatBetween(0, 200);
        if (this.starTwinkleAccumulatorMs < nextIntervalMs) {
            return;
        }
        this.starTwinkleAccumulatorMs = 0;
        const px = this.getAnimatedPixelX();
        const py = this.getAnimatedPixelY();
        const offsetX = Phaser.Math.FloatBetween(-15, 15);
        const offsetY = Phaser.Math.FloatBetween(-60, 0);
        drawEffectAtPixelCoords(this.scene, px + offsetX, py + offsetY, EFFECT_SPARKLE, {
            usePlayerDepthForDepth: true,
            playerWorldY: this.worldY,
        });
    }

    /**
     * Implements abstract method from GameObject to switch state.
     * When switching to Idle after reaching a cell with a queued cast, executes the cast instead.
     */
    protected override switchState(state: GameObjectState, _forceUpdate: boolean = false): void {
        switch (state) {
            case GameObjectState.Idle:
                if (this.queuedCastSpellId !== undefined) {
                    const spellId = this.queuedCastSpellId;
                    const useCastAnimation = this.queuedCastUseAnimation;
                    this.queuedCastSpellId = undefined;
                    this.pendingSpellId = spellId;
                    this.pendingUseCastAnimation = useCastAnimation;
                    if (useCastAnimation) {
                        this.switchPlayerState(PlayerState.Cast, true);
                        this.emitCastStarted(spellId);
                    } else {
                        EventBus.emit(OUT_UI_CAST_READY);
                        this.tryAutoConfirmSelfSpell();
                    }
                } else {
                    this.switchToIdle();
                }
                break;
            case GameObjectState.Move:
                // Always refresh movement appearance each step: same PlayerState (e.g. Run→Run) when
                // direction unchanged would otherwise skip applyStateAppearance, leaving animation FPS
                // tied to the previous step (e.g. after run/walk toggle updates movementSpeedMs).
                if (this.dashMode) {
                    this.switchPlayerState(PlayerState.MeleeAttack, true);
                } else {
                    this.switchToMovement(true);
                }
                break;
        }
    }

    /**
     * Overrides hook method from GameObject to update registry and emit when position changes.
     */
    protected override onPositionChanged(newX: number, newY: number): void {
        if (!this.isLocalPlayer) {
            return;
        }

        setPlayerPosition(this.scene.game, newX, newY);
        EventBus.emit(PLAYER_POSITION_CHANGED, { x: newX, y: newY });
    }

    /**
     * Overrides hook from GameObject. When player reaches a new cell while moving, spawns footsteps effect.
     * Uses wet splash when raining, otherwise dry footsteps.
     */
    protected override onCellReached(): void {
        // Invisible players leave no run trail (Insk: still visible via footsteps).
        if (!this.dead && this.currentState === PlayerState.Run && !this.hasInvisibilityBuff()) {
            const weather = mapDialogStore.state.weather;
            const isRaining = weather === 'rain-light' || weather === 'rain-medium' || weather === 'rain-heavy';
            const effectKey = isRaining ? EFFECT_WET_SPLASH : EFFECT_FOOTSTEPS_DRY;
            drawEffect(this.scene, this.worldX, this.worldY, effectKey);
        }

        if (!this.isLocalPlayer && this.currentState === PlayerState.Run) {
            const spatialConfig = computeOtherPlayerSpatialConfig(
                this.scene.game,
                this.worldX,
                this.worldY,
                this.offsetX,
                this.offsetY,
                TILE_SIZE,
            );
            if (spatialConfig) {
                this.soundTracker.setSpatialConfig(PlayerState.Run, spatialConfig);
            }
        }

        if (this.isInTakeDamageOnMoveState() || this.pendingStunlockAfterMovement) {
            this.pendingStunlockAfterMovement = false;
            if (!this.isLocalPlayer && this.stunlockDurationMs > 0 && this.stunlockElapsedMs < 0) {
                this.startStunlock();
            }
        }

        let continuedQueuedMovement = false;
        if (!this.isLocalPlayer) {
            const head = this.movement.pendingSyncCommands[0];
            if (
                head?.type === 'movementStep' &&
                this.worldX === head.curX &&
                this.worldY === head.curY
            ) {
                this.movement.pendingSyncCommands.shift();
                this.destinationX = head.destX;
                this.destinationY = head.destY;
                this.isDirectMovementMode = false;
                this.queuedDashModeForNextMove = head.dashAttack;
                this.movement.pendingRemoteIdleSwitchMs = undefined;
                continuedQueuedMovement = true;
            }
        }

        if (!this.isLocalPlayer && !continuedQueuedMovement) {
            this.movement.pendingRemoteIdleSwitchMs = this.movement.remoteIdleContinuationGraceMs;
        }
    }

    /**
     * Returns true when in TakeDamageOnMove state.
     */
    protected override isInTakeDamageOnMoveState(): boolean {
        return this.currentState === PlayerState.TakeDamageOnMove;
    }

    /**
     * When stunlock duration is 0 (interrupt-only), do not pause between cells or start a stunlock timer at cell boundaries.
     */
    protected override shouldPauseMovementWhenCellReached(): boolean {
        if (this.stunlockDurationMs <= 0) {
            return false;
        }
        return super.shouldPauseMovementWhenCellReached();
    }

    /**
     * Clears destination when stunlock ends so player stays at cell.
     */
    protected override onStunlockComplete(): void {
        if (this.destinationX >= 0 && this.destinationY >= 0 && !this.moving) {
            this.destinationX = -1;
            this.destinationY = -1;
        }
    }

    /**
     * Updates the remote idle continuation grace period in ms.
     * Used for remote players to delay switching to idle when movement/action ends.
     */
    public setRemoteIdleContinuationGraceMs(ms: number): void {
        this.movement.remoteIdleContinuationGraceMs = Math.max(0, Math.min(500, Math.round(ms)));
    }

    /**
     * Returns per-tile step duration in ms (align with proto `movementSpeedMs`).
     */
    public getMovementSpeedMs(): number {
        return this.movementSpeedMs;
    }

    /**
     * Updates the player's movement duration. Takes the effective duration in ms (use the packet value directly).
     */
    public setMovementSpeed(movementSpeedMs: number): void {
        const clampedMs = Phaser.Math.Clamp(movementSpeedMs, 100, 1000);

        this.movementSpeedMs = clampedMs;
        if (this.isInMovementState()) {
            this.switchToMovement(true);
        }
    }

    /**
     * Applies authoritative movement / attack / cast durations from server snapshots or temporary-effect packets (e.g. Chill).
     * Only updates fields that are provided.
     */
    public applySpeedsMs(opts: {
        movementSpeedMs?: number;
        attackSpeedMs?: number;
        castSpeedMs?: number;
    }): void {
        if (typeof opts.movementSpeedMs === 'number') {
            this.setMovementSpeed(opts.movementSpeedMs);
        }
        if (typeof opts.attackSpeedMs === 'number') {
            this.setAttackSpeedFromDurationMs(opts.attackSpeedMs);
        }
        if (typeof opts.castSpeedMs === 'number') {
            this.castSpeed = Phaser.Math.Clamp(opts.castSpeedMs, 200, 2000);
        }
    }

    /**
     * Local player only: full spell cast bar duration in ms (200–2000) from Player dialog and `InitialGameWorldState.cast_speed_ms`.
     * Ignored for remote players so their `castSpeed` is not overwritten by self world state; remotes use `queueRemoteSpellCastStart` for observed casts.
     */
    public setCastDurationMs(durationMs: number): void {
        if (!this.isLocalPlayer) {
            return;
        }
        this.castSpeed = Phaser.Math.Clamp(durationMs, 200, 2000);
    }

    /**
     * Shows or hides the FOE enemy skull above this remote player.
     * Local player never shows a skull on self.
     */
    public syncEnemySkullMarker(show: boolean): void {
        if (this.isLocalPlayer || this.dead || !show) {
            this.clearEnemySkullMarker();
            return;
        }
        if (!this.enemySkullMarker) {
            this.enemySkullMarker = this.scene.add
                .text(0, 0, '☠', {
                    fontFamily: OLYMPIA_PHASER_FONT,
                    fontSize: '14px',
                    color: '#dc2828',
                    stroke: '#000000',
                    strokeThickness: 3,
                })
                .setOrigin(0.5, 1)
                .setDepth(HIGH_DEPTH);
        }
        this.enemySkullMarker.setVisible(true);
        this.updateEnemySkullMarkerPosition();
    }

    /** Removes the world-space enemy skull if present. */
    public clearEnemySkullMarker(): void {
        if (this.enemySkullMarker) {
            this.enemySkullMarker.destroy();
            this.enemySkullMarker = undefined;
        }
    }

    private updateEnemySkullMarkerPosition(): void {
        if (!this.enemySkullMarker) {
            return;
        }
        this.enemySkullMarker.setPosition(
            this.getAnimatedPixelX(),
            this.getAnimatedPixelY() - 2 * TILE_SIZE - 4,
        );
        this.enemySkullMarker.setDepth(HIGH_DEPTH);
    }

    /**
     * Renders the health bar 2 cells above the player.
     * Only shown for the local (self) player; remote players do not display a health bar.
     */
    private updateHealthBar(): void {
        if (!this.isLocalPlayer) {
            this.healthBarGraphics.setVisible(false);
            return;
        }
        const centerX = this.getAnimatedPixelX();
        const centerY = this.getAnimatedPixelY() - 2 * TILE_SIZE - 10;
        const left = centerX - PLAYER_HEALTH_BAR_WIDTH / 2;

        this.healthBarGraphics.setVisible(true);
        this.healthBarGraphics.setDepth(HIGH_DEPTH);
        this.healthBarGraphics.clear();

        // Background (dark)
        this.healthBarGraphics.fillStyle(0x333333, 1);
        this.healthBarGraphics.fillRect(left, centerY - PLAYER_HEALTH_BAR_HEIGHT / 2, PLAYER_HEALTH_BAR_WIDTH, PLAYER_HEALTH_BAR_HEIGHT);

        // Fill (red, proportional to hp/maxHp)
        const fillWidth = Math.max(0, PLAYER_HEALTH_BAR_WIDTH * (this.hp / this.maxHp));
        this.healthBarGraphics.fillStyle(0xff0000, 1);
        this.healthBarGraphics.fillRect(left, centerY - PLAYER_HEALTH_BAR_HEIGHT / 2, fillWidth, PLAYER_HEALTH_BAR_HEIGHT);

        // Dark red border
        this.healthBarGraphics.lineStyle(1, 0x660000, 1);
        this.healthBarGraphics.strokeRect(left, centerY - PLAYER_HEALTH_BAR_HEIGHT / 2, PLAYER_HEALTH_BAR_WIDTH, PLAYER_HEALTH_BAR_HEIGHT);
    }

    /**
     * Creates the casting circle effect at the player's location.
     * Effect duration matches castSpeed and does not loop.
     */
    private createCastingCircleEffect(): void {
        // Get the effect config to determine frame count
        const effectConfig = getEffectByKey(EFFECT_CASTING_CIRCLE);
        if (!effectConfig) {
            return;
        }

        // Get texture to determine frame count
        const textureKey = `sprite-${effectConfig.sprite}-${effectConfig.spriteSheetIndex}`;
        const texture = this.scene.textures.get(textureKey);
        if (!texture) {
            return;
        }

        const frameCount = Object.keys(texture.frames).length;
        if (frameCount === 0) {
            return;
        }

        // Calculate frame rate to match castSpeed duration
        const frameRate = calculateFrameRateFromDuration(frameCount, this.castSpeed);

        // Create the effect with calculated frame rate, no looping
        this.castingCircleEffect = drawEffect(
            this.scene,
            this.worldX,
            this.worldY,
            EFFECT_CASTING_CIRCLE,
            {
                soundManager: this.soundManager,
                playerWorldX: this.worldX,
                playerWorldY: this.worldY,
                infiniteLoop: false,
                frameRate: frameRate,
            }
        );
    }

    /**
     * Destroys the casting circle effect if it exists.
     */
    private destroyCastingCircleEffect(): void {
        if (this.castingCircleEffect) {
            this.castingCircleEffect.destroy();
            this.castingCircleEffect = undefined;
        }
    }

    /**
     * Creates a floating Olympia-style spell announce above the caster (`Mass-Fire-Strike!`).
     * Color follows spell role: offensive red, protect pink, buff/heal green, utility cyan.
     * Local casts also append the announce to the SystemLog (P1.2).
     */
    private createSpellNameFloatingText(): void {
        if (!this.activeSpellName) {
            return;
        }

        const announce = formatOlympiaSpellAnnounce(this.activeSpellName);
        const color = this.resolveSpellAnnounceColor(this.activeSpellName, this.pendingSpellId);

        new FloatingText(this.scene, {
            text: announce,
            x: this.getAnimatedPixelX(),
            y: this.getAnimatedPixelY() - 3 * TILE_SIZE + 20,
            fontSize: 16,
            color,
            bold: true,
            horizontalOffset: -2,
            upwardTravelPxPerSec: 26,
            totalDurationMs: 2200,
            fadeDurationMs: 1000,
        });

        if (this.isLocalPlayer) {
            EventBus.emit(SYSTEM_LOG_APPEND, { message: announce, kind: 'event' });
        }
    }

    /** Maps spell category / name heuristics to Olympia announce palette. */
    private resolveSpellAnnounceColor(spellName: string, spellId?: number): string {
        const config = spellId !== undefined ? getSpellById(spellId) : undefined;
        const category = config?.category;
        const lower = spellName.toLowerCase();
        if (
            lower.includes('protect') ||
            lower.includes('shield') ||
            lower.includes('absolute')
        ) {
            return OLYMPIA_FLOATING_TEXT_COLORS.spellProtect;
        }
        if (
            category === 'buff' ||
            category === 'heal' ||
            lower.includes('meditation') ||
            lower.includes('berserk') ||
            lower.includes('haste')
        ) {
            return OLYMPIA_FLOATING_TEXT_COLORS.spellBuff;
        }
        if (category === 'utility') {
            return OLYMPIA_FLOATING_TEXT_COLORS.spellUtility;
        }
        if (category === 'offensive' || category === 'field' || category === 'summon') {
            return OLYMPIA_FLOATING_TEXT_COLORS.spellOffensive;
        }
        return OLYMPIA_FLOATING_TEXT_COLORS.spellBuff;
    }

    private emitCastStarted(spellId: number): void {
        EventBus.emit(OUT_UI_CAST_STARTED);
        EventBus.emit(PLAYER_CAST_ANIMATION_STARTED, { spellId });
    }

    private clearSpellState(): void {
        this.pendingSpellId = undefined;
        this.queuedCastSpellId = undefined;
        this.pendingUseCastAnimation = true;
        this.queuedCastUseAnimation = true;
        this.activeSpellName = undefined;
    }

    /**
     * Destroys the player and all associated resources including the shadow sprite.
     */
    public destroy(): void {
        if (this.equipItemHandler) {
            EventBus.off(EQUIP_ITEM, this.equipItemHandler);
        }
        if (this.genderChangeHandler) {
            EventBus.off(IN_UI_CHANGE_GENDER, this.genderChangeHandler);
        }
        if (this.skinColorChangeHandler) {
            EventBus.off(IN_UI_CHANGE_SKIN_COLOR, this.skinColorChangeHandler);
        }
        if (this.underwearColorChangeHandler) {
            EventBus.off(IN_UI_CHANGE_UNDERWEAR_COLOR, this.underwearColorChangeHandler);
        }
        if (this.hairStyleChangeHandler) {
            EventBus.off(IN_UI_CHANGE_HAIR_STYLE, this.hairStyleChangeHandler);
        }
        this.clearChatOverhead();
        this.soundTracker.stopAllSounds();
        this.cancelPendingBowArrowSpawn();
        this.destroyCastingCircleEffect();
        this.destroyStatusFootEffects();
        this.clearEnemySkullMarker();
        this.healthBarGraphics.destroy();
        this.movement.pendingSyncCommands = [];
        super.destroy();
    }

    private updateChatOverheadPosition(): void {
        if (!this.chatOverheadText) {
            return;
        }
        this.chatOverheadText.setPosition(
            this.getAnimatedPixelX(),
            this.getAnimatedPixelY() - 3 * TILE_SIZE,
        );
    }

    private tickChatOverhead(): void {
        if (!this.chatOverheadText) {
            return;
        }
        const now = this.scene.time.now;
        const remaining = this.chatOverheadExpiresAtMs - now;
        if (remaining <= 0) {
            this.clearChatOverhead();
            return;
        }
        if (remaining < CHAT_OVERHEAD_FADE_MS) {
            this.chatOverheadText.setAlpha(Math.max(0, remaining / CHAT_OVERHEAD_FADE_MS));
        } else {
            this.chatOverheadText.setAlpha(1);
        }
        this.updateChatOverheadPosition();
    }

    private clearChatOverhead(): void {
        if (this.chatOverheadText) {
            this.chatOverheadText.destroy();
            this.chatOverheadText = undefined;
        }
        this.chatOverheadExpiresAtMs = 0;
    }
}
