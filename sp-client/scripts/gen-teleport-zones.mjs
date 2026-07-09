/** Generates MapTeleportLocs zone data from .amd teleport clusters. */
import fs from 'fs';
import path from 'path';

const mapsDir = 'public/assets/maps';

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
    const tileOffset = amd.offset + (y * amd.sizeX + x) * amd.tileSize;
    const flags = amd.buf[tileOffset + 8];
    return {
        isMoveAllowed: (flags & 0x80) === 0,
        isTeleport: (flags & 0x40) !== 0,
    };
}

function parseAmd(filePath) {
    const amd = loadAmd(filePath);
    const teleports = [];
    for (let y = 0; y < amd.sizeY; y++) {
        for (let x = 0; x < amd.sizeX; x++) {
            if (getTileFlags(amd, x, y).isTeleport) teleports.push([x, y]);
        }
    }
    return teleports;
}

function findSafeSpawnNearDoor(amd, doorTiles, maxRadius = 12) {
    if (doorTiles.length === 0) return undefined;
    const doorX = Math.round(doorTiles.reduce((s, [x]) => s + x, 0) / doorTiles.length);
    const doorY = Math.round(doorTiles.reduce((s, [, y]) => s + y, 0) / doorTiles.length);
    const doorSet = new Set(doorTiles.map(([x, y]) => `${x},${y}`));
    const visited = new Set();
    const queue = doorTiles.map(([x, y]) => ({ x, y, dist: 0 }));
    for (const cell of queue) visited.add(`${cell.x},${cell.y}`);

    let best;
    while (queue.length) {
        const current = queue.shift();
        if (current.dist > maxRadius) continue;
        const tile = getTileFlags(amd, current.x, current.y);
        if (tile.isMoveAllowed && !tile.isTeleport) {
            const score = Math.max(Math.abs(current.x - doorX), Math.abs(current.y - doorY));
            if (!best || score < best.score) best = { x: current.x, y: current.y, score };
            if (score <= 1) return { x: current.x, y: current.y };
        }
        if (doorSet.has(`${current.x},${current.y}`) || tile.isMoveAllowed) {
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
                const nx = current.x + dx;
                const ny = current.y + dy;
                const key = `${nx},${ny}`;
                if (nx < 0 || ny < 0 || nx >= amd.sizeX || ny >= amd.sizeY || visited.has(key)) continue;
                visited.add(key);
                queue.push({ x: nx, y: ny, dist: current.dist + 1 });
            }
        }
    }
    return best ? { x: best.x, y: best.y } : undefined;
}

function cluster(cells) {
    const set = new Set(cells.map(([x, y]) => `${x},${y}`));
    const visited = new Set();
    const clusters = [];
    for (const [x, y] of cells) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        const queue = [[x, y]];
        const group = [];
        visited.add(key);
        while (queue.length) {
            const [cx, cy] = queue.shift();
            group.push([cx, cy]);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nk = `${cx + dx},${cy + dy}`;
                if (set.has(nk) && !visited.has(nk)) {
                    visited.add(nk);
                    queue.push([cx + dx, cy + dy]);
                }
            }
        }
        clusters.push(group);
    }
    return clusters;
}

