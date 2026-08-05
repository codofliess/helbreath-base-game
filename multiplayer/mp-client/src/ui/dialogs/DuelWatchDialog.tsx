import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useStore } from '@tanstack/react-store';
import { OlympiaDialogShell, stopOlympiaPointer } from '../components/OlympiaDialogShell';
import { duelWatchStore, setDuelWatchOpen } from '../store/DuelWatch.store';
import {
    fetchCartelera,
    fetchDuelById,
    parseStreamUrl,
    type CarteleraSnapshot,
    type PublicDuel,
    type ParsedStream,
    type WorldBroadcast,
} from '../../utils/duelStreams';
import {
    buildWeekProgram,
    formatDayHeader,
    formatTimeLocal,
    kindBadge,
    type GuideEvent,
} from '../../utils/tvGuide';
import { TOURNAMENT_DIALOG_BG } from '../../constants/SpriteKeys';
import type { IRefPhaserGame } from '../../PhaserGame';
import { getNetworkManager } from '../../utils/RegistryUtils';
import { EventBus } from '../../game/EventBus';
import { TOAST_REQUESTED } from '../../constants/EventNames';

interface DuelWatchDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
    onPositionChange?: (position: { x: number; y: number }) => void;
    phaserRef?: React.RefObject<IRefPhaserGame | null>;
}

/** Default = weekly TV guide (ESPN-style). */
type CarteleraTab = 'guide' | 'watch' | 'pvp' | 'world' | 'tournament';

function CamTile({
    title,
    stream,
    large,
    offlineLabel,
}: {
    title: string;
    stream: ParsedStream | null;
    large?: boolean;
    offlineLabel?: string;
}) {
    const h = large ? 220 : 100;
    return (
        <div
            style={{
                borderRadius: 8,
                border: large ? '2px solid #ffd76a' : '1px solid rgba(160,140,90,0.45)',
                background: 'rgba(0,0,0,0.72)',
                overflow: 'hidden',
                minWidth: large ? 0 : 120,
                flex: large ? '1 1 100%' : '1 1 120px',
                opacity: stream ? 1 : 0.88,
            }}
        >
            <div
                style={{
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: large ? '#ffd76a' : '#c8b89a',
                    borderBottom: '1px solid rgba(100,90,60,0.35)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 6,
                }}
            >
                <span>{title}</span>
                {stream ? (
                    <span style={{ opacity: 0.8 }}>{stream.platform}</span>
                ) : (
                    <span style={{ opacity: 0.45 }}>OFF</span>
                )}
            </div>
            <div style={{ height: h, background: '#08080c' }}>
                {stream?.embedUrl ? (
                    <iframe
                        title={title}
                        src={stream.embedUrl}
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                        style={{ width: '100%', height: '100%', border: 0 }}
                    />
                ) : stream ? (
                    <div
                        style={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: 8,
                            textAlign: 'center',
                            fontSize: 11,
                        }}
                    >
                        <a
                            href={stream.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#7ec8ff', fontWeight: 700 }}
                        >
                            {stream.label} ↗
                        </a>
                    </div>
                ) : (
                    <div
                        style={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0.45,
                            fontSize: 11,
                            padding: 8,
                            textAlign: 'center',
                        }}
                    >
                        <div style={{ fontSize: 18 }}>📺</div>
                        {offlineLabel || 'Waiting for stream'}
                    </div>
                )}
            </div>
        </div>
    );
}

