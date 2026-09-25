import {
    normalizeCitizenshipSide,
    normalizeDeskCharacterSlots,
    type CharacterSlotSummary,
} from '../../utils/characterListApi';

export const SELECTCHAR_SLOT_COUNT = 4;

export const SELECTCHAR_LAST_USED_STORAGE_PREFIX = 'cl-selectchar-last:';

export type SelectCharMoveDirection = 'left' | 'right' | 'next' | 'prev';

export interface SelectCharTownMapLines {
    town: string;
    lastMap?: string;
}

/** localStorage key for the last started character on this wallet. */
export function selectCharLastUsedStorageKey(wallet: string): string {
    return `${SELECTCHAR_LAST_USED_STORAGE_PREFIX}${wallet.trim().toLowerCase()}`;
}

export function readLastUsedCharacterName(wallet: string | undefined | null): string | undefined {
    const w = (wallet ?? '').trim();
    if (!w || typeof localStorage === 'undefined') {
        return undefined;
    }
    try {
        const raw = localStorage.getItem(selectCharLastUsedStorageKey(w));
        const name = (raw ?? '').trim();
        return name.length > 0 ? name : undefined;
    } catch {
        return undefined;
    }
}

export function writeLastUsedCharacterName(
    wallet: string | undefined | null,
    characterName: string,
): void {
    const w = (wallet ?? '').trim();
    const name = characterName.trim();
    if (!w || !name || typeof localStorage === 'undefined') {
        return;
    }
    try {
        localStorage.setItem(selectCharLastUsedStorageKey(w), name);
    } catch {
        /* quota / private mode */
    }
}

/** First occupied slot matching `preferredName`, else first occupied, else 0. */
export function resolveRememberedSelectCharIndex(
    slots: CharacterSlotSummary[],
    preferredName: string | undefined,
    fallbackSelected = 0,
): number {
    const occupied = normalizeDeskCharacterSlots(slots).filter((row) => row.name.length > 0);
    if (occupied.length === 0) {
        return clampSelectCharIndex(fallbackSelected);
    }
    const want = (preferredName ?? '').trim().toLowerCase();
    if (want) {
        const remembered = occupied.find((row) => row.name.trim().toLowerCase() === want);
        if (remembered) {
            return remembered.slotIndex;
        }
    }
    return occupied[0].slotIndex;
}

export function clampSelectCharIndex(index: number): number {
    const n = Number(index);
    if (!Number.isFinite(n)) {
        return 0;
    }
    return Math.max(0, Math.min(SELECTCHAR_SLOT_COUNT - 1, Math.trunc(n)));
}

export function moveSelectCharIndex(
    current: number,
    direction: SelectCharMoveDirection,
): number {
    const from = clampSelectCharIndex(current);
    if (direction === 'left' || direction === 'prev') {
        return from === 0 ? SELECTCHAR_SLOT_COUNT - 1 : from - 1;
    }
    return from === SELECTCHAR_SLOT_COUNT - 1 ? 0 : from + 1;
}

/** Keyboard that changes slot focus. Enter is handled separately (start / create). */
export function selectCharIndexFromKeyboardEvent(
    current: number,
    key: string,
    shiftKey = false,
): number | undefined {
    if (key === 'ArrowLeft') {
        return moveSelectCharIndex(current, 'left');
    }
    if (key === 'ArrowRight') {
        return moveSelectCharIndex(current, 'right');
    }
    if (key === 'Tab') {
        return moveSelectCharIndex(current, shiftKey ? 'prev' : 'next');
    }
    return undefined;
}

export function isSelectCharStartKey(key: string): boolean {
    return key === 'Enter';
}

/** Exact name match (trimmed, case-sensitive) required to confirm delete. */
export function canConfirmSelectCharDelete(
    typedName: string,
    characterName: string | undefined,
): boolean {
    const expected = (characterName ?? '').trim();
    if (!expected) {
        return false;
    }
    return typedName.trim() === expected;
}

export function formatSelectCharTown(side: string | undefined | null): string {
    const normalized = normalizeCitizenshipSide(side);
    if (normalized === 'aresden') {
        return 'Aresden';
    }
    if (normalized === 'elvine') {
        return 'Elvine';
    }
    return 'Traveler';
}

export function selectCharTownMapLines(
    occupied: CharacterSlotSummary | undefined,
): SelectCharTownMapLines | undefined {
    if (!occupied) {
        return undefined;
    }
    const lastMap = (occupied.lastMap ?? '').trim();
    return {
        town: formatSelectCharTown(occupied.citizenshipSide),
        lastMap: lastMap.length > 0 ? lastMap : undefined,
    };
}
