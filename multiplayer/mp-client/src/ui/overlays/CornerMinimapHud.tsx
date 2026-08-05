import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@tanstack/react-store';
import { cameraDialogStore } from '../store/CameraDialog.store';
import { minimapDialogStore, toggleMinimapDialog } from '../store/MinimapDialog.store';
import { minimapEntitiesStore } from '../store/MinimapEntities.store';
import { partyStore } from '../store/Party.store';
import { characterDialogStore } from '../store/CharacterDialog.store';
import { appStore } from '../store/App.store';
import { setGuideMapEnabled } from '../store/SysMenuDialog.store';
import { convertWorldPosToPixelPos } from '../../utils/CoordinateUtils';
import { getHuntPitsForMap } from '../../constants/HuntPits.generated';
import '../rpg-ui.css';

/** Default display edge (322 = 280×1.15). Zoom scales around this. */
const DEFAULT_SIZE_PX = Math.round(280 * 1.15);
const MIN_SIZE_PX = 160;
const MAX_SIZE_PX = 560;
const PLAYER_DOT_BASE = 9;
const PARTY_DOT_BASE = 8;
/** Pit markers on guide map (letter fallback until a live mob of that type is seen). */
const PIT_ICON_BASE = 22;
const LAYOUT_STORAGE_KEY = 'hb-corner-minimap-layout-v1';

interface CornerMinimapLayout {
    /** Viewport left; null = dock to canvas top-right. */
    x: number | null;
    /** Viewport top; null = dock to canvas top-right. */
    y: number | null;
    /** Display size in CSS px (map frame is square). */
    size: number;
}

function clampSize(size: number): number {
    return Math.round(Math.max(MIN_SIZE_PX, Math.min(MAX_SIZE_PX, size)));
}

function loadLayout(): CornerMinimapLayout {
    if (typeof window === 'undefined') {
        return { x: null, y: null, size: DEFAULT_SIZE_PX };
    }
    try {
        const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (!raw) {
            return { x: null, y: null, size: DEFAULT_SIZE_PX };
        }
        const parsed = JSON.parse(raw) as Partial<CornerMinimapLayout>;
        return {
            x: typeof parsed.x === 'number' ? parsed.x : null,
            y: typeof parsed.y === 'number' ? parsed.y : null,
            size: typeof parsed.size === 'number' ? clampSize(parsed.size) : DEFAULT_SIZE_PX,
        };
    } catch {
        return { x: null, y: null, size: DEFAULT_SIZE_PX };
    }
}

function saveLayout(layout: CornerMinimapLayout): void {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch {
        /* ignore quota */
    }
}

function worldToMinimapPx(
    worldX: number,
    worldY: number,
    minimapScale: number,
    minimapOriginalSize: number,
    cornerSize: number,
): { x: number; y: number } {
    const pixelX = convertWorldPosToPixelPos(worldX) * minimapScale;
    const pixelY = convertWorldPosToPixelPos(worldY) * minimapScale;
    return {
        x: (pixelX / minimapOriginalSize) * cornerSize,
        y: (pixelY / minimapOriginalSize) * cornerSize,
    };
}

function monsterThumbKey(sprite: string): string {
    return `minimap-mob-${sprite}`;
}

function pitFallbackLabel(name: string): string {
    const parts = name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || '?';
}

/**
 * Olympia-style corner guide map:
 * drag toolbar to move, wheel / ± on toolbar to zoom, X or right-click toolbar / M to hide.
 * Map body is pointer-events:none so cast/target clicks pass through to the world.
 */
