/**
 * Assert traveler plaza pads have a _plazaHunt slime rectangle fully inside Settings view.
 * Usage: node multiplayer/server/scripts/check-plaza-monster-view.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.join(__dirname, '..', 'Config');
const worlds = JSON.parse(fs.readFileSync(path.join(configDir, 'GameWorlds.json'), 'utf8'));
const settings = JSON.parse(fs.readFileSync(path.join(configDir, 'Settings.json'), 'utf8'));
const viewX = settings.radius.viewRadiusX;
const viewY = settings.radius.viewRadiusY;

const travelerPads = {
    aresden: { x: 149, y: 127 },
    elvine: { x: 149, y: 131 },
};

function inView(pad, x, y) {
    return Math.abs(x - pad.x) <= viewX && Math.abs(y - pad.y) <= viewY;
}

let failed = 0;
for (const [worldId, pad] of Object.entries(travelerPads)) {
    const world = worlds.find((w) => w.id === worldId);
    if (!world) {
        console.error(`${worldId}: missing world`);
        failed++;
        continue;
    }
    const hunts = (world.dwellAreas ?? []).filter((d) => d._plazaHunt);
    if (hunts.length === 0) {
        console.error(`${worldId}: no _plazaHunt dwell at traveler pad (${pad.x},${pad.y})`);
        failed++;
        continue;
    }
    for (const hunt of hunts) {
        const { x1, y1, x2, y2 } = hunt.area;
        const corners = [
            [x1, y1],
            [x1, y2],
            [x2, y1],
            [x2, y2],
        ];
        const outside = corners.filter(([x, y]) => !inView(pad, x, y));
        const coversPad = pad.x >= Math.min(x1, x2) && pad.x <= Math.max(x1, x2)
            && pad.y >= Math.min(y1, y2) && pad.y <= Math.max(y1, y2);
        if (outside.length > 0) {
            console.error(`${worldId}: _plazaHunt ${JSON.stringify(hunt.area)} has cells outside view ±${viewX}x±${viewY} of (${pad.x},${pad.y}): ${outside}`);
            failed++;
        } else if (coversPad) {
            console.error(`${worldId}: _plazaHunt overlaps traveler landing cell (${pad.x},${pad.y})`);
            failed++;
        } else if (hunt.monsterId !== 1 || hunt.count < 1) {
            console.error(`${worldId}: _plazaHunt must be slime (id 1) with count >= 1`);
            failed++;
        } else {
            console.log(
                `${worldId}: OK — ${hunt.count} slime(s) in ${x1},${y1}–${x2},${y2} fully in view of traveler pad (${pad.x},${pad.y}) (view ${viewX}x${viewY})`,
            );
        }
    }
}

if (failed > 0) {
    process.exit(1);
}
