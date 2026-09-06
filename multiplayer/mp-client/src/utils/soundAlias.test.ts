import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveSoundAsset, SOUND_KEY_ALIASES } from './soundAlias';

describe('resolveSoundAsset', () => {
    it('maps consumptionSound magic onto shipped C5.mp3', () => {
        assert.equal(SOUND_KEY_ALIASES.magic, 'C5');
        assert.deepEqual(resolveSoundAsset('magic'), { cacheKey: 'C5', fileName: 'C5.mp3' });
        assert.deepEqual(resolveSoundAsset('magic.mp3'), { cacheKey: 'C5', fileName: 'C5.mp3' });
    });

    it('leaves real catalog keys unchanged', () => {
        assert.deepEqual(resolveSoundAsset('C5'), { cacheKey: 'C5', fileName: 'C5.mp3' });
        assert.deepEqual(resolveSoundAsset('E12.mp3'), { cacheKey: 'E12', fileName: 'E12.mp3' });
    });
});
