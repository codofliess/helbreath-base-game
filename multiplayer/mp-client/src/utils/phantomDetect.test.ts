import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    PHANTOM_WALLET_STANDARD_NAME,
    SOLANA_SIGN_MESSAGE,
    STANDARD_CONNECT,
    WALLET_STANDARD_APP_READY,
    WALLET_STANDARD_REGISTER,
    adaptWalletStandardPhantom,
    buildPhantomBrowseLink,
    detectPhantomProvider,
    getLegacyPhantom,
    isMobileUserAgent,
    isPhantomStandardWallet,
    type PhantomHostWindow,
    type PhantomProvider,
    type StandardWallet,
    type WalletStandardEvent,
} from './phantomDetect';

function createFakeWindow(): PhantomHostWindow & {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider;
} {
    const listeners = new Map<string, Array<(event: WalletStandardEvent) => void>>();
    return {
        addEventListener(type, handler) {
            const list = listeners.get(type) ?? [];
            list.push(handler);
            listeners.set(type, list);
        },
        removeEventListener(type, handler) {
            const list = listeners.get(type) ?? [];
            listeners.set(type, list.filter((h) => h !== handler));
        },
        dispatchEvent(event) {
            for (const handler of listeners.get(event.type) ?? []) {
                handler(event);
            }
            return true;
        },
    };
}

function legacyPhantom(label = 'legacy'): PhantomProvider {
    return {
        isPhantom: true,
        connect: async () => ({ publicKey: { toBase58: () => label } }),
        signMessage: async (message) => ({ signature: message }),
    };
}

function standardPhantomWallet(address = 'StdPhantom111'): StandardWallet {
    const accounts = [{ address }];
    return {
        name: PHANTOM_WALLET_STANDARD_NAME,
        get accounts() {
            return accounts;
        },
        features: {
            [STANDARD_CONNECT]: {
                connect: async () => ({ accounts }),
            },
            [SOLANA_SIGN_MESSAGE]: {
                signMessage: async ({ message }: { message: Uint8Array }) => [
                    { signature: message },
                ],
            },
        },
    };
}

function installStandardPhantom(win: PhantomHostWindow, wallet: StandardWallet): void {
    win.addEventListener?.(WALLET_STANDARD_APP_READY, (event) => {
        const detail = event.detail as { register?: (w: unknown) => void } | undefined;
        detail?.register?.(wallet);
    });
}

describe('getLegacyPhantom', () => {
    it('accepts window.phantom.solana when isPhantom is set', () => {
        const win = createFakeWindow();
        const injected = legacyPhantom();
        win.phantom = { solana: injected };
        win.solana = { isPhantom: false, connect: injected.connect, signMessage: injected.signMessage };
        assert.equal(getLegacyPhantom(win), injected);
    });

    it('falls back to window.solana.isPhantom', () => {
        const win = createFakeWindow();
        const injected = legacyPhantom();
        win.solana = injected;
        assert.equal(getLegacyPhantom(win), injected);
    });

    it('rejects a non-Phantom window.solana override', () => {
        const win = createFakeWindow();
        win.solana = {
            isPhantom: false,
            connect: async () => ({ publicKey: { toBase58: () => 'other' } }),
            signMessage: async (message) => ({ signature: message }),
        };
        assert.equal(getLegacyPhantom(win), undefined);
    });
});

