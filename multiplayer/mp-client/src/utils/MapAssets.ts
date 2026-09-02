import type { Scene } from 'phaser';

import { LOAD_MAP_ASSETS_ON_DEMAND } from '../Config';
import { ASSETS, AssetType, Minimap, type AssetData } from '../constants/Assets';
import { HBSpriteFile } from '../game/assets/HBSprite';
import { HBMap } from '../game/assets/HBMap';
import { setMap } from './RegistryUtils';
import { isTreeSpriteIndex } from './SpriteUtils';
import {
    collectSpriteIndicesInRect,
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
 * Server world id `traveler` uses Helbreath file `default.amd`.
 * Accepts `default`, `default.amd`, `traveler`, or `traveler.amd`.
 */
export function toClientMapFileName(mapName: string, gameWorldId?: string): string {
    const raw = (mapName || gameWorldId || '').trim();
    let id = raw;
    if (id.toLowerCase().startsWith('map-')) {
        id = id.slice(4);
    }
    if (id.toLowerCase().endsWith('.amd')) {
        id = id.slice(0, -4);
    }
    const base = id.toLowerCase() === 'traveler' || id === '' ? 'default' : id;
    return `${base}.amd`;
}

function isHtmlArrayBuffer(buffer: ArrayBuffer): boolean {
    const bytes = new Uint8Array(buffer.slice(0, 64));
    const head = String.fromCharCode(...bytes).replace(/^\uFEFF/, '').trimStart().toLowerCase();
    return head.startsWith('<!doctype') || head.startsWith('<html');
}

/**
 * Fetch a Helbreath binary. Local Vite serves `public/assets`; live CF uses `/game-assets`.
 * Rejects SPA `index.html` so `.amd` is never parsed as HTML (0×0 map).
 */
async function fetchHelbreathBinary(kind: 'maps' | 'sprites' | 'sounds' | 'music', fileName: string): Promise<ArrayBuffer> {
    const paths = [`/assets/${kind}/${fileName}`, `/game-assets/${kind}/${fileName}`];
    let lastError: Error | undefined;
    for (const url of paths) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                lastError = new Error(`${url}: ${response.status} ${response.statusText}`);
                continue;
            }
            const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
            const buffer = await response.arrayBuffer();
            if (contentType.includes('text/html') || isHtmlArrayBuffer(buffer)) {
                lastError = new Error(`${url}: got HTML instead of binary (SPA fallback)`);
                continue;
            }
            if (buffer.byteLength < 16) {
                lastError = new Error(`${url}: empty or tiny body (${buffer.byteLength} bytes)`);
                continue;
            }
            return buffer;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }
    throw lastError ?? new Error(`[MapAssets] Failed to fetch ${kind}/${fileName}`);
}

/**
 * Resolve map asset metadata. Prefer the static {@link ASSETS} catalog; if a map is
 * missing there (e.g. barracks floor 2), still allow HTTP load from assets/maps.
 */
function getMapAssetByFileName(mapFileName: string): AssetData {
    const normalized = toClientMapFileName(mapFileName);
    const asset = ASSETS.find(
        (a) => a.assetType === AssetType.MAP && a.fileName === normalized,
    );
    if (asset) {
        return asset;
    }
    const base = normalized.replace(/\.amd$/i, '');
    console.warn(`[MapAssets] Map '${normalized}' not in ASSETS catalog — loading via HTTP fallback.`);
    return {
        key: `map-${base}`,
        fileName: normalized,
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
 * is the previous OOM (Aw Snap 9 on "Loading map").
 */
export function collectRequiredTileIndices(hbMap: HBMap, rect: MapTileRect): Set<number> {
    return collectSpriteIndicesInRect(hbMap.tiles, rect, isTreeSpriteIndex);
}

export function resolveTileSpriteAssets(indices: Set<number>): AssetData[] {
    const byKey = new Map<string, AssetData>();
    for (const idx of indices) {
        const asset = getTileSpriteAssetForIndex(idx);
        byKey.set(asset.key, asset);
    }
    return [...byKey.values()];
}

async function loadTileSpritePackOnce(scene: Scene, asset: AssetData): Promise<void> {
    const promises = getTilePackPromises(scene);
    const existing = promises.get(asset.key);
    if (existing) {
        return existing;
    }

    const start = asset.tileStartIndex ?? 0;
    if (scene.textures.exists(`map-tile-${start}`)) {
        return Promise.resolve();
    }

    const promise = (async () => {
        if (!asset.spriteType) {
            throw new Error(`[MapAssets] Tile asset ${asset.key} is missing spriteType`);
        }
        const arrayBuffer = await fetchHelbreathBinary('sprites', asset.fileName);
        scene.cache.binary.add(asset.key, arrayBuffer);
        const hbFile = new HBSpriteFile(
            asset.key,
            asset.spriteType,
            asset.exportFramesAsDataUrls || false,
            asset.tileStartIndex,
        );
        await hbFile.load(scene);
    })().catch((error) => {
        promises.delete(asset.key);
        throw error;
    });

    promises.set(asset.key, promise);
    return promise;
}

export async function fetchHelbreathGameAsset(
    kind: 'maps' | 'sprites' | 'sounds' | 'music',
    fileName: string,
): Promise<ArrayBuffer> {
    return fetchHelbreathBinary(kind, fileName);
}

export interface PrepareMapOptions {
    /** Player spawn cell; stream packs around this instead of every index on the .amd. */
    focusTileX?: number;
    focusTileY?: number;
}

/**
 * Loads tile `.spr` packs referenced by `rect` only. Safe to call again as the camera moves.
 */
export async function loadTileSpritePacksForMapRect(
    scene: Scene,
    hbMap: HBMap,
    rect: MapTileRect,
): Promise<number> {
    const tileAssets = resolveTileSpriteAssets(collectRequiredTileIndices(hbMap, rect));
    await Promise.all(tileAssets.map((a) => loadTileSpritePackOnce(scene, a)));
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
    const buffer = await fetchHelbreathBinary('maps', mapAsset.fileName);

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
