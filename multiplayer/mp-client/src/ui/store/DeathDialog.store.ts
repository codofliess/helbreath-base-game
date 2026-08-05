import { EventBus } from '../../game/EventBus';
import { IN_UI_PLAYER_RESURRECT, OUT_UI_PLAYER_DIED } from '../../constants/EventNames';
import { Store } from '@tanstack/react-store';

interface DeathDialogState {
    isOpen: boolean;
    /** Display name of the PvP killer when the server attributed the death; undefined for PvE / unknown. */
    killerName?: string;
}

const initialState: DeathDialogState = {
    isOpen: false,
    killerName: undefined,
};

export const deathDialogStore = new Store<DeathDialogState>(initialState);

export function setDeathDialogOpen(value: boolean, killerName?: string): void {
    deathDialogStore.setState((s) => ({
        ...s,
        isOpen: value,
        killerName: value ? killerName : undefined,
    }));
}

EventBus.on(OUT_UI_PLAYER_DIED, (data?: { killerName?: string }) => {
    const name = data?.killerName?.trim();
    setDeathDialogOpen(true, name || undefined);
});

// Close Restart! only after server-confirmed revive (or fresh world join that emits this).
EventBus.on(IN_UI_PLAYER_RESURRECT, () => {
    setDeathDialogOpen(false);
});
