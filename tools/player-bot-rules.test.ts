import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
    assertNoServerStateFlags,
    assertRulesTargetAllowed,
    isProductionHost,
    resolvePlaytestSeat,
} from './player-bot-guard.ts';
import {
    ARESDEN_FARM_GATE,
    FARM_SLIME_SOUTH,
    PlayerBotBrain,
    PlayerBotObservation,
    buildPlayerBotView,
    hpRatio,
    huntRouteGoal,
    isHpPotionName,
    isSlimeIdentity,
    stepToward,
    weaponBlocksCast,
    type PlayerBotView,
} from './player-bot-rules.ts';
import { scorePlayerBotRun } from './player-bot-score.ts';

function openGrid(blocked: ReadonlyArray<string> = []): (x: number, y: number) => boolean {
    const blockedSet = new Set(blocked);
    return (x, y) => !blockedSet.has(`${x},${y}`);
}

function viewAt(overrides: Partial<PlayerBotView> = {}): PlayerBotView {
    return {
        className: 'mage',
        x: 10,
        y: 10,
        hp: 100,
        maxHp: 100,
        tookDamage: false,
        dead: false,
        attackMode: true,
        attackRangeCells: 1,
        canMove: true,
        potionLocked: false,
        fireStrikeSpellId: 2,
        recallSpellId: 50,
        recallFailures: 0,
        potions: [{ uid: '7', quantity: 2 }],
        recallScrollUid: null,
        equippedWeaponUid: null,
        equippedWeaponBlocksCast: false,
        monsters: [],
        worldId: '',
        teleports: [],
        teleportLocs: [],
        inTown: false,
        dryRetreatDone: false,
        ...overrides,
    };
}

test('score: 30 kills and no disconnects pass; under 10 fails', () => {
    assert.equal(scorePlayerBotRun({ slimeKills: 30, disconnects: 0 }), 'PASS');
    assert.equal(scorePlayerBotRun({ slimeKills: 31, disconnects: 0 }), 'PASS');
    assert.equal(scorePlayerBotRun({ slimeKills: 30, disconnects: 1 }), 'INCONCLUSIVE');
    assert.equal(scorePlayerBotRun({ slimeKills: 9, disconnects: 0 }), 'FAIL');
    assert.equal(scorePlayerBotRun({ slimeKills: 0, disconnects: 1 }), 'FAIL');
    assert.equal(scorePlayerBotRun({ slimeKills: 10, disconnects: 0 }), 'INCONCLUSIVE');
});

test('host guard refuses production and public addresses', () => {
    assert.equal(isProductionHost('play.chainlords.net'), true);
    assert.equal(isProductionHost('PLAY.CHAINLORDS.NET'), true);
    assert.equal(isProductionHost('64.176.23.40'), true);
    assert.throws(() => assertRulesTargetAllowed('play.chainlords.net', true), /production/);
    assert.throws(() => assertRulesTargetAllowed('8.8.8.8', true), /not localhost/);
    assert.throws(() => assertRulesTargetAllowed('192.168.1.20', false), /not localhost/);
    assert.doesNotThrow(() => assertRulesTargetAllowed('127.0.0.1', false));
    assert.doesNotThrow(() => assertRulesTargetAllowed('localhost', false));
    assert.doesNotThrow(() => assertRulesTargetAllowed('[::1]', false));
    assert.doesNotThrow(() => assertRulesTargetAllowed('192.168.1.20', true));
});

test('server-state flags refuse startup', () => {
    assert.throws(() => assertNoServerStateFlags(['--server-log', 'x']), /server-log/);
    assert.throws(() => assertNoServerStateFlags(['--database=1']), /database/);
    assert.doesNotThrow(() => assertNoServerStateFlags(['--class', 'mage', '--host', '127.0.0.1']));
});

test('elon seat is ElonQa and tries the PR #87 account first', () => {
    const seat = resolvePlaytestSeat('elon');
    assert.equal(seat.characterName, 'ElonQa');
    assert.equal(seat.accountIds[0], 'playtest-elonqa');
    assert.equal(seat.accountIds[1], 'playtest-a');
});

test('slime identity and potion names come from visible fields', () => {
    assert.equal(isSlimeIdentity('Slime', 'slm'), true);
    assert.equal(isSlimeIdentity('Orc', 'orc'), false);
    assert.equal(isHpPotionName('Big Red Potion'), true);
    assert.equal(isHpPotionName('Blue Potion'), false);
    assert.equal(weaponBlocksCast('Barbarian Battle Hammer'), true);
    assert.equal(weaponBlocksCast('Magic Wand'), false);
});

