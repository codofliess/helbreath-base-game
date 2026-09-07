import {
    normalizeDeskCharacterSlots,
    type CharacterSlotSummary,
} from '../../utils/characterListApi';

/** Minimal SELECTCHAR desk surface used by LoginScreen and unit tests. */
export interface SelectCharDeskPaintTarget {
    setCharacterSlots(slots: CharacterSlotSummary[]): void;
    setVisible(visible: boolean): void;
    setSelectedSlotIndex(index: number): void;
    setLoading(loading: boolean): void;
    getCharacterSlots?(): CharacterSlotSummary[];
    forceRebuild?(): void;
}

export interface SelectCharStorePaintState {
    characterSlots: CharacterSlotSummary[];
    selectedSlotIndex: number;
    characterListLoading: boolean;
}

/**
 * Occupied rows win: EventBus payload, then React store, then CharacterList WS cache.
 * LoginScreen must not re-read an empty store after a late Phaser boot missed the emit.
 */
export function resolveSelectCharSlotsForPaint(
    eventSlots: CharacterSlotSummary[] | undefined,
    storeSlots: CharacterSlotSummary[],
    cachedSlots: CharacterSlotSummary[],
): CharacterSlotSummary[] {
    if (eventSlots && eventSlots.length > 0) {
        return eventSlots;
    }
    if (storeSlots.length > 0) {
        return storeSlots;
    }
    if (cachedSlots.length > 0) {
        return cachedSlots;
    }
    return storeSlots;
}

/** One visual SELECTCHAR card (occupied name/level or Empty / Create Character). */
export interface SelectCharSlotPaintRow {
    name: string;
    lev: string;
    occupied: CharacterSlotSummary | undefined;
}

/**
 * Labels for the 4 desk cards. Occupied rows are claimed onto 0–3 first so a
 * live Elon with a missing/out-of-range slotIndex cannot leave every shell Empty.
 */
export function paintSelectCharSlotRows(slots: CharacterSlotSummary[]): SelectCharSlotPaintRow[] {
    const normalized = normalizeDeskCharacterSlots(slots);
    const rows: SelectCharSlotPaintRow[] = [];
    for (let i = 0; i < 4; i++) {
        const occupied = normalized.find((s) => s.slotIndex === i);
        if (!occupied) {
            rows.push({ name: 'Empty', lev: 'Create Character', occupied: undefined });
            continue;
        }
        const displayName =
            occupied.name.length > 16 ? `${occupied.name.slice(0, 15)}…` : occupied.name;
        const lev =
            occupied.rebirth > 0
                ? `Lev. ${occupied.level} (+${occupied.rebirth})`
                : `Lev. ${occupied.level}`;
        rows.push({ name: displayName, lev, occupied });
    }
    return rows;
}

/** Prefer the store selection when that card is occupied; otherwise the first occupied card. */
export function resolveSelectCharSelectedIndex(
    slots: CharacterSlotSummary[],
    selectedSlotIndex: number,
): number {
    const normalized = normalizeDeskCharacterSlots(slots);
    if (normalized.length === 0) {
        return Math.max(0, Math.min(3, Number(selectedSlotIndex) || 0));
    }
    const selected = Math.max(0, Math.min(3, Number(selectedSlotIndex) || 0));
    if (normalized.some((s) => s.slotIndex === selected)) {
        return selected;
    }
    return normalized[0].slotIndex;
}

/**
 * Push occupied (or empty) store slots onto the Phaser desk.
 *
 * Slots are applied before `setVisible(true)` so a deferred visibility rebuild
 * sees Elon, then applied again after visibility so an already-visible desk
 * cannot keep empty shells from the previous `refreshSlotTexts` pass.
 * Occupied paints always `forceRebuild` so Phaser Text children cannot keep
 * the Empty/Create glyphs after the store already has Elon.
 */
export function applyStoreToSelectCharDesk(
    desk: SelectCharDeskPaintTarget,
    state: SelectCharStorePaintState,
): void {
    const characterSlots = normalizeDeskCharacterSlots(state.characterSlots);
    const selectedSlotIndex = resolveSelectCharSelectedIndex(
        characterSlots,
        state.selectedSlotIndex,
    );
    desk.setCharacterSlots(characterSlots);
    desk.setVisible(true);
    desk.setCharacterSlots(characterSlots);
    desk.setSelectedSlotIndex(selectedSlotIndex);
    desk.setLoading(state.characterListLoading);
    const painted = desk.getCharacterSlots?.() ?? characterSlots;
    if (
        characterSlots.length > 0 ||
        selectCharDeskIsMissingOccupiedSlots(characterSlots, painted)
    ) {
        desk.setCharacterSlots(characterSlots);
        desk.forceRebuild?.();
    }
}

/** True when the Phaser desk is missing an occupied row the React store already has. */
export function selectCharDeskIsMissingOccupiedSlots(
    storeSlots: CharacterSlotSummary[],
    deskSlots: CharacterSlotSummary[],
): boolean {
    if (storeSlots.length === 0) {
        return false;
    }
    if (deskSlots.length === 0) {
        return true;
    }
    return storeSlots.some(
        (row) =>
            !deskSlots.some(
                (desk) =>
                    Number(desk.slotIndex) === Number(row.slotIndex) &&
                    desk.name === row.name &&
                    desk.level === row.level,
            ),
    );
}
