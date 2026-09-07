import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    computeGuildProgression,
    guildActivityLevelFromPoints,
    guildActivityPoints,
    guildStakeBonusLevels,
} from './GuildProgression';

describe('guildStakeBonusLevels', () => {
    it('steps +1 all guild levels per 20k $HELBREATH', () => {
        assert.equal(guildStakeBonusLevels(0), 0);
        assert.equal(guildStakeBonusLevels(19_999), 0);
        assert.equal(guildStakeBonusLevels(20_000), 1);
        assert.equal(guildStakeBonusLevels(200_000), 10);
        assert.equal(guildStakeBonusLevels(240_000), 12);
    });
});

describe('computeGuildProgression', () => {
    it('adds collective stake on top of contribution / EK / gold / majestic activity', () => {
        assert.equal(guildActivityPoints({ contribution: 800, enemyKills: 20, gold: 200_000, majestics: 10 }), 2670);
        assert.equal(guildActivityLevelFromPoints(2670), 5);
        const snap = computeGuildProgression({
            contribution: 800,
            enemyKills: 20,
            gold: 200_000,
            majestics: 10,
            stakedHelbreath: 240_000,
        });
        assert.equal(snap.activityLevel, 5);
        assert.equal(snap.stakeBonusLevels, 12);
        assert.equal(snap.effectiveLevel, 17);
        assert.equal(snap.huntmaster, 6);
        assert.equal(snap.raidmaster, 5);
        assert.equal(snap.captains, 6);
        assert.ok(snap.teleports.includes('icebound'));
        assert.ok(snap.teleports.includes('toh2'));
        assert.equal(snap.teleports.includes('toh3'), false);
    });
});