test('mage casts Fire Strike on the nearest slime and walks when it is far', () => {
    const brain = new PlayerBotBrain();
    const near = brain.decide(viewAt({
        monsters: [
            { id: '2', name: 'Slime', sprite: 'slm', x: 12, y: 10, dead: false },
            { id: '9', name: 'Slime', sprite: 'slm', x: 40, y: 40, dead: false },
        ],
    }), { isOpen: openGrid() });
    assert.equal(near.type, 'cast');
    if (near.type === 'cast') {
        assert.equal(near.spellId, 2);
        assert.equal(near.monsterId, '2');
    }

    const far = brain.decide(viewAt({
        x: 0,
        y: 0,
        monsters: [{ id: '2', name: 'Slime', sprite: 'slm', x: 20, y: 0, dead: false }],
    }), { isOpen: openGrid() });
    assert.equal(far.type, 'move');
});

test('melee swings in range and does not cast', () => {
    const brain = new PlayerBotBrain();
    const action = brain.decide(viewAt({
        className: 'melee',
        attackRangeCells: 1,
        monsters: [{ id: '4', name: 'Slime', sprite: 'slm', x: 11, y: 10, dead: false }],
    }), { isOpen: openGrid() });
    assert.deepEqual(action, { type: 'melee', monsterId: '4' });
});

test('low HP drinks a potion; critical HP with no potions recalls', () => {
    const brain = new PlayerBotBrain();
    const drink = brain.decide(viewAt({ hp: 40, maxHp: 100, tookDamage: true }), { isOpen: openGrid() });
    assert.equal(drink.type, 'drink');

    const recall = brain.decide(viewAt({
        hp: 10,
        maxHp: 100,
        tookDamage: true,
        potions: [],
    }), { isOpen: openGrid() });
    assert.equal(recall.type, 'recall');
});

test('full HP with no potions still hunts; low HP with no potions recalls once', () => {
    const brain = new PlayerBotBrain();
    const slime = [{ id: '1', name: 'Slime', sprite: 'slm', x: 11, y: 10, dead: false }];
    const healthy = brain.decide(viewAt({
        hp: 100,
        potions: [],
        monsters: slime,
    }), { isOpen: openGrid() });
    assert.equal(healthy.type, 'cast');

    const retreat = brain.decide(viewAt({
        hp: 40,
        maxHp: 100,
        tookDamage: true,
        potions: [],
        monsters: slime,
    }), { isOpen: openGrid() });
    assert.equal(retreat.type, 'recall');
    brain.noteTown(0);
    const again = brain.decide(viewAt({
        hp: 40,
        maxHp: 100,
        tookDamage: true,
        potions: [],
        monsters: slime,
    }), { isOpen: openGrid() });
    assert.equal(again.type, 'cast');
});

test('server-state fields are refused inside the decision', () => {
    const brain = new PlayerBotBrain();
    const poisoned = viewAt() as PlayerBotView & { serverState: string };
    poisoned.serverState = 'hp=1';
    assert.throws(() => brain.decide(poisoned, { isOpen: openGrid() }), /serverState/);
});

test('stepToward stops inside cast range', () => {
    const step = stepToward({ x: 0, y: 0 }, { x: 8, y: 0 }, 5, openGrid());
    assert.ok(step);
    assert.equal(Math.max(Math.abs(step.x), Math.abs(step.y)), 1);
});

test('kill baseline does not count historical slime kills', () => {
    const observation = new PlayerBotObservation();
    observation.noteKillBaseline(1, 40);
    observation.markKillBaselineReady();
    assert.equal(observation.noteSlimeKills(1, 'Slime', 40), 0);
    assert.equal(observation.noteSlimeKills(1, 'Slime', 42), 2);
    assert.equal(observation.slimeKillsThisRun, 2);

    const fresh = new PlayerBotObservation();
    fresh.markKillBaselineReady();
    assert.equal(fresh.noteSlimeKills(1, 'Slime', 1), 1);
    assert.equal(fresh.noteSlimeKills(1, 'Slime', 3), 2);

    const early = new PlayerBotObservation();
    assert.equal(early.noteSlimeKills(1, 'Slime', 40), 0);
    assert.equal(early.noteSlimeKills(1, 'Slime', 41), 1);
    const view = buildPlayerBotView(observation, 'mage', true, false);
    assert.equal(view.fireStrikeSpellId, null);
});

