import { Store } from '@tanstack/react-store';

export interface GuildTaxSettings {
    goldTax: number;
    partyGoldTax: number;
    questRewardTax: number;
    firstEKToGuild: boolean;
    firstMajesticToGuild: boolean;
    weeklyContributionToGuild: boolean;
}

export interface GuildState {
    guildName: string;
    isGuildMaster: boolean;
    activeTrainer: boolean;
    activeKiller: boolean;
    tax: GuildTaxSettings;
}

const initialState: GuildState = {
    guildName: 'Legion',
    isGuildMaster: true,
    activeTrainer: false,
    activeKiller: false,
    tax: {
        goldTax: 10,
        partyGoldTax: 15,
        questRewardTax: 20,
        firstEKToGuild: true,
        firstMajesticToGuild: true,
        weeklyContributionToGuild: true,
    },
};

export const guildStore = new Store<GuildState>(initialState);

export const setGuildTaxField = <K extends keyof GuildTaxSettings>(key: K, value: GuildTaxSettings[K]) => {
    guildStore.setState((state) => ({
        ...state,
        tax: { ...state.tax, [key]: value },
    }));
};

export const setGuildActiveStatus = (field: 'activeTrainer' | 'activeKiller', value: boolean) => {
    guildStore.setState((state) => ({ ...state, [field]: value }));
};

export const setIsGuildMaster = (value: boolean) => {
    guildStore.setState((state) => ({ ...state, isGuildMaster: value }));
};