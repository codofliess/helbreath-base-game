import { Store } from '@tanstack/react-store';

export interface PendingArenaPactCreate {
    mapId: string;
    opensAtMs: number;
    readyWindowSec: number;
    inviteName?: string;
    stakeAssetId?: string;
    stakeAmount?: number;
    isPublic?: boolean;
    title?: string;
    hostStreamUrl?: string;
    globalStreamUrl?: string;
}

/** After hub Accept / 4Honor: enter arena then auto-respond. */
export interface PendingArenaPactRespond {
    matchId: string;
    /** accept | honor */
    mode: 'accept' | 'honor';
    mapId?: string;
}

interface ArenaPactDialogState {
    isOpen: boolean;
    /** Kit JSON to attach when creating / ready (from Pre-Ready desk). */
    pendingKitJson: string | null;
    pendingKitName: string | null;
    preferredMapId: string;
    /**
     * When set, client will connect to the preferred map then send ArenaPactCreate
     * (used when host creates from lobby before being in-game).
     */
    pendingCreate: PendingArenaPactCreate | null;
    pendingRespond: PendingArenaPactRespond | null;
}

export const arenaPactDialogStore = new Store<ArenaPactDialogState>({
    isOpen: false,
    pendingKitJson: null,
    pendingKitName: null,
    preferredMapId: 'colosseum',
    pendingCreate: null,
    pendingRespond: null,
});

export function setArenaPactDialogOpen(value: boolean): void {
    arenaPactDialogStore.setState((s) => ({ ...s, isOpen: value }));
}

/** Start button: open Create PVP Duel with kit (does NOT enter world by itself). */
export function openArenaPactWithKit(kitJson: string, kitName: string, mapId = 'colosseum'): void {
    arenaPactDialogStore.setState((s) => ({
        ...s,
        isOpen: true,
        pendingKitJson: kitJson,
        pendingKitName: kitName,
        preferredMapId: mapId,
        pendingCreate: null,
    }));
}

export function setArenaPactPreferredMap(mapId: string): void {
    arenaPactDialogStore.setState((s) => ({ ...s, preferredMapId: mapId }));
}

export function setPendingArenaPactCreate(create: PendingArenaPactCreate | null): void {
    arenaPactDialogStore.setState((s) => ({ ...s, pendingCreate: create }));
}

export function setPendingArenaPactRespond(respond: PendingArenaPactRespond | null): void {
    arenaPactDialogStore.setState((s) => ({ ...s, pendingRespond: respond }));
}