/** Manual destination map keyed by "mapId:centerX,centerY" from cluster centroid. */
const DEST_BY_CLUSTER = {
    // === Aresden buildings (outdoor -> interior) ===
    'aresden:186,93': ['cath_1', 37, 39],
    'aresden:113,97': ['gshop_1', 50, 37],
    'aresden:57,117': ['gldhall_1', 60, 43],
    'aresden:56,118': ['gldhall_1', 60, 43],
    'aresden:145,123': ['2ndmiddle', 141, 227],
    'aresden:136,129': ['cityhall_1', 59, 42],
    'aresden:102,159': ['bsmith_1', 44, 30],
    'aresden:95,161': ['bsmith_1', 44, 30],
    'aresden:131,166': ['wrhus_1', 54, 34],
    'aresden:126,167': ['wrhus_1', 54, 34],
    'aresden:130,167': ['wrhus_1', 54, 34],
    'aresden:168,195': ['wzdtwr_1', 41, 33],
    'aresden:157,201': ['cmdhall_1', 50, 48],
    'aresden:218,133': ['aresdend1', 37, 33],
    'aresden:223,134': ['arebrk11', 104, 36],
    'aresden:102,184': ['arefarm', 60, 70],
    'aresden:107,185': ['arefarm', 60, 70],
    'aresden:31,20': ['middleland', 315, 20],
    'aresden:262,20': ['middleland', 103, 20],
    'aresden:33,279': ['middleland', 153, 503],
    'aresden:279,207': ['middleland', 350, 503],
    'aresden:79,210': ['middleland', 382, 284],

    // === Elvine buildings ===
    'elvine:132,77': ['gshop_1', 50, 37],
    'elvine:181,77': ['cath_1', 37, 39],
    'elvine:259,82': ['wzdtwr_1', 41, 33],
    'elvine:221,87': ['cmdhall_1', 50, 48],
    'elvine:214,89': ['elvjail', 43, 30],
    'elvine:240,107': ['bsmith_1', 44, 30],
    'elvine:229,113': ['elvined1', 37, 33],
    'elvine:145,127': ['2ndmiddle', 141, 227],
    'elvine:198,128': ['elvuni', 176, 24],
    'elvine:203,129': ['elvbrk11', 104, 36],
    'elvine:136,133': ['cityhall_1', 59, 42],
    'elvine:77,141': ['gldhall_1', 60, 43],
    'elvine:230,151': ['wrhus_1', 54, 34],
    'elvine:225,152': ['wrhus_1', 54, 34],
    'elvine:226,152': ['wrhus_1', 54, 34],
    'elvine:229,152': ['wrhus_1', 54, 34],
    'elvine:88,175': ['elvfarm', 88, 179],
    'elvine:93,176': ['elvfarm', 88, 179],
    'elvine:224,20': ['middleland', 103, 20],
    'elvine:277,196': ['middleland', 315, 20],
    'elvine:254,274': ['middleland', 153, 503],
    'elvine:24,277': ['middleland', 350, 503],

    // === Middleland gates ===
    'middleland:103,20': ['aresden', 262, 20],
    'middleland:315,20': ['aresden', 31, 20],
    'middleland:200,235': ['middled1x', 100, 50],
    'middleland:453,282': ['elvine', 277, 196],
    'middleland:382,284': ['aresden', 79, 210],
    'middleland:153,503': ['aresden', 33, 279],
    'middleland:350,503': ['aresden', 279, 207],

    // === Promise land ===
    '2ndmiddle:141,228': ['aresden', 145, 123],
    '2ndmiddle:126,21': ['middleland', 200, 235],
};

const TOWN_MAPS = new Set(['aresden', 'elvine', 'middleland', '2ndmiddle', 'arefarm', 'elvfarm', 'aresdend1', 'elvined1', 'areuni', 'elvuni', 'arebrk11', 'elvbrk11', 'arejail', 'elvjail', 'middled1x']);

const INTERIOR_MAPS = new Set(['cityhall_1', 'gldhall_1', 'gshop_1', 'bsmith_1', 'wrhus_1', 'cmdhall_1', 'cath_1', 'wzdtwr_1']);

const zones = [];

for (const [mapId, file] of Object.entries({
    aresden: 'aresden.amd',
    elvine: 'elvine.amd',
    middleland: 'middleland.amd',
    '2ndmiddle': '2ndmiddle.amd',
})) {
    const cells = parseAmd(path.join(mapsDir, file));
    for (const group of cluster(cells)) {
        const cx = Math.round(group.reduce((s, c) => s + c[0], 0) / group.length);
        const cy = Math.round(group.reduce((s, c) => s + c[1], 0) / group.length);
        const key = `${mapId}:${cx},${cy}`;
        const dest = DEST_BY_CLUSTER[key];
        if (!dest) {
            console.error('MISSING DEST', key, group);
            continue;
        }
        zones.push({ mapId, locs: group, targetMap: dest[0], targetX: dest[1], targetY: dest[2] });
    }
}

// Interior exit door cells — auto-detected from teleport clusters in each interior .amd
const interiorExitCells = {};
const interiorMainDoorCells = {};
for (const mapId of INTERIOR_MAPS) {
    const amdPath = path.join(mapsDir, `${mapId}.amd`);
    if (!fs.existsSync(amdPath)) {
        console.error('Missing interior map', amdPath);
        continue;
    }
    const cells = parseAmd(amdPath);
    const groups = cluster(cells).sort((a, b) => b.length - a.length);
    interiorExitCells[mapId] = cells;
    interiorMainDoorCells[mapId] = groups[0] ?? cells;
}

