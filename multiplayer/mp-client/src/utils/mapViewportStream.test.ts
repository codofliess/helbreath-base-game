import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    MAP_STREAM_MAX_HEIGHT_TILES,
    MAP_STREAM_MAX_WIDTH_TILES,
    cameraStreamTileRect,
    collectSpriteIndicesInRect,
    initialFocusStreamRect,
    mapTileRectArea,
    mapTileRectContains,
    mapTileRectsEqual,
} from './mapViewportStream';

function isTreeSpriteIndex(spriteIndex: number): boolean {
    return spriteIndex >= 100 && spriteIndex <= 145;
}

describe('mapViewportStream', () => {
    it('never covers a full 400×400 world from a playtest-sized camera', () => {
        const mapSizeX = 400;
        const mapSizeY = 400;
        const fullArea = mapSizeX * mapSizeY;
        const rect = cameraStreamTileRect({
            scrollX: 90 * 32,
            scrollY: 80 * 32,
            viewWidthPx: 1024,
            viewHeightPx: 576,
            zoom: 1,
            mapSizeX,
            mapSizeY,
        });
        const area = mapTileRectArea(rect);
        assert.ok(area < fullArea / 10, `stream area ${area} must be << full map ${fullArea}`);
        assert.ok(area <= MAP_STREAM_MAX_WIDTH_TILES * MAP_STREAM_MAX_HEIGHT_TILES);
    });

    it('caps a full-map minimap zoom so Loading map cannot allocate the world', () => {
        const mapSizeX = 400;
        const mapSizeY = 400;
        const mapWidthPx = mapSizeX * 32;
        const mapHeightPx = mapSizeY * 32;
        const fitZoom = Math.min(1024 / mapWidthPx, 576 / mapHeightPx);
        const rect = cameraStreamTileRect({
            scrollX: 0,
            scrollY: 0,
            viewWidthPx: 1024,
            viewHeightPx: 576,
            zoom: fitZoom,
            mapSizeX,
            mapSizeY,
        });
        assert.ok(mapTileRectArea(rect) <= MAP_STREAM_MAX_WIDTH_TILES * MAP_STREAM_MAX_HEIGHT_TILES);
        assert.ok(rect.maxX - rect.minX + 1 <= MAP_STREAM_MAX_WIDTH_TILES);
        assert.ok(rect.maxY - rect.minY + 1 <= MAP_STREAM_MAX_HEIGHT_TILES);
    });

    it('collects sprite indices only inside the stream rect', () => {
        const tiles = [
            [{ sprite: 1, objectSprite: 0 }, { sprite: 2, objectSprite: 100 }],
            [{ sprite: 3, objectSprite: 0 }, { sprite: 4, objectSprite: 0 }],
        ];
        const indices = collectSpriteIndicesInRect(
            tiles,
            { minX: 0, minY: 0, maxX: 0, maxY: 0 },
            isTreeSpriteIndex,
        );
        assert.deepEqual([...indices].sort((a, b) => a - b), [1]);
        const withTree = collectSpriteIndicesInRect(
            tiles,
            { minX: 1, minY: 0, maxX: 1, maxY: 0 },
            isTreeSpriteIndex,
        );
        assert.ok(withTree.has(2));
        assert.ok(withTree.has(100));
        assert.ok(withTree.has(150));
        assert.equal(withTree.has(3), false);
    });

    it('initial ElonQa focus window stays bounded', () => {
        const rect = initialFocusStreamRect(90, 80, 400, 400);
        assert.ok(mapTileRectContains(rect, { minX: 90, minY: 80, maxX: 90, maxY: 80 }));
        assert.ok(mapTileRectArea(rect) < 400 * 400);
        assert.equal(mapTileRectsEqual(rect, rect), true);
    });
});
