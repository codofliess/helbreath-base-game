/**
 * Client-side bag drop placement prefs (localStorage via BagSettings).
 *
 * TODO(server): honor generalDropSector / potionAutoArrange in
 * InventoryManager.AllocateBagSlot when pickups are granted, so placement
 * does not need a follow-up moveItemInBagRequest.
 */
import { EventBus } from '../game/EventBus';
import { ITEM_ADD_FROM_GROUND, ITEM_MOVED_TO_BAG } from '../constants/EventNames';
import { ITEMS, ItemTypes, type InventoryItem } from '../constants/Items';
import {
    bagSettingsStore,
    type BagSector,
} from '../ui/store/BagSettings.store';
import { inventoryDialogStore } from '../ui/store/InventoryDialog.store';

/** Classic Olympia pocket size used by server AllocateBagSlot (148×120). */
const BAG_POCKET_WIDTH = 148;
const BAG_POCKET_HEIGHT = 120;
const BAG_PAD = 16;
const CLUSTER_JITTER = 10;

function isPotionItem(itemId: number): boolean {
    const def = ITEMS.find((item) => item.id === itemId);
    if (!def || def.itemType !== ItemTypes.MISC) {
        return false;
    }
    return /potion/i.test(def.name);
}

function sectorAnchor(sector: BagSector, width: number, height: number): { bagX: number; bagY: number } {
    const midX = width / 2;
    const midY = height / 2;
    const left = BAG_PAD + 18;
    const right = width - BAG_PAD - 18;
    const top = BAG_PAD + 18;
    const bottom = height - BAG_PAD - 18;
    switch (sector) {
        case 'top-left':
            return { bagX: left, bagY: top };
        case 'top-right':
            return { bagX: right, bagY: top };
        case 'bottom-left':
            return { bagX: left, bagY: bottom };
        case 'bottom-right':
            return { bagX: right, bagY: bottom };
        case 'center':
        default:
            return { bagX: midX, bagY: midY };
    }
}

function clampPocket(bagX: number, bagY: number): { bagX: number; bagY: number } {
    return {
        bagX: Math.round(Math.max(BAG_PAD, Math.min(BAG_POCKET_WIDTH - BAG_PAD, bagX))),
        bagY: Math.round(Math.max(BAG_PAD, Math.min(BAG_POCKET_HEIGHT - BAG_PAD, bagY))),
    };
}

function potionClusterAnchor(baggedItems: InventoryItem[], excludeUid: string): { bagX: number; bagY: number } | undefined {
    const potions = baggedItems.filter(
        (item) => item.itemUid !== excludeUid && isPotionItem(item.itemId) && item.bagX !== undefined && item.bagY !== undefined,
    );
    if (potions.length === 0) {
        return undefined;
    }
    const sumX = potions.reduce((acc, item) => acc + (item.bagX ?? 0), 0);
    const sumY = potions.reduce((acc, item) => acc + (item.bagY ?? 0), 0);
    return {
        bagX: sumX / potions.length,
        bagY: sumY / potions.length,
    };
}

function resolveTargetPosition(item: InventoryItem, baggedItems: InventoryItem[]): { bagX: number; bagY: number } {
    const settings = bagSettingsStore.state;
    if (isPotionItem(item.itemId)) {
        if (settings.potionAutoArrange) {
            const cluster = potionClusterAnchor(baggedItems, item.itemUid);
            if (cluster) {
                return clampPocket(
                    cluster.bagX + (Math.random() - 0.5) * CLUSTER_JITTER,
                    cluster.bagY + (Math.random() - 0.5) * CLUSTER_JITTER,
                );
            }
        }
        const potionAnchor = sectorAnchor(settings.potionSector, BAG_POCKET_WIDTH, BAG_POCKET_HEIGHT);
        return clampPocket(potionAnchor.bagX, potionAnchor.bagY);
    }

    const generalAnchor = sectorAnchor(settings.generalDropSector, BAG_POCKET_WIDTH, BAG_POCKET_HEIGHT);
    return clampPocket(generalAnchor.bagX, generalAnchor.bagY);
}

function routePickup(itemId: number): void {
    const baggedItems = inventoryDialogStore.state.baggedItems;
    const candidates = baggedItems.filter((item) => item.itemId === itemId);
    const item = candidates[candidates.length - 1];
    if (!item) {
        return;
    }

    const target = resolveTargetPosition(item, baggedItems);
    if (item.bagX === target.bagX && item.bagY === target.bagY) {
        return;
    }

    EventBus.emit(ITEM_MOVED_TO_BAG, {
        itemUid: item.itemUid,
        itemType: ItemTypes.MISC,
        bagX: target.bagX,
        bagY: target.bagY,
    });
}

EventBus.on(ITEM_ADD_FROM_GROUND, (data: { itemId: number }) => {
    // Wait for InventoryDialog.store to append the bagged item from ITEM_ADDED_TO_BAG.
    queueMicrotask(() => {
        routePickup(data.itemId);
    });
});
