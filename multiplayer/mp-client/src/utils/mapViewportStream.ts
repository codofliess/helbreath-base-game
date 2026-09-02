/**
 * Viewport-clipped map streaming math.
 *
 * Verified: `HBMap.renderMapTiles` used to create one Phaser tilemap **per map row** and
 * `renderMapObjects` instantiated a `GameAsset` for every static object. Traveler `default.amd`
 * plus every referenced tile `.spr` pack is enough to kill the Chromium renderer (Aw Snap 9)
 * during "Loading map". This module is the hard cap: load/paint only the camera window plus a
 * small ring — never `sizeX * sizeY` GameObjects.
 */

/** Extra tiles beyond the camera frustum so walking does not flash empty cells. */
export const MAP_STREAM_RING_TILES = 8;

/**
 * Maximum streamed window. A tiny camera zoom (or a full-map minimap snapshot) must not expand
 * this to the whole world.
 */
export const MAP_STREAM_MAX_WIDTH_TILES = 56;
export const MAP_STREAM_MAX_HEIGHT_TILES = 40;

/** Inclusive tile rectangle in map cell coordinates. */
export interface MapTileRect {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export function mapTileRectWidth(rect: MapTileRect): number {
    return rect.maxX - rect.minX + 1;
}

export function mapTileRectHeight(rect: MapTileRect): number {
    return rect.maxY - rect.minY + 1;
}

export function mapTileRectArea(rect: MapTileRect): number {
    return mapTileRectWidth(rect) * mapTileRectHeight(rect);
}

export function mapTileRectsEqual(a: MapTileRect | undefined, b: MapTileRect | undefined): boolean {
    if (!a || !b) {
        return false;
    }
    return a.minX === b.minX && a.minY === b.minY && a.maxX === b.maxX && a.maxY === b.maxY;
}

export function mapTileRectContains(outer: MapTileRect, inner: MapTileRect): boolean {
    return (
        inner.minX >= outer.minX &&
        inner.minY >= outer.minY &&
        inner.maxX <= outer.maxX &&
        inner.maxY <= outer.maxY
    );
}

export function clampMapTileRect(rect: MapTileRect, mapSizeX: number, mapSizeY: number): MapTileRect {
    const maxX = Math.max(0, mapSizeX - 1);
    const maxY = Math.max(0, mapSizeY - 1);
    const minX = Math.min(maxX, Math.max(0, rect.minX));
    const minY = Math.min(maxY, Math.max(0, rect.minY));
    return {
        minX,
        minY,
        maxX: Math.min(maxX, Math.max(minX, rect.maxX)),
        maxY: Math.min(maxY, Math.max(minY, rect.maxY)),
    };
}

/**
 * Centers a window on a focus cell and clamps to map bounds and the hard size cap.
 */
export function tileRectAroundFocus(
    focusTileX: number,
    focusTileY: number,
    halfWidthTiles: number,
    halfHeightTiles: number,
    mapSizeX: number,
    mapSizeY: number,
): MapTileRect {
    const width = Math.min(MAP_STREAM_MAX_WIDTH_TILES, Math.max(1, halfWidthTiles * 2 + 1));
    const height = Math.min(MAP_STREAM_MAX_HEIGHT_TILES, Math.max(1, halfHeightTiles * 2 + 1));
    const fx = Number.isFinite(focusTileX) ? focusTileX : 0;
    const fy = Number.isFinite(focusTileY) ? focusTileY : 0;
    const minX = Math.round(fx) - Math.floor(width / 2);
    const minY = Math.round(fy) - Math.floor(height / 2);
    return clampMapTileRect(
        { minX, minY, maxX: minX + width - 1, maxY: minY + height - 1 },
        mapSizeX,
        mapSizeY,
    );
}

export interface CameraStreamInput {
    scrollX: number;
    scrollY: number;
    viewWidthPx: number;
    viewHeightPx: number;
    zoom: number;
    mapSizeX: number;
    mapSizeY: number;
    ringTiles?: number;
}

/**
 * Tile rect covering the camera world view plus {@link MAP_STREAM_RING_TILES}, then clamped to
 * {@link MAP_STREAM_MAX_WIDTH_TILES} × {@link MAP_STREAM_MAX_HEIGHT_TILES} around the view center.
 */
export function cameraStreamTileRect(input: CameraStreamInput): MapTileRect {
    const zoom = input.zoom > 0 && Number.isFinite(input.zoom) ? input.zoom : 1;
    const worldW = input.viewWidthPx / zoom;
    const worldH = input.viewHeightPx / zoom;
    const left = input.scrollX;
    const top = input.scrollY;
    const ring = input.ringTiles ?? MAP_STREAM_RING_TILES;

    const viewMinX = Math.floor(left / 32) - ring;
    const viewMinY = Math.floor(top / 32) - ring;
    const viewMaxX = Math.ceil((left + worldW) / 32) + ring;
    const viewMaxY = Math.ceil((top + worldH) / 32) + ring;

    const raw = clampMapTileRect(
        { minX: viewMinX, minY: viewMinY, maxX: viewMaxX, maxY: viewMaxY },
        input.mapSizeX,
        input.mapSizeY,
    );

    if (
        mapTileRectWidth(raw) <= MAP_STREAM_MAX_WIDTH_TILES &&
        mapTileRectHeight(raw) <= MAP_STREAM_MAX_HEIGHT_TILES
    ) {
        return raw;
    }

    const centerX = Math.floor((left + worldW / 2) / 32);
    const centerY = Math.floor((top + worldH / 2) / 32);
    return tileRectAroundFocus(
        centerX,
        centerY,
        Math.floor(MAP_STREAM_MAX_WIDTH_TILES / 2),
        Math.floor(MAP_STREAM_MAX_HEIGHT_TILES / 2),
        input.mapSizeX,
        input.mapSizeY,
    );
}

/** Default play FOV in pixels (matches GameWorld 1024×576). */
export const DEFAULT_STREAM_VIEW_WIDTH_PX = 1024;
export const DEFAULT_STREAM_VIEW_HEIGHT_PX = 576;

export function initialFocusStreamRect(
    focusTileX: number,
    focusTileY: number,
    mapSizeX: number,
    mapSizeY: number,
    viewWidthPx = DEFAULT_STREAM_VIEW_WIDTH_PX,
    viewHeightPx = DEFAULT_STREAM_VIEW_HEIGHT_PX,
): MapTileRect {
    const halfW = Math.ceil(viewWidthPx / 32 / 2) + MAP_STREAM_RING_TILES;
    const halfH = Math.ceil(viewHeightPx / 32 / 2) + MAP_STREAM_RING_TILES;
    return tileRectAroundFocus(focusTileX, focusTileY, halfW, halfH, mapSizeX, mapSizeY);
}

export interface MapCellSprites {
    sprite: number;
    objectSprite: number;
}

/**
 * Ground + object sprite indices inside `rect` only (plus tree-shadow +50).
 * Full-map scans belong in tests, not in the load path.
 */
export function collectSpriteIndicesInRect(
    tiles: ReadonlyArray<ReadonlyArray<MapCellSprites>>,
    rect: MapTileRect,
    isTreeSpriteIndex: (index: number) => boolean,
): Set<number> {
    const indices = new Set<number>();
    for (let y = rect.minY; y <= rect.maxY; y++) {
        const row = tiles[y];
        if (!row) {
            continue;
        }
        for (let x = rect.minX; x <= rect.maxX; x++) {
            const tile = row[x];
            if (!tile) {
                continue;
            }
            if (tile.sprite >= 0) {
                indices.add(tile.sprite);
            }
            if (tile.objectSprite > 0) {
                indices.add(tile.objectSprite);
            }
        }
    }
    for (const idx of [...indices]) {
        if (isTreeSpriteIndex(idx)) {
            indices.add(idx + 50);
        }
    }
    return indices;
}
