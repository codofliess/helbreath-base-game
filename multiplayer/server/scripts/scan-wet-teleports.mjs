/**
 * Scan MapTeleportLocs + GameWorlds.json for teleport trigger/landing cells on water/shore (sprite 18/19).
 * Usage: node multiplayer/server/scripts/scan-wet-teleports.mjs [--fix]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const mapsDir = path.join(__dirname, '..', 'Config', 'maps');
const teleportLocsPath = path.join(root, 'sp-client', 'src', 'constants', 'MapTeleportLocs.ts');
const gameWorldsPath = path.join(__dirname, '..', 'Config', 'GameWorlds.json');
const doFix = process.argv.includes('--fix');

const WATER = 19;
const SHORE = 18;

/** @type {Map<string, {sizeX:number,sizeY:number,tileSize:number,sprites:Int16Array}>} */
const mapCache = new Map();

function parseAmd(mapName) {
    if (mapCache.has(mapName)) return mapCache.get(mapName);
    const file = path.join(mapsDir, `${mapName}.amd`);
    if (!fs.existsSync(file)) {
        mapCache.set(mapName, null);
        return null;
    }
    const bytes = fs.readFileSync(file);
    const header = bytes.subarray(0, 256).toString('ascii').replace(/\0/g, ' ');
    const get = (k) => {
        const m = header.match(new RegExp(`${k}\\s*=\\s*(\\d+)`));
        return m ? Number(m[1]) : 0;
    };
    const sizeX = get('MAPSIZEX');
    const sizeY = get('MAPSIZEY');
    const tileSize = get('TILESIZE') || 10;
    const sprites = new Int16Array(sizeX * sizeY);
    const flags = new Uint8Array(sizeX * sizeY);
    let off = 256;
    for (let y = 0; y < sizeY; y++) {
        for (let x = 0; x < sizeX; x++) {
            sprites[y * sizeX + x] = bytes.readInt16LE(off);
            flags[y * sizeX + x] = bytes[off + 8];
            off += tileSize;
        }
    }
    const parsed = { sizeX, sizeY, tileSize, sprites, flags };
    mapCache.set(mapName, parsed);
    return parsed;
}

function isWet(mapName, x, y) {
    const m = parseAmd(mapName);
    if (!m) return { wet: false, missing: true, sprite: null, tele: false };
    if (x < 0 || y < 0 || x >= m.sizeX || y >= m.sizeY) {
        return { wet: false, missing: false, oob: true, sprite: null, tele: false };
    }
    const sprite = m.sprites[y * m.sizeX + x];
    const tele = (m.flags[y * m.sizeX + x] & 0x40) !== 0;
    return { wet: sprite === WATER || sprite === SHORE, missing: false, sprite, tele };
}

function loadTsConstArray(filePath, exportName) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const marker = `export const ${exportName} = `;
    const start = raw.indexOf(marker);
    if (start < 0) throw new Error(`Missing ${exportName}`);
    const slice = raw.slice(start + marker.length);
    const end = slice.indexOf('] as const');
    if (end < 0) throw new Error(`Missing ] as const for ${exportName}`);
    return { raw, start: start + marker.length, end: start + marker.length + end + 1, data: JSON.parse(slice.slice(0, end + 1)) };
}

function cellWet(mapId, x, y) {
    return isWet(mapId, x, y);
}

function analyzeZones(zones, kind) {
    const hits = [];
    for (let zi = 0; zi < zones.length; zi++) {
        const z = zones[zi];
        const mapId = z.mapId;
        const targetMap = z.targetMap;
        const wetTriggers = [];
        for (const [x, y] of z.locs ?? []) {
            const info = cellWet(mapId, x, y);
            if (info.wet) wetTriggers.push({ x, y, sprite: info.sprite });
        }
        // MapTeleportLocs uses targetX/targetY; some older drafts used target:[x,y].
        const tx = z.targetX ?? z.target?.[0];
        const ty = z.targetY ?? z.target?.[1];
        let wetLanding = null;
        let teleLanding = null;
        if (typeof tx === 'number' && typeof ty === 'number' && targetMap) {
            const info = cellWet(targetMap, tx, ty);
            if (info.wet) wetLanding = { x: tx, y: ty, sprite: info.sprite, map: targetMap };
            if (info.tele) teleLanding = { x: tx, y: ty, map: targetMap };
        }
        if (wetTriggers.length || wetLanding || teleLanding) {
            hits.push({ kind, index: zi, mapId, targetMap, wetTriggers, wetLanding, teleLanding, zone: z });
        }
    }
    return hits;
}

