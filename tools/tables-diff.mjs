#!/usr/bin/env node
/**
 * Compare ChainLords server tables to the Helbreath Olympia configs in reference/.
 *
 * Items:  Items.json            vs Item.cfg / Item2.cfg / Item3.cfg
 * Spells: Spells.json           vs Magic.cfg (Olympia id → server id map)
 * Mobs:   Monsters.json         vs Npc.cfg (HP, damage, defense, exp, speed)
 * Drops:  Monsters.json loot    vs Npc.cfg gold + Server.cpp rare table
 *
 *   node tools/tables-diff.mjs
 *   node tools/tables-diff.mjs --out tmp-tables-diff
 *   node tools/tables-diff.mjs --md report.md --csv findings.csv
 *   node --test tools/tables-diff.test.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REFERENCE_CANDIDATES = ['reference', 'multiplayer/server/reference', 'sp-client/reference'];

/** Olympia Magic.cfg id → Spells.json id. Same table as MagicTower.OlympiaToServerSpellId. */
export const OLYMPIA_TO_SERVER_SPELL = {
    0: 0, 10: 0, 20: 1, 30: 2, 45: 3, 46: 4, 47: 5, 51: 6, 54: 7, 41: 8,
    55: 9, 57: 10, 60: 11, 61: 12, 63: 13, 64: 14, 66: 15, 70: 16, 72: 17,
    74: 18, 81: 19, 56: 20, 91: 21, 96: 22, 97: 23, 32: 24, 50: 25, 26: 26,
    35: 27, 25: 28, 1: 29, 21: 30, 2: 31, 13: 32, 44: 33, 24: 34, 33: 35,
    65: 36, 27: 37, 36: 38, 53: 39, 42: 40, 62: 41, 71: 42, 80: 43, 90: 44,
    76: 45, 83: 46, 31: 47, 77: 48, 95: 49, 12: 50, 78: 51,
};

