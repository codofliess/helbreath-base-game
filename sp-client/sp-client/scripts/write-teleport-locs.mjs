import fs from 'fs';
import { execSync } from 'child_process';

const generated = execSync('node scripts/gen-teleport-zones.mjs', { encoding: 'utf8' });

const header = `export interface MapTeleportDestination {
    targetMap: string;
    targetX: number;
    targetY: number;
}

type InteriorExitZone = {
    mapId: string;
    locs: readonly (readonly [number, number])[];
    exitsByTown: Record<string, readonly [string, number, number]>;
};

`;

const footer = `
const interiorExitLookup = new Map<string, InteriorExitZone>();
for (const zone of INTERIOR_EXIT_ZONES) {
    for (const [x, y] of zone.locs) {
        interiorExitLookup.set(\`\${zone.mapId}:\${x}:\${y}\`, zone);
    }
}

const outdoorLookup = new Map<string, MapTeleportDestination>();
for (const zone of MAP_TELEPORT_ZONES) {
    const dest: MapTeleportDestination = {
        targetMap: zone.targetMap,
        targetX: zone.targetX,
        targetY: zone.targetY,
    };
    for (const [x, y] of zone.locs) {
        outdoorLookup.set(\`\${zone.mapId}:\${x}:\${y}\`, dest);
    }
}

/** Strips registry/cache prefixes so \`map-aresden\`, \`aresden.amd\`, and \`aresden\` all become \`aresden\`. */
export function normalizeMapId(raw: string): string {
    let id = raw.trim();
    if (id.startsWith('map-')) {
        id = id.slice(4);
    }
    if (id.toLowerCase().endsWith('.amd')) {
        id = id.slice(0, -4);
    }
    return id;
}

export function isTownMapId(mapId: string): boolean {
    return (TOWN_MAP_IDS as readonly string[]).includes(normalizeMapId(mapId));
}

export function isInteriorMapId(mapId: string): boolean {
    return INTERIOR_EXIT_ZONES.some((zone) => zone.mapId === normalizeMapId(mapId));
}

export function getTeleportLookupKey(mapId: string, x: number, y: number): string {
    return \`\${normalizeMapId(mapId)}:\${x}:\${y}\`;
}

/** Returns the exit/warp door tiles for a shared interior map (used to find a safe entry spawn). */
export function getInteriorDoorTiles(mapId: string): readonly (readonly [number, number])[] {
    const normalized = normalizeMapId(mapId);
    const zone = INTERIOR_EXIT_ZONES.find((entry) => entry.mapId === normalized);
    return zone?.locs ?? [];
}

/** Returns all warp tiles in the outdoor cluster containing (x, y), for safe exit spawns. */
export function getOutdoorWarpClusterTiles(mapId: string, x: number, y: number): readonly (readonly [number, number])[] {
    const normalized = normalizeMapId(mapId);
    for (const zone of MAP_TELEPORT_ZONES) {
        if (normalizeMapId(zone.mapId) !== normalized) {
            continue;
        }
        if (zone.locs.some(([lx, ly]) => lx === x && ly === y)) {
            return zone.locs;
        }
    }
    return [];
}

const knownWarpCells = new Set<string>();
for (const zone of MAP_TELEPORT_ZONES) {
    for (const [x, y] of zone.locs) {
        knownWarpCells.add(getTeleportLookupKey(zone.mapId, x, y));
    }
}
for (const zone of INTERIOR_EXIT_ZONES) {
    for (const [x, y] of zone.locs) {
        knownWarpCells.add(getTeleportLookupKey(zone.mapId, x, y));
    }
}

/** True when (x, y) is a configured warp cell (blue tile) on this map. */
export function isKnownWarpCell(mapId: string, x: number, y: number): boolean {
    return knownWarpCells.has(getTeleportLookupKey(mapId, x, y));
}

/** Returns warp door tiles for a cell — outdoor building entrance or interior exit door. */
export function getKnownWarpClusterTiles(mapId: string, x: number, y: number): readonly (readonly [number, number])[] {
    const outdoor = getOutdoorWarpClusterTiles(mapId, x, y);
    if (outdoor.length > 0) {
        return outdoor;
    }
    const normalized = normalizeMapId(mapId);
    const interior = INTERIOR_EXIT_ZONES.find((zone) => zone.mapId === normalized);
    if (interior?.locs.some(([lx, ly]) => lx === x && ly === y)) {
        return interior.locs;
    }
    return [];
}

export function resolveTeleportDestination(
    mapId: string,
    x: number,
    y: number,
    lastOutdoorMap?: string,
): MapTeleportDestination | undefined {
    const normalizedMapId = normalizeMapId(mapId);
    const key = getTeleportLookupKey(normalizedMapId, x, y);

    const outdoor = outdoorLookup.get(key);
    if (outdoor) {
        return outdoor;
    }

    const exitZone = interiorExitLookup.get(key);
    if (!exitZone) {
        return undefined;
    }

    const townKey = normalizeMapId(lastOutdoorMap ?? 'aresden');
    const exit = exitZone.exitsByTown[townKey] ?? exitZone.exitsByTown.aresden;
    if (!exit) {
        return undefined;
    }
    return { targetMap: exit[0], targetX: exit[1], targetY: exit[2] };
}
`;

const content = header + generated.replace('// AUTO-GENERATED ZONES\n', '') + footer;
fs.writeFileSync('src/constants/MapTeleportLocs.ts', content, 'utf8');
console.log('Wrote src/constants/MapTeleportLocs.ts');