import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCartelera, type PublicDuel, type WorldBroadcast } from '../../utils/duelStreams';
import { openDuelWatch } from '../store/DuelWatch.store';

const TWELVE_H_MS = 12 * 60 * 60 * 1000;

function isLiveStatus(st: string | undefined): boolean {
    return (
        st === 'live' ||
        st === 'countdown' ||
        st === 'tech_sample' ||
        st === 'tech_agree' ||
        st === 'ready_window'
    );
}

function fightersLine(d: PublicDuel): string {
    const names = (d.fighters ?? []).map((f) => f.name).filter(Boolean);
    return names.length ? names.join(' vs ') : d.hostName || 'TBD';
}

function fmtWhen(ms: number): string {
    return new Date(ms).toLocaleString(undefined, {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function useCarteleraData() {
    const [worldLive, setWorldLive] = useState<WorldBroadcast[]>([]);
    const [pvpLive, setPvpLive] = useState<PublicDuel[]>([]);
    const [pvpUpcoming, setPvpUpcoming] = useState<PublicDuel[]>([]);
    const [tourLive, setTourLive] = useState<WorldBroadcast[]>([]);
    const [tourUpcoming, setTourUpcoming] = useState<Array<Record<string, unknown>>>([]);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const snap = await fetchCartelera();
            setWorldLive(snap.stages?.world?.live ?? []);
            setPvpLive(snap.stages?.pvp?.live ?? []);
            setPvpUpcoming(snap.stages?.pvp?.upcoming ?? []);
            setTourLive(snap.stages?.tournament?.live ?? []);
            setTourUpcoming(
                Array.isArray(snap.stages?.tournament?.upcoming)
                    ? (snap.stages.tournament.upcoming as Array<Record<string, unknown>>)
                    : [],
            );
            setError(null);
        } catch {
            setError('Cartelera offline');
        }
    }, []);

    useEffect(() => {
        void load();
        const id = window.setInterval(() => void load(), 20_000);
        return () => window.clearInterval(id);
    }, [load]);

    const next12h = useMemo(() => {
        const now = Date.now();
        const horizon = now + TWELVE_H_MS;
        const rows: {
            id: string;
            title: string;
            sub: string;
            live: boolean;
            startMs: number;
            kind: 'pvp' | 'tournament';
        }[] = [];

        for (const d of pvpLive) {
            rows.push({
                id: d.matchId,
                title: d.title || fightersLine(d),
                sub: `PVP · ${d.mapId}`,
                live: true,
                startMs: now,
                kind: 'pvp',
            });
        }
        for (const d of pvpUpcoming) {
            const t = Number(d.opensAtMs) || 0;
            if (t > horizon) {
                continue;
            }
            if (t < now - 60_000 && !isLiveStatus(d.status)) {
                continue;
            }
            rows.push({
                id: d.matchId,
                title: d.title || fightersLine(d),
                sub: `${fmtWhen(t)} · PVP · ${d.mapId}`,
                live: isLiveStatus(d.status),
                startMs: t || now,
                kind: 'pvp',
            });
        }
        for (const t of tourLive) {
            rows.push({
                id: t.id,
                title: t.title || t.characterName || 'Tournament',
                sub: 'Tournament · LIVE',
                live: true,
                startMs: Number(t.startedAtMs) || now,
                kind: 'tournament',
            });
        }
        for (const raw of tourUpcoming) {
            const id = String(raw.id ?? raw.matchId ?? `tour-${rows.length}`);
            const title = String(raw.title ?? raw.name ?? 'Tournament');
            const t = Number(raw.opensAtMs ?? raw.startMs ?? raw.startsAtMs ?? 0);
            if (t > horizon) {
                continue;
            }
            if (t && t < now - 60_000) {
                continue;
            }
            rows.push({
                id,
                title,
                sub: t ? `${fmtWhen(t)} · Tournament` : 'Tournament · soon',
                live: false,
                startMs: t || now + 3_600_000,
                kind: 'tournament',
            });
        }

        rows.sort((a, b) => {
            if (a.live !== b.live) {
                return a.live ? -1 : 1;
            }
            return a.startMs - b.startMs;
        });
        return rows.slice(0, 16);
    }, [pvpLive, pvpUpcoming, tourLive, tourUpcoming]);

    return { worldLive, next12h, error };
}

/** Under Helbreath World portal — fills remaining column height */
export function HubWorldStreamersRail() {
    const { worldLive, error } = useCarteleraData();
    return (
        <div className="hub-rail hub-rail--world hub-rail--in-column hub-rail--mid">
            <h3 className="hub-rail-title">World Streamers</h3>
            <p className="hub-rail-hint">Online hunters &amp; raiders</p>
            {error ? <p className="hub-rail-empty">{error}</p> : null}
            {worldLive.length === 0 ? (
                <p className="hub-rail-empty">No World streamers online yet.</p>
            ) : (
                <ul className="hub-rail-list">
                    {worldLive.map((w) => (
                        <li key={w.id}>
                            <button
                                type="button"
                                className="hub-rail-row is-live"
                                onClick={() => openDuelWatch('streams')}
                            >
                                <span className="hub-rail-badge">LIVE</span>
                                <span className="hub-rail-main">
                                    <strong>{w.characterName}</strong>
                                    <span>{w.title}</span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/** Under Arena rankings — PVP Duels + Tournaments next 12h, LIVE first */
export function HubGlobalPvpRail() {
    const { next12h } = useCarteleraData();
    return (
        <div className="hub-rail hub-rail--arena hub-rail--in-column hub-rail--schedule">
            <h3 className="hub-rail-title">PVPs · Duels · Tournaments</h3>
            <p className="hub-rail-hint">Next 12 hours · LIVE first</p>
            {next12h.length === 0 ? (
                <p className="hub-rail-empty">No public PVP or tournament in the next 12h.</p>
            ) : (
                <ul className="hub-rail-list">
                    {next12h.map((r) => (
                        <li key={`${r.kind}-${r.id}`}>
                            <button
                                type="button"
                                className={`hub-rail-row${r.live ? ' is-live' : ''}`}
                                onClick={() => openDuelWatch(r.kind === 'tournament' ? 'streams' : r.id)}
                            >
                                {r.live ? (
                                    <span className="hub-rail-badge">LIVE</span>
                                ) : (
                                    <span className="hub-rail-badge hub-rail-badge--soon">SOON</span>
                                )}
                                <span className="hub-rail-main">
                                    <strong>{r.title}</strong>
                                    <span>{r.sub}</span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/** @deprecated use HubWorldStreamersRail + HubGlobalPvpRail in columns */
export function HubCarteleraRails() {
    return (
        <div className="hub-cartelera-rails" aria-hidden>
            <HubWorldStreamersRail />
            <div className="hub-rail-spacer" />
            <HubGlobalPvpRail />
        </div>
    );
}
