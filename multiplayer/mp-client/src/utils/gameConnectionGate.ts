import { Store } from '@tanstack/react-store';
import type { ConnectToServerPayload } from '../constants/EventNames';

/**
 * Live game-socket presentation.
 *
 * `LoginScreen` starts `GameWorld` from `InitialGameWorldState` alone. The socket
 * can already be closed (or never have reached OPEN) by the time the scene paints
 * a local avatar, and `SOCKET_DISCONNECTED` is easy to miss across that swap.
 * This module is the source of truth for "in the game view without a live join".
 */

/** Browser `WebSocket.OPEN`. Kept numeric so tests do not need a DOM WebSocket. */
export const GAME_SOCKET_OPEN = 1;

/**
 * Silence longer than this while the socket still says OPEN is treated as a dead
 * session. The server ping is about one second; 15s covers several missed
 * heartbeats without flipping the overlay on a single dropped frame.
 */
export const GAME_SERVER_PACKET_TIMEOUT_MS = 15_000;

export type GameServerLinkPhase = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export type GameConnectionReason = 'not-connected' | 'connection-lost';

export interface GameConnectionSnapshot {
    inGameView: boolean;
    phase: GameServerLinkPhase;
    /** True after InitialGameWorldState on the current connect attempt. */
    joinWorldReceived: boolean;
    lastServerPacketAt: number | undefined;
    now: number;
    packetTimeoutMs: number;
}

export interface GameConnectionGate {
    showOverlay: boolean;
    freezeMovement: boolean;
    reason: GameConnectionReason | null;
}

export interface ServerConnectionCopy {
    title: string;
    reasonNotConnected: string;
    reasonConnectionLost: string;
    reconnect: string;
}

export interface GameServerLinkView {
    phase: GameServerLinkPhase;
    showOverlay: boolean;
    reason: GameConnectionReason | null;
}

const initialView: GameServerLinkView = {
    phase: 'idle',
    showOverlay: false,
    reason: null,
};

export const gameServerLinkStore = new Store<GameServerLinkView>(initialView);

interface LinkInternals {
    phase: GameServerLinkPhase;
    joinWorldReceived: boolean;
    lastServerPacketAt: number | undefined;
}

const link: LinkInternals = {
    phase: 'idle',
    joinWorldReceived: false,
    lastServerPacketAt: undefined,
};

let viewActive = false;
let lastWorldEnter: ConnectToServerPayload | null = null;

/** True when `socket.readyState` is OPEN. */
export function isGameSocketOpen(socket: { readyState: number } | undefined | null): boolean {
    return !!socket && socket.readyState === GAME_SOCKET_OPEN;
}

/**
 * Overlay + movement freeze while the game view is up without an open socket
 * that has already delivered join/world packets and a recent server packet.
 */
export function evaluateGameConnectionGate(snapshot: GameConnectionSnapshot): GameConnectionGate {
    if (!snapshot.inGameView) {
        return { showOverlay: false, freezeMovement: false, reason: null };
    }
    const packetFresh =
        snapshot.lastServerPacketAt !== undefined &&
        snapshot.now - snapshot.lastServerPacketAt <= snapshot.packetTimeoutMs;
    const live = snapshot.phase === 'open' && snapshot.joinWorldReceived && packetFresh;
    if (live) {
        return { showOverlay: false, freezeMovement: false, reason: null };
    }
    return {
        showOverlay: true,
        freezeMovement: true,
        reason: snapshot.joinWorldReceived ? 'connection-lost' : 'not-connected',
    };
}

/** Bag-footer style: Spanish / Portuguese / English from the chat language `mtCode`. */
export function serverConnectionCopy(mtCode: string | undefined): ServerConnectionCopy {
    if (mtCode === 'es') {
        return {
            title: 'Sin conexión con el servidor',
            reasonNotConnected: 'No conectado',
            reasonConnectionLost: 'Conexión perdida',
            reconnect: 'Reconectar',
        };
    }
    if (mtCode === 'pt') {
        return {
            title: 'Sem conexão com o servidor',
            reasonNotConnected: 'Não conectado',
            reasonConnectionLost: 'Conexão perdida',
            reconnect: 'Reconectar',
        };
    }
    return {
        title: 'No connection to the server',
        reasonNotConnected: 'Not connected',
        reasonConnectionLost: 'Connection lost',
        reconnect: 'Reconnect',
    };
}

