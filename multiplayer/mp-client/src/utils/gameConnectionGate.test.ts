import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
    GAME_SERVER_PACKET_TIMEOUT_MS,
    decideGameReconnectAction,
    evaluateGameConnectionGate,
    gameServerLinkStore,
    isGameSocketOpen,
    isWalletBoundForGameReconnect,
    noteGameServerClosed,
    noteGameServerConnecting,
    noteGameServerError,
    noteGameServerJoin,
    noteGameServerOpen,
    noteGameServerPacket,
    refreshGameConnectionOverlay,
    resetGameServerLinkForTests,
    serverConnectionCopy,
    setGameConnectionViewActive,
} from './gameConnectionGate';

const NOW = 1_700_000_000_000;

describe('evaluateGameConnectionGate', () => {
    const base = {
        inGameView: true,
        phase: 'idle' as const,
        joinWorldReceived: false,
        lastServerPacketAt: undefined as number | undefined,
        now: NOW,
        packetTimeoutMs: GAME_SERVER_PACKET_TIMEOUT_MS,
    };

    it('stays hidden outside the game view', () => {
        const gate = evaluateGameConnectionGate({ ...base, inGameView: false, phase: 'closed' });
        assert.equal(gate.showOverlay, false);
        assert.equal(gate.freezeMovement, false);
        assert.equal(gate.reason, null);
    });

    it('shows not-connected when the game view has never joined', () => {
        for (const phase of ['idle', 'connecting', 'open', 'closed', 'error'] as const) {
            const gate = evaluateGameConnectionGate({ ...base, phase });
            assert.equal(gate.showOverlay, true, phase);
            assert.equal(gate.freezeMovement, true, phase);
            assert.equal(gate.reason, 'not-connected', phase);
        }
    });

    it('hides only when the socket is open, join arrived, and packets are fresh', () => {
        const gate = evaluateGameConnectionGate({
            ...base,
            phase: 'open',
            joinWorldReceived: true,
            lastServerPacketAt: NOW - 1000,
        });
        assert.equal(gate.showOverlay, false);
        assert.equal(gate.freezeMovement, false);
        assert.equal(gate.reason, null);
    });

    it('treats an open socket without join/world packets as not connected', () => {
        const gate = evaluateGameConnectionGate({
            ...base,
            phase: 'open',
            joinWorldReceived: false,
            lastServerPacketAt: NOW,
        });
        assert.equal(gate.reason, 'not-connected');
        assert.equal(gate.freezeMovement, true);
    });

    it('treats silence, close, and error after join as connection lost', () => {
        const stale = evaluateGameConnectionGate({
            ...base,
            phase: 'open',
            joinWorldReceived: true,
            lastServerPacketAt: NOW - GAME_SERVER_PACKET_TIMEOUT_MS - 1,
        });
        assert.equal(stale.reason, 'connection-lost');
        assert.equal(stale.showOverlay, true);

        const closed = evaluateGameConnectionGate({
            ...base,
            phase: 'closed',
            joinWorldReceived: true,
            lastServerPacketAt: NOW,
        });
        assert.equal(closed.reason, 'connection-lost');

        const errored = evaluateGameConnectionGate({
            ...base,
            phase: 'error',
            joinWorldReceived: true,
            lastServerPacketAt: NOW,
        });
        assert.equal(errored.reason, 'connection-lost');
    });

    it('treats a failed connect before join as not connected', () => {
        const gate = evaluateGameConnectionGate({
            ...base,
            phase: 'error',
            joinWorldReceived: false,
        });
        assert.equal(gate.reason, 'not-connected');
    });
});

