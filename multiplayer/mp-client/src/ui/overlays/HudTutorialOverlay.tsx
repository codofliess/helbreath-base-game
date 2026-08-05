import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useState,
    type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@tanstack/react-store';
import {
    advanceHudTutorial,
    getHudTutorialStep,
    HUD_TUTORIAL_STEPS,
    hudTutorialStore,
    skipHudTutorial,
} from '../store/HudTutorial.store';
import '../rpg-ui.css';

interface SpotRect {
    top: number;
    left: number;
    width: number;
    height: number;
}

function measureTarget(targetId: string): SpotRect | null {
    const el = document.querySelector(`[data-tutorial-id="${targetId}"]`);
    if (!(el instanceof HTMLElement)) {
        return null;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) {
        return null;
    }
    const pad = 6;
    return {
        top: Math.max(0, r.top - pad),
        left: Math.max(0, r.left - pad),
        width: r.width + pad * 2,
        height: r.height + pad * 2,
    };
}

/**
 * One-shot traveler HUD tour: spotlight + dialog, skip anytime.
 * Starts at fullscreen (far-right dock).
 */
export function HudTutorialOverlay() {
    const active = useStore(hudTutorialStore, (s) => s.active);
    const stepIndex = useStore(hudTutorialStore, (s) => s.stepIndex);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | undefined>(undefined);
    const [spot, setSpot] = useState<SpotRect | null>(null);

    const step = active ? HUD_TUTORIAL_STEPS[stepIndex] : null;
    const total = HUD_TUTORIAL_STEPS.length;
    const isLast = stepIndex >= total - 1;

    useEffect(() => {
        const updatePortalTarget = () => {
            const fs = document.fullscreenElement;
            if (fs instanceof HTMLElement) {
                setPortalTarget(fs);
            } else {
                setPortalTarget(document.body);
            }
        };
        updatePortalTarget();
        document.addEventListener('fullscreenchange', updatePortalTarget);
        return () => document.removeEventListener('fullscreenchange', updatePortalTarget);
    }, []);

    const refreshSpot = useCallback(() => {
        const s = getHudTutorialStep();
        if (!s) {
            setSpot(null);
            return;
        }
        setSpot(measureTarget(s.targetId));
    }, []);

    useLayoutEffect(() => {
        if (!active) {
            setSpot(null);
            return;
        }
        refreshSpot();
        const id = window.setInterval(refreshSpot, 400);
        window.addEventListener('resize', refreshSpot);
        return () => {
            window.clearInterval(id);
            window.removeEventListener('resize', refreshSpot);
        };
    }, [active, stepIndex, refreshSpot]);

    useEffect(() => {
        if (!active) {
            return;
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                skipHudTutorial();
                return;
            }
            if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === ' ') {
                // Don't steal Enter if chat compose is open
                const ae = document.activeElement;
                if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                advanceHudTutorial();
            }
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [active]);

    if (!active || !step || !portalTarget) {
        return null;
    }

    // Place callout above the dock highlight when possible.
    const calloutStyle: CSSProperties = spot
        ? {
              left: Math.min(
                  Math.max(12, spot.left + spot.width / 2 - 160),
                  window.innerWidth - 332,
              ),
              bottom: Math.max(12, window.innerHeight - spot.top + 10),
          }
        : {
              left: '50%',
              bottom: '120px',
              transform: 'translateX(-50%)',
          };

    const node = (
        <div className="hud-tutorial-root" role="dialog" aria-modal="true" aria-labelledby="hud-tutorial-title">
            <div className="hud-tutorial-dim" onClick={(e) => e.stopPropagation()} />
            {spot ? (
                <div
                    className="hud-tutorial-spotlight"
                    style={{
                        top: spot.top,
                        left: spot.left,
                        width: spot.width,
                        height: spot.height,
                    }}
                />
            ) : null}

            <div className="hud-tutorial-card" style={calloutStyle}>
                <div className="hud-tutorial-card-top">
                    <span className="hud-tutorial-step-count">
                        {stepIndex + 1} / {total}
                    </span>
                    <button
                        type="button"
                        className="hud-tutorial-skip"
                        onClick={() => skipHudTutorial()}
                        title="Saltar tutorial (Esc)"
                    >
                        Saltar tutorial
                    </button>
                </div>
                <h2 id="hud-tutorial-title" className="hud-tutorial-title">
                    {step.title}
                </h2>
                <p className="hud-tutorial-body">{step.body}</p>
                {step.shortcut ? (
                    <p className="hud-tutorial-shortcut">
                        Atajo: <kbd>{step.shortcut}</kbd>
                    </p>
                ) : null}
                <div className="hud-tutorial-actions">
                    <button
                        type="button"
                        className="hud-tutorial-btn hud-tutorial-btn--ghost"
                        onClick={() => skipHudTutorial()}
                    >
                        Ya sé jugar
                    </button>
                    <button
                        type="button"
                        className="hud-tutorial-btn hud-tutorial-btn--primary"
                        onClick={() => advanceHudTutorial()}
                    >
                        {isLast ? 'Listo' : 'Siguiente'}
                    </button>
                </div>
                <p className="hud-tutorial-hint">Enter = siguiente · Esc = saltar</p>
            </div>
        </div>
    );

    return createPortal(node, portalTarget);
}
