/**
 * Helbreath Olympia body shadow (`CSprite::PutShadowSprite` in `sp-client/reference/Sprite.cpp`).
 *
 * The blit does not draw a tinted copy of the naked body. For every third source row it
 * darkens the ground pixel at:
 *
 *   iSangX = pvx + ix + (iy - szy) / 3
 *   iSangY = pvy + (iy + szy + szy) / 3
 *
 * Integer division matches C++ toward-zero. A normal blend of black at 75% alpha is
 * `dest * 1/4`, the same darken as the 16-bit `(color & mask) >> 2` write.
 */

/** Black alpha that normal-blends to a divide-by-4 darken. */
export const OLYMPIA_SHADOW_DARKEN_ALPHA = 0.75;

export type OlympiaShadowPoint = {
    x: number;
    y: number;
};

export type OlympiaShadowStamp = {
    /** Anchor-space position of the canvas origin. Often negative (pivots sit up-left of the feet). */
    originX: number;
    originY: number;
    width: number;
    height: number;
    /** RGBA. RGB is black. Alpha is `srcAlpha * OLYMPIA_SHADOW_DARKEN_ALPHA`. */
    rgba: Uint8ClampedArray;
};

/** Destination of one source pixel, in the same anchor space as `pvx` / `pvy`. */
export function olympiaShadowDest(
    ix: number,
    iy: number,
    frameHeight: number,
    pivotX: number,
    pivotY: number,
): OlympiaShadowPoint {
    return {
        x: pivotX + ix + Math.trunc((iy - frameHeight) / 3),
        y: pivotY + Math.trunc((iy + frameHeight + frameHeight) / 3),
    };
}

/**
 * Rasterizes the body-frame shadow. `iy` steps by 3, matching the source blit.
 * Returns undefined when the frame has no opaque pixels.
 */
export function rasterizeOlympiaBodyShadow(
    width: number,
    height: number,
    pivotX: number,
    pivotY: number,
    source: Uint8ClampedArray,
): OlympiaShadowStamp | undefined {
    if (width <= 0 || height <= 0 || source.length < width * height * 4) {
        return undefined;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    const hits: Array<{ x: number; y: number; alpha: number }> = [];

    for (let iy = 0; iy < height; iy += 3) {
        const row = iy * width * 4;
        for (let ix = 0; ix < width; ix += 1) {
            const srcAlpha = source[row + ix * 4 + 3];
            if (srcAlpha === 0) {
                continue;
            }
            const dest = olympiaShadowDest(ix, iy, height, pivotX, pivotY);
            const alpha = Math.round(srcAlpha * OLYMPIA_SHADOW_DARKEN_ALPHA);
            if (alpha <= 0) {
                continue;
            }
            hits.push({ x: dest.x, y: dest.y, alpha });
            if (dest.x < minX) {
                minX = dest.x;
            }
            if (dest.y < minY) {
                minY = dest.y;
            }
            if (dest.x > maxX) {
                maxX = dest.x;
            }
            if (dest.y > maxY) {
                maxY = dest.y;
            }
        }
    }

    if (hits.length === 0) {
        return undefined;
    }

    const stampWidth = maxX - minX + 1;
    const stampHeight = maxY - minY + 1;
    const rgba = new Uint8ClampedArray(stampWidth * stampHeight * 4);
    for (let i = 0; i < hits.length; i += 1) {
        const hit = hits[i];
        const offset = ((hit.y - minY) * stampWidth + (hit.x - minX)) * 4;
        // Later samples win only when darker, so overlapping sheared pixels stay solid.
        if (hit.alpha > rgba[offset + 3]) {
            rgba[offset] = 0;
            rgba[offset + 1] = 0;
            rgba[offset + 2] = 0;
            rgba[offset + 3] = hit.alpha;
        }
    }

    return {
        originX: minX,
        originY: minY,
        width: stampWidth,
        height: stampHeight,
        rgba,
    };
}
