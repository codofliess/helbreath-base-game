import { Scene } from 'phaser';
import { GameAsset } from '../objects/GameAsset';
import { GroundItem } from '../objects/GroundItem';
import { DEFAULT_GEAR } from '../../utils/PlayerAppearanceManager';
import { Player } from '../objects/Player';
import { Monster } from '../objects/Monster';
import { ArrowProjectile, isProjectileTarget } from '../effects/ArrowProjectile';
import { NPC } from '../objects/NPC';
import { HBMap, TILE_SIZE } from '../assets/HBMap';
import { FireInstance } from '../spells/FireInstance';
import { PoisonCloudInstance } from '../spells/PoisonCloudInstance';
import { SpikeFieldInstance } from '../spells/SpikeFieldInstance';
import { createSpikeField } from '../spells/SpikeField';
import { IceStorm } from '../spells/IceStorm';
import { EventBus } from '../EventBus';
import { canvasToScreenPosition, convertWorldPosToPixelPos, convertPixelPosToWorldPos, getNextDirection, Direction, findApproachCellNearTarget, findMovableLocation, getDistance, isCellMovable, toDirection, worldCellCenterPixelX, worldCellCenterPixelY } from '../../utils/CoordinateUtils';
import { resolveSafePlayerSpawn } from '../../../../../sp-client/src/utils/CoordinateUtils';
import { normalizeMapId } from '../../../../../sp-client/src/constants/MapTeleportLocs';
import {
    DEPTH_MULTIPLIER,
    GAME_STATS_UPDATE_INTERVAL_MS,
    HIGH_DEPTH,
    LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND,
    MONSTER_HOVER_OVERLAY_ANCHOR_OFFSET_Y,
    MONSTER_PLACEHOLDER_SPRITE,
    PLAYER_HOVER_OVERLAY_ANCHOR_OFFSET_Y,
} from '../../Config';
import { InputManager } from '../../utils/InputManager';
import { CameraManager } from '../../utils/CameraManager';
import {
    getMusicManager,
    getGameStateManager,
    getNetworkManager,
    getInventoryManager,
    getAndRemoveInitialGameWorldState,
    setDebugModeEnabled,
    setGroundItemDisplaySize,
    setInitialGameWorldState,
    setPlayerPosition,
    setSoundManager,
    takePendingPlayerItemAppearancePrefetch,
    getMapIfPresent,
} from '../../utils/RegistryUtils';
import type { InitialGameWorldState } from '../../utils/RegistryUtils';
import { cancelPlayerDialogPhaserNotificationDebouncers, playerDialogStore } from '../../ui/store/PlayerDialog.store';
import { characterDialogStore } from '../../ui/store/CharacterDialog.store';
import { MapManager } from '../../utils/MapManager';
import { prepareMapForGameWorld, shouldLoadMapAssetsOnDemand, toClientMapFileName } from '../../utils/MapAssets';
import { MapWarpSystem } from '../systems/MapWarpSystem';
import { loadPlayerItemAppearanceOnDemand } from '../../utils/ItemAssets';
import { SoundManager } from '../../utils/SoundManager';
import { getMonsterData } from '../../constants/Monsters';

import { getSpriteForCatalogNpcId } from '../../constants/NPCs';
import { extractMonsterMinimapThumbDataUrl } from '../../utils/SpriteUtils';
import {
    capturePaperDollBodyLayers,
    capturePaperDollFromLivePlayer,
    invalidatePaperDollCache,
} from '../../utils/paperDollCapture';
import {
    CURRENT_SCENE_READY,
    INITIAL_GAME_WORLD_STATE_RECEIVED,
    PLAYER_POSITION_CHANGED,
    PLAYER_ITEM_APPEARANCE_PREFETCH_REQUESTED,
    TILE_OCCUPANCY_REAPPLY_REQUESTED,
    MONSTER_ENTERED_RANGE_RECEIVED,
    MONSTER_ATTACKED_MONSTER_RECEIVED,
    MONSTER_ATTACKED_RECEIVED,
    MONSTER_DIED_RECEIVED,
    GROUND_STATES_ENTERED_RANGE_RECEIVED,
    GROUND_STATES_LEFT_RANGE_RECEIVED,
    MONSTER_MOVED_RECEIVED,
    MONSTERS_LEFT_RANGE_RECEIVED,
    PLAYER_JOINED_RECEIVED,
    PLAYER_LEFT_RECEIVED,
    PLAYER_MOVED_RECEIVED,
    PLAYER_ATTACKED_MONSTER_RECEIVED,
    PLAYER_ATTACKED_PLAYER_RECEIVED,
    PLAYER_PICKUP_PERFORMED_RECEIVED,
    PLAYER_BOW_STANCE_PERFORMED_RECEIVED,
    PLAYER_DISCONNECTED_RECEIVED,
    PLAYER_MOVEMENT_STATE_CHANGED_RECEIVED,
    PLAYER_ATTACK_MODE_CHANGED_RECEIVED,
    PLAYER_IDLE_DIRECTION_CHANGED_RECEIVED,
    PLAYER_APPEARANCE_CHANGED_RECEIVED,
    PLAYER_PARALYZED_RECEIVED,
    PLAYER_RECEIVE_DAMAGE_RECEIVED,
    PLAYER_TAKE_DAMAGE_RECEIVED,
    HP_UPDATED_RECEIVED,
    MONSTER_TAKE_DAMAGE_RECEIVED,
    MONSTER_TAKE_DAMAGE_BY_MONSTER_RECEIVED,
    PLAYER_RECONNECTED_RECEIVED,
    PLAYER_SPAWN_PROTECTION_ENABLED_RECEIVED,
    PLAYER_SPAWN_PROTECTION_DISABLED_RECEIVED,
    TEMPORARY_EFFECT_APPLIED_FOR_PLAYER_RECEIVED,
    TEMPORARY_EFFECT_EXPIRED_FOR_PLAYER_RECEIVED,
    TEMPORARY_EFFECT_APPLIED_FOR_MONSTER_RECEIVED,
    TEMPORARY_EFFECT_EXPIRED_FOR_MONSTER_RECEIVED,
    CAST_EFFECT_RECEIVED,
    TOAST_REQUESTED,
    REMOTE_PLAYER_ITEM_EQUIPPED_RECEIVED,
    REMOTE_PLAYER_ITEM_UNEQUIPPED_RECEIVED,
    SPELL_CAST_STARTED_RECEIVED,
    SPELL_CAST_CANCELLED_RECEIVED,
    SPELL_CAST_FAILED_RECEIVED,
    IN_UI_FORCE_CANCEL_CAST,
    IN_UI_SET_SUPER_ATTACK_ARMED,
    CAST_AOE_SPELL_RECEIVED,
    CAST_DIRECTIONAL_AOE_SPELL_RECEIVED,
    MONSTER_CAST_AOE_SPELL_RECEIVED,
    MONSTER_CAST_DIRECTIONAL_AOE_SPELL_RECEIVED,
    POSITION_CORRECTED_RECEIVED,
    RESET_POSITION_RECEIVED,
    PLAYER_TELEPORTED_RECEIVED,
    MONSTER_DEAD,
    IN_UI_REQUEST_PLAYER_LOGOUT,
    SOCKET_DISCONNECTED,
    IN_UI_PLAYER_RESURRECT,
    IN_UI_REQUEST_SERVER_RESURRECT,
    IN_UI_CLAIM_KILL_MILESTONE,
    IN_UI_BEGINNER_PATH_ENROLL,
    IN_UI_BEGINNER_PATH_ABANDON,
    IN_UI_BEGINNER_PATH_TALK,
    IN_UI_BEGINNER_PATH_UI_ACTION,
    IN_UI_CREATE_PARTY,
    IN_UI_JOIN_PARTY,
    IN_UI_LEAVE_PARTY,
    IN_UI_REQUEST_REBIRTH,
    IN_UI_REQUEST_REBIRTH_ROLLBACK,
    IN_UI_SET_LEVEL_BLOCK,
    IN_UI_MAJESTIC_UPGRADE,
    IN_UI_STONE_ITEM_UPGRADE,
    IN_UI_ITEM_DISENCHANT,
    IN_UI_ITEM_ENCHANT,
    IN_UI_ENCHANT_MATERIAL_UPGRADE,
    IN_UI_GET_ENCHANT_MATERIALS,
    IN_UI_CIC_ITEM_MERGE,
    IN_UI_SIPHON_GEM_UPGRADE,
    IN_UI_MAJESTIC_STAT_RESPEC,
    IN_UI_LEVEL_UP_SETTINGS,
    PLAYER_DIED_RECEIVED,
    ENEMY_KILL_AWARDED_RECEIVED,
    PLAYER_RESURRECTED_RECEIVED,
    IN_UI_CAST_SPELL,
    IN_UI_CHANGE_MOVEMENT_SPEED,
    IN_UI_CHANGE_ATTACK_SPEED,
    IN_UI_CHANGE_ATTACK_RANGE,
    IN_UI_CHANGE_STUN_DURATION,
    IN_UI_CHANGE_DAMAGE,
    IN_UI_CHANGE_ATTACK_TYPE,
    IN_UI_CHANGE_ALLOW_DASH_ATTACK,
    IN_UI_CHANGE_CAST_SPEED,
    IN_UI_CHANGE_ATTACK_MODE,
    IN_UI_CHANGE_SAFE_ATTACK_MODE,
    IN_UI_CHANGE_RUN_MODE,
    IN_UI_CHANGE_GENDER,
    IN_UI_CHANGE_SKIN_COLOR,
    IN_UI_CHANGE_UNDERWEAR_COLOR,
    IN_UI_CHANGE_HAIR_STYLE,
    IN_UI_PAPERDOLL_CAPTURE,
    IN_UI_CHANGE_MUSIC_VOLUME,
    IN_UI_CHANGE_SOUND_VOLUME,
    IN_UI_CHANGE_MUSIC_ENABLED,
    IN_UI_CHANGE_SOUND_ENABLED,
    IN_UI_MUTE_ALL_SOUNDS,
    IN_UI_UNMUTE_ALL_SOUNDS,
    IN_UI_CHANGE_DETAIL_LEVEL,
    IN_UI_GAME_VIEWPORT_RESIZED,
    IN_UI_CHANGE_MAP,
    IN_UI_TOGGLE_RENDER_MAP_TILES,
    IN_UI_TOGGLE_RENDER_MAP_OBJECTS,
    IN_UI_TOGGLE_DEBUG_MODE,
    IN_UI_TOGGLE_NON_MOVABLE_CELLS_HIGHLIGHT,
    IN_UI_TOGGLE_TELEPORT_CELLS_HIGHLIGHT,
    IN_UI_TOGGLE_SERVER_TELEPORT_CELLS_HIGHLIGHT,
    IN_UI_TOGGLE_WATER_CELLS_HIGHLIGHT,
    IN_UI_TOGGLE_FARMABLE_CELLS_HIGHLIGHT,
    IN_UI_TOGGLE_GRID_DISPLAY,
    IN_UI_GROUND_ITEM_DISPLAY_SIZE_CHANGED,
    IN_UI_CHANGE_WEATHER,
    IN_UI_RAIN_SOUNDS_CHANGED,
    IN_UI_PLAY_MUSIC,
    IN_UI_CHANGE_PLAY_MAP_MUSIC,
    IN_UI_SUMMON_MONSTER,
    IN_UI_SUMMON_NPC,
    IN_UI_KILL_ALL_NPCS,
    NPC_ENTERED_RANGE_RECEIVED,
    NPCS_LEFT_RANGE_RECEIVED,
    IN_UI_MAKE_SERVER_CELL_OCCUPIED_MODE,
    IN_UI_PLAYER_TELEPORT_REQUEST_MODE,
    IN_UI_CHANGE_GRACE_PERIOD,
    PLAYER_CAST_ANIMATION_STARTED,
    PLAYER_CONFIRM_SPELL_TARGET,
    NPC_DEAD,
    OUT_UI_GAME_STATS_UPDATE,
    OUT_UI_HOVER_ATTACKABLE_TARGET,
    OUT_UI_HOVER_GROUND_ITEM,
    OUT_UI_HOVER_GROUND_ITEM_INFO,

    OUT_UI_HOVER_MONSTER,
    OUT_UI_HOVER_NPC,
    OUT_UI_OPEN_SHOP,
    OUT_UI_OPEN_MAGIC_SHOP,
    OUT_UI_OPEN_CASH_SHOP,
    OUT_UI_OPEN_BLACKSMITH,
    OUT_UI_OPEN_WAREHOUSE,
    OUT_UI_OPEN_NPC_TALK,
    OUT_UI_HOVER_PLAYER,
    OUT_UI_SET_SELECTED_MUSIC,
    OUT_UI_SET_SELECTED_MAP,
    OUT_MAP_LOADED,
    OUT_SPRITE_FRAME_EXTRACTED,
    OUT_WEATHER_SYNCED,
    CHAT_MESSAGE_RECEIVED,
    IN_UI_TAKE_SCREENSHOT,
    type PlayerItemAppearancePrefetchEventData,
} from '../../constants/EventNames';
import { getOlympiaGameHour, getOlympiaNightStrength } from '../../utils/olympiaFormat';
import {
    chatChannelFromProto,
    chatChannelOverheadColor,
} from '../../constants/ChatChannels';
import { soundDialogStore } from '../../ui/store/SoundDialog.store';
import { sysMenuDialogStore } from '../../ui/store/SysMenuDialog.store';
import { captureManualScreenshot } from '../systems/EkScreenshotCapture';
import {
    AttackType,
    CastAoeSpellEventData,
    CastDirectionalAoeSpellEventData,
    CastSpellEvent,
    GameWorldInitData,
    Gender,
    GroundStateCellEventData,
    GroundStateCellRemovedEventData,
    InitialGameWorldStateEventData,
    ItemEquippedEventData,
    ItemUnequippedEventData,
    MonsterAllegiance,
    MonsterAttackedEventData,
    MonsterAttackedMonsterEventData,
    MonsterCastAoeSpellEventData,
    MonsterCastDirectionalAoeSpellEventData,
    MonsterDiedEventData,
    MonsterEnteredRangeEventData,
    MonsterHoverInfo,
    MonsterMovedEventData,
    MonsterTakeDamageByMonsterEventData,
    MonsterTakeDamageEventData,
    NetworkPlayer,
    NpcEnteredRangeEventData,
    NpcHoverInfo,
    PlayerAppearanceChangedEventData,
    PlayerAttackModeChangedEventData,
    PlayerAttackedMonsterEventData,
    PlayerAttackedPlayerEventData,
    PlayerBowStancePerformedEventData,
    PlayerConnectionStateChangedEventData,
    PlayerConfirmSpellTargetEvent,
    PlayerDiedEventData,
    EnemyKillAwardedEventData,
    PlayerHoverInfo,
    PlayerIdleDirectionChangedEventData,
    PlayerLeftEventData,
    PlayerMovedEventData,
    PlayerMovementStateChangedEventData,
    PlayerPickupPerformedEventData,
    PlayerReceiveDamageEventData,
    PlayerResurrectedEventData,
    PlayerTakeDamageEventData,
    SkinColor,
    SpellCastCancelledEventData,
    SpellCastStartedEventData,
    SummonMonsterEvent,
    SummonNPCEvent,
    TeleportLocSet,
    TeleportTarget,
    TemporaryEffectMonsterEventData,
    TemporaryEffectPlayerEventData,
    TemporaryEffectType,
} from '../../Types';
import { ItemTypes, type Effect } from '../../constants/Items';
import { CastManager } from '../../utils/CastManager';
import { OlympiaLocalCastManager } from '../../utils/OlympiaLocalCastManager';
import {
    confuseApplyToastMessage,
    confuseExpireToastMessage,
    illusionSpoofName,
} from '../../utils/confuseFeedback';
import { getOlympiaServerSpellId, isServerAuthoritativeOlympiaSpell } from '../../constants/OlympiaServerSpellMap';
import { WeatherManager } from '../../utils/WeatherManager';
import { setDeathDialogOpen } from '../../ui/store/DeathDialog.store';
import { scheduleEkScreenshot } from '../systems/EkScreenshotCapture';
import { mapDialogStore, syncWeather, type WeatherMode } from '../../ui/store/MapDialog.store';
import { serverDialogStore } from '../../ui/store/ServerDialog.store';
import { performLogoutCleanup } from '../../utils/LogoutUtils';
import { LoadingOverlayController } from '../../utils/LoadingOverlayController';
import {
    applyGameWorldCanvasPresentation,
    clearGameWorldCanvasPresentation,
} from '../ui/gameWorldCanvasPresentation';
import { forceClearLoginDeskCanvasPresentation } from '../ui/loginDeskPresentation';
import { FloatingText } from '../effects/FloatingText';
import { getNpcInteractionRole } from '../../constants/ShopCatalog';
import { FARM_BARRACKS_PRESETS } from '../../constants/TrainingPresets';
import { setTrainingDialogOpen, setTrainingPresetId } from '../../ui/store/TrainingDialog.store';
import { setCharacterDialogOpen, setCharacterSubPanel, setCharacterStats } from '../../ui/store/CharacterDialog.store';
import { buildPlayerHoverDisplay, resolvePlayerHoverFoe } from '../../utils/playerHoverName';
import {
    getGroundItemUnderPointer,
    getMonsterUnderWorldPixel,
    getMonsterUnderWorldPixelForHoverUi,
    getNpcUnderWorldPixelForHover,
    getOtherPlayerUnderWorldPixel,
    getPlayerUnderWorldPixelForHover,
    pointerWorldPixel,
} from '../../utils/PointerUtils';
import { getTeleportSourceCellsFromLocSets } from '../../utils/NetworkManager';
import { runSafeSync, subscribeSafe } from '../../utils/SafeEntry';
import { drawEffect, type DrawEffectOptions } from '../../utils/EffectUtils';
import { GroundEffectType, MonsterEntityState } from '../../proto/generated/network';
import {
    areMonsterAssetsLoaded,
    loadMonsterAssetsOnDemand,
    shouldLoadMonsterAssetsOnDemand,
} from '../../utils/MonsterAssets';

/**
 * Main game scene. Manages player, monsters, NPCs, ground items, map, camera, input,
 * spell casting, weather, and UI event handling. Loads map on init, spawns objects, and runs the game loop.
 */
export class GameWorld extends Scene {
    private updateInterval: number | undefined = undefined;
    /** Last known cursor position (document coords) - used for elementFromPoint when cursor is over DOM overlays */
    private lastCursorPosition: { x: number; y: number } | undefined = undefined;
    private cursorPositionCleanup: (() => void) | undefined = undefined;
    /** Player instance - cleaned up in shutdown() */
    private player: Player | undefined = undefined;
    /** Current player's network id, when provided by the server */
    private selfPlayerId: string | undefined = undefined;
    /** All spawned players keyed by network id */
    private playersById = new Map<string, Player>();
    /** List of monster instances - cleaned up in shutdown() */
    private monsters: Monster[] = [];
    /** List of NPC instances - cleaned up in shutdown() */
    private npcs: NPC[] = [];
    /** NPC the player is walking toward to talk to (cleared on interact / cancel). */
    private pendingNpcInteraction: NPC | undefined = undefined;
    /**
     * Ground-item cell the player is walking to; on arrival (same cell) fires pickup.
     * Fixes “stand exactly on the icon then click again” friction for non-gold loot.
     */
    private pendingGroundPickup: { worldX: number; worldY: number; maxItems: number } | undefined = undefined;
    /** Camera manager - handles follow, zoom, bounds, and UI-driven movement */
    private cameraManager: CameraManager | undefined = undefined;
    /** Reused for camera follow to avoid per-frame `{ x, y }` allocations */
    private readonly cameraFollowScratch = new Phaser.Math.Vector2();
    /** Mouse/pointer input manager */
    private inputManager: InputManager | undefined = undefined;
    /** Set of map objects that are currently colliding with the player */
    private collidingMapObjects: Set<GameAsset> = new Set();
    /** Full-screen loading UI during map load and minimap capture. */
    private loadingOverlayController: LoadingOverlayController | undefined = undefined;
    /** Whether scene initialization has started (deferred to first update) */
    private initializationStarted = false;
    /** Map manager - handles map loading, rendering, and minimap capture */
    private mapManager: MapManager | undefined = undefined;
    /** Sound manager instance */
    private soundManager: SoundManager;
    /** Whether to play map music when map loads */
    private playMapMusic = true;
    /** Whether the map is currently loading */
    private loadingMap = true;
    /** Cast manager - handles server AoE spell visuals */
    private castManager: CastManager | undefined = undefined;
    /** Olympia local cast manager - utility spells + client-side VFX */
    private olympiaLocalCastManager: OlympiaLocalCastManager | undefined = undefined;
    /** Map that is currently displayed (for proper cleanup on shutdown - gameStateManager may already point to new map) */
    private displayedMap: HBMap | undefined = undefined;
    /** Ground items (dropped loot) - cleaned up in shutdown() */
    private groundItems: GroundItem[] = [];
    /** Active ground-effect visuals keyed by authoritative server id. */
    private groundEffectsById = new Map<string, FireInstance | PoisonCloudInstance | SpikeFieldInstance | IceStorm>();
    /** Weather manager - rain particles and sound */
    private weatherManager: WeatherManager | undefined = undefined;
    /** Client-only ambient rain/snow cycle when the map default is dry (stopped by server/GM weather). */
    private ambientWeatherTimer: Phaser.Time.TimerEvent | undefined = undefined;
    private ambientWeatherPhase = 0;
    private ambientWeatherActive = false;
    /** Soft night tint over the camera (Parity P1.5 day/night cue). */
    private dayNightOverlay: Phaser.GameObjects.Rectangle | undefined = undefined;
    private lastDayNightHour = -1;
    /** When true, next left click sends cell coords to server as "make occupied" */
    private awaitingMakeServerCellOccupiedClick = false;
    /** When true, next left click sends cell coords to server as a player teleport request */
    private awaitingPlayerTeleportClick = false;
    /** Pending course corrections to process at start of next frame (before player update) */
    private pendingCourseCorrections: { curX: number; curY: number; destX: number; destY: number }[] = [];
    /** Initial state from server (map name, player position) */
    private initialGameWorldState: InitialGameWorldState | undefined;
    /** Game world ID from server (e.g. aresden, bisle) - used in logs */
    private gameWorldId: string | undefined;
    /** Loaded map waiting for authoritative server state before scene setup completes */
    private pendingLoadedMap: HBMap | undefined = undefined;
    /** True while switching worlds and waiting for the next InitialGameWorldState packet */
    private awaitingTransferredWorldState = false;
    /** Prevents duplicate predictive teleport restarts while one transfer is already in flight. */
    private pendingPredictedWorldTransfer = false;
    /** Active listener for map-dialog requested world changes; waits for authoritative server state before restarting. */
    private pendingRequestedWorldChangeListener: ((data: InitialGameWorldStateEventData) => void) | undefined = undefined;
    /**
     * Clears stuck warp flags if the server never answers a validated world-change
     * (silent reject leaves doors dead until scene restart).
     */
    private worldTransferWatchdog: Phaser.Time.TimerEvent | undefined = undefined;
    /** While true, ignore left-click movement until the current confirm click has been released. */
    private suppressLeftMouseMovementUntilRelease = false;
    /** Spawn protection enabled for self before player was created (apply when player is created) */
    private pendingSpawnProtectionForSelf = false;
    /** Teleport lookup for the currently loaded world, keyed as "x,y". */
    private teleportTargetsBySourceCell = new Map<string, TeleportTarget>();

    /** Latest `teleportLocs` from server (InitialGameWorldState); drives server teleport cell overlay. */
    private lastTeleportLocSets: TeleportLocSet[] = [];
    /** Arrow speed from InitialGameWorldState (px/s); used for monster bow FX toward the player. */
    private arrowSpeedPxPerSec = 1000;


    /** One arrow instance so `EventBus.off` gets the same reference as `on` (new inline `() => …` each time would not). */
    private readonly syncPlayerAppearanceHandler = () => {
        try {
            this.syncPlayerAppearance();
        } catch (error) {
            console.error('[GameWorld:syncPlayerAppearance]', error);
        }
    };

    private readonly playerItemAppearancePrefetchHandler = (payload: PlayerItemAppearancePrefetchEventData) => {
        if (!LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND) {
            return;
        }
        for (const name of payload.spriteNames) {
            void loadPlayerItemAppearanceOnDemand(this, name);
        }
    };

    constructor() {
        super('GameWorld');
        this.soundManager = new SoundManager(this);
    }

