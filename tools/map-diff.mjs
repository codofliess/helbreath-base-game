#!/usr/bin/env node
/**
 * Compare ChainLords .amd maps to a Helbreath Olympia reference.
 *
 * Tile, object, collision, and teleport-flag diffs need Olympia .amd files.
 * Teleport-loc and spawn diffs need Olympia MAPDATA text dumps.
 * Both are optional: when a source directory is missing the run still audits
 * the checked-in maps (collision, teleport wiring, spawn safety, copy drift).
 *
 *   node tools/map-diff.mjs
 *   node tools/map-diff.mjs --olympia reference/olympia-maps --mapdata reference/mapdata
 */

import fs from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HEADER_SIZE = 256;
const BLOCKED = 0x80;
const TELEPORT = 0x40;
const FARM = 0x20;

const OLYMPIA_AMD_CANDIDATES = [
    'reference/olympia-maps',
    'reference/maps',
    'reference/amd',
];

const MAPDATA_CANDIDATES = [
    'reference/mapdata',
    'sp-client/reference/mapdata',
    'tmp-mapdata',
];

/** Classic interiors: Elvine *_2 files share the Aresden *_1 asset. */
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

/**
 * MAPDATA spot-mob type → GameWorlds monsterId.
 * Same table as multiplayer/server/scripts/sync-olympia-pits.mjs.
 */
const SPOT_TYPE_TO_MONSTER_ID = {
    10: 1,
    16: 2,
    22: 3,
    55: 6,
    56: 10,
    7: 7,
    53: 7,
    60: 9,
    71: 11,
    23: 12,
    72: 13,
    13: 14,
    54: 15,
    31: 18,
    63: 20,
    52: 21,
    74: 24,
    57: 25,
    75: 26,
    76: 27,
    12: 28,
    24: 31,
    25: 31,
    26: 31,
    27: 32,
    49: 33,
    65: 34,
    77: 36,
    78: 37,
    58: 38,
    79: 39,
    14: 40,
    62: 41,
    34: 42,
    35: 42,
    73: 43,
    66: 44,
    30: 46,
    29: 47,
    61: 48,
    17: 50,
    11: 51,
    48: 53,
    80: 54,
    50: 55,
    28: 58,
    32: 59,
    33: 60,
    18: 61,
    70: 5,
    59: 0,
    81: 64,
};

const NAMED_PROBES = {
    elvine: [
        ['city streets (ip1)', 158, 57],
        ['slime plaza', 149, 131],
        ['wizard tower door', 180, 77],
        ['guide-map pin', 181, 78],
    ],
    aresden: [
        ['city streets (ip1)', 140, 49],
        ['slime plaza', 149, 127],
    ],
    default: [
        ['traveler hub', 90, 80],
    ],
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function parseHeader(buf) {
    const text = buf.subarray(0, Math.min(HEADER_SIZE, buf.length)).toString('latin1').replace(/\0/g, ' ');
    const tokens = text.split(/\s+/).filter((token) => token.length > 0);
    let sizeX = 0;
    let sizeY = 0;
    let tileSize = 0;
    for (let i = 0; i + 2 < tokens.length; i++) {
        if (tokens[i + 1] !== '=') continue;
        const value = Number(tokens[i + 2]);
        if (!Number.isInteger(value)) continue;
        if (tokens[i] === 'MAPSIZEX') sizeX = value;
        else if (tokens[i] === 'MAPSIZEY') sizeY = value;
        else if (tokens[i] === 'TILESIZE') tileSize = value;
    }
    if (sizeX <= 0 || sizeY <= 0 || tileSize < 9) {
        throw new Error(`Invalid .amd header (${sizeX}x${sizeY}, tileSize=${tileSize})`);
    }
    const need = HEADER_SIZE + sizeX * sizeY * tileSize;
    if (buf.length < need) {
        throw new Error(`Truncated .amd: ${buf.length} bytes, need ${need}`);
    }
    return { sizeX, sizeY, tileSize };
}

export function readCell(buf, header, x, y) {
    const offset = HEADER_SIZE + (y * header.sizeX + x) * header.tileSize;
    return {
        sprite: buf.readInt16LE(offset),
        spriteFrame: buf.readInt16LE(offset + 2),
        objectSprite: buf.readInt16LE(offset + 4),
        objectFrame: buf.readInt16LE(offset + 6),
        flags: buf[offset + 8],
        tail: header.tileSize > 9 ? buf[offset + 9] : 0,
    };
}

export function encodeAmd(sizeX, sizeY, cells, tileSize = 10) {
    const header = `MAPSIZEX = ${sizeX} MAPSIZEY = ${sizeY} TILESIZE = ${tileSize}`;
    const buf = Buffer.alloc(HEADER_SIZE + sizeX * sizeY * tileSize);
    buf.write(header, 0, 'ascii');
    for (let y = 0; y < sizeY; y++) {
        for (let x = 0; x < sizeX; x++) {
            const cell = cells[y * sizeX + x] ?? {};
            const offset = HEADER_SIZE + (y * sizeX + x) * tileSize;
            buf.writeInt16LE(cell.sprite ?? 0, offset);
            buf.writeInt16LE(cell.spriteFrame ?? 0, offset + 2);
            buf.writeInt16LE(cell.objectSprite ?? 0, offset + 4);
            buf.writeInt16LE(cell.objectFrame ?? 0, offset + 6);
            buf[offset + 8] = cell.flags ?? 0;
            if (tileSize > 9) buf[offset + 9] = cell.tail ?? 0;
        }
    }
    return buf;
}

function pushSample(list, sample, limit = 6) {
    if (list.length < limit) list.push(sample);
}

export function diffAmdBuffers(left, right) {
    const leftHeader = parseHeader(left);
    const rightHeader = parseHeader(right);
    const width = Math.min(leftHeader.sizeX, rightHeader.sizeX);
    const height = Math.min(leftHeader.sizeY, rightHeader.sizeY);
    const counts = {
        tile: 0,
        object: 0,
        collision: 0,
        teleport: 0,
        otherFlags: 0,
        tail: 0,
        changed: 0,
        extentCells: leftHeader.sizeX * leftHeader.sizeY + rightHeader.sizeX * rightHeader.sizeY - 2 * width * height,
    };
    const samples = { tile: [], object: [], collision: [], teleport: [] };
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const a = readCell(left, leftHeader, x, y);
            const b = readCell(right, rightHeader, x, y);
            const tileDiff = a.sprite !== b.sprite || a.spriteFrame !== b.spriteFrame;
            const objectDiff = a.objectSprite !== b.objectSprite || a.objectFrame !== b.objectFrame;
            const collisionDiff = (a.flags & BLOCKED) !== (b.flags & BLOCKED);
            const teleportDiff = (a.flags & TELEPORT) !== (b.flags & TELEPORT);
            const otherDiff = (a.flags & ~(BLOCKED | TELEPORT)) !== (b.flags & ~(BLOCKED | TELEPORT));
            const tailDiff = a.tail !== b.tail;
            if (tileDiff) {
                counts.tile++;
                pushSample(samples.tile, { x, y, left: a.sprite, right: b.sprite });
            }
            if (objectDiff) {
                counts.object++;
                pushSample(samples.object, { x, y, left: a.objectSprite, right: b.objectSprite });
            }
            if (collisionDiff) {
                counts.collision++;
                pushSample(samples.collision, { x, y, leftBlocked: (a.flags & BLOCKED) !== 0, rightBlocked: (b.flags & BLOCKED) !== 0 });
            }
            if (teleportDiff) {
                counts.teleport++;
                pushSample(samples.teleport, { x, y });
            }
            if (otherDiff) counts.otherFlags++;
            if (tailDiff) counts.tail++;
            if (tileDiff || objectDiff || collisionDiff || teleportDiff || otherDiff || tailDiff) counts.changed++;
        }
    }
    return {
        left: { sizeX: leftHeader.sizeX, sizeY: leftHeader.sizeY, tileSize: leftHeader.tileSize },
        right: { sizeX: rightHeader.sizeX, sizeY: rightHeader.sizeY, tileSize: rightHeader.tileSize },
        counts,
        samples,
    };
}