/** Catalog display name → Npc.cfg name. Same map as NpcExpCatalog / sync-olympia-pits.mjs. */
export const CATALOG_NAME_TO_NPC = {
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
    Dummy: 'Dummy',
    'Training Dummy': 'Dummy',
    'Fire Wyvern': 'Fire-Wyvern',
    Wyvern: 'Wyvern',
    'Earth Dragon': 'Fire-Wyvern',
    'Illusion Dragon': 'Wyvern',
    'Lightning Dragon': 'Fire-Wyvern',
    'Poison Dragon': 'Wyvern',
    'Black Dragon': 'Abaddon',
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

/** NpcDeadItemGenerator returns before any drop. */
const NO_DROP_TYPES = new Set([21, 34, 64]);

const GOLD_ITEM_ID = 90;
const POTION_ITEM_IDS = [91, 92, 93, 94, 95, 96, 390];
const DAMAGE_MAGIC_TYPES = new Set([1, 3, 14, 17, 19, 21, 22, 23, 25, 26, 28, 30]);
const GEAR_EFFECT_TYPES = new Set([1, 2, 12, 24]);

const CATEGORY_RANK = {
    'monster-damage': 0,
    'drop-missing': 1,
    'spell-dice': 2,
    'spell-missing': 3,
    'monster-defense': 4,
    'monster-hp': 5,
    'item-missing': 6,
    'monster-exp': 7,
    'monster-speed': 8,
    'drop-gold': 9,
    'monster-magic': 10,
    'item-stat': 11,
};

/**
 * Server.cpp _bInitNpcAttr HP midpoint.
 * HitDice ≤ 5: iDice(HD, 4) + HD → HD × 3.5.
 * Else: HD × 4 + HD + iDice(1, HD) → HD × 5 + (HD + 1) / 2.
 */
export function expectedHp(hitDice) {
    const hd = Math.max(0, hitDice);
    if (hd <= 5) return Math.max(1, Math.round(hd * 3.5));
    return Math.max(1, Math.round(hd * 5 + (hd + 1) / 2));
}

/** iDice(throw, sides) average. Min is throw, max is throw × sides. */
export function olympiaDamage(adt, adr) {
    const throwN = Math.max(0, adt);
    const sides = Math.max(0, adr);
    if (throwN === 0 || sides === 0) return { min: 0, max: 0, avg: 0 };
    return {
        min: throwN,
        max: throwN * sides,
        avg: throwN * (sides + 1) / 2,
    };
}

/**
 * NpcExpCatalog average before MonsterExpFactor.
 * Single ExpDice in this repo's Npc.cfg (not ExpDiceMin/Max).
 */
export function averageBaseExp(expDice, hitDice) {
    const dice = Math.max(1, expDice);
    const hd = Math.max(1, hitDice);
    const maxWeight = Math.max(0.33, 42 / dice);
    const weight = Math.min(hd, maxWeight);
    return Math.max(1, Math.round(dice * weight));
}

export function diceAverage(count, sides, bonus) {
    const c = Math.max(0, count);
    const s = Math.max(0, sides);
    return c * (s + 1) / 2 + (bonus || 0);
}

export function normName(value) {
    return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function nameSimilarity(left, right) {
    const a = normName(left);
    const b = normName(right);
    if (!a || !b) return 0;
    if (a === b) return 1;
    const dist = levenshtein(a, b);
    return 1 - dist / Math.max(a.length, b.length);
}

function levenshtein(a, b) {
    const prev = new Array(b.length + 1);
    const next = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
        next[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            next[j] = Math.min(next[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        for (let j = 0; j <= b.length; j++) prev[j] = next[j];
    }
    return prev[b.length];
}

function num(token) {
    const n = Number(token);
    return Number.isFinite(n) ? n : null;
}

function ratioOf(ours, olympia) {
    if (!Number.isFinite(ours) || !Number.isFinite(olympia) || olympia === 0) return null;
    return ours / olympia;
}

function fmt(n) {
    if (!Number.isFinite(n)) return '';
    if (Number.isInteger(n)) return String(n);
    return (Math.round(n * 100) / 100).toString();
}

function fmtRatio(ratio) {
    if (!Number.isFinite(ratio)) return '';
    return `${fmt(ratio)}x`;
}

/**
 * Isolatorhk Npc.cfg layout (the header in reference/Npc.cfg):
 * Name Type HitDice DR HR MinBrav ExpDice ADT ADR Size Side
 * ActionLmt ActionTime MR ML DoW Chat SrchRange RegTime Attr AbsM Mana MR AtkRange Gold
 * First row for a name wins. Later faction clones do not replace the wild monster.
 */
export function parseNpcCfg(text) {
    const byName = new Map();
    const byType = new Map();
    let layout = 'short';
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (/expdicemin/i.test(trimmed) && /hitdice/i.test(trimmed)) layout = 'long';
        if (!/^npc\b/i.test(trimmed)) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        const parts = trimmed.slice(eq + 1).trim().split(/\s+/);
        if (parts.length < 13) continue;
        const name = parts[0];
        const type = num(parts[1]);
        const hitDice = num(parts[2]);
        const defense = num(parts[3]);
        const hitRatio = num(parts[4]);
        if (type == null || hitDice == null) continue;
        let expDice;
        let adt;
        let adr;
        let actionTime;
        let magicLevel;
        let mana;
        let attackRange;
        let gold;
        let regTime;
        if (layout === 'long' && parts.length >= 20) {
            const expMin = num(parts[6]);
            const expMax = num(parts[7]);
            expDice = expMin != null && expMax != null ? Math.round((expMin + Math.max(expMin, expMax)) / 2) : expMin;
            adt = num(parts[10]);
            adr = num(parts[11]);
            actionTime = num(parts[15]);
            magicLevel = num(parts[17]);
            regTime = null;
            mana = null;
            attackRange = null;
            gold = null;
        } else {
            expDice = num(parts[6]);
            adt = num(parts[7]);
            adr = num(parts[8]);
            actionTime = num(parts[12]);
            magicLevel = num(parts[14]);
            regTime = num(parts[18]);
            mana = num(parts[21]);
            attackRange = num(parts[23]);
            gold = num(parts[24]);
        }
        const row = {
            name,
            type,
            hitDice,
            defense: defense ?? 0,
            hitRatio: hitRatio ?? 0,
            expDice: expDice ?? 0,
            adt: adt ?? 0,
            adr: adr ?? 0,
            actionTime: actionTime ?? 0,
            magicLevel: magicLevel ?? 0,
            mana: mana ?? 0,
            attackRange: attackRange ?? 1,
            regTime: regTime ?? 0,
            gold: gold ?? 0,
        };
        const key = name.toLowerCase();
        if (!byName.has(key)) byName.set(key, row);
        if (!byType.has(type)) byType.set(type, row);
    }
    return { byName, byType, layout };
}

/** Item = id Name type equip effect v1..v6 maxLife ... price */
export function parseItemCfg(text, source) {
    const byId = new Map();
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!/^item\b/i.test(trimmed)) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        const tokens = trimmed.slice(eq + 1).trim().split(/\s+/);
        if (tokens.length < 5) continue;
        const id = num(tokens[0]);
        if (id == null) continue;
        const effectType = num(tokens[4]);
        const maxLife = tokens.length > 11 ? num(tokens[11]) : null;
        const price = tokens.length > 15 ? num(tokens[15]) : null;
        const row = {
            id,
            name: tokens[1],
            itemType: num(tokens[2]),
            equipPos: num(tokens[3]),
            effectType,
            maxLife: maxLife ?? 0,
            price: price != null && price > 0 ? price : 0,
            source,
        };
        if (!byId.has(id)) byId.set(id, row);
    }
    return byId;
}

export function parseMagicCfg(text) {
    const byId = new Map();
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!/^magic\b/i.test(trimmed)) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        const tokens = trimmed.slice(eq + 1).trim().split(/\s+/);
        if (tokens.length < 12) continue;
        const id = num(tokens[0]);
        if (id == null) continue;
        const row = {
            id,
            name: tokens[1],
            type: num(tokens[2]) ?? 0,
            delay: num(tokens[3]) ?? 0,
            last: num(tokens[4]) ?? 0,
            mana: num(tokens[5]) ?? 0,
            diceA: [num(tokens[8]) ?? 0, num(tokens[9]) ?? 0, num(tokens[10]) ?? 0],
            diceB: [num(tokens[11]) ?? 0, num(tokens[12]) ?? 0, num(tokens[13]) ?? 0],
            value10: num(tokens[14]) ?? 0,
            reqInt: num(tokens[17]) ?? 0,
            cost: num(tokens[18]) ?? 0,
        };
        if (!byId.has(id)) byId.set(id, row);
    }
    return byId;
}

/**
 * Item ids assigned inside bGetItemNameWhenDeleteNpc, grouped by NPC type.
 * Nested dice switches stay inside the NPC case.
 */
export function parseSignatureDrops(cppText) {
    const marker = 'bool CGame::bGetItemNameWhenDeleteNpc';
    let start = cppText.indexOf(marker);
    if (start < 0) start = cppText.lastIndexOf('bGetItemNameWhenDeleteNpc');
    if (start < 0) return new Map();
    const open = cppText.indexOf('{', start);
    if (open < 0) return new Map();
    const fnBody = sliceBraces(cppText, open);
    const byType = new Map();
    const re = /switch\s*\(\s*sNpcType\s*\)/g;
    for (const match of fnBody.matchAll(re)) {
        const brace = fnBody.indexOf('{', match.index);
        if (brace < 0) break;
        collectNpcCases(sliceBraces(fnBody, brace), byType);
    }
    return byType;
}

function sliceBraces(text, openIdx) {
    let depth = 0;
    for (let i = openIdx; i < text.length; i++) {
        const ch = text[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) return text.slice(openIdx + 1, i);
        }
    }
    return '';
}

