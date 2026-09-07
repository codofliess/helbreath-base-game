import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    bfsAmdWalk,
    getAmdWalkCell,
    parseAmdWalkGrid,
} from './mapAmdWalkability';

const here = path.dirname(fileURLToPath(import.meta.url));
const mapsDir = path.resolve(here, '../../../server/Config/maps');
const gameWorldsPath = path.resolve(here, '../../../server/Config/GameWorlds.json');

/** Icebound pads on the east Middleland island (GameWorlds 4×4). */
const IB_PADS = { x1: 451, y1: 280, x2: 454, y2: 283 };

/** Shore causeway after the island sign at (456,249) — was client-blocked as "water". */
const IB_CAUSEWAY: Array<[number, number]> = [
    [459, 250],
    [460, 251],
    [461, 252],
    [462, 253],
    [463, 254],
    [464, 255],
    [465, 256],
    [466, 257],
    [467, 258],
    [468, 259],
    [467, 261],
    [467, 262],
    [467, 265],
];

function loadAmdFile(mapName: string) {
    const buf = fs.readFileSync(path.join(mapsDir, `${mapName}.amd`));
    return parseAmdWalkGrid(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

describe('AMD walkability (server 0x80 bit)', () => {
    it('Middleland IB sign + shore causeway are walkable (0x80 clear)', () => {
        const grid = loadAmdFile('middleland');
        const sign = getAmdWalkCell(grid, 456, 249);
        assert.ok(sign);
        assert.equal(sign.objectSprite, 200);

        const before = getAmdWalkCell(grid, 458, 249);
        assert.ok(before);
        assert.equal(before.moveAllowed, true);
        assert.equal(before.wet, false);

        for (const [x, y] of IB_CAUSEWAY) {
            const cell = getAmdWalkCell(grid, x, y);
            assert.ok(cell, `missing (${x},${y})`);
            assert.equal(cell.blocked, false, `(${x},${y}) should not have AMD 0x80`);
            assert.equal(cell.moveAllowed, true, `(${x},${y}) must be server-walkable`);
            assert.equal(cell.wet, true, `(${x},${y}) is the shore/water causeway`);
        }
    });

    it('Elvine Middleland landing can reach Icebound pads under the server walk rule', () => {
        const grid = loadAmdFile('middleland');
        const start = getAmdWalkCell(grid, 314, 23);
        assert.ok(start?.moveAllowed, 'Elvine ML landing 314,23 must be walkable');
        const path = bfsAmdWalk(grid, 314, 23, (x, y) =>
            x >= IB_PADS.x1 && x <= IB_PADS.x2 && y >= IB_PADS.y1 && y <= IB_PADS.y2);
        assert.ok(path, 'no path from Elvine ML gate landing to IB pads');
        assert.ok(path.steps > 50, `expected a long field path, got ${path.steps}`);
        const wetSteps = path.path.filter(([x, y]) => getAmdWalkCell(grid, x, y)?.wet).length;
        assert.ok(wetSteps > 0, 'path must use the shore causeway (wet + 0x80 clear)');
    });

    it('old client wet-block rule still isolates the IB island (regression lock)', () => {
        const grid = loadAmdFile('middleland');
        const path = bfsAmdWalk(
            grid,
            314,
            23,
            (x, y) => x >= IB_PADS.x1 && x <= IB_PADS.x2 && y >= IB_PADS.y1 && y <= IB_PADS.y2,
            (cell) => cell.moveAllowed && !cell.wet,
        );
        assert.equal(path, undefined);
    });

    it('GameWorlds teleport triggers and landings are map-walkable', () => {
        const worlds = JSON.parse(fs.readFileSync(gameWorldsPath, 'utf8')) as Array<{
            id: string;
            map: string;
            teleportLocs?: Array<{
                locs: Array<{ x: number; y: number }>;
                target: { worldId: string; loc: { x: number; y: number } };
            }>;
        }>;
        const grids = new Map<string, ReturnType<typeof loadAmdFile>>();
        const gridFor = (mapName: string) => {
            let g = grids.get(mapName);
            if (!g) {
                g = loadAmdFile(mapName);
                grids.set(mapName, g);
            }
            return g;
        };
        const worldById = new Map(worlds.map((w) => [w.id, w]));
        const blocked: string[] = [];
        for (const world of worlds) {
            const grid = gridFor(world.map);
            for (const t of world.teleportLocs ?? []) {
                for (const loc of t.locs ?? []) {
                    const cell = getAmdWalkCell(grid, loc.x, loc.y);
                    if (!cell?.moveAllowed) {
                        blocked.push(`${world.id} trigger (${loc.x},${loc.y})`);
                    }
                }
                const dest = worldById.get(t.target.worldId);
                if (!dest) {
                    continue;
                }
                const destCell = getAmdWalkCell(gridFor(dest.map), t.target.loc.x, t.target.loc.y);
                if (!destCell?.moveAllowed) {
                    blocked.push(`${world.id} landing ${t.target.worldId} (${t.target.loc.x},${t.target.loc.y})`);
                }
            }
        }
        assert.deepEqual(blocked, []);
    });

    it('Elvine barracks 2-1/2-2 exist and use AMD tele pads, not the copied 32,33 wall', () => {
        const worlds = JSON.parse(fs.readFileSync(gameWorldsPath, 'utf8')) as Array<{
            id: string;
            teleportLocs?: Array<{ locs: Array<{ x: number; y: number }> }>;
        }>;
        const elv21 = worlds.find((w) => w.id === 'elvbrk21');
        const elv22 = worlds.find((w) => w.id === 'elvbrk22');
        assert.ok(elv21 && elv22, 'missing elvbrk21/elvbrk22 worlds (Aresden/Elvine asymmetry)');
        const wall = (elv21.teleportLocs ?? []).some((t) =>
            (t.locs ?? []).some((l) => l.x === 32 && l.y === 33));
        assert.equal(wall, false);
        const grid21 = loadAmdFile('elvbrk21');
        assert.equal(getAmdWalkCell(grid21, 26, 41)?.moveAllowed, true);
        assert.equal(getAmdWalkCell(grid21, 32, 33)?.moveAllowed, false);
    });
});
