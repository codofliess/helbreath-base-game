import { getItemByEquippedSprite, ItemTypes, type EquipmentSlot, type InventoryItem } from '../constants/Items';
import { Gender, SkinColor } from '../Types';

/**
 * Weapon idle-peace is one sheet per facing (pack + 0..7).
 * Soft-walk / combat sheets stay on-demand — dumping 0–7 of every armour pack OOMs Elvine F5.
 */
export const WEAPON_SETTLE_SHEETS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Armour / shield / cape / boots (`ARMOUR_SPRITESHEET_BASE` / shield `ARMAMENT_STATE_INDEX`):
 * IdlePeace=0, IdleCombat=1, WalkPeace=2, WalkCombat=3.
 * `Player.attackMode` defaults true, so stand uses sheet 1 and soft-walk uses sheet 3.
 * PR #59 `{0,2}` omitted those combat-stance sheets → partial Hauberk + missing bind after equip.
 * Sheets 4–11 are run/bow/melee/cast/death — not needed to stand, open F5, or soft-walk.
 */
export const ARMOUR_SETTLE_SHEETS = [0, 1, 2, 3] as const;

/** Angel idle-peace uses state 5 × 8 facings (sheets 40–47). */
export const ACCESSORY_SETTLE_SHEETS = [40, 41, 42, 43, 44, 45, 46, 47] as const;

export type PaperDollLayerKind = 'human' | 'armour' | 'weapon' | 'shield' | 'accessory';

export type SettleAppearanceOptions = {
    /**
     * Weapon/shield pack offset (`startSpriteSheetIndex`). Clothes/hauberk are 0.
     * Must be the equipped item’s offset — `getItemByEquippedSprite('msh')` returns the first shield (0).
     */
    packBase?: number;
};

function uniqueSorted(sheets: readonly number[]): number[] {
    return [...new Set(sheets)].sort((a, b) => a - b);
}

function offsetSheets(bases: readonly number[], packBase: number): Set<number> {
    const pack = Math.max(0, packBase);
    return new Set(bases.map((sheet) => sheet + pack));
}

/**
 * Stand + soft-walk sheets after map settle.
 * Clothes: idle/walk × peace/combat (never run/bow/melee 4–7).
 * Weapons/shields: same states, shifted by {@link SettleAppearanceOptions.packBase}.
 */
export function settleAppearanceSheetIndices(
    spriteName: string,
    options?: SettleAppearanceOptions,
): Set<number> {
    const item = getItemByEquippedSprite(spriteName);
    const packBase = Math.max(0, options?.packBase ?? 0);
    if (!item) {
        return offsetSheets(ARMOUR_SETTLE_SHEETS, packBase);
    }
    switch (item.itemType) {
        case ItemTypes.WEAPON:
            return offsetSheets(WEAPON_SETTLE_SHEETS, packBase);
        case ItemTypes.ACCESSORY:
            return new Set(ACCESSORY_SETTLE_SHEETS);
        default:
            return offsetSheets(ARMOUR_SETTLE_SHEETS, packBase);
    }
}

/**
 * F5 idle-south composite only. One sheet per layer — not settle 0–3.
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

/** Stable F5 look key — object identity of `equippedItems` must not restart capture bursts. */
export function paperDollLookKey(
    gender: Gender,
    skinColor: SkinColor,
    hairStyleIndex: number,
    underwearColorIndex: number,
    equippedItems: Partial<Record<EquipmentSlot, InventoryItem>>,
): string {
    const parts: string[] = [
        String(gender),
        String(skinColor),
        String(hairStyleIndex),
        String(underwearColorIndex),
    ];
    const slots = Object.keys(equippedItems).sort();
    for (const s of slots) {
        const it = equippedItems[s as EquipmentSlot];
        if (!it) {
            continue;
        }
        parts.push(
            `${s}:${it.itemId}:${it.itemUid ?? 0}:${it.itemAttribute ?? 0}:${it.itemColor ?? 0}`,
        );
    }
    return parts.join('|');
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
