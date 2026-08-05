import {
    CastAoeSpell,
    CastDirectionalAoeSpell,
    ChatMessageReceived,
    ClientMessage,
    EquippedInventoryItemEntry,
    GroundStatesEnteredRange,
    GroundStatesLeftRange,
    HpUpdated,
    InitialGameWorldState,
    InitialState,
    InventoryItemEntry,
    ItemAddedToBag,
    ItemEquipped,
    ItemMovedInBag,
    ItemRemovedFromBag,
    ItemUnequipped,
    MonsterAttacked,
    MonsterAttackedMonster,
    MonsterCastAoeSpell,
    MonsterCastDirectionalAoeSpell,
    MonsterDied,
    MonsterEntityState,
    MonsterMoved,
    MonstersEnteredRange,
    MonstersLeftRange,
    MonstersList,
    NpcsEnteredRange,
    NpcsLeftRange,
    MonsterTakeDamageByMonster,
    PingResponse,
    PlayerAppearanceChanged,
    PlayerAttackModeChanged,
    PlayerSafeAttackModeChanged,
    PlayerAttackedMonster,
    PlayerAttackedPlayer,
    PlayerDisconnected,
    PlayerIdleDirectionChanged,
    PlayerMoved,
    PlayerMovementStateChanged,
    PlayerReceiveDamage,
    PlayerReconnected,
    PlayersEnteredRange,
    PlayersLeftRange,
    PlayerTakeDamage,
    PlayerGender,
    PlayerSkinColor,
    PlayerTeleported,
    ServerMessage,
    SpellCastCancelled,
    SpellCastFailed,
    SpellCastRequest,
    SpellCastStarted,
    VisibleEquippedItemEntry,
    WorldsList,
    TemporaryEffectApplied,
    type TemporaryEffectExpired,
    TemporaryEffectEntityKind,
    CastEffect,
    WeatherChanged,
    WeatherMode as WeatherModeProto,
    type ProgressionState,
    type ProgressionUpdated,
    type LevelUpSettingsApplied,
    type MajesticUpgradeResult,
    type StoneItemUpgradeResult,
    type ItemBindResult,
    type BuyCashShopItemResult,
    type MonsterKillsUpdated,
    type KillMilestoneClaimResult,
    type BeginnerPathState,
    type PartyState,
    type AntiBotToolsState as ProtoAntiBotToolsState,
    type SetAntiBotToolsResult as ProtoSetAntiBotToolsResult,
    type TimedChallengeState as ProtoTimedChallengeState,
    type TimedChallengeFinished as ProtoTimedChallengeFinished,
    type TimedChallengeLeaderboard as ProtoTimedChallengeLeaderboard,
} from '../proto/generated/network';
import { EventBus, type ToastRequestedEvent } from '../game/EventBus';
import { LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND } from '../Config';
import { buildGameWebSocketUrl } from './gameWebSocketUrl';
import { runSafeSync } from './SafeEntry';
import {
    CAST_AOE_SPELL_RECEIVED,
    CAST_DIRECTIONAL_AOE_SPELL_RECEIVED,
    MONSTER_CAST_AOE_SPELL_RECEIVED,
    MONSTER_CAST_DIRECTIONAL_AOE_SPELL_RECEIVED,
    CHAT_MESSAGE_RECEIVED,
    GROUND_STATES_ENTERED_RANGE_RECEIVED,
    GROUND_STATES_LEFT_RANGE_RECEIVED,
    HP_UPDATED_RECEIVED,
    PROGRESSION_STATE_RECEIVED,
    PROGRESSION_UPDATED_RECEIVED,
    LEVEL_UP_SETTINGS_APPLIED_RECEIVED,
    MAJESTIC_UPGRADE_RESULT_RECEIVED,
    STONE_ITEM_UPGRADE_RESULT_RECEIVED,
    ENCHANT_MATERIALS_STATE_RECEIVED,
    ENCHANT_RESULT_RECEIVED,
    CIC_ITEM_MERGE_RESULT_RECEIVED,
    SIPHON_GEM_UPGRADE_RESULT_RECEIVED,
    MAJESTIC_STAT_RESPEC_RESULT_RECEIVED,
    MONSTER_KILLS_UPDATED_RECEIVED,
    KILL_MILESTONE_CLAIM_RESULT_RECEIVED,
    BEGINNER_PATH_STATE_RECEIVED,
    PARTY_STATE_RECEIVED,
    INITIAL_GAME_WORLD_STATE_RECEIVED,
    MONSTER_ATTACKED_MONSTER_RECEIVED,
    MONSTER_ATTACKED_RECEIVED,
    MONSTER_DIED_RECEIVED,
    MONSTER_ENTERED_RANGE_RECEIVED,
    NPC_ENTERED_RANGE_RECEIVED,
    NPCS_LEFT_RANGE_RECEIVED,
    MONSTER_MOVED_RECEIVED,
    MONSTERS_LEFT_RANGE_RECEIVED,
    MONSTER_TAKE_DAMAGE_BY_MONSTER_RECEIVED,
    MONSTER_TAKE_DAMAGE_RECEIVED,
    OUT_UI_SET_ALLOW_DASH_ATTACK,
    OUT_UI_SET_ATTACK_MODE,
    OUT_UI_SET_SAFE_ATTACK_MODE,
    OUT_UI_SET_ATTACK_RANGE,
    OUT_UI_SET_ATTACK_SPEED_MS,
    OUT_UI_SET_ATTACK_TYPE,
    OUT_UI_SET_CAST_SPEED,
    OUT_UI_SET_DAMAGE,
    OUT_UI_SET_GENDER,
    OUT_UI_SET_GAME_WORLDS,
    OUT_UI_SET_MONSTERS,
    OUT_UI_SET_NPC_DIRECTORY,
    OUT_UI_SET_MOVEMENT_SPEED,
    OUT_UI_SET_RUN_MODE,
    OUT_UI_SET_HAIR_STYLE,
    OUT_UI_SET_SKIN_COLOR,
    OUT_UI_SET_SPELLS,
    OUT_UI_SET_STUN_DURATION_MS,
    OUT_UI_SET_UNDERWEAR_COLOR,
    PLAYER_ITEM_APPEARANCE_PREFETCH_REQUESTED,
    PLAYER_APPEARANCE_CHANGED_RECEIVED,
    PLAYER_ATTACKED_MONSTER_RECEIVED,
    PLAYER_ATTACKED_PLAYER_RECEIVED,
    PLAYER_ATTACK_MODE_CHANGED_RECEIVED,
    PLAYER_BOW_STANCE_PERFORMED_RECEIVED,
    PLAYER_DIED_RECEIVED,
    ENEMY_KILL_AWARDED_RECEIVED,
    PLAYER_DISCONNECTED_RECEIVED,
    PLAYER_IDLE_DIRECTION_CHANGED_RECEIVED,
    PLAYER_JOINED_RECEIVED,
    PLAYER_LEFT_RECEIVED,
    PLAYER_MOVED_RECEIVED,
    PLAYER_MOVEMENT_STATE_CHANGED_RECEIVED,
    PLAYER_PARALYZED_RECEIVED,
    PLAYER_PICKUP_PERFORMED_RECEIVED,
    PLAYER_RECEIVE_DAMAGE_RECEIVED,
    PLAYER_RECONNECTED_RECEIVED,
    PLAYER_RESURRECTED_RECEIVED,
    PLAYER_SPAWN_PROTECTION_DISABLED_RECEIVED,
    PLAYER_SPAWN_PROTECTION_ENABLED_RECEIVED,
    PLAYER_TAKE_DAMAGE_RECEIVED,
    PLAYER_TELEPORTED_RECEIVED,
    POSITION_CORRECTED_RECEIVED,
    REMOTE_PLAYER_ITEM_EQUIPPED_RECEIVED,
    REMOTE_PLAYER_ITEM_UNEQUIPPED_RECEIVED,
    RESET_POSITION_RECEIVED,
    SERVER_INVENTORY_SNAPSHOT_RECEIVED,
    SERVER_ITEM_ADDED_TO_BAG_RECEIVED,
    SERVER_ITEM_EQUIPPED_RECEIVED,
    SERVER_ITEM_MOVED_IN_BAG_RECEIVED,
    SERVER_ITEM_REMOVED_FROM_BAG_RECEIVED,
    SERVER_ITEM_UNEQUIPPED_RECEIVED,
    SERVER_ITEM_LIFE_SPAN_UPDATED_RECEIVED,
    SERVER_CITY_NPC_SERVICE_RESULT,
    SERVER_MESSAGE_RECEIVED,
    SOCKET_DISCONNECTED,
    SPELL_CAST_CANCELLED_RECEIVED,
    SPELL_CAST_FAILED_RECEIVED,
    SPELL_CAST_STARTED_RECEIVED,
    TOAST_DISMISS_LOGOUT_COUNTDOWN,
    TOAST_REQUESTED,
    SYSTEM_LOG_APPEND,
    SELL_BAG_ITEM_RESULT,
    TEMPORARY_EFFECT_APPLIED_FOR_PLAYER_RECEIVED,
    TEMPORARY_EFFECT_EXPIRED_FOR_PLAYER_RECEIVED,
    TEMPORARY_EFFECT_APPLIED_FOR_MONSTER_RECEIVED,
    TEMPORARY_EFFECT_EXPIRED_FOR_MONSTER_RECEIVED,
    CAST_EFFECT_RECEIVED,
    OUT_WEATHER_SYNCED,
    ARENA_PACT_STATE_RECEIVED,
    ARENA_PACT_LIST_RECEIVED,
} from '../constants/EventNames';
import type { MonsterCatalogEntry } from '../ui/store/MonsterDialog.store';
import { serverDialogStore } from '../ui/store/ServerDialog.store';
import { setCharacterStats, setLevelUpPointsLeft } from '../ui/store/CharacterDialog.store';
import { setSkillLevel, setSkillLevels } from '../ui/store/SkillDialog.store';
import { refreshCarryWeightUi } from './CarryWeight';
import { markCityChosen } from '../ui/store/CitySelectDialog.store';
import { setLogoutSecondsRemaining, type GameWorld } from '../ui/store/ControlsDialog.store';
import {
    Gender,
    SkinColor,
    type CastAoeSpellEventData,
    type CastDirectionalAoeSpellEventData,
    type GroundEffectEventData,
    type GroundStateCellEventData,
    type GroundStateCellRemovedEventData,
    type InitialGameWorldStateEventData,
    type InventorySnapshotEventData,
    type ItemEquippedEventData,
    type ItemUnequippedEventData,
    type MonsterAttackedEventData,
    type MonsterAttackedMonsterEventData,
    type MonsterCastAoeSpellEventData,
    type MonsterCastDirectionalAoeSpellEventData,
    type MonsterDiedEventData,
    type MonsterEnteredRangeEventData,
    type MonsterMovedEventData,
    type MonsterTakeDamageByMonsterEventData,
    type MonsterTakeDamageEventData,
    type NetworkPlayer,
    type NpcEnteredRangeEventData,
    type PlayerAppearanceChangedEventData,
    type PlayerAttackModeChangedEventData,
    type PlayerAttackedMonsterEventData,
    type PlayerAttackedPlayerEventData,
    type PlayerBowStancePerformedEventData,
    type PlayerConnectionStateChangedEventData,
    type PlayerDiedEventData,
    type EnemyKillAwardedEventData,
    type PlayerIdleDirectionChangedEventData,
    type PlayerMovedEventData,
    type PlayerMovementStateChangedEventData,
    type PlayerPickupPerformedEventData,
    type PlayerReceiveDamageEventData,
    type PlayerResurrectedEventData,
    type PlayerTakeDamageEventData,
    type SpellCastCancelledEventData,
    type SpellCastStartedEventData,
    type SpellEntry,
    type TeleportLoc,
    type TeleportLocSet,
    TemporaryEffectType,
} from '../Types';
import { getPlayerModeWireValue } from './playerMode';
import { getStoredReferralCode } from './referral';
import { garbleConfuseLanguageChat } from './confuseFeedback';
import { chatChannelToProto, type ChatChannelId } from '../constants/ChatChannels';
import { Direction } from './CoordinateUtils';
import {
    ItemTypes,
    applyItemDirectory,
    effectsFromDirectoryEntries,
    getItemById,
    isEquipmentSlot,
    type Effect,
    type EquipmentSlot,
    type InventoryItem,
} from '../constants/Items';
import type { WeatherMode } from '../ui/store/MapDialog.store';
import { applyServerSpellUnlocks, setTimedChallengeProtocolSpellsUnlocked } from '../ui/store/MagicShopDialog.store';
import { setShopStatusMessage } from '../ui/store/ShopDialog.store';
import { setCashShopStatusMessage } from '../ui/store/CashShopDialog.store';
import { setBlacksmithStatusMessage } from '../ui/store/BlacksmithDialog.store';
import { applyWarehouseState, setWarehouseStatusMessage } from '../ui/store/WarehouseDialog.store';
import { applyCityNpcServiceResult } from '../ui/store/NpcTalkDialog.store';
import {
    applyAntiBotToolsSetResult,
    applyAntiBotToolsState,
    type AntiBotToolsFlags,
} from '../ui/store/AntiBotToolsDialog.store';
import {
    applyTimedChallengeFinished,
    applyTimedChallengeLeaderboard,
    applyTimedChallengeState,
} from '../ui/store/TimedChallenge.store';
import {
    applyAuctionBoardActionResult,
    applyAuctionBoardSnapshot,
} from '../ui/store/AuctionBoardDialog.store';
import { applyHellMiningClaimResult, applyHellMiningStatus } from '../ui/store/HellMining.store';
import type { AuctionAccessRules, AuctionListingMode } from '../proto/generated/network';
import { collectEquippedItemAppearanceSpriteBasenamesForPrefetch } from './ItemAssets';

function appearanceGenderToClient(g: PlayerGender): Gender {
    return g === PlayerGender.PLAYER_GENDER_FEMALE ? Gender.FEMALE : Gender.MALE;
}

function mapAntiBotToolsState(data: ProtoAntiBotToolsState) {
    const flags = data.flags;
    return {
        flags: {
            guildPriorityIngress: flags?.guildPriorityIngress ?? false,
            newPlayerSegment: flags?.newPlayerSegment ?? false,
            claimTimeSybilGate: flags?.claimTimeSybilGate ?? false,
            industrialMultiBoxLimits: flags?.industrialMultiBoxLimits ?? false,
            afkOnMapAllowed: flags?.afkOnMapAllowed ?? true,
            tournamentInhumanPlayTelemetry: flags?.tournamentInhumanPlayTelemetry ?? false,
            tournamentHighStakesMode: flags?.tournamentHighStakesMode ?? false,
            softOfflineProgression: flags?.softOfflineProgression ?? false,
        },
        maxConcurrentSessions: data.maxConcurrentSessions,
        actionRateCeilingPerMin: data.actionRateCeilingPerMin,
        afkWarnAfterMs: data.afkWarnAfterMs,
        afkKickAfterMs: data.afkKickAfterMs,
        updatedBy: data.updatedBy,
        updatedAtMs: Number(data.updatedAtMs),
    };
}

function appearanceSkinToClient(s: PlayerSkinColor): SkinColor {
    switch (s) {
        case PlayerSkinColor.PLAYER_SKIN_COLOR_TANNED:
            return SkinColor.Tanned;
        case PlayerSkinColor.PLAYER_SKIN_COLOR_DARK:
            return SkinColor.Dark;
        default:
            return SkinColor.Light;
    }
}

function clientGenderToProto(g: Gender): PlayerGender {
    return g === Gender.FEMALE ? PlayerGender.PLAYER_GENDER_FEMALE : PlayerGender.PLAYER_GENDER_MALE;
}

function clientSkinToProto(s: SkinColor): PlayerSkinColor {
    switch (s) {
        case SkinColor.Tanned:
            return PlayerSkinColor.PLAYER_SKIN_COLOR_TANNED;
        case SkinColor.Dark:
            return PlayerSkinColor.PLAYER_SKIN_COLOR_DARK;
        default:
            return PlayerSkinColor.PLAYER_SKIN_COLOR_LIGHT;
    }
}

export function weatherModeToProto(mode: WeatherMode): WeatherModeProto {
    switch (mode) {
        case 'dry':
            return WeatherModeProto.WEATHER_MODE_DRY;
        case 'rain-light':
            return WeatherModeProto.WEATHER_MODE_RAIN_LIGHT;
        case 'rain-medium':
            return WeatherModeProto.WEATHER_MODE_RAIN_MEDIUM;
        case 'rain-heavy':
            return WeatherModeProto.WEATHER_MODE_RAIN_HEAVY;
        case 'snow-light':
            return WeatherModeProto.WEATHER_MODE_SNOW_LIGHT;
        case 'snow-medium':
            return WeatherModeProto.WEATHER_MODE_SNOW_MEDIUM;
        case 'snow-heavy':
            return WeatherModeProto.WEATHER_MODE_SNOW_HEAVY;
        default: {
            const _exhaustive: never = mode;
            return _exhaustive;
        }
    }
}

export function weatherModeFromProto(mode: WeatherModeProto): WeatherMode | undefined {
    switch (mode) {
        case WeatherModeProto.WEATHER_MODE_DRY:
            return 'dry';
        case WeatherModeProto.WEATHER_MODE_RAIN_LIGHT:
            return 'rain-light';
        case WeatherModeProto.WEATHER_MODE_RAIN_MEDIUM:
            return 'rain-medium';
        case WeatherModeProto.WEATHER_MODE_RAIN_HEAVY:
            return 'rain-heavy';
        case WeatherModeProto.WEATHER_MODE_SNOW_LIGHT:
            return 'snow-light';
        case WeatherModeProto.WEATHER_MODE_SNOW_MEDIUM:
            return 'snow-medium';
        case WeatherModeProto.WEATHER_MODE_SNOW_HEAVY:
            return 'snow-heavy';
        default:
            return undefined;
    }
}

function inventoryItemFromEntry(entry: InventoryItemEntry): InventoryItem {
    return {
        itemId: entry.itemId,
        itemUid: entry.itemUid.toString(),
        bagX: entry.bagX,
        bagY: entry.bagY,
        quantity: entry.quantity,
        bagZIndex: entry.bagZIndex,
        effectOverrides: effectsFromDirectoryEntries(entry.effectOverrides),
        ...(entry.itemAttribute !== undefined && entry.itemAttribute !== 0 && { itemAttribute: entry.itemAttribute }),
        ...(entry.itemColor !== undefined && entry.itemColor !== 0 && { itemColor: entry.itemColor }),
        ...(entry.maxLifeSpan !== undefined &&
            entry.maxLifeSpan > 1 && {
                curLifeSpan: entry.curLifeSpan ?? entry.maxLifeSpan,
                maxLifeSpan: entry.maxLifeSpan,
            }),
        ...(entry.bindState !== undefined && entry.bindState !== 0 && { bindState: entry.bindState }),
        ...(entry.boundGuildId && { boundGuildId: entry.boundGuildId }),
        ...(entry.cicLevel !== undefined && entry.cicLevel > 0 && { cicLevel: entry.cicLevel }),
        ...(entry.cicStatKind !== undefined && entry.cicStatKind > 0 && { cicStatKind: entry.cicStatKind }),
        ...(entry.cicStatValue !== undefined && entry.cicStatValue > 0 && { cicStatValue: entry.cicStatValue }),
        ...(entry.siphonLevel !== undefined && entry.siphonLevel > 0 && { siphonLevel: entry.siphonLevel }),
    };
}

function equippedItemsFromEntries(entries: EquippedInventoryItemEntry[]): Partial<Record<EquipmentSlot, InventoryItem>> {
    const equippedItems: Partial<Record<EquipmentSlot, InventoryItem>> = {};
    for (const entry of entries) {
        if (!isEquipmentSlot(entry.slot) || !entry.item) {
            continue;
        }

        equippedItems[entry.slot] = inventoryItemFromEntry(entry.item);
    }
    return equippedItems;
}

