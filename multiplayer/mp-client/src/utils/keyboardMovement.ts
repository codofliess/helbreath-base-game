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

/** Scene-owned: GameWorld.create sets this. Survives React effect re-subscribe. */
export const GAME_WORLD_ACTIVE_CLASS = 'game-world-active';
/** React/F-key class. PhaserGame used to strip this on effect cleanup and kill WASD. */
export const HELBREATH_GAME_ACTIVE_CLASS = 'helbreath-game-active';

export type KeyboardFocusProbe = {
    tagName?: string;
    isContentEditable?: boolean;
    hidden?: boolean;
    disabled?: boolean;
    type?: string;
    isConnected?: boolean;
    getAttribute?: (name: string) => string | null;
    getBoundingClientRect?: () => { width: number; height: number; top?: number; left?: number; bottom?: number; right?: number };
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

export function isGameWorldKeyboardActive(
    classList?: { contains: (token: string) => boolean } | null,
): boolean {
    const list = classList ?? (typeof document !== 'undefined' ? document.body.classList : null);
    if (!list) {
        return false;
    }
    return list.contains(GAME_WORLD_ACTIVE_CLASS) || list.contains(HELBREATH_GAME_ACTIVE_CLASS);
}

/**
 * Phantom / Chrome-restore leftovers are often `type=hidden`, 0×0, or detached.
 * Those must not count as "typing" or bare WASD dies without a canvas click.
 */
export function isVisiblyInteractive(active: KeyboardFocusProbe | null): boolean {
    if (!active) {
        return false;
    }
    if (active.isConnected === false || active.hidden === true || active.disabled === true) {
        return false;
    }
    if ((active.type ?? '').toLowerCase() === 'hidden') {
        return false;
    }
    if (active.getAttribute?.('aria-hidden') === 'true') {
        return false;
    }
    if (typeof active.getBoundingClientRect !== 'function') {
        return true;
    }
    const rect = active.getBoundingClientRect();
    if (rect.width < 2 && rect.height < 2) {
        return false;
    }
    if (typeof window !== 'undefined') {
        const viewW = window.innerWidth || 0;
        const viewH = window.innerHeight || 0;
        const top = rect.top ?? 0;
        const left = rect.left ?? 0;
        const bottom = rect.bottom ?? top + rect.height;
        const right = rect.right ?? left + rect.width;
        if (viewW > 0 && viewH > 0 && (bottom < 0 || right < 0 || top > viewH || left > viewW)) {
            return false;
        }
        try {
            const style = window.getComputedStyle?.(active as Element);
            if (style && (style.display === 'none' || style.visibility === 'hidden')) {
                return false;
            }
        } catch {
            // jsdom / constructor-free probes
        }
    }
    return true;
}

/** Visible chat / bag / dialog fields only. Hidden wallet leftovers do not block walk. */
export function isLiveTypingSurface(active: KeyboardFocusProbe | null): boolean {
    return isTypingTarget(active) && isVisiblyInteractive(active);
}

/** Focus that swallows keys after tab discard but is not a real compose field. */
export function isStrayKeyboardTarget(active: KeyboardFocusProbe | null): boolean {
    if (!active) {
        return false;
    }
    if (active.tagName?.toUpperCase() === 'IFRAME' && !isVisiblyInteractive(active)) {
        return true;
    }
    return isTypingTarget(active) && !isLiveTypingSurface(active);
}

/** Blur Phantom / restore leftovers so the next WASD reaches the boot tracker. */
export function blurStrayKeyboardTargets(): void {
    if (typeof document === 'undefined') {
        return;
    }
    const active = document.activeElement;
    if (!isStrayKeyboardTarget(active) || !(active instanceof HTMLElement)) {
        return;
    }
    active.blur();
}

/**
 * After Chrome discard → reload → wallet reconnect, React may have dropped
 * `helbreath-game-active` while GameWorld left `game-world-active` on.
 * Put the React class back so F-keys and older gates match the scene.
 */
export function syncHelbreathGameActiveClass(
    classList?: { contains: (token: string) => boolean; add: (token: string) => void },
): boolean {
    const list = classList ?? (
        typeof document !== 'undefined' ? document.body?.classList : undefined
    );
    if (!list || !list.contains(GAME_WORLD_ACTIVE_CLASS) || list.contains(HELBREATH_GAME_ACTIVE_CLASS)) {
        return false;
    }
    list.add(HELBREATH_GAME_ACTIVE_CLASS);
    return true;
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
 * Click-kite (LMB held) stays the overlay path. Chat compose / live typing
 * must not walk. A focused tab is enough — canvas focus is not required.
 * `gameActive` should be {@link isGameWorldKeyboardActive} so a React
 * `helbreath-game-active` miss after discard/reload cannot freeze feet.
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
    if (hasKeyboardWalkModifier(event) || isLiveTypingSurface(document.activeElement)) {
        return;
    }
    if (!applyMovementKeyHold(globalMovementKeys, event.code, event.key, true)) {
        return;
    }
    if (isArrowMovementKey(event.code, event.key) && isGameWorldKeyboardActive()) {
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
    if (typeof document === 'undefined') {
        return;
    }
    if (document.visibilityState === 'hidden') {
        onGlobalWalkBlur();
        return;
    }
    rearmKeyboardWalkAfterResume();
}

function onGlobalWalkPageShow(): void {
    rearmKeyboardWalkAfterResume();
}

/**
 * Arm WASD tracking at boot so a hold through login → enter-world is not
 * lost (GameWorld `InputManager.setup` is too late for that race).
 * Idempotent. Document capture so a leftover focused input cannot swallow
 * the bubble; does not stop Magias / F-keys.
 */
export function installKeyboardWalkTracker(): void {
    if (walkTrackerInstalled || typeof window === 'undefined') {
        return;
    }
    walkTrackerInstalled = true;
    document.addEventListener('keydown', onGlobalWalkKeyDown, true);
    document.addEventListener('keyup', onGlobalWalkKeyUp, true);
    window.addEventListener('keydown', onGlobalWalkKeyDown);
    window.addEventListener('keyup', onGlobalWalkKeyUp);
    window.addEventListener('blur', onGlobalWalkBlur);
    window.addEventListener('pageshow', onGlobalWalkPageShow);
    document.addEventListener('visibilitychange', onGlobalWalkVisibility);
}

/**
 * Primary recover path after Chrome discard / reconnect / wallet unpark:
 * tracker on, stale chord cleared, Phantom leftovers blurred, scene class synced.
 * Does not require a canvas click.
 */
export function rearmKeyboardWalkAfterResume(): void {
    installKeyboardWalkTracker();
    globalMovementKeys.clear();
    blurStrayKeyboardTargets();
    syncHelbreathGameActiveClass();
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
