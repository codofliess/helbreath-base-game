import { createDialogStore } from './utils';

export type CharacterSubPanel =
    | 'main'
    | 'quest'
    | 'party'
    | 'levelSet'
    | 'statistics'
    | 'achievements'
    | 'feedback'
    | 'guild';

export interface CharacterStats {
    playerName: string;
    level: number;
    exp: number;
    nextExp: number;
    restedExp: number;
    majestics: number;
    weight: number;
    maxWeight: number;
    /** Enemy kills (current / session slice when server sends both). */
    enemyKills: number;
    /** Lifetime / total enemy kills for Olympia `12/1539` display. */
    enemyKillsTotal: number;
    contribution: number;
    reputation: number;
    /** Hunger percent 0–100. Server feed TBD — client stub defaults to 50. */
    hunger: number;
    /** Display title (e.g. `!RIVER!`). Empty = none. Clear Title is client-local until proto. */
    title: string;
    /** True when hunger is a placeholder (label TBD in UI). */
    hungerIsStub: boolean;
    /** True when title system is not wired (label TBD). */
    titleIsStub: boolean;
    /** Olympia Super Attack charges (critical swings left / max). */
    superAttackLeft: number;
    maxSuperAttack: number;
    /** True when Super Attack is armed (melee hits consume charges as crits). */
    superAttackArmed: boolean;
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    sp: number;
    maxSp: number;
    str: number;
    vit: number;
    dex: number;
    int: number;
    mag: number;
    chr: number;
    faction: string;
    talents: string;
    /** Local player has Olympia Poison temporary effect (HotkeyBar HP label). */
    isPoisoned: boolean;
}

export interface LevelUpDraft {
    pointsLeft: number;
    str: number;
    vit: number;
    dex: number;
    int: number;
    mag: number;
    chr: number;
}

interface CharacterDialogState {
    isOpen: boolean;
    activeSubPanel: CharacterSubPanel;
    stats: CharacterStats;
    levelUpDraft: LevelUpDraft;
}

const initialStats: CharacterStats = {
    playerName: 'Player',
    level: 1,
    exp: 0,
    nextExp: 100,
    restedExp: 0,
    majestics: 0,
    weight: 0,
    maxWeight: 500,
    enemyKills: 0,
    enemyKillsTotal: 0,
    contribution: 0,
    reputation: 0,
    hunger: 100,
    title: '',
    hungerIsStub: true,
    titleIsStub: true,
    superAttackLeft: 0,
    maxSuperAttack: 1,
    superAttackArmed: false,
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    sp: 50,
    maxSp: 50,
    str: 10,
    vit: 10,
    dex: 10,
    int: 10,
    mag: 10,
    chr: 10,
    faction: 'Traveller',
    talents: '',
    isPoisoned: false,
};

const initialLevelUpDraft: LevelUpDraft = {
    pointsLeft: 0,
    str: 0,
    vit: 0,
    dex: 0,
    int: 0,
    mag: 0,
    chr: 0,
};

const initialState: CharacterDialogState = {
    isOpen: false,
    activeSubPanel: 'main',
    stats: initialStats,
    levelUpDraft: initialLevelUpDraft,
};

const {
    store: characterDialogStore,
    toggle: toggleCharacterDialog,
    setOpen: setCharacterDialogOpen,
} = createDialogStore(initialState);

export { characterDialogStore, toggleCharacterDialog, setCharacterDialogOpen };

export const setCharacterSubPanel = (panel: CharacterSubPanel) => {
    characterDialogStore.setState((state) => ({ ...state, activeSubPanel: panel }));
};

export const adjustLevelUpStat = (stat: keyof Omit<LevelUpDraft, 'pointsLeft'>, delta: 1 | -1) => {
    characterDialogStore.setState((state) => {
        const draft = { ...state.levelUpDraft };
        if (delta === 1 && draft.pointsLeft <= 0) return state;
        if (delta === -1 && draft[stat] <= 0) return state;
        draft[stat] += delta;
        draft.pointsLeft -= delta;
        return { ...state, levelUpDraft: draft };
    });
};

/** Returns allocated draft points to the pool (does not invent new LU points). */
export const resetLevelUpDraft = () => {
    characterDialogStore.setState((state) => {
        const d = state.levelUpDraft;
        const returned = d.str + d.vit + d.dex + d.int + d.mag + d.chr;
        return {
            ...state,
            levelUpDraft: {
                pointsLeft: d.pointsLeft + returned,
                str: 0,
                vit: 0,
                dex: 0,
                int: 0,
                mag: 0,
                chr: 0,
            },
        };
    });
};

/** Sets unspent LU points and clears any in-progress Level Set draft allocation. */
export const setLevelUpPointsLeft = (pointsLeft: number) => {
    characterDialogStore.setState((state) => ({
        ...state,
        levelUpDraft: {
            pointsLeft: Math.max(0, pointsLeft),
            str: 0,
            vit: 0,
            dex: 0,
            int: 0,
            mag: 0,
            chr: 0,
        },
    }));
};

export const setCharacterStats = (partial: Partial<CharacterStats>) => {
    characterDialogStore.setState((state) => ({
        ...state,
        stats: { ...state.stats, ...partial },
    }));
};

/** Clears local display title until server title proto lands. */
export const clearCharacterTitle = () => {
    characterDialogStore.setState((state) => ({
        ...state,
        stats: { ...state.stats, title: '', titleIsStub: true },
    }));
};