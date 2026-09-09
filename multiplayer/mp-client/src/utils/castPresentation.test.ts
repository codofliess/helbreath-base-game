import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SPELL_MAGIC_MISSILE_ID } from '../constants/Spells';
import { getOlympiaServerSpellId } from '../constants/OlympiaServerSpellMap';
import {
    applyMagiasMoveDuringPrepareVisuals,
    applyMagiasSoftCastConfirmVisuals,
    applyMagiasSpellSelectVisuals,
    beginMagiasMoveDuringPrepare,
    beginMagiasRitual,
    canCreateCastAnnounceText,
    canCreateMagiasUiPhaserText,
    canFetchAppearanceSheetOnStateEnter,
    canApplyWalkAppearanceOnMagiasPrepare,
    canMutateWorldCanvasOnMoveDuringPrepare,
    canMutateWorldCanvasTexturesOnCastConfirm,
    canMutateWorldCanvasTexturesOnCastEnter,
    canRebuildMapTilesetOnMagiasPrepare,
    canPresentCastingCircle,
    canSpawnCastingCircleOnPrepare,
    canTouchCanvasPoolOnMagiasSelect,
    endMagiasRitual,
    isMagiasMoveDuringPrepareActive,
    isMagiasRitualActive,
    planCastEnterVisuals,
    planMagiasMoveDuringPrepare,
    planMagiasSoftCastConfirm,
    planMagiasSpellSelect,
    shouldAdvanceCastToReady,
    shouldSkipCastCanvasWorkOnState,
} from './castPresentation';
import { PHASER_DEFAULT_TEXTURE_KEY, safeBindableTextureKey } from './worldCanvasTextureSafety';

describe('shouldAdvanceCastToReady', () => {
    it('waits for castSpeed when the CAST sheet never plays (Missile prepare)', () => {
        assert.equal(shouldAdvanceCastToReady(false, 0, 1200), false);
        assert.equal(shouldAdvanceCastToReady(false, 1199, 1200), false);
        assert.equal(shouldAdvanceCastToReady(false, 1200, 1200), true);
    });

    it('does not skip the ritual while the CAST animation is playing', () => {
        assert.equal(shouldAdvanceCastToReady(true, 5000, 1200), false);
    });

    it('advances on castSpeed when Cast skipped appearance and idle is still looping', () => {
        assert.equal(shouldAdvanceCastToReady(true, 1199, 1200, false), false);
        assert.equal(shouldAdvanceCastToReady(true, 1200, 1200, false), true);
    });
});

describe('Missile prepare must not fetch CAST / circle sheets', () => {
    it('never spawns fogata on Missile prepare even when effect5-7 looks safe', () => {
        assert.equal(canPresentCastingCircle(false), false);
        assert.equal(canPresentCastingCircle(true), true);
        assert.equal(canSpawnCastingCircleOnPrepare(), false);
    });

    it('does not fetch clothes CAST sheet 8 or the idle pack on Cast enter', () => {
        assert.equal(canFetchAppearanceSheetOnStateEnter(true), false);
        assert.equal(canFetchAppearanceSheetOnStateEnter(false), true);
    });

    it('skips appearance / shadow canvas work on Cast and CastReady', () => {
        assert.equal(shouldSkipCastCanvasWorkOnState('Cast'), true);
        assert.equal(shouldSkipCastCanvasWorkOnState('CastReady'), true);
        assert.equal(shouldSkipCastCanvasWorkOnState('Idle'), false);
    });

    it('skips Idle rebind after skipped Cast (soft-cast / target confirm)', () => {
        assert.equal(canMutateWorldCanvasTexturesOnCastConfirm(), false);
        assert.equal(shouldSkipCastCanvasWorkOnState('IdleFromCast'), true);
    });

    it('skips Walk appearance and tileset rebuild on move mid-prepare', () => {
        assert.equal(canMutateWorldCanvasOnMoveDuringPrepare(), false);
        assert.equal(canApplyWalkAppearanceOnMagiasPrepare(), false);
        assert.equal(canRebuildMapTilesetOnMagiasPrepare(), false);
        assert.equal(shouldSkipCastCanvasWorkOnState('MoveDuringPrepare'), true);
    });
});

