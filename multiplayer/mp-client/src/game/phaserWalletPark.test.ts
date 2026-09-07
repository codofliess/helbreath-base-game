import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getLivePhaserGame,
    isPhaserParkedForWalletUi,
    parkPhaserForWalletUi,
    setLivePhaserGame,
    yieldForWalletUi,
} from './phaserWalletPark';

describe('parkPhaserForWalletUi', () => {
    it('is a no-op when Phaser has not booted (hub-only React)', async () => {
        setLivePhaserGame(null);
        assert.equal(isPhaserParkedForWalletUi(), false);
        const result = await parkPhaserForWalletUi(async () => 'signed');
        assert.equal(result, 'signed');
        assert.equal(isPhaserParkedForWalletUi(), false);
        assert.equal(getLivePhaserGame() ?? null, null);
    });

    it('removes orphan canvases when Phaser never booted', async () => {
        setLivePhaserGame(null);
        const canvas = { tagName: 'CANVAS', remove() { this.removed = true; }, removed: false };
        const container = {
            id: 'game-container',
            style: { visibility: '' },
            querySelectorAll: () => [canvas],
        };
        const prev = (globalThis as { document?: unknown }).document;
        (globalThis as { document: { getElementById: (id: string) => unknown } }).document = {
            getElementById: (id: string) => (id === 'game-container' ? container : null),
        };
        try {
            await parkPhaserForWalletUi(async () => {
                assert.equal(canvas.removed, true);
                assert.equal(container.style.visibility, 'hidden');
                return 'ok';
            });
        } finally {
            (globalThis as { document?: unknown }).document = prev;
            setLivePhaserGame(null);
        }
    });

    it('sleeps the game loop and hides the canvas around Phantom work', async () => {
        const sleeps: string[] = [];
        const canvas = { style: { visibility: 'visible', pointerEvents: 'auto' } };
        const fakeGame = {
            loop: {
                sleep: () => sleeps.push('sleep'),
                wake: () => sleeps.push('wake'),
            },
            input: { enabled: true },
            canvas,
        };
        setLivePhaserGame(fakeGame as never);
        try {
            await parkPhaserForWalletUi(async () => {
                assert.equal(isPhaserParkedForWalletUi(), true);
                assert.equal(canvas.style.visibility, 'hidden');
                assert.equal(fakeGame.input.enabled, false);
                assert.deepEqual(sleeps, ['sleep']);
                return 1;
            });
            assert.equal(isPhaserParkedForWalletUi(), false);
            assert.equal(canvas.style.visibility, 'visible');
            assert.equal(fakeGame.input.enabled, true);
            assert.deepEqual(sleeps, ['sleep', 'wake']);
        } finally {
            setLivePhaserGame(null);
        }
    });

    it('yieldForWalletUi resolves without requestAnimationFrame', async () => {
        await yieldForWalletUi();
    });
});
