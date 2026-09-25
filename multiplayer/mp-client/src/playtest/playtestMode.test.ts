import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canonicalPlaytestSeatKey, isPlaytestClient, playtestGuildLayout, PLAYTEST_SEATS } from './playtestMode';

describe('playtestMode', () => {
    it('is inert without VITE_PLAYTEST (default Vite test env)', () => {
        assert.equal(isPlaytestClient(), false);
    });

    it('seeds A and C in the same guild and B in another', () => {
        const layout = playtestGuildLayout();
        assert.equal(layout.a, 'QA Guild One');
        assert.equal(layout.c, 'QA Guild One');
        assert.equal(layout.b, 'QA Guild Two');
        assert.equal(layout.a, layout.c);
        assert.notEqual(layout.a, layout.b);
        assert.equal(PLAYTEST_SEATS.length, 3);
        assert.equal(new Set(PLAYTEST_SEATS.map((s) => s.accountId)).size, 3);
        assert.equal(new Set(PLAYTEST_SEATS.map((s) => s.characterName)).size, 3);
    });

    it('maps elon/maggy/pist aliases to A/B/C', () => {
        assert.equal(canonicalPlaytestSeatKey('elon'), 'a');
        assert.equal(canonicalPlaytestSeatKey('maggy'), 'b');
        assert.equal(canonicalPlaytestSeatKey('pist'), 'c');
        assert.equal(canonicalPlaytestSeatKey('A'), 'a');
    });
});
