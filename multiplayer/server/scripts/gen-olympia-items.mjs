/**
 * Generates Olympia item catalog from reference/Item.cfg (+ Item2/3) into:
 * - multiplayer/server/Config/Items.json
 * - multiplayer/mp-client/src/constants/OlympiaItems.generated.ts
 * - remaps multiplayer/server/Config/Monsters.json loot ids (old custom → Olympia ids)
 *
 * Run: node multiplayer/server/scripts/gen-olympia-items.mjs
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..', '..');
const cfgFiles = [
    path.join(repoRoot, 'reference', 'Item.cfg'),
    path.join(repoRoot, 'reference', 'Item2.cfg'),
    path.join(repoRoot, 'reference', 'Item3.cfg'),
];
const serverItemsPath = path.join(__dirname, '..', 'Config', 'Items.json');
const monstersPath = path.join(__dirname, '..', 'Config', 'Monsters.json');
const clientItemsTsPath = path.join(repoRoot, 'multiplayer', 'mp-client', 'src', 'constants', 'Items.ts');
const clientGeneratedPath = path.join(repoRoot, 'multiplayer', 'mp-client', 'src', 'constants', 'OlympiaItems.generated.ts');

/** Manual renames between legacy client names and Olympia cfg names (normalized). */
const NAME_ALIASES = {
    barbarianbattlehammer: 'barbarianhammer',
    darkknighttemplarsword: 'templersword',
    templarsword: 'templersword',
    merienshield: 'merienshield',
    merienplatemailm: 'merienplatemailm',
    merienplatemailw: 'merienplatemailw',
    chainmail: 'chainmailm',
    platemail: 'platemailm',
    hornedhelmet: 'hornedhelmm',
    wingedhelmet: 'wingshelmm',
    longcape: 'cape+1',
    chemise: 'chemisew',
    shirt: 'shirtm',
    magicwand1: 'magicwandms10',
    magicwand2: 'magicwandms20',
    berserkwand: 'berserkwandms20',
    hellboundleather: 'helboundleather',
    hellboundtongue: 'helboundtongue',
    ancienttabletlu: 'acienttabletlu',
    anvil: 'manufacturinghammer',
    klonesswand: 'klonesswandms20',
    aresdenheroarmor: 'aheroarmorm',
    elvineheroarmor: 'eheroarmorm',
    necklaceoffireprotection: 'knecklaceoffirepro',
    necklaceofpoisionprotection: 'knecklaceofpoisonpro',
    necklaceoficeprotection: 'knecklaceoficepro',
    necklaceofefreet: 'knecklaceofefreet',
    angelicpendantstr: 'angelicpandentstr',
    angelicpendantdex: 'angelicpandentdex',
    angelicpendantint: 'angelicpandentint',
    angelicpendantmag: 'angelicpandentmag',
};

/** Legacy custom item ids → Olympia ids when name matching is insufficient. */
const LEGACY_LOOT_ID_MAP = {
    133: 458,
    131: 456,
    150: 750,
    151: 751,
    126: 429,
    128: 453,
    79: 861,
    77: 257,
    78: 256,
    12: 470,
    36: 91,
    192: 204,
    188: 200,
    311: 868,
    215: 236,
};

/** Client/server item effects preserved by normalized Olympia cfg name. */
const EFFECTS_BY_NORM_NAME = {
    stormbringer: { client: ['STORM_BRINGER'], server: [{ effect: 0 }] },
};

const EPOS_TO_ITEM_TYPE = {
    1: 'helmet',
    2: 'armor',
    3: 'hauberk',
    4: 'leggings',
    5: 'boots',
    6: 'necklace',
    7: 'shield',
    8: 'weapon',
    9: 'weapon',
    10: 'ring',
    11: 'accessory',
    12: 'cape',
};

/**
 * Olympia Item.cfg ApprValue → equipped body `.spr` basenames (lowercase, no ext).
 * Source: reference/APPEARANCE_SPRITE_PAK_ANALYSIS.md (EPos tables).
 * Keys are ApprV (1-based as in cfg). Values: [maleSprite, femaleSprite].
 */