    public init(data?: GameWorldInitData) {
        runSafeSync('GameWorld:init', () => {
            this.clearPendingRequestedWorldChangeListener();
            this.clearWorldTransferWatchdog();
            // Prefer registry over Phaser init data: `scene.restart({ initialGameWorldState })` can leave stale
            // `data` on the Scene when returning via `scene.start('GameWorld')` without args (e.g. after logout),
            // which would ignore fresh `setInitialGameWorldState` from LoginScreen.
            this.initialGameWorldState =
                getAndRemoveInitialGameWorldState(this.game) ?? data?.initialGameWorldState;
            this.gameWorldId = this.initialGameWorldState?.gameWorldId;
            this.setTeleportLocs(this.initialGameWorldState?.teleportLocs);
            this.awaitingTransferredWorldState = this.initialGameWorldState?.awaitTransferredWorldState === true;
            this.pendingPredictedWorldTransfer = this.awaitingTransferredWorldState;
            this.pendingLoadedMap = undefined;
            MapWarpSystem.getInstance().resetForNewScene();
            if (this.awaitingTransferredWorldState) {
                this.tryConsumePendingTransferredWorldState();
            }

            setSoundManager(this.game, this.soundManager);
            // Apply SysMenu / Sound dialog prefs before any map BGM / SFX can start
            this.playMapMusic = soundDialogStore.state.playMapMusic;
            this.soundManager.setSoundEnabled(sysMenuDialogStore.state.soundEnabled);
            getMusicManager(this).setMusicEnabled(sysMenuDialogStore.state.musicEnabled);
            // Reset initialization state
            this.initializationStarted = false;
            this.loadingMap = true;

            this.loadingOverlayController = new LoadingOverlayController(this);

            this.weatherManager = new WeatherManager(this, this.soundManager);
            this.weatherManager.setDetailLevel(sysMenuDialogStore.state.detailLevel);
            const snapshotWeather = this.initialGameWorldState?.weather;
            const weather = snapshotWeather ?? mapDialogStore.state.weather;
            this.weatherManager.setWeather(weather);
            if (snapshotWeather !== undefined) {
                syncWeather(snapshotWeather);
            }
            this.maybeStartAmbientWeather(weather);
            this.setupMapManager();
            this.setupCameraManager();
            this.setupViewportResizeListener();
            this.setupControlDialogEventListeners();
            this.setupSoundDialogEventListeners();
            this.setupMapDialogEventListeners();
            this.setupServerDialogEventListeners();
            this.setupSummonDialogEventListeners();
            this.setupNPCEventListeners();
            this.setupCastManager();
            this.setupSpellRequestListener();
            this.setupPlayerEventListeners();
            this.setupMonsterEventListeners();
            this.setupChatOverheadListener();
            this.setupScreenshotListener();
            this.setupInputManager();
            this.setupCameraStatsUpdateInterval();
            EventBus.on(PLAYER_ITEM_APPEARANCE_PREFETCH_REQUESTED, this.playerItemAppearancePrefetchHandler);

            this.events.once('shutdown', () => {
                runSafeSync('GameWorld:shutdownEvent', () => this.shutdown());
            });
        });
    }

    public create() {
        runSafeSync('GameWorld:create', () => {
            this.clearResidualLoginDeskChrome();
            document.body.classList.add('game-world-active');
            applyGameWorldCanvasPresentation(this);
            this.cameras.main.setBackgroundColor('#000');
            if (LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND) {
                const pending = takePendingPlayerItemAppearancePrefetch(this.game);
                for (const name of pending) {
                    void loadPlayerItemAppearanceOnDemand(this, name);
                }
            }
            EventBus.emit(CURRENT_SCENE_READY, this);
        });
    }

    /**
     * Clears leftover SELECTCHAR canvas CSS / ownership, then prepares for in-game
     * viewport presentation (Scale.FIT + fixed 1024×576 FOV — letterbox, not more map).
     */
    private clearResidualLoginDeskChrome(): void {
        forceClearLoginDeskCanvasPresentation(this);
        document.body.classList.remove('login-selectchar-active');
        const canvas = this.game.canvas;
        if (canvas) {
            canvas.classList.remove('login-selectchar-canvas');
            canvas.style.removeProperty('transform');
            canvas.style.removeProperty('position');
            canvas.style.removeProperty('left');
            canvas.style.removeProperty('top');
            canvas.style.removeProperty('width');
            canvas.style.removeProperty('height');
            canvas.style.removeProperty('margin');
            canvas.style.removeProperty('transform-origin');
        }
    }

    private setupMapManager(): void {
        let savedOverlayVisible = false;
        let savedTextVisible = false;
        this.mapManager = new MapManager({
            scene: this,
            initialMapName: this.initialGameWorldState?.mapName
                ? toClientMapFileName(this.initialGameWorldState.mapName, this.initialGameWorldState.gameWorldId)
                : undefined,
            initialMusicFile: this.initialGameWorldState?.musicFile,
            playMapMusic: this.playMapMusic,
            initialFocusTileX: this.initialGameWorldState?.playerX,
            initialFocusTileY: this.initialGameWorldState?.playerY,
            onBeforeSnapshot: () => {
                const overlay = this.loadingOverlayController?.getOverlay();
                const text = this.loadingOverlayController?.getText();
                savedOverlayVisible = overlay?.visible ?? false;
                savedTextVisible = text?.visible ?? false;
                overlay?.setVisible(false);
                text?.setVisible(false);
            },
            onAfterSnapshot: () => {
                const overlay = this.loadingOverlayController?.getOverlay();
                const text = this.loadingOverlayController?.getText();
                if (overlay && savedOverlayVisible) {
                    overlay.setVisible(true);
                }
                if (text && savedTextVisible) {
                    text.setVisible(true);
                }
            }
        });
    }

    private setupCameraManager(): void {
        this.cameraManager = new CameraManager({
            scene: this,
            isCapturingMinimap: () => this.mapManager?.isCapturingMinimap() ?? false,
            getFollowTarget: () => {
                if (!this.player) {
                    return undefined;
                }
                this.cameraFollowScratch.set(
                    this.player.getAnimatedPixelX(),
                    this.player.getAnimatedPixelY(),
                );
                return this.cameraFollowScratch;
            },
        });
        this.cameraManager.setupEventListeners();
        this.mapManager?.setCameraManager(this.cameraManager);
    }

    /**
     * Expanded fullscreen grows the Phaser FOV — re-center on player and resize overlays
     * so the dock stays correct and we don't leave the camera scrolled wrong.
     */
    private setupViewportResizeListener(): void {
        subscribeSafe('GameWorld', IN_UI_GAME_VIEWPORT_RESIZED, () => {
            if (!this.player || this.loadingMap) {
                return;
            }
            this.cameraManager?.centerOn(
                this.player.getAnimatedPixelX(),
                this.player.getAnimatedPixelY(),
            );
            // Force day/night rect to new camera size next update.
            if (this.dayNightOverlay) {
                const cam = this.cameras?.main;
                if (cam) {
                    this.dayNightOverlay.setSize(cam.width, cam.height);
                }
            }
        });
    }

    private setupControlDialogEventListeners(): void {
        // Listen for player movement speed changes from React (ms-based, 100-500 base)
        subscribeSafe('GameWorld', IN_UI_CHANGE_MOVEMENT_SPEED, (payload: { speed: number; previousSpeed: number }) => {
            const baseMs = payload.speed;
            const oldBaseMs = payload.previousSpeed;
            if (this.player) {
                const runMode = playerDialogStore.state.runMode;
                const cur = this.player.getMovementSpeedMs();
                const oldUnbuffed = runMode ? oldBaseMs : oldBaseMs * 2;
                const newUnbuffed = runMode ? baseMs : baseMs * 2;
                const effectiveMs =
                    oldUnbuffed > 0 ? Math.round((cur / oldUnbuffed) * newUnbuffed) : newUnbuffed;
                this.player.setMovementSpeed(effectiveMs);
            }
            if (serverDialogStore.state.syncWithServer) {
                getNetworkManager(this.game)?.changePlayerMovementSpeed(baseMs);
            }
        });

        // Listen for player attack speed changes from React
        subscribeSafe('GameWorld', IN_UI_CHANGE_ATTACK_SPEED, (attackSpeedMs: number) => {
            if (this.player) {
                this.player.setAttackSpeedFromDurationMs(attackSpeedMs);
            }
            if (serverDialogStore.state.syncWithServer) {
                getNetworkManager(this.game)?.changePlayerAttackSpeed(playerDialogStore.state.attackSpeedMs);
            }
        });

        // Listen for player cast speed changes from React (full cast bar duration in ms)
        subscribeSafe('GameWorld', IN_UI_CHANGE_CAST_SPEED, (castSpeedMs: number) => {
            if (this.player) {
                this.player.setCastDurationMs(castSpeedMs);
            }
            if (serverDialogStore.state.syncWithServer) {
                getNetworkManager(this.game)?.changePlayerCastSpeed(playerDialogStore.state.castSpeedMs);
            }
        });

        // Listen for player attack range changes from React
        subscribeSafe('GameWorld', IN_UI_CHANGE_ATTACK_RANGE, (range: number) => {
            if (this.player) {
                this.player.setAttackRange(range);
            }
            if (serverDialogStore.state.syncWithServer) {
                getNetworkManager(this.game)?.changePlayerAttackRange(playerDialogStore.state.attackRange);
            }
        });

        subscribeSafe('GameWorld', IN_UI_CHANGE_DAMAGE, () => {
            if (serverDialogStore.state.syncWithServer) {
                getNetworkManager(this.game)?.changePlayerAttackDamage(playerDialogStore.state.damage);
            }
        });

        subscribeSafe('GameWorld', IN_UI_CHANGE_STUN_DURATION, (ms: number) => {
            if (serverDialogStore.state.syncWithServer) {
                getNetworkManager(this.game)?.changePlayerAttackStunDuration(ms);
            }
        });

        subscribeSafe('GameWorld', IN_UI_CHANGE_ATTACK_TYPE, (attackType: AttackType) => {
            if (this.player) {
                this.player.setAttackType(attackType);
            }
            if (serverDialogStore.state.syncWithServer) {
                getNetworkManager(this.game)?.changePlayerAttackType(attackType);
            }
        });

        subscribeSafe('GameWorld', IN_UI_CHANGE_ALLOW_DASH_ATTACK, (enabled: boolean) => {
            if (serverDialogStore.state.syncWithServer) {
                getNetworkManager(this.game)?.changePlayerAllowDashAttack(enabled);
            }
        });

        subscribeSafe('GameWorld', IN_UI_CHANGE_ATTACK_MODE, (enabled: boolean) => {
            if (this.player) {
                this.player.setAttackMode(enabled);
            }
            if (serverDialogStore.state.syncWithServer) {
                getNetworkManager(this.game)?.requestPlayerAttackModeChange(enabled);
            }
        });

        subscribeSafe('GameWorld', IN_UI_CHANGE_SAFE_ATTACK_MODE, (enabled: boolean) => {
            if (serverDialogStore.state.syncWithServer) {
                getNetworkManager(this.game)?.requestPlayerSafeAttackModeChange(enabled);
            }
        });

        subscribeSafe('GameWorld', IN_UI_CHANGE_RUN_MODE, (enabled: boolean) => {
            if (this.player) {
                const cur = this.player.getMovementSpeedMs();
                const nextMs = enabled ? Math.max(100, Math.round(cur / 2)) : Math.min(1000, cur * 2);
                this.player.setRunModeAndMovementSpeed(enabled, nextMs);
            }
            if (serverDialogStore.state.syncWithServer) {
                getNetworkManager(this.game)?.requestPlayerMovementStateChange(enabled);
            }
        });

        EventBus.on(IN_UI_CHANGE_GENDER, this.syncPlayerAppearanceHandler);
        EventBus.on(IN_UI_CHANGE_SKIN_COLOR, this.syncPlayerAppearanceHandler);
        EventBus.on(IN_UI_CHANGE_UNDERWEAR_COLOR, this.syncPlayerAppearanceHandler);
        EventBus.on(IN_UI_CHANGE_HAIR_STYLE, this.syncPlayerAppearanceHandler);

        subscribeSafe('GameWorld', IN_UI_PAPERDOLL_CAPTURE, () => {
            try {
                // Always recapture on F5 — stale cache was the #1 "wrong mannequin" cause.
                invalidatePaperDollCache();
                const inv = getInventoryManager(this.game);
                const gender = this.player?.getGender?.() ?? playerDialogStore.state.gender;
                const skin = playerDialogStore.state.skinColor;
                const hair =
                    this.player?.getHairStyleIndex?.() ?? playerDialogStore.state.hairStyleIndex;
                const uw =
                    this.player?.getUnderwearColorIndex?.() ??
                    playerDialogStore.state.underwearColorIndex;
                const equipped = inv?.equippedItems ?? {};

                // 1) Prefer live map pixels first (even 1 layer = body) — most reliable for F5.
                const liveLayers = this.player?.getVisibleSpritesForPaperDoll?.() ?? [];
                if (this.player && liveLayers.length >= 1) {
                    capturePaperDollFromLivePlayer(this, this.player, true);
                }

                // 2) Idle-south rebuild (fills gear when packs finish loading; upgrades nude→geared).
                capturePaperDollBodyLayers(this, gender, skin, hair, uw, equipped, true);

                // 3) Live again if multi-layer (gear) so F5 matches the world character.
                if (this.player && liveLayers.length >= 2) {
                    capturePaperDollFromLivePlayer(this, this.player, true);
                }
            } catch (err) {
                console.warn('[GameWorld] paper-doll capture failed', err);
            }
        });

        // Listen for map change events from React
        subscribeSafe('GameWorld', IN_UI_CHANGE_MAP, (worldId: string) => {
            if (!worldId || worldId === this.gameWorldId) {
                return;
            }

            const networkManager = getNetworkManager(this.game);
            const targetWorld = networkManager?.getWorldById(worldId);
            if (!networkManager || !targetWorld) {
                console.warn(`[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Cannot change world: unknown world '${worldId}'`);
                return;
            }

            this.beginRequestedWorldChange(worldId);
        });

        subscribeSafe('GameWorld', IN_UI_REQUEST_SERVER_RESURRECT, () => {
            getNetworkManager(this.game)?.requestPlayerResurrectedRequest();
        });
        subscribeSafe('GameWorld', IN_UI_CLAIM_KILL_MILESTONE, (data: { milestoneId: string; chosenItemId: number }) => {
            getNetworkManager(this.game)?.requestClaimKillMilestone(data.milestoneId, data.chosenItemId);
        });
        subscribeSafe('GameWorld', IN_UI_BEGINNER_PATH_ENROLL, () => {
            getNetworkManager(this.game)?.requestBeginnerPathEnroll();
        });
        subscribeSafe('GameWorld', IN_UI_BEGINNER_PATH_ABANDON, () => {
            getNetworkManager(this.game)?.requestBeginnerPathAbandon();
        });
        subscribeSafe('GameWorld', IN_UI_BEGINNER_PATH_TALK, (data: { catalogNpcId: number }) => {
            getNetworkManager(this.game)?.requestBeginnerPathTalk(data.catalogNpcId);
        });
        subscribeSafe('GameWorld', IN_UI_BEGINNER_PATH_UI_ACTION, (data: { actionId: string }) => {
            getNetworkManager(this.game)?.requestBeginnerPathUiAction(data.actionId);
        });
        subscribeSafe('GameWorld', IN_UI_CREATE_PARTY, () => {
            getNetworkManager(this.game)?.requestCreateParty();
        });
        subscribeSafe('GameWorld', IN_UI_JOIN_PARTY, (data: { partyCode: string }) => {
            getNetworkManager(this.game)?.requestJoinParty(data.partyCode);
        });
        subscribeSafe('GameWorld', IN_UI_LEAVE_PARTY, () => {
            getNetworkManager(this.game)?.requestLeaveParty();
        });
        subscribeSafe('GameWorld', IN_UI_REQUEST_REBIRTH, () => {
            getNetworkManager(this.game)?.requestRebirth();
        });
        subscribeSafe('GameWorld', IN_UI_REQUEST_REBIRTH_ROLLBACK, () => {
            getNetworkManager(this.game)?.requestRebirthRollback();
        });
        subscribeSafe('GameWorld', IN_UI_SET_LEVEL_BLOCK, (data: { blocked: boolean }) => {
            getNetworkManager(this.game)?.requestSetLevelBlock(data.blocked === true);
        });
        subscribeSafe('GameWorld', IN_UI_MAJESTIC_UPGRADE, (data: { itemUid: string }) => {
            getNetworkManager(this.game)?.requestMajesticUpgrade(data.itemUid);
        });
        subscribeSafe(
            'GameWorld',
            IN_UI_STONE_ITEM_UPGRADE,
            (data: { itemUid: string; useIntegrityStone?: boolean }) => {
                getNetworkManager(this.game)?.requestStoneItemUpgrade(
                    data.itemUid,
                    data.useIntegrityStone === true,
                );
            },
        );
        subscribeSafe('GameWorld', IN_UI_ITEM_DISENCHANT, (data: { itemUid: string }) => {
            getNetworkManager(this.game)?.requestItemDisenchant(data.itemUid);
        });
        subscribeSafe('GameWorld', IN_UI_ITEM_ENCHANT, (data: { itemUid: string; kind: number }) => {
            getNetworkManager(this.game)?.requestItemEnchant(data.itemUid, data.kind ?? 0);
        });
        subscribeSafe(
            'GameWorld',
            IN_UI_ENCHANT_MATERIAL_UPGRADE,
            (data: { kind: number; type: number; level: number; mode: number }) => {
                getNetworkManager(this.game)?.requestEnchantMaterialUpgrade(
                    data.kind,
                    data.type,
                    data.level,
                    data.mode,
                );
            },
        );
        subscribeSafe('GameWorld', IN_UI_GET_ENCHANT_MATERIALS, () => {
            getNetworkManager(this.game)?.requestEnchantMaterialsState();
        });
        subscribeSafe(
            'GameWorld',
            IN_UI_CIC_ITEM_MERGE,
            (data: { itemUidA: string; itemUidB: string }) => {
                getNetworkManager(this.game)?.requestCicItemMerge(data.itemUidA, data.itemUidB);
            },
        );
        subscribeSafe('GameWorld', IN_UI_SIPHON_GEM_UPGRADE, (data: { itemUid: string }) => {
            getNetworkManager(this.game)?.requestSiphonGemUpgrade(data.itemUid);
        });
        subscribeSafe(
            'GameWorld',
            IN_UI_MAJESTIC_STAT_RESPEC,
            (data: { statA: number; statB: number; statC: number }) => {
                getNetworkManager(this.game)?.requestMajesticStatRespec(data.statA, data.statB, data.statC);
            },
        );
        subscribeSafe(
            'GameWorld',
            IN_UI_LEVEL_UP_SETTINGS,
            (data: { str: number; vit: number; dex: number; intel: number; mag: number; chr: number }) => {
                getNetworkManager(this.game)?.requestLevelUpSettings(data);
            },
        );
        subscribeSafe('GameWorld', PLAYER_DIED_RECEIVED, (data: PlayerDiedEventData) => {
            const p = this.playersById.get(data.playerId);
            let killerName = data.killerName?.trim() || undefined;
            if (!killerName && data.killerPlayerId) {
                const killer = this.playersById.get(data.killerPlayerId);
                const resolved = killer?.getCharacterName()?.trim();
                if (resolved) {
                    killerName = resolved;
                }
            }
            p?.applyDeath(killerName);
        });
        subscribeSafe('GameWorld', ENEMY_KILL_AWARDED_RECEIVED, (data: EnemyKillAwardedEventData) => {
            const killerName = this.player?.getCharacterName()?.trim();
            scheduleEkScreenshot(this.game, {
                victimName: data.victimName,
                victimPlayerId: data.victimPlayerId,
                mapName: data.mapName,
                killerName,
                victimCityKillerRank: data.victimCityKillerRank,
                rarity: data.rarity,
            });
        });
        subscribeSafe('GameWorld', PLAYER_RESURRECTED_RECEIVED, (data: PlayerResurrectedEventData) => {
            const p = this.playersById.get(data.playerId) ?? (data.playerId === this.selfPlayerId ? this.player : undefined);
            p?.applyResurrect(data.x, data.y, data.hp, data.maxHp);
            if (data.playerId === this.selfPlayerId) {
                setDeathDialogOpen(false);
                EventBus.emit(IN_UI_PLAYER_RESURRECT);
            }
        });

        // Listen for player logout events from React
        subscribeSafe('GameWorld', IN_UI_REQUEST_PLAYER_LOGOUT, () => {
            // Stop music before saving state
            getMusicManager(this).stopMusic();

            // Save game state before logout (map and position are server-authoritative)
            getGameStateManager(this.game).saveGameState();

            // Navigate back to LoginScreen
            this.scene.start('LoginScreen');
        });

        // Listen for socket disconnection (server shutdown, network loss, etc.) - same behavior as Log out button
        subscribeSafe('GameWorld', SOCKET_DISCONNECTED, () => {
            performLogoutCleanup(this.game);
        });
    }

    private setupSoundDialogEventListeners(): void {
        // Listen for music play requests from React
        subscribeSafe('GameWorld', IN_UI_PLAY_MUSIC, (musicFile: string) => {
            getMusicManager(this).playMusic(musicFile);
            // Emit event to notify React layer of music change
            EventBus.emit(OUT_UI_SET_SELECTED_MUSIC, musicFile);
        });

        // Listen for play map music setting changes from React
        subscribeSafe('GameWorld', IN_UI_CHANGE_PLAY_MAP_MUSIC, (enabled: boolean) => {
            this.playMapMusic = enabled;
            if (!enabled) {
                getMusicManager(this).silence();
            } else if (sysMenuDialogStore.state.musicEnabled) {
                this.mapManager?.playInitialMusic();
            }
        });

        // SysMenu Music On/Off
        subscribeSafe('GameWorld', IN_UI_CHANGE_MUSIC_ENABLED, (enabled: boolean) => {
            const mm = getMusicManager(this);
            if (!enabled) {
                mm.setMusicEnabled(false);
                return;
            }
            mm.setMusicEnabled(true);
            this.restorePhaserSoundMasterIfMuted();
            // Resume BGM: prefer map track when play-map-music is on, else last manual selection
            if (this.playMapMusic) {
                this.mapManager?.playInitialMusic();
            } else {
                const last = mm.getLastRequestedMusic();
                if (last) {
                    mm.playMusic(last);
                }
            }
        });

        // SysMenu Sound On/Off
        subscribeSafe('GameWorld', IN_UI_CHANGE_SOUND_ENABLED, (enabled: boolean) => {
            if (!this.soundManager) {
                return;
            }
            this.soundManager.setSoundEnabled(enabled);
            if (enabled) {
                this.restorePhaserSoundMasterIfMuted();
                // stopAllSounds may have killed rain loop — re-apply rain SFX preference
                this.weatherManager?.setRainSoundsEnabled(sysMenuDialogStore.state.rainSoundsEnabled);
            } else {
                // Drop stale rain sound id so re-enable can start a fresh loop
                this.weatherManager?.setRainSoundsEnabled(false);
            }
        });

        // Sound dialog: temporary mute while dragging volume slider
        subscribeSafe('GameWorld', IN_UI_MUTE_ALL_SOUNDS, () => {
            this.soundManager?.stopAllSounds();
        });
        subscribeSafe('GameWorld', IN_UI_UNMUTE_ALL_SOUNDS, () => {
            // Volume already applied on commit; nothing else required for one-shots.
            this.restorePhaserSoundMasterIfMuted();
        });

        // SysMenu Detail Level → weather density + hide trees on Low (Boris: Low/Med/High no ocultaba árboles)
        subscribeSafe('GameWorld', IN_UI_CHANGE_DETAIL_LEVEL, (level: 0 | 1 | 2) => {
            this.weatherManager?.setDetailLevel(level);
            try {
                this.getCurrentMap()?.applyDetailLevel(level);
            } catch {
                // Map may not be loaded yet.
            }
        });

        // Listen for music volume changes from React
        subscribeSafe('GameWorld', IN_UI_CHANGE_MUSIC_VOLUME, (volume: number) => {
            this.restorePhaserSoundMasterIfMuted();
            getMusicManager(this).setMusicVolume(volume);
            // Update GameStateManager
            getGameStateManager(this.game).setMusicVolume(volume);
        });

        // Listen for sound volume changes from React
        subscribeSafe('GameWorld', IN_UI_CHANGE_SOUND_VOLUME, (volume: number) => {
            this.restorePhaserSoundMasterIfMuted();
            if (this.soundManager) {
                this.soundManager.setSoundVolume(volume);
            }
            // Update GameStateManager
            getGameStateManager(this.game).setSoundVolume(volume);
        });
    }

    /**
     * Phaser applies game.sound.volume as a master gain on top of per-sound volumes.
     * PhaserGame sets it to 0 on window blur; if that stacks badly, sliders only update
     * MusicManager/SoundManager and cannot make audio audible until master is non-zero.
     */
    private restorePhaserSoundMasterIfMuted(): void {
        if (this.game.sound.volume === 0) {
            this.game.sound.volume = 1;
        }
    }

    private setupSummonDialogEventListeners(): void {
        // Summon is server-authoritative; UI forwards sprite, movement, and facing for the spawn packet.
        subscribeSafe('GameWorld', IN_UI_SUMMON_MONSTER, (data: SummonMonsterEvent) => {
            const nm = getNetworkManager(this.game);
            if (!nm) {
                return;
            }
            nm.sendSummonMonsterRequested(
                data.spriteName,
                data.movementSpeed,
                data.direction,
                data.attackType,
                data.allegiance,
                data.stunDurationMs,
                data.maxHp,
                data.attackDamage,
                data.attackSpeedMs,
                data.attackRecoveryMs,
                data.chaseRangeCells,
                data.attackRangeCells,
                data.summonCount,
            );
        });

        subscribeSafe('GameWorld', IN_UI_SUMMON_NPC, (data: SummonNPCEvent) => {
            const nm = getNetworkManager(this.game);
            if (!nm) {
                return;
            }
            let dir = data.direction;
            if (dir === Direction.None) {
                dir = Direction.South;
            }
            nm.sendSummonNpcRequest(data.catalogNpcId, dir);
        });
    }

    private setupNPCEventListeners(): void {
        subscribeSafe('GameWorld', NPC_DEAD, (data: { npcId: string }) => {
            const npcIndex = this.npcs.findIndex((n) => n.getNPCId() === data.npcId);
            if (npcIndex !== -1) {
                const npc = this.npcs[npcIndex];
                npc.destroy();
                this.npcs.splice(npcIndex, 1);
            }
        });

        subscribeSafe('GameWorld', IN_UI_KILL_ALL_NPCS, () => {
            getNetworkManager(this.game)?.sendKillAllNpcsRequest();
        });

        subscribeSafe('GameWorld', NPC_ENTERED_RANGE_RECEIVED, (entries: NpcEnteredRangeEventData[]) => {
            for (const entry of entries) {
                this.handleNpcEnteredRange(entry);
            }
        });
        subscribeSafe('GameWorld', NPCS_LEFT_RANGE_RECEIVED, (npcIds: string[]) => {
            this.handleNpcsLeftRange(npcIds);
        });
    }

