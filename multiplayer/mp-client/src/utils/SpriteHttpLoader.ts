import type { Scene } from 'phaser';

import { AssetType, type AssetData } from '../constants/Assets';
import { HBSpriteFile } from '../game/assets/HBSprite';
import {
    fetchGameAssetArrayBuffer,
    isHtmlAssetBody,
    looksLikeAmdMap,
} from './gameAssetHttp';
import { uniqueNonNegativeInts } from './itemIconSheets';
import { resolveSoundAsset } from './soundAlias';

export { fetchGameAssetArrayBuffer, isHtmlAssetBody, looksLikeAmdMap };

let spriteDecodeChain: Promise<void> = Promise.resolve();
const spriteLoadPromises = new Map<string, Promise<void>>();
const spriteSheetLoadChains = new Map<string, Promise<void>>();
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

export function areSpriteSheetsPresent(
    scene: Scene,
    assetKey: string,
    sheetIndices: readonly number[],
): boolean {
    return sheetIndices.every((index) => scene.textures.exists(`${assetKey}-${index}`));
}

/**
 * Decode only the listed local sheets (keeps the `.spr` in cache). Never dumps every
 * frame as a PNG data URL — that path OOMs F5 Char / F6 bag on live Canvas Chrome.
 */
export function loadSpriteSheetsOnDemand(
    scene: Scene,
    asset: AssetData,
    sheetIndices: readonly number[],
): Promise<void> {
    if (asset.assetType !== AssetType.SPRITE || !asset.spriteType) {
        return Promise.resolve();
    }
    const wanted = uniqueNonNegativeInts(sheetIndices);
    if (wanted.length === 0 || areSpriteSheetsPresent(scene, asset.key, wanted)) {
        return Promise.resolve();
    }

    const run = async (): Promise<void> => {
        const still = wanted.filter((index) => !scene.textures.exists(`${asset.key}-${index}`));
        if (still.length === 0) {
            return;
        }
        if (!scene.cache.binary.get(asset.key)) {
            const arrayBuffer = await fetchGameAssetArrayBuffer('sprites', asset.fileName);
            scene.cache.binary.add(asset.key, arrayBuffer);
        }
        const hbFile = new HBSpriteFile(asset.key, asset.spriteType, false, asset.tileStartIndex);
        await hbFile.load(scene, { sheetIndices: new Set(still) });
    };

    const chained = (spriteSheetLoadChains.get(asset.key) ?? Promise.resolve())
        .then(() => enqueueSpriteDecode(run))
        .catch((error) => {
            spriteSheetLoadChains.delete(asset.key);
            throw error;
        });
    spriteSheetLoadChains.set(
        asset.key,
        chained.then(
            () => undefined,
            () => undefined,
        ),
    );
    return chained;
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
