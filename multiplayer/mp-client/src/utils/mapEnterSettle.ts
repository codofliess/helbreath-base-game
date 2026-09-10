/**
 * Post-paint settle after a GameWorld map load (login or city↔tower transfer).
 *
 * Chile journal (64.176.23.40): Elon never reached slime. Repeated sessions stuck
 * in Wizard Tower `elvwzdtwr` at ~(43,34) (Gandalf pad), flat exp, then
 * `[GameWorld:elvwzdtwr] Player disconnected` ~1–2 min later. Server RSS ~262MB,
 * no dmesg OOM. Login idle 2 min does not discard — pressure is world / Tower /
 * city-walk texture load.
 *
 * Sitting at Gandalf is idle. Gating heavy decode on "moving or casting" still
 * dumps equipped-gear (Elvine F5 OOM path) + zoom-out + HUD at T+16–20s on that
 * pad. Compact interiors skip that cascade; every map also holds it while the
 * player has not walked off the enter cell.
 */

/** First monster/player sync after tiles+player exist. Must stay << tree/gear delays. */
export const MAP_ENTER_MONSTER_SYNC_MS = 400;

/** Tree-shadow pass (after expand). Literal kept so live-memory assert can see the cadence. */
export const MAP_ENTER_TREE_PASS_MS = 10_000;

/** Catch-up entity sync if early spawn missed an in-view burst. */
export const MAP_ENTER_ENTITY_CATCHUP_MS = 12_000;

/** NPC spr decode — city streets have few catalog NPCs; keep off the monster tick. */
export const MAP_ENTER_NPC_SYNC_MS = 14_000;

/** Equipped appearance / paper-doll gear (Elvine F5 OOM path). */
export const MAP_ENTER_HEAVY_DECODE_MS = 16_000;

/** Restore saved camera zoom (zoom-out enlarges the stream frustum). */
export const MAP_ENTER_ZOOM_RESTORE_MS = 18_000;

/** Cursor + HUD icon sheets. */
export const MAP_ENTER_HUD_SPRITES_MS = 20_000;

/** Retry heavy/zoom/HUD work while the player is still on the enter pad or fighting. */
export const MAP_ENTER_HEAVY_DECODE_RETRY_MS = 2_000;

/** wzdtwr_1 is 100×100. Elvine / Aresden plazas are 300×300. */
export const COMPACT_INTERIOR_MAX_SIZE_TILES = 100;

export type HeavyEnterDecodeInput = {
    loadingMap: boolean;
    castingOrPreparing: boolean;
    moving: boolean;
    /** Chile: sit at Gandalf (43,34) is idle — must not dump F5 gear/zoom/HUD. */
    standingAtEnterFocus: boolean;
};

export type CompactInteriorInput = {
    sizeX: number;
    sizeY: number;
    worldId?: string;
    mapName?: string;
};

/**
 * Gear / HUD / zoom-out / trees must not run mid-Fire-Strike, mid-walk, or while
 * still standing on the enter cell (Tower pad or city spawn).
 */
export function shouldDeferHeavyEnterDecode(input: HeavyEnterDecodeInput): boolean {
    return input.loadingMap || input.castingOrPreparing || input.moving || input.standingAtEnterFocus;
}

export function isCompactInteriorMap(sizeX: number, sizeY: number): boolean {
    return (
        Number.isFinite(sizeX) &&
        Number.isFinite(sizeY) &&
        sizeX > 0 &&
        sizeY > 0 &&
        sizeX <= COMPACT_INTERIOR_MAX_SIZE_TILES &&
        sizeY <= COMPACT_INTERIOR_MAX_SIZE_TILES
    );
}

export function isWizardTowerMap(worldId?: string, mapName?: string): boolean {
    const blob = `${worldId ?? ''}\n${mapName ?? ''}`.toLowerCase();
    return blob.includes('wzdtwr');
}

/** Skip tree / gear / zoom-out / HUD cascade on Wizard Tower and other small interiors. */
export function shouldSkipEnterHeavyCascade(input: CompactInteriorInput): boolean {
    return isWizardTowerMap(input.worldId, input.mapName) || isCompactInteriorMap(input.sizeX, input.sizeY);
}

/**
 * Elon path: Wizard Tower → city → gates. Once they leave the door cell, abort the
 * enter-ring object dump and let walk restream create props a handful at a time.
 */
export function shouldAbortEnterExpandForWalk(standingAtEnterFocus: boolean): boolean {
    return !standingAtEnterFocus;
}

/** Survives city↔tower `scene.restart` so the city door does not dump plaza props. */
export const ENTER_FROM_COMPACT_INTERIOR_REGISTRY_KEY = 'enterFromCompactInterior';

export function markEnterFromCompactInterior(registry: { set: (key: string, value: boolean) => void }): void {
    registry.set(ENTER_FROM_COMPACT_INTERIOR_REGISTRY_KEY, true);
}

export function takeEnterFromCompactInterior(registry: {
    get: (key: string) => unknown;
    remove?: (key: string) => void;
}): boolean {
    const flagged = registry.get(ENTER_FROM_COMPACT_INTERIOR_REGISTRY_KEY) === true;
    registry.remove?.(ENTER_FROM_COMPACT_INTERIOR_REGISTRY_KEY);
    return flagged;
}

/**
 * Login idle does not discard. Paper-doll toDataURL on Tower / post-Tower city
 * enter is the Elvine F5 OOM path — skip until the map settle finishes.
 */
export function shouldSkipEnterPaperDollCapture(input: {
    loadingMap: boolean;
    compactInterior: boolean;
    enterFromCompactInterior: boolean;
}): boolean {
    return input.loadingMap || input.compactInterior || input.enterFromCompactInterior;
}

/** True when an async expand/tree/prefetch closure belongs to a previous scene.restart. */
export function isStaleMapLoad(currentGeneration: number, expectedGeneration: number): boolean {
    return currentGeneration !== expectedGeneration;
}

export function nextMapLoadGeneration(currentGeneration: number): number {
    return currentGeneration >= Number.MAX_SAFE_INTEGER ? 1 : currentGeneration + 1;
}
