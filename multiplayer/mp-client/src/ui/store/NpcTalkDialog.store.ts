import { Store } from '@tanstack/react-store';
import { setCrusadeHudFromStatus } from './CrusadeHud.store';

export type NpcTalkRole =
    | 'guild-hall'
    | 'city-hall'
    | 'cathedral'
    | 'command-hall'
    | 'academy-learning'
    | 'academy-challenge';

interface NpcTalkDialogState {
    isOpen: boolean;
    npcId: string;
    npcName: string;
    role: NpcTalkRole;
    title: string;
    statusMessage: string;
    guildInterestRegistered: boolean;
    citizenshipSide: string;
    cityServicesSummary: string;
    crusadeStatus: string;
    hp: number;
    maxHp: number;
    blessed: boolean;
}

const initialState: NpcTalkDialogState = {
    isOpen: false,
    npcId: '',
    npcName: '',
    role: 'guild-hall',
    title: '',
    statusMessage: '',
    guildInterestRegistered: false,
    citizenshipSide: '',
    cityServicesSummary: '',
    crusadeStatus: '',
    hp: 0,
    maxHp: 0,
    blessed: false,
};

export const npcTalkDialogStore = new Store<NpcTalkDialogState>(initialState);

export const openNpcTalkDialog = (payload: {
    npcId: string;
    npcName: string;
    role: NpcTalkRole;
    title: string;
}) => {
    npcTalkDialogStore.setState(() => ({
        ...initialState,
        isOpen: true,
        npcId: payload.npcId,
        npcName: payload.npcName,
        role: payload.role,
        title: payload.title,
        statusMessage: 'Connecting…',
    }));
};

export const setNpcTalkDialogOpen = (value: boolean) => {
    npcTalkDialogStore.setState((state) => ({
        ...state,
        isOpen: value,
    }));
};

export const setNpcTalkStatusMessage = (message: string) => {
    npcTalkDialogStore.setState((state) => ({
        ...state,
        statusMessage: message,
    }));
};

export const applyCityNpcServiceResult = (result: {
    ok: boolean;
    message: string;
    role?: string;
    npcName?: string;
    guildInterestRegistered?: boolean;
    citizenshipSide?: string;
    cityServicesSummary?: string;
    crusadeStatus?: string;
    hp?: number;
    maxHp?: number;
    blessed?: boolean;
}) => {
    if (result.crusadeStatus !== undefined) {
        setCrusadeHudFromStatus(result.crusadeStatus);
    }
    npcTalkDialogStore.setState((state) => {
        if (!state.isOpen) {
            return state;
        }
        return {
            ...state,
            statusMessage: result.message || (result.ok ? 'Done.' : 'Request failed.'),
            guildInterestRegistered: result.guildInterestRegistered ?? state.guildInterestRegistered,
            citizenshipSide: result.citizenshipSide || state.citizenshipSide,
            cityServicesSummary: result.cityServicesSummary || state.cityServicesSummary,
            crusadeStatus: result.crusadeStatus || state.crusadeStatus,
            hp: result.hp ?? state.hp,
            maxHp: result.maxHp ?? state.maxHp,
            blessed: result.blessed ?? state.blessed,
            npcName: result.npcName || state.npcName,
        };
    });
};
