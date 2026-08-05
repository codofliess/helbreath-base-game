/**
 * Olympia-style mouse cursor presentation for the CSS custom cursor.
 *
 * Helbreath draws `interface.spr` sheet 0 with PutSpriteFast(msX, msY, frame):
 * image top-left = (msX + pivotX, msY + pivotY), so CSS hotspot = (-pivotX, -pivotY).
 * Frame 4/5 (cast) use pivot (0,0) — tip of the small arrow at top-left of the circle.
 */

import {
    CURSOR_ATTACK,
    CURSOR_CAST_READY,
    CURSOR_CASTING,
    CURSOR_GRAB_1,
    CURSOR_GRAB_2,
    CURSOR_POINTER,
} from '../constants/SpriteKeys';

/** ~50% larger than native interface.spr frames (user: Olympia cursor feels bigger). */
export const CURSOR_DISPLAY_SCALE = 1.5;

/**
 * Pivot X/Y from interface.spr sheet 0 (same order as SpriteKeys CURSOR_* frames).
 * Helbreath brush pvx/pvy for PutSpriteFast.
 */
const CURSOR_PIVOTS: Record<string, { px: number; py: number }> = {
    [CURSOR_POINTER]: { px: -1, py: -1 },
    [CURSOR_GRAB_1]: { px: -4, py: -7 },
    [CURSOR_GRAB_2]: { px: -1, py: -2 },
    [CURSOR_ATTACK]: { px: -2, py: -1 },
    [CURSOR_CASTING]: { px: 0, py: 0 },
    [CURSOR_CAST_READY]: { px: 0, py: 0 },
    // Extra frames (FOE blue / grey / etc.) if ever wired
    'sprite-interface-0-6': { px: -1, py: -1 },
    'sprite-interface-0-7': { px: -2, py: -1 },
    'sprite-interface-0-8': { px: 1, py: -7 },
};

export type CombatCursorMode = 'peace' | 'attack' | 'safe';

/** Dock-aligned combat mode tint colors for cast-prep cursor. */
const MODE_TINT: Record<CombatCursorMode, { r: number; g: number; b: number }> = {
    // Peace = cool grey (dock grey)
    peace: { r: 200, g: 198, b: 190 },
    // Attack = terracotta / red
    attack: { r: 232, g: 88, b: 64 },
    // Safe = gold
    safe: { r: 240, g: 200, b: 64 },
};

const scaledCache = new Map<string, string>();
const tintedCache = new Map<string, string>();

function clampHotspot(v: number, max: number): number {
    return Math.max(0, Math.min(max, Math.round(v)));
}

/**
 * CSS hotspot for a cursor key at the given display scale.
 * Arrow tip (cast frames pivot 0,0) stays on the mouse aim point.
 */
export function getCursorHotspot(
    key: string,
    imageWidth: number,
    imageHeight: number,
    scale: number = CURSOR_DISPLAY_SCALE,
): { x: number; y: number } {
    const piv = CURSOR_PIVOTS[key] ?? { px: 0, py: 0 };
    // Hotspot in unscaled frame space = (-pvx, -pvy); then scale with the image.
    const x = clampHotspot(-piv.px * scale, Math.max(0, imageWidth - 1));
    const y = clampHotspot(-piv.py * scale, Math.max(0, imageHeight - 1));
    return { x, y };
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('cursor image load failed'));
        img.src = dataUrl;
    });
}

/** Upscale cursor PNG with nearest-neighbor (pixel art). */
export async function scaleCursorDataUrl(
    dataUrl: string,
    scale: number = CURSOR_DISPLAY_SCALE,
): Promise<{ dataUrl: string; width: number; height: number }> {
    const cacheKey = `${scale}|${dataUrl.length}|${dataUrl.slice(-48)}`;
    const hit = scaledCache.get(cacheKey);
    if (hit) {
        // Decode size from cache by loading once is expensive; store dims in composite key later.
        const img = await loadImage(hit);
        return { dataUrl: hit, width: img.naturalWidth, height: img.naturalHeight };
    }
    const img = await loadImage(dataUrl);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
        return { dataUrl, width: img.naturalWidth, height: img.naturalHeight };
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL('image/png');
    scaledCache.set(cacheKey, out);
    return { dataUrl: out, width: w, height: h };
}

/**
 * Recolor non-transparent pixels toward combat-mode color (preserves alpha / shape).
 * Used while arming a cast so the cursor matches Peace / Attack / Safe.
 */
export async function tintCursorDataUrl(
    dataUrl: string,
    mode: CombatCursorMode,
): Promise<string> {
    const cacheKey = `${mode}|${dataUrl.length}|${dataUrl.slice(-48)}`;
    const hit = tintedCache.get(cacheKey);
    if (hit) {
        return hit;
    }
    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
        return dataUrl;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { r: tr, g: tg, b: tb } = MODE_TINT[mode];
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (a < 8) {
            continue;
        }
        // Luminance of source → multiply onto mode color (keeps edges/shading).
        const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
        // Strong mode color with some source brightness variation.
        const mix = 0.55 + lum * 0.45;
        d[i] = Math.min(255, Math.round(tr * mix));
        d[i + 1] = Math.min(255, Math.round(tg * mix));
        d[i + 2] = Math.min(255, Math.round(tb * mix));
    }
    ctx.putImageData(imageData, 0, 0);
    const out = canvas.toDataURL('image/png');
    tintedCache.set(cacheKey, out);
    return out;
}

export function isCastCursorKey(key: string): boolean {
    return key === CURSOR_CASTING || key === CURSOR_CAST_READY;
}

/**
 * Build full CSS `cursor` value: scaled image + hotspot so the arrow tip tracks aim.
 */
export async function buildCssCursorValue(
    key: string,
    rawDataUrl: string,
    options?: { combatMode?: CombatCursorMode },
): Promise<string> {
    let source = rawDataUrl;
    if (isCastCursorKey(key) && options?.combatMode) {
        source = await tintCursorDataUrl(rawDataUrl, options.combatMode);
    }
    const scaled = await scaleCursorDataUrl(source, CURSOR_DISPLAY_SCALE);
    const hot = getCursorHotspot(key, scaled.width, scaled.height, CURSOR_DISPLAY_SCALE);
    return `url("${scaled.dataUrl}") ${hot.x} ${hot.y}, auto`;
}