describe('detectPhantomProvider', () => {
    it('returns the legacy injection when present', async () => {
        const win = createFakeWindow();
        const injected = legacyPhantom();
        win.phantom = { solana: injected };
        const found = await detectPhantomProvider({
            getWindow: () => win,
            timeoutMs: 0,
        });
        assert.equal(found, injected);
    });

    it('finds Phantom via wallet-standard when injection is missing or overridden', async () => {
        const win = createFakeWindow();
        win.solana = {
            isPhantom: false,
            connect: async () => ({ publicKey: { toBase58: () => 'solflare' } }),
            signMessage: async (message) => ({ signature: message }),
        };
        const wallet = standardPhantomWallet('StdOnlyPhantom');
        installStandardPhantom(win, wallet);
        const found = await detectPhantomProvider({
            getWindow: () => win,
            timeoutMs: 0,
        });
        assert.ok(found);
        assert.equal(found?.isPhantom, true);
        const connected = await found!.connect({ onlyIfTrusted: false });
        assert.equal(connected.publicKey.toBase58(), 'StdOnlyPhantom');
    });

    it('returns undefined when neither legacy nor a Phantom standard wallet is present', async () => {
        const win = createFakeWindow();
        win.addEventListener?.(WALLET_STANDARD_APP_READY, (event) => {
            const detail = event.detail as { register?: (w: unknown) => void } | undefined;
            detail?.register?.({
                name: 'Not Phantom',
                features: {
                    [STANDARD_CONNECT]: { connect: async () => ({ accounts: [] }) },
                    [SOLANA_SIGN_MESSAGE]: { signMessage: async () => [] },
                },
            });
        });
        const found = await detectPhantomProvider({
            getWindow: () => win,
            timeoutMs: 40,
            intervalMs: 10,
        });
        assert.equal(found, undefined);
    });

    it('waits for a late legacy injection within the poll window', async () => {
        const win = createFakeWindow();
        const injected = legacyPhantom('late');
        setTimeout(() => {
            win.phantom = { solana: injected };
        }, 50);
        const found = await detectPhantomProvider({
            getWindow: () => win,
            timeoutMs: 400,
            intervalMs: 20,
        });
        assert.equal(found, injected);
    });

    it('waits for a late wallet-standard register-wallet event', async () => {
        const win = createFakeWindow();
        const wallet = standardPhantomWallet('LateStdPhantom');
        setTimeout(() => {
            win.dispatchEvent?.({
                type: WALLET_STANDARD_REGISTER,
                detail: ({ register }: { register: (w: unknown) => void }) => register(wallet),
            });
        }, 50);
        const found = await detectPhantomProvider({
            getWindow: () => win,
            timeoutMs: 400,
            intervalMs: 20,
        });
        assert.ok(found);
        const connected = await found!.connect();
        assert.equal(connected.publicKey.toBase58(), 'LateStdPhantom');
    });
});

describe('wallet-standard Phantom adapter', () => {
    it('requires name Phantom plus standard:connect and solana:signMessage', () => {
        assert.equal(isPhantomStandardWallet(standardPhantomWallet()), true);
        assert.equal(
            isPhantomStandardWallet({
                name: 'Phantom',
                features: { [STANDARD_CONNECT]: { connect: async () => ({ accounts: [] }) } },
            }),
            false,
        );
    });

    it('connect + signMessage stay on the adapted provider (no transactions)', async () => {
        const wallet = standardPhantomWallet('AdapterKey');
        const phantom = adaptWalletStandardPhantom(wallet);
        const connected = await phantom.connect({ onlyIfTrusted: false });
        assert.equal(connected.publicKey.toBase58(), 'AdapterKey');
        const message = new TextEncoder().encode('chainlords login');
        const signed = await phantom.signMessage(message, 'utf8');
        assert.deepEqual(signed.signature, message);
        assert.equal(typeof (phantom as { signTransaction?: unknown }).signTransaction, 'undefined');
    });
});

describe('Phantom notice helpers', () => {
    it('builds the Phantom universal browse link', () => {
        assert.equal(
            buildPhantomBrowseLink('https://play.chainlords.net/', 'https://play.chainlords.net'),
            'https://phantom.app/ul/browse/https%3A%2F%2Fplay.chainlords.net%2F?ref=https%3A%2F%2Fplay.chainlords.net',
        );
    });

    it('detects mobile user agents', () => {
        assert.equal(isMobileUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), true);
        assert.equal(isMobileUserAgent('Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0'), true);
        assert.equal(isMobileUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'), false);
    });
});
