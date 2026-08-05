/**
 * Cross-validates the teleport pipeline end to end:
 *   1. MapTeleportLocs.ts destinations land on walkable, non-teleport tiles.
 *   2. Arrival points are not adjacent to a warp cluster (instant re-warp risk).
 *   3. Client zones and server GameWorlds.json teleportLocs agree (cells + targets).
 *   4. Every client target map resolves to a server world id (resolver coverage).
 *
 * Usage: node scripts/validate-teleports.mjs   (from sp-client/)
 */
import fs from 'fs';
import path from 'path';

const mapsDir = 'public/assets/maps';
const teleportLocsPath = 'src/constants/MapTeleportLocs.ts';
const gameWorldsPath = '../multiplayer/server/Config/GameWorlds.json';

// --- .amd helpers (same layout as gen-teleport-zones.mjs) ---

function loadAmd(filePath) {
    const buf = fs.readFileSync(filePath);
    const headerText = new TextDecoder('ascii').decode(buf.subarray(0, 256)).replace(/\0/g, ' ');
    const tokens = headerText.split(/\s+/).filter((t) => t.length > 0);
    let sizeX = 0, sizeY = 0, tileSize = 0;
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === 'MAPSIZEX' && i + 2 < tokens.length) sizeX = parseInt(tokens[i + 2], 10);
        if (tokens[i] === 'MAPSIZEY' && i + 2 < tokens.length) sizeY = parseInt(tokens[i + 2], 10);
        if (tokens[i] === 'TILESIZE' && i + 2 < tokens.length) tileSize = parseInt(tokens[i + 2], 10);
    }
    return { buf, sizeX, sizeY, tileSize, offset: 256 };
}

function getTileFlags(amd, x, y) {
    if (x < 0 || y < 0 || x >= amd.sizeX || y >= amd.sizeY) return { isMoveAllowed: false, isTeleport: false, isWet: true };
    const tileOffset = amd.offset + (y * amd.sizeX + x) * amd.tileSize;
    const sprite = amd.buf.readInt16LE(tileOffset);
    const flags = amd.buf[tileOffset + 8];
    const isWet = sprite === 18 || sprite === 19;
    return {
        isMoveAllowed: (flags & 0x80) === 0 && !isWet,
        isTeleport: (flags & 0x40) !== 0,
        isWet,
    };
}

const amdCache = new Map();
function getAmd(mapId) {
    if (!amdCache.has(mapId)) {
        const p = path.join(mapsDir, `${mapId}.amd`);
        amdCache.set(mapId, fs.existsSync(p) ? loadAmd(p) : null);
    }
    return amdCache.get(mapId);
}

// --- Load client data by extracting the JSON literals from MapTeleportLocs.ts ---

function extractArrayLiteral(source, exportName) {
    const marker = `export const ${exportName} = `;
    const start = source.indexOf(marker);
    if (start === -1) throw new Error(`Export not found: ${exportName}`);
    const jsonStart = start + marker.length;
    const end = source.indexOf(' as const;', jsonStart);
    return JSON.parse(source.slice(jsonStart, end));
}

const tsSource = fs.readFileSync(teleportLocsPath, 'utf8');
const MAP_TELEPORT_ZONES = extractArrayLiteral(tsSource, 'MAP_TELEPORT_ZONES');
const INTERIOR_EXIT_ZONES = extractArrayLiteral(tsSource, 'INTERIOR_EXIT_ZONES');
const gameWorlds = JSON.parse(fs.readFileSync(gameWorldsPath, 'utf8'));

// --- Replicate OlympiaTeleportResolver world-id mapping ---

const INTERIOR_TARGETS = {
    aresden: { gshop_1: 'areshop', bsmith_1: 'arebsmith', gldhall_1: 'aregldhall', cityhall_1: 'arecityhall', wrhus_1: 'arewrus', arewrhus: 'arewrhus', cmdhall_1: 'arecmdhall', cath_1: 'arecath', wzdtwr_1: 'arewzdtwr' },
    elvine: { gshop_1: 'elvshop', bsmith_1: 'elvbsmith', gldhall_1: 'elvgldhall', cityhall_1: 'elvcityhall', wrhus_1: 'elvwrus', elvwrhus: 'elvwrhus', cmdhall_1: 'elvcmdhall', cath_1: 'elvcath', wzdtwr_1: 'elvwzdtwr' },
};
const DIRECT_TARGET_WORLD = {
    default: 'traveler', middleland: 'middleland', '2ndmiddle': 'promiseland', aresden: 'aresden', elvine: 'elvine',
    middled1x: 'middled1x', middled1n: 'middled1n', aresdend1: 'aresdend1', elvined1: 'elvined1', arefarm: 'arefarm',
    elvfarm: 'elvfarm', areuni: 'areuni', elvuni: 'elvuni', arebrk11: 'arebrk11', elvbrk11: 'elvbrk11', arejail: 'arejail', elvjail: 'elvjail',
    huntzone1: 'huntzone1', huntzone2: 'huntzone2', huntzone3: 'huntzone3', huntzone4: 'huntzone4',
    toh1: 'toh1', toh2: 'toh2', icebound: 'icebound', arewrhus: 'arewrhus', elvwrhus: 'elvwrhus',
};

