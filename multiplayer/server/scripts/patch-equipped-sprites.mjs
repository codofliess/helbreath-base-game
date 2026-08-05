/**
 * One-shot / ops: fill missing equippedSpriteMale/Female on OlympiaItems.generated.ts
 * from Item.cfg ApprValue tables (body gear only). Does not rewrite Items.json.
 *
 * Run: node multiplayer/server/scripts/patch-equipped-sprites.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..', '..');
const cfgFiles = [
    path.join(repoRoot, 'reference', 'Item.cfg'),
    path.join(repoRoot, 'reference', 'Item2.cfg'),
    path.join(repoRoot, 'reference', 'Item3.cfg'),
];
const clientGeneratedPath = path.join(
    repoRoot,
    'multiplayer',
    'mp-client',
    'src',
    'constants',
    'OlympiaItems.generated.ts',
);

const EPOS_TO_ITEM_TYPE = {
    1: 'helmet',
    2: 'armor',
    3: 'hauberk',
    4: 'leggings',
    5: 'boots',
    12: 'cape',
};

const APPR_BODY_SPRITES = {
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
    3: {
        1: ['mshirt', 'wchemiss'],
        2: ['mhauberk', 'wshirt'],
        3: ['mhhauberk1', 'whauberk'],
        4: ['mhhauberk2', 'whhauberk1'],
        6: ['mhhauberk2', 'whhauberk2'],
    },
    4: {
        1: ['mtrouser', 'wskirt'],
        2: ['mhtrouser', 'wtrouser'],
        3: ['mchoses', 'whtrouser'],
        4: ['mleggings', 'wchoses'],
        5: ['mhleggings1', 'wleggings'],
        6: ['mhleggings2', 'whleggings1'],
        7: ['mhleggings2', 'whleggings2'],
    },
    5: {
        1: ['mshoes', 'wshoes'],
        2: ['mlboots', 'wlboots'],
    },
    12: {
        1: ['mmantle01', 'wmantle01'],
        2: ['mmantle02', 'wmantle02'],
        3: ['mmantle03', 'wmantle03'],
        4: ['mmantle04', 'wmantle04'],
        5: ['mmantle05', 'wmantle05'],
        6: ['mmantle06', 'wmantle06'],
    },
};

function parseItemLine(line) {
    const match = line.trim().match(/^Item\s*=\s*(.+)$/);
    if (!match) return null;
    const tokens = match[1].trim().split(/\s+/);
    if (tokens.length < 26) return null;
    const nums = tokens.slice(2).map((t) => Number.parseInt(t, 10));
    return {
        id: Number.parseInt(tokens[0], 10),
        name: tokens[1],
        equipPos: nums[1],
        apprValue: nums[15],
        genderLimit: nums[18],
    };
}

const byId = new Map();
for (const file of cfgFiles) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const row = parseItemLine(line);
        if (row && !byId.has(row.id)) byId.set(row.id, row);
    }
}

let src = fs.readFileSync(clientGeneratedPath, 'utf8');
let patched = 0;
const examples = [];

// Match each item object block loosely.
const blockRe = /(\{\s*\n\s*id:\s*(\d+),[\s\S]*?\n\s*\})/g;
src = src.replace(blockRe, (block, _full, idStr) => {
    const id = Number.parseInt(idStr, 10);
    const cfg = byId.get(id);
    if (!cfg) return block;
    const itemType = EPOS_TO_ITEM_TYPE[cfg.equipPos];
    if (!itemType) return block;
    const pair = APPR_BODY_SPRITES[cfg.equipPos]?.[cfg.apprValue];
    if (!pair) return block;

    let next = block;
    const [male, female] = pair;
    if (!/equippedSpriteMale:/.test(next)) {
        // Insert before closing brace
        next = next.replace(/\n\s*\}$/, `,\n        equippedSpriteMale: "${male}",\n    }`);
        patched++;
        if (examples.length < 12) examples.push(`${id} ${cfg.name} +male=${male}`);
    }
    if (!/equippedSpriteFemale:/.test(next)) {
        next = next.replace(/\n\s*\}$/, `,\n        equippedSpriteFemale: "${female}",\n    }`);
        patched++;
        if (examples.length < 12) examples.push(`${id} ${cfg.name} +female=${female}`);
    }
    return next;
});

fs.writeFileSync(clientGeneratedPath, src, 'utf8');
console.log(`[patch-equipped-sprites] fields added: ${patched}`);
for (const e of examples) console.log('  ', e);

// Sanity: plate leggings
const plate = src.match(/id:\s*462,[\s\S]{0,400}/);
console.log('[check 462]', plate?.[0]?.slice(0, 350));