export function parseMapdata(text) {
    const teleports = [];
    const spots = [];
    const initialPoints = [];
    let maximumObject = null;
    let randomMob = null;
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('/') || trimmed.startsWith('#')) continue;
        const lower = trimmed.toLowerCase();
        if (lower.startsWith('teleport-loc')) {
            const parts = trimmed.split(/[=\s]+/).filter(Boolean);
            if (parts.length < 6) continue;
            const x = Number(parts[1]);
            const y = Number(parts[2]);
            const destX = Number(parts[4]);
            const destY = Number(parts[5]);
            if ([x, y, destX, destY].some((n) => !Number.isFinite(n))) continue;
            if (destX < 0 || destY < 0) continue;
            teleports.push({
                x,
                y,
                destMap: normalizeMapId(parts[3]),
                destX,
                destY,
            });
        } else if (lower.startsWith('spot-mob-generator')) {
            const nums = numbersAfterEquals(trimmed);
            if (nums.length < 8) continue;
            const [, , x1, y1, x2, y2, mobType, mobNum] = nums;
            spots.push({
                x1: Math.min(x1, x2),
                y1: Math.min(y1, y2),
                x2: Math.max(x1, x2),
                y2: Math.max(y1, y2),
                mobType,
                count: mobNum,
                monsterId: SPOT_TYPE_TO_MONSTER_ID[mobType],
            });
        } else if (lower.startsWith('initial-point')) {
            const parts = trimmed.split(/[=\s]+/).filter(Boolean);
            if (parts.length < 4) continue;
            const x = Number(parts[2]);
            const y = Number(parts[3]);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            initialPoints.push({ n: Number(parts[1]), x, y });
        } else if (lower.startsWith('maximum-object')) {
            const nums = numbersAfterEquals(trimmed);
            if (nums.length > 0) maximumObject = nums[0];
        } else if (lower.startsWith('random-mob-generator')) {
            const nums = numbersAfterEquals(trimmed);
            if (nums.length >= 2) randomMob = { enabled: nums[0] !== 0, level: nums[1] };
        }
    }
    return { teleports, spots, initialPoints, maximumObject, randomMob };
}

function numbersAfterEquals(line) {
    const eq = line.indexOf('=');
    if (eq < 0) return [];
    return line
        .slice(eq + 1)
        .trim()
        .split(/\s+/)
        .map(Number)
        .filter((n) => Number.isFinite(n));
}

/** Object-layer walls: structures 50–69, tile370–381, and the column at 422. */
export function isWallSprite(index) {
    return (index >= 50 && index <= 69) || (index >= 370 && index <= 381) || index === 422;
}

/**
 * Walkable wall: wall art on the object layer, or ground sprite 370–381 / 422, with the blocked bit clear.
 * Ground sprites 50–69 are excluded — on battlefields those indexes are paths, not walls.
 */
export function isWalkableWallCell(cell) {
    const wet = cell.sprite === 18 || cell.sprite === 19;
    if (wet || (cell.flags & BLOCKED) !== 0) return false;
    if (isWallSprite(cell.objectSprite)) return true;
    return (cell.sprite >= 370 && cell.sprite <= 381) || cell.sprite === 422;
}

export function normalizeMapId(raw) {
    const id = String(raw).trim().toLowerCase();
    return SHARED_INTERIOR_NORMALIZE[id] ?? id;
}

export function listAmd(dir) {
    const out = new Map();
    if (!dir || !fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir)) {
        if (!name.toLowerCase().endsWith('.amd')) continue;
        const key = name.slice(0, -4).toLowerCase();
        if (!out.has(key)) out.set(key, path.join(dir, name));
    }
    return out;
}

export function findMapdataFile(dir, mapId) {
    if (!dir || !fs.existsSync(dir)) return null;
    const want = `${mapId}.txt`.toLowerCase();
    for (const name of fs.readdirSync(dir)) {
        if (name.toLowerCase() === want) return path.join(dir, name);
    }
    return null;
}

function dirHas(dir, ext) {
    if (!dir || !fs.existsSync(dir)) return false;
    return fs.readdirSync(dir).some((name) => name.toLowerCase().endsWith(ext));
}

export function locateReference(root, overrideAmd, overrideMapdata) {
    const amdSearched = overrideAmd ? [overrideAmd] : OLYMPIA_AMD_CANDIDATES.map((rel) => path.join(root, rel));
    const mapdataSearched = overrideMapdata ? [overrideMapdata] : MAPDATA_CANDIDATES.map((rel) => path.join(root, rel));
    const olympiaAmd = amdSearched.find((dir) => dirHas(dir, '.amd')) ?? null;
    const mapdata = mapdataSearched.find((dir) => dirHas(dir, '.txt')) ?? null;
    return { olympiaAmd, mapdata, amdSearched, mapdataSearched };
}

export function parseTownSpawns(spawnSource) {
    const spawns = [];
    const travelerX = /TravelerDefaultSpawnX\s*=\s*(-?\d+)/.exec(spawnSource);
    const travelerY = /TravelerDefaultSpawnY\s*=\s*(-?\d+)/.exec(spawnSource);
    if (travelerX && travelerY) {
        spawns.push({ worldId: 'traveler', x: Number(travelerX[1]), y: Number(travelerY[1]), label: 'traveler-hub' });
    }
    const re = /string\.Equals\(worldId,\s*"([^"]+)"[\s\S]{0,220}?x\s*=\s*(-?\d+);\s*\r?\n\s*y\s*=\s*(-?\d+);/g;
    for (const match of spawnSource.matchAll(re)) {
        spawns.push({ worldId: match[1], x: Number(match[2]), y: Number(match[3]), label: 'town-default' });
    }
    return spawns;
}

export function parseRecallPads(recallSource) {
    const pads = [];
    const re = /\["([^"]+)"\]\s*=\s*\[([\s\S]*?)\],/g;
    for (const match of recallSource.matchAll(re)) {
        const worldId = match[1];
        for (const pair of match[2].matchAll(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g)) {
            pads.push({ worldId, x: Number(pair[1]), y: Number(pair[2]), label: 'recall' });
        }
    }
    return pads;
}

export function indexWorlds(worlds) {
    const idToMap = new Map();
    for (const world of worlds) {
        if (world?.id && world?.map) idToMap.set(world.id, normalizeMapId(world.map));
    }
    const byMap = new Map();
    const bucket = (mapName) => {
        const key = normalizeMapId(mapName);
        let row = byMap.get(key);
        if (!row) {
            row = {
                map: key,
                worldIds: [],
                teleports: [],
                recall: [],
                npcs: [],
                dwells: [],
                landings: [],
            };
            byMap.set(key, row);
        }
        return row;
    };
    for (const world of worlds) {
        if (!world?.map || !world?.id) continue;
        const row = bucket(world.map);
        row.worldIds.push(world.id);
        for (const set of world.teleportLocs ?? []) {
            const destWorld = set.target?.worldId;
            const dest = set.target?.loc;
            const destMap = destWorld && idToMap.get(destWorld);
            for (const loc of set.locs ?? []) {
                if (!Number.isFinite(loc.x) || !Number.isFinite(loc.y)) continue;
                row.teleports.push({
                    x: loc.x,
                    y: loc.y,
                    destMap: destMap ?? null,
                    destWorld: destWorld ?? null,
                    destX: dest?.x,
                    destY: dest?.y,
                });
            }
            if (destMap && Number.isFinite(dest?.x) && Number.isFinite(dest?.y)) {
                bucket(destMap).landings.push({
                    x: dest.x,
                    y: dest.y,
                    from: world.id,
                    to: destWorld,
                });
            }
        }
        for (const pad of world._recallPads ?? []) {
            if (!Number.isFinite(pad.x) || !Number.isFinite(pad.y)) continue;
            row.recall.push({ x: pad.x, y: pad.y, label: pad.label ?? 'recall', worldId: world.id });
        }
        for (const npc of world.npcs ?? []) {
            if (!Number.isFinite(npc.x) || !Number.isFinite(npc.y)) continue;
            row.npcs.push({ x: npc.x, y: npc.y, npcId: npc.npcId, worldId: world.id });
        }
        for (const dwell of world.dwellAreas ?? []) {
            const area = dwell.area;
            if (!area) continue;
            row.dwells.push({
                worldId: world.id,
                monsterId: dwell.monsterId,
                count: dwell.count ?? 0,
                x1: Math.min(area.x1, area.x2),
                y1: Math.min(area.y1, area.y2),
                x2: Math.max(area.x1, area.x2),
                y2: Math.max(area.y1, area.y2),
            });
        }
    }
    return { idToMap, byMap };
}

