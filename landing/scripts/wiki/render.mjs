/**
 * Renders catalog HTML. Visible values come only from projected records.
 */

import { indexById } from './project.mjs';
import { evaluate } from './planner.mjs';

const SITE = 'https://chainlords.net/wiki/';

const KINDS = [
  { key: 'monsters', slug: 'monsters', title: 'Monsters', extra: 'sprite' },
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
  const known = {
    hp: 'HP',
    id: 'Id',
    mp: 'MP',
    itemType: 'Item type',
    itemId: 'Item id',
    spellId: 'Spell id',
    monsterId: 'Monster id',
    npcId: 'NPC id',
    worldId: 'World id',
    aoeRadius: 'AoE radius',
  };
  if (known[key]) {
    return known[key];
  }
  const spaced = key.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
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

export function shell({ title, description, canonical, current, body, scripts }) {
  const nav = [
    ['monsters/index.html', 'Monsters', 'monsters'],
    ['items/index.html', 'Items', 'items'],
    ['maps/index.html', 'Maps', 'maps'],
    ['spells/index.html', 'Spells', 'spells'],
    ['planner/index.html', 'Stat planner', 'planner'],
  ].map(([href, text, key]) => {
    const currentAttr = key === current ? ' aria-current="page"' : '';
    return `<a href="/wiki/${href}"${currentAttr}>${text}</a>`;
  }).join('');
  const scriptTags = (scripts || []).map((src) => `<script src="/wiki/${src}"></script>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(canonical)}">
  <meta name="robots" content="index,follow">
  <link rel="stylesheet" href="/wiki/wiki.css">
</head>
<body>
  <a class="skip" href="#content">Skip to content</a>
  <header class="top">
    <a class="brand" href="/wiki/index.html">Catalog</a>
    <nav class="nav" aria-label="Catalog">${nav}</nav>
  </header>
  <main id="content" class="wrap">
${body}
  </main>
  <footer>
    <p>Pages are generated from the server config in this repository. A value that is not in those files is left out.</p>
  </footer>
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

function renderPrimitives(value, path, indexes) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return field(path, value.length === 0 ? 0 : value);
    }
    return '';
  }
  const text = primitiveText(value);
  if (text === null) {
    return '';
  }
  let extra = '';
  const leaf = path.split('.').pop();
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
  return `${field(path, value)}${extra}`;
}

function renderNode(value, path, indexes) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `<p><span data-field="${esc(path)}" data-empty="1">0</span></p>`;
    }
    const items = value.map((entry, index) => {
      const childPath = `${path}.${index}`;
      return `<li class="nest">${renderNode(entry, childPath, indexes)}</li>`;
    }).join('');
    return `<ol class="nest-list">${items}</ol>`;
  }
  if (value && typeof value === 'object') {
    const bits = Object.entries(value).map(([key, child]) => {
      const childPath = path ? `${path}.${key}` : key;
      return `<div><dt>${esc(label(key))}</dt><dd>${renderNode(child, childPath, indexes)}</dd></div>`;
    }).join('');
    return `<dl class="fields">${bits}</dl>`;
  }
  return renderPrimitives(value, path, indexes);
}

function renderRecord(record, indexes) {
  const scalars = [];
  const nested = [];
  for (const [key, value] of Object.entries(record)) {
    if (key === 'name' || key === 'id') {
      continue;
    }
    if (value && typeof value === 'object') {
      nested.push([key, value]);
    } else {
      scalars.push([key, value]);
    }
  }
  const scalarHtml = scalars.length === 0 ? '' : `<dl class="scalar-grid">${scalars.map(([key, value]) => {
    return `<div><dt>${esc(label(key))}</dt><dd>${renderPrimitives(value, key, indexes)}</dd></div>`;
  }).join('')}</dl>`;
  const nestedHtml = nested.map(([key, value]) => {
    return `<section class="section"><h2>${esc(label(key))}</h2>${renderNode(value, key, indexes)}</section>`;
  }).join('');
  return `${scalarHtml}${nestedHtml}`;
}

function detailDescription(record, extraKey) {
  const parts = [record.name];
  if (extraKey && record[extraKey] !== undefined && record[extraKey] !== null) {
    parts.push(String(record[extraKey]));
  }
  return parts.join('. ');
}

export function renderDetail(kind, record, indexes) {
  const meta = KINDS.find((entry) => entry.slug === kind);
  const description = detailDescription(record, meta.extra);
  const body = `    <h1>${field('name', record.name)}</h1>
    <p class="lede">${field('id', record.id)}</p>
    ${renderRecord(record, indexes)}
    <script type="application/json" id="wiki-record">${jsonForScript(record)}</script>`;
  return shell({
    depth: 1,
    title: `${record.name} — Chain Lords catalog`,
    description,
    canonical: `${SITE}${kind}/${record.id}.html`,
    current: kind,
    body,
  });
}

function searchText(record, extraKey) {
  const bits = [record.id, record.name];
  if (extraKey && record[extraKey] !== undefined && record[extraKey] !== null) {
    bits.push(record[extraKey]);
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
    const extraField = kindMeta.extra && row[kindMeta.extra] !== undefined && row[kindMeta.extra] !== null
      ? ` · ${field(kindMeta.extra, row[kindMeta.extra])}`
      : '';
    return `      <li data-row data-id="${esc(row.id)}" data-search="${esc(searchText(row, kindMeta.extra))}">
        <a href="${esc(row.id)}.html">${field('name', row.name)}</a>
        <span class="meta">${field('id', row.id)}${extraField}</span>
      </li>`;
  }).join('\n');
  const body = `    <h1>${esc(kindMeta.title)}</h1>
    <p class="lede"><span data-count="${rows.length}">${rows.length}</span> from the server config.</p>
    <form class="search" role="search" action="" onsubmit="return false">
      <label for="wiki-q">Search ${esc(kindMeta.title.toLowerCase())}</label>
      <input id="wiki-q" name="q" type="search" autocomplete="off" placeholder="Name or id">
    </form>
${typeChips(rows, kindMeta.extra)}
    <p id="wiki-status" role="status" data-state="loading">Loading catalog check…</p>
    <p id="wiki-empty" class="empty" hidden>No rows match.</p>
    <ul id="wiki-list" class="rows" data-kind="${esc(kindMeta.key)}" data-catalog="../catalog.json">
${list}
    </ul>`;
  return shell({
    depth: 1,
    title: `${kindMeta.title} — Chain Lords catalog`,
    description: `${kindMeta.title} from the Chain Lords server config.`,
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
  const sources = catalog.sources.map((source) => `      <li>${esc(source)}</li>`).join('\n');
  const body = `    <h1>Catalog</h1>
    <p class="lede">Monsters, items, maps, and spells published from this server's config. Nothing here is filled in from another server.</p>
    <div class="cards">
${cards}
      <a class="card" href="planner/index.html"><span>Stat planner</span><strong>Points</strong></a>
    </div>
    <h2>Config files</h2>
    <ul class="sources">
${sources}
    </ul>`;
  return shell({
    depth: 0,
    title: 'Catalog — Chain Lords',
    description: 'Monsters, items, maps, and spells from the Chain Lords server config.',
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
  const body = `    <h1>Stat planner</h1>
    <p class="lede">Spend level-up points. HP, MP, SP, and unspent points follow the server formulas with no gear bonus. Limits come from the progression config.</p>
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
    depth: 1,
    title: 'Stat planner — Chain Lords catalog',
    description: 'Spend level-up points and see HP, MP, SP, and unspent points from the server formulas.',
    canonical: `${SITE}planner/`,
    current: 'planner',
    body,
    scripts: ['planner-math.js', 'planner-ui.js'],
  });
}

export function renderError() {
  const body = `    <h1>Page not in the catalog</h1>
    <p id="wiki-status" class="alert" role="alert" data-state="error">This address is not a generated catalog page.</p>
    <p><a href="/wiki/index.html">Back to the catalog</a></p>`;
  return shell({
    depth: 0,
    title: 'Not in the catalog — Chain Lords',
    description: 'This address is not a generated catalog page.',
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
