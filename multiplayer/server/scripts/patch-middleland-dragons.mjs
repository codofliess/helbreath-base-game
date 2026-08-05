/**
 * Middleland Nemesis-style dragons (no Elementalist mob).
 * - Strip Elementalist-tier manuals from catalog Dragon (id 5 / Barlog).
 * - Add Earth / Illusion / Lightning / Poison / Black dragons (ids 110–114).
 * - Black Dragon gets Elementalist-style elite manuals + Nemesis Black rares.
 * Run: node multiplayer/server/scripts/patch-middleland-dragons.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monstersPath = path.join(__dirname, '../Config/Monsters.json');

const GOLD = 90;
const BIG_HP = 95;
const BIG_MP = 93;
const BIG_SP = 96;
const HP_POT = 92;
const MP_POT = 91;
const SP_POT = 94;
const POWER_GREEN = 382; // may not match potion; keep Bloody Shock manual separate

// Shared primary-style gear (gen8-ish) — multi-drop bosses roll independently.
const PRIMARY_GEAR = [
  { itemId: 54, chance: 0.035 }, // Flameberge
  { itemId: 50, chance: 0.03 },
  { itemId: 51, chance: 0.03 },
  { itemId: 47, chance: 0.028 },
  { itemId: 174, chance: 0.025 }, // War Axe if present — fallback checked at runtime
  { itemId: 178, chance: 0.02 },
  { itemId: 205, chance: 0.02 },
  { itemId: 139, chance: 0.02 },
  { itemId: 140, chance: 0.018 },
  { itemId: 128, chance: 0.018 },
  { itemId: 217, chance: 0.025 }, // Tower Shield
  { itemId: 216, chance: 0.022 },
  { itemId: 214, chance: 0.022 },
  { itemId: 215, chance: 0.02 },
  { itemId: 211, chance: 0.02 },
  { itemId: 213, chance: 0.018 },
  { itemId: 209, chance: 0.015 },
  { itemId: 339, chance: 0.022 },
  { itemId: 340, chance: 0.022 },
  { itemId: 337, chance: 0.02 },
  { itemId: 338, chance: 0.02 },
  { itemId: 335, chance: 0.02 },
  { itemId: 336, chance: 0.02 },
  { itemId: 333, chance: 0.018 },
  { itemId: 334, chance: 0.018 },
  { itemId: 331, chance: 0.02 },
  { itemId: 332, chance: 0.02 },
  { itemId: 343, chance: 0.018 },
  { itemId: 344, chance: 0.018 },
  { itemId: 388, chance: 0.02 },
  { itemId: 389, chance: 0.02 },
  { itemId: 386, chance: 0.018 },
  { itemId: 387, chance: 0.018 },
  { itemId: 431, chance: 0.015 },
  { itemId: 432, chance: 0.015 },
  { itemId: 433, chance: 0.015 },
  { itemId: 434, chance: 0.015 },
  { itemId: 300, chance: 0.02 },
  { itemId: 327, chance: 0.015 },
];

const PRIMARY_STONES = [
  { itemId: 650, chance: 0.04 }, // Zemstone
  { itemId: 656, chance: 0.035 }, // Xelima
  { itemId: 657, chance: 0.035 }, // Merien
];

const SECONDARY_COMMON = [
  { itemId: GOLD, chance: 0.55, minQuantity: 10, maxQuantity: 15000 },
  { itemId: 740, chance: 0.04 }, // 5k pocket
  { itemId: 741, chance: 0.03 }, // 10k
  { itemId: 742, chance: 0.012 }, // 50k
  { itemId: 333, chance: 0.02 }, // Platinum Ring
  { itemId: 334, chance: 0.018 },
  { itemId: 335, chance: 0.018 },
  { itemId: 336, chance: 0.018 },
  { itemId: 337, chance: 0.018 },
  { itemId: 300, chance: 0.015 }, // Magic Necklace RM10
  { itemId: 305, chance: 0.015 },
  { itemId: 308, chance: 0.015 },
  { itemId: 311, chance: 0.015 },
  { itemId: 632, chance: 0.012 }, // Ogrepower
  { itemId: 633, chance: 0.012 }, // Demonpower
  { itemId: 634, chance: 0.01 },
  { itemId: 635, chance: 0.01 },
  { itemId: 636, chance: 0.008 },
  { itemId: 735, chance: 0.008 }, // Dragonpower
  { itemId: 290, chance: 0.006 }, // Flameberge+3 LLF
  { itemId: 292, chance: 0.006 }, // Golden Axe LLF
  { itemId: 650, chance: 0.03 },
  { itemId: 656, chance: 0.025 },
  { itemId: 657, chance: 0.025 },
];

function entry(itemId, chance, minQuantity = 1, maxQuantity = 1) {
  return { itemId, chance, minQuantity, maxQuantity };
}

function filterExistingItems(loot, itemIds) {
  const set = new Set(itemIds);
  return loot.filter((e) => set.has(e.itemId));
}

function buildColorLoot(signatureSecondary) {
  return [
    entry(GOLD, 0.85, 8001, 16000),
    entry(BIG_HP, 0.12),
    entry(BIG_MP, 0.12),
    entry(BIG_SP, 0.1),
    entry(HP_POT, 0.08),
    entry(MP_POT, 0.08),
    entry(SP_POT, 0.06),
    ...PRIMARY_GEAR.map((e) => entry(e.itemId, e.chance)),
    ...PRIMARY_STONES.map((e) => entry(e.itemId, e.chance)),
    ...SECONDARY_COMMON.map((e) =>
      entry(e.itemId, e.chance, e.minQuantity ?? 1, e.maxQuantity ?? 1),
    ),
    ...signatureSecondary.map((e) => entry(e.itemId, e.chance, e.minQuantity ?? 1, e.maxQuantity ?? 1)),
  ];
}

function buildBlackLoot() {
  // Elementalist-style elite manuals (moved off Barlog/Dragon) + Nemesis Black Dragon rares.
  const elementalist = [
    entry(873, 0.0015), // Mass Blizzard Manual
    entry(852, 0.0015), // Cancel Manual
    entry(874, 0.0008), // Sleep Manual
    entry(872, 0.001), // Bane
    entry(853, 0.0006), // E.S.W Manual
    entry(846, 0.0005), // Devastator
    entry(382, 0.0005), // Bloody Shock Wave Manual
  ];
  const blackRares = [
    entry(630, 0.01), // Ring of the Xelima
    entry(631, 0.01), // Ring of the Abaddon
    entry(734, 0.008), // Arc Mage
    entry(735, 0.012), // Dragonpower
    entry(633, 0.015),
    entry(636, 0.01),
    entry(860, 0.006), // Necklace of Xelima
    entry(858, 0.006), // Necklace of Merien
    entry(742, 0.02),
    entry(743, 0.008), // 100k pocket
    entry(290, 0.01),
    entry(292, 0.01),
  ];
  return [
    entry(GOLD, 0.95, 12000, 25000),
    entry(BIG_HP, 0.2),
    entry(BIG_MP, 0.2),
    entry(BIG_SP, 0.15),
    ...PRIMARY_GEAR.map((e) => entry(e.itemId, e.chance * 1.2)),
    ...PRIMARY_STONES.map((e) => entry(e.itemId, e.chance * 1.3)),
    ...SECONDARY_COMMON.map((e) =>
      entry(e.itemId, e.chance * 1.2, e.minQuantity ?? 1, e.maxQuantity ?? 1),
    ),
    ...elementalist,
    ...blackRares,
  ];
}

const DRAGONS = [
  {
    id: 110,
    name: 'Earth Dragon',
    sprite: 'barlog',
    hp: 18500,
    attackDamageMin: 20,
    attackDamageMax: 380,
    attackRange: 7,
    attackSpeed: 400,
    movementSpeed: 900,
    genLevel: 9,
    corpseDecayTime: 60000,
    magicLevel: 10,
    maxMana: 99000,
    magicHitRatio: 120,
    spells: [
      { spellId: 22, castProbability: 0.35 }, // Earth Shock Wave
      { spellId: 14, castProbability: 0.3 }, // Earthworm Strike
      { spellId: 16, castProbability: 0.25 }, // Bloody Shock Wave
    ],
    loot: buildColorLoot([
      { itemId: 647, chance: 0.012 }, // Necklace Of Stone Gol (earth-ish)
      { itemId: 858, chance: 0.01 }, // Necklace Of Merien
      { itemId: 853, chance: 0.008 }, // E.S.W Manual (earth signature)
    ]),
  },
  {
    id: 111,
    name: 'Illusion Dragon',
    sprite: 'wyvern',
    hp: 18500,
    attackDamageMin: 20,
    attackDamageMax: 380,
    attackRange: 7,
    attackSpeed: 400,
    movementSpeed: 900,
    genLevel: 9,
    corpseDecayTime: 60000,
    magicLevel: 10,
    maxMana: 99000,
    magicHitRatio: 120,
    spells: [
      { spellId: 49, castProbability: 0.25 }, // Mass Illusion Movement
      { spellId: 46, castProbability: 0.25 }, // Inhibition Casting
      { spellId: 15, castProbability: 0.25 }, // Armor Break
      { spellId: 27, castProbability: 0.2 }, // Paralyze
      { spellId: 11, castProbability: 0.3 }, // Energy Strike
    ],
    loot: buildColorLoot([
      { itemId: 338, chance: 0.01 }, // Memorial Ring (Angelic-ish stand-in)
      { itemId: 852, chance: 0.008 }, // Cancel Manual
      { itemId: 874, chance: 0.005 }, // Sleep Manual
    ]),
  },
  {
    id: 112,
    name: 'Lightning Dragon',
    sprite: 'firewyvern',
    hp: 18500,
    attackDamageMin: 20,
    attackDamageMax: 380,
    attackRange: 7,
    attackSpeed: 400,
    movementSpeed: 900,
    genLevel: 9,
    corpseDecayTime: 60000,
    magicLevel: 10,
    maxMana: 99000,
    magicHitRatio: 120,
    spells: [
      { spellId: 20, castProbability: 0.3 }, // Mass Lightning Strike
      { spellId: 18, castProbability: 0.3 }, // Lightning Strike
      { spellId: 6, castProbability: 0.25 }, // Lightning Bolt
    ],
    loot: buildColorLoot([
      { itemId: 845, chance: 0.006 }, // Storm Bringer (Fury of Thor stand-in)
      { itemId: 381, chance: 0.008 }, // Mass Fire Strike Manual
      { itemId: 644, chance: 0.01 }, // Necklace Of Air Ele
    ]),
  },
  {
    id: 113,
    name: 'Poison Dragon',
    sprite: 'uglywyvern',
    hp: 18500,
    attackDamageMin: 20,
    attackDamageMax: 380,
    attackRange: 7,
    attackSpeed: 400,
    movementSpeed: 900,
    genLevel: 9,
    corpseDecayTime: 60000,
    magicLevel: 10,
    maxMana: 99000,
    magicHitRatio: 120,
    spells: [
      { spellId: 39, castProbability: 0.35 }, // Mass Poison
      { spellId: 37, castProbability: 0.3 }, // Poison
      { spellId: 14, castProbability: 0.25 }, // Earthworm Strike
      { spellId: 16, castProbability: 0.2 }, // Bloody Shock Wave
    ],
    loot: buildColorLoot([
      { itemId: 743, chance: 0.01 }, // 100k gold pocket (Nemesis poison unique-ish)
      { itemId: 639, chance: 0.012 }, // Knecklace Of Poison Pro
      { itemId: 29, chance: 0.008 }, // Great Heal if present — filtered later
      { itemId: 858, chance: 0.008 },
    ]),
  },
  {
    id: 114,
    name: 'Black Dragon',
    sprite: 'wyvern',
    hp: 42000,
    attackDamageMin: 22,
    attackDamageMax: 506,
    attackRange: 7,
    attackSpeed: 400,
    movementSpeed: 800,
    genLevel: 10,
    corpseDecayTime: 180000,
    magicLevel: 12,
    maxMana: 99000,
    magicHitRatio: 140,
    spells: [
      { spellId: 19, castProbability: 0.3 }, // Meteor Strike
      { spellId: 12, castProbability: 0.3 }, // Mass Fire Strike
      { spellId: 2, castProbability: 0.25 }, // Fire Strike
      { spellId: 16, castProbability: 0.25 }, // Bloody Shock Wave
      { spellId: 22, castProbability: 0.2 }, // Earth Shock Wave
    ],
    loot: buildBlackLoot(),
  },
];

const ELEMENTALIST_OFF_BARLOG = new Set([872, 873, 874, 852, 846, 853]);

function main() {
  const monsters = JSON.parse(fs.readFileSync(monstersPath, 'utf8'));
  const itemsPath = path.join(__dirname, '../Config/Items.json');
  const itemIds = new Set(
    JSON.parse(fs.readFileSync(itemsPath, 'utf8')).map((i) => i.id),
  );

  // 1) Strip Elementalist manuals from Dragon (id 5)
  const dragon = monsters.find((m) => m.id === 5);
  if (!dragon) throw new Error('Dragon id 5 missing');
  const before = dragon.loot?.length ?? 0;
  if (Array.isArray(dragon.loot)) {
    dragon.loot = dragon.loot.filter((e) => !ELEMENTALIST_OFF_BARLOG.has(e.itemId));
  }
  const after = dragon.loot?.length ?? 0;
  console.log(`Dragon(id=5): stripped Elementalist rares ${before} → ${after} loot rows`);

  // 2) Upsert color/black dragons
  for (const d of DRAGONS) {
    d.loot = d.loot.filter((e) => itemIds.has(e.itemId));
    d.chaseDistance = 12;
    d.chaseMaxDistance = 28;
    d.respawnTime = 14_400_000; // 4h (used only if dwell-attached; rotation owns spawn)
    const idx = monsters.findIndex((m) => m.id === d.id);
    if (idx >= 0) {
      monsters[idx] = d;
      console.log(`Updated ${d.name} (id ${d.id}), loot rows=${d.loot.length}`);
    } else {
      monsters.push(d);
      console.log(`Added ${d.name} (id ${d.id}), loot rows=${d.loot.length}`);
    }
  }

  fs.writeFileSync(monstersPath, JSON.stringify(monsters, null, 2) + '\n');
  console.log('Wrote', monstersPath);
}

main();