function resolveWorldId(sourceMapId, targetMap) {
    if (sourceMapId === 'aresden' || sourceMapId === 'arewrhus') {
        return INTERIOR_TARGETS.aresden[targetMap] ?? DIRECT_TARGET_WORLD[targetMap] ?? null;
    }
    if (sourceMapId === 'elvine' || sourceMapId === 'elvwrhus') {
        return INTERIOR_TARGETS.elvine[targetMap] ?? DIRECT_TARGET_WORLD[targetMap] ?? null;
    }
    return DIRECT_TARGET_WORLD[targetMap] ?? targetMap;
}

const worldsById = new Map(gameWorlds.map((w) => [w.id, w]));
const worldMapName = (w) => (w.map ?? '').replace(/\.amd$/i, '');

// Teleport source cells per destination map (for re-warp adjacency check).
const warpCellsByMap = new Map();
function warpCellsOf(mapId) {
    if (!warpCellsByMap.has(mapId)) {
        const amd = getAmd(mapId);
        const cells = new Set();
        if (amd) {
            for (let y = 0; y < amd.sizeY; y++) {
                for (let x = 0; x < amd.sizeX; x++) {
                    if (getTileFlags(amd, x, y).isTeleport) cells.add(`${x},${y}`);
                }
            }
        }
        warpCellsByMap.set(mapId, cells);
    }
    return warpCellsByMap.get(mapId);
}

function distanceToNearestWarp(mapId, x, y) {
    let best = Infinity;
    for (const key of warpCellsOf(mapId)) {
        const [wx, wy] = key.split(',').map(Number);
        best = Math.min(best, Math.max(Math.abs(wx - x), Math.abs(wy - y)));
    }
    return best;
}

const errors = [];
const warnings = [];

function checkArrival(context, targetMap, x, y) {
    const amd = getAmd(targetMap);
    if (!amd) {
        errors.push(`${context}: target map '${targetMap}' has no .amd file`);
        return;
    }
    const tile = getTileFlags(amd, x, y);
    if (tile.isWet) errors.push(`${context}: arrival (${x},${y}) in '${targetMap}' is WET (shore/water sprite)`);
    if (!tile.isMoveAllowed) errors.push(`${context}: arrival (${x},${y}) in '${targetMap}' is NOT walkable`);
    if (tile.isTeleport) errors.push(`${context}: arrival (${x},${y}) in '${targetMap}' IS a teleport tile (instant re-warp / blue pad)`);
    else {
        const d = distanceToNearestWarp(targetMap, x, y);
        if (d <= 1) warnings.push(`${context}: arrival (${x},${y}) in '${targetMap}' is adjacent (d=${d}) to a warp tile (one step re-warps)`);
    }
}

// --- 1+2: client data arrival checks ---

for (const zone of MAP_TELEPORT_ZONES) {
    checkArrival(`ZONE ${zone.mapId}(${zone.locs[0]}) → ${zone.targetMap}`, zone.targetMap, zone.targetX, zone.targetY);
}
for (const zone of INTERIOR_EXIT_ZONES) {
    for (const [town, [targetMap, x, y]] of Object.entries(zone.exitsByTown)) {
        checkArrival(`EXIT ${zone.mapId} → ${town}`, targetMap, x, y);
    }
}

// --- 4: resolver coverage (every zone must resolve to an existing world) ---

const sourceWorldsForMap = {
    default: ['traveler'],
    aresden: ['aresden'], elvine: ['elvine'], middleland: ['middleland'], '2ndmiddle': ['promiseland'],
    arefarm: ['arefarm'], elvfarm: ['elvfarm'], aresdend1: ['aresdend1'], elvined1: ['elvined1'],
    huntzone1: ['huntzone1'], huntzone2: ['huntzone2'], huntzone3: ['huntzone3'], huntzone4: ['huntzone4'],
    middled1x: ['middled1x'], middled1n: ['middled1n'], toh1: ['toh1'], toh2: ['toh2'], icebound: ['icebound'],
    areuni: ['areuni'], elvuni: ['elvuni'], arebrk11: ['arebrk11'], elvbrk11: ['elvbrk11'],
    arewrhus: ['arewrhus'], elvwrhus: ['elvwrhus'],
};

for (const zone of MAP_TELEPORT_ZONES) {
    const worldId = resolveWorldId(zone.mapId, zone.targetMap);
    if (!worldId) {
        errors.push(`RESOLVER ${zone.mapId}(${zone.locs[0]}) → '${zone.targetMap}': no world id mapping (warp silently fails)`);
        continue;
    }
    if (!worldsById.has(worldId)) {
        errors.push(`RESOLVER ${zone.mapId} → '${zone.targetMap}' resolves to world '${worldId}' which does NOT exist in GameWorlds.json`);
    }
}

// --- 3: client vs server consistency ---

function serverTeleportIndex(world) {
    const index = new Map();
    for (const set of world.teleportLocs ?? []) {
        for (const loc of set.locs) {
            index.set(`${loc.x},${loc.y}`, set.target);
        }
    }
    return index;
}

