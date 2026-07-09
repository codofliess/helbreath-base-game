import questData from './quests.data.json';
import { getPersonById } from './Persons';

export interface QuestKillObjective {
    name: string;
    count: number;
    map?: string;
    is_elite?: boolean;
}

export interface QuestGatherObjective {
    id: number;
    count: number;
}

export interface QuestRewardItem {
    id: number;
    count?: number;
    attribute?: number;
}

export interface QuestReward {
    text?: string;
    contribution?: number;
    experience?: number;
    items?: QuestRewardItem[];
    item_pick?: QuestRewardItem[];
}

export interface QuestDefinition {
    id: number;
    person: number;
    name: string;
    text?: string;
    required_level?: number;
    obsolete_level?: number;
    period?: number;
    repeatable?: boolean;
    objectives: {
        kill?: QuestKillObjective[];
        gather?: QuestGatherObjective[];
    };
    reward: QuestReward;
}

export const QUESTS: QuestDefinition[] = questData as QuestDefinition[];

export function getQuestById(id: number): QuestDefinition | undefined {
    return QUESTS.find((q) => q.id === id);
}

export function getQuestsForPerson(personId: number): QuestDefinition[] {
    return QUESTS.filter((q) => q.person === personId);
}

export function getQuestGiverName(quest: QuestDefinition): string {
    return getPersonById(quest.person)?.name ?? 'Unknown';
}

/** Daily quest cooldown in hours (Olympia period 20 ≈ 20h). */
export const DAILY_QUEST_COOLDOWN_HOURS = 20;

export function isDailyQuest(quest: QuestDefinition): boolean {
    return quest.period !== undefined && quest.period >= 20;
}

export function formatKillObjective(obj: QuestKillObjective): string {
    const elite = obj.is_elite ? ' (Elite)' : '';
    const map = obj.map ? ` en ${obj.map}` : '';
    return `Matar ${obj.count} ${obj.name}${elite}${map}`;
}

export function formatQuestObjectives(quest: QuestDefinition): string[] {
    const lines: string[] = [];
    for (const obj of quest.objectives.kill ?? []) {
        lines.push(formatKillObjective(obj));
    }
    for (const obj of quest.objectives.gather ?? []) {
        lines.push(`Recolectar ${obj.count}× item #${obj.id}`);
    }
    return lines;
}