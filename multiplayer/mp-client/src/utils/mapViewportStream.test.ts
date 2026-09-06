import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    MAP_ENTER_RING_TILES,
    MAP_EXPAND_STEP_TILES,
    MAP_FIRST_PAINT_MAX_HEIGHT_TILES,
    MAP_FIRST_PAINT_MAX_WIDTH_TILES,
    MAP_POST_PAINT_MAX_HEIGHT_TILES,
    MAP_POST_PAINT_MAX_WIDTH_TILES,
    MAP_STAND_REFRESH_SLACK_TILES,
    MAP_STREAM_MAX_HEIGHT_TILES,
    MAP_STREAM_MAX_WIDTH_TILES,
    MAP_STREAM_RING_TILES,
    cameraStreamTileRect,
    collectSpriteIndicesInRect,
    firstPaintStreamRect,
    growMapTileRectToward,
    initialFocusStreamRect,
    mapTileKeysToEvict,
    mapTileRectArea,
    mapTileRectContains,
    mapTileRectHeight,
    mapTileRectWidth,
    mapTileRectsEqual,
    paintStreamTileRect,
    postPaintStreamRect,
    shouldRefreshMapStream,
} from './mapViewportStream';

function isTreeSpriteIndex(spriteIndex: number): boolean {
    return spriteIndex >= 100 && spriteIndex <= 145;
}

