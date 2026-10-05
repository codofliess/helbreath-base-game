/**
 * Regenerates landing/wiki from the server config allowlist when that
 * config is reachable next to this landing folder. A deploy whose service
 * root is only landing/ keeps the committed wiki.
 * Run from landing/: npm run build
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { indexById, loadCatalog, SOURCE_FILES } from './project.mjs';
import {
  KINDS,
  renderDetail,
  renderError,
  renderHome,
  renderIndex,
  renderPlanner,
  renderSitemap,
} from './render.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const landingDir = path.resolve(here, '../..');
const outDir = path.join(landingDir, 'wiki');
const repoRoot = path.resolve(landingDir, '..');

function configReachable(root) {
  const resolvedRoot = path.resolve(root);
  return SOURCE_FILES.every((rel) => {
    const abs = path.resolve(resolvedRoot, rel);
    if (abs !== resolvedRoot && !abs.startsWith(resolvedRoot + path.sep)) {
      return false;
    }
    return fs.existsSync(abs);
  });
}

if (!configReachable(repoRoot)) {
  const committed = path.join(outDir, 'catalog.json');
  if (!fs.existsSync(committed)) {
    console.error('[wiki] server config is not reachable and there is no committed wiki');
    process.exit(1);
  }
  console.log('[wiki] server config is not reachable; using the committed wiki');
  process.exit(0);
}

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
