/**
 * Ensure elvfarm gray pad (117,158) r=1 is a city warp in MapTeleportLocs + GameWorlds.
 * Run: node multiplayer/server/scripts/patch-farm-gray-pad-teleports.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..', '..');

// --- GameWorlds.json ---
const gwPath = path.join(root, 'multiplayer/server/Config/GameWorlds.json');
const g = JSON.parse(fs.readFileSync(gwPath, 'utf8'));
const CX = 117;
const CY = 158;
const pad = [];
for (let y = CY - 1; y <= CY + 1; y++) {
    for (let x = CX - 1; x <= CX + 1; x++) {
        pad.push({ x, y });
    }
}
const padKeys = new Set(pad.map((p) => `${p.x},${p.y}`));
function around(cx, cy, r) {
    const s = new Set();
    for (let y = cy - r; y <= cy + r; y++) {
        for (let x = cx - r; x <= cx + r; x++) {
            s.add(`${x},${y}`);
        }
    }
    return s;
}
const scrub = new Set([...padKeys, ...around(124, 151, 2), ...around(117, 158, 2)]);
const w = g.find((x) => x.id === 'elvfarm');
w.teleportLocs = (w.teleportLocs || []).filter((t) => {
    if (t.target?.worldId !== 'elvine') return true;
    const locs = t.locs || [];
    const hitsPad = locs.some((l) => scrub.has(`${l.x},${l.y}`));
    const isEdge = locs.every((l) => l.x <= 25);
    if (hitsPad && !isEdge) return false;
    return true;
});
w.teleportLocs.push({
    locs: pad,
    target: { worldId: 'elvine', loc: { x: 158, y: 57 } },
    _note: 'Gray pad 117,158 r=1 city warp',
});
w._grayPadWarp = { x: CX, y: CY, to: 'elvine', radius: 1 };
w._recallPads = [{ x: CX + 3, y: CY - 3, label: 'recall-landing-NE' }];
fs.writeFileSync(gwPath, JSON.stringify(g, null, 2) + '\n');
console.log('GameWorlds elvfarm pad', pad.length, 'cells @', CX, CY);

// --- MapTeleportLocs.ts (client warp discovery) ---
const mtPath = path.join(root, 'sp-client/src/constants/MapTeleportLocs.ts');
let mt = fs.readFileSync(mtPath, 'utf8');
const marker = `"mapId": "elvfarm",
        "locs": [
            [
                20,
                147`;
if (!mt.includes('"targetMap": "elvine"') || mt.includes('// gray-pad-117-158')) {
    // continue
}
if (!mt.includes('// gray-pad-117-158')) {
    const entry = `    // gray-pad-117-158
    {
        "mapId": "elvfarm",
        "locs": [
            [116, 157], [117, 157], [118, 157],
            [116, 158], [117, 158], [118, 158],
            [116, 159], [117, 159], [118, 159]
        ],
        "targetMap": "elvine",
        "targetX": 158,
        "targetY": 57
    },
`;
    const idx = mt.indexOf(marker);
    if (idx < 0) {
        console.error('MapTeleportLocs marker not found');
        process.exit(1);
    }
    mt = mt.slice(0, idx) + entry + mt.slice(idx);
    fs.writeFileSync(mtPath, mt);
    console.log('MapTeleportLocs: inserted elvfarm gray pad 117,158 r=1');
} else {
    console.log('MapTeleportLocs: gray pad already present');
}
