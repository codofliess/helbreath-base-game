import { Scale, type Game, type Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { IN_UI_GAME_VIEWPORT_RESIZED } from '../../constants/EventNames';

/**
 * Classic-safe camera FOV (world pixels). TILE_SIZE = 32 → ~32×18 tiles @ 1024×576.
 *
 * **Always fixed** — windowed and fullscreen use the same buffer size.
 * Never Scale.RESIZE / never grow the buffer with the monitor: extra map FOV
 * is PvP-unfair (mages / dark elves can hit beyond intended vision).
 *
 * Presentation: Scale.ENVELOP covers the parent edge-to-edge (may crop thin
 * strips on non-16:9). HUD docks to the *visible* canvas×viewport intersection.
 */
export const GAME_VIEW_W = 1024;
export const GAME_VIEW_H = 576;

let presentationActive = false;
let windowResizeBound = false;
let activeGame: Game | null = null;

/**
 * Visible canvas rect clamped to the browser viewport — for ENVELOP the canvas CSS
 * box can extend past the screen; the dock must bind to the on-screen edge only.
 */
export function publishCanvasLayoutVarsFromDom(canvas: HTMLCanvasElement): void {
    const r = canvas.getBoundingClientRect();
    const left = Math.max(0, Math.round(r.left));
    const top = Math.max(0, Math.round(r.top));
    const right = Math.min(window.innerWidth, Math.round(r.right));
    const bottom = Math.min(window.innerHeight, Math.round(r.bottom));
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);

    const root = document.documentElement;
    root.style.setProperty('--hb-canvas-left', `${left}px`);
    root.style.setProperty('--hb-canvas-top', `${top}px`);
    root.style.setProperty('--hb-canvas-width', `${width}px`);
    root.style.setProperty('--hb-canvas-height', `${height}px`);
    root.style.setProperty(
        '--hb-canvas-inset-bottom',
        `${Math.max(0, window.innerHeight - bottom)}px`,
    );
    root.style.setProperty(
        '--hb-canvas-inset-top',
        `${top}px`,
    );
}

/** @deprecated Expanded vision removed for PvP FOV fairness — always false. */
export function isExpandedVisionActive(): boolean {
    return false;
}

function clearCanvasLayoutVars(): void {
    const root = document.documentElement;
    root.style.removeProperty('--hb-canvas-left');
    root.style.removeProperty('--hb-canvas-top');
    root.style.removeProperty('--hb-canvas-width');
    root.style.removeProperty('--hb-canvas-height');
    root.style.removeProperty('--hb-canvas-inset-bottom');
    root.style.removeProperty('--hb-canvas-inset-top');
}

function clearInlineCanvasLayout(canvas: HTMLCanvasElement | null | undefined): void {
    if (!canvas) {
        return;
    }
    canvas.classList.remove(
        'game-world-canvas',
        'game-world-expanded',
        'login-selectchar-canvas',
        'login-charui-canvas',
    );
    canvas.style.removeProperty('width');
    canvas.style.removeProperty('height');
    canvas.style.removeProperty('position');
    canvas.style.removeProperty('left');
    canvas.style.removeProperty('top');
    canvas.style.removeProperty('right');
    canvas.style.removeProperty('bottom');
    canvas.style.removeProperty('margin');
    canvas.style.removeProperty('transform');
    canvas.style.removeProperty('transform-origin');
    canvas.style.removeProperty('max-width');
    canvas.style.removeProperty('max-height');
}

/**
 * Safe resize — Phaser can throw if parentSize is not ready (HMR / early boot).
 */
function safeResize(game: Game, width: number, height: number): void {
    try {
        if (!game.scale.parentSize) {
            return;
        }
        const w = Math.max(1, Math.floor(width));
        const h = Math.max(1, Math.floor(height));
        if (game.scale.width === w && game.scale.height === h) {
            return;
        }
        game.scale.resize(w, h);
    } catch (err) {
        console.warn('[gameWorldCanvasPresentation] scale.resize failed', err);
    }
}

/**
 * Force classic FOV buffer + ENVELOP. Same vision range in windowed and fullscreen.
 */