function collectNpcCases(body, byType) {
    let depth = 0;
    let group = [];
    let sawStatement = false;
    const ensure = (type) => {
        if (!byType.has(type)) byType.set(type, new Set());
        return byType.get(type);
    };
    let i = 0;
    while (i < body.length) {
        const ch = body[i];
        if (ch === '{') {
            depth++;
            i++;
            continue;
        }
        if (ch === '}') {
            depth--;
            i++;
            continue;
        }
        if (depth === 0 && (i === 0 || /[^A-Za-z0-9_]/.test(body[i - 1]))) {
            const caseMatch = /^case\s+(\d+)\s*:/.exec(body.slice(i));
            if (caseMatch) {
                const type = Number(caseMatch[1]);
                group = sawStatement ? [type] : [...group, type];
                sawStatement = false;
                ensure(type);
                i += caseMatch[0].length;
                continue;
            }
            if (body.startsWith('default', i)) {
                group = [];
                sawStatement = true;
            } else if (/^break\s*;/.test(body.slice(i))) {
                group = [];
                sawStatement = true;
            }
        }
        if (group.length > 0) {
            const idMatch = /^iItemID\s*=\s*(\d+)/.exec(body.slice(i));
            if (idMatch && (i === 0 || /[^A-Za-z0-9_]/.test(body[i - 1]))) {
                const itemId = Number(idMatch[1]);
                for (const type of group) ensure(type).add(itemId);
                sawStatement = true;
                i += idMatch[0].length;
                continue;
            }
        }
        i++;
    }
}

export function resolveNpc(monster, npcs) {
    const mapped = CATALOG_NAME_TO_NPC[monster.name];
    if (mapped) {
        const row = npcs.byName.get(mapped.toLowerCase());
        if (row) return { row, how: 'name-map' };
    }
    const direct = npcs.byName.get(String(monster.name).toLowerCase());
    if (direct) return { row: direct, how: 'name' };
    const dashed = String(monster.name).toLowerCase().replace(/ /g, '-');
    const dashedRow = npcs.byName.get(dashed);
    if (dashedRow) return { row: dashedRow, how: 'dashed-name' };
    const compact = normName(monster.name);
    for (const [key, row] of npcs.byName) {
        if (normName(key) === compact) return { row, how: 'normalized-name' };
    }
    return null;
}

function pushFinding(list, finding) {
    list.push({
        score: Math.round(finding.score * 10) / 10,
        category: finding.category,
        subject: finding.subject,
        olympia: finding.olympia ?? '',
        ours: finding.ours ?? '',
        ratio: finding.ratio ?? '',
        detail: finding.detail,
    });
}

function outlierScore(ratio, { twoX = 92, high = 74, low = 70, floor = 1.45 } = {}) {
    if (!Number.isFinite(ratio) || ratio <= 0) return 0;
    if (ratio >= 1.75 && ratio <= 2.4) return twoX;
    if (ratio > 2.4) return Math.min(98, twoX + Math.min(6, (ratio - 2.4) * 2));
    if (ratio >= floor) return high - (1.75 - ratio) * 20;
    if (ratio <= 0.55) return low + 8;
    if (ratio <= 1 / floor) return low;
    return 0;
}

export function diffMonster(monster, npc, defaults) {
    const findings = [];
    const label = `${monster.name} (#${monster.id})`;
    const hp = monster.hp ?? defaults.hp;
    const hpDefault = monster.hp == null;
    const expected = expectedHp(npc.hitDice);
    const hpRatio = ratioOf(hp, expected);
    const hpScore = outlierScore(hpRatio, { twoX: 80, high: 64, low: 60, floor: 1.4 });
    if (hpScore > 0 && Math.abs(hp - expected) >= 4) {
        pushFinding(findings, {
            score: hpScore + (hpDefault ? 4 : 0),
            category: 'monster-hp',
            subject: label,
            olympia: `HP ~${expected} (HitDice ${npc.hitDice})`,
            ours: hpDefault ? `HP ${hp} (monsterDefaults)` : `HP ${hp}`,
            ratio: fmtRatio(hpRatio),
            detail: hpDefault
                ? `${label} does not set HP, so it uses monsterDefaults ${hp}, about ${fmtRatio(hpRatio)} the Olympia roll for ${npc.name} (~${expected}).`
                : `${label} has about ${fmtRatio(hpRatio)} the Olympia hit-point roll for ${npc.name} (~${expected} from HitDice ${npc.hitDice}).`,
        });
    }

    const dmgMin = monster.attackDamageMin ?? defaults.attackDamageMin;
    const dmgMax = monster.attackDamageMax ?? defaults.attackDamageMax;
    const dmgDefault = monster.attackDamageMin == null || monster.attackDamageMax == null;
    const oursAvg = (dmgMin + dmgMax) / 2;
    const oly = olympiaDamage(npc.adt, npc.adr);
    const dmgRatio = ratioOf(oursAvg, oly.avg);
    const dmgScore = outlierScore(dmgRatio, { twoX: 94, high: 78, low: 72, floor: 1.45 });
    if (dmgScore > 0 && (oly.avg >= 2 || Math.abs(oursAvg - oly.avg) >= 4)) {
        const about = dmgRatio >= 1.75 && dmgRatio <= 2.4 ? 'hits about twice as hard as' : 'damage is off versus';
        pushFinding(findings, {
            score: dmgScore + Math.min(4, Math.log2(oly.avg + 1)),
            category: 'monster-damage',
            subject: label,
            olympia: `iDice(${npc.adt},${npc.adr}) avg ${fmt(oly.avg)} (${oly.min}–${oly.max})`,
            ours: dmgDefault ? `${dmgMin}–${dmgMax} (monsterDefaults)` : `${dmgMin}–${dmgMax}`,
            ratio: fmtRatio(dmgRatio),
            detail: `${label} ${about} Olympia. Our swing is ${dmgMin}–${dmgMax} (avg ${fmt(oursAvg)}); ${npc.name} rolls ${npc.adt}d${npc.adr} (avg ${fmt(oly.avg)}, max ${oly.max}).`,
        });
    }

    const speed = monster.movementSpeed;
    const speedRatio = ratioOf(speed, npc.actionTime);
    if (npc.actionTime > 0 && speed > 0) {
        const speedScore = outlierScore(speedRatio, { twoX: 68, high: 56, low: 64, floor: 1.5 });
        if (speedScore > 0 && Math.abs(speed - npc.actionTime) >= 200) {
            const faster = speedRatio < 1;
            pushFinding(findings, {
                score: speedScore,
                category: 'monster-speed',
                subject: label,
                olympia: `ActionTime ${npc.actionTime} ms`,
                ours: `movementSpeed ${speed} ms`,
                ratio: fmtRatio(speedRatio),
                detail: faster
                    ? `${label} steps faster than Olympia (${speed} ms vs ActionTime ${npc.actionTime} ms).`
                    : `${label} steps slower than Olympia (${speed} ms vs ActionTime ${npc.actionTime} ms).`,
            });
        }
    }

    if (monster.magicLevel != null && npc.magicLevel !== monster.magicLevel) {
        const gap = Math.abs((monster.magicLevel ?? 0) - npc.magicLevel);
        if (gap >= 2 || (npc.magicLevel >= 5 && (monster.magicLevel ?? 0) === 0)) {
            pushFinding(findings, {
                score: npc.magicLevel >= 7 && (monster.magicLevel ?? 0) === 0 ? 76 : 58,
                category: 'monster-magic',
                subject: label,
                olympia: `ML ${npc.magicLevel}`,
                ours: `magicLevel ${monster.magicLevel ?? 0}`,
                ratio: '',
                detail: `${label} magic level is ${monster.magicLevel ?? 0}; ${npc.name} is ML ${npc.magicLevel}. The ladder decides which spells it casts.`,
            });
        }
    } else if (monster.magicLevel == null && npc.magicLevel >= 5) {
        pushFinding(findings, {
            score: 76,
            category: 'monster-magic',
            subject: label,
            olympia: `ML ${npc.magicLevel}`,
            ours: 'magicLevel omitted',
            ratio: '',
            detail: `${label} has no magicLevel. ${npc.name} casts at ML ${npc.magicLevel}.`,
        });
    }

    return { findings, hp, expectedHp: expected, damage: { min: dmgMin, max: dmgMax, avg: oursAvg }, olympiaDamage: oly };
}

