import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    ACCESSORY_SETTLE_SHEETS,
    ARMOUR_SETTLE_SHEETS,
    WEAPON_SETTLE_SHEETS,
    paperDollLayerSheetIndices,
    paperDollPendingGearJobs,
    settleAppearanceSheetIndices,
} from './itemAppearanceSheets';

describe('itemAppearanceSheets', () => {
    it('settle decodes armour idle+walk only (not combat 0–7)', () => {
        assert.deepEqual([...ARMOUR_SETTLE_SHEETS], [0, 2]);
        const armor = settleAppearanceSheetIndices('mhpmail2');
        assert.deepEqual([...armor].sort((a, b) => a - b), [0, 2]);
        const boots = settleAppearanceSheetIndices('mshoes');
        assert.deepEqual([...boots].sort((a, b) => a - b), [0, 2]);
        const unknown = settleAppearanceSheetIndices('not-a-real-pack');
        assert.deepEqual([...unknown].sort((a, b) => a - b), [0, 2]);
    });

    it('settle keeps weapon idle facings 0–7 and angel idle 40–47', () => {
        assert.deepEqual([...WEAPON_SETTLE_SHEETS], [0, 1, 2, 3, 4, 5, 6, 7]);
        const weapon = settleAppearanceSheetIndices('msw');
        assert.deepEqual([...weapon].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
        const staff = settleAppearanceSheetIndices('mstaff2');
        assert.deepEqual([...staff].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
        assert.deepEqual([...ACCESSORY_SETTLE_SHEETS], [40, 41, 42, 43, 44, 45, 46, 47]);
    });

    it('F5 paper-doll jobs request one idle-south sheet per gear layer', () => {
        assert.deepEqual(paperDollLayerSheetIndices('human', 0), [4]);
        assert.deepEqual(paperDollLayerSheetIndices('armour', 0), [0]);
        assert.deepEqual(paperDollLayerSheetIndices('weapon', 0), [4]);
        assert.deepEqual(paperDollLayerSheetIndices('shield', 8), [8]);
        assert.deepEqual(paperDollLayerSheetIndices('accessory', 0), [44]);
        const jobs = paperDollPendingGearJobs(
            [
                { kind: 'human', spriteName: 'wm', sheetPack: 0 },
                { kind: 'armour', spriteName: 'mhr', sheetPack: 12 },
                { kind: 'armour', spriteName: 'mhpmail2', sheetPack: 0 },
                { kind: 'weapon', spriteName: 'msw', sheetPack: 0 },
            ],
            new Set(['wm', 'mhr', 'mpt']),
        );
        assert.deepEqual(
            jobs.map((j) => j.name),
            ['mhpmail2', 'msw'],
        );
        assert.deepEqual(jobs[0].sheets, [0]);
        assert.deepEqual(jobs[1].sheets, [4]);
        assert.ok(jobs.every((j) => j.sheets.length === 1));
    });
});
