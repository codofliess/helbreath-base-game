/**
 * Phaser-free `.amd` cell reader for enter-path tests (stream pack counts, live HTTP).
 * Matches HBMapTile: Int16 sprite/frame/object/frame at TILESIZE 10.
 */

export interface AmdCellSprites {
    sprite: number;
    objectSprite: number;
}

export interface AmdMapCells {
    sizeX: number;
    sizeY: number;
    tileSize: number;
    tiles: AmdCellSprites[][];
}

export function parseAmdMapCells(buffer: ArrayBuffer): AmdMapCells {
    const bytes = new Uint8Array(buffer);
    const headerText = new TextDecoder('ascii').decode(bytes.subarray(0, 256)).replace(/\0/g, ' ');
    const tokens = headerText.split(/\s+/).filter((t) => t.length > 0);
    let sizeX = 0;
    let sizeY = 0;
    let tileSize = 0;
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === 'MAPSIZEX' && i + 2 < tokens.length) {
            sizeX = parseInt(tokens[i + 2], 10);
        }
        if (tokens[i] === 'MAPSIZEY' && i + 2 < tokens.length) {
            sizeY = parseInt(tokens[i + 2], 10);
        }
        if (tokens[i] === 'TILESIZE' && i + 2 < tokens.length) {
            tileSize = parseInt(tokens[i + 2], 10);
        }
    }
    if (sizeX <= 0 || sizeY <= 0 || tileSize < 8) {
        throw new Error(`Invalid .amd header: ${sizeX}x${sizeY} tileSize=${tileSize}`);
    }
    const view = new DataView(buffer);
    const tiles: AmdCellSprites[][] = new Array(sizeY);
    let offset = 256;
    for (let y = 0; y < sizeY; y++) {
        const row: AmdCellSprites[] = new Array(sizeX);
        for (let x = 0; x < sizeX; x++) {
            row[x] = {
                sprite: view.getInt16(offset, true),
                objectSprite: view.getInt16(offset + 4, true),
            };
            offset += tileSize;
        }
        tiles[y] = row;
    }
    return { sizeX, sizeY, tileSize, tiles };
}
