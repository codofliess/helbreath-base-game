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
 * PRs #67–#71 disabled callers and wrapped pool.create/create2D/remove.
 * Elon Chile on live `CzMvjmi7`: bare Missile SELECT still blacks the map
 * (gauntlet CSS cursor only). Phaser's inner create/remove close over the
 * unwrapped functions; Scale.refresh / F7 book close assign `canvas.width`
 * (even a non-1×1 size clears pixels); `getContext('2d', attrs)` can reset
 * the renderer buffer. Lock size + getContext on *every* select/prepare path.
 * Move mid-prepare still restreams the map tileset (`createCanvas`) and can
 * setAttribute('width') — those bypass the IDL size setter. Lock both.
 *
 * #73 armed fillRect refuse / clearBeforeRender=false / FOV snapshot restore
 * on *select*. Bare Missile SELECT then restored an empty FOV (or skipped the
 * first Phaser paint) and Elon Chile went black. #74 moved those to WASD,
 * but still wrapped fillRect / assigned camera.transparent on idle move
 * (`DQVdzggt` full-black canvas). Those move rituals engage only after a
 * painted snapshot, on an actual WASD / click-to-move *during Magias prepare*.
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
    createCanvas?: (key: string, width?: number, height?: number, ...rest: unknown[]) => unknown;
};

type GuardedFn = { __hbWorldCanvasGuard?: boolean };

type SealedPoolContainer = CanvasPoolContainer & { __hbWorldSlotSealed?: boolean };

type SizeLockedCanvas = WorldCanvasLike & {
    __hbWorldCanvasSizeLock?: boolean;
    __hbWorldCanvasGetContextLock?: boolean;
    __hbWorldCanvasAttrLock?: boolean;
    setAttribute?: (name: string, value: string) => void;
};

type WorldCanvas2DContext = {
    fillRect?: (x: number, y: number, w: number, h: number) => void;
    clearRect?: (x: number, y: number, w: number, h: number) => void;
    reset?: () => void;
    getImageData?: (x: number, y: number, w: number, h: number) => unknown;
    putImageData?: (data: unknown, x: number, y: number) => void;
    __hbWorldCanvasClearLock?: boolean;
};

type PixelBackup = {
    width: number;
    height: number;
    data: unknown;
};

const WORLD_SLOT_SENTINEL = { hbWorldCanvasSlot: true };

type RendererLike = {
    gameContext?: WorldCanvas2DContext;
    context?: WorldCanvas2DContext;
    config?: { clearBeforeRender?: boolean };
};

type GameEventsLike = {
    on?: (event: string, fn: (...args: unknown[]) => void) => void;
    __hbWorldCanvasPostRenderRestore?: boolean;
};

type GameWithRenderer = {
    canvas?: WorldCanvasLike;
    textures?: TextureBindApi;
    renderer?: RendererLike;
    events?: GameEventsLike;
};

const guardState: {
    worldCanvas: WorldCanvasLike | undefined;
    worldParent: unknown;
    pool: WorldCanvasPoolApi | undefined;
    textures: TextureBindApi | undefined;
    renderer: RendererLike | undefined;
    events: GameEventsLike | undefined;
    pixelBackup: PixelBackup | undefined;
    refuseFullCanvasClear: boolean;
    clearBeforeRenderSaved: boolean | undefined;
} = {
    worldCanvas: undefined,
    worldParent: undefined,
    pool: undefined,
    textures: undefined,
    renderer: undefined,
    events: undefined,
    pixelBackup: undefined,
    refuseFullCanvasClear: false,
    clearBeforeRenderSaved: undefined,
};

/** Armed only after a painted move-during-prepare snapshot — not on bare select. */
export function setWorldCanvasClearRefused(refuse: boolean): void {
    guardState.refuseFullCanvasClear = refuse;
    if (refuse) {
        armWorldCanvasMoveDuringPrepareClear();
    }
    syncRendererClearBeforeRender();
}

export function isWorldCanvasClearRefused(): boolean {
    return guardState.refuseFullCanvasClear;
}

/**
 * Bind Phaser renderer refs for a later move-freeze. Does **not** wrap
 * fillRect / disable clearBeforeRender — that is idle-move #74 black.
 */
export function bindWorldCanvasRenderer(game?: GameWithRenderer): void {
    const canvas = game?.canvas ?? guardState.worldCanvas;
    if (canvas) {
        guardState.worldCanvas = canvas;
    }
    const renderer = game?.renderer ?? guardState.renderer;
    if (renderer) {
        guardState.renderer = renderer;
    }
    if (game?.events) {
        guardState.events = game.events;
    }
}