    private setupCastManager(): void {
        const castConfig = {
            scene: this,
            soundManager: this.soundManager,
            cameraManager: this.cameraManager,
            getPlayerWorldPos: () =>
                this.player ? { x: this.player.getWorldX(), y: this.player.getWorldY() } : undefined,
        };
        this.castManager = new CastManager(castConfig);
        this.castManager.setupEventListeners();
        this.olympiaLocalCastManager = new OlympiaLocalCastManager(castConfig);
        this.olympiaLocalCastManager.setupEventListeners();
    }

    private setupSpellRequestListener(): void {
        subscribeSafe('GameWorld', IN_UI_CAST_SPELL, (data: CastSpellEvent) => {
            this.player?.requestCast(data.spellId, data.useCastAnimation ?? true);
        });
        subscribeSafe('GameWorld', PLAYER_CAST_ANIMATION_STARTED, (data: { spellId: number }) => {
            if (!isServerAuthoritativeOlympiaSpell(data.spellId)) {
                return;
            }
            const serverSpellId = getOlympiaServerSpellId(data.spellId);
            if (serverSpellId !== undefined) {
                getNetworkManager(this.game)?.sendSpellCastStartRequest(serverSpellId);
            }
        });
        subscribeSafe('GameWorld', PLAYER_CONFIRM_SPELL_TARGET, (data: PlayerConfirmSpellTargetEvent) => {
            if (!isServerAuthoritativeOlympiaSpell(data.spellId)) {
                return;
            }
            const serverSpellId = getOlympiaServerSpellId(data.spellId);
            if (serverSpellId === undefined) {
                return;
            }
            const nm = getNetworkManager(this.game);
            const spellEntry = nm?.getSpellById(serverSpellId);
            let aimAssistPlayerId: bigint | undefined;
            let aimAssistMonsterId: bigint | undefined;
            let targetWorldX = convertPixelPosToWorldPos(data.targetPixelX);
            let targetWorldY = convertPixelPosToWorldPos(data.targetPixelY);
            if (spellEntry?.aimAssist) {
                const ids = this.getSpellAimAssistTargetIds(serverSpellId, data.targetPixelX, data.targetPixelY);
                aimAssistPlayerId = ids.playerId;
                aimAssistMonsterId = ids.monsterId;
                // Snap cast cell to entity feet when body was clicked (chest/head → north cell otherwise).
                if (aimAssistPlayerId !== undefined) {
                    const pid = aimAssistPlayerId.toString();
                    const aimed =
                        (this.player && this.player.getPlayerId() === pid ? this.player : undefined) ??
                        this.playersById.get(pid);
                    if (aimed && !aimed.isDead()) {
                        targetWorldX = aimed.getWorldX();
                        targetWorldY = aimed.getWorldY();
                    }
                } else if (aimAssistMonsterId !== undefined) {
                    const mid = aimAssistMonsterId.toString();
                    const mon = this.monsters.find((m) => m.getMonsterId() === mid);
                    if (mon && !mon.isDead()) {
                        targetWorldX = mon.getWorldX();
                        targetWorldY = mon.getWorldY();
                    }
                } else if (
                    // Utility/buff/cancel on empty pad next to self: still self-target so
                    // Cancellation / PFM VFX land on the caster's feet (not a far grid cell).
                    spellEntry.damageType === undefined &&
                    this.player &&
                    !this.player.isDead()
                ) {
                    const selfId = this.player.getPlayerId();
                    const sx = this.player.getWorldX();
                    const sy = this.player.getWorldY();
                    if (
                        selfId &&
                        Math.max(Math.abs(targetWorldX - sx), Math.abs(targetWorldY - sy)) <= 1
                    ) {
                        aimAssistPlayerId = BigInt(selfId);
                        targetWorldX = sx;
                        targetWorldY = sy;
                    }
                }
            }
            nm?.sendSpellCastRequest(
                targetWorldX,
                targetWorldY,
                aimAssistPlayerId,
                aimAssistMonsterId,
            );
        });
    }

    private setupPlayerEventListeners(): void {
        // Listen for player position changes to update monster spatial audio + warp when idle on tile
        subscribeSafe('GameWorld', PLAYER_POSITION_CHANGED, (data: { x: number; y: number }) => {
            this.updateMonsterSpatialAudio(data.x, data.y);
            this.tryPlayerWarp(data.x, data.y);
            this.tryCompletePendingNpcInteraction();
            this.tryCompletePendingGroundPickup();
        });
        subscribeSafe('GameWorld', TILE_OCCUPANCY_REAPPLY_REQUESTED, () => {
            this.reapplyTileOccupancyOnMap();
        });
        subscribeSafe('GameWorld', MONSTER_ENTERED_RANGE_RECEIVED, (data: MonsterEnteredRangeEventData[]) => {
            for (const entry of data) {
                this.handleMonsterEnteredRange(entry);
            }
        });
        subscribeSafe('GameWorld', MONSTERS_LEFT_RANGE_RECEIVED, (monsterIds: string[]) => {
            this.handleMonstersLeftRange(monsterIds);
        });
        subscribeSafe('GameWorld', GROUND_STATES_ENTERED_RANGE_RECEIVED, (states: GroundStateCellEventData[]) => {
            this.handleGroundStatesEnteredRange(states);
        });
        subscribeSafe('GameWorld', GROUND_STATES_LEFT_RANGE_RECEIVED, (states: GroundStateCellRemovedEventData[]) => {
            this.handleGroundStatesLeftRange(states);
        });
        subscribeSafe('GameWorld', MONSTER_MOVED_RECEIVED, (data: MonsterMovedEventData) => {
            this.handleMonsterMoved(data);
        });
        subscribeSafe('GameWorld', MONSTER_ATTACKED_RECEIVED, (data: MonsterAttackedEventData) => {
            this.handleMonsterAttacked(data);
        });
        subscribeSafe('GameWorld', MONSTER_ATTACKED_MONSTER_RECEIVED, (data: MonsterAttackedMonsterEventData) => {
            this.handleMonsterAttackedMonster(data);
        });
        subscribeSafe('GameWorld', MONSTER_DIED_RECEIVED, (data: MonsterDiedEventData) => {
            this.handleMonsterDied(data);
        });
        subscribeSafe('GameWorld', PLAYER_RECEIVE_DAMAGE_RECEIVED, (data: PlayerReceiveDamageEventData) => {
            this.handlePlayerReceiveDamage(data);
        });
        subscribeSafe('GameWorld', PLAYER_TAKE_DAMAGE_RECEIVED, (data: PlayerTakeDamageEventData) => {
            this.handlePlayerTakeDamage(data);
        });
        subscribeSafe('GameWorld', HP_UPDATED_RECEIVED, (data: { hp: number; maxHp: number }) => {
            this.player?.setHp(data.hp, data.maxHp);
        });
        subscribeSafe('GameWorld', MONSTER_TAKE_DAMAGE_RECEIVED, (data: MonsterTakeDamageEventData) => {
            this.handleMonsterTakeDamage(data);
        });
        subscribeSafe('GameWorld', MONSTER_TAKE_DAMAGE_BY_MONSTER_RECEIVED, (data: MonsterTakeDamageByMonsterEventData) => {
            this.handleMonsterTakeDamageByMonster(data);
        });
        subscribeSafe('GameWorld', PLAYER_JOINED_RECEIVED, (data: NetworkPlayer[]) => {
            for (const p of data) {
                this.handlePlayerEnteredRange(p);
            }
        });
        subscribeSafe('GameWorld', REMOTE_PLAYER_ITEM_EQUIPPED_RECEIVED, (data: ItemEquippedEventData) => {
            this.handleRemotePlayerItemEquipped(data);
        });
        subscribeSafe('GameWorld', REMOTE_PLAYER_ITEM_UNEQUIPPED_RECEIVED, (data: ItemUnequippedEventData) => {
            this.handleRemotePlayerItemUnequipped(data);
        });
        subscribeSafe('GameWorld', PLAYER_LEFT_RECEIVED, (playerIds: string[]) => {
            for (const playerId of playerIds) {
                this.handlePlayerLeftRange({ playerId });
            }
        });
        subscribeSafe('GameWorld', PLAYER_MOVED_RECEIVED, (data: PlayerMovedEventData) => {
            this.handlePlayerMoved(data);
        });
        subscribeSafe('GameWorld', PLAYER_ATTACKED_MONSTER_RECEIVED, (data: PlayerAttackedMonsterEventData) => {
            this.handlePlayerAttackedMonster(data);
        });
        subscribeSafe('GameWorld', PLAYER_ATTACKED_PLAYER_RECEIVED, (data: PlayerAttackedPlayerEventData) => {
            this.handlePlayerAttackedPlayer(data);
        });
        subscribeSafe('GameWorld', PLAYER_PICKUP_PERFORMED_RECEIVED, (data: PlayerPickupPerformedEventData) => {
            this.handlePlayerPickupPerformed(data);
        });
        subscribeSafe('GameWorld', PLAYER_BOW_STANCE_PERFORMED_RECEIVED, (data: PlayerBowStancePerformedEventData) => {
            this.handlePlayerBowStancePerformed(data);
        });
        subscribeSafe('GameWorld', SPELL_CAST_STARTED_RECEIVED, (data: SpellCastStartedEventData) => {
            this.handleSpellCastStarted(data);
        });
        subscribeSafe('GameWorld', SPELL_CAST_CANCELLED_RECEIVED, (data: SpellCastCancelledEventData) => {
            this.handleSpellCastCancelled(data);
        });
        subscribeSafe('GameWorld', SPELL_CAST_FAILED_RECEIVED, () => {
            this.player?.onSpellCastRejected();
        });
        // ESC (and other UI): cancel cast bar + notify server.
        subscribeSafe('GameWorld', IN_UI_FORCE_CANCEL_CAST, () => {
            if (!this.player) {
                return;
            }
            this.player.onRightClick();
        });
        // Super Attack arm/disarm (right-click / Shift+click Attack Mode button).
        subscribeSafe('GameWorld', IN_UI_SET_SUPER_ATTACK_ARMED, (data: { armed?: boolean } | boolean) => {
            const armed = typeof data === 'boolean' ? data : Boolean(data?.armed);
            getNetworkManager(this.game)?.sendSetSuperAttackArmed(armed);
        });
        subscribeSafe('GameWorld', CAST_AOE_SPELL_RECEIVED, (data: CastAoeSpellEventData) => {
            this.handleCastAoeSpell(data);
        });
        subscribeSafe('GameWorld', CAST_DIRECTIONAL_AOE_SPELL_RECEIVED, (data: CastDirectionalAoeSpellEventData) => {
            this.handleCastDirectionalAoeSpell(data);
        });
        subscribeSafe('GameWorld', MONSTER_CAST_AOE_SPELL_RECEIVED, (data: MonsterCastAoeSpellEventData) => {
            this.handleMonsterCastAoeSpell(data);
        });
        subscribeSafe('GameWorld', MONSTER_CAST_DIRECTIONAL_AOE_SPELL_RECEIVED, (data: MonsterCastDirectionalAoeSpellEventData) => {
            this.handleMonsterCastDirectionalAoeSpell(data);
        });
        subscribeSafe('GameWorld', PLAYER_MOVEMENT_STATE_CHANGED_RECEIVED, (data: PlayerMovementStateChangedEventData) => {
            this.handlePlayerMovementStateChanged(data);
        });
        subscribeSafe('GameWorld', PLAYER_ATTACK_MODE_CHANGED_RECEIVED, (data: PlayerAttackModeChangedEventData) => {
            this.handlePlayerAttackModeChanged(data);
        });
        subscribeSafe('GameWorld', PLAYER_IDLE_DIRECTION_CHANGED_RECEIVED, (data: PlayerIdleDirectionChangedEventData) => {
            this.handlePlayerIdleDirectionChanged(data);
        });
        subscribeSafe('GameWorld', PLAYER_APPEARANCE_CHANGED_RECEIVED, (data: PlayerAppearanceChangedEventData) => {
            this.handlePlayerAppearanceChanged(data);
        });
        subscribeSafe('GameWorld', PLAYER_DISCONNECTED_RECEIVED, (data: PlayerConnectionStateChangedEventData) => {
            this.handlePlayerDisconnected(data);
        });
        subscribeSafe('GameWorld', PLAYER_RECONNECTED_RECEIVED, (data: PlayerConnectionStateChangedEventData) => {
            this.handlePlayerReconnected(data);
        });
        subscribeSafe('GameWorld', RESET_POSITION_RECEIVED, (data: { x: number; y: number; remainingStunlockMs?: number }) => {
            this.player?.resetPosition(data.x, data.y, data.remainingStunlockMs);
        });
        subscribeSafe('GameWorld', PLAYER_TELEPORTED_RECEIVED, (data: { x: number; y: number }) => {
            this.player?.applyTeleport(data.x, data.y);
        });
        subscribeSafe('GameWorld', POSITION_CORRECTED_RECEIVED, (data: { curX: number; curY: number; destX: number; destY: number }) => {
            this.pendingCourseCorrections.push({ curX: data.curX, curY: data.curY, destX: data.destX, destY: data.destY });
        });
        subscribeSafe('GameWorld', PLAYER_PARALYZED_RECEIVED, (data: { durationSeconds: number }) => {
            const seconds = Math.max(0, data.durationSeconds ?? 0);
            this.player?.setParalysisUntil(Date.now() + seconds * 1000);
            this.player?.cancelMovement();
            // Visible feedback — "can attack but not walk" is usually this anti-cheat freeze.
            if (seconds > 0) {
                EventBus.emit(TOAST_REQUESTED, {
                    message: `Movement locked ${seconds}s (speed check). Attacks OK — wait or keep fighting.`,
                    severity: 'warning',
                    autoClose: Math.min(4000, seconds * 1000),
                });
            }
        });
        subscribeSafe('GameWorld', PLAYER_SPAWN_PROTECTION_ENABLED_RECEIVED, (data: { playerId: string }) => {
            this.handleSpawnProtectionEnabled(data);
        });
        subscribeSafe('GameWorld', PLAYER_SPAWN_PROTECTION_DISABLED_RECEIVED, (data: { playerId: string }) => {
            this.handleSpawnProtectionDisabled(data);
        });
        subscribeSafe('GameWorld', TEMPORARY_EFFECT_APPLIED_FOR_PLAYER_RECEIVED, (data: TemporaryEffectPlayerEventData) => {
            this.handleTemporaryEffectAppliedForPlayer(data);
        });
        subscribeSafe('GameWorld', TEMPORARY_EFFECT_EXPIRED_FOR_PLAYER_RECEIVED, (data: TemporaryEffectPlayerEventData) => {
            this.handleTemporaryEffectExpiredForPlayer(data);
        });
        subscribeSafe('GameWorld', TEMPORARY_EFFECT_APPLIED_FOR_MONSTER_RECEIVED, (data: TemporaryEffectMonsterEventData) => {
            this.handleTemporaryEffectAppliedForMonster(data);
        });
        subscribeSafe('GameWorld', TEMPORARY_EFFECT_EXPIRED_FOR_MONSTER_RECEIVED, (data: TemporaryEffectMonsterEventData) => {
            this.handleTemporaryEffectExpiredForMonster(data);
        });
        subscribeSafe('GameWorld', CAST_EFFECT_RECEIVED, (data: { effectKey: string; x: number; y: number }) => {
            this.handleCastEffectAtCell(data);
        });
    }

    private setupMonsterEventListeners(): void {
        // Listen for monster death events to remove them from the game
        subscribeSafe('GameWorld', MONSTER_DEAD, (data: { monsterId: string }) => {
            const monsterIndex = this.monsters.findIndex(m => m.getMonsterId() === data.monsterId);
            if (monsterIndex !== -1) {
                const monster = this.monsters[monsterIndex];

                // Clear player's attack target if it was this monster
                if (this.player && this.player.getAttackTarget() === monster) {
                    this.player.clearAttackTarget();
                }

                // Destroy monster and remove from list
                monster.destroy();
                this.monsters.splice(monsterIndex, 1);
            }
        });

    }

    private setupMapDialogEventListeners(): void {
        // Listen for non-movable cells highlight toggle events from React
        subscribeSafe('GameWorld', IN_UI_TOGGLE_NON_MOVABLE_CELLS_HIGHLIGHT, (enabled: boolean) => {
            const currentMap = this.getCurrentMap();
            if (enabled) {
                currentMap.enableNonMovableCellsHighlight(this);
            } else {
                currentMap.disableNonMovableCellsHighlight();
            }
        });

        // Listen for teleport cells highlight toggle events from React
        subscribeSafe('GameWorld', IN_UI_TOGGLE_TELEPORT_CELLS_HIGHLIGHT, (enabled: boolean) => {
            const currentMap = this.getCurrentMap();
            if (enabled) {
                currentMap.enableTeleportCellsHighlight(this);
            } else {
                currentMap.disableTeleportCellsHighlight();
            }
        });

        subscribeSafe('GameWorld', IN_UI_TOGGLE_SERVER_TELEPORT_CELLS_HIGHLIGHT, (enabled: boolean) => {
            const currentMap = this.getCurrentMap();
            if (enabled) {
                currentMap.enableServerTeleportCellsHighlight(this);
            } else {
                currentMap.disableServerTeleportCellsHighlight();
            }
        });

        // Listen for water cells highlight toggle events from React
        subscribeSafe('GameWorld', IN_UI_TOGGLE_WATER_CELLS_HIGHLIGHT, (enabled: boolean) => {
            const currentMap = this.getCurrentMap();
            if (enabled) {
                currentMap.enableWaterCellsHighlight(this);
            } else {
                currentMap.disableWaterCellsHighlight();
            }
        });

        // Listen for farmable cells highlight toggle events from React
        subscribeSafe('GameWorld', IN_UI_TOGGLE_FARMABLE_CELLS_HIGHLIGHT, (enabled: boolean) => {
            const currentMap = this.getCurrentMap();
            if (enabled) {
                currentMap.enableFarmableCellsHighlight(this);
            } else {
                currentMap.disableFarmableCellsHighlight();
            }
        });

        // Listen for map tiles render toggle events from React
        subscribeSafe('GameWorld', IN_UI_TOGGLE_RENDER_MAP_TILES, (enabled: boolean) => {
            const currentMap = this.getCurrentMap();
            if (enabled) {
                currentMap.renderMapTiles(this);
            } else {
                currentMap.destroyMapTiles(this);
            }
        });

        // Listen for map objects render toggle events from React
        subscribeSafe('GameWorld', IN_UI_TOGGLE_RENDER_MAP_OBJECTS, (enabled: boolean) => {
            const currentMap = this.getCurrentMap();
            if (enabled) {
                currentMap.renderMapObjects(this);
            } else {
                currentMap.destroyMapObjects();
            }
        });

        // Listen for debug mode toggle events from React
        subscribeSafe('GameWorld', IN_UI_TOGGLE_DEBUG_MODE, (enabled: boolean) => {
            setDebugModeEnabled(this, enabled);
        });

        // Listen for grid display toggle events from React (SysMenu Ctrl+G / Map dialog)
        subscribeSafe('GameWorld', IN_UI_TOGGLE_GRID_DISPLAY, (enabled: boolean) => {
            try {
                const currentMap = this.getCurrentMap();
                if (enabled) {
                    currentMap.enableGridDisplay(this);
                } else {
                    currentMap.disableGridDisplay();
                }
            } catch (err) {
                console.warn('[GameWorld] Show Grid toggle failed:', err);
            }
        });

        // Listen for display large items toggle events from React
        subscribeSafe('GameWorld', IN_UI_GROUND_ITEM_DISPLAY_SIZE_CHANGED, (size: import('../../constants/GroundItemDisplay').GroundItemDisplaySize) => {
            setGroundItemDisplaySize(this, size);
        });

        // Listen for weather change events from React (local preview + server request)
        subscribeSafe('GameWorld', IN_UI_CHANGE_WEATHER, (weather: WeatherMode) => {
            this.stopAmbientWeather();
            this.weatherManager?.setWeather(weather);
            getNetworkManager(this.game)?.sendWeatherChangeRequest(weather);
        });
        subscribeSafe('GameWorld', OUT_WEATHER_SYNCED, (weather: WeatherMode) => {
            this.stopAmbientWeather();
            this.weatherManager?.setWeather(weather);
            syncWeather(weather);
        });
        subscribeSafe('GameWorld', IN_UI_RAIN_SOUNDS_CHANGED, (enabled: boolean) => {
            this.weatherManager?.setRainSoundsEnabled(enabled);
        });
    }

    /**
     * When the authoritative map weather is dry, slowly cycle light rain/snow locally
     * so traveler sessions see Olympia-like climate without requiring the GM Map dialog.
     * First precipitation after ~25s; then ~3 min cadence. Server/GM weather stops the cycle.
     */
    private maybeStartAmbientWeather(initial: WeatherMode): void {
        this.stopAmbientWeather();
        if (initial !== 'dry') {
            return;
        }

        this.ambientWeatherActive = true;
        this.ambientWeatherPhase = 0;
        // Short first delay so dry maps show climate without waiting a full ambient period.
        this.ambientWeatherTimer = this.time.delayedCall(25_000, () => {
            if (!this.ambientWeatherActive) {
                return;
            }
            this.tickAmbientWeather();
            this.ambientWeatherTimer = this.time.addEvent({
                delay: 180_000,
                loop: true,
                callback: () => this.tickAmbientWeather(),
            });
        });
    }

    private tickAmbientWeather(): void {
        if (!this.ambientWeatherActive || !this.weatherManager) {
            return;
        }

        const cycle: WeatherMode[] = ['rain-light', 'dry', 'rain-medium', 'dry', 'snow-light', 'dry'];
        const next = cycle[this.ambientWeatherPhase % cycle.length];
        this.ambientWeatherPhase += 1;
        this.weatherManager.setWeather(next);
        syncWeather(next);
    }

    private stopAmbientWeather(): void {
        this.ambientWeatherActive = false;
        this.ambientWeatherTimer?.remove(false);
        this.ambientWeatherTimer = undefined;
    }

    private setupServerDialogEventListeners(): void {
        subscribeSafe('GameWorld', IN_UI_MAKE_SERVER_CELL_OCCUPIED_MODE, () => {
            this.awaitingMakeServerCellOccupiedClick = true;
            this.awaitingPlayerTeleportClick = false;
            this.player?.cancelMovement();
        });

        subscribeSafe('GameWorld', IN_UI_PLAYER_TELEPORT_REQUEST_MODE, () => {
            this.awaitingPlayerTeleportClick = true;
            this.awaitingMakeServerCellOccupiedClick = false;
            this.player?.cancelMovement();
        });

        subscribeSafe('GameWorld', IN_UI_CHANGE_GRACE_PERIOD, (ms: number) => {
            for (const player of this.playersById.values()) {
                if (player !== this.player) {
                    player.setRemoteIdleContinuationGraceMs(ms);
                }
            }
            for (const monster of this.monsters) {
                monster.setRemoteIdleContinuationGraceMs(ms);
            }
        });
    }

