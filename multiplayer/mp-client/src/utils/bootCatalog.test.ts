import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

describe('bootCatalog deferral sets', () => {
    it('select packs are body/hair/underwear only (no interface data-URL dumps)', () => {
        const src = fs.readFileSync(path.join(root, 'bootCatalog.ts'), 'utf8');
        assert.match(src, /'wm'/);
        assert.match(src, /'mhr'/);
        assert.match(src, /SELECT_APPEARANCE_SPRITE_NAMES/);
        assert.doesNotMatch(src, /sprite-gamedialog2/);
        assert.match(src, /getWorldInterfaceAssets/);
        assert.match(src, /SpriteType\.Interface/);
    });

    it('world deferred packs are the interface HUD sheets plus placeholder', () => {
        const src = fs.readFileSync(path.join(root, 'bootCatalog.ts'), 'utf8');
        assert.match(src, /getMonsterPlaceholderAsset/);
        assert.match(src, /loadSelectAppearanceSprites/);
        assert.match(src, /loadWorldDeferredSprites/);
    });
});
