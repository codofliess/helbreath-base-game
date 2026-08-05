import { Store } from '@tanstack/react-store';

interface MobKillsDialogState {
    isOpen: boolean;
}

export const mobKillsDialogStore = new Store<MobKillsDialogState>({ isOpen: false });

export function toggleMobKillsDialog(): void {
    mobKillsDialogStore.setState((s) => ({ ...s, isOpen: !s.isOpen }));
}

export function setMobKillsDialogOpen(value: boolean): void {
    mobKillsDialogStore.setState((s) => ({ ...s, isOpen: value }));
}
