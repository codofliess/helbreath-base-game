/**
 * Quest-giver NPC definitions from Helbreath Olympia persons.json.
 * Sprites are mapped to available .spr assets in the client.
 */

export type PlayerFaction = 'aresden' | 'elvine' | 'neutral';

export interface PersonSpawn {
    map: string;
    x: number;
    y: number;
    dir: number;
}

export interface PersonDefinition {
    id: number;
    /** Sprite basename used by the client */
    sprite: string;
    name: string;
    spawns: Partial<Record<PlayerFaction, PersonSpawn>>;
    role: 'quest-giver' | 'shop' | 'city-hall';
}

/** Maps Olympia sprite names to client sprite basenames. */
export const OLYMPIA_SPRITE_MAP: Record<string, string> = {
    'aguard-neutral': 'guard',
    'bguard-neutral': 'guard',
    'sguard-neutral': 'guard',
    gandalf: 'gandlf',
    shopkeeperw: 'shopkpr',
    giantlizard: 'giantlizard',
    wyvern: 'wyvern',
    firewyvern: 'firewyvern',
    william: 'william',
    howard: 'howard',
    kennedy: 'kennedy',
    tom: 'tom',
    gail: 'gail',
    perry: 'perry',
    gandlf: 'gandlf',
    shopkpr: 'shopkpr',
};

export function resolveOlympiaSprite(olympiaSprite: string): string {
    const key = olympiaSprite.toLowerCase();
    return OLYMPIA_SPRITE_MAP[key] ?? key;
}

export function getPlayerFaction(factionLabel: string): PlayerFaction {
    const lower = factionLabel.toLowerCase();
    if (lower.includes('aresden')) return 'aresden';
    if (lower.includes('elvine')) return 'elvine';
    return 'neutral';
}

export const PERSONS: PersonDefinition[] = [
    {
        id: 1,
        sprite: 'guard',
        name: 'Enzu',
        role: 'quest-giver',
        spawns: {
            neutral: { map: 'middleland', x: 119, y: 46, dir: 2 },
            aresden: { map: 'arefarm', x: 49, y: 97, dir: 6 },
            elvine: { map: 'elvfarm', x: 118, y: 150, dir: 3 },
        },
    },
    {
        id: 2,
        sprite: 'shopkpr',
        name: 'Kiora',
        role: 'shop',
        spawns: {
            aresden: { map: 'gshop_1', x: 59, y: 42, dir: 4 },
            elvine: { map: 'gshop_2', x: 59, y: 42, dir: 4 },
        },
    },
    {
        id: 3,
        sprite: 'guard',
        name: 'Daara',
        role: 'quest-giver',
        spawns: {
            neutral: { map: 'middled1n', x: 37, y: 169, dir: 4 },
        },
    },
    {
        id: 4,
        sprite: 'guard',
        name: 'Oxyia',
        role: 'quest-giver',
        spawns: {
            neutral: { map: 'middled1n', x: 150, y: 30, dir: 3 },
        },
    },
    {
        id: 5,
        sprite: 'guard',
        name: 'Lagus',
        role: 'quest-giver',
        spawns: {
            neutral: { map: 'middled1n', x: 99, y: 77, dir: 5 },
        },
    },
    {
        id: 6,
        sprite: 'william',
        name: 'William',
        role: 'city-hall',
        spawns: {
            aresden: { map: 'wrhus_1', x: 48, y: 37, dir: 4 },
            elvine: { map: 'wrhus_2', x: 48, y: 37, dir: 4 },
        },
    },
    {
        id: 7,
        sprite: 'kennedy',
        name: 'City Hall Officer',
        role: 'city-hall',
        spawns: {
            aresden: { map: 'cityhall_1', x: 45, y: 43, dir: 4 },
            elvine: { map: 'cityhall_2', x: 45, y: 43, dir: 4 },
        },
    },
    {
        id: 8,
        sprite: 'guard',
        name: 'Lysio',
        role: 'quest-giver',
        spawns: {
            aresden: { map: 'areuni', x: 93, y: 172, dir: 1 },
        },
    },
    {
        id: 12,
        sprite: 'guard',
        name: 'Lisyo',
        role: 'quest-giver',
        spawns: {
            elvine: { map: 'elvuni', x: 33, y: 34, dir: 3 },
        },
    },
    {
        id: 9,
        sprite: 'gandlf',
        name: 'Irenicus',
        role: 'quest-giver',
        spawns: {
            neutral: { map: 'middleland', x: 179, y: 225, dir: 7 },
        },
    },
    {
        id: 10,
        sprite: 'giantlizard',
        name: 'Litzy',
        role: 'quest-giver',
        spawns: {
            neutral: { map: 'dglv2', x: 266, y: 150, dir: 4 },
        },
    },
    {
        id: 11,
        sprite: 'wyvern',
        name: 'Fooldya',
        role: 'quest-giver',
        spawns: {
            neutral: { map: 'icebound', x: 212, y: 42, dir: 7 },
        },
    },
    {
        id: 13,
        sprite: 'firewyvern',
        name: 'Moeru',
        role: 'quest-giver',
        spawns: {
            neutral: { map: 'toh3', x: 234, y: 252, dir: 7 },
        },
    },
];

export function getPersonById(id: number): PersonDefinition | undefined {
    return PERSONS.find((p) => p.id === id);
}