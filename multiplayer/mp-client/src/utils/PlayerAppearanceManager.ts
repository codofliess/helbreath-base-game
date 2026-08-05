import type { GameObjects, Scene } from 'phaser';
import type { GameAssetConfig } from '../game/objects/GameAsset';
import { AnimationType, GameAsset } from '../game/objects/GameAsset';
import type { Direction } from './CoordinateUtils';
import { Gender, SkinColor } from '../Types';
import {
    DEFAULT_ANIMATION_FRAME_RATE,
    DEPTH_MULTIPLIER,
    ENTITY_DEPTH_BIAS,
    LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND,
    PLAYER_BODY_SCALE_X,
} from '../Config';
import { calculateFrameRateFromDuration } from './AnimationUtils';
import { getItemEquippedAppearanceSpriteNames } from '../constants/Assets';
import {
    getItemByEquippedSprite,
    getItemById,
    ITEMS,
    ItemEffect,
    ItemTypes,
    mergeItemEffects,
    WEAPON_SPRITE_OVERWRITES,
    type Effect,
} from '../constants/Items';
import { olympiaItemColorToSpriteTint } from '../constants/OlympiaItemName';
import {
    arePlayerItemAppearanceLoaded,
    loadPlayerItemAppearanceOnDemand,
} from './ItemAssets';
import type { ShadowManager } from './ShadowManager';

export enum PlayerState {
    IdlePeaceMode = 0,
    IdleCombatMode = 1,
    WalkPeaceMode = 2,
    WalkCombatMode = 3,
    Run = 4,
    BowStance = 5,
    MeleeAttack = 6,
    BowAttack = 7,
    Cast = 8,
    PickUp = 9,
    TakeDamage = 10,
    TakeDamageOnMove = 11,
    Die = 12,
    TakeDamageWithKnockback = 13,
    CastReady = 14,
}

type GearSlot = 'human' | 'hair' | 'underwear' | 'hauberk' | 'leggings' | 'boots' | 'helm' | 'armor' | 'weapon' | 'cape' | 'shield' | 'accessory';

/**
 * Non-catalog sprite name used only to reserve weapon/shield/accessory draw-order slots while unequipped.
 * Forced onto the pending placeholder texture so a cached catalog sheet (e.g. ITEMS[0] / msw) cannot appear.
 */
const UNEQUIPPED_ARMAMENT_PLACEHOLDER = '__unequipped_armament__';
type EquippedItems = Partial<Record<ItemTypes, { itemId: number; effectOverrides?: Effect[]; itemColor?: number }>>;

/** Merge catalog effects with Olympia m_cItemColor → TINT_APPEARANCE (poison BH green, etc.). */
function effectsWithOlympiaItemColor(
    itemDefEffects: Effect[] | undefined,
    effectOverrides: Effect[] | undefined,
    itemColor: number | undefined,
): Effect[] | undefined {
    const base = mergeItemEffects(itemDefEffects, effectOverrides) ?? [];
    const tint = olympiaItemColorToSpriteTint(itemColor);
    if (tint === undefined) {
        return base.length > 0 ? base : undefined;
    }
    const without = base.filter((e) => e.effect !== ItemEffect.TINT_APPEARANCE);
    without.push({ effect: ItemEffect.TINT_APPEARANCE, effectColor: tint });
    return without;
}

export type GearConfig = {
    human: string;
    underwear?: string;
    /** Underwear color index (0-7). 12 sprite sheets per color. */
    underwearColorIndex?: number;
    /** Hair style: 0-7 = Style 1-8. Index 2 renders no hair. 12 sprite sheets per style. */
    hairStyleIndex?: number;
    hauberk?: string;
    helm?: string;
    leggings?: string;
    boots?: string;
    armor?: string;
    cape?: string;
    weapon?: string;
    weaponStartSpriteSheetIndex?: number;
    shield?: string;
    shieldStartSpriteSheetIndex?: number;
    accessory?: string;
};

export const DEFAULT_GEAR: GearConfig = {
    human: 'wm',
    underwear: undefined,
    underwearColorIndex: 0,
    hairStyleIndex: 0,
    hauberk: undefined,
    helm: undefined,
    leggings: undefined,
    boots: undefined,
    armor: undefined,
    cape: undefined,
    weapon: undefined,
    shield: undefined,
    accessory: undefined,
};

type PlayerAssetIndices = {
    weaponAssetIndex: number;
    shieldAssetIndex: number;
    armorAssetIndex: number;
    hauberkAssetIndex: number;
    leggingsAssetIndex: number;
    bootsAssetIndex: number;
    helmAssetIndex: number;
    capeAssetIndex: number;
    accessoryAssetIndex: number;
    humanAssetIndex: number;
    hairAssetIndex: number;
    underwearAssetIndex: number;
};

export type BuildPlayerAssetConfigsResult = {
    configs: Omit<GameAssetConfig, 'x' | 'y'>[];
    assetIndices: PlayerAssetIndices;
};

export type PlayerAppearanceAnimationConfig = {
    movementSpeedMs: number;
    attackSpeed: number;
    castSpeed: number;
    idleFrameRate: number;
    /** When set, TakeDamage / TakeDamageOnMove / TakeDamageWithKnockback span this duration (e.g. server stunlock ms). */
    takeDamageAnimationDurationMs?: number;
    /** When set, PickUp spans this duration (from InitialGameWorldState or remote `player_pickup_performed`). */
    pickupAnimationDurationMs?: number;
    /** When set, BowStance spans this duration (from InitialGameWorldState or remote `player_bow_stance_performed`). */
    bowStanceAnimationDurationMs?: number;
};

const ARMOUR_SPRITESHEET_BASE: Record<PlayerState, number> = {
    [PlayerState.IdlePeaceMode]: 0,
    [PlayerState.IdleCombatMode]: 1,
    [PlayerState.WalkPeaceMode]: 2,
    [PlayerState.WalkCombatMode]: 3,
    [PlayerState.Run]: 4,
    [PlayerState.BowStance]: 5,
    [PlayerState.MeleeAttack]: 6,
    [PlayerState.BowAttack]: 7,
    [PlayerState.Cast]: 8,
    [PlayerState.PickUp]: 9,
    [PlayerState.TakeDamage]: 10,
    [PlayerState.TakeDamageOnMove]: 10,
    [PlayerState.Die]: 11,
    [PlayerState.TakeDamageWithKnockback]: 10,
    [PlayerState.CastReady]: 1,
};

const PLAYER_ANIMATION_FRAME_COUNT: Record<PlayerState, number> = {
    [PlayerState.IdlePeaceMode]: 8,
    [PlayerState.IdleCombatMode]: 8,
    [PlayerState.WalkPeaceMode]: 8,
    [PlayerState.WalkCombatMode]: 8,
    [PlayerState.Run]: 8,
    [PlayerState.BowStance]: 8,
    [PlayerState.MeleeAttack]: 8,
    [PlayerState.BowAttack]: 8,
    [PlayerState.Cast]: 16,
    [PlayerState.PickUp]: 4,
    [PlayerState.TakeDamage]: 4,
    [PlayerState.TakeDamageOnMove]: 4,
    [PlayerState.Die]: 8,
    [PlayerState.TakeDamageWithKnockback]: 4,
    [PlayerState.CastReady]: 8,
};

const ARMAMENT_STATE_INDEX: Record<PlayerState, number> = {
    [PlayerState.IdlePeaceMode]: 0,
    [PlayerState.IdleCombatMode]: 1,
    [PlayerState.WalkPeaceMode]: 2,
    [PlayerState.WalkCombatMode]: 3,
    [PlayerState.Run]: 6,
    [PlayerState.BowStance]: -1,
    [PlayerState.MeleeAttack]: 4,
    [PlayerState.BowAttack]: 4,
    [PlayerState.Cast]: -1,
    [PlayerState.PickUp]: -1,
    [PlayerState.TakeDamage]: 5,
    [PlayerState.TakeDamageOnMove]: 5,
    [PlayerState.Die]: -1,
    [PlayerState.TakeDamageWithKnockback]: 5,
    [PlayerState.CastReady]: 1,
};

const HUMAN_SPRITESHEET_BASE: Record<PlayerState, number> = {
    [PlayerState.IdlePeaceMode]: 0,
    [PlayerState.IdleCombatMode]: 8,
    [PlayerState.WalkPeaceMode]: 16,
    [PlayerState.WalkCombatMode]: 24,
    [PlayerState.Run]: 32,
    [PlayerState.BowStance]: 40,
    [PlayerState.MeleeAttack]: 48,
    [PlayerState.BowAttack]: 56,
    [PlayerState.Cast]: 64,
    [PlayerState.PickUp]: 72,
    [PlayerState.TakeDamage]: 80,
    [PlayerState.TakeDamageOnMove]: 80,
    [PlayerState.Die]: 88,
    [PlayerState.TakeDamageWithKnockback]: 80,
    [PlayerState.CastReady]: 8,
};