    private setupInputManager(): void {
        this.inputManager = new InputManager({
            scene: this,
            isEnabled: () => !this.loadingMap,
            acceptLeftMouseDown: () => this.loadingOverlayController?.getOverlay() === undefined,
            onPointerMove: (worldPixelX, worldPixelY) => {
                this.getCurrentMap().updateHoverCell(this, worldPixelX, worldPixelY);
            },
            onPointerDown: (pointer) => {
                if (this.awaitingMakeServerCellOccupiedClick || this.awaitingPlayerTeleportClick) {
                    return;
                }
                if (pointer.leftButtonDown() && this.player && this.cameras?.main) {
                    if (this.castManager?.getPendingEffectKey() || this.player.hasPendingSpell()) {
                        return;
                    }
                    // LMB down: one attack intent (hold re-swings via handleLeftMouseButton after anim ends).
                    // Do NOT also attack on pointerup — that caused double swings / speed anti-cheat.
                    // Prefer NPC talk on click (Magic Tower / shops) before combat targeting.
                    if (this.cameras?.main) {
                        const cam = this.cameras.main;
                        const wx = pointerWorldPixel(pointer, cam).x;
                        const wy = pointerWorldPixel(pointer, cam).y;
                        const npcUnder = getNpcUnderWorldPixelForHover(this.npcs, wx, wy);
                        if (npcUnder && !npcUnder.isDead()) {
                            this.tryInteractWithNpc(npcUnder);
                            return;
                        }
                    }
                    const attackTarget = this.getAttackableTargetUnderPointer(pointer);
                    if (attackTarget) {
                        this.player.attack(attackTarget);
                    }
                } else if (pointer.rightButtonDown() && this.player) {
                    if (this.castManager?.getPendingEffectKey()) {
                        this.castManager.clearPendingEffect();
                        return;
                    }
                    if (this.player.hasPendingSpell()) {
                        this.player.onRightClick();
                        return;
                    }
                    this.pendingNpcInteraction = undefined;
                    this.pendingGroundPickup = undefined;
                    const rmbTarget = this.getAttackableTargetUnderPointer(pointer);
                    if (rmbTarget) {
                        // Olympia RMB: standstill attack — never pathfind toward the target.
                        this.player.attackStandstill(rmbTarget);
                    } else {
                        this.player.cancelMovement();
                    }
                }
            },
            onPointerUp: (pointer) => {
                if (this.awaitingMakeServerCellOccupiedClick) {
                    this.awaitingMakeServerCellOccupiedClick = false;
                    const camera = this.cameras?.main;
                    if (camera) {
                        const worldPixelX = pointerWorldPixel(pointer, camera).x;
                        const worldPixelY = pointerWorldPixel(pointer, camera).y;
                        const destX = convertPixelPosToWorldPos(worldPixelX);
                        const destY = convertPixelPosToWorldPos(worldPixelY);
                        getNetworkManager(this.game)?.sendMakeCellOccupiedRequest(destX, destY);
                    }
                    return;
                }
                if (this.awaitingPlayerTeleportClick) {
                    this.awaitingPlayerTeleportClick = false;
                    const camera = this.cameras?.main;
                    if (camera) {
                        const worldPixelX = pointerWorldPixel(pointer, camera).x;
                        const worldPixelY = pointerWorldPixel(pointer, camera).y;
                        const destX = convertPixelPosToWorldPos(worldPixelX);
                        const destY = convertPixelPosToWorldPos(worldPixelY);
                        getNetworkManager(this.game)?.sendPlayerTeleportRequested(destX, destY);
                    }
                    return;
                }
                if (!this.player || !this.cameras?.main) {
                    return;
                }
                if (this.suppressLeftMouseMovementUntilRelease) {
                    this.suppressLeftMouseMovementUntilRelease = false;
                    return;
                }
                if (this.castManager?.getPendingEffectKey() || this.player.hasPendingSpell()) {
                    return;
                }
                if (this.castManager?.getCastReady()) {
                    this.castManager.setCastReady(false);
                    return;
                }
                const attackTarget = this.getAttackableTargetUnderPointer(pointer);
                if (attackTarget) {
                    // Attack already started on pointerdown / hold — never re-attack on release
                    // (double packet = two hits + erratic movement anti-cheat).
                    if (!this.player.isParalyzed() &&
                        !this.player.isAttacking() &&
                        !this.player.isInBowStance() &&
                        getDistance(
                            this.player.getWorldX(),
                            this.player.getWorldY(),
                            attackTarget.getWorldX(),
                            attackTarget.getWorldY()
                        ) > this.player.getAttackRange()) {
                        // Path to a free adjacent approach cell — never onto the occupied mob tile.
                        const approach = findApproachCellNearTarget(
                            this.getCurrentMap(),
                            this.player.getWorldX(),
                            this.player.getWorldY(),
                            attackTarget.getWorldX(),
                            attackTarget.getWorldY(),
                            this.player.getAttackRange(),
                        );
                        if (approach) {
                            this.player.setDestination(approach.x, approach.y, false);
                        }
                    }
                    return;
                }
                const camera = this.cameras.main;
                const worldPixelX = pointerWorldPixel(pointer, camera).x;
                const worldPixelY = pointerWorldPixel(pointer, camera).y;
                const npcUnderPointer = getNpcUnderWorldPixelForHover(this.npcs, worldPixelX, worldPixelY);
                if (npcUnderPointer && !npcUnderPointer.isDead()) {
                    this.pendingGroundPickup = undefined;
                    this.tryInteractWithNpc(npcUnderPointer);
                    return;
                }
                this.pendingNpcInteraction = undefined;

                const ctrlHeld = Boolean(
                    pointer.event && 'ctrlKey' in pointer.event && (pointer.event as MouseEvent).ctrlKey,
                );
                const maxPickupItems = ctrlHeld ? 9 : 1;

                // Prefer ground-item cell (authoritative) over raw pixel→tile when the cursor
                // is over loot — sprites/hover can straddle cell edges and feel “uncalibrated”.
                const groundUnder = getGroundItemUnderPointer(this.groundItems, pointer, camera);
                let destX: number;
                let destY: number;
                let walkForPickup = false;
                if (groundUnder) {
                    destX = groundUnder.worldX;
                    destY = groundUnder.worldY;
                    walkForPickup = true;
                } else {
                    destX = convertPixelPosToWorldPos(worldPixelX);
                    destY = convertPixelPosToWorldPos(worldPixelY);
                }

                const distanceToDest = getDistance(
                    this.player.getWorldX(),
                    this.player.getWorldY(),
                    destX,
                    destY
                );
                if (distanceToDest === 0) {
                    // Same cell: pickup (manual stack for non-gold; gold also auto-steps on move).
                    this.pendingGroundPickup = undefined;
                    this.player.requestPickUp(maxPickupItems);
                    return;
                }
                if (walkForPickup) {
                    this.pendingGroundPickup = { worldX: destX, worldY: destY, maxItems: maxPickupItems };
                } else {
                    this.pendingGroundPickup = undefined;
                }

                const map = this.getCurrentMap();
                // Olympia: clicking a wall / non-walkable tile must NOT re-target a spiral
                // "nearest free cell" (that made the char sprint around buildings forever).
                // Adjacent blocked: cancel and face the wall. Far blocked: walk toward the
                // clicked cell and stop when the next step cannot progress (GameObject).
                if (!isCellMovable(map, destX, destY)) {
                    if (this.player.isParalyzed()) {
                        return;
                    }
                    this.player.clearAttackTarget();
                    // Still allow pending pickup if item sits on a tile we can stand on later —
                    // blocked destination cancels walk-for-pickup.
                    this.pendingGroundPickup = undefined;
                    if (distanceToDest < 2) {
                        this.player.cancelMovement();
                        const face = getNextDirection(
                            this.player.getWorldX(),
                            this.player.getWorldY(),
                            destX,
                            destY,
                        );
                        if (face !== Direction.None) {
                            this.player.turnTowardsDirection(face);
                        }
                        return;
                    }
                    // Keep blocked cell as soft goal — processMovement stops without progress.
                    this.player.setDestination(destX, destY, false);
                    return;
                }
                if (distanceToDest < 2) {
                    // Only stop if already mid-step toward that adjacent cell.
                    // Idle players must still be allowed a one-cell step (common after melee).
                    if (this.player.isMoving() && !walkForPickup) {
                        this.player.cancelMovement();
                        return;
                    }
                    if (!this.player.isParalyzed()) {
                        // Direct step for adjacent cell — do not swallow the click.
                        this.player.clearAttackTarget();
                        this.player.setDestination(destX, destY, true);
                    }
                    return;
                }
                if (!this.player.isParalyzed()) {
                    this.player.clearAttackTarget();
                    this.player.setDestination(destX, destY, false);
                }
            }
        });
        this.inputManager.setup();
    }

    private setupCameraStatsUpdateInterval(): void {
        // Track actual cursor position for elementFromPoint - Phaser's pointer can be stale when cursor is over DOM overlays (e.g. inventory dialog)
        const handleMouseMove = (e: MouseEvent) => {
            try {
                this.lastCursorPosition = { x: e.clientX, y: e.clientY };
            } catch (error) {
                console.error('[GameWorld:documentMouseMove]', error);
            }
        };
        document.addEventListener('mousemove', handleMouseMove, { passive: true });
        this.cursorPositionCleanup = () => {
            document.removeEventListener('mousemove', handleMouseMove);
        };

        // Set up interval to emit FPS, camera position, and player position updates every 20ms
        this.updateInterval = window.setInterval(() => {
            // Check if game, cameras, and main camera are still valid
            if (!this.game || !this.cameras || !this.cameras.main) {
                return;
            }

            try {
                const fps = Math.round(this.game.loop.actualFps);
                const networkManager = getNetworkManager(this.game);
                const ping = networkManager?.getLatestPing();
                const pingVariance = networkManager?.getLatestPingVariance();
                const queueLengths = networkManager?.getLatestQueueLengths();
                const camX = Math.round(this.cameras.main.scrollX);
                const camY = Math.round(this.cameras.main.scrollY);

                // Include player position if player exists
                let playerSceneX: number | undefined = undefined;
                let playerSceneY: number | undefined = undefined;
                let playerWorldX: number | undefined = undefined;
                let playerWorldY: number | undefined = undefined;

                let playerGender: Gender | undefined = undefined;
                if (this.player) {
                    playerSceneX = Math.round(this.player.getPixelX());
                    playerSceneY = Math.round(this.player.getPixelY());
                    playerWorldX = this.player.getWorldX();
                    playerWorldY = this.player.getWorldY();
                    playerGender = this.player.getGender();
                    setCharacterStats({
                        isPoisoned: this.player.hasTemporaryEffect(TemporaryEffectType.Poison),
                    });
                    this.syncEnemySkullMarkers();
                }

                EventBus.emit(OUT_UI_GAME_STATS_UPDATE, {
                    fps,
                    ping,
                    pingVariance,
                    gameWorldQueueLength: queueLengths?.gameWorldQueueLength,
                    playersInMap: queueLengths?.playersInMap,
                    cameraX: camX,
                    cameraY: camY,
                    playerSceneX,
                    playerSceneY,
                    playerWorldX,
                    playerWorldY,
                    playerGender,
                });

                // Broadcast combat-target and ground-item hover state
                const pointer = this.input.activePointer;
                const hoveredAttackTarget = pointer ? this.getAttackableTargetUnderPointer(pointer) : undefined;
                const hoveredMonster =
                    pointer && this.cameras?.main
                        ? getMonsterUnderWorldPixelForHoverUi(
                            this.monsters,
                            pointerWorldPixel(pointer, this.cameras.main).x,
                            pointerWorldPixel(pointer, this.cameras.main).y,
                        )
                        : undefined;
                const liveMonsterForHover = hoveredMonster && !hoveredMonster.isDead() ? hoveredMonster : undefined;
                const hoveredNpcForHover =
                    pointer && this.cameras?.main
                        ? getNpcUnderWorldPixelForHover(
                            this.npcs,
                            pointerWorldPixel(pointer, this.cameras.main).x,
                            pointerWorldPixel(pointer, this.cameras.main).y,
                        )
                        : undefined;
                const liveNpcForHover = hoveredNpcForHover && !hoveredNpcForHover.isDead() ? hoveredNpcForHover : undefined;
                const hoveredPlayerForHover =
                    pointer && this.cameras?.main
                        ? getPlayerUnderWorldPixelForHover(
                            this.playersById,
                            pointerWorldPixel(pointer, this.cameras.main).x,
                            pointerWorldPixel(pointer, this.cameras.main).y,
                        )
                        : undefined;
                const hoveredGroundItem =
                    pointer && this.cameras?.main
                        ? getGroundItemUnderPointer(this.groundItems, pointer, this.cameras.main)
                        : undefined;
                EventBus.emit(OUT_UI_HOVER_ATTACKABLE_TARGET, !!hoveredAttackTarget);
                EventBus.emit(OUT_UI_HOVER_GROUND_ITEM, !!hoveredGroundItem);
                // Use actual cursor position for elementFromPoint - Phaser's pointer can be stale when cursor is over DOM overlays (inventory, etc.)
                const checkX = this.lastCursorPosition?.x ?? (pointer ? canvasToScreenPosition(pointer.x, pointer.y, this.game).screenX : 0);
                const checkY = this.lastCursorPosition?.y ?? (pointer ? canvasToScreenPosition(pointer.x, pointer.y, this.game).screenY : 0);
                const el = document.elementFromPoint(checkX, checkY);
                if (el === this.game.canvas && pointer) {
                    const { screenX, screenY } = canvasToScreenPosition(pointer.x, pointer.y, this.game);
                    EventBus.emit(
                        OUT_UI_HOVER_GROUND_ITEM_INFO,
                        hoveredGroundItem ? hoveredGroundItem.getHoverInfo(screenX, screenY) : undefined
                    );
                }
                let showMonsterHover = false;
                let showNpcHover = false;
                let showPlayerHover = false;
                let monsterHoverInfo: MonsterHoverInfo | undefined;
                let npcHoverInfo: NpcHoverInfo | undefined;
                let playerHoverInfo: PlayerHoverInfo | undefined;

                type HoverPick =
                    | { kind: 'npc'; depth: number; npc: NPC }
                    | { kind: 'monster'; depth: number; monster: Monster }
                    | { kind: 'player'; depth: number; player: Player };

                const hoverCandidates: HoverPick[] = [];
                if (liveNpcForHover) {
                    hoverCandidates.push({ kind: 'npc', depth: liveNpcForHover.getDepth(), npc: liveNpcForHover });
                }
                if (liveMonsterForHover) {
                    hoverCandidates.push({
                        kind: 'monster',
                        depth: liveMonsterForHover.getDepth(),
                        monster: liveMonsterForHover,
                    });
                }
                if (hoveredPlayerForHover) {
                    hoverCandidates.push({
                        kind: 'player',
                        depth: hoveredPlayerForHover.getDepth(),
                        player: hoveredPlayerForHover,
                    });
                }

                if (hoverCandidates.length > 0) {
                    const top = hoverCandidates.reduce((a, b) => (a.depth >= b.depth ? a : b));
                    switch (top.kind) {
                        case 'npc': {
                            showNpcHover = true;
                            const anchorX = top.npc.getAnimatedPixelX();
                            const anchorY = top.npc.getAnimatedPixelY() + MONSTER_HOVER_OVERLAY_ANCHOR_OFFSET_Y;
                            const camera = this.cameras.main;
                            const canvasX = anchorX - camera.scrollX;
                            const canvasY = anchorY - camera.scrollY;
                            const { screenX: overlayScreenX, screenY: overlayScreenY } = canvasToScreenPosition(
                                canvasX,
                                canvasY,
                                this.game,
                            );
                            npcHoverInfo = {
                                name: top.npc.getDisplayName(),
                                overlayScreenX,
                                overlayScreenY,
                            };
                            break;
                        }
                        case 'monster': {
                            showMonsterHover = true;
                            monsterHoverInfo = this.buildMonsterTargetHoverInfo(top.monster);
                            break;
                        }
                        case 'player': {
                            showPlayerHover = true;
                            // Olympia DrawObjectName(sX, sY): sX/sY = character draw pos (feet pivot).
                            // Prefer body sprite bottom (visual feet); fall back to cell-center base.
                            const bodyBounds = top.player.getBounds();
                            const anchorX = top.player.getAnimatedPixelX();
                            const feetY = bodyBounds
                                ? bodyBounds.y + bodyBounds.height
                                : top.player.getAnimatedPixelY();
                            const anchorY = feetY + PLAYER_HOVER_OVERLAY_ANCHOR_OFFSET_Y;
                            const camera = this.cameras.main;
                            const canvasX = anchorX - camera.scrollX;
                            const canvasY = anchorY - camera.scrollY;
                            const { screenX: overlayScreenX, screenY: overlayScreenY } = canvasToScreenPosition(
                                canvasX,
                                canvasY,
                                this.game,
                            );
                            const hoverDisplay = buildPlayerHoverDisplay(top.player, this.player);
                            const confusedName = this.resolveConfusedPlayerNameDisplay(
                                top.player.getCharacterName(),
                                top.player.getPlayerId() ?? top.player.getCharacterName(),
                            );
                            // Illusion: classic replaces the base name with "?????" (suffixes stay via buildPlayerHoverDisplay).
                            if (confusedName !== top.player.getCharacterName()) {
                                const suffix = hoverDisplay.displayName.slice(top.player.getCharacterName().length);
                                hoverDisplay.displayName = `${confusedName}${suffix}`;
                            }
                            playerHoverInfo = {
                                displayName: hoverDisplay.displayName,
                                guildLine: hoverDisplay.guildLine,
                                affiliation: hoverDisplay.affiliation,
                                affiliationColor: hoverDisplay.affiliationColor,
                                // Classic: FOE enemy = red affiliation only (no skull row above feet).
                                showEnemySkull: false,
                                overlayScreenX,
                                overlayScreenY,
                            };
                            break;
                        }
                    }
                } else {
                    // Keep Olympia target HP bar while attacking even if the cursor left the mob.
                    const attackTarget = this.player?.getAttackTarget();
                    if (
                        attackTarget &&
                        !attackTarget.isDead() &&
                        attackTarget instanceof Monster
                    ) {
                        showMonsterHover = true;
                        monsterHoverInfo = this.buildMonsterTargetHoverInfo(attackTarget);
                    }
                }

                EventBus.emit(OUT_UI_HOVER_MONSTER, showMonsterHover ? monsterHoverInfo : undefined);
                EventBus.emit(OUT_UI_HOVER_NPC, showNpcHover ? npcHoverInfo : undefined);
                EventBus.emit(OUT_UI_HOVER_PLAYER, showPlayerHover ? playerHoverInfo : undefined);
            } catch (error) {
                console.warn('Failed to update game stats:', error);
            }
        }, GAME_STATS_UPDATE_INTERVAL_MS);
    }

    private initializeGameObjects(): void {
        const gameStateManager = getGameStateManager(this.game);
        const map = this.getCurrentMap();

        let playerWorldX: number;
        let playerWorldY: number;

        if (this.initialGameWorldState) {
            if (this.initialGameWorldState.playerX === -1 || this.initialGameWorldState.playerY === -1) {
                // Traveler default map: inland hub, never raw map-center (coastal shore south of ~y104).
                const pendingMapId = normalizeMapId(this.initialGameWorldState.mapName ?? map.fileName);
                if (this.gameWorldId === 'traveler' || pendingMapId === 'default') {
                    playerWorldX = 90;
                    playerWorldY = 80;
                    console.log(`[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Map change, using traveler hub:`, {
                        playerWorldX,
                        playerWorldY,
                    });
                } else {
                    playerWorldX = Math.floor(map.sizeX / 2);
                    playerWorldY = Math.floor(map.sizeY / 2);
                    console.log(`[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Map change, using center position:`, {
                        playerWorldX,
                        playerWorldY,
                    });
                }
            } else {
                playerWorldX = this.initialGameWorldState.playerX;
                playerWorldY = this.initialGameWorldState.playerY;
                console.log(`[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Using server-provided coordinates:`, { playerWorldX, playerWorldY });
            }
        } else {
            const pendingMapId = normalizeMapId(map.fileName);
            if (this.gameWorldId === 'traveler' || pendingMapId === 'default') {
                playerWorldX = 90;
                playerWorldY = 80;
                console.log(`[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] No initial state, using traveler hub:`, {
                    playerWorldX,
                    playerWorldY,
                });
            } else {
                playerWorldX = Math.floor(map.sizeX / 2);
                playerWorldY = Math.floor(map.sizeY / 2);
                console.log(`[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] No initial state, using center position:`, {
                    playerWorldX,
                    playerWorldY,
                });
            }
        }

        // Check if the calculated position is movable dry land; if not find nearest movable location
        const mapId = this.initialGameWorldState?.mapName ?? map.fileName;
        const normalizedMapId = normalizeMapId(mapId);
        const isTravelerMap = this.gameWorldId === 'traveler' || normalizedMapId === 'default';

        // Traveler: hard-force inland hub whenever the tile is wet/blocked — never spiral toward shore.
        if (isTravelerMap) {
            const tile = map.getTile(playerWorldX, playerWorldY);
            if (!tile || !tile.isMoveAllowed || tile.isWater) {
                playerWorldX = 90;
                playerWorldY = 80;
                console.log(`[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Traveler wet/blocked spawn — forcing hub:`, {
                    playerWorldX,
                    playerWorldY,
                });
            }
        }

        const initialTile = map.getTile(playerWorldX, playerWorldY);
        if (!initialTile || !initialTile.isMoveAllowed || initialTile.isWater) {
            if (isTravelerMap) {
                playerWorldX = 90;
                playerWorldY = 80;
            } else {
                console.log(`[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Initial position is not movable/dry, searching for movable location...`);
                const movableLocation = findMovableLocation(map, playerWorldX, playerWorldY);
                if (movableLocation) {
                    playerWorldX = movableLocation.x;
                    playerWorldY = movableLocation.y;
                    console.log(`[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Found movable location:`, { playerWorldX, playerWorldY });
                } else {
                    console.warn(`[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] No movable location found near initial position, using original coordinates`);
                }
            }
        }

        // Avoid landing on or adjacent to warp tiles (prevents enter/exit loops).
        // Traveler: if safe-spawn still wet, snap hub again (never accept shore).
        const safeSpawn = resolveSafePlayerSpawn(map, normalizedMapId, playerWorldX, playerWorldY);
        playerWorldX = safeSpawn.x;
        playerWorldY = safeSpawn.y;
        if (isTravelerMap) {
            const afterSafe = map.getTile(playerWorldX, playerWorldY);
            if (!afterSafe || !afterSafe.isMoveAllowed || afterSafe.isWater) {
                playerWorldX = 90;
                playerWorldY = 80;
            }
        }

        this.selfPlayerId = this.initialGameWorldState?.playerId;

        let initialPlayerDirection = Direction.NorthEast;
        const direction = this.initialGameWorldState?.playerDirection;
        if (direction !== undefined) {
            const resolvedDirection = toDirection(direction);
            if (resolvedDirection !== Direction.None) {
                initialPlayerDirection = resolvedDirection;
            }
        }

        const initialMovementSpeedMs =
            this.initialGameWorldState?.movementSpeedMs !== undefined && this.initialGameWorldState.movementSpeedMs > 0
                ? this.initialGameWorldState.movementSpeedMs
                : playerDialogStore.state.movementSpeed;

        // Create player at server-provided or fallback center position.
        // Never let equip-layer texture errors black-screen the world.
        try {
            this.player = new Player(
                this,
                playerWorldX,
                playerWorldY,
                initialPlayerDirection,
                this.soundManager,
                map,
                this.createDefaultPlayerGear(),
                initialMovementSpeedMs,
            );
        } catch (error) {
            console.error('[GameWorld] Player create failed (retry naked body):', error);
            this.player = new Player(
                this,
                playerWorldX,
                playerWorldY,
                initialPlayerDirection,
                this.soundManager,
                map,
                {
                    human: 'wm',
                    underwearColorIndex: 0,
                    hairStyleIndex: 0,
                },
                initialMovementSpeedMs,
            );
        }
        if (this.selfPlayerId) {
            this.player.setPlayerId(this.selfPlayerId);
            this.playersById.set(this.selfPlayerId, this.player);
        }
        const savedCharacterName = getGameStateManager(this.game).getCharacterName();
        if (savedCharacterName) {
            this.player.setCharacterName(savedCharacterName);
        }
        setPlayerPosition(this.game, playerWorldX, playerWorldY);

        const runMode = this.initialGameWorldState?.runMode ?? playerDialogStore.state.runMode;
        this.player.setRunMode(runMode);

        const igw = this.initialGameWorldState;
        if (igw?.attackRangeCells !== undefined && igw.attackRangeCells > 0) {
            this.player.setAttackRange(igw.attackRangeCells);
        } else {
            this.player.setAttackRange(playerDialogStore.state.attackRange);
        }
        if (igw?.attackSpeedMs !== undefined && igw.attackSpeedMs > 0) {
            this.player.setAttackSpeedFromDurationMs(igw.attackSpeedMs);
        } else {
            this.player.setAttackSpeedFromDurationMs(playerDialogStore.state.attackSpeedMs);
        }
        if (igw?.arrowSpeedPxPerSec !== undefined && igw.arrowSpeedPxPerSec > 0) {
            this.arrowSpeedPxPerSec = igw.arrowSpeedPxPerSec;
            this.player.setArrowSpeedPxPerSec(igw.arrowSpeedPxPerSec);
        } else {
            this.arrowSpeedPxPerSec = 1000;
            this.player.setArrowSpeedPxPerSec(1000);
        }
        const attackType = igw?.attackType !== undefined
            ? igw.attackType as AttackType
            : playerDialogStore.state.attackType;
        this.player.setAttackType(attackType);
        if (igw?.castSpeedMs !== undefined && igw.castSpeedMs >= 200 && igw.castSpeedMs <= 2000) {
            this.player.setCastDurationMs(igw.castSpeedMs);
        } else {
            this.player.setCastDurationMs(playerDialogStore.state.castSpeedMs);
        }
        const igwHp = this.initialGameWorldState?.hp;
        const igwMaxHp = this.initialGameWorldState?.maxHp;
        if (igwHp !== undefined && igwMaxHp !== undefined) {
            this.player.setHp(igwHp, igwMaxHp);
        }
        if (this.initialGameWorldState?.dead) {
            this.player.applySpawnedDeathState();
        }
        setDeathDialogOpen(this.initialGameWorldState?.dead === true);
        const attackMode = this.initialGameWorldState?.attackMode !== undefined
            ? this.initialGameWorldState.attackMode
            : playerDialogStore.state.attackMode;
        this.player.setAttackMode(attackMode);
        const citizenshipSide = this.initialGameWorldState?.citizenshipSide
            ?? (characterDialogStore.state.stats.faction === 'Aresden'
                ? 'aresden'
                : characterDialogStore.state.stats.faction === 'Elvine'
                  ? 'elvine'
                  : 'traveler');
        this.player.setCitizenshipSide(citizenshipSide);

        const pickupMs = this.initialGameWorldState?.playerPickupAnimationTimeMs;
        if (pickupMs !== undefined && pickupMs > 0) {
            this.player.setPlayerPickupAnimationMs(pickupMs);
        }
        const bowMs = this.initialGameWorldState?.playerBowAnimationDurationMs;
        if (bowMs !== undefined && bowMs > 0) {
            this.player.setPlayerBowAnimationDurationMs(bowMs);
        }

        const networkManager = getNetworkManager(this.game);
        const applySpawnProtection = this.pendingSpawnProtectionForSelf || networkManager?.getAndClearPendingSpawnProtectionForSelf();
        if (applySpawnProtection) {
            this.pendingSpawnProtectionForSelf = false;
            this.player.setSpawnProtectionEffect(true);
        }

        // Apply saved music/sound volume from GameStateManager
        const savedMusicVolume = gameStateManager.getMusicVolume();
        getMusicManager(this).setMusicVolume(savedMusicVolume);

        const savedSoundVolume = gameStateManager.getSoundVolume();
        this.soundManager.setSoundVolume(savedSoundVolume);

        // Center camera around player
        this.cameraManager?.centerOn(convertWorldPosToPixelPos(playerWorldX), convertWorldPosToPixelPos(playerWorldY));
    }

