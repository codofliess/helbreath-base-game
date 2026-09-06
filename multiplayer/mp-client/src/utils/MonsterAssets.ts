import type { Scene } from 'phaser';

import { LOAD_MONSTER_ASSETS_ON_DEMAND, MONSTER_PLACEHOLDER_SPRITE } from '../Config';
import { AssetType, getMonsterAssets, type AssetData } from '../constants/Assets';
import { HBSpriteFile } from '../game/assets/HBSprite';
import { idleEntitySheetIndices } from './entitySheetFilter';
import {
    enqueueSpriteDecode,
    evictSpriteSheetTextures,
    fetchGameAssetArrayBuffer,
    loadSoundAssetOnDemand,
} from './SpriteHttpLoader';

const monsterAssetLoadPromises = new Map<string, Promise<void>>();
const assetLoadPromises = new Map<string, Promise<void>>();

/** True when monster assets should be fetched lazily in the current loading mode. */
export function shouldLoadMonsterAssetsOnDemand(): boolean {
    return LOAD_MONSTER_ASSETS_ON_DEMAND;
}

/** True while a decode for this monster basename is queued (idle or extra sheets). */
export function isMonsterAssetLoadInFlight(spriteName: string): boolean {
    for (const key of monsterAssetLoadPromises.keys()) {
        if (key === spriteName || key.startsWith(`${spriteName}:`)) {
            return true;
        }
    }
    return false;
}

function monsterSpriteAssetKey(spriteName: string): string {
    return `sprite-${spriteName}`;
}

/** True when idle sheets 0–7 exist so the body can be shown without combat/death atlases. */
export function areMonsterIdleSheetsLoaded(scene: Scene, spriteName: string): boolean {
    const idle = idleEntitySheetIndices();
    return getMonsterAssets(spriteName)
        .filter((asset) => asset.assetType === AssetType.SPRITE)
        .every((asset) => {
            for (const sheet of idle) {
                if (!scene.textures.exists(`${asset.key}-${sheet}`)) {
                    return false;
                }
            }
            return true;
        });
}

/**
 * Returns true when idle sheets are registered. Combat sheets may still be missing.
 * Callers must not treat this as "the whole `.spr` is in VRAM".
 */
export function areMonsterAssetsLoaded(scene: Scene, spriteName: string): boolean {
    return areMonsterIdleSheetsLoaded(scene, spriteName);
}

export interface LoadMonsterAssetOptions {
    /** Local sheet indexes to decode. Defaults to idle 0–7. */
    sheetIndices?: ReadonlySet<number>;
}

/** Fetches, decodes, and registers monster sprite sheets (idle by default) and sounds. */
export function loadMonsterAssetsOnDemand(
    scene: Scene,
    spriteName: string,
    options?: LoadMonsterAssetOptions,
): Promise<void> {
    if (spriteName === MONSTER_PLACEHOLDER_SPRITE) {
        return Promise.resolve();
    }

    const sheets = options?.sheetIndices ?? idleEntitySheetIndices();
    const promiseKey = `${spriteName}:${[...sheets].sort((a, b) => a - b).join(',')}`;
    const existing = monsterAssetLoadPromises.get(promiseKey);
    if (existing) {
        return existing;
    }

    const promise = loadMonsterAssets(scene, spriteName, sheets)
        .then(() => {
            console.log(`[MonsterAssetLoader] Loaded monster sheets for ${spriteName} (${sheets.size} sheet(s))`);
        })
        .catch((error) => {
            throw error;
        })
        .finally(() => {
            monsterAssetLoadPromises.delete(promiseKey);
        });

    monsterAssetLoadPromises.set(promiseKey, promise);
    return promise;
}

async function loadMonsterAssets(
    scene: Scene,
    spriteName: string,
    sheetIndices: ReadonlySet<number>,
): Promise<void> {
    const assets = getMonsterAssets(spriteName);
    const spriteAssets = assets.filter((asset) => asset.assetType === AssetType.SPRITE);
    const soundAssets = assets.filter((asset) => asset.assetType === AssetType.SOUND && !scene.cache.audio.exists(asset.key));
    const startedAt = performance.now();

    for (const asset of spriteAssets) {
        await loadAssetOnce(scene, asset, sheetIndices);
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    for (const asset of soundAssets) {
        await loadAssetOnce(scene, asset);
    }

    console.log(
        `[MonsterAssetLoader] Registered ${spriteAssets.length} sprites and ${soundAssets.length} sounds for ${spriteName} in ${(performance.now() - startedAt).toFixed(2)}ms`,
    );
}

function loadAssetOnce(
    scene: Scene,
    asset: AssetData,
    sheetIndices?: ReadonlySet<number>,
): Promise<void> {
    if (asset.assetType === AssetType.SOUND) {
        if (scene.cache.audio.exists(asset.key)) {
            return Promise.resolve();
        }
    } else if (sheetIndices) {
        let missing = false;
        for (const sheet of sheetIndices) {
            if (!scene.textures.exists(`${asset.key}-${sheet}`)) {
                missing = true;
                break;
            }
        }
        if (!missing) {
            return Promise.resolve();
        }
    } else if (scene.textures.exists(`${asset.key}-0`)) {
        return Promise.resolve();
    }

    const loadKey = sheetIndices
        ? `${asset.assetType}:${asset.key}:${[...sheetIndices].sort((a, b) => a - b).join(',')}`
        : `${asset.assetType}:${asset.key}`;
    const existing = assetLoadPromises.get(loadKey);
    if (existing) {
        return existing;
    }

    const promise = asset.assetType === AssetType.SPRITE
        ? fetchAndRegisterMonsterSprite(scene, asset, sheetIndices)
        : loadSoundAssetOnDemand(scene, asset.key, asset.fileName);
    assetLoadPromises.set(loadKey, promise);
    return promise.catch((error) => {
        assetLoadPromises.delete(loadKey);
        throw error;
    });
}

async function fetchAndRegisterMonsterSprite(
    scene: Scene,
    asset: AssetData,
    sheetIndices?: ReadonlySet<number>,
): Promise<void> {
    if (!asset.spriteType) {
        throw new Error(`Monster sprite asset ${asset.key} is missing spriteType`);
    }
    const spriteType = asset.spriteType;

    await enqueueSpriteDecode(async () => {
        if (sheetIndices) {
            let allPresent = true;
            for (const sheet of sheetIndices) {
                if (!scene.textures.exists(`${asset.key}-${sheet}`)) {
                    allPresent = false;
                    break;
                }
            }
            if (allPresent) {
                return;
            }
        } else if (scene.textures.exists(`${asset.key}-0`)) {
            return;
        }
        if (!scene.cache.binary.exists(asset.key)) {
            const arrayBuffer = await fetchGameAssetArrayBuffer('sprites', asset.fileName);
            scene.cache.binary.add(asset.key, arrayBuffer);
        }

        const hbFile = new HBSpriteFile(asset.key, spriteType, false, asset.tileStartIndex);
        await hbFile.load(scene, sheetIndices ? { sheetIndices } : undefined);
    });
}

/**
 * Drops combat/death (or all) sheets for a monster that left view.
 * Idle sheets can be kept if another copy is still on-screen.
 */
export function evictMonsterSpriteSheets(
    scene: Scene,
    spriteName: string,
    keepLocalSheets: ReadonlySet<number>,
): number {
    return evictSpriteSheetTextures(scene, monsterSpriteAssetKey(spriteName), keepLocalSheets);
}
