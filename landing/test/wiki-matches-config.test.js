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

const HIDDEN_KEYS = new Set([
  'aimAssist', 'chaseDistance', 'chaseMaxDistance', 'clearTemporaryEffects', 'corpseDecayTime',
  'direction', 'effect', 'endShards', 'loc', 'locs', 'maxIdleTime', 'minIdleTime', 'music',
  'olympiaEffectType', 'pactArena', 'sprite', 'startShards', 'tickRate', 'workerThread',
  'x', 'x1', 'x2', 'y', 'y1', 'y2',
]);

const COMBINED = [
  { keys: ['damageDiceCount', 'damageDiceSides'], field: 'damageDice', format: (count, sides) => `${count}d${sides}` },
  { keys: ['healDiceCount', 'healDiceSides'], field: 'healDice', format: (count, sides) => `${count}d${sides}` },
  { keys: ['attackDamageMin', 'attackDamageMax'], field: 'attackDamage', format: (min, max) => `${min}–${max}` },
];

function formatChance(value) {
  return `${(Math.round(value * 10000) / 100).toFixed(2)}%`;
}

function formatDurationMs(value) {
  assert.equal(Number.isInteger(value) && value >= 0, true, value);
  return `${(value / 1000).toFixed(1)} s`;
}

const ZERO_MAGIC_KEYS = new Set(['magicLevel', 'maxMana', 'magicHitRatio']);

function magicTrioIsZero(record) {
  const magic = Object.prototype.hasOwnProperty.call(record, 'magicLevel') ? record.magicLevel : 0;
  const mana = Object.prototype.hasOwnProperty.call(record, 'maxMana') ? record.maxMana : 0;
  const hit = Object.prototype.hasOwnProperty.call(record, 'magicHitRatio') ? record.magicHitRatio : 0;
  return magic === 0 && mana === 0 && hit === 0;
}

function omitItem1309(value) {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => !(entry && typeof entry === 'object' && !Array.isArray(entry) && entry.itemId === 1309))
      .map((entry) => omitItem1309(entry));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) out[key] = omitItem1309(child);
    return out;
  }
  return value;
}

function joinPath(parent, key) {
  return parent ? `${parent}.${key}` : key;
}

function pairList(object) {
  const skip = new Set();
  const pairs = [];
  for (const key of Object.keys(object)) {
    if (skip.has(key) || HIDDEN_KEYS.has(key)) continue;
    const spec = COMBINED.find((entry) => entry.keys.includes(key) && entry.keys.every((name) => Object.prototype.hasOwnProperty.call(object, name)));
    if (spec) {
      spec.keys.forEach((name) => skip.add(name));
      const nums = spec.keys.map((name) => object[name]);
      assert.ok(nums.every((num) => Number.isInteger(num)), spec.keys.join('+'));
      pairs.push({ key: spec.field, synthetic: true, text: spec.format(nums[0], nums[1]) });
      continue;
    }
    pairs.push({ key, value: object[key], synthetic: false });
  }
  return pairs;
}

function emitPair(pair, pathName, indexes, out) {
  const childPath = joinPath(pathName, pair.key);
  if (pair.synthetic) {
    out.push({ path: childPath, text: pair.text });
    return;
  }
  if (pair.key === 'target' && pair.value && typeof pair.value === 'object' && !Array.isArray(pair.value)) {
    const keys = Object.keys(pair.value);
    if (keys.includes('worldId') && keys.every((name) => name === 'worldId' || HIDDEN_KEYS.has(name))) {
      const map = indexes.maps.get(String(pair.value.worldId));
      assert.ok(map, pair.value.worldId);
      out.push({ path: `${childPath}.leadsTo`, text: map.name });
      return;
    }
  }
  visibleFields(pair.value, childPath, indexes, out, false);
}

