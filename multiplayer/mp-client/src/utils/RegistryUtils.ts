import type { PhaserGameLike, PhaserSceneLike } from '../game/phaserHubTypes';
import { GameStateManager } from './GameStateManager';
import { InventoryManager } from './InventoryManager';
import { CachedMinimap, type PivotData, type PivotFrame } from '../Types';
import type { SoundManager } from './SoundManager';
import {
    SOUND_MANAGER_KEY,
    GAME_STATE_MANAGER_KEY,
    INVENTORY_MANAGER_KEY,
    NETWORK_MANAGER_KEY,
    DEBUG_KEY,
    GROUND_ITEM_DISPLAY_SIZE_KEY,
    LOADING_BG_KEY,
    LOGIN_SCREEN_BG_KEY,
    ITEM_PACK_SPRITE_SHEETS_KEY,
    ITEM_PACK_EMITTED_TINT_KEYS_KEY,
    PLAYER_POSITION_KEY,
    INITIAL_GAME_WORLD_STATE_KEY,
    PENDING_PLAYER_ITEM_APPEARANCE_PREFETCH_KEY,
} from '../constants/RegistryKeys';
import type { HBSpriteSheet } from '../game/assets/HBSprite';
import type { GroundItemDisplaySize } from '../constants/GroundItemDisplay';
import { parseGroundItemDisplaySize } from '../constants/GroundItemDisplay';
import { NetworkManager } from './NetworkManager';
import type { Gender, SkinColor, TeleportLocSet } from '../Types';
import type { WeatherMode } from '../ui/store/MapDialog.store';
import { mapBaseName } from './mapCatalogLookup';

/**
 * Typed Phaser registry accessors: managers, binary/minimap cache, pivot tables, and UI flags.
 * Keys live in `constants/RegistryKeys.ts`.
 */

/**
 * Gets a typed value from the registry. Phaser registry returns 'any'; we centralize
 * the type assertion here based on our storage pattern.
 */
function getRegistryValue<T>(registry: { get: (key: string) => unknown }, key: string): T | undefined {
    const value = registry.get(key);
    return value as T | undefined;
}

/**
 * Whether the browser window/tab currently has system focus.
 * Updated by PhaserGame on window focus/blur; SoundManager uses this to skip SFX when unfocused.
 */
let windowHasFocus = true;

export function setWindowFocused(focused: boolean): void {
    windowHasFocus = focused;
}

export function isWindowFocused(): boolean {
    return windowHasFocus;
}

/**
 * Creates a new GameStateManager instance and stores it in the game's registry.
 * 
 * @param game - The Phaser game instance
 * @returns The created GameStateManager instance
 */
export function createGameStateManager(game: PhaserGameLike): GameStateManager {
    const gameStateManager = new GameStateManager();
    game.registry.set(GAME_STATE_MANAGER_KEY, gameStateManager);
    return gameStateManager;
}

/**
 * Gets the SoundManager instance from the game's registry.
 * Returns undefined if not yet registered (e.g. before GameWorld has started).
 *
 * @param game - The Phaser game instance
 * @returns The SoundManager instance, or undefined
 */
export function getSoundManager(game: PhaserGameLike): SoundManager | undefined {
    return getRegistryValue<SoundManager>(game.registry, SOUND_MANAGER_KEY);
}

/**
 * Registers the SoundManager instance in the game's registry.
 *
 * @param game - The Phaser game instance
 * @param soundManager - The SoundManager instance to register
 */
export function setSoundManager(game: PhaserGameLike, soundManager: SoundManager): void {
    game.registry.set(SOUND_MANAGER_KEY, soundManager);
}

/**
 * Gets or creates an InventoryManager instance from the game's registry.
 *
 * @param game - The Phaser game instance
 * @returns The InventoryManager instance
 */
