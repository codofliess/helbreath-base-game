import { ClientMessage, ServerMessage, type ArenaPactState } from '../proto/generated/network';
import { buildGameWebSocketUrl } from './gameWebSocketUrl';

const INBOX_TIMEOUT_MS = 6_000;

/**
 * Short-lived WebSocket: wallet-auth list of pending PVP duel invites
 * for the given character / arena kit names (hub inbox).
 */
export async function fetchArenaPactInbox(
    host: string,
    port: number,
    wallet: string,
    authToken: string,
    filterNames: string[],
): Promise<ArenaPactState[]> {
    const trimmedHost = host.trim();
    const trimmedWallet = wallet.trim();
    if (!trimmedHost || !Number.isFinite(port) || port < 1 || port > 65535) {
        throw new Error('Invalid host or port for PVP inbox.');
    }
    if (!trimmedWallet) {
        throw new Error('Wallet is required for PVP inbox.');
    }
    const names = filterNames.map((n) => n.trim()).filter(Boolean);
    const websocketUrl = buildGameWebSocketUrl(trimmedHost, port);

    return new Promise((resolve, reject) => {
        let settled = false;
        const socket = new WebSocket(websocketUrl);
        socket.binaryType = 'arraybuffer';

        const finish = (error?: Error, invites?: ArenaPactState[]) => {
            if (settled) {
                return;
            }
            settled = true;
            window.clearTimeout(timeoutId);
            try {
                socket.close();
            } catch {
                // ignore
            }
            if (error) {
                reject(error);
            } else {
                resolve(invites ?? []);
            }
        };

        const timeoutId = window.setTimeout(() => {
            finish(new Error('Timed out waiting for PVP inbox.'));
        }, INBOX_TIMEOUT_MS);

        socket.addEventListener('open', () => {
            const packet = ClientMessage.encode({
                payload: {
                    $case: 'arenaPactListRequest',
                    value: {
                        id: trimmedWallet,
                        authToken: authToken ?? '',
                        filterNames: names,
                    },
                },
            }).finish();
            socket.send(packet);
        });

        socket.addEventListener('message', (event: MessageEvent) => {
            if (!(event.data instanceof ArrayBuffer)) {
                return;
            }
            try {
                const message = ServerMessage.decode(new Uint8Array(event.data));
                if (message.payload?.$case !== 'arenaPactListResponse') {
                    return;
                }
                finish(undefined, message.payload.value.matches ?? []);
            } catch (error) {
                finish(error instanceof Error ? error : new Error('Failed to decode PVP inbox.'));
            }
        });

        socket.addEventListener('error', () => {
            finish(new Error(`Failed to connect to ${websocketUrl} for PVP inbox.`));
        });

        socket.addEventListener('close', (event) => {
            if (!settled) {
                const reason = event.reason?.trim();
                finish(new Error(reason || 'Connection closed before PVP inbox arrived.'));
            }
        });
    });
}

/** Decline a pending invite from the hub without entering the world. */
export async function declineArenaPactFromHub(
    host: string,
    port: number,
    wallet: string,
    authToken: string,
    matchId: string,
    inviteeName: string,
    remainingFilterNames: string[],
): Promise<ArenaPactState[]> {
    const marker = `__decline__:${matchId}:${inviteeName}`;
    return fetchArenaPactInbox(host, port, wallet, authToken, [marker, ...remainingFilterNames]);
}
