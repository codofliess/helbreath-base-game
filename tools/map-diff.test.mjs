import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inflateSync } from 'node:zlib';
import {
    auditMap,
    compareSpawnConfig,
    diffAmdBuffers,
    encodeAmd,
    isWalkableWallCell,
    locateReference,
    parseHeader,
    parseMapdata,
    renderComparisonPng,
    writeRgbPng,
} from './map-diff.mjs';

test('amd diff counts tile, object, collision, and teleport', () => {
    const same = { sprite: 1, spriteFrame: 0, objectSprite: 0, objectFrame: 0, flags: 0 };
    const leftCells = Array.from({ length: 16 }, () => ({ ...same }));
    const rightCells = Array.from({ length: 16 }, () => ({ ...same }));
    rightCells[0] = { ...same, sprite: 4 };
    rightCells[1] = { ...same, objectSprite: 55, objectFrame: 2 };
    rightCells[2] = { ...same, flags: 0x80 };
    rightCells[3] = { ...same, flags: 0x40 };
    const diff = diffAmdBuffers(encodeAmd(4, 4, leftCells), encodeAmd(4, 4, rightCells));
    assert.equal(diff.counts.tile, 1);
    assert.equal(diff.counts.object, 1);
    assert.equal(diff.counts.collision, 1);
    assert.equal(diff.counts.teleport, 1);
    assert.equal(diff.counts.changed, 4);
    assert.equal(diff.samples.collision[0].rightBlocked, true);
});

test('mapdata teleport and spawn diffs against GameWorlds', () => {
    const mapdata = parseMapdata(`
teleport-loc = 10 20 arefarm 1 2
teleport-loc = 11 20 arefarm 1 2
initial-point = 1 30 40
spot-mob-generator = 1 1 5 6 8 9 10 4
maximum-object = 50
random-mob-generator = 0 4
`);
    const bucket = {
        teleports: [
            { x: 10, y: 20, destMap: 'arefarm', destX: 1, destY: 2 },
            { x: 12, y: 20, destMap: 'arefarm', destX: 3, destY: 4 },
        ],
        recall: [{ x: 30, y: 40 }, { x: 1, y: 1 }],
        dwells: [{ x1: 5, y1: 6, x2: 8, y2: 9, count: 4, monsterId: 1 }],
    };
    const spawn = compareSpawnConfig(mapdata, bucket);
    assert.equal(spawn.teleportOnlyOlympia, 1);
    assert.equal(spawn.teleportOnlyOurs, 1);
    assert.equal(spawn.initialOnlyOlympia, 0);
    assert.equal(spawn.initialOnlyOurs, 1);
    assert.equal(spawn.spotsOnlyOlympia, 0);
    assert.equal(spawn.spotsOnlyOurs, 0);
    assert.ok(spawn.spawn >= 3);
});

test('spawn audit flags a recall pad on a blocked cell', () => {
    const cells = Array.from({ length: 9 }, () => ({ sprite: 1, flags: 0 }));
    cells[4] = { sprite: 1, flags: 0x80 };
    const buf = encodeAmd(3, 3, cells);
    const audit = auditMap(buf, {
        teleports: [],
        recall: [{ x: 1, y: 1, kind: 'recall', worldId: 'elvine', label: 'ip1' }],
        npcs: [],
        dwells: [],
        landings: [],
    });
    assert.equal(audit.stats.badSpawns.length, 1);
    assert.equal(audit.stats.badSpawns[0].issue, 'blocked');
    assert.equal(parseHeader(buf).sizeX, 3);
});

test('walkable walls are object-layer art, not structures-pack paths', () => {
    assert.equal(isWalkableWallCell({ sprite: 51, objectSprite: 0, flags: 0 }), false);
    assert.equal(isWalkableWallCell({ sprite: 0, objectSprite: 375, flags: 0 }), true);
    assert.equal(isWalkableWallCell({ sprite: 401, objectSprite: 422, flags: 0 }), true);
    assert.equal(isWalkableWallCell({ sprite: 0, objectSprite: 375, flags: 0x80 }), false);
});

test('missing Olympia directories stay missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'map-diff-'));
    const found = locateReference(dir, path.join(dir, 'no-amd'), path.join(dir, 'no-mapdata'));
    assert.equal(found.olympiaAmd, null);
    assert.equal(found.mapdata, null);
});

test('png round-trip keeps the painted pixel', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'map-diff-png-'));
    const file = path.join(dir, 'one.png');
    const rgb = Buffer.from([12, 34, 56]);
    writeRgbPng(file, 1, 1, rgb);
    const png = fs.readFileSync(file);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    let offset = 8;
    let idat = null;
    while (offset + 8 <= png.length) {
        const len = png.readUInt32BE(offset);
        const type = png.subarray(offset + 4, offset + 8).toString('ascii');
        if (type === 'IDAT') idat = png.subarray(offset + 8, offset + 8 + len);
        offset += 12 + len;
    }
    assert.ok(idat, 'png missing IDAT');
    const raw = inflateSync(idat);
    assert.equal(raw[0], 0);
    assert.equal(raw[1], 12);
    assert.equal(raw[2], 34);
    assert.equal(raw[3], 56);
});

test('side-by-side render writes a png', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'map-diff-side-'));
    const file = path.join(dir, 'side.png');
    const left = encodeAmd(4, 2, [
        { sprite: 1, flags: 0x80 },
        { sprite: 2, objectSprite: 55 },
        { sprite: 19 },
        { sprite: 1, flags: 0x40 },
        { sprite: 1 },
        { sprite: 1 },
        { sprite: 1 },
        { sprite: 422 },
    ]);
    const right = encodeAmd(4, 2, [
        { sprite: 1, flags: 0 },
        { sprite: 2, objectSprite: 10 },
        { sprite: 19 },
        { sprite: 9, flags: 0x40 },
        { sprite: 1 },
        { sprite: 1 },
        { sprite: 1 },
        { sprite: 422 },
    ]);
    const size = renderComparisonPng(file, left, right, new Set(['0,1']));
    assert.ok(size.width > 8);
    assert.equal(fs.readFileSync(file).subarray(0, 4).toString('hex'), '89504e47');
});
