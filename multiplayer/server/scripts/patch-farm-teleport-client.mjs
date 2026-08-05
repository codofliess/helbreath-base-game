/**
 * Inject farm building teleports into sp-client MapTeleportLocs.ts
 */
import fs from 'fs';

const p = 'C:/Users/54116/helbreath-base-game/sp-client/src/constants/MapTeleportLocs.ts';
let s = fs.readFileSync(p, 'utf8');

const outdoorZones = `
    {
        "mapId": "arefarm",
        "locs": [[59,69],[59,70],[60,70],[63,70],[64,69]],
        "targetMap": "gshop_1f",
        "targetX": 50,
        "targetY": 39
    },
    {
        "mapId": "arefarm",
        "locs": [[73,87],[74,87],[75,87],[75,86]],
        "targetMap": "bsmith_1f",
        "targetX": 34,
        "targetY": 37
    },
    {
        "mapId": "arefarm",
        "locs": [[63,92],[63,93],[64,93]],
        "targetMap": "bsmith_1f",
        "targetX": 43,
        "targetY": 32
    },
    {
        "mapId": "arefarm",
        "locs": [[34,88],[35,89],[36,90]],
        "targetMap": "wrhus_1f",
        "targetX": 59,
        "targetY": 36
    },
    {
        "mapId": "arefarm",
        "locs": [[40,90]],
        "targetMap": "wrhus_1f",
        "targetX": 56,
        "targetY": 36
    },
    {
        "mapId": "elvfarm",
        "locs": [[88,178],[88,179],[89,179],[92,179],[93,178]],
        "targetMap": "gshop_2f",
        "targetX": 50,
        "targetY": 39
    },
    {
        "mapId": "elvfarm",
        "locs": [[121,187],[122,187],[123,187],[123,186]],
        "targetMap": "bsmith_2f",
        "targetX": 34,
        "targetY": 37
    },
    {
        "mapId": "elvfarm",
        "locs": [[111,192],[111,193],[112,193]],
        "targetMap": "bsmith_2f",
        "targetX": 43,
        "targetY": 32
    },
    {
        "mapId": "elvfarm",
        "locs": [[66,195],[67,196],[68,197],[72,197]],
        "targetMap": "wrhus_2f",
        "targetX": 56,
        "targetY": 36
    },
`;

const interiorZones = `
    {
        "mapId": "gshop_1f",
        "locs": [[49,36],[50,36],[49,37],[50,37],[51,37]],
        "exitsByTown": {
            "arefarm": ["arefarm", 61, 70],
            "aresden": ["arefarm", 61, 70]
        }
    },
    {
        "mapId": "bsmith_1f",
        "locs": [[33,34],[32,35],[33,35],[43,30],[44,29],[44,30]],
        "exitsByTown": {
            "arefarm": ["arefarm", 74, 88],
            "aresden": ["arefarm", 74, 88]
        }
    },
    {
        "mapId": "wrhus_1f",
        "locs": [[54,33],[53,34],[54,34],[55,34],[61,34],[61,35],[61,36]],
        "exitsByTown": {
            "arefarm": ["arefarm", 37, 90],
            "aresden": ["arefarm", 37, 90]
        }
    },
    {
        "mapId": "gshop_2f",
        "locs": [[49,36],[50,36],[49,37],[50,37],[51,37]],
        "exitsByTown": {
            "elvfarm": ["elvfarm", 90, 179],
            "elvine": ["elvfarm", 90, 179]
        }
    },
    {
        "mapId": "bsmith_2f",
        "locs": [[33,34],[32,35],[33,35],[43,30],[44,29],[44,30]],
        "exitsByTown": {
            "elvfarm": ["elvfarm", 122, 188],
            "elvine": ["elvfarm", 122, 188]
        }
    },
    {
        "mapId": "wrhus_2f",
        "locs": [[54,33],[53,34],[54,34],[55,34],[61,34],[61,35],[61,36]],
        "exitsByTown": {
            "elvfarm": ["elvfarm", 69, 197],
            "elvine": ["elvfarm", 69, 197]
        }
    },
`;

// Idempotent: strip previous farm-building inject markers
const OUT_MARK = '/* FARM_BUILDING_OUTDOOR_START */';
const OUT_END = '/* FARM_BUILDING_OUTDOOR_END */';
const IN_MARK = '/* FARM_BUILDING_INTERIOR_START */';
const IN_END = '/* FARM_BUILDING_INTERIOR_END */';

function stripBlock(src, start, end) {
  const a = src.indexOf(start);
  const b = src.indexOf(end);
  if (a >= 0 && b > a) {
    return src.slice(0, a) + src.slice(b + end.length);
  }
  return src;
}

s = stripBlock(s, OUT_MARK, OUT_END);
s = stripBlock(s, IN_MARK, IN_END);

// Insert outdoor zones before `] as const;\nexport const INTERIOR_EXIT_ZONES`
const outdoorNeedle = '] as const;\nexport const INTERIOR_EXIT_ZONES';
const outdoorNeedle2 = '] as const;\r\nexport const INTERIOR_EXIT_ZONES';
let idx = s.indexOf(outdoorNeedle);
let needle = outdoorNeedle;
if (idx < 0) {
  idx = s.indexOf(outdoorNeedle2);
  needle = outdoorNeedle2;
}
if (idx < 0) throw new Error('MAP_TELEPORT_ZONES end not found');

const outdoorBlock = `${OUT_MARK}\n${outdoorZones}${OUT_END}\n`;
// need comma before insert - previous entry ends with }
// insert before closing ]
s = s.slice(0, idx) + ',\n' + outdoorBlock + s.slice(idx);

// Insert interior zones before `] as const;\nfor (const zone of INTERIOR_EXIT_ZONES)`
// find last INTERIOR_EXIT_ZONES array end - look for pattern after INTERIOR_EXIT_ZONES definition
const intStart = s.indexOf('export const INTERIOR_EXIT_ZONES');
if (intStart < 0) throw new Error('INTERIOR_EXIT_ZONES not found');
const afterInt = s.indexOf('] as const;', intStart);
if (afterInt < 0) throw new Error('INTERIOR_EXIT_ZONES end not found');
const interiorBlock = `,\n${IN_MARK}\n${interiorZones}${IN_END}\n`;
s = s.slice(0, afterInt) + interiorBlock + s.slice(afterInt);

fs.writeFileSync(p, s);
console.log('MapTeleportLocs.ts patched');
