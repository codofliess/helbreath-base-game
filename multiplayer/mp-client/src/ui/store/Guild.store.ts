import { Store } from '@tanstack/react-store';
import { computeGuildProgression, type GuildProgressionSnapshot } from '../../constants/GuildProgression';

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
    /** Activity tallies that already grant guild levels (Fase H ledger). */
    contribution: number;
    enemyKills: number;
    gold: number;
    majestics: number;
    /** Sum of members' $HELBREATH pledged to this guild. */
    stakedHelbreath: number;
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
    contribution: 800,
    enemyKills: 20,
    gold: 200_000,
    majestics: 10,
    stakedHelbreath: 240_000,
};

export const guildStore = new Store<GuildState>(initialState);

export function guildProgressionFromStore(state: GuildState = guildStore.state): GuildProgressionSnapshot {
    return computeGuildProgression({
        contribution: state.contribution,
        enemyKills: state.enemyKills,
        gold: state.gold,
        majestics: state.majestics,
        stakedHelbreath: state.stakedHelbreath,
    });
}