const APPR_BODY_SPRITES = {
    // EPos 1 helmet
    1: {
        1: ['mhelm1', 'whelm1'],
        2: ['mhelm2', 'whelm1'],
        3: ['mhelm3', 'whelm1'],
        4: ['mhelm4', 'whelm4'],
        5: ['nmhelm1', 'nwhelm1'],
        6: ['nmhelm2', 'nwhelm2'],
        7: ['nmhelm3', 'nwhelm3'],
        8: ['nmhelm4', 'nwhelm4'],
        9: ['mhhelm1', 'whhelm1'],
        10: ['mhhelm2', 'whhelm2'],
        11: ['mhcap1', 'whcap1'],
        12: ['mhcap2', 'whcap2'],
    },
    // EPos 2 armor
    2: {
        1: ['mlarmor', 'wbodice1'],
        2: ['mcmail', 'wbodice2'],
        3: ['msmail', 'wlarmor'],
        4: ['mpmail', 'wcmail'],
        5: ['mtunic', 'wsmail'],
        6: ['mrobe1', 'wpmail'],
        7: ['msanta', 'wrobe1'],
        8: ['mhpmail1', 'whpmail1'],
        9: ['mhpmail2', 'whpmail2'],
        10: ['mhrobe1', 'whrobe1'],
        11: ['mhrobe2', 'whrobe2'],
    },
    // EPos 3 hauberk / berk
    3: {
        1: ['mshirt', 'wchemiss'],
        2: ['mhauberk', 'wshirt'],
        3: ['mhhauberk1', 'whauberk'],
        4: ['mhhauberk2', 'whhauberk1'],
        6: ['mhhauberk2', 'whhauberk2'],
    },
    // EPos 4 leggings
    4: {
        1: ['mtrouser', 'wskirt'],
        2: ['mhtrouser', 'wtrouser'],
        3: ['mchoses', 'whtrouser'],
        4: ['mleggings', 'wchoses'],
        5: ['mhleggings1', 'wleggings'],
        6: ['mhleggings2', 'whleggings1'],
        7: ['mhleggings2', 'whleggings2'],
    },
    // EPos 5 boots
    5: {
        1: ['mshoes', 'wshoes'],
        2: ['mlboots', 'wlboots'],
    },
    // EPos 12 cape / mantle
    12: {
        1: ['mmantle01', 'wmantle01'],
        2: ['mmantle02', 'wmantle02'],
        3: ['mmantle03', 'wmantle03'],
        4: ['mmantle04', 'wmantle04'],
        5: ['mmantle05', 'wmantle05'],
        6: ['mmantle06', 'wmantle06'],
    },
};

/** Infer equippedSprite basenames from equipPos + apprValue when legacy override is absent. */
function inferEquippedSpritesFromAppr(row, itemType) {
    const epos = row.equipPos;
    const appr = row.apprValue;
    if (!epos || !appr) {
        return null;
    }
    // Shield / weapon / accessory have separate tables (handled elsewhere).
    if (!['helmet', 'armor', 'hauberk', 'leggings', 'boots', 'cape'].includes(itemType)) {
        return null;
    }
    const table = APPR_BODY_SPRITES[epos];
    if (!table) {
        return null;
    }
    const pair = table[appr];
    if (!pair) {
        return null;
    }
    return { male: pair[0], female: pair[1] };
}

function normName(name) {
    return name.toLowerCase().replace(/[^a-z0-9+]/g, '');
}

function resolveNormName(name) {
    const n = normName(name);
    return NAME_ALIASES[n] ?? n;
}

function parseItemLine(line) {
    const trimmed = line.trim();
    // Item3.cfg sometimes uses "Item  = id ..." (extra spaces before =).
    const match = trimmed.match(/^Item\s*=\s*(.+)$/);
    if (!match) {
        return null;
    }
    const tokens = match[1].trim().split(/\s+/);
    if (tokens.length < 26) {
        console.warn(`[gen-olympia-items] Skipping short line (${tokens.length} tokens): ${trimmed.slice(0, 80)}`);
        return null;
    }

    const id = Number.parseInt(tokens[0], 10);
    const name = tokens[1];
    const nums = tokens.slice(2).map((t) => Number.parseInt(t, 10));

    return {
        id,
        name,
        itemType: nums[0],
        equipPos: nums[1],
        effectType: nums[2],
        effectValues: nums.slice(3, 9),
        maxLifeSpan: nums[9],
        specialEffect: nums[10],
        sprite: nums[11],
        spriteFrame: nums[12],
        price: nums[13],
        weight: nums[14],
        apprValue: nums[15],
        speed: nums[16],
        levelLimit: nums[17],
        genderLimit: nums[18],
        specialEffectValue1: nums[19],
        specialEffectValue2: nums[20],
        relatedSkill: nums[21],
        category: nums[22],
        itemColor: nums[23],
    };
}

