/**
 * Cast ritual → CastReady. Missing CAST body/clothes sheets never start an
 * animation; treating that as "done" skips the bar and lets an F7 click-through
 * confirm Missile on the same pointer (EnergyBolt / casting-circle FX).
 *
 * When appearance was not mutated (fail-closed Cast), idle may still be looping.
 * Ignore `animPlaying` in that case and advance on `castSpeed` only.
 */
export function shouldAdvanceCastToReady(
    animPlaying: boolean,
    elapsedMs: number,
    castSpeedMs: number,
    appearanceMutated = true,
): boolean {
    if (appearanceMutated && animPlaying) {
        return false;
    }
    return elapsedMs >= Math.max(0, castSpeedMs);
}

/**
 * Isolated-sheet check only. Magias prepare must not use this alone —
 * {@link canSpawnCastingCircleOnPrepare} is the fail-closed gate.
 */
export function canPresentCastingCircle(textureAlreadySafe: boolean): boolean {
    return textureAlreadySafe;
}

/**
 * Cast animation ON still entered Cast and spawned fogata (`drawEffect` →
 * GameAsset) when effect5-7 *looked* safe. That bind can steal `game.canvas`.
 * Missile select/prepare never paints the circle.
 */
export function canSpawnCastingCircleOnPrepare(): boolean {
    return false;
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
 *
 * Fail-closed for the whole magias UI path (F7 select → prepare → Cast),
 * not only PlayerState.Cast enter. #69 gated announce after Cast and missed
 * select-time Text / leftover FloatingText (Cast failed).
 */
export function canCreateMagiasUiPhaserText(): boolean {
    return false;
}

/** Same fail-closed gate as {@link canCreateMagiasUiPhaserText} (Cast-enter alias). */
export function canCreateCastAnnounceText(): boolean {
    return canCreateMagiasUiPhaserText();
}

/**
 * Magias select / prepare / Cast must never generateTexture / addCanvas(game.canvas)
 * / textures.remove a world-backed key / bind that key as a sprite.
 */
export function canMutateWorldCanvasTexturesOnCastEnter(): boolean {
    return false;
}

/** CanvasPool.create on a pooled `game.canvas` is the black-map steal. */
export function canTouchCanvasPoolOnMagiasSelect(): boolean {
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
        presentCircle:
            canSpawnCastingCircleOnPrepare() && canPresentCastingCircle(circleTextureAlreadySafe),
        fetchAppearanceSheets: canFetchAppearanceSheetOnStateEnter(true),
        createPhaserText: canCreateMagiasUiPhaserText(),
        mayMutateWorldCanvasTextures: canMutateWorldCanvasTexturesOnCastEnter(),
    };
}

export type MagiasSpellSelectPlan = {
    spellId: number;
    serverCatalogSpellId: number | undefined;
    useCastAnimationOn: boolean;
    createPhaserText: boolean;
    createFloatingText: boolean;
    mayTouchCanvasPoolForGameCanvas: boolean;
    fetchAppearanceSheets: boolean;
    presentCircle: boolean;
    mayMutateWorldCanvasTextures: boolean;
};

/**
 * F7 row click / F4 / shortcut: select + prepare. Must not allocate Phaser Text
 * or touch CanvasPool for `game.canvas` — that runs *before* PlayerState.Cast.
 */
export function planMagiasSpellSelect(
    spellId: number,
    mapToServerCatalog: (olympiaSpellId: number) => number | undefined,
    circleTextureAlreadySafe = false,
    useCastAnimationOn = true,
): MagiasSpellSelectPlan {
    const enter = planCastEnterVisuals(circleTextureAlreadySafe);
    return {
        spellId,
        serverCatalogSpellId: mapToServerCatalog(spellId),
        useCastAnimationOn,
        createPhaserText: canCreateMagiasUiPhaserText(),
        createFloatingText: canCreateMagiasUiPhaserText(),
        mayTouchCanvasPoolForGameCanvas: canTouchCanvasPoolOnMagiasSelect(),
        fetchAppearanceSheets: enter.fetchAppearanceSheets,
        presentCircle: enter.presentCircle,
        mayMutateWorldCanvasTextures: enter.mayMutateWorldCanvasTextures,
    };
}

export type MagiasSelectSceneProbe = {
    game: { canvas: { width: number; height: number } };
    add: { text: (...args: unknown[]) => unknown };
    textures: {
        addCanvas?: (...args: unknown[]) => unknown;
        remove?: (...args: unknown[]) => unknown;
        generateTexture?: (...args: unknown[]) => unknown;
    };
};

/**
 * Applies the F7 Missile-select visual plan to a scene probe.
 * Fail-closed: never calls `add.text` / addCanvas / generateTexture / textures.remove.
 * Begins the magias ritual so FloatingText constructed during select is a no-op.
 */
export function applyMagiasSpellSelectVisuals(
    spellId: number,
    scene: MagiasSelectSceneProbe,
    mapToServerCatalog: (olympiaSpellId: number) => number | undefined,
): MagiasSpellSelectPlan {
    beginMagiasRitual();
    const plan = planMagiasSpellSelect(spellId, mapToServerCatalog, false);
    if (
        plan.createPhaserText
        || plan.createFloatingText
        || plan.mayTouchCanvasPoolForGameCanvas
        || plan.mayMutateWorldCanvasTextures
        || plan.fetchAppearanceSheets
        || plan.presentCircle
    ) {
        scene.add.text(0, 0, 'magias-select');
        scene.textures.addCanvas?.('magias-select', scene.game.canvas as HTMLCanvasElement);
        scene.textures.generateTexture?.('magias-select');
        scene.textures.remove?.('magias-select');
    }
    return plan;
}

let magiasRitualActive = false;

/**
 * Armed at F7 spell *select* (before PlayerState.Cast). FloatingText / add.text
 * during the ritual steal a pooled `game.canvas`.
 */
export function beginMagiasRitual(): void {
    magiasRitualActive = true;
}

export function endMagiasRitual(): void {
    magiasRitualActive = false;
}

export function isMagiasRitualActive(): boolean {
    return magiasRitualActive;
}
