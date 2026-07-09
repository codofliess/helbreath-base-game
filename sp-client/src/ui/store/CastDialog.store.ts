import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { IN_UI_CAST_SPELL } from '../../constants/EventNames';
import { SPELL_ENERGY_BOLT_ID } from '../../constants/Spells';
import type { CastSpellEvent } from '../../Types';

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

export const castDialogStore = new Store<CastDialogState>(initialState);

export const toggleCastDialog = () => {
    castDialogStore.setState((state) => ({ ...state, isOpen: !state.isOpen }));
};

export const setCastDialogOpen = (value: boolean) => {
    castDialogStore.setState((state) => ({ ...state, isOpen: value }));
};

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

/** Opens magic book on a specific circle (Ctrl+1..0). */
export const openCastDialogOnCircle = (circle: number) => {
    setActiveCircle(circle);
    setCastDialogOpen(true);
};

/** Select spell and enter prepare/cast mode (Helbreath: select → prepare → target). */
export const prepareSelectedSpell = () => {
    castSpellById(castDialogStore.state.selectedSpellId);
};

/** Olympia / Helbreath magic book: single click on a spell casts immediately. */
export const castSpellById = (spellId: number) => {
    setSelectedSpellId(spellId);
    const state = castDialogStore.state;
    EventBus.emit(IN_UI_CAST_SPELL, {
        spellId,
        useCastAnimation: state.useCastAnimation,
    } satisfies CastSpellEvent);
};