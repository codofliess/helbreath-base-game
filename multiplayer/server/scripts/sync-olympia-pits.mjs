/**
 * Syncs GameWorlds.json dwellAreas from MAPDATA spot-mob-generator lines and
 * random-mob-generator level tables (expected counts), and patches Monsters.json
 * hp / attackDamage / respawnTime from reference/Npc.cfg using Olympia
 * Server.cpp formulas.
 *
 * Run: node multiplayer/server/scripts/sync-olympia-pits.mjs
 *
 * Sources:
 * - tmp-mapdata/*.txt | sp-client/reference/mapdata/*.txt
 * - reference/Npc.cfg (HitDice, ADT, ADR, RegTime)
 * - sp-client/reference/Server.cpp spot-mob type→name + Random Mob Generator tables
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..', '..');
const serverConfigDir = path.join(root, 'multiplayer', 'server', 'Config');
const mapdataDirs = [
    path.join(root, 'tmp-mapdata'),
    path.join(root, 'sp-client', 'reference', 'mapdata'),
];

/** MAPDATA Mob column (Server.cpp spot-mob switch) → our Monsters.json id. */
const OLYMPIA_MOB_TYPE_TO_CATALOG_ID = {
    10: 1, // Slime
    16: 2, // Giant-Ant → Ant
    22: 3, // Amphis → Snake
    55: 6, // Rabbit → Bunny
    56: 10, // Cat (not in spot switch by default, but present in NPC.cfg)
    7: 7, // Beholder (type 53 below)
    53: 7, // Beholder
    60: 9, // Cannibal-Plant
    71: 11, // Centaurus
    23: 12, // Clay-Golem
    72: 13, // Claw-Turtle
    13: 14, // Cyclops
    54: 15, // Dark-Elf
    31: 18, // Demon
    63: 20, // Frost
    52: 21, // Gagoyle
    74: 24, // Giant-Crayfish
    57: 25, // Giant-Frog
    75: 26, // Giant-Lizard
    76: 27, // Giant-Plant
    12: 28, // Stone-Golem
    24: 31, // Guard-Aresden (spot type ≠ NPC.cfg Tom type)
    25: 31, // Guard-Elvine
    26: 31, // Guard-Neutral
    27: 32, // Hellbound → Hellhound
    49: 33, // Hellclaw
    65: 34, // Ice-Golem
    77: 36, // MasterMage-Orc
    78: 37, // Minotaurs
    58: 38, // Mountain-Giant
    79: 39, // Nizie
    14: 40, // Orc
    62: 41, // DireBoar
    34: 42, // Dummy
    35: 42, // Attack-Dummy
    73: 43, // Fire-Wyvern
    66: 44, // Wyvern
    30: 46, // Liche
    29: 47, // Orge → Ogre
    61: 48, // Rudolph
    17: 50, // Scorpion
    11: 51, // Skeleton
    48: 53, // Stalker
    80: 54, // Tentocle
    50: 55, // Tigerworm
    28: 58, // Troll (commented in switch but in NPC.cfg)
    32: 59, // Unicorn
    33: 60, // WereWolf
    18: 61, // Zombie
    70: 5, // Barlog → Dragon
    59: 0, // Ettin
    81: 64, // Abaddon → Abaddon (incomplete)
};

/** Spot types that are town quest NPCs — skip for combat dwell. */
const SKIP_SPOT_TYPES = new Set([67, 68, 69]); // McGaffin, Perry, Devlin

/**
 * PO: city Guard spots (Olympia MAPDATA types 24/25) random-walk in a tight ring around
 * the city TP pad (landing 149,127 / 149,131), not the scattered MAPDATA rectangles.
 * Pad ≈ 3×3 centered on landing; dwell = pad expanded ≤3 tiles from pad edge; count 4/city.
 */
const CITY_GUARD_TP_PLAZA = {
    aresden: { x1: 145, y1: 123, x2: 153, y2: 131, count: 4 },
    elvine: { x1: 145, y1: 127, x2: 153, y2: 135, count: 4 },
};
const GUARD_CATALOG_ID = 31;

