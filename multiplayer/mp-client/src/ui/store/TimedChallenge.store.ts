import { Store } from '@tanstack/react-store';

/** Live Timed Challenge state from the server (Mode 1 CC / Modes 2–3 PVP Skills). */
export interface TimedChallengeUiState {
    active: boolean;
    mode: number;
    targetsTotal: number;
    targetsCompleted: number;
    startedAtMs: number;
    message: string;
    freeMana: boolean;
    /** 1-based wave index for PVP modes; 0 when N/A. */
    waveIndex: number;
    waveCount: number;
    /** 0 = combat, 1 = setup (invis + PFA). */
    phase: number;
    /** Last finished run summary (cleared on next start). */
    lastFinishMessage: string;
    lastElapsedMs: number;
    leaderboardUtcDay: string;
    leaderboardEntries: Array<{ characterName: string; walletSuffix: string; elapsedMs: number }>;
    yourBestMs: number | null;
}

const initialState: TimedChallengeUiState = {
    active: false,
    mode: 1,
    targetsTotal: 10,
    targetsCompleted: 0,
    startedAtMs: 0,
    message: '',
    freeMana: false,
    waveIndex: 0,
    waveCount: 0,
    phase: 0,
    lastFinishMessage: '',
    lastElapsedMs: 0,
    leaderboardUtcDay: '',
    leaderboardEntries: [],
    yourBestMs: null,
};

export const timedChallengeStore = new Store<TimedChallengeUiState>(initialState);

export function applyTimedChallengeState(partial: {
    active: boolean;
    mode: number;
    targetsTotal: number;
    targetsCompleted: number;
    startedAtMs: number;
    message: string;
    freeMana: boolean;
    waveIndex?: number;
    waveCount?: number;
    phase?: number;
}): void {
    timedChallengeStore.setState((s) => ({
        ...s,
        active: partial.active,
        mode: partial.mode,
        targetsTotal: partial.targetsTotal,
        targetsCompleted: partial.targetsCompleted,
        startedAtMs: partial.startedAtMs,
        message: partial.message || '',
        freeMana: partial.freeMana,
        waveIndex: partial.waveIndex ?? 0,
        waveCount: partial.waveCount ?? 0,
        phase: partial.phase ?? 0,
        ...(partial.active ? { lastFinishMessage: '', lastElapsedMs: 0 } : {}),
    }));
}

export function applyTimedChallengeFinished(partial: {
    ok: boolean;
    message: string;
    elapsedMs: number;
}): void {
    timedChallengeStore.setState((s) => ({
        ...s,
        active: false,
        freeMana: false,
        waveIndex: 0,
        waveCount: 0,
        phase: 0,
        lastFinishMessage: partial.message || '',
        lastElapsedMs: partial.elapsedMs,
    }));
}

export function applyTimedChallengeLeaderboard(partial: {
    mode: number;
    utcDay: string;
    entries: Array<{ characterName: string; walletSuffix: string; elapsedMs: number }>;
    yourBestMs?: number;
}): void {
    timedChallengeStore.setState((s) => ({
        ...s,
        mode: partial.mode,
        leaderboardUtcDay: partial.utcDay,
        leaderboardEntries: partial.entries,
        yourBestMs: partial.yourBestMs ?? null,
    }));
}

export function resetTimedChallengeStore(): void {
    timedChallengeStore.setState(() => ({ ...initialState }));
}
