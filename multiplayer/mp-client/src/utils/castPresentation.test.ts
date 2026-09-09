import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    canCreateCastAnnounceText,
    canFetchAppearanceSheetOnStateEnter,
    canMutateWorldCanvasTexturesOnCastEnter,
    canPresentCastingCircle,
    planCastEnterVisuals,
    shouldAdvanceCastToReady,
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
});

describe('Missile prepare must not fetch CAST / circle sheets', () => {
    it('presents the casting circle only when effect5-7 is already safe', () => {
        assert.equal(canPresentCastingCircle(false), false);
        assert.equal(canPresentCastingCircle(true), true);
    });

    it('does not fetch clothes CAST sheet 8 or the idle pack on Cast enter', () => {
        assert.equal(canFetchAppearanceSheetOnStateEnter(true), false);
        assert.equal(canFetchAppearanceSheetOnStateEnter(false), true);
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

    it('still presents a preloaded isolated circle without mutating game.canvas', () => {
        const plan = planCastEnterVisuals(true);
        assert.equal(plan.presentCircle, true);
        assert.equal(plan.fetchAppearanceSheets, false);
        assert.equal(plan.createPhaserText, false);
        assert.equal(plan.mayMutateWorldCanvasTextures, false);
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
