import { Store } from '@tanstack/react-store';
import type { GroundItemDisplaySize } from '../../constants/GroundItemDisplay';
import {
    GROUND_ITEM_DISPLAY_STORAGE_KEY,
    migrateLegacyDisplayLargeItems,
    parseGroundItemDisplaySize,
} from '../../constants/GroundItemDisplay';
import { mapDialogStore, setGroundItemDisplaySize } from './MapDialog.store';

const STORAGE_KEY = GROUND_ITEM_DISPLAY_STORAGE_KEY;

/** Bag window scale steps (Olympia-style resize). */
export const BAG_SCALE_LEVELS = [0.85, 1, 1.15, 1.3] as const;

export const BAG_BASE_WIDTH = 225;
export const BAG_BASE_HEIGHT = 185;

interface BagSettingsState {
    transparent: boolean;
    scaleIndex: number;
    configMenuOpen: boolean;
}

function clampScaleIndex(index: number): number {
    return Math.max(0, Math.min(BAG_SCALE_LEVELS.length - 1, index));
}

function loadPersistedSettings(): Pick<BagSettingsState, 'transparent' | 'scaleIndex'> & {
    groundItemDisplaySize: GroundItemDisplaySize;
} {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { transparent: false, scaleIndex: 1, groundItemDisplaySize: 'small' };
        }
        const parsed = JSON.parse(raw) as {
            transparent?: boolean;
            scaleIndex?: number;
            groundItemDisplaySize?: unknown;
            displayLargeItems?: boolean;
        };
        const groundItemDisplaySize = parsed.groundItemDisplaySize !== undefined
            ? parseGroundItemDisplaySize(parsed.groundItemDisplaySize)
            : migrateLegacyDisplayLargeItems(parsed.displayLargeItems);
        return {
            transparent: parsed.transparent === true,
            scaleIndex: clampScaleIndex(parsed.scaleIndex ?? 1),
            groundItemDisplaySize,
        };
    } catch {
        return { transparent: false, scaleIndex: 1, groundItemDisplaySize: 'small' };
    }
}

const persisted = loadPersistedSettings();
setGroundItemDisplaySize(persisted.groundItemDisplaySize);

const initialState: BagSettingsState = {
    transparent: persisted.transparent,
    scaleIndex: persisted.scaleIndex,
    configMenuOpen: false,
};

export const bagSettingsStore = new Store<BagSettingsState>(initialState);

function persistSettings(state: BagSettingsState, groundItemDisplaySize: GroundItemDisplaySize) {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                transparent: state.transparent,
                scaleIndex: state.scaleIndex,
                groundItemDisplaySize,
            }),
        );
    } catch {
        // ignore quota / private mode
    }
}

function getCurrentGroundItemDisplaySize(): GroundItemDisplaySize {
    return mapDialogStore.state.groundItemDisplaySize;
}

export const persistBagGroundItemDisplaySize = (groundItemDisplaySize: GroundItemDisplaySize) => {
    persistSettings(bagSettingsStore.state, groundItemDisplaySize);
};

export function getBagScale(state: BagSettingsState = bagSettingsStore.state): number {
    return BAG_SCALE_LEVELS[clampScaleIndex(state.scaleIndex)];
}

export const setBagTransparent = (value: boolean) => {
    bagSettingsStore.setState((state) => {
        const next = { ...state, transparent: value };
        persistSettings(next, getCurrentGroundItemDisplaySize());
        return next;
    });
};

export const increaseBagScale = () => {
    bagSettingsStore.setState((state) => {
        const scaleIndex = clampScaleIndex(state.scaleIndex + 1);
        if (scaleIndex === state.scaleIndex) {
            return state;
        }
        const next = { ...state, scaleIndex };
        persistSettings(next, getCurrentGroundItemDisplaySize());
        return next;
    });
};

export const decreaseBagScale = () => {
    bagSettingsStore.setState((state) => {
        const scaleIndex = clampScaleIndex(state.scaleIndex - 1);
        if (scaleIndex === state.scaleIndex) {
            return state;
        }
        const next = { ...state, scaleIndex };
        persistSettings(next, getCurrentGroundItemDisplaySize());
        return next;
    });
};

export const setBagConfigMenuOpen = (value: boolean) => {
    bagSettingsStore.setState((state) => ({ ...state, configMenuOpen: value }));
};

export const toggleBagConfigMenu = () => {
    bagSettingsStore.setState((state) => ({ ...state, configMenuOpen: !state.configMenuOpen }));
};

