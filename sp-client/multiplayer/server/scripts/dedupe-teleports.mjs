import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gameWorldsPath = path.join(__dirname, '..', 'Config', 'GameWorlds.json');
const worlds = JSON.parse(fs.readFileSync(gameWorldsPath, 'utf8'));

for (const world of worlds) {
    if (!world.teleportLocs?.length) continue;
    const usedCells = new Set();
    const deduped = [];
    for (const tl of world.teleportLocs) {
        const locs = [];
        for (const loc of tl.locs) {
            const key = `${loc.x},${loc.y}`;
            if (usedCells.has(key)) continue;
            usedCells.add(key);
            locs.push(loc);
        }
        if (locs.length > 0) {
            deduped.push({ ...tl, locs });
        }
    }
    const before = world.teleportLocs.length;
    world.teleportLocs = deduped;
    if (before !== deduped.length) {
        console.log(`${world.id}: ${before} -> ${deduped.length} teleport groups`);
    }
}

fs.writeFileSync(gameWorldsPath, `${JSON.stringify(worlds, null, 2)}\n`);
console.log('Deduped teleport source cells.');