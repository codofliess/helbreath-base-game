import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { OUT_UI_HOVER_GROUND_ITEM_INFO } from '../../constants/EventNames';
import { ItemTypes } from '../../constants/Items';
import { Gender } from '../../Types';

export interface InventoryItemHoverInfo {
    itemName: string;
    /** Olympia magic stat line (primary shard). */
    magicStatLine1?: string;
    /** Olympia magic stat line (secondary fragment). */
    magicStatLine2?: string;
    /**
     * Full Olympia PutString block after the name (magic + Item.cfg characteristics).
     * Prefer this over magicStatLine1/2 when present.
     */
    detailLines?: string[];
    /** Colored name for magic items (Olympia green or itemColor palette). */
    itemNameColor?: string;
    itemType: ItemTypes;
    itemId: number;
    itemUid: string;
    /** When 'ground', overlay uses 90% opacity (e.g. for GroundItem). */
    source?: 'ground' | 'inventory' | 'equipped' | 'warehouse';
    /** When set, item is gender-specific (e.g. female-only Chemise). */
    gender?: Gender;
    /** When set and item is stackable, displayed as Quantity. */
    quantity?: number;
    /** When true, Quantity row is shown. */
    stackable?: boolean;
    /** When true, item is consumable (double-click to use). */
    consumable?: boolean;
    /** Hex color for GLOW effect (base or overridden). Shown as "Appearance glow" when set. */
    appearanceGlowColor?: number;
    /** Hex color for GLARE effect (base or overridden). Shown as "Appearance glare" when set. */
    appearanceGlareColor?: number;
    /** Hex color for TINT_APPEARANCE effect (base or overridden). Shown as "Appearance tint" when set. */
    appearanceTintColor?: number;
    /** Hex color for TINT_INVENTORY effect (base or overridden). Shown as "Inventory tint" when set. */
    inventoryTintColor?: number;
    mouseX: number;
    mouseY: number;
}

interface InventoryItemHoverOverlayState {
    hoverInfo: InventoryItemHoverInfo | undefined;
    /** When true, overlay does not render (e.g. when inventory context menu is open). */
    suppressOverlay: boolean;
    /**
     * Click-selected bag item: keep PutString detail until explicit clear.
     * Blocks ground-hover and mouseLeave from wiping the pin.
     */
    pinned: boolean;
}

const initialState: InventoryItemHoverOverlayState = {
    hoverInfo: undefined,
    suppressOverlay: false,
    pinned: false,
};

export const inventoryItemHoverOverlayStore = new Store<InventoryItemHoverOverlayState>(initialState);

export const setInventoryItemHoverInfo = (hoverInfo: InventoryItemHoverInfo | undefined) => {
    inventoryItemHoverOverlayStore.setState((state) => {
        // Pinned bag selection must not be overwritten by transient hover/ground clears.
        if (state.pinned) {
            if (hoverInfo === undefined) {
                return state;
            }
            if (hoverInfo.source === 'ground') {
                return state;
            }
            // Allow updating the same pinned item's cursor position / stats.
            if (state.hoverInfo && hoverInfo.itemUid !== state.hoverInfo.itemUid) {
                return { ...state, hoverInfo, pinned: true };
            }
            return { ...state, hoverInfo };
        }
        return { ...state, hoverInfo, pinned: false };
    });
};

/** Pin Olympia GetItemName overlay after a bag click (no drag). */
export const pinInventoryItemHoverInfo = (hoverInfo: InventoryItemHoverInfo) => {
    inventoryItemHoverOverlayStore.setState({
        hoverInfo,
        pinned: true,
        suppressOverlay: false,
    });
};

/** Clear pinned/hover detail (click-away, Escape, dialog close). */
export const clearInventoryItemHoverInfo = () => {
    inventoryItemHoverOverlayStore.setState({
        hoverInfo: undefined,
        pinned: false,
        suppressOverlay: false,
    });
};

export const setInventoryItemHoverOverlaySuppressed = (suppressed: boolean) => {
    inventoryItemHoverOverlayStore.setState((state) => ({ ...state, suppressOverlay: suppressed }));
};

EventBus.on(OUT_UI_HOVER_GROUND_ITEM_INFO, (hoverInfo: InventoryItemHoverInfo | undefined) => {
    setInventoryItemHoverInfo(hoverInfo);
});