function visibleEquippedItemsFromEntries(entries: VisibleEquippedItemEntry[]): Partial<Record<ItemTypes, { itemId: number; effectOverrides?: Effect[]; itemAttribute?: number; itemColor?: number }>> {
    const visibleEquippedItems: Partial<Record<ItemTypes, { itemId: number; effectOverrides?: Effect[]; itemAttribute?: number; itemColor?: number }>> = {};
    for (const entry of entries) {
        if (!isEquipmentSlot(entry.slot)) {
            continue;
        }
        if (!Object.values(ItemTypes).includes(entry.slot as ItemTypes)) {
            continue;
        }

        visibleEquippedItems[entry.slot as ItemTypes] = {
            itemId: entry.itemId,
            effectOverrides: effectsFromDirectoryEntries(entry.effectOverrides),
            ...(entry.itemAttribute !== undefined && entry.itemAttribute !== 0 && { itemAttribute: entry.itemAttribute }),
            ...(entry.itemColor !== undefined && entry.itemColor !== 0 && { itemColor: entry.itemColor }),
        };
    }
    return visibleEquippedItems;
}

function effectToProtoIndex(effect: Effect['effect']): number {
    switch (effect) {
        case 'STORM_BRINGER':
            return 0;
        case 'STAR_TWINKLE':
            return 1;
        case 'GLARE':
            return 2;
        case 'GLOW':
            return 3;
        case 'TINT_INVENTORY':
            return 4;
        case 'TINT_APPEARANCE':
            return 5;
    }

    throw new Error(`Unsupported item effect '${effect}'.`);
}

function normalizeTeleportLocs(teleportLocs: InitialGameWorldState['teleportLocs']): TeleportLocSet[] {
    return teleportLocs.map((teleportLoc) => ({
        locs: teleportLoc.locs.map((loc) => ({ x: loc.x, y: loc.y })),
        target: {
            worldId: teleportLoc.target?.worldId ?? '',
            mapName: teleportLoc.target?.mapName ?? '',
            loc: {
                x: teleportLoc.target?.loc?.x ?? 0,
                y: teleportLoc.target?.loc?.y ?? 0,
            },
        },
    }));
}

/**
 * Unique source tile coordinates from `InitialGameWorldState.teleportLocs` (server-authored teleport triggers).
 * Used for debug overlay on the client map.
 */
