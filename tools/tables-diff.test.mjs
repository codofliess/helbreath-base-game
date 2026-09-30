import assert from 'node:assert/strict';
import test from 'node:test';
import {
    averageBaseExp,
    diffDrops,
    diffMonster,
    diffSpell,
    expectedHp,
    nameSimilarity,
    olympiaDamage,
    parseItemCfg,
    parseMagicCfg,
    parseNpcCfg,
    parseSignatureDrops,
} from './tables-diff.mjs';

const DEFAULTS = { hp: 100, attackDamageMin: 1, attackDamageMax: 5 };

test('slime HP and damage match the Olympia midpoint', () => {
    assert.equal(expectedHp(2), 7);
    assert.equal(expectedHp(6), 34);
    const dmg = olympiaDamage(1, 4);
    assert.equal(dmg.min, 1);
    assert.equal(dmg.max, 4);
    assert.equal(dmg.avg, 2.5);
    assert.equal(averageBaseExp(4, 2), 8);
});

test('npc.cfg short row keeps defense, speed, and gold', () => {
    const npcs = parseNpcCfg(`
Name Type HitDice DR HR MinBrav ExpDice ADT ADR Size Side ActionLmt ActionTime MR ML DoW Chat SrchRange RegTime Attr AbsM Mana MR AtkRange Gold
Npc = Slime 10 2 10 30 1 4 1 4 0 10 0 2300 5 0 10 0 2 3500 1 0 0 0 1 30
Npc = Slime 10 99 1 1 1 1 9 9 0 10 0 100 5 0 10 0 2 3500 1 0 0 0 1 1
`);
    const slime = npcs.byName.get('slime');
    assert.equal(slime.hitDice, 2);
    assert.equal(slime.defense, 10);
    assert.equal(slime.adt, 1);
    assert.equal(slime.adr, 4);
    assert.equal(slime.actionTime, 2300);
    assert.equal(slime.gold, 30);
    assert.equal(slime.hitDice, 2);
    assert.equal(npcs.byType.get(10).name, 'Slime');
});

test('a swing about twice Olympia ranks above a small HP miss', () => {
    const npc = parseNpcCfg('Npc = Orc 14 4 35 70 2 20 3 3 0 10 0 1400 25 0 10 0 5 3500 1 0 0 0 1 30').byName.get('orc');
    const monster = {
        id: 5,
        name: 'Orc',
        hp: 14,
        attackDamageMin: 6,
        attackDamageMax: 18,
        movementSpeed: 1400,
        magicLevel: 0,
    };
    const findings = diffMonster(monster, npc, DEFAULTS).findings;
    const damage = findings.find((row) => row.category === 'monster-damage');
    assert.ok(damage, 'expected a damage finding');
    assert.ok(damage.score >= 90);
    assert.match(damage.detail, /twice/i);
    assert.equal(olympiaDamage(3, 3).avg, 6);
    assert.equal((6 + 18) / 2 / 6, 2);
});

test('signature drops stay on the NPC case, not the inner dice case', () => {
    const cpp = `
bool CGame::bGetItemNameWhenDeleteNpc(int & iItemID, short sNpcType)
{
	switch (sNpcType) {
		case 49:
			iItemID = 308;
			else if (iDice(1,2) == 1) iItemID = 259;
			return true;
		default:
			break;
	}
	switch (sNpcType) {
	case 11:
	case 17:
		switch (iDice(1,7)) {
		case 1: iItemID = 334 ; break;
		case 2: iItemID = 336 ; break;
		}
		break;
	}
}
`;
    const drops = parseSignatureDrops(cpp);
    assert.deepEqual([...drops.get(49)].sort((a, b) => a - b), [259, 308]);
    assert.deepEqual([...drops.get(11)].sort((a, b) => a - b), [334, 336]);
    assert.deepEqual([...drops.get(17)].sort((a, b) => a - b), [334, 336]);
    assert.equal(drops.has(1), false);
});

test('missing signature loot is one finding', () => {
    const npc = { type: 49, name: 'Hellclaw', gold: 700, defense: 450 };
    const findings = diffDrops(
        {
            id: 40,
            name: 'Hellclaw',
            loot: [
                { itemId: 90, chance: 0.21, minQuantity: 1, maxQuantity: 700 },
                { itemId: 91, chance: 0.1, minQuantity: 1, maxQuantity: 1 },
            ],
        },
        npc,
        new Set([308, 643]),
        new Map([[308, 'MagicNecklace'], [643, 'KnecklaceOfIceEle']]),
    );
    const missing = findings.filter((row) => row.category === 'drop-missing');
    assert.equal(missing.length, 1);
    assert.match(missing[0].detail, /308 MagicNecklace/);
    assert.match(missing[0].detail, /643 KnecklaceOfIceEle/);
});

test('spell dice that match either Magic.cfg triple are quiet', () => {
    const magic = parseMagicCfg('magic = 81 Meteor-Strike 21 0 0 120 2 2 6 8 12 7 12 18 0 0 0 169 40000 1 3');
    const row = magic.get(81);
    const quiet = diffSpell({
        id: 19,
        name: 'Meteor Strike',
        damageDiceCount: 7,
        damageDiceSides: 12,
        damageDiceBonus: 18,
    }, row);
    assert.equal(quiet.length, 0);
    const loud = diffSpell({
        id: 19,
        name: 'Meteor Strike',
        damageDiceCount: 16,
        damageDiceSides: 12,
        damageDiceBonus: 18,
    }, row);
    assert.equal(loud.length, 1);
    assert.ok(loud[0].score >= 80);
});

test('item names ignore spaces and punctuation', () => {
    const items = parseItemCfg('Item = 1 Dagger 1 8 1 1 5 0 1 4 0 300 0 1 0 25 200 1 0 0 0 0 -10 7 1 0', 'Item.cfg');
    const dagger = items.get(1);
    assert.equal(dagger.effectType, 1);
    assert.equal(dagger.maxLife, 300);
    assert.equal(dagger.price, 25);
    assert.ok(nameSimilarity('Dagger(S.C.)', 'Dagger(S.C)') > 0.8);
    assert.ok(nameSimilarity('Dagger', 'Excaliber') < 0.55);
});
