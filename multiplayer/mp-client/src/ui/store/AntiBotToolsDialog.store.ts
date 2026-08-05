import { Store } from '@tanstack/react-store';

/** Wire-aligned anti-bot tool flags (docs/ANTIBOT-AIRDROP.md). */
export interface AntiBotToolsFlags {
    guildPriorityIngress: boolean;
    newPlayerSegment: boolean;
    claimTimeSybilGate: boolean;
    industrialMultiBoxLimits: boolean;
    afkOnMapAllowed: boolean;
    tournamentInhumanPlayTelemetry: boolean;
    tournamentHighStakesMode: boolean;
    softOfflineProgression: boolean;
}

export interface AntiBotToolsState {
    flags: AntiBotToolsFlags;
    maxConcurrentSessions: number;
    actionRateCeilingPerMin: number;
    afkWarnAfterMs: number;
    afkKickAfterMs: number;
    updatedBy: string;
    updatedAtMs: number;
}

interface AntiBotToolsDialogState {
    isOpen: boolean;
    loading: boolean;
    saving: boolean;
    statusMessage: string;
    draft: AntiBotToolsFlags;
    server: AntiBotToolsState | undefined;
}

const DEFAULT_FLAGS: AntiBotToolsFlags = {
    guildPriorityIngress: false,
    newPlayerSegment: false,
    claimTimeSybilGate: false,
    industrialMultiBoxLimits: false,
    afkOnMapAllowed: true,
    tournamentInhumanPlayTelemetry: false,
    tournamentHighStakesMode: false,
    softOfflineProgression: false,
};

export const antiBotToolsDialogStore = new Store<AntiBotToolsDialogState>({
    isOpen: false,
    loading: false,
    saving: false,
    statusMessage: '',
    draft: { ...DEFAULT_FLAGS },
    server: undefined,
});

export function toggleAntiBotToolsDialog(): void {
    antiBotToolsDialogStore.setState((s) => ({ ...s, isOpen: !s.isOpen }));
}

export function setAntiBotToolsDialogOpen(value: boolean): void {
    antiBotToolsDialogStore.setState((s) => ({ ...s, isOpen: value }));
}

export function setAntiBotToolsLoading(value: boolean): void {
    antiBotToolsDialogStore.setState((s) => ({ ...s, loading: value }));
}

export function setAntiBotToolsSaving(value: boolean): void {
    antiBotToolsDialogStore.setState((s) => ({ ...s, saving: value }));
}

export function setAntiBotToolsStatusMessage(message: string): void {
    antiBotToolsDialogStore.setState((s) => ({ ...s, statusMessage: message }));
}

export function setAntiBotToolsDraftFlag(key: keyof AntiBotToolsFlags, value: boolean): void {
    antiBotToolsDialogStore.setState((s) => ({
        ...s,
        draft: { ...s.draft, [key]: value },
    }));
}

/** Applies an authoritative server snapshot into the panel (open or after save). */
export function applyAntiBotToolsState(state: AntiBotToolsState): void {
    antiBotToolsDialogStore.setState((s) => ({
        ...s,
        loading: false,
        saving: false,
        server: state,
        draft: { ...state.flags },
    }));
}

export function applyAntiBotToolsSetResult(ok: boolean, message: string, state: AntiBotToolsState | undefined): void {
    antiBotToolsDialogStore.setState((s) => ({
        ...s,
        loading: false,
        saving: false,
        statusMessage: message || (ok ? 'Saved.' : 'Save failed.'),
        server: state ?? s.server,
        draft: state ? { ...state.flags } : s.draft,
    }));
}
