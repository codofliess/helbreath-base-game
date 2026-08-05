import type { Game } from 'phaser';
import {
    applyGameWorldCanvasPresentation,
    publishCanvasLayoutVarsFromDom,
    resyncGameWorldCanvasPresentationIfActive,
} from '../game/ui/gameWorldCanvasPresentation';
import { setIsFullscreen } from '../ui/store/ControlsDialog.store';

let handlersBound = false;
let resizeHandler: (() => void) | undefined;
let refreshFrame: number | undefined;

function scheduleLayoutPublish(game: Game): void {
    if (refreshFrame !== undefined) {
        window.cancelAnimationFrame(refreshFrame);
    }
    refreshFrame = window.requestAnimationFrame(() => {
        refreshFrame = undefined;
        try {
            game.scale.refresh();
        } catch {
            // ignore
        }
        if (game.canvas) {
            publishCanvasLayoutVarsFromDom(game.canvas);
        }
    });
}

/**
 * Fullscreen keeps the classic 1024×576 FOV (same vision range as windowed).
 * Only the presentation scales to the monitor — no extra map tiles (PvP-safe).
 */
function enterFullscreenPresentation(game: Game): void {
    const wrapper = document.getElementById('game-wrapper');
    const container = document.getElementById('game-container');
    wrapper?.classList.add('fullscreen');
    container?.classList.add('fullscreen');
    game.canvas?.classList.add('fullscreen');
    game.canvas?.classList.remove('game-world-expanded');
    document.body.classList.remove('game-world-expanded-vision');

    // Same FOV as windowed — ENVELOP over the fullscreen parent.
    resyncGameWorldCanvasPresentationIfActive(game);
    // If GameWorld not marked active yet, still force classic size.
    if (!document.body.classList.contains('game-world-active') && game.scene.isActive('GameWorld')) {
        const scene = game.scene.getScene('GameWorld');
        if (scene) {
            applyGameWorldCanvasPresentation(scene);
        }
    }

    scheduleLayoutPublish(game);

    if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
    }
    resizeHandler = () => {
        resyncGameWorldCanvasPresentationIfActive(game);
        scheduleLayoutPublish(game);
    };
    window.addEventListener('resize', resizeHandler);
    setIsFullscreen(true);
}

function leaveFullscreenPresentation(game: Game): void {
    const wrapper = document.getElementById('game-wrapper');
    const container = document.getElementById('game-container');
    const canvas = game.canvas;
    wrapper?.classList.remove('fullscreen');
    container?.classList.remove('fullscreen');
    canvas?.classList.remove('fullscreen');
    canvas?.classList.remove('game-world-expanded');
    document.body.classList.remove('game-world-expanded-vision');

    if (refreshFrame !== undefined) {
        window.cancelAnimationFrame(refreshFrame);
        refreshFrame = undefined;
    }
    if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = undefined;
    }

    resyncGameWorldCanvasPresentationIfActive(game);
    scheduleLayoutPublish(game);
    setIsFullscreen(false);
}

function ensureHandlers(game: Game): void {
    if (handlersBound) {
        return;
    }
    handlersBound = true;

    game.scale.on('enterfullscreen', () => {
        enterFullscreenPresentation(game);
    });

    game.scale.on('leavefullscreen', () => {
        leaveFullscreenPresentation(game);
    });
}

/**
 * Toggle browser fullscreen. Vision range stays classic 1024×576 always.
 */
export function toggleGameFullscreen(game: Game | null | undefined): void {
    if (!game) {
        return;
    }
    ensureHandlers(game);
    if (game.scale.isFullscreen) {
        game.scale.stopFullscreen();
    } else {
        game.scale.startFullscreen();
    }
}

export function isGameFullscreen(game: Game | null | undefined): boolean {
    if (!game) {
        return !!document.fullscreenElement;
    }
    return game.scale.isFullscreen;
}