/** Arena / training mercenaries — keep combat out of Npc.cfg sync. */
const SKIP_COMBAT_PATCH_NAMES = new Set([
    'Training Dummy',
    'Mercenary Warrior',
    'Mercenary Mage',
]);

/** Farm barracks (Beginner Path) — not in MAPDATA spots; preserved across pit sync. */
const BARRACKS_MONSTER_IDS = new Set([42, 62, 63]);

/** map file basename (no ext) → GameWorlds world id */
const MAP_TO_WORLD = {
    aresden: 'aresden',
    elvine: 'elvine',
    arefarm: 'arefarm',
    elvfarm: 'elvfarm',
    '2ndmiddle': 'promiseland',
    middleland: 'middleland',
    icebound: 'icebound',
    aresdend1: 'aresdend1',
    elvined1: 'elvined1',
    huntzone1: 'huntzone1',
    huntzone2: 'huntzone2',
    huntzone3: 'huntzone3',
    huntzone4: 'huntzone4',
    middled1x: 'middled1x',
    toh1: 'toh1',
    toh2: 'toh2',
    toh3: 'toh3',
};

/** Expected HP from Server.cpp _bInitNpcAttr (mid of roll range). */
function expectedHp(hitDice) {
    if (hitDice <= 5) {
        // iDice(HD,4)+HD → avg HD*2.5+HD = HD*3.5
        return Math.max(1, Math.round(hitDice * 3.5));
    }
    // HD*4 + HD + iDice(1,HD) → avg HD*5 + (HD+1)/2
    return Math.max(1, Math.round(hitDice * 5 + (hitDice + 1) / 2));
}

function parseNpcCfg(text) {
    /** @type {Map<string, {type:number, hitDice:number, adt:number, adr:number, regTime:number}>} */
    const byName = new Map();
    /** @type {Map<number, {name:string, hitDice:number, adt:number, adr:number, regTime:number}>} */
    const byTypeFirst = new Map();

    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.toLowerCase().startsWith('npc')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        const parts = trimmed.slice(eq + 1).trim().split(/\s+/);
        if (parts.length < 20) continue;
        // Header (isolatorhk NPC.cfg): Name Type HitDice DR HR MinBrav ExpDice ADT ADR Size Side
        // ActionLmt ActionTime MR ML DoW Chat SrchRange RegTime Attr AbsM Mana MR AtkRange Gold
        const name = parts[0];
        const type = Number(parts[1]);
        const hitDice = Number(parts[2]);
        const adt = Number(parts[7]);
        const adr = Number(parts[8]);
        const regTime = Number(parts[18]);
        if (![type, hitDice, adt, adr, regTime].every((n) => Number.isFinite(n))) continue;
        const row = { type, hitDice, adt, adr, regTime };
        byName.set(name.toLowerCase(), row);
        if (!byTypeFirst.has(type)) {
            byTypeFirst.set(type, { name, hitDice, adt, adr, regTime });
        }
    }
    return { byName, byTypeFirst };
}

