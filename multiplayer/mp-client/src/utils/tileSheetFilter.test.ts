import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { localTileSheetIndices } from './tileSheetFilter';

describe('localTileSheetIndices', () => {
    it('keeps only sheets in this pack (plaza maptiles1 vs maptiles4)', () => {
        const resolve = (idx: number) => {
            if (idx >= 388) {
                return 'tile-388';
            }
            if (idx >= 320) {
                return 'tile-maptiles4';
            }
            return 'tile-maptiles1';
        };
        assert.deepEqual(
            localTileSheetIndices(0, 'tile-maptiles1', [0, 8, 320, 398], resolve),
            [0, 8],
        );
        assert.deepEqual(
            localTileSheetIndices(320, 'tile-maptiles4', [0, 8, 320, 398], resolve),
            [0],
        );
    });
});