function cellIssue(buf, header, x, y) {
    if (x < 0 || y < 0 || x >= header.sizeX || y >= header.sizeY) return 'out-of-bounds';
    const cell = readCell(buf, header, x, y);
    const wet = cell.sprite === 18 || cell.sprite === 19;
    const blocked = (cell.flags & BLOCKED) !== 0;
    const teleport = (cell.flags & TELEPORT) !== 0;
    if (blocked && wet) return 'blocked-wet';
    if (blocked) return 'blocked';
    if (wet) return 'wet';
    if (teleport) return 'teleport';
    return null;
}

function isFreeSpawn(buf, header, x, y) {
    return cellIssue(buf, header, x, y) === null;
}

export function auditMap(buf, bucket) {
    const header = parseHeader(buf);
    const teleportKeys = new Set((bucket?.teleports ?? []).map((loc) => `${loc.x},${loc.y}`));
    const seenFlag = new Set();
    const stats = {
        sizeX: header.sizeX,
        sizeY: header.sizeY,
        tileSize: header.tileSize,
        blocked: 0,
        wet: 0,
        wetWithoutBlockedBit: 0,
        teleportFlags: 0,
        objects: 0,
        unwiredTeleport: 0,
        wiredNotFlag: 0,
        walkableStructure: 0,
        structureObjects: 0,
        sprite422: 0,
        sprite422Walkable: 0,
        bareBlocked: 0,
        badSpawns: [],
        dwellUnplaceable: 0,
        dwellDeficit: 0,
        unwiredSamples: [],
        wiredNotFlagSamples: [],
    };
    for (let y = 0; y < header.sizeY; y++) {
        for (let x = 0; x < header.sizeX; x++) {
            const cell = readCell(buf, header, x, y);
            const key = `${x},${y}`;
            const blocked = (cell.flags & BLOCKED) !== 0;
            const teleport = (cell.flags & TELEPORT) !== 0;
            const wet = cell.sprite === 18 || cell.sprite === 19;
            if (blocked) stats.blocked++;
            if (wet) stats.wet++;
            if (wet && !blocked) stats.wetWithoutBlockedBit++;
            if (cell.objectSprite > 0) stats.objects++;
            if (teleport) {
                stats.teleportFlags++;
                seenFlag.add(key);
                if (!teleportKeys.has(key)) {
                    stats.unwiredTeleport++;
                    pushSample(stats.unwiredSamples, { x, y }, 8);
                }
            }
            const structureObject = cell.objectSprite >= 50 && cell.objectSprite <= 69;
            if (structureObject) stats.structureObjects++;
            if (isWalkableWallCell(cell)) stats.walkableStructure++;
            if (cell.sprite === 422 || cell.objectSprite === 422) {
                stats.sprite422++;
                if (!blocked && !wet) stats.sprite422Walkable++;
            }
            if (blocked && !wet && cell.objectSprite <= 0 && !isWallSprite(cell.sprite)) stats.bareBlocked++;
        }
    }
    for (const key of teleportKeys) {
        if (seenFlag.has(key)) continue;
        stats.wiredNotFlag++;
        const [x, y] = key.split(',').map(Number);
        pushSample(stats.wiredNotFlagSamples, { x, y }, 8);
    }

    const spawnPoints = [
        ...(bucket?.recall ?? []).map((pad) => ({ ...pad, kind: 'recall' })),
        ...(bucket?.npcs ?? []).map((npc) => ({ ...npc, kind: 'npc' })),
        ...(bucket?.landings ?? []).map((landing) => ({ ...landing, kind: 'landing' })),
    ];
    const seenSpawn = new Set();
    for (const point of spawnPoints) {
        const key = `${point.kind}:${point.x},${point.y}`;
        if (seenSpawn.has(key)) continue;
        seenSpawn.add(key);
        const issue = cellIssue(buf, header, point.x, point.y);
        if (!issue) continue;
        stats.badSpawns.push({ ...point, issue });
    }

    for (const dwell of bucket?.dwells ?? []) {
        let free = 0;
        const x1 = Math.max(0, dwell.x1);
        const y1 = Math.max(0, dwell.y1);
        const x2 = Math.min(header.sizeX - 1, dwell.x2);
        const y2 = Math.min(header.sizeY - 1, dwell.y2);
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                if (isFreeSpawn(buf, header, x, y)) free++;
            }
        }
        if (free < dwell.count) {
            stats.dwellUnplaceable++;
            stats.dwellDeficit += dwell.count - free;
        }
    }
    return { header, stats };
}

export function compareSpawnConfig(mapdata, bucket) {
    const oursTele = new Set(
        (bucket?.teleports ?? [])
            .filter((loc) => loc.destMap && Number.isFinite(loc.destX) && Number.isFinite(loc.destY))
            .map((loc) => `${loc.x},${loc.y}->${loc.destMap}:${loc.destX},${loc.destY}`),
    );
    const olympiaTele = new Set(mapdata.teleports.map((loc) => `${loc.x},${loc.y}->${loc.destMap}:${loc.destX},${loc.destY}`));
    let teleportOnlyOlympia = 0;
    let teleportOnlyOurs = 0;
    for (const key of olympiaTele) if (!oursTele.has(key)) teleportOnlyOlympia++;
    for (const key of oursTele) if (!olympiaTele.has(key)) teleportOnlyOurs++;

    const ourPads = new Set((bucket?.recall ?? []).map((pad) => `${pad.x},${pad.y}`));
    const olympiaPads = new Set(mapdata.initialPoints.map((pad) => `${pad.x},${pad.y}`));
    let initialOnlyOlympia = 0;
    let initialOnlyOurs = 0;
    for (const key of olympiaPads) if (!ourPads.has(key)) initialOnlyOlympia++;
    for (const key of ourPads) if (!olympiaPads.has(key)) initialOnlyOurs++;

    const olympiaSpots = new Map();
    for (const spot of mapdata.spots) {
        const id = spot.monsterId === undefined ? `type:${spot.mobType}` : String(spot.monsterId);
        const key = `${spot.x1},${spot.y1},${spot.x2},${spot.y2}#${spot.count}#${id}`;
        olympiaSpots.set(key, (olympiaSpots.get(key) ?? 0) + 1);
    }
    const ourSpots = new Map();
    for (const dwell of bucket?.dwells ?? []) {
        const key = `${dwell.x1},${dwell.y1},${dwell.x2},${dwell.y2}#${dwell.count}#${dwell.monsterId}`;
        ourSpots.set(key, (ourSpots.get(key) ?? 0) + 1);
    }
    let spotsOnlyOlympia = 0;
    let spotsOnlyOurs = 0;
    const keys = new Set([...olympiaSpots.keys(), ...ourSpots.keys()]);
    for (const key of keys) {
        const delta = (olympiaSpots.get(key) ?? 0) - (ourSpots.get(key) ?? 0);
        if (delta > 0) spotsOnlyOlympia += delta;
        if (delta < 0) spotsOnlyOurs += -delta;
    }

    let populationDelta = 0;
    let populationNote = null;
    if (mapdata.spots.length === 0 && mapdata.randomMob?.enabled) {
        const expected = Math.max(0, (mapdata.maximumObject ?? 0) - 30);
        const actual = (bucket?.dwells ?? []).reduce((sum, dwell) => sum + (dwell.count ?? 0), 0);
        populationDelta = actual - expected;
        populationNote = `random-mob level ${mapdata.randomMob.level}: Olympia slots ${expected} (maximum-object−30), our dwell sum ${actual}`;
    }

    const spawn =
        teleportOnlyOlympia +
        teleportOnlyOurs +
        initialOnlyOlympia +
        initialOnlyOurs +
        spotsOnlyOlympia +
        spotsOnlyOurs +
        Math.abs(populationDelta);

    return {
        teleportOnlyOlympia,
        teleportOnlyOurs,
        initialOnlyOlympia,
        initialOnlyOurs,
        spotsOnlyOlympia,
        spotsOnlyOurs,
        populationDelta,
        populationNote,
        spawn,
    };
}