/** Catalog name → NPC.cfg name for combat stats. */
const CATALOG_NAME_TO_NPC = {
    Ettin: 'Ettin',
    Slime: 'Slime',
    Ant: 'Giant-Ant',
    Snake: 'Amphis',
    Dragon: 'Barlog',
    Bunny: 'Rabbit',
    Beholder: 'Beholder',
    'Cannibal Plant': 'Cannibal-Plant',
    Cat: 'Cat',
    Centaurus: 'Centaurus',
    'Clay Golem': 'Clay-Golem',
    'Claw Turtle': 'Claw-Turtle',
    Cyclops: 'Cyclops',
    'Dark Elf': 'Dark-Elf',
    Demon: 'Demon',
    Frost: 'Frost',
    Gargoyle: 'Gagoyle',
    "Giant Cray Fish": 'Giant-Crayfish',
    'Giant Frog': 'Giant-Frog',
    'Giant Lizard': 'Giant-Lizard',
    'Giant Tree': 'Giant-Plant',
    'Stone Golem': 'Stone-Golem',
    Guard: 'Guard-Aresden',
    Hellhound: 'Hellbound',
    Hellclaw: 'Hellclaw',
    'Ice Golem': 'Ice-Golem',
    'Master Mage Orc': 'MasterMage-Orc',
    Minotaur: 'Minotaurs',
    'Mountain Giant': 'Mountain-Giant',
    Nizie: 'Nizie',
    Orc: 'Orc',
    'Dire Boar': 'DireBoar',
    Dummy: 'Dummy',
    'Training Dummy': 'Dummy',
    'Fire Wyvern': 'Fire-Wyvern',
    Wyvern: 'Wyvern',
    Lich: 'Liche',
    Ogre: 'Orge',
    Rudolph: 'Rudolph',
    Scarecrow: 'Scarecrow',
    Scorpion: 'Scorpion',
    Skeleton: 'Skeleton',
    Stalker: 'Stalker',
    Tentocle: 'Tentocle',
    Tigerworm: 'Tigerworm',
    Troll: 'Troll',
    Unicorn: 'Unicorn',
    Werewolf: 'WereWolf',
    Zombie: 'Zombie',
    Abaddon: 'Abaddon',
    'Abaddon (incomplete)': 'Abaddon',
};

function findMapFile(baseName) {
    for (const dir of mapdataDirs) {
        for (const candidate of [
            `${baseName}.txt`,
            `${baseName}.TXT`,
            `${baseName}.Txt`,
        ]) {
            const p = path.join(dir, candidate);
            if (fs.existsSync(p)) return p;
        }
    }
    return null;
}

function parseSpotMobGenerators(mapText) {
    const spots = [];
    for (const line of mapText.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.toLowerCase().startsWith('spot-mob-generator')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        const nums = trimmed
            .slice(eq + 1)
            .trim()
            .split(/\s+/)
            .map(Number)
            .filter((n) => Number.isFinite(n));
        // Num Type x1 y1 x2 y2 Mob MobNum
        if (nums.length < 8) continue;
        const [, , x1, y1, x2, y2, mobType, mobNum] = nums;
        spots.push({
            x1: Math.min(x1, x2),
            y1: Math.min(y1, y2),
            x2: Math.max(x1, x2),
            y2: Math.max(y1, y2),
            mobType,
            count: mobNum,
        });
    }
    return spots;
}

function parseRandomMobGenerator(mapText) {
    for (const line of mapText.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) continue;
        if (!trimmed.toLowerCase().startsWith('random-mob-generator')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        const nums = trimmed
            .slice(eq + 1)
            .trim()
            .split(/\s+/)
            .map(Number)
            .filter((n) => Number.isFinite(n));
        if (nums.length >= 2) {
            return { enabled: nums[0] !== 0, level: nums[1] };
        }
    }
    return null;
}

function parseMaximumObject(mapText) {
    for (const line of mapText.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) continue;
        if (!trimmed.toLowerCase().startsWith('maximum-object')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        const n = Number(trimmed.slice(eq + 1).trim().split(/\s+/)[0]);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
}

/** Waypoint bounding box from MAPDATA (used as dwell spawn rect for random maps). */
function parseWaypointBounds(mapText, pad = 20) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const line of mapText.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) continue;
        if (!trimmed.toLowerCase().startsWith('waypoint')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        const nums = trimmed
            .slice(eq + 1)
            .trim()
            .split(/\s+/)
            .map(Number)
            .filter((n) => Number.isFinite(n));
        // Num X Y
        if (nums.length < 3) continue;
        const x = nums[1];
        const y = nums[2];
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }
    if (!Number.isFinite(minX)) return null;
    return {
        x1: Math.max(0, minX - pad),
        y1: Math.max(0, minY - pad),
        x2: maxX + pad,
        y2: maxY + pad,
    };
}