/** Wallet seal present and not expired. Missing or stale seals go back to Bind Phantom. */
export function isWalletBoundForGameReconnect(
    session: { wallet?: string; token?: string; expiresAt?: number } | null | undefined,
    now: number,
): boolean {
    const wallet = session?.wallet?.trim() ?? '';
    const token = session?.token?.trim() ?? '';
    if (!wallet || !token) {
        return false;
    }
    if (typeof session?.expiresAt === 'number' && session.expiresAt > 0 && session.expiresAt <= now) {
        return false;
    }
    return true;
}

/** Reconnect only when a bound wallet and a previous Start payload both exist. */
export function decideGameReconnectAction(
    session: { wallet?: string; token?: string; expiresAt?: number } | null | undefined,
    hasPayload: boolean,
    now: number,
): 'bind' | 'reconnect' {
    if (!isWalletBoundForGameReconnect(session, now) || !hasPayload) {
        return 'bind';
    }
    return 'reconnect';
}

/** Last Start / Arena enter payload, so Reconectar can reuse the connect flow. */
export function rememberWorldEnterPayload(payload: ConnectToServerPayload): void {
    lastWorldEnter = payload;
}

export function peekWorldEnterPayload(): ConnectToServerPayload | null {
    return lastWorldEnter;
}

export function isLocalMovementFrozen(now = Date.now()): boolean {
    return evaluateGameConnectionGate(currentSnapshot(true, now)).freezeMovement;
}

/** GameWorld sets this while it is the active scene. */
export function setGameConnectionViewActive(active: boolean, now = Date.now()): void {
    viewActive = active;
    commit(now);
}

export function refreshGameConnectionOverlay(now = Date.now()): void {
    commit(now);
}

export function noteGameServerConnecting(now = Date.now()): void {
    link.phase = 'connecting';
    link.joinWorldReceived = false;
    link.lastServerPacketAt = undefined;
    commit(now);
}

export function noteGameServerOpen(now = Date.now()): void {
    link.phase = 'open';
    commit(now);
}

export function noteGameServerPacket(now = Date.now()): void {
    link.lastServerPacketAt = now;
    commit(now);
}

/** InitialGameWorldState — the join/world packet that makes the session live. */
export function noteGameServerJoin(now = Date.now()): void {
    link.joinWorldReceived = true;
    link.lastServerPacketAt = now;
    commit(now);
}

export function noteGameServerClosed(now = Date.now()): void {
    link.phase = 'closed';
    commit(now);
}

export function noteGameServerError(now = Date.now()): void {
    link.phase = 'error';
    commit(now);
}

/**
 * Intentional logout should leave the world, not flash the reconnect card
 * for the frame before LoginScreen mounts.
 */
export function noteIntentionalGameServerClose(): void {
    link.phase = 'closed';
    const prev = gameServerLinkStore.state;
    if (prev.phase === 'closed' && !prev.showOverlay && prev.reason === null) {
        return;
    }
    gameServerLinkStore.setState({
        phase: 'closed',
        showOverlay: false,
        reason: null,
    });
}

export function resetGameServerLinkForTests(): void {
    link.phase = 'idle';
    link.joinWorldReceived = false;
    link.lastServerPacketAt = undefined;
    viewActive = false;
    lastWorldEnter = null;
    gameServerLinkStore.setState(initialView);
}

function currentSnapshot(inGameView: boolean, now: number): GameConnectionSnapshot {
    return {
        inGameView,
        phase: link.phase,
        joinWorldReceived: link.joinWorldReceived,
        lastServerPacketAt: link.lastServerPacketAt,
        now,
        packetTimeoutMs: GAME_SERVER_PACKET_TIMEOUT_MS,
    };
}

function commit(now: number): void {
    const gate = evaluateGameConnectionGate(currentSnapshot(viewActive, now));
    const prev = gameServerLinkStore.state;
    if (prev.phase === link.phase && prev.showOverlay === gate.showOverlay && prev.reason === gate.reason) {
        return;
    }
    gameServerLinkStore.setState({
        phase: link.phase,
        showOverlay: gate.showOverlay,
        reason: gate.reason,
    });
}
