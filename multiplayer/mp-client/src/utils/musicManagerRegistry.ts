import type { PhaserSceneLike } from '../game/phaserHubTypes';
import { MusicManager } from './MusicManager';
import { MUSIC_MANAGER_KEY } from '../constants/RegistryKeys';

/**
 * MusicManager lives in a Phaser-scene module so the React hub graph never
 * evaluates MusicManager → SpriteHttpLoader → HBSprite → `phaser`.
 */
export function getMusicManager(scene: PhaserSceneLike): MusicManager {
    const existing = scene.registry.get(MUSIC_MANAGER_KEY) as MusicManager | undefined;
    if (existing) {
        existing.setScene(scene as never);
        return existing;
    }
    const musicManager = new MusicManager(scene as never);
    scene.registry.set(MUSIC_MANAGER_KEY, musicManager);
    return musicManager;
}