export function suspicionScore(row) {
    const olympia = row.olympia;
    const num = (value) => (typeof value === 'number' ? value : 0);
    const olympiaScore = olympia
        ? num(olympia.counts.tile) +
          num(olympia.counts.object) +
          num(olympia.counts.collision) * 4 +
          num(olympia.counts.teleport) * 8 +
          (olympia.spawn?.spawn ?? 0) * 6 +
          num(olympia.counts.extentCells) * 2
        : 0;
    const local = row.local.stats;
    const copyChanged = row.copy?.counts.changed ?? 0;
    const copyExtent = row.copy?.counts.extentCells ?? 0;
    // Cap wholesale file replacements so a resized map does not hide every other map,
    // but keep them well above a handful of unwired pads.
    const copyScore = Math.min(copyChanged, 2500) + Math.min(copyExtent, 2500) * 0.4;
    return (
        olympiaScore +
        copyScore +
        local.unwiredTeleport * 8 +
        local.wiredNotFlag * 10 +
        local.badSpawns.length * 25 +
        local.dwellUnplaceable * 8 +
        local.dwellDeficit * 0.15 +
        local.walkableStructure * 3 +
        local.wetWithoutBlockedBit * 0.04
    );
}

function classifyColor(cell, spawnHere) {
    if (spawnHere) return [220, 40, 200];
    if ((cell.flags & TELEPORT) !== 0) return [40, 210, 220];
    const wet = cell.sprite === 18 || cell.sprite === 19;
    if (wet) return [36, 78, 150];
    if (isWalkableWallCell(cell)) return [230, 196, 40];
    if ((cell.flags & BLOCKED) !== 0) return [150, 42, 42];
    if (cell.objectSprite > 0) return [64, 120, 64];
    const shade = 32 + (Math.abs(cell.sprite) % 36);
    return [shade, shade + 8, shade];
}

function diffColor(left, right) {
    if (!left || !right) return [180, 0, 180];
    if ((left.flags & BLOCKED) !== (right.flags & BLOCKED)) return [220, 48, 48];
    if ((left.flags & TELEPORT) !== (right.flags & TELEPORT)) return [40, 200, 230];
    if (left.objectSprite !== right.objectSprite || left.objectFrame !== right.objectFrame) return [48, 200, 90];
    if (left.sprite !== right.sprite || left.spriteFrame !== right.spriteFrame) return [230, 150, 40];
    return [16, 16, 18];
}

function paintPanel(width, height, sample) {
    const rgb = Buffer.alloc(width * height * 3);
    const step = Math.max(1, Math.ceil(Math.max(width, height) / 420));
    const outW = Math.ceil(width / step);
    const outH = Math.ceil(height / step);
    const out = Buffer.alloc(outW * outH * 3);
    const rank = new Uint8Array(outW * outH);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = sample(x, y);
            const ox = Math.floor(x / step);
            const oy = Math.floor(y / step);
            const priority = color[3] ?? 1;
            const index = oy * outW + ox;
            if (priority < rank[index]) continue;
            rank[index] = priority;
            out[index * 3] = color[0];
            out[index * 3 + 1] = color[1];
            out[index * 3 + 2] = color[2];
        }
    }
    return { rgb: out, width: outW, height: outH, raw: rgb };
}

function withPriority(color, priority) {
    return [color[0], color[1], color[2], priority];
}

export function renderComparisonPng(file, leftBuf, rightBuf, spawnKeys) {
    const leftHeader = parseHeader(leftBuf);
    const rightHeader = rightBuf ? parseHeader(rightBuf) : null;
    const width = Math.max(leftHeader.sizeX, rightHeader?.sizeX ?? 0);
    const height = Math.max(leftHeader.sizeY, rightHeader?.sizeY ?? 0);
    const spawn = spawnKeys ?? new Set();
    const leftPanel = paintPanel(width, height, (x, y) => {
        if (x >= leftHeader.sizeX || y >= leftHeader.sizeY) return withPriority([0, 0, 0], 0);
        const cell = readCell(leftBuf, leftHeader, x, y);
        const color = classifyColor(cell, spawn.has(`${x},${y}`));
        const priority = spawn.has(`${x},${y}`) ? 6 : (cell.flags & TELEPORT) ? 5 : (color[0] > 200 && color[1] > 160) ? 4 : (cell.flags & BLOCKED) ? 3 : 1;
        return withPriority(color, priority);
    });
    const midPanel = rightBuf
        ? paintPanel(width, height, (x, y) => {
            if (x >= rightHeader.sizeX || y >= rightHeader.sizeY) return withPriority([0, 0, 0], 0);
            const cell = readCell(rightBuf, rightHeader, x, y);
            return withPriority(classifyColor(cell, false), (cell.flags & BLOCKED) ? 3 : 1);
        })
        : paintPanel(width, height, (x, y) => {
            if (x >= leftHeader.sizeX || y >= leftHeader.sizeY) return withPriority([0, 0, 0], 0);
            const cell = readCell(leftBuf, leftHeader, x, y);
            if (spawn.has(`${x},${y}`)) return withPriority([220, 40, 200], 6);
            if ((cell.flags & TELEPORT) !== 0) return withPriority([40, 210, 220], 5);
            if ((cell.flags & BLOCKED) !== 0) return withPriority([210, 50, 50], 4);
            return withPriority([24, 24, 24], 1);
        });
    const diffPanel = paintPanel(width, height, (x, y) => {
        const inLeft = x < leftHeader.sizeX && y < leftHeader.sizeY;
        const inRight = rightBuf && x < rightHeader.sizeX && y < rightHeader.sizeY;
        if (!rightBuf) {
            if (!inLeft) return withPriority([0, 0, 0], 0);
            const cell = readCell(leftBuf, leftHeader, x, y);
            if ((cell.flags & TELEPORT) !== 0) return withPriority([40, 210, 220], 5);
            if (isWalkableWallCell(cell)) return withPriority([230, 196, 40], 4);
            const blockedWall = (cell.flags & BLOCKED) !== 0 && (isWallSprite(cell.objectSprite) || cell.sprite === 422 || (cell.sprite >= 370 && cell.sprite <= 381));
            if (blockedWall) return withPriority([160, 70, 40], 3);
            return withPriority([20, 20, 20], 1);
        }
        if (!inLeft || !inRight) return withPriority([180, 0, 180], 2);
        const color = diffColor(readCell(leftBuf, leftHeader, x, y), readCell(rightBuf, rightHeader, x, y));
        const priority = color[0] === 16 ? 1 : 5;
        return withPriority(color, priority);
    });
    const gap = 2;
    const outW = leftPanel.width + midPanel.width + diffPanel.width + gap * 2;
    const outH = Math.max(leftPanel.height, midPanel.height, diffPanel.height);
    const rgb = Buffer.alloc(outW * outH * 3, 255);
    blit(rgb, outW, leftPanel.rgb, leftPanel.width, leftPanel.height, 0, 0);
    blit(rgb, outW, midPanel.rgb, midPanel.width, midPanel.height, leftPanel.width + gap, 0);
    blit(rgb, outW, diffPanel.rgb, diffPanel.width, diffPanel.height, leftPanel.width + midPanel.width + gap * 2, 0);
    writeRgbPng(file, outW, outH, rgb);
    return { width: outW, height: outH };
}

