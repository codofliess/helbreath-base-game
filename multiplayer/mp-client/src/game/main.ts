import { Boot } from './scenes/Boot';
import { GameWorld } from './scenes/GameWorld';
import { Game, Scale, WEBGL } from 'phaser';
import { LoadingScreen } from './scenes/LoadingScreen';
import { LoginScreen } from './scenes/LoginScreen';
import { FXAAPostFX } from './pipelines/FXAAPostFX';

// Phaser Game config: https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config = {
    type: WEBGL,
    // Fixed FOV buffer (~32×18 tiles @ TILE=32). Scale.FIT letterboxes/pillarboxes
    // on ultrawide — never Scale.RESIZE (that expands visible map / PvP unfair).
    width: 1024,
    height: 576,
    parent: 'game-container',
    // fps: {
    //     target: 30,
    //     forceSetTimeOut: true
    // },
    render: {
        pixelArt: true, // Disable texture smoothing/filtering
        antialias: false, // Disable antialiasing
        roundPixels: true // Round pixel positions to prevent sub-pixel rendering
    },
    scale: {
        // Boot/login may override; GameWorld uses ENVELOP for edge-to-edge cover.
        mode: Scale.ENVELOP,
        autoCenter: Scale.CENTER_BOTH,
        expandParent: true,
        // #app includes canvas + React dock/HUD so fullscreen keeps bottom bar & dialogs.
        fullscreenTarget: 'app',
    },
    pipeline: { FXAAPostFX } as unknown as Phaser.Types.Core.PipelineConfig,
    scene: [
        Boot,
        LoadingScreen,
        LoginScreen,
        GameWorld,
    ]
} as Phaser.Types.Core.GameConfig;

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
}

export default StartGame;
