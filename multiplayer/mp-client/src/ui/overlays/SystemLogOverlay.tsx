import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@tanstack/react-store';
import {
    pruneExpiredSystemLogLines,
    SYSTEM_LOG_LINE_TTL_MS,
    systemLogStore,
} from '../store/SystemLog.store';
import {
    OLYMPIA_SYSTEM_LOG_COLORS,
    OLYMPIA_UI_FONT,
} from '../../constants/OlympiaTypography';
import type { SystemLogLineKind } from '../../constants/EventNames';
import '../rpg-ui.css';

const LINE_COLOR: Record<SystemLogLineKind, string> = {
    damage: OLYMPIA_SYSTEM_LOG_COLORS.damage,
    heal: OLYMPIA_SYSTEM_LOG_COLORS.heal,
    tip: OLYMPIA_SYSTEM_LOG_COLORS.tip,
    event: OLYMPIA_SYSTEM_LOG_COLORS.event,
    warning: OLYMPIA_SYSTEM_LOG_COLORS.warning,
};

/**
 * Olympia-style bottom-left colored system/combat log (Parity P1.2).
 * Lines auto-dismiss after {@link SYSTEM_LOG_LINE_TTL_MS} (3s) and fade out in that window.
 */
export function SystemLogOverlay() {
    const lines = useStore(systemLogStore, (s) => s.lines);
    const listRef = useRef<HTMLDivElement | null>(null);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | undefined>(undefined);
    const [nowMs, setNowMs] = useState(() => Date.now());

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

    // Tick so opacity animates and each line is removed 3s after it appears.
    useEffect(() => {
        const id = window.setInterval(() => {
            pruneExpiredSystemLogLines();
            setNowMs(Date.now());
        }, 100);
        return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
        const el = listRef.current;
        if (!el) {
            return;
        }
        el.scrollTop = el.scrollHeight;
    }, [lines.length]);

    const visible = lines.filter((line) => nowMs - line.createdAtMs < SYSTEM_LOG_LINE_TTL_MS);

    if (!portalTarget || visible.length === 0) {
        return null;
    }

    const dialog = (
        <div className="system-log-overlay" aria-live="polite" aria-label="System combat log">
            <div className="system-log-overlay-list" ref={listRef}>
                {visible.map((line) => {
                    const ageMs = Math.max(0, nowMs - line.createdAtMs);
                    // Linear fade over full 3s lifetime (end fully transparent).
                    const life = Math.min(1, ageMs / SYSTEM_LOG_LINE_TTL_MS);
                    const opacity = Math.max(0, 1 - life);
                    return (
                        <div
                            key={line.id}
                            className="system-log-overlay-line"
                            style={{
                                color: LINE_COLOR[line.kind],
                                opacity,
                                transition: 'opacity 80ms linear',
                                fontFamily: OLYMPIA_UI_FONT,
                            }}
                        >
                            {line.message}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return createPortal(dialog, portalTarget);
}
