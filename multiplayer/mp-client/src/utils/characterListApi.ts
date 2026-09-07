import { ClientMessage, ServerMessage } from '../proto/generated/network';
import { buildGameWebSocketUrl } from './gameWebSocketUrl';
import { getPlayerModeWireValue } from './playerMode';
import { selectCharWarn } from './selectCharTrace';

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

const LIST_TIMEOUT_MS = 15_000;
/** Hold the list socket after decode so React remount / paint cannot race a close wipe. */
const LIST_SOCKET_HOLD_MS = 400;

export interface ParsedCharacterList {
    slots: CharacterSlotSummary[];
    referral?: ReferralListInfo;
}

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

/** Tag for live smoke when a WS frame is not the expected binary type. */
export function wsPayloadTag(data: unknown): string {
    if (data == null) {
        return String(data);
    }
    const ctor = (data as { constructor?: { name?: string } }).constructor?.name ?? '?';
    const tos = Object.prototype.toString.call(data);
    const byteLength =
        typeof (data as { byteLength?: unknown }).byteLength === 'number'
            ? (data as { byteLength: number }).byteLength
            : undefined;
    return `${tos}|${ctor}|bl=${byteLength ?? 'n'}`;
}

function copyToSameRealmBytes(view: Uint8Array): Uint8Array {
    const copy = new Uint8Array(view.byteLength);
    copy.set(view);
    return copy;
}

function isArrayBufferLike(data: unknown): data is ArrayBuffer {
    if (typeof ArrayBuffer === 'undefined' || data == null || typeof data !== 'object') {
        return false;
    }
    if (Object.prototype.toString.call(data) === '[object ArrayBuffer]') {
        return true;
    }
    const maybe = data as { byteLength?: unknown; constructor?: { name?: string }; slice?: unknown };
    return (
        typeof maybe.byteLength === 'number' &&
        maybe.constructor?.name === 'ArrayBuffer' &&
        typeof maybe.slice === 'function'
    );
}

function isBlobLike(data: unknown): data is Blob {
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
        return true;
    }
    if (data == null || typeof data !== 'object') {
        return false;
    }
    return (
        Object.prototype.toString.call(data) === '[object Blob]' &&
        typeof (data as Blob).arrayBuffer === 'function'
    );
}

/**
 * Copy a WS binary frame into a same-realm Uint8Array.
 * KindGem / Phantom / iframe wrappers can fail `instanceof ArrayBuffer` and still
 * carry a real protobuf frame — silent drop there is the live SELECTCHAR empty-desk
 * path (server CharacterList logged, Occupied never fires).
 */
export function coerceWsBinaryPayload(
    data: unknown,
): { ok: true; bytes: Uint8Array; tag: string } | { ok: false; tag: string } {
    const tag = wsPayloadTag(data);
    if (data == null) {
        return { ok: false, tag };
    }
    if (data instanceof Uint8Array) {
        return { ok: true, bytes: copyToSameRealmBytes(data), tag };
    }
    if (data instanceof ArrayBuffer) {
        return { ok: true, bytes: copyToSameRealmBytes(new Uint8Array(data)), tag };
    }
    if (ArrayBuffer.isView(data)) {
        const view = data as ArrayBufferView;
        return {
            ok: true,
            bytes: copyToSameRealmBytes(new Uint8Array(view.buffer, view.byteOffset, view.byteLength)),
            tag,
        };
    }
    if (isArrayBufferLike(data)) {
        try {
            return { ok: true, bytes: copyToSameRealmBytes(new Uint8Array(data as ArrayBuffer)), tag };
        } catch {
            return { ok: false, tag };
        }
    }
    return { ok: false, tag };
}

/** Read a WebSocket binary frame as bytes (ArrayBuffer, typed view, duck-typed buffer, or Blob). */
export async function wsPayloadToBytes(data: unknown): Promise<Uint8Array | undefined> {
    const coerced = coerceWsBinaryPayload(data);
    if (coerced.ok) {
        return coerced.bytes;
    }
    if (isBlobLike(data)) {
        return copyToSameRealmBytes(new Uint8Array(await data.arrayBuffer()));
    }
    return undefined;
}

function claimDeskSlotIndex(raw: number, used: Set<number>): number {
    if (Number.isInteger(raw) && raw >= 0 && raw <= 3 && !used.has(raw)) {
        return raw;
    }
    for (let i = 0; i < 4; i++) {
        if (!used.has(i)) {
            return i;
        }
    }
    return 0;
}

