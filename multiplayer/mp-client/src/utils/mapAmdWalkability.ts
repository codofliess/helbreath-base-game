/**
 * Classic Helbreath `.amd` walkability — same rule as server `Map.LoadOccupancy`.
 * Movement is bit 0x80 only; sprites 18/19 are wet for spawn/VFX, not walls.
 */

export const AMD_HEADER_SIZE = 256;
export const AMD_BLOCKED_FLAG = 0x80;
export const AMD_TELEPORT_FLAG = 0x40;
export const AMD_WATER_SPRITE = 19;
export const AMD_SHORE_SPRITE = 18;

export interface AmdWalkCell {
    x: number;
    y: number;
    sprite: number;
    objectSprite: number;
    flags: number;
    blocked: boolean;
    teleport: boolean;
    wet: boolean;
    moveAllowed: boolean;
}

export interface AmdWalkGrid {
    sizeX: number;
    sizeY: number;
    tileSize: number;
    cells: AmdWalkCell[];
}

function headerInt(headerText: string, key: string): number {
    const tokens = headerText.split(/\s+/).filter((t) => t.length > 0);
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === key && i + 2 < tokens.length) {
            return parseInt(tokens[i + 2], 10);
        }
    }
    return 0;
}

/** True when classic AMD bit 7 is clear — the only server movement check. */
export function isAmdMoveAllowed(flags: number): boolean {
    return (flags & AMD_BLOCKED_FLAG) === 0;
}

export function isAmdWetSprite(sprite: number): boolean {
    return sprite === AMD_WATER_SPRITE || sprite === AMD_SHORE_SPRITE;
}

export function parseAmdWalkGrid(buffer: ArrayBuffer): AmdWalkGrid {
    const bytes = new Uint8Array(buffer);
    const headerText = new TextDecoder('ascii').decode(bytes.subarray(0, AMD_HEADER_SIZE)).replace(/\0/g, ' ');
    const sizeX = headerInt(headerText, 'MAPSIZEX');
    const sizeY = headerInt(headerText, 'MAPSIZEY');
    const tileSize = headerInt(headerText, 'TILESIZE');
    if (sizeX <= 0 || sizeY <= 0 || tileSize < 9) {
        throw new Error(`Invalid .amd header: ${sizeX}x${sizeY} tileSize=${tileSize}`);
    }
    const view = new DataView(buffer);
    const cells: AmdWalkCell[] = new Array(sizeX * sizeY);
    let offset = AMD_HEADER_SIZE;
    for (let y = 0; y < sizeY; y++) {
        for (let x = 0; x < sizeX; x++) {
            const sprite = view.getInt16(offset, true);
            const objectSprite = view.getInt16(offset + 4, true);
            const flags = view.getUint8(offset + 8);
            const blocked = !isAmdMoveAllowed(flags);
            const wet = isAmdWetSprite(sprite);
            cells[y * sizeX + x] = {
                x,
                y,
                sprite,
                objectSprite,
                flags,
                blocked,
                teleport: (flags & AMD_TELEPORT_FLAG) !== 0,
                wet,
                moveAllowed: !blocked,
            };
            offset += tileSize;
        }
    }
    return { sizeX, sizeY, tileSize, cells };
}

export function getAmdWalkCell(grid: AmdWalkGrid, x: number, y: number): AmdWalkCell | undefined {
    if (x < 0 || y < 0 || x >= grid.sizeX || y >= grid.sizeY) {
        return undefined;
    }
    return grid.cells[y * grid.sizeX + x];
}

/**
 * Chebyshev BFS. `walk` defaults to server occupancy (`moveAllowed`).
 * Returns path inclusive of start, or undefined when unreachable.
 */
export function bfsAmdWalk(
    grid: AmdWalkGrid,
    startX: number,
    startY: number,
    isGoal: (x: number, y: number) => boolean,
    walk: (cell: AmdWalkCell) => boolean = (cell) => cell.moveAllowed,
): { steps: number; path: Array<[number, number]> } | undefined {
    const start = getAmdWalkCell(grid, startX, startY);
    if (!start || !walk(start)) {
        return undefined;
    }
    const q: Array<[number, number]> = [[startX, startY]];
    const seen = new Uint8Array(grid.sizeX * grid.sizeY);
    const parent = new Int32Array(grid.sizeX * grid.sizeY).fill(-1);
    seen[startY * grid.sizeX + startX] = 1;
    let head = 0;
    while (head < q.length) {
        const [x, y] = q[head++];
        if (isGoal(x, y)) {
            const path: Array<[number, number]> = [];
            let i = y * grid.sizeX + x;
            while (i >= 0) {
                path.push([i % grid.sizeX, (i / grid.sizeX) | 0]);
                i = parent[i];
            }
            path.reverse();
            return { steps: path.length - 1, path };
        }
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) {
                    continue;
                }
                const nx = x + dx;
                const ny = y + dy;
                const cell = getAmdWalkCell(grid, nx, ny);
                if (!cell || !walk(cell)) {
                    continue;
                }
                const ni = ny * grid.sizeX + nx;
                if (seen[ni]) {
                    continue;
                }
                seen[ni] = 1;
                parent[ni] = y * grid.sizeX + x;
                q.push([nx, ny]);
            }
        }
    }
    return undefined;
}
