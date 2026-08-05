/**
 * Syncs Olympia teleports + city guards from sp-client MapTeleportLocs / MapNpcPlacements
 * into multiplayer server GameWorlds.json.
 *
 * Replaces teleportLocs per world (no merge) to avoid duplicate cells / wrong targets.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverConfigDir = path.join(__dirname, '..', 'Config');
const spClientSrc = path.join(__dirname, '..', '..', '..', 'sp-client', 'src', 'constants');

const ARESDEN_INTERIOR_TARGETS = {
    gshop_1: 'areshop',
    bsmith_1: 'arebsmith',
    gldhall_1: 'aregldhall',
    cityhall_1: 'arecityhall',
    wrhus_1: 'arewrus',
    arewrhus: 'arewrhus',
    cmdhall_1: 'arecmdhall',
    cath_1: 'arecath',
    wzdtwr_1: 'arewzdtwr',
};

const ELVINE_INTERIOR_TARGETS = {
    gshop_1: 'elvshop',
    bsmith_1: 'elvbsmith',
    gldhall_1: 'elvgldhall',
    cityhall_1: 'elvcityhall',
    wrhus_1: 'elvwrus',
    elvwrhus: 'elvwrhus',
    cmdhall_1: 'elvcmdhall',
    cath_1: 'elvcath',
    wzdtwr_1: 'elvwzdtwr',
};

/** mapId in MapTeleportLocs → GameWorlds world id (source side). */
const SOURCE_MAP_TO_WORLD = {
    default: 'traveler',
    aresden: 'aresden',
    elvine: 'elvine',
    middleland: 'middleland',
    '2ndmiddle': 'promiseland',
    arefarm: 'arefarm',
    elvfarm: 'elvfarm',
    aresdend1: 'aresdend1',
    elvined1: 'elvined1',
    huntzone1: 'huntzone1',
    huntzone2: 'huntzone2',
    huntzone3: 'huntzone3',
    huntzone4: 'huntzone4',
    middled1x: 'middled1x',
    middled1n: 'middled1n',
    toh1: 'toh1',
    toh2: 'toh2',
    icebound: 'icebound',
    areuni: 'areuni',
    elvuni: 'elvuni',
    arebrk11: 'arebrk11',
    elvbrk11: 'elvbrk11',
    arewrhus: 'arewrhus',
    elvwrhus: 'elvwrhus',
};

const DIRECT_TARGET_WORLD = {
    default: 'traveler',
    middleland: 'middleland',
    '2ndmiddle': 'promiseland',
    aresden: 'aresden',
    elvine: 'elvine',
    middled1x: 'middled1x',
    middled1n: 'middled1n',
    aresdend1: 'aresdend1',
    elvined1: 'elvined1',
    arefarm: 'arefarm',
    elvfarm: 'elvfarm',
    areuni: 'areuni',
    elvuni: 'elvuni',
    arebrk11: 'arebrk11',
    elvbrk11: 'elvbrk11',
    arejail: 'arejail',
    elvjail: 'elvjail',
    huntzone1: 'huntzone1',
    huntzone2: 'huntzone2',
    huntzone3: 'huntzone3',
    huntzone4: 'huntzone4',
    toh1: 'toh1',
    toh2: 'toh2',
    icebound: 'icebound',
    arewrhus: 'arewrhus',
    elvwrhus: 'elvwrhus',
};

function resolveTargetWorld(sourceMapId, targetMap) {
    if (sourceMapId === 'aresden' || sourceMapId === 'arewrhus') {
        return ARESDEN_INTERIOR_TARGETS[targetMap] ?? DIRECT_TARGET_WORLD[targetMap] ?? null;
    }
    if (sourceMapId === 'elvine' || sourceMapId === 'elvwrhus') {
        return ELVINE_INTERIOR_TARGETS[targetMap] ?? DIRECT_TARGET_WORLD[targetMap] ?? null;
    }
    return DIRECT_TARGET_WORLD[targetMap] ?? targetMap;
}

function loadTsConstArray(filePath, exportName) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const marker = `export const ${exportName} = `;
    const start = raw.indexOf(marker);
    if (start < 0) throw new Error(`Missing ${exportName} in ${filePath}`);
    const slice = raw.slice(start + marker.length);
    const end = slice.indexOf('] as const');
    if (end < 0) throw new Error(`Missing ] as const for ${exportName}`);
    return JSON.parse(slice.slice(0, end + 1));
}

