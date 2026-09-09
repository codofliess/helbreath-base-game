import { Boot } from './scenes/Boot';
import { GameWorld } from './scenes/GameWorld';
import { AUTO, CANVAS, Game, Scale } from 'phaser';
import { LoadingScreen } from './scenes/LoadingScreen';
import { LoginScreen } from './scenes/LoginScreen';
import { FXAAPostFX } from './pipelines/FXAAPostFX';
import { startGameWithRendererFallback } from './startGameWithRendererFallback';
import { shouldConstructPhaserAfterSeal } from '../ui/store/ConnectDialog.store';
import { installWorldCanvasPoolGuard } from '../utils/worldCanvasPoolGuardInstall';

function buildGameConfig(
    parent: string,
    type: typeof AUTO | typeof CANVAS,
    includeFxaa: boolean,
): Phaser.Types.Core.GameConfig {
    return {
        type,
        // Fixed FOV buffer (~32×18 tiles @ TILE=32). Scale.FIT letterboxes/pillarboxes
        // on ultrawide — never Scale.RESIZE (that expands visible map / PvP unfair).
        width: 1024,
        height: 576,
        parent,
        render: {
            pixelArt: true,
            antialias: false,
            roundPixels: true,
            // Chrome GPU blocklist / remote desktop otherwise refuses WebGL and Phaser aborts.
            failIfMajorPerformanceCaveat: false,
            powerPreference: 'default',
        },
        scale: {
            // Boot/login may override; GameWorld uses ENVELOP for edge-to-edge cover.
            mode: Scale.ENVELOP,
            autoCenter: Scale.CENTER_BOTH,
            expandParent: true,
            // #app includes canvas + React dock/HUD so fullscreen keeps bottom bar & dialogs.
            fullscreenTarget: 'app',
        },
        ...(includeFxaa
            ? { pipeline: { FXAAPostFX } as unknown as Phaser.Types.Core.PipelineConfig }
            : {}),
        scene: [
            Boot,
            LoadingScreen,
            LoginScreen,
            GameWorld,
        ],
    };
}

/**
 * Creates Phaser without throwing into React.
 * Canvas 2D first — forcing Phaser's WEBGL renderer throws "Cannot create WebGL context, aborting"
 * when `Features.webGL` is false (Elon / GPU-blocked Chrome). AUTO is only a fallback.
 */
const StartGame = (parent: string): Game | null => {
    if (!shouldConstructPhaserAfterSeal()) {
        console.error('[StartGame] Refusing Phaser/WebGL construct before entering-world');
        return null;
    }
    const game = startGameWithRendererFallback(
        () => new Game(buildGameConfig(parent, CANVAS, false)),
        () => new Game(buildGameConfig(parent, AUTO, false)),
    );
    if (game) {
        installWorldCanvasPoolGuard(game);
    }
    return game;
};

export default StartGame;
