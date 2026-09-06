import type { Scene } from 'phaser';

import { AssetType, type AssetData } from '../constants/Assets';
import { HBSpriteFile } from '../game/assets/HBSprite';
import {
    fetchGameAssetArrayBuffer,
    isHtmlAssetBody,
    looksLikeAmdMap,
} from './gameAssetHttp';
import { resolveSoundAsset } from './soundAlias';

export { fetchGameAssetArrayBuffer, isHtmlAssetBody, looksLikeAmdMap };

let spriteDecodeChain: Promise<void> = Promise.resolve();
const spriteLoadPromises = new Map<string, Promise<void>>();
const soundLoadPromises = new Map<string, Promise<void>>();
const musicLoadPromises = new Map<string, Promise<void>>();
const failedAudioKeys = new Set<string>();

export interface LoadSpriteOnDemandOptions {
    /** Decode only these local sheet indexes. Omit to decode the whole `.spr`. */
    sheetIndices?: ReadonlySet<number>;
}

/**
 * Runs sprite decode/register work one-at-a-time. Parallel `HBSpriteFile.load`
 * of item/effect/tile packs is a known Chrome Aw Snap 9 (OOM) spike on live enter.
 */
export function enqueueSpriteDecode<T>(work: () => Promise<T>): Promise<T> {
    const run = spriteDecodeChain.then(work, work);
    spriteDecodeChain = run.then(
        () => undefined,
        () => undefined,
    );
    return run;
}

/** True when sheet 0 for this asset key is registered (load finished enough to draw). */
export function areSpriteSheetLoaded(scene: Scene, assetKey: string): boolean {
    return scene.textures.exists(`${assetKey}-0`);
}

/** True when every requested local sheet exists as `assetKey-{n}`. */
export function areSpriteSheetsLoaded(
    scene: Scene,
    assetKey: string,
    sheetIndices?: ReadonlySet<number>,
): boolean {
    if (!sheetIndices || sheetIndices.size === 0) {
        return areSpriteSheetLoaded(scene, assetKey);
    }
    for (const index of sheetIndices) {
        if (!scene.textures.exists(`${assetKey}-${index}`)) {
            return false;
        }
    }
    return true;
}

function listSceneTextureKeys(scene: Scene): string[] {
    const textures = scene.textures as {
        getTextureKeys?: () => string[];
        list?: Record<string, unknown>;
    };
    if (typeof textures.getTextureKeys === 'function') {
        return textures.getTextureKeys();
    }
    return Object.keys(textures.list ?? {});
}

/**
 * Drops Canvas textures + Phaser animations for one sprite cache key outside the keep-set.
 */
export function evictSpriteSheetTextures(
    scene: Scene,
    assetKey: string,
    keepLocalSheets: ReadonlySet<number>,
): number {
    const prefix = `${assetKey}-`;
    let removed = 0;
    for (const key of listSceneTextureKeys(scene)) {
        if (!key.startsWith(prefix) || !/^\d+$/.test(key.slice(prefix.length))) {
            continue;
        }
        const local = Number(key.slice(prefix.length));
        if (keepLocalSheets.has(local)) {
            continue;
        }
        try {
            if (scene.textures.exists(key)) {
                scene.textures.remove(key);
            }
            if (scene.anims.exists(key)) {
                scene.anims.remove(key);
            }
            scene.registry.remove(`pivots-${key}`);
            removed += 1;
        } catch (error) {
            console.warn(`[SpriteHttpLoader] Failed to evict ${key}`, error);
        }
    }
    return removed;
}

/**
 * Fetches and registers one `.spr` (shared promise per asset+sheets; decode is serialized).
 * Never dumps every frame as a PNG data URL — that OOMs the live Canvas hub / pad enter.
 */
