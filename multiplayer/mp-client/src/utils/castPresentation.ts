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
 * Cast / CastReady must not fetch clothes / angelic CAST sheets (armour base 8)
 * and must not start the idle-pack helper (`scheduleLazyItemAppearanceIfNeeded`).
 * World enter only settled idle 0–3; first Missile prepare was the decode.
 * Pass true for CastReady as well — that state still binds appearance textures.
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

/**
 * Soft-cast confirm (CastReady → click mob / click-through) must not
 * generateTexture / addCanvas(game.canvas) / bind a world-canvas alias.
 * #71 guarded the pool on *select*; confirm still ran switchToIdle appearance.
 */
export function canMutateWorldCanvasTexturesOnCastConfirm(): boolean {
    return false;
}

/**
 * WASD / click-to-move / camera-follow restream during prepare must not
 * generateTexture / addCanvas(game.canvas) / rebuild the map tileset /
 * fetch walk clothes. #72 locked FOV size-write; select therefore stayed
 * painted. Move still rebuilt tiles (`createCanvas` + `getContext`) and
 * could apply Walk appearance — that is the remaining wipe.
 */
export function canMutateWorldCanvasOnMoveDuringPrepare(): boolean {
    return false;
}

/** Map tileset `createCanvas` / `textures.remove` / evict during Magias prepare. */
export function canRebuildMapTilesetOnMagiasPrepare(): boolean {
    return canMutateWorldCanvasOnMoveDuringPrepare();
}

/** Walk / Run `applyStateAppearance` while the Magias ritual is still armed. */
export function canApplyWalkAppearanceOnMagiasPrepare(): boolean {
    return canMutateWorldCanvasOnMoveDuringPrepare();
}

/**
 * Fail-closed Cast, CastReady, the Idle rebind after a skipped Cast, and
 * Walk/Run mid-prepare. #70 skipped Cast only; #71 skipped CastReady;
 * #72 skipped IdleFromCast; move-during-prepare still rebound Walk.
 */