function blit(dest, destW, src, srcW, srcH, originX, originY) {
    for (let y = 0; y < srcH; y++) {
        src.copy(dest, ((originY + y) * destW + originX) * 3, y * srcW * 3, (y + 1) * srcW * 3);
    }
}

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([length, typeBuf, data, crc]);
}

export function writeRgbPng(file, width, height, rgb) {
    const raw = Buffer.alloc((width * 3 + 1) * height);
    for (let y = 0; y < height; y++) {
        const start = y * (width * 3 + 1);
        raw[start] = 0;
        rgb.copy(raw, start + 1, y * width * 3, (y + 1) * width * 3);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    const png = Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', deflateSync(raw)),
        pngChunk('IEND', Buffer.alloc(0)),
    ]);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, png);
}

function largestComponent(buf, header, predicate) {
    const seen = new Uint8Array(header.sizeX * header.sizeY);
    let best = null;
    const stack = [];
    for (let y = 0; y < header.sizeY; y++) {
        for (let x = 0; x < header.sizeX; x++) {
            const start = y * header.sizeX + x;
            if (seen[start]) continue;
            const cell = readCell(buf, header, x, y);
            if (!predicate(cell)) continue;
            let count = 0;
            let minX = x;
            let maxX = x;
            let minY = y;
            let maxY = y;
            stack.push(start);
            seen[start] = 1;
            while (stack.length > 0) {
                const index = stack.pop();
                const cy = Math.floor(index / header.sizeX);
                const cx = index - cy * header.sizeX;
                count++;
                if (cx < minX) minX = cx;
                if (cx > maxX) maxX = cx;
                if (cy < minY) minY = cy;
                if (cy > maxY) maxY = cy;
                const neighbors = [index - 1, index + 1, index - header.sizeX, index + header.sizeX];
                for (const next of neighbors) {
                    if (next < 0 || next >= seen.length || seen[next]) continue;
                    const ny = Math.floor(next / header.sizeX);
                    const nx = next - ny * header.sizeX;
                    if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue;
                    const nextCell = readCell(buf, header, nx, ny);
                    if (!predicate(nextCell)) continue;
                    seen[next] = 1;
                    stack.push(next);
                }
            }
            if (!best || count > best.count) best = { count, minX, maxX, minY, maxY };
        }
    }
    return best;
}

function describeCell(buf, header, x, y) {
    if (x < 0 || y < 0 || x >= header.sizeX || y >= header.sizeY) return 'out of bounds';
    const cell = readCell(buf, header, x, y);
    const parts = [
        `sprite ${cell.sprite}/${cell.spriteFrame}`,
        `object ${cell.objectSprite}/${cell.objectFrame}`,
        (cell.flags & BLOCKED) ? 'blocked' : 'walkable',
    ];
    if ((cell.flags & TELEPORT) !== 0) parts.push('teleport');
    if (cell.sprite === 18 || cell.sprite === 19) parts.push(cell.sprite === 19 ? 'deep water' : 'shore');
    if ((cell.flags & FARM) !== 0) parts.push('farm');
    return parts.join(', ');
}

function scanStrip(buf, header, cells) {
    return cells.map(([x, y]) => {
        const issue = x >= 0 && y >= 0 && x < header.sizeX && y < header.sizeY
            ? describeCell(buf, header, x, y)
            : 'out of bounds';
        return { x, y, text: issue };
    });
}

function fmtNum(value) {
    if (value === null || value === undefined) return '—';
    return String(value);
}

function localSummary(stats) {
    const parts = [];
    if (stats.unwiredTeleport) parts.push(`${stats.unwiredTeleport} unwired teleport`);
    if (stats.wiredNotFlag) parts.push(`${stats.wiredNotFlag} wired without 0x40`);
    if (stats.badSpawns.length) parts.push(`${stats.badSpawns.length} bad spawn`);
    if (stats.dwellUnplaceable) parts.push(`${stats.dwellUnplaceable} dwell short`);
    if (stats.walkableStructure) parts.push(`${stats.walkableStructure} walkable wall`);
    if (stats.wetWithoutBlockedBit >= 50) parts.push(`${stats.wetWithoutBlockedBit} wet with walk bit`);
    return parts.length > 0 ? parts.join('; ') : 'clean';
}

function coordList(points) {
    if (!points || points.length === 0) return 'none';
    return points.map((point) => `(${point.x},${point.y})`).join(', ');
}

