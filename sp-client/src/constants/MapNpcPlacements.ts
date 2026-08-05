import { getNPCData } from './NPCs';
import { normalizeMapId } from './MapTeleportLocs';

/**
 * A stationary NPC placed on a specific map (Helbreath interior buildings and outdoor zones).
 */
export type NpcRole = 'generic' | 'magic-shop' | 'quest-giver' | 'city-guard' | 'shop' | 'city-hall';

export interface MapNpcPlacement {
    /** Sprite basename without extension (e.g. 'shopkpr') */
    sprite: string;
    /** Display name shown in UI */
    displayName: string;
    /** World tile X */
    x: number;
    /** World tile Y */
    y: number;
    /** Facing direction 0-7 (matches NPC sprite sheet index) */
    direction: number;
    /** Line shown when the player talks to this NPC */
    greeting?: string;
    /** Special interaction role */
    role?: NpcRole;
    /** Olympia person id — links to quest definitions */
    personId?: number;
}

/**
 * All NPC placements keyed by normalized map id.
 * Positions from Helbreath Olympia persons.json. City outdoor guards live in server dwellAreas (TP plaza).
 */
export const MAP_NPC_PLACEMENTS: Record<string, MapNpcPlacement[]> = {
    // --- Interior buildings ---
    // Classic Helbreath waypoint / chimney-counter stand (gshop_1.txt waypoint 59,42)
    gshop_1: [{ sprite: 'shopkpr', displayName: 'Shop Keeper', x: 59, y: 42, direction: 4, role: 'shop' }],
    gshop_2: [{ sprite: 'shopkpr', displayName: 'Shop Keeper', x: 59, y: 42, direction: 4, role: 'shop' }],
    bsmith_1: [{ sprite: 'tom', displayName: 'Tom', x: 48, y: 33, direction: 7 }],
    bsmith_2: [{ sprite: 'tom', displayName: 'Tom', x: 48, y: 33, direction: 7 }],
    gldhall_1: [{ sprite: 'howard', displayName: 'Howard', x: 48, y: 38, direction: 4 }],
    gldhall_2: [{ sprite: 'howard', displayName: 'Howard', x: 48, y: 38, direction: 4 }],
    cityhall_1: [{
        sprite: 'kennedy', displayName: 'City Hall Officer', x: 45, y: 43, direction: 4,
        role: 'city-hall', personId: 7,
        greeting: 'Welcome to City Hall. How may I help you?',
    }],
    cityhall_2: [{
        sprite: 'kennedy', displayName: 'City Hall Officer', x: 45, y: 43, direction: 4,
        role: 'city-hall', personId: 7,
        greeting: 'Welcome to City Hall. How may I help you?',
    }],
    wrhus_1: [{ sprite: 'william', displayName: 'William', x: 48, y: 37, direction: 4, role: 'city-hall', personId: 6 }],
    wrhus_2: [{ sprite: 'william', displayName: 'William', x: 48, y: 37, direction: 4, role: 'city-hall', personId: 6 }],
    cmdhall_1: [{ sprite: 'perry', displayName: 'Perry', x: 57, y: 39, direction: 4 }],
    cmdhall_2: [{ sprite: 'perry', displayName: 'Perry', x: 57, y: 39, direction: 4 }],
    cath_1: [{ sprite: 'gail', displayName: 'Gail', x: 43, y: 36, direction: 4 }],
    cath_2: [{ sprite: 'gail', displayName: 'Gail', x: 43, y: 36, direction: 4 }],
    wzdtwr_1: [{
        sprite: 'gandlf', displayName: 'Gandalf', x: 48, y: 33, direction: 4,
        role: 'magic-shop',
        greeting: 'Welcome to the Wizard Tower. Study magic here.',
    }],
    wzdtwr_2: [{
        sprite: 'gandlf', displayName: 'Gandalf', x: 48, y: 33, direction: 4,
        role: 'magic-shop',
        greeting: 'Welcome to the Wizard Tower. Study magic here.',
    }],

    // --- Farm maps (beginner quests — Enzu) ---
    arefarm: [{
        sprite: 'guard', displayName: 'Enzu', x: 49, y: 97, direction: 6,
        role: 'quest-giver', personId: 1,
        greeting: 'Soy Enzu. Matá Slimes al sur y volvé para tu primera misión.',
    }],
    elvfarm: [{
        sprite: 'guard', displayName: 'Enzu', x: 118, y: 150, direction: 3,
        role: 'quest-giver', personId: 1,
        greeting: 'Soy Enzu. Matá Slimes al sur y volvé para tu primera misión.',
    }],

    // --- Garden maps (troll / unicorn quests) ---
    areuni: [{
        sprite: 'guard', displayName: 'Lysio', x: 93, y: 172, direction: 1,
        role: 'quest-giver', personId: 8,
        greeting: 'Soy Lysio. Tengo misiones de Trolls y Unicorns en el Garden.',
    }],
    elvuni: [{
        sprite: 'guard', displayName: 'Lisyo', x: 33, y: 34, direction: 3,
        role: 'quest-giver', personId: 12,
        greeting: 'Soy Lisyo. Tengo misiones de Trolls y Unicorns en el Garden.',
    }],

    // --- Middleland dungeon NPCs ---
    middled1n: [
        { sprite: 'guard', displayName: 'Daara', x: 37, y: 169, direction: 4, role: 'quest-giver', personId: 3,
          greeting: '¡Malditos Orcs! ¿Me ayudás?' },
        { sprite: 'guard', displayName: 'Oxyia', x: 150, y: 30, direction: 3, role: 'quest-giver', personId: 4,
          greeting: 'Los Elites me complican todo. ¿Una mano?' },
        { sprite: 'guard', displayName: 'Lagus', x: 99, y: 77, direction: 5, role: 'quest-giver', personId: 5,
          greeting: 'Los Scorpions son deliciosos. ¿Me traés algunos?' },
    ],

    // --- Middleland / high-level quest givers ---
    middleland: [
        { sprite: 'gandlf', displayName: 'Irenicus', x: 179, y: 225, direction: 7, role: 'quest-giver', personId: 9,
          greeting: 'Soy Irenicus. Tengo misiones de Middleland.' },
        { sprite: 'guard', displayName: 'Enzu', x: 119, y: 46, direction: 2, role: 'quest-giver', personId: 1,
          greeting: 'Soy Enzu. ¿Buscás trabajo?' },
    ],
    dglv2: [{
        sprite: 'giantlizard', displayName: 'Litzy', x: 266, y: 150, direction: 4,
        role: 'quest-giver', personId: 10,
        greeting: 'Misiones de Cyclops en Dungeon Lv2.',
    }],
    icebound: [{
        sprite: 'wyvern', displayName: 'Fooldya', x: 212, y: 42, direction: 7,
        role: 'quest-giver', personId: 11,
        greeting: 'Misiones de Icebound — Golems, Beholders y Frosts.',
    }],
    toh3: [{
        sprite: 'firewyvern', displayName: 'Moeru', x: 234, y: 252, direction: 7,
        role: 'quest-giver', personId: 13,
        greeting: 'Misiones de Tower of Hell — Demons, Gargoyles y Dark Elves.',
    }],

    // City outdoor guards are server dwell monsters (random-walk near city-hall TP plaza).
    // Do not place stationary city-guard NPCs here — fixed cells on building tiles show as balconies/roofs.
    aresden: [],
    elvine: [],
};

/**
 * Returns NPC placements for the given map, or an empty array if none are configured.
 */
export function getMapNpcPlacements(mapName: string): MapNpcPlacement[] {
    const mapId = normalizeMapId(mapName);
    return MAP_NPC_PLACEMENTS[mapId] ?? [];
}

/**
 * Resolves display name for a placement sprite, falling back to NPC catalog or title-cased sprite name.
 */
export function getMapNpcDisplayName(sprite: string, placementDisplayName?: string): string {
    if (placementDisplayName) return placementDisplayName;
    return getNPCData(sprite)?.name ?? sprite;
}

/** Default greeting when a placement does not define one. */
export function getMapNpcGreeting(
    _mapName: string,
    _sprite: string,
    displayName: string,
    placementGreeting?: string,
): string {
    return placementGreeting ?? `Greetings, traveler. I am ${displayName}.`;
}