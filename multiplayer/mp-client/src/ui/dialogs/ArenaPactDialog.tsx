import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { OlympiaDialogShell, stopOlympiaPointer } from '../components/OlympiaDialogShell';
import {
    arenaPactDialogStore,
    setArenaPactDialogOpen,
    setArenaPactPreferredMap,
    setPendingArenaPactCreate,
    setPendingArenaPactRespond,
} from '../store/ArenaPactDialog.store';
import { EventBus } from '../../game/EventBus';
import {
    ARENA_PACT_LIST_RECEIVED,
    ARENA_PACT_STATE_RECEIVED,
    INITIAL_GAME_WORLD_STATE_RECEIVED,
    IN_UI_CONNECT_TO_SERVER,
    TOAST_REQUESTED,
} from '../../constants/EventNames';
import { ARENA_MAPS } from '../../constants/ArenaKitCatalog';
import type { ArenaPactListResponse, ArenaPactState } from '../../proto/generated/network';
import type { IRefPhaserGame } from '../../PhaserGame';
import { getNetworkManager } from '../../utils/RegistryUtils';
import { getDefaultGameHost, getDefaultGamePort } from '../../utils/serverDefaults';
import { connectDialogStore } from '../store/ConnectDialog.store';

interface ArenaPactDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
    onPositionChange?: (position: { x: number; y: number }) => void;
    phaserRef?: React.RefObject<IRefPhaserGame | null>;
}

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

function formatClock(totalSec: number): string {
    const s = Math.max(0, Math.floor(totalSec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${pad2(r)}`;
}

/** Human relative time for schedule pickers (timezone-safe "how long from now"). */
function formatRelativeFromNow(targetMs: number, nowMs: number): string {
    const delta = targetMs - nowMs;
    const abs = Math.abs(delta);
    const sec = Math.floor(abs / 1000);
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const parts: string[] = [];
    if (days > 0) {
        parts.push(`${days}d`);
    }
    if (hours > 0 || days > 0) {
        parts.push(`${hours}h`);
    }
    parts.push(`${mins}m`);
    const body = parts.join(' ');
    if (Math.abs(delta) < 45_000) {
        return 'Opens essentially now (within ~1 min)';
    }
    if (delta > 0) {
        return `Opens in ${body}`;
    }
    return `That time was ${body} ago — pick a future time or use a quick button`;
}

function formatLocalAndUtc(ms: number): { local: string; utc: string; tz: string } {
    const d = new Date(ms);
    const tz =
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        `UTC${d.getTimezoneOffset() <= 0 ? '+' : '-'}${pad2(Math.floor(Math.abs(d.getTimezoneOffset()) / 60))}`;
    return {
        local: d.toLocaleString(undefined, {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }),
        utc: d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
        tz,
    };
}

function statusLabel(status: string): string {
    switch (status) {
        case 'scheduled':
            return 'Scheduled — waiting for open time';
        case 'ready_window':
            return 'Ready window — press Ready';
        case 'tech_sample':
            return 'On map — measuring tech photo';
        case 'tech_agree':
            return 'Pre-countdown — agree tech / infra';
        case 'countdown':
            return 'Countdown';
        case 'live':
            return 'Fight live';
        case 'done':
            return 'Finished';
        case 'cancelled':
            return 'Cancelled';
        case 'expired':
            return 'Expired';
        default:
            return status;
    }
}

type TechMode = 'as_is' | 'equalize_ping' | 'fixed_delay';
type StreamGuidePlatform = 'none' | 'discord' | 'twitch' | 'youtube';

const TECH_MODE_HELP: Record<TechMode, string> = {
    as_is: 'No artificial delay. Fight with real ping/FPS. Full transparency only.',
    equalize_ping:
        'Delay the better connections toward the worst ping (within min–max ms caps). Recommended for stakes.',
    fixed_delay: 'Same fixed input delay for everyone (uses Max ms). Symmetric feel.',
};

/** Build a clean stream URL from the simple fields (channel name / paste). */
function buildStreamUrlFromGuide(
    platform: StreamGuidePlatform,
    twitchChannel: string,
    pasteUrl: string,
): string {
    if (platform === 'none') {
        return '';
    }
    const pasted = pasteUrl.trim();
    if (pasted.startsWith('http://') || pasted.startsWith('https://')) {
        return pasted;
    }
    if (platform === 'twitch') {
        const ch = (twitchChannel || pasted).trim().replace(/^@/, '').replace(/\/+$/, '');
        if (!ch) {
            return '';
        }
        // Accept "twitch.tv/foo" without scheme
        if (ch.toLowerCase().includes('twitch.tv/')) {
            const path = ch.replace(/^https?:\/\//i, '');
            return `https://${path}`;
        }
        return `https://www.twitch.tv/${ch}`;
    }
    return pasted;
}

function StreamGuidePanel({
    platform,
    onPlatform,
    twitchChannel,
    onTwitchChannel,
    pasteUrl,
    onPasteUrl,
    showAdvancedGlobal,
    globalUrl,
    onGlobalUrl,
}: {
    platform: StreamGuidePlatform;
    onPlatform: (p: StreamGuidePlatform) => void;
    twitchChannel: string;
    onTwitchChannel: (v: string) => void;
    pasteUrl: string;
    onPasteUrl: (v: string) => void;
    showAdvancedGlobal: boolean;
    globalUrl: string;
    onGlobalUrl: (v: string) => void;
}) {
    const chip = (id: StreamGuidePlatform, label: string) => (
        <button
            key={id}
            type="button"
            className="olympia-btn"
            onClick={() => onPlatform(id)}
            style={{
                fontWeight: 700,
                fontSize: 12,
                padding: '6px 10px',
                background: platform === id ? 'rgba(80,50,10,0.9)' : 'rgba(20,16,10,0.6)',
                border: platform === id ? '2px solid #ffd76a' : '1px solid rgba(160,140,90,0.45)',
                color: '#f5e6c8',
                cursor: 'pointer',
            }}
        >
            {label}
        </button>
    );

    return (
        <div
            style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 10,
                border: '1px solid rgba(100, 140, 200, 0.35)',
                background: 'rgba(12, 20, 36, 0.55)',
            }}
        >
            <div style={{ fontWeight: 800, color: '#9fd4ff', marginBottom: 6, fontSize: 14 }}>
                How will fans watch you? (optional)
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 11, opacity: 0.85, lineHeight: 1.45 }}>
                No hace falta ser pro. Elegí una app, seguí los pasos, y listo. Si no streameás, dejá{' '}
                <strong>No stream</strong>.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {chip('none', 'No stream')}
                {chip('discord', 'Discord')}
                {chip('twitch', 'Twitch')}
                {chip('youtube', 'YouTube')}
            </div>

            {platform === 'none' ? (
                <p style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>
                    El duel se puede jugar igual. Fans solo verán el horario en la cartelera (si publicás).
                </p>
            ) : null}

            {platform === 'discord' ? (
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                    <ol style={{ margin: '0 0 10px', paddingLeft: 18 }}>
                        <li>
                            Abrí <strong>Discord</strong> (app de escritorio) e iniciá sesión.
                        </li>
                        <li>
                            Entrá a un canal de voz del server Chain Lords (o uno tuyo).
                        </li>
                        <li>
                            Abajo a la izquierda: <strong>Compartir pantalla</strong> /{' '}
                            <strong>Screen Share</strong> → elegí la ventana del browser con el juego.
                        </li>
                        <li>
                            (Opcional) Si tenés invite del canal, pegalo abajo para que fans sepan dónde
                            unirse.
                        </li>
                    </ol>
                    <label style={{ display: 'block', marginBottom: 6 }}>
                        Invite o link del canal (opcional)
                        <input
                            type="text"
                            placeholder="https://discord.gg/…  o  dejá vacío si solo avisás en voz"
                            value={pasteUrl}
                            onChange={(e) => onPasteUrl(e.target.value)}
                            style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                        />
                    </label>
                    <p style={{ margin: 0, fontSize: 11, opacity: 0.75, color: '#9fd4ff' }}>
                        Tip: Discord no se embebe en la web como Twitch. El Watch mostrará un botón “Abrir en
                        Discord”. Con compartir pantalla ya es tu POV en vivo.
                    </p>
                </div>
            ) : null}

            {platform === 'twitch' ? (
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                    <ol style={{ margin: '0 0 10px', paddingLeft: 18 }}>
                        <li>
                            Creá cuenta en <strong>twitch.tv</strong> si no tenés.
                        </li>
                        <li>
                            Instalá <strong>OBS</strong> (gratis) o usá el Studio de Twitch.
                        </li>
                        <li>
                            En OBS: Fuente → Captura de ventana → elegí el browser del juego → Iniciar
                            transmisión.
                        </li>
                        <li>
                            Solo necesitamos tu <strong>nombre de canal</strong> (no el link largo).
                        </li>
                    </ol>
                    <label style={{ display: 'block', marginBottom: 6 }}>
                        Tu canal Twitch
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <span style={{ opacity: 0.8 }}>twitch.tv/</span>
                            <input
                                type="text"
                                placeholder="tunombre"
                                value={twitchChannel}
                                onChange={(e) => onTwitchChannel(e.target.value)}
                                style={{ flex: 1, minWidth: 120 }}
                                autoCapitalize="off"
                                autoCorrect="off"
                            />
                        </div>
                    </label>
                    <p style={{ margin: 0, fontSize: 11, opacity: 0.75 }}>
                        Ejemplo: si tu canal es <code>twitch.tv/pepe</code>, escribí solo <strong>pepe</strong>.
                    </p>
                </div>
            ) : null}

            {platform === 'youtube' ? (
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                    <ol style={{ margin: '0 0 10px', paddingLeft: 18 }}>
                        <li>
                            En YouTube Studio → <strong>Transmitir en vivo</strong> (o Live).
                        </li>
                        <li>
                            Cuando esté al aire, copiá el link del video en vivo (barra del navegador).
                        </li>
                        <li>Pegalo abajo. Tiene que verse como youtube.com/watch?v=… o youtu.be/…</li>
                    </ol>
                    <label style={{ display: 'block' }}>
                        Link del live
                        <input
                            type="url"
                            placeholder="https://www.youtube.com/watch?v=…"
                            value={pasteUrl}
                            onChange={(e) => onPasteUrl(e.target.value)}
                            style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                        />
                    </label>
                </div>
            ) : null}

            {showAdvancedGlobal ? (
                <details style={{ marginTop: 12, fontSize: 11, opacity: 0.9 }}>
                    <summary style={{ cursor: 'pointer', color: '#c8b89a' }}>
                        Avanzado: cámara global / cast (opcional)
                    </summary>
                    <p style={{ margin: '8px 0 6px', lineHeight: 1.4 }}>
                        Solo si alguien transmite un plano amplio o multi-PC. La mayoría puede dejarlo vacío —
                        el POV del host ya es la cam principal.
                    </p>
                    <input
                        type="url"
                        placeholder="https://… (opcional)"
                        value={globalUrl}
                        onChange={(e) => onGlobalUrl(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                </details>
            ) : null}
        </div>
    );
}

