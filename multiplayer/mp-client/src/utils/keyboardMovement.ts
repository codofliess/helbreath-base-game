import { Direction, getDirectionOffset } from './CoordinateUtils';
import { TILE_SIZE } from '../constants/TileSize';

/** How many cells ahead a held WASD / arrow chord aims. Release cancels after the current step. */
export const KEYBOARD_WALK_LOOKAHEAD_CELLS = 8;

/** Synthetic cursor offset so direct-mode sector math matches the held chord. */
export const KEYBOARD_WALK_CURSOR_PIXELS = TILE_SIZE * 2;

export type MovementKeyAxis = 'north' | 'south' | 'west' | 'east';

/** One token per physical key so W and ArrowUp do not share a latch. */
export type MovementKeyHold = Set<string>;

export type KeyboardWalkPlan = {
    destX: number;
    destY: number;
    cursorPixelX: number;
    cursorPixelY: number;
};

/**
 * Chat / bag name fields must not steer the avatar. Tag-name check stays
 * DOM-constructor-free so unit tests can run under `tsx`.
 */
export function isTypingTarget(active: { tagName?: string; isContentEditable?: boolean } | null): boolean {
    if (!active) {
        return false;
    }
    const tag = active.tagName?.toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return true;
    }
    return active.isContentEditable === true;
}

export function createEmptyMovementKeys(): MovementKeyHold {
    return new Set();
}

function movementToken(code?: string, key?: string): string | undefined {
    const axis = movementKeyAxis(code, key);
    if (!axis) {
        return undefined;
    }
    return `${axis}:${code || (key ?? '').toLowerCase()}`;
}

/**
 * Physical WASD (`KeyW`…) plus arrows. `code` wins so AZERTY still walks on
 * the WASD cluster; `key` is the fallback when `code` is empty.
 */
export function movementKeyAxis(code?: string, key?: string): MovementKeyAxis | undefined {
    switch (code) {
        case 'KeyW':
        case 'ArrowUp':
            return 'north';
        case 'KeyS':
        case 'ArrowDown':
            return 'south';
        case 'KeyA':
        case 'ArrowLeft':
            return 'west';
        case 'KeyD':
        case 'ArrowRight':
            return 'east';
        default:
            break;
    }
    switch ((key ?? '').toLowerCase()) {
        case 'w':
        case 'arrowup':
            return 'north';
        case 's':
        case 'arrowdown':
            return 'south';
        case 'a':
        case 'arrowleft':
            return 'west';
        case 'd':
        case 'arrowright':
            return 'east';
        default:
            return undefined;
    }
}

export function isKeyboardMovementKey(code?: string, key?: string): boolean {
    return movementKeyAxis(code, key) !== undefined;
}

export function isArrowMovementKey(code?: string, key?: string): boolean {
    return (
        code === 'ArrowUp'
        || code === 'ArrowDown'
        || code === 'ArrowLeft'
        || code === 'ArrowRight'
        || key === 'ArrowUp'
        || key === 'ArrowDown'
        || key === 'ArrowLeft'
        || key === 'ArrowRight'
    );
}

/** Ctrl/Alt/Meta chords are SysMenu / browser shortcuts — never walk. */
export function hasKeyboardWalkModifier(e: { ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean }): boolean {
    return Boolean(e.ctrlKey || e.altKey || e.metaKey);
}

export function applyMovementKeyHold(
    held: MovementKeyHold,
    code: string | undefined,
    key: string | undefined,
    down: boolean,
): boolean {
    const token = movementToken(code, key);
    if (!token) {
        return false;
    }
    if (down) {
        held.add(token);
    } else {
        held.delete(token);
    }
    return true;
}

