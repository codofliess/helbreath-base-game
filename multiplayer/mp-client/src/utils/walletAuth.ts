const DEFAULT_MIDDLEWARE_URL = 'http://localhost:3001';
const PROD_MIDDLEWARE_URL =
    'https://chainlords-middleware-production.up.railway.app';

/** Middleware `chainId` for challenge+verify. Same 0x on rh vs base is two binds. */
export type AuthChainId = 'sol' | 'rh' | 'base';

export interface WalletSession {
    wallet: string;
    token: string;
    expiresAt: number;
    chainId?: AuthChainId;
}

type PhantomProvider = {
    isPhantom?: boolean;
    isConnected?: boolean;
    connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toBase58: () => string } }>;
    signMessage: (
        message: Uint8Array,
        display?: string,
    ) => Promise<{ signature: Uint8Array; publicKey?: { toBase58: () => string } }>;
    request?: (args: { method: string; params: { message: Uint8Array; display: string } }) => Promise<{
        signature: Uint8Array;
        publicKey?: { toBase58: () => string };
    }>;
};

export const PHANTOM_SIGN_PENDING_TOAST = 'Approve the signature in the Phantom extension';

type Eip1193Provider = {
    request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
    providers?: Eip1193Provider[];
};

function getPhantom(): PhantomProvider | undefined {
    const w = window as Window & {
        solana?: PhantomProvider;
        phantom?: { solana?: PhantomProvider };
    };
    const injected = w.phantom?.solana ?? w.solana;
    return injected?.isPhantom ? injected : undefined;
}

function getInjectedEvm(): Eip1193Provider | undefined {
    const w = window as Window & {
        ethereum?: Eip1193Provider;
        phantom?: { ethereum?: Eip1193Provider };
    };
    if (w.ethereum?.providers && w.ethereum.providers.length > 0) {
        return w.ethereum.providers[0];
    }
    if (w.ethereum) {
        return w.ethereum;
    }
    return w.phantom?.ethereum;
}

export function isAuthChainId(raw: string | null | undefined): raw is AuthChainId {
    return raw === 'sol' || raw === 'rh' || raw === 'base';
}

const PREFERRED_CHAIN_KEY = 'helbreath_auth_chain';

export function persistPreferredAuthChain(chainId: AuthChainId): void {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        sessionStorage.setItem(PREFERRED_CHAIN_KEY, chainId);
    } catch {
        // private mode / quota
    }
}

/** Landing `?chain=sol|rh|base` or sessionStorage pick for Play Now autologin. */
export function consumePreferredAuthChain(): AuthChainId | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }
    try {
        const params = new URLSearchParams(window.location.search);
        const fromQuery = params.get('chain');
        if (isAuthChainId(fromQuery)) {
            persistPreferredAuthChain(fromQuery);
            params.delete('chain');
            const qs = params.toString();
            const clean = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
            window.history.replaceState({}, '', clean);
            return fromQuery;
        }
        const stored = sessionStorage.getItem(PREFERRED_CHAIN_KEY);
        return isAuthChainId(stored) ? stored : undefined;
    } catch {
        return undefined;
    }
}

export function getMiddlewareAuthUrl(): string {
    const fromEnv = (import.meta.env?.VITE_MIDDLEWARE_URL ?? '').toString().trim();
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

function readStoredGameState(): {
    authToken?: string;
    authExpiresAt?: number;
    networkId?: string;
    authChainId?: string;
} | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }
    try {
        const raw = localStorage.getItem('gameState');
        if (!raw) {
            return undefined;
        }
        return JSON.parse(raw) as {
            authToken?: string;
            authExpiresAt?: number;
            networkId?: string;
            authChainId?: string;
        };
    } catch {
        return undefined;
    }
}

function storedTokenIsExpired(expiresAt: number | undefined): boolean {
    return typeof expiresAt === 'number' && expiresAt > 0 && expiresAt <= Date.now();
}

/** Returns the persisted wallet auth token when still valid. */
export function getStoredWalletToken(): string | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }

    const state = readStoredGameState();
    const token = state?.authToken?.trim();
    if (!token || storedTokenIsExpired(state?.authExpiresAt)) {
        return undefined;
    }
    return token;
}

/** Chain last persisted with the seal (`sol` / `rh` / `base`). */
export function getStoredAuthChainId(): AuthChainId | undefined {
    const raw = readStoredGameState()?.authChainId;
    return isAuthChainId(raw) ? raw : undefined;
}

/**
 * Hub may reuse a verified EVM seal (RH / Base). Phantom Sol must never skip
 * challenge+signMessage just because `localStorage.gameState` still holds a token.
 */
