import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { worldEnterAppearanceSheetJobs } from './worldEnterAppearance';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

describe('bootCatalog deferral sets', () => {
    it('select packs are body/hair/underwear only (no interface data-URL dumps)', () => {
        const src = fs.readFileSync(path.join(root, 'bootCatalog.ts'), 'utf8');
        assert.match(src, /'wm'/);
        assert.match(src, /'mhr'/);
        assert.match(src, /SELECT_APPEARANCE_SPRITE_NAMES/);
        const selectBlock = src.slice(
            src.indexOf('SELECT_APPEARANCE_SPRITE_NAMES'),
            src.indexOf('WORLD_ENTER_HUD_ASSETS'),
        );
        assert.doesNotMatch(selectBlock, /gamedialog2/);
        assert.match(src, /getWorldInterfaceAssets/);
        assert.match(src, /SpriteType\.Interface/);
    });

    it('world enter HUD decodes cursor + icon panel sheets only (no placeholder / dialog packs)', () => {
        const src = fs.readFileSync(path.join(root, 'bootCatalog.ts'), 'utf8');
        assert.match(src, /WORLD_ENTER_HUD_ASSETS/);
        assert.match(src, /gamedialog2\.spr/);
        assert.match(src, /sheets: \[6\]/);
        assert.match(src, /sheets: \[0\]/);
        assert.match(src, /loadWorldDeferredSprites/);
        assert.match(src, /evictUnusedSelectAppearanceSprites/);
        assert.match(src, /trimSelectAppearanceToIdleSheets/);
        const loadFn = src.slice(src.indexOf('export async function loadWorldDeferredSprites'));
        assert.doesNotMatch(loadFn, /getMonsterPlaceholderAsset/);
        assert.doesNotMatch(src, /exportFramesAsDataUrls: true/);
        assert.match(src, /loadWorldEnterAppearanceSprites/);
        assert.match(src, /worldEnterAppearanceSheetJobs/);
        assert.match(src, /sheetIndices: new Set\(job\.sheets\)/);
        const loadWorld = src.slice(src.indexOf('export async function loadWorldEnterAppearanceSprites'));
        assert.doesNotMatch(loadWorld, /getSelectAppearanceAssets/);
        assert.doesNotMatch(loadWorld, /loadSpriteList/);
    });

    it('world enter appearance decodes only the occupied look idle sheets', () => {
        const jobs = worldEnterAppearanceSheetJobs({
            humanSpriteName: 'wm',
            hairSpriteName: 'mhr',
            underwearSpriteName: 'mpt',
            hairStyleIndex: 1,
            underwearColorIndex: 3,
        });
        assert.deepEqual(
            jobs.map((j) => j.name),
            ['wm', 'mhr', 'mpt'],
        );
        assert.deepEqual(jobs[0].sheets, [0, 1, 2, 3, 4, 5, 6, 7]);
        assert.deepEqual(jobs[1].sheets, [12, 14]);
        assert.deepEqual(jobs[2].sheets, [36, 38]);
        const bald = worldEnterAppearanceSheetJobs({
            humanSpriteName: 'ww',
            hairSpriteName: 'whr',
            underwearSpriteName: 'wpt',
            hairStyleIndex: 2,
            underwearColorIndex: 0,
        });
        assert.deepEqual(
            bald.map((j) => j.name),
            ['ww', 'wpt'],
        );
        assert.ok(!bald.some((j) => j.name === 'whr' || j.name === 'ym' || j.name === 'bm'));
    });
});