/**
 * Create PVP Duel: host sets open date + hour + minute,
 * then a 15-minute Ready window runs; when ALL Ready → 5s countdown → fight.
 */
export function ArenaPactDialog({
    position,
    zIndex,
    onBringToFront,
    onPositionChange,
    phaserRef,
}: ArenaPactDialogProps) {
    const isOpen = useStore(arenaPactDialogStore, (s) => s.isOpen);
    const kitJson = useStore(arenaPactDialogStore, (s) => s.pendingKitJson);
    const kitName = useStore(arenaPactDialogStore, (s) => s.pendingKitName);
    const mapId = useStore(arenaPactDialogStore, (s) => s.preferredMapId);
    const pendingCreate = useStore(arenaPactDialogStore, (s) => s.pendingCreate);

    const nowLocal = useMemo(() => new Date(), [isOpen]);
    const [dateStr, setDateStr] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    });
    const [hour, setHour] = useState(() => new Date().getHours());
    const [minute, setMinute] = useState(() => Math.min(59, new Date().getMinutes() + 5));
    const [readyWindowMin, setReadyWindowMin] = useState(15);
    const [inviteName, setInviteName] = useState('');
    /** Bolsa $ each fighter posts (0 = Honor). Escrow later — recorded on match for now. */
    const [stakeAmount, setStakeAmount] = useState(0);
    /** Publish on cartelera + Discord Events. */
    const [isPublic, setIsPublic] = useState(true);
    const [duelTitle, setDuelTitle] = useState('');
    const [hostStreamUrl, setHostStreamUrl] = useState('');
    const [globalStreamUrl, setGlobalStreamUrl] = useState('');
    const [streamGuide, setStreamGuide] = useState<StreamGuidePlatform>('none');
    const [twitchChannel, setTwitchChannel] = useState('');
    const [streamPaste, setStreamPaste] = useState('');
    const [match, setMatch] = useState<ArenaPactState | null>(null);
    const pendingRespond = useStore(arenaPactDialogStore, (s) => s.pendingRespond);
    const [openList, setOpenList] = useState<ArenaPactState[]>([]);
    const [statusHint, setStatusHint] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const [fpsSample, setFpsSample] = useState<number | undefined>(undefined);
    const [techMode, setTechMode] = useState<TechMode>('equalize_ping');
    const [techMinMs, setTechMinMs] = useState(0);
    const [techMaxMs, setTechMaxMs] = useState(120);
    const [techFpsFloor, setTechFpsFloor] = useState(30);
    const [techApplyMovement, setTechApplyMovement] = useState(false);
    const [captainDelayMs, setCaptainDelayMs] = useState<number | undefined>(undefined);

    const resolveNm = () => {
        const game = phaserRef?.current?.game;
        return game ? getNetworkManager(game) : undefined;
    };

    // Live clock refresh for seconds_left display + schedule banner
    useEffect(() => {
        if (!isOpen) {
            return;
        }
        const id = window.setInterval(() => setTick((t) => t + 1), 1000);
        return () => window.clearInterval(id);
    }, [isOpen]);

    // Lightweight FPS sample while duel panel is open (for tech transparency report).
    useEffect(() => {
        if (!isOpen) {
            return;
        }
        let frames = 0;
        let last = performance.now();
        let raf = 0;
        const loop = (now: number) => {
            frames++;
            if (now - last >= 1000) {
                setFpsSample(frames);
                frames = 0;
                last = now;
            }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [isOpen]);

    // During tech_sample (and tech_agree), stream tech reports so the server can freeze a photo.
    useEffect(() => {
        if (!isOpen || !match?.matchId) {
            return;
        }
        if (match.status !== 'tech_sample' && match.status !== 'tech_agree') {
            return;
        }
        const matchId = match.matchId;
        const push = () => {
            const nm = resolveNm();
            if (!nm) {
                return;
            }
            const p = nm.getLatestPing();
            const v = nm.getLatestPingVariance();
            nm.sendArenaPactTechReport(matchId, {
                pingMs: typeof p === 'number' ? Math.round(p) : 0,
                pingVarianceMs: typeof v === 'number' ? Math.round(v) : 0,
                fps: typeof fpsSample === 'number' ? fpsSample : 0,
            });
        };
        push();
        const id = window.setInterval(push, 500);
        return () => window.clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, match?.matchId, match?.status, fpsSample, phaserRef]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        const onState = (state: ArenaPactState) => {
            // Server "none" / empty = error or left duel — clear card so we don't show ghost UI.
            if (!state.matchId || state.status === 'none') {
                setMatch(null);
                if (state.message) {
                    setStatusHint(state.message);
                    EventBus.emit(TOAST_REQUESTED, {
                        message: state.message,
                        severity: 'warning',
                    });
                }
                return;
            }
            setMatch(state);
            if (state.message) {
                setStatusHint(state.message);
            }
            if (state.techMode === 'as_is' || state.techMode === 'equalize_ping' || state.techMode === 'fixed_delay') {
                setTechMode(state.techMode);
            }
            if (state.techParamMinMs !== undefined) {
                setTechMinMs(state.techParamMinMs);
            }
            if (state.techParamMaxMs !== undefined) {
                setTechMaxMs(state.techParamMaxMs);
            }
            if (state.techFpsFloor !== undefined) {
                setTechFpsFloor(state.techFpsFloor);
            }
            if (state.techApplyToMovement !== undefined) {
                setTechApplyMovement(!!state.techApplyToMovement);
            }
            if (state.yourDelayMs !== undefined) {
                setCaptainDelayMs(state.yourDelayMs);
            }
            if (state.status === 'tech_sample') {
                EventBus.emit(TOAST_REQUESTED, {
                    message: 'On map: measuring ping/FPS for the tech photo…',
                    severity: 'info',
                });
            } else if (state.status === 'tech_agree') {
                EventBus.emit(TOAST_REQUESTED, {
                    message: 'TECH PHOTO ready — use Accept tech below (or propose buffer).',
                    severity: 'info',
                });
            } else if (state.status === 'countdown') {
                EventBus.emit(TOAST_REQUESTED, {
                    message: `Tech locked — fight in ${state.secondsLeft}s!`,
                    severity: 'info',
                });
            } else if (state.status === 'ready_window') {
                EventBus.emit(TOAST_REQUESTED, {
                    message: 'Ready window open — use the green READY button in this panel.',
                    severity: 'info',
                });
            }
        };
        const onList = (list: ArenaPactListResponse) => {
            setOpenList(list.matches ?? []);
        };
        EventBus.on(ARENA_PACT_STATE_RECEIVED, onState);
        EventBus.on(ARENA_PACT_LIST_RECEIVED, onList);
        resolveNm()?.sendArenaPactList();
        return () => {
            EventBus.off(ARENA_PACT_STATE_RECEIVED, onState);
            EventBus.off(ARENA_PACT_LIST_RECEIVED, onList);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, phaserRef]);

    // After connect (pending create from lobby), send create once NM is live.
    useEffect(() => {
        if (!pendingCreate || !kitJson) {
            return;
        }
        let inviteQueued = pendingCreate.inviteName?.trim() || '';
        const tryFlush = () => {
            const nm = resolveNm();
            if (!nm) {
                return false;
            }
            nm.sendArenaPactCreate({
                mapId: pendingCreate.mapId,
                arenaKitJson: kitJson,
                opensAtMs: pendingCreate.opensAtMs,
                readyWindowSec: pendingCreate.readyWindowSec,
                stakeAssetId: pendingCreate.stakeAmount && pendingCreate.stakeAmount > 0
                    ? pendingCreate.stakeAssetId || 'USDT'
                    : undefined,
                stakeAmount: pendingCreate.stakeAmount && pendingCreate.stakeAmount > 0
                    ? pendingCreate.stakeAmount
                    : undefined,
                isPublic: pendingCreate.isPublic,
                title: pendingCreate.title,
                hostStreamUrl: pendingCreate.hostStreamUrl,
                globalStreamUrl: pendingCreate.globalStreamUrl,
            });
            if (inviteQueued) {
                setInviteName(inviteQueued);
            }
            setPendingArenaPactCreate(null);
            setStatusHint(
                pendingCreate.opensAtMs === 0
                    ? `Ready on ${pendingCreate.mapId} — warping to PVP map…`
                    : 'PVP duel created on server…',
            );
            EventBus.emit(TOAST_REQUESTED, {
                message:
                    pendingCreate.opensAtMs === 0
                        ? `Entering ${pendingCreate.mapId} for Ready window.`
                        : 'PVP duel created. Invite is queued even if opponent is offline.',
                severity: 'success',
            });
            return true;
        };
        if (tryFlush()) {
            return;
        }
        const onJoin = () => {
            window.setTimeout(() => tryFlush(), 400);
        };
        EventBus.on(INITIAL_GAME_WORLD_STATE_RECEIVED, onJoin);
        const poll = window.setInterval(() => {
            if (tryFlush()) {
                window.clearInterval(poll);
            }
        }, 500);
        return () => {
            EventBus.off(INITIAL_GAME_WORLD_STATE_RECEIVED, onJoin);
            window.clearInterval(poll);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingCreate, kitJson, phaserRef]);

    // After hub Accept / 4Honor: send respond once in world.
    useEffect(() => {
        if (!pendingRespond || !kitJson) {
            return;
        }
        const tryFlush = () => {
            const nm = resolveNm();
            if (!nm) {
                return false;
            }
            nm.sendArenaPactRespond(
                pendingRespond.matchId,
                true,
                kitJson,
                pendingRespond.mode === 'honor' ? 'honor' : 'accept',
            );
            setPendingArenaPactRespond(null);
            setArenaPactDialogOpen(true);
            setStatusHint(
                pendingRespond.mode === 'honor'
                    ? 'Accepted for Honor (no stake).'
                    : 'Invite accepted.',
            );
            return true;
        };
        if (tryFlush()) {
            return;
        }
        const onJoin = () => {
            window.setTimeout(() => tryFlush(), 500);
        };
        EventBus.on(INITIAL_GAME_WORLD_STATE_RECEIVED, onJoin);
        const poll = window.setInterval(() => {
            if (tryFlush()) {
                window.clearInterval(poll);
            }
        }, 500);
        return () => {
            EventBus.off(INITIAL_GAME_WORLD_STATE_RECEIVED, onJoin);
            window.clearInterval(poll);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingRespond, kitJson, phaserRef]);

    // Auto-invite after create when invite name is set and we have a match.
    useEffect(() => {
        if (!match?.matchId || !inviteName.trim() || !resolveNm()) {
            return;
        }
        const already = (match.fighters ?? []).some(
            (f) => f.characterName?.toLowerCase() === inviteName.trim().toLowerCase(),
        );
        if (already) {
            return;
        }
        // Only auto-invite once shortly after create while still host-only roster.
        if ((match.fighters?.length ?? 0) > 1) {
            return;
        }
        const t = window.setTimeout(() => {
            resolveNm()?.sendArenaPactInvite(match.matchId, inviteName.trim());
        }, 600);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [match?.matchId]);

    if (!isOpen) {
        return null;
    }

    void tick; // re-render each second for clocks
    const nm = resolveNm();
    const inGame = !!nm;

    const computeOpensAtMs = (): number | null => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
        if (!m) {
            return null;
        }
        const y = Number(m[1]);
        const mo = Number(m[2]) - 1;
        const d = Number(m[3]);
        const h = Math.max(0, Math.min(23, Math.floor(hour)));
        const min = Math.max(0, Math.min(59, Math.floor(minute)));
        const local = new Date(y, mo, d, h, min, 0, 0);
        if (Number.isNaN(local.getTime())) {
            return null;
        }
        return local.getTime();
    };

    const enterArenaWithKit = () => {
        if (!kitJson || !kitName) {
            EventBus.emit(TOAST_REQUESTED, {
                message: 'No kit attached — complete a Pre-Ready fighter first.',
                severity: 'warning',
            });
            return;
        }
        let kit: {
            name: string;
            gender: 'male' | 'female';
            skinColor: number;
            hairStyleIndex: number;
            underwearColorIndex: number;
        };
        try {
            kit = JSON.parse(kitJson) as typeof kit;
        } catch {
            EventBus.emit(TOAST_REQUESTED, { message: 'Invalid kit JSON.', severity: 'error' });
            return;
        }
        const walletSession = connectDialogStore.state.walletSession;
        if (!walletSession) {
            EventBus.emit(TOAST_REQUESTED, {
                message: 'Connect wallet first.',
                severity: 'warning',
            });
            return;
        }
        const skin = kit.skinColor === 1 ? 'tanned' : kit.skinColor === 2 ? 'dark' : 'light';
        const targetMap = mapId || 'colosseum';
        EventBus.emit(IN_UI_CONNECT_TO_SERVER, {
            host: getDefaultGameHost(),
            port: getDefaultGamePort(),
            characterName: kit.name || kitName,
            slotIndex: 0,
            preferredInitialWorldId: targetMap,
            gender: kit.gender === 'female' ? 'female' : 'male',
            skinColor: skin,
            hairStyleIndex: kit.hairStyleIndex ?? 0,
            underwearColorIndex: kit.underwearColorIndex ?? 0,
            str: 14,
            vit: 12,
            dex: 12,
            int: 11,
            mag: 11,
            chr: 10,
            walletSession,
            arenaKitJson: kitJson,
        });
    };

    const createPvpDuel = () => {
        if (!kitJson || !kitName) {
            EventBus.emit(TOAST_REQUESTED, {
                message: 'Need a complete Pre-Ready kit (Edit Fighter first).',
                severity: 'warning',
            });
            return;
        }
        const opensAtMs = computeOpensAtMs();
        if (opensAtMs === null) {
            EventBus.emit(TOAST_REQUESTED, {
                message: 'Invalid date / time.',
                severity: 'warning',
            });
            return;
        }
        const readyWindowSec = Math.max(60, Math.min(3600, readyWindowMin * 60));
        const when = new Date(opensAtMs);
        const whenLabel = `${when.toLocaleDateString()} ${pad2(when.getHours())}:${pad2(when.getMinutes())}`;

        const stake = Math.max(0, Math.floor(stakeAmount));
        const resolvedHostStream =
            buildStreamUrlFromGuide(streamGuide, twitchChannel, streamPaste) ||
            hostStreamUrl.trim() ||
            undefined;
        if (resolvedHostStream) {
            setHostStreamUrl(resolvedHostStream);
        }
        const createPayload = {
            mapId,
            opensAtMs,
            readyWindowSec,
            inviteName: inviteName.trim() || undefined,
            stakeAssetId: stake > 0 ? 'USDT' : undefined,
            stakeAmount: stake > 0 ? stake : undefined,
            isPublic,
            title: duelTitle.trim() || undefined,
            hostStreamUrl: resolvedHostStream,
            globalStreamUrl: globalStreamUrl.trim() || undefined,
        };

        if (!inGame) {
            setPendingArenaPactCreate(createPayload);
            setStatusHint(`Entering ${mapId} to schedule duel at ${whenLabel}…`);
            enterArenaWithKit();
            return;
        }

        nm!.sendArenaPactCreate({
            mapId,
            arenaKitJson: kitJson,
            opensAtMs,
            readyWindowSec,
            stakeAssetId: createPayload.stakeAssetId,
            stakeAmount: createPayload.stakeAmount,
            isPublic: createPayload.isPublic,
            title: createPayload.title,
            hostStreamUrl: createPayload.hostStreamUrl,
            globalStreamUrl: createPayload.globalStreamUrl,
        });
        // Invite is auto-sent when match state arrives (see effect on match.matchId + inviteName).
        setStatusHint(`Creating PVP duel — opens ${whenLabel}, then ${readyWindowMin} min Ready.`);
        EventBus.emit(TOAST_REQUESTED, {
            message: `PVP duel scheduled for ${whenLabel}.${stake > 0 ? ` Bolsa ${stake} USDT each.` : ' For Honor.'}`,
            severity: 'success',
        });
    };

    const invite = () => {
        if (!nm || !match?.matchId) {
            EventBus.emit(TOAST_REQUESTED, {
                message: 'Create a duel first, then invite.',
                severity: 'warning',
            });
            return;
        }
        const name = inviteName.trim();
        if (!name) {
            EventBus.emit(TOAST_REQUESTED, { message: 'Enter opponent name.', severity: 'warning' });
            return;
        }
        nm.sendArenaPactInvite(match.matchId, name);
    };

    const collectTechReport = () => {
        const ping = nm?.getLatestPing();
        const variance = nm?.getLatestPingVariance();
        return {
            pingMs: typeof ping === 'number' ? Math.round(ping) : undefined,
            pingVarianceMs: typeof variance === 'number' ? Math.round(variance) : undefined,
            fps: typeof fpsSample === 'number' ? fpsSample : undefined,
        };
    };

    const setReady = (ready: boolean) => {
        if (!nm || !match?.matchId) {
            return;
        }
        if (match.status !== 'ready_window') {
            EventBus.emit(TOAST_REQUESTED, {
                message:
                    match.status === 'scheduled'
                        ? 'Ready unlocks at the scheduled open time.'
                        : 'Ready only during the Ready window.',
                severity: 'info',
            });
            return;
        }
        nm.sendArenaPactReady(match.matchId, ready, kitJson ?? undefined, collectTechReport());
    };

    const applyOpensInMinutes = (mins: number) => {
        const d = new Date(Date.now() + Math.max(0, mins) * 60_000);
        setDateStr(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
        setHour(d.getHours());
        setMinute(d.getMinutes());
    };

    const respond = (mode: 'accept' | 'decline' | 'honor') => {
        if (!nm || !match?.matchId) {
            return;
        }
        nm.sendArenaPactRespond(
            match.matchId,
            mode !== 'decline',
            kitJson ?? undefined,
            mode,
        );
    };

    const cancel = () => {
        if (!nm || !match?.matchId) {
            return;
        }
        nm.sendArenaPactCancel(match.matchId);
        setMatch(null);
        setStatusHint('Duel cancelled.');
    };

    /** Close the panel and return to Arena desk / game (keeps scheduled duel on server if any). */
    const goBack = () => {
        setArenaPactDialogOpen(false);
    };

    /** Cancel active duel (if any) then close the panel. */
    const cancelAndClose = () => {
        if (nm && match?.matchId) {
            nm.sendArenaPactCancel(match.matchId);
        }
        setMatch(null);
        setStatusHint(null);
        setArenaPactDialogOpen(false);
    };

    const proposeTech = () => {
        if (!nm || !match?.matchId) {
            return;
        }
        nm.sendArenaPactTechPropose({
            matchId: match.matchId,
            mode: techMode,
            paramMinMs: techMinMs,
            paramMaxMs: techMaxMs,
            fpsFloor: techFpsFloor,
            applyToMovement: techApplyMovement,
        });
    };

    const voteTech = (accept: boolean) => {
        if (!nm || !match?.matchId) {
            return;
        }
        nm.sendArenaPactTechVote(match.matchId, accept);
    };

    const phaseColor =
        match?.status === 'countdown'
            ? '#ff6b6b'
            : match?.status === 'tech_sample'
              ? '#7ec8ff'
              : match?.status === 'tech_agree'
                ? '#c9a0ff'
                : match?.status === 'ready_window'
                  ? '#7dffb3'
                  : match?.status === 'live'
                    ? '#ffd76a'
                    : '#9fd4ff';

    return (
        <OlympiaDialogShell
            id="arena-pact-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onPositionChange={onPositionChange}
            bgSpriteKey={undefined}
            rootClassName="arena-pact-dialog-root olympia-dialog-fallback"
            width={520}
            minHeight={560}
        >
            <div
                className="olympia-dialog-title-bar hb-nemesis-dialog-title arena-pact-title-bar"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    pointerEvents: 'auto',
                    position: 'relative',
                    zIndex: 60,
                }}
            >
                <span style={{ pointerEvents: 'none' }}>Create PVP Duel</span>
                <button
                    type="button"
                    className="olympia-dialog-close arena-pact-close-btn"
                    aria-label="Close"
                    title="Close"
                    onPointerDown={(e) => {
                        stopOlympiaPointer(e);
                        e.preventDefault();
                    }}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        goBack();
                    }}
                    style={{
                        pointerEvents: 'auto',
                        position: 'relative',
                        zIndex: 70,
                        minWidth: 36,
                        minHeight: 32,
                        margin: 0,
                        padding: '4px 10px',
                        fontSize: 22,
                        lineHeight: 1,
                        fontWeight: 700,
                        cursor: 'pointer',
                        color: '#ffd76a',
                        background: 'rgba(40,20,10,0.85)',
                        border: '1px solid #c9a227',
                        borderRadius: 4,
                    }}
                >
                    ×
                </button>
            </div>

            <div
                className="arena-pact-dialog-body"
                style={{
                    padding: '12px 16px',
                    color: '#f5e6c8',
                    fontSize: 14,
                    maxHeight: 520,
                    overflowY: 'auto',
                    position: 'relative',
                    zIndex: 5,
                    pointerEvents: 'auto',
                }}
            >
                <p style={{ margin: '0 0 10px', opacity: 0.9 }}>
                    Fighter: <strong>{kitName ?? '—'}</strong>
                    {!inGame ? (
                        <span style={{ marginLeft: 8, color: '#e8b86d' }}>
                            (lobby — create enters {mapId})
                        </span>
                    ) : (
                        <span style={{ marginLeft: 8, color: '#7dffb3' }}>(in arena)</span>
                    )}
                </p>

                {statusHint ? (
                    <p
                        style={{
                            margin: '0 0 12px',
                            padding: '8px 10px',
                            borderRadius: 6,
                            background: 'rgba(20,40,60,0.55)',
                            border: '1px solid #4a7aaa',
                            color: '#9fd4ff',
                        }}
                    >
                        {statusHint}
                    </p>
                ) : null}

                {match && match.matchId ? (
                    <div
                        style={{
                            border: `1px solid ${phaseColor}`,
                            borderRadius: 10,
                            padding: 12,
                            marginBottom: 12,
                            background: 'rgba(0,0,0,0.35)',
                        }}
                    >
                        <div style={{ fontWeight: 700, color: phaseColor, marginBottom: 6 }}>
                            {statusLabel(match.status)}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>
                            {match.mapId} · host {match.hostName}
                            {match.stakeAmount && Number(match.stakeAmount) > 0
                                ? ` · bolsa ${String(match.stakeAmount)} ${match.stakeAssetId || 'USDT'} each`
                                : ' · for Honor'}
                            {match.opensAtMs
                                ? ` · opens ${new Date(Number(match.opensAtMs)).toLocaleString()}`
                                : ''}
                        </div>

                        {(match.status === 'scheduled' ||
                            match.status === 'ready_window' ||
                            match.status === 'tech_sample' ||
                            match.status === 'tech_agree' ||
                            match.status === 'countdown' ||
                            match.status === 'live') && (
                            <div style={{ fontSize: 28, fontWeight: 800, margin: '8px 0', color: phaseColor }}>
                                {match.status === 'scheduled' && 'Opens in '}
                                {match.status === 'ready_window' && 'Ready ends in '}
                                {match.status === 'tech_sample' && 'Measuring tech '}
                                {match.status === 'tech_agree' && 'Agree tech · window '}
                                {match.status === 'countdown' && 'Fight in '}
                                {match.status === 'live' && 'Match '}
                                {formatClock(match.secondsLeft)}
                            </div>
                        )}

                        {match.status === 'tech_sample' && (
                            <div
                                style={{
                                    margin: '10px 0 14px',
                                    padding: 12,
                                    borderRadius: 10,
                                    border: '1px solid #7ec8ff',
                                    background: 'rgba(10,30,50,0.55)',
                                }}
                            >
                                <div style={{ fontWeight: 800, fontSize: 16, color: '#9fd4ff', marginBottom: 8 }}>
                                    On map — tech photo in progress
                                </div>
                                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>
                                    Server is collecting ping / variance / FPS from every fighter for a few seconds.
                                    Stay on the map. When the photo freezes, captains choose buffer or as-is.
                                </p>
                                <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12 }}>
                                    {(match.fighters ?? []).map((f) => (
                                        <li key={`sample-${f.team}-${f.characterName}`}>
                                            {f.characterName}:{' '}
                                            {f.pingMs ? `${f.pingMs}ms` : 'ping…'}
                                            {f.fps ? ` · ${f.fps} fps` : ''}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {match.status === 'tech_agree' && (
                            <div
                                style={{
                                    margin: '10px 0 14px',
                                    padding: 12,
                                    borderRadius: 10,
                                    border: '1px solid #c9a0ff',
                                    background: 'rgba(40,20,60,0.55)',
                                }}
                            >
                                <div style={{ fontWeight: 800, fontSize: 16, color: '#e0c4ff', marginBottom: 8 }}>
                                    TECH PHOTO · Captains agree buffer
                                </div>
                                <p style={{ margin: '0 0 10px', fontSize: 12, lineHeight: 1.4, opacity: 0.9 }}>
                                    Photo is frozen. If DE vs AR (or any big gap), pick equalize / fixed delay and
                                    caps. <strong>Everyone Accepts</strong> → countdown. Live combat applies the
                                    locked buffer on melee hits.
                                </p>
                                <div
                                    style={{
                                        fontSize: 13,
                                        marginBottom: 10,
                                        padding: 8,
                                        borderRadius: 6,
                                        background: 'rgba(0,0,0,0.35)',
                                        color: '#9fd4ff',
                                    }}
                                >
                                    <div>
                                        <strong>PHOTO</strong> worst ping{' '}
                                        <strong>
                                            {match.techWorstPingMs !== undefined
                                                ? `${match.techWorstPingMs}ms`
                                                : '—'}
                                        </strong>
                                        {' · '}
                                        lowest FPS{' '}
                                        <strong>
                                            {match.techLowestFps !== undefined ? match.techLowestFps : '—'}
                                        </strong>
                                    </div>
                                    {match.techProposedBy ? (
                                        <div style={{ marginTop: 4, opacity: 0.85 }}>
                                            Proposal by <strong>{match.techProposedBy}</strong>
                                        </div>
                                    ) : null}
                                    <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
                                        {(match.fighters ?? []).map((f) => (
                                            <li key={`photo-${f.team}-${f.characterName}`}>
                                                {f.characterName}: ping {f.pingMs ?? '—'}ms
                                                {f.pingVarianceMs ? ` σ${f.pingVarianceMs}` : ''}
                                                {f.fps ? ` · ${f.fps}fps` : ''}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                                    {(
                                        [
                                            ['as_is', '1) As-is (no equalize)'],
                                            ['equalize_ping', '2) Equalize to worst ping'],
                                            ['fixed_delay', '3) Fixed delay for all'],
                                        ] as const
                                    ).map(([mode, label]) => (
                                        <label
                                            key={mode}
                                            style={{
                                                display: 'block',
                                                padding: '8px 10px',
                                                borderRadius: 6,
                                                border:
                                                    techMode === mode
                                                        ? '1px solid #e0c4ff'
                                                        : '1px solid rgba(200,160,255,0.25)',
                                                background:
                                                    techMode === mode ? 'rgba(80,40,120,0.4)' : 'rgba(0,0,0,0.2)',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <input
                                                type="radio"
                                                name="tech-mode"
                                                checked={techMode === mode}
                                                onChange={() => setTechMode(mode)}
                                                style={{ marginRight: 8 }}
                                            />
                                            <strong>{label}</strong>
                                            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4, marginLeft: 22 }}>
                                                {TECH_MODE_HELP[mode]}
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                <div
                                    style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 10,
                                        alignItems: 'center',
                                        marginBottom: 10,
                                    }}
                                >
                                    <label>
                                        Min delay ms{' '}
                                        <input
                                            type="number"
                                            min={0}
                                            max={500}
                                            value={techMinMs}
                                            onChange={(e) => setTechMinMs(Number(e.target.value))}
                                            style={{ width: 64, marginLeft: 4 }}
                                            disabled={techMode === 'as_is'}
                                        />
                                    </label>
                                    <label>
                                        Max delay ms{' '}
                                        <input
                                            type="number"
                                            min={0}
                                            max={500}
                                            value={techMaxMs}
                                            onChange={(e) => setTechMaxMs(Number(e.target.value))}
                                            style={{ width: 64, marginLeft: 4 }}
                                            disabled={techMode === 'as_is'}
                                        />
                                    </label>
                                    <label>
                                        FPS floor{' '}
                                        <input
                                            type="number"
                                            min={0}
                                            max={120}
                                            value={techFpsFloor}
                                            onChange={(e) => setTechFpsFloor(Number(e.target.value))}
                                            style={{ width: 56, marginLeft: 4 }}
                                        />
                                    </label>
                                    <label
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            padding: '4px 8px',
                                            borderRadius: 6,
                                            border: techApplyMovement
                                                ? '1px solid #7dffb3'
                                                : '1px solid rgba(255,255,255,0.2)',
                                            background: techApplyMovement
                                                ? 'rgba(30,80,50,0.45)'
                                                : 'rgba(0,0,0,0.25)',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={techApplyMovement}
                                            onChange={(e) => setTechApplyMovement(e.target.checked)}
                                        />
                                        <span>
                                            <strong>Movement buffer</strong>{' '}
                                            <span style={{ opacity: 0.8 }}>{techApplyMovement ? 'ON' : 'OFF'}</span>
                                        </span>
                                    </label>
                                </div>
                                <p style={{ margin: '0 0 10px', fontSize: 11, opacity: 0.75 }}>
                                    Movement buffer is independent: combat always uses the delay; walk/run only if
                                    this switch is ON (easy A/B test).
                                </p>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    <button
                                        type="button"
                                        className="olympia-btn"
                                        onClick={proposeTech}
                                        style={{
                                            fontWeight: 700,
                                            background: '#4a2a7a',
                                            border: '1px solid #e0c4ff',
                                            color: '#f5e8ff',
                                        }}
                                    >
                                        Propose tech
                                    </button>
                                    <button
                                        type="button"
                                        className="olympia-btn"
                                        onClick={() => voteTech(true)}
                                        style={{
                                            fontWeight: 700,
                                            background: '#1a6b3c',
                                            border: '1px solid #7dffb3',
                                            color: '#e8ffe8',
                                        }}
                                    >
                                        Accept tech
                                    </button>
                                    <button type="button" className="olympia-btn" onClick={() => voteTech(false)}>
                                        Reject / re-propose
                                    </button>
                                </div>

                                <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12 }}>
                                    {(match.fighters ?? []).map((f) => (
                                        <li key={`tech-${f.team}-${f.characterName}`}>
                                            {f.characterName}:{' '}
                                            {f.techAccepted ? (
                                                <span style={{ color: '#7dffb3' }}>✓ accepted</span>
                                            ) : (
                                                <span style={{ opacity: 0.7 }}>pending</span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <ul style={{ margin: '8px 0', paddingLeft: 18 }}>
                            {(match.fighters ?? []).map((f) => {
                                const techBits: string[] = [];
                                if (f.pingMs !== undefined && f.pingMs > 0) {
                                    techBits.push(`ping ${f.pingMs}ms`);
                                }
                                if (f.pingVarianceMs !== undefined && f.pingVarianceMs > 0) {
                                    techBits.push(`σ ${f.pingVarianceMs}ms`);
                                }
                                if (f.fps !== undefined && f.fps > 0) {
                                    techBits.push(`${f.fps} fps`);
                                }
                                return (
                                    <li key={`${f.team}-${f.characterName}`} style={{ marginBottom: 4 }}>
                                        Team {f.team + 1}: <strong>{f.characterName}</strong>{' '}
                                        {f.ready ? (
                                            <span style={{ color: '#7dffb3' }}>✓ Ready</span>
                                        ) : (
                                            <span style={{ opacity: 0.6 }}>… waiting</span>
                                        )}
                                        {techBits.length > 0 ? (
                                            <div style={{ fontSize: 12, color: '#9fd4ff', marginLeft: 4 }}>
                                                Tech: {techBits.join(' · ')}
                                            </div>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>

                        <div
                            style={{
                                marginTop: 8,
                                padding: '8px 10px',
                                borderRadius: 6,
                                background: 'rgba(10,20,40,0.45)',
                                border: '1px solid rgba(100,160,220,0.35)',
                                fontSize: 12,
                                lineHeight: 1.4,
                            }}
                        >
                            <strong style={{ color: '#9fd4ff' }}>Technical transparency</strong>
                            <div style={{ marginTop: 4, opacity: 0.9 }}>
                                Your live sample:{' '}
                                {(() => {
                                    const p = nm?.getLatestPing();
                                    const v = nm?.getLatestPingVariance();
                                    const bits = [
                                        typeof p === 'number' ? `ping ${Math.round(p)}ms` : 'ping —',
                                        typeof v === 'number' ? `σ ${Math.round(v)}ms` : null,
                                        typeof fpsSample === 'number' ? `${fpsSample} fps` : 'fps —',
                                    ].filter(Boolean);
                                    return bits.join(' · ');
                                })()}
                            </div>
                            {captainDelayMs !== undefined &&
                            (match.status === 'countdown' ||
                                match.status === 'live' ||
                                match.status === 'tech_agree') ? (
                                <div
                                    style={{
                                        marginTop: 8,
                                        padding: '8px 10px',
                                        borderRadius: 6,
                                        background: 'rgba(40,20,60,0.55)',
                                        border: '1px solid #c9a0ff',
                                        color: '#e0c4ff',
                                        fontWeight: 700,
                                        fontSize: 14,
                                    }}
                                >
                                    Your delay: {captainDelayMs}ms
                                    {match.techApplyToMovement ? ' · movement ON' : ' · movement OFF'}
                                    <div style={{ fontWeight: 400, fontSize: 11, opacity: 0.85, marginTop: 4 }}>
                                        Solo tu número (1v1 ambos lo ven). No se muestra el delay del rival. Combat
                                        always delayed; walk only if movement buffer is ON.
                                    </div>
                                </div>
                            ) : null}
                            <div style={{ marginTop: 4, opacity: 0.75 }}>
                                PHOTO pública · delay personal privado (cada uno ve el suyo).
                            </div>
                        </div>

                        <div style={{ margin: '8px 0 10px' }}>
                            <div style={{ fontWeight: 600, fontSize: 12, opacity: 0.85, marginBottom: 4 }}>
                                Fighters
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                                {(match.fighters ?? []).map((f) => (
                                    <li key={`roster-${f.team}-${f.characterName}`}>
                                        <strong>{f.characterName}</strong>
                                        {f.invitePending ? (
                                            <span style={{ color: '#e8b86d' }}> · waiting accept</span>
                                        ) : f.ready ? (
                                            <span style={{ color: '#7dffb3' }}> · READY</span>
                                        ) : (
                                            <span style={{ opacity: 0.75 }}> · not ready</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                flexWrap: 'wrap',
                                marginTop: 8,
                                padding: 10,
                                borderRadius: 8,
                                background: 'rgba(30,24,10,0.55)',
                                border: '1px solid rgba(212,175,55,0.4)',
                            }}
                        >
                            {match.status === 'ready_window' ? (
                                <>
                                    <button
                                        type="button"
                                        className="olympia-btn"
                                        onClick={() => setReady(true)}
                                        style={{
                                            fontWeight: 800,
                                            fontSize: 16,
                                            padding: '10px 20px',
                                            background: '#1a6b3c',
                                            border: '2px solid #7dffb3',
                                            color: '#e8ffe8',
                                        }}
                                    >
                                        READY
                                    </button>
                                    <button type="button" className="olympia-btn" onClick={() => setReady(false)}>
                                        Unready
                                    </button>
                                </>
                            ) : null}
                            {match.status === 'scheduled' ? (
                                <button
                                    type="button"
                                    className="olympia-btn"
                                    onClick={() => {
                                        if (!kitJson || !nm) {
                                            return;
                                        }
                                        nm.sendArenaPactCreate({
                                            mapId: match.mapId,
                                            arenaKitJson: kitJson,
                                            opensAtMs: 0,
                                            readyWindowSec: match.readyWindowSec || 900,
                                        });
                                        setStatusHint('Opening Ready now on this duel…');
                                    }}
                                    style={{
                                        fontWeight: 800,
                                        fontSize: 14,
                                        padding: '10px 16px',
                                        background: '#1a5a8a',
                                        border: '2px solid #7ec8ff',
                                        color: '#e8f4ff',
                                    }}
                                >
                                    Open Ready now
                                </button>
                            ) : null}
                            {(match.status === 'scheduled' || match.status === 'ready_window') && (
                                <button type="button" className="olympia-btn" onClick={invite} disabled={!inGame}>
                                    Invite
                                </button>
                            )}
                            {/* ACCEPT/DECLINE/4HONOR only when there is a pending invite on the roster */}
                            {(match.status === 'scheduled' || match.status === 'ready_window') &&
                            (match.fighters ?? []).some((f) => f.invitePending) ? (
                                <>
                                    <button
                                        type="button"
                                        className="olympia-btn"
                                        onClick={() => respond('accept')}
                                        style={{ background: '#1a5a8a', border: '1px solid #7ec8ff' }}
                                    >
                                        ACCEPT
                                    </button>
                                    <button
                                        type="button"
                                        className="olympia-btn"
                                        onClick={() => respond('decline')}
                                    >
                                        DECLINE
                                    </button>
                                    <button
                                        type="button"
                                        className="olympia-btn"
                                        onClick={() => respond('honor')}
                                        title="Accept duel but clear the money stake"
                                        style={{ background: '#5a3a10', border: '1px solid #ffd76a' }}
                                    >
                                        4HONOR
                                    </button>
                                </>
                            ) : null}
                            <button
                                type="button"
                                className="olympia-btn"
                                onClick={cancel}
                                disabled={!inGame || !match.matchId}
                                title="Cancel the active duel on the server"
                            >
                                Cancel duel
                            </button>
                            {inGame && match.matchId ? (
                                <button
                                    type="button"
                                    className="olympia-btn"
                                    onClick={() => {
                                        const choice = window.prompt(
                                            [
                                                'Cómo streameás? Escribí el número:',
                                                '1 = Twitch (solo tu nombre de canal, ej: pepe)',
                                                '2 = YouTube (pegá el link del live)',
                                                '3 = Discord (invite discord.gg/… o vacío si ya compartís pantalla en voz)',
                                                '0 = borrar stream',
                                            ].join('\n'),
                                            '1',
                                        );
                                        if (choice === null) {
                                            return;
                                        }
                                        const c = choice.trim();
                                        if (c === '0') {
                                            setHostStreamUrl('');
                                            nm?.sendArenaPactSetStream(match.matchId, '', false);
                                            return;
                                        }
                                        if (c === '1' || c.toLowerCase() === 'twitch') {
                                            const ch = window.prompt(
                                                'Tu canal Twitch (solo el nombre, sin twitch.tv/):',
                                                twitchChannel || '',
                                            );
                                            if (ch === null) {
                                                return;
                                            }
                                            const url = buildStreamUrlFromGuide('twitch', ch, '');
                                            setTwitchChannel(ch);
                                            setHostStreamUrl(url);
                                            nm?.sendArenaPactSetStream(match.matchId, url, false);
                                            EventBus.emit(TOAST_REQUESTED, {
                                                message: url
                                                    ? `POV: ${url}`
                                                    : 'Canal Twitch vacío.',
                                                severity: url ? 'success' : 'warning',
                                            });
                                            return;
                                        }
                                        if (c === '2' || c.toLowerCase() === 'youtube') {
                                            const link = window.prompt(
                                                'Pegá el link del live de YouTube:',
                                                streamPaste || hostStreamUrl || '',
                                            );
                                            if (link === null) {
                                                return;
                                            }
                                            const url = buildStreamUrlFromGuide('youtube', '', link);
                                            setStreamPaste(link);
                                            setHostStreamUrl(url);
                                            nm?.sendArenaPactSetStream(match.matchId, url, false);
                                            return;
                                        }
                                        // Discord / default paste
                                        const link = window.prompt(
                                            'Discord: primero Compartir pantalla en un canal de voz.\nOpcional: pegá invite discord.gg/…',
                                            streamPaste || hostStreamUrl || '',
                                        );
                                        if (link === null) {
                                            return;
                                        }
                                        const url = link.trim();
                                        setStreamPaste(url);
                                        setHostStreamUrl(url);
                                        nm?.sendArenaPactSetStream(match.matchId, url, false);
                                    }}
                                    title="Guía simple: Twitch canal / YouTube link / Discord screen share"
                                >
                                    Set my POV stream
                                </button>
                            ) : null}
                            {inGame && match.matchId && match.isPublic ? (
                                <button
                                    type="button"
                                    className="olympia-btn"
                                    onClick={() => {
                                        const w = match.watchUrl || `${window.location.origin}/?watch=${match.matchId}`;
                                        void navigator.clipboard?.writeText(w);
                                        EventBus.emit(TOAST_REQUESTED, {
                                            message: `Watch link copied: ${w}`,
                                            severity: 'success',
                                        });
                                    }}
                                >
                                    Copy Watch link
                                </button>
                            ) : null}
                        </div>
                        {match.message ? (
                            <p style={{ margin: '10px 0 0', opacity: 0.9 }}>{match.message}</p>
                        ) : null}
                    </div>
                ) : null}


                {/* —— Schedule form (create new) —— */}
                <div
                    style={{
                        border: '1px solid rgba(212,175,55,0.45)',
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 14,
                        background: 'rgba(20,12,4,0.45)',
                        opacity: match?.matchId ? 0.75 : 1,
                    }}
                >
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#ffd76a', marginBottom: 10 }}>
                        Schedule open time
                    </div>
                    <p style={{ margin: '0 0 10px', fontSize: 12, opacity: 0.8, lineHeight: 1.4 }}>
                        At this date/time the arena opens and a <strong>15 min Ready window</strong> starts. When{' '}
                        <strong>everyone</strong> presses Ready, the countdown begins. Use the banner below so timezones
                        don&apos;t confuse you — it always counts from <em>your clock now</em>.
                    </p>

                    <label style={{ display: 'block', marginBottom: 8 }}>
                        Map{' '}
                        <select
                            value={mapId}
                            onChange={(e) => setArenaPactPreferredMap(e.target.value)}
                            style={{ marginLeft: 8, minWidth: 200 }}
                        >
                            <option value="colosseum">Colosseum Medium</option>
                            {ARENA_MAPS.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                        <label>
                            Date{' '}
                            <input
                                type="date"
                                value={dateStr}
                                onChange={(e) => setDateStr(e.target.value)}
                                style={{ marginLeft: 4 }}
                            />
                        </label>
                        <label>
                            Hour{' '}
                            <input
                                type="number"
                                min={0}
                                max={23}
                                value={hour}
                                onChange={(e) => setHour(Number(e.target.value))}
                                style={{ width: 56, marginLeft: 4 }}
                            />
                        </label>
                        <label>
                            Minute{' '}
                            <input
                                type="number"
                                min={0}
                                max={59}
                                value={minute}
                                onChange={(e) => setMinute(Number(e.target.value))}
                                style={{ width: 56, marginLeft: 4 }}
                            />
                        </label>
                    </div>

                    {(() => {
                        void tick;
                        const opensAt = computeOpensAtMs();
                        if (opensAt === null) {
                            return (
                                <div
                                    style={{
                                        marginBottom: 12,
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        background: 'rgba(80,20,20,0.45)',
                                        border: '1px solid #c06060',
                                        color: '#ffc9c9',
                                        fontWeight: 600,
                                    }}
                                >
                                    Invalid date/time — check the fields above.
                                </div>
                            );
                        }
                        const now = Date.now();
                        const rel = formatRelativeFromNow(opensAt, now);
                        const { local, utc, tz } = formatLocalAndUtc(opensAt);
                        const future = opensAt >= now - 45_000;
                        return (
                            <div
                                style={{
                                    marginBottom: 12,
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    background: future ? 'rgba(20,40,28,0.65)' : 'rgba(80,40,10,0.5)',
                                    border: `1px solid ${future ? '#5ecf8a' : '#e8a84a'}`,
                                }}
                            >
                                <div style={{ fontSize: 18, fontWeight: 800, color: future ? '#7dffb3' : '#ffd76a' }}>
                                    {rel}
                                </div>
                                <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.45, opacity: 0.95 }}>
                                    <div>
                                        Your local: <strong>{local}</strong>
                                    </div>
                                    <div>
                                        Absolute: <strong>{utc}</strong>
                                    </div>
                                    <div style={{ opacity: 0.8 }}>Timezone: {tz}</div>
                                </div>
                            </div>
                        );
                    })()}

                    <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>Start PVP in:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            <button
                                type="button"
                                className="olympia-btn"
                                onClick={() => applyOpensInMinutes(2)}
                                style={{ fontWeight: 700 }}
                            >
                                2 minutes
                            </button>
                            <button
                                type="button"
                                className="olympia-btn"
                                onClick={() => applyOpensInMinutes(15)}
                                style={{ fontWeight: 700 }}
                            >
                                15 minutes
                            </button>
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>
                            Or set a farther time with the calendar above.
                        </div>
                    </div>

                    <label style={{ display: 'block', marginBottom: 10 }}>
                        Ready window (minutes){' '}
                        <input
                            type="number"
                            min={1}
                            max={60}
                            value={readyWindowMin}
                            onChange={(e) => setReadyWindowMin(Number(e.target.value))}
                            style={{ width: 56, marginLeft: 4 }}
                        />
                        <span style={{ marginLeft: 6, opacity: 0.7, fontSize: 12 }}>(default 15)</span>
                    </label>

                    <label style={{ display: 'block', marginBottom: 10 }}>
                        Invite opponent (name){' '}
                        <input
                            type="text"
                            placeholder="Character / kit name"
                            value={inviteName}
                            onChange={(e) => setInviteName(e.target.value)}
                            maxLength={16}
                            style={{ marginLeft: 4, minWidth: 140 }}
                        />
                        <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>
                            Works offline — they see it on the landing inbox.
                        </span>
                    </label>

                    <label style={{ display: 'block', marginBottom: 12 }}>
                        Bolsa $ each (USDT){' '}
                        <input
                            type="number"
                            min={0}
                            step={1}
                            value={stakeAmount}
                            onChange={(e) => setStakeAmount(Math.max(0, Number(e.target.value) || 0))}
                            style={{ width: 80, marginLeft: 4 }}
                        />
                        <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.75 }}>
                            0 = for Honor (escrow later)
                        </span>
                    </label>

                    <label
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 10,
                            cursor: 'pointer',
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={isPublic}
                            onChange={(e) => setIsPublic(e.target.checked)}
                        />
                        <span>
                            <strong>Publish to cartelera</strong>
                            <span style={{ opacity: 0.75, fontSize: 11, marginLeft: 6 }}>
                                chainlords.net + Discord Events / #eventos
                            </span>
                        </span>
                    </label>

                    <label style={{ display: 'block', marginBottom: 10 }}>
                        Title{' '}
                        <input
                            type="text"
                            placeholder="e.g. Blood Friday 1v1"
                            value={duelTitle}
                            onChange={(e) => setDuelTitle(e.target.value)}
                            maxLength={80}
                            style={{ marginLeft: 4, minWidth: 200 }}
                        />
                    </label>

                    <StreamGuidePanel
                        platform={streamGuide}
                        onPlatform={(p) => {
                            setStreamGuide(p);
                            if (p === 'none') {
                                setHostStreamUrl('');
                                setTwitchChannel('');
                                setStreamPaste('');
                            }
                        }}
                        twitchChannel={twitchChannel}
                        onTwitchChannel={setTwitchChannel}
                        pasteUrl={streamPaste}
                        onPasteUrl={setStreamPaste}
                        showAdvancedGlobal
                        globalUrl={globalStreamUrl}
                        onGlobalUrl={setGlobalStreamUrl}
                    />

                    <button
                        type="button"
                        className="olympia-btn"
                        onClick={createPvpDuel}
                        style={{
                            fontWeight: 700,
                            fontSize: 15,
                            padding: '8px 16px',
                            background: 'linear-gradient(180deg,#c9a227,#8a6a12)',
                            border: '1px solid #ffd76a',
                            color: '#1a1205',
                            cursor: 'pointer',
                        }}
                    >
                        Create PVP Duel
                    </button>
                    <button
                        type="button"
                        className="olympia-btn"
                        onClick={() => {
                            // opensAtMs = 0 → server opens Ready window + warps to PVP map
                            const readyWindowSec = Math.max(60, Math.min(3600, readyWindowMin * 60));
                            if (!kitJson) {
                                EventBus.emit(TOAST_REQUESTED, {
                                    message: 'Need a complete kit first.',
                                    severity: 'warning',
                                });
                                return;
                            }
                            const stake = Math.max(0, Math.floor(stakeAmount));
                            const resolvedHostStream =
                                buildStreamUrlFromGuide(streamGuide, twitchChannel, streamPaste) ||
                                hostStreamUrl.trim() ||
                                undefined;
                            if (resolvedHostStream) {
                                setHostStreamUrl(resolvedHostStream);
                            }
                            const payload = {
                                mapId,
                                opensAtMs: 0,
                                readyWindowSec,
                                inviteName: inviteName.trim() || undefined,
                                stakeAssetId: stake > 0 ? 'USDT' : undefined,
                                stakeAmount: stake > 0 ? stake : undefined,
                                isPublic,
                                title: duelTitle.trim() || undefined,
                                hostStreamUrl: resolvedHostStream,
                                globalStreamUrl: globalStreamUrl.trim() || undefined,
                            };
                            if (!resolveNm()) {
                                setPendingArenaPactCreate(payload);
                                setStatusHint(`Entering ${mapId} — Ready now…`);
                                enterArenaWithKit();
                                return;
                            }
                            resolveNm()!.sendArenaPactCreate({
                                mapId,
                                arenaKitJson: kitJson,
                                opensAtMs: 0,
                                readyWindowSec,
                                stakeAssetId: payload.stakeAssetId,
                                stakeAmount: payload.stakeAmount,
                                isPublic: payload.isPublic,
                                title: payload.title,
                                hostStreamUrl: payload.hostStreamUrl,
                                globalStreamUrl: payload.globalStreamUrl,
                            });
                            setStatusHint(
                                'Opening Ready… wait for the green READY button above (server must confirm).',
                            );
                        }}
                        style={{ marginLeft: 8 }}
                    >
                        Open Ready now
                    </button>
                </div>


                {openList.length > 0 ? (
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>Open / scheduled duels</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {openList.map((m) => (
                                <li key={m.matchId}>
                                    {m.hostName} · {m.mapId} · {m.status}
                                    {m.secondsLeft > 0 ? ` · ${formatClock(m.secondsLeft)}` : ''}
                                </li>
                            ))}
                        </ul>
                        <button
                            type="button"
                            className="olympia-btn"
                            style={{ marginTop: 8 }}
                            onClick={() => nm?.sendArenaPactList()}
                            disabled={!inGame}
                        >
                            Refresh list
                        </button>
                    </div>
                ) : null}

                {/* Always-visible exit — drag-handle used to eat the title × */}
                <div
                    className="arena-pact-footer"
                    style={{
                        marginTop: 16,
                        paddingTop: 12,
                        borderTop: '1px solid rgba(212,175,55,0.35)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 10,
                        alignItems: 'center',
                    }}
                >
                    <button
                        type="button"
                        className="olympia-btn"
                        onPointerDown={(e) => stopOlympiaPointer(e)}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            goBack();
                        }}
                        style={{
                            fontWeight: 800,
                            fontSize: 15,
                            padding: '10px 18px',
                            background: 'linear-gradient(180deg,#4a3a18,#2a2010)',
                            border: '2px solid #ffd76a',
                            color: '#ffd76a',
                            cursor: 'pointer',
                        }}
                    >
                        ← Go Back
                    </button>
                    {match?.matchId ? (
                        <button
                            type="button"
                            className="olympia-btn"
                            onPointerDown={(e) => stopOlympiaPointer(e)}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                cancelAndClose();
                            }}
                            style={{
                                fontWeight: 700,
                                padding: '10px 14px',
                                background: '#4a1515',
                                border: '1px solid #c06060',
                                color: '#ffd0d0',
                                cursor: 'pointer',
                            }}
                        >
                            Cancel duel &amp; close
                        </button>
                    ) : null}
                    <span style={{ fontSize: 11, opacity: 0.7 }}>
                        Go Back cierra el menú. Cancel duel anula el pacto en el server.
                    </span>
                </div>
            </div>
        </OlympiaDialogShell>
    );
}