export function getReusableHubWalletSession(): WalletSession | undefined {
    const token = getStoredWalletToken();
    const wallet = getStoredWalletPubkey();
    const chainId = getStoredAuthChainId();
    if (!token || !wallet || !chainId || chainId === 'sol') {
        return undefined;
    }
    const expiresAt = readStoredGameState()?.authExpiresAt;
    return {
        wallet,
        token,
        expiresAt:
            typeof expiresAt === 'number' && expiresAt > Date.now()
                ? expiresAt
                : Date.now() + 24 * 60 * 60 * 1000,
        chainId,
    };
}

/** Drops persisted authToken so the next Phantom connect cannot reuse a stale seal. */
export function clearStoredWalletAuth(): void {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        const raw = localStorage.getItem('gameState');
        const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        delete existing.authToken;
        delete existing.authExpiresAt;
        localStorage.setItem('gameState', JSON.stringify(existing));
    } catch (err) {
        console.warn('[walletAuth] Failed to clear stored wallet auth', err);
    }
}

function looksLikeEvmAddress(value: string): boolean {
    return /^0x[0-9a-fA-F]{40}$/.test(value);
}

/** Returns the persisted wallet address from Phantom (sol) or EVM (rh/base) login. */
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

        if (looksLikeEvmAddress(networkId)) {
            return networkId;
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

function utf8ToHex(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let hex = '0x';
    for (const byte of bytes) {
        hex += byte.toString(16).padStart(2, '0');
    }
    return hex;
}

async function requestChallenge(
    middlewareUrl: string,
    chainId: AuthChainId,
    address: string,
): Promise<{ challenge: string; challengeId?: string; message: string }> {
    const qs = new URLSearchParams({
        chainId,
        address,
        wallet: address,
    });
    const challengeRes = await fetch(`${middlewareUrl}/auth/challenge?${qs.toString()}`);
    if (!challengeRes.ok) {
        throw new Error(`Failed to request wallet login challenge (${challengeRes.status})`);
    }

    return challengeRes.json() as Promise<{ challenge: string; challengeId?: string; message: string }>;
}

async function signChallengeMessage(phantom: PhantomProvider, message: string) {
    const encoded = new TextEncoder().encode(message);
    // Prefer signMessage — Kind/Chrome injects `request` but that path often skips the popup.
    if (typeof phantom.signMessage === 'function') {
        return phantom.signMessage(encoded, 'utf8');
    }
    if (phantom.request) {
        return phantom.request({
            method: 'signMessage',
            params: { message: encoded, display: 'utf8' },
        });
    }
    throw new Error('Phantom wallet cannot sign messages');
}

async function verifySignature(
    middlewareUrl: string,
    chainId: AuthChainId,
    address: string,
    challengeId: string,
    signature: string,
): Promise<WalletSession> {
    const verifyRes = await fetch(`${middlewareUrl}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chainId,
            address,
            wallet: address,
            challenge: challengeId,
            challengeId,
            signature,
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
        wallet?: string | null;
        token?: string;
        expiresAt?: number;
    };

    const resolvedWallet = (verifyBody.wallet || address).trim();
    const token = (verifyBody.token ?? '').trim();
    if (!resolvedWallet || !token) {
        throw new Error('Wallet verification did not return a session');
    }

    return {
        wallet: resolvedWallet,
        token,
        expiresAt:
            typeof verifyBody.expiresAt === 'number' && verifyBody.expiresAt > Date.now()
                ? verifyBody.expiresAt
                : Date.now() + 24 * 60 * 60 * 1000,
        chainId,
    };
}

/**
 * Persists a verified wallet session into `localStorage.gameState` so hub restore
 * and character-list retries can reuse the seal without another wallet prompt.
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
                authChainId: session.chainId ?? existing.authChainId,
            }),
        );
        if (session.chainId) {
            persistPreferredAuthChain(session.chainId);
        }
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
            chainId?: string;
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
                chainId: isAuthChainId(parsed.chainId) ? parsed.chainId : undefined,
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
                        chainId: fromUrl.session.chainId,
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
    try {
        const params = new URLSearchParams(window.location.search);
        const autologin = params.get('autologin') === '1' || params.get('mode') === 'world';
        const chainFromQuery = params.get('chain');
        if (isAuthChainId(chainFromQuery)) {
            persistPreferredAuthChain(chainFromQuery);
        }
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
                    chainId: link.session.chainId,
                }),
            );
            console.info('[walletAuth] Bootstrapped deep link at boot (mode=%s)', link.mode);
            return;
        }

        // Landing fallback when middleware auth cannot run on the marketing origin:
        // ?mode=world&autologin=1 → client prompts the chosen wallet and opens SELECTCHAR.
        if (autologin) {
            sessionStorage.setItem(AUTO_ENTER_WORLD_KEY, '1');
            params.delete('autologin');
            params.delete('mode');
            params.delete('chain');
            const qs = params.toString();
            const clean = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
            window.history.replaceState({}, '', clean);
            console.info('[walletAuth] Auto-enter World flag set (client will prompt wallet)');
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
    const chainRaw = params.get('chain');

    if (stripFromAddressBar) {
        params.delete('wallet');
        params.delete('token');
        params.delete('exp');
        params.delete('mode');
        params.delete('chain');
        const qs = params.toString();
        const clean = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', clean);
    }

    return {
        session: {
            wallet,
            token,
            expiresAt,
            chainId: isAuthChainId(chainRaw) ? chainRaw : undefined,
        },
        mode,
    };
}

export type ConnectWalletAuthOptions = {
    /** Drop any cached token before challenge (always on for Phantom Sol). */
    forceFresh?: boolean;
    /** Fired after connect() once signMessage is waiting on the extension UI. */
    onSignPending?: () => void;
};

async function connectSolanaAndAuthenticate(onSignPending?: () => void): Promise<WalletSession> {
    const phantom = getPhantom();
    if (!phantom) {
        throw new Error('Phantom wallet not found. Install it from phantom.app');
    }

    const { publicKey } = await phantom.connect({ onlyIfTrusted: false });
    let wallet = publicKey.toBase58();
    const middlewareUrl = getMiddlewareAuthUrl();

    let challengeBody = await requestChallenge(middlewareUrl, 'sol', wallet);
    onSignPending?.();
    let signed = await signChallengeMessage(phantom, challengeBody.message);
    const signedWallet = signed.publicKey?.toBase58?.() ?? wallet;

    if (signedWallet !== wallet) {
        wallet = signedWallet;
        challengeBody = await requestChallenge(middlewareUrl, 'sol', wallet);
        onSignPending?.();
        signed = await signChallengeMessage(phantom, challengeBody.message);
    }

    const signatureBytes = signed.signature instanceof Uint8Array
        ? signed.signature
        : new Uint8Array(signed.signature as ArrayLike<number>);

    const challengeId = challengeBody.challengeId || challengeBody.challenge;
    return verifySignature(middlewareUrl, 'sol', wallet, challengeId, toBase64(signatureBytes));
}

async function connectEvmAndAuthenticate(chainId: 'rh' | 'base'): Promise<WalletSession> {
    const eth = getInjectedEvm();
    if (!eth || typeof eth.request !== 'function') {
        const hint = chainId === 'base'
            ? 'Install Coinbase Wallet, MetaMask, or Phantom (EVM) for Base.'
            : 'Install Robinhood Wallet, MetaMask, or another injected EVM wallet for RH Chain.';
        throw new Error(`No EVM wallet found. ${hint}`);
    }

    const accounts = await eth.request({ method: 'eth_requestAccounts' });
    const list = Array.isArray(accounts) ? accounts : [];
    const address = typeof list[0] === 'string' ? list[0].trim() : '';
    if (!looksLikeEvmAddress(address)) {
        throw new Error('EVM wallet did not return a valid address');
    }

    const middlewareUrl = getMiddlewareAuthUrl();
    const challengeBody = await requestChallenge(middlewareUrl, chainId, address);
    const hexMessage = utf8ToHex(challengeBody.message);
    let signature: unknown;
    try {
        signature = await eth.request({
            method: 'personal_sign',
            params: [hexMessage, address],
        });
    } catch {
        signature = await eth.request({
            method: 'personal_sign',
            params: [challengeBody.message, address],
        });
    }
    if (typeof signature !== 'string' || !signature.trim()) {
        throw new Error('Wallet did not return a personal_sign signature');
    }

    const challengeId = challengeBody.challengeId || challengeBody.challenge;
    return verifySignature(middlewareUrl, chainId, address, challengeId, signature.trim());
}

/**
 * Connect + challenge + verify for `sol` (Phantom), `rh`, or `base` (EIP-1193 personal_sign).
 * Phantom Sol always clears a stale token and requires a fresh signMessage.
 */
export async function connectWalletAndAuthenticate(
    chainId: AuthChainId = 'sol',
    options?: ConnectWalletAuthOptions,
): Promise<WalletSession> {
    persistPreferredAuthChain(chainId);
    if (chainId === 'sol' || options?.forceFresh) {
        clearStoredWalletAuth();
    }
    const session = chainId === 'sol'
        ? await connectSolanaAndAuthenticate(options?.onSignPending)
        : await connectEvmAndAuthenticate(chainId);
    persistWalletSession(session);
    return session;
}
