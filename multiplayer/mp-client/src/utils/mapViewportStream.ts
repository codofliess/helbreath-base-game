/**
 * Viewport-clipped map streaming math.
 *
 * `HBMap.renderMapTiles` used to create one Phaser tilemap per map row and
 * `renderMapObjects` instantiated a GameAsset for every static object. On Canvas 2D
 * that allocates the whole `.amd` in CPU RAM and Chrome Aw Snaps (error 9) on enter.
 * Load/paint only the camera window plus a ring — never `sizeX * sizeY` GameObjects.
 */

/** Extra tiles beyond the camera frustum so walking does not flash empty cells. */
export const MAP_STREAM_RING_TILES = 8;

/**
 * First enter uses a tighter ring than walk. The walk cap (56×40) plus tree shadows
 * was still enough Canvas textures to Aw Snap during map load before the pad.
 */
export const MAP_ENTER_RING_TILES = 4;

/**
 * Frame-0 paint is smaller than enter FOV+ring. Decoding ~40×26 ground+object sheets
 * before the first Phaser frame still Aw Snaps (~2GB Chrome) — restream/settle never runs.
 */
export const MAP_FIRST_PAINT_MAX_WIDTH_TILES = 12;
export const MAP_FIRST_PAINT_MAX_HEIGHT_TILES = 8;

/**
 * Do not rebuild the tileset because walk-ring (8) is a few cells larger than enter-ring (4).
 * That false restream after a brief stand (56×40 + tree shadows) Aw Snapped before the pad.
 */
export const MAP_STREAM_REFRESH_SLACK_TILES = 10;

/**
 * While standing (camera follow / focus recenter), require a larger miss before restream.
 * Slack 10 still let a focus-driven camera+ring miss the 12×8 then jump to the walk cap.
 */
export const MAP_STAND_REFRESH_SLACK_TILES = 16;

/**
 * Grow the painted window by at most this many tiles per edge per expand/restream.
 * Jumping 12×8 → enter FOV+ring (~40×26) plus object packs in one tick Aw Snaps after stand.
 */
export const MAP_EXPAND_STEP_TILES = 4;

/**
 * First post-paint ground window (still smaller than enter FOV+ring).
 */
export const MAP_POST_PAINT_MAX_WIDTH_TILES = 20;
export const MAP_POST_PAINT_MAX_HEIGHT_TILES = 12;

/** New plaza GameAssets per yield so object instantiate cannot dump ~200 sprites in one tick. */
export const MAP_OBJECT_INSTANTIATE_BATCH = 8;

/**
 * Chebyshev tile gap between the painted window and the new camera that rebuilds
 * the stream in one shot. Walking shifts the camera about one tile per step and
 * grows {@link MAP_EXPAND_STEP_TILES} per edge, so it stays under this.
 * A respawn or teleport past it — or any camera window that does not overlap the
 * painted rect — must not crawl four tiles per pack-load (that is the ~5s black
 * plaza after Restart).
 */
export const MAP_STREAM_SNAP_JUMP_TILES = 12;

/**
 * Fail-soft for the respawn/teleport cover. The rebuild is one pack load, not a
 * multi-pass crawl; lift the cover if that load never covers the camera.
 */
export const MAP_STREAM_JUMP_COVER_MAX_MS = 4000;

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

