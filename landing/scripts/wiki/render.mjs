/**
 * Renders catalog HTML. Visible values come only from projected records.
 */

import { indexById } from './project.mjs';
import { evaluate } from './planner.mjs';

const SITE = 'https://chainlords.net/wiki/';
const PAGE_TITLE = 'ChainLords Wiki: Helbreath monsters, items, maps & character planner';
const PAGE_DESCRIPTION = 'Every monster, item and map in ChainLords, plus a free character planner. Plan your build, then play Helbreath in your browser.';
const PLAN_LABEL = 'Plan your build';
const PLAY_LABEL = 'Play Helbreath in your browser';
const PLAY_URL = 'https://play.chainlords.net';

const CHECKING = 'Checking this list against the server…';
const NO_MATCH = 'No match. Clear the search to see everything.';
const MISSING_PAGE = "That page isn't in the wiki.";
const BACK_LINK = 'Back to the wiki';

/** Config keys that stay off the page. Unknown visible keys still fail the build. */
const HIDDEN_KEYS = new Set([
  'aimAssist',
  'chaseDistance',
  'chaseMaxDistance',
  'clearTemporaryEffects',
  'corpseDecayTime',
  'direction',
  'effect',
  'endShards',
  'loc',
  'locs',
  'maxIdleTime',
  'minIdleTime',
  'music',
  'olympiaEffectType',
  'pactArena',
  'sprite',
  'startShards',
  'tickRate',
  'workerThread',
  'x',
  'x1',
  'x2',
  'y',
  'y1',
  'y2',
]);

const COMBINED = [
  { keys: ['damageDiceCount', 'damageDiceSides'], field: 'damageDice', format: (count, sides) => `${count}d${sides}` },
  { keys: ['healDiceCount', 'healDiceSides'], field: 'healDice', format: (count, sides) => `${count}d${sides}` },
  { keys: ['attackDamageMin', 'attackDamageMax'], field: 'attackDamage', format: (min, max) => `${min}–${max}` },
];

/** Short field labels. Unknown keys fail the build instead of growing a new phrase. */
export const LABELS = {
  allegiance: 'Side',
  aoeRadius: 'Area',
  area: 'Area',
  arenaSize: 'Size',
  armorLifeDecrement: 'Armor',
  attackDamage: 'Damage',
  attackRange: 'Range',
  attackRecoveryTime: 'Recovery',
  attackSpeed: 'Attack',
  attackSpeedModifier: 'Attack',
  attackStunDuration: 'Stun',
  attackType: 'Attack type',
  blockedItemSlots: 'Slots',
  castProbability: 'Chance',
  castSpeedModifier: 'Cast',
  category: 'Category',
  chance: 'Chance',
  consumable: 'Use',
  count: 'Count',
  createFood: 'Food',
  curePoison: 'Cure',
  damageDice: 'Damage',
  damageDiceBonus: 'Bonus',
  damageMultiplier: 'Multiplier',
  damageType: 'Shape',
  defaultWeather: 'Weather',
  duration: 'Time',
  dwellAreas: 'Spawns',
  effectColor: 'Color',
  effects: 'Effects',
  emissionSteps: 'Steps',
  endRadius: 'End',
  gender: 'Gender',
  genLevel: 'Level',
  group: 'Group',
  healBonus: 'Heal bonus',
  healDice: 'Heal',
  hitChanceBonus: 'Hit bonus',
  hitsToAggro: 'Hits',
  hp: 'HP',
  id: 'Id',
  itemId: 'Item',
  itemType: 'Type',
  kind: 'Kind',
  leadsTo: 'Leads to',
  loot: 'Loot',
  magicHitRatio: 'Magic hit',
  magicLevel: 'Magic',
  map: 'Map',
  maxHitsPerTarget: 'Hits',
  maxLifeSpan: 'Life',
  maxMana: 'Mana',
  maxPlayerLevel: 'Max level',
  maxQuantity: 'Max',
  minQuantity: 'Min',
  miningNodes: 'Mining',
  monsterId: 'Monster',
  movementSpeed: 'Move',
  movementSpeedModifier: 'Move',
  name: 'Name',
  note: 'Note',
  npcId: 'NPC',
  npcs: 'NPCs',
  pickupGroundItem: 'Pickup',
  poisonLevel: 'Poison',
  projectileDistance: 'Distance',
  projectileSpeed: 'Speed',
  rangedAttack: 'Ranged',
  recall: 'Recall',
  requiredInt: 'Int',
  respawnTime: 'Respawn',
  spellId: 'Spell',
  spells: 'Spells',
  stackable: 'Stack',
  startRadius: 'Start',
  summonCreature: 'Summon',
  teleportLocs: 'Teleports',
  temporaryEffects: 'Effects',
  tournamentArena: 'Tournament',
  trainingArena: 'Training',
  type: 'Type',
  value: 'Value',
  weaponType: 'Weapon',
  worldId: 'World',
};

