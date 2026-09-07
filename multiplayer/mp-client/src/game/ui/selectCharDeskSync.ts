import type { CharacterSlotSummary } from '../../utils/characterListApi';

/** Minimal SELECTCHAR desk surface used by LoginScreen and unit tests. */
export interface SelectCharDeskPaintTarget {
    setCharacterSlots(slots: CharacterSlotSummary[]): void;
    setVisible(visible: boolean): void;
    setSelectedSlotIndex(index: number): void;
    setLoading(loading: boolean): void;
}

export interface SelectCharStorePaintState {
    characterSlots: CharacterSlotSummary[];
    selectedSlotIndex: number;
    characterListLoading: boolean;
}

/**
 * Push occupied (or empty) store slots onto the Phaser desk.
 *
 * Slots are applied before `setVisible(true)` so a deferred visibility rebuild
 * sees Elon, then applied again after visibility so an already-visible desk
 * cannot keep empty shells from the previous `refreshSlotTexts` pass.
 */
export function applyStoreToSelectCharDesk(
    desk: SelectCharDeskPaintTarget,
    state: SelectCharStorePaintState,
): void {
    desk.setCharacterSlots(state.characterSlots);
    desk.setVisible(true);
    desk.setCharacterSlots(state.characterSlots);
    desk.setSelectedSlotIndex(state.selectedSlotIndex);
    desk.setLoading(state.characterListLoading);
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
                    desk.slotIndex === row.slotIndex &&
                    desk.name === row.name &&
                    desk.level === row.level,
            ),
    );
}
