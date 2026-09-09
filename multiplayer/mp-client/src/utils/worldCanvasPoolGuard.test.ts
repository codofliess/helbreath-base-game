import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SPELL_MAGIC_MISSILE_ID } from '../constants/Spells';
import { getOlympiaServerSpellId } from '../constants/OlympiaServerSpellMap';
import {
    applyMagiasMoveDuringPrepareVisuals,
    applyMagiasSoftCastConfirmVisuals,
    applyMagiasSpellSelectVisuals,
    beginMagiasRitual,
    endMagiasRitual,
    shouldSkipCastCanvasWorkOnState,
} from './castPresentation';
import {
    attachWorldCanvasPoolGuard,
    lockWorldCanvasPresentationSize,
    lockWorldCanvasRendererClear,
    occupyWorldCanvasPoolSlot,
    protectWorldCanvasInPool,
    reassertWorldCanvasPresentationGuard,
    refuseWorldCanvasCreateCanvas,
    refuseWorldCanvasGenerateTexture,
    refuseWorldCanvasTextureBind,
    restoreWorldCanvasBoxIfStolen,
    restoreWorldCanvasPixels,
    sealWorldCanvasPoolSlot,
    setWorldCanvasClearRefused,
    snapshotWorldCanvasBox,
    snapshotWorldCanvasPixels,
    withWorldCanvasBoxGuard,
    type CanvasPoolContainer,
    type WorldCanvasLike,
    type WorldCanvasPoolApi,
} from './worldCanvasPoolGuard';

/**
 * Phaser 3.90 CanvasPool: `first()` reuses falsy parent; `create2D` closes over
 * the inner `create` (replacing `pool.create` alone does not protect it);
 * `remove` 1×1s a matching canvas or parent.
 */
function createPhaserStylePool(): WorldCanvasPoolApi {
    const pool: CanvasPoolContainer[] = [];
    const create = (parent?: unknown, width = 1, height = 1): WorldCanvasLike => {
        let container = pool.find((row) => !row.parent);
        if (!container) {
            container = { parent: parent ?? null, canvas: { width: 1, height: 1 } };
            pool.push(container);
        } else {
            container.parent = parent ?? null;
        }
        if (container.canvas) {
            container.canvas.width = Number(width) || 1;
            container.canvas.height = Number(height) || 1;
        }
        return container.canvas as WorldCanvasLike;
    };
    const create2D = (parent?: unknown, width = 1, height = 1): WorldCanvasLike => {
        return create(parent, width, height);
    };
    return {
        pool,
        create,
        create2D,
        remove(parent: unknown) {
            for (const container of pool) {
                if (container.canvas === parent || container.parent === parent) {
                    container.parent = null;
                    if (container.canvas) {
                        container.canvas.width = 1;
                        container.canvas.height = 1;
                    }
                }
            }
        },
    };
}

describe('Phaser CanvasPool 1×1s game.canvas (the black-map steal)', () => {
    it('remove(game.canvas) and remove(game) shrink the presentation canvas', () => {
        const game = { id: 'phaser-game' };
        const world: WorldCanvasLike = { width: 1024, height: 576 };
        const pool = createPhaserStylePool();
        pool.pool.push({ parent: game, canvas: world });

        pool.remove(world);
        assert.equal(world.width, 1);
        assert.equal(world.height, 1);

        world.width = 1024;
        world.height = 576;
        pool.pool[0].parent = game;
        pool.pool[0].canvas = world;
        pool.remove(game);
        assert.equal(world.width, 1);
        assert.equal(world.height, 1);
    });

    it('create after remove reuses game.canvas and resizes it (Text / createCanvas)', () => {
        const game = { id: 'phaser-game' };
        const world: WorldCanvasLike = { width: 1024, height: 576 };
        const pool = createPhaserStylePool();
        pool.pool.push({ parent: game, canvas: world });
        pool.remove(world);
        const stolen = pool.create({ id: 'phaser-text' }, 32, 16);
        assert.equal(stolen, world);
        assert.equal(world.width, 32);
        assert.equal(world.height, 16);
    });

    it('create2D closes over inner create so wrapping pool.create alone is not enough', () => {
        const game = { id: 'phaser-game' };
        const world: WorldCanvasLike = { width: 1024, height: 576 };
        const pool = createPhaserStylePool();
        pool.pool.push({ parent: game, canvas: world });
        pool.remove(world);
        const stolen = pool.create2D?.({ id: 'texture-manager' }, 1, 1);
        assert.equal(stolen, world);
        assert.equal(world.width, 1);
        assert.equal(world.height, 1);
    });
});

