import { Store } from '@tanstack/react-store';
import {
    DAILY_QUEST_COOLDOWN_HOURS,
    getQuestById,
    getQuestsForPerson,
    isDailyQuest,
    type QuestDefinition,
    type QuestKillObjective,
} from '../../constants/Quests';
import { playerDialogStore } from './PlayerDialog.store';
import { magicShopDialogStore } from './MagicShopDialog.store';

export interface ActiveQuestProgress {
    questId: number;
    /** Per kill-objective index */
    killProgress: number[];
    /** Per gather-objective index */
    gatherProgress: number[];
}

interface QuestState {
    activeQuests: ActiveQuestProgress[];
    completedQuestIds: number[];
    /** questId → timestamp of last completion (for daily cooldown) */
    dailyCompletions: Record<number, number>;
    /** Currently open quest dialog person id */
    dialogPersonId: number | null;
    isDialogOpen: boolean;
    statusMessage: string;
}

const STORAGE_KEY = 'hb-quest-progress';

function loadPersistedState(): Pick<QuestState, 'activeQuests' | 'completedQuestIds' | 'dailyCompletions'> {
    if (typeof window === 'undefined') {
        return { activeQuests: [], completedQuestIds: [], dailyCompletions: {} };
    }
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { activeQuests: [], completedQuestIds: [], dailyCompletions: {} };
        const parsed = JSON.parse(raw) as Pick<QuestState, 'activeQuests' | 'completedQuestIds' | 'dailyCompletions'>;
        return {
            activeQuests: parsed.activeQuests ?? [],
            completedQuestIds: parsed.completedQuestIds ?? [],
            dailyCompletions: parsed.dailyCompletions ?? {},
        };
    } catch {
        return { activeQuests: [], completedQuestIds: [], dailyCompletions: {} };
    }
}

function persistState(state: QuestState): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        activeQuests: state.activeQuests,
        completedQuestIds: state.completedQuestIds,
        dailyCompletions: state.dailyCompletions,
    }));
}

const persisted = loadPersistedState();

const initialState: QuestState = {
    ...persisted,
    dialogPersonId: null,
    isDialogOpen: false,
    statusMessage: '',
};

export const questStore = new Store<QuestState>(initialState);

function applyRewards(quest: QuestDefinition): void {
    const reward = quest.reward;
    if (reward.experience) {
        playerDialogStore.setState((s) => ({
            ...s,
            stats: { ...s.stats, exp: s.stats.exp + reward.experience! },
        }));
    }
    if (reward.contribution) {
        playerDialogStore.setState((s) => ({
            ...s,
            stats: { ...s.stats, contribution: s.stats.contribution + reward.contribution! },
        }));
    }
    const goldItems = [...(reward.items ?? []), ...(reward.item_pick ?? [])].filter((i) => i.id === 90);
    const goldTotal = goldItems.reduce((sum, i) => sum + (i.count ?? 0), 0);
    if (goldTotal > 0) {
        magicShopDialogStore.setState((s) => ({ ...s, gold: s.gold + goldTotal }));
    }
}

function isQuestActive(questId: number): boolean {
    return questStore.state.activeQuests.some((q) => q.questId === questId);
}

function isQuestCompleted(questId: number): boolean {
    return questStore.state.completedQuestIds.includes(questId);
}

function isDailyOnCooldown(quest: QuestDefinition): boolean {
    if (!isDailyQuest(quest)) return false;
    const last = questStore.state.dailyCompletions[quest.id];
    if (!last) return false;
    const hoursSince = (Date.now() - last) / (1000 * 60 * 60);
    return hoursSince < DAILY_QUEST_COOLDOWN_HOURS;
}