/**
 * Random-mob-generator result id → catalog monsterId (Server.cpp strcpy table ~26549).
 * Orc-Mage (6) has no separate open-world catalog row; omitted from tables we need.
 */
const RANDOM_RESULT_TO_CATALOG_ID = {
    1: 1, // Slime
    2: 2, // Giant-Ant → Ant
    3: 40, // Orc
    4: 61, // Zombie
    5: 51, // Skeleton
    7: 50, // Scorpion
    8: 28, // Stone-Golem
    9: 14, // Cyclops
    10: 3, // Amphis → Snake
    11: 12, // Clay-Golem
    12: 58, // Troll
    13: 47, // Orge → Ogre
    14: 32, // Hellbound → Hellhound
    15: 46, // Liche → Lich
    16: 18, // Demon
    17: 59, // Unicorn
    18: 60, // WereWolf
    21: 21, // Gagoyle → Gargoyle
    22: 7, // Beholder
    23: 15, // Dark-Elf
    24: 6, // Rabbit → Bunny
    25: 10, // Cat
    26: 25, // Giant-Frog
    27: 38, // Mountain-Giant
    28: 0, // Ettin
    29: 9, // Cannibal-Plant
    30: 48, // Rudolph
    31: 34, // Ice-Golem
    32: 41, // DireBoar
    33: 20, // Frost
    34: 53, // Stalker
    35: 33, // Hellclaw
    36: 44, // Wyvern
    37: 43, // Fire-Wyvern
    39: 54, // Tentocle
    40: 11, // Centaurus
    41: 26, // Giant-Lizard
    42: 37, // Minotaurs
    43: 54, // Tentocle (dup case in Server.cpp)
    44: 13, // Claw-Turtle
    45: 24, // Giant-Crayfish
    46: 27, // Giant-Plant → Giant Tree
    47: 36, // MasterMage-Orc
    48: 39, // Nizie
    49: 55, // Tigerworm
    50: 27, // Giant-Plant
    51: 64, // Abaddon → Abaddon (incomplete)
};

/**
 * Probability mass per random-result id for each RMG level.
 * Exact fractions from Server.cpp ~25911 (1..100 outer dice + nested iDice averages).
 * Only levels needed by MAPDATA in this repo (incl. level 6 for huntzone3/4).
 */
