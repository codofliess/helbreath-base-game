import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { ITEM_CONSUMED_REQUESTED, ITEM_EQUIP_REQUESTED, TOAST_REQUESTED } from '../../constants/EventNames';
import { ITEMS, ItemTypes } from '../../constants/Items';
import { getSpellById } from '../../constants/Spells';
import { castSpellById } from './CastDialog.store';
import { inventoryDialogStore } from './InventoryDialog.store';

/** F1–F3 shortcut payload (Helbreath: item bag-id or magic+100). */
export type ShortCutBinding =
    | { kind: 'spell'; spellId: number }
    | { kind: 'item'; itemId: number };

type ShortCutSlot = 1 | 2 | 3;

interface ShortCutState {
    /** Last selected spell/item — Ctrl+Fn binds this into a slot. */
    recent: ShortCutBinding | undefined;
    slots: Record<ShortCutSlot, ShortCutBinding | undefined>;
}

const STORAGE_KEY = 'olympia-shortcuts-f1-f3';

function isSlot(n: number): n is ShortCutSlot {
    return n === 1 || n === 2 || n === 3;
}

function parseBinding(raw: unknown): ShortCutBinding | undefined {
    if (!raw || typeof raw !== 'object') {
        return undefined;
    }
    const obj = raw as { kind?: string; spellId?: number; itemId?: number };
    if (obj.kind === 'spell' && typeof obj.spellId === 'number') {
        return { kind: 'spell', spellId: obj.spellId };
    }
    if (obj.kind === 'item' && typeof obj.itemId === 'number') {
        return { kind: 'item', itemId: obj.itemId };
    }
    return undefined;
}

function loadSlots(): Record<ShortCutSlot, ShortCutBinding | undefined> {
    const empty: Record<ShortCutSlot, ShortCutBinding | undefined> = {
        1: undefined,
        2: undefined,
        3: undefined,
    };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return empty;
        }
        const parsed = JSON.parse(raw) as { slots?: Record<string, unknown> };
        return {
            1: parseBinding(parsed.slots?.['1']),
            2: parseBinding(parsed.slots?.['2']),
            3: parseBinding(parsed.slots?.['3']),
        };
    } catch {
        return empty;
    }
}

function persistSlots(slots: Record<ShortCutSlot, ShortCutBinding | undefined>) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ slots }));
    } catch {
        // ignore quota / private mode
    }
}

const initialState: ShortCutState = {
    recent: undefined,
    slots: loadSlots(),
};

export const shortCutStore = new Store<ShortCutState>(initialState);

function toast(message: string) {
    EventBus.emit(TOAST_REQUESTED, { message, severity: 'info' });
}

function bindingLabel(binding: ShortCutBinding): string {
    if (binding.kind === 'spell') {
        const spell = getSpellById(binding.spellId);
        return spell?.name.replace(/-/g, ' ') ?? `Spell ${binding.spellId}`;
    }
    const item = ITEMS.find((i) => i.id === binding.itemId);
    return item?.name ?? `Item ${binding.itemId}`;
}

/** Remember last clicked/cast spell or bag item for Ctrl+F1–F3. */
export function setRecentShortCut(binding: ShortCutBinding) {
    shortCutStore.setState((state) => ({ ...state, recent: binding }));
}

/**
 * Ctrl+Fn — bind recent selection into slot (Client.cpp UseShortCut with Ctrl).
 * Plain Fn — equip/use item or cast spell (Client.cpp UseShortCut).
 */
export function useShortCut(slot: number) {
    if (!isSlot(slot)) {
        return;
    }

    const binding = shortCutStore.state.slots[slot];
    if (!binding) {
        toast(`No shortcut on F${slot}. Select a spell/item, then Ctrl+F${slot}.`);
        return;
    }

    if (binding.kind === 'spell') {
        castSpellById(binding.spellId);
        return;
    }

    const bagItem = inventoryDialogStore.state.baggedItems.find((b) => b.itemId === binding.itemId);
    if (!bagItem) {
        toast(`${bindingLabel(binding)} is not in your bag.`);
        return;
    }
    const itemDef = ITEMS.find((i) => i.id === bagItem.itemId);
    if (!itemDef) {
        return;
    }
    if (itemDef.itemType === ItemTypes.MISC && itemDef.consumable) {
        EventBus.emit(ITEM_CONSUMED_REQUESTED, { item: bagItem });
        return;
    }
    if (itemDef.itemType === ItemTypes.MISC) {
        toast(`${itemDef.name} cannot be used from a shortcut.`);
        return;
    }
    EventBus.emit(ITEM_EQUIP_REQUESTED, { item: bagItem, itemType: itemDef.itemType });
}

/** Ctrl+F1–F3 — assign {@link shortCutStore}.recent into the slot. */
export function bindShortCut(slot: number) {
    if (!isSlot(slot)) {
        return;
    }
    const recent = shortCutStore.state.recent;
    if (!recent) {
        toast(`Select a spell or bag item first, then Ctrl+F${slot}.`);
        return;
    }
    shortCutStore.setState((state) => {
        const slots = { ...state.slots, [slot]: recent };
        persistSlots(slots);
        return { ...state, slots };
    });
    toast(`${bindingLabel(recent)} → F${slot}`);
}
