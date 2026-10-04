const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

const landingDir = path.join(__dirname, '..');
const repoRoot = path.join(landingDir, '..');
const wikiDir = path.join(landingDir, 'wiki');

const SOURCE_FILES = [
  'multiplayer/server/Config/Items.json',
  'multiplayer/server/Config/Monsters.json',
  'multiplayer/server/Config/Spells.json',
  'multiplayer/server/Config/GameWorlds.json',
  'multiplayer/server/Config/NPCs.json',
  'multiplayer/server/Config/Progression.json',
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, rel), 'utf8'));
}

function stripInternal(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => stripInternal(entry));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith('_')) continue;
      out[key] = stripInternal(child);
    }
    return out;
  }
  return value;
}

function assertNoInternalKeys(value, where) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoInternalKeys(entry, `${where}.${index}`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      assert.equal(key.startsWith('_'), false, `${where}.${key}`);
      assertNoInternalKeys(child, `${where}.${key}`);
    }
  }
}

function primitiveText(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return JSON.stringify(value);
  }
  return null;
}

function walkPrimitives(value, pathName, out) {
  if (Array.isArray(value)) {
    if (value.length === 0) out.push({ path: pathName, empty: true });
    value.forEach((entry, index) => walkPrimitives(entry, `${pathName}.${index}`, out));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      walkPrimitives(child, pathName ? `${pathName}.${key}` : key, out);
    }
    return;
  }
  out.push({ path: pathName, text: primitiveText(value) });
}

function getPath(record, pathName) {
  let current = record;
  for (const part of pathName.split('.')) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function unescapeHtml(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

function extractRecord(html) {
  const match = html.match(/<script type="application\/json" id="wiki-record">([\s\S]*?)<\/script>/);
  assert.ok(match, 'missing wiki-record');
  return JSON.parse(match[1]);
}

function fieldsIn(html) {
  const found = [];
  const re = /<span data-field="([^"]+)"( data-empty="1")?>([^<]*)<\/span>/g;
  let match;
  while ((match = re.exec(html))) {
    found.push({
      path: match[1],
      empty: Boolean(match[2]),
      text: unescapeHtml(match[3]),
    });
  }
  return found;
}

function assertFieldsMatchRecord(html, record) {
  const expected = [];
  walkPrimitives(record, '', expected);
  const found = fieldsIn(html);
  const byPath = new Map();
  for (const field of found) {
    if (!byPath.has(field.path)) byPath.set(field.path, []);
    byPath.get(field.path).push(field);
  }
  for (const item of expected) {
    const hits = byPath.get(item.path);
    assert.ok(hits && hits.length > 0, `missing visible field ${item.path}`);
    for (const hit of hits) {
      if (item.empty) {
        assert.equal(hit.empty, true, item.path);
        assert.equal(hit.text, '0', item.path);
        assert.deepEqual(getPath(record, item.path), []);
      } else {
        assert.equal(hit.empty, false, item.path);
        assert.equal(hit.text, item.text, item.path);
      }
    }
  }
  for (const field of found) {
    const expectedItem = expected.find((item) => item.path === field.path);
    assert.ok(expectedItem, `unexpected field ${field.path}`);
  }
}

function indexById(rows) {
  return new Map(rows.map((row) => [String(row.id), row]));
}

const RESOLVE_TO_SECTION = {
  item: 'items',
  spell: 'spells',
  monster: 'monsters',
  npc: 'npcs',
  map: 'maps',
};