export function buildReport(run) {
    const lines = [];
    lines.push('# Map diff vs Helbreath Olympia');
    lines.push('');
    lines.push(`Run: ${run.generatedAt}. Authoritative maps: \`${run.paths.ours}\` (${run.ourMaps.size} files).`);
    lines.push('');
    lines.push('## Olympia sources');
    lines.push('');
    if (run.sources.olympiaAmd) {
        lines.push(`- Olympia \`.amd\` dumps: \`${run.sources.olympiaAmd}\` (${run.olympiaMaps.size} files).`);
    } else {
        lines.push('- Olympia `.amd` dumps: **not in the repo.** Tile, object, and collision diffs against Olympia were not computed.');
        lines.push(`  Looked for a directory of \`*.amd\` at: ${run.sources.amdSearched.map((dir) => `\`${path.relative(run.root, dir) || dir}\``).join(', ')}.`);
        lines.push('  Drop the Helbreath Olympia client map pack in `reference/olympia-maps/` (or pass `--olympia`) and rerun. Nothing under `reference/` today is a map binary — that folder is cfg and C++ only.');
    }
    if (run.sources.mapdata) {
        lines.push(`- Olympia MAPDATA: \`${run.sources.mapdata}\`.`);
    } else {
        lines.push('- Olympia MAPDATA text dumps: **not in the repo.** Teleport-loc and spawn diffs against Olympia were not computed.');
        lines.push(`  Looked for \`*.txt\` at: ${run.sources.mapdataSearched.map((dir) => `\`${path.relative(run.root, dir) || dir}\``).join(', ')}.`);
        lines.push('  The pit-sync script expects `sp-client/reference/mapdata/` or `tmp-mapdata/` (isolatorhk `HGServer/MAPDATA`). Those directories are absent.');
    }
    lines.push('');
    lines.push('Ranking below is most suspicious first. With Olympia binaries missing, the score is local: a capped `sp-client` byte drift, unwired `.amd` teleport flags, GameWorlds pads that are not `0x40`, recall/NPC/landing cells on blocked, wet, or teleport tiles, dwell rectangles that cannot hold their count, and walkable wall objects (object sprite 50–69, 370–381, or 422, or ground sprite 370–381 / 422, with the blocked bit clear). Ground sprites 50–69 are not treated as walls. Solid ground with no object is not scored.');
    lines.push('');
    lines.push('## Elvine walls and collision');
    lines.push('');
    lines.push(run.elvineNarrative);
    lines.push('');
    if (run.images.length > 0) {
        lines.push('Images are three panels. When an Olympia `.amd` exists they are ours, Olympia, diff. When `sp-client` bytes differ they are server, sp-client, diff. Otherwise they are classification, collision, and wall sprites (yellow = walkable wall, brown = blocked wall, cyan = teleport). Other colors: red = blocked, magenta = recall/NPC/landing, blue = water/shore, green = other object. Diff panel: red collision, cyan teleport flag, green object, orange ground tile, magenta = size mismatch, near-black = same.');
        lines.push('');
        for (const image of run.images) {
            lines.push(`- [${image.name}](${image.href}) — ${image.caption}`);
            lines.push('');
            lines.push(`![${image.name}](${image.href})`);
            lines.push('');
        }
    }
    lines.push('## Ranked maps');
    lines.push('');
    lines.push('| Rank | Map | Score | Tile | Object | Collision | Teleport | Spawn | Local |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    run.rows.forEach((row, index) => {
        const tile = row.olympia ? fmtNum(row.olympia.counts.tile) : '—';
        const object = row.olympia ? fmtNum(row.olympia.counts.object) : '—';
        const collision = row.olympia ? fmtNum(row.olympia.counts.collision) : '—';
        const teleport = row.olympia ? fmtNum(row.olympia.counts.teleport) : '—';
        const spawn = row.olympia?.spawn ? fmtNum(row.olympia.spawn.spawn) : '—';
        const local = localSummary(row.local.stats) + (row.copy ? `; sp-client Δ ${row.copy.counts.changed}` : '');
        lines.push(`| ${index + 1} | ${row.name} | ${row.score.toFixed(1)} | ${tile} | ${object} | ${collision} | ${teleport} | ${spawn} | ${local} |`);
    });
    lines.push('');
    lines.push('Tile / object / collision / teleport / spawn columns are Olympia deltas. An em dash means that source was not available, not that the map matches.');
    lines.push('');
    lines.push('## Missing and extra maps');
    lines.push('');
    if (run.sources.olympiaAmd) {
        lines.push(`- In Olympia, missing from our maps: ${run.olympiaOnly.length ? run.olympiaOnly.join(', ') : 'none'}.`);
        lines.push(`- In our maps, absent from Olympia: ${run.oursOnly.length ? run.oursOnly.join(', ') : 'none'}.`);
    } else {
        lines.push('- Olympia filename comparison skipped — no Olympia `.amd` directory.');
    }
    if (run.sources.mapdata) {
        lines.push(`- MAPDATA files with no matching \`.amd\`: ${run.mapdataOnly.length ? run.mapdataOnly.join(', ') : 'none'}.`);
        lines.push(`- Our maps with no MAPDATA file: ${run.mapsWithoutMapdata.length}.`);
    }
    lines.push(`- GameWorlds entries whose \`.amd\` is missing: ${run.missingAmdForWorlds.length ? run.missingAmdForWorlds.map((row) => `${row.worldId} (${row.map})`).join(', ') : 'none'}.`);
    lines.push(`- \`.amd\` files no world references: ${run.orphanAmd.length ? run.orphanAmd.join(', ') : 'none'}.`);
    lines.push('');
    lines.push('## Server versus client copies');
    lines.push('');
    lines.push(`\`mp-client\` public maps differ from \`Config/maps\` on **${run.mpDrift.length}** file(s). \`sp-client\` public maps differ on **${run.spDrift.length}** file(s).`);
    lines.push('');
    if (run.spDrift.length > 0) {
        lines.push('| Map | Changed cells | Tile | Object | Collision | Teleport | Extent |');
        lines.push('| --- | --- | --- | --- | --- | --- | --- |');
        for (const row of run.spDrift) {
            const counts = row.diff.counts;
            lines.push(`| ${row.name} | ${counts.changed} | ${counts.tile} | ${counts.object} | ${counts.collision} | ${counts.teleport} | ${counts.extentCells} |`);
        }
        lines.push('');
        lines.push('These rows are `sp-client/public/assets/maps` versus the server copy. They are not an Olympia diff. The multiplayer client copy matches the server on every file unless the mp-client count above says otherwise.');
    }
    lines.push('');
    lines.push('## Highest local issues');
    lines.push('');
    for (const row of run.rows.slice(0, 10)) {
        lines.push(`### ${row.name}`);
        lines.push('');
        lines.push(`- Size ${row.local.stats.sizeX}×${row.local.stats.sizeY}, tile record ${row.local.stats.tileSize} bytes. Worlds: ${row.worldIds.join(', ') || 'none'}.`);
        lines.push(`- Blocked ${row.local.stats.blocked}, bare blocked ${row.local.stats.bareBlocked}, wet ${row.local.stats.wet} (${row.local.stats.wetWithoutBlockedBit} wet without the blocked bit — the client refuses those cells, the server still walks them).`);
        lines.push(`- Objects ${row.local.stats.objects}. Structure objects 50–69: ${row.local.stats.structureObjects}. Walkable wall-like cells: ${row.local.stats.walkableStructure}. Sprite 422: ${row.local.stats.sprite422} (${row.local.stats.sprite422Walkable} walkable).`);
        lines.push(`- Teleport flags ${row.local.stats.teleportFlags}. Unwired (flag set, no GameWorlds loc): ${row.local.stats.unwiredTeleport} e.g. ${coordList(row.local.stats.unwiredSamples)}. Wired but flag clear: ${row.local.stats.wiredNotFlag} e.g. ${coordList(row.local.stats.wiredNotFlagSamples)}.`);
        if (row.local.stats.badSpawns.length > 0) {
            const sample = row.local.stats.badSpawns.slice(0, 6).map((point) => `${point.kind} (${point.x},${point.y}) ${point.issue}${point.worldId ? ` ${point.worldId}` : ''}`).join('; ');
            lines.push(`- Bad spawns: ${row.local.stats.badSpawns.length}. ${sample}.`);
        } else {
            lines.push('- Recall pads, NPC cells, and teleport landings on this map are free of blocked, wet, and teleport-flag cells.');
        }
        if (row.local.stats.dwellUnplaceable > 0) {
            lines.push(`- Dwell rectangles that cannot fit their count: ${row.local.stats.dwellUnplaceable} (short by ${row.local.stats.dwellDeficit} mobs).`);
        }
        if (row.copy) {
            const counts = row.copy.counts;
            lines.push(`- sp-client copy differs in ${counts.changed} cells (${row.copy.left.sizeX}×${row.copy.left.sizeY} server vs ${row.copy.right.sizeX}×${row.copy.right.sizeY} sp-client). Tile ${counts.tile}, object ${counts.object}, collision ${counts.collision}, teleport flag ${counts.teleport}, extent ${counts.extentCells}.`);
        }
        if (row.olympia) {
            lines.push(`- Versus Olympia: tile ${row.olympia.counts.tile}, object ${row.olympia.counts.object}, collision ${row.olympia.counts.collision}, teleport flag ${row.olympia.counts.teleport}, extent ${row.olympia.counts.extentCells}.`);
            if (row.olympia.spawn) {
                const spawn = row.olympia.spawn;
                lines.push(`- Versus MAPDATA: teleport only-Olympia ${spawn.teleportOnlyOlympia}, only-ours ${spawn.teleportOnlyOurs}; initial-point only-Olympia ${spawn.initialOnlyOlympia}, only-ours ${spawn.initialOnlyOurs}; spots only-Olympia ${spawn.spotsOnlyOlympia}, only-ours ${spawn.spotsOnlyOurs}; population delta ${spawn.populationDelta}.`);
                if (spawn.populationNote) lines.push(`- ${spawn.populationNote}. Species mix for random-mob maps stays in \`sync-olympia-pits.mjs\`; this column is the slot total.`);
            }
        }
        if (row.components) {
            lines.push(`- Largest walkable-wall cluster: ${row.components.walkable ? `${row.components.walkable.count} cells, bbox (${row.components.walkable.minX},${row.components.walkable.minY})–(${row.components.walkable.maxX},${row.components.walkable.maxY})` : 'none'}.`);
        }
        lines.push('');
    }
    lines.push('## Rerun');
    lines.push('');
    lines.push('```bash');
    lines.push('node tools/map-diff.mjs --report tools/map-diff-out/report.md --images tools/map-diff-out/images');
    lines.push('node tools/map-diff.mjs --olympia reference/olympia-maps --mapdata reference/mapdata');
    lines.push('```');
    lines.push('');
    lines.push('`--strict` exits non-zero when either Olympia source is missing. The default exit is 0 so CI can run before those dumps are vendored. Generated reports and images stay out of git (`tools/map-diff-out/`).');
    lines.push('');
    return lines.join('\n');
}