function canAcceptQuest(quest: QuestDefinition): { ok: boolean; reason?: string } {
    const level = playerDialogStore.state.stats.level;

    if (isQuestActive(quest.id)) {
        return { ok: false, reason: 'Ya tenés esta misión activa.' };
    }

    if (quest.repeatable === false && isQuestCompleted(quest.id)) {
        return { ok: false, reason: 'Ya completaste esta misión.' };
    }

    if (isDailyQuest(quest) && isDailyOnCooldown(quest)) {
        return { ok: false, reason: `Disponible en ${DAILY_QUEST_COOLDOWN_HOURS}h (daily).` };
    }

    if (!isDailyQuest(quest) && isQuestCompleted(quest.id)) {
        return { ok: false, reason: 'Ya completaste esta misión.' };
    }

    if (quest.required_level && level < quest.required_level) {
        return { ok: false, reason: `Necesitás nivel ${quest.required_level}.` };
    }

    if (quest.obsolete_level && level > quest.obsolete_level) {
        return { ok: false, reason: `Misión obsoleta (máx. nivel ${quest.obsolete_level}).` };
    }

    // Chain: quest 1 must be done before quest 2 for same person (non-daily)
    if (quest.id === 1 || quest.name === 'A New Challenge') {
        const humble = getQuestById(0);
        if (humble && !isQuestCompleted(0) && quest.id !== 0) {
            // quest 1 (id=1) requires quest 0
        }
    }
    if (quest.id === 1 && !isQuestCompleted(0)) {
        return { ok: false, reason: 'Completá "Humble Beginning" primero.' };
    }

    return { ok: true };
}

function createProgress(quest: QuestDefinition): ActiveQuestProgress {
    return {
        questId: quest.id,
        killProgress: (quest.objectives.kill ?? []).map(() => 0),
        gatherProgress: (quest.objectives.gather ?? []).map(() => 0),
    };
}

function isObjectiveComplete(quest: QuestDefinition, progress: ActiveQuestProgress): boolean {
    const kills = quest.objectives.kill ?? [];
    for (let i = 0; i < kills.length; i++) {
        if ((progress.killProgress[i] ?? 0) < kills[i].count) return false;
    }
    const gathers = quest.objectives.gather ?? [];
    for (let i = 0; i < gathers.length; i++) {
        if ((progress.gatherProgress[i] ?? 0) < gathers[i].count) return false;
    }
    return true;
}

export function openQuestDialog(personId: number): void {
    questStore.setState((s) => ({
        ...s,
        isDialogOpen: true,
        dialogPersonId: personId,
        statusMessage: '',
    }));
}

export function closeQuestDialog(): void {
    questStore.setState((s) => ({
        ...s,
        isDialogOpen: false,
        dialogPersonId: null,
        statusMessage: '',
    }));
}

export function acceptQuest(questId: number): { ok: boolean; message: string } {
    const quest = getQuestById(questId);
    if (!quest) return { ok: false, message: 'Misión no encontrada.' };

    const check = canAcceptQuest(quest);
    if (!check.ok) return { ok: false, message: check.reason ?? 'No podés aceptar esta misión.' };

    questStore.setState((s) => {
        const next = {
            ...s,
            activeQuests: [...s.activeQuests, createProgress(quest)],
            statusMessage: `Aceptaste: ${quest.name}`,
        };
        persistState(next);
        return next;
    });

    return { ok: true, message: `Aceptaste: ${quest.name}` };
}

export function abandonQuest(questId: number): void {
    questStore.setState((s) => {
        const next = {
            ...s,
            activeQuests: s.activeQuests.filter((q) => q.questId !== questId),
            statusMessage: 'Misión abandonada.',
        };
        persistState(next);
        return next;
    });
}

export function turnInQuest(questId: number): { ok: boolean; message: string } {
    const quest = getQuestById(questId);
    if (!quest) return { ok: false, message: 'Misión no encontrada.' };

    const progress = questStore.state.activeQuests.find((q) => q.questId === questId);
    if (!progress) return { ok: false, message: 'No tenés esta misión activa.' };
    if (!isObjectiveComplete(quest, progress)) {
        return { ok: false, message: 'Aún no completaste los objetivos.' };
    }

    applyRewards(quest);

    questStore.setState((s) => {
        const completed = isDailyQuest(quest)
            ? s.completedQuestIds
            : [...s.completedQuestIds, questId];
        const dailyCompletions = isDailyQuest(quest)
            ? { ...s.dailyCompletions, [questId]: Date.now() }
            : s.dailyCompletions;

        const next = {
            ...s,
            activeQuests: s.activeQuests.filter((q) => q.questId !== questId),
            completedQuestIds: completed,
            dailyCompletions,
            statusMessage: quest.reward.text ?? `¡Completaste ${quest.name}!`,
        };
        persistState(next);
        return next;
    });

    const rewardText = quest.reward.text ?? `¡Completaste ${quest.name}!`;
    return { ok: true, message: rewardText };
}

