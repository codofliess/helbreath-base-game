import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ServerMessage } from '../proto/generated/network';
import {
    mapCharacterListResponse,
    tryParseCharacterListMessage,
    wsPayloadToBytes,
    coalesceCharacterListResult,
    clearCachedOccupiedCharacterList,
    fetchCharacterList,
    fetchCharacterListShared,
    peekCachedOccupiedCharacterList,
} from './characterListApi';

function encodeListFrame(partial: Parameters<typeof mapCharacterListResponse>[0]): Uint8Array {
    return ServerMessage.encode({
        payload: {
            $case: 'characterListResponse',
            value: {
                characters: (partial.characters ?? []).map((c) => ({
                    slotIndex: c.slotIndex ?? 0,
                    name: c.name ?? '',
                    level: c.level ?? 0,
                    exp: typeof c.exp === 'bigint' ? c.exp : BigInt(c.exp ?? 0),
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
                    equipped: [],
                    citizenshipSide: c.citizenshipSide ?? '',
                })),
                referralCode: partial.referralCode,
                referralShareUrl: partial.referralShareUrl,
                referralAlreadyAttributed: partial.referralAlreadyAttributed,
                arenaPactInvites: [],
            },
        },
    }).finish();
}

describe('character list parse / paint mapping', () => {
    it('maps a traveler row so SELECTCHAR can show name and level', () => {
        const parsed = mapCharacterListResponse({
            characters: [
                {
                    slotIndex: 0,
                    name: 'Elon',
                    level: 150,
                    citizenshipSide: 'elvine',
                },
            ],
        });
        assert.equal(parsed.slots.length, 1);
        assert.equal(parsed.slots[0].name, 'Elon');
        assert.equal(parsed.slots[0].level, 150);
        assert.equal(parsed.slots[0].slotIndex, 0);
        assert.equal(parsed.slots[0].citizenshipSide, 'elvine');
    });

    it('clamps out-of-range slotIndex onto desk 0–3 so the row is visible', () => {
        const parsed = mapCharacterListResponse({
            characters: [{ slotIndex: 99, name: 'Elon', level: 150, citizenshipSide: 'traveler' }],
        });
        assert.equal(parsed.slots.length, 1);
        assert.equal(parsed.slots[0].slotIndex, 0);
        assert.equal(parsed.slots[0].citizenshipSide, 'traveler');
    });

    it('decodes a CharacterListResponse ServerMessage frame', () => {
        const bytes = encodeListFrame({
            characters: [{ slotIndex: 0, name: 'Elon', level: 150, citizenshipSide: 'elvine' }],
            referralCode: 'Elon-AAAA',
        });
        const parsed = tryParseCharacterListMessage(bytes);
        assert.ok(parsed);
        assert.equal(parsed?.slots[0]?.name, 'Elon');
        assert.equal(parsed?.referral?.code, 'Elon-AAAA');
    });

    it('ignores WorldsList bootstrap instead of wiping a desk payload', () => {
        const bootstrap = ServerMessage.encode({
            payload: {
                $case: 'worldsList',
                value: { worlds: [] },
            },
        }).finish();
        assert.equal(tryParseCharacterListMessage(bootstrap), undefined);

        const list = tryParseCharacterListMessage(
            encodeListFrame({
                characters: [{ slotIndex: 0, name: 'Elon', level: 150 }],
            }),
        );
        assert.equal(list?.slots.length, 1);
        assert.equal(list?.slots[0].name, 'Elon');
    });

    it('ignores undecodable bytes without throwing', () => {
        assert.equal(tryParseCharacterListMessage(new Uint8Array([0xff, 0x00, 0x01])), undefined);
    });

    it('reads ArrayBuffer websocket payloads', async () => {
        const bytes = encodeListFrame({
            characters: [{ slotIndex: 0, name: 'Elon', level: 150 }],
        });
        const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        const asAb = await wsPayloadToBytes(copy);
        assert.ok(asAb);
        const parsed = tryParseCharacterListMessage(asAb!);
        assert.equal(parsed?.slots[0]?.name, 'Elon');
    });
});

describe('coalesceCharacterListResult — retain occupied list', () => {
    const elon = mapCharacterListResponse({
        characters: [{ slotIndex: 0, name: 'Elon', level: 150, citizenshipSide: 'traveler' }],
    });

    it('keeps a buffered occupied list across close/error/timeout', () => {
        const closed = coalesceCharacterListResult(
            undefined,
            new Error('Connection closed before character list arrived.'),
            elon,
        );
        assert.ok('ok' in closed);
        if ('ok' in closed) {
            assert.equal(closed.ok.slots[0]?.name, 'Elon');
        }

        const timedOut = coalesceCharacterListResult(
            undefined,
            new Error('Timed out waiting for character list.'),
            elon,
        );
        assert.ok('ok' in timedOut);

        const emptyFollowUp = coalesceCharacterListResult({ slots: [] }, undefined, elon);
        assert.ok('ok' in emptyFollowUp);
        if ('ok' in emptyFollowUp) {
            assert.equal(emptyFollowUp.ok.slots.length, 1);
        }
    });

    it('rejects when nothing was buffered', () => {
        const missed = coalesceCharacterListResult(
            undefined,
            new Error('Connection closed before character list arrived.'),
            undefined,
        );
        assert.ok('error' in missed);
    });
});

class FakeListSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = FakeListSocket.CONNECTING;
    binaryType = 'arraybuffer';
    sent: Uint8Array[] = [];
    private listeners = new Map<string, Array<(ev: unknown) => void>>();

    addEventListener(type: string, fn: (ev: unknown) => void) {
        const list = this.listeners.get(type) ?? [];
        list.push(fn);
        this.listeners.set(type, list);
    }

    send(data: Uint8Array) {
        this.sent.push(data);
    }

    close() {
        this.readyState = FakeListSocket.CLOSED;
        this.emit('close', { reason: '' });
    }

    emit(type: string, ev: unknown) {
        for (const fn of this.listeners.get(type) ?? []) {
            fn(ev);
        }
    }

    openAndDeliver(bytes: Uint8Array, thenClose: boolean) {
        this.readyState = FakeListSocket.OPEN;
        this.emit('open', {});
        this.emit('message', { data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
        if (thenClose) {
            this.close();
        }
    }
}

describe('fetchCharacterList WS hold / remount cache', () => {
    it('resolves Elon when the socket closes immediately after the list frame', async () => {
        clearCachedOccupiedCharacterList();
        const created: FakeListSocket[] = [];
        const bytes = encodeListFrame({
            characters: [{ slotIndex: 0, name: 'Elon', level: 150, citizenshipSide: 'traveler' }],
        });

        const prevWindow = (globalThis as { window?: unknown }).window;
        const prevWS = (globalThis as { WebSocket?: unknown }).WebSocket;
        (globalThis as { window?: unknown }).window = {
            setTimeout: globalThis.setTimeout.bind(globalThis),
            clearTimeout: globalThis.clearTimeout.bind(globalThis),
            location: {
                protocol: 'https:',
                hostname: 'play.chainlords.net',
                host: 'play.chainlords.net',
                port: '',
            },
        };
        (globalThis as { WebSocket?: unknown }).WebSocket = class extends FakeListSocket {
            constructor() {
                super();
                created.push(this);
                queueMicrotask(() => this.openAndDeliver(bytes, true));
            }
        };

        try {
            const parsed = await fetchCharacterList('play.chainlords.net', 443, '4R7FsyC8elon', 'tok');
            assert.equal(parsed.slots[0]?.name, 'Elon');
            assert.equal(parsed.slots[0]?.level, 150);
            assert.equal(peekCachedOccupiedCharacterList('4R7FsyC8elon')?.slots[0]?.name, 'Elon');
        } finally {
            (globalThis as { window?: unknown }).window = prevWindow;
            (globalThis as { WebSocket?: unknown }).WebSocket = prevWS;
        }
    });

    it('does not open a second WS when an occupied list is already cached', async () => {
        clearCachedOccupiedCharacterList();
        const bytes = encodeListFrame({
            characters: [{ slotIndex: 0, name: 'Elon', level: 150 }],
        });
        let sockets = 0;
        const prevWindow = (globalThis as { window?: unknown }).window;
        const prevWS = (globalThis as { WebSocket?: unknown }).WebSocket;
        (globalThis as { window?: unknown }).window = {
            setTimeout: globalThis.setTimeout.bind(globalThis),
            clearTimeout: globalThis.clearTimeout.bind(globalThis),
            location: {
                protocol: 'https:',
                hostname: 'play.chainlords.net',
                host: 'play.chainlords.net',
                port: '',
            },
        };
        (globalThis as { WebSocket?: unknown }).WebSocket = class extends FakeListSocket {
            constructor() {
                super();
                sockets += 1;
                queueMicrotask(() => this.openAndDeliver(bytes, true));
            }
        };

        try {
            const first = await fetchCharacterListShared('h', 443, '4R7FsyC8elon', 'tok-1');
            assert.equal(first.slots[0]?.name, 'Elon');
            const second = await fetchCharacterListShared('h', 443, '4R7FsyC8elon', 'tok-2');
            assert.equal(second.slots[0]?.name, 'Elon');
            assert.equal(sockets, 1);
        } finally {
            (globalThis as { window?: unknown }).window = prevWindow;
            (globalThis as { WebSocket?: unknown }).WebSocket = prevWS;
            clearCachedOccupiedCharacterList();
        }
    });
});

