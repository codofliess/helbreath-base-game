import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    CIRCLE_ONE_OLYMPIA_IDS,
    GOLD_ITEM_ID,
    countBagGold,
    isGoldBagItemId,
    mergeOlympiaBookFromServerCatalog,
} from './magicBookClient';

/** Mirrors OlympiaServerSpellMap for Energy Bolt / Heal / Create Food. */
const SERVER_TO_OLYMPIA: Record<number, number> = {
    0: 10,
    29: 1,
    31: 2,
};

function mapServer(sid: number): number | undefined {
    return SERVER_TO_OLYMPIA[sid];
}

describe('countBagGold', () => {
    it('counts item 90 Quantity and accepts string/bigint ids', () => {
        assert.equal(
            countBagGold([
                { itemId: GOLD_ITEM_ID, quantity: 1700 },
                { itemId: 91, quantity: 5 },
            ]),
            1700,
        );
        assert.equal(countBagGold([{ itemId: '90', quantity: '1700' }]), 1700);
        assert.equal(countBagGold([{ itemId: 90n, quantity: 100 }]), 100);
        assert.equal(isGoldBagItemId('90'), true);
        assert.equal(isGoldBagItemId(91), false);
    });

    it('does not treat persist Gold scalar (absent bag row) as gold', () => {
        assert.equal(countBagGold([]), 0);
        assert.equal(countBagGold([{ itemId: 1, quantity: 1700 }]), 0);
    });
});

describe('mergeOlympiaBookFromServerCatalog', () => {
    it('keeps Circle One Olympia ids when InitialState is Energy Bolt only', () => {
        const next = mergeOlympiaBookFromServerCatalog(
            [10, ...CIRCLE_ONE_OLYMPIA_IDS],
            [0],
            mapServer,
            10,
        );
        assert.deepEqual(next.slice().sort((a, b) => a - b), [0, 1, 2, 10]);
    });

    it('adds Heal/Create Food from Spells.json ids without dropping Missile', () => {
        const next = mergeOlympiaBookFromServerCatalog([10, 0], [0, 29, 31], mapServer, 10);
        assert.deepEqual(next.slice().sort((a, b) => a - b), [0, 1, 2, 10]);
    });

    it('does not invent Circle One from SkillLevels / empty persist book', () => {
        const next = mergeOlympiaBookFromServerCatalog([10], [0], mapServer, 10);
        assert.deepEqual(next, [10]);
    });
});