/** Maps Olympia quest monster names to client sprite basenames. */
const MONSTER_QUEST_NAME_ALIASES: Record<string, string> = {
    slime: 'slm',
    scorpion: 'scp',
    cyclops: 'cyc',
    ogre: 'orge',
    gargoyle: 'gagoyle',
};

function resolveQuestMonsterSprite(questName: string): string {
    const lower = questName.toLowerCase();
    return MONSTER_QUEST_NAME_ALIASES[lower] ?? lower;
}

function matchesKillObjective(
    obj: QuestKillObjective,
    spriteName: string,
    mapName: string,
    _isElite: boolean,
): boolean {
    const expected = resolveQuestMonsterSprite(obj.name);
    if (expected !== spriteName.toLowerCase()) return false;
    if (obj.map && normalizeMapId(obj.map) !== normalizeMapId(mapName)) return false;
    // Elite tracking not yet implemented on monsters — count all kills for now
    return true;
}

function normalizeMapId(map: string): string {
    return map.toLowerCase().replace(/\.amd$/i, '').replace(/_map$/i, '');
}

export function onMonsterKilled(spriteName: string, mapName: string, isElite = false): void {
    const state = questStore.state;
    let changed = false;

    const updatedQuests = state.activeQuests.map((progress) => {
        const quest = getQuestById(progress.questId);
        if (!quest?.objectives.kill) return progress;

        const newKillProgress = [...progress.killProgress];
        let questChanged = false;

        quest.objectives.kill.forEach((obj, idx) => {
            if (matchesKillObjective(obj, spriteName, mapName, isElite)) {
                if (newKillProgress[idx] < obj.count) {
                    newKillProgress[idx] = Math.min(obj.count, newKillProgress[idx] + 1);
                    questChanged = true;
                }
            }
        });

        if (questChanged) {
            changed = true;
            return { ...progress, killProgress: newKillProgress };
        }
        return progress;
    });

    if (changed) {
        questStore.setState((s) => {
            const next = { ...s, activeQuests: updatedQuests };
            persistState(next);
            return next;
        });
    }
}

export function getActiveQuestEntries(): Array<{ quest: QuestDefinition; progress: ActiveQuestProgress }> {
    return questStore.state.activeQuests
        .map((progress) => {
            const quest = getQuestById(progress.questId);
            return quest ? { quest, progress } : null;
        })
        .filter((e): e is { quest: QuestDefinition; progress: ActiveQuestProgress } => e !== null);
}

export function getAvailableQuestsForPerson(personId: number): QuestDefinition[] {
    return getQuestsForPerson(personId).filter((q) => {
        const check = canAcceptQuest(q);
        return check.ok || isQuestActive(q.id);
    });
}

export function getQuestProgressLabel(quest: QuestDefinition, progress: ActiveQuestProgress): string {
    const parts: string[] = [];
    (quest.objectives.kill ?? []).forEach((obj, idx) => {
        parts.push(`${obj.name}: ${progress.killProgress[idx] ?? 0}/${obj.count}`);
    });
    (quest.objectives.gather ?? []).forEach((obj, idx) => {
        parts.push(`Item ${obj.id}: ${progress.gatherProgress[idx] ?? 0}/${obj.count}`);
    });
    return parts.join(' · ');
}

export function isQuestReadyToTurnIn(questId: number): boolean {
    const quest = getQuestById(questId);
    const progress = questStore.state.activeQuests.find((q) => q.questId === questId);
    if (!quest || !progress) return false;
    return isObjectiveComplete(quest, progress);
}