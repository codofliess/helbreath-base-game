/**
 * Configuration constants for the game client: tuning values, layout, defaults, and feature toggles.
 */

/**
 * Whether to generate the minimap when loading a map.
 * Full-map WebGL snapshots are skipped in MapManager (viewport stream only) so this flag
 * cannot allocate the whole world during "Loading map".
 */
export const GENERATE_MINIMAP = true;

/**
 * Player body horizontal scale vs height (height stays 1).
 * Olympia classic FOV looks noticeably wider; ~12% stretch matches that “wide” feel without
 * looking cartoonish. Tune after live playtest (1.0 = off, 1.08–1.15 = good range).
 */
export const PLAYER_BODY_SCALE_X = 1.12;

/**
 * World entities (monsters / NPCs) horizontal scale — same Olympia-wide treatment as players.
 */
export const WORLD_ENTITY_SCALE_X = 1.1;

/**
 * When true, during minimap capture the scene (map tiles + objects)
 * is captured as a PNG and triggered for browser download.
 */
export const DOWNLOAD_MAP_SNAPSHOT = false;

/**
 * Shrink multiplier for map snapshot to avoid WebGL framebuffer size limits.
 * Output size is (mapWidth / multiplier) x (mapHeight / multiplier).
 * Use 1 for full resolution; increase (e.g. 3) for large maps that exceed GPU limits.
 * 1 doesn't work very well, use 2 or 3 for most maps
 */
export const MAP_SNAPSHOT_SHRINK_MULTIPLIER = 3;

/**
 * Default movement speed slider value (0-100).
 * Used as the initial movement speed when no value is stored in localStorage.
 */
export const DEFAULT_MOVEMENT_SPEED = 80;

/** Summon Monster dialog: per-tile duration in ms (200–2000; 2000 = Immobile sentinel). */
export const MONSTER_DIALOG_MIN_MOVEMENT_MS = 200;

/** Summon Monster dialog: Immobile (server maps to 0 movement speed). */
export const MONSTER_DIALOG_IMMOBILE_MS = 2000;

/** Maps stored ms to linear slider value: `invertSum - ms` (slow/immobile left, fast right). */
export const MONSTER_DIALOG_MOVEMENT_SLIDER_INVERT_SUM =
    MONSTER_DIALOG_MIN_MOVEMENT_MS + MONSTER_DIALOG_IMMOBILE_MS;

/**
 * Default per-tile movement duration for the Summon Monster dialog (ms).
 * Matches the former 0–100 slider midpoint (~600ms per step).
 */
export const MONSTER_DIALOG_DEFAULT_MOVEMENT_MS = 600;

/** Summon Monster dialog: full melee swing duration (ms). Left of slider = slower (higher ms), right = faster (lower ms). */
export const MONSTER_DIALOG_MIN_ATTACK_SPEED_MS = 200;

export const MONSTER_DIALOG_MAX_ATTACK_SPEED_MS = 2000;

/** Same invert as player attack speed / movement sliders: `min + max - ms` for linear slider position. */
export const MONSTER_DIALOG_ATTACK_SPEED_SLIDER_INVERT_SUM =
    MONSTER_DIALOG_MIN_ATTACK_SPEED_MS + MONSTER_DIALOG_MAX_ATTACK_SPEED_MS;

/** Default swing duration for the summon dialog (ms); matches server `monsterDefaults.attackSpeed` and player default. */
export const MONSTER_DIALOG_DEFAULT_ATTACK_SPEED_MS = 600;

/** Summon Monster dialog: post-hit attack recovery gate (ms). Slider left = slow (2000ms), right = none (0ms). */
export const MONSTER_DIALOG_MIN_ATTACK_RECOVERY_MS = 0;

export const MONSTER_DIALOG_MAX_ATTACK_RECOVERY_MS = 2000;

/** `min + max` so slider position = this value minus displayed ms (same pattern as attack speed). */
export const MONSTER_DIALOG_ATTACK_RECOVERY_SLIDER_INVERT_SUM =
    MONSTER_DIALOG_MIN_ATTACK_RECOVERY_MS + MONSTER_DIALOG_MAX_ATTACK_RECOVERY_MS;

/** Default recovery; matches server `monsterDefaults.attackRecoveryTime`. */
export const MONSTER_DIALOG_DEFAULT_ATTACK_RECOVERY_MS = 400;

/** Summon Monster dialog: player stunlock duration from monster Stun/Knockback hits (ms). Server accepts 100–2000. */
export const MONSTER_DIALOG_MIN_STUN_DURATION_MS = 100;

export const MONSTER_DIALOG_MAX_STUN_DURATION_MS = 2000;

/** Default stun duration slider value (matches typical player attack stun default). */
export const MONSTER_DIALOG_DEFAULT_STUN_DURATION_MS = 500;