function armWorldCanvasMoveDuringPrepareClear(canvas?: WorldCanvasLike): void {
    const target = canvas ?? guardState.worldCanvas;
    if (target) {
        guardState.worldCanvas = target;
        lockWorldCanvasContextClear(
            target.getContext?.('2d') as WorldCanvas2DContext | undefined,
            target,
        );
    }
    const renderer = guardState.renderer;
    if (renderer && target) {
        lockWorldCanvasContextClear(renderer.gameContext, target);
        lockWorldCanvasContextClear(renderer.context, target);
    }
    ensureWorldCanvasPostRenderRestore();
}

function syncRendererClearBeforeRender(): void {
    const config = guardState.renderer?.config;
    if (!config) {
        return;
    }
    if (guardState.refuseFullCanvasClear) {
        if (guardState.clearBeforeRenderSaved === undefined) {
            guardState.clearBeforeRenderSaved = config.clearBeforeRender !== false;
        }
        config.clearBeforeRender = false;
        return;
    }
    if (guardState.clearBeforeRenderSaved !== undefined) {
        config.clearBeforeRender = guardState.clearBeforeRenderSaved;
        guardState.clearBeforeRenderSaved = undefined;
    }
}

/**
 * Phaser `CanvasRenderer.preRender` / camera `fillRect(#000)` hold
 * `renderer.gameContext` from boot. Wrap that object (not only a later
 * `canvas.getContext`) and disable `clearBeforeRender` while prepare is armed.
 * POST_RENDER blit is the safety net if a wipe still lands after update.
 * Call only after {@link setWorldCanvasClearRefused}(true) — not at attach.
 */
export function lockWorldCanvasRendererClear(game?: GameWithRenderer): void {
    bindWorldCanvasRenderer(game);
    if (guardState.refuseFullCanvasClear) {
        armWorldCanvasMoveDuringPrepareClear(game?.canvas ?? guardState.worldCanvas);
    }
    syncRendererClearBeforeRender();
    const events = game?.events;
    if (events) {
        ensureWorldCanvasPostRenderRestore(events);
    }
}

function ensureWorldCanvasPostRenderRestore(events?: GameEventsLike): void {
    const target = events ?? guardState.events;
    if (!target?.on || target.__hbWorldCanvasPostRenderRestore) {
        return;
    }
    target.on('postrender', () => {
        if (guardState.refuseFullCanvasClear) {
            restoreWorldCanvasPixels(guardState.worldCanvas);
        }
    });
    target.__hbWorldCanvasPostRenderRestore = true;
    guardState.events = target;
}

function isFullCanvasWipe(
    x: number,
    y: number,
    w: number,
    h: number,
    canvas: WorldCanvasLike,
): boolean {
    const cw = canvas.width;
    const ch = canvas.height;
    if (!(cw > 0 && ch > 0) || !(w > 0 && h > 0)) {
        return false;
    }
    // Phaser camera fill can be 1px inset from the IDL box and still black the FOV.
    return x <= 1 && y <= 1 && x + w >= cw - 1 && y + h >= ch - 1;
}

function lockWorldCanvasContextClear(
    ctx: WorldCanvas2DContext | undefined,
    canvas: WorldCanvasLike,
): void {
    if (!ctx || ctx.__hbWorldCanvasClearLock) {
        return;
    }
    if (typeof ctx.fillRect === 'function') {
        const nativeFill = ctx.fillRect.bind(ctx);
        ctx.fillRect = function (x: number, y: number, w: number, h: number): void {
            if (guardState.refuseFullCanvasClear && isFullCanvasWipe(x, y, w, h, canvas)) {
                return;
            }
            nativeFill(x, y, w, h);
        };
    }
    if (typeof ctx.clearRect === 'function') {
        const nativeClear = ctx.clearRect.bind(ctx);
        ctx.clearRect = function (x: number, y: number, w: number, h: number): void {
            if (guardState.refuseFullCanvasClear && isFullCanvasWipe(x, y, w, h, canvas)) {
                return;
            }
            nativeClear(x, y, w, h);
        };
    }
    if (typeof ctx.reset === 'function') {
        const nativeReset = ctx.reset.bind(ctx);
        ctx.reset = function (): void {
            if (guardState.refuseFullCanvasClear) {
                return;
            }
            nativeReset();
        };
    }
    ctx.__hbWorldCanvasClearLock = true;
}

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
 * HTMLCanvasElement: any `width`/`height` assignment clears pixels — pool
 * `remove` writes 1×1, Scale.refresh / F7 book close rewrite even a *different*
 * FOV size, and same-size assign wipes too. Refuse every write after lock.
 *
 * `getContext('2d', attrs)` can also reset the renderer buffer when attrs
 * differ from the first context (CanvasPool.create → Smoothing.disable).
 *
 * `setAttribute('width'|'height')` bypasses the IDL setter and still
 * clears pixels — Scale / restream can take that path without assigning
 * `.width`. Refuse those attribute writes after lock.
 */