/** Inclusive overlap. Touching edges count; a one-tile gap does not. */
export function mapTileRectsOverlap(a: MapTileRect, b: MapTileRect): boolean {
    return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

export function isDegenerateMapTileRect(rect: MapTileRect): boolean {
    return rect.maxX < rect.minX || rect.maxY < rect.minY;
}

/** Chebyshev distance between rect centers, in tiles. */
export function mapTileRectChebyshevCenterDelta(a: MapTileRect, b: MapTileRect): number {
    const ax = (a.minX + a.maxX) / 2;
    const ay = (a.minY + a.maxY) / 2;
    const bx = (b.minX + b.maxX) / 2;
    const by = (b.minY + b.maxY) / 2;
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
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
    const fx = Number.isFinite(focusTileX) ? focusTileX : 0;
    const fy = Number.isFinite(focusTileY) ? focusTileY : 0;
    return cameraStreamTileRect({
        scrollX: fx * 32 - viewWidthPx / 2,
        scrollY: fy * 32 - viewHeightPx / 2,
        viewWidthPx,
        viewHeightPx,
        zoom: 1,
        mapSizeX,
        mapSizeY,
        ringTiles: MAP_ENTER_RING_TILES,
    });
}

/**
 * Tiny ground window around spawn for the first Phaser paint. Objects, enter-ring
 * tiles, and walk restream load after this rect has produced a stable frame.
 */
export function firstPaintStreamRect(
    focusTileX: number,
    focusTileY: number,
    mapSizeX: number,
    mapSizeY: number,
): MapTileRect {
    const fx = Number.isFinite(focusTileX) ? focusTileX : 0;
    const fy = Number.isFinite(focusTileY) ? focusTileY : 0;
    const width = MAP_FIRST_PAINT_MAX_WIDTH_TILES;
    const height = MAP_FIRST_PAINT_MAX_HEIGHT_TILES;
    const minX = Math.round(fx) - Math.floor(width / 2);
    const minY = Math.round(fy) - Math.floor(height / 2);
    return clampMapTileRect(
        { minX, minY, maxX: minX + width - 1, maxY: minY + height - 1 },
        mapSizeX,
        mapSizeY,
    );
}

/**
 * Intermediate ground window after frame-0. Larger than 12×8 so the plaza is walkable,
 * smaller than enter FOV+ring so object packs are not decoded in the same beat.
 */
export function postPaintStreamRect(
    focusTileX: number,
    focusTileY: number,
    mapSizeX: number,
    mapSizeY: number,
): MapTileRect {
    const fx = Number.isFinite(focusTileX) ? focusTileX : 0;
    const fy = Number.isFinite(focusTileY) ? focusTileY : 0;
    const width = MAP_POST_PAINT_MAX_WIDTH_TILES;
    const height = MAP_POST_PAINT_MAX_HEIGHT_TILES;
    const minX = Math.round(fx) - Math.floor(width / 2);
    const minY = Math.round(fy) - Math.floor(height / 2);
    return clampMapTileRect(
        { minX, minY, maxX: minX + width - 1, maxY: minY + height - 1 },
        mapSizeX,
        mapSizeY,
    );
}

/**
 * Expands `current` toward `target` by at most `stepTiles` per edge. Used so stand/focus
 * never rebuilds a walk-cap tileset in one tick.
 */
export function growMapTileRectToward(
    current: MapTileRect,
    target: MapTileRect,
    stepTiles = MAP_EXPAND_STEP_TILES,
): MapTileRect {
    const step = Math.max(1, stepTiles);
    return {
        minX: Math.max(target.minX, current.minX - step),
        minY: Math.max(target.minY, current.minY - step),
        maxX: Math.min(target.maxX, current.maxX + step),
        maxY: Math.min(target.maxY, current.maxY + step),
    };
}

/**
 * True when growing {@link MAP_EXPAND_STEP_TILES} per edge would leave the new
 * camera on empty ground for several pack loads.
 *
 * No painted rect yet: false (first enter still grows from the tiny window).
 * The new camera already inside the paint: false (tiles are ready).
 * Otherwise reset when the windows do not overlap, the paint is degenerate, or
 * the centers jumped by at least {@link MAP_STREAM_SNAP_JUMP_TILES}.
 */
export function shouldResetStreamedView(
    painted: MapTileRect | undefined,
    needed: MapTileRect,
    jumpTiles = MAP_STREAM_SNAP_JUMP_TILES,
): boolean {
    if (!painted) {
        return false;
    }
    if (isDegenerateMapTileRect(painted)) {
        return true;
    }
    if (mapTileRectContains(painted, needed)) {
        return false;
    }
    if (!mapTileRectsOverlap(painted, needed)) {
        return true;
    }
    return mapTileRectChebyshevCenterDelta(painted, needed) >= Math.max(1, jumpTiles);
}

export interface StreamedPaintResolution {
    rect: MapTileRect;
    /** True when the old window was discarded instead of grown toward `destination`. */
    reset: boolean;
}

/**
 * Next ground window. Walking grows `painted` toward `destination` by `stepTiles`.
 * A respawn/teleport (or a grow that would invert the rect) recenters on `needed`.
 * With no paint yet, still grows from `needed` so first enter does not jump to the walk cap.
 */
export function resolveStreamedPaintRect(
    painted: MapTileRect | undefined,
    needed: MapTileRect,
    destination: MapTileRect,
    stepTiles = MAP_EXPAND_STEP_TILES,
): StreamedPaintResolution {
    if (!painted) {
        return { rect: growMapTileRectToward(needed, destination, stepTiles), reset: false };
    }
    if (shouldResetStreamedView(painted, needed)) {
        return { rect: needed, reset: true };
    }
    const grown = growMapTileRectToward(painted, destination, stepTiles);
    if (isDegenerateMapTileRect(grown)) {
        return { rect: needed, reset: true };
    }
    return { rect: grown, reset: false };
}

/** True when `painted` already covers the visible camera, so a jump cover can lift. */
export function streamedViewCoversCamera(painted: MapTileRect | undefined, camera: MapTileRect): boolean {
    if (!painted || isDegenerateMapTileRect(painted) || isDegenerateMapTileRect(camera)) {
        return false;
    }
    return mapTileRectContains(painted, camera);
}

/** Yields until `count` animation frames (or 16ms ticks when rAF is missing). */
export function waitForBrowserFrames(count = 2): Promise<void> {
    const frames = Math.max(1, count);
    return new Promise((resolve) => {
        let left = frames;
        const tick = () => {
            left -= 1;
            if (left <= 0) {
                resolve();
                return;
            }
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(tick);
            } else {
                setTimeout(tick, 16);
            }
        };
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(tick);
        } else {
            setTimeout(tick, 16);
        }
    });
}

