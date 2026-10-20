/**
 * Local draw timing for equipment, run, and a spell effect.
 * Not part of the client bundle. Run via scripts/run-sprite-draw-measure.mjs.
 */
import Phaser from 'phaser';
import { AssetType } from '../src/constants/Assets';
import { SPELL_HEAL_ID } from '../src/constants/Spells';
import { SpriteType } from '../src/game/assets/HBSprite';
import {
    buildBodyAndEquipmentJobs,
    buildSpellEffectJobs,
    preloadActionSpriteJobs,
    type ActionPreloadLook,
} from '../src/utils/actionSpritePreload';
import { MAP_ENTER_HEAVY_DECODE_MS } from '../src/utils/mapEnterSettle';
import { loadSpriteAssetOnDemand } from '../src/utils/SpriteHttpLoader';

type Phase = 'before' | 'after';

type DrawSample = {
    label: 'equipment' | 'run' | 'spell';
    msFromActionStart: number;
    opaquePixels: number;
};

const LOOK: ActionPreloadLook = {
    humanSpriteName: 'wm',
    hairSpriteName: 'mhr',
    underwearSpriteName: 'mpt',
    hairStyleIndex: 0,
    underwearColorIndex: 0,
    equipment: [{ spriteName: 'mhauberk', kind: 'armour' }],
};

const TARGETS = [
    { label: 'equipment' as const, key: 'sprite-mhauberk-1', assetKey: 'sprite-mhauberk', fileName: 'mhauberk.spr', sheet: 1, spriteType: SpriteType.EquipmentPack },
    { label: 'run' as const, key: 'sprite-wm-32', assetKey: 'sprite-wm', fileName: 'wm.spr', sheet: 32, spriteType: SpriteType.Human },
    { label: 'spell' as const, key: 'sprite-effect7-5', assetKey: 'sprite-effect7', fileName: 'effect7.spr', sheet: 5, spriteType: SpriteType.Effect },
];

function phaseFromLocation(): Phase {
    const value = new URLSearchParams(location.search).get('phase');
    return value === 'after' ? 'after' : 'before';
}

function opaquePixelCount(canvas: HTMLCanvasElement): number {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return 0;
    }
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    let count = 0;
    for (let i = 3; i < data.length; i += 16) {
        if (data[i] > 24) {
            count += 1;
        }
    }
    return count;
}

function waitFrames(frames: number): Promise<void> {
    return new Promise((resolve) => {
        const step = (left: number) => {
            if (left <= 0) {
                resolve();
                return;
            }
            requestAnimationFrame(() => step(left - 1));
        };
        step(frames);
    });
}

async function drawUntilOpaque(
    scene: Phaser.Scene,
    textureKey: string,
    actionStartedAt: number,
): Promise<{ ms: number; opaque: number; png: string }> {
    const sprite = scene.add.sprite(160, 140, textureKey, 0);
    sprite.setOrigin(0.5, 0.5);
    sprite.setScale(2);
    let opaque = 0;
    for (let attempt = 0; attempt < 8; attempt += 1) {
        await waitFrames(2);
        opaque = opaquePixelCount(scene.game.canvas);
        if (opaque > 8) {
            break;
        }
    }
    const png = scene.game.canvas.toDataURL('image/png');
    sprite.destroy();
    scene.cameras.main.setBackgroundColor('#000000');
    await waitFrames(1);
    return { ms: performance.now() - actionStartedAt, opaque, png };
}

async function loadCold(scene: Phaser.Scene, target: (typeof TARGETS)[number]): Promise<void> {
    await loadSpriteAssetOnDemand(
        scene,
        {
            key: target.assetKey,
            fileName: target.fileName,
            assetType: AssetType.SPRITE,
            spriteType: target.spriteType,
        },
        { sheetIndices: new Set([target.sheet]) },
    );
}

async function run(scene: Phaser.Scene): Promise<void> {
    const phase = phaseFromLocation();
    const samples: DrawSample[] = [];
    const pngs: Record<string, string> = {};
    let preloadMs = 0;
    const actionStartedAt = performance.now();

    if (phase === 'before') {
        await new Promise((resolve) => setTimeout(resolve, MAP_ENTER_HEAVY_DECODE_MS));
        for (const target of TARGETS) {
            await loadCold(scene, target);
            const drawn = await drawUntilOpaque(scene, target.key, actionStartedAt);
            samples.push({ label: target.label, msFromActionStart: drawn.ms, opaquePixels: drawn.opaque });
            pngs[target.label] = drawn.png;
        }
    } else {
        const preloadStarted = performance.now();
        await preloadActionSpriteJobs(scene, [
            ...buildBodyAndEquipmentJobs(LOOK),
            ...buildSpellEffectJobs([SPELL_HEAL_ID]),
        ]);
        preloadMs = performance.now() - preloadStarted;
        for (const target of TARGETS) {
            const drawn = await drawUntilOpaque(scene, target.key, performance.now());
            samples.push({ label: target.label, msFromActionStart: drawn.ms, opaquePixels: drawn.opaque });
            pngs[target.label] = drawn.png;
        }
    }

    await fetch('/results', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            phase,
            gateMs: MAP_ENTER_HEAVY_DECODE_MS,
            preloadMs,
            samples,
            pngs,
        }),
    });
}

new Phaser.Game({
    type: Phaser.CANVAS,
    width: 320,
    height: 240,
    backgroundColor: '#000000',
    banner: false,
    audio: { noAudio: true },
    scene: {
        create() {
            void run(this).catch(async (error) => {
                await fetch('/results', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ error: String(error), stack: error instanceof Error ? error.stack : '' }),
                });
            });
        },
    },
});
