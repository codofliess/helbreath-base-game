/**
 * Client warps for farm barracks entry/exit (MapTeleportLocs.ts)
 */
import fs from 'fs';

const p = 'C:/Users/54116/helbreath-base-game/sp-client/src/constants/MapTeleportLocs.ts';
let s = fs.readFileSync(p, 'utf8');

const START = '/* FARM_BARRACKS_START */';
const END = '/* FARM_BARRACKS_END */';

function strip(src) {
  const a = src.indexOf(START);
  const b = src.indexOf(END);
  if (a >= 0 && b > a) return src.slice(0, a) + src.slice(b + END.length);
  return src;
}
s = strip(s);

const block = `
${START}
    {
        "mapId": "arefarm",
        "locs": [[53,133],[54,133],[55,133],[55,132]],
        "targetMap": "arebrk11",
        "targetX": 28,
        "targetY": 43
    },
    {
        "mapId": "arebrk11",
        "locs": [[26,41],[27,41],[26,42]],
        "targetMap": "arefarm",
        "targetX": 54,
        "targetY": 133
    },
    {
        "mapId": "arebrk11",
        "locs": [[67,70],[68,70],[68,71]],
        "targetMap": "arebrk12",
        "targetX": 33,
        "targetY": 33
    },
    {
        "mapId": "arebrk12",
        "locs": [[32,33],[33,33],[32,34]],
        "targetMap": "arebrk11",
        "targetX": 67,
        "targetY": 70
    },
    {
        "mapId": "elvfarm",
        "locs": [[96,148],[97,148],[95,149],[96,149]],
        "targetMap": "elvbrk11",
        "targetX": 28,
        "targetY": 43
    },
    {
        "mapId": "elvbrk11",
        "locs": [[26,41],[27,41],[26,42]],
        "targetMap": "elvfarm",
        "targetX": 96,
        "targetY": 149
    },
    {
        "mapId": "elvbrk11",
        "locs": [[67,70],[68,70],[68,71]],
        "targetMap": "elvbrk12",
        "targetX": 33,
        "targetY": 33
    },
    {
        "mapId": "elvbrk12",
        "locs": [[32,33],[33,33],[32,34]],
        "targetMap": "elvbrk11",
        "targetX": 67,
        "targetY": 70
    },
${END}
`;

// Insert into MAP_TELEPORT_ZONES before FARM_BUILDING outdoor or before INTERIOR.
// Block already ends with a trailing comma on the last zone — do NOT add another comma
// (that creates a sparse `undefined` hole and crashes zone.targetMap at module load).
const marker = '/* FARM_BUILDING_OUTDOOR_START */';
const mi = s.indexOf(marker);
if (mi >= 0) {
  s = s.slice(0, mi) + block + s.slice(mi);
} else {
  const needle = '] as const;\nexport const INTERIOR_EXIT_ZONES';
  const i = s.indexOf(needle);
  if (i < 0) throw new Error('insert point not found');
  s = s.slice(0, i) + ',\n' + block + s.slice(i);
}

fs.writeFileSync(p, s);
console.log('MapTeleportLocs barracks warps OK');