describe('Cast-enter path cannot touch game.canvas textures', () => {
    it('refuses Phaser Text, pack fetch, and world-canvas mutations on Cast enter', () => {
        const plan = planCastEnterVisuals(false);
        assert.equal(plan.presentCircle, false);
        assert.equal(plan.fetchAppearanceSheets, false);
        assert.equal(plan.createPhaserText, false);
        assert.equal(plan.mayMutateWorldCanvasTextures, false);
        assert.equal(canCreateCastAnnounceText(), false);
        assert.equal(canMutateWorldCanvasTexturesOnCastEnter(), false);
    });

    it('Cast animation ON does not present a preloaded circle (GameAsset bind can steal game.canvas)', () => {
        const plan = planCastEnterVisuals(true);
        assert.equal(plan.presentCircle, false);
        assert.equal(plan.fetchAppearanceSheets, false);
        assert.equal(plan.createPhaserText, false);
        assert.equal(plan.mayMutateWorldCanvasTextures, false);
        assert.equal(canSpawnCastingCircleOnPrepare(), false);
    });

    it('does not bind a world-canvas alias when pending cannot detach', () => {
        const world = { id: 'game-canvas', width: 800, height: 600 };
        const textures = new Map<string, { getSourceImage: () => unknown }>([
            ['player-item-appearance-pending', { getSourceImage: () => world }],
        ]);
        const scene = {
            game: { canvas: world },
            textures: {
                exists: (key: string) => textures.has(key),
                get: (key: string) => {
                    const row = textures.get(key);
                    if (!row) {
                        throw new Error(`missing ${key}`);
                    }
                    return row;
                },
                remove: () => {
                    throw new Error('Cast enter must not textures.remove');
                },
                addCanvas: () => {
                    throw new Error('Cast enter must not addCanvas');
                },
            },
        };
        assert.equal(safeBindableTextureKey(scene, 'player-item-appearance-pending'), PHASER_DEFAULT_TEXTURE_KEY);
        assert.equal((world as { width: number }).width, 800);
        assert.equal((world as { height: number }).height, 600);
    });
});

describe('F7 select Olympia Missile id 0 must not create Text or touch CanvasPool', () => {
    it('plans Missile select without Phaser Text / game.canvas CanvasPool', () => {
        const plan = planMagiasSpellSelect(SPELL_MAGIC_MISSILE_ID, getOlympiaServerSpellId, true, true);
        assert.equal(plan.spellId, 0);
        assert.equal(plan.serverCatalogSpellId, 0);
        assert.equal(plan.useCastAnimationOn, true);
        assert.equal(plan.presentCircle, false);
        assert.equal(plan.createPhaserText, false);
        assert.equal(plan.createFloatingText, false);
        assert.equal(plan.mayTouchCanvasPoolForGameCanvas, false);
        assert.equal(plan.fetchAppearanceSheets, false);
        assert.equal(plan.mayMutateWorldCanvasTextures, false);
        assert.equal(canCreateMagiasUiPhaserText(), false);
        assert.equal(canTouchCanvasPoolOnMagiasSelect(), false);
    });

    it('selecting Missile 0 does not add.text or resize game.canvas', () => {
        const world = { width: 800, height: 600 };
        let textCalls = 0;
        let canvasPoolTouches = 0;
        const scene = {
            game: { canvas: world },
            add: {
                text: () => {
                    textCalls += 1;
                    world.width = 1;
                    world.height = 1;
                    throw new Error('Missile select must not create Phaser Text');
                },
            },
            textures: {
                addCanvas: () => {
                    canvasPoolTouches += 1;
                    throw new Error('Missile select must not addCanvas');
                },
                remove: () => {
                    canvasPoolTouches += 1;
                    throw new Error('Missile select must not textures.remove');
                },
                generateTexture: () => {
                    canvasPoolTouches += 1;
                    throw new Error('Missile select must not generateTexture');
                },
            },
        };

        endMagiasRitual();
        const plan = applyMagiasSpellSelectVisuals(SPELL_MAGIC_MISSILE_ID, scene, getOlympiaServerSpellId);
        assert.equal(plan.spellId, 0);
        assert.equal(plan.serverCatalogSpellId, 0);
        assert.equal(isMagiasRitualActive(), true);
        assert.equal(isMagiasMoveDuringPrepareActive(), false);
        assert.equal(textCalls, 0);
        assert.equal(canvasPoolTouches, 0);
        assert.equal(world.width, 800);
        assert.equal(world.height, 600);
        endMagiasRitual();
        assert.equal(isMagiasRitualActive(), false);
    });

    it('beginMagiasRitual is armed at select before Cast without the move freeze', () => {
        endMagiasRitual();
        beginMagiasRitual();
        assert.equal(isMagiasRitualActive(), true);
        assert.equal(isMagiasMoveDuringPrepareActive(), false);
        endMagiasRitual();
    });
});