    /**
     * Initializes game objects (player and NPCs) after minimap capture is complete.
     * This is called by captureMinimap() to ensure objects don't appear in the minimap.
     */
    private createDefaultPlayerGear() {
        return {
            ...DEFAULT_GEAR,
            underwearColorIndex: playerDialogStore.state.underwearColorIndex,
            hairStyleIndex: playerDialogStore.state.hairStyleIndex,
        };
    }

    private syncMonstersFromNetworkState(): void {
        const inView = getNetworkManager(this.game)?.getMonstersInViewState() ?? [];
        for (const entry of inView) {
            this.handleMonsterEnteredRange(entry);
        }
    }

    private syncNpcsFromNetworkState(): void {
        const inView = getNetworkManager(this.game)?.getNpcsInViewState() ?? [];
        for (const entry of inView) {
            this.handleNpcEnteredRange(entry);
        }
    }

    private syncGroundStatesFromNetworkState(): void {
        const groundStates = getNetworkManager(this.game)?.getGroundStatesInViewState() ?? [];
        this.handleGroundStatesEnteredRange(groundStates);
    }

    private syncOtherPlayersFromNetworkState(): void {
        const otherPlayers = getNetworkManager(this.game)?.getOtherPlayersState() ?? [];
        for (const otherPlayer of otherPlayers) {
            this.handlePlayerEnteredRange(otherPlayer);
        }
    }

    private tryFinalizeMapSetup(): void {
        if (this.awaitingTransferredWorldState) {
            this.tryConsumePendingTransferredWorldState();
        }
        if (!this.pendingLoadedMap) {
            return;
        }
        if (this.awaitingTransferredWorldState) {
            return;
        }

        const map = this.pendingLoadedMap;
        const expectedMapId = normalizeMapId(this.initialGameWorldState?.mapName ?? this.mapManager?.getCurrentMapName() ?? '');
        const loadedMapId = normalizeMapId(map.fileName.replace(/^map-/, ''));
        if (expectedMapId && loadedMapId && expectedMapId !== loadedMapId) {
            console.warn(
                `[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Discarding stale map '${loadedMapId}' (expected '${expectedMapId}') — reloading`,
            );
            this.pendingLoadedMap = undefined;
            this.loadingMap = true;
            void this.runDeferredMapLoad();
            return;
        }

        this.pendingLoadedMap = undefined;
        try {
            this.setupMap(map);
            EventBus.emit(OUT_MAP_LOADED);
            if (this.gameWorldId) {
                EventBus.emit(OUT_UI_SET_SELECTED_MAP, this.gameWorldId);
            }
        } catch (error) {
            // Log full stack — "Map setup failed" without cause hid real bugs (player gear, camera, etc.).
            console.error('[GameWorld] setupMap failed:', error);
            if (error instanceof Error && error.stack) {
                console.error('[GameWorld] setupMap stack:', error.stack);
            }
            // Keep map painted if tiles already exist; still clear overlay so player is not stuck on black loading.
            this.loadingMap = false;
            try {
                this.cameraManager?.setZoom(1);
            } catch {
                /* ignore */
            }
            this.forceClearLoadingOverlay(
                `Map setup failed: ${error instanceof Error ? error.message : String(error)}. Try F5 / hard refresh.`,
            );
        }
    }

    /**
     * Completes map setup after minimap capture by initializing game objects
     * and setting up overlay removal timing.
     * This is called AFTER the minimap snapshot has been taken, so it's safe to apply the saved zoom here.
     */
    private setupMap(map: HBMap): void {
        this.displayedMap = map;
        // Now initialize game objects (player, NPCs, etc.)
        this.initializeGameObjects();

        // Apply camera zoom AFTER minimap snapshot has been taken
        // This ensures the zoom is applied to the main camera, not the minimap snapshot camera
        // Get camera zoom from GameStateManager (saved zoom level as percentage 20-200, where 100 = zoom 1.0)
        const gameStateManager = getGameStateManager(this.game);
        const savedCameraZoom = gameStateManager.getCameraZoom();
        // Convert percentage to zoom value (e.g., 100% = 1.0, 50% = 0.5, 200% = 2.0)
        // Guard NaN/0/out-of-range — bad localStorage zoom used to abort setupMap and stick players.
        let cameraZoom = typeof savedCameraZoom === 'number' && Number.isFinite(savedCameraZoom)
            ? savedCameraZoom / 100
            : 1;
        if (!Number.isFinite(cameraZoom) || cameraZoom < 0.2 || cameraZoom > 2.5) {
            cameraZoom = 1;
        }
        this.cameraManager?.setZoom(cameraZoom);
        console.log(`[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Applied saved camera zoom after minimap snapshot:`, savedCameraZoom, '% =', cameraZoom);

        // Defer overlay removal using frame-based approach
        // Wait many frames after camera restoration to ensure no flash is visible
        this.loadingOverlayController?.scheduleRemovalAfterMapReady();

        // Map has been fully loaded
        this.loadingMap = false;
        MapWarpSystem.getInstance().beginPostLoadGrace();
        // Never leave warp/water debug overlays on after map load (yellow/blue boxes hide the world).
        map.disableTeleportCellsHighlight();
        map.disableServerTeleportCellsHighlight();
        map.disableWaterCellsHighlight();
        this.syncMonstersFromNetworkState();
        this.syncNpcsFromNetworkState();
        this.syncGroundStatesFromNetworkState();
        this.syncOtherPlayersFromNetworkState();
        this.tryPushWorldTeleportCellsToCurrentMap();
        // DISABLED: bulk hunt-pit .spr preload + canvas toDataURL thrashed React/GPU and
        // froze the browser (felt like "everything broke"). Pit markers still show as
        // letter labels; thumbs only when a live monster of that type enters view.
    }

    /**
     * Extract south-idle frame for minimap when a live monster is already loaded.
     * Never loads packs just for the guide map.
     */
    private emitMonsterMinimapThumb(sprite: string): boolean {
        try {
            const dataUrl = extractMonsterMinimapThumbDataUrl(this, sprite);
            if (dataUrl) {
                EventBus.emit(OUT_SPRITE_FRAME_EXTRACTED, `minimap-mob-${sprite}`, dataUrl);
                return true;
            }
        } catch {
            /* ignore — pit fallback letters are fine */
        }
        return false;
    }

    private setTeleportLocs(teleportLocs: TeleportLocSet[] | undefined): void {
        this.teleportTargetsBySourceCell.clear();
        this.lastTeleportLocSets = teleportLocs ? [...teleportLocs] : [];
        if (!teleportLocs?.length) {
            this.tryPushWorldTeleportCellsToCurrentMap();
            return;
        }

        for (const teleportLoc of teleportLocs) {
            for (const loc of teleportLoc.locs) {
                const cellKey = this.getTeleportCellKey(loc.x, loc.y);
                if (this.teleportTargetsBySourceCell.has(cellKey)) {
                    const existing = this.teleportTargetsBySourceCell.get(cellKey);
                    console.warn(
                        `[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Duplicate teleport cell (${loc.x}, ${loc.y}): ` +
                        `keeping ${existing?.worldId}, ignoring ${teleportLoc.target.worldId}`,
                    );
                    continue;
                }
                this.teleportTargetsBySourceCell.set(cellKey, teleportLoc.target);
            }
        }
        this.tryPushWorldTeleportCellsToCurrentMap();
    }

    /**
     * Pushes server teleport source cells (from InitialGameWorldState via NetworkManager) onto the loaded map for debug overlay.
     */
    private tryPushWorldTeleportCellsToCurrentMap(): void {
        if (!this.mapManager) {
            return;
        }
        try {
            const mapName = this.mapManager.getCurrentMapName();
            const currentMap = getMapIfPresent(this, mapName);
            if (!currentMap) {
                // Teleport locs often arrive in init before lazy `prepareMapForGameWorld` registers the map;
                // `setupMap` calls this again once the HBMap exists.
                return;
            }
            currentMap.setServerTeleportSourceCells(getTeleportSourceCellsFromLocSets(this.lastTeleportLocSets));
            if (mapDialogStore.state.showServerTeleportCells) {
                currentMap.enableServerTeleportCellsHighlight(this);
            } else {
                currentMap.disableServerTeleportCellsHighlight();
            }
        } catch (error) {
            console.warn(
                `[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Could not sync server teleport cells:`,
                error,
            );
        }
    }

    private getTeleportCellKey(x: number, y: number): string {
        return `${x},${y}`;
    }

    private tryConsumePendingTransferredWorldState(): boolean {
        const nm = getNetworkManager(this.game);
        // Peek without clearing until we decide — NetworkManager only has getAndClear.
        const pendingInitialGameWorldState = nm?.getAndClearPendingInitialGameWorldState();
        if (!pendingInitialGameWorldState) {
            return false;
        }

        // Map/world changes must full-restart. Applying city spawn coords (e.g. Aresden 149,127)
        // onto the still-loaded traveler `default` map places the player in water (sprite 19).
        // Also force restart when world id changed even if mapName string matches (barracks floors).
        const nextState = toRegistryInitialGameWorldState(pendingInitialGameWorldState);
        const currentMapId = normalizeMapId(this.initialGameWorldState?.mapName ?? '');
        const nextMapId = normalizeMapId(nextState.mapName);
        const worldChanged =
            !!pendingInitialGameWorldState.gameWorldId &&
            pendingInitialGameWorldState.gameWorldId !== this.gameWorldId;
        const mapChanged =
            nextMapId !== '' && currentMapId !== '' && nextMapId !== currentMapId;

        if (worldChanged || mapChanged) {
            this.restartOntoTransferredWorld(nextState, worldChanged ? 'world-id-change' : 'map-name-change');
            return true;
        }

        this.applyTransferredWorldState(pendingInitialGameWorldState);
        return true;
    }

    /**
     * Tears down in-flight map load and restarts GameWorld onto the server's new world/map.
     * Avoids painting traveler `default` tiles at city plaza coordinates.
     */
    private restartOntoTransferredWorld(initialGameWorldState: InitialGameWorldState, reason: string): void {
        console.log(
            `[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Restarting onto '${initialGameWorldState.gameWorldId}' (${initialGameWorldState.mapName}) [${reason}]`,
        );
        this.clearWorldTransferWatchdog();
        this.clearPendingRequestedWorldChangeListener();
        this.awaitingTransferredWorldState = false;
        this.pendingPredictedWorldTransfer = false;
        this.pendingLoadedMap = undefined;
        getGameStateManager(this.game).saveGameState();
        setInitialGameWorldState(this.game, initialGameWorldState);
        this.scene.restart({ initialGameWorldState });
    }

    private applyTransferredWorldState(data: InitialGameWorldStateEventData): void {
        this.clearWorldTransferWatchdog();
        this.awaitingTransferredWorldState = false;
        this.pendingPredictedWorldTransfer = false;
        this.initialGameWorldState = toRegistryInitialGameWorldState(data);
        setInitialGameWorldState(this.game, this.initialGameWorldState);
        this.mapManager?.setInitialMapName(this.initialGameWorldState.mapName);
        this.mapManager?.setInitialFocusTile(
            this.initialGameWorldState.playerX,
            this.initialGameWorldState.playerY,
        );
        this.mapManager?.setInitialMusicFile(data.musicFile);
        if (this.playMapMusic && data.musicFile) {
            this.mapManager?.playInitialMusic();
        }
        this.gameWorldId = data.gameWorldId;
        this.setTeleportLocs(data.teleportLocs);
        if (data.weather !== undefined) {
            this.stopAmbientWeather();
            this.weatherManager?.setWeather(data.weather);
            syncWeather(data.weather);
            this.maybeStartAmbientWeather(data.weather);
        }
        // NetworkManager already cleared in-view caches on IGWS and emits leave events;
        // rebuild remotes/ground/NPC/monsters from whatever has been re-filled so far.
        if (!this.loadingMap && this.mapManager) {
            this.syncMonstersFromNetworkState();
            this.syncNpcsFromNetworkState();
            this.syncGroundStatesFromNetworkState();
            this.syncOtherPlayersFromNetworkState();
        }
    }

    private beginWorldTransfer(worldId: string, _mapName: string): void {
        if (!worldId || worldId === this.gameWorldId) {
            return;
        }
        if (this.pendingPredictedWorldTransfer || this.awaitingTransferredWorldState) {
            return;
        }

        const networkManager = getNetworkManager(this.game);
        if (!networkManager) {
            console.warn(`[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Cannot change world: network manager not found`);
            return;
        }

        this.pendingNpcInteraction = undefined;
        this.pendingPredictedWorldTransfer = true;
        this.awaitingTransferredWorldState = true;
        MapWarpSystem.getInstance().markWarpTriggered();
        this.armWorldTransferWatchdog(worldId);

        this.clearPendingRequestedWorldChangeListener();
        this.pendingRequestedWorldChangeListener = (data: InitialGameWorldStateEventData) => {
            try {
                if (data.gameWorldId !== worldId) {
                    return;
                }

                // Consume pending so update()/tryFinalize cannot paint the old .amd at new coords.
                getNetworkManager(this.game)?.clearPendingInitialGameWorldState();
                this.restartOntoTransferredWorld(toRegistryInitialGameWorldState(data), 'warp-transfer');
            } catch (error) {
                console.error('[GameWorld:beginWorldTransfer]', error);
                this.clearPendingWorldTransfer('beginWorldTransfer listener error');
            }
        };
        EventBus.on(INITIAL_GAME_WORLD_STATE_RECEIVED, this.pendingRequestedWorldChangeListener);
        networkManager.requestWorldChange(worldId, false, true);
    }

    /** Arms a short watchdog so a silent server reject cannot permanently disable building doors. */
    private armWorldTransferWatchdog(worldId: string): void {
        this.clearWorldTransferWatchdog();
        this.worldTransferWatchdog = this.time.delayedCall(5000, () => {
            this.worldTransferWatchdog = undefined;
            if (!this.awaitingTransferredWorldState && !this.pendingPredictedWorldTransfer) {
                return;
            }
            console.warn(
                `[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] World transfer to '${worldId}' timed out; clearing pending warp state so doors can retry.`,
            );
            this.clearPendingWorldTransfer('watchdog timeout');
        });
    }

    private clearWorldTransferWatchdog(): void {
        if (!this.worldTransferWatchdog) {
            return;
        }
        this.worldTransferWatchdog.remove(false);
        this.worldTransferWatchdog = undefined;
    }

    private clearPendingWorldTransfer(_reason: string): void {
        this.clearWorldTransferWatchdog();
        this.clearPendingRequestedWorldChangeListener();
        this.pendingPredictedWorldTransfer = false;
        this.awaitingTransferredWorldState = false;
    }

    private beginRequestedWorldChange(worldId: string, validateTeleport = false): void {
        if (!worldId || worldId === this.gameWorldId) {
            return;
        }
        if (this.pendingPredictedWorldTransfer || this.awaitingTransferredWorldState) {
            return;
        }

        const networkManager = getNetworkManager(this.game);
        if (!networkManager) {
            console.warn(`[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Cannot request world change: network manager not found`);
            return;
        }

        this.clearPendingRequestedWorldChangeListener();
        this.pendingPredictedWorldTransfer = true;
        this.awaitingTransferredWorldState = true;
        this.armWorldTransferWatchdog(worldId);
        this.pendingRequestedWorldChangeListener = (data: InitialGameWorldStateEventData) => {
            try {
                if (data.gameWorldId !== worldId) {
                    return;
                }

                getNetworkManager(this.game)?.clearPendingInitialGameWorldState();
                this.restartOntoTransferredWorld(toRegistryInitialGameWorldState(data), 'requested-world-change');
            } catch (error) {
                console.error('[GameWorld:pendingRequestedWorldChange]', error);
                this.clearPendingWorldTransfer('requested-world-change listener error');
            }
        };
        EventBus.on(INITIAL_GAME_WORLD_STATE_RECEIVED, this.pendingRequestedWorldChangeListener);
        networkManager.requestWorldChange(worldId, false, validateTeleport);
    }

    private syncPlayerAppearance(): void {
        getNetworkManager(this.game)?.changePlayerAppearance(
            playerDialogStore.state.gender,
            playerDialogStore.state.skinColor,
            playerDialogStore.state.hairStyleIndex,
            playerDialogStore.state.underwearColorIndex,
        );
    }

    /**
     * Called every frame by Phaser. Updates game objects.
     * 
     * @param _time - Total elapsed time in milliseconds (unused)
     * @param delta - Time elapsed since last frame in milliseconds
     */
    public update(_time: number, delta: number): void {
        runSafeSync('GameWorld:update', () => {
            // Consume server world transfers always (door warps AND Recall / death / etc.).
            // Previously only checked when awaitingTransferredWorldState was set by door warps,
            // so Recall left IGWS pending → black map + coordinate desync.
            if (this.tryConsumePendingTransferredWorldState()) {
                if (this.pendingLoadedMap) {
                    this.tryFinalizeMapSetup();
                }
            }
            this.handleOverlayUpdate();

            // Defer initialization to first update() call so overlay is visible first frame
            if (!this.initializationStarted) {
                this.drawLoadingOverlay(() => {
                    void this.runDeferredMapLoad();
                });
                return; // Return early to let overlay render
            }

            // Update player movement
            if (this.player) {
                // Process pending course corrections before player update to avoid snapping to blocked cell
                for (const correction of this.pendingCourseCorrections) {
                    this.player.adjustCourse(correction.curX, correction.curY, correction.destX, correction.destY);
                }
                this.pendingCourseCorrections = [];

                this.player.update(delta);
                this.handleLeftMouseButton();
                this.handleRightMouseButton();
                this.cameraManager?.update();
                void this.mapManager?.syncStreamedView();
                this.handleMapObjectCollisions();

                if (!this.pendingPredictedWorldTransfer && !this.awaitingTransferredWorldState && !this.loadingMap) {
                    this.tryPlayerWarp();
                }
            }

            for (const [playerId, player] of this.playersById) {
                if (playerId === this.selfPlayerId) {
                    continue;
                }

                player.update(delta);
            }

            // Update monsters
            for (const monster of this.monsters) {
                monster.update(delta);
            }

            // Update weather (rain particles, sound)
            if (this.weatherManager && this.cameras?.main) {
                const cam = this.cameras.main;
                this.weatherManager.update(delta, cam.scrollX, cam.scrollY, cam.width, cam.height);
            }
            this.updateDayNightOverlay();
        });
    }

    private handleOverlayUpdate(): void {
        this.loadingOverlayController?.bringToTop();
        this.loadingOverlayController?.tickRemovalCountdown();
    }

    private drawLoadingOverlay(callback: () => void): void {
        this.initializationStarted = true;
        this.loadingOverlayController!.drawAndDeferLoad(callback);
        // Hard failsafe: never stay black with "Loading map..." forever (minimap/WebGL hang).
        this.time.delayedCall(20000, () => {
            if (this.loadingMap) {
                console.warn('[GameWorld] Loading map timeout (20s) — forcing overlay clear.');
                this.forceClearLoadingOverlay(
                    'Map load timed out. If the world is blank, press F5 and re-enter.',
                );
            }
        });
    }

    /**
     * When map assets load on demand, fetches the current `.amd` and tile packs before the normal minimap path.
     */
    private async runDeferredMapLoad(): Promise<void> {
        try {
            if (shouldLoadMapAssetsOnDemand()) {
                await prepareMapForGameWorld(this, this.mapManager!.getCurrentMapName(), {
                    focusTileX: this.initialGameWorldState?.playerX,
                    focusTileY: this.initialGameWorldState?.playerY,
                });
            }

            runSafeSync('GameWorld:deferredMapLoad', () => {
                this.displayedMap = this.mapManager!.getCurrentMap();
                this.mapManager!.startMinimapCapture((map) => {
                    runSafeSync('GameWorld:minimapCapture', () => {
                        try {
                            map.renderMapObjects(this, true); // Third pass (with trees)
                            // Apply SysMenu detail (hide trees on Low) after objects exist.
                            map.applyDetailLevel(sysMenuDialogStore.state.detailLevel);
                            this.pendingLoadedMap = map;
                            this.tryFinalizeMapSetup();
                        } catch (error) {
                            console.error('[GameWorld] Map finalize failed:', error);
                            this.forceClearLoadingOverlay(
                                'Map setup failed. Try reconnecting (F5).',
                            );
                        }
                    });
                });
            });
        } catch (error) {
            console.error('[GameWorld] Map on-demand load failed:', error);
            this.forceClearLoadingOverlay(
                'Could not load map assets. Refresh (F5) or re-enter character.',
            );
        }
    }

    /** Never leave players stuck on black "Loading map..." (music + empty scene). */
    private forceClearLoadingOverlay(message?: string): void {
        this.loadingMap = false;
        this.awaitingTransferredWorldState = false;
        this.pendingPredictedWorldTransfer = false;
        this.clearWorldTransferWatchdog();
        this.loadingOverlayController?.destroyImmediate();
        if (message) {
            EventBus.emit(TOAST_REQUESTED, {
                message,
                severity: 'error',
                autoClose: 5000,
            });
        }
    }

    private handleLeftMouseButton(): void {
        if (this.awaitingMakeServerCellOccupiedClick || this.awaitingPlayerTeleportClick) {
            return;
        }
        const inputManager = this.inputManager;
        if (!inputManager) {
            return;
        }
        if (!inputManager.isLeftMouseDown()) {
            this.suppressLeftMouseMovementUntilRelease = false;
            return;
        }
        if (!this.loadingMap && inputManager.getActivePointer() && this.cameras?.main && this.player) {
            if (this.suppressLeftMouseMovementUntilRelease) {
                return;
            }
            if (this.player.isCasting()) {
                return;
            }

            const pointer = inputManager.getActivePointer()!;

            // Casting / aiming: hard-stop path and never treat the click as run destination.
            if (this.player.hasPendingSpell() || this.player.isCastReady()) {
                this.player.hardStopForCast();
                const camera = this.cameras.main;
                const cursorPixelX = pointerWorldPixel(pointer, camera).x;
                const cursorPixelY = pointerWorldPixel(pointer, camera).y;
                if (this.player.onLeftClickAt(cursorPixelX, cursorPixelY)) {
                    this.suppressLeftMouseMovementUntilRelease = true;
                    return;
                }
                // Still in cast bar (not CastReady yet) — eat click, don't move.
                this.suppressLeftMouseMovementUntilRelease = true;
                return;
            }

            // Pending effect summon: create effect at cursor position (overrides movement)
            if (this.castManager?.getPendingEffectKey()) {
                const camera = this.cameras.main;
                const worldPixelX = pointerWorldPixel(pointer, camera).x;
                const worldPixelY = pointerWorldPixel(pointer, camera).y;
                const worldX = convertPixelPosToWorldPos(worldPixelX);
                const worldY = convertPixelPosToWorldPos(worldPixelY);
                if (this.castManager.tryPlaceEffect(worldX, worldY)) {
                    return;
                }
            }

            const attackTarget = this.getAttackableTargetUnderPointer(pointer);

            // Skip attack and movement when we just placed an effect (castReady)
            if (this.castManager?.getCastReady()) {
                return;
            }

            // Hold-to-attack: even cadence at weapon swing speed.
            // First swing = pointerdown; subsequent swings only when not mid-anim and lock open
            // (startAttack enforces one packet per AttackSpeedMs — no double-fire).
            if (attackTarget) {
                if (!this.player.isAttacking() && !this.player.isInBowStance()) {
                    this.player.attack(attackTarget);
                }
                // In range / mid-swing: stay put (no pathfind thrash).
                if (
                    this.player.isAttacking() ||
                    this.player.isInBowStance() ||
                    getDistance(
                        this.player.getWorldX(),
                        this.player.getWorldY(),
                        attackTarget.getWorldX(),
                        attackTarget.getWorldY(),
                    ) <= this.player.getAttackRange()
                ) {
                    return;
                }
                // Out of range: path to free approach cell (not the occupied mob tile).
                const approach = findApproachCellNearTarget(
                    this.getCurrentMap(),
                    this.player.getWorldX(),
                    this.player.getWorldY(),
                    attackTarget.getWorldX(),
                    attackTarget.getWorldY(),
                    this.player.getAttackRange(),
                );
                if (approach) {
                    this.player.setDestination(approach.x, approach.y, false);
                }
                return;
            }

            // Casting / aiming: never hold-run toward the cursor.
            if (this.player.hasPendingSpell() || this.player.isCastReady()) {
                this.player.hardStopForCast();
                return;
            }

            // Not over monster: move towards cursor (throttled)
            if (inputManager.canAcceptMovementCommand()) {
                const camera = this.cameras.main;
                const worldPixelX = pointerWorldPixel(pointer, camera).x;
                const worldPixelY = pointerWorldPixel(pointer, camera).y;
                // Use player's anchor point (where they appear on screen) as center for direction calculation
                const playerAnchorPixelX = this.player.getAnimatedPixelX();
                const playerAnchorPixelY = this.player.getAnimatedPixelY();

                const commandedDestX = convertPixelPosToWorldPos(worldPixelX);
                const commandedDestY = convertPixelPosToWorldPos(worldPixelY);

                this.player.clearAttackTarget();
                // Olympia hold-run: always steer by cursor sector (direct mode), even when the
                // cursor cell is a wall / water / other body. Never cancelMovement here — that
                // froze players mid-PvP whenever the cursor skimmed a non-walkable tile.
                // Soft destination may be blocked; GameObject.processMovement uses cursor pixels
                // for direction and side-steps freely in direct mode (no progress-to-goal gate).
                this.player.setDestination(
                    commandedDestX,
                    commandedDestY,
                    true,
                    playerAnchorPixelX,
                    playerAnchorPixelY,
                    worldPixelX,
                    worldPixelY
                );
                inputManager.recordMovementCommand();
            }
        }
    }