test('playtest kit potion is in the client item directory and is drunk when HP is low', () => {
    const catalog = JSON.parse(readFileSync(new URL('../multiplayer/server/Config/Items.json', import.meta.url), 'utf8')) as Array<{
        id: number;
        name: string;
        consumable?: boolean;
    }>;
    const potion = catalog.find((item) => item.id === 164);
    assert.ok(potion);
    assert.equal(potion.name, 'Big Red Potion');
    assert.equal(potion.consumable, true);
    assert.equal(isHpPotionName(potion.name), true);
    const consumable = readFileSync(new URL('../multiplayer/server/Helpers/ConsumableUse.cs', import.meta.url), 'utf8');
    assert.match(consumable, /case 164:/);
    assert.match(consumable, /player\.ApplyHeal\(amount\)/);

    const observation = new PlayerBotObservation();
    observation.noteVitals(100, 100);
    observation.noteVitals(40, 100);
    assert.equal(observation.tookDamage, true);
    observation.attackMode = true;
    observation.noteItems([{ id: potion.id, name: potion.name, consumable: potion.consumable === true }]);
    observation.noteBag([{ uid: '164-stack', itemId: potion.id, quantity: 5 }]);
    const brain = new PlayerBotBrain();
    const action = brain.decide(buildPlayerBotView(observation, 'mage', true, false), { isOpen: openGrid() });
    assert.equal(action.type, 'drink');
    if (action.type === 'drink') {
        assert.equal(action.itemUid, '164-stack');
    }
});

test('potions are not used without real damage, and a drink that does not heal is not repeated', () => {
    const undamaged = new PlayerBotObservation();
    undamaged.noteVitals(40, 1000);
    assert.equal(undamaged.tookDamage, false);
    assert.ok(hpRatio(undamaged) < 0.5);
    undamaged.attackMode = true;
    undamaged.noteItems([{ id: 164, name: 'Big Red Potion', consumable: true }]);
    undamaged.noteBag([{ uid: '164-stack', itemId: 164, quantity: 50 }]);
    const brain = new PlayerBotBrain();
    const nav = { isOpen: openGrid() };
    const first = brain.decide(buildPlayerBotView(undamaged, 'mage', true, false), nav);
    assert.notEqual(first.type, 'drink');
    assert.notEqual(first.type, 'recall');

    const scaled = new PlayerBotObservation();
    scaled.noteVitals(1000, 1000);
    scaled.noteVitals(40, 40);
    assert.equal(scaled.tookDamage, false);
    scaled.noteVitals(40, 100);
    assert.equal(scaled.hp, 40);
    assert.equal(scaled.maxHp, 40);

    const hurt = new PlayerBotObservation();
    hurt.noteVitals(40, 40);
    hurt.noteVitals(16, 40);
    assert.equal(hurt.tookDamage, true);
    hurt.attackMode = true;
    hurt.noteItems([{ id: 164, name: 'Big Red Potion', consumable: true }]);
    hurt.noteBag([{ uid: '164-stack', itemId: 164, quantity: 50 }]);
    const healer = new PlayerBotBrain();
    const drink = healer.decide(buildPlayerBotView(hurt, 'mage', true, false), nav);
    assert.equal(drink.type, 'drink');
    healer.noteDrink(hurt.hp);
    const locked = healer.decide(buildPlayerBotView(hurt, 'mage', true, true), nav);
    assert.notEqual(locked.type, 'drink');
    const stillLow = healer.decide(buildPlayerBotView(hurt, 'mage', true, false), nav);
    assert.notEqual(stillLow.type, 'drink');
    hurt.noteVitals(36, 40);
    const healed = healer.decide(buildPlayerBotView(hurt, 'mage', true, false), nav);
    assert.notEqual(healed.type, 'drink');
});