function loadOlympiaItems() {
    const byId = new Map();
    for (const file of cfgFiles) {
        const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
        for (const line of lines) {
            const row = parseItemLine(line);
            if (!row) {
                continue;
            }
            if (byId.has(row.id)) {
                console.warn(`[gen-olympia-items] Duplicate id ${row.id} (${row.name}) — keeping first`);
                continue;
            }
            byId.set(row.id, row);
        }
    }
    return [...byId.values()].sort((a, b) => a.id - b.id);
}

function inferServerItemType(row) {
    if (row.itemType === 1 && row.equipPos > 0) {
        return EPOS_TO_ITEM_TYPE[row.equipPos] ?? 'misc';
    }
    if (row.itemType === 6) {
        return 'misc';
    }
    return 'misc';
}

function inferStackable(row) {
    return row.itemType === 5 || row.itemType === 6 || row.itemType === 7 || row.maxLifeSpan === 1;
}

function inferConsumable(row) {
    if (row.itemType === 7) {
        return true;
    }
    if (row.name.toLowerCase().includes('potion') && row.itemType !== 1) {
        return true;
    }
    return false;
}

function inferWeaponType(row, itemType) {
    if (itemType !== 'weapon') {
        return undefined;
    }
    if (/\bbow\b/i.test(row.name) || /directbow|firebow|crossbow/i.test(row.name)) {
        return 1;
    }
    return undefined;
}

function inferOlympiaEffectType(row, itemType) {
    if (row.effectType === 13) {
        return 13;
    }
    if (itemType === 'weapon' && /wand/i.test(row.name)) {
        return 13;
    }
    if (itemType === 'weapon') {
        return 1;
    }
    if (['shield', 'armor', 'hauberk', 'leggings', 'boots', 'helmet', 'cape'].includes(itemType)) {
        return 2;
    }
    return undefined;
}

function inferBlockedSlots(row, itemType) {
    if (itemType === 'weapon' && (row.equipPos === 9 || row.equipPos === 10)) {
        return ['shield'];
    }
    return undefined;
}

/**
 * Helbreath Olympia `Spr` in Item.cfg is 1-based relative to MakeSprite pivot.
 * Our client loads item-pack.spr sheets 0-based, so Spr 1 → sheet 0.
 * Spr 20–22 are remapped to pack sheets 17–19 (capes / angelic pendants).
 */
function olympiaSprToItemPackSheet(spr) {
    if (spr >= 20 && spr <= 22) {
        return 17 + (spr - 20);
    }
    return spr - 1;
}

function buildLegacyServerEffectsByName(oldItems) {
    const map = new Map();
    for (const item of oldItems) {
        if (item.effects?.length) {
            map.set(resolveNormName(item.name), item.effects);
        }
    }
    return map;
}

function buildServerEntry(row, legacyEffectsByName) {
    const itemType = inferServerItemType(row);
    const entry = {
        id: row.id,
        name: row.name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\(/g, ' (').replace(/\)/g, ')'),
        itemType,
    };

    const blocked = inferBlockedSlots(row, itemType);
    if (blocked) {
        entry.blockedItemSlots = blocked;
    }
    if (inferStackable(row)) {
        entry.stackable = true;
    }
    if (inferConsumable(row)) {
        entry.consumable = true;
    }
    const weaponType = inferWeaponType(row, itemType);
    if (weaponType !== undefined) {
        entry.weaponType = weaponType;
    }
    if (row.genderLimit === 1) {
        entry.gender = 0;
    } else if (row.genderLimit === 2) {
        entry.gender = 1;
    }
    const olympiaEffectType = inferOlympiaEffectType(row, itemType);
    if (olympiaEffectType !== undefined) {
        entry.olympiaEffectType = olympiaEffectType;
    }

    // Fix display names that lost intentional casing from cfg
    entry.name = row.name
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\+/g, '+')
        .replace(/\(S\.C\)/g, '(S.C.)')
        .replace(/\(M\)/g, '(M)')
        .replace(/\(W\)/g, '(W)');

    const norm = resolveNormName(row.name);
    const hardcodedEffects = EFFECTS_BY_NORM_NAME[norm];
    if (hardcodedEffects?.server) {
        entry.effects = hardcodedEffects.server;
    } else {
        const legacyEffects = legacyEffectsByName.get(norm);
        if (legacyEffects?.length) {
            entry.effects = legacyEffects;
        }
    }

    return entry;
}