/**
 * Default full melee swing duration in ms (player dialog slider range 200–2000).
 */
export const DEFAULT_PLAYER_ATTACK_SPEED_MS = 600;

/**
 * Default player attack range in cells (1-20).
 */
export const DEFAULT_PLAYER_ATTACK_RANGE = 2;

/**
 * Extra ms added on top of server duration/remaining when arming local movement stunlock (clock skew).
 * Half RTT is added separately in Player (see armLocalPlayerMovementStunlockFromNow).
 */
export const MOVEMENT_STUNLOCK_CLIENT_BUFFER_MS = 100;

/**
 * Stunlock duration in milliseconds for monsters after interrupted attack.
 * Monster cannot move, attack, or perform any action during this period.
 */
export const MONSTER_STUNLOCK_DURATION_MS = 500;

/** Take-damage animation length when the player hits a monster with interrupt attack type (server `monster_take_damage`). */
export const MONSTER_INTERRUPT_HIT_DURATION_MS = 100;

/**
 * Duration for knockback movement in milliseconds (TakeDamageWithKnockback).
 * Used by both Monster and Player for consistent knockback speed.
 */
export const KNOCKBACK_DURATION_MS = 100;

/**
 * Default animation frame rate in frames per second.
 * Used for idle and death animations.
 */
export const DEFAULT_ANIMATION_FRAME_RATE = 10;

/**
 * When true, initial loading only preloads the monster placeholder
 * and fetches concrete monster sprite/sound assets as monsters enter view.
 * ZIP archives generated by `tools/compress-assets.js` follow the same filtered manifest.
 */
export const LOAD_MONSTER_ASSETS_ON_DEMAND = true;

/**
 * When true, initial loading skips all `.amd` maps and tile `.spr` packs; GameWorld fetches the
 * current `.amd` and **viewport** tile sheets (spawn camera + ring), not every pack the map
 * references. Requires HTTP paths `assets/maps/*` and `assets/sprites/*`.
 */
export const LOAD_MAP_ASSETS_ON_DEMAND = true;

/**
 * When true, item equipped appearance `.spr` files (from `Items.ts` `equippedSpriteMale` /
 * `equippedSpriteFemale`) are not preloaded; each player's gender-resolved sprite name is fetched
 * when that layer is needed. Requires HTTP `assets/sprites/*` when ZIP loading is off.
 * ZIP output from `tools/compress-assets.js` omits those sprites when this matches Config.
 */
export const LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND = true;

/**
 * Phaser texture key for a 1×1 transparent placeholder used while a lazy item appearance `.spr` loads.
 * Registered in {@link Boot}.
 */
export const PLAYER_ITEM_APPEARANCE_PENDING_TEXTURE = 'player-item-appearance-pending';

/**
 * Monster sprite shell used while a concrete monster's on-demand assets are still loading.
 * Kept for structural spawn (states/shadow layout) only — the body is fully hidden until
 * the real `.spr` registers (see Monster.assetsPendingLoad) so players never see the
 * purple `ghk` ninja stand-in on every late-loading mob.
 */
export const MONSTER_PLACEHOLDER_SPRITE = 'ghk';

/**
 * Dialog positioning constants.
 * These define the approximate widths of dialogs and spacing for sequential positioning.
 */
export const CONTROLS_DIALOG_WIDTH = 250;
export const MAP_DIALOG_WIDTH = 220;
export const CAMERA_DIALOG_WIDTH = 240;
export const SOUND_DIALOG_WIDTH = 220;
export const PLAYER_DIALOG_WIDTH = 220;
export const DIALOG_PADDING = 10; // Padding between dialogs
export const DIALOG_START_X = 20;
export const DIALOG_START_Y = 20;

/**
 * Minimum time between movement commands in milliseconds.
 * Used to throttle movement commands to prevent overshooting.
 */
export const MOVEMENT_COMMAND_THROTTLE_MS = 100;

/**
 * Maximum distance for spatial audio in grid cells.
 * Sounds beyond this distance are inaudible.
 */
export const MAX_SPATIAL_AUDIO_DISTANCE = 20;

/** Summon Monster dialog: max Chebyshev chase distance before abandoning target (cells). Matches server `chase_range_cells`. */
export const MONSTER_MIN_CHASE_RANGE_CELLS = 1;

export const MONSTER_MAX_CHASE_RANGE_CELLS = 20;

/** Default chase range; matches server `monsterDefaults.chaseMaxDistance` when set (10). */
export const MONSTER_DEFAULT_CHASE_RANGE_CELLS = 10;

/** Summon Monster dialog: Chebyshev melee reach (cells). Matches server `attack_range_cells`. */
export const MONSTER_MIN_ATTACK_RANGE_CELLS = 1;

