import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    isPhaserSceneActive,
    liveOneShotEffectCount,
    MAX_LIVE_ONESHOT_EFFECTS,
    releaseOneShotEffectSlot,
    resetOneShotEffectSlotsForTests,
    tryAcquireOneShotEffectSlot,
} from './effectLiveCap';

describe('effectLiveCap', () => {
    it('refuses one-shot VFX past the farm cap and releases slots', () => {
        resetOneShotEffectSlotsForTests();
        let acquired = 0;
        for (let i = 0; i < MAX_LIVE_ONESHOT_EFFECTS + 8; i++) {
            if (tryAcquireOneShotEffectSlot()) {
                acquired += 1;
            }
        }
        assert.equal(acquired, MAX_LIVE_ONESHOT_EFFECTS);
        assert.equal(liveOneShotEffectCount(), MAX_LIVE_ONESHOT_EFFECTS);
        assert.equal(tryAcquireOneShotEffectSlot(), false);
        releaseOneShotEffectSlot();
        assert.equal(liveOneShotEffectCount(), MAX_LIVE_ONESHOT_EFFECTS - 1);
        assert.equal(tryAcquireOneShotEffectSlot(), true);
        resetOneShotEffectSlotsForTests();
        assert.equal(liveOneShotEffectCount(), 0);
    });

    it('treats a shut-down Phaser scene as inactive (stale Fire Strike delayedCall)', () => {
        assert.equal(isPhaserSceneActive(undefined), false);
        assert.equal(isPhaserSceneActive({}), false);
        assert.equal(isPhaserSceneActive({ sys: { isActive: () => false } }), false);
        assert.equal(isPhaserSceneActive({ sys: { isActive: () => true } }), true);
    });
});