describe('wiki catalog matches server config', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(wikiDir, 'catalog.json'), 'utf8'));

  it('lists only the allowlisted config files', () => {
    assert.deepEqual(catalog.sources, SOURCE_FILES);
  });

  it('copies items, monsters, spells, maps, and npcs with internal notes removed', () => {
    const expected = {
      items: stripInternal(readJson(SOURCE_FILES[0])),
      monsters: stripInternal(readJson(SOURCE_FILES[1])),
      spells: stripInternal(readJson(SOURCE_FILES[2])),
      maps: stripInternal(readJson(SOURCE_FILES[3])),
      npcs: stripInternal(readJson(SOURCE_FILES[4])),
    };
    assert.deepEqual(catalog.items, expected.items);
    assert.deepEqual(catalog.monsters, expected.monsters);
    assert.deepEqual(catalog.spells, expected.spells);
    assert.deepEqual(catalog.maps, expected.maps);
    assert.deepEqual(catalog.npcs, expected.npcs);
    for (const section of Object.values(expected)) {
      assertNoInternalKeys(section, 'section');
    }
  });

  it('copies only the planner tunables from Progression.json', () => {
    const progression = readJson(SOURCE_FILES[5]);
    assert.deepEqual(catalog.progression, {
      maxLevel: progression.maxLevel,
      maxRebirth: progression.maxRebirth,
      rebirthLuPoints: progression.rebirthLuPoints,
    });
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(wikiDir, 'planner-config.json'), 'utf8')),
      catalog.progression,
    );
  });

  it('shows every config value on the detail page for that row', () => {
    const sections = [
      ['items', catalog.items],
      ['monsters', catalog.monsters],
      ['spells', catalog.spells],
      ['maps', catalog.maps],
    ];
    for (const [dir, rows] of sections) {
      const files = fs.readdirSync(path.join(wikiDir, dir)).filter((name) => name.endsWith('.html') && name !== 'index.html');
      assert.equal(files.length, rows.length, dir);
      const indexes = {
        items: indexById(catalog.items),
        monsters: indexById(catalog.monsters),
        spells: indexById(catalog.spells),
        maps: indexById(catalog.maps),
        npcs: indexById(catalog.npcs),
      };
      for (const row of rows) {
        const html = fs.readFileSync(path.join(wikiDir, dir, `${row.id}.html`), 'utf8');
        const embedded = extractRecord(html);
        assert.deepEqual(embedded, row, `${dir}/${row.id}`);
        assertFieldsMatchRecord(html, row);
        const resolves = [...html.matchAll(/<span class="resolve" data-resolve="([^"]+)" data-resolve-id="([^"]+)">([^<]*)<\/span>/g)];
        for (const match of resolves) {
          const section = RESOLVE_TO_SECTION[match[1]];
          const linked = indexes[section].get(match[2]);
          assert.ok(linked, `${match[1]} ${match[2]}`);
          assert.equal(unescapeHtml(match[3]), linked.name);
        }
      }
    }
  });

  it('lists every row on the index pages', () => {
    const home = fs.readFileSync(path.join(wikiDir, 'index.html'), 'utf8');
    for (const [key, dir] of [['monsters', 'monsters'], ['items', 'items'], ['maps', 'maps'], ['spells', 'spells']]) {
      const rows = catalog[key];
      assert.match(home, new RegExp(`data-count="${rows.length}" data-kind="${key}"`));
      const html = fs.readFileSync(path.join(wikiDir, dir, 'index.html'), 'utf8');
      assert.match(html, new RegExp(`data-count="${rows.length}"`));
      const ids = [...html.matchAll(/data-row data-id="([^"]+)"/g)].map((match) => match[1]);
      assert.deepEqual(ids, rows.map((row) => String(row.id)));
      for (const row of rows) {
        const block = html.slice(html.indexOf(`data-id="${row.id}"`), html.indexOf('</li>', html.indexOf(`data-id="${row.id}"`)));
        for (const field of fieldsIn(block)) {
          assert.equal(field.text, primitiveText(row[field.path]), `${dir} ${row.id} ${field.path}`);
        }
      }
      const chips = [...html.matchAll(/data-q="([^"]+)">[^<]* <span>(\d+)<\/span>/g)];
      for (const chip of chips) {
        const count = rows.filter((row) => row.itemType === chip[1] || row.sprite === chip[1] || row.map === chip[1] || String(row.damageType) === chip[1]).length;
        assert.equal(Number(chip[2]), count, `${dir} chip ${chip[1]}`);
      }
    }
    for (const source of SOURCE_FILES) {
      assert.ok(home.includes(source), source);
    }
  });

  it('does not publish wallet, login, or third-party pages', () => {
    const banned = ['Play Now', 'Phantom', 'wallet', '$HELL', '$helbreath', 'helbreath.net', 'Item.cfg'];
    const files = [];
    function walk(dir) {
      for (const name of fs.readdirSync(dir)) {
        const abs = path.join(dir, name);
        if (fs.statSync(abs).isDirectory()) walk(abs);
        else if (name.endsWith('.html')) files.push(abs);
      }
    }
    walk(wikiDir);
    for (const file of files) {
      const html = fs.readFileSync(file, 'utf8');
      for (const word of banned) {
        assert.equal(html.includes(word), false, `${file} contains ${word}`);
      }
    }
    const generatorDir = path.join(landingDir, 'scripts', 'wiki');
    const forbiddenReads = ['Item.cfg', 'Magic.cfg', 'Npc.cfg', 'olympia-ingest', 'helbreath.net'];
    for (const name of fs.readdirSync(generatorDir)) {
      const text = fs.readFileSync(path.join(generatorDir, name), 'utf8');
      for (const word of forbiddenReads) {
        assert.equal(text.includes(word), false, `${name} mentions ${word}`);
      }
    }
  });
});

