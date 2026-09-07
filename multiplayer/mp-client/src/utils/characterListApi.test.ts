import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ServerMessage } from '../proto/generated/network';
import {
    mapCharacterListResponse,
    tryParseCharacterListMessage,
    wsPayloadToBytes,
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
