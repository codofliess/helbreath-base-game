import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gameWorldsPath = path.join(__dirname, '..', 'Config', 'GameWorlds.json');
const worlds = JSON.parse(fs.readFileSync(gameWorldsPath, 'utf8'));

for (const world of worlds) {
    if (!world.npcs?.length) continue;
    const seen = new Set();
    const deduped = [];
    for (const npc of world.npcs) {
        const key = `${npc.x},${npc.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(npc);
    }
    if (deduped.length !== world.npcs.length) {
        console.log(`${world.id}: ${world.npcs.length} -> ${deduped.length} npcs`);
        world.npcs = deduped;
    }
}

fs.writeFileSync(gameWorldsPath, `${JSON.stringify(worlds, null, 2)}\n`);
console.log('Deduped NPC placements.');