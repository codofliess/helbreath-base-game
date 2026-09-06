import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SpriteType } from '../game/assets/HBSprite';
import {
    getSelectAppearanceAssets,
    getWorldInterfaceAssets,
    SELECT_APPEARANCE_SPRITE_NAMES,
} from './bootCatalog';

describe('bootCatalog deferral sets', () => {
    it('select packs are body/hair/underwear only (no interface data-URL dumps)', () => {
        const names = getSelectAppearanceAssets().map((a) => a.fileName);
        assert.deepEqual(
            names,
            SELECT_APPEARANCE_SPRITE_NAMES.map((n) => `${n}.spr`),
        );
        for (const asset of getSelectAppearanceAssets()) {
            assert.notEqual(asset.spriteType, SpriteType.Interface);
            assert.notEqual(asset.exportFramesAsDataUrls, true);
        }
    });

    it('world deferred packs are the interface HUD sheets', () => {
        const keys = getWorldInterfaceAssets().map((a) => a.key);
        assert.ok(keys.includes('sprite-interface'));
        assert.ok(keys.includes('sprite-gamedialog2'));
        assert.ok(keys.includes('sprite-dialogtext'));
        assert.ok(keys.includes('sprite-interface2'));
        assert.equal(
            getWorldInterfaceAssets().every((a) => a.spriteType === SpriteType.Interface),
            true,
        );
    });
});
