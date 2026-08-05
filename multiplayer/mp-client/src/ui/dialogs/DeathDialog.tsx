import { useStore } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { IN_UI_REQUEST_SERVER_RESURRECT } from '../../constants/EventNames';
import { deathDialogStore, setDeathDialogOpen } from '../store/DeathDialog.store';

interface DeathDialogProps {
    /** Ignored — Olympia death UI is fixed bottom-right, not a centered modal. */
    position?: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
}

/**
 * Olympia-style death chrome: floating golden Restart! (bottom-right).
 * System log already carries "You have died!…" — this is only the revive affordance.
 */
export function DeathDialog({ zIndex = 10013, onBringToFront }: DeathDialogProps) {
    const killerName = useStore(deathDialogStore, (s) => s.killerName);

    const handleRestart = () => {
        // Keep dialog open until server confirms PlayerResurrected (or world transfer join).
        // Closing early left players stuck dead if revive failed or packet was missed.
        EventBus.emit(IN_UI_REQUEST_SERVER_RESURRECT);
    };

    return (
        <div
            className="death-restart-overlay"
            data-dialog-id="death-dialog"
            style={{ zIndex }}
            onPointerDown={() => onBringToFront?.()}
        >
            {killerName ? (
                <p className="death-restart-killer">
                    Killed by <strong>{killerName}</strong>
                </p>
            ) : null}
            <button
                type="button"
                className="death-restart-btn"
                title="Restart!"
                onClick={handleRestart}
            >
                Restart!
            </button>
        </div>
    );
}
