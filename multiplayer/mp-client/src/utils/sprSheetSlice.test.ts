import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countSprSheets, pngRgbaByteEstimate, sliceSprSheets } from './sprSheetSlice';

/** 1×1 transparent PNG */
const PNG_1X1 = Uint8Array.from(
    Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
    ),
);

function writeInt16(view: DataView, offset: number, value: number): void {
    view.setInt16(offset, value, true);
}

function writeInt32(view: DataView, offset: number, value: number): void {
    view.setInt32(offset, value, true);
}

function buildSpr(sheetCount: number, png: Uint8Array): ArrayBuffer {
    const headerBytes = 2 + sheetCount * (2 + 4 + 4 + 4 + 1 + 12);
    const payloadBytes = sheetCount * (4 + png.byteLength);
    const buffer = new ArrayBuffer(headerBytes + payloadBytes);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let offset = 0;
    writeInt16(view, offset, sheetCount);
    offset += 2;
    for (let i = 0; i < sheetCount; i++) {
        writeInt16(view, offset, 1);
        offset += 2;
        writeInt32(view, offset, png.byteLength);
        offset += 4;
        writeInt32(view, offset, 1);
        offset += 4;
        writeInt32(view, offset, 1);
        offset += 4;
        bytes[offset] = 0;
        offset += 1;
        writeInt16(view, offset, 0);
        offset += 2;
        writeInt16(view, offset, 0);
        offset += 2;
        writeInt16(view, offset, 1);
        offset += 2;
        writeInt16(view, offset, 1);
        offset += 2;
        writeInt16(view, offset, 0);
        offset += 2;
        writeInt16(view, offset, 0);
        offset += 2;
    }
    for (let i = 0; i < sheetCount; i++) {
        writeInt32(view, offset, 0);
        offset += 4;
        bytes.set(png, offset);
        offset += png.byteLength;
    }
    return buffer;
}

describe('sliceSprSheets', () => {
    it('copies only requested sheet PNGs (not views of the whole pack)', () => {
        const buffer = buildSpr(3, PNG_1X1);
        assert.equal(countSprSheets(buffer), 3);

        const all = sliceSprSheets(buffer);
        assert.equal(all.length, 3);
        assert.equal(all[1].sheetIndex, 1);
        assert.equal(all[1].png.byteLength, PNG_1X1.byteLength);
        assert.notEqual(all[1].png.buffer, buffer);

        const one = sliceSprSheets(buffer, new Set([1]));
        assert.equal(one.length, 1);
        assert.equal(one[0].sheetIndex, 1);
        assert.deepEqual([...one[0].png], [...PNG_1X1]);
        assert.ok(one[0].png.byteLength < buffer.byteLength / 2);
        assert.equal(pngRgbaByteEstimate(PNG_1X1), 4);
    });
});
