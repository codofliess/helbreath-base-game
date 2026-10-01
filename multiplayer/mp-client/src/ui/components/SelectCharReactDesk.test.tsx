import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'node:test';
import { SelectCharReactDesk, scrollExplorerHubOnPageKey } from './SelectCharReactDesk';
import { connectDialogStore } from '../store/ConnectDialog.store';
import type { CharacterSlotSummary } from '../../utils/characterListApi';

const elon: CharacterSlotSummary = {
    slotIndex: 0,
    name: 'Elon',
    level: 150,
    exp: 0,
    rebirth: 0,
    hoursPlayed: 12,
    str: 200,
    vit: 200,
    dex: 200,
    intel: 50,
    mag: 40,
    chr: 20,
    gender: 0,
    skinColor: 0,
    hairStyleIndex: 0,
    underwearColorIndex: 0,
    citizenshipSide: 'aresden',
    equipped: [
        { slot: 'weapon', itemId: 762 },
        { slot: 'helmet', itemId: 403 },
        { slot: 'armor', itemId: 411 },
        { slot: 'hauberk', itemId: 419 },
        { slot: 'leggings', itemId: 423 },
        { slot: 'cape', itemId: 402 },
    ],
};

describe('SelectCharReactDesk markup', () => {
    it('keeps the Explorer header outside the scroll container and paints the middle column', () => {
        connectDialogStore.setState((state) => ({
            ...state,
            isOpen: true,
            phase: 'play-world',
            characterListLoading: false,
            selectedSlotIndex: 0,
            characterSlots: [elon],
            walletSession: {
                wallet: 'DevTestWallet111111111111111111111111',
                token: 'dev-bypass-token',
                expiresAt: Date.now() + 60_000,
            },
        }));
        const html = renderToStaticMarkup(createElement(SelectCharReactDesk));
        const header = html.indexOf('explorer-hub-header');
        const scroll = html.indexOf('explorer-hub-scroll');
        const doll = html.indexOf('explorer-hub-doll');
        const cover = html.indexOf('explorer-hub-cover');
        assert.ok(header >= 0 && scroll > header, 'Explorer header must be outside the scroll container');
        assert.ok(doll > scroll && cover > doll, 'portrait column sits between the list and the detail card');
        assert.match(html, />Explorer</);
        assert.match(html, /explorer-hub-doll-fallback/);
        assert.match(html, /Elon/);
        assert.equal(html.includes('data-doll-scale="0"'), false);
        connectDialogStore.setState((state) => ({
            ...state,
            isOpen: false,
            phase: 'hub',
            characterSlots: [],
            walletSession: null,
        }));
    });
});

describe('scrollExplorerHubOnPageKey', () => {
    it('pages the hub body and does not steal Home from a text field', () => {
        const scroll = { scrollTop: 100, scrollHeight: 800, clientHeight: 200 };
        assert.equal(scrollExplorerHubOnPageKey('PageDown', scroll, null), true);
        assert.equal(scroll.scrollTop, 270);
        assert.equal(scrollExplorerHubOnPageKey('PageUp', scroll, null), true);
        assert.equal(scroll.scrollTop, 100);
        assert.equal(scrollExplorerHubOnPageKey('End', scroll, null), true);
        assert.equal(scroll.scrollTop, 600);
        assert.equal(scrollExplorerHubOnPageKey('Home', scroll, null), true);
        assert.equal(scroll.scrollTop, 0);
        scroll.scrollTop = 40;
        assert.equal(scrollExplorerHubOnPageKey('Home', scroll, { tagName: 'INPUT' } as EventTarget), false);
        assert.equal(scroll.scrollTop, 40);
        assert.equal(scrollExplorerHubOnPageKey('PageDown', scroll, { tagName: 'TEXTAREA' } as EventTarget), false);
        assert.equal(scroll.scrollTop, 40);
        assert.equal(scrollExplorerHubOnPageKey('ArrowDown', scroll, null), false);
    });
});
