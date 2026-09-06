import type { Scene } from 'phaser';

import { LOAD_MAP_ASSETS_ON_DEMAND } from '../Config';
import { ASSETS, AssetType, Minimap, type AssetData } from '../constants/Assets';
import { HBSpriteFile } from '../game/assets/HBSprite';
import { HBMap } from '../game/assets/HBMap';
import { getBinaryBuffer, setMap } from './RegistryUtils';
import { isTreeSpriteIndex } from './SpriteUtils';
import { enqueueSpriteDecode, fetchGameAssetArrayBuffer } from './SpriteHttpLoader';
import { catalogAmdFileName } from './mapCatalogLookup';
import { localTileSheetIndices } from './tileSheetFilter';
import {
    initialFocusStreamRect,
    type MapTileRect,
} from './mapViewportStream';

const tilePackLoadPromisesByScene = new WeakMap<Scene, Map<string, Promise<void>>>();
const tilePackShutdownHookRegistered = new WeakSet<Scene>();

function getTilePackPromises(scene: Scene): Map<string, Promise<void>> {
    let m = tilePackLoadPromisesByScene.get(scene);
    if (!m) {
        m = new Map();
        tilePackLoadPromisesByScene.set(scene, m);
    }
    if (!tilePackShutdownHookRegistered.has(scene)) {
        tilePackShutdownHookRegistered.add(scene);
        scene.events.once('shutdown', () => {
            m!.clear();
            tilePackShutdownHookRegistered.delete(scene);
        });
    }
    return m;
}

/** True when map `.amd` and tile `.spr` packs load lazily at GameWorld start. */
export function shouldLoadMapAssetsOnDemand(): boolean {
    return LOAD_MAP_ASSETS_ON_DEMAND;
}

/**
 * Resolve map asset metadata. Prefer the static {@link ASSETS} catalog; if a map is
 * missing there (e.g. barracks floor 2), still allow HTTP load from game-assets/maps.
 */
function getMapAssetByFileName(mapFileName: string): AssetData {
    const withExt = catalogAmdFileName(mapFileName);
    const asset = ASSETS.find(
        (a) => a.assetType === AssetType.MAP && a.fileName.toLowerCase() === withExt.toLowerCase(),
    );
    if (asset) {
        return asset;
    }
    const base = withExt.replace(/\.amd$/i, '');
    console.warn(`[MapAssets] Map '${withExt}' not in ASSETS catalog — loading via HTTP fallback.`);
    return {
        key: `map-${base}`,
        fileName: withExt,
        assetType: AssetType.MAP,
        mapName: base,
        minimap: Minimap.NONE,
    };
}

const sortedTileSpriteAssets: AssetData[] = ASSETS.filter(
    (a) => a.assetType === AssetType.TILE_SPRITE,
).sort((a, b) => (a.tileStartIndex ?? 0) - (b.tileStartIndex ?? 0));

function getTileSpriteAssetForIndex(index: number): AssetData {
    let chosen: AssetData | undefined;
    for (const a of sortedTileSpriteAssets) {
        const start = a.tileStartIndex ?? 0;
        if (start <= index) {
            chosen = a;
        } else {
            break;
        }
    }
    if (!chosen) {
        throw new Error(`[MapAssets] No tile sprite pack covers global tile index ${index}`);
    }
    return chosen;
}

/**
 * Ground and map-object sprite indices inside `rect` (viewport + ring), plus tree-shadow +50.
 * Do not call this without a rect on the load path — a full-map scan plus every `.spr` pack
 * is the previous OOM (Aw Snap 9 on enter).
 */
export function collectRequiredTileIndices(hbMap: HBMap, rect: MapTileRect): Set<number> {
    const indices = new Set<number>();
    for (let y = rect.minY; y <= rect.maxY; y++) {
        for (let x = rect.minX; x <= rect.maxX; x++) {
            const tile = hbMap.getTile(x, y);
            if (!tile) {
                continue;
            }
            if (tile.sprite >= 0) {
                indices.add(tile.sprite);
            }
            if (tile.objectSprite > 0) {
                indices.add(tile.objectSprite);
            }
        }
    }
    for (const idx of [...indices]) {
        if (isTreeSpriteIndex(idx)) {
            indices.add(idx + 50);
        }
    }
    return indices;
}