const ANGELIC_STATE_FROM_PLAYER_STATE: Record<PlayerState, number> = {
    [PlayerState.IdlePeaceMode]: 5,
    [PlayerState.IdleCombatMode]: 5,
    [PlayerState.WalkPeaceMode]: 5,
    [PlayerState.WalkCombatMode]: 5,
    [PlayerState.Run]: 5,
    [PlayerState.BowStance]: 5,
    [PlayerState.MeleeAttack]: 0,
    [PlayerState.BowAttack]: 0,
    [PlayerState.Cast]: 4,
    [PlayerState.PickUp]: 5,
    [PlayerState.TakeDamage]: 2,
    [PlayerState.TakeDamageOnMove]: 2,
    [PlayerState.Die]: 3,
    [PlayerState.TakeDamageWithKnockback]: 2,
    [PlayerState.CastReady]: 5,
};

const ANGELIC_STATE_FRAME_COUNT: Record<number, number> = {
    0: 8,
    1: 8,
    2: 4,
    3: 8,
    4: 16,
    5: 4,
};

const MANTLE_DRAWING_ORDER = [1, 1, 1, 0, 0, 0, 2, 2] as const;
const MANTLE_DRAWING_ORDER_ON_RUN = [1, 1, 1, 1, 1, 1, 1, 1] as const;

function getGearRenderOrder(direction: Direction, isRunning: boolean): readonly GearSlot[] {
    const dirIndex = Math.max(0, Math.min(7, direction));
    let mantleOrder = (isRunning ? MANTLE_DRAWING_ORDER_ON_RUN : MANTLE_DRAWING_ORDER)[dirIndex];
    if (!isRunning && direction === 7) {
        mantleOrder = 1;
    }
    if (isRunning && direction === 6) {
        mantleOrder = 2;
    }
    const shieldBeforeWeapon = (!isRunning && (direction === 1 || direction === 2 || direction === 3 || direction === 4)) || (isRunning && (direction === 2 || direction === 3));
    const weaponShield = shieldBeforeWeapon ? (['shield', 'weapon'] as const) : (['weapon', 'shield'] as const);
    const accessorySuffix = ['accessory'] as const;
    if (!isRunning && direction === 2) {
        return ['human', 'hair', 'underwear', 'hauberk', 'leggings', 'boots', 'helm', 'armor', 'shield', 'cape', 'weapon', ...accessorySuffix];
    }
    if (isRunning && direction === 6) {
        return ['human', 'hair', 'underwear', 'hauberk', 'leggings', 'boots', 'helm', 'armor', 'weapon', 'cape', 'shield', ...accessorySuffix];
    }
    switch (mantleOrder) {
        case 0:
            return ['human', 'hair', 'underwear', 'cape', 'hauberk', 'leggings', 'boots', 'helm', 'armor', ...weaponShield, ...accessorySuffix];
        case 1:
            return ['human', 'hair', 'underwear', 'hauberk', 'leggings', 'boots', 'helm', 'armor', ...weaponShield, 'cape', ...accessorySuffix];
        case 2:
            return ['human', 'hair', 'underwear', 'hauberk', 'leggings', 'boots', 'helm', 'armor', 'cape', ...weaponShield, ...accessorySuffix];
        default:
            return ['human', 'hair', 'underwear', 'hauberk', 'leggings', 'boots', 'helm', 'armor', ...weaponShield, 'cape', ...accessorySuffix];
    }
}

/**
 * Manages player visual appearance: gear layers, animations, and state-to-sprite mapping.
 * Builds and updates GameAsset configs for human, armor, weapon, shield, cape, etc., with correct
 * render order and sprite sheet indices per PlayerState.
 */
export class PlayerAppearanceManager {
    private readonly assets: GameAsset[];
    private gender: Gender;
    private humanSpriteName: string;
    private hauberk: string | undefined;
    private helm: string | undefined;
    private leggings: string | undefined;
    private boots: string | undefined;
    private cape: string | undefined;
    private armor: string | undefined;
    private weapon: string | undefined;
    private shield: string | undefined;
    private accessory: string | undefined;
    private accessoryOffsetX: number = 0;
    private accessoryOffsetY: number = 0;
    private weaponStartSpriteSheetIndex: number | undefined;
    private shieldStartSpriteSheetIndex: number | undefined;
    private readonly weaponAssetIndex: number;
    private readonly shieldAssetIndex: number;
    private readonly armorAssetIndex: number;
    private readonly hauberkAssetIndex: number;
    private readonly leggingsAssetIndex: number;
    private readonly bootsAssetIndex: number;
    private readonly helmAssetIndex: number;
    private readonly capeAssetIndex: number;
    private readonly accessoryAssetIndex: number;
    private readonly humanAssetIndex: number;
    private readonly hairAssetIndex: number;
    private readonly underwearAssetIndex: number;
    private underwearColorIndex: number;
    private hairStyleIndex: number;

    private isChilled: boolean = false;
    private isBerserked: boolean = false;
    private isSpawnProtected: boolean = false;
    private isDisconnected: boolean = false;
    /** Local player: Invisibility buff renders body at 50% opacity. */
    private invisibilityLocalHalf: boolean = false;
    /** Remote player: Invisibility hides appearance (alpha 0); footsteps remain. */
    private invisibilityRemoteHidden: boolean = false;

    private readonly scene: Scene;

    /** Refreshes visuals after a lazy item `.spr` finishes loading (e.g. re-run current state animations). */
    private readonly onLazyItemAppearanceLoaded?: () => void;

    /** Per-sprite fetch: one completion handler promotes every pending layer using that basename. */
    private readonly lazyItemAppearanceLoadsStarted = new Set<string>();

    public constructor(
        assets: GameAsset[],
        initialGender: Gender,
        resolvedGear: GearConfig,
        assetIndices: PlayerAssetIndices,
        scene: Scene,
        onLazyItemAppearanceLoaded?: () => void,
    ) {
        this.assets = assets;
        this.scene = scene;
        this.onLazyItemAppearanceLoaded = onLazyItemAppearanceLoaded;
        this.gender = initialGender;
        this.humanSpriteName = resolvedGear.human;
        this.armor = resolvedGear.armor;
        this.hauberk = resolvedGear.hauberk;
        this.leggings = resolvedGear.leggings;
        this.boots = resolvedGear.boots;
        this.helm = resolvedGear.helm;
        this.cape = resolvedGear.cape;
        this.weapon = resolvedGear.weapon;
        this.shield = resolvedGear.shield;
        this.accessory = resolvedGear.accessory;
        this.weaponStartSpriteSheetIndex = resolvedGear.weaponStartSpriteSheetIndex;
        this.shieldStartSpriteSheetIndex = resolvedGear.shieldStartSpriteSheetIndex;
        this.weaponAssetIndex = assetIndices.weaponAssetIndex;
        this.shieldAssetIndex = assetIndices.shieldAssetIndex;
        this.armorAssetIndex = assetIndices.armorAssetIndex;
        this.hauberkAssetIndex = assetIndices.hauberkAssetIndex;
        this.leggingsAssetIndex = assetIndices.leggingsAssetIndex;
        this.bootsAssetIndex = assetIndices.bootsAssetIndex;
        this.helmAssetIndex = assetIndices.helmAssetIndex;
        this.capeAssetIndex = assetIndices.capeAssetIndex;
        this.accessoryAssetIndex = assetIndices.accessoryAssetIndex;
        this.humanAssetIndex = assetIndices.humanAssetIndex;
        this.hairAssetIndex = assetIndices.hairAssetIndex;
        this.underwearAssetIndex = assetIndices.underwearAssetIndex;
        this.underwearColorIndex = resolvedGear.underwearColorIndex ?? 0;
        this.hairStyleIndex = resolvedGear.hairStyleIndex ?? 0;
        this.updateAccessoryOffset();
        this.syncDefaultGearFromRenderedAssets();
        this.applyInitialVisibility();
        this.kickOffAllPendingItemAppearanceLoads();
    }

    /**
     * `buildAssetConfigs` fills default clothing layers from the item catalog when inventory slots are empty,
     * but `resolveGearFromEquippedItems` leaves those fields undefined. Align clothing state with what is
     * actually on each {@link GameAsset}. Never adopt weapon/shield/accessory — unequipped armament slots use
     * {@link UNEQUIPPED_ARMAMENT_PLACEHOLDER} (not ITEMS[0]/msw); adopting that would reintroduce a ghost weapon.
     */
    private syncDefaultGearFromRenderedAssets(): void {
        if (this.armorAssetIndex >= 0 && this.armor === undefined) {
            this.armor = this.assets[this.armorAssetIndex].getSpriteName();
        }
        if (this.hauberkAssetIndex >= 0 && this.hauberk === undefined) {
            this.hauberk = this.assets[this.hauberkAssetIndex].getSpriteName();
        }
        if (this.leggingsAssetIndex >= 0 && this.leggings === undefined) {
            this.leggings = this.assets[this.leggingsAssetIndex].getSpriteName();
        }
        if (this.bootsAssetIndex >= 0 && this.boots === undefined) {
            this.boots = this.assets[this.bootsAssetIndex].getSpriteName();
        }
        if (this.helmAssetIndex >= 0 && this.helm === undefined) {
            this.helm = this.assets[this.helmAssetIndex].getSpriteName();
        }
        if (this.capeAssetIndex >= 0 && this.cape === undefined) {
            this.cape = this.assets[this.capeAssetIndex].getSpriteName();
        }
        this.updateAccessoryOffset();
    }