export function getInventoryManager(game: PhaserGameLike): InventoryManager {
    const existing = getRegistryValue<InventoryManager>(game.registry, INVENTORY_MANAGER_KEY);
    if (existing) {
        return existing;
    }
    const manager = new InventoryManager(game);
    game.registry.set(INVENTORY_MANAGER_KEY, manager);
    return manager;
}

/**
 * Gets the NetworkManager instance from the game's registry.
 *
 * @param game - The Phaser game instance
 * @returns The NetworkManager instance, or undefined
 */
export function getNetworkManager(game: PhaserGameLike): NetworkManager | undefined {
    return getRegistryValue<NetworkManager>(game.registry, NETWORK_MANAGER_KEY);
}

/**
 * Registers the NetworkManager instance in the game's registry.
 *
 * @param game - The Phaser game instance
 * @param networkManager - The NetworkManager instance to register, or undefined to clear it
 */
export function setNetworkManager(game: PhaserGameLike, networkManager: NetworkManager | undefined): void {
    game.registry.set(NETWORK_MANAGER_KEY, networkManager);
}

/**
 * Gets the GameStateManager instance from the game's registry.
 * Throws an error if the GameStateManager is not found, as it should be created
 * in LoginScreen before GameWorld is initialized.
 * 
 * @param game - The Phaser game instance
 * @returns The GameStateManager instance
 * @throws Error if GameStateManager is not found in registry
 */
export function getGameStateManager(game: PhaserGameLike): GameStateManager {
    const gameStateManager = getRegistryValue<GameStateManager>(game.registry, GAME_STATE_MANAGER_KEY);
    if (!gameStateManager) {
        throw new Error('[GameWorld] GameStateManager not found in registry. It should be created in LoginScreen.');
    }
    return gameStateManager;
}

/**
 * Gets a cached minimap from the scene's registry based on the map name.
 * Converts map filename (e.g., 'aresden.amd') to registry key (e.g., 'minimap-aresden').
 * 
 * @param scene - The Phaser scene instance
 * @param mapName - The map filename (e.g., 'aresden.amd')
 * @returns The cached minimap data, or undefined if not found
 */
export function getCachedMinimap(scene: PhaserSceneLike, mapName: string): CachedMinimap | undefined {
    const cacheKey = `minimap-${mapBaseName(mapName)}`;
    return getRegistryValue<CachedMinimap>(scene.registry, cacheKey);
}

/**
 * Stores a minimap in the scene's registry cache based on the map name.
 * Converts map filename (e.g., 'aresden.amd') to registry key (e.g., 'minimap-aresden').
 * 
 * @param scene - The Phaser scene instance
 * @param mapName - The map filename (e.g., 'aresden.amd')
 * @param minimap - The minimap data to cache
 */
export function setCachedMinimap(scene: PhaserSceneLike, mapName: string, minimap: CachedMinimap): void {
    const cacheKey = `minimap-${mapBaseName(mapName)}`;
    scene.registry.set(cacheKey, minimap);
}

/**
 * Gets pivot data from the scene's registry.
 * For map objects, uses textureKey-based lookup (e.g., 'pivots-map-tile-123').
 * For regular sprites, uses sprite name-based lookup (e.g., 'pivots-sprite-wm').
 * 
 * @param scene - The Phaser scene instance
 * @param textureKey - The texture key (for map objects)
 * @param spriteName - The sprite name (for regular sprites)
 * @param mapObject - Whether this is a map object
 * @returns The pivot data, or undefined if not found
 */
export function getPivotData(scene: PhaserSceneLike, textureKey: string, spriteName: string, mapObject: boolean): PivotData | undefined {
    const pivotRegistryKey = mapObject
        ? `pivots-${textureKey}`
        : `pivots-sprite-${spriteName.toLowerCase()}`;
    
    return getRegistryValue<PivotData>(scene.registry, pivotRegistryKey);
}

/**
 * Sets pivot data in the scene's registry using a texture key.
 * Used for tile sprites where pivots are looked up by texture key (e.g., 'pivots-map-tile-123').
 * 
 * @param scene - The Phaser scene instance
 * @param textureKey - The texture key (e.g., 'map-tile-123')
 * @param pivotData - The pivot data to store
 */
