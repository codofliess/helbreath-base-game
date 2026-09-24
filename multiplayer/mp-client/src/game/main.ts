import { Boot } from './scenes/Boot';
import { GameWorld } from './scenes/GameWorld';
import { CANVAS, Game, Scale, WEBGL } from 'phaser';
import { LoadingScreen } from './scenes/LoadingScreen';
import { LoginScreen } from './scenes/LoginScreen';
import { FXAAPostFX } from './pipelines/FXAAPostFX';

/**
 * Prefer WebGL. If the context cannot be created, Canvas keeps React mounted
 * (a hard WebGL abort inside Phaser unmounts `#root`).
 */
function rendererType(): number {
    if (typeof document === 'undefined') {
        return CANVAS;
    }
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl) {
            return WEBGL;
        }
    } catch (error) {
        console.warn('[main] WebGL probe failed', error);
    }
    console.warn('[main] WebGL unavailable; using Canvas so the React shell can mount.');
    return CANVAS;
}

// Phaser Game config: https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config = {
    type: rendererType(),
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
        mode: Scale.NONE,
        autoCenter: Scale.CENTER_BOTH,
        fullscreenTarget: 'game-wrapper'
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
