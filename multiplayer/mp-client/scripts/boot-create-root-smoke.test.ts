import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { startGameWithRendererFallback } from '../src/game/startGameWithRendererFallback';
import {
    bootstrapWalletDeepLinkAtBoot,
    consumePreferredAuthChain,
    consumeWalletDeepLink,
    getStoredWalletPubkey,
    getStoredWalletToken,
} from '../src/utils/walletAuth';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function installMinimalBrowser() {
    const mem = new Map<string, string>();
    const storage = {
        getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
        setItem: (k: string, v: string) => {
            mem.set(String(k), String(v));
        },
        removeItem: (k: string) => {
            mem.delete(String(k));
        },
    };
    const windowLike = {
        location: {
            search: '',
            pathname: '/',
            hash: '',
            hostname: 'play.chainlords.net',
        },
        history: { replaceState() {} },
        localStorage: storage,
        sessionStorage: storage,
    };
    (globalThis as { window?: typeof windowLike }).window = windowLike;
    (globalThis as { localStorage?: typeof storage }).localStorage = storage;
    (globalThis as { sessionStorage?: typeof storage }).sessionStorage = storage;
}

describe('startGameWithRendererFallback', () => {
    it('returns AUTO/WebGL game when the first factory succeeds', () => {
        const game = startGameWithRendererFallback(
            () => ({ renderer: 'webgl' }),
            () => {
                throw new Error('canvas should not run');
            },
        );
        assert.deepEqual(game, { renderer: 'webgl' });
    });

    it('retries Canvas when WebGL abort is thrown', () => {
        const game = startGameWithRendererFallback(
            () => {
                throw new Error('Cannot create WebGL context, aborting.');
            },
            () => ({ renderer: 'canvas' }),
        );
        assert.deepEqual(game, { renderer: 'canvas' });
    });

    it('returns null instead of throwing when both renderers fail', () => {
        const game = startGameWithRendererFallback(
            () => {
                throw new Error('Cannot create WebGL context, aborting.');
            },
            () => {
                throw new Error('Cannot create Canvas 2d context');
            },
        );
        assert.equal(game, null);
    });
});

describe('createRoot boot path (no wallet)', () => {
    it('Phaser config is AUTO with Canvas fallback, not WEBGL-only', () => {
        const src = fs.readFileSync(path.join(clientRoot, 'src/game/main.ts'), 'utf8');
        assert.match(src, /buildGameConfig\(parent, AUTO/);
        assert.doesNotMatch(src, /\bWEBGL\b/);
        assert.match(src, /failIfMajorPerformanceCaveat:\s*false/);
        assert.match(src, /buildGameConfig\(parent, CANVAS/);
        assert.match(src, /startGameWithRendererFallback/);
    });

    it('PhaserGame starts after paint and catches StartGame so React hub cannot be rolled back', () => {
        const src = fs.readFileSync(path.join(clientRoot, 'src/PhaserGame.tsx'), 'utf8');
        assert.match(src, /try\s*\{[\s\S]*StartGame/);
        assert.doesNotMatch(src, /useLayoutEffect\(/);
        assert.match(src, /game\.current = null/);
    });

    it('App wraps PhaserGame so a Phaser render throw cannot empty #root', () => {
        const src = fs.readFileSync(path.join(clientRoot, 'src/App.tsx'), 'utf8');
        assert.match(src, /PhaserMountGuard/);
        assert.match(src, /<PhaserGame /);
    });

    it('main.tsx opens login hub before createRoot', () => {
        const src = fs.readFileSync(path.join(clientRoot, 'src/main.tsx'), 'utf8');
        const hubIdx = src.indexOf('ensureLoginHubOpenAtBoot');
        const rootIdx = src.indexOf('createRoot');
        assert.ok(hubIdx >= 0, 'ensureLoginHubOpenAtBoot missing');
        assert.ok(rootIdx > hubIdx, 'login hub must open before createRoot');
    });

    it('walletAuth boot does not throw without a wallet', () => {
        installMinimalBrowser();
        assert.doesNotThrow(() => bootstrapWalletDeepLinkAtBoot());
        assert.equal(getStoredWalletToken(), undefined);
        assert.equal(getStoredWalletPubkey(), undefined);
        assert.equal(consumeWalletDeepLink(), null);
        assert.equal(consumePreferredAuthChain(), undefined);
    });
});