/**
 * Clamp occupied rows onto visual desks 0–3.
 * EventBus / store copies can carry NaN or out-of-range slotIndex; without this
 * SelectCharDesk.slotForIndex never matches and every card stays Empty.
 */
export function normalizeDeskCharacterSlots(
    slots: CharacterSlotSummary[],
): CharacterSlotSummary[] {
    const used = new Set<number>();
    const out: CharacterSlotSummary[] = [];
    for (const row of slots) {
        if (!row) {
            continue;
        }
        const raw = Number(row.slotIndex);
        const slotIndex = claimDeskSlotIndex(Number.isFinite(raw) ? raw : 0, used);
        used.add(slotIndex);
        out.push({
            ...row,
            slotIndex,
            name: (row.name ?? '').trim(),
        });
    }
    out.sort((a, b) => a.slotIndex - b.slotIndex);
    return out;
}

/**
 * Map proto CharacterListResponse rows onto desk slots 0–3.
 * Does not filter traveler vs city — every occupied server row is shown.
 */
export function mapCharacterListResponse(body: {
    characters?: Array<{
        slotIndex?: number;
        name?: string;
        level?: number;
        exp?: bigint | number;
        rebirth?: number;
        hoursPlayed?: number;
        str?: number;
        vit?: number;
        dex?: number;
        intel?: number;
        mag?: number;
        chr?: number;
        gender?: number;
        skinColor?: number;
        hairStyleIndex?: number;
        underwearColorIndex?: number;
        equipped?: Array<{ slot?: string; itemId?: number } | undefined>;
        citizenshipSide?: string;
    }>;
    referralCode?: string;
    referralShareUrl?: string;
    referralAlreadyAttributed?: boolean;
}): ParsedCharacterList {
    const used = new Set<number>();
    const slots: CharacterSlotSummary[] = [];
    for (const c of body.characters ?? []) {
        if (!c) {
            continue;
        }
        const slotIndex = claimDeskSlotIndex(c.slotIndex ?? 0, used);
        used.add(slotIndex);
        slots.push({
            slotIndex,
            name: (c.name ?? '').trim(),
            level: c.level ?? 0,
            exp: c.exp ?? 0,
            rebirth: c.rebirth ?? 0,
            hoursPlayed: c.hoursPlayed ?? 0,
            str: c.str ?? 0,
            vit: c.vit ?? 0,
            dex: c.dex ?? 0,
            intel: c.intel ?? 0,
            mag: c.mag ?? 0,
            chr: c.chr ?? 0,
            gender: c.gender ?? 0,
            skinColor: c.skinColor ?? 0,
            hairStyleIndex: c.hairStyleIndex ?? 0,
            underwearColorIndex: c.underwearColorIndex ?? 0,
            equipped: (c.equipped ?? [])
                .filter((e): e is { slot: string; itemId: number } => !!e && (e.itemId ?? 0) > 0 && !!e.slot)
                .map((e) => ({ slot: e.slot, itemId: e.itemId })),
            citizenshipSide: normalizeCitizenshipSide(c.citizenshipSide),
        });
    }
    slots.sort((a, b) => a.slotIndex - b.slotIndex);

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
    return { slots, referral };
}

/** One inbound WS frame while waiting for CharacterListResponse (including bootstrap). */
export interface CharacterListFrameInspection {
    payloadCase: string;
    parsed?: ParsedCharacterList;
    decodeError?: string;
}

/**
 * Decode one ServerMessage without wiping the desk on bootstrap / junk frames.
 * Logs live smoke uses this so a silent worldsList skip cannot hide a bad list decode.
 */
export function inspectCharacterListFrame(bytes: Uint8Array): CharacterListFrameInspection {
    try {
        const message = ServerMessage.decode(bytes);
        const payloadCase = message.payload?.$case ?? 'none';
        if (payloadCase !== 'characterListResponse' || message.payload?.$case !== 'characterListResponse') {
            return { payloadCase };
        }
        return {
            payloadCase,
            parsed: mapCharacterListResponse(message.payload.value),
        };
    } catch (error) {
        return {
            payloadCase: 'decode-error',
            decodeError: error instanceof Error ? error.message : String(error),
        };
    }
}

export function tryParseCharacterListMessage(bytes: Uint8Array): ParsedCharacterList | undefined {
    const inspected = inspectCharacterListFrame(bytes);
    if (inspected.payloadCase === 'decode-error') {
        console.warn(
            '[characterList] Ignoring undecodable WS frame while waiting for list',
            inspected.decodeError,
        );
        return undefined;
    }
    return inspected.parsed;
}

