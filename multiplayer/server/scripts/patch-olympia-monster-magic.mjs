/**
 * Merge Olympia reference/Npc.cfg magicLevel / mana / MHR / attack kit into Monsters.json.
 * Ladder spell ids match multiplayer Spells.json (see OlympiaMonsterMagic.cs).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const npcPath = path.join(root, 'reference', 'Npc.cfg');
const monPath = path.join(root, 'multiplayer', 'server', 'Config', 'Monsters.json');

const lines = fs.readFileSync(npcPath, 'utf8').split(/\r?\n/).filter((l) => l.startsWith('Npc'));
const byNpc = new Map();
for (const l of lines) {
  const p = l.split('\t');
  byNpc.set(p[2], {
    type: +p[3],
    ml: +p[16],
    mana: +p[23],
    mhr: +p[24],
    atkRange: +p[25],
    actionTime: +p[14],
  });
}

/** Catalog display name → Npc.cfg name */
const nameMap = {
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
  'Giant Cray Fish': 'Giant-Crayfish',
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
  'Abaddon (incomplete)': 'Abaddon',
  Sorceress: 'Sor-Aresden',
  "God's Hand Knight": 'GHK',
  "God's Hand Knight on Armored Battle Steed": 'GHKABS',
  'Light War Beetle': 'LWB-Aresden',
  'Temple Knight': 'TK',
  'Ancient Temple Knight': 'BG',
  'Arrow Guard Tower': 'AGT-Aresden',
  'Cannon Guard Tower': 'CGT-Aresden',
  'Elf Master': 'Dark-Elf',
  'Battle Golem': 'BG',
  'Ugly Wyvern': 'Wyvern',
  'Armored Battle Steed': 'GHKABS',
  Detector: null,
  'Mercenary Warrior': null,
  'Mercenary Mage': null,
};

function spellsForMl(ml) {
  if (ml < 0) return [6, 0];
  switch (ml) {
    case 1:
    case 2:
      return [0];
    case 3:
      return [1, 0];
    case 4:
      return [2, 6, 1, 0];
    case 5:
      return [6, 2, 1, 0];
    case 6:
      return [6, 2, 1, 0];
    case 7:
      return [16, 12, 11, 6];
    case 8:
      return [27, 11, 6, 2];
    case 9:
      return [18];
    case 10:
      return [10];
    case 11:
      return [];
    case 12:
      return [21, 13];
    case 13:
      return [22, 19];
    default:
      return ml > 13 ? [27, 11, 6, 2] : [];
  }
}

const academy = {
  100: { ml: 3, mana: 200, mhr: 80, spells: [0] },
  101: { ml: 6, mana: 800, mhr: 100, spells: [11, 3, 0] },
  102: { ml: 8, mana: 2000, mhr: 200, spells: [11, 3, 27, 2, 6] },
  103: { ml: 9, mana: 3500, mhr: 280, spells: [11, 5, 3, 27, 2, 6, 18] },
};

const monsters = JSON.parse(fs.readFileSync(monPath, 'utf8'));
let patched = 0;
const report = [];

function applyRow(m, row) {
  m.magicLevel = row.ml;
  m.maxMana = row.mana;
  m.magicHitRatio = row.mhr;

  if (row.type === 54) {
    m.rangedAttack = true;
    m.attackRange = Math.max(m.attackRange ?? 1, row.atkRange || 8);
  }
  if (row.type === 63 || row.type === 79) {
    m.attackRange = Math.max(m.attackRange ?? 1, 3);
  }
  if (m.name === 'Cannon Guard Tower') {
    m.magicLevel = 7;
    m.maxMana = Math.max(m.maxMana || 0, 500);
    m.magicHitRatio = Math.max(m.magicHitRatio || 0, 1000);
    m.spells = [{ spellId: 12, castProbability: 1.0 }];
    report.push(`${m.name} cannon MFS ML7 mana${m.maxMana}`);
    return;
  }
  if (m.name === 'Guard' && row.ml < 0) {
    // City guards: negative ML healing ladder → Lightning / EB
    m.spells = spellsForMl(row.ml).map((id) => ({ spellId: id, castProbability: 1.0 }));
    report.push(`${m.name} guard ML${row.ml} mana${row.mana}`);
    return;
  }

  const ids = spellsForMl(row.ml);
  if (ids.length > 0) {
    m.spells = ids.map((id) => ({ spellId: id, castProbability: 1.0 }));
  } else if (row.ml === 0 && m.name === 'Orc') {
    delete m.spells;
  }
  report.push(`${m.name} ML${row.ml} mana${row.mana} mhr${row.mhr} spells[${ids.join(',')}]`);
}

for (const m of monsters) {
  if (academy[m.id]) {
    const a = academy[m.id];
    m.magicLevel = a.ml;
    m.maxMana = a.mana;
    m.magicHitRatio = a.mhr;
    m.spells = a.spells.map((id) => ({ spellId: id, castProbability: 1.0 }));
    patched++;
    report.push(`${m.name} academy ML${a.ml} mana${a.mana}`);
    continue;
  }

  const mapped = nameMap[m.name];
  if (mapped === null) {
    // Mercenary Mage keeps custom kit; give ML for regen if missing
    if (m.name === 'Mercenary Mage') {
      m.magicLevel = m.magicLevel ?? 5;
      m.maxMana = m.maxMana ?? 600;
      m.magicHitRatio = m.magicHitRatio ?? 80;
      report.push(`${m.name} keep custom spells ML${m.magicLevel}`);
      patched++;
    } else {
      report.push(`SKIP ${m.name}`);
    }
    continue;
  }

  const npcName = mapped || m.name.replace(/ /g, '-');
  const row = byNpc.get(npcName) || byNpc.get(m.name);
  if (!row) {
    report.push(`SKIP ${m.name} (no Npc.cfg row for ${npcName})`);
    continue;
  }
  applyRow(m, row);
  patched++;
}

fs.writeFileSync(monPath, JSON.stringify(monsters, null, 2) + '\n');
console.log(`Patched ${patched}/${monsters.length} monsters → ${monPath}`);
for (const line of report) console.log(line);
