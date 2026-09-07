/**
 * Structural Phaser shapes for hub-reachable modules.
 * Do not `import from 'phaser'` here — KindGem Phantom seal OOMs if index-*.js loads WebGL.
 */

export type PhaserGameLike = {
    canvas?: HTMLCanvasElement;
    config?: { width?: unknown; height?: unknown };
    registry: {
        get: (key: string) => unknown;
        set: (key: string, value: unknown) => void;
        remove?: (key: string) => void;
    };
    loop: {
        sleep: () => void;
        wake: (resetTime?: boolean) => void;
    };
    input: { enabled: boolean };
    destroy: (removeCanvas: boolean, noReturn?: boolean) => void;
    scale?: {
        width?: number;
        height?: number;
        refresh?: () => void;
        isFullscreen?: boolean;
        startFullscreen?: () => void;
        stopFullscreen?: () => void;
        on?: (event: string, fn: () => void) => void;
    };
    scene?: {
        isActive: (key: string) => boolean;
        getScene: (key: string) => unknown;
    };
};

/** Loose on purpose so hub modules never `import from 'phaser'`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PhaserSceneLike = any;

/** React ref shape. Lives here so hub UI never type-imports PhaserGame.tsx (and thus phaser). */
export type IRefPhaserGame = {
    game: PhaserGameLike | null;
    scene: PhaserSceneLike | null;
};
