/**
 * Body / hair / underwear `.spr` indexes for one motion state.
 *
 * World enter decodes human idle 0–7 only (`idleEntitySheetIndices`). Default
 * play is run + combat stance, whose sheets live at HUMAN base 32 and hair /
 * underwear `style * 12 + 4`. Without a later fetch the idle pose stays bound
 * while `GameObject.move` still interpolates the cell — the sprite slides.
 *
 * Human packs store one facing per sheet. Hair and underwear store every
 * facing inside a single sheet.
 */
export function sheetsForBodyLayerMotion(
    slot: 'human' | 'hair' | 'underwear',
    animationSheetIndex: number,
    direction: number,
): number[] {
    if (!Number.isFinite(animationSheetIndex)) {
        return [];
    }
    if (slot !== 'human') {
        return [animationSheetIndex];
    }
    const dir = Math.trunc(direction);
    if (dir < 0 || dir > 7) {
        return [animationSheetIndex];
    }
    const base = animationSheetIndex - dir;
    const sheets: number[] = [];
    for (let facing = 0; facing < 8; facing += 1) {
        sheets.push(base + facing);
    }
    return sheets;
}