export function directionFromMovementKeys(held: MovementKeyHold): Direction {
    let north = false;
    let south = false;
    let west = false;
    let east = false;
    for (const token of held) {
        const axis = token.slice(0, token.indexOf(':')) as MovementKeyAxis;
        switch (axis) {
            case 'north':
                north = true;
                break;
            case 'south':
                south = true;
                break;
            case 'west':
                west = true;
                break;
            case 'east':
                east = true;
                break;
            default:
                break;
        }
    }
    const dx = (east ? 1 : 0) - (west ? 1 : 0);
    const dy = (south ? 1 : 0) - (north ? 1 : 0);
    if (dx === 0 && dy === 0) {
        return Direction.None;
    }
    if (dx === 0) {
        return dy < 0 ? Direction.North : Direction.South;
    }
    if (dy === 0) {
        return dx < 0 ? Direction.West : Direction.East;
    }
    if (dx < 0) {
        return dy < 0 ? Direction.NorthWest : Direction.SouthWest;
    }
    return dy < 0 ? Direction.NorthEast : Direction.SouthEast;
}

/**
 * Click-kite (LMB held) stays the overlay path. Chat compose / typing must
 * not walk. A focused tab is enough — canvas focus is not required.
 */
export function shouldAcceptKeyboardWalk(opts: {
    gameActive: boolean;
    typing: boolean;
    composeOpen: boolean;
    leftMouseDown: boolean;
}): boolean {
    return opts.gameActive && !opts.typing && !opts.composeOpen && !opts.leftMouseDown;
}

let walkTrackerInstalled = false;
const globalMovementKeys: MovementKeyHold = createEmptyMovementKeys();

function onGlobalWalkKeyDown(event: KeyboardEvent): void {
    if (hasKeyboardWalkModifier(event) || isTypingTarget(document.activeElement)) {
        return;
    }
    if (!applyMovementKeyHold(globalMovementKeys, event.code, event.key, true)) {
        return;
    }
    if (
        isArrowMovementKey(event.code, event.key)
        && typeof document !== 'undefined'
        && document.body.classList.contains('helbreath-game-active')
    ) {
        event.preventDefault();
    }
}

function onGlobalWalkKeyUp(event: KeyboardEvent): void {
    applyMovementKeyHold(globalMovementKeys, event.code, event.key, false);
}

function onGlobalWalkBlur(): void {
    globalMovementKeys.clear();
}

function onGlobalWalkVisibility(): void {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        onGlobalWalkBlur();
    }
}

/**
 * Arm WASD tracking at boot so a hold through login → enter-world is not
 * lost (GameWorld `InputManager.setup` is too late for that race).
 * Idempotent. Bubble phase — does not swallow Magias / F-keys.
 */
export function installKeyboardWalkTracker(): void {
    if (walkTrackerInstalled || typeof window === 'undefined') {
        return;
    }
    walkTrackerInstalled = true;
    window.addEventListener('keydown', onGlobalWalkKeyDown);
    window.addEventListener('keyup', onGlobalWalkKeyUp);
    window.addEventListener('blur', onGlobalWalkBlur);
    document.addEventListener('visibilitychange', onGlobalWalkVisibility);
}

export function getHeldWalkDirection(): Direction {
    return directionFromMovementKeys(globalMovementKeys);
}

/** Maps a held chord to a direct-mode `setDestination` payload. */
export function planKeyboardWalk(
    worldX: number,
    worldY: number,
    direction: Direction,
    anchorPixelX: number,
    anchorPixelY: number,
    lookaheadCells: number = KEYBOARD_WALK_LOOKAHEAD_CELLS,
): KeyboardWalkPlan | undefined {
    if (direction === Direction.None) {
        return undefined;
    }
    const [dx, dy] = getDirectionOffset(direction);
    return {
        destX: worldX + dx * lookaheadCells,
        destY: worldY + dy * lookaheadCells,
        cursorPixelX: anchorPixelX + dx * KEYBOARD_WALK_CURSOR_PIXELS,
        cursorPixelY: anchorPixelY + dy * KEYBOARD_WALK_CURSOR_PIXELS,
    };
}
