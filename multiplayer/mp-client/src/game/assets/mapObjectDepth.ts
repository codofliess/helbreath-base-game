import { DEPTH_MULTIPLIER } from '../../Config';
import { TILE_SIZE } from '../../constants/TileSize';

/**
 * Y-sort depth for a static map sprite.
 *
 * Pieces are anchored on one tile, but a wall or roof bitmap can hang many
 * rows south of that tile. Sorting by the anchor then loses to a character
 * whose feet are already on the grass under the art (`visualY * 100 +
 * ENTITY_DEPTH_BIAS`). The foot row is the row that contains the sprite's
 * bottom pixel.
 *
 * Bottoms that sit inside the anchor tile — carpets, furniture, and the
 * usual column walls — keep the anchor row. A bottom above the anchor is
 * not pulled north. A spill of a single row (rocks, signs) sorts on that
 * foot row, so a character standing on it stays in front via the entity bias.
 *
 * Taller hangs sort two rows south of the foot pixel. Character feet sit on
 * the north edge of their cell, so the cell just past the bitmap still has
 * its body inside the art, and the +85 bias would paint that body over the
 * wall. Two rows clears that bias; the cell after it stays in front.
 * Trees stay on the anchor row so a drooping canopy does not cover someone
 * standing south of the trunk.
 */
export function mapObjectSortDepth(options: {
    anchorRow: number;
    /** Pivot Y applied to the tile origin (sprite top = anchorPixelY + pivotY). */
    pivotY: number;
    frameHeight: number;
    /** Trees ignore a southern canopy and keep {@link options.anchorRow}. */
    keepAnchorRow?: boolean;
}): number {
    const { anchorRow, pivotY, frameHeight } = options;
    if (options.keepAnchorRow || frameHeight <= 0) {
        return anchorRow * DEPTH_MULTIPLIER;
    }
    const bottomOffset = pivotY + frameHeight;
    // Last pixel still inside the anchor tile (or entirely north of it).
    if (bottomOffset <= TILE_SIZE) {
        return anchorRow * DEPTH_MULTIPLIER;
    }
    const footRow = anchorRow + Math.floor((bottomOffset - 1) / TILE_SIZE);
    if (footRow <= anchorRow + 1) {
        return footRow * DEPTH_MULTIPLIER;
    }
    return (footRow + 2) * DEPTH_MULTIPLIER;
}

/**
 * `map-tile-422` is a walkable wall column whose bitmap ends inside the
 * anchor tile, so {@link mapObjectSortDepth} leaves it there. One extra row
 * still clears a character standing on that tile (entity bias is 85; one
 * row is 100) without covering the next row.
 */
export function mapTileSpriteDepthBias(spriteName: string): number {
    return spriteName === 'map-tile-422' ? DEPTH_MULTIPLIER : 0;
}
