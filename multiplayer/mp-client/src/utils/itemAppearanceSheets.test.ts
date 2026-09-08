import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Gender, SkinColor } from '../Types';
import { ItemTypes } from '../constants/Items';
import {
    ACCESSORY_SETTLE_SHEETS,
    ARMOUR_SETTLE_SHEETS,
    WEAPON_SETTLE_SHEETS,
    paperDollLayerSheetIndices,
    paperDollLookKey,
    paperDollPendingGearJobs,
    settleAppearanceSheetIndices,
} from './itemAppearanceSheets';

describe('itemAppearanceSheets', () => {
    it('settle decodes armour stand+walk peace and combat (not run/bow 4–7)', () => {
        assert.deepEqual([...ARMOUR_SETTLE_SHEETS], [0, 1, 2, 3]);
        const armor = settleAppearanceSheetIndices('mhpmail2');
        assert.deepEqual([...armor].sort((a, b) => a - b), [0, 1, 2, 3]);
        const hauberk = settleAppearanceSheetIndices('mhauberk');
        assert.deepEqual([...hauberk].sort((a, b) => a - b), [0, 1, 2, 3]);
        const elvineHauberk = settleAppearanceSheetIndices('mhhauberk1');
        assert.deepEqual([...elvineHauberk].sort((a, b) => a - b), [0, 1, 2, 3]);
        const boots = settleAppearanceSheetIndices('mshoes');
        assert.deepEqual([...boots].sort((a, b) => a - b), [0, 1, 2, 3]);
        const unknown = settleAppearanceSheetIndices('not-a-real-pack');
        assert.deepEqual([...unknown].sort((a, b) => a - b), [0, 1, 2, 3]);
    });

    it('settle shifts weapon/shield sheets by packBase (shared msh / weapon packs)', () => {
        const targe = settleAppearanceSheetIndices('msh', { packBase: 14 });
        assert.deepEqual([...targe].sort((a, b) => a - b), [14, 15, 16, 17]);
        const weapon = settleAppearanceSheetIndices('msw', { packBase: 8 });
        assert.deepEqual([...weapon].sort((a, b) => a - b), [8, 9, 10, 11, 12, 13, 14, 15]);
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

    it('paperDollLookKey is stable across equippedItems object identity', () => {
        const item = { itemId: 1, itemUid: 'u1', itemColor: 0 };
        const a = paperDollLookKey(Gender.MALE, SkinColor.Light, 1, 3, {
            [ItemTypes.WEAPON]: item,
        });
        const b = paperDollLookKey(Gender.MALE, SkinColor.Light, 1, 3, {
            [ItemTypes.WEAPON]: { ...item },
        });
        assert.equal(a, b);
        const c = paperDollLookKey(Gender.MALE, SkinColor.Light, 1, 3, {
            [ItemTypes.WEAPON]: { ...item, itemUid: 'u2' },
        });
        assert.notEqual(a, c);
    });

});