function toTeleportEntry(locs, targetWorldId, targetX, targetY) {
    return {
        locs: locs.map(([x, y]) => ({ x, y })),
        target: {
            worldId: targetWorldId,
            loc: { x: targetX, y: targetY },
        },
    };
}

function patchWorld(worlds, worldId, patch) {
    const world = worlds.find((w) => w.id === worldId);
    if (!world) {
        console.warn(`World not found: ${worldId}`);
        return;
    }
    Object.assign(world, patch(world));
}

const teleportZones = loadTsConstArray(path.join(spClientSrc, 'MapTeleportLocs.ts'), 'MAP_TELEPORT_ZONES');
const interiorExits = loadTsConstArray(path.join(spClientSrc, 'MapTeleportLocs.ts'), 'INTERIOR_EXIT_ZONES');
const npcPlacementsRaw = fs.readFileSync(path.join(spClientSrc, 'MapNpcPlacements.ts'), 'utf8');
const npcMarker = 'export const MAP_NPC_PLACEMENTS: Record<string, MapNpcPlacement[]> = ';
const npcStart = npcPlacementsRaw.indexOf(npcMarker);
const npcSlice = npcPlacementsRaw.slice(npcStart + npcMarker.length);
const npcEnd = npcSlice.indexOf('};');
const npcPlacements = Function(`"use strict"; return (${npcSlice.slice(0, npcEnd + 1)});`)();

const gameWorldsPath = path.join(serverConfigDir, 'GameWorlds.json');
const legacyServerConfigDir = path.join(__dirname, '..', '..', '..', '..', 'multiplayer', 'server', 'Config');
const worlds = JSON.parse(fs.readFileSync(gameWorldsPath, 'utf8'));

/** Ensure faction warehouse worlds exist (MAPDATA arewrhus / elvwrhus). */
function ensureWorld(id, name, map, music) {
    if (worlds.some((w) => w.id === id)) return;
    worlds.push({ id, name, map, music, workerThread: 0, teleportLocs: [] });
    console.log(`Added missing world '${id}' (map ${map})`);
}
ensureWorld('arewrhus', 'Aresden Warehouse 2', 'arewrhus', 'aresden.mp3');
ensureWorld('elvwrhus', 'Elvine Warehouse 2', 'elvwrhus', 'elvine.mp3');

const teleportsByWorld = new Map();

function addTeleport(worldId, entry) {
    if (!teleportsByWorld.has(worldId)) {
        teleportsByWorld.set(worldId, []);
    }
    teleportsByWorld.get(worldId).push(entry);
}

for (const zone of teleportZones) {
    const sourceWorldId = SOURCE_MAP_TO_WORLD[zone.mapId];
    if (!sourceWorldId) {
        console.warn(`Skipping outdoor zone: unknown source map "${zone.mapId}"`);
        continue;
    }
    const targetWorldId = resolveTargetWorld(zone.mapId, zone.targetMap);
    if (!targetWorldId) {
        console.warn(`Skipping zone ${zone.mapId} → ${zone.targetMap}: no world mapping`);
        continue;
    }
    if (!worlds.some((w) => w.id === targetWorldId)) {
        console.warn(`Skipping zone ${zone.mapId} → ${targetWorldId}: world not in GameWorlds.json`);
        continue;
    }
    addTeleport(
        sourceWorldId,
        toTeleportEntry(zone.locs, targetWorldId, zone.targetX, zone.targetY),
    );
}

for (const exit of interiorExits) {
    const aresdenInteriorWorld = ARESDEN_INTERIOR_TARGETS[exit.mapId];
    const elvineInteriorWorld = ELVINE_INTERIOR_TARGETS[exit.mapId];
    const aresdenExit = exit.exitsByTown?.aresden;
    const elvineExit = exit.exitsByTown?.elvine;

    if (aresdenInteriorWorld && aresdenExit) {
        const [, x, y] = aresdenExit;
        addTeleport(aresdenInteriorWorld, toTeleportEntry(exit.locs, 'aresden', x, y));
    }
    if (elvineInteriorWorld && elvineExit) {
        const [, x, y] = elvineExit;
        addTeleport(elvineInteriorWorld, toTeleportEntry(exit.locs, 'elvine', x, y));
    }
}

