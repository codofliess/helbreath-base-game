/**
 * Phantom discovery for hub sign-in.
 * Prefers the legacy `window.phantom.solana` / `window.solana` injection, then
 * Solana Wallet Standard (`wallet-standard:register-wallet` / `app-ready`) when
 * another extension stole `window.solana` or injection is late.
 * Connect + signMessage only — no transactions.
 */

export const PHANTOM_DETECT_TIMEOUT_MS = 3000;
export const PHANTOM_DETECT_INTERVAL_MS = 100;
export const PHANTOM_WALLET_STANDARD_NAME = 'Phantom';
export const PHANTOM_NOT_FOUND_MESSAGE = 'Phantom wallet not found. Install it from phantom.app';
export const STANDARD_CONNECT = 'standard:connect';
export const SOLANA_SIGN_MESSAGE = 'solana:signMessage';
export const WALLET_STANDARD_REGISTER = 'wallet-standard:register-wallet';
export const WALLET_STANDARD_APP_READY = 'wallet-standard:app-ready';

export type PhantomProvider = {
    isPhantom?: boolean;
    isConnected?: boolean;
    publicKey?: { toBase58: () => string };
    connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toBase58: () => string } }>;
    signMessage: (
        message: Uint8Array,
        display?: string,
    ) => Promise<{ signature: Uint8Array; publicKey?: { toBase58: () => string } }>;
    request?: (args: { method: string; params: { message: Uint8Array; display: string } }) => Promise<{
        signature: Uint8Array;
        publicKey?: { toBase58: () => string };
    }>;
    on?: (event: string, handler: (publicKey?: { toBase58: () => string } | null) => void) => void;
    off?: (event: string, handler: (publicKey?: { toBase58: () => string } | null) => void) => void;
};

export type PhantomHostWindow = {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider;
    addEventListener?: (type: string, handler: (event: WalletStandardEvent) => void) => void;
    removeEventListener?: (type: string, handler: (event: WalletStandardEvent) => void) => void;
    dispatchEvent?: (event: WalletStandardEvent) => boolean;
};

export type WalletStandardEvent = {
    type: string;
    detail?: unknown;
};

type StandardWalletAccount = {
    address: string;
};

type StandardConnectFeature = {
    connect: (input?: { silent?: boolean }) => Promise<{ accounts?: StandardWalletAccount[] }>;
};

type StandardSignMessageFeature = {
    signMessage: (
        input: { account: StandardWalletAccount; message: Uint8Array },
    ) => Promise<Array<{ signature: Uint8Array }>>;
};

export type StandardWallet = {
    name: string;
    accounts?: StandardWalletAccount[];
    features?: Record<string, unknown>;
};

export class PhantomNotFoundError extends Error {
    constructor() {
        super(PHANTOM_NOT_FOUND_MESSAGE);
        this.name = 'PhantomNotFoundError';
    }
}

export function isPhantomNotFoundError(error: unknown): boolean {
    return error instanceof PhantomNotFoundError
        || (error instanceof Error && error.name === 'PhantomNotFoundError');
}