export function setPivotDataByTextureKey(scene: PhaserSceneLike, textureKey: string, pivotData: PivotData): void {
    const pivotRegistryKey = `pivots-${textureKey}`;
    scene.registry.set(pivotRegistryKey, pivotData);
}

/**
 * Sets pivot data in the scene's registry using a sprite name.
 * Used for backward compatibility with sprite name-based lookup (e.g., 'pivots-wm').
 *
 * @param scene - The Phaser scene instance
 * @param spriteName - The sprite name (e.g., 'wm')
 * @param pivotData - The pivot data to store
 */
export function setPivotDataBySpriteName(scene: PhaserSceneLike, spriteName: string, pivotData: PivotData): void {
    const pivotRegistryKey = `pivots-${spriteName}`;
    scene.registry.set(pivotRegistryKey, pivotData);
}

/**
 * Merges one sheet's pivots into the sprite cache-key registry entry (`pivots-sprite-slime`).
 * Partial `.spr` loads must not replace earlier idle/combat sheets.
 */
export function mergePivotSheetBySpriteCacheKey(
    scene: PhaserSceneLike,
    cacheKey: string,
    sheetIndex: number,
    framePivots: PivotFrame[],
): void {
    const pivotRegistryKey = `pivots-${cacheKey.toLowerCase()}`;
    const existing = getRegistryValue<PivotData>(scene.registry, pivotRegistryKey);
    const next = existing?.spriteSheetPivots ? existing.spriteSheetPivots.slice() : [];
    while (next.length <= sheetIndex) {
        next.push([]);
    }
    next[sheetIndex] = framePivots;
    scene.registry.set(pivotRegistryKey, { spriteSheetPivots: next });
}

/**
 * Checks if debug mode is enabled in the scene's registry.
 * 
 * @param scene - The Phaser scene instance
 * @returns True if debug mode is enabled, false otherwise
 */
export function isDebugModeEnabled(scene: PhaserSceneLike): boolean {
    return scene.registry.get(DEBUG_KEY) === true;
}

/**
 * Sets the debug mode flag in the scene's registry.
 * 
 * @param scene - The Phaser scene instance
 * @param enabled - Whether debug mode should be enabled
 */
export function setDebugModeEnabled(scene: PhaserSceneLike, enabled: boolean): void {
    scene.registry.set(DEBUG_KEY, enabled);
}

/**
 * Returns the user-selected ground item display size from the scene registry.
 */
export function getGroundItemDisplaySize(scene: PhaserSceneLike): GroundItemDisplaySize {
    return parseGroundItemDisplaySize(scene.registry.get(GROUND_ITEM_DISPLAY_SIZE_KEY));
}

/**
 * Persists the ground item display size in the scene registry.
 */
export function setGroundItemDisplaySize(scene: PhaserSceneLike, size: GroundItemDisplaySize): void {
    scene.registry.set(GROUND_ITEM_DISPLAY_SIZE_KEY, size);
}

/** @deprecated Use getGroundItemDisplaySize(scene) === 'large' */
export function isDisplayLargeItemsEnabled(scene: PhaserSceneLike): boolean {
    return getGroundItemDisplaySize(scene) === 'large';
}

/** @deprecated Use setGroundItemDisplaySize */
export function setDisplayLargeItemsEnabled(scene: PhaserSceneLike, enabled: boolean): void {
    setGroundItemDisplaySize(scene, enabled ? 'large' : 'small');
}

/**
 * Gets a binary buffer from the scene's binary cache.
 * 
 * @param scene - The Phaser scene instance
 * @param fileName - The filename/key of the binary resource
 * @returns The ArrayBuffer, or undefined if not found
 */
export function getBinaryBuffer(scene: PhaserSceneLike, fileName: string): ArrayBuffer | undefined {
    return scene.cache.binary.get(fileName) as ArrayBuffer | undefined;
}