describe('protectWorldCanvasInPool', () => {
    it('Missile-select steal paths must not clear or unbind the world canvas', () => {
        const game = { id: 'phaser-game' };
        const world: WorldCanvasLike = { width: 1024, height: 576 };
        const pool = createPhaserStylePool();
        pool.pool.push({ parent: game, canvas: world });
        protectWorldCanvasInPool(pool, world, game);

        pool.remove(world);
        pool.remove(game);
        assert.equal(world.width, 1024);
        assert.equal(world.height, 576);
        assert.equal(pool.pool[0].canvas, world);
        assert.notEqual(pool.pool[0].parent, null);

        const textCanvas = pool.create({ id: 'phaser-text' }, 32, 16);
        assert.notEqual(textCanvas, world);
        assert.equal(textCanvas.width, 32);
        assert.equal(textCanvas.height, 16);
        assert.equal(world.width, 1024);
        assert.equal(world.height, 576);

        const fromCreate2D = pool.create2D?.({ id: 'text-style' }, 8, 8) as WorldCanvasLike;
        assert.notEqual(fromCreate2D, world);
        assert.equal(fromCreate2D.width, 8);
        assert.equal(fromCreate2D.height, 8);
        assert.equal(world.width, 1024);
        assert.equal(world.height, 576);
    });

    it('occupyWorldCanvasPoolSlot marks a freed world slot so create cannot reuse it', () => {
        const game = { id: 'phaser-game' };
        const world: WorldCanvasLike = { width: 1024, height: 576 };
        const pool = createPhaserStylePool();
        pool.pool.push({ parent: null, canvas: world });
        protectWorldCanvasInPool(pool, world, game);
        occupyWorldCanvasPoolSlot(pool);
        const other = pool.create({ id: 'other' }, 4, 4);
        assert.notEqual(other, world);
        assert.equal(world.width, 1024);
        assert.equal(world.height, 576);
    });
});