function ProgramRow({
    event,
    onWatch,
}: {
    event: GuideEvent;
    onWatch: (e: GuideEvent) => void;
}) {
    const badge = kindBadge(event.kind);
    const isLive = event.status === 'live';
    const isSoon = event.status === 'soon';
    return (
        <button
            type="button"
            onClick={() => onWatch(event)}
            style={{
                display: 'grid',
                gridTemplateColumns: '64px 72px 1fr auto',
                gap: 8,
                alignItems: 'center',
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                marginBottom: 4,
                borderRadius: 6,
                border: isLive
                    ? '1px solid #e74c3c'
                    : isSoon
                      ? '1px solid #e67e22'
                      : '1px solid rgba(100,90,60,0.4)',
                background: isLive
                    ? 'rgba(80,15,15,0.55)'
                    : isSoon
                      ? 'rgba(80,40,10,0.4)'
                      : 'rgba(16,14,12,0.65)',
                color: '#f5e6c8',
                cursor: 'pointer',
            }}
        >
            <span
                style={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: 12,
                    color: isLive ? '#ff6b6b' : '#ffd76a',
                }}
            >
                {isLive ? 'NOW' : formatTimeLocal(event.startMs)}
            </span>
            <span
                style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0.04,
                    color: badge.color,
                    border: `1px solid ${badge.color}`,
                    borderRadius: 3,
                    padding: '2px 4px',
                    textAlign: 'center',
                }}
            >
                {badge.label}
            </span>
            <span style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.25 }}>{event.title}</div>
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{event.subtitle}</div>
            </span>
            <span
                style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: isLive ? '#7dffb3' : '#9fd4ff',
                    whiteSpace: 'nowrap',
                }}
            >
                {isLive ? '▶ WATCH' : 'INFO'}
            </span>
        </button>
    );
}

/**
 * ESPN / Disney-channel style weekly programming + multi-cam Watch.
 * Stage always present (OFF until streams). Observer seat deferred.
 */
