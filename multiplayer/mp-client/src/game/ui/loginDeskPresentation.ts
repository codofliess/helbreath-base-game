import { Scale, type Scene } from 'phaser';

/**
 * Logical SELECTCHAR / NEWCHAR buffer (classic ND_SELECTCHAR art = 800×600).
 *
 * Letterbox is owned by CSS in public/style.css (native cm units):
 *   left/right black  = 3.5cm
 *   top/bottom black  = 2.0cm
 * This module only: body class, Scale.NONE, 800×600 buffer, pointer displayScale.
 */
export const DESK_W = 800;
export const DESK_H = 600;

/** Kept for docs / callers; real letterbox is CSS `cm` in style.css. */
export const DESK_SIDE_BLACK_CM = 3.5;
export const DESK_VERT_BLACK_CM = 2.0;

const HOLD_RESYNC_MS = 3000;
const HOLD_RESYNC_INTERVAL_MS = 300;

let sharedResizedForDesk = false;
let sharedSavedGameW = 800;
let sharedSavedGameH = 600;
let sharedSavedScaleMode: number = Scale.FIT;
let sharedSavedAutoCenter: number = Scale.CENTER_BOTH;
let sharedActiveOwners = 0;
let applyInProgress = false;
let resyncBoundScene: Scene | undefined;
let resyncBoundGame: Scene['game'] | undefined;
let holdResyncUntilMs = 0;
let holdResyncIntervalId: number | undefined;

function safeResize(game: Scene['game'], width: number, height: number): void {
    try {
        if (!game.scale.parentSize) {
            return;
        }
        game.scale.resize(width, height);
    } catch (err) {
        console.warn('[loginDeskPresentation] scale.resize failed', err);
    }
}

/**
 * Sync Phaser pointer math to the CSS-sized canvas box.
 * MUST use current game buffer size (full-bleed char UI), not hardcoded 800×600 —
 * otherwise clicks land in the wrong sector of Character List / Create.
 */
function syncDisplayScaleFromDom(canvas: HTMLCanvasElement, game: Scene['game']): void {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
        return;
    }
    try {
        game.scale.updateBounds();
        // buffer px / CSS display px — use live scale size after full-bleed resize
        const bufW = Math.max(1, game.scale.width || DESK_W);
        const bufH = Math.max(1, game.scale.height || DESK_H);
        game.scale.displayScale.set(bufW / rect.width, bufH / rect.height);
    } catch {
        // ignore mid-teardown
    }
    document.body.dataset.loginDeskLeft = String(Math.round(rect.left));
    document.body.dataset.loginDeskTop = String(Math.round(rect.top));
    document.body.dataset.loginDeskW = String(Math.round(rect.width));
    document.body.dataset.loginDeskH = String(Math.round(rect.height));
    document.body.dataset.loginDeskViewport = `${window.innerWidth}x${window.innerHeight}`;
}

/**
 * Strip inline geometry Phaser may write so CSS letterbox owns the box.
 */
function clearInlineCanvasGeometry(canvas: HTMLCanvasElement): void {
    canvas.style.removeProperty('position');
    canvas.style.removeProperty('left');
    canvas.style.removeProperty('top');
    canvas.style.removeProperty('right');
    canvas.style.removeProperty('bottom');
    canvas.style.removeProperty('width');
    canvas.style.removeProperty('height');
    canvas.style.removeProperty('margin');
    canvas.style.removeProperty('max-width');
    canvas.style.removeProperty('max-height');
    canvas.style.removeProperty('min-width');
    canvas.style.removeProperty('min-height');
    canvas.style.removeProperty('transform');
    canvas.style.removeProperty('transform-origin');
    canvas.style.removeProperty('z-index');
}

/**
 * Chain Lords char UI: full-bleed canvas (hub language), not classic 800×600 letterbox.
 * Buffer = parent client size; CSS `body.login-charui-active` pins #game-container to inset 0.
 */
