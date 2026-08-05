/**
 * Default game-server endpoint for World / SELECTCHAR flows.
 * Host/port are not shown in the World UI; players never need to type them.
 *
 * Production (play.chainlords.net / VPS IP): connect to the same host as the
 * page so nginx can terminate TLS and proxy `/ws` → game :1337.
 * Local traveler/GM: loopback :1337.
 */

/** Prefer IPv4 loopback — game server often binds 0.0.0.0 only (not [::1]). */
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 1337;

function isBrowserPageRemote(): boolean {
    if (typeof window === 'undefined' || !window.location?.hostname) {
        return false;
    }
    const h = window.location.hostname.toLowerCase();
    return h !== 'localhost' && h !== '127.0.0.1' && h !== '[::1]';
}

/** Resolves the game host from Vite env, page hostname (prod), or localhost. */
export function getDefaultGameHost(): string {
    const fromEnv = (import.meta.env.VITE_GAME_HOST ?? '').toString().trim();
    if (fromEnv.length > 0) {
        return fromEnv;
    }
    if (isBrowserPageRemote()) {
        return window.location.hostname;
    }
    return DEFAULT_HOST;
}

/** Resolves the game port from Vite env, page scheme (prod nginx), or 1337. */
export function getDefaultGamePort(): number {
    const raw = (import.meta.env.VITE_GAME_PORT ?? '').toString().trim();
    if (raw.length > 0) {
        const n = Number.parseInt(raw, 10);
        if (Number.isFinite(n) && n >= 1 && n <= 65535) {
            return n;
        }
    }
    if (isBrowserPageRemote() && typeof window !== 'undefined') {
        // Same-origin nginx: no public :1337 — use standard HTTP(S) ports.
        return window.location.protocol === 'https:' ? 443 : 80;
    }
    return DEFAULT_PORT;
}
