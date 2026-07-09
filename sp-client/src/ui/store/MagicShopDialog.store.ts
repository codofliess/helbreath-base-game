import { Store } from '@tanstack/react-store';
import { SPELLS } from '../../constants/Spells';
import { getMagicShopPrice, MAGIC_SHOP_SPELL_IDS } from '../../constants/SpellAcquisition';

interface MagicShopState {
    isOpen: boolean;
    activeCircle: number;
    /** Spell IDs the player has learned (purchased) */
    learnedSpellIds: number[];
    /** Player gold for purchases (dev default — server will own this later) */
    gold: number;
}

const initialState: MagicShopState = {
    isOpen: false,
    activeCircle: 1,
    learnedSpellIds: [],
    gold: 500000,
};

export const magicShopDialogStore = new Store<MagicShopState>(initialState);

export const setMagicShopOpen = (value: boolean) => {
    magicShopDialogStore.setState((state) => ({ ...state, isOpen: value }));
};

export const toggleMagicShopDialog = () => {
    magicShopDialogStore.setState((state) => ({ ...state, isOpen: !state.isOpen }));
};

export const setMagicShopCircle = (circle: number) => {
    const clamped = Math.max(1, Math.min(10, circle));
    magicShopDialogStore.setState((state) => ({ ...state, activeCircle: clamped }));
};

export const isSpellLearned = (spellId: number): boolean => {
    return magicShopDialogStore.state.learnedSpellIds.includes(spellId);
};

export const buySpell = (spellId: number): { ok: boolean; message: string } => {
    const state = magicShopDialogStore.state;

    if (!MAGIC_SHOP_SPELL_IDS.includes(spellId)) {
        return { ok: false, message: 'Este hechizo no está disponible en la tienda.' };
    }
    if (state.learnedSpellIds.includes(spellId)) {
        return { ok: false, message: 'Ya conocés este hechizo.' };
    }

    const { cost } = getMagicShopPrice(spellId);
    if (state.gold < cost) {
        return { ok: false, message: `Necesitás ${cost} oro (tenés ${state.gold}).` };
    }

    magicShopDialogStore.setState((s) => ({
        ...s,
        gold: s.gold - cost,
        learnedSpellIds: [...s.learnedSpellIds, spellId],
    }));

    const spell = SPELLS.find((sp) => sp.id === spellId);
    return { ok: true, message: `Aprendiste ${spell?.name ?? 'hechizo'} por ${cost} oro.` };
};

/** Spells visible in the cast book — learned spells, or all if none learned yet (dev convenience) */
export function getCastableSpells() {
    const { learnedSpellIds } = magicShopDialogStore.state;
    if (learnedSpellIds.length === 0) {
        return SPELLS;
    }
    return SPELLS.filter((s) => learnedSpellIds.includes(s.id));
}