    /** Start HTTP fetch for every equipped-appearance layer still on the placeholder texture. */
    private kickOffAllPendingItemAppearanceLoads(): void {
        if (!LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND) {
            return;
        }
        const seen = new Set<string>();
        for (let i = 0; i < this.assets.length; i++) {
            const asset = this.assets[i];
            if (!asset.isPendingLazyPlayerItemAppearance()) {
                continue;
            }
            const slot = this.getGearSlotForSprite(asset.getSpriteName(), i);
            // Unequipped armament placeholders must never fetch a catalog sheet.
            if (
                (slot === 'weapon' && this.weapon === undefined) ||
                (slot === 'shield' && this.shield === undefined) ||
                (slot === 'accessory' && this.accessory === undefined)
            ) {
                continue;
            }
            const name = asset.getSpriteName();
            if (!getItemEquippedAppearanceSpriteNames().has(name)) {
                continue;
            }
            if (seen.has(name)) {
                continue;
            }
            seen.add(name);
            this.scheduleLazyItemAppearanceIfNeeded(name, asset);
        }
    }

    public static getHumanSpriteName(gender: Gender, skinColor: SkinColor = SkinColor.Light): string {
        const spriteMap: Record<Gender, Record<SkinColor, string>> = {
            [Gender.MALE]: { [SkinColor.Light]: 'wm', [SkinColor.Tanned]: 'ym', [SkinColor.Dark]: 'bm' },
            [Gender.FEMALE]: { [SkinColor.Light]: 'ww', [SkinColor.Tanned]: 'yw', [SkinColor.Dark]: 'bw' },
        };
        return spriteMap[gender][skinColor];
    }

    public static resolveGearFromEquippedItems(
        gear: GearConfig,
        equippedItems: EquippedItems,
        gender: Gender,
    ): GearConfig {
        /** Prefer gender sprite; fall back to opposite so missing female/male rows never go invisible. */
        const equippedSprite = (
            def: { equippedSpriteMale?: string; equippedSpriteFemale?: string } | undefined,
        ): string | undefined => {
            if (!def) {
                return undefined;
            }
            if (gender === Gender.MALE) {
                return def.equippedSpriteMale || def.equippedSpriteFemale;
            }
            return def.equippedSpriteFemale || def.equippedSpriteMale;
        };

        const weaponItem = equippedItems[ItemTypes.WEAPON];
        const weaponDef = weaponItem ? getItemById(weaponItem.itemId) : undefined;
        const weapon = gear.weapon ?? equippedSprite(weaponDef);
        const weaponStartSpriteSheetIndex = gear.weaponStartSpriteSheetIndex
            ?? weaponDef?.startSpriteSheetIndex
            ?? (weapon ? getItemByEquippedSprite(weapon)?.startSpriteSheetIndex : undefined);

        const shieldItem = equippedItems[ItemTypes.SHIELD];
        const shieldDef = shieldItem ? getItemById(shieldItem.itemId) : undefined;
        const shield = gear.shield ?? equippedSprite(shieldDef);
        const shieldStartSpriteSheetIndex = gear.shieldStartSpriteSheetIndex
            ?? shieldDef?.startSpriteSheetIndex
            ?? (shield ? getItemByEquippedSprite(shield)?.startSpriteSheetIndex : undefined);

        const armorItem = equippedItems[ItemTypes.ARMOR];
        const armorDef = armorItem ? getItemById(armorItem.itemId) : undefined;
        const armor = gear.armor ?? equippedSprite(armorDef);

        const hauberkItem = equippedItems[ItemTypes.HAUBERK];
        const hauberkDef = hauberkItem ? getItemById(hauberkItem.itemId) : undefined;
        const hauberk = gear.hauberk ?? equippedSprite(hauberkDef);

        const leggingsItem = equippedItems[ItemTypes.LEGGINGS];
        const leggingsDef = leggingsItem ? getItemById(leggingsItem.itemId) : undefined;
        const leggings = gear.leggings ?? equippedSprite(leggingsDef);

        const bootsItem = equippedItems[ItemTypes.BOOTS];
        const bootsDef = bootsItem ? getItemById(bootsItem.itemId) : undefined;
        const boots = gear.boots ?? equippedSprite(bootsDef);

        const helmItem = equippedItems[ItemTypes.HELMET];
        const helmDef = helmItem ? getItemById(helmItem.itemId) : undefined;
        const helm = gear.helm ?? equippedSprite(helmDef);

        const capeItem = equippedItems[ItemTypes.CAPE];
        const capeDef = capeItem ? getItemById(capeItem.itemId) : undefined;
        const cape = gear.cape ?? equippedSprite(capeDef);

        const accessoryItem = equippedItems[ItemTypes.ACCESSORY];
        const accessoryDef = accessoryItem ? getItemById(accessoryItem.itemId) : undefined;
        const accessory = gear.accessory ?? equippedSprite(accessoryDef);

        const underwear = gear.underwear ?? (gender === Gender.MALE ? 'mpt' : 'wpt');
        return { ...gear, weapon, weaponStartSpriteSheetIndex, shield, shieldStartSpriteSheetIndex, armor, hauberk, leggings, boots, helm, cape, accessory, underwear };
    }

    public static resolveGearFromInventory(
        gear: GearConfig,
        inventoryManager: { equippedItems: EquippedItems },
        gender: Gender,
    ): GearConfig {
        return this.resolveGearFromEquippedItems(gear, inventoryManager.equippedItems, gender);
    }

