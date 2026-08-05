/**
 * Fill missing weapon/shield equippedSprite + startSpriteSheetIndex from Item.cfg ApprV.
 * Body gear already patched separately. Keeps existing sprites.
 * node multiplayer/server/scripts/patch-weapon-sprites.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..', '..');
const genPath = path.join(root, 'multiplayer', 'mp-client', 'src', 'constants', 'OlympiaItems.generated.ts');
const cfgFiles = ['Item.cfg', 'Item2.cfg', 'Item3.cfg'].map((f) => path.join(root, 'reference', f));

/** ApprV → [maleSprite, femaleSprite, startSheet] for weapons (EPos 8/9). */
function weaponAppr(appr) {
    const a = appr | 0;
    // Swords msw/wsw
    if (a >= 1 && a <= 4) return ['msw', 'wsw', a - 1];
    if (a === 5) return ['mswx', 'wswx', 0];
    if (a >= 6 && a <= 12) return ['msw', 'wsw', a - 1]; // sheets 5–11
    if (a === 13) return ['msw2', 'wsw2', 0];
    if (a === 14) return ['msw3', 'wsw3', 0];
    if (a === 15) return ['mstormbringer', 'wstormbringer', 0];
    if (a === 16) return ['mdarkexec', 'wdarkexec', 0];
    if (a === 17) return ['mklonessblade', 'wklonessblade', 0];
    if (a === 18) return ['mklonessastock', 'wklonessastock', 0];
    if (a === 19) return ['mdebastator', 'wdebastator', 0];
    if (a === 20) return ['maxe1', 'waxe1', 0];
    if (a === 21) return ['maxe2', 'waxe2', 0];
    if (a === 22) return ['maxe3', 'waxe3', 0];
    if (a === 23) return ['maxe4', 'waxe4', 0];
    if (a === 24) return ['maxe5', 'waxe5', 0];
    if (a === 25) return ['maxe6', 'waxe6', 0];
    if (a === 26) return ['mpickaxe1', 'wpickaxe1', 0];
    if (a === 27) return ['mhoe', 'whoe', 0];
    if (a === 28) return ['mklonessaxe', 'wklonessaxe', 0];
    if (a === 29) return ['mlightblade', 'wlightblade', 0];
    if (a === 30) return ['mhammer', 'whammer', 0];
    if (a === 31) return ['mbhammer', 'wbhammer', 0];
    if (a === 32) return ['mbabhammer', 'wbabhammer', 0];
    if (a === 33) return ['mbshadowsword', 'wbshadowsword', 0];
    if (a === 34) return ['mberserkwand', 'wberserkwand', 0];
    if (a === 35) return ['mstaff1', 'wstaff1', 0];
    if (a === 36) return ['mstaff2', 'wstaff2', 0];
    if (a === 37) return ['mstaff3', 'wstaff3', 0];
    if (a === 38) return ['mremagicwand', 'wremagicwand', 0];
    if (a === 39) return ['mklonesswand', 'wklonesswand', 0];
    if (a === 40) return ['mbo', 'wbo', 0];
    if (a === 41) return ['mbo', 'wbo', 1];
    if (a === 42) return ['mdirectbow', 'wdirectbow', 0];
    if (a === 43) return ['mfirebow', 'wfirebow', 0];
    // Fallback dagger-class
    return ['msw', 'wsw', 0];
}

function parseCfg() {
    const byId = new Map();
    for (const file of cfgFiles) {
        if (!fs.existsSync(file)) continue;
        for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
            const m = line.trim().match(/^Item\s*=\s*(.+)$/);
            if (!m) continue;
            const t = m[1].trim().split(/\s+/);
            if (t.length < 26) continue;
            const id = Number(t[0]);
            if (byId.has(id)) continue;
            const nums = t.slice(2).map((x) => Number.parseInt(x, 10));
            byId.set(id, {
                id,
                name: t[1],
                equipPos: nums[1],
                appr: nums[15],
                spriteFrame: nums[12],
            });
        }
    }
    return byId;
}

const cfg = parseCfg();
let src = fs.readFileSync(genPath, 'utf8');
let added = 0;

src = src.replace(/(\{\s*\n\s*id:\s*(\d+),[\s\S]*?\n\s*\})/g, (block, _full, idStr) => {
    const id = Number(idStr);
    const c = cfg.get(id);
    if (!c) return block;
    const epos = c.equipPos;
    // Weapons EPos 8/9
    if (epos !== 8 && epos !== 9) {
        // Shields already handled; skip non-weapons
        return block;
    }
    if (!/itemType:\s*"weapon"/.test(block)) return block;

    const [male, female, sheet] = weaponAppr(c.appr);
    let next = block;
    if (!/equippedSpriteMale:/.test(next)) {
        next = next.replace(/\n(\s*)\}/, `,\n$1    equippedSpriteMale: "${male}",\n$1}`);
        added++;
    }
    if (!/equippedSpriteFemale:/.test(next)) {
        next = next.replace(/\n(\s*)\}/, `,\n$1    equippedSpriteFemale: "${female}",\n$1}`);
        added++;
    }
    if (!/startSpriteSheetIndex:/.test(next)) {
        next = next.replace(/\n(\s*)\}/, `,\n$1    startSpriteSheetIndex: ${sheet},\n$1}`);
        added++;
    }
    return next;
});

// Fix accidental double commas
src = src.replace(/,(\s*),/g, ',$1');

// CritCandy 970 if missing
if (!/id:\s*970,/.test(src)) {
    src = src.replace(
        /export const OLYMPIA_GENERATED_ITEMS[^=]*=\s*\[/,
        (h) => `${h}
    {
        id: 970,
        name: "Crit Candy",
        itemType: "misc",
        itemSheetIndexMale: 5,
        itemSheetIndexFemale: 5,
        itemSpriteIndexMale: 0,
        itemSpriteIndexFemale: 0,
        stackable: true,
        consumable: true,
    },`,
    );
    added++;
    console.log('Added CritCandy 970');
}

fs.writeFileSync(genPath, src);
console.log(`Weapon/sprite fields touched: ${added}`);
const sample = src.match(/id:\s*17,[\s\S]{0,350}/);
console.log('LongSword sample:\n', sample?.[0]?.slice(0, 340));
const d2 = src.match(/id:\s*2,[\s\S]{0,350}/);
console.log('Dagger SC sample:\n', d2?.[0]?.slice(0, 340));
