import { isWorldCanvasImageSource } from './pendingAppearanceTexture';

type TextureScene = {
    game?: { canvas?: unknown };
    textures: {
        exists: (key: string) => boolean;
        get: (key: string) => { getSourceImage?: () => unknown };
        remove?: (key: string) => unknown;
    };
    anims?: {
        exists: (key: string) => boolean;
        remove?: (key: string) => unknown;
    };
};

/**
 * True when a Phaser texture key's source is the live world/game canvas.
 * Same class as F5 `generateTexture` pending: drawing or blit of that key
 * samples the presentation canvas and blacks the map.
 */
export function isWorldCanvasTextureKey(scene: TextureScene, key: string): boolean {
    if (!key || !scene.textures.exists(key)) {
        return false;
    }
    try {
        const source = scene.textures.get(key).getSourceImage?.();
        return isWorldCanvasImageSource(source, scene.game?.canvas);
    } catch {
        return false;
    }
}

/** Texture exists and is not a generateTexture / addCanvas alias of the world canvas. */
export function isSafeDrawableTexture(scene: TextureScene, key: string): boolean {
    return scene.textures.exists(key) && !isWorldCanvasTextureKey(scene, key);
}

/**
 * Drops a leftover world-canvas alias so later sprites cannot blit the map.
 * Returns true when a key was removed.
 */
export function removeWorldCanvasAliasedTexture(scene: TextureScene, key: string): boolean {
    if (!isWorldCanvasTextureKey(scene, key)) {
        return false;
    }
    try {
        scene.textures.remove?.(key);
    } catch {
        return false;
    }
    try {
        if (scene.anims?.exists(key)) {
            scene.anims.remove?.(key);
        }
    } catch {
        // Animation key may not exist or may already be gone.
    }
    return true;
}
