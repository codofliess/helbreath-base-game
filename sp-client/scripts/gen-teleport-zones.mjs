/**
 * Generates MapTeleportLocs zone data from Helbreath MAPDATA teleport-loc files.
 *
 * Source of truth: tmp-mapdata/*.txt (from isolatorhk/Helbreath.ServerFiles HGServer/MAPDATA).
 * Shared multiplayer interiors (_1/_2) collapse to *_1 map ids; town affinity is preserved
 * via INTERIOR_EXIT_ZONES.exitsByTown and OlympiaTeleportResolver world mapping.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mapsDir = path.join(__dirname, '..', 'public', 'assets', 'maps');
const mapdataDir = path.join(__dirname, '..', 'reference', 'mapdata');
const legacyMapdataDir = path.join(__dirname, '..', '..', 'tmp-mapdata');
const resolvedMapdataDir = fs.existsSync(mapdataDir) ? mapdataDir : legacyMapdataDir;

/** Classic elvine interiors (*_2) share the aresden (*_1) map asset in our MP worlds. */
const SHARED_INTERIOR_NORMALIZE = {
    cityhall_2: 'cityhall_1',
    cath_2: 'cath_1',
    bsmith_2: 'bsmith_1',
    wrhus_2: 'wrhus_1',
    gldhall_2: 'gldhall_1',
    wzdtwr_2: 'wzdtwr_1',
    gshop_2: 'gshop_1',
    cmdhall_2: 'cmdhall_1',
};

const SHARED_INTERIOR_MAPS = new Set([
    'cityhall_1',
    'gldhall_1',
    'gshop_1',
    'bsmith_1',
    'wrhus_1',
    'cmdhall_1',
    'cath_1',
    'wzdtwr_1',
]);

/** Outdoor / dungeon maps whose teleport-loc rows become MAP_TELEPORT_ZONES. */
const OUTDOOR_SOURCE_MAPS = new Set([
    'aresden',
    'elvine',
    'middleland',
    '2ndmiddle',
    'arefarm',
    'elvfarm',
    'aresdend1',
    'elvined1',
    'huntzone1',
    'huntzone2',
    'huntzone3',
    'huntzone4',
    'middled1x',
    'middled1n',
    'toh1',
    'toh2',
    'icebound',
    'areuni',
    'elvuni',
    'arebrk11',
    'elvbrk11',
]);

/** Dest maps we intentionally skip (no world / farm-shop variants not wired yet). */
const SKIP_DEST_MAPS = new Set([
    'bsmith_1f',
    'bsmith_2f',
    'wrhus_1f',
    'wrhus_2f',
    'gshop_1f',
    'gshop_2f',
    'dglv2',
    'istfarm',
]);

const TOWN_MAPS = new Set([
    'aresden',
    'elvine',
    'middleland',
    '2ndmiddle',
    'arefarm',
    'elvfarm',
    'aresdend1',
    'elvined1',
    'areuni',
    'elvuni',
    'arebrk11',
    'elvbrk11',
    'arejail',
    'elvjail',
    'middled1x',
    'middled1n',
    'huntzone1',
    'huntzone2',
    'huntzone3',
    'huntzone4',
    'toh1',
    'toh2',
    'icebound',
    'arewrhus',
    'elvwrhus',
]);

function loadAmd(filePath) {
    const buf = fs.readFileSync(filePath);
    const headerText = new TextDecoder('ascii').decode(buf.subarray(0, 256)).replace(/\0/g, ' ');
    const tokens = headerText.split(/\s+/).filter((t) => t.length > 0);
    let sizeX = 0;
    let sizeY = 0;
    let tileSize = 0;
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === 'MAPSIZEX' && i + 2 < tokens.length) sizeX = parseInt(tokens[i + 2], 10);
        if (tokens[i] === 'MAPSIZEY' && i + 2 < tokens.length) sizeY = parseInt(tokens[i + 2], 10);
        if (tokens[i] === 'TILESIZE' && i + 2 < tokens.length) tileSize = parseInt(tokens[i + 2], 10);
    }
    return { buf, sizeX, sizeY, tileSize, offset: 256 };
}

function getTileFlags(amd, x, y) {
    if (x < 0 || y < 0 || x >= amd.sizeX || y >= amd.sizeY) {
        return { isMoveAllowed: false, isTeleport: false, isWet: true, sprite: -1 };
    }
    const tileOffset = amd.offset + (y * amd.sizeX + x) * amd.tileSize;
    const sprite = amd.buf.readInt16LE
        ? amd.buf.readInt16LE(tileOffset)
        : new DataView(amd.buf.buffer, amd.buf.byteOffset + tileOffset, 2).getInt16(0, true);
    const flags = amd.buf[tileOffset + 8];
    const isWet = sprite === 18 || sprite === 19;
    return {
        isMoveAllowed: (flags & 0x80) === 0 && !isWet,
        isTeleport: (flags & 0x40) !== 0,
        isWet,
        sprite,
    };
}

