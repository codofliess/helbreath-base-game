import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { sheetsForBodyLayerMotion } from './playerBodyMotionSheets';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

describe('player body motion sheets', () => {
    it('expands a human run facing into all 8 directional sheets', () => {
        // HUMAN_SPRITESHEET_BASE Run = 32; south = 4 → sheet 36.
        assert.deepEqual(sheetsForBodyLayerMotion('human', 36, 4), [32, 33, 34, 35, 36, 37, 38, 39]);
        assert.deepEqual(sheetsForBodyLayerMotion('human', 16, 0), [16, 17, 18, 19, 20, 21, 22, 23]);
    });

    it('keeps hair and underwear on the single directional sheet', () => {
        assert.deepEqual(sheetsForBodyLayerMotion('hair', 16, 4), [16]);
        assert.deepEqual(sheetsForBodyLayerMotion('underwear', 40, 2), [40]);
    });

    it('does not invent a facing block when direction is unset', () => {
        assert.deepEqual(sheetsForBodyLayerMotion('human', 32, -1), [32]);
    });

    it('appearance manager fetches body layers when the motion sheet is missing', () => {
        const src = fs.readFileSync(path.join(root, 'PlayerAppearanceManager.ts'), 'utf8');
        assert.match(src, /scheduleBodyLayerMotionSheetIfNeeded/);
        assert.match(src, /sheetsForBodyLayerMotion/);
        assert.match(src, /slot === 'human' \|\| slot === 'hair' \|\| slot === 'underwear'/);
        const schedule = src.slice(
            src.indexOf('private scheduleBodyLayerMotionSheetIfNeeded'),
            src.indexOf('private applyEquipItem'),
        );
        assert.match(schedule, /shouldRefuseMagiasAppearanceFetch/);
        assert.match(schedule, /loadSpriteAssetOnDemand/);
        assert.match(schedule, /onLazyItemAppearanceLoaded/);
    });
});