    private handleRightMouseButton(): void {
        const inputManager = this.inputManager;
        if (!this.loadingMap && inputManager?.isRightMouseDown() && inputManager.getActivePointer() && this.cameras?.main && this.player) {
            if (this.player.hasPendingSpell()) {
                return;
            }
            const pointer = inputManager.getActivePointer()!;
            const attackTarget = this.getAttackableTargetUnderPointer(pointer);
            if (attackTarget) {
                // Hold RMB standstill: same even cadence as LMB (gate inside startAttack).
                if (!this.player.isAttacking() && !this.player.isInBowStance()) {
                    this.player.attackStandstill(attackTarget);
                }
                return;
            }
            const camera = this.cameras.main;
            const worldPixelX = pointerWorldPixel(pointer, camera).x;
            const worldPixelY = pointerWorldPixel(pointer, camera).y;
            const direction = getNextDirection(
                this.player.getWorldX(),
                this.player.getWorldY(),
                convertPixelPosToWorldPos(worldPixelX),
                convertPixelPosToWorldPos(worldPixelY)
            );
            if (direction === Direction.None) {
                return;
            }
            if (!this.player.isMoving()) {
                if (this.player.turnTowardsDirection(direction)) {
                    getNetworkManager(this.game)?.requestChangePlayerIdleDirection(direction);
                }
            } else {
                this.player.queueLocalIdleDirectionForWhenStopped(direction);
            }
        }
    }

    private getCurrentMap(): HBMap {
        return this.mapManager!.getCurrentMap();
    }

    /**
     * Re-sets HBMap occupancy for living monsters and all players (self + others). Player reset/course correction
     * can clear a tile another actor still uses (single boolean per cell).
     */
    private reapplyTileOccupancyOnMap(): void {
        if (!this.mapManager || this.loadingMap) {
            return;
        }
        const map = this.getCurrentMap();
        // Clear first — otherwise departed actors leave permanent client-side walls.
        map.clearDynamicOccupancy();
        for (const monster of this.monsters) {
            if (!monster.isDead()) {
                map.setTileOccupied(monster.getWorldX(), monster.getWorldY(), true);
            }
        }
        if (this.player && !this.player.isDead()) {
            map.setTileOccupied(this.player.getWorldX(), this.player.getWorldY(), true);
        }
        for (const p of this.playersById.values()) {
            if (!p.isDead()) {
                map.setTileOccupied(p.getWorldX(), p.getWorldY(), true);
            }
        }
    }

    private getOtherPlayerUnderPointer(pointer: Phaser.Input.Pointer): Player | undefined {
        if (!this.cameras?.main) {
            return undefined;
        }
        const camera = this.cameras.main;
        return getOtherPlayerUnderWorldPixel(
            this.player,
            this.playersById,
            pointerWorldPixel(pointer, camera).x,
            pointerWorldPixel(pointer, camera).y,
        );
    }

    /** Other player under cursor for attacks/spells only; spawn-protected and invisible remotes are not valid targets. */
    private getAttackableOtherPlayerUnderPointer(pointer: Phaser.Input.Pointer): Player | undefined {
        const p = this.getOtherPlayerUnderPointer(pointer);
        if (!p || p.hasSpawnProtection() || p.hasInvisibilityBuff()) {
            return undefined;
        }
        return p;
    }

    /** Same as {@link getAttackableOtherPlayerUnderPointer} in world pixel space (non-buff aim assist). */
    private getAttackableOtherPlayerUnderWorldPixel(worldPixelX: number, worldPixelY: number): Player | undefined {
        const p = getOtherPlayerUnderWorldPixel(this.player, this.playersById, worldPixelX, worldPixelY);
        if (!p || p.hasSpawnProtection() || p.hasInvisibilityBuff()) {
            return undefined;
        }
        return p;
    }

    private filterMonsterForSpellAimAssist(spellId: number, m: Monster | undefined): Monster | undefined {
        if (!m || m.isDead()) {
            return undefined;
        }
        const spell = getNetworkManager(this.game)?.getSpellById(spellId);
        // Non-damage (heal/buff/utility) may target friendly summons even while invisible.
        const isFriendlyTargetSpell = spell?.damageType === undefined;
        if (!m.hasInvisibilityBuff()) {
            return m;
        }
        if (isFriendlyTargetSpell && m.getAllegiance() === MonsterAllegiance.Friendly) {
            return m;
        }
        return undefined;
    }

    private getPlayerUnderWorldPixelForSpellAimAssist(spellId: number, worldPixelX: number, worldPixelY: number): Player | undefined {
        const spell = getNetworkManager(this.game)?.getSpellById(spellId);
        // Non-damage = heal / buff / cure / cancel / utility — Olympia body-click includes self.
        // (Heal has healDice but no temporaryEffects; old check only treated buffs as friendly.)
        const isFriendlyTargetSpell = spell?.damageType === undefined;
        if (isFriendlyTargetSpell) {
            const p = getPlayerUnderWorldPixelForHover(this.playersById, worldPixelX, worldPixelY);
            if (!p || p.isDead()) {
                return undefined;
            }
            if (p !== this.player && p.hasSpawnProtection()) {
                return undefined;
            }
            if (p !== this.player && p.hasInvisibilityBuff()) {
                return undefined;
            }
            return p;
        }
        return this.getAttackableOtherPlayerUnderWorldPixel(worldPixelX, worldPixelY);
    }

    /**
     * When the cursor is over another player or a living monster, returns ids for spell aim assist (top-most by depth).
     */
    private getSpellAimAssistTargetIds(spellId: number, worldPixelX: number, worldPixelY: number): { playerId?: bigint; monsterId?: bigint } {
        const hoveredMonster = this.filterMonsterForSpellAimAssist(
            spellId,
            getMonsterUnderWorldPixel(this.monsters, worldPixelX, worldPixelY),
        );
        const liveMonster = hoveredMonster && !hoveredMonster.isDead() ? hoveredMonster : undefined;
        const hoveredPlayer = this.getPlayerUnderWorldPixelForSpellAimAssist(spellId, worldPixelX, worldPixelY);
        if (!liveMonster) {
            const pid = hoveredPlayer?.getPlayerId();
            if (pid) {
                return { playerId: BigInt(pid) };
            }
            return {};
        }
        if (!hoveredPlayer) {
            return { monsterId: BigInt(liveMonster.getMonsterId()) };
        }
        if (hoveredPlayer.getDepth() > liveMonster.getDepth()) {
            const pid = hoveredPlayer.getPlayerId();
            if (pid) {
                return { playerId: BigInt(pid) };
            }
            return {};
        }
        return { monsterId: BigInt(liveMonster.getMonsterId()) };
    }

    /** Invisible monsters are not valid melee/ranged targets (server also rejects); hover uses {@link getMonsterUnderWorldPixelForHoverUi}. */
    private getMonsterUnderWorldPixelForCombatTargeting(worldPixelX: number, worldPixelY: number): Monster | undefined {
        const m = getMonsterUnderWorldPixel(this.monsters, worldPixelX, worldPixelY);
        if (!m || m.isDead()) {
            return undefined;
        }
        if (m.hasInvisibilityBuff()) {
            return undefined;
        }
        return m;
    }

    private getMonsterUnderPointerForCombatTargeting(pointer: Phaser.Input.Pointer): Monster | undefined {
        if (!this.cameras?.main) {
            return undefined;
        }
        const camera = this.cameras.main;
        return this.getMonsterUnderWorldPixelForCombatTargeting(pointerWorldPixel(pointer, camera).x, pointerWorldPixel(pointer, camera).y);
    }

    private getAttackableTargetUnderPointer(pointer: Phaser.Input.Pointer): Monster | Player | undefined {
        const hoveredMonster = this.getMonsterUnderPointerForCombatTargeting(pointer);
        const liveMonster = hoveredMonster && !hoveredMonster.isDead() ? hoveredMonster : undefined;
        const hoveredPlayer = this.getAttackableOtherPlayerUnderPointer(pointer);
        if (!liveMonster) {
            return hoveredPlayer;
        }
        if (!hoveredPlayer) {
            return liveMonster;
        }
        return hoveredPlayer.getDepth() > liveMonster.getDepth() ? hoveredPlayer : liveMonster;
    }

    private handleNpcEnteredRange(entry: NpcEnteredRangeEventData): void {
        if (this.npcs.some((n) => n.getNPCId() === entry.npcId)) {
            return;
        }
        const sprite = getSpriteForCatalogNpcId(entry.catalogNpcId);
        if (!sprite) {
            console.warn(
                `[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Unknown NPC catalog id ${entry.catalogNpcId} for instance ${entry.npcId}`,
            );
            return;
        }
        const map = this.getCurrentMap();
        const npc = new NPC(this, {
            x: entry.x,
            y: entry.y,
            spriteName: sprite,
            displayName: entry.displayName,
            direction: entry.direction,
            soundManager: this.soundManager,
            map,
            npcId: entry.npcId,
            catalogNpcId: entry.catalogNpcId,
        });
        this.npcs.push(npc);
    }

    private interactWithNpc(npc: NPC): void {
        if (!this.player || npc.isDead()) {
            return;
        }

        const direction = getNextDirection(
            this.player.getWorldX(),
            this.player.getWorldY(),
            npc.getWorldX(),
            npc.getWorldY(),
        );
        if (direction !== Direction.None) {
            this.player.turnTowardsDirection(direction);
        }

        const role = getNpcInteractionRole(npc.getCatalogNpcId());
        let greeting = 'Greetings.';
        switch (role) {
            case 'shop':
                EventBus.emit(OUT_UI_OPEN_SHOP, {
                    npcId: npc.getNPCId(),
                    npcName: npc.getDisplayName(),
                });
                greeting = 'What can I get you?';
                break;
            case 'magic-shop':
                EventBus.emit(OUT_UI_OPEN_MAGIC_SHOP, {
                    npcId: npc.getNPCId(),
                    npcName: npc.getDisplayName(),
                });
                greeting = 'Seek knowledge of the arcane.';
                break;
            case 'cash-shop':
                EventBus.emit(OUT_UI_OPEN_CASH_SHOP, {
                    npcId: npc.getNPCId(),
                    npcName: npc.getDisplayName(),
                });
                greeting = 'USDC/USDT for boosts & seals; $HELL for combos & stones.';
                break;
            case 'blacksmith':
                EventBus.emit(OUT_UI_OPEN_BLACKSMITH, {
                    npcId: npc.getNPCId(),
                    npcName: npc.getDisplayName(),
                });
                greeting = 'Need a blade? I have weapons for sale.';
                break;
            case 'warehouse':
                EventBus.emit(OUT_UI_OPEN_WAREHOUSE, {
                    npcId: npc.getNPCId(),
                    npcName: npc.getDisplayName(),
                });
                greeting = 'Your warehouse is ready.';
                break;
            case 'guild-hall':
                EventBus.emit(OUT_UI_OPEN_NPC_TALK, {
                    npcId: npc.getNPCId(),
                    npcName: npc.getDisplayName(),
                    role: 'guild-hall',
                    title: 'Guild Hall',
                });
                greeting = 'Welcome to the Guild Hall.';
                break;
            case 'city-hall':
                EventBus.emit(OUT_UI_OPEN_NPC_TALK, {
                    npcId: npc.getNPCId(),
                    npcName: npc.getDisplayName(),
                    role: 'city-hall',
                    title: 'City Hall',
                });
                greeting = 'City Hall is at your service.';
                break;
            case 'cathedral':
                EventBus.emit(OUT_UI_OPEN_NPC_TALK, {
                    npcId: npc.getNPCId(),
                    npcName: npc.getDisplayName(),
                    role: 'cathedral',
                    title: 'Cathedral',
                });
                greeting = 'May the gods watch over you.';
                break;
            case 'academy-learning':
                EventBus.emit(OUT_UI_OPEN_NPC_TALK, {
                    npcId: npc.getNPCId(),
                    npcName: npc.getDisplayName(),
                    role: 'academy-learning',
                    title: 'PvP Learning',
                });
                greeting = 'Drill Instructor: choose a learning sequence.';
                break;
            case 'academy-challenge':
                EventBus.emit(OUT_UI_OPEN_NPC_TALK, {
                    npcId: npc.getNPCId(),
                    npcName: npc.getDisplayName(),
                    role: 'academy-challenge',
                    title: 'PvP Challenge',
                });
                greeting = 'Arena Master: pick your challenge tier.';
                break;
            case 'command-hall':
                EventBus.emit(OUT_UI_OPEN_NPC_TALK, {
                    npcId: npc.getNPCId(),
                    npcName: npc.getDisplayName(),
                    role: 'command-hall',
                    title: 'Command Hall',
                });
                greeting = 'Report when ready for orders.';
                break;
            case 'guard':
                greeting = 'Move along, citizen. Keep the peace.';
                break;
            case 'quest-giver':
                greeting = 'Beginner training is optional — enroll in Quest (F5). Abandon anytime, no penalty.';
                EventBus.emit(IN_UI_BEGINNER_PATH_TALK, { catalogNpcId: npc.getCatalogNpcId() });
                setCharacterDialogOpen(true);
                setCharacterSubPanel('quest');
                break;
            case 'garden-warden':
                EventBus.emit(OUT_UI_OPEN_NPC_TALK, {
                    npcId: npc.getNPCId(),
                    npcName: npc.getDisplayName(),
                    role: 'garden-warden',
                    title: 'Garden Quests',
                });
                greeting = 'Hunt Unicorns or Trolls for the city.';
                break;
            case 'training-dummy':
                greeting = 'Dummy Barracks — practice hits. Open Training for tip sheets.';
                setTrainingPresetId(FARM_BARRACKS_PRESETS[0]?.id ?? 'farm_dummy_barracks');
                setTrainingDialogOpen(true);
                EventBus.emit(IN_UI_BEGINNER_PATH_TALK, { catalogNpcId: npc.getCatalogNpcId() });
                break;
            case 'training-merc':
                greeting = 'Merc Barracks — Chill Wind → Paralyze → deny PFM. Mercs chase and grant XP.';
                setTrainingPresetId(
                    FARM_BARRACKS_PRESETS.find((p) => p.id === 'farm_cc_protocol')?.id ??
                        FARM_BARRACKS_PRESETS[FARM_BARRACKS_PRESETS.length - 1]?.id ??
                        'farm_cc_protocol',
                );
                setTrainingDialogOpen(true);
                EventBus.emit(IN_UI_BEGINNER_PATH_TALK, { catalogNpcId: npc.getCatalogNpcId() });
                break;
            default:
                break;
        }

        new FloatingText(this, {
            text: `${npc.getDisplayName()}: ${greeting}`,
            x: npc.getAnimatedPixelX(),
            y: npc.getAnimatedPixelY() - TILE_SIZE,
            fontSize: 14,
            color: '#ffe8a3',
            totalDurationMs: 3500,
            fadeDurationMs: 800,
            upwardTravelPxPerSec: 12,
        });
    }

    private tryInteractWithNpc(npc: NPC): boolean {
        if (!this.player || npc.isDead()) {
            return false;
        }

        const distance = getDistance(
            this.player.getWorldX(),
            this.player.getWorldY(),
            npc.getWorldX(),
            npc.getWorldY(),
        );

        if (distance <= 2) {
            this.pendingNpcInteraction = undefined;
            this.player.cancelMovement();
            this.interactWithNpc(npc);
            return true;
        }

        // Walk to a free adjacent approach cell — never path onto the NPC's occupied stand
        // (that makes pathfinding circle forever / step door warps = "runaway").
        const approach = findApproachCellNearTarget(
            this.getCurrentMap(),
            this.player.getWorldX(),
            this.player.getWorldY(),
            npc.getWorldX(),
            npc.getWorldY(),
            2,
        );
        if (!approach) {
            this.pendingNpcInteraction = undefined;
            return false;
        }

        this.pendingNpcInteraction = npc;
        this.player.setDestination(approach.x, approach.y, false);
        return true;
    }

    private tryCompletePendingNpcInteraction(): void {
        const npc = this.pendingNpcInteraction;
        if (!npc || !this.player || npc.isDead()) {
            this.pendingNpcInteraction = undefined;
            return;
        }

        const distance = getDistance(
            this.player.getWorldX(),
            this.player.getWorldY(),
            npc.getWorldX(),
            npc.getWorldY(),
        );
        // Open as soon as in interact range — do not wait for idle; otherwise pathfinding
        // keeps chasing and the dialog never opens.
        if (distance <= 2) {
            this.pendingNpcInteraction = undefined;
            this.player.cancelMovement();
            this.interactWithNpc(npc);
        }
    }

    /** After walk-to-loot: pickup when standing on the target cell (and idle enough to anim). */
    private tryCompletePendingGroundPickup(): void {
        const pending = this.pendingGroundPickup;
        if (!pending || !this.player) {
            return;
        }
        if (
            this.player.getWorldX() !== pending.worldX ||
            this.player.getWorldY() !== pending.worldY
        ) {
            return;
        }
        // requestPickUp refuses while mid-step — retry briefly until idle on the cell.
        if (this.player.isMoving()) {
            this.time.delayedCall(80, () => this.tryCompletePendingGroundPickup());
            return;
        }
        this.pendingGroundPickup = undefined;
        this.player.requestPickUp(pending.maxItems);
    }

    private handleNpcsLeftRange(npcIds: string[]): void {
        for (const id of npcIds) {
            const idx = this.npcs.findIndex((n) => n.getNPCId() === id);
            if (idx === -1) {
                continue;
            }
            const npc = this.npcs[idx];
            npc.destroy();
            this.npcs.splice(idx, 1);
        }
    }

    private handleMonsterEnteredRange(data: MonsterEnteredRangeEventData): void {
        if (data.sprite) {
            // If already loaded, publish thumb immediately; else after lazy load.
            this.emitMonsterMinimapThumb(data.sprite);
        }
        if (this.monsters.some((m) => m.getMonsterId() === data.monsterId)) {
            return;
        }
        if (!this.mapManager || this.loadingMap || !this.soundManager) {
            return;
        }
        if (!this.player) {
            return;
        }

        const monsterTemplate = getMonsterData(data.sprite);
        if (!monsterTemplate) {
            console.warn(
                `[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Unknown monster sprite '${data.sprite}' from server (id=${data.monsterId})`);
            return;
        }

        if (
            data.state !== MonsterEntityState.MONSTER_ENTITY_STATE_IDLE &&
            data.state !== MonsterEntityState.MONSTER_ENTITY_STATE_MOVE &&
            data.state !== MonsterEntityState.MONSTER_ENTITY_STATE_ATTACK
        ) {
            console.warn(
                `[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Ignoring monster enter: unsupported entity state ${data.state} (id=${data.monsterId})`);
            return;
        }

        const map = this.getCurrentMap();
        const facing = toDirection(data.direction);
        if (facing === Direction.None) {
            console.warn(
                `[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Ignoring monster enter: invalid direction ${data.direction} (id=${data.monsterId})`);
            return;
        }
        if (data.attackType < 0 || data.attackType > 3) {
            console.warn(
                `[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Ignoring monster enter: invalid attack_type ${data.attackType} (id=${data.monsterId})`);
            return;
        }
        if (data.allegiance < MonsterAllegiance.Hostile || data.allegiance > MonsterAllegiance.Friendly) {
            console.warn(
                `[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Ignoring monster enter: invalid allegiance ${data.allegiance} (id=${data.monsterId})`);
            return;
        }
        const lazyMonsterAssets = shouldLoadMonsterAssetsOnDemand();
        const concreteAssetsReady = !lazyMonsterAssets || areMonsterAssetsLoaded(this, data.sprite);
        const visualSpriteName = concreteAssetsReady ? data.sprite : MONSTER_PLACEHOLDER_SPRITE;
        const visualTemplate = concreteAssetsReady ? monsterTemplate : getMonsterData(MONSTER_PLACEHOLDER_SPRITE);
        if (!visualTemplate) {
            console.warn(
                `[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Missing placeholder monster sprite '${MONSTER_PLACEHOLDER_SPRITE}'`);
            return;
        }

        try {
            const monster = new Monster(this, {
                x: data.x,
                y: data.y,
                spriteName: visualSpriteName,
                displayName: data.name,
                direction: facing,
                soundManager: this.soundManager,
                map,
                states: visualTemplate.states,
                movementSpeedMs: data.movementSpeedMs,
                attackSpeedMs: data.attackSpeedMs,
                playerX: this.player.getWorldX(),
                playerY: this.player.getWorldY(),
                attackType: data.attackType as AttackType,
                allegiance: data.allegiance as MonsterAllegiance,
                hp: data.hp,
                maxHp: data.maxHp,
                attackDamage: data.attackDamage,
                monsterId: data.monsterId,
                temporalCoefficient: monsterTemplate.temporalCoefficient,
                shadow: visualTemplate.shadow,
                // Hide while lazy-loading so the purple `ghk` ninja placeholder never flashes.
                opacity: concreteAssetsReady ? monsterTemplate.opacity : 0,
                assetsPendingLoad: !concreteAssetsReady,
                height: monsterTemplate.height,
                dead: data.dead,
                state: data.state,
            });
            monster.setRemoteIdleContinuationGraceMs(serverDialogStore.state.gracePeriod);
            monster.syncActiveTemporaryEffects(data.activeTemporaryEffects ?? []);
            if (this.player && this.player.getAttackTarget() === monster && monster.hasInvisibilityBuff()) {
                this.player.clearAttackTarget();
            }
            this.monsters.push(monster);

            if (!concreteAssetsReady) {
                loadMonsterAssetsOnDemand(this, data.sprite)
                    .then(() => {
                        const currentMonster = this.monsters.find((entry) => entry.getMonsterId() === data.monsterId);
                        if (!currentMonster) {
                            return;
                        }
                        currentMonster.applyLoadedMonsterAssets({
                            spriteName: data.sprite,
                            states: monsterTemplate.states,
                            shadow: monsterTemplate.shadow,
                            height: monsterTemplate.height,
                        });
                        // After real textures exist — feed minimap pit icons (once per sprite type).
                        this.time.delayedCall(50, () => this.emitMonsterMinimapThumb(data.sprite));
                    })
                    .catch((error) => {
                        console.error(
                            `[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Failed to lazy-load monster assets for '${data.sprite}' (id=${data.monsterId})`,
                            error,
                        );
                    });
            } else {
                this.time.delayedCall(0, () => this.emitMonsterMinimapThumb(data.sprite));
            }

        } catch (error) {
            console.error(
                `[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Failed to spawn monster '${data.sprite}' (id=${data.monsterId})`,
                error,
            );
        }
    }

    private handleTemporaryEffectAppliedForPlayer(data: TemporaryEffectPlayerEventData): void {
        if (!this.mapManager || this.loadingMap) {
            return;
        }
        const p = this.playersById.get(data.playerId);
        if (!p) {
            return;
        }
        p.applyTemporaryEffect(data.temporaryEffectType);
        p.applySpeedsMs({
            movementSpeedMs: data.movementSpeedMs,
            attackSpeedMs: data.attackSpeedMs,
            castSpeedMs: data.castSpeedMs,
        });
        if (data.temporaryEffectType === TemporaryEffectType.Invisibility && this.player?.getAttackTarget() === p) {
            this.player.clearAttackTarget();
        }
        if (p.isLocalCharacter()) {
            const toastMessage = confuseApplyToastMessage(data.temporaryEffectType);
            if (toastMessage) {
                EventBus.emit(TOAST_REQUESTED, { message: toastMessage, severity: 'warning' });
            }
        }
    }

    private handleTemporaryEffectExpiredForPlayer(data: TemporaryEffectPlayerEventData): void {
        if (!this.mapManager || this.loadingMap) {
            return;
        }
        const p = this.playersById.get(data.playerId);
        if (!p) {
            return;
        }
        p.removeTemporaryEffect(data.temporaryEffectType);
        p.applySpeedsMs({
            movementSpeedMs: data.movementSpeedMs,
            attackSpeedMs: data.attackSpeedMs,
            castSpeedMs: data.castSpeedMs,
        });
        if (p.isLocalCharacter()) {
            const toastMessage = confuseExpireToastMessage(data.temporaryEffectType);
            if (toastMessage) {
                EventBus.emit(TOAST_REQUESTED, { message: toastMessage, severity: 'info' });
            }
        }
    }

    /**
     * Builds Olympia target/hover payload for a live monster (name + HP strip + Berserked).
     */
    private buildMonsterTargetHoverInfo(monster: Monster): MonsterHoverInfo {
        const anchorX = monster.getAnimatedPixelX();
        const anchorY = monster.getAnimatedPixelY() + MONSTER_HOVER_OVERLAY_ANCHOR_OFFSET_Y;
        const camera = this.cameras.main;
        const canvasX = anchorX - camera.scrollX;
        const canvasY = anchorY - camera.scrollY;
        const { screenX: overlayScreenX, screenY: overlayScreenY } = canvasToScreenPosition(
            canvasX,
            canvasY,
            this.game,
        );
        return {
            name: monster.getDisplayName(),
            hp: monster.getHp(),
            maxHp: monster.getMaxHp(),
            allegiance: this.resolveConfusedAllegianceDisplay(monster.getAllegiance(), monster.getMonsterId()),
            berserked: monster.isBerserked(),
            overlayScreenX,
            overlayScreenY,
        };
    }