export function isMobileUserAgent(ua: string): boolean {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

export function buildPhantomBrowseLink(href: string, origin: string): string {
    return `https://phantom.app/ul/browse/${encodeURIComponent(href)}?ref=${encodeURIComponent(origin)}`;
}

export type DetectPhantomOptions = {
    timeoutMs?: number;
    intervalMs?: number;
    getWindow?: () => PhantomHostWindow | undefined;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
};

function defaultSleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export function getLegacyPhantom(w: PhantomHostWindow): PhantomProvider | undefined {
    const injected = w.phantom?.solana ?? w.solana;
    return injected?.isPhantom ? injected : undefined;
}

function isStandardWallet(value: unknown): value is StandardWallet {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value as { name?: unknown; features?: unknown };
    return typeof candidate.name === 'string' && !!candidate.features && typeof candidate.features === 'object';
}

function readConnectFeature(wallet: StandardWallet): StandardConnectFeature | undefined {
    const feature = wallet.features?.[STANDARD_CONNECT];
    if (!feature || typeof feature !== 'object') {
        return undefined;
    }
    const connect = (feature as { connect?: unknown }).connect;
    return typeof connect === 'function' ? { connect: connect as StandardConnectFeature['connect'] } : undefined;
}

function readSignMessageFeature(wallet: StandardWallet): StandardSignMessageFeature | undefined {
    const feature = wallet.features?.[SOLANA_SIGN_MESSAGE];
    if (!feature || typeof feature !== 'object') {
        return undefined;
    }
    const signMessage = (feature as { signMessage?: unknown }).signMessage;
    return typeof signMessage === 'function'
        ? { signMessage: signMessage as StandardSignMessageFeature['signMessage'] }
        : undefined;
}

export function isPhantomStandardWallet(wallet: unknown): wallet is StandardWallet {
    if (!isStandardWallet(wallet) || wallet.name !== PHANTOM_WALLET_STANDARD_NAME) {
        return false;
    }
    return !!readConnectFeature(wallet) && !!readSignMessageFeature(wallet);
}

export function findPhantomStandardWallet(wallets: unknown[]): StandardWallet | undefined {
    return wallets.find(isPhantomStandardWallet);
}

function publicKeyFromAddress(address: string): { toBase58: () => string } {
    return { toBase58: () => address };
}

/** Wrap a Wallet Standard Phantom so hub auth can keep using connect + signMessage. */
export function adaptWalletStandardPhantom(wallet: StandardWallet): PhantomProvider {
    let lastAccount = wallet.accounts?.[0];
    const addressOf = () => (lastAccount?.address ?? wallet.accounts?.[0]?.address ?? '').trim();

    return {
        isPhantom: true,
        get isConnected() {
            return addressOf().length > 0;
        },
        get publicKey() {
            const address = addressOf();
            return address ? publicKeyFromAddress(address) : undefined;
        },
        async connect(opts) {
            const feature = readConnectFeature(wallet);
            if (!feature) {
                throw new PhantomNotFoundError();
            }
            const silent = opts?.onlyIfTrusted === true;
            const result = await feature.connect(silent ? { silent: true } : { silent: false });
            lastAccount = result.accounts?.[0] ?? lastAccount;
            const address = addressOf();
            return { publicKey: publicKeyFromAddress(address) };
        },
        async signMessage(message) {
            const feature = readSignMessageFeature(wallet);
            const account = lastAccount ?? wallet.accounts?.[0];
            if (!feature || !account) {
                throw new Error('Phantom wallet cannot sign messages');
            }
            const outputs = await feature.signMessage({ account, message });
            const signature = outputs[0]?.signature;
            if (!(signature instanceof Uint8Array)) {
                throw new Error('Phantom wallet cannot sign messages');
            }
            const address = addressOf();
            return {
                signature,
                publicKey: address ? publicKeyFromAddress(address) : undefined,
            };
        },
    };
}

function invokeRegisterWalletCallback(detail: unknown, register: (wallet: unknown) => void): void {
    if (typeof detail === 'function') {
        detail({ register });
    }
}

function dispatchAppReady(win: PhantomHostWindow, register: (wallet: unknown) => void): void {
    const detail = { register };
    if (typeof CustomEvent === 'function') {
        try {
            win.dispatchEvent?.(new CustomEvent(WALLET_STANDARD_APP_READY, { detail }) as unknown as WalletStandardEvent);
            return;
        } catch {
            // fall through to a plain event for tests
        }
    }
    win.dispatchEvent?.({ type: WALLET_STANDARD_APP_READY, detail });
}

function collectStandardWallets(win: PhantomHostWindow): {
    wallets: unknown[];
    dispose: () => void;
} {
    const wallets: unknown[] = [];
    const seen = new Set<unknown>();
    const register = (wallet: unknown) => {
        if (!wallet || seen.has(wallet)) {
            return;
        }
        seen.add(wallet);
        wallets.push(wallet);
    };
    const onRegisterWallet = (event: WalletStandardEvent) => {
        invokeRegisterWalletCallback(event.detail, register);
    };
    win.addEventListener?.(WALLET_STANDARD_REGISTER, onRegisterWallet);
    dispatchAppReady(win, register);
    return {
        wallets,
        dispose: () => {
            win.removeEventListener?.(WALLET_STANDARD_REGISTER, onRegisterWallet);
        },
    };
}

function resolveHostWindow(opts?: DetectPhantomOptions): PhantomHostWindow | undefined {
    if (opts?.getWindow) {
        return opts.getWindow();
    }
    if (typeof window === 'undefined') {
        return undefined;
    }
    return window as unknown as PhantomHostWindow;
}

/**
 * Wait briefly for Phantom injection / Wallet Standard registration.
 * Legacy `isPhantom` wins when present; otherwise a standard wallet named Phantom.
 */
export async function detectPhantomProvider(opts?: DetectPhantomOptions): Promise<PhantomProvider | undefined> {
    const win = resolveHostWindow(opts);
    if (!win) {
        return undefined;
    }
    const timeoutMs = opts?.timeoutMs ?? PHANTOM_DETECT_TIMEOUT_MS;
    const intervalMs = opts?.intervalMs ?? PHANTOM_DETECT_INTERVAL_MS;
    const sleep = opts?.sleep ?? defaultSleep;
    const now = opts?.now ?? Date.now;
    const deadline = now() + timeoutMs;
    const collection = collectStandardWallets(win);

    try {
        for (;;) {
            const legacy = getLegacyPhantom(win);
            if (legacy) {
                return legacy;
            }
            const standard = findPhantomStandardWallet(collection.wallets);
            if (standard) {
                return adaptWalletStandardPhantom(standard);
            }
            if (now() >= deadline) {
                return undefined;
            }
            await sleep(intervalMs);
        }
    } finally {
        collection.dispose();
    }
}