function readLegacyItemsTsSource() {
    const src = fs.readFileSync(clientItemsTsPath, 'utf8');
    const start = src.indexOf('export const ITEMS: Item[] = [');
    const end = src.lastIndexOf('\n];');
    if (start >= 0 && end >= 0) {
        return src;
    }
    try {
        return execSync('git show HEAD:multiplayer/mp-client/src/constants/Items.ts', {
            cwd: repoRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch {
        return src;
    }
}

/** Extract legacy handcrafted client rows from Items.ts for sprite/effect merge. */
function loadLegacyClientOverrides() {
    const src = readLegacyItemsTsSource();
    const start = src.indexOf('export const ITEMS: Item[] = [');
    const end = src.lastIndexOf('\n];');
    if (start < 0 || end < 0) {
        return new Map();
    }
    const body = src.slice(start, end + 3);
    const overrides = new Map();
    const blockRe = /\{\s*\n\s*id:\s*(\d+),[\s\S]*?\n\s*\}/g;
    let match;
    while ((match = blockRe.exec(body)) !== null) {
        const block = match[0];
        const id = Number.parseInt(match[1], 10);
        const nameMatch = block.match(/name:\s*'([^']*)'/);
        if (!nameMatch) {
            continue;
        }
        const name = nameMatch[1];
        const row = { id, name };
        const pick = (key, re) => {
            const m = block.match(re);
            if (m) {
                row[key] = m[1];
            }
        };
        pick('equippedSpriteMale', /equippedSpriteMale:\s*'([^']+)'/);
        pick('equippedSpriteFemale', /equippedSpriteFemale:\s*'([^']+)'/);
        pick('consumptionSound', /consumptionSound:\s*'([^']+)'/);
        const scaleMatch = block.match(/scale:\s*([\d.]+)/);
        if (scaleMatch) {
            row.scale = Number.parseFloat(scaleMatch[1]);
        }
        const startSheetMatch = block.match(/startSpriteSheetIndex:\s*(\d+)/);
        if (startSheetMatch) {
            row.startSpriteSheetIndex = Number.parseInt(startSheetMatch[1], 10);
        }
        const offsetXMatch = block.match(/offsetX:\s*(-?\d+)/);
        if (offsetXMatch) {
            row.offsetX = Number.parseInt(offsetXMatch[1], 10);
        }
        const offsetYMatch = block.match(/offsetY:\s*(-?\d+)/);
        if (offsetYMatch) {
            row.offsetY = Number.parseInt(offsetYMatch[1], 10);
        }
        if (block.includes('ItemEffect.STORM_BRINGER')) {
            row.effects = ['STORM_BRINGER'];
        } else if (block.includes('ItemEffect.GLARE')) {
            const colorMatch = block.match(/effectColor:\s*(0x[0-9a-fA-F]+|\d+)/);
            row.effects = [{ kind: 'GLARE', color: colorMatch ? colorMatch[1] : '0xff' }];
        } else if (block.includes('ItemEffect.GLOW')) {
            const colorMatch = block.match(/effectColor:\s*(0x[0-9a-fA-F]+|\d+)/);
            row.effects = [{ kind: 'GLOW', color: colorMatch ? colorMatch[1] : '0xffffff' }];
        }
        overrides.set(resolveNormName(name), row);
    }
    // Legacy "Shirt" was unisex; Olympia splits Shirt(M)/Shirt(W).
    if (overrides.has('shirtm') && !overrides.has('shirtw')) {
        const shirt = overrides.get('shirtm');
        overrides.set('shirtw', {
            name: 'Shirt(W)',
            equippedSpriteFemale: shirt.equippedSpriteFemale ?? 'wshirt',
        });
    }
    return overrides;
}

