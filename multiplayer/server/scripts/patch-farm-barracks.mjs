/**
 * Wire farm barracks interiors (arebrk11 / elvbrk11): exits, NPCs, training dwells.
 * Olympia: arefarm doors (53-55,132-133) → arebrk11 (28,43).
 * Elv: no mapdata door — use blue tele pads ~96,148 near village as barracks entrance.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gwPath = path.join(__dirname, '..', 'Config', 'GameWorlds.json');
const j = JSON.parse(fs.readFileSync(gwPath, 'utf8'));

function locs(pairs) {
  return pairs.map(([x, y]) => ({ x, y }));
}
function tp(pairs, worldId, tx, ty) {
  return { locs: locs(pairs), target: { worldId, loc: { x: tx, y: ty } } };
}
function npc(npcId, x, y, direction = 4) {
  return { npcId, x, y, direction };
}
function dwell(monsterId, count, x1, y1, x2, y2) {
  return { monsterId, count, area: { x1, y1, x2, y2 } };
}

function upsertWorld(w) {
  const i = j.findIndex((x) => x.id === w.id);
  if (i >= 0) j[i] = { ...j[i], ...w };
  else j.push(w);
  console.log('upsert', w.id);
}

// --- Barracks L1 (main farm barracks interior) ---
upsertWorld({
  id: 'arebrk11',
  name: 'Aresden Farm Barracks',
  map: 'arebrk11',
  music: 'default.mp3',
  workerThread: 0,
  // AMD tele flags: exit near spawn 26-27,41-42; link to brk12 67-68,70-71
  teleportLocs: [
    tp([[26, 41], [27, 41], [26, 42]], 'arefarm', 54, 133),
    tp([[67, 70], [68, 70], [68, 71]], 'arebrk12', 33, 33),
  ],
  npcs: [
    npc(12, 40, 50, 4), // Drillmaster — dummy tips
    npc(13, 55, 55, 6), // Merc Captain — CC tips
  ],
  dwellAreas: [
    // Training dummies (static practice)
    dwell(42, 8, 35, 45, 55, 65),
    // Mercenaries for CC practice — contained inside barracks only
    dwell(62, 3, 70, 80, 95, 100),
    dwell(63, 2, 72, 82, 95, 102),
  ],
});

upsertWorld({
  id: 'arebrk12',
  name: 'Aresden Farm Barracks 1-2',
  map: 'arebrk12',
  music: 'default.mp3',
  workerThread: 0,
  teleportLocs: [
    tp([[32, 33], [33, 33], [32, 34]], 'arebrk11', 67, 70),
  ],
  npcs: [],
  dwellAreas: [
    dwell(42, 4, 40, 40, 60, 60),
  ],
});

upsertWorld({
  id: 'elvbrk11',
  name: 'Elvine Farm Barracks',
  map: 'elvbrk11',
  music: 'default.mp3',
  workerThread: 0,
  teleportLocs: [
    tp([[26, 41], [27, 41], [26, 42]], 'elvfarm', 96, 149),
    tp([[67, 70], [68, 70], [68, 71]], 'elvbrk12', 33, 33),
  ],
  npcs: [
    npc(12, 40, 50, 4),
    npc(13, 55, 55, 6),
  ],
  dwellAreas: [
    dwell(42, 8, 35, 45, 55, 65),
    dwell(62, 3, 70, 80, 95, 100),
    dwell(63, 2, 72, 82, 95, 102),
  ],
});

upsertWorld({
  id: 'elvbrk12',
  name: 'Elvine Farm Barracks 1-2',
  map: 'elvbrk12',
  music: 'default.mp3',
  workerThread: 0,
  teleportLocs: [
    tp([[32, 33], [33, 33], [32, 34]], 'elvbrk11', 67, 70),
  ],
  npcs: [],
  dwellAreas: [
    dwell(42, 4, 40, 40, 60, 60),
  ],
});

// --- Farm outdoor: ensure barracks door TPs; move drillmaster/captain outdoor NPCs off map ---
const af = j.find((w) => w.id === 'arefarm');
const ef = j.find((w) => w.id === 'elvfarm');

// Keep Enzu (11) outdoor; remove 12/13 from outdoor (now inside barracks)
af.npcs = (af.npcs || []).filter((n) => n.npcId === 11 || n.npcId === 0);
if (!af.npcs.some((n) => n.npcId === 11)) {
  af.npcs.push(npc(11, 49, 97, 6));
}
// Strip outdoor dummies/mercs (moved into barracks)
af.dwellAreas = (af.dwellAreas || []).filter(
  (d) => d.monsterId !== 42 && d.monsterId !== 62 && d.monsterId !== 63,
);

// arefarm already has arebrk11 TP — ensure present
const hasAreBrk = (af.teleportLocs || []).some((t) => t.target.worldId === 'arebrk11');
if (!hasAreBrk) {
  af.teleportLocs.push(tp([[53, 133], [54, 133], [55, 133], [55, 132]], 'arebrk11', 28, 43));
}

ef.npcs = (ef.npcs || []).filter((n) => n.npcId === 11 || n.npcId === 0);
if (!ef.npcs.some((n) => n.npcId === 11)) {
  ef.npcs.push(npc(11, 118, 150, 3));
}
ef.dwellAreas = (ef.dwellAreas || []).filter(
  (d) => d.monsterId !== 42 && d.monsterId !== 62 && d.monsterId !== 63,
);

// Elv farm: blue pads 95-97,148-149 unused — barracks entrance (Olympia has no mapdata line; AMD has tiles)
ef.teleportLocs = (ef.teleportLocs || []).filter((t) => t.target.worldId !== 'elvbrk11');
ef.teleportLocs.push(tp([[96, 148], [97, 148], [95, 149], [96, 149]], 'elvbrk11', 28, 43));

console.log('arefarm npcs', af.npcs.map((n) => n.npcId), 'tps', af.teleportLocs.length);
console.log('elvfarm npcs', ef.npcs.map((n) => n.npcId), 'tps', ef.teleportLocs.length);

fs.writeFileSync(gwPath, JSON.stringify(j, null, 2) + '\n');
console.log('GameWorlds barracks OK');
