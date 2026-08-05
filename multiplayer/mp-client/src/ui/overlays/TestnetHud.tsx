import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@tanstack/react-store';
import { performanceDialogStore } from '../store/PerformanceDialog.store';
import { hellMiningStore } from '../store/HellMining.store';
import {
    TESTNET_CREDIT_CHECKLIST,
    TESTNET_DISCORD_URL,
    TESTNET_NEWS_URL,
    TESTNET_X_HANDLE,
} from '../../constants/TestnetCredits';
import { getNetworkManager } from '../../utils/RegistryUtils';
import type { IRefPhaserGame } from '../../PhaserGame';
import '../rpg-ui.css';

interface TestnetHudProps {
    phaserRef?: React.RefObject<IRefPhaserGame | null>;
}

const LAYOUT_STORAGE_KEY = 'hb-testnet-hud-layout-v1';

interface TestnetHudLayout {
    /** Viewport left; null = default dock under top-left chat. */
    x: number | null;
    /** Viewport top; null = default dock. */
    y: number | null;
}

function loadLayout(): TestnetHudLayout {
    if (typeof window === 'undefined') {
        return { x: null, y: null };
    }
    try {
        const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (!raw) {
            return { x: null, y: null };
        }
        const parsed = JSON.parse(raw) as Partial<TestnetHudLayout>;
        return {
            x: typeof parsed.x === 'number' ? parsed.x : null,
            y: typeof parsed.y === 'number' ? parsed.y : null,
        };
    } catch {
        return { x: null, y: null };
    }
}

function saveLayout(layout: TestnetHudLayout): void {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch {
        /* ignore quota */
    }
}

/**
 * Buff timer: cycles 1 → 60 → 1 (no minutes). For timing 30s/60s buffs.
 */
function buffSecond(elapsedSeconds: number): number {
    return (Math.max(0, Math.floor(elapsedSeconds)) % 60) + 1;
}

/**
 * Always-on HUD: buff-second clock (1–60), FPS, ping, collapsible $HELL credits.
 * Drag anywhere on the panel (except buttons/links) to reposition; position persists.
 * Double-click drag handle / title area resets to default dock.
 */