export function diffDrops(monster, npc, signatureIds, itemNames) {
    const findings = [];
    const label = `${monster.name} (#${monster.id})`;
    const loot = Array.isArray(monster.loot) ? monster.loot : [];
    const lootIds = new Set(loot.map((row) => row.itemId));
    if (NO_DROP_TYPES.has(npc.type)) {
        return findings;
    }
    if (loot.length === 0 && (npc.gold > 0 || (signatureIds && signatureIds.size > 0))) {
        pushFinding(findings, {
            score: 90,
            category: 'drop-missing',
            subject: label,
            olympia: npc.gold > 0 ? `gold ${npc.gold} plus rare table` : 'rare table',
            ours: 'loot empty',
            ratio: '',
            detail: `${label} has an empty loot list. ${npc.name} drops gold${npc.gold > 0 ? ` (column ${npc.gold})` : ''} and any rare table for type ${npc.type}.`,
        });
        return findings;
    }

    const goldRows = loot.filter((row) => row.itemId === GOLD_ITEM_ID);
    if (npc.gold > 0 && goldRows.length === 0) {
        pushFinding(findings, {
            score: 84,
            category: 'drop-gold',
            subject: label,
            olympia: `Gold column ${npc.gold}`,
            ours: 'no item 90',
            ratio: '',
            detail: `${label} never drops gold. Olympia ${npc.name} gold column is ${npc.gold} (~21% of kills).`,
        });
    } else if (npc.gold > 0 && goldRows.length > 0) {
        const maxQty = Math.max(...goldRows.map((row) => row.maxQuantity ?? row.minQuantity ?? 1));
        const chance = goldRows.reduce((sum, row) => sum + (row.chance ?? 0), 0);
        const qtyRatio = ratioOf(maxQty, npc.gold);
        if (qtyRatio != null && (qtyRatio >= 1.8 || qtyRatio <= 0.55) && Math.abs(maxQty - npc.gold) >= 8) {
            pushFinding(findings, {
                score: outlierScore(qtyRatio, { twoX: 62, high: 52, low: 52, floor: 1.8 }),
                category: 'drop-gold',
                subject: label,
                olympia: `gold max ${npc.gold}`,
                ours: `gold max ${maxQty} @ ${fmt(chance)}`,
                ratio: fmtRatio(qtyRatio),
                detail: `${label} gold stack is ${fmtRatio(qtyRatio)} the Npc.cfg gold column (${maxQty} vs ${npc.gold}).`,
            });
        }
        if (chance > 0 && (chance < 0.08 || chance > 0.45)) {
            pushFinding(findings, {
                score: 48,
                category: 'drop-gold',
                subject: label,
                olympia: '~21% gold branch',
                ours: `chance ${fmt(chance)}`,
                ratio: fmtRatio(chance / 0.21),
                detail: `${label} gold chance is ${fmt(chance)}; Olympia's primary branch is about 21%.`,
            });
        }
    }

    const hasPotion = POTION_ITEM_IDS.some((id) => lootIds.has(id));
    if (!hasPotion && npc.gold > 0) {
        pushFinding(findings, {
            score: 72,
            category: 'drop-missing',
            subject: label,
            olympia: 'potion band 91–96 / 390',
            ours: 'none of those ids',
            ratio: '',
            detail: `${label} is missing the Olympia standard potion band (red/blue/green and big potions).`,
        });
    }

    if (signatureIds && signatureIds.size > 0) {
        const missing = [...signatureIds].filter((id) => !lootIds.has(id));
        if (missing.length > 0) {
            const names = missing.slice(0, 6).map((id) => {
                const name = itemNames.get(id);
                return name ? `${id} ${name}` : String(id);
            });
            const more = missing.length > names.length ? `, +${missing.length - names.length} more` : '';
            const notInCatalog = missing.filter((id) => !itemNames.has(id)).length;
            pushFinding(findings, {
                score: 80 + Math.min(10, missing.length) + (notInCatalog > 0 ? 4 : 0),
                category: 'drop-missing',
                subject: label,
                olympia: `${signatureIds.size} signature ids on type ${npc.type}`,
                ours: `missing ${missing.length}`,
                ratio: '',
                detail: `${label} is missing ${missing.length} Olympia signature drop${missing.length === 1 ? '' : 's'} from bGetItemNameWhenDeleteNpc (${names.join(', ')}${more}).${notInCatalog ? ` ${notInCatalog} of those ids ${notInCatalog === 1 ? 'is' : 'are'} not in Items.json either.` : ''}`,
            });
        }
    }
    return findings;
}

