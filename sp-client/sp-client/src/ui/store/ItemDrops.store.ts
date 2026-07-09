import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { ITEM_ADD_FROM_GROUND, ITEM_DROPPED_TO_GROUND } from '../../constants/EventNames';
import { ITEMS, ItemEffect, getGlowEffectColor, getGlareEffectColor, type Effect } from '../../constants/Items';

export interface ItemDropLogEntry {
    id: number;
    itemId: number;
    itemName: string;
    timestamp: number;
    isRare: boolean;
    mapName: string;
    source: 'drop' | 'pickup';
}

interface ItemDropsState {
    entries: ItemDropLogEntry[];
}

const STORAGE_KEY = 'hb-item-drops-log';
const MAX_ENTRIES = 50;

function loadEntries(): ItemDropLogEntry[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as ItemDropLogEntry[];
    } catch {
        return [];
    }
}

function persistEntries(entries: ItemDropLogEntry[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

function isNotableItem(itemId: number, effectOverrides?: Effect[]): boolean {
    const item = ITEMS.find((i) => i.id === itemId);
    if (!item) return false;

    if (getGlowEffectColor(item, effectOverrides) !== undefined) return true;
    if (getGlareEffectColor(item, effectOverrides) !== undefined) return true;
    if (item.effects?.some((e) => e.effect === ItemEffect.GLOW || e.effect === ItemEffect.GLARE)) return true;

    // Consumables, high-tier gear, quest reward ids
    if (itemId >= 500) return true;
    if (item.itemType === 'WEAPON' && itemId >= 200) return true;
    if (item.itemType === 'ARMOR' && itemId >= 150) return true;

    return false;
}

let nextId = Date.now();

function addDropLog(
    itemId: number,
    source: ItemDropLogEntry['source'],
    mapName = 'unknown',
    effectOverrides?: Effect[],
): void {
    if (!isNotableItem(itemId, effectOverrides)) return;

    const item = ITEMS.find((i) => i.id === itemId);
    const entry: ItemDropLogEntry = {
        id: nextId++,
        itemId,
        itemName: item?.name ?? `Item #${itemId}`,
        timestamp: Date.now(),
        isRare: true,
        mapName,
        source,
    };

    itemDropsStore.setState((s) => {
        const entries = [entry, ...s.entries].slice(0, MAX_ENTRIES);
        persistEntries(entries);
        return { ...s, entries };
    });
}

const initialState: ItemDropsState = {
    entries: loadEntries(),
};

export const itemDropsStore = new Store<ItemDropsState>(initialState);

export function clearItemDropsLog(): void {
    itemDropsStore.setState({ entries: [] });
    persistEntries([]);
}

EventBus.on(
    ITEM_DROPPED_TO_GROUND,
    (data: { itemId: number; effectOverrides?: Effect[] }) => {
        addDropLog(data.itemId, 'drop', 'current', data.effectOverrides);
    },
);

EventBus.on(
    ITEM_ADD_FROM_GROUND,
    (data: { itemId: number; effectOverrides?: Effect[] }) => {
        addDropLog(data.itemId, 'pickup', 'current', data.effectOverrides);
    },
);