function buildClientRow(row, legacyByName) {
    const itemType = inferServerItemType(row);
    const client = {
        id: row.id,
        name: row.name.replace(/([a-z])([A-Z])/g, '$1 $2'),
        itemType,
    };

    const packSheet = olympiaSprToItemPackSheet(row.sprite);
    if (row.genderLimit === 1) {
        client.itemSheetIndexMale = packSheet;
        client.itemSpriteIndexMale = row.spriteFrame;
        client.gender = 0;
    } else if (row.genderLimit === 2) {
        client.itemSheetIndexFemale = packSheet;
        client.itemSpriteIndexFemale = row.spriteFrame;
        client.gender = 1;
    } else {
        client.itemSheetIndexMale = packSheet;
        client.itemSheetIndexFemale = packSheet;
        client.itemSpriteIndexMale = row.spriteFrame;
        client.itemSpriteIndexFemale = row.spriteFrame;
    }

    const blocked = inferBlockedSlots(row, itemType);
    if (blocked) {
        client.blockedItemSlots = blocked;
    }
    if (inferStackable(row)) {
        client.stackable = true;
    }
    if (inferConsumable(row)) {
        client.consumable = true;
    }
    if (inferWeaponType(row, itemType) === 1) {
        client.weaponType = 'BOW';
    }

    const legacy = legacyByName.get(resolveNormName(row.name));
    if (legacy) {
        if (legacy.equippedSpriteMale) {
            client.equippedSpriteMale = legacy.equippedSpriteMale;
        }
        if (legacy.equippedSpriteFemale) {
            client.equippedSpriteFemale = legacy.equippedSpriteFemale;
        }
        if (legacy.startSpriteSheetIndex !== undefined) {
            client.startSpriteSheetIndex = legacy.startSpriteSheetIndex;
        }
        if (legacy.scale !== undefined && row.id !== 90) {
            client.scale = legacy.scale;
        }
        if (legacy.offsetX !== undefined) {
            client.offsetX = legacy.offsetX;
        }
        if (legacy.offsetY !== undefined) {
            client.offsetY = legacy.offsetY;
        }
        if (legacy.consumptionSound) {
            client.consumptionSound = legacy.consumptionSound;
        }
        if (legacy.effects) {
            client.effects = legacy.effects;
        }
    }

    const hardcodedEffects = EFFECTS_BY_NORM_NAME[resolveNormName(row.name)];
    if (hardcodedEffects?.client) {
        client.effects = hardcodedEffects.client;
    }

    // Standard Olympia shields share msh/wsh; sheet base = inventory frame index × 7 states.
    if (itemType === 'shield') {
        if (!client.equippedSpriteMale) {
            client.equippedSpriteMale = 'msh';
        }
        if (!client.equippedSpriteFemale) {
            client.equippedSpriteFemale = 'wsh';
        }
        if (client.startSpriteSheetIndex === undefined) {
            client.startSpriteSheetIndex = (row.spriteFrame ?? 0) * 7;
        }
    }

    // Body gear: map Item.cfg ApprValue → appearance .spr (plate leggings → mleggings, etc.).
    const fromAppr = inferEquippedSpritesFromAppr(row, itemType);
    if (fromAppr) {
        if (!client.equippedSpriteMale) {
            client.equippedSpriteMale = fromAppr.male;
        }
        if (!client.equippedSpriteFemale) {
            client.equippedSpriteFemale = fromAppr.female;
        }
    }

    // Weapons: ApprV → msw/maxe/mstaff… + sheet index (world appearance).
    if (itemType === 'weapon' && row.apprValue > 0) {
        const w = inferWeaponSpritesFromAppr(row.apprValue);
        if (w) {
            if (!client.equippedSpriteMale) {
                client.equippedSpriteMale = w.male;
            }
            if (!client.equippedSpriteFemale) {
                client.equippedSpriteFemale = w.female;
            }
            if (client.startSpriteSheetIndex === undefined) {
                client.startSpriteSheetIndex = w.sheet;
            }
        }
    }

    return client;
}

/** ApprV → weapon appearance basename + start sheet (see APPEARANCE_SPRITE_PAK_ANALYSIS §4.1). */
function inferWeaponSpritesFromAppr(appr) {
    const a = Number(appr) || 0;
    const pair = (m, f, sheet) => ({ male: m, female: f, sheet });
    if (a >= 1 && a <= 4) return pair('msw', 'wsw', a - 1);
    if (a === 5) return pair('mswx', 'wswx', 0);
    if (a >= 6 && a <= 12) return pair('msw', 'wsw', a - 1);
    if (a === 13) return pair('msw2', 'wsw2', 0);
    if (a === 14) return pair('msw3', 'wsw3', 0);
    if (a === 15) return pair('mstormbringer', 'wstormbringer', 0);
    if (a === 16) return pair('mdarkexec', 'wdarkexec', 0);
    if (a === 17) return pair('mklonessblade', 'wklonessblade', 0);
    if (a === 18) return pair('mklonessastock', 'wklonessastock', 0);
    if (a === 19) return pair('mdebastator', 'wdebastator', 0);
    if (a === 20) return pair('maxe1', 'waxe1', 0);
    if (a === 21) return pair('maxe2', 'waxe2', 0);
    if (a === 22) return pair('maxe3', 'waxe3', 0);
    if (a === 23) return pair('maxe4', 'waxe4', 0);
    if (a === 24) return pair('maxe5', 'waxe5', 0);
    if (a === 25) return pair('maxe6', 'waxe6', 0);
    if (a === 26) return pair('mpickaxe1', 'wpickaxe1', 0);
    if (a === 27) return pair('mhoe', 'whoe', 0);
    if (a === 28) return pair('mklonessaxe', 'wklonessaxe', 0);
    if (a === 29) return pair('mlightblade', 'wlightblade', 0);
    if (a === 30) return pair('mhammer', 'whammer', 0);
    if (a === 31) return pair('mbhammer', 'wbhammer', 0);
    if (a === 32) return pair('mbabhammer', 'wbabhammer', 0);
    if (a === 33) return pair('mbshadowsword', 'wbshadowsword', 0);
    if (a === 34) return pair('mberserkwand', 'wberserkwand', 0);
    if (a === 35) return pair('mstaff1', 'wstaff1', 0);
    if (a === 36) return pair('mstaff2', 'wstaff2', 0);
    if (a === 37) return pair('mstaff3', 'wstaff3', 0);
    if (a === 38) return pair('mremagicwand', 'wremagicwand', 0);
    if (a === 39) return pair('mklonesswand', 'wklonesswand', 0);
    if (a === 40) return pair('mbo', 'wbo', 0);
    if (a === 41) return pair('mbo', 'wbo', 1);
    if (a === 42) return pair('mdirectbow', 'wdirectbow', 0);
    if (a === 43) return pair('mfirebow', 'wfirebow', 0);
    return pair('msw', 'wsw', 0);
}

