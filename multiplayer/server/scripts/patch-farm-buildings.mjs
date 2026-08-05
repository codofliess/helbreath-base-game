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

const farmWorlds = [
  {
    id: 'arefarmshop',
    name: 'Aresden Farm Shop',
    map: 'gshop_1f',
    music: 'default.mp3',
    workerThread: 0,
    teleportLocs: [tp([[49, 36], [50, 36], [49, 37], [50, 37], [51, 37]], 'arefarm', 61, 70)],
    npcs: [npc(0, 59, 42, 4)],
  },
  {
    id: 'arefarmbsmith',
    name: 'Aresden Farm Blacksmith',
    map: 'bsmith_1f',
    music: 'default.mp3',
    workerThread: 0,
    teleportLocs: [tp([[33, 34], [32, 35], [33, 35], [43, 30], [44, 29], [44, 30]], 'arefarm', 74, 88)],
    npcs: [npc(3, 48, 33, 7)],
  },
  {
    id: 'arefarmwrus',
    name: 'Aresden Farm Warehouse',
    map: 'wrhus_1f',
    music: 'default.mp3',
    workerThread: 0,
    teleportLocs: [tp([[54, 33], [53, 34], [54, 34], [55, 34], [61, 34], [61, 35], [61, 36]], 'arefarm', 37, 90)],
    npcs: [npc(4, 48, 37, 4)],
  },
  {
    id: 'elvfarmshop',
    name: 'Elvine Farm Shop',
    map: 'gshop_2f',
    music: 'default.mp3',
    workerThread: 0,
    teleportLocs: [tp([[49, 36], [50, 36], [49, 37], [50, 37], [51, 37]], 'elvfarm', 90, 179)],
    npcs: [npc(0, 59, 42, 4)],
  },
  {
    id: 'elvfarmbsmith',
    name: 'Elvine Farm Blacksmith',
    map: 'bsmith_2f',
    music: 'default.mp3',
    workerThread: 0,
    teleportLocs: [tp([[33, 34], [32, 35], [33, 35], [43, 30], [44, 29], [44, 30]], 'elvfarm', 122, 188)],
    npcs: [npc(3, 48, 33, 7)],
  },
  {
    id: 'elvfarmwrus',
    name: 'Elvine Farm Warehouse',
    map: 'wrhus_2f',
    music: 'default.mp3',
    workerThread: 0,
    teleportLocs: [tp([[54, 33], [53, 34], [54, 34], [55, 34], [61, 34], [61, 35], [61, 36]], 'elvfarm', 69, 197)],
    npcs: [npc(4, 48, 37, 4)],
  },
];

for (const w of farmWorlds) {
  const i = j.findIndex((x) => x.id === w.id);
  if (i >= 0) j[i] = w;
  else j.push(w);
  console.log('world', w.id, 'map', w.map, 'npc', w.npcs[0].npcId);
}

const af = j.find((w) => w.id === 'arefarm');
const ef = j.find((w) => w.id === 'elvfarm');
if (!af || !ef) throw new Error('farm worlds missing');

const stripTargets = new Set([
  'arefarmshop',
  'arefarmbsmith',
  'arefarmwrus',
  'elvfarmshop',
  'elvfarmbsmith',
  'elvfarmwrus',
]);
af.teleportLocs = (af.teleportLocs || []).filter((t) => !stripTargets.has(t.target.worldId));
ef.teleportLocs = (ef.teleportLocs || []).filter((t) => !stripTargets.has(t.target.worldId));

// Olympia arefarm.TXT building doors
af.teleportLocs.push(
  tp([[59, 69], [59, 70], [60, 70], [63, 70], [64, 69]], 'arefarmshop', 50, 39),
  tp([[73, 87], [74, 87], [75, 87], [75, 86]], 'arefarmbsmith', 34, 37),
  tp([[63, 92], [63, 93], [64, 93]], 'arefarmbsmith', 43, 32),
  tp([[34, 88], [35, 89], [36, 90]], 'arefarmwrus', 59, 36),
  tp([[40, 90]], 'arefarmwrus', 56, 36),
);

// Olympia elvfarm.TXT building doors
ef.teleportLocs.push(
  tp([[88, 178], [88, 179], [89, 179], [92, 179], [93, 178]], 'elvfarmshop', 50, 39),
  tp([[121, 187], [122, 187], [123, 187], [123, 186]], 'elvfarmbsmith', 34, 37),
  tp([[111, 192], [111, 193], [112, 193]], 'elvfarmbsmith', 43, 32),
  tp([[66, 195], [67, 196], [68, 197], [72, 197]], 'elvfarmwrus', 56, 36),
);

console.log('arefarm tps', af.teleportLocs.length, 'elvfarm tps', ef.teleportLocs.length);
fs.writeFileSync(path.join(__dirname, '..', 'Config', 'GameWorlds.json'), JSON.stringify(j, null, 2) + '\n');
console.log('GameWorlds.json OK');
