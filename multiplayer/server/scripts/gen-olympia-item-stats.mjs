/**
 * Generates Olympia Item.cfg combat/stat fields for client tooltips.
 * Run: node multiplayer/server/scripts/gen-olympia-item-stats.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..', '..');
const cfgFiles = [
    path.join(repoRoot, 'reference', 'Item.cfg'),
    path.join(repoRoot, 'reference', 'Item2.cfg'),
    path.join(repoRoot, 'reference', 'Item3.cfg'),
];
const outPath = path.join(
    repoRoot,
    'multiplayer',
    'mp-client',
    'src',
    'constants',
    'OlympiaItemStats.generated.ts',
);

function parseItemLine(line) {
    const trimmed = line.trim();
    const match = trimmed.match(/^Item\s*=\s*(.+)$/);
    if (!match) {
        return null;
    }
    const tokens = match[1].trim().split(/\s+/);
    if (tokens.length < 26) {
        return null;
    }
    const id = Number.parseInt(tokens[0], 10);
    const nums = tokens.slice(2).map((t) => Number.parseInt(t, 10));
    return {
        id,
        itemType: nums[0],
        equipPos: nums[1],
        effectType: nums[2],
        effectValues: nums.slice(3, 9),
        maxLifeSpan: nums[9],
        weight: nums[14],
        speed: nums[16],
        levelLimit: nums[17],
    };
}

function main() {
    const byId = new Map();
    for (const file of cfgFiles) {
        for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
            const row = parseItemLine(line);
            if (!row || byId.has(row.id)) {
                continue;
            }
            byId.set(row.id, row);
        }
    }

    const rows = [...byId.values()].sort((a, b) => a.id - b.id);
    const entries = rows.map((row) => {
        const ev = row.effectValues.map((n) => (Number.isFinite(n) ? n : 0));
        return `    ${row.id}: { equipPos: ${row.equipPos}, effectType: ${row.effectType}, effectValues: [${ev.join(', ')}], maxLifeSpan: ${row.maxLifeSpan}, weight: ${row.weight}, speed: ${row.speed}, levelLimit: ${row.levelLimit} },`;
    });

    const ts = [
        '/** Auto-generated from reference/Item.cfg — do not edit. Run: node multiplayer/server/scripts/gen-olympia-item-stats.mjs */',
        'export interface OlympiaItemStats {',
        '    equipPos: number;',
        '    effectType: number;',
        '    effectValues: readonly [number, number, number, number, number, number];',
        '    maxLifeSpan: number;',
        '    weight: number;',
        '    speed: number;',
        '    levelLimit: number;',
        '}',
        '',
        'export const OLYMPIA_ITEM_STATS: Record<number, OlympiaItemStats> = {',
        ...entries,
        '};',
        '',
    ].join('\n');

    fs.writeFileSync(outPath, ts, 'utf8');
    console.log(`[gen-olympia-item-stats] Wrote ${rows.length} items → ${outPath}`);
}

main();
