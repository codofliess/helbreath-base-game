import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

describe('bootCatalog deferral sets', () => {
    it('select packs are body/hair/underwear only (no interface data-URL dumps)', () => {
        const src = fs.readFileSync(path.join(root, 'bootCatalog.ts'), 'utf8');
        const selectEnd = src.indexOf('WORLD_HUD_SPRITE_SHEETS');
        const selectSrc = selectEnd >= 0 ? src.slice(0, selectEnd) : src;
        assert.match(selectSrc, /'wm'/);
        assert.match(selectSrc, /'mhr'/);
        assert.match(selectSrc, /SELECT_APPEARANCE_SPRITE_NAMES/);
        assert.doesNotMatch(selectSrc, /sprite-gamedialog2/);
        assert.match(src, /getWorldInterfaceAssets/);
        assert.match(src, /SpriteType\.Interface/);
    });

    it('world deferred packs are HUD sheets only (no dialogtext / full interface dump)', () => {
        const src = fs.readFileSync(path.join(root, 'bootCatalog.ts'), 'utf8');
        assert.match(src, /getMonsterPlaceholderAsset/);
        assert.match(src, /loadSelectAppearanceSprites/);
        assert.match(src, /loadWorldDeferredSprites/);
        assert.match(src, /loadSpriteSheetsOnDemand/);
        assert.match(src, /ensureNamedSpriteFrames/);
        assert.match(src, /WORLD_HUD_FRAME_KEYS/);
        assert.doesNotMatch(src, /dialogtext\.spr/);
        assert.doesNotMatch(src, /item-pack\.spr/);
        assert.match(src, /exportFramesAsDataUrls: false/);
    });
});
