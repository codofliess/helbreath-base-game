/**
 * Helbreath `.spr` directory walk that can copy only the PNG payloads we will decode.
 * Enter-world must not retain a Uint8Array view per unused sheet (those views pin the
 * whole pack ArrayBuffer and allocate frame objects for every atlas in objects*.spr).
 */

export interface SprSheetFrameMeta {
    x: number;
    y: number;
    width: number;
    height: number;
    pivotX: number;
    pivotY: number;
}

export interface SprSheetSlice {
    sheetIndex: number;
    frames: SprSheetFrameMeta[];
    /** Independent copy of this sheet's PNG only — not a view of the full `.spr`. */
    png: Uint8Array;
}

const HEADER_SIZE = 2;

function readInt16(view: DataView, offset: number): number {
    return view.getInt16(offset, true);
}

function readInt32(view: DataView, offset: number): number {
    return view.getInt32(offset, true);
}

export function countSprSheets(buffer: ArrayBuffer): number {
    if (buffer.byteLength < HEADER_SIZE) {
        return 0;
    }
    return readInt16(new DataView(buffer), 0);
}

/**
 * Parses `.spr` metadata. When `sheetIndices` is set, only those local sheet indexes
 * are returned (PNG bytes copied). Other sheets are skipped in the payload scan.
 */
export function sliceSprSheets(
    buffer: ArrayBuffer,
    sheetIndices?: ReadonlySet<number>,
): SprSheetSlice[] {
    const view = new DataView(buffer);
    let offset = 0;
    const spriteCount = readInt16(view, offset);
    offset += HEADER_SIZE;

    const framesBySheet = new Array<SprSheetFrameMeta[]>(spriteCount);
    const imageLengths = new Array<number>(spriteCount);

    for (let i = 0; i < spriteCount; i += 1) {
        const frameCount = readInt16(view, offset);
        offset += 2;

        const imageLength = readInt32(view, offset);
        offset += 4;
        imageLengths[i] = imageLength;

        offset += 4; // width
        offset += 4; // height
        offset += 1; // startLocation placeholder

        const want = !sheetIndices || sheetIndices.has(i);
        if (want) {
            const frames = new Array<SprSheetFrameMeta>(frameCount);
            for (let f = 0; f < frameCount; f += 1) {
                const x = readInt16(view, offset);
                offset += 2;
                const y = readInt16(view, offset);
                offset += 2;
                const width = readInt16(view, offset);
                offset += 2;
                const height = readInt16(view, offset);
                offset += 2;
                const pivotX = readInt16(view, offset);
                offset += 2;
                const pivotY = readInt16(view, offset);
                offset += 2;
                frames[f] = { x, y, width, height, pivotX, pivotY };
            }
            framesBySheet[i] = frames;
        } else {
            offset += frameCount * 12;
        }
    }

    const slices: SprSheetSlice[] = [];
    for (let i = 0; i < spriteCount; i += 1) {
        offset += 4; // startLocation
        const imageLength = imageLengths[i];
        const want = !sheetIndices || sheetIndices.has(i);
        if (want) {
            slices.push({
                sheetIndex: i,
                frames: framesBySheet[i] ?? [],
                png: new Uint8Array(buffer.slice(offset, offset + imageLength)),
            });
        }
        offset += imageLength;
    }
    return slices;
}

/** Uncompressed RGBA estimate from PNG IHDR (8-bit truecolor / truecolor+alpha). */
export function pngRgbaByteEstimate(png: Uint8Array): number {
    if (png.byteLength < 24 || png[0] !== 0x89 || png[1] !== 0x50) {
        return png.byteLength;
    }
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return png.byteLength;
    }
    return width * height * 4;
}