    public static buildAssetConfigs(direction: Direction, state: PlayerState, gear: GearConfig): BuildPlayerAssetConfigsResult {
        const configs: Omit<GameAssetConfig, 'x' | 'y'>[] = [];
        const assetIndices: PlayerAssetIndices = {
            weaponAssetIndex: -1,
            shieldAssetIndex: -1,
            armorAssetIndex: -1,
            hauberkAssetIndex: -1,
            leggingsAssetIndex: -1,
            bootsAssetIndex: -1,
            helmAssetIndex: -1,
            capeAssetIndex: -1,
            accessoryAssetIndex: -1,
            humanAssetIndex: -1,
            hairAssetIndex: -1,
            underwearAssetIndex: -1,
        };

        const isFemale = gear.human === 'ww' || gear.human === 'yw' || gear.human === 'bw';
        const underwear = gear.underwear ?? (isFemale ? 'wpt' : 'mpt');
        const hairStyleIndex = gear.hairStyleIndex ?? 0;
        const hair = isFemale ? 'whr' : 'mhr';
        // No ghost clothing: only draw layers that are actually equipped (plus body/hair/underwear).
        // Catalog-first-item fallbacks made unequipped chars look armored/caped.
        const gearBySlot: Record<GearSlot, string | undefined> = {
            human: gear.human,
            hair,
            underwear,
            hauberk: gear.hauberk,
            leggings: gear.leggings,
            boots: gear.boots,
            helm: gear.helm,
            armor: gear.armor,
            weapon: gear.weapon,
            shield: gear.shield,
            cape: gear.cape,
            accessory: gear.accessory,
        };

        const gearRenderOrder = getGearRenderOrder(direction, state === PlayerState.Run);
        for (const slot of gearRenderOrder) {
            const equippedSpriteName = gearBySlot[slot];
            const isUnequippedArmament =
                (slot === 'weapon' || slot === 'shield' || slot === 'accessory') && !equippedSpriteName;
            const spriteName = isUnequippedArmament ? UNEQUIPPED_ARMAMENT_PLACEHOLDER : equippedSpriteName;
            if (!spriteName) {
                continue;
            }

            switch (slot) {
                case 'weapon':
                    assetIndices.weaponAssetIndex = configs.length;
                    break;
                case 'shield':
                    assetIndices.shieldAssetIndex = configs.length;
                    break;
                case 'armor':
                    assetIndices.armorAssetIndex = configs.length;
                    break;
                case 'hauberk':
                    assetIndices.hauberkAssetIndex = configs.length;
                    break;
                case 'leggings':
                    assetIndices.leggingsAssetIndex = configs.length;
                    break;
                case 'boots':
                    assetIndices.bootsAssetIndex = configs.length;
                    break;
                case 'helm':
                    assetIndices.helmAssetIndex = configs.length;
                    break;
                case 'cape':
                    assetIndices.capeAssetIndex = configs.length;
                    break;
                case 'accessory':
                    assetIndices.accessoryAssetIndex = configs.length;
                    break;
                case 'human':
                    assetIndices.humanAssetIndex = configs.length;
                    break;
                case 'hair':
                    assetIndices.hairAssetIndex = configs.length;
                    break;
                case 'underwear':
                    assetIndices.underwearAssetIndex = configs.length;
                    break;
            }

            switch (slot) {
                case 'human': {
                    const spriteSheetIndex = HUMAN_SPRITESHEET_BASE[state] + direction;
                    configs.push({
                        spriteName,
                        spriteSheetIndex,
                        direction: 0,
                        animationType: AnimationType.FullFrame,
                    });
                    break;
                }
                case 'weapon': {
                    if (isUnequippedArmament) {
                        // Reserve draw order only — invisible pending texture, never a catalog weapon sheet.
                        configs.push({
                            spriteName,
                            spriteSheetIndex: 0,
                            direction: 0,
                            animationType: AnimationType.FullFrame,
                            pendingLazyPlayerItemAppearance: true,
                        });
                        break;
                    }
                    // Cast/PickUp/Die use -1; using that raw made sheet index jump to a wrong sword
                    // (looks like a floating detached weapon — Morlak Flameberge report).
                    const rawArmament = ARMAMENT_STATE_INDEX[state];
                    const armamentStateIndex = rawArmament >= 0 ? rawArmament : 1; // IdleCombat fallback
                    const base = gear.weaponStartSpriteSheetIndex ?? 0;
                    const spriteSheetIndex = base + armamentStateIndex * 8 + direction;
                    const weaponItem = getItemByEquippedSprite(spriteName);
                    const effects = weaponItem?.effects;
                    configs.push({
                        spriteName,
                        spriteSheetIndex,
                        direction: 0,
                        animationType: AnimationType.FullFrame,
                        ...(effects && effects.length > 0 && { effects }),
                    });
                    break;
                }
                case 'shield': {
                    if (isUnequippedArmament) {
                        configs.push({
                            spriteName,
                            spriteSheetIndex: 0,
                            direction: 0,
                            framesPerDirection: 8,
                            animationType: AnimationType.DirectionalSubFrame,
                            pendingLazyPlayerItemAppearance: true,
                        });
                        break;
                    }
                    const armamentStateIndex = ARMAMENT_STATE_INDEX[state];
                    const base = gear.shieldStartSpriteSheetIndex ?? 0;
                    const effectiveStateIndex = armamentStateIndex >= 0 ? armamentStateIndex : 1;
                    // Merien/etc. can claim start>=63 while msh/wsh.spr only pack 0..62.
                    // Cap so we never request a non-existent sheet at Player construct time.
                    const spriteSheetIndex = Math.min(62, Math.max(0, base + effectiveStateIndex));
                    const shieldItem = getItemByEquippedSprite(spriteName);
                    const effects = shieldItem?.effects;
                    configs.push({
                        spriteName,
                        spriteSheetIndex,
                        direction,
                        framesPerDirection: 8,
                        animationType: AnimationType.DirectionalSubFrame,
                        ...(effects && effects.length > 0 && { effects }),
                    });
                    break;
                }
                case 'accessory': {
                    if (isUnequippedArmament) {
                        configs.push({
                            spriteName,
                            spriteSheetIndex: 0,
                            direction: 0,
                            framesPerDirection: 8,
                            animationType: AnimationType.FullFrame,
                            pendingLazyPlayerItemAppearance: true,
                        });
                        break;
                    }
                    const angelicState = ANGELIC_STATE_FROM_PLAYER_STATE[state];
                    const spriteSheetIndex = angelicState * 8 + direction;
                    const framesPerDirection = ANGELIC_STATE_FRAME_COUNT[angelicState] ?? 8;
                    const accessoryItem = getItemByEquippedSprite(spriteName);
                    const effects = accessoryItem?.effects;
                    configs.push({
                        spriteName,
                        spriteSheetIndex,
                        direction: 0,
                        framesPerDirection,
                        animationType: AnimationType.FullFrame,
                        ...(effects && effects.length > 0 && { effects }),
                    });
                    break;
                }
                case 'hair': {
                    const framesPerDirection = PLAYER_ANIMATION_FRAME_COUNT[state];
                    const effectiveHairStyle = hairStyleIndex === 2 ? 0 : hairStyleIndex;
                    const spriteSheetIndex = effectiveHairStyle * 12 + ARMOUR_SPRITESHEET_BASE[state];
                    configs.push({
                        spriteName,
                        spriteSheetIndex,
                        direction,
                        framesPerDirection,
                        animationType: AnimationType.DirectionalSubFrame,
                    });
                    break;
                }
                case 'underwear': {
                    const framesPerDirection = PLAYER_ANIMATION_FRAME_COUNT[state];
                    const underwearColorIndex = gear.underwearColorIndex ?? 0;
                    const spriteSheetIndex = underwearColorIndex * 12 + ARMOUR_SPRITESHEET_BASE[state];
                    configs.push({
                        spriteName,
                        spriteSheetIndex,
                        direction,
                        framesPerDirection,
                        animationType: AnimationType.DirectionalSubFrame,
                    });
                    break;
                }
                default: {
                    // armor, hauberk, leggings, boots, helm, cape (glare supported; accessory excluded)
                    const slotItem = getItemByEquippedSprite(spriteName);
                    const effects = slotItem?.effects;
                    configs.push({
                        spriteName,
                        spriteSheetIndex: ARMOUR_SPRITESHEET_BASE[state],
                        direction,
                        animationType: AnimationType.DirectionalSubFrame,
                        ...(effects && effects.length > 0 && { effects }),
                    });
                    break;
                }
            }
        }

        // Slight horizontal stretch (height unchanged) — Olympia-on-classic-FOV feel.
        const scaledConfigs =
            PLAYER_BODY_SCALE_X === 1
                ? configs
                : configs.map((c) => ({ ...c, scaleX: PLAYER_BODY_SCALE_X, scaleY: 1 }));

        return { configs: scaledConfigs, assetIndices };
    }

    public getGender(): Gender {
        return this.gender;
    }

    public getHumanSpriteName(): string {
        return this.humanSpriteName;
    }

    public getHairStyleIndex(): number {
        return this.hairStyleIndex;
    }

    public getUnderwearColorIndex(): number {
        return this.underwearColorIndex;
    }

    /**
     * Visible body/gear layers currently drawn on the map (depth-sorted).
     * Used by F5 paper-doll to snapshot the exact avatar, not a rebuilt mannequin.
     */
    public getVisibleSpritesForCapture(): Array<{ sprite: GameObjects.Sprite; spriteName: string }> {
        const out: Array<{ sprite: GameObjects.Sprite; spriteName: string }> = [];
        for (let i = 0; i < this.assets.length; i++) {
            const asset = this.assets[i];
            if (asset.isPendingLazyPlayerItemAppearance()) {
                continue;
            }
            const name = asset.getSpriteName();
            if (!name || name === UNEQUIPPED_ARMAMENT_PLACEHOLDER || name.startsWith('__')) {
                continue;
            }
            const spr = asset.sprite;
            if (!spr?.active || !spr.visible || spr.alpha < 0.05) {
                continue;
            }
            const texKey = spr.texture?.key;
            if (!texKey || texKey === '__MISSING' || texKey === '__DEFAULT') {
                continue;
            }
            out.push({ sprite: spr, spriteName: name });
        }
        out.sort((a, b) => a.sprite.depth - b.sprite.depth);
        return out;
    }

    public getAccessoryAssetIndex(): number {
        return this.accessoryAssetIndex;
    }

    public hasAccessory(): boolean {
        return this.accessory !== undefined;
    }

    public getShadowSpriteSheetIndex(state: PlayerState, direction: Direction): number {
        return HUMAN_SPRITESHEET_BASE[state] + direction;
    }

