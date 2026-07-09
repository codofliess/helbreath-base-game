/**
 * Generates per-monster loot tables for Monsters.json from Olympia Server.cpp drop rules.
 * Uses MP item IDs (Items.json). Independent rolls match MonsterLoot.cs semantics.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const monstersPath = path.join(root, 'multiplayer/server/Config/Monsters.json');
const itemsPath = path.join(root, 'multiplayer/server/Config/Items.json');

const GOLD_ID = 35;
const RED_POTION_ID = 36;
const GREEN_POTION_ID = 167;
const BLUE_POTION_ID = 165;

const itemIds = new Set(JSON.parse(fs.readFileSync(itemsPath, 'utf8')).map((i) => i.id));

/** Olympia NPC type by MP catalog sprite. */
const OLYMPIA_TYPE_BY_SPRITE = {
    ettin: 59,
    slm: 10,
    ant: 16,
    amp: 22,
    barlog: 70,
    bunny: 55,
    beholder: 53,
    canplant: 60,
    cat: 56,
    centaurus: 71,
    cla: 23,
    clawturtle: 72,
    cyc: 13,
    darkelf: 54,
    demon: 31,
    frost: 63,
    gagoyle: 52,
    giantcrayfish: 74,
    giantfrog: 57,
    giantlizard: 75,
    giantplant: 76,
    gol: 12,
    helb: 27,
    hellclaw: 49,
    icegolem: 65,
    mastermageorc: 77,
    minotaurs: 78,
    mtgiant: 58,
    nizie: 79,
    orc: 14,
    direboar: 62,
    firewyvern: 73,
    wyvern: 66,
    liche: 30,
    orge: 29,
    rudolph: 61,
    scp: 17,
    ske: 11,
    stalker: 48,
    tigerworm: 50,
    troll: 28,
    unicorn: 32,
    werewolf: 33,
    zom: 18,
    yspro: 81,
};

/** Olympia gen tier used for magic roll caps (Server.cpp NpcDeadItemGenerator). */
const GEN_LEVEL_BY_OLYMPIA = {
    10: 1, 16: 1, 22: 1, 55: 1, 56: 1,
    11: 2, 14: 2, 17: 2, 18: 2,
    12: 3, 23: 3,
    27: 4, 61: 4,
    72: 5, 76: 5, 74: 5, 13: 5, 28: 5, 53: 5, 60: 5, 62: 5,
    29: 6, 33: 6, 48: 6, 54: 6, 65: 6, 78: 6,
    70: 7, 71: 7, 30: 7, 63: 7, 79: 7,
    31: 8, 32: 8, 49: 8, 50: 8, 52: 8,
    58: 9,
    77: 10, 59: 10, 75: 10,
    66: 8, 73: 8, 81: 10,
};

/** Gold drop tuning per gen tier (approximates NpcDeadItemGenerator ~21% gold branch). */
const GOLD_BY_GEN = {
    1: { chance: 0.55, minQuantity: 1, maxQuantity: 4 },
    2: { chance: 0.6, minQuantity: 2, maxQuantity: 6 },
    3: { chance: 0.65, minQuantity: 3, maxQuantity: 8 },
    4: { chance: 0.7, minQuantity: 4, maxQuantity: 10 },
    5: { chance: 0.75, minQuantity: 5, maxQuantity: 14 },
    6: { chance: 0.8, minQuantity: 6, maxQuantity: 18 },
    7: { chance: 0.82, minQuantity: 7, maxQuantity: 22 },
    8: { chance: 0.85, minQuantity: 8, maxQuantity: 26 },
    9: { chance: 0.88, minQuantity: 8, maxQuantity: 30 },
    10: { chance: 0.9, minQuantity: 8, maxQuantity: 35 },
};

/** Standard potion branch (~5% of kills). */
function potionDrops(genLevel) {
    const scale = Math.min(1, 0.5 + genLevel * 0.05);
    return [
        { itemId: RED_POTION_ID, chance: 0.12 * scale, minQuantity: 1, maxQuantity: 2 },
        { itemId: GREEN_POTION_ID, chance: 0.08 * scale, minQuantity: 1, maxQuantity: 1 },
        { itemId: BLUE_POTION_ID, chance: 0.06 * scale, minQuantity: 1, maxQuantity: 1 },
    ].filter((d) => itemIds.has(d.itemId));
}

/** Magic gear pools by gen tier — MP item ids that accept Olympia magic rolls. */
const GEAR_POOL_BY_GEN = {
    1: [3, 4, 5, 6, 7, 12],
    2: [3, 4, 5, 6, 7, 39, 44, 125],
    3: [5, 6, 39, 44, 70, 125, 126],
    4: [5, 6, 39, 44, 70, 77, 125, 126],
    5: [5, 6, 39, 44, 70, 77, 78, 125, 126, 131],
    6: [5, 6, 39, 44, 70, 77, 78, 79, 125, 126, 131, 133],
    7: [5, 6, 39, 44, 70, 77, 78, 79, 85, 125, 126, 131, 133, 150],
    8: [1, 5, 6, 39, 44, 70, 77, 78, 79, 85, 125, 126, 131, 133, 150, 151],
    9: [1, 5, 6, 39, 44, 70, 77, 78, 79, 85, 125, 126, 131, 133, 150, 151, 154],
    10: [1, 5, 6, 39, 44, 70, 77, 78, 79, 85, 125, 126, 131, 133, 150, 151, 154, 155],
};

function gearDrops(genLevel) {
    const pool = (GEAR_POOL_BY_GEN[genLevel] ?? GEAR_POOL_BY_GEN[5]).filter((id) => itemIds.has(id));
    const base = 0.14 - genLevel * 0.008;
    return pool.map((itemId, idx) => ({
        itemId,
        chance: Math.max(0.002, base * Math.pow(0.72, idx)),
        minQuantity: 1,
        maxQuantity: 1,
    }));
}