    /**
     * Keeps world-space enemy skull markers in sync for opposing-city remote players (FOE &lt; 0).
     * PK count is not on the wire yet — citizenship FOE is the available enemy cue.
     */
    private syncEnemySkullMarkers(): void {
        if (!this.player) {
            return;
        }
        for (const other of this.playersById.values()) {
            if (other === this.player) {
                other.clearEnemySkullMarker();
                continue;
            }
            const foe = resolvePlayerHoverFoe(
                this.player.getCitizenshipSide(),
                other.getCitizenshipSide(),
                false,
            );
            other.syncEnemySkullMarker(foe < 0);
        }
    }

    /**
     * Olympia Confusion: spoof allegiance labels on hover so the local player cannot trust friend/foe cues.
     */
    private resolveConfusedAllegianceDisplay(real: MonsterAllegiance, seed: string): MonsterAllegiance {
        if (!this.player?.hasTemporaryEffect(TemporaryEffectType.Confusion)) {
            return real;
        }
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = (hash * 31 + seed.charCodeAt(i)) | 0;
        }
        const values = [MonsterAllegiance.Hostile, MonsterAllegiance.Neutral, MonsterAllegiance.Friendly];
        return values[Math.abs(hash) % values.length]!;
    }

    /**
     * Olympia Illusion: spoof remote character names on hover; Confusion alone keeps the real name.
     */
    private resolveConfusedPlayerNameDisplay(realName: string, seed: string): string {
        if (!this.player?.hasTemporaryEffect(TemporaryEffectType.Illusion)) {
            return realName;
        }
        return illusionSpoofName(seed || realName);
    }

    private handleTemporaryEffectAppliedForMonster(data: TemporaryEffectMonsterEventData): void {
        if (!this.mapManager || this.loadingMap) {
            return;
        }
        const m = this.monsters.find((x) => x.getMonsterId() === data.monsterId);
        if (!m) {
            return;
        }
        m.applyTemporaryEffect(data.temporaryEffectType);
        m.applySpeedsMs(data.movementSpeedMs, data.attackSpeedMs);
        if (data.temporaryEffectType === TemporaryEffectType.Invisibility && this.player?.getAttackTarget() === m) {
            this.player.clearAttackTarget();
        }
    }

    private handleTemporaryEffectExpiredForMonster(data: TemporaryEffectMonsterEventData): void {
        if (!this.mapManager || this.loadingMap) {
            return;
        }
        const m = this.monsters.find((x) => x.getMonsterId() === data.monsterId);
        if (!m) {
            return;
        }
        m.removeTemporaryEffect(data.temporaryEffectType);
        m.applySpeedsMs(data.movementSpeedMs, data.attackSpeedMs);
    }

    private handleCastEffectAtCell(data: { effectKey: string; x: number; y: number }): void {
        // Still draw when soundManager is missing; only skip mid-map-load.
        if (!this.mapManager || this.loadingMap) {
            return;
        }
        const options: DrawEffectOptions = {
            soundManager: this.soundManager ?? undefined,
            // Always above map objects / invisible carpets on the same row.
            depthOffset: 70,
        };
        if (this.player) {
            options.playerWorldX = this.player.getWorldX();
            options.playerWorldY = this.player.getWorldY();
        }
        drawEffect(this, data.x, data.y, data.effectKey, options);
    }

    private handleMonstersLeftRange(monsterIds: string[]): void {
        for (const monsterId of monsterIds) {
            const monsterIndex = this.monsters.findIndex((m) => m.getMonsterId() === monsterId);
            if (monsterIndex === -1) {
                continue;
            }
            const monster = this.monsters[monsterIndex];
            if (this.player && this.player.getAttackTarget() === monster) {
                this.player.clearAttackTarget();
            }
            if (monster.isDead()) {
                monster.beginRemovalFade();
            } else {
                monster.destroy();
                this.monsters.splice(monsterIndex, 1);
            }
        }
    }

    private handleGroundStatesEnteredRange(states: GroundStateCellEventData[]): void {
        if (!this.mapManager || this.loadingMap) {
            return;
        }

        for (const state of states) {
            for (const effect of state.effects) {
                this.upsertGroundEffectVisual(state.x, state.y, effect.groundEffectId, effect.effectType);
            }
            if (state.groundItem) {
                this.upsertGroundItemVisual(
                    state.x,
                    state.y,
                    state.groundItem.itemId,
                    state.groundItem.itemUid,
                    state.groundItem.quantity,
                    state.groundItem.effectOverrides,
                    state.groundItem.itemAttribute,
                    state.groundItem.itemColor,
                );
                // Do NOT emit ITEM_DROPPED_TO_GROUND here — that fires for every pile
                // entering view and filled Item Drops with junk. Notable loot is logged
                // on bag pickup only (ITEM_ADD_FROM_GROUND → ItemDrops.store).
            }
        }
    }

    private handleGroundStatesLeftRange(states: GroundStateCellRemovedEventData[]): void {
        for (const state of states) {
            for (const groundEffectId of state.groundEffectIds) {
                this.removeGroundEffectVisual(groundEffectId);
            }
            if (state.groundItemUid) {
                this.removeGroundItemVisualByUid(state.groundItemUid);
            }
        }
    }

    private upsertGroundItemVisual(
        worldX: number,
        worldY: number,
        itemId: number,
        itemUid: string,
        quantity: number,
        effectOverrides?: Effect[],
        itemAttribute?: number,
        itemColor?: number,
    ): void {
        this.removeGroundItemVisualAtCell(worldX, worldY);

        const playerGender = playerDialogStore.state.gender;
        try {
            const groundItem = new GroundItem(
                this,
                worldX,
                worldY,
                itemId,
                itemUid,
                quantity,
                playerGender,
                undefined,
                effectOverrides,
                itemAttribute,
                itemColor,
            );
            groundItem.setDepth(worldY * DEPTH_MULTIPLIER - 5);
            this.groundItems.push(groundItem);
        } catch (error) {
            console.warn(`[GameWorld${this.gameWorldId ? `:${this.gameWorldId}` : ''}] Failed to create GroundItem:`, error);
        }
    }

    private removeGroundItemVisualAtCell(worldX: number, worldY: number): void {
        const existingIndex = this.groundItems.findIndex((groundItem) => groundItem.worldX === worldX && groundItem.worldY === worldY);
        if (existingIndex < 0) {
            return;
        }

        const [removed] = this.groundItems.splice(existingIndex, 1);
        removed.destroy();
    }

    private removeGroundItemVisualByUid(itemUid: string): void {
        const existingIndex = this.groundItems.findIndex((groundItem) => groundItem.itemUid === itemUid);
        if (existingIndex < 0) {
            return;
        }

        const [removed] = this.groundItems.splice(existingIndex, 1);
        removed.destroy();
    }

    private upsertGroundEffectVisual(
        worldX: number,
        worldY: number,
        groundEffectId: string,
        effectType: GroundEffectType
    ): void {
        this.removeGroundEffectVisual(groundEffectId);

        const pixelX = worldCellCenterPixelX(worldX);
        const pixelY = worldCellCenterPixelY(worldY);
        switch (effectType) {
            case GroundEffectType.GROUND_EFFECT_TYPE_FIRE:
                this.groundEffectsById.set(
                    groundEffectId,
                    new FireInstance(this, pixelX, pixelY)
                );
                break;
            case GroundEffectType.GROUND_EFFECT_TYPE_POISON:
                this.groundEffectsById.set(
                    groundEffectId,
                    new PoisonCloudInstance(this, pixelX, pixelY)
                );
                break;
            case GroundEffectType.GROUND_EFFECT_TYPE_SPIKE_FIELD:
                this.groundEffectsById.set(
                    groundEffectId,
                    createSpikeField(this, pixelX, pixelY)
                );
                break;
            case GroundEffectType.GROUND_EFFECT_TYPE_ICE_STORM:
                this.groundEffectsById.set(groundEffectId, new IceStorm(this, pixelX, pixelY, {}));
                break;
            default:
                console.warn('[GameWorld] Unsupported ground effect type from server.', { effectType, groundEffectId, worldX, worldY });
                break;
        }
    }

    private removeGroundEffectVisual(groundEffectId: string): void {
        const existing = this.groundEffectsById.get(groundEffectId);
        if (!existing) {
            return;
        }

        existing.destroy();
        this.groundEffectsById.delete(groundEffectId);
    }

    private handleMonsterMoved(data: MonsterMovedEventData): void {
        if (!this.mapManager || this.loadingMap) {
            return;
        }
        const monster = this.monsters.find((m) => m.getMonsterId() === data.monsterId);
        if (!monster) {
            return;
        }
        if (monster.isDead()) {
            return;
        }
        monster.startMovement(data.curX, data.curY, data.destX, data.destY, data.movementSpeedMs, data.direction);
    }

    private handleMonsterAttacked(data: MonsterAttackedEventData): void {
        this.playMonsterAttack(data, () => this.resolvePlayerProjectileTarget(data.targetPlayerId));
    }

    private handleMonsterAttackedMonster(data: MonsterAttackedMonsterEventData): void {
        this.playMonsterAttack(data, () => this.resolveMonsterById(data.targetMonsterId) ?? null);
    }

    private handlePlayerReceiveDamage(data: PlayerReceiveDamageEventData): void {
        const monster = this.monsters.find((m) => m.getMonsterId() === data.monsterId);
        if (monster) {
            monster.playAttackImpactSound();
        }

        const target = this.resolvePlayerById(data.playerId);
        if (!target) {
            return;
        }
        target.applyMonsterDamage(
            data.damage,
            data.attackType,
            data.stunDurationMs,
            data.knockbackDurationMs,
            data.destX,
            data.destY,
            data.knockbackFromX,
            data.knockbackFromY,
        );
    }

    private handlePlayerTakeDamage(data: PlayerTakeDamageEventData): void {
        const target = this.resolvePlayerById(data.targetPlayerId);
        if (!target) {
            return;
        }
        target.applyMonsterDamage(
            data.damage,
            data.attackType,
            data.stunDurationMs,
            data.knockbackDurationMs,
            data.destX,
            data.destY,
            data.knockbackFromX,
            data.knockbackFromY,
        );
    }

    private handleMonsterTakeDamage(data: MonsterTakeDamageEventData): void {
        this.applyMonsterDamage(data.monsterId, data);
    }

    private handleMonsterTakeDamageByMonster(data: MonsterTakeDamageByMonsterEventData): void {
        const attacker = this.resolveMonsterById(data.attackerMonsterId);
        if (attacker) {
            attacker.playAttackImpactSound();
        }

        this.applyMonsterDamage(data.targetMonsterId, data);
    }

    private playMonsterAttack(
        data: { monsterId: string; direction: number; attackSpeedMs: number; rangedAttack: boolean; worldX: number; worldY: number },
        resolveTarget: () => Player | Monster | null,
    ): void {
        if (!this.mapManager || this.loadingMap) {
            return;
        }

        const monster = this.resolveMonsterById(data.monsterId);
        if (!monster || monster.isDead()) {
            return;
        }

        monster.startAttackAnimation(data.direction, data.attackSpeedMs, data.worldX, data.worldY);
        if (!data.rangedAttack) {
            return;
        }

        const initialTarget = resolveTarget();
        if (!initialTarget || !isProjectileTarget(initialTarget)) {
            return;
        }

        const halfMs = data.attackSpeedMs / 2;
        const monsterId = data.monsterId;
        const arrowSpeed = this.arrowSpeedPxPerSec;
        this.time.delayedCall(halfMs, () => {
            const target = resolveTarget();
            const attacker = this.resolveMonsterById(monsterId);
            if (!target || !attacker || !isProjectileTarget(target)) {
                return;
            }

            new ArrowProjectile(this, {
                originPixelX: attacker.getAnimatedPixelX(),
                originPixelY: attacker.getAnimatedPixelY(),
                target,
                speed: arrowSpeed,
            });
        });
    }

    private applyMonsterDamage(
        monsterId: string,
        data: {
            damage: number;
            attackType: number;
            stunlockDurationMs: number;
            hp: number;
            knockbackDurationMs?: number;
            destX?: number;
            destY?: number;
            knockbackFromX?: number;
            knockbackFromY?: number;
        },
    ): void {
        if (!this.mapManager || this.loadingMap) {
            return;
        }

        const monster = this.resolveMonsterById(monsterId);
        if (!monster) {
            return;
        }

        monster.takeDamage(
            data.damage,
            data.attackType,
            data.stunlockDurationMs,
            data.knockbackDurationMs,
            data.destX,
            data.destY,
            data.knockbackFromX,
            data.knockbackFromY,
            data.hp,
        );
    }

    private resolveMonsterById(monsterId: string): Monster | undefined {
        return this.monsters.find((monster) => monster.getMonsterId() === monsterId);
    }

    private resolvePlayerProjectileTarget(playerId: string): Player | null {
        const isSelfTarget = playerId === this.selfPlayerId || playerId === this.initialGameWorldState?.playerId;
        if (isSelfTarget) {
            return this.player ?? null;
        }

        return this.playersById.get(playerId) ?? null;
    }

    private handleMonsterDied(data: MonsterDiedEventData): void {
        if (!this.mapManager || this.loadingMap) {
            return;
        }
        const monster = this.monsters.find((m) => m.getMonsterId() === data.monsterId);
        if (!monster) {
            return;
        }
        monster.applyDeath();
    }

    private handlePlayerEnteredRange(data: NetworkPlayer): void {
        if (data.playerId === this.selfPlayerId || this.playersById.has(data.playerId)) {
            return;
        }
        if (!this.player || !this.mapManager || this.loadingMap) {
            return;
        }

        const movementSpeedMs = data.movementSpeedMs;
        const runningMode = data.runningMode;
        const otherPlayer = this.createOtherPlayer(
            data.playerId,
            data.x,
            data.y,
            movementSpeedMs,
            runningMode,
            data.attackMode,
            data.disconnected,
            data.dead,
            data.direction,
            data.visibleEquippedItems,
            {
                gender: data.gender,
                skinColor: data.skinColor,
                underwearColorIndex: data.underwearColorIndex,
                hairStyleIndex: data.hairStyleIndex,
            },
            data.characterName,
            data.citizenshipSide,
        );
        if (data.spawnProtection) {
            otherPlayer.setSpawnProtectionEffect(true);
        }
        otherPlayer.syncActiveTemporaryEffects(data.activeTemporaryEffects ?? []);
        otherPlayer.applySpeedsMs({
            attackSpeedMs: data.attackSpeedMs ?? 600,
            castSpeedMs: data.castSpeedMs ?? 1200,
        });
        if (this.player && this.player.getAttackTarget() === otherPlayer && otherPlayer.hasInvisibilityBuff()) {
            this.player.clearAttackTarget();
        }
        this.playersById.set(data.playerId, otherPlayer);
    }

    private handleRemotePlayerItemEquipped(data: ItemEquippedEventData): void {
        if (data.playerId === this.selfPlayerId) {
            return;
        }

        const otherPlayer = this.playersById.get(data.playerId);
        if (!otherPlayer) {
            return;
        }
        if (!Object.values(ItemTypes).includes(data.slot as ItemTypes)) {
            return;
        }

        otherPlayer.setRemoteVisibleEquippedItem(data.slot as ItemTypes, data.item.itemId, data.item.effectOverrides);
    }

    private handleRemotePlayerItemUnequipped(data: ItemUnequippedEventData): void {
        if (data.playerId === this.selfPlayerId) {
            return;
        }

        const otherPlayer = this.playersById.get(data.playerId);
        if (!otherPlayer) {
            return;
        }
        if (!Object.values(ItemTypes).includes(data.slot as ItemTypes)) {
            return;
        }

        otherPlayer.setRemoteVisibleEquippedItem(data.slot as ItemTypes, undefined);
    }

    private handlePlayerMoved(data: PlayerMovedEventData): void {
        if (data.playerId === this.selfPlayerId || !this.player || !this.mapManager || this.loadingMap) {
            return;
        }

        const movementSpeedMs = data.movementSpeedMs;
        const runningMode = data.runningMode;
        let otherPlayer = this.playersById.get(data.playerId);
        const spawnX = data.teleport ? data.destX : data.curX;
        const spawnY = data.teleport ? data.destY : data.curY;
        if (!otherPlayer) {
            const snap = getNetworkManager(this.game)?.getOtherPlayersState().find((player) => player.playerId === data.playerId);
            const visibleEquippedItems = snap?.visibleEquippedItems ?? {};
            const appearance = snap
                ? {
                    gender: snap.gender,
                    skinColor: snap.skinColor,
                    underwearColorIndex: snap.underwearColorIndex,
                    hairStyleIndex: snap.hairStyleIndex,
                }
                : {
                    gender: Gender.MALE,
                    skinColor: SkinColor.Light,
                    underwearColorIndex: 0,
                    hairStyleIndex: 0,
                };
            otherPlayer = this.createOtherPlayer(
                data.playerId,
                spawnX,
                spawnY,
                movementSpeedMs,
                runningMode,
                data.attackMode,
                false,
                false,
                Direction.NorthEast,
                visibleEquippedItems,
                appearance,
                snap?.characterName ?? '',
                snap?.citizenshipSide ?? 'traveler',
            );
            otherPlayer.syncActiveTemporaryEffects(snap?.activeTemporaryEffects ?? []);
            otherPlayer.applySpeedsMs({
                attackSpeedMs: snap?.attackSpeedMs ?? 600,
                castSpeedMs: snap?.castSpeedMs ?? 1200,
            });
            if (this.player && this.player.getAttackTarget() === otherPlayer && otherPlayer.hasInvisibilityBuff()) {
                this.player.clearAttackTarget();
            }
            this.playersById.set(data.playerId, otherPlayer);
        } else {
            otherPlayer.setRunModeAndMovementSpeed(runningMode, movementSpeedMs);
            otherPlayer.setAttackMode(data.attackMode);
        }

        if (data.teleport) {
            otherPlayer.snapRemoteToAuthoritativeCell(data.destX, data.destY);
        } else {
            otherPlayer.startMovementStep(data.curX, data.curY, data.destX, data.destY, data.dashAttack);
        }
    }

    private handlePlayerAttackedMonster(data: PlayerAttackedMonsterEventData): void {
        if (data.playerId === this.selfPlayerId || !this.player || !this.mapManager || this.loadingMap) {
            return;
        }

        const otherPlayer = this.playersById.get(data.playerId);
        if (!otherPlayer) {
            return;
        }

        const monster = data.monsterId !== '0' ? this.monsters.find((m) => m.getMonsterId() === data.monsterId) : undefined;
        otherPlayer.playRemoteAttack(this.arrowSpeedPxPerSec, {
            direction: data.direction,
            attackSpeedMs: data.attackSpeedMs,
            ranged: data.rangedAttack,
            target: monster,
            worldX: data.worldX,
            worldY: data.worldY,
            attackType: data.attackType,
        });
    }

    private handlePlayerAttackedPlayer(data: PlayerAttackedPlayerEventData): void {
        if (data.playerId === this.selfPlayerId || !this.player || !this.mapManager || this.loadingMap) {
            return;
        }

        const otherPlayer = this.playersById.get(data.playerId);
        const targetPlayer = this.resolvePlayerById(data.targetPlayerId);
        if (!otherPlayer || !targetPlayer) {
            return;
        }

        otherPlayer.playRemoteAttack(this.arrowSpeedPxPerSec, {
            direction: data.direction,
            attackSpeedMs: data.attackSpeedMs,
            ranged: data.rangedAttack,
            target: targetPlayer,
            worldX: data.worldX,
            worldY: data.worldY,
            attackType: data.attackType,
        });
    }

    private handlePlayerPickupPerformed(data: PlayerPickupPerformedEventData): void {
        if (data.playerId === this.selfPlayerId || !this.player || !this.mapManager || this.loadingMap) {
            return;
        }

        const otherPlayer = this.playersById.get(data.playerId);
        if (!otherPlayer) {
            return;
        }

        otherPlayer.queueRemotePickup(data.direction, data.animationTimeMs);
    }

    private handlePlayerBowStancePerformed(data: PlayerBowStancePerformedEventData): void {
        if (data.playerId === this.selfPlayerId || !this.player || !this.mapManager || this.loadingMap) {
            return;
        }

        const otherPlayer = this.playersById.get(data.playerId);
        if (!otherPlayer) {
            return;
        }

        otherPlayer.queueRemoteBowStance(data.direction, data.animationTimeMs);
    }

    private handleSpellCastStarted(data: SpellCastStartedEventData): void {
        if (data.playerId === this.selfPlayerId || !this.player || !this.mapManager || this.loadingMap) {
            return;
        }

        const otherPlayer = this.playersById.get(data.playerId);
        if (!otherPlayer) {
            return;
        }

        otherPlayer.queueRemoteSpellCastStart(data.spellName, data.castSpeedMs);
    }

    private handleSpellCastCancelled(data: SpellCastCancelledEventData): void {
        if (!this.player || !this.mapManager || this.loadingMap) {
            return;
        }

        // Local player: clear cast bar only (do not re-send cancel — already cancelled on server).
        if (data.playerId === this.selfPlayerId) {
            this.player.cancelPendingCast();
            return;
        }

        const otherPlayer = this.playersById.get(data.playerId);
        if (!otherPlayer) {
            return;
        }

        otherPlayer.clearRemoteSpellCast();
    }

    private handleCastAoeSpell(data: CastAoeSpellEventData): void {
        if (!this.mapManager || this.loadingMap || !this.castManager) {
            return;
        }

        const caster = this.resolvePlayerById(data.playerId);
        if (caster) {
            if (data.playerId !== this.selfPlayerId) {
                caster.clearRemoteSpellCast();
            }
            this.castManager.dispatchNetworkPlayerAoeSpell(caster, data);
            return;
        }

        // Caster left camera range mid-cast — still play impact/AoE at the target cell
        // so VFX is not silently dropped (intermittent "no animation" reports).
        this.castManager.dispatchNetworkAoeSpellAtTarget(data.spellId, data.x, data.y);
    }

    private handleCastDirectionalAoeSpell(data: CastDirectionalAoeSpellEventData): void {
        if (!this.player || !this.mapManager || this.loadingMap || !this.castManager) {
            return;
        }

        const caster = this.resolvePlayerById(data.playerId);
        if (!caster) {
            return;
        }

        if (data.playerId !== this.selfPlayerId) {
            caster.clearRemoteSpellCast();
        }

        this.castManager.dispatchNetworkPlayerDirectionalAoeSpell(data);
    }

    private handleMonsterCastAoeSpell(data: MonsterCastAoeSpellEventData): void {
        if (!this.mapManager || this.loadingMap || !this.castManager) {
            return;
        }

        const monster = this.resolveMonsterById(data.monsterId);
        if (monster && !monster.isDead()) {
            this.castManager.dispatchNetworkMonsterAoeSpell(monster, data);
            return;
        }
        // Monster despawned / out of range — still show impact at target.
        this.castManager.dispatchNetworkAoeSpellAtTarget(data.spellId, data.x, data.y);
    }

    private handleMonsterCastDirectionalAoeSpell(data: MonsterCastDirectionalAoeSpellEventData): void {
        if (!this.player || !this.mapManager || this.loadingMap || !this.castManager) {
            return;
        }

        const monster = this.resolveMonsterById(data.monsterId);
        if (!monster || monster.isDead()) {
            return;
        }

        this.castManager.dispatchNetworkMonsterDirectionalAoeSpell(data);
    }

    private handlePlayerLeftRange(data: PlayerLeftEventData): void {
        if (data.playerId === this.selfPlayerId) {
            return;
        }

        const player = this.playersById.get(data.playerId);
        if (!player) {
            return;
        }

        if (this.player && this.player.getAttackTarget() === player) {
            this.player.clearAttackTarget();
        }
        player.destroy();
        this.playersById.delete(data.playerId);
    }

    private handlePlayerMovementStateChanged(data: PlayerMovementStateChangedEventData): void {
        if (!this.mapManager || this.loadingMap) {
            return;
        }
        if (data.playerId === this.selfPlayerId) {
            if (!this.player) {
                return;
            }
            this.player.setRunModeAndMovementSpeed(data.runningMode, data.movementSpeedMs);
            return;
        }

        const otherPlayer = this.playersById.get(data.playerId);
        if (!otherPlayer) {
            return;
        }

        otherPlayer.setRunModeAndMovementSpeed(data.runningMode, data.movementSpeedMs);
    }

    private handlePlayerAttackModeChanged(data: PlayerAttackModeChangedEventData): void {
        if (data.playerId === this.selfPlayerId || !this.player || !this.mapManager || this.loadingMap) {
            return;
        }

        const otherPlayer = this.playersById.get(data.playerId);
        if (!otherPlayer) {
            return;
        }

        otherPlayer.setAttackMode(data.attackMode);
    }

    private handlePlayerIdleDirectionChanged(data: PlayerIdleDirectionChangedEventData): void {
        if (data.playerId === this.selfPlayerId || !this.player || !this.mapManager || this.loadingMap) {
            return;
        }

        const otherPlayer = this.playersById.get(data.playerId);
        if (!otherPlayer) {
            return;
        }

        const facing = toDirection(data.direction);
        if (facing === Direction.None) {
            return;
        }
        if (otherPlayer.isMoving()) {
            otherPlayer.queueIdleFacingForWhenAligned(data.direction);
        } else {
            otherPlayer.applyIdleFacing(facing);
        }
    }

    private handlePlayerAppearanceChanged(data: PlayerAppearanceChangedEventData): void {
        if (data.playerId === this.selfPlayerId || !this.mapManager || this.loadingMap) {
            return;
        }

        const otherPlayer = this.playersById.get(data.playerId);
        if (!otherPlayer) {
            return;
        }

        otherPlayer.applyAppearance(
            data.gender,
            data.skinColor,
            data.underwearColorIndex,
            data.hairStyleIndex,
        );
    }

    private handleSpawnProtectionEnabled(data: { playerId: string }): void {
        const isSelf = data.playerId === this.selfPlayerId || data.playerId === this.initialGameWorldState?.playerId;
        if (isSelf) {
            if (this.player && this.mapManager && !this.loadingMap) {
                this.player.setSpawnProtectionEffect(true);
            } else {
                this.pendingSpawnProtectionForSelf = true;
            }
            return;
        }
        if (!this.player || !this.mapManager || this.loadingMap) {
            return;
        }
        const targetPlayer = this.playersById.get(data.playerId);
        if (targetPlayer) {
            targetPlayer.setSpawnProtectionEffect(true);
        }
    }

    private handleSpawnProtectionDisabled(data: { playerId: string }): void {
        const isSelf = data.playerId === this.selfPlayerId || data.playerId === this.initialGameWorldState?.playerId;
        if (isSelf) {
            if (this.player && this.mapManager && !this.loadingMap) {
                this.player.setSpawnProtectionEffect(false);
            }
            return;
        }
        if (!this.player || !this.mapManager || this.loadingMap) {
            return;
        }
        const targetPlayer = this.playersById.get(data.playerId);
        if (targetPlayer) {
            targetPlayer.setSpawnProtectionEffect(false);
        }
    }

    private handlePlayerDisconnected(data: PlayerConnectionStateChangedEventData): void {
        if (data.playerId === this.selfPlayerId || !this.player || !this.mapManager || this.loadingMap) {
            return;
        }

        const otherPlayer = this.playersById.get(data.playerId);
        if (!otherPlayer) {
            return;
        }

        otherPlayer.setDisconnected(true);
    }

    private handlePlayerReconnected(data: PlayerConnectionStateChangedEventData): void {
        if (data.playerId === this.selfPlayerId || !this.player || !this.mapManager || this.loadingMap) {
            return;
        }

        const otherPlayer = this.playersById.get(data.playerId);
        if (!otherPlayer) {
            return;
        }

        otherPlayer.setDisconnected(false);
    }

    private createOtherPlayer(
        playerId: string,
        worldX: number,
        worldY: number,
        movementSpeedMs: number = 260,
        runningMode: boolean = true,
        attackMode: boolean = true,
        disconnected: boolean = false,
        dead: boolean = false,
        direction: number = Direction.NorthEast,
        visibleEquippedItems: Partial<Record<ItemTypes, { itemId: number; effectOverrides?: Effect[] }>> = {},
        appearance: { gender: Gender; skinColor: SkinColor; underwearColorIndex: number; hairStyleIndex: number } = {
            gender: Gender.MALE,
            skinColor: SkinColor.Light,
            underwearColorIndex: 0,
            hairStyleIndex: 0,
        },
        characterName: string = '',
        citizenshipSide: string = 'traveler',
    ): Player {
        const resolvedDirection = toDirection(direction);
        const initialDirection = resolvedDirection === Direction.None ? Direction.NorthEast : resolvedDirection;
        const player = new Player(
            this,
            worldX,
            worldY,
            initialDirection,
            this.soundManager,
            this.getCurrentMap(),
            this.createDefaultPlayerGear(),
            movementSpeedMs,
            false,
            visibleEquippedItems,
            appearance,
        );
        player.setPlayerId(playerId);
        player.setCharacterName(characterName);
        player.setCitizenshipSide(citizenshipSide);
        player.setRunMode(runningMode);
        player.setAttackMode(attackMode);
        player.setDisconnected(disconnected);
        player.setRemoteIdleContinuationGraceMs(serverDialogStore.state.gracePeriod);
        if (dead) {
            player.applySpawnedDeathState();
        }
        return player;
    }

    private resolvePlayerById(playerId: string): Player | undefined {
        if (playerId === this.selfPlayerId) {
            return this.player;
        }
        return this.playersById.get(playerId);
    }

    /**
     * Updates player position for all monsters and their spatial audio.
     * 
     * @param playerX - Player's world X coordinate
     * @param playerY - Player's world Y coordinate
     */
    private updateMonsterSpatialAudio(playerX: number, playerY: number): void {
        for (const monster of this.monsters) {
            monster.updatePlayerPosition(playerX, playerY);
        }
    }

    /** Wire chat broadcasts to Olympia overhead labels above speaker heads (Parity P1.3 / P2.1). */
    private setupChatOverheadListener(): void {
        subscribeSafe(
            'GameWorld',
            CHAT_MESSAGE_RECEIVED,
            (payload: {
                senderCharacterName: string;
                message: string;
                channel?: number;
            }) => {
                const channel = chatChannelFromProto(payload.channel);
                if (channel === 'whisper' && !sysMenuDialogStore.state.whisperEnabled) {
                    return;
                }
                if (channel === 'global' && !sysMenuDialogStore.state.shoutEnabled) {
                    return;
                }
                const speaker = this.findPlayerByCharacterName(payload.senderCharacterName);
                if (!speaker) {
                    return;
                }
                speaker.showChatOverhead(payload.message, chatChannelOverheadColor(channel));
            },
        );
    }

    private setupScreenshotListener(): void {
        subscribeSafe('GameWorld', IN_UI_TAKE_SCREENSHOT, () => {
            captureManualScreenshot(this.game);
        });
    }

    private findPlayerByCharacterName(name: string): Player | undefined {
        const needle = name.trim();
        if (!needle) {
            return undefined;
        }
        for (const player of this.playersById.values()) {
            const label = player.getCharacterName().trim();
            if (label && label.localeCompare(needle, undefined, { sensitivity: 'accent' }) === 0) {
                return player;
            }
        }
        return undefined;
    }

    /** Soft night tint from client game hour (until server hour is on the snapshot). */
    private updateDayNightOverlay(): void {
        const cam = this.cameras?.main;
        if (!cam || this.loadingMap) {
            return;
        }
        const hour = getOlympiaGameHour();
        const strength = getOlympiaNightStrength(hour);
        if (!this.dayNightOverlay) {
            this.dayNightOverlay = this.add.rectangle(0, 0, cam.width, cam.height, 0x081028, 0);
            this.dayNightOverlay.setOrigin(0, 0);
            this.dayNightOverlay.setScrollFactor(0);
            this.dayNightOverlay.setDepth(HIGH_DEPTH - 10);
        }
        this.dayNightOverlay.setPosition(0, 0);
        this.dayNightOverlay.setSize(cam.width, cam.height);
        if (hour !== this.lastDayNightHour) {
            this.lastDayNightHour = hour;
            this.dayNightOverlay.setFillStyle(0x081028, strength);
            this.dayNightOverlay.setVisible(strength > 0.01);
        }
    }

    /**
     * Warp when idle on a teleport tile.
     * Prefer **server** `teleportLocs` (GameWorlds.json — farm gray pads, etc.), then
     * Olympia static MapTeleportLocs. Without the server map, pad warps never fire.
     */
    private tryPlayerWarp(tileX?: number, tileY?: number): void {
        if (!this.player || this.pendingPredictedWorldTransfer || this.awaitingTransferredWorldState || this.loadingMap) {
            return;
        }
        if (this.player.isMoving()) {
            return;
        }

        const worldX = tileX ?? this.player.getWorldX();
        const worldY = tileY ?? this.player.getWorldY();
        if (!this.gameWorldId) {
            return;
        }

        // 1) Server-authoritative pads (InitialGameWorldState.teleportLocs)
        const serverTarget =
            this.teleportTargetsBySourceCell.get(this.getTeleportCellKey(worldX, worldY)) ??
            this.findServerTeleportNear(worldX, worldY, 1);
        if (serverTarget?.worldId && serverTarget.worldId !== this.gameWorldId) {
            const destLabel = serverTarget.loc
                ? `@ (${serverTarget.loc.x},${serverTarget.loc.y})`
                : '';
            console.log(
                `[GameWorld:${this.gameWorldId}] Server warp (${worldX},${worldY}) → ${serverTarget.worldId} ${destLabel}`,
            );
            MapWarpSystem.getInstance().markWarpTriggered();
            this.beginWorldTransfer(serverTarget.worldId, serverTarget.worldId);
            return;
        }

        // 2) Legacy Olympia MapTeleportLocs (buildings / edges)
        const rawMapName = this.initialGameWorldState?.mapName ?? this.mapManager?.getCurrentMap()?.fileName;
        if (!rawMapName) {
            return;
        }
        const mapName = normalizeMapId(rawMapName);
        const transfer = MapWarpSystem.getInstance().checkWarp(
            this.mapManager?.getCurrentMap(),
            this.gameWorldId,
            mapName,
            worldX,
            worldY,
            this.player.isMoving(),
        );
        if (!transfer) {
            return;
        }

        console.log(
            `[GameWorld:${this.gameWorldId}] Warp ${mapName}(${worldX},${worldY}) → ${transfer.worldId} (${transfer.mapName}) @ (${transfer.spawnX},${transfer.spawnY})`,
        );
        this.beginWorldTransfer(transfer.worldId, transfer.mapName);
    }

    /** Chebyshev-radius lookup for server teleport cells (matches pad radius-1 doorstep). */
    private findServerTeleportNear(
        tileX: number,
        tileY: number,
        radius: number,
    ): TeleportTarget | undefined {
        let best: TeleportTarget | undefined;
        let bestDist = Infinity;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const d = Math.max(Math.abs(dx), Math.abs(dy));
                if (d > radius) {
                    continue;
                }
                const t = this.teleportTargetsBySourceCell.get(this.getTeleportCellKey(tileX + dx, tileY + dy));
                if (!t) {
                    continue;
                }
                if (d < bestDist) {
                    bestDist = d;
                    best = t;
                }
            }
        }
        return best;
    }

    /**
     * Checks for collisions between the player and static map objects.
     * If the player collides with a map object and the player is behind it (lower depth),
     * makes the map object 50% transparent.
     * 
     * Uses spatial grid for efficient object lookup:
     * - Phase 1: Get objects within 20 grid cells using spatial grid (fast)
     * - Phase 2: Filter by accurate 10-cell radius distance (precise)
     * - Phase 3: Check pixel-perfect collision (accurate)
     */
    private handleMapObjectCollisions(): void {
        if (!this.player || !this.mapManager) {
            return;
        }

        this.collidingMapObjects = this.mapManager.updateMapObjectCollisionsForPlayer(
            this.player,
            this.collidingMapObjects,
        );
    }

    private clearPendingRequestedWorldChangeListener(): void {
        if (!this.pendingRequestedWorldChangeListener) {
            return;
        }

        EventBus.off(INITIAL_GAME_WORLD_STATE_RECEIVED, this.pendingRequestedWorldChangeListener);
        this.pendingRequestedWorldChangeListener = undefined;
    }

    public shutdown() {
        runSafeSync('GameWorld:shutdown', () => {
            clearGameWorldCanvasPresentation(this);
            document.body.classList.remove('game-world-active');
            EventBus.emit(OUT_UI_HOVER_GROUND_ITEM, false);
            EventBus.emit(OUT_UI_HOVER_GROUND_ITEM_INFO, undefined);
            EventBus.emit(OUT_UI_HOVER_MONSTER, undefined);
            EventBus.emit(OUT_UI_HOVER_NPC, undefined);
            EventBus.emit(OUT_UI_HOVER_PLAYER, undefined);
            this.castManager?.destroy();
            this.castManager = undefined;
            if (this.player?.hasPendingSpell()) {
                this.player.cancelPendingCast();
            }
            this.inputManager?.destroy();
            this.inputManager = undefined;
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = undefined;
            }
            this.cursorPositionCleanup?.();
            this.cursorPositionCleanup = undefined;

            if (this.player) {
                this.player.destroy();
                this.player = undefined;
            }

            for (const [playerId, player] of this.playersById) {
                if (playerId === this.selfPlayerId) {
                    continue;
                }

                player.destroy();
            }
            this.playersById.clear();
            this.selfPlayerId = undefined;

            // Destroy all monsters
            for (const monster of this.monsters) {
                monster.destroy();
            }
            this.monsters = [];

            // Destroy all NPCs
            for (const npc of this.npcs) {
                npc.destroy();
            }
            this.npcs = [];

            // Destroy all ground items
            for (const groundItem of this.groundItems) {
                groundItem.destroy();
            }
            this.groundItems = [];
            for (const groundEffect of this.groundEffectsById.values()) {
                groundEffect.destroy();
            }
            this.groundEffectsById.clear();

            this.loadingOverlayController?.destroyImmediate();
            this.loadingOverlayController = undefined;

            this.stopAmbientWeather();
            this.weatherManager?.destroy();
            this.weatherManager = undefined;
            this.dayNightOverlay?.destroy();
            this.dayNightOverlay = undefined;
            this.lastDayNightHour = -1;

            if (this.soundManager) {
                this.soundManager.stopAllSounds();
            }

            this.initializationStarted = false;
            this.loadingMap = true;
            this.clearPendingWorldTransfer('shutdown');
            this.initialGameWorldState = undefined;
            this.pendingLoadedMap = undefined;
            this.teleportTargetsBySourceCell.clear();
            this.lastTeleportLocSets = [];
            this.mapManager?.resetCapturingState();
            this.collidingMapObjects.clear();

            this.cameraManager?.destroyEventListeners();
            this.cameraManager = undefined;
            EventBus.off(IN_UI_TOGGLE_NON_MOVABLE_CELLS_HIGHLIGHT);
            EventBus.off(IN_UI_TOGGLE_TELEPORT_CELLS_HIGHLIGHT);
            EventBus.off(IN_UI_TOGGLE_SERVER_TELEPORT_CELLS_HIGHLIGHT);
            EventBus.off(IN_UI_TOGGLE_WATER_CELLS_HIGHLIGHT);
            EventBus.off(IN_UI_TOGGLE_FARMABLE_CELLS_HIGHLIGHT);
            EventBus.off(IN_UI_TOGGLE_RENDER_MAP_TILES);
            EventBus.off(IN_UI_TOGGLE_RENDER_MAP_OBJECTS);
            EventBus.off(IN_UI_TOGGLE_DEBUG_MODE);
            EventBus.off(IN_UI_TOGGLE_GRID_DISPLAY);
            EventBus.off(IN_UI_GROUND_ITEM_DISPLAY_SIZE_CHANGED);
            EventBus.off(IN_UI_CHANGE_WEATHER);
            EventBus.off(IN_UI_RAIN_SOUNDS_CHANGED);
            EventBus.off(OUT_WEATHER_SYNCED);
            cancelPlayerDialogPhaserNotificationDebouncers();
            EventBus.off(IN_UI_CHANGE_MOVEMENT_SPEED);
            EventBus.off(IN_UI_CHANGE_ATTACK_SPEED);
            EventBus.off(IN_UI_CHANGE_ATTACK_RANGE);
            EventBus.off(IN_UI_CHANGE_STUN_DURATION);
            EventBus.off(IN_UI_CHANGE_DAMAGE);
            EventBus.off(IN_UI_CHANGE_ATTACK_TYPE);
            EventBus.off(IN_UI_CHANGE_ALLOW_DASH_ATTACK);
            EventBus.off(IN_UI_CHANGE_CAST_SPEED);
            EventBus.off(IN_UI_CHANGE_ATTACK_MODE);
            EventBus.off(IN_UI_CHANGE_SAFE_ATTACK_MODE);
            EventBus.off(IN_UI_CHANGE_RUN_MODE);
            // `off(event)` alone drops every listener; appearance events are shared (e.g. InventoryManager on gender, Player on all four), so remove only this scene's handler.
            EventBus.off(IN_UI_CHANGE_GENDER, this.syncPlayerAppearanceHandler);
            EventBus.off(IN_UI_CHANGE_SKIN_COLOR, this.syncPlayerAppearanceHandler);
            EventBus.off(IN_UI_CHANGE_UNDERWEAR_COLOR, this.syncPlayerAppearanceHandler);
            EventBus.off(IN_UI_CHANGE_HAIR_STYLE, this.syncPlayerAppearanceHandler);
            EventBus.off(IN_UI_REQUEST_PLAYER_LOGOUT);
            EventBus.off(SOCKET_DISCONNECTED);
            EventBus.off(PLAYER_ITEM_APPEARANCE_PREFETCH_REQUESTED, this.playerItemAppearancePrefetchHandler);
            EventBus.off(IN_UI_PLAYER_RESURRECT);
            EventBus.off(IN_UI_REQUEST_SERVER_RESURRECT);
            EventBus.off(IN_UI_CLAIM_KILL_MILESTONE);
            EventBus.off(IN_UI_BEGINNER_PATH_ENROLL);
            EventBus.off(IN_UI_BEGINNER_PATH_ABANDON);
            EventBus.off(IN_UI_BEGINNER_PATH_TALK);
            EventBus.off(IN_UI_BEGINNER_PATH_UI_ACTION);
            EventBus.off(IN_UI_CREATE_PARTY);
            EventBus.off(IN_UI_JOIN_PARTY);
            EventBus.off(IN_UI_LEAVE_PARTY);
            EventBus.off(IN_UI_REQUEST_REBIRTH);
            EventBus.off(IN_UI_REQUEST_REBIRTH_ROLLBACK);
            EventBus.off(IN_UI_SET_LEVEL_BLOCK);
            EventBus.off(IN_UI_MAJESTIC_UPGRADE);
            EventBus.off(IN_UI_STONE_ITEM_UPGRADE);
            EventBus.off(IN_UI_ITEM_DISENCHANT);
            EventBus.off(IN_UI_CIC_ITEM_MERGE);
            EventBus.off(IN_UI_SIPHON_GEM_UPGRADE);
            EventBus.off(IN_UI_ITEM_ENCHANT);
            EventBus.off(IN_UI_ENCHANT_MATERIAL_UPGRADE);
            EventBus.off(IN_UI_GET_ENCHANT_MATERIALS);
            EventBus.off(IN_UI_MAJESTIC_STAT_RESPEC);
            EventBus.off(IN_UI_LEVEL_UP_SETTINGS);
            EventBus.off(PLAYER_DIED_RECEIVED);
            EventBus.off(ENEMY_KILL_AWARDED_RECEIVED);
            EventBus.off(PLAYER_RESURRECTED_RECEIVED);
            EventBus.off(IN_UI_PLAY_MUSIC);
            EventBus.off(IN_UI_CHANGE_PLAY_MAP_MUSIC);
            EventBus.off(IN_UI_CHANGE_MUSIC_ENABLED);
            EventBus.off(IN_UI_CHANGE_SOUND_ENABLED);
            EventBus.off(IN_UI_MUTE_ALL_SOUNDS);
            EventBus.off(IN_UI_UNMUTE_ALL_SOUNDS);
            EventBus.off(IN_UI_CHANGE_DETAIL_LEVEL);
            EventBus.off(IN_UI_GAME_VIEWPORT_RESIZED);
            EventBus.off(IN_UI_CHANGE_MUSIC_VOLUME);
            EventBus.off(IN_UI_CHANGE_SOUND_VOLUME);
            EventBus.off(IN_UI_SUMMON_MONSTER);
            EventBus.off(IN_UI_SUMMON_NPC);
            EventBus.off(IN_UI_CAST_SPELL);
            EventBus.off(PLAYER_CAST_ANIMATION_STARTED);
            EventBus.off(PLAYER_CONFIRM_SPELL_TARGET);
            EventBus.off(IN_UI_KILL_ALL_NPCS);
            EventBus.off(IN_UI_CHANGE_MAP);
            EventBus.off(IN_UI_MAKE_SERVER_CELL_OCCUPIED_MODE);
            EventBus.off(IN_UI_PLAYER_TELEPORT_REQUEST_MODE);
            EventBus.off(IN_UI_CHANGE_GRACE_PERIOD);
            EventBus.off(PLAYER_POSITION_CHANGED);
            EventBus.off(TILE_OCCUPANCY_REAPPLY_REQUESTED);
            EventBus.off(MONSTER_ENTERED_RANGE_RECEIVED);
            EventBus.off(MONSTER_MOVED_RECEIVED);
            EventBus.off(MONSTER_ATTACKED_RECEIVED);
            EventBus.off(MONSTER_ATTACKED_MONSTER_RECEIVED);
            EventBus.off(MONSTER_DIED_RECEIVED);
            EventBus.off(GROUND_STATES_ENTERED_RANGE_RECEIVED);
            EventBus.off(GROUND_STATES_LEFT_RANGE_RECEIVED);
            EventBus.off(PLAYER_RECEIVE_DAMAGE_RECEIVED);
            EventBus.off(PLAYER_TAKE_DAMAGE_RECEIVED);
            EventBus.off(HP_UPDATED_RECEIVED);
            EventBus.off(MONSTER_TAKE_DAMAGE_RECEIVED);
            EventBus.off(MONSTER_TAKE_DAMAGE_BY_MONSTER_RECEIVED);
            EventBus.off(MONSTERS_LEFT_RANGE_RECEIVED);
            EventBus.off(NPC_ENTERED_RANGE_RECEIVED);
            EventBus.off(NPCS_LEFT_RANGE_RECEIVED);
            EventBus.off(PLAYER_JOINED_RECEIVED);
            EventBus.off(PLAYER_LEFT_RECEIVED);
            EventBus.off(PLAYER_MOVED_RECEIVED);
            EventBus.off(PLAYER_ATTACKED_MONSTER_RECEIVED);
            EventBus.off(PLAYER_ATTACKED_PLAYER_RECEIVED);
            EventBus.off(PLAYER_PICKUP_PERFORMED_RECEIVED);
            EventBus.off(PLAYER_BOW_STANCE_PERFORMED_RECEIVED);
            EventBus.off(SPELL_CAST_STARTED_RECEIVED);
            EventBus.off(SPELL_CAST_CANCELLED_RECEIVED);
            EventBus.off(SPELL_CAST_FAILED_RECEIVED);
            EventBus.off(CAST_AOE_SPELL_RECEIVED);
            EventBus.off(MONSTER_CAST_AOE_SPELL_RECEIVED);
            EventBus.off(MONSTER_CAST_DIRECTIONAL_AOE_SPELL_RECEIVED);
            EventBus.off(CAST_DIRECTIONAL_AOE_SPELL_RECEIVED);
            EventBus.off(PLAYER_MOVEMENT_STATE_CHANGED_RECEIVED);
            EventBus.off(PLAYER_ATTACK_MODE_CHANGED_RECEIVED);
            EventBus.off(PLAYER_IDLE_DIRECTION_CHANGED_RECEIVED);
            EventBus.off(PLAYER_APPEARANCE_CHANGED_RECEIVED);
            EventBus.off(PLAYER_DISCONNECTED_RECEIVED);
            EventBus.off(PLAYER_RECONNECTED_RECEIVED);
            EventBus.off(PLAYER_SPAWN_PROTECTION_ENABLED_RECEIVED);
            EventBus.off(PLAYER_SPAWN_PROTECTION_DISABLED_RECEIVED);
            EventBus.off(TEMPORARY_EFFECT_APPLIED_FOR_PLAYER_RECEIVED);
            EventBus.off(TEMPORARY_EFFECT_EXPIRED_FOR_PLAYER_RECEIVED);
            EventBus.off(TEMPORARY_EFFECT_APPLIED_FOR_MONSTER_RECEIVED);
            EventBus.off(TEMPORARY_EFFECT_EXPIRED_FOR_MONSTER_RECEIVED);
            EventBus.off(CAST_EFFECT_RECEIVED);
            EventBus.off(RESET_POSITION_RECEIVED);
            EventBus.off(PLAYER_TELEPORTED_RECEIVED);
            EventBus.off(POSITION_CORRECTED_RECEIVED);
            EventBus.off(PLAYER_PARALYZED_RECEIVED);
            EventBus.off(MONSTER_DEAD);
            EventBus.off(NPC_DEAD);
            // Destroy the map that was actually displayed (not getCurrentMap - gameStateManager
            // may already point to the new map after IN_UI_CHANGE_MAP)
            const mapToCleanup = this.displayedMap;
            this.displayedMap = undefined;
            if (mapToCleanup) {
                mapToCleanup.destroyAllHighlights();
                mapToCleanup.destroyMapTiles(this);
                mapToCleanup.destroyMapObjects();
            }
            this.mapManager = undefined;
        });
    }

}



