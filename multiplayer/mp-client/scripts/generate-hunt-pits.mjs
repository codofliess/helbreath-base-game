/**
 * Generates HuntPits.generated.ts from server GameWorlds.json dwellAreas + Monsters.json.
 * Run: node scripts/generate-hunt-pits.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverConfig = path.resolve(__dirname, '../../server/Config');
const outPath = path.resolve(__dirname, '../src/constants/HuntPits.generated.ts');

const worlds = JSON.parse(fs.readFileSync(path.join(serverConfig, 'GameWorlds.json'), 'utf8'));
const mons = JSON.parse(fs.readFileSync(path.join(serverConfig, 'Monsters.json'), 'utf8'));
const byId = new Map(mons.map((m) => [m.id, { name: m.name, sprite: m.sprite }]));

/** @type {Record<string, Array<{monsterId:number,name:string,sprite:string,x:number,y:number,count:number}>>} */
const out = {};

for (const w of worlds) {
    if (!w.dwellAreas?.length) continue;
    const mapKey = String(w.map || w.id || '').replace(/\.amd$/i, '');
    if (!mapKey) continue;
    const pits = [];
    for (const d of w.dwellAreas) {
        const a = d.area;
        if (!a) continue;
        const info = byId.get(d.monsterId) || { name: `Mob#${d.monsterId}`, sprite: '' };
        pits.push({
            monsterId: d.monsterId,
            name: info.name,
            sprite: info.sprite || '',
            x: Math.round((a.x1 + a.x2) / 2),
            y: Math.round((a.y1 + a.y2) / 2),
            count: d.count || 0,
        });
    }
    out[mapKey] = pits;
}

const body = `/** Auto-generated from server GameWorlds.json dwellAreas + Monsters.json. Do not edit by hand.
 * Regenerate: node multiplayer/mp-client/scripts/generate-hunt-pits.mjs
 */
export interface HuntPitMarker {
    monsterId: number;
    name: string;
    sprite: string;
    x: number;
    y: number;
    count: number;
}

export const HUNT_PITS_BY_MAP: Record<string, readonly HuntPitMarker[]> = ${JSON.stringify(out, null, 2)} as const;

export function getHuntPitsForMap(mapName: string | undefined): readonly HuntPitMarker[] {
    if (!mapName) {
        return [];
    }
    const key = mapName.replace(/\\.amd$/i, '').toLowerCase();
    for (const [k, v] of Object.entries(HUNT_PITS_BY_MAP)) {
        if (k.toLowerCase() === key) {
            return v;
        }
    }
    return [];
}
`;

fs.writeFileSync(outPath, body);
const total = Object.values(out).reduce((s, a) => s + a.length, 0);
console.log(`Wrote ${outPath} (${Object.keys(out).length} maps, ${total} pits)`);