const RANDOM_LEVEL_WEIGHTS = {
    // aresdend1 / elvined1
    4: {
        2: 0.245, // Giant-Ant 49% × 1/2
        10: 0.245, // Amphis
        8: 0.15, // Stone-Golem 30% × 1/2
        11: 0.15, // Clay-Golem
        14: 0.105, // Hellbound 21% × 1/2
        9: 0.105, // Cyclops
    },
    // middled1x
    5: {
        2: 0.29, // Giant-Ant 29%
        3: 0.15, // Orc 30% × 1/2
        4: 0.15, // Zombie
        5: 0.1, // Skeleton 20% × 1/2
        7: 0.1, // Scorpion
        8: 0.1, // Stone-Golem 15% × 2/3
        11: 0.07, // Clay-Golem 15%×1/3 + 6%×1/3
        14: 0.02, // Hellbound 6% × 1/3
        9: 0.02, // Cyclops 6% × 1/3
    },
    // huntzone3 / huntzone4 — MAPDATA from isolatorhk (max-object 350, RMG level 6)
    // Bands: 1–59 (59%), 60–89 (30%), 90–100 (11%). Comments on result ids are wrong; strcpy table wins.
    6: {
        5: 0.59 / 4, // Skeleton
        6: 0.59 / 4, // Orc-Mage — catalog gap (skipped at emit)
        12: 0.59 / 4 + 0.3 / 5, // Troll (strcpy id 12)
        11: 0.59 / 4 + 0.3 / 5, // Clay-Golem (strcpy id 11)
        8: (0.3 * 2) / 5, // Stone-Golem
        43: 0.3 / 5, // Tentocle
        // High band: iDice(1,9) cases 1–8 assign; case 9 leaves outer roll → default Orc (3)
        26: 0.11 / 9,
        9: 0.11 / 9,
        13: 0.11 / 9,
        14: 0.11 / 9,
        18: 0.11 / 9,
        28: 0.11 / 9,
        27: 0.11 / 9,
        29: 0.11 / 9,
        3: 0.11 / 9, // default Orc when nested dice = 9
    },
    // toh1
    13: {
        4: 0.14, // Zombie
        14: 0.25, // Hellbound
        9: 0.2, // Cyclops
        13: 0.15, // Orge
        23: 0.2, // Dark-Elf
        22: 0.06, // Beholder
    },
    // toh2 (MAPDATA rmg 14) — Server.cpp case 14 labeled icebound but toh2 uses level 14
    14: {
        23: 0.3, // Dark-Elf 1–29
        31: 0.2, // Ice-Golem 30–49
        22: 0.2, // Beholder 50–69
        32: 0.2, // DireBoar 70–89
        33: 0.1, // Frost 90–100
    },
    // toh3 (MAPDATA rmg 15)
    15: {
        23: 0.35, // Dark-Elf 1–34
        22: 0.15, // Beholder 35–49
        15: 0.3, // Liche 50–79
        21: 0.2, // Gagoyle 80–100
    },
    // huntzone1 / huntzone2 (also 2ndmiddle when spots absent)
    16: {
        7: 0.13 + 0.16 / 3, // Scorpion 39%×1/3 + 16%×1/3
        2: 0.13, // Giant-Ant
        10: 0.13, // Amphis
        30: 0.1, // Rudolph
        5: 0.175, // Skeleton 35% × 1/2
        4: 0.175, // Zombie
        8: 0.16 / 3, // Stone-Golem
        11: 0.16 / 3, // Clay-Golem
    },
};

/** Largest-remainder allocation so rounded counts sum to totalSlots. */
function allocateExpectedCounts(weights, totalSlots) {
    const entries = Object.entries(weights).map(([resultId, w]) => {
        const exact = w * totalSlots;
        const floor = Math.floor(exact);
        return {
            resultId: Number(resultId),
            exact,
            count: floor,
            frac: exact - floor,
        };
    });
    let used = entries.reduce((n, e) => n + e.count, 0);
    let remain = totalSlots - used;
    entries.sort((a, b) => b.frac - a.frac || a.resultId - b.resultId);
    for (let i = 0; i < entries.length && remain > 0; i++) {
        entries[i].count += 1;
        remain--;
    }
    return entries
        .filter((e) => e.count > 0)
        .sort((a, b) => a.resultId - b.resultId)
        .map((e) => ({ resultId: e.resultId, count: e.count, weight: weights[e.resultId] }));
}

/**
 * Converts Olympia random-mob-generator level → dwellAreas with expected population
 * maximum-object − 30 (Server.cpp iResultNum).
 */
function randomLevelToDwellAreas(level, maximumObject, area) {
    const weights = RANDOM_LEVEL_WEIGHTS[level];
    if (!weights) {
        return {
            dwell: [],
            skipped: [{ reason: 'unmapped-random-level', level }],
            totalSlots: 0,
        };
    }
    const totalSlots = Math.max(0, maximumObject - 30);
    if (totalSlots < 1) {
        return { dwell: [], skipped: [{ reason: 'max-object-too-small', maximumObject }], totalSlots: 0 };
    }
    const allocated = allocateExpectedCounts(weights, totalSlots);
    const dwell = [];
    const skipped = [];
    for (const row of allocated) {
        if (row.resultId === 6) {
            // Orc-Mage — no open-world catalog id
            skipped.push({ reason: 'unmapped-random-result', resultId: 6, count: row.count });
            continue;
        }
        const monsterId = RANDOM_RESULT_TO_CATALOG_ID[row.resultId];
        if (monsterId === undefined) {
            skipped.push({
                reason: 'unmapped-random-result',
                resultId: row.resultId,
                count: row.count,
            });
            continue;
        }
        const entry = { monsterId, count: row.count };
        if (area) entry.area = { ...area };
        dwell.push(entry);
    }
    return { dwell, skipped, totalSlots, allocated };
}

