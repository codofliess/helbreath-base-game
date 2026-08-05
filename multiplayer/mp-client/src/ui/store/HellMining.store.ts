import { Store } from '@tanstack/react-store';

/** Client mirror of server HellMiningStatus (play-mine pending $HELL). */
export interface HellMiningUiState {
    pendingHell: number;
    claimedHell: number;
    remainingPool: number;
    utcDay: string;
    todayCredits: number;
    todayMonsterKills: number;
    todayMonsterCreditGranted: boolean;
    todayDirectTokens: number;
    todaySettled: boolean;
    claimAvailable: boolean;
    note: string;
    lastClaimMessage: string;
}

const emptyState = (): HellMiningUiState => ({
    pendingHell: 0,
    claimedHell: 0,
    remainingPool: 0,
    utcDay: '',
    todayCredits: 0,
    todayMonsterKills: 0,
    todayMonsterCreditGranted: false,
    todayDirectTokens: 0,
    todaySettled: false,
    claimAvailable: false,
    note: '',
    lastClaimMessage: '',
});

export const hellMiningStore = new Store<HellMiningUiState>(emptyState());

export function applyHellMiningStatus(payload: {
    pendingHell?: number;
    claimedHell?: number;
    remainingPool?: number;
    utcDay?: string;
    todayCredits?: number;
    todayMonsterKills?: number;
    todayMonsterCreditGranted?: boolean;
    todayDirectTokens?: number;
    todaySettled?: boolean;
    claimAvailable?: boolean;
    note?: string;
}): void {
    hellMiningStore.setState((s) => ({
        ...s,
        pendingHell: Number(payload.pendingHell ?? 0),
        claimedHell: Number(payload.claimedHell ?? 0),
        remainingPool: Number(payload.remainingPool ?? 0),
        utcDay: payload.utcDay ?? '',
        todayCredits: Number(payload.todayCredits ?? 0),
        todayMonsterKills: Number(payload.todayMonsterKills ?? 0),
        todayMonsterCreditGranted: Boolean(payload.todayMonsterCreditGranted),
        todayDirectTokens: Number(payload.todayDirectTokens ?? 0),
        todaySettled: Boolean(payload.todaySettled),
        claimAvailable: Boolean(payload.claimAvailable),
        note: payload.note ?? s.note,
    }));
}

export function applyHellMiningClaimResult(payload: {
    ok?: boolean;
    message?: string;
    pendingHell?: number;
    claimedAmount?: number;
}): void {
    hellMiningStore.setState((s) => ({
        ...s,
        pendingHell: payload.pendingHell !== undefined ? Number(payload.pendingHell) : s.pendingHell,
        lastClaimMessage: payload.message ?? (payload.ok ? 'Claim reserved.' : 'Claim failed.'),
    }));
}

export function resetHellMiningStore(): void {
    hellMiningStore.setState(emptyState());
}