/**
 * Gets the loading screen background texture key from the registry.
 * Set in Boot scene.
 *
 * @param scene - The Phaser scene (uses game registry)
 * @returns The texture key for the loading background, or undefined if not set
 */
export function getLoadingBgKey(scene: PhaserSceneLike): string | undefined {
    return getRegistryValue<string>(scene.registry, LOADING_BG_KEY);
}

/**
 * Login-screen background texture id (e.g. `login-screen-bg`). Set in Boot under `LOGIN_SCREEN_BG_KEY`.
 */
export function getLoginScreenBgKey(scene: PhaserSceneLike): string | undefined {
    return getRegistryValue<string>(scene.registry, LOGIN_SCREEN_BG_KEY);
}

/**
 * Gets item pack sprite sheets from the game's registry.
 * Set by LoadingScreen when sprite-item-pack is loaded.
 *
 * @param game - The Phaser game instance
 * @returns The HBSpriteSheet array, or undefined if not yet loaded
 */
export function getItemPackSpriteSheets(game: PhaserGameLike): HBSpriteSheet[] | undefined {
    return getRegistryValue<HBSpriteSheet[]>(game.registry, ITEM_PACK_SPRITE_SHEETS_KEY);
}

/**
 * Gets the set of emitted tint keys for item pack sprites.
 * Tracks which tinted frames have been emitted to avoid duplicates.
 *
 * @param game - The Phaser game instance
 * @returns The Set of emitted tint keys, or undefined if not yet initialized
 */
export function getItemPackEmittedTintKeys(game: PhaserGameLike): Set<string> | undefined {
    return getRegistryValue<Set<string>>(game.registry, ITEM_PACK_EMITTED_TINT_KEYS_KEY);
}

/**
 * Sets item pack sprite sheets in the game's registry.
 *
 * @param game - The Phaser game instance
 * @param spriteSheets - The HBSpriteSheet array from the loaded sprite-item-pack
 */
export function setItemPackSpriteSheets(game: PhaserGameLike, spriteSheets: HBSpriteSheet[]): void {
    game.registry.set(ITEM_PACK_SPRITE_SHEETS_KEY, spriteSheets);
}

/**
 * Sets the emitted tint keys set in the game's registry.
 * Call when initializing item pack (e.g., with new Set<string>()).
 *
 * @param game - The Phaser game instance
 * @param emitted - The Set to track emitted tint keys
 */
export function setItemPackEmittedTintKeys(game: PhaserGameLike, emitted: Set<string>): void {
    game.registry.set(ITEM_PACK_EMITTED_TINT_KEYS_KEY, emitted);
}

/**
 * Gets the player's world position from the game's registry.
 * Set by GameWorld when the player is created and by Player when position changes.
 *
 * @param game - The Phaser game instance
 * @returns The player position { x, y }, or undefined if not yet set
 */
export function getPlayerPosition(game: PhaserGameLike): { x: number; y: number } | undefined {
    return getRegistryValue<{ x: number; y: number }>(game.registry, PLAYER_POSITION_KEY);
}

/**
 * Sets the player's world position in the game's registry.
 *
 * @param game - The Phaser game instance
 * @param x - World X coordinate
 * @param y - World Y coordinate
 */
export function setPlayerPosition(game: PhaserGameLike, x: number, y: number): void {
    game.registry.set(PLAYER_POSITION_KEY, { x, y });
}