describe('stat planner formulas match the server', () => {
  let planner;

  before(async () => {
    planner = await import(pathToFileURL(path.join(landingDir, 'scripts', 'wiki', 'planner.mjs')).href);
  });

  it('uses the Progression.cs expressions and the base stat of 10', () => {
    const progression = fs.readFileSync(path.join(repoRoot, 'multiplayer/server/Helpers/Progression.cs'), 'utf8');
    assert.match(progression, /return Math\.Max\(0, player\.Level \* 3 - \(sumStats - 70\) - 3 \+ rebirthLu\);/);
    assert.match(progression, /vit \* 3 \+ level \* 2 \+ strIncludingAngelic \/ 2/);
    assert.match(progression, /2 \* magIncludingAngelic \+ 2 \* level \+ intIncludingAngelic \/ 2/);
    assert.match(progression, /2 \* strIncludingAngelic \+ 2 \* level/);
    assert.match(progression, /public const int MaxStat = 200;/);
    const player = fs.readFileSync(path.join(repoRoot, 'multiplayer/server/World/Game/GameWorldPlayer.cs'), 'utf8');
    for (const stat of ['str', 'vit', 'dex', 'intel', 'mag', 'chr']) {
      assert.match(player, new RegExp(`private int ${stat} = 10;`));
    }
    const math = fs.readFileSync(path.join(wikiDir, 'planner-math.js'), 'utf8');
    assert.match(math, /level \* 3 - \(sum - 70\) - 3 \+ rebirthLu/);
    assert.match(math, /vit \* 3 \+ level \* 2 \+ Math\.floor\(str \/ 2\)/);
    assert.match(math, /2 \* mag \+ 2 \* level \+ Math\.floor\(intel \/ 2\)/);
    assert.match(math, /2 \* str \+ 2 \* level/);
    assert.match(math, /const BASE_STAT = 10;/);
    assert.match(math, /const MAX_STAT = 200;/);
  });

  it('matches a fresh level-1 build and rejects an overspend', () => {
    const config = JSON.parse(fs.readFileSync(path.join(wikiDir, 'planner-config.json'), 'utf8'));
    const start = { level: 1, rebirth: 0, str: 10, vit: 10, dex: 10, int: 10, mag: 10, chr: 10 };
    const outcome = planner.evaluate(config, start);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.points, 10);
    assert.equal(outcome.hp, 37);
    assert.equal(outcome.mp, 27);
    assert.equal(outcome.sp, 22);
    const page = fs.readFileSync(path.join(wikiDir, 'planner', 'index.html'), 'utf8');
    assert.match(page, new RegExp(`id="out-points">${outcome.points}`));
    assert.match(page, new RegExp(`id="out-hp">${outcome.hp}`));
    assert.match(page, new RegExp(`id="out-mp">${outcome.mp}`));
    assert.match(page, new RegExp(`id="out-sp">${outcome.sp}`));
    const embedded = JSON.parse(page.match(/<script type="application\/json" id="planner-config">([\s\S]*?)<\/script>/)[1]);
    assert.deepEqual(embedded, config);
    const overspent = { ...start, str: 30 };
    assert.equal(planner.evaluate(config, overspent).error, 'Not enough level-up points.');
    assert.equal(planner.evaluate(config, { ...start, str: 201 }).error, 'Stat cannot exceed 200.');
    assert.equal(planner.evaluate(config, { ...start, level: config.maxLevel + 1 }).ok, false);
  });
});

describe('wiki miss stays on the catalog error page', () => {
  const { missPolicy } = require('../server.js');
  let child;
  const port = 8765;

  before(async () => {
    assert.equal(missPolicy('/wiki/items/missing.html'), 'wiki-404');
    assert.equal(missPolicy('/market.html'), 'marketing-fallback');
    child = spawn(process.execPath, ['server.js'], {
      cwd: landingDir,
      env: { ...process.env, PORT: String(port) },
      stdio: 'ignore',
    });
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/wiki/index.html`);
        if (response.status === 200) return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    throw new Error('landing server did not start');
  });

  after(() => {
    if (child) child.kill();
  });

  it('returns the catalog error page instead of the marketing site', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/wiki/items/not-a-real-page.html`);
    const body = await response.text();
    assert.equal(response.status, 404);
    assert.match(body, /Page not in the catalog/);
    assert.equal(body.includes('Play Now'), false);
    assert.equal(body.includes('wallet'), false);
  });
});
