import { ClientMessage, ServerMessage } from '../proto/generated/network';
import { buildGameWebSocketUrl } from './gameWebSocketUrl';
import { getPlayerModeWireValue } from './playerMode';

/** Visible equip row for SELECTCHAR walk/rotate preview (mirrors CharacterEquipPreview proto). */
export interface CharacterEquipPreview {
    slot: string;
    itemId: number;
}

/** One occupied SELECTCHAR desk slot (empty slots are omitted by the server). */
export interface CharacterSlotSummary {
    slotIndex: number;
    name: string;
    level: number;
    exp: bigint | number;
    rebirth: number;
    hoursPlayed: number;
    str: number;
    vit: number;
    dex: number;
    intel: number;
    mag: number;
    chr: number;
    gender: number;
    skinColor: number;
    hairStyleIndex: number;
    underwearColorIndex: number;
    /** Equipped gear for Olympia DrawObject_OnMove_ForMenu preview. */
    equipped?: CharacterEquipPreview[];
    /** aresden | elvine | traveler */
    citizenshipSide?: string;
}

/** Wallet-level referral info from CharacterListResponse. */
export interface ReferralListInfo {
    code: string;
    shareUrl: string;
    alreadyAttributed: boolean;
}

const LIST_TIMEOUT_MS = 5_000;

/** Normalize city citizenship for SELECTCHAR seals. */
export function normalizeCitizenshipSide(
    side: string | undefined | null,
): 'aresden' | 'elvine' | 'traveler' {
    const s = (side ?? '').trim().toLowerCase();
    if (s === 'aresden' || s === 'elvine') {
        return s;
    }
    return 'traveler';
}

/**
 * Opens a short-lived WebSocket, sends CharacterListRequest after Phantom auth,
 * and returns up to 4 occupied desk slots. Does not join a game world.
 */
export async function fetchCharacterList(
    host: string,
    port: number,
    wallet: string,
    authToken: string,
): Promise<{ slots: CharacterSlotSummary[]; referral?: ReferralListInfo }> {
    const trimmedHost = host.trim();
    const trimmedWallet = wallet.trim();
    if (!trimmedHost || !Number.isFinite(port) || port < 1 || port > 65535) {
        throw new Error('Invalid host or port for character list.');
    }
    if (!trimmedWallet) {
        throw new Error('Wallet is required for character list.');
    }

    const websocketUrl = buildGameWebSocketUrl(trimmedHost, port);

    return new Promise((resolve, reject) => {
        let settled = false;
        const socket = new WebSocket(websocketUrl);
        socket.binaryType = 'arraybuffer';

        const finish = (
            error?: Error,
            payload?: { slots: CharacterSlotSummary[]; referral?: ReferralListInfo },
        ) => {
            if (settled) {
                return;
            }
            settled = true;
            window.clearTimeout(timeoutId);
            try {
                socket.close();
            } catch {
                // ignore close errors
            }
            if (error) {
                reject(error);
            } else {
                resolve(payload ?? { slots: [] });
            }
        };

        const timeoutId = window.setTimeout(() => {
            finish(new Error('Timed out waiting for character list.'));
        }, LIST_TIMEOUT_MS);

        socket.addEventListener('open', () => {
            const packet = ClientMessage.encode({
                payload: {
                    $case: 'characterListRequest',
                    value: {
                        id: trimmedWallet,
                        authToken: authToken ?? '',
                        playerMode: getPlayerModeWireValue(),
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
                if (message.payload?.$case !== 'characterListResponse') {
                    return;
                }
                const body = message.payload.value;
                const characters = body.characters ?? [];
                const code = (body.referralCode ?? '').trim();
                const shareUrl =
                    (body.referralShareUrl ?? '').trim() ||
                    (code ? `https://play.chainlords.net/?ref=${code}` : '');
                const referral: ReferralListInfo | undefined = code
                    ? {
                          code,
                          shareUrl,
                          alreadyAttributed: !!body.referralAlreadyAttributed,
                      }
                    : undefined;
                finish(undefined, {
                    slots: characters.map((c) => ({
                        slotIndex: c.slotIndex,
                        name: c.name,
                        level: c.level,
                        exp: c.exp,
                        rebirth: c.rebirth,
                        hoursPlayed: c.hoursPlayed,
                        str: c.str,
                        vit: c.vit,
                        dex: c.dex,
                        intel: c.intel,
                        mag: c.mag,
                        chr: c.chr,
                        gender: c.gender,
                        skinColor: c.skinColor,
                        hairStyleIndex: c.hairStyleIndex,
                        underwearColorIndex: c.underwearColorIndex,
                        equipped: (c.equipped ?? [])
                            .filter((e) => e && e.itemId > 0 && e.slot)
                            .map((e) => ({ slot: e.slot, itemId: e.itemId })),
                        citizenshipSide: normalizeCitizenshipSide(c.citizenshipSide),
                    })),
                    referral,
                });
            } catch (error) {
                finish(error instanceof Error ? error : new Error('Failed to decode character list.'));
            }
        });

        // Browser fires `error` then `close` on failure — only settle once (avoids double toasts/modals).
        socket.addEventListener('error', () => {
            finish(new Error(`Failed to connect to ${websocketUrl} for character list.`));
        });

        socket.addEventListener('close', (event) => {
            if (!settled) {
                const reason = event.reason?.trim();
                finish(new Error(reason || 'Connection closed before character list arrived.'));
            }
        });
    });
}

/** Formats lifetime hours for the SELECTCHAR desk (e.g. 12.5h). */
export function formatHoursPlayed(hours: number): string {
    if (!Number.isFinite(hours) || hours <= 0) {
        return '0h';
    }
    if (hours < 10) {
        return `${hours.toFixed(1)}h`;
    }
    return `${Math.floor(hours)}h`;
}

/** Formats exp for desk display. */
export function formatExp(exp: bigint | number): string {
    const n = typeof exp === 'bigint' ? Number(exp) : exp;
    if (!Number.isFinite(n) || n < 0) {
        return '0';
    }
    return Math.floor(n).toLocaleString('en-US');
}
