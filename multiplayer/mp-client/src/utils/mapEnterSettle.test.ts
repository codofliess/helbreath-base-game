import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    isStaleMapLoad,
    MAP_ENTER_ENTITY_CATCHUP_MS,
    MAP_ENTER_HEAVY_DECODE_MS,
    MAP_ENTER_HEAVY_DECODE_RETRY_MS,
    MAP_ENTER_HUD_SPRITES_MS,
    MAP_ENTER_MONSTER_SYNC_MS,
    MAP_ENTER_NPC_SYNC_MS,
    MAP_ENTER_TREE_PASS_MS,
    MAP_ENTER_ZOOM_RESTORE_MS,
    nextMapLoadGeneration,
    shouldDeferHeavyEnterDecode,
} from './mapEnterSettle';

const here = path.dirname(fileURLToPath(import.meta.url));
const gameWorldSrc = fs.readFileSync(path.join(here, '../game/scenes/GameWorld.ts'), 'utf8');

describe('mapEnterSettle', () => {
    it('enables monsters before trees/gear so city→farm after Gandalf can score kills', () => {
        assert.ok(MAP_ENTER_MONSTER_SYNC_MS < 1_000);
        assert.ok(MAP_ENTER_MONSTER_SYNC_MS < MAP_ENTER_TREE_PASS_MS);
        assert.ok(MAP_ENTER_TREE_PASS_MS < MAP_ENTER_ENTITY_CATCHUP_MS);
        assert.equal(MAP_ENTER_TREE_PASS_MS, 10_000);
        assert.equal(MAP_ENTER_ENTITY_CATCHUP_MS, 12_000);
        assert.equal(MAP_ENTER_NPC_SYNC_MS, 14_000);
        assert.equal(MAP_ENTER_HEAVY_DECODE_MS, 16_000);
        assert.equal(MAP_ENTER_ZOOM_RESTORE_MS, 18_000);
        assert.equal(MAP_ENTER_HUD_SPRITES_MS, 20_000);
        assert.ok(MAP_ENTER_HEAVY_DECODE_RETRY_MS >= 1_000);
    });

    it('defers equipped decode / zoom-out while loading, casting, or walking', () => {
        assert.equal(
            shouldDeferHeavyEnterDecode({ loadingMap: true, castingOrPreparing: false, moving: false }),
            true,
        );
        assert.equal(
            shouldDeferHeavyEnterDecode({ loadingMap: false, castingOrPreparing: true, moving: false }),
            true,
        );
        assert.equal(
            shouldDeferHeavyEnterDecode({ loadingMap: false, castingOrPreparing: false, moving: true }),
            true,
        );
        assert.equal(
            shouldDeferHeavyEnterDecode({ loadingMap: false, castingOrPreparing: false, moving: false }),
            false,
        );
    });

    it('invalidates expand/tree closures across scene.restart generations', () => {
        assert.equal(isStaleMapLoad(2, 1), true);
        assert.equal(isStaleMapLoad(3, 3), false);
        assert.equal(nextMapLoadGeneration(3), 4);
        assert.equal(nextMapLoadGeneration(Number.MAX_SAFE_INTEGER), 1);
    });

    it('GameWorld wires generation abort, early monsters, and idle-gated heavy decode', () => {
        assert.match(gameWorldSrc, /mapLoadGeneration/);
        assert.match(gameWorldSrc, /invalidateMapLoadGeneration/);
        assert.match(gameWorldSrc, /isLiveMapLoad/);
        assert.match(gameWorldSrc, /enableEntitiesAfterFirstPaint/);
        assert.match(gameWorldSrc, /tryHeavyEnterDecode/);
        assert.match(gameWorldSrc, /shouldDeferHeavyEnterDecode/);
        assert.match(gameWorldSrc, /MAP_ENTER_MONSTER_SYNC_MS/);
        assert.match(gameWorldSrc, /MAP_ENTER_TREE_PASS_MS/);
        assert.match(gameWorldSrc, /MAP_ENTER_ENTITY_CATCHUP_MS/);
        assert.match(gameWorldSrc, /MAP_ENTER_NPC_SYNC_MS/);
        assert.match(gameWorldSrc, /MAP_ENTER_HEAVY_DECODE_MS/);
        assert.match(gameWorldSrc, /MAP_ENTER_ZOOM_RESTORE_MS/);
        assert.match(gameWorldSrc, /MAP_ENTER_HUD_SPRITES_MS/);
    });
});
