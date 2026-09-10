import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Direction } from './CoordinateUtils';
import {
    applyMovementKeyHold,
    createEmptyMovementKeys,
    directionFromMovementKeys,
    getHeldWalkDirection,
    hasKeyboardWalkModifier,
    installKeyboardWalkTracker,
    isArrowMovementKey,
    isKeyboardMovementKey,
    isTypingTarget,
    KEYBOARD_WALK_CURSOR_PIXELS,
    KEYBOARD_WALK_LOOKAHEAD_CELLS,
    planKeyboardWalk,
    shouldAcceptKeyboardWalk,
} from './keyboardMovement';

describe('keyboardMovement', () => {
    it('maps physical WASD and arrows, including 8-dir chords', () => {
        const bits = createEmptyMovementKeys();
        assert.equal(applyMovementKeyHold(bits, 'KeyW', 'w', true), true);
        assert.equal(directionFromMovementKeys(bits), Direction.North);
        applyMovementKeyHold(bits, 'KeyD', 'd', true);
        assert.equal(directionFromMovementKeys(bits), Direction.NorthEast);
        applyMovementKeyHold(bits, 'KeyW', 'w', false);
        assert.equal(directionFromMovementKeys(bits), Direction.East);
        applyMovementKeyHold(bits, 'KeyD', 'd', false);
        applyMovementKeyHold(bits, 'ArrowLeft', 'ArrowLeft', true);
        applyMovementKeyHold(bits, 'ArrowDown', 'ArrowDown', true);
        assert.equal(directionFromMovementKeys(bits), Direction.SouthWest);
        applyMovementKeyHold(bits, 'KeyW', 'w', true);
        applyMovementKeyHold(bits, 'KeyS', 's', true);
        applyMovementKeyHold(bits, 'ArrowLeft', 'ArrowLeft', false);
        applyMovementKeyHold(bits, 'ArrowDown', 'ArrowDown', false);
        assert.equal(directionFromMovementKeys(bits), Direction.None);
    });

    it('prefers KeyW over key letter so AZERTY still walks on the WASD cluster', () => {
        const bits = createEmptyMovementKeys();
        assert.equal(isKeyboardMovementKey('KeyW', 'z'), true);
        applyMovementKeyHold(bits, 'KeyW', 'z', true);
        assert.equal(directionFromMovementKeys(bits), Direction.North);
    });

    it('ignores non-move keys and modifier chords', () => {
        const bits = createEmptyMovementKeys();
        assert.equal(applyMovementKeyHold(bits, 'KeyF', 'f', true), false);
        assert.equal(directionFromMovementKeys(bits), Direction.None);
        assert.equal(hasKeyboardWalkModifier({ ctrlKey: true }), true);
        assert.equal(hasKeyboardWalkModifier({ altKey: true }), true);
        assert.equal(hasKeyboardWalkModifier({ metaKey: true }), true);
        assert.equal(hasKeyboardWalkModifier({ ctrlKey: false, altKey: false, metaKey: false }), false);
        assert.equal(isArrowMovementKey('ArrowUp', 'ArrowUp'), true);
        assert.equal(isArrowMovementKey('KeyW', 'w'), false);
    });

    it('refuses walk while typing, chatting, click-kiting, or outside the world', () => {
        assert.equal(isTypingTarget({ tagName: 'INPUT' }), true);
        assert.equal(isTypingTarget({ tagName: 'TEXTAREA' }), true);
        assert.equal(isTypingTarget({ tagName: 'DIV', isContentEditable: true }), true);
        assert.equal(isTypingTarget({ tagName: 'DIV' }), false);
        assert.equal(shouldAcceptKeyboardWalk({
            gameActive: true,
            typing: false,
            composeOpen: false,
            leftMouseDown: false,
        }), true);
        assert.equal(shouldAcceptKeyboardWalk({
            gameActive: false,
            typing: false,
            composeOpen: false,
            leftMouseDown: false,
        }), false);
        assert.equal(shouldAcceptKeyboardWalk({
            gameActive: true,
            typing: true,
            composeOpen: false,
            leftMouseDown: false,
        }), false);
        assert.equal(shouldAcceptKeyboardWalk({
            gameActive: true,
            typing: false,
            composeOpen: true,
            leftMouseDown: false,
        }), false);
        assert.equal(shouldAcceptKeyboardWalk({
            gameActive: true,
            typing: false,
            composeOpen: false,
            leftMouseDown: true,
        }), false);
    });

    it('boot tracker is idempotent and starts with no held chord', () => {
        assert.equal(getHeldWalkDirection(), Direction.None);
        installKeyboardWalkTracker();
        installKeyboardWalkTracker();
        assert.equal(getHeldWalkDirection(), Direction.None);
    });

    it('plans a direct-mode destination ahead of the player without starting a Magias ritual', () => {
        const plan = planKeyboardWalk(10, 20, Direction.West, 320, 640);
        assert.ok(plan);
        assert.equal(plan.destX, 10 - KEYBOARD_WALK_LOOKAHEAD_CELLS);
        assert.equal(plan.destY, 20);
        assert.equal(plan.cursorPixelX, 320 - KEYBOARD_WALK_CURSOR_PIXELS);
        assert.equal(plan.cursorPixelY, 640);
        assert.equal(planKeyboardWalk(10, 20, Direction.None, 320, 640), undefined);
    });
});
