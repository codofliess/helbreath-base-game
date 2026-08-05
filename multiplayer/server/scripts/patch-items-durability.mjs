/**
 * Merges Olympia Item.cfg maxLifeSpan / price / category into server Items.json
 * without regenerating the full catalog (preserves hand-tuned fields).
 *
 * Run: node multiplayer/server/scripts/patch-items-durability.mjs
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
const itemsPath = path.join(__dirname, '..', 'Config', 'Items.json');

function parseItemLine(line) {
    const match = line.trim().match(/^Item\s*=\s*(.+)$/);
    if (!match) return null;
    const tokens = match[1].trim().split(/\s+/);
    if (tokens.length < 26) return null;
    const id = Number.parseInt(tokens[0], 10);
    const nums = tokens.slice(2).map((t) => Number.parseInt(t, 10));
    return {
        id,
        maxLifeSpan: nums[9],
        price: nums[13],
        category: nums[22],
    };
}

const byId = new Map();
for (const file of cfgFiles) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const row = parseItemLine(line);
        if (!row || byId.has(row.id)) continue;
        byId.set(row.id, row);
    }
}

const items = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
let patched = 0;
for (const item of items) {
    const row = byId.get(item.id);
    if (!row) continue;
    let changed = false;
    if (row.maxLifeSpan > 0 && item.maxLifeSpan !== row.maxLifeSpan) {
        item.maxLifeSpan = row.maxLifeSpan;
        changed = true;
    }
    if (row.price > 0 && item.price !== row.price) {
        item.price = row.price;
        changed = true;
    }
    if (row.category >= 0 && item.category !== row.category) {
        item.category = row.category;
        changed = true;
    }
    if (changed) patched++;
}

fs.writeFileSync(itemsPath, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
console.log(`[patch-items-durability] Patched ${patched}/${items.length} items → ${itemsPath}`);
