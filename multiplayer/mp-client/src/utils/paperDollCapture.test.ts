import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Gender, SkinColor } from '../Types';
import { ItemTypes } from '../constants/Items';
import { paperDollLookKey } from './itemAppearanceSheets';
import {
    isWorldCanvasImageSource,
    PENDING_APPEARANCE_TEXTURE_KEY,
} from './pendingAppearanceTexture';

describe('paperDollLookKey', () => {
    it('is stable across equippedItems object identity', () => {
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

describe('paperDoll capture safety', () => {
    it('skips pending / default keys and world-canvas sources', () => {
        assert.equal(PENDING_APPEARANCE_TEXTURE_KEY, 'player-item-appearance-pending');
        assert.equal(PENDING_APPEARANCE_TEXTURE_KEY === 'sprite-wsw-12', false);
        const world = { id: 'canvas' };
        assert.equal(isWorldCanvasImageSource(world, world), true);
    });
});