const KINDS = [
  { key: 'monsters', slug: 'monsters', title: 'Monsters' },
  { key: 'items', slug: 'items', title: 'Items', extra: 'itemType' },
  { key: 'maps', slug: 'maps', title: 'Maps', extra: 'map' },
  { key: 'spells', slug: 'spells', title: 'Spells', extra: 'damageType' },
];

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function primitiveText(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return JSON.stringify(value);
  }
  return null;
}

function label(key) {
  if (!Object.prototype.hasOwnProperty.call(LABELS, key)) {
    throw new Error(`No simple label for field ${key}`);
  }
  return LABELS[key];
}

function playButton() {
  return `    <p class="end-actions"><a class="play-btn" href="${PLAY_URL}">${PLAY_LABEL}</a></p>`;
}

function field(path, value) {
  const text = primitiveText(value);
  if (text === null) {
    return '';
  }
  const empty = Array.isArray(value) && value.length === 0 ? ' data-empty="1"' : '';
  return `<span data-field="${esc(path)}"${empty}>${esc(text)}</span>`;
}

function resolveSpan(kind, id, name) {
  if (name === undefined) {
    return '';
  }
  return `<span class="resolve" data-resolve="${esc(kind)}" data-resolve-id="${esc(id)}">${esc(name)}</span>`;
}

function lookupName(index, id) {
  const row = index.get(String(id));
  return row ? row.name : undefined;
}

export function shell({ canonical, current, body, scripts }) {
  const nav = [
    ['monsters/index.html', 'Monsters', 'monsters', ''],
    ['items/index.html', 'Items', 'items', ''],
    ['maps/index.html', 'Maps', 'maps', ''],
    ['spells/index.html', 'Spells', 'spells', ''],
    ['planner/index.html', PLAN_LABEL, 'planner', ' class="plan-btn"'],
  ].map(([href, text, key, klass]) => {
    const currentAttr = key === current ? ' aria-current="page"' : '';
    return `<a href="/wiki/${href}"${klass}${currentAttr}>${text}</a>`;
  }).join('');
  const scriptTags = (scripts || []).map((src) => `<script src="/wiki/${src}"></script>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(PAGE_TITLE)}</title>
  <meta name="description" content="${esc(PAGE_DESCRIPTION)}">
  <link rel="canonical" href="${esc(canonical)}">
  <meta name="robots" content="index,follow">
  <link rel="stylesheet" href="/wiki/wiki.css">
</head>
<body>
  <a class="skip" href="#content">Skip to content</a>
  <header class="top">
    <a class="brand" href="/wiki/index.html">ChainLords Wiki</a>
    <nav class="nav" aria-label="ChainLords Wiki">${nav}</nav>
  </header>
  <main id="content" class="wrap">
${body}
  </main>
  <footer></footer>
  ${scriptTags}
</body>
</html>
`;
}

function walkPrimitives(value, path, out) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.push({ path, value });
    }
    value.forEach((entry, index) => walkPrimitives(entry, `${path}.${index}`, out));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      walkPrimitives(child, path ? `${path}.${key}` : key, out);
    }
    return;
  }
  out.push({ path, value });
}

const DAMAGE_SHAPES = new Map([
  [0, 'Area'],
  [1, 'Cone'],
  [2, 'Line'],
  [3, 'Direct'],
  [4, 'Ground'],
]);

function formatDamageType(value) {
  if (!DAMAGE_SHAPES.has(value)) {
    throw new Error(`Unknown spell damage type ${value}.`);
  }
  return DAMAGE_SHAPES.get(value);
}

function formatChance(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Loot chance is not a finite number.');
  }
  return `${(Math.round(value * 10000) / 100).toFixed(2)}%`;
}

function formatDurationMs(value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('Move and respawn times must be a non-negative whole number of milliseconds.');
  }
  return `${(value / 1000).toFixed(1)} s`;
}

function isLootItemPath(path) {
  return /(?:^|\.)loot\.\d+\.itemId$/.test(path);
}

