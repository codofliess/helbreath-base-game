import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SPELL_MAGIC_MISSILE_ID } from '../constants/Spells';
import { getOlympiaServerSpellId } from '../constants/OlympiaServerSpellMap';
import {
    applyMagiasSpellSelectVisuals,
    endMagiasRitual,
    shouldSkipCastCanvasWorkOnState,
} from './castPresentation';
import {
    attachWorldCanvasPoolGuard,
    occupyWorldCanvasPoolSlot,
    protectWorldCanvasInPool,
    refuseWorldCanvasTextureBind,
    restoreWorldCanvasBoxIfStolen,
    snapshotWorldCanvasBox,
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
        assert.equal(world.width, 1024);
        assert.equal(world.height, 576);
        assert.equal(pool.pool[0].canvas, world);
        endMagiasRitual();
    });
});
