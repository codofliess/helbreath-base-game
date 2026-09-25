import { fetchGameAssetArrayBuffer } from '../../utils/gameAssetHttp';
import { sliceSprSheets, type SprSheetFrameMeta, type SprSheetSlice } from '../../utils/sprSheetSlice';
import type { SelectCharAvatarLayer, SelectCharAvatarLook } from './selectCharAvatarLook';

interface CachedSheet {
    image: HTMLImageElement;
    frames: SprSheetFrameMeta[];
}

const sheetCache = new Map<string, Promise<CachedSheet | undefined>>();

function sheetCacheKey(spriteName: string, sheetIndex: number): string {
    return `${spriteName}:${sheetIndex}`;
}

function applyMultiplyTint(src: HTMLCanvasElement, tintRgb: number): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d');
    if (!ctx) {
        return src;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `#${tintRgb.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    return out;
}

function loadImageFromPng(png: Uint8Array): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const blob = new Blob([png], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('png decode failed'));
        };
        img.src = url;
    });
}

async function loadSheet(spriteName: string, sheetIndex: number): Promise<CachedSheet | undefined> {
    const key = sheetCacheKey(spriteName, sheetIndex);
    const existing = sheetCache.get(key);
    if (existing) {
        return existing;
    }
    const pending = (async () => {
        try {
            const buffer = await fetchGameAssetArrayBuffer('sprites', `${spriteName}.spr`);
            const slices = sliceSprSheets(buffer, new Set([sheetIndex]));
            const slice: SprSheetSlice | undefined = slices.find((s) => s.sheetIndex === sheetIndex) ?? slices[0];
            if (!slice || slice.png.byteLength < 8) {
                return undefined;
            }
            const image = await loadImageFromPng(slice.png);
            return { image, frames: slice.frames };
        } catch {
            return undefined;
        }
    })();
    sheetCache.set(key, pending);
    return pending;
}

function extractFrame(sheet: CachedSheet, frameIndex: number): HTMLCanvasElement | undefined {
    const frames = sheet.frames;
    if (frames.length === 0) {
        return undefined;
    }
    const safe = Math.max(0, Math.min(frames.length - 1, frameIndex));
    const frame = frames[safe];
    if (!frame || frame.width <= 0 || frame.height <= 0) {
        return undefined;
    }
    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return undefined;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
        sheet.image,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        0,
        0,
        frame.width,
        frame.height,
    );
    return canvas;
}

/**
 * Draws idle-south layers into `dest` using the same .spr frames as F5 / SELECTCHAR.
 * Feet sit near the bottom-center of the canvas.
 */
export async function composeSelectCharAvatar(
    dest: HTMLCanvasElement,
    look: SelectCharAvatarLook,
): Promise<boolean> {
    const loaded: Array<{ layer: SelectCharAvatarLayer; canvas: HTMLCanvasElement; pivotX: number; pivotY: number }> =
        [];
    for (const layer of look.layers) {
        const sheet = await loadSheet(layer.spriteName, layer.sheetIndex);
        if (!sheet) {
            continue;
        }
        let frame = extractFrame(sheet, layer.frameIndex);
        if (!frame) {
            continue;
        }
        if (layer.tint !== undefined) {
            frame = applyMultiplyTint(frame, layer.tint);
        }
        const meta = sheet.frames[Math.max(0, Math.min(sheet.frames.length - 1, layer.frameIndex))];
        loaded.push({
            layer,
            canvas: frame,
            pivotX: meta?.pivotX ?? 0,
            pivotY: meta?.pivotY ?? 0,
        });
    }
    if (loaded.length === 0) {
        return false;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const row of loaded) {
        const left = row.pivotX;
        const top = row.pivotY;
        minX = Math.min(minX, left);
        minY = Math.min(minY, top);
        maxX = Math.max(maxX, left + row.canvas.width);
        maxY = Math.max(maxY, top + row.canvas.height);
    }
    const srcW = Math.max(1, maxX - minX);
    const srcH = Math.max(1, maxY - minY);
    const pad = 4;
    const outW = dest.width;
    const outH = dest.height;
    const scale = Math.min((outW - pad * 2) / srcW, (outH - pad * 2) / srcH);
    const ctx = dest.getContext('2d');
    if (!ctx) {
        return false;
    }
    ctx.clearRect(0, 0, outW, outH);
    ctx.imageSmoothingEnabled = false;
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const originX = (outW - drawW) / 2 - minX * scale;
    const originY = outH - pad - drawH - minY * scale;
    for (const row of loaded) {
        ctx.drawImage(
            row.canvas,
            originX + row.pivotX * scale,
            originY + row.pivotY * scale,
            row.canvas.width * scale,
            row.canvas.height * scale,
        );
    }
    return true;
}