describe('soft-cast / target-mob confirm must not touch game.canvas', () => {
    it('plans Missile confirm without Text / Idle rebind / local projectile', () => {
        const plan = planMagiasSoftCastConfirm(SPELL_MAGIC_MISSILE_ID);
        assert.equal(plan.spellId, 0);
        assert.equal(plan.createPhaserText, false);
        assert.equal(plan.createFloatingText, false);
        assert.equal(plan.mayTouchCanvasPoolForGameCanvas, false);
        assert.equal(plan.mayMutateWorldCanvasTextures, false);
        assert.equal(plan.fetchAppearanceSheets, false);
        assert.equal(plan.presentCircle, false);
        assert.equal(plan.spawnProjectileGameAsset, false);
        assert.equal(plan.applyIdleAppearanceOnConfirm, false);
        assert.equal(canMutateWorldCanvasTexturesOnCastConfirm(), false);
    });

    it('confirming Missile on a mob does not add.text or resize game.canvas', () => {
        const world = { width: 1024, height: 576 };
        let textCalls = 0;
        let canvasPoolTouches = 0;
        const scene = {
            game: { canvas: world },
            add: {
                text: () => {
                    textCalls += 1;
                    world.width = 1;
                    world.height = 1;
                    throw new Error('Missile confirm must not create Phaser Text');
                },
            },
            textures: {
                addCanvas: () => {
                    canvasPoolTouches += 1;
                    throw new Error('Missile confirm must not addCanvas');
                },
                remove: () => {
                    canvasPoolTouches += 1;
                    throw new Error('Missile confirm must not textures.remove');
                },
                generateTexture: () => {
                    canvasPoolTouches += 1;
                    throw new Error('Missile confirm must not generateTexture');
                },
            },
        };

        endMagiasRitual();
        const plan = applyMagiasSoftCastConfirmVisuals(SPELL_MAGIC_MISSILE_ID, scene);
        assert.equal(plan.spellId, 0);
        assert.equal(plan.applyIdleAppearanceOnConfirm, false);
        assert.equal(plan.spawnProjectileGameAsset, false);
        assert.equal(isMagiasRitualActive(), true);
        assert.equal(textCalls, 0);
        assert.equal(canvasPoolTouches, 0);
        assert.equal(world.width, 1024);
        assert.equal(world.height, 576);
        endMagiasRitual();
        assert.equal(isMagiasRitualActive(), false);
    });

    it('select skips Cast only; confirm is the IdleFromCast hole #71 left open', () => {
        assert.equal(shouldSkipCastCanvasWorkOnState('Cast'), true);
        assert.equal(shouldSkipCastCanvasWorkOnState('CastReady'), true);
        assert.equal(shouldSkipCastCanvasWorkOnState('Idle'), false);
        assert.equal(shouldSkipCastCanvasWorkOnState('IdleFromCast'), true);
    });
});