    public applyAppearanceChange(gender: Gender, skinColor: SkinColor, equippedItems: EquippedItems, currentState: PlayerState, direction: Direction, shadowManager?: ShadowManager, underwearColorIndex?: number, hairStyleIndex?: number): void {
        this.gender = gender;
        this.humanSpriteName = PlayerAppearanceManager.getHumanSpriteName(gender, skinColor);
        if (underwearColorIndex !== undefined) {
            this.underwearColorIndex = Math.max(0, Math.min(7, underwearColorIndex));
        }
        if (hairStyleIndex !== undefined) {
            this.hairStyleIndex = hairStyleIndex < 0 ? 0 : hairStyleIndex > 7 ? 7 : hairStyleIndex;
        }

        if (this.humanAssetIndex >= 0) {
            this.assets[this.humanAssetIndex].setSpriteName(this.humanSpriteName);
        }
        if (this.hairAssetIndex >= 0) {
            const hairSprite = gender === Gender.MALE ? 'mhr' : 'whr';
            this.assets[this.hairAssetIndex].setSpriteName(hairSprite);
        }
        if (this.underwearAssetIndex >= 0) {
            this.assets[this.underwearAssetIndex].setSpriteName(gender === Gender.MALE ? 'mpt' : 'wpt');
        }
        if (shadowManager) {
            const shadowSpriteSheetIndex = this.getShadowSpriteSheetIndex(currentState, direction);
            shadowManager.updateShadowSprite(this.humanSpriteName, shadowSpriteSheetIndex);
        }

        this.applyEquipItem(
            ItemTypes.WEAPON,
            equippedItems[ItemTypes.WEAPON]?.itemId,
            equippedItems[ItemTypes.WEAPON]?.effectOverrides,
            equippedItems[ItemTypes.WEAPON]?.itemColor,
        );
        this.applyEquipItem(
            ItemTypes.SHIELD,
            equippedItems[ItemTypes.SHIELD]?.itemId,
            equippedItems[ItemTypes.SHIELD]?.effectOverrides,
            equippedItems[ItemTypes.SHIELD]?.itemColor,
        );
        this.applyEquipItem(
            ItemTypes.ARMOR,
            equippedItems[ItemTypes.ARMOR]?.itemId,
            equippedItems[ItemTypes.ARMOR]?.effectOverrides,
            equippedItems[ItemTypes.ARMOR]?.itemColor,
        );
        this.applyEquipItem(
            ItemTypes.HAUBERK,
            equippedItems[ItemTypes.HAUBERK]?.itemId,
            equippedItems[ItemTypes.HAUBERK]?.effectOverrides,
            equippedItems[ItemTypes.HAUBERK]?.itemColor,
        );
        this.applyEquipItem(
            ItemTypes.LEGGINGS,
            equippedItems[ItemTypes.LEGGINGS]?.itemId,
            equippedItems[ItemTypes.LEGGINGS]?.effectOverrides,
            equippedItems[ItemTypes.LEGGINGS]?.itemColor,
        );
        this.applyEquipItem(
            ItemTypes.BOOTS,
            equippedItems[ItemTypes.BOOTS]?.itemId,
            equippedItems[ItemTypes.BOOTS]?.effectOverrides,
            equippedItems[ItemTypes.BOOTS]?.itemColor,
        );
        this.applyEquipItem(
            ItemTypes.HELMET,
            equippedItems[ItemTypes.HELMET]?.itemId,
            equippedItems[ItemTypes.HELMET]?.effectOverrides,
            equippedItems[ItemTypes.HELMET]?.itemColor,
        );
        this.applyEquipItem(
            ItemTypes.CAPE,
            equippedItems[ItemTypes.CAPE]?.itemId,
            equippedItems[ItemTypes.CAPE]?.effectOverrides,
            equippedItems[ItemTypes.CAPE]?.itemColor,
        );
        this.applyEquipItem(
            ItemTypes.ACCESSORY,
            equippedItems[ItemTypes.ACCESSORY]?.itemId,
            equippedItems[ItemTypes.ACCESSORY]?.effectOverrides,
            equippedItems[ItemTypes.ACCESSORY]?.itemColor,
        );
        this.syncHairVisibility();
        this.applyChilledToAllAssets();
        this.applySaturateToEligibleAssets();
        this.applyDisconnectedToAllAssets();
        this.applyInvisibilityAlpha();
    }

    public handleEquip(
        itemType: ItemTypes,
        itemId: number | undefined,
        effectOverrides?: Effect[],
        itemColor?: number,
    ): void {
        this.applyEquipItem(itemType, itemId, effectOverrides, itemColor);
    }

    public updateDepth(worldY: number, direction: Direction, currentState: PlayerState): void {
        // +20 above same-row map objects (carpets/furniture) so players never draw under floor decals.
        // Callers pass logical or visual worldY; bias matches GameObject entity depth.
        const baseDepth = worldY * DEPTH_MULTIPLIER + ENTITY_DEPTH_BIAS;
        const order = getGearRenderOrder(direction, currentState === PlayerState.Run);
        for (let i = 0; i < this.assets.length; i++) {
            const slot = this.getGearSlotForSprite(this.assets[i].getSpriteName(), i);
            const position = slot ? order.indexOf(slot) : i;
            this.assets[i].setDepth(baseDepth + position * 3);
        }
    }

    /**
     * Ghost config for trail effect during movement.
     * When provided and enabled, each asset renders a semi-transparent copy offset behind.
     */
    public updateAssetPositions(pixelX: number, pixelY: number, ghostConfig?: { enabled: boolean; offsetX: number; offsetY: number }): void {
        for (let i = 0; i < this.assets.length; i++) {
            const asset = this.assets[i];
            if (asset.isMapObject()) {
                continue;
            }

            const isAccessory = i === this.accessoryAssetIndex && this.accessory;
            const offsetX = isAccessory ? this.accessoryOffsetX : 0;
            const offsetY = isAccessory ? this.accessoryOffsetY : 0;
            asset.setPosition(pixelX + offsetX, pixelY + offsetY);

            if (ghostConfig?.enabled) {
                asset.updateGhostSprite(true, ghostConfig.offsetX, ghostConfig.offsetY);
            } else {
                asset.updateGhostSprite(false, 0, 0);
            }
        }
    }

    /**
     * Sets or clears chilled blue tint on all appearance items.
     * Applied after other effects (e.g. TINT_APPEARANCE, glare) so it blends with existing visuals.
     */
    public setChilledEffect(chilled: boolean): void {
        this.isChilled = chilled;
        this.applyChilledToAllAssets();
    }

    /**
     * Sets or clears berserk red overlay on body and equipment (excludes weapon, shield, accessory).
     * Berserk overlay is rendered underneath other effects (chilled, glare).
     */
    public setBerserkEffect(berserked: boolean): void {
        this.isBerserked = berserked;
        this.applySaturateToEligibleAssets();
    }

    /**
     * Tracks spawn protection state. Green glow on the base body is applied from Player via getHumanBodyAsset().setSpawnProtectionGlow.
     */
    public setSpawnProtectionEffect(enabled: boolean): void {
        this.isSpawnProtected = enabled;
        this.applySaturateToEligibleAssets();
    }

    /** Whether spawn protection is active (matches server spawn protection / join grace). */
    public hasSpawnProtectionEffect(): boolean {
        return this.isSpawnProtected;
    }

    /** Base body GameAsset (human sprite); used for spawn protection glow on the body only. */
    public getHumanBodyAsset(): GameAsset | undefined {
        if (this.humanAssetIndex < 0) {
            return undefined;
        }
        return this.assets[this.humanAssetIndex];
    }

    /**
     * Sets or clears the disconnected black tint on all appearance assets.
     * This runs after every other tint source so disconnected players stay visually overridden.
     */
    public setDisconnectedEffect(disconnected: boolean): void {
        this.isDisconnected = disconnected;
        this.applyDisconnectedToAllAssets();
    }

    /**
     * Applies chilled tint to all assets. Called at the end of appearance updates so it layers over other effects.
     */
    private applyChilledToAllAssets(): void {
        for (let i = 0; i < this.assets.length; i++) {
            this.assets[i].setChilledTint(this.isChilled);
        }
    }

    /** Red tint for berserk effect. */
    private static readonly BERSERK_COLOR = 0xff4444;
    private static readonly BERSERK_ALPHA = 0.5;

    /**
     * Applies berserk red saturate overlay to body, underwear, and equipment. Excludes weapon, shield, accessory (angels).
     * Independent of spawn protection (both can be active: green body glow + red overlay).
     */
    private applySaturateToEligibleAssets(): void {
        for (let i = 0; i < this.assets.length; i++) {
            const slot = this.getGearSlotForSprite(this.assets[i].getSpriteName(), i);
            const excluded = slot === 'weapon' || slot === 'shield' || slot === 'accessory';
            this.assets[i].setSaturateOverlay(this.isBerserked && !excluded, PlayerAppearanceManager.BERSERK_COLOR, PlayerAppearanceManager.BERSERK_ALPHA);
        }
    }

    private applyDisconnectedToAllAssets(): void {
        for (let i = 0; i < this.assets.length; i++) {
            this.assets[i].setDisconnectedTint(this.isDisconnected);
        }
    }

    public setInvisibilityLocalHalfOpacity(enabled: boolean): void {
        this.invisibilityLocalHalf = enabled;
        this.applyInvisibilityAlpha();
    }

    public setInvisibilityRemoteHidden(hidden: boolean): void {
        this.invisibilityRemoteHidden = hidden;
        this.applyInvisibilityAlpha();
    }