function serializeClientRow(row) {
    const parts = [
        `    {`,
        `        id: ${row.id},`,
        `        name: ${JSON.stringify(row.name)},`,
        `        itemType: ${JSON.stringify(row.itemType)},`,
    ];
    const num = (k, v) => parts.push(`        ${k}: ${v},`);
    const str = (k, v) => parts.push(`        ${k}: ${JSON.stringify(v)},`);
    if (row.itemSheetIndexMale !== undefined) num('itemSheetIndexMale', row.itemSheetIndexMale);
    if (row.itemSheetIndexFemale !== undefined) num('itemSheetIndexFemale', row.itemSheetIndexFemale);
    if (row.itemSpriteIndexMale !== undefined) num('itemSpriteIndexMale', row.itemSpriteIndexMale);
    if (row.itemSpriteIndexFemale !== undefined) num('itemSpriteIndexFemale', row.itemSpriteIndexFemale);
    if (row.gender !== undefined) num('gender', row.gender);
    if (row.equippedSpriteMale) str('equippedSpriteMale', row.equippedSpriteMale);
    if (row.equippedSpriteFemale) str('equippedSpriteFemale', row.equippedSpriteFemale);
    if (row.startSpriteSheetIndex !== undefined) num('startSpriteSheetIndex', row.startSpriteSheetIndex);
    if (row.scale !== undefined) num('scale', row.scale);
    if (row.offsetX !== undefined) num('offsetX', row.offsetX);
    if (row.offsetY !== undefined) num('offsetY', row.offsetY);
    if (row.consumptionSound) str('consumptionSound', row.consumptionSound);
    if (row.stackable) parts.push('        stackable: true,');
    if (row.consumable) parts.push('        consumable: true,');
    if (row.weaponType) str('weaponType', row.weaponType);
    if (row.blockedItemSlots) {
        parts.push(`        blockedItemSlots: [${row.blockedItemSlots.map((s) => JSON.stringify(s)).join(', ')}],`);
    }
    if (row.effects) {
        if (row.effects === ['STORM_BRINGER'] || (Array.isArray(row.effects) && row.effects[0] === 'STORM_BRINGER')) {
            parts.push(`        effects: [{ effect: 'STORM_BRINGER' }],`);
        } else if (Array.isArray(row.effects) && row.effects[0]?.kind) {
            const eff = row.effects[0];
            parts.push(`        effects: [{ effect: '${eff.kind}', effectColor: ${eff.color} }],`);
        }
    }
    parts.push('    }');
    return parts.join('\n');
}