export function resolveTileSpriteAssets(indices: Set<number>): AssetData[] {
    const byKey = new Map<string, AssetData>();
    for (const idx of indices) {
        const asset = getTileSpriteAssetForIndex(idx);
        byKey.set(asset.key, asset);
    }
    return [...byKey.values()];
}

async function ensureTileSpriteSheets(scene: Scene, asset: AssetData, globalIndices: Set<number>): Promise<void> {
    const start = asset.tileStartIndex ?? 0;
    const locals = localTileSheetIndices(start, asset.key, globalIndices, (idx) => getTileSpriteAssetForIndex(idx).key);
    const missing = locals.filter((local) => !scene.textures.exists(`map-tile-${start + local}`));
    if (missing.length === 0) {
        return;
    }

    const promises = getTilePackPromises(scene);
    const run = async (): Promise<void> => {
        const stillMissing = locals.filter((local) => !scene.textures.exists(`map-tile-${start + local}`));
        if (stillMissing.length === 0) {
            return;
        }
        if (!asset.spriteType) {
            throw new Error(`[MapAssets] Tile asset ${asset.key} is missing spriteType`);
        }
        if (!getBinaryBuffer(scene, asset.key)) {
            const arrayBuffer = await fetchGameAssetArrayBuffer('sprites', asset.fileName);
            scene.cache.binary.add(asset.key, arrayBuffer);
        }
        const hbFile = new HBSpriteFile(
            asset.key,
            asset.spriteType,
            asset.exportFramesAsDataUrls || false,
            asset.tileStartIndex,
        );
        await hbFile.load(scene, { sheetIndices: new Set(stillMissing) });
    };

    const chained = (promises.get(asset.key) ?? Promise.resolve())
        .then(() => enqueueSpriteDecode(run))
        .catch((error) => {
            promises.delete(asset.key);
            throw error;
        });
    promises.set(asset.key, chained.then(() => undefined, () => undefined));
    return chained;
}

export interface PrepareMapOptions {
    /** Player spawn cell; stream packs around this instead of every index on the .amd. */
    focusTileX?: number;
    focusTileY?: number;
}

/**
 * Loads tile `.spr` packs referenced by `rect` only. Safe to call again as the camera moves.
 * Packs decode sequentially — parallel objects*.spr + trees + shadows OOMs enter on ~2GB Chrome.
 */
export async function loadTileSpritePacksForMapRect(
    scene: Scene,
    hbMap: HBMap,
    rect: MapTileRect,
): Promise<number> {
    const indices = collectRequiredTileIndices(hbMap, rect);
    const tileAssets = resolveTileSpriteAssets(indices);
    for (const asset of tileAssets) {
        await ensureTileSpriteSheets(scene, asset, indices);
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return tileAssets.length;
}

/**
 * Fetches the map binary, parses it, loads tile packs for the spawn viewport only, and registers the map.
 */
export async function prepareMapForGameWorld(
    scene: Scene,
    mapFileName: string,
    options?: PrepareMapOptions,
): Promise<HBMap> {
    const startedAt = performance.now();
    const mapAsset = getMapAssetByFileName(mapFileName);
    const mapKey = mapAsset.key;

    const buffer = await fetchGameAssetArrayBuffer('maps', mapAsset.fileName);

    const map = new HBMap(mapKey);
    map.loadFromBuffer(buffer);

    const focusX = options?.focusTileX != null && options.focusTileX >= 0 ? options.focusTileX : 0;
    const focusY = options?.focusTileY != null && options.focusTileY >= 0 ? options.focusTileY : 0;
    const rect = initialFocusStreamRect(focusX, focusY, map.sizeX, map.sizeY);
    const packCount = await loadTileSpritePacksForMapRect(scene, map, rect);

    setMap(scene, mapKey, map);
    const elapsedMs = performance.now() - startedAt;
    console.log(
        `[MapAssets] On-demand map ready: ${mapFileName} (${packCount} viewport tile pack(s), ` +
            `${map.sizeX}x${map.sizeY} world, stream ${rect.minX},${rect.minY}-${rect.maxX},${rect.maxY}) ` +
            `in ${elapsedMs.toFixed(2)}ms`,
    );
    return map;
}
