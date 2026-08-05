import { useStore } from '@tanstack/react-store';
import { connectDialogStore, setConnectGatePhase } from '../store/ConnectDialog.store';
import { ARENA_CLOSED_MESSAGE, ARENA_ENTRY_ENABLED } from '../../constants/ArenaGate';
import { EventBus } from '../../game/EventBus';
import { TOAST_REQUESTED } from '../../constants/EventNames';

/**
 * Side “oreja” on Character List / Arena Pre-Ready desks:
 * fully outside the referral strip so it never sits under the panel edge.
 * World → Ir a Arena · Arena → Ir a World.
 */
export function DeskModeJumpTab() {
    const isOpen = useStore(connectDialogStore, (s) => s.isOpen);
    const phase = useStore(connectDialogStore, (s) => s.phase);

    if (!isOpen || (phase !== 'play-world' && phase !== 'arena-lobby')) {
        return null;
    }

    const toArena = phase === 'play-world';

    const onClick = () => {
        if (toArena) {
            if (!ARENA_ENTRY_ENABLED) {
                EventBus.emit(TOAST_REQUESTED, {
                    message: ARENA_CLOSED_MESSAGE,
                    severity: 'warning',
                    autoClose: 4500,
                });
                return;
            }
            setConnectGatePhase('arena-lobby');
            return;
        }
        setConnectGatePhase('play-world');
    };

    return (
        <button
            type="button"
            className={`cl-desk-mode-tab${toArena ? ' cl-desk-mode-tab--arena' : ' cl-desk-mode-tab--world'}`}
            onClick={onClick}
            title={toArena ? 'Ir a Arena — Pre-Ready Fighters' : 'Ir a World — Character List'}
            aria-label={toArena ? 'Ir a Arena' : 'Ir a World'}
        >
            <span className="cl-desk-mode-tab__arrow" aria-hidden>
                {toArena ? '▸' : '◂'}
            </span>
            <span className="cl-desk-mode-tab__label">
                {toArena ? 'Ir a Arena' : 'Ir a World'}
            </span>
        </button>
    );
}