function applyDeskPresentation(scene: Scene): void {
    const game = scene.game;
    const canvas = game.canvas;
    if (!canvas) {
        return;
    }

    document.body.classList.remove('game-world-active');
    document.body.classList.remove('login-selectchar-active');
    document.body.classList.add('login-charui-active');

    document.body.style.removeProperty('--login-desk-scale');
    document.body.style.removeProperty('--login-desk-left');
    document.body.style.removeProperty('--login-desk-top');
    document.body.style.removeProperty('--login-desk-width');
    document.body.style.removeProperty('--login-desk-height');
    const root = document.documentElement;
    root.style.removeProperty('--hb-canvas-left');
    root.style.removeProperty('--hb-canvas-top');
    root.style.removeProperty('--hb-canvas-width');
    root.style.removeProperty('--hb-canvas-height');
    root.style.removeProperty('--hb-canvas-inset-bottom');
    root.style.removeProperty('--hb-canvas-inset-top');

    canvas.classList.add('login-charui-canvas');
    canvas.classList.remove('login-selectchar-canvas');
    canvas.classList.remove('game-world-canvas');
    clearInlineCanvasGeometry(canvas);

    game.scale.scaleMode = Scale.NONE;
    game.scale.autoCenter = Scale.NO_CENTER;

    const parentEl = game.scale.parent as HTMLElement | null;
    const pw = Math.max(640, Math.floor(parentEl?.clientWidth || window.innerWidth || DESK_W));
    const ph = Math.max(480, Math.floor(parentEl?.clientHeight || window.innerHeight || DESK_H));
    // Avoid 1px thrash loops: only resize when the parent actually changed.
    if (Math.abs(game.scale.width - pw) > 4 || Math.abs(game.scale.height - ph) > 4) {
        safeResize(game, pw, ph);
    }

    clearInlineCanvasGeometry(canvas);
    syncDisplayScaleFromDom(canvas, game);
}

function resyncBoundDeskCss(): void {
    const scene = resyncBoundScene;
    if (!scene || !sharedResizedForDesk || sharedActiveOwners <= 0) {
        return;
    }
    if (!scene.game.canvas || scene.game.scale.isFullscreen) {
        return;
    }
    applyDeskPresentation(scene);
}

function stopHoldResync(): void {
    holdResyncUntilMs = 0;
    if (holdResyncIntervalId !== undefined) {
        window.clearInterval(holdResyncIntervalId);
        holdResyncIntervalId = undefined;
    }
}

function startHoldResync(scene: Scene, durationMs = HOLD_RESYNC_MS): void {
    holdResyncUntilMs = Math.max(holdResyncUntilMs, performance.now() + durationMs);
    if (holdResyncIntervalId !== undefined) {
        return;
    }
    holdResyncIntervalId = window.setInterval(() => {
        if (performance.now() > holdResyncUntilMs || sharedActiveOwners <= 0) {
            stopHoldResync();
            return;
        }
        resyncBoundScene = scene;
        resyncBoundDeskCss();
    }, HOLD_RESYNC_INTERVAL_MS);
}

function bindDeskCssResync(scene: Scene): void {
    if (resyncBoundScene === scene && resyncBoundGame === scene.game) {
        return;
    }
    unbindDeskCssResync();
    resyncBoundScene = scene;
    resyncBoundGame = scene.game;
    scene.scale.on('resize', resyncBoundDeskCss);
    window.addEventListener('resize', resyncBoundDeskCss);
    window.addEventListener('focus', resyncBoundDeskCss);
    document.addEventListener('visibilitychange', resyncBoundDeskCss);
}

function unbindDeskCssResync(): void {
    stopHoldResync();
    if (resyncBoundScene) {
        resyncBoundScene.scale.off('resize', resyncBoundDeskCss);
    }
    window.removeEventListener('resize', resyncBoundDeskCss);
    window.removeEventListener('focus', resyncBoundDeskCss);
    document.removeEventListener('visibilitychange', resyncBoundDeskCss);
    resyncBoundScene = undefined;
    resyncBoundGame = undefined;
}

