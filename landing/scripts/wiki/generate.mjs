/**
 * Regenerates landing/wiki from the server config allowlist.
 * Run from landing/: npm run build
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadCatalog } from './project.mjs';
import {
  KINDS,
  renderDetail,
  renderError,
  renderHome,
  renderIndex,
  renderPlanner,
  renderSitemap,
} from './render.mjs';
import { indexById } from './project.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const outDir = path.join(repoRoot, 'landing', 'wiki');

function browserMath() {
  const source = fs.readFileSync(path.join(here, 'planner.mjs'), 'utf8');
  const stripped = source
    .replace(/^\/\*\*[\s\S]*?\*\/\s*/m, '')
    .replace(/^export /gm, '');
  return `${stripped}\nwindow.WikiPlanner = { BASE_STAT, MAX_STAT, STAT_KEYS, pointBudget, luPoints, maxHp, maxMp, maxSp, evaluate };\n`;
}

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function resetGeneratedDirs() {
  for (const kind of KINDS) {
    fs.rmSync(path.join(outDir, kind.slug), { recursive: true, force: true });
  }
  fs.rmSync(path.join(outDir, 'planner'), { recursive: true, force: true });
}

const catalog = loadCatalog(repoRoot);
const indexes = {
  items: indexById(catalog.items),
  monsters: indexById(catalog.monsters),
  spells: indexById(catalog.spells),
  maps: indexById(catalog.maps),
  npcs: indexById(catalog.npcs),
};

resetGeneratedDirs();
write(path.join(outDir, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
write(path.join(outDir, 'planner-config.json'), `${JSON.stringify(catalog.progression, null, 2)}\n`);
write(path.join(outDir, 'planner-math.js'), browserMath());
write(path.join(outDir, 'index.html'), renderHome(catalog));
write(path.join(outDir, 'error.html'), renderError());
write(path.join(outDir, 'sitemap.xml'), renderSitemap(catalog));
write(path.join(outDir, 'planner', 'index.html'), renderPlanner(catalog.progression));

for (const kind of KINDS) {
  const rows = catalog[kind.key];
  write(path.join(outDir, kind.slug, 'index.html'), renderIndex(kind, rows));
  for (const row of rows) {
    write(path.join(outDir, kind.slug, `${row.id}.html`), renderDetail(kind.slug, row, indexes));
  }
}

console.log(`[wiki] wrote ${catalog.items.length} items, ${catalog.monsters.length} monsters, ${catalog.maps.length} maps, ${catalog.spells.length} spells`);