export const MONSTER_MAX_ATTACK_RANGE_CELLS = 20;

/** Default attack range when catalog uses implicit 1. */
export const MONSTER_DEFAULT_ATTACK_RANGE_CELLS = 1;

/**
 * Transparency for the monster hover overlay (0-1).
 * 0 = fully transparent, 1 = fully opaque.
 */
export const MONSTER_OVERLAY_TRANSPARENCY = 0.9;

/**
 * Vertical offset in pixels below monster center for monster hover overlay anchor.
 */
export const MONSTER_HOVER_OVERLAY_ANCHOR_OFFSET_Y = 30;

/**
 * Olympia `DrawObjectName(sX, sY)` draws at the character feet pivot (same as draw pos).
 * Extra Y after feet is 0 — name line starts at feet; guild/affiliation use +14 / +28 in the overlay.
 * (Previously +30 from cell center, which floated the block far below the feet.)
 */
export const PLAYER_HOVER_OVERLAY_ANCHOR_OFFSET_Y = 0;

/**
 * Interval in milliseconds for game stats and monster hover updates.
 */
export const GAME_STATS_UPDATE_INTERVAL_MS = 10;

/**
 * Multiplier for world-Y-based depth calculation. Depth = worldY * DEPTH_MULTIPLIER.
 * All depth offsets used with this system should be scaled by 10 (e.g. -1 → -10, +5 → +50).
 */
export const DEPTH_MULTIPLIER = 100;

/**
 * Entities (players/mobs) sit above same-row map objects (carpets, pads, furniture).
 * Map objects use y * DEPTH_MULTIPLIER; next row is +100, so keep bias &lt; 100.
 * 50 = classic “+5” scaled; high enough that flat pads no longer cover feet.
 */
/**
 * Was 50 → 70; 85 keeps tall mob feet above same-row pads/decals during animation frames
 * without overtaking the next map row (+100). Paired with visual-Y depth in GameObject.
 */
export const ENTITY_DEPTH_BIAS = 85;

/**
 * Spell / cast VFX depth over worldY * DEPTH_MULTIPLIER.
 * Was 70 (under next ground rows) → tall explosions looked “cut off” mid-sprite.
 * Use multi-row lift so Bloody Shock / Energy Strike / explosions always paint above terrain.
 * Y-sort vs far southern entities is less critical than not clipping VFX.
 */
export const MAGIC_VFX_DEPTH_BIAS = 900;

/**
 * Status rings / buff shadows under the body but above map objects/carpets.
 */
export const STATUS_FOOT_DEPTH_BIAS = 40;

/**
 * Depth for effects that should render above everything else (e.g. projectiles, critical strike).
 */
export const HIGH_DEPTH = 5000000;

/**
 * Depth for loading overlay (covers screen during map load).
 */
export const LOADING_OVERLAY_DEPTH = 10000000;

/**
 * Depth for loading text (above loading overlay).
 */
export const LOADING_TEXT_DEPTH = 10000001;

/**
 * Frames to wait after camera restoration before removing loading overlay.
 * Ensures zoom/scroll changes are fully rendered (~1 second at 30fps).
 */
export const FRAMES_UNTIL_OVERLAY_REMOVAL = 30;

/**
 * Spatial grid radius in cells for map object collision lookup.
 * Phase 1: get candidates within this radius (fast).
 */
export const MAP_OBJECT_COLLISION_GRID_RADIUS_CELLS = 24;

/**
 * Filter radius in cells for map object collision.
 * Phase 2: filter candidates by accurate distance (precise).
 */
export const MAP_OBJECT_COLLISION_RADIUS_CELLS = 12;

/**
 * Alpha (0-1) for map objects when player is behind them (collision transparency).
 */
export const MAP_OBJECT_COLLISION_ALPHA = 0.5;

/**
 * Depth for floating text (damage numbers, etc.) - above all game objects and debug.
 */
export const FLOATING_TEXT_DEPTH = 100000;

/**
 * Alpha reduction per frame for monster corpse fade-out (0-255 range).
 */
export const MONSTER_CORPSE_FADE_ALPHA_STEP = 10;

/**
 * Player health bar width in pixels.
 */
export const PLAYER_HEALTH_BAR_WIDTH = 30;

/**
 * Player health bar height in pixels.
 */
export const PLAYER_HEALTH_BAR_HEIGHT = 3;

/**
 * List of sprite names that have shadows enabled.
 * Shadows are rendered beneath these sprites for depth visualization.
 */
export const SPRITES_WITH_SHADOWS: readonly string[] = [
    'map-tile-223',
] as const;

/**
 * When true, the loading scene reads assets from public/assets.zip.
 * When false, assets are loaded individually from public/assets.
 */
export const ENABLE_ZIP_LOADING = false;

