import assert from 'node:assert/strict';
import test from 'node:test';
import {
    EQUIVALENTS,
    classify,
    extractFunction,
    parseOlympiaServer,
    parseProtoOneofs,
    parseSwitchCases,
    rankedGaps,
    run,
    statusFor,
    stripCppComments,
    switchCasesAfter,
} from './messages-diff.mjs';

test('comment strip drops a commented case and keeps a live one', () => {
    const text = stripCppComments(`
        switch (id) {
        // case MSGID_GONE:
        /* case MSGID_ALSO_GONE: */
        case MSGID_LIVE:
            DoLive();
            break;
        case MSGID_EMPTY:
            // DoEmpty();
            break;
        }
    `);
    assert.equal(text.includes('MSGID_GONE'), false);
    assert.equal(text.includes('MSGID_ALSO_GONE'), false);
    const brace = text.indexOf('{');
    const cases = parseSwitchCases(text, brace);
    assert.deepEqual(cases.map((row) => row.id), ['MSGID_LIVE', 'MSGID_EMPTY']);
    assert.equal(cases[0].stub, false);
    assert.equal(cases[1].stub, true);
});

test('nested switch does not leak inner cases', () => {
    const text = `
        switch (outer) {
        case MSGID_OUTER:
            switch (inner) {
            case MSGID_INNER:
                Inner();
                break;
            }
            break;
        }
    `;
    const cases = parseSwitchCases(text, text.indexOf('{'));
    assert.deepEqual(cases.map((row) => row.id), ['MSGID_OUTER']);
});

test('string braces do not end a function early', () => {
    const source = `
        void CGame::MsgProcess() {
            const char * p = "brace } still inside";
            switch (x) { case MSGID_OK: Ok(); break; }
        }
        void CGame::Next() {}
    `;
    const body = extractFunction(source, 'void CGame::MsgProcess');
    assert.ok(body.includes('MSGID_OK'));
    assert.equal(body.includes('void CGame::Next'), false);
});

test('proto oneof keeps field numbers', () => {
    const proto = parseProtoOneofs(`
        message ClientMessage {
          oneof payload {
            PingRequest ping_request = 1;
            // note
            SellBagItemRequest sell_bag_item_request = 70;
          }
        }
        message ServerMessage {
          oneof payload {
            PingResponse ping_response = 1;
          }
        }
    `);
    assert.equal(proto.client[1].field, 'sell_bag_item_request');
    assert.equal(proto.client[1].number, 70);
    assert.equal(proto.client[1].camel, 'sellBagItemRequest');
    assert.equal(proto.server[0].type, 'PingResponse');
});

test('missing trade stays missing and a wired move is covered', () => {
    const wiring = {
        proto: { client: [], server: [] },
        clientHandles: new Set(),
        byField: new Map([
            ['request_movement', { type: 'RequestMovement', field: 'request_movement', camel: 'requestMovement' }],
        ]),
        handledTypes: new Set(['RequestMovement']),
        sends: new Set(['requestMovement']),
    };
    const move = EQUIVALENTS.find((row) => row.id === 'DEF_OBJECTMOVE');
    const trade = EQUIVALENTS.find((row) => row.id === 'DEF_COMMONTYPE_EXCHANGEITEMTOCHAR');
    assert.equal(statusFor({ id: move.id, stub: false }, move, wiring), 'covered');
    assert.equal(statusFor({ id: trade.id, stub: false }, trade, wiring), 'missing');
    const classified = classify(
        [
            { id: 'DEF_OBJECTMOVE', layer: 'motion', stub: false },
            { id: 'DEF_COMMONTYPE_EXCHANGEITEMTOCHAR', layer: 'common', stub: false },
            { id: 'MSGID_BRAND_NEW', layer: 'client', stub: false },
        ],
        wiring,
    );
    const gaps = rankedGaps(classified.rows);
    assert.equal(gaps[0].id, 'DEF_COMMONTYPE_EXCHANGEITEMTOCHAR');
    assert.ok(gaps.some((gap) => gap.id === 'MSGID_BRAND_NEW' && gap.status === 'unmapped'));
    assert.equal(classified.rows.find((row) => row.id === 'DEF_OBJECTMOVE').status, 'covered');
});

test('marker switch is the inner dispatch, not the outer one', () => {
    const source = `
        switch (cFrom) {
        case DEF_MSGFROM_CLIENT:
            switch (*dwpMsgID) {
            case MSGID_COMMAND_CHATMSG:
                ChatMsgHandler();
                break;
            case MSGID_REQUEST_NOTICEMENT:
                break;
            }
            break;
        case DEF_MSGFROM_LOGSERVER:
            switch (*dwpMsgID) {
            case MSGID_REQUEST_LOGIN:
                g_login->RequestLogin();
                break;
            }
            break;
        }
    `;
    const client = switchCasesAfter(source, 'case DEF_MSGFROM_CLIENT:');
    assert.deepEqual(client.map((row) => [row.id, row.stub]), [
        ['MSGID_COMMAND_CHATMSG', false],
        ['MSGID_REQUEST_NOTICEMENT', true],
    ]);
    const login = switchCasesAfter(source, 'case DEF_MSGFROM_LOGSERVER:');
    assert.equal(login[0].id, 'MSGID_REQUEST_LOGIN');
    assert.equal(login[0].stub, false);
});

test('checked-in Olympia server matches the equivalence table', () => {
    const result = run({ now: '2026-09-30T00:00:00.000Z' });
    assert.equal(result.unmapped.length, 0, `unmapped: ${result.unmapped.join(', ')}`);
    assert.ok(result.rows.length >= 90);
    const byId = new Map(result.rows.map((row) => [row.id, row]));
    assert.equal(byId.get('DEF_COMMONTYPE_EXCHANGEITEMTOCHAR').status, 'missing');
    assert.equal(byId.get('MSGID_REQUEST_CREATENEWGUILD').status, 'missing');
    assert.equal(byId.get('DEF_COMMONTYPE_GIVEITEMTOCHAR').status, 'missing');
    assert.equal(byId.get('MSGID_LEVELUPSETTINGS').status, 'covered');
    assert.equal(byId.get('DEF_COMMONTYPE_MAGIC').status, 'covered');
    assert.equal(byId.get('DEF_COMMONTYPE_REQ_STUDYMAGIC').status, 'partial');
    assert.equal(byId.get('MSGID_REQUEST_NOTICEMENT').status, 'olympia-stub');
    assert.equal(byId.get('DEF_COMMONTYPE_REQ_TRAINSKILL').status, 'olympia-stub');
    assert.ok(result.oursOnly.some((row) => row.field === 'auction_board_browse_request'));
    assert.equal(result.oursOnly.some((row) => row.field === 'warehouse_deposit_request'), false);
    assert.ok(result.clientOnlyCommon.includes('DEF_COMMONTYPE_REQUEST_HUNTMODE'));
    assert.deepEqual(result.handledNotSent, [
        'arena_pact_prize_pledge_request',
        'arena_pact_prize_confirm_request',
        'arena_pact_sign_loss_request',
    ]);
    assert.deepEqual(result.serverNotRead, ['stream_broadcast_state']);
    assert.equal(result.gaps[0].impact >= result.gaps[result.gaps.length - 1].impact, true);
    assert.match(result.markdown, /## Unhandled, ranked by player impact/);
    assert.match(result.markdown, /DEF_COMMONTYPE_EXCHANGEITEMTOCHAR/);
    assert.match(result.summary, /Top gaps:/);
    assert.ok(result.outgoing.notify.length > 100);
    assert.ok(result.outgoing.response.includes('MSGID_RESPONSE_INITDATA'));
});
