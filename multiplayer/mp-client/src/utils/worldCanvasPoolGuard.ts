/**
 * Phaser 3.90 `CanvasPool` holds the live presentation canvas
 * (`CanvasPool.create(game, w, h)` in CreateRenderer).
 *
 * `CanvasPool.remove(parent)` 1×1s every container whose `canvas === parent`
 * or `parent === parent`. `CanvasTexture.destroy` → `remove(this.canvas)`
 * therefore 1×1s `game.canvas` when any texture was aliased to it.
 * The next `create` / `create2D` (Phaser Text, TextStyle, createCanvas)
 * reuses that freed slot and resizes the world again.
 *
 * PRs #67–#70 disabled known callers (fogata, announce Text, Cast appearance)
 * but never wrapped the pool. Elon Chile: Missile *select* still blacks the
 * map with fogata off — a leftover pool steal, not the circle spawn.
 */

export type WorldCanvasLike = {
    width: number;
    height: number;
    getContext?: (type: string, attrs?: unknown) => unknown;
};

export type WorldCanvasBox = {
    width: number;
    height: number;
};

export type CanvasPoolContainer = {
    parent: unknown;
    canvas: WorldCanvasLike | null;
};

export type WorldCanvasPoolApi = {
    pool: CanvasPoolContainer[];
    create: (...args: unknown[]) => WorldCanvasLike;
    create2D?: (...args: unknown[]) => { canvas?: WorldCanvasLike } | unknown;
    createWebGL?: (...args: unknown[]) => unknown;
    remove: (parent: unknown) => void;
};

export type TextureBindApi = {
    addCanvas?: (key: string, source: unknown, ...rest: unknown[]) => unknown;
};

type GuardedFn = { __hbWorldCanvasGuard?: boolean };

const WORLD_SLOT_SENTINEL = { hbWorldCanvasSlot: true };

const guardState: {
    worldCanvas: WorldCanvasLike | undefined;
    worldParent: unknown;
} = {
    worldCanvas: undefined,
    worldParent: undefined,
};

function isGuarded<T extends object>(fn: T): boolean {
    return Boolean((fn as T & GuardedFn).__hbWorldCanvasGuard);
}

function markGuarded<T extends object>(fn: T): T {
    (fn as T & GuardedFn).__hbWorldCanvasGuard = true;
    return fn;
}

function isProtectedTarget(parent: unknown): boolean {
    return parent != null
        && (parent === guardState.worldCanvas || parent === guardState.worldParent);
}

function isWorldContainer(container: CanvasPoolContainer): boolean {
    return container.canvas != null && container.canvas === guardState.worldCanvas;
}

/** Keep the world slot occupied so `create` will not reuse `game.canvas`. */
export function occupyWorldCanvasPoolSlot(pool: WorldCanvasPoolApi): void {
    const world = guardState.worldCanvas;
    if (!world) {
        return;
    }
    for (const container of pool.pool) {
        if (container.canvas === world && container.parent == null) {
            container.parent = guardState.worldParent ?? WORLD_SLOT_SENTINEL;
        }
    }
}

export function createDetachedCanvas(width: number, height: number): WorldCanvasLike {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        return canvas;
    }
    return { width: w, height: h };
}

export function snapshotWorldCanvasBox(
    canvas: WorldCanvasLike | undefined,
): WorldCanvasBox | undefined {
    if (!canvas) {
        return undefined;
    }
    return { width: canvas.width, height: canvas.height };
}

/**
 * Re-assert the presentation buffer size after a steal. Assigning width/height
 * clears pixels; the next Phaser frame must repaint. Prefer preventing the steal.
 */
export function restoreWorldCanvasBoxIfStolen(
    canvas: WorldCanvasLike | undefined,
    box: WorldCanvasBox | undefined,
): boolean {
    if (!canvas || !box) {
        return false;
    }
    if (canvas.width === box.width && canvas.height === box.height) {
        return false;
    }
    canvas.width = box.width;
    canvas.height = box.height;
    return true;
}

function wrapCreate(pool: WorldCanvasPoolApi, original: WorldCanvasPoolApi['create']): void {
    if (isGuarded(pool.create)) {
        return;
    }
    const wrapped = function (this: WorldCanvasPoolApi, ...args: unknown[]): WorldCanvasLike {
        occupyWorldCanvasPoolSlot(pool);
        const box = snapshotWorldCanvasBox(guardState.worldCanvas);
        const created = original.apply(this, args);
        const stoleSize = restoreWorldCanvasBoxIfStolen(guardState.worldCanvas, box);
        if (stoleSize || created === guardState.worldCanvas) {
            occupyWorldCanvasPoolSlot(pool);
            const width = typeof args[1] === 'number' ? args[1] : 1;
            const height = typeof args[2] === 'number' ? args[2] : 1;
            return createDetachedCanvas(width, height);
        }
        return created;
    };
    markGuarded(wrapped);
    pool.create = wrapped;
}

