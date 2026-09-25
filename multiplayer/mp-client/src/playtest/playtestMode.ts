/** Shared bypass token — only valid against a PLAYTEST=1 game on loopback. */
export const PLAYTEST_AUTH_TOKEN = 'playtest-bypass-token';

export const PLAYTEST_GAME_HOST = '127.0.0.1';
export const PLAYTEST_GAME_PORT = 31337;

export type PlaytestSeat = {
    seatKey: string;
    accountId: string;
    characterName: string;
    agentLabel: string;
    guildId: string;
};

/** Must match server PlaytestMode.Seats (A+C same guild, B other, no party). */
export const PLAYTEST_SEATS: PlaytestSeat[] = [
    {
        seatKey: 'a',
        accountId: 'playtest-a',
        characterName: 'ElonQa',
        agentLabel: 'Seat A (Elon)',
        guildId: 'QA Guild One',
    },
    {
        seatKey: 'b',
        accountId: 'playtest-b',
        characterName: 'MaggyQa',
        agentLabel: 'Seat B (Maggy)',
        guildId: 'QA Guild Two',
    },
    {
        seatKey: 'c',
        accountId: 'playtest-c',
        characterName: 'PistQa',
        agentLabel: 'Seat C (PIST)',
        guildId: 'QA Guild One',
    },
];

const SEAT_ALIASES: Record<string, string> = {
    elon: 'a',
    maggy: 'b',
    pist: 'c',
};

const STORAGE_KEY = 'helbreath.playtest.seat';

function isLoopbackHostname(hostname: string): boolean {
    const host = hostname.trim().toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

/**
 * True only for a playtest Vite build (VITE_PLAYTEST=1) opened on loopback.
 * Any other host, including play.chainlords.net, forces the door off.
 */
export function isPlaytestClient(): boolean {
    if (typeof window !== 'undefined' && !isLoopbackHostname(window.location.hostname)) {
        return false;
    }
    const raw = (import.meta.env?.VITE_PLAYTEST ?? '').toString().trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes';
}

/** Traveler Vite (:8081): play the seat. GM spawn/edit tools stay hidden. */
export function isPlaytestTravelerClient(): boolean {
    if (!isPlaytestClient()) {
        return false;
    }
    return (import.meta.env.VITE_PLAYER_MODE ?? '').toString().trim().toLowerCase() === 'traveler';
}

/** GM Vite (:8080): same seats, with the existing editor dialogs. */
export function isPlaytestGmClient(): boolean {
    if (!isPlaytestClient()) {
        return false;
    }
    return (import.meta.env.VITE_PLAYER_MODE ?? '').toString().trim().toLowerCase() === 'gm';
}

export function canonicalPlaytestSeatKey(raw: string | null | undefined): string {
    const key = (raw ?? '').trim().toLowerCase();
    if (!key) {
        return 'a';
    }
    return SEAT_ALIASES[key] ?? key;
}

/** Resolve seat from ?seat= / localStorage / default A. */
export function resolvePlaytestSeat(): PlaytestSeat {
    let key = '';
    try {
        const querySeat = new URLSearchParams(window.location.search).get('seat');
        if (querySeat) {
            key = querySeat.trim().toLowerCase();
        }
    } catch (error) {
        console.warn('[playtest] failed to read seat query', error);
    }
    if (!key) {
        try {
            key = (localStorage.getItem(STORAGE_KEY) ?? '').trim().toLowerCase();
        } catch (error) {
            console.warn('[playtest] failed to read stored seat', error);
        }
    }
    const canonical = canonicalPlaytestSeatKey(key || 'a');
    const seat = PLAYTEST_SEATS.find((candidate) => candidate.seatKey === canonical) ?? PLAYTEST_SEATS[0];
    try {
        localStorage.setItem(STORAGE_KEY, seat.seatKey);
    } catch (error) {
        console.warn('[playtest] failed to store seat', error);
    }
    return seat;
}

export function getPlaytestSeat(): PlaytestSeat {
    return resolvePlaytestSeat();
}

/** QA guild layout used by tests (mirrors the server seed). */
export function playtestGuildLayout(): { a: string; b: string; c: string } {
    return {
        a: PLAYTEST_SEATS[0].guildId,
        b: PLAYTEST_SEATS[1].guildId,
        c: PLAYTEST_SEATS[2].guildId,
    };
}
