/**
 * Assert plaza hunts are hostile Slime dwellAreas (not NPCs) and cover traveler / recheck anchors.
 * Usage: node multiplayer/server/scripts/check-plaza-monster-view.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.join(__dirname, '..', 'Config');
const worlds = JSON.parse(fs.readFileSync(path.join(configDir, 'GameWorlds.json'), 'utf8'));
const monsters = JSON.parse(fs.readFileSync(path.join(configDir, 'Monsters.json'), 'utf8'));
const settings = JSON.parse(fs.readFileSync(path.join(configDir, 'Settings.json'), 'utf8'));
const viewX = settings.radius.viewRadiusX;
const viewY = settings.radius.viewRadiusY;

const SLIME_ID = 1;
const slime = monsters.find((m) => m.id === SLIME_ID);
if (!slime || slime.name !== 'Slime') {
    console.error('Monsters.json id 1 must be Slime');
    process.exit(1);
}
if (slime.allegiance != null && slime.allegiance !== 0) {
    console.error(`Slime allegiance must be Hostile (0) or omitted, got ${slime.allegiance}`);
    process.exit(1);
}

/** @type {Record<string, { name: string, x: number, y: number, forbidCover?: boolean }[]>} */
const anchors = {
    aresden: [{ name: 'traveler-pad', x: 149, y: 127, forbidCover: true }],
    elvine: [
        { name: 'traveler-pad', x: 149, y: 131, forbidCover: true },
        { name: 'smith-street', x: 220, y: 105 },
    ],
};

function inView(cx, cy, x, y) {
    return Math.abs(x - cx) <= viewX && Math.abs(y - cy) <= viewY;
}

function rectCovers(area, x, y) {
    return x >= Math.min(area.x1, area.x2) && x <= Math.max(area.x1, area.x2)
        && y >= Math.min(area.y1, area.y2) && y <= Math.max(area.y1, area.y2);
}

function fullyInView(area, cx, cy) {
    const { x1, y1, x2, y2 } = area;
    return inView(cx, cy, x1, y1) && inView(cx, cy, x1, y2)
        && inView(cx, cy, x2, y1) && inView(cx, cy, x2, y2);
}

let failed = 0;
for (const [worldId, points] of Object.entries(anchors)) {
    const world = worlds.find((w) => w.id === worldId);
    if (!world) {
        console.error(`${worldId}: missing world`);
        failed++;
        continue;
    }
    if ((world.npcs ?? []).length > 0) {
        console.error(`${worldId}: plaza worlds must not gain city npcs[] for this hunt (got ${world.npcs.length})`);
        failed++;
    }
    const hunts = (world.dwellAreas ?? []).filter((d) => d._plazaHunt);
    if (hunts.length === 0) {
        console.error(`${worldId}: no _plazaHunt dwellAreas`);
        failed++;
        continue;
    }
    for (const hunt of hunts) {
        if (hunt.npcId != null) {
            console.error(`${worldId}: _plazaHunt must not use npcId`);
            failed++;
        }
        if (hunt.monsterId !== SLIME_ID || hunt.count < 12) {
            console.error(`${worldId}: _plazaHunt must be slime id 1 with count >= 12, got ${JSON.stringify({ id: hunt.monsterId, count: hunt.count })}`);
            failed++;
        }
    }
    for (const anchor of points) {
        const covering = hunts.filter((h) => fullyInView(h.area, anchor.x, anchor.y));
        if (covering.length === 0) {
            console.error(`${worldId}: no hostile-slime hunt fully in view of ${anchor.name} (${anchor.x},${anchor.y})`);
            failed++;
            continue;
        }
        if (anchor.forbidCover && covering.some((h) => rectCovers(h.area, anchor.x, anchor.y))) {
            console.error(`${worldId}: hunt overlaps ${anchor.name} landing cell (${anchor.x},${anchor.y})`);
            failed++;
            continue;
        }
        const sample = covering[0];
        console.log(
            `${worldId} ${anchor.name} (${anchor.x},${anchor.y}): OK — ${sample.count} Slime monsters (not npcs) in ${sample.area.x1},${sample.area.y1}–${sample.area.x2},${sample.area.y2}`,
        );
    }
}

if (failed > 0) {
    process.exit(1);
}
