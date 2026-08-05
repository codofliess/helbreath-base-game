/** Parse stream URLs into embeddable players (Twitch / YouTube) or external links (Discord). */

export type StreamPlatform = 'twitch' | 'youtube' | 'discord' | 'other';

export interface ParsedStream {
    platform: StreamPlatform;
    /** Original URL */
    url: string;
    /** iframe src when embeddable; null for Discord Go Live / other */
    embedUrl: string | null;
    /** Channel or video label for UI */
    label: string;
}

export function detectPlatform(url: string): StreamPlatform {
    const u = url.toLowerCase();
    if (u.includes('twitch.tv') || u.includes('twitch.com')) {
        return 'twitch';
    }
    if (u.includes('youtube.com') || u.includes('youtu.be')) {
        return 'youtube';
    }
    if (u.includes('discord') || u.includes('discordapp')) {
        return 'discord';
    }
    return 'other';
}

function twitchParentHosts(): string {
    const hosts = new Set<string>(['play.chainlords.net', 'www.chainlords.net', 'chainlords.net', 'localhost']);
    try {
        if (typeof window !== 'undefined' && window.location?.hostname) {
            hosts.add(window.location.hostname);
        }
    } catch {
        // ignore
    }
    return [...hosts].map((h) => `parent=${encodeURIComponent(h)}`).join('&');
}

export function parseStreamUrl(raw: string | undefined | null): ParsedStream | null {
    if (!raw?.trim()) {
        return null;
    }
    const url = raw.trim();
    let uri: URL;
    try {
        uri = new URL(url);
    } catch {
        return null;
    }
    const platform = detectPlatform(url);
    if (platform === 'twitch') {
        // https://www.twitch.tv/channel or /videos/id
        const parts = uri.pathname.split('/').filter(Boolean);
        const channel = parts[0] && parts[0] !== 'videos' && parts[0] !== 'popout' ? parts[0] : '';
        const videoId = parts[0] === 'videos' && parts[1] ? parts[1] : '';
        const parents = twitchParentHosts();
        if (videoId) {
            return {
                platform,
                url,
                embedUrl: `https://player.twitch.tv/?video=${encodeURIComponent(videoId)}&${parents}&autoplay=false`,
                label: `Twitch VOD ${videoId}`,
            };
        }
        if (channel) {
            return {
                platform,
                url,
                embedUrl: `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&${parents}&autoplay=false`,
                label: `twitch.tv/${channel}`,
            };
        }
    }
    if (platform === 'youtube') {
        let videoId = '';
        if (uri.hostname.includes('youtu.be')) {
            videoId = uri.pathname.replace(/^\//, '').split('/')[0] ?? '';
        } else {
            videoId = uri.searchParams.get('v') ?? '';
            if (!videoId && uri.pathname.includes('/live/')) {
                videoId = uri.pathname.split('/live/')[1]?.split(/[/?]/)[0] ?? '';
            }
            if (!videoId && uri.pathname.includes('/embed/')) {
                videoId = uri.pathname.split('/embed/')[1]?.split(/[/?]/)[0] ?? '';
            }
        }
        if (videoId) {
            return {
                platform,
                url,
                embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=0`,
                label: `YouTube ${videoId}`,
            };
        }
    }
    return {
        platform,
        url,
        embedUrl: null,
        label: platform === 'discord' ? 'Discord Go Live / Stage' : uri.hostname,
    };
}

export interface PublicDuelFighter {
    name: string;
    team: number;
    invitePending?: boolean;
    ready?: boolean;
    streamUrl?: string | null;
    streamPlatform?: string | null;
}

export interface PublicDuel {
    matchId: string;
    status: string;
    mapId: string;
    hostName: string;
    title: string;
    isPublic: boolean;
    opensAtMs: number;
    readyEndsAtMs?: number;
    secondsLeft?: number;
    stakeAssetId?: string | null;
    stakeAmount?: number;
    globalStreamUrl?: string | null;
    globalStreamPlatform?: string | null;
    watchUrl?: string | null;
    fighters: PublicDuelFighter[];
}

function gameHttpBase(): string {
    // Same host as game WS by default (play.chainlords.net nginx proxies /api).
    try {
        const proto = window.location.protocol === 'https:' ? 'https' : 'http';
        return `${proto}//${window.location.host}`;
    } catch {
        return 'https://play.chainlords.net';
    }
}

export async function fetchUpcomingDuels(): Promise<PublicDuel[]> {
    const res = await fetch(`${gameHttpBase()}/api/duels/upcoming`, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`upcoming ${res.status}`);
    }
    const body = (await res.json()) as { duels?: PublicDuel[] };
    return body.duels ?? [];
}

export async function fetchLiveDuels(): Promise<PublicDuel[]> {
    const res = await fetch(`${gameHttpBase()}/api/duels/live`, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`live ${res.status}`);
    }
    const body = (await res.json()) as { duels?: PublicDuel[] };
    return body.duels ?? [];
}

export async function fetchDuelById(matchId: string): Promise<PublicDuel | null> {
    const res = await fetch(`${gameHttpBase()}/api/duels/${encodeURIComponent(matchId)}`, {
        cache: 'no-store',
    });
    if (res.status === 404) {
        return null;
    }
    if (!res.ok) {
        throw new Error(`duel ${res.status}`);
    }
    return (await res.json()) as PublicDuel;
}

export interface WorldBroadcast {
    id: string;
    kind: string;
    title: string;
    characterName: string;
    streamUrl?: string | null;
    streamPlatform?: string | null;
    worldId?: string;
    startedAtMs?: number;
    status?: string;
}

export interface CarteleraSnapshot {
    stageReady: boolean;
    powered: boolean;
    note?: string;
    updatedAtUtc?: string;
    stages: {
        pvp: {
            enabled: boolean;
            label: string;
            live: PublicDuel[];
            upcoming: PublicDuel[];
        };
        world: {
            enabled: boolean;
            label: string;
            description?: string;
            live: WorldBroadcast[];
        };
        tournament: {
            enabled: boolean;
            label: string;
            description?: string;
            live: WorldBroadcast[];
            upcoming?: unknown[];
        };
        other?: {
            enabled: boolean;
            label: string;
            live: WorldBroadcast[];
        };
    };
    allLive?: Array<{
        kind: string;
        id: string;
        title: string;
        status?: string;
        characterName?: string;
        streamUrl?: string | null;
        watchUrl?: string | null;
    }>;
}

export async function fetchCartelera(): Promise<CarteleraSnapshot> {
    const res = await fetch(`${gameHttpBase()}/api/streams`, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`streams ${res.status}`);
    }
    return (await res.json()) as CarteleraSnapshot;
}
