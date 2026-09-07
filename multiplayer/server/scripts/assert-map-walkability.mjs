/**
 * Server-side walkability assertions: IB Elvine causeway + GameWorlds pads on AMD 0x80.
 * Run: node multiplayer/server/scripts/assert-map-walkability.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mapsDir = path.join(__dirname, '..', 'Config', 'maps');
const gameWorldsPath = path.join(__dirname, '..', 'Config', 'GameWorlds.json');
const BLOCKED = 0x80;

function parseAmd(mapName) {
    const file = path.join(mapsDir, `${mapName}.amd`);
    const bytes = fs.readFileSync(file);
    const header = bytes.subarray(0, 256).toString('ascii').replace(/\0/g, ' ');
    const get = (k) => Number(header.match(new RegExp(`${k}\\s*=\\s*(\\d+)`))?.[1] ?? 0);
    return { bytes, sizeX: get('MAPSIZEX'), sizeY: get('MAPSIZEY'), tileSize: get('TILESIZE') || 10 };
}

function flagsAt(m, x, y) {
    if (x < 0 || y < 0 || x >= m.sizeX || y >= m.sizeY) {
        return null;
    }
    return m.bytes[256 + (y * m.sizeX + x) * m.tileSize + 8];
}

const errors = [];
const ml = parseAmd('middleland');
// 456,249 is the sign object (may sit on a blocked decoration tile). Path starts at 458,249.
for (const [x, y] of [[458, 249], [459, 250], [467, 265], [451, 281]]) {
    const f = flagsAt(ml, x, y);
    if (f === null || (f & BLOCKED) !== 0) {
        errors.push(`middleland (${x},${y}) blocked or OOB (flags=${f})`);
    }
}

const worlds = JSON.parse(fs.readFileSync(gameWorldsPath, 'utf8'));
const byId = new Map(worlds.map((w) => [w.id, w]));
const amdCache = new Map();
const amdFor = (name) => {
    if (!amdCache.has(name)) {
        amdCache.set(name, parseAmd(name));
    }
    return amdCache.get(name);
};

for (const world of worlds) {
    const map = amdFor(world.map);
    for (const t of world.teleportLocs ?? []) {
        for (const loc of t.locs ?? []) {
            const f = flagsAt(map, loc.x, loc.y);
            if (f === null || (f & BLOCKED) !== 0) {
                errors.push(`${world.id} trigger (${loc.x},${loc.y}) not walkable`);
            }
        }
        const dest = byId.get(t.target?.worldId);
        if (!dest) {
            continue;
        }
        const f = flagsAt(amdFor(dest.map), t.target.loc.x, t.target.loc.y);
        if (f === null || (f & BLOCKED) !== 0) {
            errors.push(`${world.id} landing ${t.target.worldId} (${t.target.loc.x},${t.target.loc.y}) not walkable`);
        }
    }
}

if (!byId.has('elvbrk21') || !byId.has('elvbrk22')) {
    errors.push('missing elvbrk21/elvbrk22 worlds');
}

if (errors.length) {
    console.error('assert-map-walkability FAILED:');
    for (const e of errors) {
        console.error('  ', e);
    }
    process.exit(1);
}
console.log('assert-map-walkability OK (IB causeway + GameWorlds pads walkable)');