export function DuelWatchDialog({
    position,
    zIndex,
    onBringToFront,
    onPositionChange,
    phaserRef,
}: DuelWatchDialogProps) {
    const isOpen = useStore(duelWatchStore, (s) => s.isOpen);
    const matchId = useStore(duelWatchStore, (s) => s.matchId);
    const [tab, setTab] = useState<CarteleraTab>('guide');
    const [cartelera, setCartelera] = useState<CarteleraSnapshot | null>(null);
    const [selectedDuel, setSelectedDuel] = useState<PublicDuel | null>(null);
    const [focusStream, setFocusStream] = useState<ParsedStream | null>(null);
    const [focusTitle, setFocusTitle] = useState('🌐 CHAIN LORDS · Live stage');
    const [sideCams, setSideCams] = useState<{ title: string; stream: ParsedStream | null }[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [tick, setTick] = useState(0);

    const resolveNm = () => {
        const game = phaserRef?.current?.game;
        return game ? getNetworkManager(game) : undefined;
    };

    const refresh = useCallback(async () => {
        setBusy(true);
        setError(null);
        try {
            const snap = await fetchCartelera();
            setCartelera(snap);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Cartelera offline');
        } finally {
            setBusy(false);
        }
    }, []);

    const program = useMemo(() => {
        return buildWeekProgram({
            pvpLive: cartelera?.stages?.pvp?.live ?? [],
            pvpUpcoming: cartelera?.stages?.pvp?.upcoming ?? [],
            worldLive: cartelera?.stages?.world?.live ?? [],
            tournamentLive: cartelera?.stages?.tournament?.live ?? [],
        });
    }, [cartelera, tick]);

    const openDuel = useCallback(async (id: string) => {
        setBusy(true);
        try {
            const d = await fetchDuelById(id);
            setSelectedDuel(d);
            if (!d) {
                setError('Duel not found.');
                return;
            }
            setTab('watch');
            const global = parseStreamUrl(d.globalStreamUrl);
            const povs = (d.fighters ?? []).map((f) => ({
                title: `📷 ${f.name}`,
                stream: parseStreamUrl(f.streamUrl),
            }));
            const main = global ?? povs.find((p) => p.stream)?.stream ?? null;
            setFocusStream(main);
            setFocusTitle(
                global
                    ? `🌐 ${d.title || 'PVP'} · Global`
                    : main
                      ? `Main · ${d.title || d.hostName}`
                      : `🌐 ${d.title || 'PVP'} · stage OFF (waiting stream)`,
            );
            setSideCams(
                povs.length
                    ? povs
                    : [
                          { title: '📷 Fighter A', stream: null },
                          { title: '📷 Fighter B', stream: null },
                      ],
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Load failed');
        } finally {
            setBusy(false);
        }
    }, []);

    const openWorldStream = (b: WorldBroadcast) => {
        setSelectedDuel(null);
        setTab('watch');
        const s = parseStreamUrl(b.streamUrl);
        setFocusStream(s);
        setFocusTitle(`🌐 ${b.title}`);
        setSideCams([
            { title: `📷 ${b.characterName}`, stream: s },
            { title: '📷 Slot', stream: null },
            { title: '📷 Slot', stream: null },
        ]);
    };

    const onWatchEvent = (e: GuideEvent) => {
        if (e.kind === 'pvp' && e.matchId) {
            void openDuel(e.matchId);
            return;
        }
        if (e.streamUrl) {
            setSelectedDuel(null);
            setTab('watch');
            const s = parseStreamUrl(e.streamUrl);
            setFocusStream(s);
            setFocusTitle(`🌐 ${e.title}`);
            setSideCams([
                { title: '📷 POV', stream: s },
                { title: '📷 Slot', stream: null },
            ]);
            return;
        }
        EventBus.emit(TOAST_REQUESTED, {
            message: 'Evento agendado — todavía no hay link de stream. Volvé cuando esté LIVE.',
            severity: 'info',
        });
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        void refresh();
        if (matchId && matchId !== 'streams') {
            void openDuel(matchId);
        } else {
            setFocusStream(null);
            setFocusTitle('🌐 CHAIN LORDS · Live stage (OFF until streams)');
            setSideCams([
                { title: '📷 PVP A', stream: null },
                { title: '📷 PVP B', stream: null },
                { title: '📷 World', stream: null },
            ]);
            setTab('guide');
        }
        const id = window.setInterval(() => {
            void refresh();
            setTick((t) => t + 1);
        }, 12_000);
        return () => window.clearInterval(id);
    }, [isOpen, matchId, refresh, openDuel]);

    const goLiveWorld = (kind: 'world' | 'tournament') => {
        const nm = resolveNm();
        if (!nm) {
            EventBus.emit(TOAST_REQUESTED, {
                message: 'Entrá al World o Arena para Go Live en la cartelera.',
                severity: 'warning',
            });
            return;
        }
        const platform = window.prompt(
            'Cómo streameás?\n1 = Twitch (nombre canal)\n2 = YouTube (link)\n3 = Discord',
            '1',
        );
        if (platform === null) {
            return;
        }
        let url = '';
        if (platform.trim() === '1') {
            const ch = window.prompt('Canal Twitch (solo nombre):', '');
            if (ch === null) {
                return;
            }
            const c = ch.trim().replace(/^@/, '');
            if (c) {
                url = `https://www.twitch.tv/${c}`;
            }
        } else if (platform.trim() === '2') {
            const link = window.prompt('Link live YouTube:', '');
            if (link === null) {
                return;
            }
            url = link.trim();
        } else {
            const link = window.prompt('Discord invite (opcional) tras compartir pantalla:', '');
            if (link === null) {
                return;
            }
            url = link.trim() || 'https://discord.com';
        }
        if (!url) {
            return;
        }
        const title = window.prompt(
            kind === 'tournament' ? 'Título torneo:' : 'Título (ej: Hunting Middleland):',
            kind === 'tournament' ? 'Tournament live' : 'World live',
        );
        nm.sendStreamBroadcast({ kind, title: title || undefined, streamUrl: url, active: true });
        EventBus.emit(TOAST_REQUESTED, { message: 'En cartelera · Go Live', severity: 'success' });
        window.setTimeout(() => void refresh(), 800);
    };

    if (!isOpen) {
        return null;
    }

    const tabBtn = (id: CarteleraTab, label: string) => (
        <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
                fontWeight: 700,
                fontSize: 11,
                padding: '6px 10px',
                borderRadius: 4,
                border: tab === id ? '2px solid #ffd76a' : '1px solid rgba(160,140,90,0.4)',
                background: tab === id ? 'rgba(80,50,10,0.85)' : 'rgba(20,16,10,0.55)',
                color: '#f5e6c8',
                cursor: 'pointer',
            }}
        >
            {label}
        </button>
    );

    return (
        <OlympiaDialogShell
            id="duel-watch-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onPositionChange={onPositionChange}
            bgSpriteKey={TOURNAMENT_DIALOG_BG}
            rootClassName="duel-watch-dialog-root"
            width={800}
            minHeight={600}
        >
            <div
                className="olympia-dialog-title-bar hb-nemesis-dialog-title"
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    pointerEvents: 'auto',
                    position: 'relative',
                    zIndex: 60,
                    paddingRight: 8,
                }}
            >
                <span style={{ pointerEvents: 'none' }}>CHAIN LORDS TV · Weekly Guide</span>
                <button
                    type="button"
                    onPointerDown={(e) => stopOlympiaPointer(e)}
                    onClick={() => setDuelWatchOpen(false)}
                    style={{
                        pointerEvents: 'auto',
                        zIndex: 70,
                        minWidth: 36,
                        fontSize: 20,
                        fontWeight: 700,
                        color: '#ffd76a',
                        background: 'rgba(40,20,10,0.85)',
                        border: '1px solid #c9a227',
                        borderRadius: 4,
                        cursor: 'pointer',
                    }}
                    aria-label="Close"
                >
                    ×
                </button>
            </div>

            <div
                style={{
                    padding: '10px 14px 14px',
                    color: '#f5e6c8',
                    fontSize: 13,
                    maxHeight: 600,
                    overflowY: 'auto',
                    position: 'relative',
                    zIndex: 5,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                        flexWrap: 'wrap',
                    }}
                >
                    <p style={{ margin: 0, fontSize: 11, opacity: 0.85, lineHeight: 1.4, flex: 1 }}>
                        Programación de la semana · como una grilla ESPN: <strong>EN VIVO</strong> arriba, días
                        abajo. Tocá un evento para ver multi-cam.
                    </p>
                    <button
                        type="button"
                        className="olympia-btn"
                        disabled={busy}
                        onClick={() => void refresh()}
                        style={{ fontSize: 11 }}
                    >
                        {busy ? '…' : 'Refresh'}
                    </button>
                </div>

                {error ? (
                    <p style={{ color: '#ffb0b0', margin: '0 0 8px' }} role="alert">
                        {error}
                    </p>
                ) : null}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {tabBtn('guide', '📅 This week')}
                    {tabBtn('watch', '▶ Watch now')}
                    {tabBtn(
                        'pvp',
                        `PVP (${(cartelera?.stages?.pvp?.live?.length ?? 0) + (cartelera?.stages?.pvp?.upcoming?.length ?? 0)})`,
                    )}
                    {tabBtn('world', `World (${cartelera?.stages?.world?.live?.length ?? 0})`)}
                    {tabBtn('tournament', `Tourney (${cartelera?.stages?.tournament?.live?.length ?? 0})`)}
                </div>

                {/* —— WEEKLY TV GUIDE (default) —— */}
                {tab === 'guide' ? (
                    <div>
                        {/* LIVE NOW strip */}
                        <div
                            style={{
                                marginBottom: 14,
                                padding: 10,
                                borderRadius: 10,
                                border: '1px solid rgba(231,76,60,0.55)',
                                background: 'linear-gradient(180deg, rgba(60,12,12,0.75), rgba(20,8,8,0.85))',
                            }}
                        >
                            <div
                                style={{
                                    fontWeight: 900,
                                    fontSize: 14,
                                    color: '#ff6b6b',
                                    letterSpacing: 0.06,
                                    marginBottom: 8,
                                }}
                            >
                                🔴 LIVE NOW
                            </div>
                            {program.live.length === 0 ? (
                                <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.45 }}>
                                    Nada en vivo todavía — la grilla de la semana ya está lista. Cuando haya
                                    streams de test o duels, aparecen acá con <strong>▶ WATCH</strong>.
                                </div>
                            ) : (
                                program.live.map((e) => (
                                    <ProgramRow key={`live-${e.id}`} event={e} onWatch={onWatchEvent} />
                                ))
                            )}
                        </div>

                        {/* Full schedule list */}
                        <div
                            style={{
                                fontWeight: 900,
                                fontSize: 13,
                                color: '#ffd76a',
                                marginBottom: 8,
                                letterSpacing: 0.04,
                            }}
                        >
                            📋 ALL SCHEDULED DUELS &amp; EVENTS
                        </div>
                        {program.all.filter((e) => e.status !== 'live').length === 0 &&
                        program.live.length === 0 ? (
                            <div
                                style={{
                                    padding: 12,
                                    borderRadius: 8,
                                    border: '1px dashed rgba(160,140,90,0.45)',
                                    fontSize: 12,
                                    opacity: 0.8,
                                    marginBottom: 12,
                                    lineHeight: 1.45,
                                }}
                            >
                                No hay duelos públicos en la agenda. Creá uno con <strong>Publish to cartelera</strong>{' '}
                                o usá <strong>Go Live · World</strong> para testear el stage.
                            </div>
                        ) : (
                            <div style={{ marginBottom: 12 }}>
                                {program.all.map((e) => (
                                    <ProgramRow key={`all-${e.id}-${e.status}`} event={e} onWatch={onWatchEvent} />
                                ))}
                            </div>
                        )}

                        {/* Day-by-day grid */}
                        <div
                            style={{
                                fontWeight: 900,
                                fontSize: 13,
                                color: '#9fd4ff',
                                marginBottom: 8,
                                letterSpacing: 0.04,
                            }}
                        >
                            🗓️ WEEKLY GRID
                        </div>
                        {program.days.map((day) => {
                            const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                            const events = program.byDay.get(key) ?? [];
                            return (
                                <div
                                    key={key}
                                    style={{
                                        marginBottom: 10,
                                        borderRadius: 8,
                                        border: '1px solid rgba(80,90,120,0.35)',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        style={{
                                            padding: '6px 10px',
                                            background: 'rgba(30,40,70,0.55)',
                                            fontWeight: 800,
                                            fontSize: 12,
                                            color: '#b8d4ff',
                                        }}
                                    >
                                        {formatDayHeader(day)}
                                        <span style={{ opacity: 0.7, fontWeight: 500, marginLeft: 8 }}>
                                            {events.length === 0
                                                ? '· open slot'
                                                : `· ${events.length} event${events.length === 1 ? '' : 's'}`}
                                        </span>
                                    </div>
                                    <div style={{ padding: '6px 8px', background: 'rgba(8,10,16,0.5)' }}>
                                        {events.length === 0 ? (
                                            <div style={{ fontSize: 11, opacity: 0.45, padding: '4px 2px' }}>
                                                — no programming —
                                            </div>
                                        ) : (
                                            events.map((e) => (
                                                <ProgramRow
                                                    key={`${key}-${e.id}`}
                                                    event={e}
                                                    onWatch={onWatchEvent}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : null}

                {/* —— WATCH multi-cam —— */}
                {tab === 'watch' ? (
                    <div>
                        <div
                            style={{
                                marginBottom: 10,
                                padding: 10,
                                borderRadius: 10,
                                border: '1px solid rgba(212,175,55,0.4)',
                                background: 'rgba(8,10,16,0.75)',
                            }}
                        >
                            <div
                                style={{
                                    fontWeight: 900,
                                    fontSize: 13,
                                    color: focusStream ? '#ff6b6b' : '#ffd76a',
                                    marginBottom: 8,
                                }}
                            >
                                {focusStream ? '🔴 ON AIR' : '⚫ STAGE READY (OFF)'}
                                {selectedDuel ? ` · ${selectedDuel.title || selectedDuel.hostName}` : ''}
                            </div>
                            <CamTile title={focusTitle} stream={focusStream} large />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                                {(sideCams.length
                                    ? sideCams
                                    : [
                                          { title: '📷 POV A', stream: null as ParsedStream | null },
                                          { title: '📷 POV B', stream: null },
                                          { title: '📷 World', stream: null },
                                      ]
                                ).map((c, i) => (
                                    <CamTile key={`${c.title}-${i}`} title={c.title} stream={c.stream} />
                                ))}
                            </div>
                        </div>
                        <button type="button" className="olympia-btn" onClick={() => setTab('guide')}>
                            ← Back to weekly guide
                        </button>
                    </div>
                ) : null}

                {tab === 'pvp' ? (
                    <div>
                        <p style={{ fontSize: 12, opacity: 0.85, marginTop: 0 }}>
                            Todos los duelos públicos: en vivo y programados. Tocá para ir al multi-cam.
                        </p>
                        <div style={{ fontWeight: 700, color: '#ff6b6b', marginBottom: 6 }}>🔴 Live</div>
                        {(cartelera?.stages?.pvp?.live?.length ?? 0) === 0 ? (
                            <p style={{ opacity: 0.65, fontSize: 12 }}>No PVP live.</p>
                        ) : (
                            cartelera!.stages.pvp.live.map((d) => (
                                <button
                                    key={d.matchId}
                                    type="button"
                                    onClick={() => void openDuel(d.matchId)}
                                    style={listBtnStyle}
                                >
                                    <strong>{d.title || d.hostName}</strong>
                                    <div style={{ fontSize: 11, opacity: 0.85 }}>
                                        {(d.fighters ?? []).map((f) => f.name).join(' vs ') || d.hostName} ·{' '}
                                        {d.mapId}
                                    </div>
                                </button>
                            ))
                        )}
                        <div style={{ fontWeight: 700, color: '#9fd4ff', margin: '12px 0 6px' }}>
                            📅 Scheduled
                        </div>
                        {(cartelera?.stages?.pvp?.upcoming?.length ?? 0) === 0 ? (
                            <p style={{ opacity: 0.65, fontSize: 12 }}>
                                No scheduled public duels. Publish one from Create PVP Duel.
                            </p>
                        ) : (
                            cartelera!.stages.pvp.upcoming.map((d) => (
                                <button
                                    key={d.matchId}
                                    type="button"
                                    onClick={() => void openDuel(d.matchId)}
                                    style={listBtnStyle}
                                >
                                    <strong>{d.title || d.hostName}</strong>
                                    <div style={{ fontSize: 11, opacity: 0.85 }}>
                                        {new Date(d.opensAtMs).toLocaleString()} · {d.mapId} ·{' '}
                                        {(d.fighters ?? []).map((f) => f.name).join(' vs ') || 'TBD'}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                ) : null}

                {tab === 'world' ? (
                    <div>
                        <p style={{ fontSize: 12, opacity: 0.85, marginTop: 0 }}>
                            Helbreath World — hunt / raid streams. Stage multi-cam ready even when empty.
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                            <button
                                type="button"
                                className="olympia-btn"
                                onClick={() => goLiveWorld('world')}
                                style={{ fontWeight: 800, background: '#1a5a8a', border: '1px solid #7ec8ff' }}
                            >
                                Go Live · World
                            </button>
                            <button
                                type="button"
                                className="olympia-btn"
                                onClick={() => {
                                    resolveNm()?.sendStreamBroadcast({
                                        kind: 'world',
                                        streamUrl: 'https://discord.com',
                                        active: false,
                                    });
                                    window.setTimeout(() => void refresh(), 600);
                                }}
                            >
                                Stop Live
                            </button>
                        </div>
                        {(cartelera?.stages?.world?.live?.length ?? 0) === 0 ? (
                            <div style={emptyBoxStyle}>No World streams — slot open for testers.</div>
                        ) : (
                            cartelera!.stages.world.live.map((b) => (
                                <button
                                    key={b.id}
                                    type="button"
                                    onClick={() => openWorldStream(b)}
                                    style={listBtnStyle}
                                >
                                    <strong>{b.title}</strong>
                                    <div style={{ fontSize: 11, opacity: 0.85 }}>{b.characterName}</div>
                                </button>
                            ))
                        )}
                    </div>
                ) : null}

                {tab === 'tournament' ? (
                    <div>
                        <p style={{ fontSize: 12, opacity: 0.85, marginTop: 0 }}>
                            Tournament desk — same weekly guide + multi-cam.
                        </p>
                        <button
                            type="button"
                            className="olympia-btn"
                            onClick={() => goLiveWorld('tournament')}
                            style={{
                                marginBottom: 10,
                                fontWeight: 800,
                                background: '#4a2060',
                                border: '1px solid #c9a0ff',
                            }}
                        >
                            Go Live · Tournament
                        </button>
                        {(cartelera?.stages?.tournament?.live?.length ?? 0) === 0 ? (
                            <div style={emptyBoxStyle}>Tournament grid ready (OFF).</div>
                        ) : (
                            cartelera!.stages.tournament.live.map((b) => (
                                <button
                                    key={b.id}
                                    type="button"
                                    onClick={() => openWorldStream(b)}
                                    style={listBtnStyle}
                                >
                                    <strong>{b.title}</strong>
                                    <div style={{ fontSize: 11, opacity: 0.85 }}>{b.characterName}</div>
                                </button>
                            ))
                        )}
                    </div>
                ) : null}
            </div>
        </OlympiaDialogShell>
    );
}

const listBtnStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    marginBottom: 6,
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid rgba(100,90,60,0.45)',
    background: 'rgba(20,16,10,0.55)',
    color: '#f5e6c8',
    cursor: 'pointer',
};

const emptyBoxStyle: CSSProperties = {
    padding: 12,
    borderRadius: 8,
    border: '1px dashed rgba(120,140,180,0.4)',
    opacity: 0.8,
    fontSize: 12,
};