function wrapCreate2D(pool: WorldCanvasPoolApi): void {
    const original = pool.create2D;
    if (!original || isGuarded(pool.create2D)) {
        return;
    }
    const wrapped = function (this: WorldCanvasPoolApi, ...args: unknown[]): unknown {
        occupyWorldCanvasPoolSlot(pool);
        const box = snapshotWorldCanvasBox(guardState.worldCanvas);
        const ctx = original.apply(this, args);
        restoreWorldCanvasBoxIfStolen(guardState.worldCanvas, box);
        const ctxCanvas = ctx && typeof ctx === 'object' && 'canvas' in ctx
            ? (ctx as { canvas?: WorldCanvasLike }).canvas
            : undefined;
        if (ctxCanvas === guardState.worldCanvas) {
            occupyWorldCanvasPoolSlot(pool);
            const width = typeof args[1] === 'number' ? args[1] : 1;
            const height = typeof args[2] === 'number' ? args[2] : 1;
            const fallback = createDetachedCanvas(width, height);
            if (typeof fallback.getContext === 'function') {
                return fallback.getContext('2d') ?? { canvas: fallback };
            }
            return { canvas: fallback };
        }
        return ctx;
    };
    markGuarded(wrapped);
    pool.create2D = wrapped;
}

function wrapRemove(pool: WorldCanvasPoolApi, original: WorldCanvasPoolApi['remove']): void {
    if (isGuarded(pool.remove)) {
        return;
    }
    const wrapped = function (this: WorldCanvasPoolApi, parent: unknown): void {
        if (isProtectedTarget(parent)) {
            occupyWorldCanvasPoolSlot(pool);
            return;
        }
        for (const container of pool.pool) {
            if (isWorldContainer(container)) {
                continue;
            }
            if (container.canvas === parent || container.parent === parent) {
                container.parent = null;
                if (container.canvas) {
                    container.canvas.width = 1;
                    container.canvas.height = 1;
                }
            }
        }
    };
    markGuarded(wrapped);
    pool.remove = wrapped;
}

/**
 * Wrap a Phaser-style CanvasPool so `game.canvas` is never 1×1'd or reused.
 * Safe to call more than once; later calls retarget the protected canvas.
 */
export function protectWorldCanvasInPool(
    pool: WorldCanvasPoolApi,
    worldCanvas: WorldCanvasLike,
    worldParent?: unknown,
): void {
    guardState.worldCanvas = worldCanvas;
    guardState.worldParent = worldParent;
    occupyWorldCanvasPoolSlot(pool);
    wrapCreate(pool, pool.create.bind(pool));
    wrapCreate2D(pool);
    wrapRemove(pool, pool.remove.bind(pool));
}

/**
 * `textures.addCanvas(key, game.canvas)` builds a CanvasTexture on the live
 * world surface (`getContext` / `setSize` / later `CanvasPool.remove`).
 * Rebind to an isolated 1×1 instead.
 */
export function refuseWorldCanvasTextureBind(
    textures: TextureBindApi | undefined,
    worldCanvas: unknown,
): void {
    if (!textures?.addCanvas || isGuarded(textures.addCanvas)) {
        return;
    }
    const original = textures.addCanvas.bind(textures);
    const wrapped = function (key: string, source: unknown, ...rest: unknown[]): unknown {
        if (source != null && source === guardState.worldCanvas) {
            return original(key, createDetachedCanvas(1, 1), ...rest);
        }
        if (source != null && source === worldCanvas) {
            return original(key, createDetachedCanvas(1, 1), ...rest);
        }
        return original(key, source, ...rest);
    };
    markGuarded(wrapped);
    textures.addCanvas = wrapped;
}

/**
 * Point the global pool + TextureManager at this game's presentation canvas.
 * `pool` is required the first time (Phaser.Display.Canvas.CanvasPool).
 */
export function attachWorldCanvasPoolGuard(
    game: { canvas?: WorldCanvasLike; textures?: TextureBindApi },
    pool?: WorldCanvasPoolApi,
): void {
    if (!game.canvas) {
        return;
    }
    if (pool) {
        protectWorldCanvasInPool(pool, game.canvas, game);
    }
    refuseWorldCanvasTextureBind(game.textures, game.canvas);
}
