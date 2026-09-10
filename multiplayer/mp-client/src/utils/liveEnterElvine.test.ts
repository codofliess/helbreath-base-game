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
    MAP_ENTER_RING_TILES,
    MAP_EXPAND_STEP_TILES,
    MAP_OBJECT_INSTANTIATE_BATCH,
    MAP_STREAM_MAX_HEIGHT_TILES,
    MAP_STREAM_MAX_WIDTH_TILES,
    collectSpriteIndicesInRect,
    firstPaintStreamRect,
    growMapTileRectToward,
    initialFocusStreamRect,
    mapTileRectArea,
    mapTileRectContains,
    paintStreamTileRect,
    postPaintStreamRect,
} from './mapViewportStream';
import { isCompactInteriorMap, shouldSkipEnterHeavyCascade } from './mapEnterSettle';

const LIVE_ORIGIN = 'https://play.chainlords.net';
/** Legacy traveler / plaza-hunt pad — farm FOV, not login spawn after PR #79. */
const ELVINE_SLIME_PLAZA_X = 149;
const ELVINE_SLIME_PLAZA_Y = 131;
/** Olympia city streets (login / Restart! / City Hall). */
const ELVINE_CITY_STREETS_X = 158;
const ELVINE_CITY_STREETS_Y = 57;
/** Wizard Tower door exit after Gandalf. */
const ELVINE_TOWER_DOOR_X = 181;
const ELVINE_TOWER_DOOR_Y = 78;
/** First-paint HTTP budget remains the open plaza (historical OOM fixture). */
const ELVINE_SPAWN_X = ELVINE_SLIME_PLAZA_X;
const ELVINE_SPAWN_Y = ELVINE_SLIME_PLAZA_Y;

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
    includeTrees: boolean,
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
                if (!includeTrees && isTreeSpriteIndex(ob)) {
                    continue;
                }
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
        const firstPaint = firstPaintStreamRect(ELVINE_SPAWN_X, ELVINE_SPAWN_Y, map.sizeX, map.sizeY);
        const postPaint = postPaintStreamRect(ELVINE_SPAWN_X, ELVINE_SPAWN_Y, map.sizeX, map.sizeY);
        assert.ok(mapTileRectArea(firstPaint) < mapTileRectArea(postPaint));
        assert.ok(mapTileRectArea(postPaint) < mapTileRectArea(rect));
        const grown = growMapTileRectToward(firstPaint, rect, MAP_EXPAND_STEP_TILES);
        assert.ok(mapTileRectArea(grown) < mapTileRectArea(rect) || mapTileRectContains(grown, firstPaint));
        assert.ok(mapTileRectArea(grown) < MAP_STREAM_MAX_WIDTH_TILES * MAP_STREAM_MAX_HEIGHT_TILES);
        assert.ok(MAP_OBJECT_INSTANTIATE_BATCH <= 12);
        assert.ok(rect.maxX - rect.minX + 1 <= MAP_STREAM_MAX_WIDTH_TILES);
        assert.ok(rect.maxY - rect.minY + 1 <= MAP_STREAM_MAX_HEIGHT_TILES);
        assert.ok(mapTileRectArea(rect) < map.sizeX * map.sizeY / 10);

        const catalog = tilePacksFromAssetsTs();
        const indices = collectSpriteIndicesInRect(map.tiles, rect, isTreeSpriteIndex, false);
        const firstPaintGround = collectSpriteIndicesInRect(map.tiles, firstPaint, isTreeSpriteIndex, false, false);
        const packs = resolvePackFileNames(indices, catalog);
        const objectsFirstPaint = countObjectInstances(map.tiles, rect, false);
        const objectsPostPaint = countObjectInstances(map.tiles, postPaint, false);
        const objectsWithTrees = countObjectInstances(map.tiles, rect, true);
        assert.ok(packs.length <= 8, `plaza should load few packs, got ${packs.join(',')}`);
        assert.ok(objectsPostPaint <= objectsFirstPaint, 'post-paint object window must not exceed enter-ring props');
        assert.ok(objectsFirstPaint < 200, `plaza object instances ${objectsFirstPaint} must stay << full map`);
        assert.ok(
            objectsFirstPaint <= objectsWithTrees,
            'first paint must not instantiate more objects than the tree pass',
        );
        const walkPaint = paintStreamTileRect({
            scrollX: ELVINE_SPAWN_X * 32,
            scrollY: ELVINE_SPAWN_Y * 32,
            viewWidthPx: 1024,
            viewHeightPx: 576,
            zoom: 1,
            mapSizeX: map.sizeX,
            mapSizeY: map.sizeY,
        });
        assert.ok(mapTileRectArea(rect) < mapTileRectArea(walkPaint));
        assert.ok(MAP_ENTER_RING_TILES < 8);

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

        const firstPaintPacks = resolvePackFileNames(firstPaintGround, catalog);
        let firstPaintSheets = 0;
        let firstPaintRgba = 0;
        for (const pack of catalog.filter((p) => firstPaintPacks.includes(p.fileName))) {
            const spr = await fetchGameAssetArrayBuffer('sprites', pack.fileName, LIVE_ORIGIN);
            const locals = localTileSheetIndices(pack.tileStartIndex, pack.fileName, firstPaintGround, resolveKey);
            firstPaintSheets += locals.length;
            for (const sheet of sliceSprSheets(spr, new Set(locals))) {
                firstPaintRgba += pngRgbaByteEstimate(sheet.png);
            }
        }
        assert.ok(firstPaintSheets > 0);
        assert.ok(firstPaintSheets <= plazaSheets, `frame-0 sheets ${firstPaintSheets} must be <= enter ${plazaSheets}`);
        assert.ok(firstPaintSheets <= 12, `frame-0 should decode few ground sheets, got ${firstPaintSheets}`);
        assert.ok(
            firstPaintRgba < selectedRgbaBytes,
            `frame-0 RGBA ${firstPaintRgba} must be < enter ${selectedRgbaBytes}`,
        );
        assert.ok(
            firstPaintRgba < 16 * 1024 * 1024,
            `frame-0 decoded RGBA estimate ${firstPaintRgba} too large for first paint`,
        );
    });

    it('hostile slime idle sheets are a fraction of the full .spr (pad standstill)', async () => {
        const spr = await fetchGameAssetArrayBuffer('sprites', 'slm.spr', LIVE_ORIGIN);
        const totalSheets = countSprSheets(spr);
        assert.ok(totalSheets >= 8, `slime.spr should have idle+combat sheets, got ${totalSheets}`);
        const idle = sliceSprSheets(spr, new Set([0, 1, 2, 3, 4, 5, 6, 7]));
        const all = sliceSprSheets(spr);
        let idleRgba = 0;
        let allRgba = 0;
        for (const sheet of idle) {
            idleRgba += pngRgbaByteEstimate(sheet.png);
        }
        for (const sheet of all) {
            allRgba += pngRgbaByteEstimate(sheet.png);
        }
        assert.equal(idle.length, 8);
        assert.ok(all.length > idle.length, `full slime sheets ${all.length} vs idle 8`);
        assert.ok(idleRgba < allRgba, `idle RGBA ${idleRgba} must be < full ${allRgba}`);
        assert.ok(idleRgba * 2 < allRgba || all.length >= 24, 'combat/death sheets must dominate VRAM if decoded eagerly');
    });

    it('city streets and Wizard Tower door stay inside the stream cap (PR #79 farm path)', async () => {
        const buffer = await fetchGameAssetArrayBuffer('maps', catalogAmdFileName('elvine'), LIVE_ORIGIN);
        const map = parseAmdMapCells(buffer);
        const foci = [
            { name: 'city streets', x: ELVINE_CITY_STREETS_X, y: ELVINE_CITY_STREETS_Y },
            { name: 'tower door', x: ELVINE_TOWER_DOOR_X, y: ELVINE_TOWER_DOOR_Y },
            { name: 'slime plaza', x: ELVINE_SLIME_PLAZA_X, y: ELVINE_SLIME_PLAZA_Y },
        ];
        for (const focus of foci) {
            const firstPaint = firstPaintStreamRect(focus.x, focus.y, map.sizeX, map.sizeY);
            const enter = initialFocusStreamRect(focus.x, focus.y, map.sizeX, map.sizeY);
            const objectsEnter = countObjectInstances(map.tiles, enter, false);
            const objectsTrees = countObjectInstances(map.tiles, enter, true);
            assert.ok(
                mapTileRectArea(enter) <= MAP_STREAM_MAX_WIDTH_TILES * MAP_STREAM_MAX_HEIGHT_TILES,
                `${focus.name} enter window exceeds stream cap`,
            );
            assert.ok(
                objectsEnter < 280,
                `${focus.name} enter objects ${objectsEnter} must stay bounded (city is denser than plaza)`,
            );
            assert.ok(objectsEnter <= objectsTrees, `${focus.name} tree pass must not drop props`);
            assert.ok(
                mapTileRectArea(firstPaint) < mapTileRectArea(enter),
                `${focus.name} first paint must stay smaller than enter FOV`,
            );
        }
    });

    it('city walk from Wizard Tower door toward north gates stays inside the stream cap', () => {
        const mapsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../../sp-client/public/assets/maps');
        const buffer = fs.readFileSync(path.join(mapsDir, 'elvine.amd'));
        const map = parseAmdMapCells(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
        const door = initialFocusStreamRect(ELVINE_TOWER_DOOR_X, ELVINE_TOWER_DOOR_Y, map.sizeX, map.sizeY);
        const gates = initialFocusStreamRect(225, 20, map.sizeX, map.sizeY);
        const doorObjects = countObjectInstances(map.tiles, door, false);
        const gateObjects = countObjectInstances(map.tiles, gates, false);
        assert.ok(doorObjects < 280, `tower-door enter objects ${doorObjects}`);
        assert.ok(gateObjects < 280, `north-gate enter objects ${gateObjects}`);
        const grown = growMapTileRectToward(door, gates);
        assert.ok(
            mapTileRectArea(grown) < mapTileRectArea(door) + mapTileRectArea(gates),
            'walk grow must not union door+gates (that was the city-walk discard)',
        );
        assert.ok(mapTileRectArea(grown) <= MAP_STREAM_MAX_WIDTH_TILES * MAP_STREAM_MAX_HEIGHT_TILES);
    });

    it('Wizard Tower pad (43,34) is a compact interior — skip the city gear/zoom dump', () => {
        const mapsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../../sp-client/public/assets/maps');
        const buffer = fs.readFileSync(path.join(mapsDir, 'wzdtwr_1.amd'));
        const map = parseAmdMapCells(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
        assert.equal(map.sizeX, 100);
        assert.equal(map.sizeY, 100);
        assert.equal(isCompactInteriorMap(map.sizeX, map.sizeY), true);
        assert.equal(
            shouldSkipEnterHeavyCascade({
                sizeX: map.sizeX,
                sizeY: map.sizeY,
                worldId: 'elvwzdtwr',
                mapName: 'map-wzdtwr_1',
            }),
            true,
        );
        const gandalfPad = { x: 43, y: 34 };
        const firstPaint = firstPaintStreamRect(gandalfPad.x, gandalfPad.y, map.sizeX, map.sizeY);
        const enter = initialFocusStreamRect(gandalfPad.x, gandalfPad.y, map.sizeX, map.sizeY);
        const objectsEnter = countObjectInstances(map.tiles, enter, false);
        assert.ok(mapTileRectArea(firstPaint) <= mapTileRectArea(enter));
        assert.ok(
            objectsEnter < 80,
            `tower pad enter objects ${objectsEnter} must stay tiny (Chile sit-discard is gear/zoom, not props)`,
        );
    });
});
