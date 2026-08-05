import { Store } from '@tanstack/react-store';

interface DuelWatchState {
    isOpen: boolean;
    /** When set, load this match for multi-cam Watch. */
    matchId: string | null;
}

export const duelWatchStore = new Store<DuelWatchState>({
    isOpen: false,
    matchId: null,
});

export function openDuelWatch(matchId?: string | null): void {
    duelWatchStore.setState(() => ({
        isOpen: true,
        matchId: matchId?.trim() || null,
    }));
}

export function setDuelWatchOpen(isOpen: boolean): void {
    duelWatchStore.setState((s) => ({ ...s, isOpen }));
}

export function setDuelWatchMatchId(matchId: string | null): void {
    duelWatchStore.setState((s) => ({ ...s, matchId }));
}