const ZERO_MAGIC_KEYS = new Set(['magicLevel', 'maxMana', 'magicHitRatio']);

function magicTrioIsZero(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return false;
  }
  const magic = Object.prototype.hasOwnProperty.call(record, 'magicLevel') ? record.magicLevel : 0;
  const mana = Object.prototype.hasOwnProperty.call(record, 'maxMana') ? record.maxMana : 0;
  const hit = Object.prototype.hasOwnProperty.call(record, 'magicHitRatio') ? record.magicHitRatio : 0;
  return magic === 0 && mana === 0 && hit === 0;
}

function combinedRow(object, key) {
  const spec = COMBINED.find((entry) => entry.keys.includes(key) && entry.keys.every((name) => Object.prototype.hasOwnProperty.call(object, name)));
  if (!spec) {
    return null;
  }
  const nums = spec.keys.map((name) => object[name]);
  if (!nums.every((num) => Number.isInteger(num))) {
    throw new Error(`Expected integers for ${spec.keys.join(' + ')}.`);
  }
  return { field: spec.field, text: spec.format(nums[0], nums[1]), keys: spec.keys };
}

function isTeleportTarget(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  return keys.includes('worldId') && keys.every((key) => key === 'worldId' || HIDDEN_KEYS.has(key));
}

function visiblePairs(object) {
  const skip = new Set();
  const pairs = [];
  for (const key of Object.keys(object)) {
    if (skip.has(key) || HIDDEN_KEYS.has(key)) {
      continue;
    }
    const combined = combinedRow(object, key);
    if (combined) {
      combined.keys.forEach((name) => skip.add(name));
      pairs.push({ key: combined.field, synthetic: true, text: combined.text });
      continue;
    }
    pairs.push({ key, value: object[key], synthetic: false });
  }
  return pairs;
}

function renderPrimitives(value, path, indexes) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return field(path, value.length === 0 ? 0 : value);
    }
    return '';
  }
  const leaf = path.split('.').pop();
  if (leaf === 'itemId' && isLootItemPath(path)) {
    const name = lookupName(indexes.items, value);
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error(`Loot item ${value} has no name.`);
    }
    return `<a class="resolve" href="/wiki/items/${esc(value)}.html" data-resolve="item" data-resolve-id="${esc(value)}">${field(path, name)}</a>`;
  }
  let shown = value;
  if (leaf === 'chance' && typeof value === 'number') {
    shown = formatChance(value);
  } else if (leaf === 'damageType' && typeof value === 'number') {
    shown = formatDamageType(value);
  } else if ((leaf === 'movementSpeed' || leaf === 'respawnTime') && typeof value === 'number') {
    shown = formatDurationMs(value);
  }
  const text = primitiveText(shown);
  if (text === null) {
    return '';
  }
  let extra = '';
  if (leaf === 'itemId') {
    extra = resolveSpan('item', value, lookupName(indexes.items, value));
  } else if (leaf === 'spellId') {
    extra = resolveSpan('spell', value, lookupName(indexes.spells, value));
  } else if (leaf === 'monsterId') {
    extra = resolveSpan('monster', value, lookupName(indexes.monsters, value));
  } else if (leaf === 'npcId') {
    extra = resolveSpan('npc', value, lookupName(indexes.npcs, value));
  } else if (leaf === 'worldId') {
    extra = resolveSpan('map', value, lookupName(indexes.maps, value));
  }
  return `${field(path, shown)}${extra}`;
}

function leadsTo(value, path, indexes) {
  const name = lookupName(indexes.maps, value.worldId);
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error(`Teleport world ${value.worldId} has no map name.`);
  }
  return `<div><dt>${esc(label('leadsTo'))}</dt><dd><span data-field="${esc(`${path}.leadsTo`)}" class="resolve" data-resolve="map" data-resolve-id="${esc(value.worldId)}">${esc(name)}</span></dd></div>`;
}