function elvineNarrative(run, elvineRow, elvuniRow) {
    const parts = [];
    if (!elvineRow) {
        return 'elvine.amd was not in the server map directory.';
    }
    const stats = elvineRow.local.stats;
    parts.push(`\`elvine.amd\` is ${stats.sizeX}×${stats.sizeY}. Blocked cells: ${stats.blocked}. Walkable wall cells: **${stats.walkableStructure}** (object sprite 50–69 / 370–381 / 422, or ground 370–381 / 422, blocked bit clear), of which ${stats.sprite422Walkable} are sprite 422. Structure objects 50–69: ${stats.structureObjects}. The other wall objects on this map are blocked. Bare blocked ground with no object (${stats.bareBlocked}) is the solid footprint, not a separate wall bug.`);
    parts.push(`Teleport flags: ${stats.teleportFlags}. Unwired (blue in the file, absent from GameWorlds): ${stats.unwiredTeleport} at ${coordList(stats.unwiredSamples)}. GameWorlds cells whose flag is clear: ${stats.wiredNotFlag} at ${coordList(stats.wiredNotFlagSamples)}. Wet cells whose blocked bit is clear: ${stats.wetWithoutBlockedBit}. The client treats sprite 18/19 as not standable; server movement follows only bit 0x80 and keeps those cells wet so spawns avoid them.`);
    if (elvineRow.probes?.length) {
        parts.push(`Named cells: ${elvineRow.probes.map((probe) => `${probe.label} (${probe.x},${probe.y}) ${probe.text}`).join('; ')}.`);
    }
    if (elvineRow.components?.walkable) {
        const box = elvineRow.components.walkable;
        parts.push(`Largest walkable-wall cluster is ${box.count} cells covering (${box.minX},${box.minY})–(${box.maxX},${box.maxY}). Sprite 422 is the walkable wall column the depth sort already special-cases; object sprites 370–381 are the tile370 wall pack. A walkable cell there is wall art you can step through.`);
    }
    if (elvineRow.copy) {
        parts.push(`sp-client elvine.amd differs in ${elvineRow.copy.counts.changed} cells (collision ${elvineRow.copy.counts.collision}).`);
    } else {
        parts.push('Server, mp-client, and sp-client copies of elvine.amd are the same file. The wall question is inside that file, not a stale client copy.');
    }
    if (!run.sources.olympiaAmd) {
        parts.push('No Olympia elvine.amd was available, so this is not a claim that our walls diverged from Olympia. It is the collision picture of the file we ship.');
    }
    if (elvuniRow) {
        const garden = elvuniRow.local.stats;
        parts.push(`Garden \`elvuni.amd\` (${garden.sizeX}×${garden.sizeY}): teleport flags ${garden.teleportFlags}, unwired ${garden.unwiredTeleport}, wired without flag ${garden.wiredNotFlag}, walkable walls ${garden.walkableStructure}, bare blocked ${garden.bareBlocked}.`);
        if (elvuniRow.eastWall) {
            const flagged = elvuniRow.eastWall.filter((cell) => cell.text.includes('teleport')).length;
            parts.push(`East wall x=176 y=20–28: ${flagged}/9 tiles have the teleport bit. ${elvuniRow.eastWall.map((cell) => `y${cell.y} ${cell.text}`).join('; ')}.`);
        }
    }
    return parts.join(' ');
}

function attachTownSpawns(byMap, idToMap, spawns) {
    for (const spawn of spawns) {
        const map = idToMap.get(spawn.worldId);
        if (!map) continue;
        const row = byMap.get(map);
        if (!row) continue;
        row.recall.push({ x: spawn.x, y: spawn.y, label: spawn.label, worldId: spawn.worldId });
    }
}