function spotsToDwellAreas(spots, worldId = null) {
    const dwell = [];
    const skipped = [];
    let collapsedGuardCount = 0;
    for (const s of spots) {
        if (SKIP_SPOT_TYPES.has(s.mobType)) {
            skipped.push({ reason: 'town-npc', ...s });
            continue;
        }
        const monsterId = OLYMPIA_MOB_TYPE_TO_CATALOG_ID[s.mobType];
        if (monsterId === undefined) {
            skipped.push({ reason: 'unmapped-type', ...s });
            continue;
        }
        if (s.count < 1) {
            skipped.push({ reason: 'zero-count', ...s });
            continue;
        }
        // Fold city Guard MAPDATA pits into one TP-plaza dwell (PO); keep other maps as-is.
        if (monsterId === GUARD_CATALOG_ID && worldId && CITY_GUARD_TP_PLAZA[worldId]) {
            collapsedGuardCount += s.count;
            skipped.push({ reason: 'city-guard-collapsed-to-tp-plaza', ...s });
            continue;
        }
        dwell.push({
            monsterId,
            count: s.count,
            area: { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 },
        });
    }
    const plaza = worldId ? CITY_GUARD_TP_PLAZA[worldId] : null;
    if (plaza && collapsedGuardCount > 0) {
        dwell.push({
            monsterId: GUARD_CATALOG_ID,
            count: plaza.count,
            area: { x1: plaza.x1, y1: plaza.y1, x2: plaza.x2, y2: plaza.y2 },
        });
    }
    return { dwell, skipped };
}

