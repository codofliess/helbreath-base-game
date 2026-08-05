import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import {
    KILL_MILESTONE_CLAIM_RESULT_RECEIVED,
    LEVEL_UP_SETTINGS_APPLIED_RECEIVED,
    MONSTER_KILLS_UPDATED_RECEIVED,
    PROGRESSION_STATE_RECEIVED,
    PROGRESSION_UPDATED_RECEIVED,
    SYSTEM_LOG_APPEND,
    TOAST_REQUESTED,
} from '../../constants/EventNames';
import type {
    KillMilestoneClaimResult,
    LevelUpSettingsApplied,
    MonsterKillsUpdated,
    ProgressionState,
    ProgressionUpdated,
} from '../../proto/generated/network';
import { ITEMS } from '../../constants/Items';
import { characterDialogStore, setCharacterStats, setLevelUpPointsLeft } from './CharacterDialog.store';
import { ENEMY_KILL_AWARDED_RECEIVED } from '../../constants/EventNames';
import type { EnemyKillAwardedEventData } from '../../Types';
import { refreshCarryWeightUi } from '../../utils/CarryWeight';

export interface MonsterKillRow {
    monsterId: number;
    monsterName: string;
    kills: number;
    /** Specialty tier from kills only (real tier). */
    specialtyLevel: number;
    /** Real tier + stake bonus levels (final with staking). */
    effectiveLevel: number;
    /** Kills required for next real specialty level. */
    nextKills: number;
    /** floor(staked/100k)*10 applied to every species. */
    stakeBonusLevels: number;
    /** Compact bonus summary at effective level. */
    bonusSummary: string;
}

export interface MilestoneRow {
    milestoneId: string;
    /** 0 = monster kill count, 1 = rebirth. */
    kind: number;
    monsterId?: number;
    monsterName?: string;
    required: number;
    progress: number;
    claimed: boolean;
    rewardItemIds: number[];
}

interface ExpSample {
    atMs: number;
    exp: number;
}

interface ProgressionStoreState {
    exp: number;
    level: number;
    rebirth: number;
    expForNextLevel: number;
    /** Cumulative exp required to reach the current level (0 at level 1). */
    expForCurrentLevel: number;
    maxLevel: number;
    maxRebirth: number;
    /** Olympia majestic / gizon points (angel + DK upgrades). */
    majesticPoints: number;
    /** Chain Lords Block Level: new exp → majestic instead of levels. */
    levelBlocked: boolean;
    totalKills: number;
    /** Wallet mock/ledger $HELL staked for specialty offset. */
    stakedHell: number;
    killsByMonsterId: Record<number, MonsterKillRow>;
    milestones: MilestoneRow[];
    claimingMilestoneId: string | null;
    /**
     * Rested Exp pool for F5 (Olympia parity P2.2).
     * Stub until server Progression wires a rested pool — always 0 for now.
     */
    restedExp: number;
    /** Net exp gained in the rolling last-10-seconds window (client-side ticker). */
    expChangeLast10s: number;
    /** Portion of the 10s ticker attributed to rested bonus (0 until server). */
    expRestedBonusLast10s: number;
}

const EXP_TICKER_WINDOW_MS = 10_000;
const EXP_TICKER_INTERVAL_MS = 10_000;

const initialState: ProgressionStoreState = {
    exp: 0,
    level: 1,
    rebirth: 0,
    expForNextLevel: 0,
    expForCurrentLevel: 0,
    maxLevel: 150,
    maxRebirth: 10,
    majesticPoints: 0,
    levelBlocked: false,
    totalKills: 0,
    stakedHell: 0,
    killsByMonsterId: {},
    milestones: [],
    claimingMilestoneId: null,
    restedExp: 0,
    expChangeLast10s: 0,
    expRestedBonusLast10s: 0,
};

export const progressionStore = new Store<ProgressionStoreState>(initialState);

