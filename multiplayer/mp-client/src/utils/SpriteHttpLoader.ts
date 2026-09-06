import type { Scene } from 'phaser';

import { AssetType, type AssetData } from '../constants/Assets';
import { HBSpriteFile } from '../game/assets/HBSprite';

let spriteDecodeChain: Promise<void> = Promise.resolve();
const spriteLoadPromises = new Map<string, Promise<void>>();
const soundLoadPromises = new Map<string, Promise<void>>();

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

/**
 * Fetches a game binary. Live Hetzner serves packs under `/game-assets/`;
 * Vite/dev and some nginx layouts still use `assets/`.
 * SPA HTML 200s (index.html) must not be treated as `.amd`/`.spr` — that leaves the map registry empty.
 */
export async function fetchGameAssetArrayBuffer(
    folder: 'sprites' | 'maps' | 'sounds' | 'music',
    fileName: string,
): Promise<ArrayBuffer> {
    const safeName = fileName.replace(/^.*[/\\]/, '');
    const candidates = [
        `/game-assets/${folder}/${safeName}`,
        `/assets/${folder}/${safeName}`,
        `assets/${folder}/${safeName}`,
    ];
    let lastStatus = 'no attempt';
    for (const url of candidates) {
        const response = await fetch(url);
        if (!response.ok) {
            lastStatus = `${url} → ${response.status} ${response.statusText}`;
            continue;
        }
        const contentType = response.headers.get('content-type') ?? '';
        const buffer = await response.arrayBuffer();
        if (isHtmlAssetBody(buffer, contentType)) {
            lastStatus = `${url} → HTML SPA fallback (not a binary)`;
            continue;
        }
        if (folder === 'maps' && !looksLikeAmdMap(buffer)) {
            lastStatus = `${url} → not an .amd (missing MAPSIZEX)`;
            continue;
        }
        return buffer;
    }
    throw new Error(`Failed to fetch ${folder}/${safeName} (${lastStatus})`);
}

function isHtmlAssetBody(buffer: ArrayBuffer, contentType: string): boolean {
    const ct = contentType.toLowerCase();
    if (ct.includes('text/html') || ct.includes('application/xhtml')) {
        return true;
    }
    const slice = new Uint8Array(buffer, 0, Math.min(64, buffer.byteLength));
    const head = new TextDecoder('utf-8').decode(slice).trimStart().toLowerCase();
    return head.startsWith('<!doctype') || head.startsWith('<html') || head.startsWith('<head');
}

function looksLikeAmdMap(buffer: ArrayBuffer): boolean {
    const header = new TextDecoder('ascii').decode(new Uint8Array(buffer, 0, Math.min(256, buffer.byteLength)));
    return /MAPSIZEX/i.test(header) && /MAPSIZEY/i.test(header);
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

/** Decodes one sound into Phaser audio cache if missing. */
export function loadSoundAssetOnDemand(scene: Scene, key: string, fileName: string): Promise<void> {
    if (scene.cache.audio.exists(key)) {
        return Promise.resolve();
    }
    const existing = soundLoadPromises.get(key);
    if (existing) {
        return existing;
    }

    const promise = (async () => {
        if (scene.cache.audio.exists(key)) {
            return;
        }
        const soundManager = scene.sound as { context?: AudioContext };
        const audioContext = soundManager.context;
        if (!audioContext) {
            console.warn(`[SpriteHttpLoader] No audio context, skipping ${fileName}`);
            return;
        }
        const arrayBuffer = await fetchGameAssetArrayBuffer('sounds', fileName);
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        scene.cache.audio.add(key, audioBuffer);
    })().catch((error) => {
        soundLoadPromises.delete(key);
        throw error;
    });

    soundLoadPromises.set(key, promise);
    return promise;
}