    private applyInvisibilityAlpha(): void {
        if (this.invisibilityRemoteHidden) {
            for (let i = 0; i < this.assets.length; i++) {
                this.assets[i].setAlpha(0);
            }
            return;
        }
        const alpha = this.invisibilityLocalHalf ? 0.5 : 1;
        for (let i = 0; i < this.assets.length; i++) {
            this.assets[i].setAlpha(alpha);
        }
    }

    public updateShadow(shadowManager: ShadowManager | undefined, currentState: PlayerState, direction: Direction, animationConfig: PlayerAppearanceAnimationConfig): void {
        if (!shadowManager) {
            return;
        }
        const shadowSpriteSheetIndex = HUMAN_SPRITESHEET_BASE[currentState] + direction;
        const animationFrameRate = this.getAnimationFrameRate(currentState, animationConfig);
        const repeat = this.getAnimationRepeat(currentState);
        shadowManager.updateAnimation(shadowSpriteSheetIndex, animationFrameRate, repeat);
    }

    public applyStateAppearance(newState: PlayerState, direction: Direction, animationConfig: PlayerAppearanceAnimationConfig): void {
        const repeat = this.getAnimationRepeat(newState);
        const currentRelativeFrame = repeat === 0
            ? undefined
            : (this.assets.length > 0 ? this.assets[0].getCurrentRelativeFrame() : undefined);
        const frameCount = PLAYER_ANIMATION_FRAME_COUNT[newState];

        for (let i = 0; i < this.assets.length; i++) {
            const asset = this.assets[i];
            let spriteName = asset.getSpriteName();
            const slot = this.getGearSlotForSprite(spriteName, i);

            // Exception: use female sprite for broken male sprites per WEAPON_SPRITE_OVERWRITES
            if (slot === 'weapon' && this.weapon !== undefined) {
                const stateName = PlayerState[newState];
                const overwrites = WEAPON_SPRITE_OVERWRITES[stateName];
                const overwrite = overwrites?.find((o) => o.maleSprite === this.weapon);
                spriteName = overwrite ? overwrite.femaleSprite : this.weapon;
                asset.setSpriteName(spriteName);
            }

            const shouldHideArmaments = newState === PlayerState.Die ||
                newState === PlayerState.Cast ||
                newState === PlayerState.PickUp ||
                newState === PlayerState.BowStance;
            if (shouldHideArmaments && (slot === 'weapon' || slot === 'shield')) {
                asset.setVisible(false);
                continue;
            }

            if (this.isLazyPlayerItemAppearanceSlot(slot) && this.scheduleLazyItemAppearanceIfNeeded(spriteName, asset)) {
                asset.setVisible(false);
                continue;
            }

            if (asset.isPendingLazyPlayerItemAppearance()) {
                asset.setVisible(false);
                continue;
            }

            asset.setVisible(this.isSlotVisible(slot));

            const { animationKey, animationDirection, animationType } = this.getAnimationConfigForAsset(spriteName, newState, direction, i);
            const animationFrameRate = slot === 'accessory'
                ? this.getAccessoryAnimationFrameRate(newState, animationConfig)
                : this.getAnimationFrameRate(newState, animationConfig);
            const assetRepeat = slot === 'accessory' ? this.getAccessoryAnimationRepeat(newState) : repeat;
            const assetFrameCount = slot === 'accessory'
                ? (ANGELIC_STATE_FRAME_COUNT[ANGELIC_STATE_FROM_PLAYER_STATE[newState]] ?? 8)
                : frameCount;
            asset.playAnimationWithDirection(animationKey, animationDirection, animationFrameRate, currentRelativeFrame, assetRepeat, assetFrameCount, animationType);
        }
        this.applyChilledToAllAssets();
        this.applySaturateToEligibleAssets();
        this.applyDisconnectedToAllAssets();
        this.applyInvisibilityAlpha();
    }

    private applyEquipItem(
        itemType: ItemTypes,
        itemId: number | undefined,
        effectOverrides?: Effect[],
        itemColor?: number,
    ): void {
        switch (itemType) {
            case ItemTypes.WEAPON:
                this.applyWeaponEquip(itemId, effectOverrides, itemColor);
                break;
            case ItemTypes.SHIELD:
                this.applyShieldEquip(itemId, effectOverrides, itemColor);
                break;
            case ItemTypes.ARMOR:
                this.applySimpleEquip(itemId, this.armorAssetIndex, 'armor', effectOverrides, itemColor);
                break;
            case ItemTypes.HAUBERK:
                this.applySimpleEquip(itemId, this.hauberkAssetIndex, 'hauberk', effectOverrides, itemColor);
                break;
            case ItemTypes.LEGGINGS:
                this.applySimpleEquip(itemId, this.leggingsAssetIndex, 'leggings', effectOverrides, itemColor);
                break;
            case ItemTypes.BOOTS:
                this.applySimpleEquip(itemId, this.bootsAssetIndex, 'boots', effectOverrides, itemColor);
                break;
            case ItemTypes.HELMET:
                this.applySimpleEquip(itemId, this.helmAssetIndex, 'helm', effectOverrides, itemColor);
                break;
            case ItemTypes.CAPE:
                this.applySimpleEquip(itemId, this.capeAssetIndex, 'cape', effectOverrides, itemColor);
                break;
            case ItemTypes.ACCESSORY:
                this.applyAccessoryEquip(itemId, effectOverrides, itemColor);
                break;
        }
        this.applyChilledToAllAssets();
        this.applySaturateToEligibleAssets();
        this.applyDisconnectedToAllAssets();
        this.applyInvisibilityAlpha();
    }

    /**
     * When lazy item appearance is enabled and the `.spr` is missing, starts fetch and keeps the layer hidden
     * until load completes. Returns true if load was deferred (caller must not force visible yet).
     */
    private scheduleLazyItemAppearanceIfNeeded(sprite: string, asset: GameAsset): boolean {
        if (!LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND) {
            return false;
        }
        if (!getItemEquippedAppearanceSpriteNames().has(sprite)) {
            return false;
        }
        if (arePlayerItemAppearanceLoaded(this.scene, sprite)) {
            // Sheets already registered: promote synchronously so the following setVisible / state
            // refresh is not blocked by a leftover unequipped-placeholder pending flag.
            if (asset.isPendingLazyPlayerItemAppearance() && asset.getSpriteName() === sprite) {
                asset.promotePendingPlayerItemAppearance();
            }
            return false;
        }
        if (!asset.isPendingLazyPlayerItemAppearance()) {
            asset.retargetPlayerItemAppearanceToPending(this.scene);
        }
        if (!this.lazyItemAppearanceLoadsStarted.has(sprite)) {
            this.lazyItemAppearanceLoadsStarted.add(sprite);
            loadPlayerItemAppearanceOnDemand(this.scene, sprite)
                .then(() => {
                    this.lazyItemAppearanceLoadsStarted.delete(sprite);
                    this.flushPendingLazyItemPromotionForSprite(sprite);
                })
                .catch((err) => {
                    this.lazyItemAppearanceLoadsStarted.delete(sprite);
                    console.error(`[PlayerItemAppearanceLoader] Failed to load equipped appearance '${sprite}'`, err);
                });
        }
        return true;
    }

    /**
     * After `HBSpriteFile.load` resolves, Phaser may not expose new animations until the next frame.
     * Defer promotion and appearance refresh so `scene.anims.exists` sees keys like `sprite-mbabhammer-10`.
     */
    private flushPendingLazyItemPromotionForSprite(sprite: string): void {
        this.scene.time.delayedCall(0, () => {
            for (const a of this.assets) {
                if (a.isPendingLazyPlayerItemAppearance() && a.getSpriteName() === sprite) {
                    a.promotePendingPlayerItemAppearance();
                }
            }
            // Phaser may not expose newly registered animations until after this frame; refresh once more.
            this.scene.time.delayedCall(0, () => {
                this.onLazyItemAppearanceLoaded?.();
            });
        });
    }

    /** Gear slots that may use `.spr` on-demand loading (matches equip handlers). */
    private isLazyPlayerItemAppearanceSlot(slot: GearSlot | undefined): boolean {
        return (
            slot === 'weapon' ||
            slot === 'shield' ||
            slot === 'armor' ||
            slot === 'hauberk' ||
            slot === 'leggings' ||
            slot === 'boots' ||
            slot === 'helm' ||
            slot === 'cape' ||
            slot === 'accessory'
        );
    }