/** Ring buffer of exp snapshots for the 10-second Olympia ticker. */
let expSamples: ExpSample[] = [];
let lastTickerEmitMs = 0;
let tickerTimer: ReturnType<typeof setInterval> | undefined;

function sumKills(killsByMonsterId: Record<number, MonsterKillRow>): number {
    return Object.values(killsByMonsterId).reduce((sum, row) => sum + row.kills, 0);
}

/** Milestone progress derives from either kill counters or rebirth count, so it must be recomputed on both updates. */
function withMilestoneProgress(state: ProgressionStoreState): ProgressionStoreState {
    const milestones = state.milestones.map((m) => {
        if (m.kind === 1) {
            return { ...m, progress: state.rebirth };
        }
        const kills = m.monsterId !== undefined ? state.killsByMonsterId[m.monsterId]?.kills ?? 0 : 0;
        return { ...m, progress: kills };
    });
    return { ...state, milestones };
}

function formatTickerDelta(n: number): string {
    const abs = Math.abs(n).toLocaleString('en-US');
    return n >= 0 ? `+${abs}` : `-${abs}`;
}

function recordExpSample(exp: number): void {
    const now = Date.now();
    expSamples.push({ atMs: now, exp });
    const cutoff = now - EXP_TICKER_WINDOW_MS * 2;
    while (expSamples.length > 0 && expSamples[0].atMs < cutoff) {
        expSamples.shift();
    }
}

/** Computes net exp change over the last 10 seconds and optionally logs Olympia-style ticker line. */
function flushExpTicker(emitLog: boolean): void {
    const now = Date.now();
    const windowStart = now - EXP_TICKER_WINDOW_MS;
    const inWindow = expSamples.filter((s) => s.atMs >= windowStart);
    if (inWindow.length === 0) {
        progressionStore.setState((s) => ({
            ...s,
            expChangeLast10s: 0,
            expRestedBonusLast10s: 0,
        }));
        return;
    }

    const oldest = inWindow[0];
    const newest = inWindow[inWindow.length - 1];
    const delta = newest.exp - oldest.exp;
    // Server rested pool TBD — client cannot split bonus yet.
    const restedBonus = 0;

    progressionStore.setState((s) => ({
        ...s,
        expChangeLast10s: delta,
        expRestedBonusLast10s: restedBonus,
    }));

    if (!emitLog || delta === 0) {
        return;
    }

    if (now - lastTickerEmitMs < EXP_TICKER_INTERVAL_MS - 250) {
        return;
    }
    lastTickerEmitMs = now;

    const restedPart =
        restedBonus > 0 ? ` (+${restedBonus.toLocaleString('en-US')} rested bonus)` : '';
    EventBus.emit(SYSTEM_LOG_APPEND, {
        message: `Exp change in the last 10 seconds: ${formatTickerDelta(delta)}${restedPart}`,
        kind: 'event',
    });
}

function ensureExpTickerTimer(): void {
    if (tickerTimer !== undefined || typeof window === 'undefined') {
        return;
    }
    tickerTimer = setInterval(() => flushExpTicker(true), EXP_TICKER_INTERVAL_MS);
}

function syncRestedToCharacter(restedExp: number): void {
    setCharacterStats({ restedExp });
}

