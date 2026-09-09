import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    isSafeDrawableTexture,
    isWorldCanvasTextureKey,
    removeWorldCanvasAliasedTexture,
} from './worldCanvasTextureSafety';

function sceneWithTextures(
    worldCanvas: unknown,
    textures: Map<string, { getSourceImage: () => unknown }>,
) {
    const removed: string[] = [];
    return {
        removed,
        scene: {
            game: { canvas: worldCanvas },
            textures: {
                exists: (key: string) => textures.has(key),
                get: (key: string) => {
                    const row = textures.get(key);
                    if (!row) {
                        throw new Error(`missing ${key}`);
                    }
                    return row;
                },
                remove: (key: string) => {
                    textures.delete(key);
                    removed.push(key);
                },
            },
            anims: {
                exists: () => false,
                remove: () => undefined,
            },
        },
    };
}

describe('worldCanvasTextureSafety', () => {
    it('treats a generateTexture alias of the live world canvas as unsafe', () => {
        const world = { id: 'game-canvas' };
        const textures = new Map<string, { getSourceImage: () => unknown }>([
            ['sprite-effect-0', { getSourceImage: () => world }],
            ['sprite-effect5-7', { getSourceImage: () => ({ id: 'isolated' }) }],
        ]);
        const { scene } = sceneWithTextures(world, textures);
        assert.equal(isWorldCanvasTextureKey(scene, 'sprite-effect-0'), true);
        assert.equal(isSafeDrawableTexture(scene, 'sprite-effect-0'), false);
        assert.equal(isWorldCanvasTextureKey(scene, 'sprite-effect5-7'), false);
        assert.equal(isSafeDrawableTexture(scene, 'sprite-effect5-7'), true);
        assert.equal(isSafeDrawableTexture(scene, 'sprite-missing'), false);
    });

    it('removes a world-canvas alias so Missile / Heal FX cannot blit the map', () => {
        const world = { id: 'world' };
        const textures = new Map<string, { getSourceImage: () => unknown }>([
            ['sprite-effect-0', { getSourceImage: () => world }],
        ]);
        const { scene, removed } = sceneWithTextures(world, textures);
        assert.equal(removeWorldCanvasAliasedTexture(scene, 'sprite-effect-0'), true);
        assert.deepEqual(removed, ['sprite-effect-0']);
        assert.equal(isSafeDrawableTexture(scene, 'sprite-effect-0'), false);
        assert.equal(removeWorldCanvasAliasedTexture(scene, 'sprite-effect-0'), false);
    });
});