function spellDice(spell) {
    if (spell.damageDiceCount != null || spell.damageDiceSides != null) {
        return {
            kind: 'damage',
            count: spell.damageDiceCount ?? 0,
            sides: spell.damageDiceSides ?? 0,
            bonus: spell.damageDiceBonus ?? 0,
        };
    }
    if (spell.healDiceCount != null || spell.healDiceSides != null) {
        return {
            kind: 'heal',
            count: spell.healDiceCount ?? 0,
            sides: spell.healDiceSides ?? 0,
            bonus: spell.healBonus ?? 0,
        };
    }
    return null;
}

function magicTriples(magic) {
    const triples = [];
    for (const [count, sides, bonus] of [magic.diceA, magic.diceB]) {
        if ((sides ?? 0) > 0) {
            triples.push({ count, sides, bonus, avg: diceAverage(count, sides, bonus) });
        }
    }
    return triples;
}

export function diffSpell(spell, magic) {
    const findings = [];
    const dice = spellDice(spell);
    const triples = magicTriples(magic);
    if (!dice || triples.length === 0) return findings;
    const oursAvg = diceAverage(dice.count, dice.sides, dice.bonus);
    let closest = triples[0];
    let closestRatio = ratioOf(oursAvg, closest.avg);
    for (const triple of triples) {
        const ratio = ratioOf(oursAvg, triple.avg);
        if (closestRatio == null || (ratio != null && Math.abs(Math.log(ratio)) < Math.abs(Math.log(closestRatio)))) {
            closest = triple;
            closestRatio = ratio;
        }
    }
    const exact = triples.some((triple) => triple.count === dice.count && triple.sides === dice.sides && triple.bonus === dice.bonus);
    if (exact || closestRatio == null) return findings;
    const score = outlierScore(closestRatio, { twoX: 90, high: 70, low: 68, floor: 1.4 });
    if (score <= 0 || Math.abs(oursAvg - closest.avg) < 2) return findings;
    const label = `${spell.name} (spell ${spell.id} / magic ${magic.id})`;
    pushFinding(findings, {
        score,
        category: 'spell-dice',
        subject: label,
        olympia: `${closest.count}d${closest.sides}+${closest.bonus} avg ${fmt(closest.avg)}`,
        ours: `${dice.count}d${dice.sides}+${dice.bonus} avg ${fmt(oursAvg)}`,
        ratio: fmtRatio(closestRatio),
        detail: `${label} ${dice.kind} dice are ${fmtRatio(closestRatio)} the closest Magic.cfg triple (${magic.name}).`,
    });
    return findings;
}