let sharedListFetch:
    | { key: string; promise: Promise<ParsedCharacterList> }
    | undefined;

/** Last occupied desk keyed by wallet — survives WS close, remount, and token refresh. */
const occupiedListByWallet = new Map<string, ParsedCharacterList>();

export function peekCachedOccupiedCharacterList(wallet: string): ParsedCharacterList | undefined {
    const key = wallet.trim();
    if (!key) {
        return undefined;
    }
    return occupiedListByWallet.get(key);
}

/** Drops the occupied-list cache (Reconnect / Sign again, or tests). */
export function clearCachedOccupiedCharacterList(wallet?: string): void {
    if (wallet && wallet.trim()) {
        occupiedListByWallet.delete(wallet.trim());
        return;
    }
    occupiedListByWallet.clear();
}

function rememberOccupiedCharacterList(wallet: string, parsed: ParsedCharacterList): void {
    if (parsed.slots.length === 0) {
        return;
    }
    const key = wallet.trim();
    if (!key) {
        return;
    }
    occupiedListByWallet.set(key, parsed);
}

/**
 * Prefer an occupied list that already arrived over close/error/empty follow-ups.
 * Used by the WS client and ConnectDialog so SELECTCHAR never wipes Elon after a valid paint.
 */
export function coalesceCharacterListResult(
    incoming: ParsedCharacterList | undefined,
    error: Error | undefined,
    buffered: ParsedCharacterList | undefined,
): { ok: ParsedCharacterList } | { error: Error } {
    const occupied = (list: ParsedCharacterList | undefined): list is ParsedCharacterList =>
        (list?.slots.length ?? 0) > 0;
    if (occupied(incoming)) {
        return { ok: incoming };
    }
    if (occupied(buffered)) {
        if (error) {
            console.warn(
                '[characterList] WS close/error/timeout after occupied list; keeping buffered slots',
                error,
            );
        }
        return { ok: buffered };
    }
    if (incoming && !error) {
        return { ok: incoming };
    }
    if (buffered && !error) {
        return { ok: buffered };
    }
    return { error: error ?? new Error('Connection closed before character list arrived.') };
}

/**
 * One in-flight CharacterList WS per wallet+token+endpoint so React Strict Mode
 * / overlapping hub enters do not cancel a valid list or open a second socket.
 * Occupied lists are reused so a remount after the first socket settles does not
 * open another CharacterList connection (live: two WS both slots=1 same second).
 */
export function fetchCharacterListShared(
    host: string,
    port: number,
    wallet: string,
    authToken: string,
): Promise<ParsedCharacterList> {
    const trimmedWallet = wallet.trim();
    const cached = peekCachedOccupiedCharacterList(trimmedWallet);
    if (cached && cached.slots.length > 0) {
        console.info(
            '[characterList] Reusing occupied list wallet=%s… slots=%d (no new WS)',
            trimmedWallet.slice(0, 8),
            cached.slots.length,
        );
        return Promise.resolve(cached);
    }
    const key = `${trimmedWallet}\0${authToken}\0${host.trim()}\0${port}`;
    if (sharedListFetch?.key === key) {
        return sharedListFetch.promise;
    }
    const promise = fetchCharacterList(host, port, trimmedWallet, authToken).finally(() => {
        if (sharedListFetch?.promise === promise) {
            sharedListFetch = undefined;
        }
    });
    sharedListFetch = { key, promise };
    return promise;
}

