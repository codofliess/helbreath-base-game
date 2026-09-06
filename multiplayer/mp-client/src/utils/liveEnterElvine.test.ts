import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { catalogAmdFileName, registryMapKey } from './mapCatalogLookup';
import { localTileSheetIndices } from './tileSheetFilter';
import { parseAmdMapCells } from './mapAmdBinary';
import { fetchGameAssetArrayBuffer } from './gameAssetHttp';
import { countSprSheets, pngRgbaByteEstimate, sliceSprSheets } from './sprSheetSlice';
import {
    MAP_STREAM_MAX_HEIGHT_TILES,
    MAP_STREAM_MAX_WIDTH_TILES,
    collectSpriteIndicesInRect,
    initialFocusStreamRect,
    mapTileRectArea,
} from './mapViewportStream';

const LIVE_ORIGIN = 'https://play.chainlords.net';
const ELVINE_SPAWN_X = 149;
const ELVINE_SPAWN_Y = 131;

function isTreeSpriteIndex(spriteIndex: number): boolean {
    return spriteIndex >= 100 && spriteIndex <= 145;
}

function tilePacksFromAssetsTs(): Array<{ fileName: string; tileStartIndex: number }> {
    const assetsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../constants/Assets.ts');
    const src = fs.readFileSync(assetsPath, 'utf8');
    const packs: Array<{ fileName: string; tileStartIndex: number }> = [];
    const re =
        /fileName: '([^']+\.spr)', assetType: AssetType\.TILE_SPRITE, spriteType: SpriteType\.Tiles, tileStartIndex: (\d+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
        packs.push({ fileName: m[1], tileStartIndex: Number(m[2]) });
    }
    packs.sort((a, b) => a.tileStartIndex - b.tileStartIndex);
    return packs;
}

function resolvePackFileNames(indices: Set<number>, packs: Array<{ fileName: string; tileStartIndex: number }>): string[] {
    const used = new Set<string>();
    for (const idx of indices) {
        let chosen = packs[0];
        for (const pack of packs) {
            if (pack.tileStartIndex <= idx) {
                chosen = pack;
            } else {
                break;
            }
        }
        used.add(chosen.fileName);
    }
    return [...used];
}

function countObjectInstances(
    tiles: Array<Array<{ sprite: number; objectSprite: number }>>,
    rect: { minX: number; minY: number; maxX: number; maxY: number },
): number {
    let n = 0;
    for (let y = rect.minY; y <= rect.maxY; y++) {
        const row = tiles[y];
        if (!row) {
            continue;
        }
        for (let x = rect.minX; x <= rect.maxX; x++) {
            const ob = row[x]?.objectSprite ?? 0;
            if (ob > 0 && ob !== 6 && ob !== 7 && ob !== 9 && ob !== 24) {
                n += 1;
            }
        }
    }
    return n;
}

describe('live Elvine enter path (HTTP + stream)', () => {
    it('registers elvine.amd (not HTML / not elvine.amd.amd) and streams plaza packs only', async () => {
        assert.equal(catalogAmdFileName('elvine'), 'elvine.amd');
        assert.equal(catalogAmdFileName('elvine.amd.amd'), 'elvine.amd');
        assert.equal(registryMapKey('elvine'), 'map-elvine');

        const buffer = await fetchGameAssetArrayBuffer('maps', catalogAmdFileName('elvine'), LIVE_ORIGIN);
        const map = parseAmdMapCells(buffer);
        assert.equal(map.sizeX, 300);
        assert.equal(map.sizeY, 300);
        assert.equal(map.tileSize, 10);

        const rect = initialFocusStreamRect(ELVINE_SPAWN_X, ELVINE_SPAWN_Y, map.sizeX, map.sizeY);
        assert.ok(rect.maxX - rect.minX + 1 <= MAP_STREAM_MAX_WIDTH_TILES);
        assert.ok(rect.maxY - rect.minY + 1 <= MAP_STREAM_MAX_HEIGHT_TILES);
        assert.ok(mapTileRectArea(rect) < map.sizeX * map.sizeY / 10);

        const catalog = tilePacksFromAssetsTs();
        const indices = collectSpriteIndicesInRect(map.tiles, rect, isTreeSpriteIndex);
        const packs = resolvePackFileNames(indices, catalog);
        const objects = countObjectInstances(map.tiles, rect);
        assert.ok(packs.length <= 8, `plaza should load few packs, got ${packs.join(',')}`);
        assert.ok(objects < 200, `plaza object instances ${objects} must stay << full map`);

        const resolveKey = (idx: number) => {
            let chosen = catalog[0];
            for (const pack of catalog) {
                if (pack.tileStartIndex <= idx) {
                    chosen = pack;
                } else {
                    break;
                }
            }
            return chosen.fileName;
        };
        let plazaSheets = 0;
        for (const pack of catalog.filter((p) => packs.includes(p.fileName))) {
            plazaSheets += localTileSheetIndices(pack.tileStartIndex, pack.fileName, indices, resolveKey).length;
        }
        assert.ok(plazaSheets > 0);
        assert.ok(plazaSheets <= 24, `plaza should decode few tile sheets, got ${plazaSheets}`);

        let sprBytes = 0;
        let selectedPngBytes = 0;
        let selectedRgbaBytes = 0;
        let catalogSheetCount = 0;
        for (const pack of catalog.filter((p) => packs.includes(p.fileName))) {
            const spr = await fetchGameAssetArrayBuffer('sprites', pack.fileName, LIVE_ORIGIN);
            sprBytes += spr.byteLength;
            const head = new TextDecoder('utf-8').decode(new Uint8Array(spr, 0, Math.min(16, spr.byteLength))).trimStart();
            assert.equal(head.toLowerCase().startsWith('<!doctype') || head.toLowerCase().startsWith('<html'), false);
            const locals = localTileSheetIndices(pack.tileStartIndex, pack.fileName, indices, resolveKey);
            catalogSheetCount += countSprSheets(spr);
            const sliced = sliceSprSheets(spr, new Set(locals));
            assert.equal(sliced.length, locals.length);
            for (const sheet of sliced) {
                selectedPngBytes += sheet.png.byteLength;
                selectedRgbaBytes += pngRgbaByteEstimate(sheet.png);
            }
        }
        assert.ok(sprBytes > 0);
        assert.ok(sprBytes < 20 * 1024 * 1024, `plaza pack bytes ${sprBytes} too large for enter`);
        assert.ok(catalogSheetCount > plazaSheets, `full packs ${catalogSheetCount} sheets vs plaza ${plazaSheets}`);
        assert.ok(selectedPngBytes < sprBytes, `decoded PNG copies ${selectedPngBytes} must be < packed ${sprBytes}`);
        assert.ok(
            selectedRgbaBytes < 48 * 1024 * 1024,
            `plaza decoded RGBA estimate ${selectedRgbaBytes} too large for enter`,
        );
    });
});
