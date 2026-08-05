import { OLYMPIA_ITEM_STATS } from '../constants/OlympiaItemStats.generated';
import type { EquipmentSlot, InventoryItem } from '../constants/Items';
import { inventoryDialogStore } from '../ui/store/InventoryDialog.store';
import { characterDialogStore, setCharacterStats } from '../ui/store/CharacterDialog.store';

/** Gold catalog id — always weighs 1 raw unit total (any stack size). */
export const GOLD_ITEM_ID = 90;

/** Olympia raw weight for one unit of catalog id (0 when unknown). */
export function itemWeightRaw(itemId: number): number {
    const stats = OLYMPIA_ITEM_STATS[itemId];
    return stats && stats.weight > 0 ? stats.weight : 0;
}

/**
 * Stack weight in raw units. Mirrors server ItemWeightCatalog.GetStackWeight.
 * Gold (90): always 1 regardless of quantity. Other: weight × qty.
 */
export function itemStackWeightRaw(itemId: number, quantity: number): number {
    if (itemId === GOLD_ITEM_ID) {
        return 1;
    }
    const qty = Math.max(1, quantity);
    const raw = itemWeightRaw(itemId) * qty;
    if (raw <= 0) {
        return itemWeightRaw(itemId) > 0 ? 1 : 0;
    }
    return raw;
}

/** Max carry stones: (Str + Level) × 5. */
export function maxCarryWeightStones(str: number, level: number): number {
    return Math.max(1, str) * 5 + Math.max(1, level) * 5;
}

/** Current carry stones from bag + equip (raw sum rounded up to stones). */
export function currentCarryWeightStones(
    baggedItems: InventoryItem[],
    equippedItems: Partial<Record<EquipmentSlot, InventoryItem>>,
): number {
    let raw = 0;
    for (const item of baggedItems) {
        raw += itemStackWeightRaw(item.itemId, item.quantity ?? 1);
    }
    for (const item of Object.values(equippedItems)) {
        if (item) {
            raw += itemStackWeightRaw(item.itemId, 1);
        }
    }
    return Math.max(0, Math.ceil(raw / 100));
}

/** Recompute bag footer / F11 weight from local inventory + stats. */
export function refreshCarryWeightUi(): void {
    const inv = inventoryDialogStore.state;
    const stats = characterDialogStore.state.stats;
    const weight = currentCarryWeightStones(inv.baggedItems, inv.equippedItems);
    const maxWeight = maxCarryWeightStones(stats.str, stats.level);
    if (stats.weight !== weight || stats.maxWeight !== maxWeight) {
        setCharacterStats({ weight, maxWeight });
    }
}
