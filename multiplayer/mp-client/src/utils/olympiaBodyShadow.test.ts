import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    OLYMPIA_SHADOW_DARKEN_ALPHA,
    olympiaShadowDest,
    rasterizeOlympiaBodyShadow,
} from './olympiaBodyShadow';

/**
 * `wm.spr` idle-south sheet 4 frame 0 (measured from the pack).
 * Body top is pivotY. Feet are pivotY + height.
 */
const WM_IDLE_SOUTH = { width: 26, height: 63, pivotX: -13, pivotY: -57 };

describe('olympiaShadowDest', () => {
    it('matches PutShadowSprite integer division for the idle-south body', () => {
        // Top of the head, center column. C++: (0 - 63) / 3 = -21, (0+63+63)/3 = 42.
        const head = olympiaShadowDest(13, 0, WM_IDLE_SOUTH.height, WM_IDLE_SOUTH.pivotX, WM_IDLE_SOUTH.pivotY);
        assert.deepEqual(head, { x: -21, y: -15 });

        // Lowest sampled row (iy = 60). (60-63)/3 = -1, so x = -13+13-1.
        // Lands on the feet, not back up at the head.
        const feet = olympiaShadowDest(13, 60, WM_IDLE_SOUTH.height, WM_IDLE_SOUTH.pivotX, WM_IDLE_SOUTH.pivotY);
        assert.deepEqual(feet, { x: -1, y: 5 });

        const bodyTop = WM_IDLE_SOUTH.pivotY;
        const bodyBottom = WM_IDLE_SOUTH.pivotY + WM_IDLE_SOUTH.height;
        assert.ok(head.y > bodyTop + 20);
        assert.ok(feet.y >= bodyBottom - 2);
        assert.ok(feet.y < bodyBottom + 2);
    });

    it('truncates negative division toward zero, not toward -infinity', () => {
        // (0 - 10) / 3 is -3 in C++, -4 if floored.
        const point = olympiaShadowDest(0, 0, 10, 0, 0);
        assert.equal(point.x, Math.trunc((0 - 10) / 3));
        assert.equal(point.x, -3);
    });
});

describe('rasterizeOlympiaBodyShadow', () => {
    it('keeps the shadow on the ground under the feet and darkens by one quarter', () => {
        const width = 4;
        const height = 12;
        const pivotX = -2;
        const pivotY = -10;
        const source = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < width * height; i += 1) {
            source[i * 4 + 3] = 255;
        }

        const stamp = rasterizeOlympiaBodyShadow(width, height, pivotX, pivotY, source);
        assert.ok(stamp);

        const bodyTop = pivotY;
        const bodyBottom = pivotY + height;
        // The squashed shadow starts well below the head.
        assert.ok(stamp.originY >= bodyTop + Math.floor(height / 2));
        assert.ok(stamp.originY + stamp.height <= bodyBottom + 1);

        let maxAlpha = 0;
        for (let i = 3; i < stamp.rgba.length; i += 4) {
            maxAlpha = Math.max(maxAlpha, stamp.rgba[i]);
        }
        assert.equal(maxAlpha, Math.round(255 * OLYMPIA_SHADOW_DARKEN_ALPHA));
    });

    it('samples every third source row only', () => {
        const width = 1;
        const height = 6;
        const source = new Uint8ClampedArray(width * height * 4);
        source[0 * 4 + 3] = 255; // iy 0, sampled
        source[1 * 4 + 3] = 255; // iy 1, skipped
        source[3 * 4 + 3] = 255; // iy 3, sampled

        const stamp = rasterizeOlympiaBodyShadow(width, height, 0, 0, source);
        assert.ok(stamp);
        let opaque = 0;
        for (let i = 3; i < stamp.rgba.length; i += 4) {
            if (stamp.rgba[i] > 0) {
                opaque += 1;
            }
        }
        assert.equal(opaque, 2);
    });
});
