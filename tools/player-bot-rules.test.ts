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
    PlayerBotBrain,
    PlayerBotObservation,
    buildPlayerBotView,
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
    const drink = brain.decide(viewAt({ hp: 40, maxHp: 100 }), { isOpen: openGrid() });
    assert.equal(drink.type, 'drink');

    const recall = brain.decide(viewAt({
        hp: 10,
        maxHp: 100,
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
        potions: [],
        monsters: slime,
    }), { isOpen: openGrid() });
    assert.equal(retreat.type, 'recall');
    brain.noteTown(0);
    const again = brain.decide(viewAt({
        hp: 40,
        maxHp: 100,
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
