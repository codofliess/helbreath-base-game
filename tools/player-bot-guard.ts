/**
 * Fail-closed target and seat checks for the rules bot.
 * Local PLAYTEST only, no wallet. The playtest token is the loopback door's published bypass.
 * Decisions never read server memory, admin sockets, databases, or logs.
 * Server logs are scored after the run by player-bot-eval.ts and never feed this loop.
 */

export const PLAYTEST_AUTH_TOKEN = 'playtest-bypass-token';

const PRODUCTION_HOSTS = new Set([
    'play.chainlords.net',
    'chainlords.net',
    'www.chainlords.net',
    '64.176.23.40',
]);

export interface PlaytestSeatIdentity {
    seatKey: string;
    /** Tried in order. PR #87 id first, then the consolidacion door id when it differs. */
    accountIds: readonly string[];
    characterName: string;
}

/**
 * Seats from the PLAYTEST door (PR #87) plus the consolidacion door's account ids.
 * Character names stay the published QA names. No wallet keys.
 */
const SEATS: readonly PlaytestSeatIdentity[] = [
    { seatKey: 'elon', accountIds: ['playtest-elonqa', 'playtest-a'], characterName: 'ElonQa' },
    { seatKey: 'maggy', accountIds: ['playtest-maggy', 'playtest-b'], characterName: 'MaggyQa' },
    { seatKey: 'pist', accountIds: ['playtest-pist', 'playtest-c'], characterName: 'PistQa' },
    { seatKey: 'stalk', accountIds: ['playtest-stalk'], characterName: 'StalkQa' },
    { seatKey: 'pulpo', accountIds: ['playtest-pulpo'], characterName: 'PulpoQa' },
    { seatKey: 'proj', accountIds: ['playtest-proj'], characterName: 'ProjQa' },
    { seatKey: 'paio', accountIds: ['playtest-paio'], characterName: 'PaioQa' },
    { seatKey: 'a', accountIds: ['playtest-a', 'playtest-elonqa'], characterName: 'ElonQa' },
    { seatKey: 'b', accountIds: ['playtest-b', 'playtest-maggy'], characterName: 'MaggyQa' },
    { seatKey: 'c', accountIds: ['playtest-c', 'playtest-pist'], characterName: 'PistQa' },
];

const SEAT_ALIASES: Readonly<Record<string, string>> = {
    elonqa: 'elon',
    maggyqa: 'maggy',
    pistqa: 'pist',
};

/** Flags that would pipe server state into the live loop. Presence refuses startup. */
const FORBIDDEN_FLAG_KEYS = new Set([
    'server-state',
    'serverstate',
    'server-log',
    'serverlog',
    'server-memory',
    'servermemory',
    'admin',
    'admin-socket',
    'adminsocket',
    'database',
    'db',
    'telemetry',
    'memory',
    'eval-feedback',
    'feed-bot',
]);

export function normalizeHost(raw: string): string {
    let host = raw.trim().toLowerCase();
    if (host.startsWith('[')) {
        const end = host.indexOf(']');
        host = end > 0 ? host.slice(1, end) : host;
    } else if (host.includes(':') && !host.includes('::')) {
        host = host.slice(0, host.indexOf(':'));
    }
    if (host.endsWith('.')) {
        host = host.slice(0, -1);
    }
    return host;
}

export function splitHostPort(raw: string, fallbackPort: number): { host: string; port: number } {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
        const end = trimmed.indexOf(']');
        const host = end > 0 ? trimmed.slice(1, end) : trimmed;
        const rest = end > 0 ? trimmed.slice(end + 1) : '';
        if (rest.startsWith(':') && rest.length > 1) {
            const port = Number.parseInt(rest.slice(1), 10);
            if (!Number.isInteger(port) || port <= 0 || port > 65535) {
                throw new Error(`Invalid port in --host ${raw}.`);
            }
            return { host, port };
        }
        return { host, port: fallbackPort };
    }
    const colon = trimmed.lastIndexOf(':');
    if (colon > 0 && /^\d+$/.test(trimmed.slice(colon + 1))) {
        const port = Number.parseInt(trimmed.slice(colon + 1), 10);
        if (port <= 0 || port > 65535) {
            throw new Error(`Invalid port in --host ${raw}.`);
        }
        return { host: trimmed.slice(0, colon), port };
    }
    return { host: trimmed, port: fallbackPort };
}