function applyClassicFovPresentation(game: Game): void {
    const canvas = game.canvas;
    if (!canvas) {
        return;
    }

    document.body.classList.remove('login-charui-active', 'login-selectchar-active', 'game-world-expanded-vision');
    document.body.classList.add('game-world-active');

    clearInlineCanvasLayout(canvas);
    canvas.classList.add('game-world-canvas');
    // Keep 'fullscreen' class if browser FS is on (for CSS chrome only) — never expand FOV.
    if (game.scale.isFullscreen || document.fullscreenElement) {
        canvas.classList.add('fullscreen');
    } else {
        canvas.classList.remove('fullscreen');
    }

    game.scale.scaleMode = Scale.ENVELOP;
    game.scale.autoCenter = Scale.CENTER_BOTH;
    safeResize(game, GAME_VIEW_W, GAME_VIEW_H);
    try {
        game.scale.refresh();
    } catch (err) {
        console.warn('[gameWorldCanvasPresentation] scale.refresh failed', err);
    }

    publishCanvasLayoutVarsFromDom(canvas);
    presentationActive = true;
    activeGame = game;
    ensureWindowResizeListener();

    requestAnimationFrame(() => {
        if (!presentationActive || !game.canvas) {
            return;
        }
        publishCanvasLayoutVarsFromDom(game.canvas);
        requestAnimationFrame(() => {
            if (document.body.classList.contains('game-world-active') && game.canvas?.isConnected) {
                publishCanvasLayoutVarsFromDom(game.canvas);
            }
        });
    });
}

function onWindowResize(): void {
    if (!presentationActive || !activeGame) {
        return;
    }
    const canvas = activeGame.canvas;
    if (!canvas) {
        return;
    }
    // Always re-assert classic FOV (never grow buffer with monitor).
    applyClassicFovPresentation(activeGame);
}

function ensureWindowResizeListener(): void {
    if (windowResizeBound) {
        return;
    }
    window.addEventListener('resize', onWindowResize);
    windowResizeBound = true;
}

/**
 * In-game: fixed 1024×576 FOV + Scale.ENVELOP (windowed or fullscreen).
 */
export function applyGameWorldCanvasPresentation(scene: Scene): void {
    applyClassicFovPresentation(scene.game);
}

/**
 * Re-assert ENVELOP + classic FOV after Phaser refresh / leaving browser fullscreen.
 */
export function resyncGameWorldCanvasPresentation(scene: Scene): void {
    if (!presentationActive && !document.body.classList.contains('game-world-active')) {
        return;
    }
    applyGameWorldCanvasPresentation(scene);
}

/** Clears in-game canvas class + HUD layout vars when leaving GameWorld. */
export function clearGameWorldCanvasPresentation(scene: Scene): void {
    presentationActive = false;
    activeGame = null;
    const game = scene.game;
    const canvas = game.canvas;
    if (canvas) {
        canvas.classList.remove('game-world-canvas', 'game-world-expanded', 'fullscreen');
        canvas.style.removeProperty('width');
        canvas.style.removeProperty('height');
        canvas.style.removeProperty('margin');
    }
    document.body.classList.remove('game-world-active', 'game-world-expanded-vision');
    clearCanvasLayoutVars();
    game.scale.scaleMode = Scale.FIT;
    game.scale.autoCenter = Scale.CENTER_BOTH;
    safeResize(game, GAME_VIEW_W, GAME_VIEW_H);
    try {
        if (game.scale.parentSize) {
            game.scale.refresh();
        }
    } catch (err) {
        console.warn('[gameWorldCanvasPresentation] scale.refresh on clear failed', err);
    }
}

/**
 * Applies classic FOV if GameWorld is still active (e.g. after fullscreen enter/leave).
 */
export function resyncGameWorldCanvasPresentationIfActive(game: Game): void {
    if (!document.body.classList.contains('game-world-active')) {
        return;
    }
    applyClassicFovPresentation(game);
    requestAnimationFrame(() => {
        EventBus.emit(IN_UI_GAME_VIEWPORT_RESIZED);
    });
}

/**
 * Fullscreen enter/leave: same classic FOV as windowed (PvP-safe).
 * Kept as named exports so fullscreenUtils does not grow the vision range.
 */
export function applyExpandedGameWorldVision(game: Game): void {
    // Name historical — intentionally does NOT expand FOV.
    applyClassicFovPresentation(game);
    requestAnimationFrame(() => {
        EventBus.emit(IN_UI_GAME_VIEWPORT_RESIZED);
    });
}

export function clearExpandedGameWorldVision(game: Game): void {
    document.body.classList.remove('game-world-expanded-vision');
    const canvas = game.canvas;
    canvas?.classList.remove('game-world-expanded');
    applyClassicFovPresentation(game);
    requestAnimationFrame(() => {
        EventBus.emit(IN_UI_GAME_VIEWPORT_RESIZED);
    });
}