export function lockWorldCanvasPresentationSize(canvas: WorldCanvasLike | undefined): void {
    if (!canvas) {
        return;
    }
    const locked = canvas as SizeLockedCanvas;
    if (!locked.__hbWorldCanvasAttrLock && typeof locked.setAttribute === 'function') {
        const nativeSetAttribute = locked.setAttribute.bind(locked);
        locked.setAttribute = function (name: string, value: string): void {
            const attr = String(name).toLowerCase();
            if (attr === 'width' || attr === 'height') {
                return;
            }
            nativeSetAttribute(name, value);
        };
        locked.__hbWorldCanvasAttrLock = true;
    }
    if (!locked.__hbWorldCanvasGetContextLock && typeof canvas.getContext === 'function') {
        const nativeGetContext = canvas.getContext.bind(canvas);
        canvas.getContext = function (type: string, _attrs?: unknown): unknown {
            const kind = String(type).toLowerCase();
            if (kind.startsWith('webgl') || kind === 'experimental-webgl') {
                return null;
            }
            const ctx = nativeGetContext(kind === '2d' ? '2d' : type);
            // Wrap fillRect only while the painted move-freeze is armed.
            // #73/#74 wrapped on every getContext and idle WASD went black.
            if (guardState.refuseFullCanvasClear) {
                lockWorldCanvasContextClear(ctx as WorldCanvas2DContext | undefined, canvas);
            }
            return ctx;
        };
        locked.__hbWorldCanvasGetContextLock = true;
    }
    if (locked.__hbWorldCanvasSizeLock) {
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
    const nativeGetHeight = heightDesc?.get?.bind(canvas);

    Object.defineProperty(canvas, 'width', {
        configurable: true,
        enumerable: true,
        get() {
            return nativeGetWidth ? nativeGetWidth() : width;
        },
        set() {
            // Refuse 1×1, same-size wipe, and Scale/F7 FOV rewrite.
        },
    });
    Object.defineProperty(canvas, 'height', {
        configurable: true,
        enumerable: true,
        get() {
            return nativeGetHeight ? nativeGetHeight() : height;
        },
        set() {
            // Refuse 1×1, same-size wipe, and Scale/F7 FOV rewrite.
        },
    });
    locked.__hbWorldCanvasSizeLock = true;
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
    guardState.pool = pool;
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
 * `textures.createCanvas` → CanvasPool.create2D. Walk restream rebuilds the
 * map tileset this way. If the inner create still hits `game.canvas`, the
 * world buffer is wiped without assigning `.width` on the guarded setter.
 */
export function refuseWorldCanvasCreateCanvas(textures: TextureBindApi | undefined): void {
    if (!textures?.createCanvas || isGuarded(textures.createCanvas)) {
        return;
    }
    const original = textures.createCanvas.bind(textures);
    const wrapped = function (key: string, width?: number, height?: number, ...rest: unknown[]): unknown {
        if (guardState.pool) {
            occupyWorldCanvasPoolSlot(guardState.pool);
        }
        const box = snapshotWorldCanvasBox(guardState.worldCanvas);
        const created = original(key, width, height, ...rest);
        restoreWorldCanvasBoxIfStolen(guardState.worldCanvas, box);
        return created;
    };
    markGuarded(wrapped);
    textures.createCanvas = wrapped;
}

/**
 * Point the global pool + TextureManager at this game's presentation canvas.
 * `pool` is required the first time (Phaser.Display.Canvas.CanvasPool).
 */
export function attachWorldCanvasPoolGuard(
    game: GameWithRenderer,
    pool?: WorldCanvasPoolApi,
): void {
    if (!game.canvas) {
        return;
    }
    lockWorldCanvasPresentationSize(game.canvas);
    bindWorldCanvasRenderer(game);
    if (pool) {
        protectWorldCanvasInPool(pool, game.canvas, game);
    }
    guardState.textures = game.textures;
    refuseWorldCanvasTextureBind(game.textures, game.canvas);
    refuseWorldCanvasGenerateTexture(game.textures);
    refuseWorldCanvasCreateCanvas(game.textures);
}

/**
 * Re-lock FOV size / getContext / setAttribute and reseal the pool slot.
 * Move mid-prepare can swap `game.canvas` or restream without going through
 * the select/confirm wrappers — rebind if the presentation surface changed.
 */
export function reassertWorldCanvasPresentationGuard(
    game?: GameWithRenderer,
): void {
    const canvas = game?.canvas ?? guardState.worldCanvas;
    if (!canvas) {
        return;
    }
    if (game?.canvas && game.canvas !== guardState.worldCanvas) {
        attachWorldCanvasPoolGuard(game, guardState.pool);
        return;
    }
    lockWorldCanvasPresentationSize(canvas);
    bindWorldCanvasRenderer(game);
    if (guardState.refuseFullCanvasClear) {
        lockWorldCanvasRendererClear(game);
        restoreWorldCanvasPixels(canvas);
    }
    if (guardState.pool) {
        occupyWorldCanvasPoolSlot(guardState.pool);
    }
    const textures = game?.textures ?? guardState.textures;
    refuseWorldCanvasTextureBind(textures, canvas);
    refuseWorldCanvasGenerateTexture(textures);
    refuseWorldCanvasCreateCanvas(textures);
}

function readPixelBytes(data: unknown): ArrayLike<number> | undefined {
    if (typeof ImageData !== 'undefined' && data instanceof ImageData) {
        return data.data;
    }
    if (typeof data !== 'object' || data === null || !('data' in data)) {
        return undefined;
    }
    const bytes = (data as { data: unknown }).data;
    if (!bytes || typeof (bytes as ArrayLike<number>).length !== 'number') {
        return undefined;
    }
    const len = (bytes as ArrayLike<number>).length;
    if (len < 4 || typeof (bytes as ArrayLike<number>)[0] !== 'number') {
        return undefined;
    }
    return bytes as ArrayLike<number>;
}

function rgbaHasNonBlackRgb(pixels: ArrayLike<number>): boolean {
    const len = pixels.length;
    const step = Math.max(4, Math.floor(len / 4096) * 4);
    for (let i = 0; i < len; i += step) {
        if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0) {
            return true;
        }
    }
    const last = len - 4;
    return pixels[last] !== 0 || pixels[last + 1] !== 0 || pixels[last + 2] !== 0;
}

function pixelBackupLooksPainted(data: unknown): boolean {
    if (data == null) {
        return false;
    }
    const pixels = readPixelBytes(data);
    if (!pixels) {
        // Unit-test stub objects (e.g. `{ id: 'painted-fov' }`) count as painted.
        return true;
    }
    return rgbaHasNonBlackRgb(pixels);
}

/** True when the last snapshot has non-black RGB (empty FOV must not be frozen). */
export function hasPaintedWorldCanvasSnapshot(): boolean {
    const backup = guardState.pixelBackup;
    return Boolean(backup && pixelBackupLooksPainted(backup.data));
}

export function clearWorldCanvasPixelBackup(): void {
    guardState.pixelBackup = undefined;
}

/** Copy the FOV buffer. Callers that freeze clear must use the painted variant. */
export function snapshotWorldCanvasPixels(canvas?: WorldCanvasLike): boolean {
    const target = canvas ?? guardState.worldCanvas;
    if (target) {
        guardState.worldCanvas = target;
    }
    if (!target?.getContext) {
        return false;
    }
    const ctx = target.getContext('2d') as WorldCanvas2DContext | undefined;
    if (typeof ctx?.getImageData !== 'function') {
        return false;
    }
    try {
        guardState.pixelBackup = {
            width: target.width,
            height: target.height,
            data: ctx.getImageData(0, 0, target.width, target.height),
        };
        return true;
    } catch {
        return false;
    }
}

/**
 * Snapshot only a painted FOV. Keeps a previous painted backup if the current
 * read is empty/black — that empty restore is the #73 SELECT black canvas.
 */
export function snapshotWorldCanvasPixelsIfPainted(canvas?: WorldCanvasLike): boolean {
    const previous = guardState.pixelBackup;
    const previousPainted = previous && pixelBackupLooksPainted(previous.data) ? previous : undefined;
    if (!snapshotWorldCanvasPixels(canvas) || !hasPaintedWorldCanvasSnapshot()) {
        guardState.pixelBackup = previousPainted;
        return previousPainted !== undefined;
    }
    return true;
}

/** Blit the last painted FOV after a move-during-prepare wipe. Never blit black. */
export function restoreWorldCanvasPixels(canvas?: WorldCanvasLike): boolean {
    const target = canvas ?? guardState.worldCanvas;
    const backup = guardState.pixelBackup;
    if (!target || !backup || backup.width !== target.width || backup.height !== target.height) {
        return false;
    }
    if (!pixelBackupLooksPainted(backup.data)) {
        return false;
    }
    const ctx = target.getContext?.('2d') as WorldCanvas2DContext | undefined;
    if (typeof ctx?.putImageData !== 'function') {
        return false;
    }
    try {
        ctx.putImageData(backup.data, 0, 0);
        return true;
    } catch {
        return false;
    }
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