describe('move mid-prepare must not touch game.canvas', () => {
    it('plans WASD / camera follow without Walk rebind or tileset rebuild', () => {
        const plan = planMagiasMoveDuringPrepare(SPELL_MAGIC_MISSILE_ID);
        assert.equal(plan.spellId, 0);
        assert.equal(plan.createPhaserText, false);
        assert.equal(plan.createFloatingText, false);
        assert.equal(plan.mayTouchCanvasPoolForGameCanvas, false);
        assert.equal(plan.mayMutateWorldCanvasTextures, false);
        assert.equal(plan.fetchAppearanceSheets, false);
        assert.equal(plan.presentCircle, false);
        assert.equal(plan.applyWalkAppearanceOnMove, false);
        assert.equal(plan.rebuildMapTileset, false);
        assert.equal(plan.mayResizeWorldCanvas, false);
        assert.equal(canMutateWorldCanvasOnMoveDuringPrepare(), false);
        assert.equal(canRebuildMapTilesetOnMagiasPrepare(), false);
    });

    it('select Missile then move mid-prepare does not add.text or resize game.canvas', () => {
        const world = { width: 1024, height: 576 };
        let textCalls = 0;
        let canvasPoolTouches = 0;
        const scene = {
            game: { canvas: world },
            add: {
                text: () => {
                    textCalls += 1;
                    world.width = 1;
                    world.height = 1;
                    throw new Error('Missile move mid-prepare must not create Phaser Text');
                },
            },
            textures: {
                addCanvas: () => {
                    canvasPoolTouches += 1;
                    throw new Error('Missile move mid-prepare must not addCanvas');
                },
                remove: () => {
                    canvasPoolTouches += 1;
                    throw new Error('Missile move mid-prepare must not textures.remove');
                },
                generateTexture: () => {
                    canvasPoolTouches += 1;
                    throw new Error('Missile move mid-prepare must not generateTexture');
                },
                createCanvas: () => {
                    canvasPoolTouches += 1;
                    world.width = 1;
                    world.height = 1;
                    throw new Error('Missile move mid-prepare must not createCanvas tileset');
                },
            },
        };

        endMagiasRitual();
        applyMagiasSpellSelectVisuals(SPELL_MAGIC_MISSILE_ID, scene, getOlympiaServerSpellId);
        assert.equal(isMagiasMoveDuringPrepareActive(), false);
        const plan = applyMagiasMoveDuringPrepareVisuals(SPELL_MAGIC_MISSILE_ID, scene);
        assert.equal(plan.spellId, 0);
        assert.equal(plan.applyWalkAppearanceOnMove, false);
        assert.equal(plan.rebuildMapTileset, false);
        assert.equal(isMagiasRitualActive(), true);
        assert.equal(textCalls, 0);
        assert.equal(canvasPoolTouches, 0);
        assert.equal(world.width, 1024);
        assert.equal(world.height, 576);
        endMagiasRitual();
        assert.equal(isMagiasRitualActive(), false);
        assert.equal(isMagiasMoveDuringPrepareActive(), false);
    });

    it('WASD mid-prepare arms the freeze only after a painted FOV snapshot', () => {
        const painted = { id: 'painted-fov' };
        const black = { data: new Uint8ClampedArray(16) };
        let reads = 0;
        const world = {
            width: 1024,
            height: 576,
            getContext: () => ({
                getImageData: () => {
                    reads += 1;
                    return reads === 1 ? black : painted;
                },
            }),
        };
        endMagiasRitual();
        applyMagiasSpellSelectVisuals(
            SPELL_MAGIC_MISSILE_ID,
            {
                game: { canvas: world },
                add: { text: () => {
                    throw new Error('select must not create Phaser Text');
                } },
                textures: {},
            },
            getOlympiaServerSpellId,
        );
        assert.equal(isMagiasMoveDuringPrepareActive(), false);
        assert.equal(beginMagiasMoveDuringPrepare(world), false);
        assert.equal(isMagiasMoveDuringPrepareActive(), false);
        assert.equal(beginMagiasMoveDuringPrepare(world), true);
        assert.equal(isMagiasMoveDuringPrepareActive(), true);
        endMagiasRitual();
    });
});
