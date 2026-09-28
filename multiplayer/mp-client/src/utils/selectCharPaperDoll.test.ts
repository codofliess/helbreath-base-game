import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { selectCharPaperDollLayers } from './selectCharPaperDoll';

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
});