export function applyLoginDeskCanvasPresentation(scene: Scene, alreadyActive: boolean): boolean {
    const game = scene.game;
    const canvas = game.canvas;
    if (!canvas) {
        return alreadyActive;
    }

    if (applyInProgress) {
        return true;
    }

    if (game.scale.isFullscreen) {
        if (alreadyActive) {
            document.body.classList.remove('login-selectchar-active');
            sharedActiveOwners = Math.max(0, sharedActiveOwners - 1);
            if (sharedActiveOwners <= 0) {
                unbindDeskCssResync();
            }
        }
        return false;
    }

    applyInProgress = true;
    try {
        if (!alreadyActive) {
            sharedActiveOwners += 1;
        }

        if (!sharedResizedForDesk) {
            sharedSavedGameW = game.scale.width;
            sharedSavedGameH = game.scale.height;
            sharedSavedScaleMode = game.scale.scaleMode;
            sharedSavedAutoCenter = game.scale.autoCenter;
            sharedResizedForDesk = true;
        }

        applyDeskPresentation(scene);
        bindDeskCssResync(scene);
        startHoldResync(scene);
        window.requestAnimationFrame(() => {
            if (sharedActiveOwners > 0) {
                applyDeskPresentation(scene);
            }
            window.requestAnimationFrame(() => {
                if (sharedActiveOwners > 0) {
                    applyDeskPresentation(scene);
                }
            });
        });
        return true;
    } finally {
        applyInProgress = false;
    }
}

export function resyncLoginDeskCanvasPresentation(scene: Scene): void {
    if (!sharedResizedForDesk || sharedActiveOwners <= 0) {
        return;
    }
    if (!scene.game.canvas || scene.game.scale.isFullscreen) {
        return;
    }
    applyDeskPresentation(scene);
}

export function holdLoginDeskCanvasPresentation(scene: Scene, durationMs = HOLD_RESYNC_MS): void {
    if (sharedActiveOwners <= 0 || !sharedResizedForDesk) {
        return;
    }
    resyncBoundScene = scene;
    resyncBoundGame = scene.game;
    startHoldResync(scene, durationMs);
    resyncLoginDeskCanvasPresentation(scene);
}

function clearDeskCanvasDom(canvas: HTMLCanvasElement | null | undefined): void {
    document.body.classList.remove('login-selectchar-active');
    document.body.classList.remove('login-charui-active');
    delete document.body.dataset.loginDeskLeft;
    delete document.body.dataset.loginDeskTop;
    delete document.body.dataset.loginDeskW;
    delete document.body.dataset.loginDeskH;
    delete document.body.dataset.loginDeskViewport;
    document.body.style.removeProperty('--login-desk-scale');
    document.body.style.removeProperty('--login-desk-top');
    document.body.style.removeProperty('--login-desk-left');
    document.body.style.removeProperty('--login-desk-width');
    document.body.style.removeProperty('--login-desk-height');
    if (!canvas) {
        return;
    }
    canvas.classList.remove('login-selectchar-canvas');
    canvas.classList.remove('login-charui-canvas');
    clearInlineCanvasGeometry(canvas);
}

function restoreSavedScale(game: Scene['game']): void {
    if (!sharedResizedForDesk) {
        return;
    }
    game.scale.scaleMode = sharedSavedScaleMode;
    game.scale.autoCenter = sharedSavedAutoCenter;
    safeResize(game, sharedSavedGameW, sharedSavedGameH);
    sharedResizedForDesk = false;
    try {
        game.scale.refresh();
    } catch (err) {
        console.warn('[loginDeskPresentation] scale.refresh failed', err);
    }
}

export function restoreLoginDeskCanvasPresentation(scene: Scene, wasActive: boolean): boolean {
    if (!wasActive) {
        return false;
    }
    sharedActiveOwners = Math.max(0, sharedActiveOwners - 1);
    if (sharedActiveOwners > 0) {
        return false;
    }
    unbindDeskCssResync();
    clearDeskCanvasDom(scene.game.canvas);
    restoreSavedScale(scene.game);
    return false;
}

export function forceClearLoginDeskCanvasPresentation(scene: Scene): void {
    sharedActiveOwners = 0;
    unbindDeskCssResync();
    clearDeskCanvasDom(scene.game.canvas);
    if (sharedResizedForDesk) {
        restoreSavedScale(scene.game);
    }
}