function visibleFields(value, pathName, indexes, out, top, options = {}) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.push({ path: pathName, empty: true, text: '0' });
      return;
    }
    value.forEach((entry, index) => visibleFields(entry, `${pathName}.${index}`, indexes, out, false));
    return;
  }
  if (value && typeof value === 'object') {
    const pairs = pairList(value);
    const dropMagic = top && options.kind === 'monsters' && magicTrioIsZero(value);
    const skipKey = (key) => key === 'name' || key === 'id' || (dropMagic && ZERO_MAGIC_KEYS.has(key)) || (top && options.kind === 'monsters' && key === 'id');
    if (top) {
      for (const key of ['name', 'id']) {
        if (options.kind === 'monsters' && key === 'id') continue;
        const pair = pairs.find((entry) => entry.key === key);
        if (pair) emitPair(pair, pathName, indexes, out);
      }
      for (const pair of pairs) {
        if (skipKey(pair.key)) continue;
        if (pair.synthetic || !pair.value || typeof pair.value !== 'object') emitPair(pair, pathName, indexes, out);
      }
      for (const pair of pairs) {
        if (pair.synthetic || !pair.value || typeof pair.value !== 'object') continue;
        if (skipKey(pair.key)) continue;
        emitPair(pair, pathName, indexes, out);
      }
      return;
    }
    pairs.forEach((pair) => emitPair(pair, pathName, indexes, out));
    return;
  }
  const leaf = pathName.split('.').pop();
  if (leaf === 'itemId' && /(?:^|\.)loot\.\d+\.itemId$/.test(pathName)) {
    const item = indexes.items.get(String(value));
    assert.ok(item, value);
    out.push({ path: pathName, text: item.name });
    return;
  }
  let text = primitiveText(value);
  if (leaf === 'chance' && typeof value === 'number') {
    text = formatChance(value);
  } else if ((leaf === 'movementSpeed' || leaf === 'respawnTime') && typeof value === 'number') {
    text = formatDurationMs(value);
  }
  out.push({ path: pathName, text });
}

function fieldsIn(html) {
  const found = [];
  const re = /<span\b([^>]*)>([^<]*)<\/span>/g;
  let match;
  while ((match = re.exec(html))) {
    const field = match[1].match(/data-field="([^"]+)"/);
    if (!field) continue;
    found.push({
      path: field[1],
      empty: /data-empty="1"/.test(match[1]),
      text: unescapeHtml(match[2]),
    });
  }
  return found;
}

function assertFieldsMatchRecord(html, record, indexes, kind) {
  const expected = [];
  visibleFields(record, '', indexes, expected, true, { kind });
  const found = fieldsIn(html);
  assert.equal(found.length, expected.length, `${record.id} field count`);
  for (let index = 0; index < expected.length; index += 1) {
    const item = expected[index];
    const hit = found[index];
    assert.equal(hit.path, item.path, `${record.id} ${item.path}`);
    assert.equal(hit.empty, Boolean(item.empty), `${record.id} ${item.path}`);
    assert.equal(hit.text, item.text, `${record.id} ${item.path}`);
  }
}

