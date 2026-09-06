import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseSpriteFrameKey, uniqueSheetIndicesForAsset } from './spriteFrameKey';
import { collectItemIconSheetIndices } from './itemIconSheets';

describe('spriteFrameKey + item icon sheets', () => {
    it('parses interface and tinted item-pack keys', () => {
        const hud = parseSpriteFrameKey('sprite-gamedialog2-6-14');
        assert.deepEqual(hud, {
            assetKey: 'sprite-gamedialog2',
            sheetIndex: 6,
            frameIndex: 14,
            textureKey: 'sprite-gamedialog2-6',
            tintHex: undefined,
        });
        const jewelry = parseSpriteFrameKey('sprite-item-pack-3-12-00ff00');
        assert.equal(jewelry?.assetKey, 'sprite-item-pack');
        assert.equal(jewelry?.sheetIndex, 3);
        assert.equal(jewelry?.frameIndex, 12);
        assert.equal(jewelry?.tintHex, '00ff00');
        assert.equal(parseSpriteFrameKey('sprite-interface2-0-1')?.assetKey, 'sprite-interface2');
        assert.equal(parseSpriteFrameKey('paperdoll-body'), undefined);
    });

    it('collects unique pack sheets without implying a full-bag decode', () => {
        const sheets = collectItemIconSheetIndices([
            { sheetIndex: 3 },
            { sheetIndex: 3 },
            { sheetIndex: 11 },
            undefined,
            { sheetIndex: -1 },
        ]);
        assert.deepEqual(sheets, [3, 11]);
        assert.deepEqual(
            uniqueSheetIndicesForAsset(
                ['sprite-item-pack-3-1', 'sprite-dialogtext-0-0', 'sprite-item-pack-11-0'],
                'sprite-item-pack',
            ),
            [3, 11],
        );
    });
});