/** Timer yield so Canvas 2D can GC between pack decode / object batches. */
export function waitMs(ms: number): Promise<void> {
    const delay = Math.max(0, ms);
    return new Promise((resolve) => {
        setTimeout(resolve, delay);
    });
}

/**
 * Painted/decoded window: always the hard cap around the camera center.
 * `cameraStreamTileRect` is the *needed* camera+ring; walking inside a painted cap
 * must not decode more sheets or rebuild the tileset every cell.
 */
export function paintStreamTileRect(input: CameraStreamInput): MapTileRect {
    const zoom = input.zoom > 0 && Number.isFinite(input.zoom) ? input.zoom : 1;
    const worldW = input.viewWidthPx / zoom;
    const worldH = input.viewHeightPx / zoom;
    const centerX = Math.floor((input.scrollX + worldW / 2) / 32);
    const centerY = Math.floor((input.scrollY + worldH / 2) / 32);
    return tileRectAroundFocus(
        centerX,
        centerY,
        Math.floor(MAP_STREAM_MAX_WIDTH_TILES / 2),
        Math.floor(MAP_STREAM_MAX_HEIGHT_TILES / 2),
        input.mapSizeX,
        input.mapSizeY,
    );
}

/** True when the camera+ring has moved far enough outside the painted window to restream. */
export function shouldRefreshMapStream(
    painted: MapTileRect | undefined,
    needed: MapTileRect,
    slackTiles = MAP_STREAM_REFRESH_SLACK_TILES,
): boolean {
    if (!painted) {
        return true;
    }
    if (mapTileRectContains(painted, needed)) {
        return false;
    }
    const slack = Math.max(0, slackTiles);
    if (slack === 0) {
        return true;
    }
    return !mapTileRectContains(
        {
            minX: painted.minX - slack,
            minY: painted.minY - slack,
            maxX: painted.maxX + slack,
            maxY: painted.maxY + slack,
        },
        needed,
    );
}

/** Phaser `map-tile-{globalIndex}` keys that are outside the current stream keep-set. */
export function mapTileKeysToEvict(
    textureKeys: readonly string[],
    keepGlobalIndices: ReadonlySet<number>,
): string[] {
    const evict: string[] = [];
    for (const key of textureKeys) {
        const match = /^map-tile-(\d+)$/.exec(key);
        if (!match) {
            continue;
        }
        const idx = Number(match[1]);
        if (!keepGlobalIndices.has(idx)) {
            evict.push(key);
        }
    }
    return evict;
}

export interface MapCellSprites {
    sprite: number;
    objectSprite: number;
}

/**
 * Ground + object sprite indices inside `rect` only (plus tree-shadow +50 when requested).
 * Full-map scans belong in tests, not in the load path. Frame-0 skips objects and shadows.
 */
export function collectSpriteIndicesInRect(
    tiles: ReadonlyArray<ReadonlyArray<MapCellSprites>>,
    rect: MapTileRect,
    isTreeSpriteIndex: (index: number) => boolean,
    includeTreeShadows = true,
    includeObjectSprites = true,
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
            if (includeObjectSprites && tile.objectSprite > 0) {
                indices.add(tile.objectSprite);
            }
        }
    }
    if (includeTreeShadows) {
        for (const idx of [...indices]) {
            if (isTreeSpriteIndex(idx)) {
                indices.add(idx + 50);
            }
        }
    }
    return indices;
}
