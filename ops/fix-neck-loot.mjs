/**
 * Remove absurd necklace/pendant loot rates caused by bad item-id remapping
 * (gold-tier chances 0.21 / 0.9 attached to necklaces).
 *
 * Policy: necklaces should only appear as rare valuable drops.
 * - chance > 0.01 on necklace/pendant → delete row (or cap to 0.001 if item is intentional rare)
 * - Keep tiny rates (≤0.01) that look intentional.
 *
 * Also strip necklace rows that clearly inherited gold/potion rate bands:
 *   0.21, 0.03276, 0.01575, 0.0105, 0.9, 0.2
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const monPath = path.join(root, 'multiplayer', 'server', 'Config', 'Monsters.json');
const itemsPath = path.join(root, 'multiplayer', 'server', 'Config', 'Items.json');

const BAD_CHANCE_BANDS = new Set([
  0.9, 0.21, 0.2, 0.03276, 0.01575, 0.0105, 0.05,
]);

const items = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
const byId = Object.fromEntries(items.map((i) => [i.id, i]));

function isNeck(itemId) {
  const it = byId[itemId];
  if (!it) return false;
  const t = (it.itemType || '').toLowerCase();
  const n = (it.name || '').toLowerCase();
  return t === 'necklace' || n.includes('necklace') || n.includes('neck') || n.includes('pendant') || n.includes('pandent');
}

function nearBand(c) {
  for (const b of BAD_CHANCE_BANDS) {
    if (Math.abs(c - b) < 1e-9) return true;
  }
  // gold-like 0.21±eps
  if (c >= 0.2 && c <= 0.22) return true;
  if (c >= 0.85) return true; // ettin 0.9 garbage
  return false;
}

const mon = JSON.parse(fs.readFileSync(monPath, 'utf8'));
let removed = 0;
const samples = [];
for (const m of mon) {
  if (!Array.isArray(m.loot)) continue;
  const before = m.loot.length;
  m.loot = m.loot.filter((l) => {
    if (!isNeck(l.itemId)) return true;
    const c = Number(l.chance) || 0;
    if (c > 0.01 || nearBand(c)) {
      removed++;
      if (samples.length < 20) {
        samples.push(`${m.name} id=${l.itemId} ${byId[l.itemId]?.name} chance=${c}`);
      }
      return false;
    }
    return true;
  });
  if (m.loot.length !== before && m.name === 'Ettin') {
    console.log('Ettin loot count', before, '->', m.loot.length);
  }
}

fs.writeFileSync(monPath, `${JSON.stringify(mon, null, 2)}\n`);
console.log('removed neck rows', removed);
console.log(samples.join('\n'));
