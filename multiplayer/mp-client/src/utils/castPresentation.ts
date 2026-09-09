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
 * Cast enter must not fetch clothes / angelic CAST sheets (armour base 8)
 * and must not start the idle-pack helper (`scheduleLazyItemAppearanceIfNeeded`).
 * World enter only settled idle 0–3; first Missile prepare was the decode.
 */
export function canFetchAppearanceSheetOnStateEnter(isCastState: boolean): boolean {
    return !isCastState;
}

/**
 * Phaser `Text` → CanvasPool.create → textures.addCanvas. If `game.canvas`
 * was previously pooled (generateTexture / textures.remove of a world alias),
 * the announce steals and resizes the live world canvas. System log still
 * carries the spell name.
 */
export function canCreateCastAnnounceText(): boolean {
    return false;
}

/**
 * Cast-enter must never generateTexture / addCanvas(game.canvas) /
 * textures.remove a world-backed key / bind that key as a sprite.
 */
export function canMutateWorldCanvasTexturesOnCastEnter(): boolean {
    return false;
}

export type CastEnterVisualPlan = {
    presentCircle: boolean;
    fetchAppearanceSheets: boolean;
    createPhaserText: boolean;
    mayMutateWorldCanvasTextures: boolean;
};

/** Fail-closed Missile / Heal prepare: skip unsafe FX, still reach CastReady. */
export function planCastEnterVisuals(circleTextureAlreadySafe: boolean): CastEnterVisualPlan {
    return {
        presentCircle: canPresentCastingCircle(circleTextureAlreadySafe),
        fetchAppearanceSheets: canFetchAppearanceSheetOnStateEnter(true),
        createPhaserText: canCreateCastAnnounceText(),
        mayMutateWorldCanvasTextures: canMutateWorldCanvasTexturesOnCastEnter(),
    };
}