/** Prefer dry, non-tele, not adjacent to tele/wet — used when MAPDATA lands on a blue pad. */
function findSafeSpawnNearDoor(amd, doorTiles, maxRadius = 16) {
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
        let adjBad = false;
        for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [-1, 1],
            [1, -1],
            [-1, -1],
        ]) {
            const n = getTileFlags(amd, current.x + dx, current.y + dy);
            if (n.isTeleport || n.isWet) {
                adjBad = true;
                break;
            }
        }
        if (tile.isMoveAllowed && !tile.isTeleport && !tile.isWet && !adjBad) {
            const score = Math.max(Math.abs(current.x - doorX), Math.abs(current.y - doorY));
            if (!best || score < best.score) best = { x: current.x, y: current.y, score };
            if (score <= 2) return { x: current.x, y: current.y };
        }
        if (doorSet.has(`${current.x},${current.y}`) || tile.isMoveAllowed || tile.isTeleport) {
            for (const [dx, dy] of [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
                [1, 1],
                [-1, 1],
                [1, -1],
                [-1, -1],
            ]) {
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

function normalizeMapName(raw) {
    let id = String(raw).trim().toLowerCase();
    if (id === 'cmdhall_1' || id === 'cmdhall_2') {
        // already lowercased
    }
    id = SHARED_INTERIOR_NORMALIZE[id] ?? id;
    return id;
}

function parseTeleportLocFile(filePath, sourceMapId) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const rows = [];
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('/')) continue;
        if (!/^teleport-loc\b/i.test(trimmed)) continue;
        const parts = trimmed.split(/[=\s]+/).filter(Boolean);
        // ["teleport-loc", srcX, srcY, destMap, destX, destY, dir?]
        if (parts.length < 6) continue;
        const srcX = parseInt(parts[1], 10);
        const srcY = parseInt(parts[2], 10);
        const destMap = parts[3];
        const destX = parseInt(parts[4], 10);
        const destY = parseInt(parts[5], 10);
        if ([srcX, srcY, destX, destY].some((n) => Number.isNaN(n))) continue;
        // Classic random-spawn sentinel
        if (destX < 0 || destY < 0) continue;
        rows.push({
            sourceMapId,
            srcX,
            srcY,
            destMap: normalizeMapName(destMap),
            destX,
            destY,
        });
    }
    return rows;
}

function findMapdataFile(mapId) {
    const candidates = [
        `${mapId}.txt`,
        `${mapId}.TXT`,
        `${mapId.toUpperCase()}.txt`,
        mapId === 'cmdhall_1' ? 'CmdHall_1.txt' : null,
        mapId === 'cmdhall_2' ? 'CmdHall_2.txt' : null,
    ].filter(Boolean);
    for (const name of candidates) {
        const p = path.join(resolvedMapdataDir, name);
        if (fs.existsSync(p)) return p;
    }
    // Case-insensitive scan
    if (!fs.existsSync(resolvedMapdataDir)) return null;
    const lower = `${mapId}.txt`.toLowerCase();
    for (const name of fs.readdirSync(resolvedMapdataDir)) {
        if (name.toLowerCase() === lower) return path.join(resolvedMapdataDir, name);
    }
    return null;
}

if (!fs.existsSync(resolvedMapdataDir)) {
    console.error(`Missing MAPDATA dir: ${mapdataDir} (or ${legacyMapdataDir})`);
    process.exit(1);
}

const allRows = [];
for (const name of fs.readdirSync(resolvedMapdataDir)) {
    if (!/\.txt$/i.test(name)) continue;
    const base = name.replace(/\.txt$/i, '');
    // Keep original basename (cityhall_2, CmdHall_1 → cmdhall_1) for source affinity
    const srcId = /^cmdhall_/i.test(base) ? base.toLowerCase() : base.toLowerCase();
    const filePath = path.join(resolvedMapdataDir, name);
    allRows.push(...parseTeleportLocFile(filePath, srcId));
}

// --- Outdoor zones ---
const outdoorGroups = new Map();
const skipped = [];
for (const row of allRows) {
    if (!OUTDOOR_SOURCE_MAPS.has(row.sourceMapId)) continue;
    if (SKIP_DEST_MAPS.has(row.destMap)) {
        skipped.push(`${row.sourceMapId}(${row.srcX},${row.srcY})→${row.destMap}`);
        continue;
    }
    const key = `${row.sourceMapId}|${row.destMap}|${row.destX}|${row.destY}`;
    if (!outdoorGroups.has(key)) {
        outdoorGroups.set(key, {
            mapId: row.sourceMapId,
            locs: [],
            targetMap: row.destMap,
            targetX: row.destX,
            targetY: row.destY,
        });
    }
    outdoorGroups.get(key).locs.push([row.srcX, row.srcY]);
}

