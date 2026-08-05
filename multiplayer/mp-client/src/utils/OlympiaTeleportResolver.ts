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

    'arewrhus',

    'arecmdhall',

    'arecath',

    'arewzdtwr',

    'arefarmshop',

    'arefarmbsmith',

    'arefarmwrus',

]);



const ELVINE_INTERIOR_WORLDS = new Set([

    'elvshop',

    'elvbsmith',

    'elvgldhall',

    'elvcityhall',

    'elvwrus',

    'elvwrhus',

    'elvcmdhall',

    'elvcath',

    'elvwzdtwr',

    'elvfarmshop',

    'elvfarmbsmith',

    'elvfarmwrus',

]);

/** Farm interiors — parent outdoor is arefarm/elvfarm, not city plaza. */
const ARESDEN_FARM_INTERIOR_WORLDS = new Set(['arefarmshop', 'arefarmbsmith', 'arefarmwrus']);
const ELVINE_FARM_INTERIOR_WORLDS = new Set(['elvfarmshop', 'elvfarmbsmith', 'elvfarmwrus']);



const ARESDEN_INTERIOR_TARGETS: Record<string, string> = {

    gshop_1: 'areshop',

    bsmith_1: 'arebsmith',

    gldhall_1: 'aregldhall',

    cityhall_1: 'arecityhall',

    wrhus_1: 'arewrus',

    arewrhus: 'arewrhus',

    cmdhall_1: 'arecmdhall',

    cath_1: 'arecath',

    wzdtwr_1: 'arewzdtwr',

    gshop_1f: 'arefarmshop',

    bsmith_1f: 'arefarmbsmith',

    wrhus_1f: 'arefarmwrus',

};



const ELVINE_INTERIOR_TARGETS: Record<string, string> = {

    gshop_1: 'elvshop',

    bsmith_1: 'elvbsmith',

    gldhall_1: 'elvgldhall',

    cityhall_1: 'elvcityhall',

    wrhus_1: 'elvwrus',

    elvwrhus: 'elvwrhus',

    cmdhall_1: 'elvcmdhall',

    cath_1: 'elvcath',

    wzdtwr_1: 'elvwzdtwr',

    gshop_2f: 'elvfarmshop',

    bsmith_2f: 'elvfarmbsmith',

    wrhus_2f: 'elvfarmwrus',

};



/** Direct mapId → server worldId (outdoor / dungeon / farm). */

const DIRECT_TARGET_WORLD: Record<string, string> = {

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

    arebrk12: 'arebrk12',

    elvbrk11: 'elvbrk11',

    elvbrk12: 'elvbrk12',

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



export interface OlympiaServerWorldTransfer {

    worldId: string;

    mapName: string;

    spawnX: number;

    spawnY: number;

}



/** Maps an interior server world id back to its parent outdoor map for exit warps. */

export function getLastOutdoorMapForInterior(gameWorldId: string): string | undefined {

    if (ARESDEN_FARM_INTERIOR_WORLDS.has(gameWorldId)) {
        return 'arefarm';
    }

    if (ELVINE_FARM_INTERIOR_WORLDS.has(gameWorldId)) {
        return 'elvfarm';
    }

    if (ARESDEN_INTERIOR_WORLDS.has(gameWorldId)) {

        return 'aresden';

    }

    if (ELVINE_INTERIOR_WORLDS.has(gameWorldId)) {

        return 'elvine';

    }

    return undefined;

}



function resolveTargetWorldId(gameWorldId: string, sourceMapId: string, targetMap: string): string | null {

    const originTown = getLastOutdoorMapForInterior(gameWorldId);

    const fromAresden =

        originTown === 'aresden' ||
        originTown === 'arefarm' ||
        sourceMapId === 'aresden' ||
        sourceMapId === 'arefarm' ||
        gameWorldId === 'aresden' ||
        gameWorldId === 'arefarm' ||
        ARESDEN_FARM_INTERIOR_WORLDS.has(gameWorldId);

    const fromElvine =

        originTown === 'elvine' ||
        originTown === 'elvfarm' ||
        sourceMapId === 'elvine' ||
        sourceMapId === 'elvfarm' ||
        gameWorldId === 'elvine' ||
        gameWorldId === 'elvfarm' ||
        ELVINE_FARM_INTERIOR_WORLDS.has(gameWorldId);

    // Farm map ids (*_1f / *_2f) always map via faction tables.
    if (fromAresden && !fromElvine) {

        return ARESDEN_INTERIOR_TARGETS[targetMap] ?? DIRECT_TARGET_WORLD[targetMap] ?? null;

    }

    if (fromElvine && !fromAresden) {

        return ELVINE_INTERIOR_TARGETS[targetMap] ?? DIRECT_TARGET_WORLD[targetMap] ?? null;

    }

    // Direct farm-building map names (when outdoor resolver only has targetMap).
    if (targetMap === 'gshop_1f') return 'arefarmshop';
    if (targetMap === 'bsmith_1f') return 'arefarmbsmith';
    if (targetMap === 'wrhus_1f') return 'arefarmwrus';
    if (targetMap === 'gshop_2f') return 'elvfarmshop';
    if (targetMap === 'bsmith_2f') return 'elvfarmbsmith';
    if (targetMap === 'wrhus_2f') return 'elvfarmwrus';

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



    const worldId = resolveTargetWorldId(gameWorldId, sourceMapId, normalizeMapId(destination.targetMap));

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


