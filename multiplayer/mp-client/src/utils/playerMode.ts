/**
 * Client play-mode flags from Vite env. Opt-in traveler mode uses a separate
 * dev server (port 8081) so the GM tooling client on 8080 stays unchanged.
 *
 * Public hosts (play.chainlords.net / VPS IP) are ALWAYS traveler so GM sandbox
 * menus cannot leak to real players even if a prod build forgot VITE_PLAYER_MODE.
 */

export type PlayerMode = 'gm' | 'traveler';

const TRAVELER_WORLD_ID = 'traveler';

/** Hostnames that must never expose GM tooling UI or a Phantom skip. */
export function isPublicPlayHost(): boolean {
    if (typeof window === 'undefined' || !window.location?.hostname) {
        return false;
    }
    const h = window.location.hostname.toLowerCase();
    return (
        h === 'play.chainlords.net' ||
        h === '178.105.242.156' ||
        h === '46.224.129.38' ||
        h.endsWith('.chainlords.net')
    );
}

/** True when this Vite build is the real-player / traveler experience. */
export function isTravelerPlayerMode(): boolean {
    // Public play URL always traveler (overrides accidental gm prod builds).
    if (isPublicPlayHost()) {
        return true;
    }
    const mode = (import.meta.env.VITE_PLAYER_MODE ?? 'gm').toString().trim().toLowerCase();
    return mode === 'traveler' || mode === 'traveller' || mode === 'player';
}

export function getPlayerMode(): PlayerMode {
    return isTravelerPlayerMode() ? 'traveler' : 'gm';
}

/** World id used for the pre-citizenship traveler zone. */
export function getTravelerWorldId(): string {
    return TRAVELER_WORLD_ID;
}

/** Preferred spawn world sent on AuthenticateRequest in traveler mode. */
export function getPreferredInitialWorldId(): string | undefined {
    return isTravelerPlayerMode() ? TRAVELER_WORLD_ID : undefined;
}

/** Proto `player_mode` string announced to the server on authenticate. */
export function getPlayerModeWireValue(): string {
    return getPlayerMode();
}
