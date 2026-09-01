import { createDialogStore } from './utils';
import type { WalletSession } from '../../utils/walletAuth';
import type { CharacterSlotSummary, ReferralListInfo } from '../../utils/characterListApi';
import { EventBus } from '../../game/EventBus';
import { IN_UI_CONNECT_TO_SERVER, OUT_UI_SELECTCHAR_ACTION } from '../../constants/EventNames';
import { getDefaultGameHost, getDefaultGamePort } from '../../utils/serverDefaults';
import { getPreferredInitialWorldId } from '../../utils/playerMode';
import {
    createPlaytestWalletSession,
    isPlaytestClient,
    PLAYTEST_CHARACTER_NAME,
} from '../../utils/playtestMode';
import { ARENA_ENTRY_ENABLED } from '../../constants/ArenaGate';

/**
 * Login gate phase:
 * - hub — World | Goddesses | Arena; equal entry portals
 * - play-world — Phaser SELECTCHAR desk (ND_SELECTCHAR)
 * - create-char — Phaser Create Character desk (ND_NEWCHAR) for an empty slot
 * - arena-lobby — Phaser Arena SELECTCHAR desk (kits 160/90)
 */
export type ConnectGatePhase = 'hub' | 'play-world' | 'create-char' | 'arena-lobby';

export interface ConnectDialogState {
    isOpen: boolean;
    /** Prefill from GameStateManager when opening the login screen */
    defaultCharacterName: string;
    /** Last submit attempt; restores fields after a failed connection */
    lastAttempt: { characterName: string; host: string; port: number; slotIndex?: number } | null;
    /** hub → play-world (desk) / create-char / arena-lobby; wallet shared across phases */
    phase: ConnectGatePhase;
    /** Session from Phantom auth on this login gate (not yet sent to game server). */
    walletSession: WalletSession | null;
    /** Occupied SELECTCHAR slots from CharacterListResponse (empty = create-ready). */
    characterSlots: CharacterSlotSummary[];
    /** Wallet referral code / share URL from character list. */
    referralInfo: ReferralListInfo | null;
    /** True while fetching the character list for the desk. */
    characterListLoading: boolean;
    /** Selected desk slot 0–3 (for create or enter). */
    selectedSlotIndex: number;
    /** Selected Arena desk cradle 0–3 (Lv160 A/B, Lv90 A/B). */
    arenaDeskIndex: number;
}

const initialState: ConnectDialogState = {
    isOpen: false,
    defaultCharacterName: '',
    lastAttempt: null,
    phase: 'hub',
    walletSession: null,
    characterSlots: [],
    referralInfo: null,
    characterListLoading: false,
    selectedSlotIndex: 0,
    arenaDeskIndex: 0,
};

const { store: connectDialogStore, setOpen: setConnectDialogOpenBase } = createDialogStore(initialState);

export { connectDialogStore };

export const setConnectDialogOpen = (isOpen: boolean) => {
    setConnectDialogOpenBase(isOpen);
};

/** Opens the login hub for a fresh login (clears last-attempt restore; keeps wallet if still valid). */
export const openConnectDialogForLogin = (defaultCharacterName: string) => {
    connectDialogStore.setState((state) => ({
        isOpen: true,
        defaultCharacterName,
        lastAttempt: null,
        phase: 'hub',
        walletSession: state.walletSession,
        characterSlots: [],
        referralInfo: null,
        characterListLoading: false,
        selectedSlotIndex: 0,
        arenaDeskIndex: 0,
    }));
};

export const setLastConnectAttempt = (attempt: {
    characterName: string;
    host: string;
    port: number;
    slotIndex?: number;
}) => {
    connectDialogStore.setState((state) => ({ ...state, lastAttempt: attempt }));
};

export const setConnectGatePhase = (phase: ConnectGatePhase) => {
    // Hard block: never open incomplete Arena desk while production gate is closed.
    if (phase === 'arena-lobby' && !ARENA_ENTRY_ENABLED) {
        connectDialogStore.setState((state) => ({
            ...state,
            phase: 'hub',
            isOpen: true,
        }));
        return;
    }
    connectDialogStore.setState((state) => ({ ...state, phase }));
};

/**
 * Opens SELECTCHAR in one store write (wallet + play-world) so the hub never
 * unmounts without a desk phase — avoids a black empty stage after Phantom.
 */
export const enterPlayWorldPhase = (walletSession: WalletSession) => {
    connectDialogStore.setState((state) => ({
        ...state,
        isOpen: true,
        walletSession,
        phase: 'play-world',
    }));
};

