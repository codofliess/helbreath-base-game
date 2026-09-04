/**
 * Static guards so live `pnpm build` cannot silently reintroduce Chrome OOM
 * (Aw Snap 9) on map enter: preload-all-maps or full-world minimap capture.
 *
 *   node scripts/assert-live-client-memory.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(cond, message) {
    if (!cond) {
        failures.push(message);
    }
}

const config = read('src/Config.ts');
const mapManager = read('src/utils/MapManager.ts');
const mapAssets = read('src/utils/MapAssets.ts');
const loadingScreen = read('src/game/scenes/LoadingScreen.ts');
const prodVite = read('vite/config.prod.mjs');
const viteEnv = read('src/vite-env.d.ts');

assert(
    /export const LOAD_MAP_ASSETS_ON_DEMAND = true;/.test(config),
    'LOAD_MAP_ASSETS_ON_DEMAND must stay true so live does not preload every .amd / tile .spr',
);

assert(
    !/export const GENERATE_MINIMAP\s*=\s*true/.test(config),
    'GENERATE_MINIMAP must not be hardcoded true (full-world snapshot OOMs live Chrome)',
);

assert(
    /export const GENERATE_MINIMAP = isViteFlagOn\(import\.meta\.env\.VITE_GENERATE_MINIMAP\)/.test(
        config,
    ),
    'GENERATE_MINIMAP must be gated on VITE_GENERATE_MINIMAP via isViteFlagOn',
);

assert(
    /readonly VITE_GENERATE_MINIMAP\?: string;/.test(viteEnv),
    'vite-env.d.ts must declare VITE_GENERATE_MINIMAP',
);

assert(
    /import\.meta\.env\.VITE_GENERATE_MINIMAP/.test(prodVite) &&
        /process\.env\.VITE_GENERATE_MINIMAP \|\| ''/.test(prodVite),
    'vite/config.prod.mjs must default VITE_GENERATE_MINIMAP to empty (off) unless the operator sets it',
);

assert(
    /shouldGenerateMinimap/.test(mapManager) &&
        /GENERATE_MINIMAP && catalogMinimap === Minimap\.ON_DEMAND_GENERATED/.test(mapManager),
    'MapManager must only full-world-capture when GENERATE_MINIMAP and ON_DEMAND_GENERATED',
);

assert(
    /Minimap\.NONE/.test(mapManager) && /Skipping full-world minimap snapshot/.test(mapManager),
    'MapManager must skip ON_DEMAND capture without hanging the minimap HUD',
);

assert(
    /isTreeSpriteIndex\(idx\)/.test(mapAssets) && /indices\.add\(idx \+ 50\)/.test(mapAssets),
    'MapAssets must still pull tree-shadow tile indices (tree + 50) on the on-demand path',
);

assert(
    /export async function prepareMapForGameWorld/.test(mapAssets) &&
        /resolveTileSpriteAssets\(collectRequiredTileIndices\(map\)\)/.test(mapAssets),
    'prepareMapForGameWorld must load only required tile packs for the current map',
);

assert(
    /a\.assetType !== AssetType\.MAP && a\.assetType !== AssetType\.TILE_SPRITE/.test(loadingScreen),
    'LoadingScreen must omit MAP and TILE_SPRITE assets when LOAD_MAP_ASSETS_ON_DEMAND is on',
);

assert(
    /if \(!LOAD_MAP_ASSETS_ON_DEMAND\)/.test(loadingScreen),
    'LoadingScreen must not unpack all maps when on-demand is on',
);

if (failures.length > 0) {
    console.error('[assert-live-client-memory] FAILED:');
    for (const f of failures) {
        console.error(`  - ${f}`);
    }
    process.exit(1);
}

console.log('[assert-live-client-memory] OK — live on-demand maps + minimap capture off by default');
