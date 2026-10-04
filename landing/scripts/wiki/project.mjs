/**
 * Projects public catalog records from the server config allowlist.
 * Internal keys (leading underscore) are dropped at every depth.
 * No other files are read.
 */

import fs from 'fs';
import path from 'path';

export const SOURCE_FILES = [
  'multiplayer/server/Config/Items.json',
  'multiplayer/server/Config/Monsters.json',
  'multiplayer/server/Config/Spells.json',
  'multiplayer/server/Config/GameWorlds.json',
  'multiplayer/server/Config/NPCs.json',
  'multiplayer/server/Config/Progression.json',
];

const PLANNER_KEYS = ['maxLevel', 'maxRebirth', 'rebirthLuPoints'];

export function stripInternal(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => stripInternal(entry));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith('_')) {
        continue;
      }
      out[key] = stripInternal(child);
    }
    return out;
  }
  return value;
}

function readArray(repoRoot, rel, label) {
  const abs = path.join(repoRoot, rel);
  const root = path.resolve(repoRoot);
  if (!path.resolve(abs).startsWith(root + path.sep)) {
    throw new Error(`Refusing to read outside the repo: ${rel}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${rel}: ${error.message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${rel} is not a JSON array.`);
  }
  const rows = parsed.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`${label} entry ${index} is not an object.`);
    }
    return stripInternal(row);
  });
  return rows;
}

function assertIdentity(rows, label, idKind) {
  const seen = new Set();
  rows.forEach((row, index) => {
    if (!Object.prototype.hasOwnProperty.call(row, 'id')) {
      throw new Error(`${label} entry ${index} has no id.`);
    }
    if (idKind === 'number' && !Number.isInteger(row.id)) {
      throw new Error(`${label} entry ${index} id is not an integer.`);
    }
    if (idKind === 'string' && (typeof row.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(row.id))) {
      throw new Error(`${label} entry ${index} id is not a safe file name.`);
    }
    if (typeof row.name !== 'string' || row.name.trim() === '') {
      throw new Error(`${label} entry ${index} has an empty name.`);
    }
    const key = String(row.id);
    if (seen.has(key)) {
      throw new Error(`${label} duplicate id ${key}.`);
    }
    seen.add(key);
  });
}

function plannerConfig(repoRoot) {
  const rel = 'multiplayer/server/Config/Progression.json';
  const abs = path.join(repoRoot, rel);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${rel}: ${error.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${rel} is not an object.`);
  }
  const out = {};
  for (const key of PLANNER_KEYS) {
    if (!Number.isInteger(parsed[key])) {
      throw new Error(`${rel} is missing integer ${key}.`);
    }
    out[key] = parsed[key];
  }
  if (out.maxLevel < 1 || out.maxRebirth < 0 || out.rebirthLuPoints < 0) {
    throw new Error(`${rel} planner tunables are out of range.`);
  }
  return out;
}

export function loadCatalog(repoRoot) {
  const items = readArray(repoRoot, SOURCE_FILES[0], 'items');
  const monsters = readArray(repoRoot, SOURCE_FILES[1], 'monsters');
  const spells = readArray(repoRoot, SOURCE_FILES[2], 'spells');
  const maps = readArray(repoRoot, SOURCE_FILES[3], 'maps');
  const npcs = readArray(repoRoot, SOURCE_FILES[4], 'npcs');
  assertIdentity(items, 'items', 'number');
  assertIdentity(monsters, 'monsters', 'number');
  assertIdentity(spells, 'spells', 'number');
  assertIdentity(maps, 'maps', 'string');
  assertIdentity(npcs, 'npcs', 'number');
  return {
    sources: SOURCE_FILES.slice(),
    items,
    monsters,
    spells,
    maps,
    npcs,
    progression: plannerConfig(repoRoot),
  };
}

export function indexById(rows) {
  const map = new Map();
  for (const row of rows) {
    map.set(String(row.id), row);
  }
  return map;
}
