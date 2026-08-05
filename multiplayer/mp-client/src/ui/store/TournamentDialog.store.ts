import { Store } from '@tanstack/react-store';

export type TournamentDialogTab = 'leaderboard' | 'events' | 'hof';
export type TournamentLeaderboardMode = 'solo' | 'team';

interface TournamentDialogState {
    isOpen: boolean;
    tab: TournamentDialogTab;
    /** Preferred ranks mode when opening from hub ranking buttons. */
    leaderboardMode: TournamentLeaderboardMode;
}

export const tournamentDialogStore = new Store<TournamentDialogState>({
    isOpen: false,
    tab: 'leaderboard',
    leaderboardMode: 'solo',
});

export function toggleTournamentDialog(): void {
    tournamentDialogStore.setState((s) => ({ ...s, isOpen: !s.isOpen }));
}

export function setTournamentDialogOpen(value: boolean): void {
    tournamentDialogStore.setState((s) => ({ ...s, isOpen: value }));
}

export function setTournamentDialogTab(tab: TournamentDialogTab): void {
    tournamentDialogStore.setState((s) => ({ ...s, tab }));
}

export function openTournamentLeaderboard(mode: TournamentLeaderboardMode = 'solo'): void {
    tournamentDialogStore.setState(() => ({
        isOpen: true,
        tab: 'leaderboard',
        leaderboardMode: mode,
    }));
}

export function setTournamentLeaderboardMode(mode: TournamentLeaderboardMode): void {
    tournamentDialogStore.setState((s) => ({ ...s, leaderboardMode: mode }));
}