/**
 * Opens a WebSocket, sends CharacterListRequest after Phantom auth, and returns
 * up to 4 occupied desk slots. Does not join a game world.
 *
 * The socket stays open after the list frame until paint has a turn (hold delay).
 * First-frame WorldsList / undecodable bytes are ignored. Close/error/timeout
 * after an occupied list still resolve with that buffer — they must not wipe.
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
    const trimmedToken = (authToken ?? '').trim();
    if (!trimmedToken) {
        throw new Error('Wallet auth token missing for character list.');
    }

    const websocketUrl = buildGameWebSocketUrl(trimmedHost, port);

    return new Promise((resolve, reject) => {
        let settled = false;
        let buffered: ParsedCharacterList | undefined;
        let pendingBlobReads = 0;
        const socket = new WebSocket(websocketUrl);
        socket.binaryType = 'arraybuffer';

        const scheduleSocketClose = () => {
            const closer = () => {
                try {
                    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                        socket.close();
                    }
                } catch {
                    // ignore close errors
                }
            };
            const hold = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
            hold(closer, LIST_SOCKET_HOLD_MS);
        };

        const finish = (error?: Error, payload?: ParsedCharacterList, force = false) => {
            if (settled) {
                return;
            }
            const coalesced = coalesceCharacterListResult(payload, error, buffered);
            if ('ok' in coalesced) {
                settled = true;
                window.clearTimeout(timeoutId);
                buffered = coalesced.ok;
                const names = coalesced.ok.slots.map((s) => s.name).join(',');
                if (coalesced.ok.slots.length > 0) {
                    rememberOccupiedCharacterList(trimmedWallet, coalesced.ok);
                }
                selectCharWarn(
                    'characterList Occupied list ready slots=%d names=%s; holding WS %dms',
                    coalesced.ok.slots.length,
                    names || '(empty)',
                    LIST_SOCKET_HOLD_MS,
                );
                scheduleSocketClose();
                resolve(coalesced.ok);
                return;
            }
            if (!force && pendingBlobReads > 0) {
                return;
            }
            settled = true;
            window.clearTimeout(timeoutId);
            scheduleSocketClose();
            selectCharWarn('characterList WS failed: %s', coalesced.error.message);
            reject(coalesced.error);
        };

        const acceptParsed = (parsed: ParsedCharacterList | undefined) => {
            if (!parsed) {
                return;
            }
            buffered = parsed;
            if (parsed.slots.length > 0) {
                rememberOccupiedCharacterList(trimmedWallet, parsed);
            }
            finish(undefined, parsed);
        };

        const onListBytes = (bytes: Uint8Array, payloadTag?: string) => {
            const inspected = inspectCharacterListFrame(bytes);
            selectCharWarn(
                'characterList WS frame case=%s slots=%s names=%s bytes=%d tag=%s',
                inspected.payloadCase,
                inspected.parsed ? inspected.parsed.slots.length : '-',
                inspected.parsed?.slots.map((s) => s.name).join(',') || inspected.decodeError || '',
                bytes.byteLength,
                payloadTag ?? '',
            );
            if (inspected.payloadCase === 'decode-error') {
                console.warn(
                    '[characterList] Ignoring undecodable WS frame while waiting for list',
                    inspected.decodeError,
                );
            }
            acceptParsed(inspected.parsed);
        };

        const timeoutId = window.setTimeout(() => {
            finish(new Error('Timed out waiting for character list.'), undefined, true);
        }, LIST_TIMEOUT_MS);

        socket.addEventListener('open', () => {
            selectCharWarn(
                'characterList WS open sending request wallet=%s… url=%s',
                trimmedWallet.slice(0, 8),
                websocketUrl,
            );
            const packet = ClientMessage.encode({
                payload: {
                    $case: 'characterListRequest',
                    value: {
                        id: trimmedWallet,
                        authToken: trimmedToken,
                        playerMode: getPlayerModeWireValue(),
                    },
                },
            }).finish();
            socket.send(packet);
        });

        socket.addEventListener('message', (event: MessageEvent) => {
            const data = event.data as unknown;
            const coerced = coerceWsBinaryPayload(data);
            if (coerced.ok) {
                onListBytes(coerced.bytes, coerced.tag);
                return;
            }
            if (!isBlobLike(data)) {
                selectCharWarn('characterList WS frame not binary tag=%s', coerced.tag);
                return;
            }
            pendingBlobReads += 1;
            void (async () => {
                try {
                    const bytes = await wsPayloadToBytes(data);
                    if (!bytes) {
                        selectCharWarn('characterList WS frame not bytes tag=%s', coerced.tag);
                        return;
                    }
                    onListBytes(bytes, coerced.tag);
                } finally {
                    pendingBlobReads -= 1;
                    if (!settled && pendingBlobReads === 0 && buffered) {
                        finish(undefined, buffered);
                    }
                }
            })();
        });

        socket.addEventListener('error', () => {
            selectCharWarn('characterList WS error url=%s', websocketUrl);
            finish(new Error(`Failed to connect to ${websocketUrl} for character list.`));
        });

        socket.addEventListener('close', (event) => {
            if (settled) {
                return;
            }
            const reason = event.reason?.trim();
            selectCharWarn('characterList WS close before list code=%s reason=%s', event.code, reason || '');
            finish(new Error(reason || 'Connection closed before character list arrived.'));
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
