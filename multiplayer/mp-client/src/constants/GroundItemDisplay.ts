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

/**
 * Bag icon max edge at OLYMPIA_UI_SCALE=1.
 * These caps match the pre-2026-07 gold display size (do NOT inflate further).
 * Gold keeps its natural size (only down-clamped). Other items upscale to that gold edge.
 */
export const BAG_ITEM_DISPLAY_SIZE_PX: Record<GroundItemDisplaySize, number> = {
    small: 40,
    medium: 48,
    large: 56,
};

/** Absolute max bag icon edge at OLYMPIA_UI_SCALE=1 regardless of ground-size tier. */
export const BAG_ITEM_DISPLAY_MAX_PX = 56;

/** Catalog id for Gold — visual reference size for other bag icons. */
export const BAG_GOLD_ITEM_ID = 90;

export function parseGroundItemDisplaySize(value: unknown): GroundItemDisplaySize {
    if (value === 'small' || value === 'large') {
        return value;
    }
    return 'medium';
}

/** Migrates legacy boolean `displayLargeItems` from older saves. */
export function migrateLegacyDisplayLargeItems(legacy?: boolean): GroundItemDisplaySize {
    return legacy === false ? 'small' : 'large';
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
            return 'medium';
        }
        const parsed = JSON.parse(raw) as {
            groundItemDisplaySize?: unknown;
            displayLargeItems?: boolean;
        };
        if (parsed.groundItemDisplaySize !== undefined) {
            return parseGroundItemDisplaySize(parsed.groundItemDisplaySize);
        }
        return 'medium';
    } catch {
        return 'medium';
    }
}