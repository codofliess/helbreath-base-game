/**
 * Cast ritual → CastReady. Missing CAST body/clothes sheets never start an
 * animation; treating that as "done" skips the bar and lets an F7 click-through
 * confirm Missile on the same pointer (EnergyBolt / casting-circle FX).
 */
export function shouldAdvanceCastToReady(
    animPlaying: boolean,
    elapsedMs: number,
    castSpeedMs: number,
): boolean {
    if (animPlaying) {
        return false;
    }
    return elapsedMs >= Math.max(0, castSpeedMs);
}

/**
 * Casting circle (`effect5` sheet 7) is presented only when that key is
 * already a safe isolated sheet. Missile prepare must not HTTP+decode it —
 * that path still ran after PR #67 and can lose the Canvas 2D context.
 */
export function canPresentCastingCircle(textureAlreadySafe: boolean): boolean {
    return textureAlreadySafe;
}

/**
 * Cast enter must not fetch clothes / angelic CAST sheets (armour base 8).
 * World enter only settled idle 0–3; first Missile prepare was the decode.
 */
export function canFetchAppearanceSheetOnStateEnter(isCastState: boolean): boolean {
    return !isCastState;
}
