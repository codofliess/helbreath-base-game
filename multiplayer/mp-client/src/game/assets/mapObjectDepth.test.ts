import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DEPTH_MULTIPLIER, ENTITY_DEPTH_BIAS } from '../../Config';
import { TILE_SIZE } from '../../constants/TileSize';
import { sliceSprSheets } from '../../utils/sprSheetSlice';
import { mapObjectSortDepth, mapTileSpriteDepthBias } from './mapObjectDepth';

const spritesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../public/assets/sprites');

function characterDepth(row: number): number {
    return row * DEPTH_MULTIPLIER + ENTITY_DEPTH_BIAS;
}

function readFrame(fileName: string, sheetIndex: number, frameIndex: number) {
    const buf = fs.readFileSync(path.join(spritesDir, fileName));
    const bytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const sheet = sliceSprSheets(bytes, new Set([sheetIndex])).find((entry) => entry.sheetIndex === sheetIndex);
    const frame = sheet?.frames[frameIndex];
    assert.ok(frame, `${fileName} sheet ${sheetIndex} frame ${frameIndex} missing`);
    return frame;
}

describe('mapObjectSortDepth', () => {
    it('keeps carpets and in-tile walls on the anchor row, under a same-row character', () => {
        const carpet = mapObjectSortDepth({ anchorRow: 40, pivotY: -2, frameHeight: 19 });
        assert.equal(carpet, 40 * DEPTH_MULTIPLIER);
        assert.ok(characterDepth(40) > carpet);
        assert.ok(characterDepth(39) < carpet);

        const wall = readFrame('tile370-381.spr', 0, 1);
        const wallDepth = mapObjectSortDepth({
            anchorRow: 67,
            pivotY: wall.pivotY,
            frameHeight: wall.height,
        });
        assert.equal(wall.pivotY + wall.height, 17);
        assert.equal(wallDepth, 67 * DEPTH_MULTIPLIER);
        assert.ok(characterDepth(68) > wallDepth);
    });

    it('does not pull a sprite north of its anchor tile', () => {
        const depth = mapObjectSortDepth({ anchorRow: 50, pivotY: -111, frameHeight: 104 });
        assert.ok(-111 + 104 < 0);
        assert.equal(depth, 50 * DEPTH_MULTIPLIER);
    });

    it('treats a bottom on the tile boundary as the anchor row, and one pixel past it as the next row', () => {
        assert.equal(
            mapObjectSortDepth({ anchorRow: 10, pivotY: 0, frameHeight: TILE_SIZE }),
            10 * DEPTH_MULTIPLIER,
        );
        assert.equal(
            mapObjectSortDepth({ anchorRow: 10, pivotY: 0, frameHeight: TILE_SIZE + 1 }),
            11 * DEPTH_MULTIPLIER,
        );
    });

    it('sorts a one-row spill on its foot row and a multi-row hang past the entity bias', () => {
        assert.equal(
            mapObjectSortDepth({ anchorRow: 10, pivotY: 0, frameHeight: TILE_SIZE + 20 }),
            11 * DEPTH_MULTIPLIER,
        );
        // Bottom pixel lands two rows south of the anchor. Clear the bias of the
        // cell just past that pixel; the cell after it stays in front.
        const hung = mapObjectSortDepth({ anchorRow: 10, pivotY: 0, frameHeight: TILE_SIZE * 2 + 1 });
        const footRow = 12;
        assert.equal(hung, (footRow + 2) * DEPTH_MULTIPLIER);
        assert.ok(characterDepth(footRow + 1) < hung);
        assert.ok(characterDepth(footRow + 2) > hung);
    });

    it('sorts Elvine hanging wall pieces behind a character on the grass under them', () => {
        // objects7.spr tile start 242 → map-tile-244 is sheet 2. Frame 6 hangs
        // south from row 80 over the grass; anchor-row depth drew the player on top.
        const frame = readFrame('objects7.spr', 2, 6);
        const anchorRow = 80;
        const depth = mapObjectSortDepth({
            anchorRow,
            pivotY: frame.pivotY,
            frameHeight: frame.height,
        });
        const footRow = anchorRow + Math.floor((frame.pivotY + frame.height - 1) / TILE_SIZE);
        assert.ok(footRow > anchorRow + 1, `expected a multi-row hang, foot ${footRow}`);
        assert.equal(depth, (footRow + 2) * DEPTH_MULTIPLIER);

        const grassRow = 88;
        assert.ok(characterDepth(grassRow) < depth, 'character under the overhang draws behind the wall');
        assert.ok(characterDepth(footRow + 1) < depth, 'cell just south of the bitmap stays behind the wall');
        assert.ok(characterDepth(footRow + 2) > depth, 'the next cell south stays in front');
    });

    it('leaves trees on the anchor row when the canopy hangs south', () => {
        const canopy = mapObjectSortDepth({
            anchorRow: 30,
            pivotY: -293,
            frameHeight: 368,
            keepAnchorRow: true,
        });
        assert.equal(-293 + 368, 75);
        assert.equal(canopy, 30 * DEPTH_MULTIPLIER);
        assert.ok(characterDepth(31) > canopy);
    });

    it('keeps the map-tile-422 same-tile bias from stacking on top of a foot shift', () => {
        const frame = readFrame('tile422-429.spr', 0, 12);
        const anchorRow = 111;
        const foot = mapObjectSortDepth({
            anchorRow,
            pivotY: frame.pivotY,
            frameHeight: frame.height,
        });
        assert.ok(frame.pivotY + frame.height <= TILE_SIZE);
        assert.equal(foot, anchorRow * DEPTH_MULTIPLIER);
        assert.equal(mapTileSpriteDepthBias('map-tile-422'), DEPTH_MULTIPLIER);
        assert.equal(mapTileSpriteDepthBias('map-tile-370'), 0);

        const drawn = foot + mapTileSpriteDepthBias('map-tile-422');
        assert.ok(characterDepth(anchorRow) < drawn);
        assert.ok(characterDepth(anchorRow + 1) > drawn);
    });
});