export function CornerMinimapHud() {
    const minimapImage = useStore(minimapDialogStore, (s) => s.minimapImage);
    const minimapScale = useStore(minimapDialogStore, (s) => s.minimapScale);
    const minimapOriginalSize = useStore(minimapDialogStore, (s) => s.minimapOriginalSize);
    const minimapAvailable = useStore(minimapDialogStore, (s) => s.minimapAvailable);
    const isOpen = useStore(minimapDialogStore, (s) => s.isOpen);
    const playerPosition = useStore(cameraDialogStore, (s) => s.playerPosition);
    const mapName = useStore(minimapEntitiesStore, (s) => s.mapName);
    const remotePlayers = useStore(minimapEntitiesStore, (s) => s.players);
    const partyIn = useStore(partyStore, (s) => s.inParty);
    const partyNames = useStore(partyStore, (s) => s.memberNames);
    const selfName = useStore(characterDialogStore, (s) => s.stats.playerName);
    const spriteFrameMap = useStore(appStore, (s) => s.spriteFrameMap);

    const [portalTarget, setPortalTarget] = useState<HTMLElement | undefined>(undefined);
    const [layout, setLayout] = useState<CornerMinimapLayout>(() => loadLayout());
    const [dragging, setDragging] = useState(false);
    const dragRef = useRef<{
        startX: number;
        startY: number;
        originLeft: number;
        originTop: number;
    } | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);

    const size = layout.size;
    const sizeScale = size / DEFAULT_SIZE_PX;
    const playerDotSize = Math.max(6, Math.round(PLAYER_DOT_BASE * sizeScale));
    const partyDotSize = Math.max(5, Math.round(PARTY_DOT_BASE * sizeScale));
    const pitIconSize = Math.max(14, Math.round(PIT_ICON_BASE * sizeScale));

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

    const setSize = useCallback((next: number) => {
        setLayout((prev) => ({ ...prev, size: clampSize(next) }));
    }, []);

    // Wheel zoom only on the toolbar (map body is click-through to the game).
    useEffect(() => {
        const el = rootRef.current?.querySelector('.corner-minimap-hud-toolbar');
        if (!(el instanceof HTMLElement)) {
            return;
        }
        const onWheelNative = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const delta = e.deltaY > 0 ? -24 : 24;
            setLayout((prev) => ({ ...prev, size: clampSize(prev.size + delta) }));
        };
        el.addEventListener('wheel', onWheelNative, { passive: false });
        return () => el.removeEventListener('wheel', onWheelNative);
    }, [isOpen, minimapAvailable, size]);

    const hideMap = useCallback(() => {
        toggleMinimapDialog();
        setGuideMapEnabled(minimapDialogStore.state.isOpen);
    }, []);

    const resetDock = useCallback(() => {
        setLayout((prev) => ({ ...prev, x: null, y: null }));
    }, []);

    const onDragPointerDown = (e: ReactPointerEvent) => {
        if (e.button !== 0) {
            return;
        }
        // Don't start drag from toolbar buttons
        if ((e.target as HTMLElement).closest('.corner-minimap-hud-btn')) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        const root = rootRef.current;
        if (!root) {
            return;
        }
        const rect = root.getBoundingClientRect();
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            originLeft: rect.left,
            originTop: rect.top,
        };
        setDragging(true);
        // Capture on toolbar (map body is pointer-events:none).
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const onDragPointerMove = (e: ReactPointerEvent) => {
        if (!dragRef.current) {
            return;
        }
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const nextX = dragRef.current.originLeft + dx;
        const nextY = dragRef.current.originTop + dy;
        // Keep mostly on-screen
        const maxX = window.innerWidth - 48;
        const maxY = window.innerHeight - 48;
        setLayout((prev) => ({
            ...prev,
            x: Math.max(-size + 48, Math.min(maxX, nextX)),
            y: Math.max(0, Math.min(maxY, nextY)),
        }));
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

    const canProject = minimapScale > 0 && minimapOriginalSize > 0;

    const selfDot = useMemo(() => {
        if (
            !canProject ||
            playerPosition.worldX === undefined ||
            playerPosition.worldY === undefined
        ) {
            return undefined;
        }
        return worldToMinimapPx(
            playerPosition.worldX,
            playerPosition.worldY,
            minimapScale,
            minimapOriginalSize,
            size,
        );
    }, [canProject, playerPosition.worldX, playerPosition.worldY, minimapScale, minimapOriginalSize, size]);

    const partyDots = useMemo(() => {
        if (!canProject || !partyIn || partyNames.length === 0) {
            return [];
        }
        const selfLower = selfName.trim().toLowerCase();
        const want = new Set(
            partyNames
                .map((n) => n.trim().toLowerCase())
                .filter((n) => n.length > 0 && n !== selfLower),
        );
        if (want.size === 0) {
            return [];
        }
        return remotePlayers
            .filter((p) => want.has(p.name.trim().toLowerCase()))
            .map((p) => ({
                id: p.playerId,
                name: p.name,
                ...worldToMinimapPx(p.x, p.y, minimapScale, minimapOriginalSize, size),
            }));
    }, [canProject, partyIn, partyNames, remotePlayers, selfName, minimapScale, minimapOriginalSize, size]);

    const huntPits = useMemo(() => {
        if (!canProject) {
            return [];
        }
        return getHuntPitsForMap(mapName).map((pit) => {
            const pos = worldToMinimapPx(pit.x, pit.y, minimapScale, minimapOriginalSize, size);
            const thumb = pit.sprite ? spriteFrameMap.get(monsterThumbKey(pit.sprite)) : undefined;
            return { ...pit, ...pos, thumb };
        });
    }, [canProject, mapName, minimapScale, minimapOriginalSize, spriteFrameMap, size]);

    if (!portalTarget || !isOpen || !minimapAvailable) {
        return null;
    }

    const docked = layout.x === null || layout.y === null;
    const rootStyle: React.CSSProperties = docked
        ? {
              // Default: top-right of game canvas
              top: 'calc(var(--hb-canvas-top, 0px) + 8px)',
              left: `calc(var(--hb-canvas-left, 0px) + var(--hb-canvas-width, 800px) - ${size + 8}px)`,
          }
        : {
              top: layout.y ?? 8,
              left: layout.x ?? 8,
          };

    const zoomPct = Math.round((size / DEFAULT_SIZE_PX) * 100);

    const overlay = (
        <div
            ref={rootRef}
            className={`corner-minimap-hud${dragging ? ' is-dragging' : ''}${docked ? '' : ' is-free'}`}
            style={rootStyle}
            aria-label="Guide map"
        >
            <div
                className="corner-minimap-hud-toolbar"
                title="Drag to move · wheel to zoom · right-click to hide. Map body is click-through (cast under it)."
                onContextMenu={(e) => {
                    e.preventDefault();
                    hideMap();
                }}
                onPointerDown={onDragPointerDown}
                onPointerMove={onDragPointerMove}
                onPointerUp={onDragPointerUp}
                onPointerCancel={onDragPointerUp}
            >
                <span className="corner-minimap-hud-title" title="Drag to move · wheel to zoom">
                    Map
                </span>
                <button
                    type="button"
                    className="corner-minimap-hud-btn"
                    title="Zoom out"
                    onClick={() => setSize(size - 28)}
                >
                    −
                </button>
                <span className="corner-minimap-hud-zoom-label" title="Zoom">
                    {zoomPct}%
                </span>
                <button
                    type="button"
                    className="corner-minimap-hud-btn"
                    title="Zoom in"
                    onClick={() => setSize(size + 28)}
                >
                    +
                </button>
                {!docked && (
                    <button
                        type="button"
                        className="corner-minimap-hud-btn"
                        title="Reset to top-right corner"
                        onClick={resetDock}
                    >
                        ↖
                    </button>
                )}
                <button
                    type="button"
                    className="corner-minimap-hud-btn corner-minimap-hud-btn-close"
                    title="Hide map (M / right-click toolbar). F11 = more translucent; map body always click-through"
                    onClick={hideMap}
                >
                    ×
                </button>
            </div>

            {minimapImage ? (
                <div
                    className="corner-minimap-hud-frame"
                    style={{ width: size, height: size }}
                >
                    <img className="corner-minimap-hud-img" src={minimapImage} alt="" draggable={false} />

                    {huntPits.map((pit) => (
                        <div
                            key={`pit-${pit.monsterId}-${pit.x}-${pit.y}`}
                            className="corner-minimap-hud-pit"
                            title={`${pit.name}${pit.count > 0 ? ` ×${pit.count}` : ''} (${pit.x},${pit.y})`}
                            style={{
                                left: pit.x,
                                top: pit.y,
                                width: pitIconSize,
                                height: pitIconSize,
                            }}
                        >
                            {pit.thumb ? (
                                <img
                                    src={pit.thumb}
                                    alt={pit.name}
                                    className="corner-minimap-hud-pit-img"
                                    draggable={false}
                                />
                            ) : (
                                <span className="corner-minimap-hud-pit-fallback" aria-hidden>
                                    {pitFallbackLabel(pit.name)}
                                </span>
                            )}
                        </div>
                    ))}

                    {partyDots.map((dot) => (
                        <div
                            key={`party-${dot.id}`}
                            className="corner-minimap-hud-dot corner-minimap-hud-dot-party"
                            title={dot.name}
                            style={{
                                left: dot.x,
                                top: dot.y,
                                width: partyDotSize,
                                height: partyDotSize,
                            }}
                        />
                    ))}

                    {selfDot ? (
                        <div
                            className="corner-minimap-hud-dot corner-minimap-hud-dot-self"
                            title={selfName || 'You'}
                            style={{
                                left: selfDot.x,
                                top: selfDot.y,
                                width: playerDotSize,
                                height: playerDotSize,
                            }}
                        />
                    ) : null}
                </div>
            ) : (
                <div className="corner-minimap-hud-loading" style={{ width: size, height: size }}>
                    Map…
                </div>
            )}
        </div>
    );

    return createPortal(overlay, portalTarget);
}
