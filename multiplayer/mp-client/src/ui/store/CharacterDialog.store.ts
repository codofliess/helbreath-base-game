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
    enemyKills: number;
    contribution: number;
    reputation: number;
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
    contribution: 0,
    reputation: 0,
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

export const resetLevelUpDraft = () => {
    characterDialogStore.setState((state) => ({
        ...state,
        levelUpDraft: { ...initialLevelUpDraft },
    }));
};

export const setCharacterStats = (partial: Partial<CharacterStats>) => {
    characterDialogStore.setState((state) => ({
        ...state,
        stats: { ...state.stats, ...partial },
    }));
};