function htmlFiles() {
  const files = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      if (fs.statSync(abs).isDirectory()) walk(abs);
      else if (name.endsWith('.html')) files.push(abs);
    }
  }
  walk(wikiDir);
  return files;
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
      items: stripInternal(readJson(SOURCE_FILES[0])).filter((row) => row.id !== 1309),
      monsters: omitItem1309(stripInternal(readJson(SOURCE_FILES[1]))),
      spells: omitItem1309(stripInternal(readJson(SOURCE_FILES[2]))),
      maps: omitItem1309(stripInternal(readJson(SOURCE_FILES[3]))),
      npcs: omitItem1309(stripInternal(readJson(SOURCE_FILES[4]))),
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
        assertFieldsMatchRecord(html, row, indexes, dir);
        const visible = html.replace(/<script[\s\S]*?<\/script>/g, '');
        if (dir === 'monsters') {
          assert.equal(visible.includes('<p class="lede">'), false, `${row.id} id`);
          assert.equal(/data-field="loot\.\d+\.itemId">\d+</.test(visible), false, `${row.id} loot id`);
        }
        const lootLinks = [...visible.matchAll(/<a class="resolve" href="([^"]+)" data-resolve="item" data-resolve-id="([^"]+)"><span data-field="loot\.\d+\.itemId">([^<]*)<\/span><\/a>/g)];
        for (const match of lootLinks) {
          const item = indexes.items.get(match[2]);
          assert.ok(item, match[2]);
          assert.equal(match[1], `/wiki/items/${match[2]}.html`);
          assert.equal(unescapeHtml(match[3]), item.name);
        }
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
    assert.equal(home.includes('Config files'), false);
    assert.equal(home.includes('multiplayer/server/Config/'), false);
  });

  it('uses the fixed title, description, and buttons', () => {
    const title = 'ChainLords Wiki: Helbreath monsters, items, maps &amp; character planner';
    const description = 'Every monster, item and map in ChainLords, plus a free character planner. Plan your build, then play Helbreath in your browser.';
    const play = '<a class="play-btn" href="https://play.chainlords.net">Play Helbreath in your browser</a>';
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
      assert.ok(html.includes(`<title>${title}</title>`), file);
      assert.ok(html.includes(`<meta name="description" content="${description}">`), file);
      assert.equal(/No download/i.test(html), false, file);
      assert.equal(/Play free/i.test(html), false, file);
      assert.ok(html.includes('Plan your build'), file);
      const isEntry = /\/(items|monsters|maps|spells)\/(?!index\.html$)[^/]+\.html$/.test(file);
      assert.equal(html.includes(play), isEntry, file);
    }
  });

  it('keeps entry labels inside the simple list', async () => {
    const { LABELS } = await import(pathToFileURL(path.join(landingDir, 'scripts', 'wiki', 'render.mjs')).href);
    const allowed = new Set(Object.values(LABELS));
    const used = new Set();
    for (const dir of ['items', 'monsters', 'maps', 'spells']) {
      const folder = path.join(wikiDir, dir);
      for (const name of fs.readdirSync(folder)) {
        if (!name.endsWith('.html') || name === 'index.html') continue;
        const html = fs.readFileSync(path.join(folder, name), 'utf8');
        for (const match of html.matchAll(/<dt>([^<]+)<\/dt>|<h2>([^<]+)<\/h2>/g)) {
          used.add(match[1] || match[2]);
        }
      }
    }
    for (const label of used) {
      assert.equal(allowed.has(label), true, label);
    }
    assert.ok(used.has('HP'));
    assert.ok(used.has('Loot'));
    assert.ok(used.has('Leads to'));
    assert.ok(used.has('Heal'));
    assert.ok(used.has('Damage'));
    const hiddenLabels = [
      'Sprite', 'Corpse', 'Facing', 'Idle min', 'Idle max', 'Chase', 'Chase max', 'Cells',
      'Worker', 'Music', 'Clear', 'Aim', 'Tick', 'Start shards', 'End shards',
      'X', 'Y', 'X1', 'X2', 'Y1', 'Y2', 'At', 'To', 'Effect', 'Pact',
      'Dice', 'Sides', 'Heal dice', 'Heal sides', 'Min damage', 'Max damage',
    ];
    for (const label of hiddenLabels) {
      assert.equal(used.has(label), false, label);
    }
    assert.equal([...used].some((label) => /olympia|catalog|download|token|nft|\$/i.test(label)), false);
  });

  it('omits item 1309 and the word NFT from generated pages', () => {
    assert.equal(catalog.items.some((row) => row.id === 1309), false);
    assert.equal(fs.existsSync(path.join(wikiDir, 'items', '1309.html')), false);
    const index = fs.readFileSync(path.join(wikiDir, 'items', 'index.html'), 'utf8');
    assert.equal(index.includes('data-id="1309"'), false);
    assert.equal(index.includes('Item into NFT Ticket'), false);
    const rawItems = stripInternal(readJson(SOURCE_FILES[0]));
    assert.equal(rawItems.some((row) => row.id === 1309 && row.name === 'Item into NFT Ticket'), true);
    function walk(value) {
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (value && typeof value === 'object') {
        assert.notEqual(value.itemId, 1309);
        Object.values(value).forEach(walk);
      }
    }
    walk(catalog);
    const generated = [];
    function walkFiles(dir) {
      for (const name of fs.readdirSync(dir)) {
        const abs = path.join(dir, name);
        if (fs.statSync(abs).isDirectory()) walkFiles(abs);
        else generated.push(abs);
      }
    }
    walkFiles(wikiDir);
    assert.ok(generated.length > 100);
    for (const file of generated) {
      const text = fs.readFileSync(file, 'utf8');
      assert.equal(text.includes('NFT'), false, file);
    }
    const sitemap = fs.readFileSync(path.join(wikiDir, 'sitemap.xml'), 'utf8');
    assert.equal(sitemap.includes('/items/1309.html'), false);
  });

  it('formats combined rows and loot chance from the config numbers', () => {
    const spell = catalog.spells.find((row) => row.damageDiceCount === 2 && row.damageDiceSides === 6);
    assert.ok(spell);
    const spellHtml = fs.readFileSync(path.join(wikiDir, 'spells', `${spell.id}.html`), 'utf8');
    assert.match(spellHtml, /<dt>Damage<\/dt><dd><span data-field="damageDice">2d6<\/span>/);
    const heal = catalog.spells.find((row) => Number.isInteger(row.healDiceCount) && Number.isInteger(row.healDiceSides));
    assert.ok(heal);
    const healHtml = fs.readFileSync(path.join(wikiDir, 'spells', `${heal.id}.html`), 'utf8');
    assert.match(healHtml, new RegExp(`<dt>Heal</dt><dd><span data-field="healDice">${heal.healDiceCount}d${heal.healDiceSides}</span>`));
    const monster = catalog.monsters.find((row) => Number.isInteger(row.attackDamageMin) && Number.isInteger(row.attackDamageMax));
    assert.ok(monster);
    const monsterHtml = fs.readFileSync(path.join(wikiDir, 'monsters', `${monster.id}.html`), 'utf8');
    assert.match(monsterHtml, new RegExp(`<dt>Damage</dt><dd><span data-field="attackDamage">${monster.attackDamageMin}–${monster.attackDamageMax}</span>`));
    const rare = catalog.monsters.find((row) => (row.loot || []).some((entry) => entry.chance === 0.00336));
    assert.ok(rare);
    const rareHtml = fs.readFileSync(path.join(wikiDir, 'monsters', `${rare.id}.html`), 'utf8');
    const visible = rareHtml.replace(/<script[\s\S]*?<\/script>/g, '');
    assert.match(visible, />0\.34%</);
    assert.equal(visible.includes('0.00336'), false);
    const dagger = fs.readFileSync(path.join(wikiDir, 'items', '1.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
    assert.equal(dagger.includes('>Effect<'), false);
    assert.equal(dagger.includes('olympiaEffectType'), false);
    const demon = catalog.monsters.find((row) => row.id === 18);
    assert.equal(demon.loot[0].chance, 0.21);
    assert.equal(demon.loot[1].chance, 0.03276);
    const demonVisible = fs.readFileSync(path.join(wikiDir, 'monsters', '18.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
    assert.match(demonVisible, /data-field="loot\.0\.chance">21\.00%</);
    assert.match(demonVisible, /data-field="loot\.1\.chance">3\.28%</);
    assert.equal(demonVisible.includes('>Pact<'), false);
    assert.equal(demonVisible.includes('>Sprite<'), false);
    const slime = catalog.monsters.find((row) => row.id === 1 && row.name === 'Slime');
    assert.equal(slime.movementSpeed, 2300);
    assert.equal(slime.respawnTime, 3500);
    assert.equal(slime.magicLevel, 0);
    assert.equal(slime.maxMana, 0);
    assert.equal(slime.magicHitRatio, 0);
    const slimeVisible = fs.readFileSync(path.join(wikiDir, 'monsters', '1.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
    assert.match(slimeVisible, /data-field="movementSpeed">2\.3 s</);
    assert.match(slimeVisible, /data-field="respawnTime">3\.5 s</);
    assert.equal(slimeVisible.includes('>Magic<'), false);
    assert.equal(slimeVisible.includes('>Mana<'), false);
    assert.equal(slimeVisible.includes('>Magic hit<'), false);
    assert.equal(slimeVisible.includes('<p class="lede">'), false);
    const gold = catalog.items.find((row) => row.id === slime.loot[0].itemId);
    assert.equal(gold.name, 'Gold');
    assert.match(slimeVisible, /href="\/wiki\/items\/90\.html" data-resolve="item" data-resolve-id="90"><span data-field="loot\.0\.itemId">Gold<\/span>/);
    const caster = catalog.monsters.find((row) => row.magicLevel > 0 && row.maxMana > 0 && row.magicHitRatio > 0);
    assert.ok(caster);
    const casterVisible = fs.readFileSync(path.join(wikiDir, 'monsters', `${caster.id}.html`), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
    assert.match(casterVisible, new RegExp(`data-field="magicLevel">${caster.magicLevel}<`));
    assert.match(casterVisible, new RegExp(`data-field="maxMana">${caster.maxMana}<`));
    assert.match(casterVisible, new RegExp(`data-field="magicHitRatio">${caster.magicHitRatio}<`));
  });

  it('uses the fixed screen sentences', () => {
    const items = fs.readFileSync(path.join(wikiDir, 'items', 'index.html'), 'utf8');
    assert.match(items, /Checking this list against the server…/);
    assert.match(items, /No match\. Clear the search to see everything\./);
    const statusAt = items.indexOf('id="wiki-status"');
    const listAt = items.indexOf('id="wiki-list"');
    assert.ok(statusAt > 0 && statusAt < listAt);
    const error = fs.readFileSync(path.join(wikiDir, 'error.html'), 'utf8');
    assert.match(error, /That page isn't in the wiki\./);
    assert.match(error, /href="\/wiki\/index.html">Back to the wiki</);
    const client = fs.readFileSync(path.join(wikiDir, 'wiki.js'), 'utf8');
    assert.match(client, /Couldn't confirm this list is current\. It may be out of date\./);
    assert.equal(client.includes('Catalog check failed'), false);
    assert.equal(client.includes('Loading catalog check'), false);
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
    assert.match(body, /That page isn't in the wiki\./);
    assert.match(body, /Back to the wiki/);
    assert.equal(body.includes('Play Now'), false);
    assert.equal(body.includes('wallet'), false);
  });
});
