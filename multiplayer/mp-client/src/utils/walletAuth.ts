import { isPlaytestClient } from './playtestMode';

const DEFAULT_MIDDLEWARE_URL = 'http://localhost:3001';
const PROD_MIDDLEWARE_URL =
    'https://chainlords-middleware-production.up.railway.app';

export interface WalletSession {
    wallet: string;
    token: string;
    expiresAt: number;
}

type PhantomProvider = {
    isPhantom?: boolean;
    connect: () => Promise<{ publicKey: { toBase58: () => string } }>;
    signMessage: (
        message: Uint8Array,
        display?: string,
    ) => Promise<{ signature: Uint8Array; publicKey?: { toBase58: () => string } }>;
    request?: (args: { method: string; params: { message: Uint8Array; display: string } }) => Promise<{
        signature: Uint8Array;
        publicKey?: { toBase58: () => string };
    }>;
};

function getPhantom(): PhantomProvider | undefined {
    const w = window as Window & { solana?: PhantomProvider };
    return w.solana?.isPhantom ? w.solana : undefined;
}

export function getMiddlewareAuthUrl(): string {
    if (isPlaytestClient()) {
        return '';
    }
    const fromEnv = (import.meta.env.VITE_MIDDLEWARE_URL ?? '').toString().trim();
    if (fromEnv.length > 0) {
        return fromEnv;
    }
    if (typeof window !== 'undefined' && window.location?.hostname) {
        const h = window.location.hostname.toLowerCase();
        if (h !== 'localhost' && h !== '127.0.0.1' && h !== '[::1]') {
            return PROD_MIDDLEWARE_URL;
        }
    }
    return DEFAULT_MIDDLEWARE_URL;
}

/** Returns the persisted wallet auth token when still valid. */
export function getStoredWalletToken(): string | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }

    try {
        const raw = localStorage.getItem('gameState');
        if (!raw) {
            return undefined;
        }

        const state = JSON.parse(raw) as { authToken?: string; authExpiresAt?: number };
        const token = state.authToken?.trim();
        if (!token) {
            return undefined;
        }

        if (typeof state.authExpiresAt === 'number' && state.authExpiresAt > 0 && state.authExpiresAt <= Date.now()) {
            return undefined;
        }

        return token;
    } catch {
        return undefined;
    }
}

/** Returns the persisted Solana wallet pubkey when the player logged in with Phantom. */
export function getStoredWalletPubkey(): string | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }

    try {
        const raw = localStorage.getItem('gameState');
        if (!raw) {
            return undefined;
        }

        const state = JSON.parse(raw) as { networkId?: string };
        const networkId = state.networkId?.trim();
        if (!networkId || networkId.includes('-')) {
            return undefined;
        }

        if (networkId.length >= 32 && networkId.length <= 44) {
            return networkId;
        }
    } catch {
        return undefined;
    }

    return undefined;
}

function toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

async function requestChallenge(middlewareUrl: string, wallet: string): Promise<{ challenge: string; message: string }> {
    const challengeRes = await fetch(`${middlewareUrl}/auth/challenge?wallet=${encodeURIComponent(wallet)}`);
    if (!challengeRes.ok) {
        throw new Error(`Failed to request wallet login challenge (${challengeRes.status})`);
    }

    return challengeRes.json() as Promise<{ challenge: string; message: string }>;
}

async function signChallengeMessage(phantom: PhantomProvider, message: string) {
    const encoded = new TextEncoder().encode(message);
    return phantom.request
        ? phantom.request({
            method: 'signMessage',
            params: { message: encoded, display: 'utf8' },
        })
        : phantom.signMessage(encoded, 'utf8');
}

/**
 * Persists a verified wallet session into `localStorage.gameState` so hub restore
 * and character-list retries can reuse the seal without another Phantom prompt.
 */
export function persistWalletSession(session: WalletSession): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        const raw = localStorage.getItem('gameState');
        const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        localStorage.setItem(
            'gameState',
            JSON.stringify({
                ...existing,
                networkId: session.wallet,
                authToken: session.token,
                authExpiresAt: session.expiresAt,
            }),
        );
    } catch (err) {
        console.warn('[walletAuth] Failed to persist wallet session', err);
    }
}

