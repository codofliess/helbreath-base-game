/**
 * Builds the game-server WebSocket URL for character-list and world sessions.
 *
 * Production is served behind nginx on the same host as the static client
 * (`https://play.chainlords.net` → proxy `/ws` → game :1337). Local dev still
 * talks to `ws://127.0.0.1:1337/ws` directly.
 */

/** True when the host is a loopback address used only in local development. */
export function isLoopbackHost(host: string): boolean {
    const h = host.trim().toLowerCase();
    return h === '127.0.0.1' || h === 'localhost' || h === '::1' || h === '[::1]';
}

/**
 * Resolves ws:// vs wss:// and whether to omit the port (same-origin nginx /ws).
 */
export function buildGameWebSocketUrl(host: string, port: number): string {
    const trimmedHost = host.trim();
    if (!trimmedHost || !Number.isFinite(port) || port < 1 || port > 65535) {
        throw new Error('Invalid host or port for game WebSocket.');
    }

    const pageIsHttps =
        typeof window !== 'undefined' && window.location?.protocol === 'https:';
    const pageHost =
        typeof window !== 'undefined' ? (window.location?.hostname ?? '') : '';
    const pagePort =
        typeof window !== 'undefined' ? (window.location?.port ?? '') : '';

    // Same host as the page (or production host served via nginx): use /ws on
    // the page origin so TLS + reverse-proxy work without exposing :1337.
    const sameHostAsPage =
        pageHost.length > 0 &&
        (trimmedHost === pageHost ||
            trimmedHost === window.location.host ||
            // Host-only match when connect used hostname without port.
            trimmedHost.replace(/:\d+$/, '') === pageHost);

    if (sameHostAsPage && !isLoopbackHost(trimmedHost)) {
        const scheme = pageIsHttps ? 'wss' : 'ws';
        const portPart =
            pagePort && pagePort !== '80' && pagePort !== '443' ? `:${pagePort}` : '';
        return `${scheme}://${pageHost}${portPart}/ws`;
    }

    // Explicit remote / local: pick scheme from page TLS or well-known ports.
    const useTls = pageIsHttps || port === 443;
    const scheme = useTls ? 'wss' : 'ws';
    if (port === 443 || port === 80) {
        return `${scheme}://${trimmedHost}/ws`;
    }
    return `${scheme}://${trimmedHost}:${port}/ws`;
}