test('aresden walks to the farm gate and the farm walks south to the slime field', () => {
    const brain = new PlayerBotBrain();
    const nav = { isOpen: openGrid() };
    const city = brain.decide(viewAt({
        x: 100,
        y: 40,
        worldId: 'aresden',
        teleports: [{
            sources: [{ x: 279, y: 206 }, { x: 279, y: 205 }],
            targetWorldId: 'arefarm',
        }],
        monsters: [],
        potions: [],
    }), nav);
    assert.equal(city.type, 'move');
    if (city.type === 'move') {
        assert.ok(city.x > 100 || city.y > 40);
    }
    const goal = huntRouteGoal(viewAt({
        x: 100,
        y: 40,
        worldId: 'aresden',
        teleports: [],
    }));
    assert.deepEqual(goal, ARESDEN_FARM_GATE);

    const farm = brain.decide(viewAt({
        x: 23,
        y: 27,
        worldId: 'arefarm',
        monsters: [],
        potions: [],
    }), nav);
    assert.equal(farm.type, 'move');
    if (farm.type === 'move') {
        assert.ok(farm.x > 23 || farm.y > 27);
    }
    assert.deepEqual(huntRouteGoal(viewAt({ x: 23, y: 27, worldId: 'arefarm' })), FARM_SLIME_SOUTH);
    assert.equal(huntRouteGoal(viewAt({ x: FARM_SLIME_SOUTH.x, y: FARM_SLIME_SOUTH.y, worldId: 'arefarm' })), null);
});

test('mage without Fire Strike melees instead of waiting', () => {
    const brain = new PlayerBotBrain();
    const near = brain.decide(viewAt({
        fireStrikeSpellId: null,
        attackRangeCells: 1,
        monsters: [{ id: '2', name: 'Slime', sprite: 'slm', x: 11, y: 10, dead: false }],
    }), { isOpen: openGrid() });
    assert.deepEqual(near, { type: 'melee', monsterId: '2' });

    const far = brain.decide(viewAt({
        fireStrikeSpellId: null,
        x: 0,
        y: 0,
        monsters: [{ id: '2', name: 'Slime', sprite: 'slm', x: 8, y: 0, dead: false }],
    }), { isOpen: openGrid() });
    assert.equal(far.type, 'move');
});

test('playtest kit grants potions and Fire Strike, and PLAYTEST binds loopback', () => {
    const kit = readFileSync(new URL('../multiplayer/server/Helpers/PlaytestQaKit.cs', import.meta.url), 'utf8');
    assert.match(kit, /BigRedPotionItemId = 164/);
    assert.match(kit, /PotionQuantity = 20/);
    assert.match(kit, /FireStrikeOlympiaId = 30/);
    assert.match(kit, /LearnOlympiaSpell/);
    assert.match(kit, /IsBotActor/);
    assert.match(kit, /PLAYTEST=1 is refused/);
    const server = readFileSync(new URL('../multiplayer/server/Server.cs', import.meta.url), 'utf8');
    assert.match(server, /127\.0\.0\.1/);
    assert.match(server, /PlaytestQaKit\.IsEnabled/);
    assert.doesNotMatch(server, /PLAYTEST=1[\s\S]{0,80}0\.0\.0\.0/);
    const readme = readFileSync(new URL('./README.md', import.meta.url), 'utf8');
    assert.match(readme, /npm ci --ignore-scripts/);
    assert.match(readme, /experimental-websocket/);
    const simulator = readFileSync(new URL('./client-simulator.ts', import.meta.url), 'utf8');
    assert.match(simulator, /ensureGlobalWebSocket/);
    assert.match(simulator, /experimental-websocket/);
    const spawn = readFileSync(new URL('../multiplayer/server/Helpers/Spawn.cs', import.meta.url), 'utf8');
    assert.match(spawn, /PlaytestQaKit\.Apply/);
});

test('live wallet login is not weakened and eval stays outside the loop', () => {
    const validator = readFileSync(new URL('../multiplayer/server/Auth/WalletAuthValidator.cs', import.meta.url), 'utf8');
    assert.match(validator, /Wallet binding required before entering the world/);
    assert.match(validator, /WALLET_AUTH_SECRET is required in production/);
    assert.match(validator, /actorKind bot does not skip this check/);
});

test('bot sources do not import the post-run evaluator', () => {
    const files = [
        'client-simulator.ts',
        'player-bot-rules.ts',
        'player-bot-guard.ts',
        'player-bot-log.ts',
        'player-bot-score.ts',
    ];
    for (const fileName of files) {
        const source = readFileSync(new URL(`./${fileName}`, import.meta.url), 'utf8');
        assert.doesNotMatch(source, /from\s+['"]\.\/player-bot-eval/, fileName);
        assert.doesNotMatch(source, /import\s*\(\s*['"]\.\/player-bot-eval/, fileName);
    }
    const evaluator = readFileSync(new URL('./player-bot-eval.ts', import.meta.url), 'utf8');
    assert.match(evaluator, /must not be/);
    assert.match(evaluator, /player-bot-score/);
});
