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

/** Fetches and registers one `.spr` (shared promise per asset key; decode is serialized). */
export function loadSpriteAssetOnDemand(scene: Scene, asset: AssetData): Promise<void> {
    if (asset.assetType !== AssetType.SPRITE) {
        return Promise.resolve();
    }
    if (areSpriteSheetLoaded(scene, asset.key)) {
        return Promise.resolve();
    }
    const existing = spriteLoadPromises.get(asset.key);
    if (existing) {
        return existing;
    }

    const promise = enqueueSpriteDecode(async () => {
        if (areSpriteSheetLoaded(scene, asset.key)) {
            return;
        }
        if (!asset.spriteType) {
            throw new Error(`Sprite asset ${asset.key} is missing spriteType`);
        }
        const arrayBuffer = await fetchGameAssetArrayBuffer('sprites', asset.fileName);
        scene.cache.binary.add(asset.key, arrayBuffer);
        const hbFile = new HBSpriteFile(
            asset.key,
            asset.spriteType,
            asset.exportFramesAsDataUrls === true,
            asset.tileStartIndex,
        );
        await hbFile.load(scene);
    }).catch((error) => {
        spriteLoadPromises.delete(asset.key);
        throw error;
    });

    spriteLoadPromises.set(asset.key, promise);
    return promise;
}

async function decodeAudioIntoCache(
    scene: Scene,
    folder: 'sounds' | 'music',
    cacheKey: string,
    fileName: string,
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
    try {
        const arrayBuffer = await fetchGameAssetArrayBuffer(folder, fileName);
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        scene.cache.audio.add(cacheKey, audioBuffer);
    } catch (error) {
        failedAudioKeys.add(cacheKey);
        console.warn(`[SpriteHttpLoader] Audio ${folder}/${fileName} skipped (will not retry)`, error);
    }
}

/**
 * Decodes one sound into Phaser audio cache if missing.
 * Missing/404 files (and aliases like `magic` → `C5.mp3`) never throw — playback is optional.
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

    const promise = decodeAudioIntoCache(scene, 'sounds', cacheKey, resolved.fileName).finally(() => {
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