function remapMonsterLoot(oldItems, newItems) {
    const oldById = new Map(oldItems.map((i) => [i.id, i]));
    const newById = new Map(newItems.map((i) => [i.id, i]));
    const newByNorm = new Map(newItems.map((i) => [resolveNormName(i.name), i.id]));
    const idRemap = new Map();
    for (const old of oldItems) {
        const target = newByNorm.get(resolveNormName(old.name));
        if (target !== undefined && target !== old.id) {
            idRemap.set(old.id, target);
        }
    }
    for (const [oldId, newId] of Object.entries(LEGACY_LOOT_ID_MAP)) {
        idRemap.set(Number.parseInt(oldId, 10), newId);
    }

    const monsters = JSON.parse(fs.readFileSync(monstersPath, 'utf8'));
    let remapped = 0;
    let missing = new Set();
    let skippedBad = 0;
    for (const monster of monsters) {
        for (const loot of monster.loot ?? []) {
            const itemId = loot.itemId;
            if (idRemap.has(itemId)) {
                const nextId = idRemap.get(itemId);
                const oldItem = oldById.get(itemId);
                const newItem = newById.get(nextId);
                // Safety: never remap gold/potions/materials onto gear (caused 21% necklace rain 2026-07-25).
                const oldType = (oldItem?.itemType || '').toLowerCase();
                const newType = (newItem?.itemType || '').toLowerCase();
                const gearTypes = new Set(['necklace', 'weapon', 'shield', 'armor', 'hauberk', 'leggings', 'boots', 'helmet', 'cape', 'ring', 'accessory']);
                const consumableish = oldType === 'misc' || oldItem?.stackable === true || itemId === 90;
                if (consumableish && gearTypes.has(newType)) {
                    skippedBad++;
                    continue;
                }
                loot.itemId = nextId;
                remapped++;
            } else if (!newById.has(itemId)) {
                missing.add(`${itemId}:${oldById.get(itemId)?.name ?? '?'}`);
            }
        }
    }
    fs.writeFileSync(monstersPath, `${JSON.stringify(monsters, null, 2)}\n`, 'utf8');
    if (skippedBad > 0) {
        console.warn(`[gen-olympia-items] Skipped ${skippedBad} unsafe loot remaps (consumable→gear).`);
    }
    return { remapped, missing: [...missing] };
}

const MAP_GENERATED_ITEM_FN = `function mapGeneratedItem(row: OlympiaGeneratedItemRow): Item {
    const itemType = itemTypeFromDirectoryString(row.itemType);
    const blocked = row.blockedItemSlots?.map((s) => itemTypeFromDirectoryString(s)).filter(Boolean) as ItemTypes[] | undefined;
    const effects = row.effects?.map((eff) => {
        if (eff.effect === 'STORM_BRINGER') {
            return { effect: ItemEffect.STORM_BRINGER };
        }
        if (eff.effect === 'GLARE') {
            return { effect: ItemEffect.GLARE, effectColor: eff.effectColor };
        }
        if (eff.effect === 'GLOW') {
            return { effect: ItemEffect.GLOW, effectColor: eff.effectColor };
        }
        return undefined;
    }).filter((e): e is Effect => e !== undefined);
    return {
        id: row.id,
        name: row.name,
        itemType,
        itemSheetIndexMale: row.itemSheetIndexMale,
        itemSheetIndexFemale: row.itemSheetIndexFemale,
        itemSpriteIndexMale: row.itemSpriteIndexMale,
        itemSpriteIndexFemale: row.itemSpriteIndexFemale,
        gender: row.gender === 1 ? Gender.FEMALE : row.gender === 0 ? Gender.MALE : undefined,
        equippedSpriteMale: row.equippedSpriteMale,
        equippedSpriteFemale: row.equippedSpriteFemale,
        startSpriteSheetIndex: row.startSpriteSheetIndex,
        scale: row.scale,
        offsetX: row.offsetX,
        offsetY: row.offsetY,
        consumptionSound: row.consumptionSound,
        blockedItemSlots: blocked?.length ? blocked : undefined,
        stackable: row.stackable,
        consumable: row.consumable ? true : undefined,
        weaponType: row.weaponType === 'BOW' ? WeaponType.BOW : undefined,
        effects: effects?.length ? effects : undefined,
    };
}

export const ITEMS: Item[] = OLYMPIA_GENERATED_ITEMS.map(mapGeneratedItem);
`;