export function loadSpriteAssetOnDemand(
    scene: Scene,
    asset: AssetData,
    options?: LoadSpriteOnDemandOptions,
): Promise<void> {
    if (asset.assetType !== AssetType.SPRITE) {
        return Promise.resolve();
    }
    const sheetIndices = options?.sheetIndices;
    if (areSpriteSheetsLoaded(scene, asset.key, sheetIndices)) {
        return Promise.resolve();
    }
    const promiseKey = sheetIndices
        ? `${asset.key}:${[...sheetIndices].sort((a, b) => a - b).join(',')}`
        : `${asset.key}:all`;
    const existing = spriteLoadPromises.get(promiseKey);
    if (existing) {
        return existing;
    }

    const promise = enqueueSpriteDecode(async () => {
        if (areSpriteSheetsLoaded(scene, asset.key, sheetIndices)) {
            return;
        }
        if (!asset.spriteType) {
            throw new Error(`Sprite asset ${asset.key} is missing spriteType`);
        }
        if (!scene.cache.binary.exists(asset.key)) {
            const arrayBuffer = await fetchGameAssetArrayBuffer('sprites', asset.fileName);
            scene.cache.binary.add(asset.key, arrayBuffer);
        }
        const hbFile = new HBSpriteFile(
            asset.key,
            asset.spriteType,
            false,
            asset.tileStartIndex,
        );
        await hbFile.load(scene, sheetIndices ? { sheetIndices } : undefined);
    }).catch((error) => {
        spriteLoadPromises.delete(promiseKey);
        throw error;
    });

    spriteLoadPromises.set(promiseKey, promise);
    return promise;
}

async function decodeAudioIntoCache(
    scene: Scene,
    folder: 'sounds' | 'music',
    cacheKey: string,
    fileName: string,
    fallbackFileName?: string,
): Promise<void> {
    if (failedAudioKeys.has(cacheKey) || scene.cache.audio.exists(cacheKey)) {
        return;
    }
    const soundManager = scene.sound as { context?: AudioContext };
    const audioContext = soundManager.context;
    if (!audioContext) {
        console.warn(`[SpriteHttpLoader] No audio context, skipping ${fileName}`);
        return;
    }
    const names =
        fallbackFileName && fallbackFileName !== fileName ? [fileName, fallbackFileName] : [fileName];
    let lastError: unknown;
    for (const name of names) {
        try {
            const arrayBuffer = await fetchGameAssetArrayBuffer(folder, name);
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
            scene.cache.audio.add(cacheKey, audioBuffer);
            return;
        } catch (error) {
            lastError = error;
        }
    }
    failedAudioKeys.add(cacheKey);
    console.warn(`[SpriteHttpLoader] Audio ${folder}/${fileName} skipped (will not retry)`, lastError);
}

/**
 * Decodes one sound into Phaser audio cache if missing.
 * Missing/404 files never throw. `magic.mp3` is optional and falls back to C5.
 */
export function loadSoundAssetOnDemand(scene: Scene, key: string, fileName: string): Promise<void> {
    const resolved = resolveSoundAsset(fileName || key);
    const cacheKey = resolved.cacheKey;
    if (scene.cache.audio.exists(cacheKey) || failedAudioKeys.has(cacheKey)) {
        return Promise.resolve();
    }
    const existing = soundLoadPromises.get(cacheKey);
    if (existing) {
        return existing;
    }

    const promise = decodeAudioIntoCache(
        scene,
        'sounds',
        cacheKey,
        resolved.fileName,
        resolved.fallbackFileName,
    ).finally(() => {
        soundLoadPromises.delete(cacheKey);
    });

    soundLoadPromises.set(cacheKey, promise);
    return promise;
}

/** Decodes one music track into Phaser audio cache if missing. Failures are non-blocking. */
export function loadMusicAssetOnDemand(scene: Scene, key: string, fileName: string): Promise<void> {
    const cacheKey = key.replace(/\.mp3$/i, '');
    const safeName = fileName.endsWith('.mp3') ? fileName : `${cacheKey}.mp3`;
    if (scene.cache.audio.exists(cacheKey) || failedAudioKeys.has(cacheKey)) {
        return Promise.resolve();
    }
    const existing = musicLoadPromises.get(cacheKey);
    if (existing) {
        return existing;
    }

    const promise = decodeAudioIntoCache(scene, 'music', cacheKey, safeName).finally(() => {
        musicLoadPromises.delete(cacheKey);
    });

    musicLoadPromises.set(cacheKey, promise);
    return promise;
}