const managedWorldIds = new Set([
    ...Object.values(SOURCE_MAP_TO_WORLD),
    ...Object.values(ARESDEN_INTERIOR_TARGETS),
    ...Object.values(ELVINE_INTERIOR_TARGETS),
]);

for (const world of worlds) {
    if (managedWorldIds.has(world.id)) {
        world.teleportLocs = teleportsByWorld.get(world.id) ?? [];
    }
}

function collectTeleportCells(teleportLocs) {
    const cells = new Set();
    for (const tl of teleportLocs ?? []) {
        for (const loc of tl.locs ?? []) {
            cells.add(`${loc.x},${loc.y}`);
        }
    }
    return cells;
}

function placeGuards(world, placements) {
    const cells = collectTeleportCells(world.teleportLocs ?? []);
    return (placements ?? [])
        .map((npc) => ({ npcId: 10, x: npc.x, y: npc.y, direction: npc.direction }))
        .filter((npc) => {
            if (!cells.has(`${npc.x},${npc.y}`)) return true;
            console.warn(`Skipping guard at (${npc.x}, ${npc.y}) — overlaps teleport in ${world.id}`);
            return false;
        });
}

patchWorld(worlds, 'aresden', (world) => ({
    npcs: placeGuards({ ...world, teleportLocs: teleportsByWorld.get('aresden') ?? [] }, npcPlacements.aresden),
}));

patchWorld(worlds, 'elvine', (world) => ({
    npcs: placeGuards({ ...world, teleportLocs: teleportsByWorld.get('elvine') ?? [] }, npcPlacements.elvine),
}));

const interiorNpcMap = {
    gshop_1: { aresden: 'areshop', elvine: 'elvshop', npcId: 0 },
    bsmith_1: { aresden: 'arebsmith', elvine: 'elvbsmith', npcId: 3 },
    gldhall_1: { aresden: 'aregldhall', elvine: 'elvgldhall', npcId: 2 },
    cityhall_1: { aresden: 'arecityhall', elvine: 'elvcityhall', npcId: 5 },
    wrhus_1: { aresden: 'arewrus', elvine: 'elvwrus', npcId: 4 },
    cmdhall_1: { aresden: 'arecmdhall', elvine: 'elvcmdhall', npcId: 8 },
    cath_1: { aresden: 'arecath', elvine: 'elvcath', npcId: 6 },
    wzdtwr_1: { aresden: 'arewzdtwr', elvine: 'elvwzdtwr', npcId: 1 },
};

const spriteToNpcId = {
    shopkpr: 0,
    gandlf: 1,
    howard: 2,
    tom: 3,
    william: 4,
    kennedy: 5,
    gail: 6,
    perry: 8,
    guard: 10,
};

for (const world of worlds) {
    if (Object.values(ARESDEN_INTERIOR_TARGETS).includes(world.id) || Object.values(ELVINE_INTERIOR_TARGETS).includes(world.id)) {
        world.npcs = (world.npcs ?? []).filter((npc) => npc.npcId !== 10);
    }
}

for (const [mapId, placements] of Object.entries(npcPlacements)) {
    const mapping = interiorNpcMap[mapId];
    if (!mapping) continue;
    for (const npc of placements) {
        const npcId = spriteToNpcId[npc.sprite] ?? mapping.npcId;
        for (const faction of ['aresden', 'elvine']) {
            const worldId = mapping[faction];
            if (!worldId) continue;
            patchWorld(worlds, worldId, (world) => ({
                npcs: [
                    ...(world.npcs ?? []).filter((existing) =>
                        !(existing.x === npc.x && existing.y === npc.y && existing.npcId === npcId),
                    ),
                    { npcId, x: npc.x, y: npc.y, direction: npc.direction },
                ],
            }));
        }
    }
}

const serialized = `${JSON.stringify(worlds, null, 2)}\n`;
fs.writeFileSync(gameWorldsPath, serialized);
if (fs.existsSync(legacyServerConfigDir)) {
    fs.writeFileSync(path.join(legacyServerConfigDir, 'GameWorlds.json'), serialized);
    console.log(`Also updated legacy ${path.join(legacyServerConfigDir, 'GameWorlds.json')}`);
}

const summary = [...managedWorldIds]
    .sort()
    .map((id) => `${id}: ${(teleportsByWorld.get(id) ?? []).length} groups`)
    .join('\n  ');
console.log('Updated GameWorlds.json — Olympia teleports replaced.\n  ' + summary);