import { Store } from '@tanstack/react-store';
import type { GroundItemDisplaySize } from '../../constants/GroundItemDisplay';
import {
    GROUND_ITEM_DISPLAY_STORAGE_KEY,
    migrateLegacyDisplayLargeItems,
    parseGroundItemDisplaySize,
} from '../../constants/GroundItemDisplay';
import { mapDialogStore, setGroundItemDisplaySize } from './MapDialog.store';

const STORAGE_KEY = GROUND_ITEM_DISPLAY_STORAGE_KEY;
const BEGINNER_TIP_STORAGE_KEY = 'hb-bag-beginner-tip-seen';

/** Bag window scale steps (Olympia-style resize). */
export const BAG_SCALE_LEVELS = [0.85, 1, 1.15, 1.3] as const;

/** Independent width/height multipliers for the F6 bag panel + pocket. */
export const BAG_DIM_LEVELS = [0.85, 1, 1.15, 1.35] as const;

export const BAG_BASE_WIDTH = 225;
export const BAG_BASE_HEIGHT = 185;

/** Pocket sectors used for client-side drop placement (server routing TODO). */
export type BagSector = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

export const BAG_SECTORS: readonly BagSector[] = [
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
    'center',
] as const;

export const BAG_SECTOR_LABELS: Record<BagSector, string> = {
    'top-left': 'Arriba izq.',
    'top-right': 'Arriba der.',
    'bottom-left': 'Abajo izq.',
    'bottom-right': 'Abajo der.',
    center: 'Centro',
};

interface BagSettingsState {
    transparent: boolean;
    scaleIndex: number;
    widthIndex: number;
    heightIndex: number;
    /** Where general (non-potion) pickups land in the pocket. */
    generalDropSector: BagSector;
    /** Fallback sector for potions when no potion cluster exists yet. */
    potionSector: BagSector;
    /** Stack/arrange potions near where the player already keeps them. */
    potionAutoArrange: boolean;
    configMenuOpen: boolean;
    /** One-shot F6 beginner tip; after true, tip lives only in the gear menu. */
    beginnerTipSeen: boolean;
}

function clampScaleIndex(index: number): number {
    return Math.max(0, Math.min(BAG_SCALE_LEVELS.length - 1, index));
}

function clampDimIndex(index: number): number {
    return Math.max(0, Math.min(BAG_DIM_LEVELS.length - 1, index));
}

function parseBagSector(value: unknown, fallback: BagSector): BagSector {
    if (typeof value === 'string' && (BAG_SECTORS as readonly string[]).includes(value)) {
        return value as BagSector;
    }
    return fallback;
}