export type WalletDeepLink = {
    session: WalletSession;
    /** Landing Play Now sets mode=world → open SELECTCHAR desk. */
    mode: 'world' | 'arena' | 'hub';
};

const DEEP_LINK_STORAGE_KEY = 'helbreath_wallet_deep_link';
const AUTO_ENTER_WORLD_KEY = 'helbreath_auto_enter_world';

/** Peek pending landing deep-link without clearing (URL or sessionStorage). */
export function peekWalletDeepLink(): WalletDeepLink | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const fromUrl = readDeepLinkFromUrl(false);
        if (fromUrl) {
            return fromUrl;
        }
        const raw = sessionStorage.getItem(DEEP_LINK_STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as {
            wallet?: string;
            token?: string;
            expiresAt?: number;
            mode?: string;
        };
        const wallet = parsed.wallet?.trim() ?? '';
        const token = parsed.token?.trim() ?? '';
        if (!wallet || !token) {
            return null;
        }
        const modeRaw = (parsed.mode ?? 'world').trim().toLowerCase();
        const mode: WalletDeepLink['mode'] =
            modeRaw === 'arena' ? 'arena' : modeRaw === 'hub' ? 'hub' : 'world';
        return {
            session: {
                wallet,
                token,
                expiresAt:
                    typeof parsed.expiresAt === 'number' && parsed.expiresAt > Date.now()
                        ? parsed.expiresAt
                        : Date.now() + 24 * 60 * 60 * 1000,
            },
            mode,
        };
    } catch {
        return null;
    }
}

/**
 * Reads landing Play Now deep-link (`?wallet=&token=&mode=world`).
 * Keeps sessionStorage until {@link clearWalletDeepLink} so React Strict Mode
 * remounts / LoginScreen+ConnectDialog can both recover (no one-shot race).
 */
export function consumeWalletDeepLink(): WalletDeepLink | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const fromUrl = readDeepLinkFromUrl(true);
        if (fromUrl) {
            persistWalletSession(fromUrl.session);
            try {
                sessionStorage.setItem(
                    DEEP_LINK_STORAGE_KEY,
                    JSON.stringify({
                        wallet: fromUrl.session.wallet,
                        token: fromUrl.session.token,
                        expiresAt: fromUrl.session.expiresAt,
                        mode: fromUrl.mode,
                    }),
                );
            } catch {
                // private mode / quota
            }
            console.info(
                '[walletAuth] Deep link from URL → mode=%s wallet=%s…%s',
                fromUrl.mode,
                fromUrl.session.wallet.slice(0, 4),
                fromUrl.session.wallet.slice(-4),
            );
            return fromUrl;
        }

        return peekWalletDeepLink();
    } catch (err) {
        console.warn('[walletAuth] Failed to consume wallet deep link', err);
        return null;
    }
}

/** Clears pending deep-link after SELECTCHAR is open (call once desk is applied). */
export function clearWalletDeepLink(): void {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        sessionStorage.removeItem(DEEP_LINK_STORAGE_KEY);
    } catch {
        // ignore
    }
}

/** Call once at app boot so the query string is not lost if LoginScreen starts late. */
export function bootstrapWalletDeepLinkAtBoot(): void {
    if (typeof window === 'undefined') {
        return;
    }
    if (isPlaytestClient()) {
        return;
    }
    try {
        const params = new URLSearchParams(window.location.search);
        const autologin = params.get('autologin') === '1' || params.get('mode') === 'world';
        const link = readDeepLinkFromUrl(true);

        if (link) {
            persistWalletSession(link.session);
            sessionStorage.setItem(
                DEEP_LINK_STORAGE_KEY,
                JSON.stringify({
                    wallet: link.session.wallet,
                    token: link.session.token,
                    expiresAt: link.session.expiresAt,
                    mode: link.mode,
                }),
            );
            console.info('[walletAuth] Bootstrapped deep link at boot (mode=%s)', link.mode);
            return;
        }

        // Landing fallback when middleware auth cannot run on the marketing origin:
        // ?mode=world&autologin=1 → client prompts Phantom and opens SELECTCHAR.
        if (autologin) {
            sessionStorage.setItem(AUTO_ENTER_WORLD_KEY, '1');
            params.delete('autologin');
            params.delete('mode');
            // readDeepLinkFromUrl already stripped wallet/token if present; clean leftovers.
            const qs = params.toString();
            const clean = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
            window.history.replaceState({}, '', clean);
            console.info('[walletAuth] Auto-enter World flag set (client will prompt Phantom)');
        }
    } catch (err) {
        console.warn('[walletAuth] bootstrapWalletDeepLinkAtBoot failed', err);
    }
}

