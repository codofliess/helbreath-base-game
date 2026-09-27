import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    PLAYER_TOKEN_DISPLAY,
    PLAYER_TOKEN_TICKER,
    playerTokenCopy,
} from './PlayerTokenTicker';

describe('PlayerTokenTicker', () => {
    it('exposes the player-facing ticker as $helbreath', () => {
        assert.equal(PLAYER_TOKEN_TICKER, 'helbreath');
        assert.equal(PLAYER_TOKEN_DISPLAY, '$helbreath');
    });

    it('rewrites leftover token names in player copy to "a reward" without touching mint ids', () => {
        assert.equal(playerTokenCopy('Pending $HELL is utility mining.'), 'Pending a reward is utility mining.');
        assert.equal(playerTokenCopy('Need 10 pending $hell (you have 2).'), 'Need 10 pending a reward (you have 2).');
        assert.equal(
            playerTokenCopy('Need 10 pending $helbreath (you have 2).'),
            'Need 10 pending a reward (you have 2).',
        );
        assert.equal(playerTokenCopy('Earn a helbreath token at 150.'), 'Earn a reward at 150.');
        assert.equal(
            playerTokenCopy('HELL_MINT stays HELL; only $HELL is rewritten.'),
            'HELL_MINT stays HELL; only a reward is rewritten.',
        );
        assert.equal(playerTokenCopy('assetId HELL'), 'assetId HELL');
    });
});
