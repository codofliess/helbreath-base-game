import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { TOAST_REQUESTED } from '../../constants/EventNames';

/**
 * IconPannel crusade seal (Olympia left-of-mode recess).
 * Reserved on the dock always; the seal is only interactive while a crusade is active.
 */
interface CrusadeHudState {
    /** When true, the crusade seal is visible/clickable (slot width stays reserved either way). */
    isActive: boolean;
    /** Short status from Perry / future world crusade packets. */
    statusLabel: string;
}

export const crusadeHudStore = new Store<CrusadeHudState>({
    isActive: false,
    statusLabel: '',
});

/** True for any non-empty crusade status other than classic inactive/none stubs. */
export function isCrusadeStatusActive(status: string | undefined): boolean {
    const normalized = (status ?? '').trim().toLowerCase();
    if (!normalized) {
        return false;
    }
    return normalized !== 'inactive' && normalized !== 'none' && normalized !== 'off';
}

export function setCrusadeHudFromStatus(status: string | undefined): void {
    const label = (status ?? '').trim();
    crusadeHudStore.setState(() => ({
        isActive: isCrusadeStatusActive(label),
        statusLabel: label,
    }));
}

export function setCrusadeHudActive(isActive: boolean, statusLabel = ''): void {
    crusadeHudStore.setState(() => ({
        isActive,
        statusLabel: statusLabel.trim(),
    }));
}

/** Dock crusade seal click — brief toast until a full crusade window ships. */
export function onCrusadeHudClick(): void {
    const { isActive, statusLabel } = crusadeHudStore.state;
    if (!isActive) {
        return;
    }
    EventBus.emit(TOAST_REQUESTED, {
        message: statusLabel ? `Crusade: ${statusLabel}` : 'Crusade',
        severity: 'info',
        autoClose: 1800,
    });
}

if (typeof window !== 'undefined') {
    const w = window as Window & {
        __helbreathDevSetCrusadeHud?: (active: boolean, statusLabel?: string) => void;
    };
    w.__helbreathDevSetCrusadeHud = (active, statusLabel = 'active') => {
        setCrusadeHudActive(active, active ? statusLabel : '');
    };
}
