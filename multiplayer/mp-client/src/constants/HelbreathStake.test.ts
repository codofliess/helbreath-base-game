import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    HELBREATH_STAKE_PER_EXPERTISE_LEVEL,
    HELBREATH_TOKEN_TICKER,
    helbreathStakeBonusLevels,
} from './HelbreathStake';

describe('helbreathStakeBonusLevels', () => {
    it('matches the 20k all-group formula', () => {
        assert.equal(HELBREATH_TOKEN_TICKER, '$HELBREATH');
        assert.equal(HELBREATH_STAKE_PER_EXPERTISE_LEVEL, 20_000);
        assert.equal(helbreathStakeBonusLevels(0), 0);
        assert.equal(helbreathStakeBonusLevels(20_000), 1);
        assert.equal(helbreathStakeBonusLevels(200_000), 10);
        assert.equal(helbreathStakeBonusLevels(240_000), 12);
    });
});