describe('serverConnectionCopy', () => {
    it('uses the Spanish reconnect copy for es', () => {
        const copy = serverConnectionCopy('es');
        assert.equal(copy.title, 'Sin conexión con el servidor');
        assert.equal(copy.reasonNotConnected, 'No conectado');
        assert.equal(copy.reasonConnectionLost, 'Conexión perdida');
        assert.equal(copy.reconnect, 'Reconectar');
    });

    it('uses Portuguese and English for the other chat languages', () => {
        assert.equal(serverConnectionCopy('pt').title, 'Sem conexão com o servidor');
        assert.equal(serverConnectionCopy('en').reconnect, 'Reconnect');
        assert.equal(serverConnectionCopy(undefined).reasonNotConnected, 'Not connected');
    });
});

describe('decideGameReconnectAction', () => {
    const bound = { wallet: 'PhantomWallet111', token: 'seal', expiresAt: NOW + 60_000 };

    it('returns to bind when the wallet is missing, blank, or expired', () => {
        assert.equal(isWalletBoundForGameReconnect(null, NOW), false);
        assert.equal(isWalletBoundForGameReconnect({ wallet: '  ', token: 'seal' }, NOW), false);
        assert.equal(isWalletBoundForGameReconnect({ ...bound, expiresAt: NOW }, NOW), false);
        assert.equal(decideGameReconnectAction(null, true, NOW), 'bind');
        assert.equal(decideGameReconnectAction({ ...bound, expiresAt: NOW - 1 }, true, NOW), 'bind');
    });

    it('returns to bind when there is no previous connect payload', () => {
        assert.equal(decideGameReconnectAction(bound, false, NOW), 'bind');
    });

    it('retries the connect flow when the wallet is bound and a payload exists', () => {
        assert.equal(decideGameReconnectAction(bound, true, NOW), 'reconnect');
    });
});

describe('gameServerLinkStore', { concurrency: false }, () => {
    beforeEach(() => {
        resetGameServerLinkForTests();
    });

    it('shows not-connected in the game view until join packets arrive on an open socket', () => {
        setGameConnectionViewActive(true, NOW);
        assert.equal(gameServerLinkStore.state.showOverlay, true);
        assert.equal(gameServerLinkStore.state.reason, 'not-connected');

        noteGameServerConnecting(NOW);
        noteGameServerOpen(NOW);
        assert.equal(gameServerLinkStore.state.reason, 'not-connected');

        noteGameServerJoin(NOW);
        assert.equal(gameServerLinkStore.state.showOverlay, false);
        assert.equal(gameServerLinkStore.state.reason, null);
    });

    it('shows connection lost when packets stop or the socket closes after join', () => {
        setGameConnectionViewActive(true, NOW);
        noteGameServerOpen(NOW);
        noteGameServerJoin(NOW);
        refreshGameConnectionOverlay(NOW + GAME_SERVER_PACKET_TIMEOUT_MS + 5);
        assert.equal(gameServerLinkStore.state.showOverlay, true);
        assert.equal(gameServerLinkStore.state.reason, 'connection-lost');

        noteGameServerPacket(NOW + GAME_SERVER_PACKET_TIMEOUT_MS + 5);
        assert.equal(gameServerLinkStore.state.showOverlay, false);

        noteGameServerClosed(NOW + GAME_SERVER_PACKET_TIMEOUT_MS + 5);
        assert.equal(gameServerLinkStore.state.reason, 'connection-lost');
    });

    it('keeps a connect error before join as not connected', () => {
        setGameConnectionViewActive(true, NOW);
        noteGameServerConnecting(NOW);
        noteGameServerError(NOW);
        assert.equal(gameServerLinkStore.state.phase, 'error');
        assert.equal(gameServerLinkStore.state.reason, 'not-connected');
    });
});

describe('isGameSocketOpen', () => {
    it('is true only for readyState OPEN', () => {
        assert.equal(isGameSocketOpen(undefined), false);
        assert.equal(isGameSocketOpen({ readyState: 0 }), false);
        assert.equal(isGameSocketOpen({ readyState: 1 }), true);
        assert.equal(isGameSocketOpen({ readyState: 3 }), false);
    });
});
