import {
    normalizeMapId,
    resolveTeleportDestination,
    type MapTeleportDestination,
} from '../../../../sp-client/src/constants/MapTeleportLocs';

const ARESDEN_INTERIOR_WORLDS = new Set([
    'areshop',
    'arebsmith',
    'aregldhall',
    'arecityhall',
    'arewrus',
    'arecmdhall',
    'arecath',
    'arewzdtwr',
]);

const ELVINE_INTERIOR_WORLDS = new Set([
    'elvshop',
    'elvbsmith',
    'elvgldhall',
    'elvcityhall',
    'elvwrus',
    'elvcmdhall',
    'elvcath',
    'elvwzdtwr',
]);

const ARESDEN_INTERIOR_TARGETS: Record<string, string> = {
    gshop_1: 'areshop',
    bsmith_1: 'arebsmith',
    gldhall_1: 'aregldhall',
    cityhall_1: 'arecityhall',
    wrhus_1: 'arewrus',
    cmdhall_1: 'arecmdhall',
    cath_1: 'arecath',
    wzdtwr_1: 'arewzdtwr',
};

const ELVINE_INTERIOR_TARGETS: Record<string, string> = {
    gshop_1: 'elvshop',
    bsmith_1: 'elvbsmith',
    gldhall_1: 'elvgldhall',
    cityhall_1: 'elvcityhall',
    wrhus_1: 'elvwrus',
    cmdhall_1: 'elvcmdhall',
    cath_1: 'elvcath',
    wzdtwr_1: 'elvwzdtwr',
};

const DIRECT_TARGET_WORLD: Record<string, string> = {
    middleland: 'middleland',
    '2ndmiddle': 'promiseland',
    aresden: 'aresden',
    elvine: 'elvine',
    middled1x: 'middled1x',
    aresdend1: 'aresdend1',
    elvined1: 'elvined1',
    arefarm: 'arefarm',
    elvfarm: 'elvfarm',
    arebrk11: 'arebrk11',
    elvbrk11: 'elvbrk11',
    arejail: 'arejail',
    elvjail: 'elvjail',
};

export interface OlympiaServerWorldTransfer {
    worldId: string;
    mapName: string;
    spawnX: number;
    spawnY: number;
}

function getLastOutdoorMapForInterior(gameWorldId: string): string | undefined {
    if (ARESDEN_INTERIOR_WORLDS.has(gameWorldId)) {
        return 'aresden';
    }
    if (ELVINE_INTERIOR_WORLDS.has(gameWorldId)) {
        return 'elvine';
    }
    return undefined;
}

function resolveTargetWorldId(sourceMapId: string, targetMap: string): string | null {
    if (sourceMapId === 'aresden') {
        return ARESDEN_INTERIOR_TARGETS[targetMap] ?? DIRECT_TARGET_WORLD[targetMap] ?? null;
    }
    if (sourceMapId === 'elvine') {
        return ELVINE_INTERIOR_TARGETS[targetMap] ?? DIRECT_TARGET_WORLD[targetMap] ?? null;
    }
    return DIRECT_TARGET_WORLD[targetMap] ?? targetMap;
}

/**
 * Resolves Olympia warp data (MapTeleportLocs) to multiplayer server world ids.
 * Authoritative for client warp triggers; server still validates via GameWorlds.json.
 */
export function resolveOlympiaServerWorldTransfer(
    gameWorldId: string,
    mapName: string,
    x: number,
    y: number,
): OlympiaServerWorldTransfer | null {
    const sourceMapId = normalizeMapId(mapName);
    const lastOutdoorMap = getLastOutdoorMapForInterior(gameWorldId);
    const destination = resolveTeleportDestination(sourceMapId, x, y, lastOutdoorMap);
    if (!destination) {
        return null;
    }

    const worldId = resolveTargetWorldId(sourceMapId, normalizeMapId(destination.targetMap));
    if (!worldId) {
        console.warn(
            `[OlympiaTeleport] No server world for ${sourceMapId}(${x},${y}) → ${destination.targetMap}`,
        );
        return null;
    }

    return {
        worldId,
        mapName: normalizeMapId(destination.targetMap),
        spawnX: destination.targetX,
        spawnY: destination.targetY,
    };
}

/** @internal Exported for tests / debug overlays */
export function describeOlympiaTeleportDestination(
    gameWorldId: string,
    mapName: string,
    x: number,
    y: number,
): MapTeleportDestination | undefined {
    const sourceMapId = normalizeMapId(mapName);
    const lastOutdoorMap = getLastOutdoorMapForInterior(gameWorldId);
    return resolveTeleportDestination(sourceMapId, x, y, lastOutdoorMap);
}