import { EventBus } from '../../game/EventBus';
import { IN_UI_CAST_SPELL } from '../../constants/EventNames';
import { SPELL_ENERGY_BOLT_ID } from '../../constants/Spells';
import type { CastSpellEvent } from '../../Types';
import { createDialogStore } from './utils';

interface CastDialogState {
    isOpen: boolean;
    selectedSpellId: number;
    activeCircle: number;
    useCastAnimation: boolean;
}

const initialState: CastDialogState = {
    isOpen: false,
    selectedSpellId: SPELL_ENERGY_BOLT_ID,
    activeCircle: 1,
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

/** Opens magic book on a specific circle (F7 / Ctrl+1..0). */
export const openCastDialogOnCircle = (circle: number) => {
    setActiveCircle(circle);
    setCastDialogOpen(true);
};

/** Olympia / Helbreath: single click on a spell enters cast/targeting mode. */
export const castSpellById = (spellId: number) => {
    setSelectedSpellId(spellId);
    const state = castDialogStore.state;
    EventBus.emit(IN_UI_CAST_SPELL, {
        spellId,
        useCastAnimation: state.useCastAnimation,
    } satisfies CastSpellEvent);
};

/** Quick cast selected spell (F4). */
export const prepareSelectedSpell = () => {
    castSpellById(castDialogStore.state.selectedSpellId);
};