export function TestnetHud({ phaserRef }: TestnetHudProps) {
    const fps = useStore(performanceDialogStore, (s) => s.fps);
    const ping = useStore(performanceDialogStore, (s) => s.ping);
    const hell = useStore(hellMiningStore);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | undefined>(undefined);
    /** Collapse tokens + credits + checklist (T/FPS/Ping always visible). */
    const [creditsCollapsed, setCreditsCollapsed] = useState(false);
    const [checklistOpen, setChecklistOpen] = useState(true);
    const [layout, setLayout] = useState<TestnetHudLayout>(() => loadLayout());
    const [dragging, setDragging] = useState(false);
    const rootRef = useRef<HTMLElement | null>(null);
    const dragRef = useRef<{
        startX: number;
        startY: number;
        originLeft: number;
        originTop: number;
    } | null>(null);

    useEffect(() => {
        const started = Date.now();
        const id = window.setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - started) / 1000));
        }, 200);
        return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
        const request = () => {
            const game = phaserRef?.current?.game;
            if (!game) {
                return;
            }
            getNetworkManager(game)?.sendHellMiningStatusRequest();
        };
        request();
        const id = window.setInterval(request, 30_000);
        return () => window.clearInterval(id);
    }, [phaserRef]);

    useEffect(() => {
        const updatePortalTarget = () => {
            const fullscreenElement = document.fullscreenElement;
            if (fullscreenElement instanceof HTMLElement) {
                setPortalTarget(fullscreenElement);
            } else {
                setPortalTarget(document.body);
            }
        };
        updatePortalTarget();
        document.addEventListener('fullscreenchange', updatePortalTarget);
        return () => document.removeEventListener('fullscreenchange', updatePortalTarget);
    }, []);

    useEffect(() => {
        saveLayout(layout);
    }, [layout]);

    const totalTokens = useMemo(
        () => Math.max(0, Math.floor(hell.pendingHell + hell.claimedHell)),
        [hell.pendingHell, hell.claimedHell],
    );

    const checkState = useMemo(() => {
        const credits = hell.todayCredits;
        const kills = hell.todayMonsterKills;
        return {
            login: credits > 0 || hell.todayMonsterCreditGranted || kills > 0,
            online: credits >= 2,
            farm: kills > 0,
            diversity: hell.todayMonsterCreditGranted || kills >= 50,
            ek: false,
            challenge: hell.todayDirectTokens > 0 && kills === 0 ? true : false,
        } as Record<string, boolean>;
    }, [hell]);

    const dayLabel = hell.utcDay
        ? hell.utcDay
        : new Date().toISOString().slice(0, 10);

    const buffT = buffSecond(elapsedSeconds);
    const isFree = layout.x !== null && layout.y !== null;

    const resetDock = useCallback(() => {
        setLayout({ x: null, y: null });
    }, []);

    const onDragPointerDown = (e: ReactPointerEvent) => {
        if (e.button !== 0) {
            return;
        }
        // Don't start drag from interactive controls / links
        const t = e.target as HTMLElement;
        if (t.closest('button, a, input, textarea, select, label')) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        const el = rootRef.current;
        if (!el) {
            return;
        }
        const rect = el.getBoundingClientRect();
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            originLeft: rect.left,
            originTop: rect.top,
        };
        setDragging(true);
        el.setPointerCapture(e.pointerId);
    };

    const onDragPointerMove = (e: ReactPointerEvent) => {
        if (!dragRef.current) {
            return;
        }
        const el = rootRef.current;
        const w = el?.offsetWidth ?? 220;
        const h = el?.offsetHeight ?? 80;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const nextX = dragRef.current.originLeft + dx;
        const nextY = dragRef.current.originTop + dy;
        const maxX = Math.max(0, window.innerWidth - 48);
        const maxY = Math.max(0, window.innerHeight - 48);
        setLayout({
            x: Math.max(-w + 48, Math.min(maxX, nextX)),
            y: Math.max(0, Math.min(maxY, nextY)),
        });
    };

    const onDragPointerUp = (e: ReactPointerEvent) => {
        if (!dragRef.current) {
            return;
        }
        dragRef.current = null;
        setDragging(false);
        try {
            rootRef.current?.releasePointerCapture(e.pointerId);
        } catch {
            /* already released */
        }
    };

    const positionStyle: CSSProperties | undefined = isFree
        ? { left: layout.x!, top: layout.y!, right: 'auto', bottom: 'auto' }
        : undefined;

    const node = (
        <aside
            ref={rootRef}
            className={`testnet-hud${creditsCollapsed ? ' is-collapsed' : ''}${dragging ? ' is-dragging' : ''}${isFree ? ' is-free' : ''}`}
            aria-label="Testnet HUD"
            style={positionStyle}
            onPointerDown={onDragPointerDown}
            onPointerMove={onDragPointerMove}
            onPointerUp={onDragPointerUp}
            onPointerCancel={onDragPointerUp}
            onDoubleClick={(e) => {
                if ((e.target as HTMLElement).closest('button, a, input')) {
                    return;
                }
                resetDock();
            }}
            title="Drag to move · double-click to reset position"
        >
            <div className="testnet-hud-drag-hint" aria-hidden>
                ⠿
            </div>
            <div className="testnet-hud-clock" title="Buff timer — cycles 1→60 (no minutes)">
                <span className="testnet-hud-k">T</span>
                <span className="testnet-hud-v mono testnet-hud-buff-t">{buffT}</span>
                <span className="testnet-hud-t-hint">/60</span>
            </div>
            <div className="testnet-hud-row" title="Frames per second">
                <span className="testnet-hud-k">FPS</span>
                <span className="testnet-hud-v mono">{fps > 0 ? fps : '—'}</span>
            </div>
            <div className="testnet-hud-row" title="Round-trip latency to game server">
                <span className="testnet-hud-k">Ping</span>
                <span className="testnet-hud-v mono">
                    {ping !== undefined && ping >= 0 ? `${Math.round(ping)} ms` : '—'}
                </span>
            </div>

            <button
                type="button"
                className="testnet-hud-minimize"
                onClick={() => setCreditsCollapsed((v) => !v)}
                aria-expanded={!creditsCollapsed}
                title={creditsCollapsed ? 'Show $HELL credits & checklist' : 'Hide $HELL credits & checklist'}
            >
                {creditsCollapsed ? '▸ $HELL / créditos' : '▾ $HELL / créditos'}
            </button>

            {!creditsCollapsed ? (
                <>
                    <div className="testnet-hud-sep" />

                    <div className="testnet-hud-section-title">Testnet · $HELL</div>
                    <div className="testnet-hud-row" title="Pending + already claimed play-mine balance">
                        <span className="testnet-hud-k wide">Tokens totales acumulados</span>
                        <span className="testnet-hud-v mono gold">{totalTokens.toLocaleString()}</span>
                    </div>
                    <div className="testnet-hud-sub">
                        pending {hell.pendingHell.toLocaleString()} · claimed {hell.claimedHell.toLocaleString()}
                    </div>
                    <div className="testnet-hud-row" title={`UTC day ${dayLabel}`}>
                        <span className="testnet-hud-k wide">Créditos del día (test)</span>
                        <span className="testnet-hud-v mono gold">{hell.todayCredits}</span>
                    </div>
                    <div className="testnet-hud-sub">
                        kills {hell.todayMonsterKills}
                        {hell.todayMonsterCreditGranted ? ' · farm ✓' : ''}
                        {hell.todaySettled ? ' · settled' : ''}
                    </div>

                    <button
                        type="button"
                        className="testnet-hud-toggle"
                        onClick={() => setChecklistOpen((v) => !v)}
                        aria-expanded={checklistOpen}
                    >
                        Checklist créditos {checklistOpen ? '▾' : '▸'}
                    </button>

                    {checklistOpen ? (
                        <ul className="testnet-hud-checklist">
                            {TESTNET_CREDIT_CHECKLIST.map((rule) => {
                                const done = Boolean(checkState[rule.id]);
                                return (
                                    <li key={rule.id} className={done ? 'is-done' : undefined} title={rule.detail}>
                                        <span className="testnet-hud-check" aria-hidden>
                                            {done ? '☑' : '☐'}
                                        </span>
                                        <span className="testnet-hud-check-label">
                                            <strong>{rule.label}</strong>
                                            <em>{rule.detail}</em>
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : null}

                    <div className="testnet-hud-links">
                        <a href={TESTNET_DISCORD_URL} target="_blank" rel="noreferrer">
                            Discord
                        </a>
                        <span aria-hidden>·</span>
                        <a href={TESTNET_NEWS_URL} target="_blank" rel="noreferrer">
                            Rules
                        </a>
                        <span aria-hidden>·</span>
                        <span title="Follow for claim eligibility">{TESTNET_X_HANDLE}</span>
                    </div>
                    <div className="testnet-hud-foot">Grid: Ctrl+G · SysMenu Show Grid · drag HUD to move</div>
                </>
            ) : null}
        </aside>
    );

    if (!portalTarget) {
        return null;
    }
    return createPortal(node, portalTarget);
}
