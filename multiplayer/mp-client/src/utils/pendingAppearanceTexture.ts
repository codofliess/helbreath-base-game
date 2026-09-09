/** Keep in sync with `PLAYER_ITEM_APPEARANCE_PENDING_TEXTURE` in Config (no Vite import here). */
export const PENDING_APPEARANCE_TEXTURE_KEY = 'player-item-appearance-pending';

type PendingTextureScene = {
    game?: { canvas?: unknown };
    textures: {
        exists: (key: string) => boolean;
        addCanvas?: (key: string, canvas: HTMLCanvasElement) => unknown;
        remove?: (key: string) => unknown;
        get: (key: string) => { getSourceImage?: () => unknown };
    };
};

/**
 * True when a Phaser texture's source is the live world/game canvas.
 * `Graphics.generateTexture` snapshots that canvas — later sprite/paper-doll
 * drawImage of the pending key blanks the map and can hard-leave to landing.
 */
export function isWorldCanvasImageSource(source: unknown, worldCanvas: unknown): boolean {
    return worldCanvas != null && source != null && source === worldCanvas;
}

/** Dedicated 1×1 canvas — never {@link HTMLCanvasElement} of the Phaser game. */
export function createIndependentPendingAppearanceCanvas(): HTMLCanvasElement {
    if (typeof document === 'undefined') {
        return { width: 1, height: 1 } as HTMLCanvasElement;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, 1, 1);
    return canvas;
}

/**
 * Point a Phaser canvas texture off `game.canvas` before destroy.
 * `textures.remove` of a world-backed key → CanvasPool.remove → 1×1 world.
 */
function retargetTextureOffWorldCanvas(texture: unknown, worldCanvas: unknown): boolean {
    if (texture == null || typeof texture !== 'object' || worldCanvas == null) {
        return false;
    }
    const dummy = createIndependentPendingAppearanceCanvas();
    const rec = texture as {
        canvas?: unknown;
        source?: Array<{ image?: unknown; source?: unknown }>;
    };
    let detached = false;
    if (rec.canvas === worldCanvas) {
        rec.canvas = dummy;
        detached = true;
    }
    const src0 = rec.source?.[0];
    if (src0) {
        if (src0.image === worldCanvas) {
            src0.image = dummy;
            detached = true;
        }
        if (src0.source === worldCanvas) {
            src0.source = dummy;
            detached = true;
        }
    }
    return detached;
}

/**
 * Registers the pending appearance key as an isolated canvas.
 * Only replaces a leftover world-canvas alias after detaching `game.canvas`.
 */
export function ensurePendingPlayerItemAppearanceTexture(scene: PendingTextureScene): void {
    const textures = scene.textures;
    const key = PENDING_APPEARANCE_TEXTURE_KEY;
    const worldCanvas = scene.game?.canvas;
    if (textures.exists(key)) {
        try {
            const texture = textures.get(key);
            const source = texture.getSourceImage?.();
            if (!isWorldCanvasImageSource(source, worldCanvas)) {
                return;
            }
            if (!retargetTextureOffWorldCanvas(texture, worldCanvas)) {
                return;
            }
            textures.remove?.(key);
        } catch {
            return;
        }
    }
    if (typeof textures.addCanvas !== 'function') {
        return;
    }
    textures.addCanvas(key, createIndependentPendingAppearanceCanvas());
}