describe('lockWorldCanvasPresentationSize', () => {
    it('refuses pool 1×1, same-size wipe, and F7/Scale FOV rewrite on select/prepare', () => {
        const world: WorldCanvasLike = { width: 1024, height: 576 };
        lockWorldCanvasPresentationSize(world);
        world.width = 1;
        world.height = 1;
        assert.equal(world.width, 1024);
        assert.equal(world.height, 576);
        world.width = 1024;
        world.height = 576;
        assert.equal(world.width, 1024);
        assert.equal(world.height, 576);
        world.width = 800;
        world.height = 450;
        assert.equal(world.width, 1024);
        assert.equal(world.height, 576);
    });

    it('refuses setAttribute width/height that bypass the IDL setter', () => {
        const world = {
            width: 1024,
            height: 576,
            setAttribute(name: string, value: string) {
                if (name === 'width') {
                    this.width = Number(value) || 1;
                }
                if (name === 'height') {
                    this.height = Number(value) || 1;
                }
            },
        };
        lockWorldCanvasPresentationSize(world);
        world.setAttribute('width', '1');
        world.setAttribute('height', '1');
        assert.equal(world.width, 1024);
        assert.equal(world.height, 576);
    });

    it('ignores getContext attribute objects that would reset the 2d buffer', () => {
        let attrsSeen = 0;
        const world: WorldCanvasLike = {
            width: 1024,
            height: 576,
            getContext: (type: string, attrs?: unknown) => {
                if (attrs !== undefined) {
                    attrsSeen += 1;
                }
                return { type };
            },
        };
        lockWorldCanvasPresentationSize(world);
        const ctx = world.getContext?.('2d', { willReadFrequently: false }) as { type?: string };
        assert.equal(ctx?.type, '2d');
        assert.equal(attrsSeen, 0);
        assert.equal(world.getContext?.('webgl'), null);
    });

    it('refuses full-canvas fillRect/clearRect while Magias prepare is armed', () => {
        let fillCalls = 0;
        let clearCalls = 0;
        const ctx = {
            fillRect() {
                fillCalls += 1;
            },
            clearRect() {
                clearCalls += 1;
            },
        };
        const world: WorldCanvasLike = {
            width: 1024,
            height: 576,
            getContext: () => ctx,
        };
        beginMagiasRitual();
        lockWorldCanvasPresentationSize(world);
        world.getContext?.('2d');
        ctx.fillRect(0, 0, 1024, 576);
        ctx.clearRect(0, 0, 1024, 576);
        assert.equal(fillCalls, 0);
        assert.equal(clearCalls, 0);
        endMagiasRitual();
        ctx.fillRect(0, 0, 1024, 576);
        ctx.clearRect(0, 0, 1024, 576);
        assert.equal(fillCalls, 1);
        assert.equal(clearCalls, 1);
    });

    it('restores painted FOV pixels after a move-during-prepare wipe', () => {
        const pixels = { id: 'painted-fov' };
        let restored: unknown;
        const ctx = {
            getImageData: () => pixels,
            putImageData(data: unknown) {
                restored = data;
            },
        };
        const world: WorldCanvasLike = {
            width: 1024,
            height: 576,
            getContext: () => ctx,
        };
        assert.equal(snapshotWorldCanvasPixels(world), true);
        restored = undefined;
        assert.equal(restoreWorldCanvasPixels(world), true);
        assert.equal(restored, pixels);
        setWorldCanvasClearRefused(false);
    });

    it('disables Phaser clearBeforeRender and restores after postrender wipe', () => {
        const pixels = { id: 'painted-fov' };
        let restored: unknown;
        let postrender: (() => void) | undefined;
        const ctx = {
            fillRect() {
                restored = undefined;
            },
            getImageData: () => pixels,
            putImageData(data: unknown) {
                restored = data;
            },
        };
        const world: WorldCanvasLike = {
            width: 1024,
            height: 576,
            getContext: () => ctx,
        };
        const renderer = {
            gameContext: ctx,
            config: { clearBeforeRender: true },
        };
        const game = {
            canvas: world,
            renderer,
            events: {
                on(_event: string, fn: () => void) {
                    postrender = fn;
                },
            },
        };
        assert.equal(snapshotWorldCanvasPixels(world), true);
        beginMagiasRitual();
        lockWorldCanvasRendererClear(game);
        assert.equal(renderer.config.clearBeforeRender, false);
        ctx.fillRect();
        assert.equal(restored, undefined);
        postrender?.();
        assert.equal(restored, pixels);
        endMagiasRitual();
        assert.equal(renderer.config.clearBeforeRender, true);
    });
});

describe('sealWorldCanvasPoolSlot', () => {
    it('Phaser first() cannot free or reuse game.canvas after unwrapped remove', () => {
        const game = { id: 'phaser-game' };
        const world: WorldCanvasLike = { width: 1024, height: 576 };
        const pool = createPhaserStylePool();
        pool.pool.push({ parent: game, canvas: world });
        protectWorldCanvasInPool(pool, world, game);
        sealWorldCanvasPoolSlot(pool);

        pool.pool[0].parent = null;
        pool.pool[0].parent = { id: 'phaser-text' };
        assert.notEqual(pool.pool[0].parent, null);
        assert.notEqual(pool.pool[0].parent, pool.pool[0].canvas);
        assert.equal(
            pool.pool.find((row) => !row.parent),
            undefined,
        );

        const created = pool.create({ id: 'announce-text' }, 32, 16);
        assert.notEqual(created, world);
        assert.equal(world.width, 1024);
        assert.equal(world.height, 576);
    });
});

describe('refuseWorldCanvasTextureBind', () => {
    it('addCanvas(game.canvas) receives an isolated canvas, not the world surface', () => {
        const world: WorldCanvasLike = { width: 1024, height: 576 };
        const bound: unknown[] = [];
        const textures = {
            addCanvas: (key: string, source: unknown) => {
                bound.push(source);
                return { key, source };
            },
        };
        refuseWorldCanvasTextureBind(textures, world);
        protectWorldCanvasInPool(createPhaserStylePool(), world, { id: 'game' });
        textures.addCanvas('magias-select', world);
        assert.equal(bound.length, 1);
        assert.notEqual(bound[0], world);
        assert.equal(world.width, 1024);
        assert.equal(world.height, 576);
    });
});

