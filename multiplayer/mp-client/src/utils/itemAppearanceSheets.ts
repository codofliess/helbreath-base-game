import { getItemByEquippedSprite, ItemTypes } from '../constants/Items';

/**
 * Weapon idle-peace is one sheet per facing (base + 0..7).
 * Soft-walk / combat sheets stay on-demand — dumping 0–7 of every armour pack OOMs Elvine F5.
 */
export const WEAPON_SETTLE_SHEETS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Armour / shield / cape / boots: IdlePeace=0, WalkPeace=2 (ARMOUR_SPRITESHEET_BASE).
 * Sheets 1,3–7 are combat/run/bow — not needed to stand, open F5, or soft-walk.
 */
export const ARMOUR_SETTLE_SHEETS = [0, 2] as const;

/** Angel idle-peace uses state 5 × 8 facings (sheets 40–47). */
export const ACCESSORY_SETTLE_SHEETS = [40, 41, 42, 43, 44, 45, 46, 47] as const;

export type PaperDollLayerKind = 'human' | 'armour' | 'weapon' | 'shield' | 'accessory';

function uniqueSorted(sheets: readonly number[]): number[] {
    return [...new Set(sheets)].sort((a, b) => a - b);
}

/**
 * Idle (+ walk for armour) sheets after map settle. Never the full 0–7 combat dump for clothes.
 */
export function settleAppearanceSheetIndices(spriteName: string): Set<number> {
    const item = getItemByEquippedSprite(spriteName);
    if (!item) {
        return new Set(ARMOUR_SETTLE_SHEETS);
    }
    switch (item.itemType) {
        case ItemTypes.WEAPON:
            return new Set(WEAPON_SETTLE_SHEETS);
        case ItemTypes.ACCESSORY:
            return new Set(ACCESSORY_SETTLE_SHEETS);
        default:
            return new Set(ARMOUR_SETTLE_SHEETS);
    }
}

/**
 * F5 idle-south composite only. One sheet per layer — not settle 0–7.
 * Armour: pack + IdlePeace(0). Weapon: pack + south(4). Shield: pack + idle state.
 * Accessory: angel idle-peace south (5*8+4).
 */
export function paperDollLayerSheetIndices(kind: PaperDollLayerKind, sheetPack: number): number[] {
    const pack = Math.max(0, sheetPack);
    switch (kind) {
        case 'human':
            return [4];
        case 'armour':
            return [pack];
        case 'weapon':
            return [pack + 4];
        case 'shield':
            return [pack];
        case 'accessory':
            return [40 + 4];
        default:
            return [pack];
    }
}

export function paperDollPendingGearJobs(
    layers: ReadonlyArray<{ kind: PaperDollLayerKind; spriteName: string; sheetPack: number }>,
    baseNames: ReadonlySet<string>,
): Array<{ name: string; sheets: number[] }> {
    const byName = new Map<string, Set<number>>();
    for (const layer of layers) {
        if (baseNames.has(layer.spriteName)) {
            continue;
        }
        const sheets = paperDollLayerSheetIndices(layer.kind, layer.sheetPack);
        const existing = byName.get(layer.spriteName) ?? new Set<number>();
        for (const sheet of sheets) {
            existing.add(sheet);
        }
        byName.set(layer.spriteName, existing);
    }
    return [...byName.entries()].map(([name, sheets]) => ({
        name,
        sheets: uniqueSorted([...sheets]),
    }));
}
