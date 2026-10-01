import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { SPELL_FIRE_STRIKE_ID, SPELL_HEAL_ID } from '../constants/Spells';
import { enqueueSpriteDecode } from './SpriteHttpLoader';
import {
    ARMOUR_ACTION_SHEETS,
    HUMAN_RUN_SHEETS,
    MAX_SPELL_EFFECT_PRELOAD_SHEETS,
    buildBodyAndEquipmentJobs,
    buildSpellEffectJobs,
    type ActionPreloadLook,
} from './actionSpritePreload';

const look: ActionPreloadLook = {
    humanSpriteName: 'wm',
    hairSpriteName: 'mhr',
    underwearSpriteName: 'mpt',
    hairStyleIndex: 0,
    underwearColorIndex: 1,
    equipment: [
        { spriteName: 'mhauberk', kind: 'armour' },
        { spriteName: 'msw', kind: 'weapon', packBase: 0 },
        { spriteName: 'msh', kind: 'shield', packBase: 14 },
    ],
};

describe('actionSpritePreload jobs', () => {
    it('caches body run facings and equipped stand/run sheets', () => {
        const jobs = buildBodyAndEquipmentJobs(look);
        const human = jobs.find((job) => job.asset.key === 'sprite-wm');
        const hauberk = jobs.find((job) => job.asset.key === 'sprite-mhauberk');
        const weapon = jobs.find((job) => job.asset.key === 'sprite-msw');
        const shield = jobs.find((job) => job.asset.key === 'sprite-msh');
        const hair = jobs.find((job) => job.asset.key === 'sprite-mhr');
        const undies = jobs.find((job) => job.asset.key === 'sprite-mpt');
        assert.deepEqual(human?.sheets, [...HUMAN_RUN_SHEETS]);
        assert.ok(hauberk?.sheets.includes(1));
        assert.ok(hauberk?.sheets.includes(4));
        assert.deepEqual([...ARMOUR_ACTION_SHEETS], [0, 1, 4]);
        assert.ok(weapon?.sheets.includes(8));
        assert.ok(weapon?.sheets.includes(48));
        assert.deepEqual(shield?.sheets, [14, 15, 20]);
        assert.deepEqual(hair?.sheets, [4]);
        assert.deepEqual(undies?.sheets, [16]);
    });

    it('skips bald hair and still preloads the run body', () => {
        const jobs = buildBodyAndEquipmentJobs({ ...look, hairStyleIndex: 2, equipment: [] });
        assert.equal(jobs.some((job) => job.asset.key === 'sprite-mhr'), false);
        assert.ok(jobs.some((job) => job.asset.key === 'sprite-wm'));
    });

    it('preloads heal and fire-strike sheets without the 16s enter timer', () => {
        const src = fs.readFileSync(new URL('./actionSpritePreload.ts', import.meta.url), 'utf8');
        const preloadFn = src.slice(src.indexOf('export function preloadActionSpriteJobs'));
        assert.doesNotMatch(preloadFn, /MAP_ENTER_HEAVY_DECODE/);
        assert.doesNotMatch(preloadFn, /setTimeout\(/);
        const jobs = buildSpellEffectJobs([SPELL_HEAL_ID, SPELL_FIRE_STRIKE_ID]);
        const heal = jobs.find((job) => job.asset.fileName === 'effect7.spr');
        const fire = jobs.find((job) => job.asset.fileName === 'effect.spr');
        assert.ok(heal?.sheets.includes(5));
        assert.ok(fire?.sheets.includes(5));
        assert.ok(fire?.sheets.includes(3));
        assert.ok(jobs.length <= MAX_SPELL_EFFECT_PRELOAD_SHEETS);
    });
});

describe('sprite decode priority', () => {
    it('runs a priority sheet before tile work already queued', async () => {
        const order: string[] = [];
        let releaseFirst: () => void = () => undefined;
        const firstBlocked = new Promise<void>((resolve) => {
            releaseFirst = resolve;
        });
        const running = enqueueSpriteDecode(async () => {
            order.push('tile-start');
            await firstBlocked;
            order.push('tile-done');
        });
        const queued = enqueueSpriteDecode(async () => {
            order.push('tile-queued');
        });
        const urgent = enqueueSpriteDecode(async () => {
            order.push('action');
        }, { priority: true });
        releaseFirst();
        await Promise.all([running, queued, urgent]);
        assert.deepEqual(order, ['tile-start', 'tile-done', 'action', 'tile-queued']);
    });
});
