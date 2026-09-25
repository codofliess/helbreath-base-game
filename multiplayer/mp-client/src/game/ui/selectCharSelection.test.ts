import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CharacterSlotSummary } from '../../utils/characterListApi';
import { Gender, SkinColor } from '../../Types';
import { selectCharAvatarLookFromSlot } from './selectCharAvatarLook';
import {
    canConfirmSelectCharDelete,
    clampSelectCharIndex,
    formatSelectCharTown,
    moveSelectCharIndex,
    readLastUsedCharacterName,
    resolveRememberedSelectCharIndex,
    selectCharIndexFromKeyboardEvent,
    selectCharLastUsedStorageKey,
    selectCharTownMapLines,
    writeLastUsedCharacterName,
} from './selectCharSelection';

function slot(partial: Partial<CharacterSlotSummary> & Pick<CharacterSlotSummary, 'slotIndex' | 'name'>): CharacterSlotSummary {
    return {
        level: 1,
        exp: 0,
        rebirth: 0,
        hoursPlayed: 0,
        str: 10,
        vit: 10,
        dex: 10,
        intel: 10,
        mag: 10,
        chr: 10,
        gender: 0,
        skinColor: 0,
        hairStyleIndex: 0,
        underwearColorIndex: 0,
        citizenshipSide: 'aresden',
        ...partial,
    };
}

function installMemoryStorage() {
    const mem = new Map<string, string>();
    const storage = {
        getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
        setItem: (k: string, v: string) => {
            mem.set(String(k), String(v));
        },
        removeItem: (k: string) => {
            mem.delete(String(k));
        },
    };
    (globalThis as { localStorage?: typeof storage }).localStorage = storage;
    return storage;
}

describe('selectChar selection', () => {
    it('moves Left/Right and Tab/Shift+Tab around four slots', () => {
        assert.equal(moveSelectCharIndex(0, 'right'), 1);
        assert.equal(moveSelectCharIndex(3, 'right'), 0);
        assert.equal(moveSelectCharIndex(0, 'left'), 3);
        assert.equal(selectCharIndexFromKeyboardEvent(1, 'ArrowLeft'), 0);
        assert.equal(selectCharIndexFromKeyboardEvent(1, 'ArrowRight'), 2);
        assert.equal(selectCharIndexFromKeyboardEvent(2, 'Tab', false), 3);
        assert.equal(selectCharIndexFromKeyboardEvent(2, 'Tab', true), 1);
        assert.equal(selectCharIndexFromKeyboardEvent(0, 'Enter'), undefined);
        assert.equal(clampSelectCharIndex(99), 3);
        assert.equal(clampSelectCharIndex(-2), 0);
    });

    it('click target is the slot index itself (0–3)', () => {
        assert.equal(clampSelectCharIndex(2), 2);
    });

    it('preselects the last used character for this wallet', () => {
        installMemoryStorage();
        const wallet = '4R7FsyC8wallet111111111111111111111';
        const slots = [
            slot({ slotIndex: 0, name: 'Co2', level: 150 }),
            slot({ slotIndex: 1, name: 'BebaMaster', level: 1, citizenshipSide: 'elvine' }),
        ];
        writeLastUsedCharacterName(wallet, 'BebaMaster');
        assert.equal(readLastUsedCharacterName(wallet), 'BebaMaster');
        assert.equal(selectCharLastUsedStorageKey(wallet), `cl-selectchar-last:${wallet.toLowerCase()}`);
        assert.equal(resolveRememberedSelectCharIndex(slots, readLastUsedCharacterName(wallet)), 1);
        assert.equal(resolveRememberedSelectCharIndex(slots, 'Missing'), 0);
        assert.equal(resolveRememberedSelectCharIndex([], 'Co2'), 0);
    });

    it('requires an exact typed name to confirm delete', () => {
        assert.equal(canConfirmSelectCharDelete('Co2', 'Co2'), true);
        assert.equal(canConfirmSelectCharDelete('  Co2  ', 'Co2'), true);
        assert.equal(canConfirmSelectCharDelete('co2', 'Co2'), false);
        assert.equal(canConfirmSelectCharDelete('Co2 ', 'BebaMaster'), false);
        assert.equal(canConfirmSelectCharDelete('Co2', undefined), false);
        assert.equal(canConfirmSelectCharDelete('', 'Co2'), false);
    });

    it('formats town and last map only when the list row has them', () => {
        assert.equal(formatSelectCharTown('aresden'), 'Aresden');
        assert.equal(formatSelectCharTown('elvine'), 'Elvine');
        assert.equal(formatSelectCharTown('traveler'), 'Traveler');
        const withMap = selectCharTownMapLines(
            slot({ slotIndex: 0, name: 'Co2', lastMap: 'Aresden Farm' }),
        );
        assert.equal(withMap?.town, 'Aresden');
        assert.equal(withMap?.lastMap, 'Aresden Farm');
        const noMap = selectCharTownMapLines(slot({ slotIndex: 0, name: 'Co2' }));
        assert.equal(noMap?.lastMap, undefined);
        assert.equal(selectCharTownMapLines(undefined), undefined);
    });
});

describe('selectChar avatar look', () => {
    it('builds idle-south body/hair/clothes layers from slot appearance', () => {
        const look = selectCharAvatarLookFromSlot(
            slot({
                slotIndex: 0,
                name: 'Co2',
                gender: 0,
                skinColor: 0,
                hairStyleIndex: 1,
                underwearColorIndex: 2,
            }),
        );
        assert.equal(look.gender, Gender.MALE);
        assert.equal(look.skinColor, SkinColor.Light);
        assert.equal(look.layers[0]?.spriteName, 'wm');
        assert.equal(look.layers.some((l) => l.spriteName === 'mhr'), true);
        assert.equal(look.layers.some((l) => l.spriteName === 'mshirt'), true);
        const female = selectCharAvatarLookFromSlot(
            slot({ slotIndex: 1, name: 'BebaMaster', gender: 1, skinColor: 2 }),
        );
        assert.equal(female.gender, Gender.FEMALE);
        assert.equal(female.skinColor, SkinColor.Dark);
        assert.equal(female.layers[0]?.spriteName, 'bw');
    });
});
