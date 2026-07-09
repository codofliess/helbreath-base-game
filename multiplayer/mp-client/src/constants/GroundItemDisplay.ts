export type GroundItemDisplaySize = 'small' | 'medium' | 'large';

export const GROUND_ITEM_DISPLAY_SIZES: GroundItemDisplaySize[] = ['small', 'medium', 'large'];

export const GROUND_ITEM_DISPLAY_LABELS: Record<GroundItemDisplaySize, string> = {
    small: 'Chico',
    medium: 'Mediano',
    large: 'Grande',
};

export interface GroundItemDisplayConfig {
    spritePrefix: 'item-ground' | 'item-pack';
    displayScale: number;
}

/** Visual config for ground drops at each user-selected size tier. */
export const GROUND_ITEM_DISPLAY_CONFIG: Record<GroundItemDisplaySize, GroundItemDisplayConfig> = {
    small: { spritePrefix: 'item-ground', displayScale: 1 },
    medium: { spritePrefix: 'item-pack', displayScale: 0.72 },
    large: { spritePrefix: 'item-pack', displayScale: 1 },
};

/** Bag icon pixel size aligned with the ground item size preference. */
export const BAG_ITEM_DISPLAY_SIZE_PX: Record<GroundItemDisplaySize, number> = {
    small: 34,
    medium: 40,
    large: 48,
};

export function parseGroundItemDisplaySize(value: unknown): GroundItemDisplaySize {
    if (value === 'medium' || value === 'large') {
        return value;
    }
    return 'small';
}

/** Migrates legacy boolean `displayLargeItems` from older saves. */
export function migrateLegacyDisplayLargeItems(legacy?: boolean): GroundItemDisplaySize {
    return legacy === true ? 'large' : 'small';
}

export const GROUND_ITEM_DISPLAY_STORAGE_KEY = 'hb-bag-settings-v1';

export function persistGroundItemDisplaySize(
    size: GroundItemDisplaySize,
    storageKey: string = GROUND_ITEM_DISPLAY_STORAGE_KEY,
): void {
    try {
        const raw = localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) as Record<string, unknown> : {};
        localStorage.setItem(
            storageKey,
            JSON.stringify({ ...parsed, groundItemDisplaySize: size }),
        );
    } catch {
        // ignore quota / private mode
    }
}

export function loadGroundItemDisplaySizeFromStorage(storageKey: string): GroundItemDisplaySize {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
            return 'small';
        }
        const parsed = JSON.parse(raw) as {
            groundItemDisplaySize?: unknown;
            displayLargeItems?: boolean;
        };
        if (parsed.groundItemDisplaySize !== undefined) {
            return parseGroundItemDisplaySize(parsed.groundItemDisplaySize);
        }
        return migrateLegacyDisplayLargeItems(parsed.displayLargeItems);
    } catch {
        return 'small';
    }
}