const zones = [...outdoorGroups.values()].map((z) => ({
    ...z,
    locs: [...new Map(z.locs.map(([x, y]) => [`${x},${y}`, [x, y]])).values()],
}));

// --- Interior exits (shared *_1 maps, exitsByTown from *_1 and *_2 MAPDATA) ---
const interiorExitCells = new Map(); // mapId -> Set of "x,y"
const interiorExitsByTown = new Map(); // mapId -> { aresden?: [map,x,y], elvine?: [map,x,y] }

function addInteriorExit(sharedMapId, town, destMap, destX, destY, cells) {
    if (!interiorExitCells.has(sharedMapId)) interiorExitCells.set(sharedMapId, new Set());
    for (const [x, y] of cells) interiorExitCells.get(sharedMapId).add(`${x},${y}`);

    if (!interiorExitsByTown.has(sharedMapId)) interiorExitsByTown.set(sharedMapId, {});
    const exits = interiorExitsByTown.get(sharedMapId);
    // Prefer first destination seen for this town (MAPDATA is consistent per town)
    if (!exits[town]) {
        exits[town] = [destMap, destX, destY];
    }
}

for (const shared of SHARED_INTERIOR_MAPS) {
    const suffix = shared.replace(/_1$/, '');
    for (const [variant, town] of [
        [`${suffix}_1`, 'aresden'],
        [`${suffix}_2`, 'elvine'],
    ]) {
        const filePath = findMapdataFile(variant === 'cmdhall_1' || variant === 'cmdhall_2' ? variant : variant);
        // CmdHall special-case already handled by findMapdataFile
        const resolved = findMapdataFile(variant);
        if (!resolved) {
            console.error(`[gen] missing interior MAPDATA ${variant}`);
            continue;
        }
        const rows = parseTeleportLocFile(resolved, variant);
        const byDest = new Map();
        for (const row of rows) {
            if (row.destMap !== town && row.destMap !== 'aresden' && row.destMap !== 'elvine') continue;
            const destTown = row.destMap === 'elvine' ? 'elvine' : 'aresden';
            const gkey = `${destTown}|${row.destX}|${row.destY}`;
            if (!byDest.has(gkey)) byDest.set(gkey, { town: destTown, destX: row.destX, destY: row.destY, cells: [] });
            byDest.get(gkey).cells.push([row.srcX, row.srcY]);
        }
        for (const group of byDest.values()) {
            addInteriorExit(shared, group.town, group.town, group.destX, group.destY, group.cells);
        }
    }
}

// arewrhus / elvwrhus are faction-specific warehouses (not shared)
for (const [mapId, town] of [
    ['arewrhus', 'aresden'],
    ['elvwrhus', 'elvine'],
]) {
    const resolved = findMapdataFile(mapId);
    if (!resolved) continue;
    const rows = parseTeleportLocFile(resolved, mapId);
    const cells = rows.filter((r) => r.destMap === town).map((r) => [r.srcX, r.srcY]);
    if (!cells.length) continue;
    const sample = rows.find((r) => r.destMap === town);
    // Emit as outdoor-style zone (source is the warehouse map itself)
    zones.push({
        mapId,
        locs: [...new Map(cells.map(([x, y]) => [`${x},${y}`, [x, y]])).values()],
        targetMap: town,
        targetX: sample.destX,
        targetY: sample.destY,
    });
}

const interiorExitZones = [];
for (const mapId of SHARED_INTERIOR_MAPS) {
    const cellSet = interiorExitCells.get(mapId);
    const exitsByTown = interiorExitsByTown.get(mapId) ?? {};
    if (!cellSet?.size) {
        console.error(`[gen] no exit cells for ${mapId}`);
        continue;
    }
    interiorExitZones.push({
        mapId,
        locs: [...cellSet].map((k) => k.split(',').map(Number)),
        exitsByTown,
    });
}

// --- Safe spawn patching ---
const outdoorWarpClusters = new Map();
for (const zone of zones) {
    for (const [x, y] of zone.locs) {
        outdoorWarpClusters.set(`${zone.mapId}:${x}:${y}`, zone.locs);
    }
}

function getOutdoorWarpCluster(mapId, x, y) {
    return outdoorWarpClusters.get(`${mapId}:${x}:${y}`);
}

