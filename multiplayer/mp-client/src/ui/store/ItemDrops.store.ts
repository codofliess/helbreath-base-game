import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { ITEM_ADD_FROM_GROUND } from '../../constants/EventNames';
import {
    evaluateOlympiaDropCategory,
    evaluateOlympiaDropRarity,
    evaluateOlympiaNftTier,
    isOlympiaNotableDrop,
    olympiaDropCategoryLabel,
    type OlympiaDropCategory,
    type OlympiaNftTier,
} from '../../utils/olympiaDropRules';
import { ITEMS, type Effect } from '../../constants/Items';
import { getOlympiaItemDisplay } from '../../constants/OlympiaItemName';
import { minimapEntitiesStore } from './MinimapEntities.store';

/**
 * F6 Item Drops log — only high-value pickups:
 * Legendary / Stated Armor / Stated Weapon / Rare / Stone
 * (CIC4+, HP·MP·DR·MR≥35, all PA/MA, stones, named endgame).
 *
 * Wired to bag pickups only (not walking past ground piles).
 */

export interface ItemDropLogEntry {
    /** Stable unique row id (string) — never reuse across sessions. */
    id: string;
    itemId: number;
    itemName: string;
    timestamp: number;
    /** True for rare or legendary (always true for log rows). */
    isRare: boolean;
    mapName: string;
    source: 'drop' | 'pickup';
    itemAttribute?: number;
    itemColor?: number;
    nftTier?: OlympiaNftTier;
    /** Bag instance uid when known (pickup); enables exact sell matching. */
    itemUid?: string;
    /** F6 badge: Legendary / Rare / Stated Armor / Stated Weapon / Stone */
    dropCategory?: OlympiaDropCategory;
    dropCategoryLabel?: string;
    cicLevel?: number;
}

interface ItemDropsState {
    entries: ItemDropLogEntry[];
    selectedEntryId: string | undefined;
}

/** Bump when filter rules change so legacy junk rows are purged. */
const STORAGE_KEY = 'hb-item-drops-log-v3';
const MAX_ENTRIES = 50;

let idSeq = 0;