function patchItemsTs() {
    let src = fs.readFileSync(clientItemsTsPath, 'utf8');
    const importLine = "import { OLYMPIA_GENERATED_ITEMS, type OlympiaGeneratedItemRow } from './OlympiaItems.generated';\n";
    if (!src.includes("OlympiaItems.generated")) {
        src = src.replace(
            "import { Gender } from '../Types';\n",
            "import { Gender } from '../Types';\n" + importLine,
        );
    }

    const mapFnStart = src.indexOf('function mapGeneratedItem(');
    const itemsExport = 'export const ITEMS: Item[] = OLYMPIA_GENERATED_ITEMS.map(mapGeneratedItem);';
    if (mapFnStart >= 0 && src.includes(itemsExport)) {
        const afterItems = src.indexOf(itemsExport, mapFnStart);
        const mapFnEnd = src.indexOf('\nexport const ITEMS:', mapFnStart);
        let itemsEnd = afterItems >= 0 ? afterItems + itemsExport.length : -1;
        while (itemsEnd >= 0) {
            const nextDup = src.indexOf('\nexport const ITEMS:', itemsEnd);
            if (nextDup === itemsEnd) {
                itemsEnd = nextDup + '\nexport const ITEMS:'.length;
                const lineEnd = src.indexOf('\n', itemsEnd);
                itemsEnd = lineEnd >= 0 ? lineEnd : src.length;
                continue;
            }
            break;
        }
        if (mapFnEnd >= 0 && itemsEnd > mapFnEnd) {
            src = src.slice(0, mapFnStart) + MAP_GENERATED_ITEM_FN + src.slice(itemsEnd);
            fs.writeFileSync(clientItemsTsPath, src, 'utf8');
            return;
        }
    }

    const marker = 'export const ITEMS: Item[] = [';
    const start = src.indexOf(marker);
    const end = src.lastIndexOf('\n];');
    if (start < 0 || end < 0) {
        throw new Error('Could not locate ITEMS array or mapGeneratedItem in Items.ts');
    }
    const head = src.slice(0, start);
    const tail = src.slice(end + 3);
    fs.writeFileSync(clientItemsTsPath, head + MAP_GENERATED_ITEM_FN + tail, 'utf8');
}

function main() {
    const olympiaRows = loadOlympiaItems();
    console.log(`[gen-olympia-items] Parsed ${olympiaRows.length} Olympia items`);

    const legacyByName = loadLegacyClientOverrides();
    console.log(`[gen-olympia-items] Loaded ${legacyByName.size} legacy client overrides by name`);

    const backupPath = serverItemsPath + '.pre-olympia.bak';
    const oldServerItems = fs.existsSync(backupPath)
        ? JSON.parse(fs.readFileSync(backupPath, 'utf8'))
        : JSON.parse(fs.readFileSync(serverItemsPath, 'utf8'));
    if (!fs.existsSync(backupPath)) {
        fs.writeFileSync(backupPath, JSON.stringify(oldServerItems, null, 2));
    }

    const legacyEffectsByName = buildLegacyServerEffectsByName(oldServerItems);
    const serverItems = olympiaRows.map((row) => buildServerEntry(row, legacyEffectsByName));
    fs.writeFileSync(serverItemsPath, `${JSON.stringify(serverItems, null, 2)}\n`, 'utf8');

    const clientRows = olympiaRows.map((r) => buildClientRow(r, legacyByName));
    const clientTs = [
        '/** Auto-generated from reference/Item.cfg — do not edit. Run: node multiplayer/server/scripts/gen-olympia-items.mjs */',
        'export interface OlympiaGeneratedItemRow {',
        '    id: number;',
        '    name: string;',
        '    itemType: string;',
        '    itemSheetIndexMale?: number;',
        '    itemSheetIndexFemale?: number;',
        '    itemSpriteIndexMale?: number;',
        '    itemSpriteIndexFemale?: number;',
        '    gender?: number;',
        '    equippedSpriteMale?: string;',
        '    equippedSpriteFemale?: string;',
        '    startSpriteSheetIndex?: number;',
        '    scale?: number;',
        '    offsetX?: number;',
        '    offsetY?: number;',
        '    consumptionSound?: string;',
        '    stackable?: boolean;',
        '    consumable?: boolean;',
        '    weaponType?: string;',
        '    blockedItemSlots?: string[];',
        '    effects?: Array<{ effect: string; effectColor?: number }>;',
        '}',
        'export const OLYMPIA_GENERATED_ITEMS: OlympiaGeneratedItemRow[] = [',
        clientRows.map(serializeClientRow).join(',\n'),
        '];',
        '',
    ].join('\n');
    fs.writeFileSync(clientGeneratedPath, clientTs, 'utf8');

    const { remapped, missing } = remapMonsterLoot(oldServerItems, serverItems);
    console.log(`[gen-olympia-items] Remapped ${remapped} monster loot entries`);
    if (missing.length > 0) {
        console.warn(`[gen-olympia-items] ${missing.length} loot ids could not be remapped:`);
        for (const m of missing.slice(0, 30)) {
            console.warn(`  - ${m}`);
        }
    }

    patchItemsTs();
    console.log('[gen-olympia-items] Updated Items.ts to import OlympiaItems.generated.ts');
    console.log(`[gen-olympia-items] Wrote ${serverItems.length} server items, ${clientRows.length} client rows`);
}

main();
