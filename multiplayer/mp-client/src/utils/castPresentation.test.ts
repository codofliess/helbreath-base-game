import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldAdvanceCastToReady } from './castPresentation';

describe('shouldAdvanceCastToReady', () => {
    it('waits for castSpeed when the CAST sheet never plays (Missile prepare)', () => {
        assert.equal(shouldAdvanceCastToReady(false, 0, 1200), false);
        assert.equal(shouldAdvanceCastToReady(false, 1199, 1200), false);
        assert.equal(shouldAdvanceCastToReady(false, 1200, 1200), true);
    });

    it('does not skip the ritual while the CAST animation is playing', () => {
        assert.equal(shouldAdvanceCastToReady(true, 5000, 1200), false);
    });
});
