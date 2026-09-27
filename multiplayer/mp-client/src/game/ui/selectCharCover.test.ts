import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { classifyEquippedCover, formatMonsterGroupLine, formatPendingNftLine } from './selectCharCover';

describe('character cover', () => {
    it('splits equipped legendary ids from other equipped pieces', () => {
        const cover = classifyEquippedCover({
            citizenshipSide: 'traveler',
            equipped: [
                { slot: 'accessory', itemId: 860 },
                { slot: 'accessory', itemId: 1200 },
            ],
        });
        assert.equal(cover.legendary.length, 1);
        assert.match(cover.legendary[0], /860|Xelima|Necklace/i);
        assert.deepEqual(cover.rare, ['Mana Vamping Gem']);
    });

    it('formats a real group level, including zero', () => {
        assert.equal(
            formatMonsterGroupLine({ label: 'Early', level: 2, leadName: 'Slime' }),
            'Early · L2 · Slime',
        );
        assert.equal(formatMonsterGroupLine({ label: 'Low', level: 0, leadName: '' }), 'Low · L0');
    });

    it('labels a pending seal drop without a mint address', () => {
        const line = formatPendingNftLine('Storm Bringer', 'super_rare', 1);
        assert.equal(line, 'Storm Bringer · Legendary');
        assert.equal(line.includes('0x'), false);
    });

    it('keeps the explorer hub free of a ticker or mint', () => {
        const src = fs.readFileSync(
            path.join(import.meta.dirname, '../../ui/components/SelectCharReactDesk.tsx'),
            'utf8',
        );
        assert.match(src, /Explorer/);
        assert.match(src, /Legendary items/);
        assert.match(src, /Rare items/);
        assert.match(src, /Pending NFT drops/);
        assert.match(src, /Monster group tiers/);
        assert.match(src, /ReferralCharListPanel/);
        assert.doesNotMatch(src, /\$helbreath|\$HELL|\$hell/i);
        assert.doesNotMatch(src, /0xb603D6b2e5472beb338CE079a63FEb8663171529/i);
        assert.doesNotMatch(src, /\bmint\b/i);
    });
});
