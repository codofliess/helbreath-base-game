import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Direction } from './CoordinateUtils';
import {
    applyMovementKeyHold,
    createEmptyMovementKeys,
    directionFromMovementKeys,
    GAME_WORLD_ACTIVE_CLASS,
    getHeldWalkDirection,
    hasKeyboardWalkModifier,
    HELBREATH_GAME_ACTIVE_CLASS,
    installKeyboardWalkTracker,
    isArrowMovementKey,
    isGameWorldKeyboardActive,
    isKeyboardMovementKey,
    isLiveTypingSurface,
    isStrayKeyboardTarget,
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

    it('keeps walk armed when only scene-owned game-world-active remains', () => {
        const worldOnly = { contains: (token: string) => token === GAME_WORLD_ACTIVE_CLASS };
        const reactOnly = { contains: (token: string) => token === HELBREATH_GAME_ACTIVE_CLASS };
        const neither = { contains: () => false };
        assert.equal(isGameWorldKeyboardActive(worldOnly), true);
        assert.equal(isGameWorldKeyboardActive(reactOnly), true);
        assert.equal(isGameWorldKeyboardActive(neither), false);
        assert.equal(shouldAcceptKeyboardWalk({
            gameActive: isGameWorldKeyboardActive(worldOnly),
            typing: false,
            composeOpen: false,
            leftMouseDown: false,
        }), true);
    });

    it('ignores hidden / 0x0 / detached leftovers so post-discard WASD is not typing', () => {
        assert.equal(isLiveTypingSurface({ tagName: 'INPUT' }), true);
        assert.equal(isLiveTypingSurface({ tagName: 'INPUT', hidden: true }), false);
        assert.equal(isLiveTypingSurface({ tagName: 'INPUT', type: 'hidden' }), false);
        assert.equal(isLiveTypingSurface({ tagName: 'INPUT', isConnected: false }), false);
        assert.equal(isLiveTypingSurface({
            tagName: 'INPUT',
            getAttribute: (name: string) => (name === 'aria-hidden' ? 'true' : null),
        }), false);
        assert.equal(isLiveTypingSurface({
            tagName: 'INPUT',
            getBoundingClientRect: () => ({ width: 0, height: 0 }),
        }), false);
        assert.equal(isStrayKeyboardTarget({ tagName: 'INPUT', hidden: true }), true);
        assert.equal(isStrayKeyboardTarget({
            tagName: 'IFRAME',
            getBoundingClientRect: () => ({ width: 0, height: 0 }),
        }), true);
        assert.equal(isStrayKeyboardTarget({ tagName: 'INPUT' }), false);
        assert.equal(isStrayKeyboardTarget({ tagName: 'DIV' }), false);
        assert.equal(shouldAcceptKeyboardWalk({
            gameActive: true,
            typing: isLiveTypingSurface({ tagName: 'INPUT', type: 'hidden' }),
            composeOpen: false,
            leftMouseDown: false,
        }), true);
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
