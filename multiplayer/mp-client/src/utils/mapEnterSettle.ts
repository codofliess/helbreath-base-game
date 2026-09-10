/**
 * Post-paint settle after a GameWorld map load (login or city↔tower transfer).
 *
 * PR #79 lands Magias testers on Elvine streets (158,57) and Wizard Tower door
 * (181,78). The 10–20s pad-standstill cascade was budgeted for the open slime
 * plaza (149,131). After Gandalf the client restarts onto dense city tiles and
 * immediately farms — the old schedule dropped slime enters for 12s (0 kills)
 * then dumped monsters + trees + equipped decode + zoom restream together
 * (Chrome discard / Aw Snap 9).
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

/** Retry heavy/zoom/HUD work while the player is still fighting. */
export const MAP_ENTER_HEAVY_DECODE_RETRY_MS = 2_000;

export type HeavyEnterDecodeInput = {
    loadingMap: boolean;
    castingOrPreparing: boolean;
    moving: boolean;
};

/**
 * Gear / HUD / zoom-out must not run mid-Fire-Strike or mid-walk on city tiles.
 * Placeholders stay until the player stands still between pulls.
 */
export function shouldDeferHeavyEnterDecode(input: HeavyEnterDecodeInput): boolean {
    return input.loadingMap || input.castingOrPreparing || input.moving;
}

/** True when an async expand/tree/prefetch closure belongs to a previous scene.restart. */
export function isStaleMapLoad(currentGeneration: number, expectedGeneration: number): boolean {
    return currentGeneration !== expectedGeneration;
}

export function nextMapLoadGeneration(currentGeneration: number): number {
    return currentGeneration >= Number.MAX_SAFE_INTEGER ? 1 : currentGeneration + 1;
}
