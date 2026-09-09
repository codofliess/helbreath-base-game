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
    generateTexture?: (...args: unknown[]) => unknown;
};

type GuardedFn = { __hbWorldCanvasGuard?: boolean };

type SealedPoolContainer = CanvasPoolContainer & { __hbWorldSlotSealed?: boolean };

type SizeLockedCanvas = WorldCanvasLike & { __hbWorldCanvasSizeLock?: boolean };

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

/**
 * Phaser `first()` treats any falsy parent as free. The inner `create` closes
 * over that `first` — wrapping `pool.create` is not enough if a caller still
 * holds the original `create` / `create2D`. Seal the world slot so parent
 * cannot be nulled or reparented onto Text / TextureManager.
 */
export function sealWorldCanvasPoolSlot(pool: WorldCanvasPoolApi): void {
    const world = guardState.worldCanvas;
    if (!world) {
        return;
    }
    let container = pool.pool.find((row) => row.canvas === world) as SealedPoolContainer | undefined;
    if (!container) {
        container = {
            parent: guardState.worldParent ?? WORLD_SLOT_SENTINEL,
            canvas: world,
        };
        pool.pool.push(container);
    }
    if (container.__hbWorldSlotSealed) {
        if (!container.parent) {
            container.parent = guardState.worldParent ?? WORLD_SLOT_SENTINEL;
        }
        return;
    }
    let parent = container.parent || guardState.worldParent || WORLD_SLOT_SENTINEL;
    Object.defineProperty(container, 'parent', {
        configurable: true,
        enumerable: true,
        get() {
            return parent || guardState.worldParent || WORLD_SLOT_SENTINEL;
        },
        set(next: unknown) {
            if (next == null) {
                parent = guardState.worldParent || WORLD_SLOT_SENTINEL;
                return;
            }
            if (
                next !== guardState.worldParent
                && next !== guardState.worldCanvas
                && next !== WORLD_SLOT_SENTINEL
            ) {
                return;
            }
            parent = next;
        },
    });
    container.__hbWorldSlotSealed = true;
}

/** Keep the world slot occupied so `create` will not reuse `game.canvas`. */
export function occupyWorldCanvasPoolSlot(pool: WorldCanvasPoolApi): void {
    const world = guardState.worldCanvas;
    if (!world) {
        return;
    }
    sealWorldCanvasPoolSlot(pool);
    for (const container of pool.pool) {
        // Phaser `first()` treats any falsy parent as free.
        if (container.canvas === world && !container.parent) {
            container.parent = guardState.worldParent ?? WORLD_SLOT_SENTINEL;
        }
    }
}

/**
 * HTMLCanvasElement: assigning `width`/`height` clears pixels even when the
 * value is unchanged (Scale.refresh / F7 book close). Pool `remove` writes 1×1.
 * Refuse those writes so select/prepare cannot wipe the live FOV buffer.
 */
export function lockWorldCanvasPresentationSize(canvas: WorldCanvasLike | undefined): void {
    if (!canvas || (canvas as SizeLockedCanvas).__hbWorldCanvasSizeLock) {
        return;
    }
    const proto = Object.getPrototypeOf(canvas) as object | undefined;
    const widthDesc = Object.getOwnPropertyDescriptor(canvas, 'width')
        ?? (proto ? Object.getOwnPropertyDescriptor(proto, 'width') : undefined);
    const heightDesc = Object.getOwnPropertyDescriptor(canvas, 'height')
        ?? (proto ? Object.getOwnPropertyDescriptor(proto, 'height') : undefined);

    let width = canvas.width;
    let height = canvas.height;
    const nativeGetWidth = widthDesc?.get?.bind(canvas);
    const nativeSetWidth = widthDesc?.set?.bind(canvas);
    const nativeGetHeight = heightDesc?.get?.bind(canvas);
    const nativeSetHeight = heightDesc?.set?.bind(canvas);

    Object.defineProperty(canvas, 'width', {
        configurable: true,
        enumerable: true,
        get() {
            return nativeGetWidth ? nativeGetWidth() : width;
        },
        set(next: number) {
            const n = Number(next);
            const current = nativeGetWidth ? nativeGetWidth() : width;
            if (!Number.isFinite(n) || n <= 1 || n === current) {
                return;
            }
            width = n;
            nativeSetWidth?.(n);
        },
    });
    Object.defineProperty(canvas, 'height', {
        configurable: true,
        enumerable: true,
        get() {
            return nativeGetHeight ? nativeGetHeight() : height;
        },
        set(next: number) {
            const n = Number(next);
            const current = nativeGetHeight ? nativeGetHeight() : height;
            if (!Number.isFinite(n) || n <= 1 || n === current) {
                return;
            }
            height = n;
            nativeSetHeight?.(n);
        },
    });
    (canvas as SizeLockedCanvas).__hbWorldCanvasSizeLock = true;
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
    if (!pool.create2D || isGuarded(pool.create2D)) {
        return;
    }
    // Phaser 3.90 create2D closes over the *inner* create — replacing
    // pool.create does not protect TextStyle / createCanvas / DynamicTexture.
    const wrapped = function (
        this: WorldCanvasPoolApi,
        parent?: unknown,
        width?: number,
        height?: number,
    ): WorldCanvasLike {
        return pool.create(parent, width ?? 1, height ?? 1);
    };
    markGuarded(wrapped);
    pool.create2D = wrapped;
}

function wrapCreateWebGL(pool: WorldCanvasPoolApi): void {
    if (!pool.createWebGL || isGuarded(pool.createWebGL)) {
        return;
    }
    const wrapped = function (
        this: WorldCanvasPoolApi,
        parent?: unknown,
        width?: number,
        height?: number,
    ): WorldCanvasLike {
        return pool.create(parent, width ?? 1, height ?? 1);
    };
    markGuarded(wrapped);
    pool.createWebGL = wrapped;
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
    lockWorldCanvasPresentationSize(worldCanvas);
    occupyWorldCanvasPoolSlot(pool);
    wrapCreate(pool, pool.create.bind(pool));
    wrapCreate2D(pool);
    wrapCreateWebGL(pool);
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
 * `generateTexture` snapshots the live renderer (`game.canvas`). Later blit
 * of that key blacks the map. Soft-cast confirm must not take that snapshot.
 */
export function refuseWorldCanvasGenerateTexture(textures: TextureBindApi | undefined): void {
    if (!textures?.generateTexture || isGuarded(textures.generateTexture)) {
        return;
    }
    const wrapped = function (..._args: unknown[]): boolean {
        return false;
    };
    markGuarded(wrapped);
    textures.generateTexture = wrapped;
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
    lockWorldCanvasPresentationSize(game.canvas);
    if (pool) {
        protectWorldCanvasInPool(pool, game.canvas, game);
    }
    refuseWorldCanvasTextureBind(game.textures, game.canvas);
    refuseWorldCanvasGenerateTexture(game.textures);
}

/** Snapshot → run → restore if Magias confirm/select stole the FOV buffer. */
export function withWorldCanvasBoxGuard<T>(
    canvas: WorldCanvasLike | undefined,
    fn: () => T,
): T {
    const box = snapshotWorldCanvasBox(canvas);
    try {
        return fn();
    } finally {
        restoreWorldCanvasBoxIfStolen(canvas, box);
    }
}