export function shouldSkipCastCanvasWorkOnState(
    state: 'Cast' | 'CastReady' | 'Idle' | 'IdleFromCast' | 'MoveDuringPrepare',
): boolean {
    switch (state) {
        case 'IdleFromCast':
            return !canMutateWorldCanvasTexturesOnCastConfirm();
        case 'MoveDuringPrepare':
            return !canMutateWorldCanvasOnMoveDuringPrepare();
        case 'Cast':
        case 'CastReady':
            return !canMutateWorldCanvasTexturesOnCastEnter();
        case 'Idle':
            return false;
    }
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
        createCanvas?: (...args: unknown[]) => unknown;
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

export type MagiasSoftCastConfirmPlan = {
    spellId: number;
    createPhaserText: boolean;
    createFloatingText: boolean;
    mayTouchCanvasPoolForGameCanvas: boolean;
    mayMutateWorldCanvasTextures: boolean;
    fetchAppearanceSheets: boolean;
    presentCircle: boolean;
    spawnProjectileGameAsset: boolean;
    applyIdleAppearanceOnConfirm: boolean;
};

/**
 * CastReady → target mob (or F7 click-through onto a mob). Must not allocate
 * Phaser Text / touch CanvasPool for `game.canvas` / rebind idle sheets —
 * that is the #71 hole (select PASS, confirm FAIL).
 */
export function planMagiasSoftCastConfirm(spellId: number): MagiasSoftCastConfirmPlan {
    return {
        spellId,
        createPhaserText: canCreateMagiasUiPhaserText(),
        createFloatingText: canCreateMagiasUiPhaserText(),
        mayTouchCanvasPoolForGameCanvas: canTouchCanvasPoolOnMagiasSelect(),
        mayMutateWorldCanvasTextures: canMutateWorldCanvasTexturesOnCastConfirm(),
        fetchAppearanceSheets: canFetchAppearanceSheetOnStateEnter(true),
        presentCircle: canSpawnCastingCircleOnPrepare(),
        spawnProjectileGameAsset: false,
        applyIdleAppearanceOnConfirm: !shouldSkipCastCanvasWorkOnState('IdleFromCast'),
    };
}

/**
 * Applies the soft-cast confirm visual plan. Fail-closed: never Text /
 * addCanvas / generateTexture / textures.remove. Keeps the ritual armed so
 * FloatingText constructed during confirm is a no-op.
 */
export function applyMagiasSoftCastConfirmVisuals(
    spellId: number,
    scene: MagiasSelectSceneProbe,
): MagiasSoftCastConfirmPlan {
    beginMagiasRitual();
    const plan = planMagiasSoftCastConfirm(spellId);
    if (
        plan.createPhaserText
        || plan.createFloatingText
        || plan.mayTouchCanvasPoolForGameCanvas
        || plan.mayMutateWorldCanvasTextures
        || plan.fetchAppearanceSheets
        || plan.presentCircle
        || plan.spawnProjectileGameAsset
        || plan.applyIdleAppearanceOnConfirm
    ) {
        scene.add.text(0, 0, 'magias-confirm');
        scene.textures.addCanvas?.('magias-confirm', scene.game.canvas as HTMLCanvasElement);
        scene.textures.generateTexture?.('magias-confirm');
        scene.textures.remove?.('magias-confirm');
    }
    return plan;
}

export type MagiasMoveDuringPreparePlan = {
    spellId: number;
    createPhaserText: boolean;
    createFloatingText: boolean;
    mayTouchCanvasPoolForGameCanvas: boolean;
    mayMutateWorldCanvasTextures: boolean;
    fetchAppearanceSheets: boolean;
    presentCircle: boolean;
    applyWalkAppearanceOnMove: boolean;
    rebuildMapTileset: boolean;
    mayResizeWorldCanvas: boolean;
};

/**
 * Missile selected, Cast animation on, before mob click: WASD / camera
 * follow / FOV refresh. Must not allocate Phaser Text, rebuild the map
 * tileset, or rebind Walk sheets — that is the #72 hole (select PASS,
 * move mid-prepare FAIL).
 */
export function planMagiasMoveDuringPrepare(spellId: number): MagiasMoveDuringPreparePlan {
    return {
        spellId,
        createPhaserText: canCreateMagiasUiPhaserText(),
        createFloatingText: canCreateMagiasUiPhaserText(),
        mayTouchCanvasPoolForGameCanvas: canTouchCanvasPoolOnMagiasSelect(),
        mayMutateWorldCanvasTextures: canMutateWorldCanvasOnMoveDuringPrepare(),
        fetchAppearanceSheets: canFetchAppearanceSheetOnStateEnter(true),
        presentCircle: canSpawnCastingCircleOnPrepare(),
        applyWalkAppearanceOnMove: canApplyWalkAppearanceOnMagiasPrepare(),
        rebuildMapTileset: canRebuildMapTilesetOnMagiasPrepare(),
        mayResizeWorldCanvas: canMutateWorldCanvasOnMoveDuringPrepare(),
    };
}

/**
 * Applies the mid-prepare move visual plan. Fail-closed: never Text /
 * addCanvas / generateTexture / tileset createCanvas. Keeps the ritual
 * armed so a later soft-cast confirm is still gated.
 */
export function applyMagiasMoveDuringPrepareVisuals(
    spellId: number,
    scene: MagiasSelectSceneProbe,
): MagiasMoveDuringPreparePlan {
    beginMagiasRitual();
    const plan = planMagiasMoveDuringPrepare(spellId);
    if (
        plan.createPhaserText
        || plan.createFloatingText
        || plan.mayTouchCanvasPoolForGameCanvas
        || plan.mayMutateWorldCanvasTextures
        || plan.fetchAppearanceSheets
        || plan.presentCircle
        || plan.applyWalkAppearanceOnMove
        || plan.rebuildMapTileset
        || plan.mayResizeWorldCanvas
    ) {
        scene.add.text(0, 0, 'magias-move');
        scene.textures.addCanvas?.('magias-move', scene.game.canvas as HTMLCanvasElement);
        scene.textures.generateTexture?.('magias-move');
        scene.textures.createCanvas?.('magias-move-tileset', 32, 32);
        scene.textures.remove?.('magias-move');
        scene.game.canvas.width = 1;
        scene.game.canvas.height = 1;
    }
    return plan;
}

/** WASD / arrows during prepare: re-arm the ritual so later confirm stays gated. */
export function noteMagiasMoveDuringPrepareHotkey(): void {
    beginMagiasRitual();
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