const interiorExitsByTown = {
    cityhall_1: { aresden: ['aresden', 136, 129], elvine: ['elvine', 136, 133] },
    gldhall_1: { aresden: ['aresden', 56, 118], elvine: ['elvine', 77, 141] },
    gshop_1: { aresden: ['aresden', 113, 97], elvine: ['elvine', 132, 77] },
    bsmith_1: { aresden: ['aresden', 102, 159], elvine: ['elvine', 240, 107] },
    wrhus_1: { aresden: ['aresden', 128, 167], elvine: ['elvine', 226, 152] },
    cmdhall_1: { aresden: ['aresden', 157, 201], elvine: ['elvine', 221, 87] },
    cath_1: { aresden: ['aresden', 186, 93], elvine: ['elvine', 181, 77] },
    wzdtwr_1: { aresden: ['aresden', 168, 195], elvine: ['elvine', 259, 82] },
};

// Patch outdoor->interior entry coords to safe spawns (not on blue warp tiles)
const interiorSafeSpawns = {};
for (const [mapId, doorCells] of Object.entries(interiorMainDoorCells)) {
    const amd = loadAmd(path.join(mapsDir, `${mapId}.amd`));
    const safe = findSafeSpawnNearDoor(amd, doorCells);
    if (safe) {
        interiorSafeSpawns[mapId] = safe;
        console.error(`[gen] ${mapId} safe entry spawn -> (${safe.x}, ${safe.y})`);
    }
}
for (const zone of zones) {
    if (INTERIOR_MAPS.has(zone.targetMap) && interiorSafeSpawns[zone.targetMap]) {
        zone.targetX = interiorSafeSpawns[zone.targetMap].x;
        zone.targetY = interiorSafeSpawns[zone.targetMap].y;
    }
}

// Lookup outdoor warp clusters by tile (for safe exit spawns)
const outdoorWarpClusters = new Map();
for (const zone of zones) {
    for (const [x, y] of zone.locs) {
        outdoorWarpClusters.set(`${zone.mapId}:${x}:${y}`, zone.locs);
    }
}

function getOutdoorWarpCluster(mapId, x, y) {
    return outdoorWarpClusters.get(`${mapId}:${x}:${y}`);
}

// Patch interior exit coords to safe outdoor spawns (just outside blue warp tiles)
const interiorExitZones = [];
for (const [mapId, cells] of Object.entries(interiorExitCells)) {
    const exitsByTown = {};
    for (const [town, [targetMap, x, y]] of Object.entries(interiorExitsByTown[mapId] ?? {})) {
        const cluster = getOutdoorWarpCluster(targetMap, x, y) ?? [[x, y]];
        const amdPath = path.join(mapsDir, `${targetMap}.amd`);
        const safe = fs.existsSync(amdPath)
            ? findSafeSpawnNearDoor(loadAmd(amdPath), cluster)
            : undefined;
        exitsByTown[town] = [targetMap, safe?.x ?? x, safe?.y ?? y];
        if (safe && (safe.x !== x || safe.y !== y)) {
            console.error(`[gen] ${mapId} exit → ${town} safe spawn (${safe.x}, ${safe.y}) was (${x}, ${y})`);
        }
    }
    interiorExitZones.push({ mapId, locs: cells, exitsByTown });
}

// Patch outdoor→outdoor / gate destinations that still land on warp tiles
for (const zone of zones) {
    const amdPath = path.join(mapsDir, `${zone.targetMap}.amd`);
    if (!fs.existsSync(amdPath)) continue;
    const amd = loadAmd(amdPath);
    const tile = getTileFlags(amd, zone.targetX, zone.targetY);
    if (!tile.isTeleport) continue;
    const cluster = getOutdoorWarpCluster(zone.targetMap, zone.targetX, zone.targetY) ?? [[zone.targetX, zone.targetY]];
    const safe = findSafeSpawnNearDoor(amd, cluster);
    if (safe) {
        console.error(`[gen] ${zone.mapId}→${zone.targetMap} safe spawn (${safe.x}, ${safe.y}) was (${zone.targetX}, ${zone.targetY})`);
        zone.targetX = safe.x;
        zone.targetY = safe.y;
    }
}

console.log('// AUTO-GENERATED ZONES');
console.log('export const MAP_TELEPORT_ZONES = ' + JSON.stringify(zones, null, 2) + ' as const;');
console.log('export const INTERIOR_EXIT_ZONES = ' + JSON.stringify(interiorExitZones, null, 2) + ' as const;');
console.log('export const TOWN_MAP_IDS = ' + JSON.stringify([...TOWN_MAPS]) + ' as const;');