for (const [mapId, worldIds] of Object.entries(sourceWorldsForMap)) {
    for (const worldId of worldIds) {
        const world = worldsById.get(worldId);
        if (!world) { errors.push(`SYNC: source world '${worldId}' missing in GameWorlds.json`); continue; }
        const index = serverTeleportIndex(world);
        for (const zone of MAP_TELEPORT_ZONES.filter((z) => z.mapId === mapId)) {
            const expectedWorld = resolveWorldId(zone.mapId, zone.targetMap);
            for (const [x, y] of zone.locs) {
                const target = index.get(`${x},${y}`);
                if (!target) {
                    errors.push(`SYNC ${worldId}(${x},${y}): cell in client data but MISSING in server teleportLocs`);
                } else {
                    if (expectedWorld && target.worldId !== expectedWorld) {
                        errors.push(`SYNC ${worldId}(${x},${y}): client → '${expectedWorld}' but server → '${target.worldId}'`);
                    }
                    if (target.loc.x !== zone.targetX || target.loc.y !== zone.targetY) {
                        warnings.push(`SYNC ${worldId}(${x},${y}): arrival differs client(${zone.targetX},${zone.targetY}) vs server(${target.loc.x},${target.loc.y})`);
                    }
                }
            }
        }
    }
}

// Interior worlds: every interior exit cell must exist server-side with the right town exit.
const interiorWorldsByMap = {
    cityhall_1: ['arecityhall', 'elvcityhall'], gldhall_1: ['aregldhall', 'elvgldhall'],
    gshop_1: ['areshop', 'elvshop'], bsmith_1: ['arebsmith', 'elvbsmith'],
    wrhus_1: ['arewrus', 'elvwrus'], cmdhall_1: ['arecmdhall', 'elvcmdhall'],
    cath_1: ['arecath', 'elvcath'], wzdtwr_1: ['arewzdtwr', 'elvwzdtwr'],
};

for (const zone of INTERIOR_EXIT_ZONES) {
    for (const worldId of interiorWorldsByMap[zone.mapId] ?? []) {
        const world = worldsById.get(worldId);
        if (!world) { errors.push(`SYNC: interior world '${worldId}' missing in GameWorlds.json`); continue; }
        const town = worldId.startsWith('are') ? 'aresden' : 'elvine';
        const expected = zone.exitsByTown[town];
        if (!expected) { errors.push(`DATA ${zone.mapId}: no exitsByTown['${town}'] entry`); continue; }
        const [targetMap, ex, ey] = expected;
        const expectedWorld = DIRECT_TARGET_WORLD[targetMap] ?? targetMap;
        const index = serverTeleportIndex(world);
        for (const [x, y] of zone.locs) {
            const target = index.get(`${x},${y}`);
            if (!target) {
                errors.push(`SYNC ${worldId}(${x},${y}): exit cell in client data but MISSING in server teleportLocs`);
            } else {
                if (target.worldId !== expectedWorld) {
                    errors.push(`SYNC ${worldId}(${x},${y}): client exit → '${expectedWorld}' but server → '${target.worldId}'`);
                }
                if (target.loc.x !== ex || target.loc.y !== ey) {
                    warnings.push(`SYNC ${worldId}(${x},${y}): exit arrival differs client(${ex},${ey}) vs server(${target.loc.x},${target.loc.y})`);
                }
            }
        }
    }
}

// Reverse: server cells that the client does not know (warp would be server-valid but client never triggers it).
const clientCells = new Set();
for (const zone of MAP_TELEPORT_ZONES) {
    for (const worldId of sourceWorldsForMap[zone.mapId] ?? []) {
        for (const [x, y] of zone.locs) clientCells.add(`${worldId}:${x},${y}`);
    }
}
for (const zone of INTERIOR_EXIT_ZONES) {
    for (const worldId of interiorWorldsByMap[zone.mapId] ?? []) {
        for (const [x, y] of zone.locs) clientCells.add(`${worldId}:${x},${y}`);
    }
}
for (const world of gameWorlds) {
    for (const set of world.teleportLocs ?? []) {
        for (const loc of set.locs) {
            if (!clientCells.has(`${world.id}:${loc.x},${loc.y}`)) {
                warnings.push(`SYNC ${world.id}(${loc.x},${loc.y}): server cell unknown to client (client never triggers this warp)`);
            }
        }
    }
}

// --- Report ---

console.log(`\nChecked ${MAP_TELEPORT_ZONES.length} outdoor zones, ${INTERIOR_EXIT_ZONES.length} interior exit groups, ${gameWorlds.length} worlds.\n`);
if (errors.length) {
    console.log(`ERRORS (${errors.length}):`);
    for (const e of errors) console.log('  ✗ ' + e);
}
if (warnings.length) {
    console.log(`\nWARNINGS (${warnings.length}):`);
    for (const w of warnings) console.log('  ! ' + w);
}
if (!errors.length && !warnings.length) console.log('All teleport data consistent.');
process.exit(errors.length ? 1 : 0);