function toRegistryInitialGameWorldState(data: InitialGameWorldStateEventData): InitialGameWorldState {
    return {
        gameWorldId: data.gameWorldId,
        mapName: toClientMapFileName(data.mapName, data.gameWorldId),
        musicFile: data.musicFile,
        playerX: data.playerX,
        playerY: data.playerY,
        playerId: data.playerId,
        movementSpeedMs: data.movementSpeedMs,
        runMode: data.runMode,
        attackMode: data.attackMode,
        safeAttackMode: data.safeAttackMode,
        citizenshipSide: data.citizenshipSide,
        attackType: data.attackType,
        allowDashAttack: data.allowDashAttack,
        teleportLocs: data.teleportLocs,
        attackRangeCells: data.attackRangeCells,
        attackDamage: data.attackDamage,
        attackSpeedMs: data.attackSpeedMs,
        attackStunDurationMs: data.attackStunDurationMs,
        castSpeedMs: data.castSpeedMs,
        arrowSpeedPxPerSec: data.arrowSpeedPxPerSec,
        hp: data.hp,
        maxHp: data.maxHp,
        playerPickupAnimationTimeMs: data.playerPickupAnimationTimeMs,
        playerBowAnimationDurationMs: data.playerBowAnimationDurationMs,
        dead: data.dead,
        playerDirection: data.playerDirection,
        gender: data.gender,
        skinColor: data.skinColor,
        hairStyleIndex: data.hairStyleIndex,
        underwearColorIndex: data.underwearColorIndex,
        weather: data.weather,
    };
}