export function getTeleportSourceCellsFromLocSets(teleportLocs: TeleportLocSet[]): TeleportLoc[] {
    const seen = new Set<string>();
    const out: TeleportLoc[] = [];
    for (const set of teleportLocs) {
        for (const loc of set.locs) {
            const key = `${loc.x},${loc.y}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            out.push({ x: loc.x, y: loc.y });
        }
    }
    return out;
}

/**
 * Client WebSocket + protobuf router: authentication, ping, world/monster/inventory packets,
 * and `EventBus` emissions for gameplay consumers (`GameWorld`, stores).
 */
/** Client outbound cases that must not sit behind chat/market/inventory spam (single WS priority queue). */
const HIGH_PRIORITY_CLIENT_CASES = new Set<string>([
    'pingRequest',
    'requestMovement',
    'makeServerCellOccupiedRequest',
    'playerMovementStateChangeRequest',
    'changePlayerIdleDirectionRequest',
    'playerAttackModeChangeRequest',
    'playerSafeAttackModeChangeRequest',
    'playerAttackedMonsterRequest',
    'playerAttackedPlayerRequest',
    'spellCastStartRequest',
    'spellCastCancelRequest',
    'spellCastRequest',
    'playerResurrectedRequest',
    'playerBowStanceRequested',
    'playerPickupRequested',
    'playerItemPickupRequested',
    'playerItemDropRequested',
    'equipItemRequest',
    'unequipItemRequest',
    'consumeItemRequest',
    'worldChangeRequest',
    'playerTeleportRequested',
    'authenticateRequest',
    'logoutRequest',
    'logoutCancelledRequest',
]);

/**
 * Toggle client-side priority flush (combat first). Set false via console if A/B needs rollback:
 * `window.__CL_PRIORITY_QUEUE__ = false`
 */
declare global {
    interface Window {
        __CL_PRIORITY_QUEUE__?: boolean;
        __CL_PRIORITY_STATS__?: { high: number; normal: number; flushes: number; highWhileNormal: number };
    }
}

export class NetworkManager {
    private socket: WebSocket | undefined;
    private pingIntervalId: number | undefined;
    private pingIntervalMs = 1000;
    private pingSentAt: number | undefined;
    /** Dual outbound queues (single WebSocket): high = combat/move, normal = meta. */
    private outboundHigh: Uint8Array[] = [];
    private outboundNormal: Uint8Array[] = [];
    private outboundFlushScheduled = false;
    private priorityStats = { high: 0, normal: 0, flushes: 0, highWhileNormal: 0 };
    private latestPing: number | undefined;
    private latestPingVariance: number | undefined;
    private latestGameWorldQueueLength: number | undefined;
    private latestPlayersInMap: number | undefined;
    private currentGameWorldId: string | undefined;
    private nextPingSequence = 1;
    private pendingPingSequence: number | undefined;
    private selfPlayerId: string | undefined;
    /** Local player's active temporary effects (for Confuse Language chat garble, etc.). */
    private selfTemporaryEffects = new Set<number>();
    private otherPlayersById = new Map<string, NetworkPlayer>();
    /** Authoritative in-view monsters from server packets; GameWorld syncs sprites from this after map load. */
    private monstersInViewById = new Map<string, MonsterEnteredRangeEventData>();
    /** Authoritative in-view NPCs from server packets; GameWorld spawns after map load (join packets can arrive before the scene subscribes to EventBus). */
    private npcsInViewById = new Map<string, NpcEnteredRangeEventData>();
    /** Authoritative in-view ground states from server packets; keyed by "x,y" cell. */
    private groundStatesInViewByCell = new Map<string, GroundStateCellEventData>();
    /**
     * When MonsterMoved arrives before MonstersEnteredRange, there is no in-view row yet; we stash the
     * authoritative destination cell so the subsequent enter packet can spawn at the correct tile (occupancy matches server).
     */
    private pendingMonsterPositionBeforeEnter = new Map<string, { destX: number; destY: number }>();
    /**
     * When PlayerMoved arrives before PlayersEnteredRange, avoid synthesizing a fake `NetworkPlayer` row.
     * Stash the move; merge spawn position on enter and emit `PLAYER_MOVED_RECEIVED` after join (same idea as monsters).
     */
    private pendingPlayerMoveBeforeEnter = new Map<string, Omit<PlayerMovedEventData, 'attackMode'>>();
    private gameWorlds: GameWorld[] = [];
    /** Catalog from `monsters_list` (connect); powers summon/UI. Separate from in-view instances in `monstersInViewById`. */
    private monsters: MonsterCatalogEntry[] = [];
    /** Catalog id → display name from InitialState npc_directory (client maps id to sprite locally). */
    private npcDirectoryByCatalogId = new Map<number, string>();
    private spells: SpellEntry[] = [];
    private authenticateCharacterName = '';
    private preferredInitialWorldId: string | undefined;
    private authenticateSlotIndex: number | undefined;
    private authenticateGender: Gender | undefined;
    private authenticateSkinColor: SkinColor | undefined;
    private authenticateHairStyleIndex: number | undefined;
    private authenticateUnderwearColorIndex: number | undefined;
    private authenticateStr: number | undefined;
    private authenticateVit: number | undefined;
    private authenticateDex: number | undefined;
    private authenticateInt: number | undefined;
    private authenticateMag: number | undefined;
    private authenticateChr: number | undefined;
    private authenticateArenaKitJson: string | undefined;
    private authToken = '';
    private hasSentAuthentication = false;
    private logoutPending = false;
    private logoutIntervalId: ReturnType<typeof setInterval> | undefined;
    private pendingSpawnProtectionForSelf = false;
    private pendingInitialGameWorldState: InitialGameWorldStateEventData | undefined;
    private latestInventorySnapshot: InventorySnapshotEventData | undefined;
    /** Authoritative self HP/max from server; updated by InitialState and hp_updated; used when merging map-only InitialGameWorldState. */
    private lastSelfHp: number | undefined;
    private lastSelfMaxHp: number | undefined;
    /** Snapshot from InitialState for merging into each InitialGameWorldState (map load). */
    private initialStateMergeBase:
        | Pick<
            InitialGameWorldStateEventData,
            | 'playerId'
            | 'movementSpeedMs'
            | 'runMode'
            | 'attackMode'
            | 'safeAttackMode'
            | 'citizenshipSide'
            | 'attackType'
            | 'allowDashAttack'
            | 'attackRangeCells'
            | 'attackDamage'
            | 'attackSpeedMs'
            | 'attackStunDurationMs'
            | 'castSpeedMs'
            | 'arrowSpeedPxPerSec'
            | 'hp'
            | 'maxHp'
            | 'playerPickupAnimationTimeMs'
            | 'playerBowAnimationDurationMs'
            | 'gender'
            | 'skinColor'
            | 'hairStyleIndex'
            | 'underwearColorIndex'
        >
        | undefined;

    constructor(private readonly networkId: string, authToken = '') {
        this.authToken = authToken;
    }

    public connect(
        ip: string,
        port: number,
        characterName: string,
        authToken?: string,
        preferredInitialWorldId?: string,
        slotIndex?: number,
        appearance?: {
            gender?: 'male' | 'female';
            skinColor?: 'light' | 'tanned' | 'dark';
            hairStyleIndex?: number;
            underwearColorIndex?: number;
            str?: number;
            vit?: number;
            dex?: number;
            int?: number;
            mag?: number;
            chr?: number;
        },
        arenaKitJson?: string,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.authenticateCharacterName = characterName.trim();
                this.preferredInitialWorldId = preferredInitialWorldId?.trim() || undefined;
                this.authenticateArenaKitJson =
                    typeof arenaKitJson === 'string' && arenaKitJson.trim().length > 0
                        ? arenaKitJson.trim()
                        : undefined;
                this.authenticateSlotIndex =
                    typeof slotIndex === 'number' && Number.isFinite(slotIndex)
                        ? Math.max(0, Math.min(3, Math.floor(slotIndex)))
                        : undefined;
                this.authenticateGender =
                    appearance?.gender === 'female'
                        ? Gender.FEMALE
                        : appearance?.gender === 'male'
                          ? Gender.MALE
                          : undefined;
                this.authenticateSkinColor =
                    appearance?.skinColor === 'tanned'
                        ? SkinColor.Tanned
                        : appearance?.skinColor === 'dark'
                          ? SkinColor.Dark
                          : appearance?.skinColor === 'light'
                            ? SkinColor.Light
                            : undefined;
                this.authenticateHairStyleIndex =
                    typeof appearance?.hairStyleIndex === 'number' && Number.isFinite(appearance.hairStyleIndex)
                        ? Math.max(0, Math.min(7, Math.floor(appearance.hairStyleIndex)))
                        : undefined;
                this.authenticateUnderwearColorIndex =
                    typeof appearance?.underwearColorIndex === 'number' &&
                    Number.isFinite(appearance.underwearColorIndex)
                        ? Math.max(0, Math.min(7, Math.floor(appearance.underwearColorIndex)))
                        : undefined;
                const clampCreateStat = (value: number | undefined): number | undefined =>
                    typeof value === 'number' && Number.isFinite(value)
                        ? Math.max(10, Math.min(14, Math.floor(value)))
                        : undefined;
                this.authenticateStr = clampCreateStat(appearance?.str);
                this.authenticateVit = clampCreateStat(appearance?.vit);
                this.authenticateDex = clampCreateStat(appearance?.dex);
                this.authenticateInt = clampCreateStat(appearance?.int);
                this.authenticateMag = clampCreateStat(appearance?.mag);
                this.authenticateChr = clampCreateStat(appearance?.chr);
                if (authToken !== undefined) {
                    this.authToken = authToken;
                }
                const websocketUrl = buildGameWebSocketUrl(ip, port);
                const socket = new WebSocket(websocketUrl);
                socket.binaryType = 'arraybuffer';

                this.socket = socket;

                socket.addEventListener('open', () => {
                    runSafeSync('NetworkManager:open', () => {
                        console.log(`[NetworkManager] Connected to ${websocketUrl}`);
                        this.sendAuthentication();
                        resolve();
                    });
                }, { once: true });

                socket.addEventListener('message', (event: MessageEvent) => {
                    try {
                        const latency = serverDialogStore.state.incomingLatency;
                        const fluctuation = serverDialogStore.state.incomingFluctuation;
                        const extra = fluctuation > 0 ? Math.random() * fluctuation : 0;
                        const totalDelay = latency + extra;
                        if (totalDelay > 0) {
                            this.sleep(totalDelay)
                                .then(() => {
                                    runSafeSync('NetworkManager:handleMessage', () => this.handleMessage(event));
                                })
                                .catch((error) => {
                                    console.error('[NetworkManager] message delay scheduling failed', error);
                                });
                        } else {
                            runSafeSync('NetworkManager:handleMessage', () => this.handleMessage(event));
                        }
                    } catch (error) {
                        console.error('[NetworkManager] message listener', error);
                    }
                });

                /** Avoid double UI noise: browser often fires `error` then `close` for the same failure. */
                let connectUiNotified = false;

                socket.addEventListener('close', (event: CloseEvent) => {
                    runSafeSync('NetworkManager:close', () => {
                        console.log('[NetworkManager] WebSocket connection closed.');
                        this.clearPingInterval();
                        this.pingSentAt = undefined;
                        this.latestPing = undefined;
                        this.latestPingVariance = undefined;
                        this.latestGameWorldQueueLength = undefined;
                        this.latestPlayersInMap = undefined;
                        this.currentGameWorldId = undefined;
                        this.pendingPingSequence = undefined;
                        this.selfPlayerId = undefined;
                        this.selfTemporaryEffects.clear();
                        this.pendingSpawnProtectionForSelf = false;
                        this.pendingInitialGameWorldState = undefined;
                        this.lastSelfHp = undefined;
                        this.lastSelfMaxHp = undefined;
                        this.initialStateMergeBase = undefined;
                        this.clearOtherPlayersState();
                        this.clearMonstersInViewState();
                        this.clearNpcsInViewState();
                        this.clearGroundStatesInViewState();
                        this.gameWorlds = [];
                        this.monsters = [];
                        this.spells = [];
                        this.authenticateCharacterName = '';
                        this.preferredInitialWorldId = undefined;
                        this.authenticateSlotIndex = undefined;
                        this.authenticateGender = undefined;
                        this.authenticateSkinColor = undefined;
                        this.authenticateHairStyleIndex = undefined;
                        this.authenticateUnderwearColorIndex = undefined;
                        this.authenticateStr = undefined;
                        this.authenticateVit = undefined;
                        this.authenticateDex = undefined;
                        this.authenticateInt = undefined;
                        this.authenticateMag = undefined;
                        this.authenticateChr = undefined;
                        this.authenticateArenaKitJson = undefined;
                        this.hasSentAuthentication = false;
                        this.logoutPending = false;
                        this.clearLogoutCountdown();
                        if (this.socket === socket) {
                            this.socket = undefined;
                        }
                        const reason = event.reason;
                        console.log(`[NetworkManager] WebSocket connection closed: ${reason}`);
                        if (!connectUiNotified && reason && reason !== 'Closing connection') {
                            connectUiNotified = true;
                            EventBus.emit(SERVER_MESSAGE_RECEIVED, { message: reason });
                        }
                        EventBus.emit(OUT_UI_SET_GAME_WORLDS, []);
                        EventBus.emit(OUT_UI_SET_MONSTERS, []);
                        EventBus.emit(OUT_UI_SET_SPELLS, []);
                        EventBus.emit(SOCKET_DISCONNECTED);
                    });
                });

                socket.addEventListener('error', (event) => {
                    runSafeSync('NetworkManager:error', () => {
                        console.warn(`[NetworkManager] Failed to connect to ${websocketUrl}`, event);
                        if (this.socket === socket) {
                            this.socket = undefined;
                        }
                        if (!connectUiNotified) {
                            connectUiNotified = true;
                            EventBus.emit(SERVER_MESSAGE_RECEIVED, {
                                message: `Failed to connect to the server at ${ip}:${port}.`,
                            });
                        }
                        reject(new Error(`[NetworkManager] Failed to connect to ${websocketUrl}`));
                    });
                }, { once: true });
            } catch (error) {
                console.warn('[NetworkManager] Failed to create WebSocket connection.', error);
                this.socket = undefined;
                EventBus.emit(SERVER_MESSAGE_RECEIVED, {
                    message: `Failed to connect to the server at ${ip}:${port}.`,
                });
                reject(error);
            }
        });
    }

    public getSocket(): WebSocket | undefined {
        return this.socket;
    }

    public getLatestPing(): number | undefined {
        return this.latestPing;
    }

    public getLatestPingVariance(): number | undefined {
        return this.latestPingVariance;
    }

    public getLatestQueueLengths(): { gameWorldQueueLength: number; playersInMap: number } | undefined {
        if (this.latestGameWorldQueueLength === undefined && this.latestPlayersInMap === undefined) {
            return undefined;
        }
        return {
            gameWorldQueueLength: this.latestGameWorldQueueLength ?? 0,
            playersInMap: this.latestPlayersInMap ?? 0,
        };
    }

    public requestMovement(
        curX: number,
        curY: number,
        destX: number,
        destY: number,
        options: { dashAttack: boolean; monsterId?: string; playerId?: string; attackType?: number },
    ): void {
        if (!this.currentGameWorldId) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'requestMovement',
                value: {
                    curX,
                    curY,
                    destX,
                    destY,
                    gameWorldId: this.currentGameWorldId,
                    dashAttack: options.dashAttack,
                    monsterId: options.monsterId ? BigInt(options.monsterId) : undefined,
                    playerId: options.playerId ? BigInt(options.playerId) : undefined,
                    attackType: options.attackType,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    public changePlayerMovementSpeed(movementSpeedMs: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'changePlayerMovementSpeedRequest',
                value: { movementSpeedMs },
            },
        }).finish();
        this.sendPacket(command);
    }

    public requestWorldChange(worldId: string, commitImmediately = false, validateTeleport = false): void {
        if (!this.currentGameWorldId) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'worldChangeRequest',
                value: { worldId, gameWorldId: this.currentGameWorldId, validateTeleport },
            },
        }).finish();
        this.sendPacket(command);
        if (commitImmediately) {
            // Teleport transfers restart immediately, so start treating the target world as authoritative right away.
            this.currentGameWorldId = worldId;
        }
    }

    public sendChatMessage(
        message: string,
        sourceLanguageTag?: string,
        options?: {
            channel?: ChatChannelId;
            whisperTargetCharacterName?: string;
        },
    ): void {
        let trimmedMessage = message.trim();
        if (!trimmedMessage) {
            return;
        }

        // Olympia Confuse Language: speaker text is garbled before broadcast (~2/3 of messages).
        if (this.selfTemporaryEffects.has(TemporaryEffectType.ConfuseLanguage)) {
            trimmedMessage = garbleConfuseLanguageChat(trimmedMessage);
        }

        const trimmedTag = sourceLanguageTag?.trim();
        const channelId =
            options?.channel && options.channel !== 'all' ? options.channel : 'nearby';
        const channel = chatChannelToProto(channelId);
        const whisperTarget = options?.whisperTargetCharacterName?.trim();

        const command = ClientMessage.encode({
            payload: {
                $case: 'chatMessageSendRequest',
                value: {
                    message: trimmedMessage,
                    ...(trimmedTag ? { sourceLanguageTag: trimmedTag } : {}),
                    channel,
                    ...(whisperTarget ? { whisperTargetCharacterName: whisperTarget } : {}),
                },
            },
        }).finish();
        this.sendPacket(command, false, 'normal', 'chatMessageSendRequest');
    }

    public sendWeatherChangeRequest(mode: WeatherMode): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'weatherChangeRequest',
                value: { weather: weatherModeToProto(mode) },
            },
        }).finish();
        this.sendPacket(command);
    }

    public requestPlayerMovementStateChange(runningMode: boolean): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'playerMovementStateChangeRequest',
                value: { runningMode },
            },
        }).finish();
        this.sendPacket(command);
    }

    public requestPlayerAttackModeChange(attackMode: boolean): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'playerAttackModeChangeRequest',
                value: { attackMode },
            },
        }).finish();
        this.sendPacket(command);
    }

    public requestPlayerSafeAttackModeChange(safeAttackMode: boolean): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'playerSafeAttackModeChangeRequest',
                value: { safeAttackMode },
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Olympia Page Up — activate equipped Merien / Xelima / Ice Sword special ability. */
    public requestActivateSpecialAbility(): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'activateSpecialAbilityRequest',
                value: {},
            },
        }).finish();
        this.sendPacket(command);
    }

    public changePlayerAttackStunDuration(attackStunDurationMs: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'changePlayerAttackStunDurationRequest',
                value: { attackStunDurationMs },
            },
        }).finish();
        this.sendPacket(command);
    }

    public changePlayerAttackSpeed(attackSpeedMs: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'changePlayerAttackSpeedRequest',
                value: { attackSpeedMs },
            },
        }).finish();
        this.sendPacket(command);
    }

    public changePlayerCastSpeed(castSpeedMs: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'changePlayerCastSpeedRequest',
                value: { castSpeedMs },
            },
        }).finish();
        this.sendPacket(command);
    }

    public changePlayerAttackType(attackType: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'changePlayerAttackTypeRequest',
                value: { attackType },
            },
        }).finish();
        this.sendPacket(command);
    }

    public changePlayerAllowDashAttack(allowDashAttack: boolean): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'changePlayerAllowDashAttackRequest',
                value: { allowDashAttack },
            },
        }).finish();
        this.sendPacket(command);
    }

    public changePlayerAppearance(
        gender: Gender,
        skinColor: SkinColor,
        hairStyleIndex: number,
        underwearColorIndex: number,
    ): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'changePlayerAppearanceRequest',
                value: {
                    gender: clientGenderToProto(gender),
                    skinColor: clientSkinToProto(skinColor),
                    hairStyleIndex: Math.max(0, Math.min(7, Math.round(hairStyleIndex))),
                    underwearColorIndex: Math.max(0, Math.min(7, Math.round(underwearColorIndex))),
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    public changePlayerAttackRange(attackRangeCells: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'changePlayerAttackRangeRequest',
                value: { attackRangeCells },
            },
        }).finish();
        this.sendPacket(command);
    }

    public changePlayerAttackDamage(attackDamage: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'changePlayerAttackDamageRequest',
                value: { attackDamage },
            },
        }).finish();
        this.sendPacket(command);
    }

    public requestChangePlayerIdleDirection(direction: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'changePlayerIdleDirectionRequest',
                value: { direction },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendLogoutRequest(): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        if (this.logoutPending) {
            return;
        }
        this.logoutPending = true;
        const command = ClientMessage.encode({
            payload: {
                $case: 'logoutRequest',
                value: {},
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Arena PVP duel: schedule open time + Ready window (default 15m). */
    public sendArenaPactCreate(opts: {
        mapId: string;
        arenaKitJson?: string;
        stakeAssetId?: string;
        stakeAmount?: number;
        /** Unix ms when Ready window opens. 0 = now. */
        opensAtMs?: number;
        /** Ready window length seconds (default 900). */
        readyWindowSec?: number;
        isPublic?: boolean;
        title?: string;
        hostStreamUrl?: string;
        globalStreamUrl?: string;
    }): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'arenaPactCreateRequest',
                value: {
                    mapId: opts.mapId,
                    arenaKitJson: opts.arenaKitJson || undefined,
                    stakeAssetId: opts.stakeAssetId || undefined,
                    stakeAmount: opts.stakeAmount !== undefined ? BigInt(Math.max(0, Math.floor(opts.stakeAmount))) : undefined,
                    opensAtMs: BigInt(Math.max(0, Math.floor(opts.opensAtMs ?? 0))),
                    readyWindowSec: opts.readyWindowSec ?? 900,
                    isPublic: !!opts.isPublic,
                    title: opts.title || undefined,
                    hostStreamUrl: opts.hostStreamUrl || undefined,
                    globalStreamUrl: opts.globalStreamUrl || undefined,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendArenaPactSetStream(matchId: string, streamUrl: string, isGlobal = false): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'arenaPactSetStreamRequest',
                value: {
                    matchId,
                    streamUrl: streamUrl || '',
                    isGlobal,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    /** World / tournament Go-Live on public cartelera. */
    public sendStreamBroadcast(opts: {
        kind: 'world' | 'tournament' | 'other';
        title?: string;
        streamUrl: string;
        active?: boolean;
    }): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'streamBroadcastRequest',
                value: {
                    kind: opts.kind,
                    title: opts.title || '',
                    streamUrl: opts.streamUrl || '',
                    active: opts.active !== false,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendArenaPactList(opts?: { id?: string; authToken?: string; filterNames?: string[] }): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'arenaPactListRequest',
                value: {
                    id: opts?.id || undefined,
                    authToken: opts?.authToken || undefined,
                    filterNames: opts?.filterNames ?? [],
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendArenaPactInvite(matchId: string, targetCharacterName: string): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'arenaPactInviteRequest',
                value: { matchId, targetCharacterName },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendArenaPactRespond(
        matchId: string,
        accept: boolean,
        arenaKitJson?: string,
        responseMode?: 'accept' | 'decline' | 'honor',
        streamUrl?: string,
    ): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'arenaPactRespondRequest',
                value: {
                    matchId,
                    accept,
                    arenaKitJson: arenaKitJson || undefined,
                    responseMode: responseMode || undefined,
                    streamUrl: streamUrl || undefined,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendArenaPactReady(
        matchId: string,
        ready: boolean,
        arenaKitJson?: string,
        tech?: { pingMs?: number; pingVarianceMs?: number; fps?: number },
    ): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'arenaPactReadyRequest',
                value: {
                    matchId,
                    ready,
                    arenaKitJson: arenaKitJson || undefined,
                    reportPingMs: tech?.pingMs,
                    reportPingVarianceMs: tech?.pingVarianceMs,
                    reportFps: tech?.fps,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendArenaPactCancel(matchId: string): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'arenaPactCancelRequest',
                value: { matchId },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendArenaPactTechPropose(opts: {
        matchId: string;
        mode: 'as_is' | 'equalize_ping' | 'fixed_delay';
        paramMinMs: number;
        paramMaxMs: number;
        fpsFloor: number;
        applyToMovement: boolean;
    }): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'arenaPactTechProposeRequest',
                value: {
                    matchId: opts.matchId,
                    mode: opts.mode,
                    paramMinMs: Math.floor(opts.paramMinMs),
                    paramMaxMs: Math.floor(opts.paramMaxMs),
                    fpsFloor: Math.floor(opts.fpsFloor),
                    applyToMovement: opts.applyToMovement,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendArenaPactTechVote(matchId: string, accept: boolean): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'arenaPactTechVoteRequest',
                value: { matchId, accept },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendArenaPactTechReport(
        matchId: string,
        tech: { pingMs?: number; pingVarianceMs?: number; fps?: number },
    ): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'arenaPactTechReportRequest',
                value: {
                    matchId,
                    pingMs: Math.max(0, Math.floor(tech.pingMs ?? 0)),
                    pingVarianceMs: Math.max(0, Math.floor(tech.pingVarianceMs ?? 0)),
                    fps: Math.max(0, Math.floor(tech.fps ?? 0)),
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendMakeCellOccupiedRequest(x: number, y: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'makeServerCellOccupiedRequest',
                value: { x, y },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendPlayerTeleportRequested(x: number, y: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'playerTeleportRequested',
                value: { x, y },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendSummonMonsterRequested(
        sprite: string,
        movementSpeedMs: number,
        direction: number,
        attackType: number,
        allegiance: number,
        stunDurationMs: number,
        maxHp: number,
        attackDamage: number,
        attackSpeedMs: number,
        attackRecoveryMs: number,
        chaseRangeCells: number,
        attackRangeCells: number,
        summonCount: number,
    ): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'summonMonsterRequested',
                value: {
                    sprite,
                    movementSpeedMs,
                    direction,
                    attackType,
                    allegiance,
                    stunDurationMs,
                    maxHp,
                    attackDamage,
                    attackSpeedMs,
                    attackRecoveryMs,
                    chaseRangeCells,
                    attackRangeCells,
                    summonCount,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendKillAllMonstersRequested(): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'killAllMonstersRequested',
                value: {},
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendSummonNpcRequest(catalogNpcId: number, direction: number): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'summonNpcRequest',
                value: {
                    catalogNpcId,
                    direction,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendKillAllNpcsRequest(): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'killAllNpcsRequest',
                value: {},
            },
        }).finish();
        this.sendPacket(command);
    }

    public disconnect(): void {
        runSafeSync('NetworkManager:disconnect', () => {
            if (!this.socket) {
                return;
            }

            this.clearPingInterval();
            this.clearLogoutCountdown();
            this.pendingPingSequence = undefined;
            this.currentGameWorldId = undefined;
            this.selfPlayerId = undefined;
            this.selfTemporaryEffects.clear();
            this.lastSelfHp = undefined;
            this.lastSelfMaxHp = undefined;
            this.initialStateMergeBase = undefined;
            this.latestInventorySnapshot = undefined;
            this.clearOtherPlayersState();
            this.clearMonstersInViewState();
            this.clearNpcsInViewState();
            this.clearGroundStatesInViewState();
            this.gameWorlds = [];
            this.monsters = [];
            this.npcDirectoryByCatalogId.clear();
            this.spells = [];
            EventBus.emit(OUT_UI_SET_GAME_WORLDS, []);
            EventBus.emit(OUT_UI_SET_MONSTERS, []);
            EventBus.emit(OUT_UI_SET_NPC_DIRECTORY, []);
            EventBus.emit(OUT_UI_SET_SPELLS, []);
            this.hasSentAuthentication = false;
            this.logoutPending = false;
            this.socket.close();
            this.socket = undefined;
        });
    }

    private clearLogoutCountdown(): void {
        EventBus.emit(TOAST_DISMISS_LOGOUT_COUNTDOWN);
        if (this.logoutIntervalId) {
            clearInterval(this.logoutIntervalId);
            this.logoutIntervalId = undefined;
        }
        setLogoutSecondsRemaining(undefined);
    }

    public cancelLogout(): void {
        if (!this.logoutPending || !this.logoutIntervalId) {
            return;
        }
        this.clearLogoutCountdown();
        this.logoutPending = false;
        this.sendLogoutCancelled();
    }

    private sendLogoutCancelled(): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'logoutCancelledRequest',
                value: {},
            },
        }).finish();
        this.sendPacket(command);
    }

    public getOtherPlayersState(): NetworkPlayer[] {
        return Array.from(this.otherPlayersById.values());
    }

    public getMonstersInViewState(): MonsterEnteredRangeEventData[] {
        return Array.from(this.monstersInViewById.values());
    }

    public getNpcsInViewState(): NpcEnteredRangeEventData[] {
        return Array.from(this.npcsInViewById.values());
    }

    public getGroundStatesInViewState(): GroundStateCellEventData[] {
        return Array.from(this.groundStatesInViewByCell.values());
    }

    public getLatestInventorySnapshot(): InventorySnapshotEventData | undefined {
        return this.latestInventorySnapshot;
    }

    private clearOtherPlayersState(): void {
        const ids = Array.from(this.otherPlayersById.keys());
        this.otherPlayersById.clear();
        this.pendingPlayerMoveBeforeEnter.clear();
        // Notify GameWorld so remotes are torn down before the next enter/sync batch.
        if (ids.length > 0) {
            EventBus.emit(PLAYER_LEFT_RECEIVED, ids);
        }
    }

    private clearMonstersInViewState(): void {
        const ids = Array.from(this.monstersInViewById.keys());
        this.monstersInViewById.clear();
        this.pendingMonsterPositionBeforeEnter.clear();
        if (ids.length > 0) {
            EventBus.emit(MONSTERS_LEFT_RANGE_RECEIVED, ids);
        }
    }

    private clearNpcsInViewState(): void {
        const ids = Array.from(this.npcsInViewById.keys());
        this.npcsInViewById.clear();
        if (ids.length > 0) {
            EventBus.emit(NPCS_LEFT_RANGE_RECEIVED, ids);
        }
    }

    private clearGroundStatesInViewState(): void {
        const batch: GroundStateCellRemovedEventData[] = [];
        for (const state of this.groundStatesInViewByCell.values()) {
            batch.push({
                x: state.x,
                y: state.y,
                groundEffectIds: state.effects.map((effect) => effect.groundEffectId),
                ...(state.groundItem ? { groundItemUid: state.groundItem.itemUid } : {}),
            });
        }
        this.groundStatesInViewByCell.clear();
        if (batch.length > 0) {
            EventBus.emit(GROUND_STATES_LEFT_RANGE_RECEIVED, batch);
        }
    }

    private getGroundStateCellKey(x: number, y: number): string {
        return `${x},${y}`;
    }

    public getGameWorlds(): GameWorld[] {
        return [...this.gameWorlds];
    }

    /** Active world id from the last InitialGameWorldState / world-change ack. */
    public getCurrentGameWorldId(): string | undefined {
        return this.currentGameWorldId;
    }

    public getWorldById(worldId: string): GameWorld | undefined {
        return this.gameWorlds.find((world) => world.id === worldId);
    }

    public getSpellById(spellId: number): SpellEntry | undefined {
        return this.spells.find((spell) => spell.id === spellId);
    }

    public clearPendingInitialGameWorldState(): void {
        this.pendingInitialGameWorldState = undefined;
    }

    public getAndClearPendingInitialGameWorldState(): InitialGameWorldStateEventData | undefined {
        const pendingInitialGameWorldState = this.pendingInitialGameWorldState;
        this.pendingInitialGameWorldState = undefined;
        return pendingInitialGameWorldState;
    }

    public sendSpellCastStartRequest(spellId: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'spellCastStartRequest',
                value: { spellId },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendSpellCastCancelRequest(): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'spellCastCancelRequest',
                value: {},
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Arm/disarm Super Attack (crit charges). Server only spends charges while armed. */
    public sendSetSuperAttackArmed(armed: boolean): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'setSuperAttackArmedRequest',
                value: { armed },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendSpellCastRequest(x: number, y: number, aimAssistPlayerId?: bigint, aimAssistMonsterId?: bigint): void {
        const value: SpellCastRequest = { x, y };
        if (aimAssistPlayerId !== undefined) {
            value.playerId = aimAssistPlayerId;
        }
        if (aimAssistMonsterId !== undefined) {
            value.monsterId = aimAssistMonsterId;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'spellCastRequest',
                value,
            },
        }).finish();
        this.sendPacket(command);
    }

    private startPingInterval(): void {
        this.clearPingInterval();
        this.pingIntervalId = window.setInterval(() => {
            runSafeSync('NetworkManager:pingInterval', () => this.sendPing());
        }, this.pingIntervalMs);
    }

    private clearPingInterval(): void {
        if (this.pingIntervalId) {
            clearInterval(this.pingIntervalId);
            this.pingIntervalId = undefined;
        }
    }

    private sendPing(): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.pingSentAt !== undefined) {
            return;
        }

        const sequence = this.nextPingSequence++;
        const command = ClientMessage.encode({
            payload: {
                $case: 'pingRequest',
                value: {
                    sequence,
                },
            },
        }).finish();

        this.pendingPingSequence = sequence;
        this.pingSentAt = performance.now();
        this.sendPacket(command);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private sendAuthentication(): void {
        this.hasSentAuthentication = true;
        const command = ClientMessage.encode({
            payload: {
                $case: 'authenticateRequest',
                value: {
                    id: this.networkId,
                    characterName: this.authenticateCharacterName,
                    authToken: this.authToken,
                    preferredInitialWorldId: this.preferredInitialWorldId,
                    playerMode: getPlayerModeWireValue(),
                    slotIndex: this.authenticateSlotIndex,
                    gender:
                        this.authenticateGender !== undefined
                            ? clientGenderToProto(this.authenticateGender)
                            : undefined,
                    skinColor:
                        this.authenticateSkinColor !== undefined
                            ? clientSkinToProto(this.authenticateSkinColor)
                            : undefined,
                    hairStyleIndex: this.authenticateHairStyleIndex,
                    underwearColorIndex: this.authenticateUnderwearColorIndex,
                    str: this.authenticateStr,
                    vit: this.authenticateVit,
                    dex: this.authenticateDex,
                    intel: this.authenticateInt,
                    mag: this.authenticateMag,
                    chr: this.authenticateChr,
                    referralCode: getStoredReferralCode(),
                    arenaKitJson: this.authenticateArenaKitJson,
                },
            },
        }).finish();
        this.sendPacket(command, true);
    }

    /**
     * Enqueue outbound binary. Combat/move/cast flush before chat/shop/meta when priority queue is on.
     * Optional 3rd arg: force priority; otherwise inferred from last encoded case when provided.
     */
    private sendPacket(
        command: Uint8Array,
        allowBeforeAuthentication = false,
        priority: 'high' | 'normal' | 'auto' = 'auto',
        payloadCase?: string,
    ): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        if (!allowBeforeAuthentication && !this.hasSentAuthentication) {
            return;
        }
        const latency = serverDialogStore.state.outgoingLatency;
        const fluctuation = serverDialogStore.state.outgoingFluctuation;
        const extra = fluctuation > 0 ? Math.random() * fluctuation : 0;
        const totalDelay = latency + extra;

        const usePriority =
            typeof window === 'undefined' || window.__CL_PRIORITY_QUEUE__ !== false;

        const resolvedPriority: 'high' | 'normal' = (() => {
            if (!usePriority) {
                return 'high'; // single FIFO into high queue
            }
            if (priority === 'high' || priority === 'normal') {
                return priority;
            }
            if (payloadCase && HIGH_PRIORITY_CLIENT_CASES.has(payloadCase)) {
                return 'high';
            }
            // Auto without case: default high for safety (legacy call sites)
            if (!payloadCase) {
                return 'high';
            }
            return 'normal';
        })();

        const enqueue = () => {
            runSafeSync('NetworkManager:sendPacket', () => {
                if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
                    return;
                }
                if (resolvedPriority === 'high') {
                    if (this.outboundNormal.length > 0) {
                        this.priorityStats.highWhileNormal++;
                    }
                    this.priorityStats.high++;
                    this.outboundHigh.push(command);
                } else {
                    this.priorityStats.normal++;
                    this.outboundNormal.push(command);
                }
                if (typeof window !== 'undefined') {
                    window.__CL_PRIORITY_STATS__ = { ...this.priorityStats };
                }
                this.scheduleOutboundFlush();
            });
        };

        if (totalDelay > 0) {
            this.sleep(totalDelay)
                .then(() => {
                    enqueue();
                })
                .catch((error) => {
                    console.error('[NetworkManager] sendPacket delayed send failed', error);
                });
        } else {
            enqueue();
        }
    }

    private scheduleOutboundFlush(): void {
        if (this.outboundFlushScheduled) {
            return;
        }
        this.outboundFlushScheduled = true;
        // Microtask: coalesce a burst of encodes in the same turn, then send high→normal.
        queueMicrotask(() => {
            this.outboundFlushScheduled = false;
            this.flushOutboundQueues();
        });
    }

    private flushOutboundQueues(): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.outboundHigh = [];
            this.outboundNormal = [];
            return;
        }
        this.priorityStats.flushes++;
        while (this.outboundHigh.length > 0) {
            const pkt = this.outboundHigh.shift();
            if (pkt) {
                this.socket.send(pkt);
            }
        }
        while (this.outboundNormal.length > 0) {
            const pkt = this.outboundNormal.shift();
            if (pkt) {
                this.socket.send(pkt);
            }
        }
        if (typeof window !== 'undefined') {
            window.__CL_PRIORITY_STATS__ = { ...this.priorityStats };
        }
    }

    private handleMessage(event: MessageEvent): void {
        if (!(event.data instanceof ArrayBuffer)) {
            return;
        }

        try {
            const message = ServerMessage.decode(new Uint8Array(event.data));
            switch (message.payload?.$case) {
                case 'pingResponse':
                    this.handlePingResponse(message.payload.value);
                    break;
                case 'initialGameWorldState':
                    this.handleInitialGameWorldState(message.payload.value);
                    break;
                case 'playerTeleported':
                    this.handlePlayerTeleported(message.payload.value);
                    break;
                case 'resetPosition':
                    this.handleResetPosition(message.payload.value);
                    break;
                case 'positionCorrected':
                    this.handlePositionCorrected(message.payload.value);
                    break;
                case 'playersEnteredRange':
                    this.handlePlayersEnteredRange(message.payload.value);
                    break;
                case 'playersLeftRange':
                    this.handlePlayersLeftRange(message.payload.value);
                    break;
                case 'groundStatesEnteredRange':
                    this.handleGroundStatesEnteredRange(message.payload.value);
                    break;
                case 'groundStatesLeftRange':
                    this.handleGroundStatesLeftRange(message.payload.value);
                    break;
                case 'playerMoved':
                    this.handlePlayerMoved(message.payload.value);
                    break;
                case 'playerMovementStateChanged':
                    this.handlePlayerMovementStateChanged(message.payload.value);
                    break;
                case 'playerAttackModeChanged':
                    this.handlePlayerAttackModeChanged(message.payload.value);
                    break;
                case 'playerSafeAttackModeChanged':
                    this.handlePlayerSafeAttackModeChanged(message.payload.value);
                    break;
                case 'playerIdleDirectionChanged':
                    this.handlePlayerIdleDirectionChanged(message.payload.value);
                    break;
                case 'playerAppearanceChanged':
                    this.handlePlayerAppearanceChanged(message.payload.value);
                    break;
                case 'playerDisconnected':
                    this.handlePlayerDisconnected(message.payload.value);
                    break;
                case 'playerReconnected':
                    this.handlePlayerReconnected(message.payload.value);
                    break;
                case 'sendMessage':
                    this.handleSendMessage(message.payload.value);
                    break;
                case 'chatMessageReceived':
                    this.handleChatMessageReceived(message.payload.value);
                    break;
                case 'weatherChanged':
                    this.handleWeatherChanged(message.payload.value);
                    break;
                case 'playerParalyzed':
                    this.handlePlayerParalyzed(message.payload.value);
                    break;
                case 'logoutResponse':
                    this.handleLogoutResponse(message.payload.value);
                    break;
                case 'logoutCancelled':
                    this.handleLogoutCancelled();
                    break;
                case 'progressionState':
                    this.handleProgressionState(message.payload.value);
                    break;
                case 'progressionUpdated':
                    this.handleProgressionUpdated(message.payload.value);
                    break;
                case 'majesticUpgradeResult':
                    this.handleMajesticUpgradeResult(message.payload.value);
                    break;
                case 'stoneItemUpgradeResult':
                    this.handleStoneItemUpgradeResult(message.payload.value);
                    break;
                case 'enchantMaterialsState':
                    EventBus.emit(ENCHANT_MATERIALS_STATE_RECEIVED, message.payload.value);
                    break;
                case 'enchantResult':
                    this.handleEnchantResult(message.payload.value);
                    break;
                case 'cicItemMergeResult':
                    this.handleCicItemMergeResult(message.payload.value);
                    break;
                case 'siphonGemUpgradeResult':
                    this.handleSiphonGemUpgradeResult(message.payload.value);
                    break;
                case 'specialAbilityStatus':
                    this.handleSpecialAbilityStatus(message.payload.value);
                    break;
                case 'arenaPactState':
                    EventBus.emit(ARENA_PACT_STATE_RECEIVED, message.payload.value);
                    break;
                case 'arenaPactListResponse':
                    EventBus.emit(ARENA_PACT_LIST_RECEIVED, message.payload.value);
                    break;
                case 'majesticStatRespecResult':
                    this.handleMajesticStatRespecResult(message.payload.value);
                    break;
                case 'skillsState':
                    this.handleSkillsState(message.payload.value);
                    break;
                case 'skillGatherResult':
                    this.handleSkillGatherResult(message.payload.value);
                    break;
                case 'itemBindResult':
                    this.handleItemBindResult(message.payload.value);
                    break;
                case 'buyCashShopItemResult':
                    this.handleBuyCashShopItemResult(message.payload.value);
                    break;
                case 'monsterKillsUpdated':
                    this.handleMonsterKillsUpdated(message.payload.value);
                    break;
                case 'killMilestoneClaimResult':
                    this.handleKillMilestoneClaimResult(message.payload.value);
                    break;
                case 'beginnerPathState':
                    this.handleBeginnerPathState(message.payload.value);
                    break;
                case 'partyState':
                    this.handlePartyState(message.payload.value);
                    break;
                case 'trainingPresetApplied':
                    this.handleTrainingPresetApplied(message.payload.value);
                    break;
                case 'timedChallengeState':
                    this.handleTimedChallengeState(message.payload.value);
                    break;
                case 'timedChallengeFinished':
                    this.handleTimedChallengeFinished(message.payload.value);
                    break;
                case 'timedChallengeLeaderboard':
                    this.handleTimedChallengeLeaderboard(message.payload.value);
                    break;
                case 'auctionBoardSnapshot':
                    applyAuctionBoardSnapshot({
                        listings: message.payload.value.listings ?? [],
                        message: message.payload.value.message,
                        myDebtGold: message.payload.value.myDebtGold,
                        myDebtDueMs: Number(message.payload.value.myDebtDueMs ?? 0),
                        myTradeBlocked: message.payload.value.myTradeBlocked,
                        settlementNote: message.payload.value.settlementNote,
                    });
                    break;
                case 'auctionBoardActionResult':
                    applyAuctionBoardActionResult({
                        ok: message.payload.value.ok,
                        message: message.payload.value.message,
                        listing: message.payload.value.listing,
                        myDebtGold: message.payload.value.myDebtGold,
                        myDebtDueMs: Number(message.payload.value.myDebtDueMs ?? 0),
                        myTradeBlocked: message.payload.value.myTradeBlocked,
                    });
                    break;
                case 'hellMiningStatus':
                    applyHellMiningStatus({
                        pendingHell: Number(message.payload.value.pendingHell ?? 0),
                        claimedHell: Number(message.payload.value.claimedHell ?? 0),
                        remainingPool: Number(message.payload.value.remainingPool ?? 0),
                        utcDay: message.payload.value.utcDay,
                        todayCredits: message.payload.value.todayCredits,
                        todayMonsterKills: message.payload.value.todayMonsterKills,
                        todayMonsterCreditGranted: message.payload.value.todayMonsterCreditGranted,
                        todayDirectTokens: Number(message.payload.value.todayDirectTokens ?? 0),
                        todaySettled: message.payload.value.todaySettled,
                        claimAvailable: message.payload.value.claimAvailable,
                        note: message.payload.value.note,
                    });
                    break;
                case 'hellMiningClaimResult':
                    applyHellMiningClaimResult({
                        ok: message.payload.value.ok,
                        message: message.payload.value.message,
                        pendingHell: Number(message.payload.value.pendingHell ?? 0),
                        claimedAmount: Number(message.payload.value.claimedAmount ?? 0),
                    });
                    break;
                case 'buyShopItemResult':
                    setShopStatusMessage(message.payload.value.message || (message.payload.value.ok ? 'Done.' : 'Purchase failed.'));
                    setBlacksmithStatusMessage(message.payload.value.message || (message.payload.value.ok ? 'Done.' : 'Purchase failed.'));
                    break;
                case 'sellBagItemResult': {
                    const sell = message.payload.value;
                    const text = sell.message || (sell.ok ? 'Sold.' : 'Sell failed.');
                    EventBus.emit(TOAST_REQUESTED, {
                        message: text,
                        severity: sell.ok ? 'success' : 'error',
                    });
                    // System communications (bottom-left log) + let bag UI clean drop-log rows.
                    EventBus.emit(SYSTEM_LOG_APPEND, {
                        message: text,
                        kind: sell.ok ? 'event' : 'warning',
                    });
                    EventBus.emit(SELL_BAG_ITEM_RESULT, {
                        ok: sell.ok,
                        message: text,
                        goldGained: sell.goldGained,
                        itemUid: sell.itemUid !== undefined ? sell.itemUid.toString() : undefined,
                    });
                    break;
                }
                case 'repairItemResult': {
                    const repairMsg =
                        message.payload.value.message ||
                        (message.payload.value.ok ? 'Repaired.' : 'Repair failed.');
                    // Tom (weapons/armor) and Shop Keeper (rings) share this result.
                    setBlacksmithStatusMessage(repairMsg);
                    setShopStatusMessage(repairMsg);
                    break;
                }
                case 'itemLifeSpanUpdated':
                    this.handleItemLifeSpanUpdated(message.payload.value);
                    break;
                case 'warehouseState':
                    this.handleWarehouseState(message.payload.value);
                    break;
                case 'warehouseMutationResult':
                    setWarehouseStatusMessage(
                        message.payload.value.message ||
                            (message.payload.value.ok ? 'Done.' : 'Warehouse action failed.'),
                    );
                    break;
                case 'cityNpcServiceResult': {
                    const r = message.payload.value;
                    const payload = {
                        ok: r.ok,
                        message: r.message || (r.ok ? 'Done.' : 'Request failed.'),
                        role: r.role,
                        npcName: r.npcName,
                        guildInterestRegistered: r.guildInterestRegistered,
                        citizenshipSide: r.citizenshipSide,
                        cityServicesSummary: r.cityServicesSummary,
                        crusadeStatus: r.crusadeStatus,
                        hp: r.hp,
                        maxHp: r.maxHp,
                        blessed: r.blessed,
                        // Magic Tower reuses this field as bag gold balance.
                        goldSpent: r.goldSpent ?? 0,
                    };
                    applyCityNpcServiceResult(payload);
                    EventBus.emit(SERVER_CITY_NPC_SERVICE_RESULT, payload);
                    break;
                }
                case 'antiBotToolsState':
                    this.handleAntiBotToolsState(message.payload.value);
                    break;
                case 'setAntiBotToolsResult':
                    this.handleSetAntiBotToolsResult(message.payload.value);
                    break;
                case 'worldsList':
                    this.handleWorldsList(message.payload.value);
                    break;
                case 'monstersList':
                    this.handleMonstersList(message.payload.value);
                    break;
                case 'initialState':
                    this.handleInitialState(message.payload.value);
                    break;
                case 'itemAddedToBag':
                    this.handleItemAddedToBag(message.payload.value);
                    break;
                case 'itemRemovedFromBag':
                    this.handleItemRemovedFromBag(message.payload.value);
                    break;
                case 'itemMovedInBag':
                    this.handleItemMovedInBag(message.payload.value);
                    break;
                case 'itemEquipped':
                    this.handleItemEquipped(message.payload.value);
                    break;
                case 'itemUnequipped':
                    this.handleItemUnequipped(message.payload.value);
                    break;
                case 'castDirectionalAoeSpell':
                    this.handleCastDirectionalAoeSpell(message.payload.value);
                    break;
                case 'monstersEnteredRange':
                    this.handleMonstersEnteredRange(message.payload.value);
                    break;
                case 'monstersLeftRange':
                    this.handleMonstersLeftRange(message.payload.value);
                    break;
                case 'npcsEnteredRange':
                    this.handleNpcsEnteredRange(message.payload.value);
                    break;
                case 'npcsLeftRange':
                    this.handleNpcsLeftRange(message.payload.value);
                    break;
                case 'monsterMoved':
                    this.handleMonsterMoved(message.payload.value);
                    break;
                case 'monsterAttacked':
                    this.handleMonsterAttacked(message.payload.value);
                    break;
                case 'monsterAttackedMonster':
                    this.handleMonsterAttackedMonster(message.payload.value);
                    break;
                case 'playerReceiveDamage':
                    this.handlePlayerReceiveDamage(message.payload.value);
                    break;
                case 'playerTakeDamage':
                    this.handlePlayerTakeDamage(message.payload.value);
                    break;
                case 'hpUpdated':
                    this.handleHpUpdated(message.payload.value);
                    break;
                case 'playerDied':
                    this.handlePlayerDied(message.payload.value);
                    break;
                case 'enemyKillAwarded':
                    this.handleEnemyKillAwarded(message.payload.value);
                    break;
                case 'levelUpSettingsApplied':
                    this.handleLevelUpSettingsApplied(message.payload.value);
                    break;
                case 'playerResurrected':
                    this.handlePlayerResurrected(message.payload.value);
                    break;
                case 'monsterTakeDamage':
                    this.handleMonsterTakeDamage(message.payload.value);
                    break;
                case 'monsterTakeDamageByMonster':
                    this.handleMonsterTakeDamageByMonster(message.payload.value);
                    break;
                case 'monsterDied':
                    this.handleMonsterDied(message.payload.value);
                    break;
                case 'playerAttackedMonster':
                    this.handlePlayerAttackedMonster(message.payload.value);
                    break;
                case 'playerAttackedPlayer':
                    this.handlePlayerAttackedPlayer(message.payload.value);
                    break;
                case 'playerPickupPerformed':
                    this.handlePlayerPickupPerformed(message.payload.value);
                    break;
                case 'playerBowStancePerformed':
                    this.handlePlayerBowStancePerformed(message.payload.value);
                    break;
                case 'spellCastStarted':
                    this.handleSpellCastStarted(message.payload.value);
                    break;
                case 'spellCastCancelled':
                    this.handleSpellCastCancelled(message.payload.value);
                    break;
                case 'spellCastFailed':
                    this.handleSpellCastFailed(message.payload.value);
                    break;
                case 'castAoeSpell':
                    this.handleCastAoeSpell(message.payload.value);
                    break;
                case 'monsterCastAoeSpell':
                    this.handleMonsterCastAoeSpell(message.payload.value);
                    break;
                case 'monsterCastDirectionalAoeSpell':
                    this.handleMonsterCastDirectionalAoeSpell(message.payload.value);
                    break;
                case 'spawnProtectionEnabled':
                    this.handleSpawnProtectionEnabled(message.payload.value);
                    break;
                case 'spawnProtectionDisabled':
                    this.handleSpawnProtectionDisabled(message.payload.value);
                    break;
                case 'temporaryEffectApplied':
                    this.handleTemporaryEffectApplied(message.payload.value);
                    break;
                case 'temporaryEffectExpired':
                    this.handleTemporaryEffectExpired(message.payload.value);
                    break;
                case 'castEffect':
                    this.handleCastEffect(message.payload.value);
                    break;
            }
        } catch (error) {
            console.warn('[NetworkManager] Failed to handle WebSocket message.', error);
        }
    }

    private handlePingResponse(pingResponse: PingResponse): void {
        if (this.pingSentAt === undefined || this.pendingPingSequence !== pingResponse.sequence) {
            return;
        }
        this.latestPing = Math.round(performance.now() - this.pingSentAt);
        this.latestPingVariance = pingResponse.pingVariance;
        this.latestGameWorldQueueLength = pingResponse.gameWorldQueueLength;
        this.latestPlayersInMap = pingResponse.playersInMap;
        this.pendingPingSequence = undefined;
        this.pingSentAt = undefined;
    }

    private handleInitialState(data: InitialState): void {
        this.selfPlayerId = String(data.playerId);
        this.npcDirectoryByCatalogId.clear();
        for (const row of data.npcDirectory) {
            this.npcDirectoryByCatalogId.set(row.id, row.name);
        }
        EventBus.emit(
            OUT_UI_SET_NPC_DIRECTORY,
            data.npcDirectory.map((row) => ({ id: row.id, name: row.name })),
        );
        applyItemDirectory(data.itemsDirectory);
        this.latestInventorySnapshot = {
            bagItems: data.bagItems
                .map((entry) => inventoryItemFromEntry(entry))
                .sort((a, b) => (a.bagZIndex ?? 0) - (b.bagZIndex ?? 0)),
            equippedItems: equippedItemsFromEntries(data.equippedItems),
        };
        EventBus.emit(SERVER_INVENTORY_SNAPSHOT_RECEIVED, this.latestInventorySnapshot);
        if (LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND) {
            const prefetchGender = appearanceGenderToClient(data.gender);
            const spriteNames = collectEquippedItemAppearanceSpriteBasenamesForPrefetch(
                this.latestInventorySnapshot.equippedItems,
                prefetchGender,
            );
            if (spriteNames.length > 0) {
                EventBus.emit(PLAYER_ITEM_APPEARANCE_PREFETCH_REQUESTED, { spriteNames });
            }
        }
        if (data.spells.length > 0) {
            this.spells = data.spells.map((spell) => {
                const entry: SpellEntry = {
                    id: spell.id,
                    name: spell.name,
                    aoeRadius: spell.aoeRadius,
                    projectileSpeed: spell.projectileSpeed,
                    emissionSteps: spell.emissionSteps,
                    startRadius: spell.startRadius,
                    endRadius: spell.endRadius,
                    startShards: spell.startShards,
                    endShards: spell.endShards,
                    durationMs: spell.durationMs,
                    projectileDistancePx: spell.projectileDistancePx,
                    aimAssist: spell.aimAssist,
                };
                if (spell.damageType !== undefined) {
                    entry.damageType = spell.damageType;
                }
                if (spell.temporaryEffects?.length) {
                    entry.temporaryEffects = spell.temporaryEffects.map((fx) => ({
                        type: fx.type,
                        durationMs: fx.durationMs,
                        group: fx.group,
                    }));
                }
                return entry;
            });
            EventBus.emit(OUT_UI_SET_SPELLS, [...this.spells]);
            applyServerSpellUnlocks(this.spells.map((s) => s.id));
        } else {
            // Empty spell list on world transfer is intentional for some paths — do NOT wipe the local
            // VFX/cast directory (arena Blizzard "no los veo" was caused by clearing here).
            // Only clear when we never had spells (fresh session) so GM leftovers are not a concern.
            if (this.spells.length === 0) {
                EventBus.emit(OUT_UI_SET_SPELLS, []);
            }
        }

        this.lastSelfHp = data.hp;
        this.lastSelfMaxHp = data.maxHp;
        setCharacterStats({
            hp: data.hp,
            maxHp: data.maxHp,
            mp: data.mp,
            maxMp: data.maxMp,
            sp: data.sp,
            maxSp: data.maxSp,
            str: data.str > 0 ? data.str : 10,
            vit: data.vit > 0 ? data.vit : 10,
            dex: data.dex > 0 ? data.dex : 10,
            int: data.intel > 0 ? data.intel : 10,
            mag: data.mag > 0 ? data.mag : 10,
            chr: data.chr > 0 ? data.chr : 10,
            level: data.level > 0 ? data.level : 1,
        });
        setLevelUpPointsLeft(data.luPoints);
        // Carry weight from bag/equip (Olympia stones); inventory snapshot is applied earlier in this handler.
        queueMicrotask(() => refreshCarryWeightUi());

        if (data.pingIntervalMs > 0) {
            this.pingIntervalMs = data.pingIntervalMs;
            this.startPingInterval();
            this.sendPing();
        }

        const runMode = data.runningMode;
        this.initialStateMergeBase = {
            playerId: this.selfPlayerId,
            movementSpeedMs: data.movementSpeedMs,
            runMode,
            attackMode: data.attackMode,
            safeAttackMode: data.safeAttackMode,
            citizenshipSide: data.citizenshipSide || 'traveler',
            attackType: data.attackType >= 0 && data.attackType <= 3 ? data.attackType : undefined,
            allowDashAttack: data.allowDashAttack,
            attackRangeCells: data.attackRangeCells > 0 ? data.attackRangeCells : undefined,
            attackDamage: data.attackDamage > 0 ? data.attackDamage : undefined,
            attackSpeedMs: data.attackSpeedMs > 0 ? data.attackSpeedMs : undefined,
            attackStunDurationMs:
                data.attackStunDurationMs >= 100 && data.attackStunDurationMs <= 2000
                    ? data.attackStunDurationMs
                    : undefined,
            castSpeedMs:
                data.castSpeedMs >= 200 && data.castSpeedMs <= 2000 ? data.castSpeedMs : undefined,
            arrowSpeedPxPerSec: data.arrowSpeedPxPerSec > 0 ? data.arrowSpeedPxPerSec : undefined,
            hp: data.hp,
            maxHp: data.maxHp,
            playerPickupAnimationTimeMs: data.playerPickupAnimationTimeMs,
            playerBowAnimationDurationMs: data.playerBowAnimationDurationMs,
            gender: appearanceGenderToClient(data.gender),
            skinColor: appearanceSkinToClient(data.skinColor),
            hairStyleIndex: Math.max(0, Math.min(7, data.hairStyleIndex)),
            underwearColorIndex: Math.max(0, Math.min(7, data.underwearColorIndex)),
        };

        if (data.baseMovementSpeedMs > 0) {
            EventBus.emit(OUT_UI_SET_MOVEMENT_SPEED, data.baseMovementSpeedMs);
        }
        EventBus.emit(OUT_UI_SET_RUN_MODE, runMode);
        EventBus.emit(OUT_UI_SET_ATTACK_MODE, data.attackMode);
        EventBus.emit(OUT_UI_SET_SAFE_ATTACK_MODE, data.safeAttackMode);
        if (data.citizenshipSide) {
            const side = data.citizenshipSide.trim().toLowerCase();
            const factionLabel =
                side === 'aresden' ? 'Aresden' : side === 'elvine' ? 'Elvine' : 'Traveller';
            setCharacterStats({ faction: factionLabel });
            // Citizens must not be force-warped back to traveler zone on every map load.
            if (side === 'aresden' || side === 'elvine') {
                markCityChosen(side);
            }
        }
        if (data.attackType >= 0 && data.attackType <= 3) {
            EventBus.emit(OUT_UI_SET_ATTACK_TYPE, data.attackType);
        }
        EventBus.emit(OUT_UI_SET_ALLOW_DASH_ATTACK, data.allowDashAttack);
        if (data.attackRangeCells > 0) {
            EventBus.emit(OUT_UI_SET_ATTACK_RANGE, data.attackRangeCells);
        }
        if (data.attackDamage > 0) {
            EventBus.emit(OUT_UI_SET_DAMAGE, data.attackDamage);
        }
        if (data.attackSpeedMs > 0) {
            EventBus.emit(OUT_UI_SET_ATTACK_SPEED_MS, data.attackSpeedMs);
        }
        if (data.attackStunDurationMs >= 100 && data.attackStunDurationMs <= 2000) {
            EventBus.emit(OUT_UI_SET_STUN_DURATION_MS, data.attackStunDurationMs);
        }
        if (data.castSpeedMs >= 200 && data.castSpeedMs <= 2000) {
            EventBus.emit(OUT_UI_SET_CAST_SPEED, data.castSpeedMs);
        }

        const gender = appearanceGenderToClient(data.gender);
        const skinColor = appearanceSkinToClient(data.skinColor);
        const hairIdx = Math.max(0, Math.min(7, data.hairStyleIndex));
        const underwearIdx = Math.max(0, Math.min(7, data.underwearColorIndex));
        EventBus.emit(OUT_UI_SET_GENDER, gender);
        EventBus.emit(OUT_UI_SET_SKIN_COLOR, skinColor);
        EventBus.emit(OUT_UI_SET_HAIR_STYLE, hairIdx);
        EventBus.emit(OUT_UI_SET_UNDERWEAR_COLOR, underwearIdx);
    }

    private handleItemAddedToBag(data: ItemAddedToBag): void {
        if (!data.item) {
            return;
        }

        EventBus.emit(SERVER_ITEM_ADDED_TO_BAG_RECEIVED, {
            item: inventoryItemFromEntry(data.item),
        });
    }

    private handleItemRemovedFromBag(data: ItemRemovedFromBag): void {
        EventBus.emit(SERVER_ITEM_REMOVED_FROM_BAG_RECEIVED, {
            itemUid: data.itemUid.toString(),
        });
    }

    private handleItemMovedInBag(data: ItemMovedInBag): void {
        EventBus.emit(SERVER_ITEM_MOVED_IN_BAG_RECEIVED, {
            itemUid: data.itemUid.toString(),
            bagX: data.bagX,
            bagY: data.bagY,
            bagZIndex: data.bagZIndex,
        });
    }

    private handleItemLifeSpanUpdated(data: { itemUid: bigint | number; curLifeSpan: number; maxLifeSpan: number }): void {
        EventBus.emit(SERVER_ITEM_LIFE_SPAN_UPDATED_RECEIVED, {
            itemUid: data.itemUid.toString(),
            curLifeSpan: data.curLifeSpan,
            maxLifeSpan: data.maxLifeSpan,
        });
    }

    private handleItemEquipped(data: ItemEquipped): void {
        if (!data.equippedItem || !data.equippedItem.item || !isEquipmentSlot(data.equippedItem.slot)) {
            return;
        }

        const payload: ItemEquippedEventData = {
            playerId: data.playerId.toString(),
            slot: data.equippedItem.slot,
            item: inventoryItemFromEntry(data.equippedItem.item),
        };
        if (payload.playerId === this.selfPlayerId) {
            EventBus.emit(SERVER_ITEM_EQUIPPED_RECEIVED, payload);
            return;
        }

        const existing = this.otherPlayersById.get(payload.playerId);
        if (existing && Object.values(ItemTypes).includes(payload.slot as ItemTypes)) {
            this.otherPlayersById.set(payload.playerId, {
                ...existing,
                visibleEquippedItems: {
                    ...existing.visibleEquippedItems,
                    [payload.slot as ItemTypes]: {
                        itemId: payload.item.itemId,
                        effectOverrides: payload.item.effectOverrides,
                    },
                },
            });
        }
        EventBus.emit(REMOTE_PLAYER_ITEM_EQUIPPED_RECEIVED, payload);
    }

    private handleItemUnequipped(data: ItemUnequipped): void {
        if (!isEquipmentSlot(data.slot)) {
            return;
        }

        const payload: ItemUnequippedEventData = {
            playerId: data.playerId.toString(),
            slot: data.slot,
            itemUid: data.itemUid.toString(),
        };
        if (payload.playerId === this.selfPlayerId) {
            EventBus.emit(SERVER_ITEM_UNEQUIPPED_RECEIVED, payload);
            return;
        }

        const existing = this.otherPlayersById.get(payload.playerId);
        if (existing && Object.values(ItemTypes).includes(payload.slot as ItemTypes)) {
            const nextVisibleEquippedItems = { ...existing.visibleEquippedItems };
            delete nextVisibleEquippedItems[payload.slot as ItemTypes];
            this.otherPlayersById.set(payload.playerId, {
                ...existing,
                visibleEquippedItems: nextVisibleEquippedItems,
            });
        }
        EventBus.emit(REMOTE_PLAYER_ITEM_UNEQUIPPED_RECEIVED, payload);
    }

    private handleInitialGameWorldState(data: InitialGameWorldState): void {
        const base = this.initialStateMergeBase;
        if (!base) {
            console.warn('[NetworkManager] InitialGameWorldState received before InitialState.');
            return;
        }
        this.currentGameWorldId = data.gameWorldId;
        this.clearOtherPlayersState();
        this.clearMonstersInViewState();
        this.clearNpcsInViewState();
        this.clearGroundStatesInViewState();
        const runMode = base.runMode;
        const weather = weatherModeFromProto(data.weather);
        if (weather === undefined) {
            console.warn('[NetworkManager] InitialGameWorldState has unrecognized weather', data.weather);
        }
        const initialGameWorldStateEventData: InitialGameWorldStateEventData = {
            gameWorldId: data.gameWorldId,
            mapName: data.mapName,
            musicFile: data.musicFile || undefined,
            playerX: data.playerX,
            playerY: data.playerY,
            playerId: base.playerId,
            movementSpeedMs: base.movementSpeedMs,
            runMode,
            attackMode: base.attackMode,
            safeAttackMode: base.safeAttackMode,
            citizenshipSide: base.citizenshipSide,
            attackType: base.attackType,
            allowDashAttack: base.allowDashAttack,
            teleportLocs: normalizeTeleportLocs(data.teleportLocs),
            attackRangeCells: base.attackRangeCells,
            attackDamage: base.attackDamage,
            attackSpeedMs: base.attackSpeedMs,
            attackStunDurationMs: base.attackStunDurationMs,
            castSpeedMs: base.castSpeedMs,
            arrowSpeedPxPerSec: base.arrowSpeedPxPerSec,
            hp: this.lastSelfHp ?? base.hp,
            maxHp: this.lastSelfMaxHp ?? base.maxHp,
            playerPickupAnimationTimeMs: base.playerPickupAnimationTimeMs,
            playerBowAnimationDurationMs: base.playerBowAnimationDurationMs,
            dead: data.dead,
            playerDirection: data.playerDirection,
            weather,
            gender: base.gender,
            skinColor: base.skinColor,
            hairStyleIndex: base.hairStyleIndex,
            underwearColorIndex: base.underwearColorIndex,
        };
        this.pendingInitialGameWorldState = initialGameWorldStateEventData;
        EventBus.emit(INITIAL_GAME_WORLD_STATE_RECEIVED, initialGameWorldStateEventData);
    }

    private handleWorldsList(data: WorldsList): void {
        this.gameWorlds = data.worlds.map((world) => ({
            id: world.id,
            name: world.name,
            map: world.map,
        }));
        EventBus.emit(OUT_UI_SET_GAME_WORLDS, this.getGameWorlds());
    }

    private handleMonstersList(data: MonstersList): void {
        this.monsters = data.monsters.map((m) => ({
            name: m.name,
            sprite: m.sprite,
        }));
        EventBus.emit(OUT_UI_SET_MONSTERS, [...this.monsters]);
    }

    private handleMonstersEnteredRange(data: MonstersEnteredRange): void {
        const payload: MonsterEnteredRangeEventData[] = data.monsters.map((m) => ({
            monsterId: m.monsterId.toString(),
            sprite: m.sprite,
            x: m.x,
            y: m.y,
            state: m.state,
            name: m.name,
            rangedAttack: m.rangedAttack,
            hp: m.hp,
            maxHp: m.maxHp,
            dead: m.dead,
            corpseDecayTimeLeftMs: m.corpseDecayTimeLeftMs,
            direction: m.direction,
            movementSpeedMs: m.movementSpeedMs,
            attackSpeedMs: m.attackSpeedMs,
            attackDamage: m.attackDamage,
            allegiance: m.allegiance,
            attackType: m.attackType,
            activeTemporaryEffects: m.activeTemporaryEffects?.length ? [...m.activeTemporaryEffects] : [],
        }));
        if (payload.length === 0) {
            return;
        }
        const mergedPayload: MonsterEnteredRangeEventData[] = [];
        for (const entry of payload) {
            const pending = this.pendingMonsterPositionBeforeEnter.get(entry.monsterId);
            const merged: MonsterEnteredRangeEventData = pending
                ? { ...entry, x: pending.destX, y: pending.destY }
                : entry;
            this.monstersInViewById.set(entry.monsterId, merged);
            mergedPayload.push(merged);
            if (pending) {
                this.pendingMonsterPositionBeforeEnter.delete(entry.monsterId);
            }
        }
        EventBus.emit(MONSTER_ENTERED_RANGE_RECEIVED, mergedPayload);
    }

    private handleMonstersLeftRange(data: MonstersLeftRange): void {
        const ids = data.monsterIds.map((id) => id.toString());
        if (ids.length === 0) {
            return;
        }
        for (const id of ids) {
            this.monstersInViewById.delete(id);
            this.pendingMonsterPositionBeforeEnter.delete(id);
        }
        EventBus.emit(MONSTERS_LEFT_RANGE_RECEIVED, ids);
    }

    private handleNpcsEnteredRange(data: NpcsEnteredRange): void {
        const payload: NpcEnteredRangeEventData[] = [];
        for (const n of data.npcs) {
            const catalogNpcId = n.catalogNpcId;
            const displayName = this.npcDirectoryByCatalogId.get(catalogNpcId) ?? `NPC ${catalogNpcId}`;
            payload.push({
                npcId: n.npcId.toString(),
                catalogNpcId,
                x: n.x,
                y: n.y,
                direction: n.direction,
                displayName,
            });
        }
        if (payload.length === 0) {
            return;
        }
        for (const entry of payload) {
            this.npcsInViewById.set(entry.npcId, entry);
        }
        EventBus.emit(NPC_ENTERED_RANGE_RECEIVED, payload);
    }

    private handleNpcsLeftRange(data: NpcsLeftRange): void {
        const ids = data.npcIds.map((id) => id.toString());
        if (ids.length === 0) {
            return;
        }
        for (const id of ids) {
            this.npcsInViewById.delete(id);
        }
        EventBus.emit(NPCS_LEFT_RANGE_RECEIVED, ids);
    }

    private handleGroundStatesEnteredRange(data: GroundStatesEnteredRange): void {
        const batch: GroundStateCellEventData[] = [];
        for (const state of data.states) {
            const x = state.loc?.x;
            const y = state.loc?.y;
            if (x === undefined || y === undefined) {
                continue;
            }

            const key = this.getGroundStateCellKey(x, y);
            const existing = this.groundStatesInViewByCell.get(key);
            const effectsById = new Map<string, GroundEffectEventData>();
            for (const existingEffect of existing?.effects ?? []) {
                effectsById.set(existingEffect.groundEffectId, existingEffect);
            }

            for (const effect of state.effects) {
                effectsById.set(effect.groundEffectId.toString(), {
                    groundEffectId: effect.groundEffectId.toString(),
                    effectType: effect.effectType,
                });
            }

            const mergedState: GroundStateCellEventData = {
                x,
                y,
                effects: Array.from(effectsById.values()),
                groundItem: state.groundItem
                    ? {
                        itemId: state.groundItem.itemId,
                        itemUid: state.groundItem.itemUid.toString(),
                        quantity: state.groundItem.quantity ?? 1,
                        effectOverrides: effectsFromDirectoryEntries(state.groundItem.effectOverrides),
                        ...(state.groundItem.itemAttribute !== undefined && state.groundItem.itemAttribute !== 0 && {
                            itemAttribute: state.groundItem.itemAttribute,
                        }),
                        ...(state.groundItem.itemColor !== undefined && state.groundItem.itemColor !== 0 && {
                            itemColor: state.groundItem.itemColor,
                        }),
                    }
                    : existing?.groundItem,
            };
            this.groundStatesInViewByCell.set(key, mergedState);
            batch.push(mergedState);
        }

        if (batch.length > 0) {
            EventBus.emit(GROUND_STATES_ENTERED_RANGE_RECEIVED, batch);
        }
    }

    private handleGroundStatesLeftRange(data: GroundStatesLeftRange): void {
        const batch: GroundStateCellRemovedEventData[] = [];
        for (const state of data.states) {
            const x = state.loc?.x;
            const y = state.loc?.y;
            if (x === undefined || y === undefined) {
                continue;
            }

            const key = this.getGroundStateCellKey(x, y);
            const existing = this.groundStatesInViewByCell.get(key);
            const removedIds = state.groundEffectIds.map((id) => id.toString());
            const removedGroundItemUid = state.groundItemUid !== undefined
                ? state.groundItemUid.toString()
                : undefined;
            if (removedIds.length === 0 && removedGroundItemUid === undefined) {
                continue;
            }

            if (existing) {
                const removedIdSet = new Set(removedIds);
                const remainingEffects = existing.effects.filter((effect) => !removedIdSet.has(effect.groundEffectId));
                const remainingGroundItem = existing.groundItem?.itemUid === removedGroundItemUid
                    ? undefined
                    : existing.groundItem;
                if (remainingEffects.length === 0 && !remainingGroundItem) {
                    this.groundStatesInViewByCell.delete(key);
                } else {
                    this.groundStatesInViewByCell.set(key, {
                        ...existing,
                        effects: remainingEffects,
                        groundItem: remainingGroundItem,
                    });
                }
            }

            batch.push({
                x,
                y,
                groundEffectIds: removedIds,
                ...(removedGroundItemUid !== undefined && { groundItemUid: removedGroundItemUid }),
            });
        }

        if (batch.length > 0) {
            EventBus.emit(GROUND_STATES_LEFT_RANGE_RECEIVED, batch);
        }
    }

    private handleMonsterMoved(data: MonsterMoved): void {
        const monsterId = data.monsterId.toString();
        const movementSpeedMs = data.movementSpeedMs;
        const existing = this.monstersInViewById.get(monsterId);
        if (existing) {
            this.monstersInViewById.set(monsterId, {
                ...existing,
                x: data.destX,
                y: data.destY,
                state: existing.dead ? existing.state : MonsterEntityState.MONSTER_ENTITY_STATE_MOVE,
                direction: data.direction,
                movementSpeedMs,
            });
        } else {
            this.pendingMonsterPositionBeforeEnter.set(monsterId, { destX: data.destX, destY: data.destY });
        }
        const eventData: MonsterMovedEventData = {
            monsterId,
            curX: data.curX,
            curY: data.curY,
            destX: data.destX,
            destY: data.destY,
            movementSpeedMs,
            direction: data.direction,
        };
        EventBus.emit(MONSTER_MOVED_RECEIVED, eventData);
    }

    private handleMonsterAttacked(data: MonsterAttacked): void {
        const monsterId = data.monsterId.toString();
        this.markMonsterAsAttacking(monsterId);
        EventBus.emit(MONSTER_ATTACKED_RECEIVED, {
            monsterId,
            direction: data.direction,
            attackSpeedMs: data.attackSpeedMs,
            rangedAttack: data.rangedAttack,
            targetPlayerId: data.targetPlayerId.toString(),
            worldX: data.worldX,
            worldY: data.worldY,
        } satisfies MonsterAttackedEventData);
    }

    private handleMonsterAttackedMonster(data: MonsterAttackedMonster): void {
        const monsterId = data.monsterId.toString();
        this.markMonsterAsAttacking(monsterId);
        EventBus.emit(MONSTER_ATTACKED_MONSTER_RECEIVED, {
            monsterId,
            direction: data.direction,
            attackSpeedMs: data.attackSpeedMs,
            rangedAttack: data.rangedAttack,
            targetMonsterId: data.targetMonsterId.toString(),
            worldX: data.worldX,
            worldY: data.worldY,
        } satisfies MonsterAttackedMonsterEventData);
    }

    private handlePlayerReceiveDamage(data: PlayerReceiveDamage): void {
        EventBus.emit(PLAYER_RECEIVE_DAMAGE_RECEIVED, {
            playerId: data.playerId.toString(),
            damage: data.damage,
            monsterId: data.monsterId.toString(),
            attackType: data.attackType,
            stunDurationMs: data.stunDurationMs,
            knockbackDurationMs: data.knockbackDurationMs,
            destX: data.destX,
            destY: data.destY,
            knockbackFromX: data.knockbackFromX,
            knockbackFromY: data.knockbackFromY,
        } satisfies PlayerReceiveDamageEventData);
    }

    private handlePlayerTakeDamage(data: PlayerTakeDamage): void {
        EventBus.emit(PLAYER_TAKE_DAMAGE_RECEIVED, {
            targetPlayerId: data.targetPlayerId.toString(),
            damage: data.damage,
            attackerPlayerId: data.attackerPlayerId.toString(),
            attackType: data.attackType,
            stunDurationMs: data.stunDurationMs,
            knockbackDurationMs: data.knockbackDurationMs,
            destX: data.destX,
            destY: data.destY,
            knockbackFromX: data.knockbackFromX,
            knockbackFromY: data.knockbackFromY,
        } satisfies PlayerTakeDamageEventData);
    }

    private handleHpUpdated(data: HpUpdated): void {
        this.lastSelfHp = data.hp;
        this.lastSelfMaxHp = data.maxHp;
        setCharacterStats({ hp: data.hp, maxHp: data.maxHp });
        EventBus.emit(HP_UPDATED_RECEIVED, { hp: data.hp, maxHp: data.maxHp });
    }


    private handleEnemyKillAwarded(data: {
        victimPlayerId: bigint;
        victimName: string;
        victimLevel: number;
        killerLevel: number;
        victimCityKillerRank?: number;
        rarity: number | string;
        mapName: string;
        killerEkCount?: number;
    }): void {
        const rarityRaw = data.rarity;
        let rarity: EnemyKillAwardedEventData['rarity'] = 'unspecified';
        const rarityKey = typeof rarityRaw === 'number'
            ? rarityRaw
            : String(rarityRaw).toLowerCase();
        if (rarityKey === 3 || rarityKey === 'ek_screenshot_rarity_legendary' || rarityKey === 'legendary') {
            rarity = 'legendary';
        } else if (rarityKey === 2 || rarityKey === 'ek_screenshot_rarity_rare' || rarityKey === 'rare') {
            rarity = 'rare';
        } else if (rarityKey === 1 || rarityKey === 'ek_screenshot_rarity_common' || rarityKey === 'common') {
            rarity = 'common';
        }
        EventBus.emit(ENEMY_KILL_AWARDED_RECEIVED, {
            victimPlayerId: data.victimPlayerId.toString(),
            victimName: data.victimName,
            victimLevel: data.victimLevel,
            killerLevel: data.killerLevel,
            victimCityKillerRank: data.victimCityKillerRank,
            rarity,
            mapName: data.mapName ?? '',
            killerEkCount: data.killerEkCount,
        } satisfies EnemyKillAwardedEventData);
    }

    private handlePlayerDied(data: {
        playerId: bigint;
        x: number;
        y: number;
        killerPlayerId?: bigint;
        killerName?: string;
    }): void {
        const playerId = data.playerId.toString();
        const existing = this.otherPlayersById.get(playerId);
        if (existing) {
            this.otherPlayersById.set(playerId, { ...existing, x: data.x, y: data.y, dead: true, activeTemporaryEffects: [] });
        }
        EventBus.emit(PLAYER_DIED_RECEIVED, {
            playerId,
            x: data.x,
            y: data.y,
            killerPlayerId: data.killerPlayerId !== undefined ? data.killerPlayerId.toString() : undefined,
            killerName: data.killerName,
        } satisfies PlayerDiedEventData);
    }

    private handlePlayerResurrected(data: { playerId: bigint; x: number; y: number; hp: number; maxHp: number }): void {
        const playerId = data.playerId.toString();
        if (playerId === this.selfPlayerId) {
            this.lastSelfHp = data.hp;
            this.lastSelfMaxHp = data.maxHp;
        }
        const existing = this.otherPlayersById.get(playerId);
        if (existing) {
            this.otherPlayersById.set(playerId, { ...existing, x: data.x, y: data.y, dead: false });
        }
        EventBus.emit(PLAYER_RESURRECTED_RECEIVED, {
            playerId,
            x: data.x,
            y: data.y,
            hp: data.hp,
            maxHp: data.maxHp,
        } satisfies PlayerResurrectedEventData);
    }

    public requestPlayerResurrectedRequest(): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'playerResurrectedRequest',
                value: {},
            },
        }).finish();
        this.sendPacket(command);
    }

    private handleProgressionState(data: ProgressionState): void {
        EventBus.emit(PROGRESSION_STATE_RECEIVED, data);
    }

    private handleProgressionUpdated(data: ProgressionUpdated): void {
        this.lastSelfHp = data.hp;
        this.lastSelfMaxHp = data.maxHp;
        EventBus.emit(HP_UPDATED_RECEIVED, { hp: data.hp, maxHp: data.maxHp });
        EventBus.emit(PROGRESSION_UPDATED_RECEIVED, data);
    }

    private handleMajesticUpgradeResult(data: MajesticUpgradeResult): void {
        EventBus.emit(MAJESTIC_UPGRADE_RESULT_RECEIVED, data);
        if (data.success) {
            EventBus.emit(TOAST_REQUESTED, {
                message: data.itemTransformed
                    ? `DK form upgraded! +${(data.itemAttribute >>> 28) & 0xf} (${data.majesticPoints} maj left)`
                    : `Majestic upgrade OK (+${(data.itemAttribute >>> 28) & 0xf}). ${data.majesticPoints} maj left`,
                severity: 'success',
            });
        } else if (data.error) {
            EventBus.emit(TOAST_REQUESTED, { message: data.error, severity: 'warning' });
        }
    }

    private handleStoneItemUpgradeResult(data: StoneItemUpgradeResult): void {
        EventBus.emit(STONE_ITEM_UPGRADE_RESULT_RECEIVED, data);
        const text = data.message || (data.success ? 'Upgrade OK.' : 'Upgrade failed.');
        EventBus.emit(TOAST_REQUESTED, {
            message: text,
            severity: data.success ? 'success' : data.burned ? 'error' : 'warning',
        });
    }

    public requestSkillsState(): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'getSkillsStateRequest',
                value: {},
            },
        }).finish();
        this.sendPacket(command);
    }

    public requestSkillGather(skillId: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'skillGatherRequest',
                value: { skillId },
            },
        }).finish();
        this.sendPacket(command);
    }

    private handleSkillsState(data: { skills?: { skillId: number; level: number }[] }): void {
        const levels: Record<number, number> = {};
        for (const s of data.skills ?? []) {
            levels[s.skillId] = s.level;
        }
        setSkillLevels(levels);
    }

    private handleSkillGatherResult(data: {
        ok: boolean;
        message: string;
        skillId: number;
        skillLevel: number;
        rareLoot: boolean;
    }): void {
        setSkillLevel(data.skillId, data.skillLevel);
        EventBus.emit(TOAST_REQUESTED, {
            message: data.message || (data.ok ? 'Gather OK.' : 'Gather failed.'),
            severity: data.ok ? (data.rareLoot ? 'success' : 'info') : 'warning',
        });
    }

    private handleLevelUpSettingsApplied(data: LevelUpSettingsApplied): void {
        if (data.success) {
            this.lastSelfHp = data.hp;
            this.lastSelfMaxHp = data.maxHp;
            EventBus.emit(HP_UPDATED_RECEIVED, { hp: data.hp, maxHp: data.maxHp });
        }
        EventBus.emit(LEVEL_UP_SETTINGS_APPLIED_RECEIVED, data);
    }

    private handleMonsterKillsUpdated(data: MonsterKillsUpdated): void {
        EventBus.emit(MONSTER_KILLS_UPDATED_RECEIVED, data);
    }

    private handleKillMilestoneClaimResult(data: KillMilestoneClaimResult): void {
        EventBus.emit(KILL_MILESTONE_CLAIM_RESULT_RECEIVED, data);
    }

    private handleBeginnerPathState(data: BeginnerPathState): void {
        EventBus.emit(BEGINNER_PATH_STATE_RECEIVED, data);
    }

    private handlePartyState(data: PartyState): void {
        EventBus.emit(PARTY_STATE_RECEIVED, data);
    }

    private handleTrainingPresetApplied(data: {
        ok: boolean;
        message: string;
        presetId: string;
        spawnedCount: number;
    }): void {
        const toastEvent: ToastRequestedEvent = {
            message: data.message || (data.ok ? 'Training preset applied.' : 'Training preset failed.'),
            severity: data.ok ? 'success' : 'error',
        };
        EventBus.emit(TOAST_REQUESTED, toastEvent);
    }

    private handleTimedChallengeState(data: ProtoTimedChallengeState): void {
        applyTimedChallengeState({
            active: data.active,
            mode: data.mode,
            targetsTotal: data.targetsTotal,
            targetsCompleted: data.targetsCompleted,
            startedAtMs: Number(data.startedAtMs ?? 0),
            message: data.message || '',
            freeMana: data.freeMana,
            waveIndex: data.waveIndex ?? 0,
            waveCount: data.waveCount ?? 0,
            phase: data.phase ?? 0,
        });
        setTimedChallengeProtocolSpellsUnlocked(data.active && data.freeMana);
        if (data.freeMana) {
            // Soft refill: client MP is cosmetic until server tracks mana.
            setCharacterStats({ mp: 999, maxMp: 999 });
        }
        // Toast on start / idle transitions only — progress ticks update the Training panel.
        if (data.message && (!data.active || data.targetsCompleted === 0 || data.phase === 1)) {
            EventBus.emit(TOAST_REQUESTED, {
                message: data.message,
                severity: data.active ? 'info' : 'success',
            } satisfies ToastRequestedEvent);
        }
    }

    private handleTimedChallengeFinished(data: ProtoTimedChallengeFinished): void {
        applyTimedChallengeFinished({
            ok: data.ok,
            message: data.message || '',
            elapsedMs: data.elapsedMs,
        });
        setTimedChallengeProtocolSpellsUnlocked(false);
        EventBus.emit(TOAST_REQUESTED, {
            message: data.message || (data.ok ? 'Challenge finished.' : 'Challenge failed.'),
            severity: data.ok ? 'success' : 'error',
        } satisfies ToastRequestedEvent);
    }

    private handleTimedChallengeLeaderboard(data: ProtoTimedChallengeLeaderboard): void {
        applyTimedChallengeLeaderboard({
            mode: data.mode,
            utcDay: data.utcDay || '',
            entries: (data.entries ?? []).map((e) => ({
                characterName: e.characterName || '',
                walletSuffix: e.walletSuffix || '',
                elapsedMs: e.elapsedMs,
            })),
            yourBestMs: data.yourBestMs,
        });
    }

    private handleAntiBotToolsState(data: ProtoAntiBotToolsState): void {
        applyAntiBotToolsState(mapAntiBotToolsState(data));
    }

    private handleSetAntiBotToolsResult(data: ProtoSetAntiBotToolsResult): void {
        const state = data.state ? mapAntiBotToolsState(data.state) : undefined;
        applyAntiBotToolsSetResult(data.ok, data.message, state);
        const toastEvent: ToastRequestedEvent = {
            message: data.message || (data.ok ? 'Anti-bot tools saved.' : 'Anti-bot tools save failed.'),
            severity: data.ok ? 'success' : 'error',
        };
        EventBus.emit(TOAST_REQUESTED, toastEvent);
    }

    public requestClaimKillMilestone(milestoneId: string, chosenItemId: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'claimKillMilestoneRequest',
                value: { milestoneId, chosenItemId },
            },
        }).finish();
        this.sendPacket(command);
    }

    public requestBeginnerPathEnroll(): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'beginnerPathEnrollRequest',
                value: {},
            },
        }).finish();
        this.sendPacket(command);
    }

    public requestBeginnerPathAbandon(): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'beginnerPathAbandonRequest',
                value: {},
            },
        }).finish();
        this.sendPacket(command);
    }

    public requestBeginnerPathTalk(catalogNpcId: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'beginnerPathTalkRequest',
                value: { catalogNpcId },
            },
        }).finish();
        this.sendPacket(command);
    }

    public requestBeginnerPathUiAction(actionId: string): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'beginnerPathUiActionRequest',
                value: { actionId },
            },
        }).finish();
        this.sendPacket(command);
    }

    public requestCreateParty(): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'createPartyRequest',
                value: {},
            },
        }).finish();
        this.sendPacket(command);
    }

    public requestJoinParty(partyCode: string): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'joinPartyRequest',
                value: { partyCode },
            },
        }).finish();
        this.sendPacket(command);
    }

    public requestLeaveParty(): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'leavePartyRequest',
                value: {},
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Training Arena: ask the server to spawn chase dummies for a preset (world `training` only). */
    public requestApplyTrainingPreset(presetId: string): void {
        if (!this.currentGameWorldId) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'applyTrainingPresetRequest',
                value: {
                    presetId,
                    gameWorldId: this.currentGameWorldId,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Timed Challenges Mode 1: start Skills protocol run (10 chase runners). */
    public requestStartTimedChallenge(mode = 1): void {
        if (!this.currentGameWorldId) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'startTimedChallengeRequest',
                value: {
                    gameWorldId: this.currentGameWorldId,
                    mode,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Abort the active timed challenge without rewards. */
    public requestAbortTimedChallenge(): void {
        if (!this.currentGameWorldId) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'abortTimedChallengeRequest',
                value: {
                    gameWorldId: this.currentGameWorldId,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Fetch today's timed challenge leaderboard for a mode. */
    public requestTimedChallengeLeaderboard(mode = 1): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'getTimedChallengeLeaderboardRequest',
                value: { mode },
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Browse active auction board listings + debt snapshot. */
    public sendAuctionBoardBrowseRequest(): void {
        if (!this.currentGameWorldId) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'auctionBoardBrowseRequest',
                value: { gameWorldId: this.currentGameWorldId },
            },
        }).finish();
        this.sendPacket(command, false, 'normal', 'auctionBoardBrowseRequest');
    }

    /** Create a timed auction or limit sell (item escrowed from bag). */
    public sendAuctionBoardCreateRequest(args: {
        itemUid: string;
        mode: AuctionListingMode;
        listPriceGold: number;
        minBidGold: number;
        durationHours: number;
        access: AuctionAccessRules;
    }): void {
        if (!this.currentGameWorldId) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'auctionBoardCreateRequest',
                value: {
                    gameWorldId: this.currentGameWorldId,
                    itemUid: BigInt(args.itemUid),
                    mode: args.mode,
                    listPriceGold: args.listPriceGold,
                    minBidGold: args.minBidGold,
                    durationHours: args.durationHours,
                    access: args.access,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendAuctionBoardBidRequest(listingId: string, bidGold: number): void {
        if (!this.currentGameWorldId) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'auctionBoardBidRequest',
                value: {
                    gameWorldId: this.currentGameWorldId,
                    listingId,
                    bidGold,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendAuctionBoardBuyRequest(listingId: string): void {
        if (!this.currentGameWorldId) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'auctionBoardBuyRequest',
                value: {
                    gameWorldId: this.currentGameWorldId,
                    listingId,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendAuctionBoardCancelRequest(listingId: string): void {
        if (!this.currentGameWorldId) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'auctionBoardCancelRequest',
                value: {
                    gameWorldId: this.currentGameWorldId,
                    listingId,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendAuctionBoardSettleDebtRequest(): void {
        if (!this.currentGameWorldId) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'auctionBoardSettleDebtRequest',
                value: { gameWorldId: this.currentGameWorldId },
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Play-mine: request pending $HELL + today's credits (SysMenu). */
    public sendHellMiningStatusRequest(): void {
        if (!this.currentGameWorldId) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'hellMiningStatusRequest',
                value: { gameWorldId: this.currentGameWorldId },
            },
        }).finish();
        this.sendPacket(command, false, 'normal', 'hellMiningStatusRequest');
    }

    /**
     * Play-mine: reserve pending for SPL claim when mint is configured.
     * amount 0 = all pending. Without mint, server keeps pending and explains.
     */
    public sendHellMiningClaimRequest(amount = 0): void {
        if (!this.currentGameWorldId) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'hellMiningClaimRequest',
                value: { gameWorldId: this.currentGameWorldId, amount },
            },
        }).finish();
        this.sendPacket(command);
    }

    /** GM ops: fetch current anti-bot / AFK / tournament-AI tool flags. */
    public requestGetAntiBotTools(): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'getAntiBotToolsRequest',
                value: {},
            },
        }).finish();
        this.sendPacket(command);
    }

    /** GM ops: replace all anti-bot tool flags (server persists + rejects travelers). */
    public requestSetAntiBotTools(flags: AntiBotToolsFlags): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'setAntiBotToolsRequest',
                value: {
                    flags: {
                        guildPriorityIngress: flags.guildPriorityIngress,
                        newPlayerSegment: flags.newPlayerSegment,
                        claimTimeSybilGate: flags.claimTimeSybilGate,
                        industrialMultiBoxLimits: flags.industrialMultiBoxLimits,
                        afkOnMapAllowed: flags.afkOnMapAllowed,
                        tournamentInhumanPlayTelemetry: flags.tournamentInhumanPlayTelemetry,
                        tournamentHighStakesMode: flags.tournamentHighStakesMode,
                        softOfflineProgression: flags.softOfflineProgression,
                    },
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    public requestRebirth(): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'rebirthRequest',
                value: {},
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Undo last rebirth (restore pre-rebirth L max + stats/maj snapshot). */
    public requestRebirthRollback(): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'rebirthRollbackRequest',
                value: {},
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Chain Lords Block Level: freeze level and convert kill exp to majestics. */
    public requestSetLevelBlock(blocked: boolean): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'setLevelBlockRequest',
                value: { blocked },
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Olympia majestic / gizon upgrade for Angelic pendants and Dark Knight weapons. */
    public requestMajesticUpgrade(itemUid: string | number | bigint): void {
        const uid = typeof itemUid === 'bigint' ? itemUid : BigInt(itemUid);
        const command = ClientMessage.encode({
            payload: {
                $case: 'majesticUpgradeRequest',
                value: {
                    itemUid: uid,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Xelima (weapons) / Merien (armor/shield) stone upgrade. Optional Integrity anti-burn past +7. */
    public requestStoneItemUpgrade(
        itemUid: string | number | bigint,
        useIntegrityStone = false,
    ): void {
        const uid = typeof itemUid === 'bigint' ? itemUid : BigInt(itemUid);
        const command = ClientMessage.encode({
            payload: {
                $case: 'stoneItemUpgradeRequest',
                value: {
                    itemUid: uid,
                    useIntegrityStone,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Olympia: break magic item into shards/fragments. */
    public requestItemDisenchant(itemUid: string | number | bigint): void {
        const uid = typeof itemUid === 'bigint' ? itemUid : BigInt(itemUid);
        const command = ClientMessage.encode({
            payload: { $case: 'itemDisenchantRequest', value: { itemUid: uid } },
        }).finish();
        this.sendPacket(command);
    }

    /** Olympia: apply shard (kind=0) or fragment (kind=1) to raise primary/secondary +1. */
    public requestItemEnchant(itemUid: string | number | bigint, kind: number): void {
        const uid = typeof itemUid === 'bigint' ? itemUid : BigInt(itemUid);
        const command = ClientMessage.encode({
            payload: { $case: 'itemEnchantRequest', value: { itemUid: uid, kind } },
        }).finish();
        this.sendPacket(command);
    }

    /** Merge 2 same-CIC same-stat-kind bag items → next CIC (result value = min). */
    public requestCicItemMerge(itemUidA: string | number | bigint, itemUidB: string | number | bigint): void {
        const a = typeof itemUidA === 'bigint' ? itemUidA : BigInt(itemUidA);
        const b = typeof itemUidB === 'bigint' ? itemUidB : BigInt(itemUidB);
        const command = ClientMessage.encode({
            payload: { $case: 'cicItemMergeRequest', value: { itemUidA: a, itemUidB: b } },
        }).finish();
        this.sendPacket(command);
    }

    /** Spend matching siphon shards to raise Mana/HP Siphon gem level +1. */
    public requestSiphonGemUpgrade(itemUid: string | number | bigint): void {
        const uid = typeof itemUid === 'bigint' ? itemUid : BigInt(itemUid);
        const command = ClientMessage.encode({
            payload: { $case: 'siphonGemUpgradeRequest', value: { itemUid: uid } },
        }).finish();
        this.sendPacket(command);
    }

    /** Olympia: combine N materials of level L into 1 of L+1. */
    public requestEnchantMaterialUpgrade(kind: number, type: number, level: number, mode: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'enchantMaterialUpgradeRequest',
                value: { kind, type, level, mode },
            },
        }).finish();
        this.sendPacket(command);
    }

    public requestEnchantMaterialsState(): void {
        const command = ClientMessage.encode({
            payload: { $case: 'getEnchantMaterialsRequest', value: {} },
        }).finish();
        this.sendPacket(command);
    }

    /** Olympia talent respec: free 3 stat points for 1 majestic (then Level Set). */
    public requestMajesticStatRespec(statA: number, statB: number, statC: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'majesticStatRespecRequest',
                value: { statA, statB, statC },
            },
        }).finish();
        this.sendPacket(command);
    }

    private handleEnchantResult(data: {
        success: boolean;
        message: string;
        itemUid: bigint;
        itemId: number;
        itemAttribute: number;
    }): void {
        EventBus.emit(ENCHANT_RESULT_RECEIVED, data);
        EventBus.emit(TOAST_REQUESTED, {
            message: data.message || (data.success ? 'Enchant OK' : 'Enchant failed'),
            severity: data.success ? 'success' : 'error',
            autoClose: 2500,
        });
    }

    private handleCicItemMergeResult(data: {
        success: boolean;
        message: string;
        itemUid: bigint;
        itemId: number;
        cicLevel: number;
        cicStatKind: number;
        cicStatValue: number;
    }): void {
        EventBus.emit(CIC_ITEM_MERGE_RESULT_RECEIVED, data);
        EventBus.emit(TOAST_REQUESTED, {
            message: data.message || (data.success ? 'CIC merge OK' : 'CIC merge failed'),
            severity: data.success ? 'success' : 'error',
            autoClose: 2800,
        });
    }

    private handleSiphonGemUpgradeResult(data: {
        success: boolean;
        message: string;
        itemUid: bigint;
        itemId: number;
        siphonLevel: number;
    }): void {
        EventBus.emit(SIPHON_GEM_UPGRADE_RESULT_RECEIVED, data);
        EventBus.emit(TOAST_REQUESTED, {
            message: data.message || (data.success ? 'Siphon upgrade OK' : 'Siphon upgrade failed'),
            severity: data.success ? 'success' : 'error',
            autoClose: 2800,
        });
    }

    /**
     * Olympia special ability lifecycle.
     * status: 1=activated, 2=set, 3=expired, 4=released, 5=ready
     */
    private handleSpecialAbilityStatus(data: {
        status: number;
        abilityType: number;
        durationOrCooldownSec: number;
        playerId: bigint;
    }): void {
        const typeName = describeSpecialAbilityType(data.abilityType);
        let message = '';
        let severity: 'info' | 'success' | 'warning' | 'error' = 'info';
        switch (data.status) {
            case 1:
                message = `Special ability activated! ${typeName} (${data.durationOrCooldownSec}s)`;
                severity = 'success';
                break;
            case 2:
                message =
                    data.durationOrCooldownSec > 0
                        ? `Special ability set: ${typeName} (ready in ${formatSaCooldown(data.durationOrCooldownSec)})`
                        : `Special ability set: ${typeName} — press Page Up to activate`;
                severity = 'info';
                break;
            case 3:
                message =
                    data.durationOrCooldownSec > 0
                        ? `Special ability ended. Ready in ${formatSaCooldown(data.durationOrCooldownSec)}`
                        : 'Special ability ended.';
                severity = 'warning';
                break;
            case 4:
                message = 'Special ability released.';
                severity = 'info';
                break;
            case 5:
                message = `Special ability ready! (${typeName || 'equipped'}) Press Page Up.`;
                severity = 'success';
                break;
            default:
                return;
        }
        EventBus.emit(TOAST_REQUESTED, {
            message,
            severity,
            autoClose: data.status === 1 ? 3500 : 2800,
        });
    }

    private handleMajesticStatRespecResult(data: {
        success: boolean;
        message: string;
        str: number;
        vit: number;
        dex: number;
        intel: number;
        mag: number;
        chr: number;
        majesticPoints: number;
        luPoints: number;
        talentsSummary: string;
    }): void {
        EventBus.emit(MAJESTIC_STAT_RESPEC_RESULT_RECEIVED, data);
        if (data.success) {
            setCharacterStats({
                str: data.str,
                vit: data.vit,
                dex: data.dex,
                int: data.intel,
                mag: data.mag,
                chr: data.chr,
                majestics: data.majesticPoints,
                talents: data.talentsSummary,
            });
            setLevelUpPointsLeft(data.luPoints);
        }
        EventBus.emit(TOAST_REQUESTED, {
            message: data.message || (data.success ? 'Talents respec OK' : 'Respec failed'),
            severity: data.success ? 'success' : 'error',
            autoClose: 2500,
        });
    }

    /**
     * Soul Bind (1) / Guild Bind (2) / Unbind (3) seals.
     * Guild unbind requires guild master or captain on the server.
     */
    public requestItemBind(itemUid: string | number | bigint, action: 1 | 2 | 3): void {
        const uid = typeof itemUid === 'bigint' ? itemUid : BigInt(itemUid);
        const command = ClientMessage.encode({
            payload: {
                $case: 'itemBindRequest',
                value: {
                    itemUid: uid,
                    action,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    private handleItemBindResult(data: ItemBindResult): void {
        const msg = data.message?.trim() || (data.ok ? 'OK' : 'Bind failed');
        EventBus.emit(TOAST_REQUESTED, {
            message: msg,
            severity: data.ok ? 'success' : 'warning',
        } satisfies ToastRequestedEvent);
        // Inventory row is also refreshed via ItemAddedToBag / ItemEquipped from the server.
    }

    public requestBuyCashShopItem(opts: {
        npcId: string;
        skuId: string;
        quantity: number;
        currency: number;
        stablecoinMint?: string;
        paymentTxSignature?: string;
    }): void {
        const world = this.getCurrentGameWorldId() ?? '';
        const command = ClientMessage.encode({
            payload: {
                $case: 'buyCashShopItemRequest',
                value: {
                    gameWorldId: world,
                    npcId: BigInt(opts.npcId),
                    skuId: opts.skuId,
                    quantity: opts.quantity,
                    currency: opts.currency,
                    stablecoinMint: opts.stablecoinMint ?? '',
                    paymentTxSignature: opts.paymentTxSignature ?? '',
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    private handleBuyCashShopItemResult(data: BuyCashShopItemResult): void {
        const msg = data.message?.trim() || (data.ok ? 'Purchase OK' : 'Purchase failed');
        EventBus.emit(TOAST_REQUESTED, {
            message: msg,
            severity: data.ok ? 'success' : 'warning',
        } satisfies ToastRequestedEvent);
        setCashShopStatusMessage(msg);
    }

    public requestLevelUpSettings(deltas: {
        str: number;
        vit: number;
        dex: number;
        intel: number;
        mag: number;
        chr: number;
    }): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'levelUpSettingsRequest',
                value: {
                    str: deltas.str,
                    vit: deltas.vit,
                    dex: deltas.dex,
                    intel: deltas.intel,
                    mag: deltas.mag,
                    chr: deltas.chr,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    private handleMonsterTakeDamage(data: {
        monsterId: bigint;
        damage: number;
        attackType: number;
        stunlockDurationMs: number;
        hp: number;
        knockbackDurationMs?: number;
        destX?: number;
        destY?: number;
        knockbackFromX?: number;
        knockbackFromY?: number;
    }): void {
        EventBus.emit(MONSTER_TAKE_DAMAGE_RECEIVED, {
            monsterId: data.monsterId.toString(),
            damage: data.damage,
            attackType: data.attackType,
            stunlockDurationMs: data.stunlockDurationMs,
            hp: data.hp,
            knockbackDurationMs: data.knockbackDurationMs,
            destX: data.destX,
            destY: data.destY,
            knockbackFromX: data.knockbackFromX,
            knockbackFromY: data.knockbackFromY,
        } satisfies MonsterTakeDamageEventData);
    }

    private handleMonsterTakeDamageByMonster(data: MonsterTakeDamageByMonster): void {
        EventBus.emit(MONSTER_TAKE_DAMAGE_BY_MONSTER_RECEIVED, {
            targetMonsterId: data.targetMonsterId.toString(),
            damage: data.damage,
            attackerMonsterId: data.attackerMonsterId.toString(),
            attackType: data.attackType,
            stunlockDurationMs: data.stunlockDurationMs,
            hp: data.hp,
            knockbackDurationMs: data.knockbackDurationMs,
            destX: data.destX,
            destY: data.destY,
            knockbackFromX: data.knockbackFromX,
            knockbackFromY: data.knockbackFromY,
        } satisfies MonsterTakeDamageByMonsterEventData);
    }

    private markMonsterAsAttacking(monsterId: string): void {
        const existing = this.monstersInViewById.get(monsterId);
        if (!existing) {
            return;
        }

        this.monstersInViewById.set(monsterId, {
            ...existing,
            state: existing.dead ? existing.state : MonsterEntityState.MONSTER_ENTITY_STATE_ATTACK,
        });
    }

    private handleMonsterDied(data: MonsterDied): void {
        const monsterId = data.monsterId.toString();
        const existing = this.monstersInViewById.get(monsterId);
        if (existing) {
            this.monstersInViewById.set(monsterId, {
                ...existing,
                dead: true,
            });
        }
        EventBus.emit(MONSTER_DIED_RECEIVED, {
            monsterId,
        } satisfies MonsterDiedEventData);
    }

    private handlePlayerAttackedMonster(data: PlayerAttackedMonster): void {
        const eventData: PlayerAttackedMonsterEventData = {
            playerId: data.playerId.toString(),
            direction: data.direction,
            attackSpeedMs: data.attackSpeedMs,
            rangedAttack: data.rangedAttack,
            monsterId: data.monsterId.toString(),
            worldX: data.worldX,
            worldY: data.worldY,
            attackType: data.attackType,
        };
        EventBus.emit(PLAYER_ATTACKED_MONSTER_RECEIVED, eventData);
    }

    private handlePlayerAttackedPlayer(data: PlayerAttackedPlayer): void {
        EventBus.emit(PLAYER_ATTACKED_PLAYER_RECEIVED, {
            playerId: data.playerId.toString(),
            direction: data.direction,
            attackSpeedMs: data.attackSpeedMs,
            rangedAttack: data.rangedAttack,
            targetPlayerId: data.targetPlayerId.toString(),
            worldX: data.worldX,
            worldY: data.worldY,
            attackType: data.attackType,
        } satisfies PlayerAttackedPlayerEventData);
    }

    public sendPlayerAttackedMonster(monsterId: string, rangedAttack: boolean, attackType: number): void {
        const id = BigInt(monsterId);
        if (id === 0n) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'playerAttackedMonsterRequest',
                value: { monsterId: id, rangedAttack, attackType },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendPlayerAttackedPlayer(targetPlayerId: string, rangedAttack: boolean, attackType: number): void {
        const id = BigInt(targetPlayerId);
        if (id === 0n) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'playerAttackedPlayerRequest',
                value: { targetPlayerId: id, rangedAttack, attackType },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendPlayerPickupRequested(direction: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'playerPickupRequested',
                value: { direction },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendPlayerItemDropRequested(itemUid: string): void {
        const id = BigInt(itemUid);
        if (id === 0n) {
            return;
        }

        const command = ClientMessage.encode({
            payload: {
                $case: 'playerItemDropRequested',
                value: { itemUid: id },
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Requests ground-stack pickup on the player's cell; <paramref name="maxItems"/> is 1 normally or up to 9 with Ctrl. */
    public sendPlayerItemPickupRequested(maxItems: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'playerItemPickupRequested',
                value: { maxItems },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendPlayerBowStanceRequested(direction: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'playerBowStanceRequested',
                value: { direction },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendCreateItemRequest(itemId: number, effectOverrides?: Effect[]): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'createItemRequest',
                value: {
                    itemId,
                    effectOverrides: (effectOverrides ?? []).map((effectOverride) => ({
                        effect: effectToProtoIndex(effectOverride.effect),
                        effectColor: effectOverride.effectColor,
                    })),
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Buy a consumable from a nearby Shop Keeper (server validates proximity + catalog). */
    public sendBuyShopItemRequest(npcId: string, itemId: number, quantity = 1): void {
        if (!this.currentGameWorldId) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'buyShopItemRequest',
                value: {
                    gameWorldId: this.currentGameWorldId,
                    npcId: BigInt(npcId),
                    itemId,
                    quantity,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Ask Tom to repair a bag/equipped weapon by item uid. */
    public sendRepairItemRequest(npcId: string, itemUid: string): void {
        if (!this.currentGameWorldId) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'repairItemRequest',
                value: {
                    gameWorldId: this.currentGameWorldId,
                    npcId: BigInt(npcId),
                    itemUid: BigInt(itemUid),
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Quick-sell one bag item for gold (Item Drops tab; Olympia buy-back formula). */
    /**
     * Quick-sell one bag stack for gold (Olympia NPC buy-back formula on server).
     * @returns false when offline / no world (caller should toast).
     */
    public sendSellBagItemRequest(itemUid: string): boolean {
        if (!this.currentGameWorldId) {
            return false;
        }
        let uid: bigint;
        try {
            uid = BigInt(itemUid);
        } catch {
            console.warn('[NetworkManager] sendSellBagItemRequest: invalid itemUid', itemUid);
            return false;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'sellBagItemRequest',
                value: {
                    gameWorldId: this.currentGameWorldId,
                    itemUid: uid,
                },
            },
        }).finish();
        this.sendPacket(command);
        return true;
    }

    /** Open William warehouse snapshot (server validates proximity + catalog 4). */
    public sendOpenWarehouseRequest(npcId: string): void {
        if (!this.currentGameWorldId) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'openWarehouseRequest',
                value: {
                    gameWorldId: this.currentGameWorldId,
                    npcId: BigInt(npcId),
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Howard / Kennedy / Gail / Perry desk action (server validates proximity + catalog). */
    public sendCityNpcServiceRequest(npcId: string, action: string, donateGold?: number): void {
        if (!this.currentGameWorldId) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'cityNpcServiceRequest',
                value: {
                    gameWorldId: this.currentGameWorldId,
                    npcId: BigInt(npcId),
                    action,
                    ...(donateGold !== undefined ? { donateGold } : {}),
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Deposit one full bag stack into William warehouse. */
    public sendWarehouseDepositRequest(npcId: string, itemUid: string): void {
        if (!this.currentGameWorldId) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'warehouseDepositRequest',
                value: {
                    gameWorldId: this.currentGameWorldId,
                    npcId: BigInt(npcId),
                    itemUid: BigInt(itemUid),
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    /** Withdraw one warehouse stack into the bag. */
    public sendWarehouseWithdrawRequest(npcId: string, itemUid: string): void {
        if (!this.currentGameWorldId) {
            return;
        }
        const command = ClientMessage.encode({
            payload: {
                $case: 'warehouseWithdrawRequest',
                value: {
                    gameWorldId: this.currentGameWorldId,
                    npcId: BigInt(npcId),
                    itemUid: BigInt(itemUid),
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    private handleWarehouseState(state: {
        items: InventoryItemEntry[];
        maxSlots: number;
        message: string;
    }): void {
        applyWarehouseState({
            items: (state.items ?? []).map((item) => ({
                itemId: item.itemId,
                itemUid: String(item.itemUid),
                quantity: item.quantity ?? 1,
                name: getItemById(item.itemId)?.name ?? `Item ${item.itemId}`,
            })),
            maxSlots: state.maxSlots,
            message: state.message ?? '',
        });
    }

    public sendMoveItemInBagRequest(itemUid: string, bagX?: number, bagY?: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'moveItemInBagRequest',
                value: {
                    itemUid: BigInt(itemUid),
                    bagX,
                    bagY,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendEquipItemRequest(itemUid: string, targetSlot?: EquipmentSlot): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'equipItemRequest',
                value: {
                    itemUid: BigInt(itemUid),
                    targetSlot,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendUnequipItemRequest(slot: EquipmentSlot, itemUid: string, bagX?: number, bagY?: number): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'unequipItemRequest',
                value: {
                    slot,
                    itemUid: BigInt(itemUid),
                    bagX,
                    bagY,
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    public sendConsumeItemRequest(itemUid: string): void {
        const command = ClientMessage.encode({
            payload: {
                $case: 'consumeItemRequest',
                value: {
                    itemUid: BigInt(itemUid),
                },
            },
        }).finish();
        this.sendPacket(command);
    }

    private handlePlayerPickupPerformed(data: { playerId: bigint; direction: number; animationTimeMs: number }): void {
        EventBus.emit(PLAYER_PICKUP_PERFORMED_RECEIVED, {
            playerId: data.playerId.toString(),
            direction: data.direction,
            animationTimeMs: data.animationTimeMs,
        } satisfies PlayerPickupPerformedEventData);
    }

    private handlePlayerBowStancePerformed(data: { playerId: bigint; direction: number; animationTimeMs: number }): void {
        EventBus.emit(PLAYER_BOW_STANCE_PERFORMED_RECEIVED, {
            playerId: data.playerId.toString(),
            direction: data.direction,
            animationTimeMs: data.animationTimeMs,
        } satisfies PlayerBowStancePerformedEventData);
    }

    private handleSpellCastStarted(data: SpellCastStarted): void {
        EventBus.emit(SPELL_CAST_STARTED_RECEIVED, {
            playerId: data.playerId.toString(),
            spellName: data.spellName,
            castSpeedMs: data.castSpeedMs,
        } satisfies SpellCastStartedEventData);
    }

    private handleSpellCastCancelled(data: SpellCastCancelled): void {
        EventBus.emit(SPELL_CAST_CANCELLED_RECEIVED, {
            playerId: data.playerId.toString(),
        } satisfies SpellCastCancelledEventData);
    }

    private handleSpellCastFailed(_data: SpellCastFailed): void {
        EventBus.emit(SPELL_CAST_FAILED_RECEIVED);
    }

    private handleCastAoeSpell(data: CastAoeSpell): void {
        EventBus.emit(CAST_AOE_SPELL_RECEIVED, {
            playerId: data.playerId.toString(),
            spellId: data.spellId,
            x: data.x,
            y: data.y,
        } satisfies CastAoeSpellEventData);
    }

    private handleCastDirectionalAoeSpell(data: CastDirectionalAoeSpell): void {
        EventBus.emit(CAST_DIRECTIONAL_AOE_SPELL_RECEIVED, {
            playerId: data.playerId.toString(),
            spellId: data.spellId,
            casterX: data.casterX,
            casterY: data.casterY,
            targetX: data.targetX,
            targetY: data.targetY,
        } satisfies CastDirectionalAoeSpellEventData);
    }

    private handleMonsterCastAoeSpell(data: MonsterCastAoeSpell): void {
        EventBus.emit(MONSTER_CAST_AOE_SPELL_RECEIVED, {
            monsterId: data.monsterId.toString(),
            spellId: data.spellId,
            x: data.x,
            y: data.y,
        } satisfies MonsterCastAoeSpellEventData);
    }

    private handleMonsterCastDirectionalAoeSpell(data: MonsterCastDirectionalAoeSpell): void {
        EventBus.emit(MONSTER_CAST_DIRECTIONAL_AOE_SPELL_RECEIVED, {
            monsterId: data.monsterId.toString(),
            spellId: data.spellId,
            casterX: data.casterX,
            casterY: data.casterY,
            targetX: data.targetX,
            targetY: data.targetY,
        } satisfies MonsterCastDirectionalAoeSpellEventData);
    }

    private handlePlayerTeleported(data: PlayerTeleported): void {
        EventBus.emit(PLAYER_TELEPORTED_RECEIVED, { x: data.x, y: data.y });
    }

    private handleResetPosition(data: { x: number; y: number; gameWorldId: string; remainingStunlockMs: number }): void {
        if (!this.shouldAcceptWorldScopedPacket(data.gameWorldId, 'reset-position')) {
            return;
        }
        EventBus.emit(RESET_POSITION_RECEIVED, { x: data.x, y: data.y, remainingStunlockMs: data.remainingStunlockMs });
    }

    private handlePositionCorrected(data: { curX: number; curY: number; destX: number; destY: number; gameWorldId: string }): void {
        if (!this.shouldAcceptWorldScopedPacket(data.gameWorldId, 'position-corrected')) {
            return;
        }
        EventBus.emit(POSITION_CORRECTED_RECEIVED, { curX: data.curX, curY: data.curY, destX: data.destX, destY: data.destY });
    }

    private shouldAcceptWorldScopedPacket(packetWorldId: string, packetName: string): boolean {
        if (!packetWorldId || !this.currentGameWorldId) {
            return true;
        }
        if (packetWorldId === this.currentGameWorldId) {
            return true;
        }

        console.log(`[NetworkManager] Ignoring stale ${packetName} packet for world '${packetWorldId}' while active world is '${this.currentGameWorldId}'.`);
        return false;
    }

    private handlePlayersEnteredRange(data: PlayersEnteredRange): void {
        const batch: NetworkPlayer[] = [];
        const pendingMovesToEmit: Array<{ playerId: string; move: Omit<PlayerMovedEventData, 'attackMode'> }> = [];
        for (const p of data.players) {
            const movementSpeedMs = p.movementSpeedMs > 0 ? p.movementSpeedMs : 260;
            const runningMode = p.runningMode;
            const gender = appearanceGenderToClient(p.gender);
            const skinColor = appearanceSkinToClient(p.skinColor);
            const hairStyleIndex = Math.max(0, Math.min(7, p.hairStyleIndex));
            const underwearColorIndex = Math.max(0, Math.min(7, p.underwearColorIndex));
            const eventData: NetworkPlayer = {
                playerId: String(p.playerId),
                x: p.x,
                y: p.y,
                movementSpeedMs,
                attackSpeedMs: p.attackSpeedMs,
                castSpeedMs: p.castSpeedMs,
                runningMode,
                attackMode: p.attackMode,
                disconnected: false,
                dead: p.dead ?? false,
                spawnProtection: p.spawnProtection ?? false,
                direction: p.direction,
                visibleEquippedItems: visibleEquippedItemsFromEntries(p.visibleEquippedItems),
                gender,
                skinColor,
                hairStyleIndex,
                underwearColorIndex,
                characterName: p.characterName,
                activeTemporaryEffects: p.activeTemporaryEffects?.length ? [...p.activeTemporaryEffects] : [],
                citizenshipSide: p.citizenshipSide || 'traveler',
            };
            if (eventData.playerId === this.selfPlayerId) {
                continue;
            }

            const pendingMove = this.pendingPlayerMoveBeforeEnter.get(eventData.playerId);
            if (pendingMove) {
                this.pendingPlayerMoveBeforeEnter.delete(eventData.playerId);
                eventData.x = pendingMove.teleport ? pendingMove.destX : pendingMove.curX;
                eventData.y = pendingMove.teleport ? pendingMove.destY : pendingMove.curY;
                pendingMovesToEmit.push({ playerId: eventData.playerId, move: pendingMove });
            }

            this.otherPlayersById.set(eventData.playerId, eventData);
            batch.push(eventData);
        }
        if (batch.length === 0) {
            return;
        }
        EventBus.emit(PLAYER_JOINED_RECEIVED, batch);
        for (const { playerId, move } of pendingMovesToEmit) {
            const row = this.otherPlayersById.get(playerId);
            if (row) {
                const moveEvent: PlayerMovedEventData = {
                    ...move,
                    attackMode: row.attackMode,
                };
                EventBus.emit(PLAYER_MOVED_RECEIVED, moveEvent);
            }
        }
        console.log(`[NetworkManager] Players entered view radius: ${batch.map((b) => b.playerId).join(', ')}`);
    }

    private handlePlayerMoved(data: PlayerMoved): void {
        const movementSpeedMs = data.movementSpeedMs > 0 ? data.movementSpeedMs : 260;
        const runningMode = data.runningMode;
        const playerId = String(data.playerId);
        if (playerId === this.selfPlayerId) {
            return;
        }

        const existingMoved = this.otherPlayersById.get(playerId);
        if (!existingMoved) {
            this.pendingPlayerMoveBeforeEnter.set(playerId, {
                playerId,
                curX: data.curX,
                curY: data.curY,
                destX: data.destX,
                destY: data.destY,
                movementSpeedMs,
                runningMode,
                dashAttack: data.dashAttack,
                teleport: data.teleport,
            });
            return;
        }

        this.pendingPlayerMoveBeforeEnter.delete(playerId);
        const attackMode = existingMoved.attackMode;
        const eventData: PlayerMovedEventData = {
            playerId,
            curX: data.curX,
            curY: data.curY,
            destX: data.destX,
            destY: data.destY,
            movementSpeedMs,
            runningMode,
            attackMode,
            dashAttack: data.dashAttack,
            teleport: data.teleport,
        };

        this.otherPlayersById.set(eventData.playerId, {
            playerId: eventData.playerId,
            x: eventData.destX,
            y: eventData.destY,
            movementSpeedMs,
            attackSpeedMs: existingMoved.attackSpeedMs,
            castSpeedMs: existingMoved.castSpeedMs,
            runningMode,
            attackMode,
            disconnected: existingMoved.disconnected ?? false,
            dead: existingMoved.dead ?? false,
            direction: existingMoved.direction ?? Direction.NorthEast,
            spawnProtection: existingMoved.spawnProtection ?? false,
            visibleEquippedItems: existingMoved.visibleEquippedItems ?? {},
            gender: existingMoved.gender ?? Gender.MALE,
            skinColor: existingMoved.skinColor ?? SkinColor.Light,
            hairStyleIndex: existingMoved.hairStyleIndex ?? 0,
            underwearColorIndex: existingMoved.underwearColorIndex ?? 0,
            characterName: existingMoved.characterName ?? '',
            activeTemporaryEffects: existingMoved.activeTemporaryEffects ?? [],
            citizenshipSide: existingMoved.citizenshipSide ?? 'traveler',
        });
        EventBus.emit(PLAYER_MOVED_RECEIVED, eventData);
    }

    private handlePlayersLeftRange(data: PlayersLeftRange): void {
        const ids = data.playerIds.map((id) => id.toString());
        if (ids.length === 0) {
            return;
        }
        for (const id of ids) {
            this.otherPlayersById.delete(id);
            this.pendingPlayerMoveBeforeEnter.delete(id);
        }
        EventBus.emit(PLAYER_LEFT_RECEIVED, ids);
        console.log(`[NetworkManager] Players left view radius: ${ids.join(', ')}`);
    }

    private handleSendMessage(data: { message: string }): void {
        EventBus.emit(SERVER_MESSAGE_RECEIVED, { message: data.message });
    }

    private handleChatMessageReceived(data: ChatMessageReceived): void {
        const sourceLanguageTag = data.sourceLanguageTag?.trim();
        const whisperTarget = data.whisperTargetCharacterName?.trim();
        EventBus.emit(CHAT_MESSAGE_RECEIVED, {
            senderCharacterName: data.senderCharacterName,
            timestampMs: Number(data.timestampMs),
            message: data.message,
            ...(sourceLanguageTag ? { sourceLanguageTag } : {}),
            channel: data.channel,
            ...(whisperTarget ? { whisperTargetCharacterName: whisperTarget } : {}),
        });
    }

    private handleWeatherChanged(data: WeatherChanged): void {
        const mode = weatherModeFromProto(data.weather);
        if (mode === undefined) {
            console.warn('[NetworkManager] weather_changed has unrecognized weather', data.weather);
            return;
        }
        EventBus.emit(OUT_WEATHER_SYNCED, mode);
    }

    private handlePlayerParalyzed(data: { durationSeconds: number }): void {
        EventBus.emit(PLAYER_PARALYZED_RECEIVED, { durationSeconds: data.durationSeconds });
    }

    /** Server cleared pending logout (e.g. combat damage); do not send LogoutCancelledRequest. */
    private handleLogoutCancelled(): void {
        this.clearLogoutCountdown();
        this.logoutPending = false;
        const toastEvent: ToastRequestedEvent = {
            message: 'Logout cancelled — you took damage.',
            severity: 'error',
        };
        EventBus.emit(TOAST_REQUESTED, toastEvent);
    }

    private handleLogoutResponse(data: { wait: number }): void {
        const waitSeconds = data.wait;
        if (waitSeconds > 0) {
            const toastEvent: ToastRequestedEvent = {
                message: `Logging out in ${waitSeconds} seconds.`,
                severity: 'info',
                autoClose: waitSeconds * 1000,
                trackForLogoutDismiss: true,
            };
            EventBus.emit(TOAST_REQUESTED, toastEvent);
            let remaining = waitSeconds;
            setLogoutSecondsRemaining(remaining);
            this.logoutIntervalId = setInterval(() => {
                runSafeSync('NetworkManager:logoutCountdown', () => {
                    remaining -= 1;
                    setLogoutSecondsRemaining(remaining > 0 ? remaining : undefined);
                    if (remaining <= 0) {
                        this.clearLogoutCountdown();
                        this.logoutPending = false;
                        this.disconnect();
                    }
                });
            }, 1000);
        } else {
            this.disconnect();
        }
    }

    private handlePlayerMovementStateChanged(data: PlayerMovementStateChanged): void {
        const eventData: PlayerMovementStateChangedEventData = {
            playerId: String(data.playerId),
            runningMode: data.runningMode,
            movementSpeedMs: data.movementSpeedMs > 0 ? data.movementSpeedMs : 260,
        };

        const existing = this.otherPlayersById.get(eventData.playerId);
        if (existing) {
            this.otherPlayersById.set(eventData.playerId, {
                ...existing,
                movementSpeedMs: eventData.movementSpeedMs,
                runningMode: eventData.runningMode,
            });
        }
        EventBus.emit(PLAYER_MOVEMENT_STATE_CHANGED_RECEIVED, eventData);
    }

    private handlePlayerAttackModeChanged(data: PlayerAttackModeChanged): void {
        const eventData: PlayerAttackModeChangedEventData = {
            playerId: String(data.playerId),
            attackMode: data.attackMode,
        };
        if (eventData.playerId === this.selfPlayerId) {
            return;
        }

        const existing = this.otherPlayersById.get(eventData.playerId);
        if (existing) {
            this.otherPlayersById.set(eventData.playerId, {
                ...existing,
                attackMode: eventData.attackMode,
            });
        }
        EventBus.emit(PLAYER_ATTACK_MODE_CHANGED_RECEIVED, eventData);
    }

    private handlePlayerSafeAttackModeChanged(data: PlayerSafeAttackModeChanged): void {
        EventBus.emit(OUT_UI_SET_SAFE_ATTACK_MODE, data.safeAttackMode);
    }

    private handlePlayerIdleDirectionChanged(data: PlayerIdleDirectionChanged): void {
        const eventData: PlayerIdleDirectionChangedEventData = {
            playerId: String(data.playerId),
            direction: data.direction,
        };
        if (eventData.playerId === this.selfPlayerId) {
            return;
        }

        const existing = this.otherPlayersById.get(eventData.playerId);
        if (existing) {
            this.otherPlayersById.set(eventData.playerId, {
                ...existing,
                direction: eventData.direction,
            });
        }
        EventBus.emit(PLAYER_IDLE_DIRECTION_CHANGED_RECEIVED, eventData);
    }

    private handlePlayerAppearanceChanged(data: PlayerAppearanceChanged): void {
        const eventData: PlayerAppearanceChangedEventData = {
            playerId: String(data.playerId),
            gender: appearanceGenderToClient(data.gender),
            skinColor: appearanceSkinToClient(data.skinColor),
            hairStyleIndex: Math.max(0, Math.min(7, data.hairStyleIndex)),
            underwearColorIndex: Math.max(0, Math.min(7, data.underwearColorIndex)),
        };
        if (eventData.playerId === this.selfPlayerId) {
            return;
        }

        const existing = this.otherPlayersById.get(eventData.playerId);
        if (existing) {
            this.otherPlayersById.set(eventData.playerId, {
                ...existing,
                gender: eventData.gender,
                skinColor: eventData.skinColor,
                hairStyleIndex: eventData.hairStyleIndex,
                underwearColorIndex: eventData.underwearColorIndex,
            });
        }
        EventBus.emit(PLAYER_APPEARANCE_CHANGED_RECEIVED, eventData);
    }

    private handlePlayerDisconnected(data: PlayerDisconnected): void {
        const eventData: PlayerConnectionStateChangedEventData = {
            playerId: String(data.playerId),
        };
        if (eventData.playerId === this.selfPlayerId) {
            return;
        }

        const existing = this.otherPlayersById.get(eventData.playerId);
        if (!existing) {
            return;
        }

        this.otherPlayersById.set(eventData.playerId, { ...existing, disconnected: true });
        EventBus.emit(PLAYER_DISCONNECTED_RECEIVED, eventData);
    }

    private handlePlayerReconnected(data: PlayerReconnected): void {
        const eventData: PlayerConnectionStateChangedEventData = {
            playerId: String(data.playerId),
        };
        if (eventData.playerId === this.selfPlayerId) {
            return;
        }

        const existing = this.otherPlayersById.get(eventData.playerId);
        if (!existing) {
            return;
        }

        this.otherPlayersById.set(eventData.playerId, { ...existing, disconnected: false });
        EventBus.emit(PLAYER_RECONNECTED_RECEIVED, eventData);
    }

    private handleSpawnProtectionEnabled(data: { playerId: bigint }): void {
        const playerIdStr = String(data.playerId);
        if (playerIdStr === this.selfPlayerId) {
            this.pendingSpawnProtectionForSelf = true;
        }
        EventBus.emit(PLAYER_SPAWN_PROTECTION_ENABLED_RECEIVED, { playerId: playerIdStr });
    }

    private handleSpawnProtectionDisabled(data: { playerId: bigint }): void {
        const playerIdStr = String(data.playerId);
        if (playerIdStr === this.selfPlayerId) {
            this.pendingSpawnProtectionForSelf = false;
        }
        EventBus.emit(PLAYER_SPAWN_PROTECTION_DISABLED_RECEIVED, { playerId: playerIdStr });
    }

    /** Returns and clears pending spawn protection for self. Used when creating player in case event arrived before listeners were ready. */
    public getAndClearPendingSpawnProtectionForSelf(): boolean {
        const had = this.pendingSpawnProtectionForSelf;
        if (had) {
            this.pendingSpawnProtectionForSelf = false;
        }
        return had;
    }

    private handleTemporaryEffectApplied(data: TemporaryEffectApplied): void {
        const temporaryEffectType = data.temporaryEffectType as number;
        const entityId = data.entityId.toString();
        if (data.entityKind === TemporaryEffectEntityKind.TEMPORARY_EFFECT_ENTITY_KIND_PLAYER) {
            if (entityId === this.selfPlayerId) {
                this.selfTemporaryEffects.add(temporaryEffectType);
            } else {
                const existing = this.otherPlayersById.get(entityId);
                if (existing) {
                    const next = new Set(existing.activeTemporaryEffects ?? []);
                    next.add(temporaryEffectType);
                    this.otherPlayersById.set(entityId, {
                        ...existing,
                        activeTemporaryEffects: Array.from(next),
                        movementSpeedMs: data.movementSpeedMs ?? existing.movementSpeedMs,
                        attackSpeedMs: data.attackSpeedMs ?? existing.attackSpeedMs,
                        castSpeedMs: data.castSpeedMs ?? existing.castSpeedMs,
                    });
                }
            }
            EventBus.emit(TEMPORARY_EFFECT_APPLIED_FOR_PLAYER_RECEIVED, {
                playerId: entityId,
                temporaryEffectType,
                movementSpeedMs: data.movementSpeedMs,
                attackSpeedMs: data.attackSpeedMs,
                castSpeedMs: data.castSpeedMs,
            });
        } else {
            const existing = this.monstersInViewById.get(entityId);
            if (existing) {
                const next = new Set(existing.activeTemporaryEffects ?? []);
                next.add(temporaryEffectType);
                this.monstersInViewById.set(entityId, {
                    ...existing,
                    activeTemporaryEffects: Array.from(next),
                    movementSpeedMs: data.movementSpeedMs ?? existing.movementSpeedMs,
                    attackSpeedMs: data.attackSpeedMs ?? existing.attackSpeedMs,
                });
            }
            EventBus.emit(TEMPORARY_EFFECT_APPLIED_FOR_MONSTER_RECEIVED, {
                monsterId: entityId,
                temporaryEffectType,
                movementSpeedMs: data.movementSpeedMs,
                attackSpeedMs: data.attackSpeedMs,
            });
        }
    }

    private handleTemporaryEffectExpired(data: TemporaryEffectExpired): void {
        const temporaryEffectType = data.temporaryEffectType as number;
        const entityId = data.entityId.toString();
        if (data.entityKind === TemporaryEffectEntityKind.TEMPORARY_EFFECT_ENTITY_KIND_PLAYER) {
            if (entityId === this.selfPlayerId) {
                this.selfTemporaryEffects.delete(temporaryEffectType);
            } else {
                const existing = this.otherPlayersById.get(entityId);
                if (existing) {
                    const next = new Set(existing.activeTemporaryEffects ?? []);
                    next.delete(temporaryEffectType);
                    this.otherPlayersById.set(entityId, {
                        ...existing,
                        activeTemporaryEffects: Array.from(next),
                        movementSpeedMs: data.movementSpeedMs ?? existing.movementSpeedMs,
                        attackSpeedMs: data.attackSpeedMs ?? existing.attackSpeedMs,
                        castSpeedMs: data.castSpeedMs ?? existing.castSpeedMs,
                    });
                }
            }
            EventBus.emit(TEMPORARY_EFFECT_EXPIRED_FOR_PLAYER_RECEIVED, {
                playerId: entityId,
                temporaryEffectType,
                movementSpeedMs: data.movementSpeedMs,
                attackSpeedMs: data.attackSpeedMs,
                castSpeedMs: data.castSpeedMs,
            });
        } else {
            const existing = this.monstersInViewById.get(entityId);
            if (existing) {
                const next = new Set(existing.activeTemporaryEffects ?? []);
                next.delete(temporaryEffectType);
                this.monstersInViewById.set(entityId, {
                    ...existing,
                    activeTemporaryEffects: Array.from(next),
                    movementSpeedMs: data.movementSpeedMs ?? existing.movementSpeedMs,
                    attackSpeedMs: data.attackSpeedMs ?? existing.attackSpeedMs,
                });
            }
            EventBus.emit(TEMPORARY_EFFECT_EXPIRED_FOR_MONSTER_RECEIVED, {
                monsterId: entityId,
                temporaryEffectType,
                movementSpeedMs: data.movementSpeedMs,
                attackSpeedMs: data.attackSpeedMs,
            });
        }
    }

    private handleCastEffect(data: CastEffect): void {
        if (!this.shouldAcceptWorldScopedPacket(data.gameWorldId, 'cast-effect')) {
            return;
        }
        EventBus.emit(CAST_EFFECT_RECEIVED, {
            effectKey: data.effectKey,
            x: data.x,
            y: data.y,
        });
    }
}

function describeSpecialAbilityType(type: number): string {
    switch (type) {
        case 1:
            return 'Xelima (half HP)';
        case 2:
            return 'Ice Elemental (freeze)';
        case 3:
            return 'Paralyze strike';
        case 4:
            return 'Execute';
        case 5:
            return 'Lifesteal';
        case 50:
            return 'Merien Plate (break weapon)';
        case 51:
            return 'Body guard';
        case 52:
            return 'Merien Shield (untouchable)';
        default:
            return type > 0 ? `type ${type}` : '';
    }
}

function formatSaCooldown(sec: number): string {
    if (sec >= 60) {
        return `${Math.ceil(sec / 60)} min`;
    }
    return `${sec}s`;
}
