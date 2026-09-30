import { getLivePhaserGame } from '../game/phaserWalletPark';
import {
    beginEnteringWorld,
    connectDialogStore,
    setConnectDialogOpen,
    setConnectGatePhase,
} from '../ui/store/ConnectDialog.store';
import { peekInMemorySolSession } from './walletAuth';
import {
    decideGameReconnectAction,
    isWalletBoundForGameReconnect,
    peekWorldEnterPayload,
} from './gameConnectionGate';

/**
 * Reconectar: replay the Start payload through LoginScreen, or send the player
 * back to Bind Phantom & enter when the wallet seal is gone.
 */
export function retryExistingGameConnect(now = Date.now()): 'bind' | 'reconnect' {
    const session = resolveBoundSession(now);
    const payload = peekWorldEnterPayload();
    if (decideGameReconnectAction(session, payload !== null, now) === 'bind' || !session || !payload) {
        returnToBindPhantomAndEnter();
        return 'bind';
    }
    beginEnteringWorld({
        ...payload,
        walletSession: {
            wallet: session.wallet.trim(),
            token: session.token.trim(),
            expiresAt: session.expiresAt,
        },
    });
    const scenes = getLivePhaserGame()?.scene as { start?: (key: string) => void } | undefined;
    if (!scenes?.start) {
        console.warn('[gameReconnect] LoginScreen is not available to retry the game socket');
        return 'reconnect';
    }
    scenes.start('LoginScreen');
    return 'reconnect';
}

function resolveBoundSession(now: number): { wallet: string; token: string; expiresAt: number } | null {
    const fromStore = connectDialogStore.state.walletSession;
    if (isWalletBoundForGameReconnect(fromStore, now) && fromStore) {
        return fromStore;
    }
    const memory = peekInMemorySolSession();
    if (isWalletBoundForGameReconnect(memory, now) && memory) {
        return memory;
    }
    return null;
}

function returnToBindPhantomAndEnter(): void {
    setConnectDialogOpen(true);
    setConnectGatePhase('hub');
}
