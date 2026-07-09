import { Store } from '@tanstack/react-store';

interface MobKillsDialogState {
    isOpen: boolean;
}

export const mobKillsDialogStore = new Store<MobKillsDialogState>({ isOpen: false });

export const toggleMobKillsDialog = () => {
    mobKillsDialogStore.setState((s) => ({ ...s, isOpen: !s.isOpen }));
};

export const setMobKillsDialogOpen = (value: boolean) => {
    mobKillsDialogStore.setState((s) => ({ ...s, isOpen: value }));
};