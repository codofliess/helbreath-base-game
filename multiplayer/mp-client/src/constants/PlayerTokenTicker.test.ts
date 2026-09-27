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

    it('rewrites leftover token names to "rewards" without an article or mint ids', () => {
        assert.equal(
            playerTokenCopy('Pending $HELL is utility mining.'),
            'Pending rewards are utility mining.',
        );
        assert.equal(playerTokenCopy('Need 10 pending $hell (you have 2).'), 'Need 10 pending rewards (you have 2).');
        assert.equal(
            playerTokenCopy('Need 10 pending $helbreath (you have 2).'),
            'Need 10 pending rewards (you have 2).',
        );
        assert.equal(playerTokenCopy('Staked $HELL:'), 'Staked rewards:');
        assert.equal(playerTokenCopy('Earn a helbreath token at 150.'), 'Earn rewards at 150.');
        assert.equal(
            playerTokenCopy('HELL_MINT stays HELL; only $HELL is rewritten.'),
            'HELL_MINT stays HELL; only rewards are rewritten.',
        );
        assert.equal(playerTokenCopy('assetId HELL'), 'assetId HELL');
        assert.equal(playerTokenCopy('does not accept $HELL.'), 'does not accept rewards.');
        assert.equal(playerTokenCopy('100k $helbreath = +1 final tier'), '100k rewards = +1 final tier');
        assert.equal(playerTokenCopy('(or 12000 $helbreath)'), '(or 12000 rewards)');
        assert.equal(/\d[\d,]*\s*k?\s+a reward/i.test(playerTokenCopy('100k $helbreath')), false);
        assert.equal(/a reward\s*:/i.test(playerTokenCopy('Staked $HELL:')), false);
    });
});