function locateReference(root) {
    const searched = REFERENCE_CANDIDATES.map((rel) => path.join(root, rel));
    const dir = searched.find((candidate) => fs.existsSync(path.join(candidate, 'Npc.cfg')) && fs.existsSync(path.join(candidate, 'Item.cfg')));
    return { dir: dir ?? null, searched };
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadItems(referenceDir) {
    const byId = new Map();
    const files = [];
    for (const name of ['Item.cfg', 'Item2.cfg', 'Item3.cfg']) {
        const file = path.join(referenceDir, name);
        if (!fs.existsSync(file)) continue;
        files.push(file);
        for (const [id, row] of parseItemCfg(fs.readFileSync(file, 'utf8'), name)) {
            if (!byId.has(id)) byId.set(id, row);
        }
    }
    return { byId, files };
}

export function run(options = {}) {
    const root = options.root ?? repoRoot;
    const configDir = options.configDir ?? path.join(root, 'multiplayer/server/Config');
    const sources = options.referenceDir
        ? { dir: options.referenceDir, searched: [options.referenceDir] }
        : locateReference(root);
    const gaps = [];
    const findings = [];
    const counts = {
        itemsOlympia: 0,
        itemsOurs: 0,
        itemsMissing: 0,
        itemsExtra: 0,
        spellsOlympia: 0,
        spellsOurs: 0,
        spellsUnmapped: 0,
        monstersOurs: 0,
        monstersMatched: 0,
        monstersUnmatched: 0,
        signatureTypes: 0,
    };

    if (!sources.dir) {
        gaps.push(`Olympia cfg directory not found. Looked at ${sources.searched.join(', ')}.`);
        return finish(options, root, sources, findings, gaps, counts);
    }

    const itemsPath = path.join(configDir, 'Items.json');
    const spellsPath = path.join(configDir, 'Spells.json');
    const monstersPath = path.join(configDir, 'Monsters.json');
    const settingsPath = path.join(configDir, 'Settings.json');
    for (const file of [itemsPath, spellsPath, monstersPath, settingsPath]) {
        if (!fs.existsSync(file)) gaps.push(`Missing server config ${file}.`);
    }
    if (gaps.length > 0) return finish(options, root, sources, findings, gaps, counts);

    const ourItems = readJson(itemsPath);
    const ourSpells = readJson(spellsPath);
    const ourMonsters = readJson(monstersPath);
    const settings = readJson(settingsPath);
    const defaults = {
        hp: settings?.monsterDefaults?.hp ?? 100,
        attackDamageMin: settings?.monsterDefaults?.attackDamageMin ?? 1,
        attackDamageMax: settings?.monsterDefaults?.attackDamageMax ?? 5,
    };

    const olympiaItems = loadItems(sources.dir);
    const magicPath = path.join(sources.dir, 'Magic.cfg');
    const npcPath = path.join(sources.dir, 'Npc.cfg');
    const serverCpp = path.join(sources.dir, 'Server.cpp');
    const magic = fs.existsSync(magicPath) ? parseMagicCfg(fs.readFileSync(magicPath, 'utf8')) : new Map();
    const npcs = fs.existsSync(npcPath) ? parseNpcCfg(fs.readFileSync(npcPath, 'utf8')) : { byName: new Map(), byType: new Map(), layout: 'short' };
    const signatures = fs.existsSync(serverCpp) ? parseSignatureDrops(fs.readFileSync(serverCpp, 'utf8')) : new Map();

    if (!fs.existsSync(magicPath)) gaps.push(`Magic.cfg not in ${sources.dir}. Spell diffs were skipped.`);
    if (!fs.existsSync(npcPath)) gaps.push(`Npc.cfg not in ${sources.dir}. Monster diffs were skipped.`);
    if (!fs.existsSync(serverCpp)) {
        gaps.push('Server.cpp is not next to the cfg files. Signature rare drops were not compared. Npc.cfg has gold only, not item tables.');
    } else if (signatures.size === 0) {
        gaps.push('bGetItemNameWhenDeleteNpc was not found in Server.cpp. Signature rare drops were not compared.');
    }

    counts.itemsOlympia = olympiaItems.byId.size;
    counts.itemsOurs = ourItems.length;
    counts.spellsOlympia = magic.size;
    counts.spellsOurs = ourSpells.length;
    counts.monstersOurs = ourMonsters.length;
    counts.signatureTypes = signatures.size;

    const ourItemById = new Map(ourItems.map((item) => [item.id, item]));
    const itemNames = new Map();
    for (const item of ourItems) itemNames.set(item.id, item.name);
    for (const item of olympiaItems.byId.values()) {
        if (!itemNames.has(item.id)) itemNames.set(item.id, item.name);
    }

    const missingGear = [];
    let missingOther = 0;
    for (const item of olympiaItems.byId.values()) {
        const ours = ourItemById.get(item.id);
        if (!ours) {
            counts.itemsMissing++;
            if (GEAR_EFFECT_TYPES.has(item.effectType) || item.price >= 5000) missingGear.push(item);
            else missingOther++;
            continue;
        }
        if (ours.olympiaEffectType != null && item.effectType != null && ours.olympiaEffectType !== item.effectType) {
            pushFinding(findings, {
                score: 60,
                category: 'item-stat',
                subject: `${ours.name} (#${ours.id})`,
                olympia: `effect ${item.effectType}`,
                ours: `olympiaEffectType ${ours.olympiaEffectType}`,
                ratio: '',
                detail: `${ours.name} (#${ours.id}) effect type ${ours.olympiaEffectType} does not match Item.cfg ${item.effectType} (${item.name}). Magic rolls use this type.`,
            });
        }
        const sim = nameSimilarity(ours.name, item.name);
        if (sim < 0.55) {
            pushFinding(findings, {
                score: 64,
                category: 'item-stat',
                subject: `${ours.name} (#${ours.id})`,
                olympia: item.name,
                ours: ours.name,
                ratio: fmt(sim),
                detail: `Item id ${ours.id} is "${ours.name}" in Items.json and "${item.name}" in ${item.source}.`,
            });
        }
        if (ours.price != null && item.price > 0) {
            const priceRatio = ratioOf(ours.price, item.price);
            const score = outlierScore(priceRatio, { twoX: 50, high: 42, low: 40, floor: 1.8 });
            if (score > 0 && Math.abs(ours.price - item.price) >= 100) {
                pushFinding(findings, {
                    score,
                    category: 'item-stat',
                    subject: `${ours.name} (#${ours.id})`,
                    olympia: `price ${item.price}`,
                    ours: `price ${ours.price}`,
                    ratio: fmtRatio(priceRatio),
                    detail: `${ours.name} list price is ${fmtRatio(priceRatio)} Item.cfg (${ours.price} vs ${item.price}).`,
                });
            }
        }
        if (ours.maxLifeSpan != null && item.maxLife > 1) {
            const lifeRatio = ratioOf(ours.maxLifeSpan, item.maxLife);
            const score = outlierScore(lifeRatio, { twoX: 40, high: 34, low: 34, floor: 1.8 });
            if (score > 0) {
                pushFinding(findings, {
                    score,
                    category: 'item-stat',
                    subject: `${ours.name} (#${ours.id})`,
                    olympia: `maxLife ${item.maxLife}`,
                    ours: `maxLifeSpan ${ours.maxLifeSpan}`,
                    ratio: fmtRatio(lifeRatio),
                    detail: `${ours.name} durability is ${fmtRatio(lifeRatio)} Item.cfg (${ours.maxLifeSpan} vs ${item.maxLife}).`,
                });
            }
        }
    }
    missingGear.sort((a, b) => b.price - a.price || a.id - b.id);
    for (const item of missingGear.slice(0, 12)) {
        pushFinding(findings, {
            score: item.price >= 10000 ? 70 : 58,
            category: 'item-missing',
            subject: `${item.name} (#${item.id})`,
            olympia: `${item.source} effect ${item.effectType} price ${item.price}`,
            ours: 'absent',
            ratio: '',
            detail: `${item.name} (#${item.id}) is in ${item.source} and missing from Items.json.`,
        });
    }
    const hiddenGear = Math.max(0, missingGear.length - 12);
    if (hiddenGear + missingOther > 0) {
        pushFinding(findings, {
            score: 46,
            category: 'item-missing',
            subject: `${hiddenGear + missingOther} other Olympia items`,
            olympia: `${counts.itemsMissing} ids absent`,
            ours: `${counts.itemsOurs} catalog rows`,
            ratio: '',
            detail: `${counts.itemsMissing} Olympia item ids are absent from Items.json (${hiddenGear} further weapons/armor/priced rows not listed individually, ${missingOther} other rows).`,
        });
    }
    counts.itemsExtra = ourItems.filter((item) => !olympiaItems.byId.has(item.id)).length;

    const ourSpellById = new Map(ourSpells.map((spell) => [spell.id, spell]));
    const mappedServerIds = new Set(Object.values(OLYMPIA_TO_SERVER_SPELL));
    for (const magicRow of magic.values()) {
        const serverId = OLYMPIA_TO_SERVER_SPELL[magicRow.id];
        if (serverId == null) {
            counts.spellsUnmapped++;
            const damage = DAMAGE_MAGIC_TYPES.has(magicRow.type);
            const sold = magicRow.cost > 0;
            const pretty = magicRow.name.replace(/-/g, ' ');
            const alias = ourSpells.find((spell) => normName(spell.name) === normName(magicRow.name));
            pushFinding(findings, {
                score: damage && sold ? 78 : damage ? 64 : sold ? 56 : 36,
                category: 'spell-missing',
                subject: `${pretty} (magic ${magicRow.id})`,
                olympia: `type ${magicRow.type} mana ${magicRow.mana} cost ${magicRow.cost}`,
                ours: alias ? `same name at spell ${alias.id}, not mapped` : 'no Spells.json id',
                ratio: '',
                detail: alias
                    ? `${pretty} (Magic.cfg ${magicRow.id}) is not in the Olympia-to-server spell map. Spells.json has "${alias.name}" at id ${alias.id}, and that row is not wired to this Magic.cfg id.`
                    : `${pretty} (Magic.cfg ${magicRow.id}) is not in the Olympia-to-server spell map, so it cannot be cast from Spells.json.`,
            });
            continue;
        }
        const spell = ourSpellById.get(serverId);
        if (!spell) {
            pushFinding(findings, {
                score: 86,
                category: 'spell-missing',
                subject: `${magicRow.name.replace(/-/g, ' ')} → spell ${serverId}`,
                olympia: magicRow.name,
                ours: `Spells.json id ${serverId} missing`,
                ratio: '',
                detail: `Magic.cfg ${magicRow.id} ${magicRow.name} maps to Spells.json id ${serverId}, and that row is missing.`,
            });
            continue;
        }
        findings.push(...diffSpell(spell, magicRow));
    }
    const customSpells = ourSpells.filter((spell) => !mappedServerIds.has(spell.id));
    if (customSpells.length > 0) {
        gaps.push(`Spells.json ids not in the Olympia map (left unscored): ${customSpells.map((spell) => `${spell.id} ${spell.name}`).join(', ')}.`);
    }

    const defenseSamples = [];
    let matchedWithDefenseField = 0;
    const unmatched = [];
    for (const monster of ourMonsters) {
        if (monster.defense != null || monster.defenseRatio != null) matchedWithDefenseField++;
        const resolved = resolveNpc(monster, npcs);
        if (!resolved) {
            counts.monstersUnmatched++;
            unmatched.push(monster);
            let best = 0;
            let bestName = '';
            for (const row of npcs.byName.values()) {
                const sim = nameSimilarity(monster.name, row.name);
                if (sim > best) {
                    best = sim;
                    bestName = row.name;
                }
            }
            if (best >= 0.72) {
                const fallback = Math.max(1, Math.floor((monster.hp ?? defaults.hp) / 4));
                pushFinding(findings, {
                    score: 62,
                    category: 'monster-exp',
                    subject: `${monster.name} (#${monster.id})`,
                    olympia: `nearest ${bestName}`,
                    ours: `exp fallback ~HP/4 (${fallback})`,
                    ratio: '',
                    detail: `${monster.name} (#${monster.id}) looks like ${bestName} but does not match an Npc.cfg row, so kill exp falls back to about max HP / 4.`,
                });
            }
            continue;
        }
        counts.monstersMatched++;
        const npc = resolved.row;
        findings.push(...diffMonster(monster, npc, defaults).findings);
        findings.push(...diffDrops(monster, npc, signatures.get(npc.type), itemNames));
        defenseSamples.push({
            name: monster.name,
            id: monster.id,
            defense: npc.defense,
            npc: npc.name,
        });
    }

    defenseSamples.sort((a, b) => b.defense - a.defense);
    if (matchedWithDefenseField === 0 && defenseSamples.length > 0) {
        const uniqueNpc = [];
        const seenNpc = new Set();
        for (const row of defenseSamples) {
            if (seenNpc.has(row.npc)) continue;
            seenNpc.add(row.npc);
            uniqueNpc.push(row);
            if (uniqueNpc.length === 6) break;
        }
        const hardest = uniqueNpc[0];
        const top = uniqueNpc.map((row) => `${row.npc} DR ${row.defense}`).join(', ');
        pushFinding(findings, {
            score: 88,
            category: 'monster-defense',
            subject: 'monster defense ratio',
            olympia: `Npc.cfg DR, hardest ${hardest.npc} ${hardest.defense}`,
            ours: 'no defense field; hit rolls ignore DR',
            ratio: '',
            detail: `Monsters.json does not store defense, and melee hit chance does not use Npc.cfg defense ratio. Hit chance only applies a small penalty from the HP band, so ${hardest.npc} (DR ${hardest.defense}) is struck about as easily as a slime. Highest DR: ${top}.`,
        });
    }

    gaps.push('Kill exp is not stored on Monsters.json. Matched monsters read Npc.cfg through NpcExpCatalog at runtime, then MonsterExpFactor. This diff only flags names that miss that lookup and fall back to max HP / 4.');
    gaps.push('Middleland dragons have no Npc.cfg row of their own. They are compared through the exp name map: Earth and Lightning to Fire-Wyvern, Illusion and Poison to Wyvern, Black to Abaddon.');
    gaps.push('Weapon dice and armor defense ratio are read from Item.cfg at runtime when Items.json omits them (ItemAttackCatalog, ItemDefenseCatalog). Those omitted fields are not treated as drift.');
    gaps.push('Spell mana, required INT, and Magic Tower gold are read from Magic.cfg, not Spells.json. Dice are compared when Spells.json stores a damage or heal triple. A Magic.cfg triple with side 0 (Ice Storm is 4/0/0; the server stores 4d4) is not treated as a dice.');
    gaps.push('Npc.cfg does not list item drop tables. Gold is the last column. Rare per-type items come from Server.cpp bGetItemNameWhenDeleteNpc. The gen-tier weapon/armor switch in NpcDeadItemGenerator is not re-simulated, so a present potion or gold row is not a claim that every weight matches.');
    gaps.push(`Npc.cfg layout used: ${npcs.layout}. This tree's header is one ExpDice, then ADT/ADR, and a single Gold column (not Server.cpp ExpDiceMin/Max and GoldDiceMin/Max).`);
    if (counts.itemsExtra > 0) {
        gaps.push(`${counts.itemsExtra} Items.json ids are not in Item.cfg/Item2/Item3 (Chain Lords rows and stubs). Extra ids are not ranked.`);
    }
    if (unmatched.length > 0) {
        gaps.push(`Catalog monsters with no Npc.cfg combat row: ${unmatched.map((monster) => monster.name).join(', ')}.`);
    }
    const coveredTypes = new Set();
    for (const monster of ourMonsters) {
        const resolved = resolveNpc(monster, npcs);
        if (resolved) coveredTypes.add(resolved.row.type);
    }
    const uncoveredRare = [...signatures.keys()].filter((type) => !coveredTypes.has(type));
    if (uncoveredRare.length > 0) {
        gaps.push(`Signature drop types with no catalog monster: ${uncoveredRare.sort((a, b) => a - b).join(', ')}.`);
    }

    return finish(options, root, sources, findings, gaps, counts, {
        itemsPath,
        spellsPath,
        monstersPath,
        magicPath,
        npcPath,
        serverCpp: fs.existsSync(serverCpp) ? serverCpp : null,
        itemFiles: olympiaItems.files,
    });
}

function finish(options, root, sources, findings, gaps, counts, paths = {}) {
    findings.sort((a, b) => b.score - a.score || (CATEGORY_RANK[a.category] ?? 99) - (CATEGORY_RANK[b.category] ?? 99) || a.subject.localeCompare(b.subject));
    const result = {
        generatedAt: options.generatedAt ?? new Date().toISOString(),
        root,
        sources,
        paths,
        counts,
        gaps,
        findings,
    };
    result.markdown = buildReport(result);
    result.csv = buildCsv(result.findings);
    return result;
}

function buildCsv(findings) {
    const header = ['rank', 'score', 'category', 'subject', 'olympia', 'ours', 'ratio', 'detail'];
    const lines = [header.join(',')];
    findings.forEach((finding, index) => {
        lines.push([
            index + 1,
            finding.score,
            finding.category,
            finding.subject,
            finding.olympia,
            finding.ours,
            finding.ratio,
            finding.detail,
        ].map(csvCell).join(','));
    });
    return `${lines.join('\n')}\n`;
}

function csvCell(value) {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
}

function buildReport(result) {
    const lines = [];
    lines.push('# Game tables diff vs Helbreath Olympia');
    lines.push('');
    lines.push(`Run: ${result.generatedAt}.`);
    lines.push('');
    lines.push('## Sources');
    lines.push('');
    if (!result.sources.dir) {
        lines.push(`Olympia cfg directory: **not found.** Looked at ${result.sources.searched.join(', ')}.`);
    } else {
        lines.push(`Olympia configs: \`${result.sources.dir}\`.`);
        if (result.paths.itemFiles) lines.push(`Items: ${result.paths.itemFiles.map((file) => path.basename(file)).join(', ')} (${result.counts.itemsOlympia} ids) vs Items.json (${result.counts.itemsOurs} rows, ${result.counts.itemsMissing} Olympia ids missing).`);
        lines.push(`Magic.cfg spells: ${result.counts.spellsOlympia}. Unmapped to Spells.json: ${result.counts.spellsUnmapped}.`);
        lines.push(`Monsters.json: ${result.counts.monstersOurs}. Matched to Npc.cfg: ${result.counts.monstersMatched}. Unmatched: ${result.counts.monstersUnmatched}.`);
        lines.push(`Signature rare-drop NPC types parsed from Server.cpp: ${result.counts.signatureTypes}.`);
    }
    lines.push('');
    lines.push('Ranking is gameplay impact. A monster whose swing averages about twice Olympia `iDice(ADT, ADR)` is first. Missing signature drops, missing sold spells, and defense ratio that never reaches the hit roll come next. HP, speed, gold quantity, and item effect/price outliers follow.');
    const doubleHits = result.findings.filter((finding) => finding.category === 'monster-damage' && finding.score >= 90);
    if (doubleHits.length === 0) {
        lines.push('');
        lines.push('No matched monster averages about twice the Olympia damage dice. Mobs with no damage row sit on the Npc.cfg ADT/ADR range (min = ADT, max = ADT × ADR). The damage rows below are the outliers that remain.');
    }
    lines.push('');
    lines.push('## Ranked findings');
    lines.push('');
    if (result.findings.length === 0) {
        lines.push('No ranked differences.');
    } else {
        const shown = result.findings.slice(0, 40);
        shown.forEach((finding, index) => {
            lines.push(`${index + 1}. **${finding.detail}** (${finding.category}, score ${finding.score}${finding.ratio ? `, ${finding.ratio}` : ''})`);
        });
        if (result.findings.length > shown.length) {
            lines.push('');
            lines.push(`${result.findings.length - shown.length} more rows are in the CSV.`);
        }
    }
    lines.push('');
    lines.push('## Not compared');
    lines.push('');
    if (result.gaps.length === 0) lines.push('Nothing skipped.');
    else for (const gap of result.gaps) lines.push(`- ${gap}`);
    lines.push('');
    return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
    const options = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const next = () => {
            const value = argv[++i];
            if (value == null) throw new Error(`Missing value for ${arg}`);
            return value;
        };
        if (arg === '--out') options.out = path.resolve(next());
        else if (arg === '--md') options.md = path.resolve(next());
        else if (arg === '--csv') options.csv = path.resolve(next());
        else if (arg === '--config') options.configDir = path.resolve(next());
        else if (arg === '--reference') options.referenceDir = path.resolve(next());
        else if (arg === '--help') options.help = true;
        else throw new Error(`Unknown argument ${arg}`);
    }
    return options;
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        console.log('node tools/tables-diff.mjs [--out dir] [--md file] [--csv file] [--config dir] [--reference dir]');
        return;
    }
    if (!options.out && !options.md && !options.csv) {
        options.out = path.join(repoRoot, 'tmp-tables-diff');
    }
    if (options.out) {
        options.md = options.md ?? path.join(options.out, 'report.md');
        options.csv = options.csv ?? path.join(options.out, 'findings.csv');
    }
    const result = run(options);
    if (options.md) {
        fs.mkdirSync(path.dirname(options.md), { recursive: true });
        fs.writeFileSync(options.md, result.markdown);
    }
    if (options.csv) {
        fs.mkdirSync(path.dirname(options.csv), { recursive: true });
        fs.writeFileSync(options.csv, result.csv);
    }
    console.log(`items ${result.counts.itemsOurs}/${result.counts.itemsOlympia} missing ${result.counts.itemsMissing} spells ${result.counts.spellsOurs}/${result.counts.spellsOlympia} unmapped ${result.counts.spellsUnmapped}`);
    console.log(`monsters matched ${result.counts.monstersMatched}/${result.counts.monstersOurs} signatureTypes ${result.counts.signatureTypes} findings ${result.findings.length}`);
    console.log('top:');
    for (const finding of result.findings.slice(0, 10)) {
        console.log(`  ${String(finding.score).padStart(5)}  ${finding.category}  ${finding.subject}`);
    }
    if (options.md) console.log(`report ${options.md}`);
    if (options.csv) console.log(`csv ${options.csv}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