/** Material & rare drops from DeleteNpc / bGetItemNameWhenDeleteNpc (MP ids). */
const MATERIAL_BY_OLYMPIA = {
    10: [{ itemId: 208, chance: 0.04 }], // SlimeJelly -> mapped
    11: [
        { itemId: 207, chance: 0.05 },
        { itemId: 334, chance: 0.0013 },
        { itemId: 336, chance: 0.0013 },
    ],
    12: [
        { itemId: 209, chance: 0.033 },
        { itemId: 738, chance: 0.0015 },
    ],
    13: [
        { itemId: 183, chance: 0.028 },
        { itemId: 311, chance: 0.0014 },
    ],
    14: [
        { itemId: 210, chance: 0.091 },
        { itemId: 334, chance: 0.0011 },
    ],
    16: [
        { itemId: 192, chance: 0.111 },
        { itemId: 193, chance: 0.1 },
    ],
    17: [
        { itemId: 215, chance: 0.02 },
        { itemId: 334, chance: 0.001 },
    ],
    18: [{ itemId: 613, chance: 0.002 }],
    22: [
        { itemId: 188, chance: 0.067 },
        { itemId: 639, chance: 0.0013 },
    ],
    23: [{ itemId: 205, chance: 0.033 }],
    27: [
        { itemId: 199, chance: 0.025 },
        { itemId: 311, chance: 0.0014 },
    ],
    28: [
        { itemId: 222, chance: 0.029 },
        { itemId: 334, chance: 0.0014 },
    ],
    29: [
        { itemId: 209, chance: 0.05 },
        { itemId: 632, chance: 0.001 },
    ],
    30: [
        { itemId: 380, chance: 0.067 },
        { itemId: 648, chance: 0.0013 },
    ],
    31: [
        { itemId: 491, chance: 0.067 },
        { itemId: 633, chance: 0.0013 },
    ],
    32: [{ itemId: 620, chance: 0.0013 }],
    33: [
        { itemId: 551, chance: 0.033 },
        { itemId: 852, chance: 0.0013 },
    ],
    48: [{ itemId: 852, chance: 0.0015 }],
    49: [{ itemId: 308, chance: 0.025 }],
    50: [{ itemId: 614, chance: 0.025 }],
    52: [{ itemId: 610, chance: 0.0013 }],
    53: [{ itemId: 380, chance: 0.01 }],
    54: [{ itemId: 618, chance: 0.0013 }],
    58: [{ itemId: 761, chance: 0.0015 }],
    59: [
        { itemId: 735, chance: 0.00042 },
        { itemId: 853, chance: 0.0013 },
        { itemId: 382, chance: 0.0043 },
    ],
    60: [],
    61: [],
    62: [],
    63: [
        { itemId: 943, chance: 0.0013 },
        { itemId: 732, chance: 0.0011 },
    ],
    65: [],
    66: [],
    70: [
        { itemId: 382, chance: 0.012 },
        { itemId: 732, chance: 0.0011 },
    ],
    71: [
        { itemId: 735, chance: 0.0013 },
        { itemId: 732, chance: 0.0011 },
    ],
    72: [],
    73: [],
    74: [],
    75: [],
    76: [],
    77: [],
    78: [],
    79: [
        { itemId: 943, chance: 0.0013 },
        { itemId: 732, chance: 0.0011 },
    ],
    81: [],
};

const NO_LOOT_SPRITES = new Set([
    'guard', 'dummy', 'gt-arrow', 'gt-cannon', 'abs', 'bg', 'ghk', 'ghkabs',
    'lwb', 'tk', 'tpknight', 'darkknight', 'elfmaster', 'detector', 'scarecrow',
    'tentocle', 'sorceress', 'unicorn', 'rudolph', 'cat', 'bunny', 'barbarian',
]);

function buildLoot(sprite) {
    if (NO_LOOT_SPRITES.has(sprite)) return null;
    const olympia = OLYMPIA_TYPE_BY_SPRITE[sprite];
    if (!olympia) return null;
    const genLevel = GEN_LEVEL_BY_OLYMPIA[olympia] ?? 5;
    const gold = GOLD_BY_GEN[genLevel];
    const loot = [
        { itemId: GOLD_ID, ...gold },
        ...potionDrops(genLevel),
        ...gearDrops(genLevel),
        ...(MATERIAL_BY_OLYMPIA[olympia] ?? []).map((e) => ({
            itemId: e.itemId,
            chance: e.chance,
            minQuantity: 1,
            maxQuantity: 1,
        })),
    ].filter((e) => itemIds.has(e.itemId));

    // Deduplicate by itemId keeping max chance
    const byId = new Map();
    for (const e of loot) {
        const prev = byId.get(e.itemId);
        if (!prev || e.chance > prev.chance) byId.set(e.itemId, e);
    }
    return {
        genLevel,
        loot: [...byId.values()].sort((a, b) => b.chance - a.chance),
    };
}

const monsters = JSON.parse(fs.readFileSync(monstersPath, 'utf8'));
let updated = 0;
for (const m of monsters) {
    if (m.sprite === 'ettin') {
        m.genLevel = 10;
        continue;
    }
    const built = buildLoot(m.sprite);
    if (!built) continue;
    m.genLevel = built.genLevel;
    m.loot = built.loot;
    updated++;
}

fs.writeFileSync(monstersPath, JSON.stringify(monsters, null, 2) + '\n');
console.log(`Updated ${updated} monsters (+ Ettin genLevel) in ${monstersPath}`);