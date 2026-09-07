/**
 * Parks the live Phaser canvas while Phantom (or another wallet overlay) is open.
 *
 * KindGem + Phantom UI + an active Canvas/WebGL compositor is a Chrome Aw Snap 9
 * (OOM) path: the crash happens before `signMessage` returns (firmas=0).
 * SELECTCHAR desks stay unbuilt until after a successful seal.
 */

type HelbreathPhaserGameGlobal = typeof globalThis & {
    __helbreathPhaserGame?: Phaser.Game | null;
};

type ParkedCanvasStyle = {
    visibility: string;
    pointerEvents: string;
    containerVisibility: string;
};

let parkDepth = 0;
let parkedCanvasStyle: ParkedCanvasStyle | undefined;
let loopWasSleeping = false;

export function setLivePhaserGame(game: Phaser.Game | null): void {
    (globalThis as HelbreathPhaserGameGlobal).__helbreathPhaserGame = game;
}

export function getLivePhaserGame(): Phaser.Game | null | undefined {
    return (globalThis as HelbreathPhaserGameGlobal).__helbreathPhaserGame;
}

/** True while Phantom connect/sign owns the tab — desk CSS must not resize the canvas. */
export function isPhaserParkedForWalletUi(): boolean {
    return parkDepth > 0;
}

/** Two animation frames (or a timeout in tests) so the click stack can unwind. */
export function yieldForWalletUi(): Promise<void> {
    return new Promise((resolve) => {
        let settled = false;
        const done = () => {
            if (settled) {
                return;
            }
            settled = true;
            resolve();
        };
        setTimeout(done, 0);
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
                requestAnimationFrame(done);
            });
        }
    });
}

function getGameContainer(): HTMLElement | null {
    if (typeof document === 'undefined') {
        return null;
    }
    return document.getElementById('game-container');
}

function parkLiveCanvas(): void {
    const game = getLivePhaserGame();
    if (!game) {
        return;
    }

    try {
        game.loop.sleep();
        loopWasSleeping = true;
    } catch (err) {
        console.warn('[phaserWalletPark] loop.sleep failed', err);
        loopWasSleeping = false;
    }

    try {
        game.input.enabled = false;
    } catch {
        // input may be mid-teardown
    }

    const canvas = game.canvas;
    const container = getGameContainer();
    parkedCanvasStyle = {
        visibility: canvas?.style.visibility ?? '',
        pointerEvents: canvas?.style.pointerEvents ?? '',
        containerVisibility: container?.style.visibility ?? '',
    };
    if (canvas) {
        canvas.style.visibility = 'hidden';
        canvas.style.pointerEvents = 'none';
    }
    if (container) {
        container.style.visibility = 'hidden';
    }
}

function unparkLiveCanvas(): void {
    const game = getLivePhaserGame();
    const style = parkedCanvasStyle;
    parkedCanvasStyle = undefined;

    if (!game) {
        loopWasSleeping = false;
        return;
    }

    const canvas = game.canvas;
    const container = getGameContainer();
    if (canvas && style) {
        canvas.style.visibility = style.visibility;
        canvas.style.pointerEvents = style.pointerEvents;
    }
    if (container && style) {
        container.style.visibility = style.containerVisibility;
    }

    try {
        game.input.enabled = true;
    } catch {
        // ignore
    }

    if (loopWasSleeping) {
        try {
            game.loop.wake(true);
        } catch (err) {
            console.warn('[phaserWalletPark] loop.wake failed', err);
        }
    }
    loopWasSleeping = false;
}

/**
 * Sleeps the Phaser RAF loop and hides the canvas around `work` (Phantom connect+sign).
 * Nested calls share one park. Safe when Phaser has not booted yet (hub-only React).
 */
export async function parkPhaserForWalletUi<T>(work: () => Promise<T>): Promise<T> {
    parkDepth += 1;
    if (parkDepth === 1) {
        parkLiveCanvas();
        await yieldForWalletUi();
    }
    try {
        return await work();
    } finally {
        parkDepth = Math.max(0, parkDepth - 1);
        if (parkDepth === 0) {
            unparkLiveCanvas();
        }
    }
}