    private applyWeaponEquip(itemId: number | undefined, effectOverrides?: Effect[], itemColor?: number): void {
        if (itemId === undefined) {
            this.weapon = undefined;
            this.weaponStartSpriteSheetIndex = undefined;
            if (this.weaponAssetIndex >= 0) {
                this.assets[this.weaponAssetIndex].resetToUnequippedArmamentPlaceholder(UNEQUIPPED_ARMAMENT_PLACEHOLDER);
            }
            return;
        }
        const itemDef = getItemById(itemId);
        if (!itemDef) {
            return;
        }
        const sprite = this.gender === Gender.MALE ? itemDef.equippedSpriteMale : itemDef.equippedSpriteFemale;
        if (!sprite) {
            return;
        }
        this.weapon = sprite;
        this.weaponStartSpriteSheetIndex = itemDef.startSpriteSheetIndex;
        if (this.weaponAssetIndex >= 0) {
            const weaponAsset = this.assets[this.weaponAssetIndex];
            weaponAsset.setSpriteName(sprite);
            // Unequipped placeholder kept sheet 0; sync base sheet so lazy promote targets a real texture.
            weaponAsset.setSpriteSheetIndex(itemDef.startSpriteSheetIndex ?? 0);
            weaponAsset.setItemEffects(effectsWithOlympiaItemColor(itemDef.effects, effectOverrides, itemColor));
            if (this.scheduleLazyItemAppearanceIfNeeded(sprite, weaponAsset)) {
                return;
            }
            weaponAsset.setVisible(true);
        }
    }

    private applyShieldEquip(itemId: number | undefined, effectOverrides?: Effect[], itemColor?: number): void {
        if (itemId === undefined) {
            this.shield = undefined;
            this.shieldStartSpriteSheetIndex = undefined;
            if (this.shieldAssetIndex >= 0) {
                this.assets[this.shieldAssetIndex].resetToUnequippedArmamentPlaceholder(UNEQUIPPED_ARMAMENT_PLACEHOLDER);
            }
            return;
        }
        const itemDef = getItemById(itemId);
        if (!itemDef) {
            return;
        }
        const sprite = this.gender === Gender.MALE ? itemDef.equippedSpriteMale : itemDef.equippedSpriteFemale;
        if (!sprite) {
            return;
        }
        this.shield = sprite;
        this.shieldStartSpriteSheetIndex = itemDef.startSpriteSheetIndex;
        if (this.shieldAssetIndex >= 0) {
            const shieldAsset = this.assets[this.shieldAssetIndex];
            shieldAsset.setSpriteName(sprite);
            // Shields share msh/wsh with per-item offsets (7, 14, …). Placeholder sheet 0 must not stick.
            shieldAsset.setSpriteSheetIndex(itemDef.startSpriteSheetIndex ?? 0);
            shieldAsset.setItemEffects(effectsWithOlympiaItemColor(itemDef.effects, effectOverrides, itemColor));
            if (this.scheduleLazyItemAppearanceIfNeeded(sprite, shieldAsset)) {
                return;
            }
            // VerifyFix: shield layer becomes visible once the slot has an equipped sprite.
            shieldAsset.setVisible(true);
        }
    }

    private applySimpleEquip(
        itemId: number | undefined,
        assetIndex: number,
        slot: 'armor' | 'hauberk' | 'leggings' | 'boots' | 'helm' | 'cape',
        effectOverrides?: Effect[],
        itemColor?: number,
    ): void {
        if (itemId === undefined) {
            this[slot] = undefined;
            if (assetIndex >= 0) {
                const asset = this.assets[assetIndex];
                asset.setItemEffects(undefined);
                asset.setVisible(false);
            }
            if (slot === 'helm') {
                this.syncHairVisibility();
            }
            return;
        }
        const itemDef = getItemById(itemId);
        if (!itemDef) {
            return;
        }
        const sprite = this.gender === Gender.MALE ? itemDef.equippedSpriteMale : itemDef.equippedSpriteFemale;
        if (!sprite) {
            return;
        }
        this[slot] = sprite;
        if (assetIndex >= 0) {
            const asset = this.assets[assetIndex];
            asset.setSpriteName(sprite);
            asset.setItemEffects(effectsWithOlympiaItemColor(itemDef.effects, effectOverrides, itemColor));
            if (this.scheduleLazyItemAppearanceIfNeeded(sprite, asset)) {
                if (slot === 'helm') {
                    this.syncHairVisibility();
                }
                return;
            }
            asset.setVisible(true);
        }
        if (slot === 'helm') {
            this.syncHairVisibility();
        }
    }

    private applyAccessoryEquip(itemId: number | undefined, effectOverrides?: Effect[], itemColor?: number): void {
        if (itemId === undefined) {
            this.accessory = undefined;
            this.accessoryOffsetX = 0;
            this.accessoryOffsetY = 0;
            if (this.accessoryAssetIndex >= 0) {
                this.assets[this.accessoryAssetIndex].resetToUnequippedArmamentPlaceholder(UNEQUIPPED_ARMAMENT_PLACEHOLDER);
            }
            return;
        }
        const itemDef = getItemById(itemId);
        if (!itemDef) {
            return;
        }
        const sprite = this.gender === Gender.MALE ? itemDef.equippedSpriteMale : itemDef.equippedSpriteFemale;
        if (!sprite) {
            return;
        }
        this.accessory = sprite;
        this.accessoryOffsetX = itemDef.offsetX ?? 0;
        this.accessoryOffsetY = itemDef.offsetY ?? 0;
        if (this.accessoryAssetIndex >= 0) {
            const accessoryAsset = this.assets[this.accessoryAssetIndex];
            accessoryAsset.setSpriteName(sprite);
            accessoryAsset.setSpriteSheetIndex(itemDef.startSpriteSheetIndex ?? 0);
            accessoryAsset.setItemEffects(effectsWithOlympiaItemColor(itemDef.effects, effectOverrides, itemColor));
            if (this.scheduleLazyItemAppearanceIfNeeded(sprite, accessoryAsset)) {
                return;
            }
            accessoryAsset.setVisible(true);
        }
    }

    private updateAccessoryOffset(): void {
        if (!this.accessory) {
            this.accessoryOffsetX = 0;
            this.accessoryOffsetY = 0;
            return;
        }
        const accessoryItemDef = getItemByEquippedSprite(this.accessory);
        if (!accessoryItemDef) {
            this.accessoryOffsetX = 0;
            this.accessoryOffsetY = 0;
            return;
        }
        this.accessoryOffsetX = accessoryItemDef.offsetX ?? 0;
        this.accessoryOffsetY = accessoryItemDef.offsetY ?? 0;
    }

    private applyInitialVisibility(): void {
        if (this.weaponAssetIndex >= 0 && !this.weapon) {
            this.assets[this.weaponAssetIndex].setVisible(false);
        }
        if (this.shieldAssetIndex >= 0 && !this.shield) {
            this.assets[this.shieldAssetIndex].setVisible(false);
        }
        if (this.armorAssetIndex >= 0 && !this.armor) {
            this.assets[this.armorAssetIndex].setVisible(false);
        }
        if (this.hauberkAssetIndex >= 0 && !this.hauberk) {
            this.assets[this.hauberkAssetIndex].setVisible(false);
        }
        if (this.leggingsAssetIndex >= 0 && !this.leggings) {
            this.assets[this.leggingsAssetIndex].setVisible(false);
        }
        if (this.bootsAssetIndex >= 0 && !this.boots) {
            this.assets[this.bootsAssetIndex].setVisible(false);
        }
        if (this.helmAssetIndex >= 0 && !this.helm) {
            this.assets[this.helmAssetIndex].setVisible(false);
        }
        if (this.capeAssetIndex >= 0 && !this.cape) {
            this.assets[this.capeAssetIndex].setVisible(false);
        }
        if (this.accessoryAssetIndex >= 0 && !this.accessory) {
            this.assets[this.accessoryAssetIndex].setVisible(false);
        }
        this.syncHairVisibility();
    }

    /**
     * Hair layer off for style index 2 (bald) or when a helm is equipped (helm covers hair).
     */
    private syncHairVisibility(): void {
        if (this.hairAssetIndex < 0) {
            return;
        }
        const visible = this.hairStyleIndex !== 2 && this.helm === undefined;
        this.assets[this.hairAssetIndex].setVisible(visible);
    }

    private isSlotVisible(slot: GearSlot | undefined): boolean {
        switch (slot) {
            case 'weapon':
                return this.weapon !== undefined;
            case 'shield':
                return this.shield !== undefined;
            case 'armor':
                return this.armor !== undefined;
            case 'hauberk':
                return this.hauberk !== undefined;
            case 'leggings':
                return this.leggings !== undefined;
            case 'boots':
                return this.boots !== undefined;
            case 'helm':
                return this.helm !== undefined;
            case 'cape':
                return this.cape !== undefined;
            case 'accessory':
                return this.accessory !== undefined;
            case 'hair':
                return this.hairStyleIndex !== 2 && this.helm === undefined;
            default:
                return true;
        }
    }

