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

    it('must not textures.remove a world-canvas alias (CanvasPool.remove zeros game.canvas)', () => {
        const world = { id: 'world', width: 800, height: 600 };
        const textures = new Map<string, { getSourceImage: () => unknown }>([
            ['sprite-effect-0', { getSourceImage: () => world }],
        ]);
        const { scene, removed } = sceneWithTextures(world, textures);
        assert.equal(removeWorldCanvasAliasedTexture(scene, 'sprite-effect-0'), true);
        assert.deepEqual(removed, []);
        assert.equal(textures.has('sprite-effect-0'), true);
        assert.equal(isSafeDrawableTexture(scene, 'sprite-effect-0'), false);
        assert.equal((world as { width: number }).width, 800);
        assert.equal((world as { height: number }).height, 600);
    });

    it('treats textures.get throw as unsafe (fail closed)', () => {
        const world = { id: 'world' };
        const scene = {
            game: { canvas: world },
            textures: {
                exists: () => true,
                get: () => {
                    throw new Error('get failed');
                },
            },
        };
        assert.equal(isWorldCanvasTextureKey(scene, 'sprite-effect5-7'), true);
        assert.equal(isSafeDrawableTexture(scene, 'sprite-effect5-7'), false);
    });
});