function main() {
    const npcCfgPath = path.join(root, 'reference', 'Npc.cfg');
    if (!fs.existsSync(npcCfgPath)) {
        throw new Error(`Missing ${npcCfgPath}`);
    }
    const { byName } = parseNpcCfg(fs.readFileSync(npcCfgPath, 'utf8'));

    const monstersPath = path.join(serverConfigDir, 'Monsters.json');
    const monsters = JSON.parse(fs.readFileSync(monstersPath, 'utf8'));
    let monstersPatched = 0;
    const monsterGaps = [];

    for (const m of monsters) {
        if (SKIP_COMBAT_PATCH_NAMES.has(m.name)) {
            continue;
        }
        const npcName = CATALOG_NAME_TO_NPC[m.name];
        if (!npcName) {
            monsterGaps.push({ id: m.id, name: m.name, gap: 'no-npc-cfg-name-map' });
            continue;
        }
        const row = byName.get(npcName.toLowerCase());
        if (!row) {
            monsterGaps.push({ id: m.id, name: m.name, gap: `npc-cfg-missing:${npcName}` });
            continue;
        }
        m.hp = expectedHp(row.hitDice);
        m.attackDamageMin = row.adt;
        m.attackDamageMax = row.adt * row.adr;
        m.respawnTime = row.regTime;
        monstersPatched++;
    }
    fs.writeFileSync(monstersPath, JSON.stringify(monsters, null, 2) + '\n');

    const worldsPath = path.join(serverConfigDir, 'GameWorlds.json');
    const worlds = JSON.parse(fs.readFileSync(worldsPath, 'utf8'));
    const report = {
        worldsUpdated: [],
        worldsSkippedNoSpots: [],
        randomMapsPorted: [],
        randomMapsBlocked: [],
        spotSkips: [],
        monstersPatched,
        monsterGaps,
    };

    for (const [mapBase, worldId] of Object.entries(MAP_TO_WORLD)) {
        const mapPath = findMapFile(mapBase);
        const world = worlds.find((w) => w.id === worldId);
        if (!world) {
            report.worldsSkippedNoSpots.push({ worldId, reason: 'world-missing' });
            continue;
        }
        if (!mapPath) {
            report.worldsSkippedNoSpots.push({
                worldId,
                reason: 'mapdata-missing',
            });
            continue;
        }
        const mapText = fs.readFileSync(mapPath, 'utf8');
        const spots = parseSpotMobGenerators(mapText);
        const random = parseRandomMobGenerator(mapText);
        const maximumObject = parseMaximumObject(mapText);
        const waypointArea = parseWaypointBounds(mapText);

        const preservedBarracks = (world.dwellAreas ?? []).filter((d) =>
            BARRACKS_MONSTER_IDS.has(d.monsterId),
        );

        if (spots.length === 0) {
            if (!random?.enabled) {
                report.worldsSkippedNoSpots.push({ worldId, mapBase, reason: 'no-spots' });
                continue;
            }
            if (!maximumObject) {
                report.randomMapsBlocked.push({
                    worldId,
                    mapBase,
                    randomLevel: random.level,
                    reason: 'maximum-object-missing',
                });
                continue;
            }
            if (!RANDOM_LEVEL_WEIGHTS[random.level]) {
                report.randomMapsBlocked.push({
                    worldId,
                    mapBase,
                    randomLevel: random.level,
                    reason: 'unmapped-random-level',
                });
                continue;
            }
            const { dwell, skipped, totalSlots } = randomLevelToDwellAreas(
                random.level,
                maximumObject,
                waypointArea,
            );
            for (const s of skipped) {
                report.spotSkips.push({ worldId, source: 'random', ...s });
            }
            world.dwellAreas = [...dwell, ...preservedBarracks];
            world._olympiaRandomMobGenerator = {
                enabled: true,
                level: random.level,
                maximumObject,
                targetSlots: totalSlots,
                note: 'Ported as expected-count dwellAreas from Server.cpp RMG table (max-object − 30)',
            };
            report.randomMapsPorted.push({
                worldId,
                mapBase,
                randomLevel: random.level,
                maximumObject,
                targetSlots: totalSlots,
                pitCount: dwell.length,
                totalMobs: dwell.reduce((n, d) => n + d.count, 0),
                area: waypointArea,
            });
            report.worldsUpdated.push({
                worldId,
                mapBase,
                source: 'random-mob-generator',
                randomLevel: random.level,
                pitCount: dwell.length,
                totalMobs: dwell.reduce((n, d) => n + d.count, 0),
                slimePits: dwell.filter((d) => d.monsterId === 1).length,
                slimeCount: dwell.filter((d) => d.monsterId === 1).reduce((n, d) => n + d.count, 0),
            });
            continue;
        }

        const { dwell, skipped } = spotsToDwellAreas(spots, worldId);
        for (const s of skipped) {
            report.spotSkips.push({ worldId, ...s });
        }
        world.dwellAreas = [...dwell, ...preservedBarracks];
        if (random?.enabled) {
            world._olympiaRandomMobGenerator = {
                enabled: true,
                level: random.level,
                note: 'MAPDATA has spot-mob-generator; spots win. RMG table not layered on top (no invented double spawn)',
            };
        } else {
            delete world._olympiaRandomMobGenerator;
        }
        report.worldsUpdated.push({
            worldId,
            mapBase,
            source: 'spot-mob-generator',
            pitCount: dwell.length,
            totalMobs: dwell.reduce((n, d) => n + d.count, 0),
            slimePits: dwell.filter((d) => d.monsterId === 1).length,
            slimeCount: dwell.filter((d) => d.monsterId === 1).reduce((n, d) => n + d.count, 0),
        });
    }

    fs.writeFileSync(worldsPath, JSON.stringify(worlds, null, 2) + '\n');

    const reportPath = path.join(root, 'docs', 'SPAWN-PIT-PARITY.report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
    console.log(`\nWrote ${worldsPath}`);
    console.log(`Wrote ${monstersPath} (${monstersPatched} combat fields patched)`);
    console.log(`Wrote ${reportPath}`);
}

main();