function analyzeGameWorlds(worlds) {
    const hits = [];
    for (const world of worlds) {
        const mapName = world.map;
        const teleports = world.teleportLocs ?? [];
        for (let ti = 0; ti < teleports.length; ti++) {
            const t = teleports[ti];
            const wetTriggers = [];
            for (const loc of t.locs ?? []) {
                const info = cellWet(mapName, loc.x, loc.y);
                if (info.wet) wetTriggers.push({ ...loc, sprite: info.sprite });
            }
            let wetLanding = null;
            const targetWorldId = t.target?.worldId;
            const targetLoc = t.target?.loc;
            if (targetWorldId && targetLoc) {
                const targetWorld = worlds.find((w) => w.id === targetWorldId);
                const targetMap = targetWorld?.map ?? targetWorldId;
                const info = cellWet(targetMap, targetLoc.x, targetLoc.y);
                if (info.wet) {
                    wetLanding = { ...targetLoc, sprite: info.sprite, map: targetMap, worldId: targetWorldId };
                }
            }
            if (wetTriggers.length || wetLanding) {
                hits.push({
                    kind: 'GameWorlds',
                    worldId: world.id,
                    map: mapName,
                    teleportIndex: ti,
                    wetTriggers,
                    wetLanding,
                });
            }
        }
    }
    return hits;
}

/** Prefer inland dry grass for traveler default hub probe. */
function probeHub() {
    const m = parseAmd('default');
    const candidates = [
        [90, 80],
        [85, 75],
        [95, 85],
        [80, 70],
        [100, 80],
        [90, 70],
        [70, 70],
        [64, 64],
        [100, 100],
    ];
    for (const [x, y] of candidates) {
        const info = isWet('default', x, y);
        console.log(`hub probe (${x},${y}): sprite=${info.sprite} ${info.wet ? 'WET' : 'dry'}`);
    }
    if (m) {
        const cx = Math.floor(m.sizeX / 2);
        const cy = Math.floor(m.sizeY / 2);
        const info = isWet('default', cx, cy);
        console.log(`map center (${cx},${cy}): sprite=${info.sprite} ${info.wet ? 'WET' : 'dry'} size=${m.sizeX}x${m.sizeY}`);
    }
}

probeHub();

const mapZones = loadTsConstArray(teleportLocsPath, 'MAP_TELEPORT_ZONES');
const interiorZones = loadTsConstArray(teleportLocsPath, 'INTERIOR_EXIT_ZONES');
const mapHits = analyzeZones(mapZones.data, 'MAP_TELEPORT_ZONES');
const interiorHits = analyzeZones(interiorZones.data, 'INTERIOR_EXIT_ZONES');
const worlds = JSON.parse(fs.readFileSync(gameWorldsPath, 'utf8'));
const gwHits = analyzeGameWorlds(worlds);

console.log(`\nWet/tele-pad MAP_TELEPORT_ZONES: ${mapHits.length}`);
for (const h of mapHits.slice(0, 40)) {
    console.log(
        `  [${h.index}] ${h.mapId} -> ${h.targetMap} triggers=${h.wetTriggers.length}` +
            ` landing=${h.wetLanding ? `${h.wetLanding.map}(${h.wetLanding.x},${h.wetLanding.y}) spr${h.wetLanding.sprite}` : 'ok'}` +
            ` telePad=${h.teleLanding ? `(${h.teleLanding.x},${h.teleLanding.y})` : 'ok'}`,
    );
}
console.log(`Wet INTERIOR_EXIT_ZONES: ${interiorHits.length}`);
for (const h of interiorHits.slice(0, 20)) {
    console.log(
        `  [${h.index}] ${h.mapId} -> ${h.targetMap} triggers=${h.wetTriggers.length} landing=${h.wetLanding ? 'WET' : 'ok'}`,
    );
}
console.log(`Wet GameWorlds teleports: ${gwHits.length}`);
for (const h of gwHits.slice(0, 40)) {
    console.log(
        `  ${h.worldId}#${h.teleportIndex} triggers=${h.wetTriggers.length} landing=${h.wetLanding ? `${h.wetLanding.worldId}(${h.wetLanding.x},${h.wetLanding.y})` : 'ok'}`,
    );
}

function findNearestDry(mapName, sx, sy, maxR = 40) {
    const m = parseAmd(mapName);
    if (!m) return null;
    for (let r = 0; r <= maxR; r++) {
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                const x = sx + dx;
                const y = sy + dy;
                if (x < 0 || y < 0 || x >= m.sizeX || y >= m.sizeY) continue;
                const sprite = m.sprites[y * m.sizeX + x];
                const tele = (m.flags[y * m.sizeX + x] & 0x40) !== 0;
                if (sprite !== WATER && sprite !== SHORE && !tele) {
                    return { x, y };
                }
            }
        }
    }
    return null;
}