EventBus.on(PROGRESSION_STATE_RECEIVED, (data: ProgressionState) => {
    const killsByMonsterId: Record<number, MonsterKillRow> = {};
    for (const row of data.monsterKills) {
        killsByMonsterId[row.monsterId] = {
            monsterId: row.monsterId,
            monsterName: row.monsterName,
            kills: Number(row.kills),
            specialtyLevel: row.specialtyLevel ?? 0,
            effectiveLevel: row.effectiveLevel ?? 0,
            nextKills: Number(row.nextKills ?? 0),
            stakeBonusLevels: row.stakeBonusLevels ?? 0,
            bonusSummary: row.bonusSummary ?? '—',
        };
    }

    const milestones: MilestoneRow[] = data.milestones.map((m) => ({
        milestoneId: m.milestoneId,
        kind: m.kind,
        monsterId: m.monsterId,
        monsterName: m.monsterName,
        required: Number(m.required),
        progress: Number(m.progress),
        claimed: m.claimed,
        rewardItemIds: m.rewardItemIds,
    }));

    const exp = Number(data.exp);
    // Proto has no rested field yet — keep stub 0 until server Progression ships the pool.
    const restedExp = 0;
    const stakedHell = Number(data.stakedHell ?? 0);

    progressionStore.setState((s) => ({
        ...s,
        exp,
        level: data.level,
        rebirth: data.rebirth,
        expForNextLevel: Number(data.expForNextLevel),
        expForCurrentLevel: Number(data.expForCurrentLevel),
        maxLevel: data.maxLevel,
        maxRebirth: data.maxRebirth,
        majesticPoints: data.majesticPoints ?? 0,
        levelBlocked: data.levelBlocked === true,
        stakedHell,
        killsByMonsterId,
        totalKills: sumKills(killsByMonsterId),
        milestones,
        restedExp,
    }));

    recordExpSample(exp);
    ensureExpTickerTimer();
    syncRestedToCharacter(restedExp);

    // Enemy Kills = open-world PvP EK ledger (not monster kills / specialty grind).
    const ek = Number((data as { enemyKills?: number }).enemyKills ?? 0);
    setCharacterStats({
        level: data.level,
        exp,
        nextExp: Number(data.expForNextLevel),
        enemyKills: ek,
        enemyKillsTotal: ek,
        mp: data.mp,
        maxMp: data.maxMp,
        sp: data.sp,
        maxSp: data.maxSp,
        restedExp,
        hunger: data.hunger ?? 100,
        hungerIsStub: false,
        superAttackLeft: Number((data as { superAttackLeft?: number }).superAttackLeft ?? 0),
        maxSuperAttack: Math.max(1, Number((data as { maxSuperAttack?: number }).maxSuperAttack ?? 1)),
        superAttackArmed: Boolean((data as { superAttackArmed?: boolean }).superAttackArmed),
    });
    setLevelUpPointsLeft(data.luPoints);
    queueMicrotask(() => refreshCarryWeightUi());
});

EventBus.on(PROGRESSION_UPDATED_RECEIVED, (data: ProgressionUpdated) => {
    const exp = Number(data.exp);
    progressionStore.setState((s) =>
        withMilestoneProgress({
            ...s,
            exp,
            level: data.level,
            rebirth: data.rebirth,
            expForNextLevel: Number(data.expForNextLevel),
            expForCurrentLevel: Number(data.expForCurrentLevel),
            majesticPoints: data.majesticPoints ?? s.majesticPoints,
            levelBlocked: data.levelBlocked === true,
        }),
    );

    recordExpSample(exp);
    ensureExpTickerTimer();
    flushExpTicker(false);

    setCharacterStats({
        level: data.level,
        exp,
        nextExp: Number(data.expForNextLevel),
        hp: data.hp,
        maxHp: data.maxHp,
        mp: data.mp,
        maxMp: data.maxMp,
        sp: data.sp,
        maxSp: data.maxSp,
        restedExp: progressionStore.state.restedExp,
        hunger: data.hunger ?? 100,
        hungerIsStub: false,
        superAttackLeft: Number((data as { superAttackLeft?: number }).superAttackLeft ?? 0),
        maxSuperAttack: Math.max(1, Number((data as { maxSuperAttack?: number }).maxSuperAttack ?? 1)),
        superAttackArmed: Boolean((data as { superAttackArmed?: boolean }).superAttackArmed),
    });
    setLevelUpPointsLeft(data.luPoints);

    if (data.leveledUp) {
        EventBus.emit(TOAST_REQUESTED, {
            message: `Level up! Now level ${data.level}`,
            severity: 'success',
            autoClose: 3000,
        });
        EventBus.emit(SYSTEM_LOG_APPEND, {
            message: `Level up! Now level ${data.level}.`,
            kind: 'event',
        });
    }
});

