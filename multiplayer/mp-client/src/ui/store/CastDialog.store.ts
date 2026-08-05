import { EventBus } from '../../game/EventBus';
import { IN_UI_CAST_SPELL } from '../../constants/EventNames';
import { SPELL_ENERGY_BOLT_ID } from '../../constants/Spells';
import type { CastSpellEvent } from '../../Types';
import { createDialogStore } from './utils';
import { isSpellLearned } from './MagicShopDialog.store';
import { isTravelerPlayerMode } from '../../utils/playerMode';

interface CastDialogState {
    isOpen: boolean;
    selectedSpellId: number;
    activeCircle: number;
    useCastAnimation: boolean;
}

const initialState: CastDialogState = {
    isOpen: false,
    selectedSpellId: SPELL_ENERGY_BOLT_ID,
    // Traveler starter is Energy Bolt (circle 2); GM keeps circle 1.
    activeCircle: isTravelerPlayerMode() ? 2 : 1,
    useCastAnimation: true,
};

const { store: castDialogStore, toggle: toggleCastDialog, setOpen: setCastDialogOpen } = createDialogStore(initialState);

export { castDialogStore, toggleCastDialog, setCastDialogOpen };

export const setSelectedSpellId = (spellId: number) => {
    castDialogStore.setState((state) => ({ ...state, selectedSpellId: spellId }));
};

export const setActiveCircle = (circle: number) => {
    const clamped = Math.max(1, Math.min(10, circle));
    castDialogStore.setState((state) => ({ ...state, activeCircle: clamped }));
};

export const setUseCastAnimation = (useCastAnimation: boolean) => {
    castDialogStore.setState((state) => ({ ...state, useCastAnimation }));
};

/** Opens magic book on a specific circle (Ctrl+1..0). Always opens; does not toggle. */
export const openCastDialogOnCircle = (circle: number) => {
    setActiveCircle(circle);
    setCastDialogOpen(true);
};

/**
 * F7 / HUD Magic — toggle the magic book.
 * If already open, close; if closed, open on the given circle (default 1).
 */
export const toggleCastDialogOnCircle = (circle: number = 1) => {
    if (castDialogStore.state.isOpen) {
        setCastDialogOpen(false);
        return;
    }
    setActiveCircle(circle);
    setCastDialogOpen(true);
};

/** Olympia / Helbreath: single click on a spell enters cast/targeting mode and closes the book. */
export const castSpellById = (spellId: number) => {
    if (!isSpellLearned(spellId)) {
        return;
    }
    setSelectedSpellId(spellId);
    const state = castDialogStore.state;
    EventBus.emit(IN_UI_CAST_SPELL, {
        spellId,
        useCastAnimation: state.useCastAnimation,
    } satisfies CastSpellEvent);
    // Boris: casting should close the spell window (Olympia closes magic book on pick).
    setCastDialogOpen(false);
};

/** Quick cast selected spell (F4). */
export const prepareSelectedSpell = () => {
    castSpellById(castDialogStore.state.selectedSpellId);
};