export function isProductionHost(raw: string): boolean {
    const host = normalizeHost(raw);
    if (PRODUCTION_HOSTS.has(host)) {
        return true;
    }
    return host === 'chainlords.net' || host.endsWith('.chainlords.net');
}

export function isLoopbackHost(raw: string): boolean {
    const host = normalizeHost(raw);
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export function isPrivateLanHost(raw: string): boolean {
    const host = normalizeHost(raw);
    const parts = host.split('.');
    if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) {
        return false;
    }
    const octets = parts.map((part) => Number.parseInt(part, 10));
    if (octets.some((octet) => octet < 0 || octet > 255)) {
        return false;
    }
    const [a, b] = octets;
    if (a === 10) {
        return true;
    }
    if (a === 192 && b === 168) {
        return true;
    }
    return a === 172 && b >= 16 && b <= 31;
}

/**
 * Rules-bot targets: loopback, or a private LAN address only when `--playtest` is set.
 * Production names and every public address are refused before any socket opens.
 */
export function assertRulesTargetAllowed(rawHost: string, explicitPlaytest: boolean): void {
    if (isProductionHost(rawHost)) {
        throw new Error(
            `Refusing to start: ${rawHost} is a production host. The rules bot never connects to play.chainlords.net or the public game.`,
        );
    }
    if (isLoopbackHost(rawHost)) {
        return;
    }
    if (explicitPlaytest && isPrivateLanHost(rawHost)) {
        return;
    }
    throw new Error(
        `Refusing to start: ${rawHost} is not localhost/127.0.0.1 and is not an explicit private PLAYTEST address. ` +
        'Pass --playtest only for a private-LAN playtest server. Public hosts are refused.',
    );
}

/** Always-on denylist, including the stress-test path. */
export function assertNotProductionHost(rawHost: string): void {
    if (isProductionHost(rawHost)) {
        throw new Error(
            `Refusing to start: ${rawHost} is a production host. This tool never connects to play.chainlords.net.`,
        );
    }
}

export function assertNoServerStateFlags(argv: readonly string[]): void {
    for (const token of argv) {
        if (!token.startsWith('--')) {
            continue;
        }
        const body = token.slice(2);
        const key = body.split('=')[0]?.trim().toLowerCase() ?? '';
        if (FORBIDDEN_FLAG_KEYS.has(key)) {
            throw new Error(
                `Refusing to start: --${key} would wire server state into the bot. ` +
                'Score a finished run with player-bot-eval.ts instead. That script never feeds the loop.',
            );
        }
    }
}

export function resolvePlaytestSeat(rawSeat: string | undefined): PlaytestSeatIdentity {
    const requested = (rawSeat ?? 'elon').trim().toLowerCase();
    const key = SEAT_ALIASES[requested] ?? requested;
    const seat = SEATS.find((candidate) => candidate.seatKey === key);
    if (!seat) {
        const known = ['elon', 'maggy', 'pist', 'stalk', 'pulpo', 'proj', 'paio', 'a', 'b', 'c'].join(', ');
        throw new Error(`Unknown --seat ${rawSeat}. Known playtest seats: ${known}.`);
    }
    return seat;
}

export function rulesModeRequested(argv: readonly string[]): boolean {
    for (const token of argv) {
        if (!token.startsWith('--')) {
            continue;
        }
        const key = token.slice(2).split('=')[0]?.trim().toLowerCase() ?? '';
        if (key === 'class' || key === 'minutes' || key === 'seat' || key === 'log' || key === 'playtest') {
            return true;
        }
    }
    return false;
}
