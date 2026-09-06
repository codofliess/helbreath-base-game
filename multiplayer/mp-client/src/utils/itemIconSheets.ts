/**
 * Item-pack / item-ground sheet picks — Phaser-free so node tests can import this.
 */

export function uniqueNonNegativeInts(values: readonly number[]): number[] {
    const set = new Set<number>();
    for (const value of values) {
        if (Number.isInteger(value) && value >= 0) {
            set.add(value);
        }
    }
    return [...set].sort((a, b) => a - b);
}

/** Sheet indexes from already-resolved pack/ground rows (bag, jewelry, one ground pile). */
export function collectItemIconSheetIndices(
    refs: ReadonlyArray<{ sheetIndex?: number } | null | undefined>,
): number[] {
    return uniqueNonNegativeInts(
        refs.map((ref) => (ref && typeof ref.sheetIndex === 'number' ? ref.sheetIndex : -1)),
    );
}