const amdCache = new Map();
function getAmd(mapId) {
    if (amdCache.has(mapId)) return amdCache.get(mapId);
    const p = path.join(mapsDir, `${mapId}.amd`);
    const amd = fs.existsSync(p) ? loadAmd(p) : null;
    amdCache.set(mapId, amd);
    return amd;
}

// Patch outdoor destinations that land on teleport tiles / wet / blocked
for (const zone of zones) {
    const amd = getAmd(zone.targetMap);
    if (!amd) continue;
    const tile = getTileFlags(amd, zone.targetX, zone.targetY);
    if (!tile.isTeleport && tile.isMoveAllowed && !tile.isWet) continue;
    const cluster =
        getOutdoorWarpCluster(zone.targetMap, zone.targetX, zone.targetY) ?? [[zone.targetX, zone.targetY]];
    const safe = findSafeSpawnNearDoor(amd, cluster);
    if (safe && (safe.x !== zone.targetX || safe.y !== zone.targetY)) {
        console.error(
            `[gen] ${zone.mapId}→${zone.targetMap} safe spawn (${safe.x}, ${safe.y}) was (${zone.targetX}, ${zone.targetY})`,
        );
        zone.targetX = safe.x;
        zone.targetY = safe.y;
    }
}

// Patch interior entry spawns (outdoor → interior)
for (const zone of zones) {
    if (!SHARED_INTERIOR_MAPS.has(zone.targetMap) && zone.targetMap !== 'arewrhus' && zone.targetMap !== 'elvwrhus') {
        continue;
    }
    const amd = getAmd(zone.targetMap);
    if (!amd) continue;
    const exitZone = interiorExitZones.find((z) => z.mapId === zone.targetMap);
    const doorCells = exitZone?.locs ?? [[zone.targetX, zone.targetY]];
    const tile = getTileFlags(amd, zone.targetX, zone.targetY);
    if (tile.isMoveAllowed && !tile.isTeleport) continue;
    const safe = findSafeSpawnNearDoor(amd, doorCells);
    if (safe) {
        console.error(
            `[gen] entry ${zone.mapId}→${zone.targetMap} safe spawn (${safe.x}, ${safe.y}) was (${zone.targetX}, ${zone.targetY})`,
        );
        zone.targetX = safe.x;
        zone.targetY = safe.y;
    }
}

// Patch interior exit arrivals
for (const zone of interiorExitZones) {
    for (const [town, dest] of Object.entries(zone.exitsByTown)) {
        const [targetMap, x, y] = dest;
        const amd = getAmd(targetMap);
        if (!amd) continue;
        const cluster = getOutdoorWarpCluster(targetMap, x, y) ?? [[x, y]];
        const tile = getTileFlags(amd, x, y);
        if (tile.isMoveAllowed && !tile.isTeleport) continue;
        const safe = findSafeSpawnNearDoor(amd, cluster);
        if (safe && (safe.x !== x || safe.y !== y)) {
            console.error(`[gen] ${zone.mapId} exit → ${town} safe spawn (${safe.x}, ${safe.y}) was (${x}, ${y})`);
            zone.exitsByTown[town] = [targetMap, safe.x, safe.y];
        }
    }
}

if (skipped.length) {
    console.error(`[gen] skipped ${skipped.length} rows to unwired dest maps (e.g. *_f / dglv2)`);
}

/** Traveler soft-zone blue pads on map `default` (no classic MAPDATA) — west→Aresden, east→Elvine. */
const TRAVELER_HUB_ZONES = [
    {
        mapId: 'default',
        locs: [
            [80, 75],
            [81, 75],
            [82, 75],
            [80, 76],
            [81, 76],
            [82, 76],
        ],
        targetMap: 'aresden',
        targetX: 149,
        targetY: 127,
    },
    {
        mapId: 'default',
        locs: [
            [127, 78],
            [128, 78],
            [129, 78],
            [127, 79],
            [128, 79],
            [129, 79],
        ],
        targetMap: 'elvine',
        targetX: 149,
        targetY: 131,
    },
];

const allZones = [...TRAVELER_HUB_ZONES, ...zones];

console.log('// AUTO-GENERATED ZONES — from Helbreath MAPDATA teleport-loc');
console.log('// Traveler hub (map `default`): hand-maintained — no classic MAPDATA file for this soft zone.');
console.log('export const MAP_TELEPORT_ZONES = ' + JSON.stringify(allZones, null, 2) + ' as const;');
console.log('export const INTERIOR_EXIT_ZONES = ' + JSON.stringify(interiorExitZones, null, 2) + ' as const;');
console.log(
    'export const TOWN_MAP_IDS = ' +
        JSON.stringify(['default', ...TOWN_MAPS]) +
        ' as const;',
);