function allocateEntryId(): string {
    idSeq += 1;
    return `drop-${Date.now()}-${idSeq}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeEntry(raw: Partial<ItemDropLogEntry> & { id?: string | number }): ItemDropLogEntry | undefined {
    if (typeof raw.itemId !== 'number' || typeof raw.itemName !== 'string') {
        return undefined;
    }
    const attr = raw.itemAttribute ?? 0;
    const cic = raw.cicLevel ?? 0;
    const category = evaluateOlympiaDropCategory(raw.itemId, attr, cic);
    if (!category) {
        return undefined;
    }
    const tier = evaluateOlympiaNftTier(raw.itemId, attr, cic) ?? raw.nftTier;
    const id =
        raw.id === undefined || raw.id === null || raw.id === ''
            ? allocateEntryId()
            : String(raw.id);
    return {
        id,
        itemId: raw.itemId,
        itemName: raw.itemName,
        timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : Date.now(),
        isRare: true,
        mapName: typeof raw.mapName === 'string' ? raw.mapName : 'unknown',
        source: raw.source === 'drop' ? 'drop' : 'pickup',
        itemAttribute: raw.itemAttribute,
        itemColor: raw.itemColor,
        nftTier: tier ?? undefined,
        itemUid: typeof raw.itemUid === 'string' ? raw.itemUid : undefined,
        dropCategory: category,
        dropCategoryLabel: olympiaDropCategoryLabel(category),
        cicLevel: cic || undefined,
    };
}

function loadEntries(): ItemDropLogEntry[] {
    if (typeof window === 'undefined') {
        return [];
    }
    try {
        // Prefer v2 key; migrate v1 if present.
        const raw =
            localStorage.getItem(STORAGE_KEY) ??
            localStorage.getItem('hb-item-drops-log');
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
            return [];
        }
        const seen = new Set<string>();
        const seenUids = new Set<string>();
        const entries: ItemDropLogEntry[] = [];
        let mutated = false;
        for (const row of parsed) {
            if (!row || typeof row !== 'object') {
                continue;
            }
            const entry = normalizeEntry(row as Partial<ItemDropLogEntry> & { id?: string | number });
            if (!entry) {
                mutated = true;
                continue;
            }
            if (entry.itemUid) {
                if (seenUids.has(entry.itemUid)) {
                    mutated = true;
                    continue;
                }
                seenUids.add(entry.itemUid);
            }
            if (seen.has(entry.id)) {
                entry.id = allocateEntryId();
                mutated = true;
            }
            seen.add(entry.id);
            entries.push(entry);
        }
        const sliced = entries.slice(0, MAX_ENTRIES);
        if (mutated || sliced.length !== entries.length) {
            persistEntries(sliced);
        }
        return sliced;
    } catch {
        return [];
    }
}

function persistEntries(entries: ItemDropLogEntry[]): void {
    if (typeof window === 'undefined') {
        return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

function currentMapName(): string {
    const fromMinimap = minimapEntitiesStore.state.mapName?.trim();
    return fromMinimap || 'unknown';
}

function addDropLog(
    itemId: number,
    source: ItemDropLogEntry['source'],
    effectOverrides?: Effect[],
    itemAttribute?: number,
    itemColor?: number,
    itemUid?: string,
    cicLevel?: number,
): void {
    const attr = itemAttribute ?? 0;
    const cic = cicLevel ?? 0;
    if (!isOlympiaNotableDrop(itemId, effectOverrides, attr, cic)) {
        return;
    }

    // Dedupe same bag instance (re-sync / stack update).
    if (itemUid) {
        const exists = itemDropsStore.state.entries.some((e) => e.itemUid === itemUid);
        if (exists) {
            return;
        }
    }

    const category = evaluateOlympiaDropCategory(itemId, attr, cic);
    if (!category) {
        return;
    }

    const item = ITEMS.find((i) => i.id === itemId);
    const displayName = item
        ? getOlympiaItemDisplay(item.name, attr, itemColor ?? 0, item.itemType).name
        : `Item #${itemId}`;
    const nftTier = evaluateOlympiaNftTier(itemId, attr, cic) ?? undefined;
    const rarity = evaluateOlympiaDropRarity(itemId, attr, cic);

    const entry: ItemDropLogEntry = {
        id: allocateEntryId(),
        itemId,
        itemName: displayName,
        timestamp: Date.now(),
        isRare: rarity !== 'common',
        mapName: currentMapName(),
        source,
        itemAttribute: attr,
        itemColor,
        nftTier,
        itemUid,
        dropCategory: category,
        dropCategoryLabel: olympiaDropCategoryLabel(category),
        cicLevel: cic || undefined,
    };

    itemDropsStore.setState((s) => {
        const entries = [entry, ...s.entries].slice(0, MAX_ENTRIES);
        persistEntries(entries);
        return { ...s, entries, selectedEntryId: entry.id };
    });
}

const initialEntries = loadEntries();
const initialState: ItemDropsState = {
    entries: initialEntries,
    selectedEntryId: initialEntries[0]?.id,
};

export const itemDropsStore = new Store<ItemDropsState>(initialState);

export function clearItemDropsLog(): void {
    itemDropsStore.setState({ entries: [], selectedEntryId: undefined });
    persistEntries([]);
}

export function selectItemDropEntry(entryId: string | undefined): void {
    itemDropsStore.setState((s) => ({ ...s, selectedEntryId: entryId }));
}

export function removeItemDropEntry(entryId: string): void {
    itemDropsStore.setState((s) => {
        const entries = s.entries.filter((e) => e.id !== entryId);
        persistEntries(entries);
        const selectedEntryId =
            s.selectedEntryId === entryId ? entries[0]?.id : s.selectedEntryId;
        return { ...s, entries, selectedEntryId };
    });
}

/**
 * Pickup path only — InventoryManager emits this when a *new* bag row is added
 * (ground loot / loot grants), not when walking past piles or equipping.
 */
EventBus.on(
    ITEM_ADD_FROM_GROUND,
    (data: {
        itemId: number;
        effectOverrides?: Effect[];
        itemAttribute?: number;
        itemColor?: number;
        itemUid?: string;
        cicLevel?: number;
    }) => {
        addDropLog(
            data.itemId,
            'pickup',
            data.effectOverrides,
            data.itemAttribute,
            data.itemColor,
            data.itemUid,
            data.cicLevel,
        );
    },
);
