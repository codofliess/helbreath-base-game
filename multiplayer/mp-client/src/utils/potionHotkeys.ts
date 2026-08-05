import type { Game } from 'phaser';
import { EventBus } from '../game/EventBus';
import { ITEM_CONSUMED_REQUESTED, TOAST_REQUESTED } from '../constants/EventNames';
import { getItemById, ItemTypes, type InventoryItem } from '../constants/Items';
import { inventoryDialogStore } from '../ui/store/InventoryDialog.store';
import { getInventoryManager } from './RegistryUtils';

/**
 * Classic Helbreath potion keys:
 * Insert = HP (red), Delete = MP (blue), Home = SP / revi (green).
 * Always prefer small pots first, then big, then super.
 */
const POTION_PRIORITY: Record<'red' | 'blue' | 'green', { ids: number[]; label: string }> = {
    // Small → big → super (prefer smallest first for classic grind economy).
    red: { ids: [91, 92, 840], label: 'Red' },
    blue: { ids: [93, 94, 841], label: 'Blue' },
    green: { ids: [95, 96, 842, 390, 391], label: 'Green' },
};

export type QuickPotionKind = keyof typeof POTION_PRIORITY;

/** Optional Phaser game for live bag snapshot; keyboard/UI may omit it. */
let preferredGame: Game | null = null;

/** Called from HotkeyBar / GameWorld so pot clicks can read the live bag. */
export function setQuickPotionGame(game: Game | null | undefined): void {
    preferredGame = game ?? null;
}

/** Phaser game last registered for hotkeys (Page Up SA, pots, …). */
export function getQuickPotionGame(): Game | null {
    return preferredGame;
}

function resolveLiveBag(): InventoryItem[] {
    if (!preferredGame) {
        return [];
    }
    try {
        return getInventoryManager(preferredGame).baggedItems ?? [];
    } catch {
        return [];
    }
}

function collectBag(): InventoryItem[] {
    const liveBag = resolveLiveBag();
    const storeBag = inventoryDialogStore.state.baggedItems ?? [];
    const byUid = new Map<string, InventoryItem>();
    // Live bag wins last so server-synced state overrides a stale store row.
    for (const b of storeBag) {
        if (b?.itemUid) {
            byUid.set(b.itemUid, b);
        }
    }
    for (const b of liveBag) {
        if (b?.itemUid) {
            byUid.set(b.itemUid, b);
        }
    }
    return [...byUid.values()];
}

/** Consume first matching pot in bag: small → big for the given color. */
export function useQuickPotion(kind: QuickPotionKind): void {
    const { ids, label } = POTION_PRIORITY[kind];
    const bagged = collectBag();
    const idSet = new Set(ids);

    for (const itemId of ids) {
        const bagItem = bagged.find((b) => Number(b.itemId) === itemId);
        if (!bagItem) {
            continue;
        }
        // Soft catalog check — still emit if catalog merge is incomplete (server is authoritative).
        const def = getItemById(bagItem.itemId);
        if (def && def.itemType !== ItemTypes.MISC) {
            continue;
        }
        EventBus.emit(ITEM_CONSUMED_REQUESTED, { item: bagItem });
        return;
    }

    // Fallback: any bag row whose id is in the color list (handles string itemId edge cases).
    const any = bagged.find((b) => idSet.has(Number(b.itemId)));
    if (any) {
        EventBus.emit(ITEM_CONSUMED_REQUESTED, { item: any });
        return;
    }

    EventBus.emit(TOAST_REQUESTED, {
        message: `No ${label} potions in bag.`,
        severity: 'info',
        autoClose: 1500,
    });
}
