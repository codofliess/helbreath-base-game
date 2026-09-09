import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    createIndependentPendingAppearanceCanvas,
    ensurePendingPlayerItemAppearanceTexture,
    isWorldCanvasImageSource,
    PENDING_APPEARANCE_TEXTURE_KEY,
} from './pendingAppearanceTexture';

describe('pendingAppearanceTexture', () => {
    it('treats the live game canvas as an unsafe paper-doll / blit source', () => {
        const world = { id: 'game-canvas' };
        assert.equal(isWorldCanvasImageSource(world, world), true);
        assert.equal(isWorldCanvasImageSource({ id: 'other' }, world), false);
        assert.equal(isWorldCanvasImageSource(undefined, world), false);
    });

    it('replaces a generateTexture alias of the world canvas with an isolated 1×1', () => {
        const worldCanvas = { id: 'world', width: 800, height: 600 };
        const textures = new Map<string, { getSourceImage: () => unknown; canvas?: unknown }>();
        const scene = {
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
                },
                addCanvas: (key: string, canvas: HTMLCanvasElement) => {
                    textures.set(key, { getSourceImage: () => canvas, canvas });
                },
            },
        };
        textures.set(PENDING_APPEARANCE_TEXTURE_KEY, {
            getSourceImage: () => worldCanvas,
            canvas: worldCanvas,
        });
        ensurePendingPlayerItemAppearanceTexture(scene);
        const next = textures.get(PENDING_APPEARANCE_TEXTURE_KEY);
        assert.ok(next);
        const source = next.getSourceImage();
        assert.notEqual(source, worldCanvas);
        assert.equal((source as HTMLCanvasElement).width, 1);
        assert.equal((source as HTMLCanvasElement).height, 1);
        assert.equal(worldCanvas.width, 800);
        assert.equal(worldCanvas.height, 600);
    });

    it('does not textures.remove a world-canvas alias when it cannot detach the source', () => {
        const worldCanvas = { id: 'world', width: 800, height: 600 };
        const textures = new Map<string, { getSourceImage: () => unknown }>();
        const removed: string[] = [];
        const scene = {
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
                    removed.push(key);
                    textures.delete(key);
                },
                addCanvas: (key: string, canvas: HTMLCanvasElement) => {
                    textures.set(key, { getSourceImage: () => canvas });
                },
            },
        };
        textures.set(PENDING_APPEARANCE_TEXTURE_KEY, {
            getSourceImage: () => worldCanvas,
        });
        ensurePendingPlayerItemAppearanceTexture(scene);
        assert.deepEqual(removed, []);
        assert.equal(textures.get(PENDING_APPEARANCE_TEXTURE_KEY)?.getSourceImage(), worldCanvas);
        assert.equal(worldCanvas.width, 800);
    });

    it('createIndependentPendingAppearanceCanvas is not the world canvas', () => {
        const world = { tag: 'phaser' };
        const canvas = createIndependentPendingAppearanceCanvas();
        assert.equal(isWorldCanvasImageSource(canvas, world), false);
        assert.equal(canvas.width, 1);
        assert.equal(canvas.height, 1);
    });
});