describe('requestCast snapshot / restore safety net', () => {
    it('restoreWorldCanvasBoxIfStolen puts a 1×1 world buffer back to FOV size', () => {
        const world: WorldCanvasLike = { width: 1024, height: 576 };
        const box = snapshotWorldCanvasBox(world);
        world.width = 1;
        world.height = 1;
        assert.equal(restoreWorldCanvasBoxIfStolen(world, box), true);
        assert.equal(world.width, 1024);
        assert.equal(world.height, 576);
        assert.equal(restoreWorldCanvasBoxIfStolen(world, box), false);
    });
});

describe('F7 select Missile must not clear the world canvas', () => {
    it('select plan + guarded pool leave 1024×576 intact', () => {
        const game = { id: 'phaser-game' };
        const world: WorldCanvasLike = { width: 1024, height: 576 };
        const pool = createPhaserStylePool();
        pool.pool.push({ parent: game, canvas: world });
        const textures = {
            addCanvas: (_key: string, source: unknown) => source,
            remove: () => undefined,
            generateTexture: () => undefined,
        };
        attachWorldCanvasPoolGuard({ canvas: world, textures }, pool);

        endMagiasRitual();
        const plan = applyMagiasSpellSelectVisuals(
            SPELL_MAGIC_MISSILE_ID,
            {
                game: { canvas: world },
                add: {
                    text: () => {
                        throw new Error('Missile select must not create Phaser Text');
                    },
                },
                textures,
            },
            getOlympiaServerSpellId,
        );
        // Leftover pool steal that #70 never wrapped (Text / CanvasTexture.destroy).
        pool.remove(world);
        pool.remove(game);
        pool.create({ id: 'announce-text' }, 1, 1);
        textures.addCanvas('magias-select', world);

        assert.equal(plan.spellId, 0);
        assert.equal(plan.presentCircle, false);
        assert.equal(shouldSkipCastCanvasWorkOnState('Cast'), true);
        assert.equal(shouldSkipCastCanvasWorkOnState('CastReady'), true);
        assert.equal(shouldSkipCastCanvasWorkOnState('Idle'), false);
        assert.equal(shouldSkipCastCanvasWorkOnState('IdleFromCast'), true);
        assert.equal(world.width, 1024);
        assert.equal(world.height, 576);
        assert.equal(pool.pool[0].canvas, world);
        endMagiasRitual();
    });
});

describe('refuseWorldCanvasGenerateTexture', () => {
    it('soft-cast confirm must not snapshot game.canvas', () => {
        const textures = {
            generateTexture: () => {
                throw new Error('generateTexture must not run');
            },
        };
        refuseWorldCanvasGenerateTexture(textures);
        assert.equal(textures.generateTexture('magias-confirm'), false);
    });
});

describe('withWorldCanvasBoxGuard', () => {
    it('restores FOV size if confirm-time code 1×1s the world canvas', () => {
        const world: WorldCanvasLike = { width: 1024, height: 576 };
        const result = withWorldCanvasBoxGuard(world, () => {
            world.width = 1;
            world.height = 1;
            return 'ok';
        });
        assert.equal(result, 'ok');
        assert.equal(world.width, 1024);
        assert.equal(world.height, 576);
    });
});