if (doFix) {
    // Remove zones whose ALL triggers are wet, or strip wet trigger cells; move wet landings inland.
    const stripZones = (zones, hits) => {
        const removeIdx = new Set();
        for (const h of hits) {
            const z = zones[h.index];
            if (!z) continue;
            if (h.wetLanding || h.teleLanding) {
                const bad = h.wetLanding || h.teleLanding;
                const dry = findNearestDry(bad.map, bad.x, bad.y);
                if (dry) {
                    z.targetX = dry.x;
                    z.targetY = dry.y;
                    delete z.target;
                    console.log(`Moved landing ${h.mapId}->${h.targetMap} (${bad.x},${bad.y}) -> (${dry.x},${dry.y})`);
                } else {
                    removeIdx.add(h.index);
                    console.log(`Remove zone (no dry landing): ${h.mapId}->${h.targetMap}`);
                    continue;
                }
            }
            if (h.wetTriggers.length) {
                const wetSet = new Set(h.wetTriggers.map((c) => `${c.x},${c.y}`));
                const kept = (z.locs ?? []).filter(([x, y]) => !wetSet.has(`${x},${y}`));
                if (kept.length === 0) {
                    removeIdx.add(h.index);
                    console.log(`Remove zone (all triggers wet): ${h.mapId}->${h.targetMap}`);
                } else {
                    z.locs = kept;
                    console.log(`Stripped ${h.wetTriggers.length} wet triggers from ${h.mapId}->${h.targetMap}, kept ${kept.length}`);
                }
            }
        }
        return zones.filter((_, i) => !removeIdx.has(i));
    };

    const newMapZones = stripZones([...mapZones.data], mapHits);
    const newInterior = stripZones([...interiorZones.data], interiorHits);

    // Rewrite TS arrays preserving surrounding file.
    let ts = fs.readFileSync(teleportLocsPath, 'utf8');
    const replaceExport = (exportName, arr) => {
        const marker = `export const ${exportName} = `;
        const start = ts.indexOf(marker);
        const sliceStart = start + marker.length;
        const endRel = ts.slice(sliceStart).indexOf('] as const');
        const end = sliceStart + endRel + 1;
        const json = JSON.stringify(arr, null, 4)
            .replace(/"([^"]+)":/g, '"$1":')
            .replace(/\n/g, '\n');
        // Keep style similar: double quotes already from JSON.stringify
        ts = ts.slice(0, sliceStart) + json + ' as const' + ts.slice(end + ' as const'.length);
    };
    replaceExport('MAP_TELEPORT_ZONES', newMapZones);
    replaceExport('INTERIOR_EXIT_ZONES', newInterior);
    fs.writeFileSync(teleportLocsPath, ts);
    console.log('Wrote MapTeleportLocs.ts');

    // Fix GameWorlds: strip wet trigger locs; move wet landings; drop empty teleports.
    for (const h of gwHits) {
        const world = worlds.find((w) => w.id === h.worldId);
        if (!world?.teleportLocs?.[h.teleportIndex]) continue;
        const t = world.teleportLocs[h.teleportIndex];
        if (h.wetLanding) {
            const dry = findNearestDry(h.wetLanding.map, h.wetLanding.x, h.wetLanding.y);
            if (dry) {
                t.target.loc = { x: dry.x, y: dry.y };
                console.log(`GW moved landing ${h.worldId}#${h.teleportIndex} -> (${dry.x},${dry.y})`);
            }
        }
        if (h.wetTriggers.length) {
            const wetSet = new Set(h.wetTriggers.map((c) => `${c.x},${c.y}`));
            t.locs = (t.locs ?? []).filter((loc) => !wetSet.has(`${loc.x},${loc.y}`));
            console.log(`GW stripped wet triggers ${h.worldId}#${h.teleportIndex}, kept ${t.locs.length}`);
        }
    }
    for (const world of worlds) {
        if (!world.teleportLocs) continue;
        world.teleportLocs = world.teleportLocs.filter((t) => (t.locs?.length ?? 0) > 0);
    }
    fs.writeFileSync(gameWorldsPath, JSON.stringify(worlds, null, 2) + '\n');
    console.log('Wrote GameWorlds.json');
}

console.log(doFix ? '\nDone (--fix).' : '\nDry-run only. Re-run with --fix to apply.');
