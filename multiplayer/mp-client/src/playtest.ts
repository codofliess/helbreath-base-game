/**
 * Compile-time playtest door. Vite inlines `VITE_*` at build time, so a production
 * client built without `VITE_PLAYTEST` has no wallet-skip and no auto-login path.
 *
 * Never point a playtest build or compose stack at play.chainlords.net.
 */

function envFlag(value: string | boolean | undefined): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    const normalized = value?.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function envString(value: string | undefined, fallback: string): string {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

/** True only in a dedicated playtest Vite build or `pnpm dev:playtest`. */
export const IS_PLAYTEST = envFlag(import.meta.env.VITE_PLAYTEST);

/** Display name Elon (or another tester) enters as on the playtest host. */
export const PLAYTEST_CHARACTER_NAME = envString(import.meta.env.VITE_PLAYTEST_CHARACTER_NAME, 'Elon');

/**
 * Stable server save key for the playtest character. Must be a valid filename
 * (no path separators). Matches server `PLAYTEST_NETWORK_ID`.
 */
export const PLAYTEST_NETWORK_ID = envString(import.meta.env.VITE_PLAYTEST_NETWORK_ID, 'playtest-elon');

/** WebSocket port of the playtest game server (not the Vite HTTP port). */
export const PLAYTEST_WS_PORT = (() => {
    const parsed = Number.parseInt(envString(import.meta.env.VITE_PLAYTEST_WS_PORT, '1338'), 10);
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : 1338;
})();

/**
 * Live production host that must never receive a playtest build.
 * Used for docs, banners, and a client-side refuse-to-connect guard.
 */
export const FORBIDDEN_PRODUCTION_PLAY_HOST = 'play.chainlords.net';

export function isForbiddenProductionPlayHost(host: string): boolean {
    const normalized = host.trim().toLowerCase();
    return normalized === FORBIDDEN_PRODUCTION_PLAY_HOST
        || normalized.endsWith(`.${FORBIDDEN_PRODUCTION_PLAY_HOST}`);
}

/**
 * WebSocket host the browser should dial. Defaults to the page hostname so a
 * dedicated playtest VM works without baking localhost into the bundle.
 * `VITE_PLAYTEST_WS_HOST` overrides when the WS host differs from the static host.
 */
export function getPlaytestWsHost(): string {
    const configured = import.meta.env.VITE_PLAYTEST_WS_HOST?.trim();
    if (configured && configured.length > 0) {
        return configured;
    }
    if (typeof window !== 'undefined' && window.location.hostname.length > 0) {
        return window.location.hostname;
    }
    return 'localhost';
}

/** True when this page is being served from the live production play host. */
export function isRunningOnForbiddenProductionHost(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    return isForbiddenProductionPlayHost(window.location.hostname);
}
