/**
 * Maps global tile indices (`.amd` sprite ids) to local sheet indexes inside one `.spr` pack.
 * Enter-world must decode only those sheets — a whole maptiles1.spr is tens of Canvas textures.
 */

export function localTileSheetIndices(
    tileStartIndex: number,
    packKey: string,
    globalIndices: Iterable<number>,
    resolvePackKey: (globalIndex: number) => string,
): number[] {
    const locals = new Set<number>();
    for (const idx of globalIndices) {
        if (resolvePackKey(idx) !== packKey) {
            continue;
        }
        const local = idx - tileStartIndex;
        if (local >= 0) {
            locals.add(local);
        }
    }
    return [...locals].sort((a, b) => a - b);
}
