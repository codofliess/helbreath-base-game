import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    COMPACT_INTERIOR_MAX_SIZE_TILES,
    isCompactInteriorMap,
    isStaleMapLoad,
    isWizardTowerMap,
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
    shouldSkipEnterHeavyCascade,
} from './mapEnterSettle';

const here = path.dirname(fileURLToPath(import.meta.url));
const gameWorldSrc = fs.readFileSync(path.join(here, '../game/scenes/GameWorld.ts'), 'utf8');

const idle = {
    loadingMap: false,
    castingOrPreparing: false,
    moving: false,
    standingAtEnterFocus: false,
};

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
        assert.equal(COMPACT_INTERIOR_MAX_SIZE_TILES, 100);
    });

    it('defers equipped decode / zoom-out while loading, casting, walking, or on the enter pad', () => {
        assert.equal(shouldDeferHeavyEnterDecode({ ...idle, loadingMap: true }), true);
        assert.equal(shouldDeferHeavyEnterDecode({ ...idle, castingOrPreparing: true }), true);
        assert.equal(shouldDeferHeavyEnterDecode({ ...idle, moving: true }), true);
        assert.equal(shouldDeferHeavyEnterDecode({ ...idle, standingAtEnterFocus: true }), true);
        assert.equal(shouldDeferHeavyEnterDecode(idle), false);
    });

    it('treats Wizard Tower 100×100 as a compact interior and Elvine 300×300 as city', () => {
        assert.equal(isCompactInteriorMap(100, 100), true);
        assert.equal(isCompactInteriorMap(80, 70), true);
        assert.equal(isCompactInteriorMap(300, 300), false);
        assert.equal(isCompactInteriorMap(0, 100), false);
        assert.equal(isWizardTowerMap('elvwzdtwr', 'map-wzdtwr_1'), true);
        assert.equal(isWizardTowerMap('elvine', 'map-elvine'), false);
        assert.equal(
            shouldSkipEnterHeavyCascade({ sizeX: 100, sizeY: 100, worldId: 'elvwzdtwr', mapName: 'map-wzdtwr_1' }),
            true,
        );
        assert.equal(
            shouldSkipEnterHeavyCascade({ sizeX: 300, sizeY: 300, worldId: 'elvine', mapName: 'map-elvine' }),
            false,
        );
    });

    it('invalidates expand/tree closures across scene.restart generations', () => {
        assert.equal(isStaleMapLoad(2, 1), true);
        assert.equal(isStaleMapLoad(3, 3), false);
        assert.equal(nextMapLoadGeneration(3), 4);
        assert.equal(nextMapLoadGeneration(Number.MAX_SAFE_INTEGER), 1);
    });

    it('GameWorld wires generation abort, early monsters, pad-hold, and interior skip', () => {
        assert.match(gameWorldSrc, /mapLoadGeneration/);
        assert.match(gameWorldSrc, /invalidateMapLoadGeneration/);
        assert.match(gameWorldSrc, /isLiveMapLoad/);
        assert.match(gameWorldSrc, /enableEntitiesAfterFirstPaint/);
        assert.match(gameWorldSrc, /tryHeavyEnterDecode/);
        assert.match(gameWorldSrc, /shouldDeferHeavyEnterDecode/);
        assert.match(gameWorldSrc, /shouldSkipEnterHeavyCascade/);
        assert.match(gameWorldSrc, /enterCompactInterior/);
        assert.match(gameWorldSrc, /standingAtEnterFocus/);
        assert.match(gameWorldSrc, /MAP_ENTER_MONSTER_SYNC_MS/);
        assert.match(gameWorldSrc, /MAP_ENTER_TREE_PASS_MS/);
        assert.match(gameWorldSrc, /MAP_ENTER_ENTITY_CATCHUP_MS/);
        assert.match(gameWorldSrc, /MAP_ENTER_NPC_SYNC_MS/);
        assert.match(gameWorldSrc, /MAP_ENTER_HEAVY_DECODE_MS/);
        assert.match(gameWorldSrc, /MAP_ENTER_ZOOM_RESTORE_MS/);
        assert.match(gameWorldSrc, /MAP_ENTER_HUD_SPRITES_MS/);
    });
});