/** True once after landing ?autologin=1 / mode=world without a token (consumes the flag). */
export function consumeAutoEnterWorldFlag(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    try {
        if (sessionStorage.getItem(AUTO_ENTER_WORLD_KEY) !== '1') {
            return false;
        }
        sessionStorage.removeItem(AUTO_ENTER_WORLD_KEY);
        return true;
    } catch {
        return false;
    }
}

/**
 * Strict-Mode-safe auto-enter lock. Returns true only for the first caller until
 * {@link releaseAutoEnterWorldLock} (survives effect remounts).
 */
export function tryAcquireAutoEnterWorldLock(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    try {
        if (sessionStorage.getItem('helbreath_auto_enter_lock') === '1') {
            return false;
        }
        sessionStorage.setItem('helbreath_auto_enter_lock', '1');
        return true;
    } catch {
        return true;
    }
}

export function releaseAutoEnterWorldLock(): void {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        sessionStorage.removeItem('helbreath_auto_enter_lock');
    } catch {
        // ignore
    }
}

function readDeepLinkFromUrl(stripFromAddressBar: boolean): WalletDeepLink | null {
    const params = new URLSearchParams(window.location.search);
    const wallet = params.get('wallet')?.trim() ?? '';
    const token = params.get('token')?.trim() ?? '';
    if (!wallet || !token) {
        return null;
    }

    const expRaw = params.get('exp');
    const expParsed = expRaw ? Number.parseInt(expRaw, 10) : NaN;
    const expiresAt =
        Number.isFinite(expParsed) && expParsed > Date.now()
            ? expParsed
            : Date.now() + 24 * 60 * 60 * 1000;

    const modeRaw = (params.get('mode') ?? 'world').trim().toLowerCase();
    const mode: WalletDeepLink['mode'] =
        modeRaw === 'arena' ? 'arena' : modeRaw === 'hub' ? 'hub' : 'world';

    if (stripFromAddressBar) {
        params.delete('wallet');
        params.delete('token');
        params.delete('exp');
        params.delete('mode');
        const qs = params.toString();
        const clean = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', clean);
    }

    return {
        session: { wallet, token, expiresAt },
        mode,
    };
}

export async function connectWalletAndAuthenticate(): Promise<WalletSession> {
    const phantom = getPhantom();
    if (!phantom) {
        throw new Error('Phantom wallet not found. Install it from phantom.app');
    }

    const { publicKey } = await phantom.connect();
    let wallet = publicKey.toBase58();
    const middlewareUrl = getMiddlewareAuthUrl();

    let challengeBody = await requestChallenge(middlewareUrl, wallet);
    let signed = await signChallengeMessage(phantom, challengeBody.message);
    const signedWallet = signed.publicKey?.toBase58?.() ?? wallet;

    if (signedWallet !== wallet) {
        wallet = signedWallet;
        challengeBody = await requestChallenge(middlewareUrl, wallet);
        signed = await signChallengeMessage(phantom, challengeBody.message);
    }

    const signatureBytes = signed.signature instanceof Uint8Array
        ? signed.signature
        : new Uint8Array(signed.signature as ArrayLike<number>);

    const verifyRes = await fetch(`${middlewareUrl}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            wallet,
            challenge: challengeBody.challenge,
            signature: toBase64(signatureBytes),
        }),
    });

    if (!verifyRes.ok) {
        let detail = 'Wallet signature verification failed';
        try {
            const errorBody = await verifyRes.json() as { error?: string };
            if (errorBody.error) {
                detail = errorBody.error;
            }
        } catch {
            // ignore parse errors
        }
        throw new Error(detail);
    }

    const verifyBody = await verifyRes.json() as {
        wallet: string;
        token: string;
        expiresAt: number;
    };

    const session: WalletSession = {
        wallet: verifyBody.wallet,
        token: verifyBody.token,
        expiresAt: verifyBody.expiresAt,
    };
    persistWalletSession(session);
    return session;
}
