import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OLYMPIA_GENERATED_ITEMS } from '../constants/OlympiaItems.generated';
import {
    canEquipHeroItemOnKit,
    heroAppearanceFaction,
    heroFactionOf,
    heroItemToSide,
    kitHasCrossFactionHeroItems,
    resolveHeroKitSide,
    rewriteHeroItemIds,
} from './heroFactionKit';

describe('heroFactionKit', () => {
    it('maps a Hero / e Hero siblings without changing gender or slot', () => {
        assert.equal(heroFactionOf(419), 'aresden');
        assert.equal(heroFactionOf(421), 'elvine');
        assert.equal(heroItemToSide(419, 'elvine'), 421);
        assert.equal(heroItemToSide(420, 'elvine'), 422);
        assert.equal(heroItemToSide(405, 'aresden'), 403);
        assert.equal(heroItemToSide(451, 'elvine'), 451);
        assert.equal(heroItemToSide(400, 'elvine'), 401);
    });

    it('locks Elvine papers to Elvine even when Aresden pieces are in the bag', () => {
        assert.equal(resolveHeroKitSide('elvine', [403, 411, 419]), 'elvine');
        assert.equal(kitHasCrossFactionHeroItems([403, 421]), true);
        assert.equal(kitHasCrossFactionHeroItems([405, 421, 425]), false);
        assert.equal(canEquipHeroItemOnKit(419, 'elvine', [405]), false);
        assert.equal(canEquipHeroItemOnKit(421, 'elvine', [405]), true);
        assert.equal(canEquipHeroItemOnKit(419, 'traveler', [403, 411]), true);
        assert.equal(canEquipHeroItemOnKit(421, 'traveler', [403, 411]), false);
        assert.deepEqual(rewriteHeroItemIds([403, 421, 420], 'elvine'), [405, 421, 422]);
    });

    it('keeps generated Hero appearance sheets on one city (1=Elvine, 2=Aresden)', () => {
        const hero = OLYMPIA_GENERATED_ITEMS.filter((row) => heroFactionOf(row.id) !== null);
        assert.ok(hero.length >= 24, `expected city Hero rows, got ${hero.length}`);
        for (const row of hero) {
            const faction = heroFactionOf(row.id);
            const male = heroAppearanceFaction(row.equippedSpriteMale);
            const female = heroAppearanceFaction(row.equippedSpriteFemale);
            if (male) {
                assert.equal(male, faction, `${row.id} ${row.name} male sheet ${row.equippedSpriteMale}`);
            }
            if (female) {
                assert.equal(female, faction, `${row.id} ${row.name} female sheet ${row.equippedSpriteFemale}`);
            }
            assert.notEqual(
                male && female && male !== female,
                true,
                `${row.id} ${row.name} mixes ${row.equippedSpriteMale}/${row.equippedSpriteFemale}`,
            );
        }
        const hauberkW = hero.find((row) => row.id === 420);
        assert.equal(hauberkW?.equippedSpriteFemale, 'whhauberk2');
        const elvineHauberkW = hero.find((row) => row.id === 422);
        assert.equal(elvineHauberkW?.equippedSpriteFemale, 'whhauberk1');
    });
});