function loadBeginnerTipSeen(): boolean {
    try {
        return localStorage.getItem(BEGINNER_TIP_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

function persistBeginnerTipSeen(seen: boolean): void {
    try {
        if (seen) {
            localStorage.setItem(BEGINNER_TIP_STORAGE_KEY, '1');
        } else {
            localStorage.removeItem(BEGINNER_TIP_STORAGE_KEY);
        }
    } catch {
        // ignore quota / private mode
    }
}

function loadPersistedSettings(): Pick<
    BagSettingsState,
    | 'transparent'
    | 'scaleIndex'
    | 'widthIndex'
    | 'heightIndex'
    | 'generalDropSector'
    | 'potionSector'
    | 'potionAutoArrange'
> & {
    groundItemDisplaySize: GroundItemDisplaySize;
} {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return {
                transparent: false,
                scaleIndex: 1,
                widthIndex: 1,
                heightIndex: 1,
                generalDropSector: 'center',
                potionSector: 'bottom-left',
                potionAutoArrange: true,
                groundItemDisplaySize: 'medium' as GroundItemDisplaySize,
            };
        }
        const parsed = JSON.parse(raw) as {
            transparent?: boolean;
            scaleIndex?: number;
            widthIndex?: number;
            heightIndex?: number;
            generalDropSector?: unknown;
            potionSector?: unknown;
            potionAutoArrange?: boolean;
            groundItemDisplaySize?: unknown;
            displayLargeItems?: boolean;
        };
        const groundItemDisplaySize = parsed.groundItemDisplaySize !== undefined
            ? parseGroundItemDisplaySize(parsed.groundItemDisplaySize)
            : migrateLegacyDisplayLargeItems(parsed.displayLargeItems);
        return {
            transparent: parsed.transparent === true,
            scaleIndex: clampScaleIndex(parsed.scaleIndex ?? 1),
            widthIndex: clampDimIndex(parsed.widthIndex ?? 1),
            heightIndex: clampDimIndex(parsed.heightIndex ?? 1),
            generalDropSector: parseBagSector(parsed.generalDropSector, 'center'),
            potionSector: parseBagSector(parsed.potionSector, 'bottom-left'),
            potionAutoArrange: parsed.potionAutoArrange !== false,
            groundItemDisplaySize,
        };
    } catch {
        return {
            transparent: false,
            scaleIndex: 1,
            widthIndex: 1,
            heightIndex: 1,
            generalDropSector: 'center',
            potionSector: 'bottom-left',
            potionAutoArrange: true,
            groundItemDisplaySize: 'medium',
        };
    }
}

const persisted = loadPersistedSettings();
setGroundItemDisplaySize(persisted.groundItemDisplaySize);

const initialState: BagSettingsState = {
    transparent: persisted.transparent,
    scaleIndex: persisted.scaleIndex,
    widthIndex: persisted.widthIndex,
    heightIndex: persisted.heightIndex,
    generalDropSector: persisted.generalDropSector,
    potionSector: persisted.potionSector,
    potionAutoArrange: persisted.potionAutoArrange,
    configMenuOpen: false,
    beginnerTipSeen: loadBeginnerTipSeen(),
};

export const bagSettingsStore = new Store<BagSettingsState>(initialState);

function persistSettings(state: BagSettingsState, groundItemDisplaySize: GroundItemDisplaySize) {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                transparent: state.transparent,
                scaleIndex: state.scaleIndex,
                widthIndex: state.widthIndex,
                heightIndex: state.heightIndex,
                generalDropSector: state.generalDropSector,
                potionSector: state.potionSector,
                potionAutoArrange: state.potionAutoArrange,
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

function commit(next: BagSettingsState): BagSettingsState {
    persistSettings(next, getCurrentGroundItemDisplaySize());
    return next;
}

export const persistBagGroundItemDisplaySize = (groundItemDisplaySize: GroundItemDisplaySize) => {
    persistSettings(bagSettingsStore.state, groundItemDisplaySize);
};

export function getBagScale(state: BagSettingsState = bagSettingsStore.state): number {
    return BAG_SCALE_LEVELS[clampScaleIndex(state.scaleIndex)];
}

export function getBagWidthMult(state: BagSettingsState = bagSettingsStore.state): number {
    return BAG_DIM_LEVELS[clampDimIndex(state.widthIndex)];
}

export function getBagHeightMult(state: BagSettingsState = bagSettingsStore.state): number {
    return BAG_DIM_LEVELS[clampDimIndex(state.heightIndex)];
}

export const setBagTransparent = (value: boolean) => {
    bagSettingsStore.setState((state) => commit({ ...state, transparent: value }));
};

/** Toggles full see-through bag chrome (Helbreath Argentina–style glass bag). */
export const toggleBagTransparent = () => {
    bagSettingsStore.setState((state) => commit({ ...state, transparent: !state.transparent }));
};

export const increaseBagScale = () => {
    bagSettingsStore.setState((state) => {
        const scaleIndex = clampScaleIndex(state.scaleIndex + 1);
        if (scaleIndex === state.scaleIndex) {
            return state;
        }
        return commit({ ...state, scaleIndex });
    });
};

export const decreaseBagScale = () => {
    bagSettingsStore.setState((state) => {
        const scaleIndex = clampScaleIndex(state.scaleIndex - 1);
        if (scaleIndex === state.scaleIndex) {
            return state;
        }
        return commit({ ...state, scaleIndex });
    });
};

export const setBagWidthIndex = (index: number) => {
    bagSettingsStore.setState((state) => {
        const widthIndex = clampDimIndex(index);
        if (widthIndex === state.widthIndex) {
            return state;
        }
        return commit({ ...state, widthIndex });
    });
};

export const setBagHeightIndex = (index: number) => {
    bagSettingsStore.setState((state) => {
        const heightIndex = clampDimIndex(index);
        if (heightIndex === state.heightIndex) {
            return state;
        }
        return commit({ ...state, heightIndex });
    });
};

export const setGeneralDropSector = (sector: BagSector) => {
    bagSettingsStore.setState((state) => commit({ ...state, generalDropSector: sector }));
};

export const setPotionSector = (sector: BagSector) => {
    bagSettingsStore.setState((state) => commit({ ...state, potionSector: sector }));
};

export const setPotionAutoArrange = (value: boolean) => {
    bagSettingsStore.setState((state) => commit({ ...state, potionAutoArrange: value }));
};

export const setBagConfigMenuOpen = (value: boolean) => {
    bagSettingsStore.setState((state) => ({ ...state, configMenuOpen: value }));
};

export const toggleBagConfigMenu = () => {
    bagSettingsStore.setState((state) => ({ ...state, configMenuOpen: !state.configMenuOpen }));
};

/** Marks the inline F6 beginner tip as seen (persisted); tip remains in the gear menu. */
export const markBagBeginnerTipSeen = () => {
    bagSettingsStore.setState((state) => {
        if (state.beginnerTipSeen) {
            return state;
        }
        persistBeginnerTipSeen(true);
        return { ...state, beginnerTipSeen: true };
    });
};