export const setConnectWalletSession = (walletSession: WalletSession | null) => {
    connectDialogStore.setState((state) => ({
        ...state,
        walletSession,
        phase: walletSession ? state.phase : 'hub',
        characterSlots: walletSession ? state.characterSlots : [],
        referralInfo: walletSession ? state.referralInfo : null,
    }));
};

export const setCharacterSlots = (characterSlots: CharacterSlotSummary[]) => {
    connectDialogStore.setState((state) => ({ ...state, characterSlots }));
};

export const setReferralInfo = (referralInfo: ReferralListInfo | null) => {
    connectDialogStore.setState((state) => ({ ...state, referralInfo }));
};

export const setCharacterListLoading = (characterListLoading: boolean) => {
    connectDialogStore.setState((state) => ({ ...state, characterListLoading }));
};

export const setSelectedSlotIndex = (selectedSlotIndex: number) => {
    connectDialogStore.setState((state) => ({
        ...state,
        selectedSlotIndex: Math.max(0, Math.min(3, selectedSlotIndex)),
    }));
};

export const setArenaDeskIndex = (arenaDeskIndex: number) => {
    connectDialogStore.setState((state) => ({
        ...state,
        arenaDeskIndex: Math.max(0, Math.min(3, arenaDeskIndex)),
    }));
};

/**
 * DEV / PLAYTEST: open SELECTCHAR without Phantom.
 * Console: `window.__helbreathDevEnterPlayWorld()` · `window.__helbreathDevEnterCreateChar(0)`
 * · `window.__helbreathDevStartSelectedChar()` (emits Start for the focused occupied slot)
 */
export function installConnectDialogDevHooks(): void {
    if (!import.meta.env.DEV && !isPlaytestClient()) {
        return;
    }

    const ensureDevWallet = () => {
        if (connectDialogStore.state.walletSession) {
            return;
        }
        setConnectWalletSession(isPlaytestClient() ? createPlaytestWalletSession() : {
            wallet: 'DevTestWallet111111111111111111111111',
            token: 'dev-bypass-token',
            expiresAt: Date.now() + 60 * 60 * 1000,
        });
    };

    const w = window as Window & {
        __helbreathDevEnterPlayWorld?: () => void;
        __helbreathDevEnterCreateChar?: (slotIndex?: number) => void;
        __helbreathDevStartSelectedChar?: () => boolean;
        __helbreathDevConnectAs?: (characterName?: string) => boolean;
        __helbreathDevConnectSnapshot?: () => {
            phase: ConnectGatePhase;
            isOpen: boolean;
            characterListLoading: boolean;
            slotCount: number;
            selectedSlotIndex: number;
            hasWallet: boolean;
            bodyClass: string;
        };
    };

    w.__helbreathDevEnterPlayWorld = () => {
        ensureDevWallet();
        const session = connectDialogStore.state.walletSession;
        if (session) {
            enterPlayWorldPhase(session);
            return;
        }
        setConnectDialogOpen(true);
        setConnectGatePhase('play-world');
    };

    w.__helbreathDevEnterCreateChar = (slotIndex = 0) => {
        setConnectDialogOpen(true);
        ensureDevWallet();
        setSelectedSlotIndex(slotIndex);
        setConnectGatePhase('create-char');
    };

    w.__helbreathDevStartSelectedChar = () => {
        const s = connectDialogStore.state;
        const slot = s.characterSlots.find((c) => c.slotIndex === s.selectedSlotIndex);
        if (!slot) {
            return false;
        }
        EventBus.emit(OUT_UI_SELECTCHAR_ACTION, {
            kind: 'start',
            slotIndex: slot.slotIndex,
        });
        return true;
    };

    /** Direct connect for viewport / world automation when CharacterList is empty. */
    w.__helbreathDevConnectAs = (characterName = isPlaytestClient() ? PLAYTEST_CHARACTER_NAME : 'Traveler') => {
        ensureDevWallet();
        const s = connectDialogStore.state;
        const session = s.walletSession;
        if (!session) {
            return false;
        }
        EventBus.emit(IN_UI_CONNECT_TO_SERVER, {
            host: getDefaultGameHost(),
            port: getDefaultGamePort(),
            characterName,
            slotIndex: s.selectedSlotIndex,
            preferredInitialWorldId: getPreferredInitialWorldId(),
            walletSession: {
                wallet: session.wallet,
                token: session.token,
                expiresAt: session.expiresAt,
            },
        });
        return true;
    };

    w.__helbreathDevConnectSnapshot = () => {
        const s = connectDialogStore.state;
        return {
            phase: s.phase,
            isOpen: s.isOpen,
            characterListLoading: s.characterListLoading,
            slotCount: s.characterSlots.length,
            selectedSlotIndex: s.selectedSlotIndex,
            hasWallet: !!s.walletSession,
            bodyClass: document.body.className,
        };
    };
}