function renderNode(value, path, indexes) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `<p><span data-field="${esc(path)}" data-empty="1">0</span></p>`;
    }
    const items = [];
    value.forEach((entry, index) => {
      const html = renderNode(entry, `${path}.${index}`, indexes);
      if (html) {
        items.push(`<li class="nest">${html}</li>`);
      }
    });
    if (items.length === 0) {
      return '';
    }
    return `<ol class="nest-list">${items.join('')}</ol>`;
  }
  if (value && typeof value === 'object') {
    const bits = [];
    for (const entry of visiblePairs(value)) {
      const childPath = path ? `${path}.${entry.key}` : entry.key;
      if (entry.synthetic) {
        bits.push(`<div><dt>${esc(label(entry.key))}</dt><dd>${field(childPath, entry.text)}</dd></div>`);
        continue;
      }
      if (entry.key === 'target' && isTeleportTarget(entry.value)) {
        bits.push(leadsTo(entry.value, childPath, indexes));
        continue;
      }
      const inner = renderNode(entry.value, childPath, indexes);
      if (!inner) {
        continue;
      }
      bits.push(`<div><dt>${esc(label(entry.key))}</dt><dd>${inner}</dd></div>`);
    }
    if (bits.length === 0) {
      return '';
    }
    return `<dl class="fields">${bits.join('')}</dl>`;
  }
  return renderPrimitives(value, path, indexes);
}

function renderRecord(record, indexes) {
  const dropMagic = magicTrioIsZero(record);
  const scalars = [];
  const nested = [];
  for (const entry of visiblePairs(record)) {
    if (entry.key === 'name' || entry.key === 'id') {
      continue;
    }
    if (dropMagic && ZERO_MAGIC_KEYS.has(entry.key)) {
      continue;
    }
    if (entry.synthetic || !entry.value || typeof entry.value !== 'object') {
      scalars.push(entry);
    } else {
      nested.push(entry);
    }
  }
  const scalarHtml = scalars.length === 0 ? '' : `<dl class="scalar-grid">${scalars.map((entry) => {
    const body = entry.synthetic ? field(entry.key, entry.text) : renderPrimitives(entry.value, entry.key, indexes);
    return `<div><dt>${esc(label(entry.key))}</dt><dd>${body}</dd></div>`;
  }).join('')}</dl>`;
  const nestedHtml = nested.map((entry) => {
    const inner = renderNode(entry.value, entry.key, indexes);
    if (!inner) {
      return '';
    }
    return `<section class="section"><h2>${esc(label(entry.key))}</h2>${inner}</section>`;
  }).join('');
  return `${scalarHtml}${nestedHtml}`;
}

export function renderDetail(kind, record, indexes) {
  const lede = kind === 'monsters' ? '' : `    <p class="lede">${field('id', record.id)}</p>\n`;
  const body = `    <h1>${field('name', record.name)}</h1>
${lede}    ${renderRecord(record, indexes)}
${playButton()}
    <script type="application/json" id="wiki-record">${jsonForScript(record)}</script>`;
  return shell({
    canonical: `${SITE}${kind}/${record.id}.html`,
    current: kind,
    body,
  });
}

function searchText(record, extraKey) {
  const bits = [record.id, record.name];
  if (extraKey && record[extraKey] !== undefined && record[extraKey] !== null) {
    const value = record[extraKey];
    bits.push(extraKey === 'damageType' ? formatDamageType(value) : value);
  }
  return bits.join(' ');
}

