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
    it('returns the primary renderer when it succeeds', () => {
        const game = startGameWithRendererFallback(
            () => ({ renderer: 'canvas' }),
            () => {
                throw new Error('secondary should not run');
            },
        );
        assert.deepEqual(game, { renderer: 'canvas' });
    });

    it('retries secondary when WebGL abort is thrown', () => {
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
    it('Phaser boots Canvas first and never requests WEBGL-only', () => {
        const src = fs.readFileSync(path.join(clientRoot, 'src/game/main.ts'), 'utf8');
        const canvasIdx = src.indexOf('buildGameConfig(parent, CANVAS');
        const autoIdx = src.indexOf('buildGameConfig(parent, AUTO');
        assert.ok(canvasIdx >= 0, 'Canvas must be the primary renderer');
        assert.ok(autoIdx > canvasIdx, 'AUTO is fallback after Canvas');
        assert.doesNotMatch(src, /type:\s*WEBGL/);
        assert.doesNotMatch(src, /buildGameConfig\(parent, WEBGL/);
        assert.match(src, /failIfMajorPerformanceCaveat:\s*false/);
    });

    it('PhaserGame lazy-loads Phaser after paint (no static StartGame import)', () => {
        const src = fs.readFileSync(path.join(clientRoot, 'src/PhaserGame.tsx'), 'utf8');
        assert.doesNotMatch(src, /import StartGame from/);
        assert.match(src, /import\('\.\/game\/main'\)/);
        assert.doesNotMatch(src, /useLayoutEffect\(/);
    });

    it('App wraps PhaserGame so a Phaser render throw cannot empty #root', () => {
        const src = fs.readFileSync(path.join(clientRoot, 'src/App.tsx'), 'utf8');
        assert.match(src, /PhaserMountGuard/);
        assert.match(src, /<PhaserGame /);
        assert.match(src, /rpg-ui\.css/);
    });

    it('main.tsx opens login hub before createRoot', () => {
        const src = fs.readFileSync(path.join(clientRoot, 'src/main.tsx'), 'utf8');
        const hubIdx = src.indexOf('ensureLoginHubOpenAtBoot');
        const rootIdx = src.indexOf('createRoot');
        assert.ok(hubIdx >= 0, 'ensureLoginHubOpenAtBoot missing');
        assert.ok(rootIdx > hubIdx, 'login hub must open before createRoot');
    });

    it('LoadingScreen defers catalog audio and sprites on the HTTP live path', () => {
        const src = fs.readFileSync(path.join(clientRoot, 'src/game/scenes/LoadingScreen.ts'), 'utf8');
        assert.match(src, /LOAD_AUDIO_ON_DEMAND/);
        assert.match(src, /LOAD_BOOT_SPRITES_ON_DEMAND/);
        const config = fs.readFileSync(path.join(clientRoot, 'src/Config.ts'), 'utf8');
        assert.match(config, /export const LOAD_AUDIO_ON_DEMAND = true;/);
        assert.match(config, /export const LOAD_BOOT_SPRITES_ON_DEMAND = true;/);
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

describe('hub Phantom sign path (source)', () => {
    it('ConnectDialog always re-authenticates Phantom Sol and surfaces the extension toast', () => {
        const src = fs.readFileSync(path.join(clientRoot, 'src/ui/dialogs/ConnectDialog.tsx'), 'utf8');
        assert.match(src, /const mustSign = chain === 'sol' \|\| !session;/);
        assert.match(src, /Reconnect \/ Sign again/);
        assert.match(src, /PHANTOM_SIGN_PENDING_TOAST/);
        assert.match(src, /getReusableHubWalletSession/);
        assert.doesNotMatch(src, /getStoredWalletToken\(\)/);
    });

    it('walletAuth prefers Phantom signMessage and clears stale Sol tokens', () => {
        const src = fs.readFileSync(path.join(clientRoot, 'src/utils/walletAuth.ts'), 'utf8');
        assert.match(src, /Approve the signature in the Phantom extension/);
        assert.match(src, /phantom\.signMessage\(encoded, 'utf8'\)/);
        assert.match(src, /clearStoredWalletAuth\(\)/);
        assert.match(src, /onlyIfTrusted: false/);
        assert.match(src, /w\.phantom\?\.solana \?\? w\.solana/);
    });
});