export function run(options) {
    const root = options.root ?? repoRoot;
    const oursDir = options.oursDir ?? path.join(root, 'multiplayer/server/Config/maps');
    const mpDir = options.mpDir ?? path.join(root, 'multiplayer/mp-client/public/assets/maps');
    const spDir = options.spDir ?? path.join(root, 'sp-client/public/assets/maps');
    const worldsPath = options.worldsPath ?? path.join(root, 'multiplayer/server/Config/GameWorlds.json');
    const sources = locateReference(root, options.olympiaDir, options.mapdataDir);
    const ourMaps = listAmd(oursDir);
    if (ourMaps.size === 0) {
        throw new Error(`No .amd files in ${oursDir}`);
    }
    const mpMaps = listAmd(mpDir);
    const spMaps = listAmd(spDir);
    const olympiaMaps = sources.olympiaAmd ? listAmd(sources.olympiaAmd) : new Map();
    const worlds = JSON.parse(fs.readFileSync(worldsPath, 'utf8'));
    const { idToMap, byMap } = indexWorlds(worlds);
    if (options.spawnSource) attachTownSpawns(byMap, idToMap, parseTownSpawns(options.spawnSource));
    if (options.recallSource) attachTownSpawns(byMap, idToMap, parseRecallPads(options.recallSource));

    const rows = [];
    for (const [name, file] of ourMaps) {
        const buf = fs.readFileSync(file);
        const bucket = byMap.get(name) ?? { map: name, worldIds: [], teleports: [], recall: [], npcs: [], dwells: [], landings: [] };
        const local = auditMap(buf, bucket);
        let olympia = null;
        const olympiaPath = olympiaMaps.get(name);
        if (olympiaPath) {
            const other = fs.readFileSync(olympiaPath);
            olympia = diffAmdBuffers(buf, other);
            if (sources.mapdata) {
                const mapdataPath = findMapdataFile(sources.mapdata, name);
                if (mapdataPath) olympia.spawn = compareSpawnConfig(parseMapdata(fs.readFileSync(mapdataPath, 'utf8')), bucket);
            }
        } else if (sources.mapdata) {
            const mapdataPath = findMapdataFile(sources.mapdata, name);
            if (mapdataPath) {
                olympia = {
                    counts: { tile: null, object: null, collision: null, teleport: null, extentCells: null, changed: 0 },
                    spawn: compareSpawnConfig(parseMapdata(fs.readFileSync(mapdataPath, 'utf8')), bucket),
                    samples: {},
                };
            }
        }
        let copy = null;
        const spPath = spMaps.get(name);
        if (spPath) {
            const diff = diffAmdBuffers(buf, fs.readFileSync(spPath));
            if (diff.counts.changed > 0 || diff.counts.extentCells > 0) copy = diff;
        }
        const row = {
            name,
            file,
            buf,
            worldIds: bucket.worldIds,
            local,
            olympia,
            copy,
            probes: [],
            components: null,
            eastWall: null,
        };
        row.score = suspicionScore(row);
        rows.push(row);
    }
    rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    const focus = new Set(['elvine', 'elvuni', 'aresden', ...rows.slice(0, 3).map((row) => row.name)]);
    for (const row of rows) {
        if (!focus.has(row.name)) continue;
        const header = row.local.header;
        row.components = {
            walkable: largestComponent(row.buf, header, (cell) => isWalkableWallCell(cell)),
        };
        for (const [label, x, y] of NAMED_PROBES[row.name] ?? []) {
            row.probes.push({ label, x, y, text: describeCell(row.buf, header, x, y) });
        }
        if (row.name === 'elvuni') {
            row.eastWall = scanStrip(row.buf, header, Array.from({ length: 9 }, (_, i) => [176, 20 + i]));
        }
    }

    const mpDrift = [];
    for (const [name, file] of ourMaps) {
        const other = mpMaps.get(name);
        if (!other) {
            mpDrift.push({ name, diff: { counts: { changed: -1, tile: 0, object: 0, collision: 0, teleport: 0, extentCells: 0 } } });
            continue;
        }
        const diff = diffAmdBuffers(fs.readFileSync(file), fs.readFileSync(other));
        if (diff.counts.changed > 0 || diff.counts.extentCells > 0) mpDrift.push({ name, diff });
    }
    const spDrift = rows.filter((row) => row.copy).map((row) => ({ name: row.name, diff: row.copy }));
    spDrift.sort((a, b) => b.diff.counts.changed - a.diff.counts.changed);

    const referenced = new Set(byMap.keys());
    const missingAmdForWorlds = [];
    for (const [worldId, map] of idToMap) {
        if (!ourMaps.has(map)) missingAmdForWorlds.push({ worldId, map });
    }
    const orphanAmd = [...ourMaps.keys()].filter((name) => !referenced.has(name)).sort();
    const olympiaOnly = [...olympiaMaps.keys()].filter((name) => !ourMaps.has(name)).sort();
    const oursOnly = sources.olympiaAmd ? [...ourMaps.keys()].filter((name) => !olympiaMaps.has(name)).sort() : [];

    let mapdataNames = [];
    if (sources.mapdata) {
        mapdataNames = fs.readdirSync(sources.mapdata)
            .filter((name) => name.toLowerCase().endsWith('.txt'))
            .map((name) => name.slice(0, -4).toLowerCase());
    }
    const mapdataOnly = mapdataNames.filter((name) => !ourMaps.has(normalizeMapId(name))).sort();
    const mapsWithoutMapdata = sources.mapdata
        ? [...ourMaps.keys()].filter((name) => !findMapdataFile(sources.mapdata, name)).sort()
        : [];

    const byName = new Map(rows.map((row) => [row.name, row]));
    const imageNames = [];
    for (const name of ['elvine', 'elvuni', 'aresden']) {
        if (byName.has(name)) imageNames.push(name);
    }
    for (const row of rows) {
        if (imageNames.length >= (options.top ?? 8)) break;
        if (!imageNames.includes(row.name)) imageNames.push(row.name);
    }

    const images = [];
    if (!options.noImages && options.imagesDir) {
        fs.mkdirSync(options.imagesDir, { recursive: true });
        const prefix = options.imagePrefix ?? options.imagesDir;
        for (const name of imageNames) {
            const row = byName.get(name);
            const fileName = `${name}.png`;
            const dest = path.join(options.imagesDir, fileName);
            const href = `${prefix.replace(/\/$/, '')}/${fileName}`;
            const olympiaPath = olympiaMaps.get(name);
            const spPath = spMaps.get(name);
            let caption;
            let right = null;
            if (olympiaPath) {
                right = fs.readFileSync(olympiaPath);
                caption = 'ours | Olympia | diff';
            } else if (row.copy && spPath) {
                right = fs.readFileSync(spPath);
                caption = 'server | sp-client | diff (not Olympia)';
            } else {
                caption = 'server classification | collision only | wall sprites (Olympia map absent)';
            }
            const spawnKeys = new Set([
                ...(byMap.get(name)?.recall ?? []).map((pad) => `${pad.x},${pad.y}`),
                ...(byMap.get(name)?.npcs ?? []).map((npc) => `${npc.x},${npc.y}`),
                ...(byMap.get(name)?.landings ?? []).map((landing) => `${landing.x},${landing.y}`),
            ]);
            renderComparisonPng(dest, row.buf, right, spawnKeys);
            images.push({ name, href, caption, dest });
        }
    }

    const result = {
        root,
        generatedAt: options.generatedAt ?? new Date().toISOString(),
        paths: { ours: oursDir, mp: mpDir, sp: spDir, worlds: worldsPath },
        sources,
        ourMaps,
        olympiaMaps,
        rows,
        mpDrift,
        spDrift,
        missingAmdForWorlds,
        orphanAmd,
        olympiaOnly,
        oursOnly,
        mapdataOnly,
        mapsWithoutMapdata,
        images,
        elvineNarrative: '',
    };
    result.elvineNarrative = elvineNarrative(result, byName.get('elvine'), byName.get('elvuni'));
    result.markdown = buildReport(result);
    for (const row of rows) delete row.buf;
    return result;
}

function parseArgs(argv) {
    const options = { noImages: false, strict: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const next = () => argv[++i];
        if (arg === '--no-images') options.noImages = true;
        else if (arg === '--strict') options.strict = true;
        else if (arg === '--ours') options.oursDir = path.resolve(next());
        else if (arg === '--olympia') options.olympiaDir = path.resolve(next());
        else if (arg === '--mapdata') options.mapdataDir = path.resolve(next());
        else if (arg === '--report') options.report = path.resolve(next());
        else if (arg === '--images') options.imagesDir = path.resolve(next());
        else if (arg === '--image-prefix') options.imagePrefix = next();
        else if (arg === '--out') {
            const dir = path.resolve(next());
            options.report = path.join(dir, 'report.md');
            options.imagesDir = path.join(dir, 'images');
        } else if (arg === '--top') options.top = Number(next());
        else if (arg === '--help') options.help = true;
        else throw new Error(`Unknown argument ${arg}`);
    }
    return options;
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        console.log('node tools/map-diff.mjs [--olympia dir] [--mapdata dir] [--report file] [--images dir] [--no-images] [--strict]');
        return;
    }
    if (!options.report && !options.imagesDir) {
        const dir = path.join(repoRoot, 'tools/map-diff-out');
        options.report = path.join(dir, 'report.md');
        options.imagesDir = path.join(dir, 'images');
    }
    options.spawnSource = fs.readFileSync(path.join(repoRoot, 'multiplayer/server/Helpers/Spawn.cs'), 'utf8');
    options.recallSource = fs.readFileSync(path.join(repoRoot, 'multiplayer/server/Helpers/Recall.cs'), 'utf8');
    const result = run(options);
    if (options.report) {
        fs.mkdirSync(path.dirname(options.report), { recursive: true });
        fs.writeFileSync(options.report, result.markdown);
    }
    for (const image of result.images) {
        if (!fs.existsSync(image.dest)) throw new Error(`Missing image ${image.dest}`);
    }
    console.log(`maps ${result.ourMaps.size} olympiaAmd ${result.sources.olympiaAmd ? 'yes' : 'MISSING'} mapdata ${result.sources.mapdata ? 'yes' : 'MISSING'}`);
    console.log('top:');
    for (const row of result.rows.slice(0, 8)) {
        console.log(`  ${row.score.toFixed(1).padStart(8)}  ${row.name}  ${localSummary(row.local.stats)}`);
    }
    if (options.report) console.log(`report ${options.report}`);
    if (result.sources.olympiaAmd === null || result.sources.mapdata === null) {
        console.log('Olympia reference incomplete — tile/object/collision and/or teleport/spawn columns are unset.');
    }
    if (options.strict && (!result.sources.olympiaAmd || !result.sources.mapdata)) {
        process.exitCode = 2;
    }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