function typeChips(rows, extraKey) {
  if (!extraKey) return '';
  const counts = new Map();
  for (const row of rows) {
    const value = row[extraKey];
    if (typeof value !== 'string' || value.trim() === '') continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  if (counts.size < 2 || counts.size > 16) return '';
  const buttons = [...counts.entries()].map(([value, count]) => {
    return `<button type="button" data-q="${esc(value)}">${esc(value)} <span>${count}</span></button>`;
  }).join('');
  return `    <div class="chips" aria-label="Filter by ${esc(label(extraKey))}">${buttons}</div>`;
}

export function renderIndex(kindMeta, rows) {
  const list = rows.map((row) => {
    const extraValue = kindMeta.extra ? row[kindMeta.extra] : undefined;
    const extraShown = kindMeta.extra === 'damageType' && extraValue !== undefined && extraValue !== null
      ? formatDamageType(extraValue)
      : extraValue;
    const extraField = extraShown !== undefined && extraShown !== null
      ? ` · ${field(kindMeta.extra, extraShown)}`
      : '';
    return `      <li data-row data-id="${esc(row.id)}" data-search="${esc(searchText(row, kindMeta.extra))}">
        <a href="${esc(row.id)}.html">${field('name', row.name)}</a>
        <span class="meta">${field('id', row.id)}${extraField}</span>
      </li>`;
  }).join('\n');
  const body = `    <h1>${esc(kindMeta.title)}</h1>
    <p class="lede"><span data-count="${rows.length}">${rows.length}</span></p>
    <form class="search" role="search" action="" onsubmit="return false">
      <label for="wiki-q">Search</label>
      <input id="wiki-q" name="q" type="search" autocomplete="off" placeholder="Name or id">
    </form>
${typeChips(rows, kindMeta.extra)}
    <p id="wiki-status" role="status" data-state="loading">${CHECKING}</p>
    <p id="wiki-empty" class="empty" hidden>${NO_MATCH}</p>
    <ul id="wiki-list" class="rows" data-kind="${esc(kindMeta.key)}" data-catalog="../catalog.json">
${list}
    </ul>`;
  return shell({
    canonical: `${SITE}${kindMeta.slug}/`,
    current: kindMeta.slug,
    body,
    scripts: ['wiki.js'],
  });
}

export function renderHome(catalog) {
  const cards = KINDS.map((kind) => {
    const count = catalog[kind.key].length;
    return `      <a class="card" href="${kind.slug}/index.html"><span>${esc(kind.title)}</span><strong data-count="${count}" data-kind="${kind.key}">${count}</strong></a>`;
  }).join('\n');
  const body = `    <h1>${esc(PAGE_TITLE)}</h1>
    <p class="lede">${esc(PAGE_DESCRIPTION)}</p>
    <p><a class="plan-btn" href="/wiki/planner/index.html">${PLAN_LABEL}</a></p>
    <div class="cards">
${cards}
    </div>`;
  return shell({
    canonical: SITE,
    current: '',
    body,
  });
}

export function renderPlanner(config) {
  const start = {
    level: 1,
    rebirth: 0,
    str: 10,
    vit: 10,
    dex: 10,
    int: 10,
    mag: 10,
    chr: 10,
  };
  const outcome = evaluate(config, start);
  if (!outcome.ok) {
    throw new Error(`Planner default build is invalid: ${outcome.error}`);
  }
  const stats = [
    ['str', 'STR'],
    ['vit', 'VIT'],
    ['dex', 'DEX'],
    ['int', 'INT'],
    ['mag', 'MAG'],
    ['chr', 'CHR'],
  ].map(([key, name]) => `        <div class="stat-row">
          <label for="stat-${key}">${name}</label>
          <input id="stat-${key}" type="text" inputmode="numeric" value="10">
          <button type="button" data-bump data-stat="${key}" data-dir="-1" aria-label="Lower ${name}">−</button>
          <button type="button" data-bump data-stat="${key}" data-dir="1" aria-label="Raise ${name}">+</button>
        </div>`).join('\n');
  const body = `    <h1>${PLAN_LABEL}</h1>
    <form id="planner-form" class="planner-grid" action="" onsubmit="return false">
      <div class="tune-row"><label for="level">Level</label><input id="level" type="text" inputmode="numeric" value="1"></div>
      <div class="tune-row"><label for="rebirth">Rebirth</label><input id="rebirth" type="text" inputmode="numeric" value="0"></div>
${stats}
    </form>
    <p id="planner-error" class="alert" role="alert" hidden></p>
    <div id="planner-result" class="results" aria-live="polite">
      <div><span>Unspent points</span><strong id="out-points">${outcome.points}</strong></div>
      <div><span>HP</span><strong id="out-hp">${outcome.hp}</strong></div>
      <div><span>MP</span><strong id="out-mp">${outcome.mp}</strong></div>
      <div><span>SP</span><strong id="out-sp">${outcome.sp}</strong></div>
    </div>
    <script type="application/json" id="planner-config">${jsonForScript(config)}</script>`;
  return shell({
    canonical: `${SITE}planner/`,
    current: 'planner',
    body,
    scripts: ['planner-math.js', 'planner-ui.js'],
  });
}

export function renderError() {
  const body = `    <h1>${MISSING_PAGE}</h1>
    <p><a href="/wiki/index.html">${BACK_LINK}</a></p>`;
  return shell({
    canonical: `${SITE}error.html`,
    current: '',
    body,
  });
}

export function renderSitemap(catalog) {
  const urls = [SITE];
  for (const kind of KINDS) {
    urls.push(`${SITE}${kind.slug}/`);
    for (const row of catalog[kind.key]) {
      urls.push(`${SITE}${kind.slug}/${row.id}.html`);
    }
  }
  urls.push(`${SITE}planner/`);
  const body = urls.map((url) => `  <url><loc>${esc(url)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function collectPrimitivePaths(record) {
  const out = [];
  walkPrimitives(record, '', out);
  return out;
}

export { KINDS };