export interface InitialGameWorldState {
    gameWorldId?: string;
    mapName: string;
    musicFile?: string;
    playerX: number;
    playerY: number;
    playerId?: string;
    /** Server `movement_speed_ms`: final per-tile duration; apply to movement without run/walk math. */
    movementSpeedMs?: number;
    runMode?: boolean;
    attackMode?: boolean;
    /** Olympia Safe Attack (Home); blocks non-enemy PvP while armed. */
    safeAttackMode?: boolean;
    /** Local citizenship side from InitialState. */
    citizenshipSide?: string;
    attackType?: number;
    allowDashAttack?: boolean;
    teleportLocs?: TeleportLocSet[];
    awaitTransferredWorldState?: boolean;
    attackRangeCells?: number;
    attackDamage?: number;
    attackSpeedMs?: number;
    /** Server stunlock duration (ms) for Stun hits when present. */
    attackStunDurationMs?: number;
    /** Full spell cast bar duration in ms (InitialGameWorldState). */
    castSpeedMs?: number;
    /** Server arrow speed for visuals and alignment with damage timing (px/s). */
    arrowSpeedPxPerSec?: number;
    /** Authoritative self HP when provided by server (InitialGameWorldState). */
    hp?: number;
    /** Authoritative self max HP when provided by server (InitialGameWorldState). */
    maxHp?: number;
    /** Full pickup animation duration in ms (InitialGameWorldState). */
    playerPickupAnimationTimeMs?: number;
    /** Full bow stance animation duration in ms (InitialGameWorldState). */
    playerBowAnimationDurationMs?: number;
    /** Whether the local player is already dead in the authoritative initial snapshot. */
    dead?: boolean;
    /** Authoritative grid facing 0–7 from InitialGameWorldState when present. */
    playerDirection?: number;
    /** Authoritative weather from server snapshot when present. */
    weather?: WeatherMode;
    /** Authoritative appearance from InitialState merge. */
    gender?: Gender;
    skinColor?: SkinColor;
    hairStyleIndex?: number;
    underwearColorIndex?: number;
}

/**
 * Gets and removes the initial game world state from the game's registry.
 * Set by LoginScreen when server sends InitialGameWorldState, or by GameWorld on map change.
 *
 * @param game - The Phaser game instance
 * @returns The initial game world state, or undefined if not set
 */
export function getAndRemoveInitialGameWorldState(game: PhaserGameLike): InitialGameWorldState | undefined {
    const value = getRegistryValue<InitialGameWorldState>(game.registry, INITIAL_GAME_WORLD_STATE_KEY);
    if (value) {
        game.registry.remove(INITIAL_GAME_WORLD_STATE_KEY);
    }
    return value;
}

/**
 * Sets the initial game world state in the game's registry.
 *
 * @param game - The Phaser game instance
 * @param data - The initial game world state (map name, player coordinates)
 */
export function setInitialGameWorldState(game: PhaserGameLike, data: InitialGameWorldState): void {
    game.registry.set(INITIAL_GAME_WORLD_STATE_KEY, data);
}

/** Merge unique equipped appearance basenames until GameWorld drains them (InitialState prefetch). */
export function appendPendingPlayerItemAppearancePrefetch(game: PhaserGameLike, spriteNames: string[]): void {
    if (!spriteNames.length) {
        return;
    }
    const existing = getRegistryValue<string[]>(game.registry, PENDING_PLAYER_ITEM_APPEARANCE_PREFETCH_KEY) ?? [];
    const merged = [...new Set([...existing, ...spriteNames])];
    game.registry.set(PENDING_PLAYER_ITEM_APPEARANCE_PREFETCH_KEY, merged);
}

/** Remove and return queued prefetch basenames (caller starts loads on a stable scene). */
export function takePendingPlayerItemAppearancePrefetch(game: PhaserGameLike): string[] {
    const pending = getRegistryValue<string[]>(game.registry, PENDING_PLAYER_ITEM_APPEARANCE_PREFETCH_KEY);
    if (pending?.length) {
        game.registry.remove(PENDING_PLAYER_ITEM_APPEARANCE_PREFETCH_KEY);
        return pending;
    }
    return [];
}

export function clearPendingPlayerItemAppearancePrefetch(game: PhaserGameLike): void {
    game.registry.remove(PENDING_PLAYER_ITEM_APPEARANCE_PREFETCH_KEY);
}
