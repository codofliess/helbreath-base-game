import type { PhaserGameLike } from '../game/phaserHubTypes';
import { setIsFullscreen } from '../ui/store/ControlsDialog.store';

let handlersBound = false;
let resizeHandler: (() => void) | undefined;
let refreshFrame: number | undefined;

async function loadWorldCanvas(): Promise<typeof import('../game/ui/gameWorldCanvasPresentation')> {
    return import('../game/ui/gameWorldCanvasPresentation');
}

function scheduleLayoutPublish(game: PhaserGameLike): void {
    if (refreshFrame !== undefined) {
        window.cancelAnimationFrame(refreshFrame);
    }
    refreshFrame = window.requestAnimationFrame(() => {
        refreshFrame = undefined;
        try {
            game.scale?.refresh?.();
        } catch {
            // ignore
        }
        if (game.canvas) {
            void loadWorldCanvas().then((mod) => {
                mod.publishCanvasLayoutVarsFromDom(game.canvas as HTMLCanvasElement);
            });
        }
    });
}

function enterFullscreenPresentation(game: PhaserGameLike): void {
    const wrapper = document.getElementById('game-wrapper');
    const container = document.getElementById('game-container');
    wrapper?.classList.add('fullscreen');
    container?.classList.add('fullscreen');
    game.canvas?.classList.add('fullscreen');
    game.canvas?.classList.remove('game-world-expanded');
    document.body.classList.remove('game-world-expanded-vision');

    void loadWorldCanvas().then((mod) => {
        mod.resyncGameWorldCanvasPresentationIfActive(game as never);
        if (!document.body.classList.contains('game-world-active') && game.scene?.isActive('GameWorld')) {
            const scene = game.scene.getScene('GameWorld');
            if (scene) {
                mod.applyGameWorldCanvasPresentation(scene as never);
            }
        }
        scheduleLayoutPublish(game);
    });

    if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
    }
    resizeHandler = () => {
        void loadWorldCanvas().then((mod) => {
            mod.resyncGameWorldCanvasPresentationIfActive(game as never);
            scheduleLayoutPublish(game);
        });
    };
    window.addEventListener('resize', resizeHandler);
    setIsFullscreen(true);
}

function leaveFullscreenPresentation(game: PhaserGameLike): void {
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

    void loadWorldCanvas().then((mod) => {
        mod.resyncGameWorldCanvasPresentationIfActive(game as never);
        scheduleLayoutPublish(game);
    });
    setIsFullscreen(false);
}

function ensureHandlers(game: PhaserGameLike): void {
    if (handlersBound) {
        return;
    }
    if (!game.scale?.on) {
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
 * Presentation helpers load with Phaser after seal — hub must not import Scale/WebGL.
 */
export function toggleGameFullscreen(game: PhaserGameLike | null | undefined): void {
    if (!game?.scale?.startFullscreen || !game.scale.stopFullscreen) {
        return;
    }
    ensureHandlers(game);
    if (game.scale.isFullscreen) {
        game.scale.stopFullscreen();
    } else {
        game.scale.startFullscreen();
    }
}

export function isGameFullscreen(game: PhaserGameLike | null | undefined): boolean {
    if (!game) {
        return !!document.fullscreenElement;
    }
    return !!game.scale?.isFullscreen;
}
