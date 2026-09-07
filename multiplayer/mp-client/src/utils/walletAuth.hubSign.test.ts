import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    clearStoredWalletAuth,
    getReusableHubWalletSession,
    getStoredWalletToken,
    persistWalletSession,
    needsWalletSignForWorldEnter,
} from './walletAuth';

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

describe('hub wallet restore', () => {
    it('does not reuse a Phantom Sol token on the hub', () => {
        installMinimalBrowser();
        persistWalletSession({
            wallet: 'SoL111111111111111111111111111111111111111',
            token: 'stale-sol-token',
            expiresAt: Date.now() + 60 * 60 * 1000,
            chainId: 'sol',
        });
        assert.equal(getStoredWalletToken(), 'stale-sol-token');
        assert.equal(getReusableHubWalletSession(), undefined);
    });

    it('does not reuse a token that has no chain id (legacy Phantom seal)', () => {
        installMinimalBrowser();
        localStorage.setItem(
            'gameState',
            JSON.stringify({
                networkId: 'SoL111111111111111111111111111111111111111',
                authToken: 'legacy-token',
                authExpiresAt: Date.now() + 60 * 60 * 1000,
            }),
        );
        assert.equal(getReusableHubWalletSession(), undefined);
    });

    it('reuses a verified RH / Base seal on the hub', () => {
        installMinimalBrowser();
        persistWalletSession({
            wallet: '0x1111111111111111111111111111111111111111',
            token: 'rh-token',
            expiresAt: Date.now() + 60 * 60 * 1000,
            chainId: 'rh',
        });
        const reused = getReusableHubWalletSession();
        assert.ok(reused);
        assert.equal(reused?.chainId, 'rh');
        assert.equal(reused?.token, 'rh-token');
    });

    it('clearStoredWalletAuth drops the token but keeps the pubkey', () => {
        installMinimalBrowser();
        persistWalletSession({
            wallet: 'SoL111111111111111111111111111111111111111',
            token: 'stale-sol-token',
            expiresAt: Date.now() + 60 * 60 * 1000,
            chainId: 'sol',
        });
        clearStoredWalletAuth();
        assert.equal(getStoredWalletToken(), undefined);
        const raw = JSON.parse(localStorage.getItem('gameState') ?? '{}') as { networkId?: string };
        assert.equal(raw.networkId, 'SoL111111111111111111111111111111111111111');
    });
});

describe('needsWalletSignForWorldEnter', () => {
    it('requires a sign when there is no in-memory session', () => {
        assert.equal(needsWalletSignForWorldEnter('sol', null), true);
        assert.equal(needsWalletSignForWorldEnter('sol', { wallet: '', token: '', expiresAt: 0 }), true);
    });

    it('does not require a second Phantom sign after a just-verified Sol session', () => {
        assert.equal(
            needsWalletSignForWorldEnter('sol', {
                wallet: '4R7FsyC85Yic3hGz7yWAt7HbV5A1qtC7UQi13Hsv5r7K',
                token: 'fresh-sol-token',
                expiresAt: Date.now() + 60_000,
                chainId: 'sol',
            }),
            false,
        );
    });

    it('requires a sign when switching from an EVM seal to Phantom', () => {
        assert.equal(
            needsWalletSignForWorldEnter('sol', {
                wallet: '0x1111111111111111111111111111111111111111',
                token: 'rh-token',
                expiresAt: Date.now() + 60_000,
                chainId: 'rh',
            }),
            true,
        );
    });
});