describe('select Missile then move mid-prepare must not clear the world canvas', () => {
    it('select + WASD/restream steal paths leave 1024×576 intact', () => {
        const game = { id: 'phaser-game' };
        const world: WorldCanvasLike = { width: 1024, height: 576 };
        const pool = createPhaserStylePool();
        pool.pool.push({ parent: game, canvas: world });
        let createCanvasSource: unknown;
        const textures = {
            addCanvas: (_key: string, source: unknown) => source,
            remove: () => undefined,
            generateTexture: () => {
                throw new Error('move mid-prepare must not generateTexture');
            },
            createCanvas: (_key: string, width = 32, height = 32) => {
                const stolen = pool.create({ id: 'map-tileset' }, width, height);
                createCanvasSource = stolen;
                return stolen;
            },
        };
        attachWorldCanvasPoolGuard({ canvas: world, textures }, pool);

        endMagiasRitual();
        applyMagiasSpellSelectVisuals(
            SPELL_MAGIC_MISSILE_ID,
            {
                game: { canvas: world },
                add: {
                    text: () => {
                        throw new Error('Missile select must not create Phaser Text');
                    },
                },
                textures,
            },
            getOlympiaServerSpellId,
        );
        const plan = applyMagiasMoveDuringPrepareVisuals(
            SPELL_MAGIC_MISSILE_ID,
            {
                game: { canvas: world },
                add: {
                    text: () => {
                        throw new Error('Missile move mid-prepare must not create Phaser Text');
                    },
                },
                textures,
            },
        );
        // Camera/FOV/Scale + walk restream after #72 size-write refuse.
        pool.remove(world);
        pool.remove(game);
        pool.create({ id: 'walk-text' }, 1, 1);
        pool.create2D?.({ id: 'tileset-style' }, 8, 8);
        textures.addCanvas('magias-move', world);
        textures.createCanvas('elvine-tileset', 256, 256);
        reassertWorldCanvasPresentationGuard({ canvas: world, textures });
        world.width = 800;
        world.height = 450;

        assert.equal(plan.spellId, 0);
        assert.equal(plan.applyWalkAppearanceOnMove, false);
        assert.equal(plan.rebuildMapTileset, false);
        assert.equal(shouldSkipCastCanvasWorkOnState('MoveDuringPrepare'), true);
        assert.equal(textures.generateTexture('magias-move'), false);
        assert.notEqual(createCanvasSource, world);
        assert.equal(world.width, 1024);
        assert.equal(world.height, 576);
        assert.equal(pool.pool[0].canvas, world);
        endMagiasRitual();
    });
});

describe('refuseWorldCanvasCreateCanvas', () => {
    it('walk restream createCanvas must not shrink the world canvas', () => {
        const game = { id: 'phaser-game' };
        const world: WorldCanvasLike = { width: 1024, height: 576 };
        const pool = createPhaserStylePool();
        pool.pool.push({ parent: game, canvas: world });
        const textures = {
            createCanvas: (_key: string, width = 1, height = 1) => {
                return pool.create({ id: 'tileset' }, width, height);
            },
        };
        attachWorldCanvasPoolGuard({ canvas: world, textures }, pool);
        refuseWorldCanvasCreateCanvas(textures);
        const tileset = textures.createCanvas('map-tileset', 256, 128);
        assert.notEqual(tileset, world);
        assert.equal(world.width, 1024);
        assert.equal(world.height, 576);
    });
});

describe('soft-cast / target-mob confirm must not clear the world canvas', () => {
    it('confirm plan + guarded pool leave 1024×576 intact', () => {
        const game = { id: 'phaser-game' };
        const world: WorldCanvasLike = { width: 1024, height: 576 };
        const pool = createPhaserStylePool();
        pool.pool.push({ parent: game, canvas: world });
        const textures = {
            addCanvas: (_key: string, source: unknown) => source,
            remove: () => undefined,
            generateTexture: () => {
                throw new Error('confirm must not generateTexture');
            },
        };
        attachWorldCanvasPoolGuard({ canvas: world, textures }, pool);

        endMagiasRitual();
        const plan = applyMagiasSoftCastConfirmVisuals(
            SPELL_MAGIC_MISSILE_ID,
            {
                game: { canvas: world },
                add: {
                    text: () => {
                        throw new Error('Missile confirm must not create Phaser Text');
                    },
                },
                textures,
            },
        );
        pool.remove(world);
        pool.remove(game);
        pool.create({ id: 'confirm-text' }, 1, 1);
        pool.create2D?.({ id: 'text-style' }, 8, 8);
        textures.addCanvas('magias-confirm', world);
        assert.equal(textures.generateTexture('magias-confirm'), false);

        assert.equal(plan.spellId, 0);
        assert.equal(plan.applyIdleAppearanceOnConfirm, false);
        assert.equal(plan.spawnProjectileGameAsset, false);
        assert.equal(shouldSkipCastCanvasWorkOnState('IdleFromCast'), true);
        assert.equal(world.width, 1024);
        assert.equal(world.height, 576);
        assert.equal(pool.pool[0].canvas, world);
        endMagiasRitual();
    });
});
