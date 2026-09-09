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
        // exists() + get() throw: fail closed. Treating this as safe was how
        // callers could still bind a broken / world-backed key.
        return true;
    }
}

/** Texture exists and is not a generateTexture / addCanvas alias of the world canvas. */
export function isSafeDrawableTexture(scene: TextureScene, key: string): boolean {
    return scene.textures.exists(key) && !isWorldCanvasTextureKey(scene, key);
}

/** Phaser built-in 32×32 — never `game.canvas`. Used when pending is still a world alias. */
export const PHASER_DEFAULT_TEXTURE_KEY = '__DEFAULT';

/**
 * Bind `preferred` only when it is an isolated sheet. Otherwise `__DEFAULT`
 * (never addCanvas / textures.remove of `game.canvas`).
 */
export function safeBindableTextureKey(scene: TextureScene, preferred: string): string {
    if (isSafeDrawableTexture(scene, preferred)) {
        return preferred;
    }
    return PHASER_DEFAULT_TEXTURE_KEY;
}

/**
 * True when `key` is a live-world-canvas alias. Does **not** `textures.remove`
 * it. Phaser `CanvasTexture.destroy` → `CanvasPool.remove` sets that canvas
 * to 1×1; if the source is `game.canvas`, Missile prepare blacks the map.
 * Callers must refuse to bind (`isSafeDrawableTexture`).
 */
export function removeWorldCanvasAliasedTexture(scene: TextureScene, key: string): boolean {
    return isWorldCanvasTextureKey(scene, key);
}
