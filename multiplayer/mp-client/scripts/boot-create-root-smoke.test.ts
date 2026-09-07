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

    it('PhaserGame static-imports StartGame so SELECTCHAR desk-sync stays in index-*.js', () => {
        const src = fs.readFileSync(path.join(clientRoot, 'src/PhaserGame.tsx'), 'utf8');
        assert.match(src, /^import StartGame from '\.\/game\/main';/m);
        assert.doesNotMatch(src, /await import\('\.\/game\/main'\)/);
        assert.doesNotMatch(src, /useLayoutEffect\(/);
    });

    it('LoginScreen and SelectCharDesk keep occupied paint + desk-sync strings in the boot graph', () => {
        const login = fs.readFileSync(
            path.join(clientRoot, 'src/game/scenes/LoginScreen.ts'),
            'utf8',
        );
        const desk = fs.readFileSync(path.join(clientRoot, 'src/game/ui/SelectCharDesk.ts'), 'utf8');
        const sync = fs.readFileSync(
            path.join(clientRoot, 'src/game/ui/selectCharDeskSync.ts'),
            'utf8',
        );
        assert.match(login, /LoginScreen SELECTCHAR desk sync/);
        assert.match(desk, /SelectCharDesk painted slot texts/);
        assert.match(sync, /paintSelectCharSlotRows/);
        assert.match(sync, /forceRebuild/);
        assert.match(sync, /applyPaintedSlotRows/);
        assert.doesNotMatch(desk, /writeSlotCardTexts/);
        assert.match(desk, /writeSlotGlyphImage/);
        assert.match(desk, /painted slot texts names=/);
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
        assert.match(src, /const mustSign = needsWalletSignForWorldEnter\(chain, session\);/);
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

describe('production index-*.js (when dist exists)', () => {
    it('hard-gates SELECTCHAR desk-sync in the entry chunk and forbids a main-* EventBus split', () => {
        const distAssets = path.join(clientRoot, 'dist/assets');
        if (!fs.existsSync(distAssets)) {
            return;
        }
        const files = fs.readdirSync(distAssets);
        const indexFiles = files.filter((f) => /^index-.*\.js$/.test(f));
        const mainFiles = files.filter((f) => /^main-.*\.js$/.test(f));
        assert.equal(indexFiles.length, 1, `expected one index-*.js, got ${indexFiles.join(',')}`);
        assert.equal(mainFiles.length, 0, `EventBus split main-* chunk must not exist: ${mainFiles.join(',')}`);
        const entry = fs.readFileSync(path.join(distAssets, indexFiles[0]), 'utf8');
        assert.match(entry, /SELECTCHAR desk sync/);
        assert.match(entry, /painted slot texts/);
        assert.match(entry, /setCharacterSlots/);
        assert.match(entry, /applyPaintedSlotRows/);
    });
});