    private getGearSlotForSprite(spriteName: string, assetIndex?: number): GearSlot | undefined {
        if (assetIndex !== undefined && assetIndex === this.weaponAssetIndex) {
            return 'weapon';
        }
        if (assetIndex !== undefined && assetIndex === this.shieldAssetIndex) {
            return 'shield';
        }
        if (assetIndex !== undefined && assetIndex === this.armorAssetIndex) {
            return 'armor';
        }
        if (assetIndex !== undefined && assetIndex === this.hairAssetIndex) {
            return 'hair';
        }
        if (assetIndex !== undefined && assetIndex === this.underwearAssetIndex) {
            return 'underwear';
        }
        if (assetIndex !== undefined && assetIndex === this.hauberkAssetIndex) {
            return 'hauberk';
        }
        if (assetIndex !== undefined && assetIndex === this.leggingsAssetIndex) {
            return 'leggings';
        }
        if (assetIndex !== undefined && assetIndex === this.bootsAssetIndex) {
            return 'boots';
        }
        if (assetIndex !== undefined && assetIndex === this.helmAssetIndex) {
            return 'helm';
        }
        if (assetIndex !== undefined && assetIndex === this.capeAssetIndex) {
            return 'cape';
        }
        if (assetIndex !== undefined && assetIndex === this.accessoryAssetIndex) {
            return 'accessory';
        }
        switch (spriteName) {
            case this.humanSpriteName:
                return 'human';
            case 'mhr':
            case 'whr':
                return 'hair';
            case 'mpt':
            case 'wpt':
                return 'underwear';
            case this.hauberk:
                return 'hauberk';
            case this.helm:
                return 'helm';
            case this.leggings:
                return 'leggings';
            case this.boots:
                return 'boots';
            case this.armor:
                return 'armor';
            case this.weapon:
                return 'weapon';
            case this.shield:
                return 'shield';
            case this.cape:
                return 'cape';
            case this.accessory:
                return 'accessory';
            default:
                return undefined;
        }
    }

    private getAnimationConfigForAsset(
        spriteName: string,
        newState: PlayerState,
        direction: Direction,
        assetIndex?: number,
    ): { animationKey: string; animationDirection: number; animationType: AnimationType } {
        const slot = this.getGearSlotForSprite(spriteName, assetIndex);
        if (!slot) {
            return {
                animationKey: `sprite-${spriteName}-0`,
                animationDirection: 0,
                animationType: AnimationType.FullFrame,
            };
        }

        if (slot === 'human') {
            const spriteSheetIndex = HUMAN_SPRITESHEET_BASE[newState] + direction;
            return {
                animationKey: `sprite-${spriteName}-${spriteSheetIndex}`,
                animationDirection: 0,
                animationType: AnimationType.FullFrame,
            };
        }

        if (slot === 'weapon') {
            const rawArmament = ARMAMENT_STATE_INDEX[newState];
            const armamentStateIndex = rawArmament >= 0 ? rawArmament : 1; // IdleCombat fallback
            const base = this.weaponStartSpriteSheetIndex ?? getItemByEquippedSprite(spriteName)?.startSpriteSheetIndex ?? 0;
            const spriteSheetIndex = base + armamentStateIndex * 8 + direction;
            return {
                animationKey: `sprite-${spriteName}-${spriteSheetIndex}`,
                animationDirection: 0,
                animationType: AnimationType.FullFrame,
            };
        }

        if (slot === 'shield') {
            const armamentStateIndex = ARMAMENT_STATE_INDEX[newState];
            const base = this.shieldStartSpriteSheetIndex ?? getItemByEquippedSprite(spriteName)?.startSpriteSheetIndex ?? 0;
            const effectiveStateIndex = armamentStateIndex >= 0 ? armamentStateIndex : 1;
            const spriteSheetIndex = Math.min(62, Math.max(0, base + effectiveStateIndex));
            return {
                animationKey: `sprite-${spriteName}-${spriteSheetIndex}`,
                animationDirection: direction,
                animationType: AnimationType.DirectionalSubFrame,
            };
        }

        if (slot === 'accessory') {
            const angelicState = ANGELIC_STATE_FROM_PLAYER_STATE[newState];
            const spriteSheetIndex = angelicState * 8 + direction;
            return {
                animationKey: `sprite-${spriteName}-${spriteSheetIndex}`,
                animationDirection: 0,
                animationType: AnimationType.FullFrame,
            };
        }

        if (slot === 'underwear') {
            const spriteSheetIndex = this.underwearColorIndex * 12 + ARMOUR_SPRITESHEET_BASE[newState];
            return {
                animationKey: `sprite-${spriteName}-${spriteSheetIndex}`,
                animationDirection: direction,
                animationType: AnimationType.DirectionalSubFrame,
            };
        }

        if (slot === 'hair') {
            const effectiveHairStyle = this.hairStyleIndex === 2 ? 0 : this.hairStyleIndex;
            const spriteSheetIndex = effectiveHairStyle * 12 + ARMOUR_SPRITESHEET_BASE[newState];
            return {
                animationKey: `sprite-${spriteName}-${spriteSheetIndex}`,
                animationDirection: direction,
                animationType: AnimationType.DirectionalSubFrame,
            };
        }

        return {
            animationKey: `sprite-${spriteName}-${ARMOUR_SPRITESHEET_BASE[newState]}`,
            animationDirection: direction,
            animationType: AnimationType.DirectionalSubFrame,
        };
    }

    private getAnimationFrameRate(state: PlayerState, animationConfig: PlayerAppearanceAnimationConfig): number {
        switch (state) {
            case PlayerState.Run:
            case PlayerState.WalkPeaceMode:
            case PlayerState.WalkCombatMode: {
                const frameCount = PLAYER_ANIMATION_FRAME_COUNT[state];
                return calculateFrameRateFromDuration(frameCount, animationConfig.movementSpeedMs);
            }
            case PlayerState.MeleeAttack:
            case PlayerState.BowAttack:
                return animationConfig.attackSpeed;
            case PlayerState.BowStance: {
                const frameCount = PLAYER_ANIMATION_FRAME_COUNT[state];
                const durationMs = animationConfig.bowStanceAnimationDurationMs ?? (4 / 15) * 1000;
                return calculateFrameRateFromDuration(frameCount, durationMs);
            }
            case PlayerState.Cast: {
                const frameCount = PLAYER_ANIMATION_FRAME_COUNT[state];
                return calculateFrameRateFromDuration(frameCount, animationConfig.castSpeed);
            }
            case PlayerState.TakeDamage:
            case PlayerState.TakeDamageOnMove:
            case PlayerState.TakeDamageWithKnockback: {
                const frameCount = PLAYER_ANIMATION_FRAME_COUNT[state];
                const durationMs = animationConfig.takeDamageAnimationDurationMs ?? (4 / 15) * 1000;
                return calculateFrameRateFromDuration(frameCount, durationMs);
            }
            case PlayerState.PickUp: {
                const frameCount = PLAYER_ANIMATION_FRAME_COUNT[state];
                const durationMs = animationConfig.pickupAnimationDurationMs ?? (4 / 15) * 1000;
                return calculateFrameRateFromDuration(frameCount, durationMs);
            }
            case PlayerState.Die:
            case PlayerState.IdlePeaceMode:
            case PlayerState.IdleCombatMode:
            default:
                return animationConfig.idleFrameRate;
        }
    }

    private getAnimationRepeat(state: PlayerState): number | undefined {
        if (state === PlayerState.MeleeAttack || state === PlayerState.BowAttack || state === PlayerState.BowStance || state === PlayerState.Cast || state === PlayerState.PickUp || state === PlayerState.TakeDamage || state === PlayerState.TakeDamageOnMove || state === PlayerState.TakeDamageWithKnockback || state === PlayerState.Die) {
            return 0;
        }
        return undefined;
    }

    private getAccessoryAnimationFrameRate(state: PlayerState, animationConfig: PlayerAppearanceAnimationConfig): number {
        const angelicState = ANGELIC_STATE_FROM_PLAYER_STATE[state];
        if (angelicState === 5) {
            return DEFAULT_ANIMATION_FRAME_RATE;
        }
        switch (state) {
            case PlayerState.MeleeAttack:
            case PlayerState.BowAttack:
                return animationConfig.attackSpeed;
            case PlayerState.Cast: {
                const frameCount = ANGELIC_STATE_FRAME_COUNT[4];
                return calculateFrameRateFromDuration(frameCount, animationConfig.castSpeed);
            }
            case PlayerState.TakeDamage:
            case PlayerState.TakeDamageOnMove:
            case PlayerState.TakeDamageWithKnockback: {
                const frameCount = ANGELIC_STATE_FRAME_COUNT[2];
                const durationMs = animationConfig.takeDamageAnimationDurationMs ?? (4 / 15) * 1000;
                return calculateFrameRateFromDuration(frameCount, durationMs);
            }
            case PlayerState.Die:
                return animationConfig.idleFrameRate;
            default:
                return DEFAULT_ANIMATION_FRAME_RATE;
        }
    }

    private getAccessoryAnimationRepeat(state: PlayerState): number | undefined {
        const angelicState = ANGELIC_STATE_FROM_PLAYER_STATE[state];
        if (angelicState === 5) {
            return undefined;
        }
        return 0;
    }
}
