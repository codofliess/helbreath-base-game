import type { PublicDuel, WorldBroadcast } from './duelStreams';

export type GuideKind = 'pvp' | 'world' | 'tournament' | 'other';

export interface GuideEvent {
    id: string;
    kind: GuideKind;
    title: string;
    subtitle: string;
    /** When the event is scheduled to start / went live */
    startMs: number;
    endMs?: number;
    status: 'live' | 'upcoming' | 'soon' | 'done';
    mapId?: string;
    streamUrl?: string | null;
    watchUrl?: string | null;
    /** For duel open */
    matchId?: string;
    fighters?: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfLocalDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

/** 7 days starting from today (local). */
export function weekDaysFromToday(now = new Date()): Date[] {
    const start = startOfLocalDay(now);
    return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY_MS));
}

export function dayKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function formatDayHeader(d: Date, now = new Date()): string {
    const today = startOfLocalDay(now).getTime();
    const t = startOfLocalDay(d).getTime();
    const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
    const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (t === today) {
        return `Today · ${weekday} ${md}`;
    }
    if (t === today + DAY_MS) {
        return `Tomorrow · ${weekday} ${md}`;
    }
    return `${weekday} ${md}`;
}

export function formatTimeLocal(ms: number): string {
    return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function duelToGuideEvent(d: PublicDuel, nowMs = Date.now()): GuideEvent {
    const live =
        d.status === 'live' ||
        d.status === 'countdown' ||
        d.status === 'tech_sample' ||
        d.status === 'tech_agree' ||
        d.status === 'ready_window';
    const fighters = (d.fighters ?? []).map((f) => f.name).filter(Boolean);
    const startMs = live && d.opensAtMs < nowMs ? nowMs : Number(d.opensAtMs) || nowMs;
    let status: GuideEvent['status'] = 'upcoming';
    if (live) {
        status = 'live';
    } else if (startMs - nowMs < 30 * 60_000) {
        status = 'soon';
    }
    const stake =
        d.stakeAmount && Number(d.stakeAmount) > 0
            ? `Bolsa ${d.stakeAmount} ${d.stakeAssetId || 'USDT'}`
            : 'Honor';
    return {
        id: d.matchId,
        kind: 'pvp',
        title: d.title || `PVP · ${d.hostName}`,
        subtitle: `${fighters.join(' vs ') || d.hostName} · ${d.mapId} · ${stake}`,
        startMs,
        status,
        mapId: d.mapId,
        streamUrl: d.globalStreamUrl || d.fighters?.find((f) => f.streamUrl)?.streamUrl,
        watchUrl: d.watchUrl,
        matchId: d.matchId,
        fighters,
    };
}

export function broadcastToGuideEvent(b: WorldBroadcast, kind: GuideKind): GuideEvent {
    return {
        id: b.id,
        kind,
        title: b.title || `${kind} · ${b.characterName}`,
        subtitle: `${b.characterName}${b.worldId ? ` · ${b.worldId}` : ''} · ${b.streamPlatform || 'stream'}`,
        startMs: Number(b.startedAtMs) || Date.now(),
        status: 'live',
        streamUrl: b.streamUrl,
    };
}

export function buildWeekProgram(opts: {
    pvpLive: PublicDuel[];
    pvpUpcoming: PublicDuel[];
    worldLive: WorldBroadcast[];
    tournamentLive: WorldBroadcast[];
    now?: Date;
}): { days: Date[]; byDay: Map<string, GuideEvent[]>; live: GuideEvent[]; all: GuideEvent[] } {
    const now = opts.now ?? new Date();
    const nowMs = now.getTime();
    const days = weekDaysFromToday(now);
    const weekEnd = startOfLocalDay(days[6]!).getTime() + DAY_MS;

    const all: GuideEvent[] = [];
    for (const d of opts.pvpLive) {
        all.push(duelToGuideEvent(d, nowMs));
    }
    for (const d of opts.pvpUpcoming) {
        all.push(duelToGuideEvent(d, nowMs));
    }
    for (const w of opts.worldLive) {
        all.push(broadcastToGuideEvent(w, 'world'));
    }
    for (const t of opts.tournamentLive) {
        all.push(broadcastToGuideEvent(t, 'tournament'));
    }

    // Dedupe by id
    const seen = new Set<string>();
    const unique = all.filter((e) => {
        if (seen.has(e.id)) {
            return false;
        }
        seen.add(e.id);
        return true;
    });

    const live = unique
        .filter((e) => e.status === 'live')
        .sort((a, b) => a.startMs - b.startMs);

    const byDay = new Map<string, GuideEvent[]>();
    for (const day of days) {
        byDay.set(dayKey(day), []);
    }

    for (const e of unique) {
        if (e.status === 'live') {
            // Also pin live under today
            const todayK = dayKey(startOfLocalDay(now));
            byDay.get(todayK)?.push(e);
            continue;
        }
        if (e.startMs < startOfLocalDay(now).getTime() || e.startMs >= weekEnd) {
            // Outside this week window — still list under nearest day if soon
            if (e.startMs >= nowMs && e.startMs < weekEnd) {
                // ok
            } else if (e.startMs < nowMs) {
                continue;
            } else {
                continue;
            }
        }
        const k = dayKey(startOfLocalDay(new Date(e.startMs)));
        if (!byDay.has(k)) {
            byDay.set(k, []);
        }
        byDay.get(k)!.push(e);
    }

    for (const [, list] of byDay) {
        list.sort((a, b) => {
            if (a.status === 'live' && b.status !== 'live') {
                return -1;
            }
            if (b.status === 'live' && a.status !== 'live') {
                return 1;
            }
            return a.startMs - b.startMs;
        });
    }

    return { days, byDay, live, all: unique.sort((a, b) => a.startMs - b.startMs) };
}

export function kindBadge(kind: GuideKind): { label: string; color: string } {
    switch (kind) {
        case 'pvp':
            return { label: 'PVP', color: '#e74c3c' };
        case 'world':
            return { label: 'WORLD', color: '#3498db' };
        case 'tournament':
            return { label: 'TOURNEY', color: '#9b59b6' };
        default:
            return { label: 'LIVE', color: '#95a5a6' };
    }
}