describe('mapViewportStream', () => {
    it('never covers a full 400×400 world from a play-sized camera', () => {
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
        const groundOnly = collectSpriteIndicesInRect(
            tiles,
            { minX: 1, minY: 0, maxX: 1, maxY: 0 },
            isTreeSpriteIndex,
            false,
            false,
        );
        assert.ok(groundOnly.has(2));
        assert.equal(groundOnly.has(100), false);
    });

    it('Elvine city-hall spawn (149,131) stays in a bounded stream window', () => {
        const rect = initialFocusStreamRect(149, 131, 400, 400);
        assert.ok(mapTileRectContains(rect, { minX: 149, minY: 131, maxX: 149, maxY: 131 }));
        assert.ok(mapTileRectArea(rect) <= MAP_STREAM_MAX_WIDTH_TILES * MAP_STREAM_MAX_HEIGHT_TILES);
        assert.ok(rect.maxY - rect.minY + 1 <= MAP_STREAM_MAX_HEIGHT_TILES);
        const walkPaint = paintStreamTileRect({
            scrollX: 149 * 32,
            scrollY: 131 * 32,
            viewWidthPx: 1024,
            viewHeightPx: 576,
            zoom: 1,
            mapSizeX: 400,
            mapSizeY: 400,
        });
        assert.ok(
            mapTileRectArea(rect) < mapTileRectArea(walkPaint),
            'first enter must decode a smaller window than the walk paint cap',
        );
        assert.ok(MAP_ENTER_RING_TILES < MAP_STREAM_RING_TILES);
    });

    it('frame-0 first paint is a tiny window, smaller than enter FOV+ring', () => {
        const first = firstPaintStreamRect(149, 131, 300, 300);
        const enter = initialFocusStreamRect(149, 131, 300, 300);
        assert.ok(mapTileRectContains(first, { minX: 149, minY: 131, maxX: 149, maxY: 131 }));
        assert.ok(mapTileRectWidth(first) <= MAP_FIRST_PAINT_MAX_WIDTH_TILES);
        assert.ok(mapTileRectHeight(first) <= MAP_FIRST_PAINT_MAX_HEIGHT_TILES);
        assert.ok(mapTileRectArea(first) < mapTileRectArea(enter));
        assert.ok(MAP_FIRST_PAINT_MAX_WIDTH_TILES < MAP_STREAM_MAX_WIDTH_TILES);
        const post = postPaintStreamRect(149, 131, 300, 300);
        assert.ok(mapTileRectWidth(post) <= MAP_POST_PAINT_MAX_WIDTH_TILES);
        assert.ok(mapTileRectHeight(post) <= MAP_POST_PAINT_MAX_HEIGHT_TILES);
        assert.ok(mapTileRectArea(first) < mapTileRectArea(post));
        assert.ok(mapTileRectArea(post) < mapTileRectArea(enter));
    });

    it('post-stand expand grows toward enter in small steps, never a walk-cap rebuild', () => {
        const first = firstPaintStreamRect(149, 131, 300, 300);
        const enter = initialFocusStreamRect(149, 131, 300, 300);
        const walkCap = paintStreamTileRect({
            scrollX: 149 * 32 - 512,
            scrollY: 131 * 32 - 288,
            viewWidthPx: 1024,
            viewHeightPx: 576,
            zoom: 1,
            mapSizeX: 300,
            mapSizeY: 300,
        });
        const step = growMapTileRectToward(first, enter, MAP_EXPAND_STEP_TILES);
        assert.ok(mapTileRectContains(enter, step) || mapTileRectsEqual(step, enter) || mapTileRectContains(step, first));
        assert.ok(mapTileRectArea(step) < mapTileRectArea(walkCap));
        assert.ok(mapTileRectArea(step) <= mapTileRectArea(first) + (MAP_EXPAND_STEP_TILES * 2) * (mapTileRectWidth(first) + mapTileRectHeight(first) + MAP_EXPAND_STEP_TILES * 2));
        assert.equal(mapTileRectsEqual(step, walkCap), false);
        const neededWalk = cameraStreamTileRect({
            scrollX: 149 * 32 - 512,
            scrollY: 131 * 32 - 288,
            viewWidthPx: 1024,
            viewHeightPx: 576,
            zoom: 1,
            mapSizeX: 300,
            mapSizeY: 300,
            ringTiles: MAP_STREAM_RING_TILES,
        });
        assert.equal(shouldRefreshMapStream(first, neededWalk, MAP_STAND_REFRESH_SLACK_TILES), false);
        const focusNeeded = cameraStreamTileRect({
            scrollX: 149 * 32 - 512,
            scrollY: 131 * 32 - 288,
            viewWidthPx: 1024,
            viewHeightPx: 576,
            zoom: 1,
            mapSizeX: 300,
            mapSizeY: 300,
            ringTiles: MAP_ENTER_RING_TILES,
        });
        assert.equal(shouldRefreshMapStream(enter, focusNeeded, MAP_STAND_REFRESH_SLACK_TILES), false);
    });

    it('live Elvine 300×300 .amd cannot paint as one layer per world row', () => {
        const mapSizeX = 300;
        const mapSizeY = 300;
        const rect = initialFocusStreamRect(149, 131, mapSizeX, mapSizeY);
        const oldLayers = mapSizeY;
        const streamedRows = rect.maxY - rect.minY + 1;
        assert.ok(streamedRows <= MAP_STREAM_MAX_HEIGHT_TILES);
        assert.ok(streamedRows < oldLayers);
        assert.ok(mapTileRectArea(rect) < mapSizeX * mapSizeY / 10);
    });

    it('initial spawn focus window stays bounded', () => {
        const rect = initialFocusStreamRect(90, 80, 400, 400);
        assert.ok(mapTileRectContains(rect, { minX: 90, minY: 80, maxX: 90, maxY: 80 }));
        assert.ok(mapTileRectArea(rect) < 400 * 400);
        assert.equal(mapTileRectsEqual(rect, rect), true);
    });

    it('standing on enter rect must not restream just because walk-ring is 8 vs enter-ring 4', () => {
        const painted = initialFocusStreamRect(149, 131, 300, 300);
        const neededWalkRing = cameraStreamTileRect({
            scrollX: 149 * 32 - 512,
            scrollY: 131 * 32 - 288,
            viewWidthPx: 1024,
            viewHeightPx: 576,
            zoom: 1,
            mapSizeX: 300,
            mapSizeY: 300,
            ringTiles: MAP_STREAM_RING_TILES,
        });
        assert.equal(shouldRefreshMapStream(painted, neededWalkRing), false);
        const far = cameraStreamTileRect({
            scrollX: 185 * 32,
            scrollY: 117 * 32,
            viewWidthPx: 1024,
            viewHeightPx: 576,
            zoom: 1,
            mapSizeX: 300,
            mapSizeY: 300,
        });
        assert.equal(shouldRefreshMapStream(painted, far), true);
    });
    it('walking one cell inside the painted cap does not restream', () => {
        const spawn = { scrollX: 149 * 32, scrollY: 131 * 32, viewWidthPx: 1024, viewHeightPx: 576, zoom: 1, mapSizeX: 300, mapSizeY: 300 };
        const painted = paintStreamTileRect(spawn);
        const neededHere = cameraStreamTileRect(spawn);
        assert.equal(shouldRefreshMapStream(painted, neededHere), false);
        const oneCell = { ...spawn, scrollX: 150 * 32, scrollY: 131 * 32 };
        assert.equal(shouldRefreshMapStream(painted, cameraStreamTileRect(oneCell)), false);
        assert.ok(mapTileRectWidth(painted) <= MAP_STREAM_MAX_WIDTH_TILES);
        assert.ok(mapTileRectHeight(painted) <= MAP_STREAM_MAX_HEIGHT_TILES);
    });

    it('Elvine walk spawn→(185,117) restreams but each paint stays capped', () => {
        const a = paintStreamTileRect({
            scrollX: 149 * 32,
            scrollY: 131 * 32,
            viewWidthPx: 1024,
            viewHeightPx: 576,
            zoom: 1,
            mapSizeX: 300,
            mapSizeY: 300,
        });
        const farNeeded = cameraStreamTileRect({
            scrollX: 185 * 32,
            scrollY: 117 * 32,
            viewWidthPx: 1024,
            viewHeightPx: 576,
            zoom: 1,
            mapSizeX: 300,
            mapSizeY: 300,
        });
        assert.equal(shouldRefreshMapStream(a, farNeeded), true);
        const b = paintStreamTileRect({
            scrollX: 185 * 32,
            scrollY: 117 * 32,
            viewWidthPx: 1024,
            viewHeightPx: 576,
            zoom: 1,
            mapSizeX: 300,
            mapSizeY: 300,
        });
        assert.ok(mapTileRectArea(b) <= MAP_STREAM_MAX_WIDTH_TILES * MAP_STREAM_MAX_HEIGHT_TILES);
        assert.equal(shouldRefreshMapStream(b, farNeeded), false);
    });

    it('evicts map-tile textures that left the keep-set (unbounded walk decode)', () => {
        const keep = new Set([10, 11, 150]);
        const evict = mapTileKeysToEvict(
            ['map-tile-10', 'map-tile-99', 'sprite-wm-0', 'map-tile-150', '__DEFAULT'],
            keep,
        );
        assert.deepEqual(evict, ['map-tile-99']);
    });
});
