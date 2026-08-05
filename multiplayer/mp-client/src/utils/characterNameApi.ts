import { ClientMessage, ServerMessage } from '../proto/generated/network';
import { buildGameWebSocketUrl } from './gameWebSocketUrl';

const CHECK_TIMEOUT_MS = 4_000;

export interface CharacterNameCheckResult {
    available: boolean;
    message: string;
    characterName: string;
}

/**
 * Pre-world WS: check if a display name is free for Create Character.
 * Same wallet may re-use its own names; other wallets get "already taken".
 */
export async function checkCharacterNameAvailable(
    host: string,
    port: number,
    wallet: string,
    authToken: string,
    characterName: string,
): Promise<CharacterNameCheckResult> {
    const trimmedHost = host.trim();
    const trimmedWallet = wallet.trim();
    const trimmedName = characterName.trim();
    if (!trimmedHost || !Number.isFinite(port) || port < 1 || port > 65535) {
        throw new Error('Invalid host or port for name check.');
    }
    if (!trimmedWallet) {
        throw new Error('Wallet is required for name check.');
    }
    if (!trimmedName) {
        return { available: false, message: 'Enter a name (at least 2 letters).', characterName: '' };
    }

    const websocketUrl = buildGameWebSocketUrl(trimmedHost, port);

    return new Promise((resolve, reject) => {
        let settled = false;
        const socket = new WebSocket(websocketUrl);
        socket.binaryType = 'arraybuffer';

        const finish = (error?: Error, result?: CharacterNameCheckResult) => {
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
                resolve(
                    result ?? {
                        available: false,
                        message: 'Name check failed.',
                        characterName: trimmedName,
                    },
                );
            }
        };

        const timeoutId = window.setTimeout(() => {
            finish(new Error('Timed out waiting for name check.'));
        }, CHECK_TIMEOUT_MS);

        socket.addEventListener('open', () => {
            const packet = ClientMessage.encode({
                payload: {
                    $case: 'characterNameCheckRequest',
                    value: {
                        id: trimmedWallet,
                        authToken: authToken ?? '',
                        characterName: trimmedName,
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
                if (message.payload?.$case !== 'characterNameCheckResponse') {
                    return;
                }
                const value = message.payload.value;
                finish(undefined, {
                    available: !!value.available,
                    message: (value.message || '').trim(),
                    characterName: (value.characterName || trimmedName).trim(),
                });
            } catch (error) {
                finish(error instanceof Error ? error : new Error('Failed to decode name check.'));
            }
        });

        socket.addEventListener('error', () => {
            finish(new Error(`Failed to connect to ${websocketUrl} for name check.`));
        });

        socket.addEventListener('close', (event) => {
            if (!settled) {
                const reason = event.reason?.trim();
                finish(new Error(reason || 'Connection closed before name check arrived.'));
            }
        });
    });
}
