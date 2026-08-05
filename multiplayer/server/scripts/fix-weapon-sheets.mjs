/**
 * Re-parse Item.cfg with line continuation and fix weapon startSpriteSheetIndex + sprites.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..', '..');
const genPath = path.join(root, 'multiplayer', 'mp-client', 'src', 'constants', 'OlympiaItems.generated.ts');
const cfgFiles = ['Item.cfg', 'Item2.cfg', 'Item3.cfg'].map((f) => path.join(root, 'reference', f));

function weaponAppr(appr) {
    const a = Number(appr) || 0;
    if (a >= 1 && a <= 4) return { m: 'msw', f: 'wsw', sheet: a - 1 };
    if (a === 5) return { m: 'mswx', f: 'wswx', sheet: 0 };
    if (a >= 6 && a <= 12) return { m: 'msw', f: 'wsw', sheet: a - 1 };
    if (a === 13) return { m: 'msw2', f: 'wsw2', sheet: 0 };
    if (a === 14) return { m: 'msw3', f: 'wsw3', sheet: 0 };
    if (a === 15) return { m: 'mstormbringer', f: 'wstormbringer', sheet: 0 };
    if (a === 16) return { m: 'mdarkexec', f: 'wdarkexec', sheet: 0 };
    if (a === 17) return { m: 'mklonessblade', f: 'wklonessblade', sheet: 0 };
    if (a === 18) return { m: 'mklonessastock', f: 'wklonessastock', sheet: 0 };
    if (a === 19) return { m: 'mdebastator', f: 'wdebastator', sheet: 0 };
    if (a === 20) return { m: 'maxe1', f: 'waxe1', sheet: 0 };
    if (a === 21) return { m: 'maxe2', f: 'waxe2', sheet: 0 };
    if (a === 22) return { m: 'maxe3', f: 'waxe3', sheet: 0 };
    if (a === 23) return { m: 'maxe4', f: 'waxe4', sheet: 0 };
    if (a === 24) return { m: 'maxe5', f: 'waxe5', sheet: 0 };
    if (a === 25) return { m: 'maxe6', f: 'waxe6', sheet: 0 };
    if (a === 26) return { m: 'mpickaxe1', f: 'wpickaxe1', sheet: 0 };
    if (a === 27) return { m: 'mhoe', f: 'whoe', sheet: 0 };
    if (a === 28) return { m: 'mklonessaxe', f: 'wklonessaxe', sheet: 0 };
    if (a === 29) return { m: 'mlightblade', f: 'wlightblade', sheet: 0 };
    if (a === 30) return { m: 'mhammer', f: 'whammer', sheet: 0 };
    if (a === 31) return { m: 'mbhammer', f: 'wbhammer', sheet: 0 };
    if (a === 32) return { m: 'mbabhammer', f: 'wbabhammer', sheet: 0 };
    if (a === 33) return { m: 'mbshadowsword', f: 'wbshadowsword', sheet: 0 };
    if (a === 34) return { m: 'mberserkwand', f: 'wberserkwand', sheet: 0 };
    if (a === 35) return { m: 'mstaff1', f: 'wstaff1', sheet: 0 };
    if (a === 36) return { m: 'mstaff2', f: 'wstaff2', sheet: 0 };
    if (a === 37) return { m: 'mstaff3', f: 'wstaff3', sheet: 0 };
    if (a === 38) return { m: 'mremagicwand', f: 'wremagicwand', sheet: 0 };
    if (a === 39) return { m: 'mklonesswand', f: 'wklonesswand', sheet: 0 };
    if (a === 40) return { m: 'mbo', f: 'wbo', sheet: 0 };
    if (a === 41) return { m: 'mbo', f: 'wbo', sheet: 1 };
    if (a === 42) return { m: 'mdirectbow', f: 'wdirectbow', sheet: 0 };
    if (a === 43) return { m: 'mfirebow', f: 'wfirebow', sheet: 0 };
    return { m: 'msw', f: 'wsw', sheet: 0 };
}

function loadCfg() {
    const byId = new Map();
    for (const file of cfgFiles) {
        if (!fs.existsSync(file)) continue;
        const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
        // Join continued item lines: lines that don't start with Item= and aren't blank/comment continue previous.
        const logical = [];
        let cur = '';
        for (const line of raw.split('\n')) {
            const t = line.trim();
            if (!t || t.startsWith('//') || t.startsWith('#')) continue;
            if (/^Item\s*=/.test(t)) {
                if (cur) logical.push(cur);
                cur = t;
            } else if (cur) {
                cur += ' ' + t;
            }
        }
        if (cur) logical.push(cur);

        for (const entry of logical) {
            const m = entry.match(/^Item\s*=\s*(.+)$/);
            if (!m) continue;
            const parts = m[1].trim().split(/\s+/);
            if (parts.length < 24) continue;
            const id = Number(parts[0]);
            if (byId.has(id)) continue;
            const nums = parts.slice(2).map((x) => Number.parseInt(x, 10));
            byId.set(id, {
                id,
                name: parts[1],
                equipPos: nums[1],
                appr: nums[15],
            });
        }
    }
    return byId;
}

const cfg = loadCfg();
console.log('cfg samples', [1, 2, 17, 59, 258].map((id) => cfg.get(id)));

let src = fs.readFileSync(genPath, 'utf8');
let fixed = 0;

// For each weapon block, rewrite equipped sprites + sheet from correct appr
src = src.replace(/\{\s*\n\s*id:\s*(\d+),([\s\S]*?)\n\s*\}/g, (block, idStr, body) => {
    const id = Number(idStr);
    const c = cfg.get(id);
    if (!c || (c.equipPos !== 8 && c.equipPos !== 9)) return block;
    if (!/itemType:\s*"weapon"/.test(block)) return block;

    const w = weaponAppr(c.appr);
    let b = body;
    // strip existing equipped/start fields so we rewrite cleanly
    b = b.replace(/\n\s*equippedSpriteMale:\s*"[^"]*",?/g, '');
    b = b.replace(/\n\s*equippedSpriteFemale:\s*"[^"]*",?/g, '');
    b = b.replace(/\n\s*startSpriteSheetIndex:\s*-?\d+,?/g, '');
    b = b.replace(/,(\s*),/g, ',$1');
    b = b.replace(/,(\s*)$/g, '$1');
    const insert = `\n        equippedSpriteMale: "${w.m}",\n        equippedSpriteFemale: "${w.f}",\n        startSpriteSheetIndex: ${w.sheet},`;
    fixed++;
    return `{\n        id: ${id},${b}${insert}\n    }`;
});

src = src.replace(/,(\s*),/g, ',$1');
fs.writeFileSync(genPath, src);
console.log('fixed weapons', fixed);
for (const id of [1, 2, 17, 18, 59, 258]) {
    const m = src.match(new RegExp(`id:\\s*${id},[\\s\\S]{0,400}`));
    console.log('---', id, m?.[0]?.slice(0, 280));
}
