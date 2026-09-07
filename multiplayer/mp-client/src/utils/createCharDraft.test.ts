import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    adjustCreateCharStat,
    CREATE_STAT_BASE,
    CREATE_STAT_BUDGET,
    createCharVitals,
    initialCreateCharStats,
    remainingCreateStatPoints,
    sanitizeCreateCharName,
    validateCreateCharName,
} from './createCharDraft';

describe('createCharDraft', () => {
    it('starts with 10 points left and blocks Create until they are spent', () => {
        const stats = initialCreateCharStats();
        assert.equal(remainingCreateStatPoints(stats), CREATE_STAT_BUDGET - CREATE_STAT_BASE * 6);
        assert.equal(remainingCreateStatPoints(stats), 10);
    });

    it('allocates +/− within 10–14 and the 70 budget', () => {
        let stats = initialCreateCharStats();
        for (let i = 0; i < 4; i += 1) {
            stats = adjustCreateCharStat(stats, 'str', 1);
        }
        assert.equal(stats.str, 14);
        assert.equal(remainingCreateStatPoints(stats), 6);
        stats = adjustCreateCharStat(stats, 'str', 1);
        assert.equal(stats.str, 14);
        stats = adjustCreateCharStat(stats, 'str', -1);
        assert.equal(stats.str, 13);
    });

    it('sanitizes and validates names like the Phaser desk', () => {
        assert.equal(sanitizeCreateCharName('Beba!Master'), 'BebaMaster');
        assert.equal(validateCreateCharName('').ok, false);
        assert.equal(validateCreateCharName('A').ok, false);
        assert.equal(validateCreateCharName('1bob').ok, false);
        assert.equal(validateCreateCharName('Co2').ok, true);
    });

    it('derives HP/MP/SP from the classic create formulas', () => {
        const vitals = createCharVitals(initialCreateCharStats());
        assert.equal(vitals.hp, 37);
        assert.equal(vitals.mp, 27);
        assert.equal(vitals.sp, 22);
    });
});
