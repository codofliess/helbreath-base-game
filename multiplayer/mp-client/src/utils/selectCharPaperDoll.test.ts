import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
    explorerDollViewportHeight,
    renderSelectCharPaperDoll,
    selectCharDollOutputSize,
    selectCharPaperDollLayers,
} from './selectCharPaperDoll';

const bare = {
    gender: 0,
    skinColor: 0,
    hairStyleIndex: 0,
    underwearColorIndex: 0,
};

describe('selectCharPaperDollLayers', () => {
    it('stacks Co2 as a male hauberk, plate legs, and long sword', () => {
        const layers = selectCharPaperDollLayers({
            ...bare,
            equipped: [
                { slot: 'hauberk', itemId: 454 },
                { slot: 'leggings', itemId: 462 },
                { slot: 'weapon', itemId: 17 },
            ],
        });
        const names = layers.map((layer) => layer.spriteName);
        assert.ok(names.includes('wm'));
        assert.ok(names.includes('mhauberk'));
        assert.ok(names.includes('mleggings'));
        assert.ok(names.includes('msw'));
        assert.equal(layers.find((layer) => layer.kind === 'weapon')?.sheetPack, 2);
        assert.equal(names.includes('wrobe1'), false);
        assert.equal(names.includes('mshirt'), false);
    });

    it('stacks BebaMaster as a woman in a robe, not Co2 gear', () => {
        const layers = selectCharPaperDollLayers({
            ...bare,
            gender: 1,
            hairStyleIndex: 1,
            equipped: [
                { slot: 'armor', itemId: 591 },
                { slot: 'hauberk', itemId: 682 },
            ],
        });
        const names = layers.map((layer) => layer.spriteName);
        assert.ok(names.includes('ww'));
        assert.ok(names.includes('whr'));
        assert.ok(names.includes('wrobe1'));
        assert.ok(names.includes('whauberk'));
        assert.equal(names.includes('mhauberk'), false);
        assert.equal(names.includes('msw'), false);
        assert.equal(layers.find((layer) => layer.spriteName === 'whr')?.sheetPack, 12);
    });

    it('wears the desk default shirt and trousers when the slot has no gear', () => {
        const names = selectCharPaperDollLayers(bare).map((layer) => layer.spriteName);
        assert.ok(names.includes('wm'));
        assert.ok(names.includes('mshirt'));
        assert.ok(names.includes('mhtrouser'));
    });

    it('stacks Elon Lv150 hero mail, cape, and giant battle hammer', () => {
        const names = selectCharPaperDollLayers({
            ...bare,
            citizenshipSide: 'aresden',
            equipped: [
                { slot: 'weapon', itemId: 762 },
                { slot: 'helmet', itemId: 403 },
                { slot: 'armor', itemId: 411 },
                { slot: 'hauberk', itemId: 419 },
                { slot: 'leggings', itemId: 423 },
                { slot: 'cape', itemId: 402 },
            ],
        }).map((layer) => layer.spriteName);
        for (const sprite of ['wm', 'mhhelm2', 'mhpmail2', 'mhhauberk2', 'mhleggings2', 'mmantle03', 'mbhammer']) {
            assert.ok(names.includes(sprite), sprite);
        }
        assert.equal(names.includes('mshirt'), false);
    });
});

describe('explorer doll viewport', () => {
    it('uses the scrollport, not the detail-card row', () => {
        const rowHeight = 1322;
        const scrollport = explorerDollViewportHeight(542, 4, 16);
        assert.equal(scrollport, 522);
        assert.ok(scrollport < rowHeight);
        assert.equal(explorerDollViewportHeight(0, 4, 16), 0);
        assert.equal(explorerDollViewportHeight(Number.NaN, 0, 0), 0);
    });

    it('scales an oversized composite down instead of dropping it', () => {
        assert.deepEqual(selectCharDollOutputSize(33, 71), { width: 33, height: 71 });
        const scaled = selectCharDollOutputSize(2000, 100);
        assert.ok(scaled);
        assert.ok(scaled.width <= 1024 && scaled.height <= 1024);
        assert.equal(scaled.width, 1024);
        assert.equal(selectCharDollOutputSize(0, 40), undefined);
    });

    it('reports why a paper-doll cannot be composed without a document', async () => {
        const image = await renderSelectCharPaperDoll({
            slotIndex: 0,
            name: 'Elon',
            level: 150,
            exp: 0,
            rebirth: 0,
            hoursPlayed: 1,
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
        });
        assert.equal(image.url, undefined);
        assert.match(image.reason ?? '', /document|canvas/i);
    });
});

function cssRule(css: string, selector: string, until: string): string {
    const start = css.indexOf(selector);
    assert.ok(start >= 0, `missing ${selector}`);
    const end = css.indexOf(until, start + selector.length);
    assert.ok(end > start, `missing ${until} after ${selector}`);
    return css.slice(start, end);
}

describe('explorer hub css', () => {
    it('does not stretch the portrait to the detail-card row', () => {
        const css = readFileSync(new URL('../ui/rpg-ui.css', import.meta.url), 'utf8');
        const doll = cssRule(css, '.explorer-hub-doll {', '.explorer-hub-doll-sprite');
        assert.match(doll, /align-self:\s*start/);
        assert.doesNotMatch(doll, /position:\s*sticky/);
        assert.doesNotMatch(doll, /height:\s*100%/);
        const hub = cssRule(css, '.explorer-hub {', '.explorer-hub-header {');
        assert.match(hub, /flex:\s*1 1 0px/);
        assert.match(hub, /overflow:\s*clip/);
        assert.match(hub, /minmax\(0,\s*1fr\)/);
        assert.doesNotMatch(hub, /overflow:\s*hidden/);
        const gate = cssRule(css, '.explorer-hub-gate.login-desk-gate {', '.explorer-hub {');
        assert.match(gate, /overflow:\s*clip/);
        const header = cssRule(css, '.explorer-hub-header {', '.explorer-hub-scroll {');
        assert.match(header, /position:\s*sticky/);
        assert.match(header, /flex:\s*none/);
        const scroll = cssRule(css, '.explorer-hub-scroll {', '.explorer-hub-title {');
        assert.match(scroll, /overflow:\s*auto/);
        assert.match(scroll, /min-height:\s*0/);
        assert.match(scroll, /overscroll-behavior:\s*contain/);
    });
});