EventBus.on(MONSTER_KILLS_UPDATED_RECEIVED, (data: MonsterKillsUpdated) => {
    progressionStore.setState((s) => {
        const prev = s.killsByMonsterId[data.monsterId];
        const killsByMonsterId = {
            ...s.killsByMonsterId,
            [data.monsterId]: {
                monsterId: data.monsterId,
                monsterName: data.monsterName,
                kills: Number(data.kills),
                specialtyLevel: data.specialtyLevel ?? prev?.specialtyLevel ?? 0,
                effectiveLevel: data.effectiveLevel ?? prev?.effectiveLevel ?? 0,
                nextKills: Number(data.nextKills ?? prev?.nextKills ?? 0),
                stakeBonusLevels: data.stakeBonusLevels ?? prev?.stakeBonusLevels ?? 0,
                bonusSummary: data.bonusSummary || prev?.bonusSummary || '—',
            },
        };
        return withMilestoneProgress({
            ...s,
            killsByMonsterId,
            totalKills: Number(data.totalKills),
        });
    });

    // Monster specialty kills must NOT overwrite F5 "Enemy Kills" (PvP EK counter).
});

EventBus.on(ENEMY_KILL_AWARDED_RECEIVED, (data: EnemyKillAwardedEventData) => {
    const n = Number(data.killerEkCount);
    if (Number.isFinite(n) && n > 0) {
        setCharacterStats({ enemyKills: n, enemyKillsTotal: n });
        return;
    }
    // Fallback if older server without killer_ek_count: +1 from current F5 value.
    const cur = characterDialogStore.state.stats.enemyKills ?? 0;
    const next = cur + 1;
    setCharacterStats({ enemyKills: next, enemyKillsTotal: next });
});

EventBus.on(KILL_MILESTONE_CLAIM_RESULT_RECEIVED, (data: KillMilestoneClaimResult) => {
    progressionStore.setState((s) => ({
        ...s,
        claimingMilestoneId: null,
        milestones: data.success
            ? s.milestones.map((m) => (m.milestoneId === data.milestoneId ? { ...m, claimed: true } : m))
            : s.milestones,
    }));

    if (data.success) {
        const itemName = ITEMS.find((i) => i.id === data.grantedItemId)?.name ?? `Item #${data.grantedItemId}`;
        EventBus.emit(TOAST_REQUESTED, { message: `Milestone reward claimed: ${itemName}`, severity: 'success' });
    } else {
        EventBus.emit(TOAST_REQUESTED, { message: data.error ?? 'Milestone claim failed', severity: 'error' });
    }
});

EventBus.on(LEVEL_UP_SETTINGS_APPLIED_RECEIVED, (data: LevelUpSettingsApplied) => {
    if (!data.success) {
        EventBus.emit(TOAST_REQUESTED, { message: data.error ?? 'Level Set failed', severity: 'error' });
        return;
    }

    setCharacterStats({
        level: data.level,
        str: data.str,
        vit: data.vit,
        dex: data.dex,
        int: data.intel,
        mag: data.mag,
        chr: data.chr,
        hp: data.hp,
        maxHp: data.maxHp,
        mp: data.mp,
        maxMp: data.maxMp,
        sp: data.sp,
        maxSp: data.maxSp,
    });
    setLevelUpPointsLeft(data.luPoints);
    EventBus.emit(TOAST_REQUESTED, { message: 'Stats updated', severity: 'success' });
});

export function setClaimingMilestone(milestoneId: string): void {
    progressionStore.setState((s) => ({ ...s, claimingMilestoneId: milestoneId }));
}

/** Clears progression + exp ticker state on logout. */
export function resetProgressionStore(): void {
    if (tickerTimer !== undefined) {
        clearInterval(tickerTimer);
        tickerTimer = undefined;
    }
    expSamples = [];
    lastTickerEmitMs = 0;
    progressionStore.setState(() => ({ ...initialState }));
}
