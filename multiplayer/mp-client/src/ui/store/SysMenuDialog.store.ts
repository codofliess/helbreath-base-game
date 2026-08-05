import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import {
    IN_UI_CHANGE_DETAIL_LEVEL,
    IN_UI_CHANGE_MUSIC_ENABLED,
    IN_UI_CHANGE_SOUND_ENABLED,
    IN_UI_RAIN_SOUNDS_CHANGED,
} from '../../constants/EventNames';

export type DetailLevel = 0 | 1 | 2;

interface SysMenuState {
    isOpen: boolean;
    detailLevel: DetailLevel;
    soundEnabled: boolean;
    musicEnabled: boolean;
    whisperEnabled: boolean;
    shoutEnabled: boolean;
    transparencyEnabled: boolean;
    guideMapEnabled: boolean;
    /** Olympia Game Options: play rain loop when raining (P2.10). */
    rainSoundsEnabled: boolean;
}

const STORAGE_KEY = 'hb-sys-menu';

function loadState(): Omit<SysMenuState, 'isOpen'> {
    if (typeof window === 'undefined') {
        return defaultPrefs();
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return defaultPrefs();
        }

        const parsed = JSON.parse(raw) as Partial<Omit<SysMenuState, 'isOpen'>>;
        return {
            detailLevel: parsed.detailLevel === 0 || parsed.detailLevel === 1 || parsed.detailLevel === 2
                ? parsed.detailLevel
                : 1,
            soundEnabled: parsed.soundEnabled ?? true,
            musicEnabled: parsed.musicEnabled ?? true,
            whisperEnabled: parsed.whisperEnabled ?? true,
            shoutEnabled: parsed.shoutEnabled ?? true,
            transparencyEnabled: parsed.transparencyEnabled ?? false,
            guideMapEnabled: parsed.guideMapEnabled ?? false,
            rainSoundsEnabled: parsed.rainSoundsEnabled ?? true,
        };
    } catch {
        return defaultPrefs();
    }
}

function defaultPrefs(): Omit<SysMenuState, 'isOpen'> {
    return {
        detailLevel: 1,
        soundEnabled: true,
        musicEnabled: true,
        whisperEnabled: true,
        shoutEnabled: true,
        transparencyEnabled: false,
        guideMapEnabled: false,
        rainSoundsEnabled: true,
    };
}

function persist(state: Omit<SysMenuState, 'isOpen'>): void {
    if (typeof window === 'undefined') {
        return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function applyTransparency(enabled: boolean): void {
    document.body.classList.toggle('dialog-transparent', enabled);
}

const prefs = loadState();
applyTransparency(prefs.transparencyEnabled);

export const sysMenuDialogStore = new Store<SysMenuState>({
    isOpen: false,
    ...prefs,
});

export function toggleSysMenuDialog(): void {
    sysMenuDialogStore.setState((s) => ({ ...s, isOpen: !s.isOpen }));
}

export function setSysMenuDialogOpen(value: boolean): void {
    sysMenuDialogStore.setState((s) => ({ ...s, isOpen: value }));
}

function updatePrefs(patch: Partial<Omit<SysMenuState, 'isOpen'>>): void {
    sysMenuDialogStore.setState((s) => {
        const next = { ...s, ...patch };
        persist(next);
        if (patch.transparencyEnabled !== undefined) {
            applyTransparency(patch.transparencyEnabled);
        }
        return next;
    });
}

export function setDetailLevel(level: DetailLevel): void {
    updatePrefs({ detailLevel: level });
    EventBus.emit(IN_UI_CHANGE_DETAIL_LEVEL, level);
}

/** Cycle Low → Normal → High → Low (Ctrl+Alt+D). */
export function cycleDetailLevel(): DetailLevel {
    const cur = sysMenuDialogStore.state.detailLevel;
    const next = ((cur + 1) % 3) as DetailLevel;
    setDetailLevel(next);
    return next;
}

export function setSoundEnabled(value: boolean): void {
    updatePrefs({ soundEnabled: value });
    EventBus.emit(IN_UI_CHANGE_SOUND_ENABLED, value);
}

export function toggleSoundEnabled(): boolean {
    const next = !sysMenuDialogStore.state.soundEnabled;
    setSoundEnabled(next);
    return next;
}

export function setMusicEnabled(value: boolean): void {
    updatePrefs({ musicEnabled: value });
    EventBus.emit(IN_UI_CHANGE_MUSIC_ENABLED, value);
}

export function toggleMusicEnabled(): boolean {
    const next = !sysMenuDialogStore.state.musicEnabled;
    setMusicEnabled(next);
    return next;
}

export function setWhisperEnabled(value: boolean): void {
    updatePrefs({ whisperEnabled: value });
}

export function toggleWhisperEnabled(): boolean {
    const next = !sysMenuDialogStore.state.whisperEnabled;
    setWhisperEnabled(next);
    return next;
}

export function setShoutEnabled(value: boolean): void {
    updatePrefs({ shoutEnabled: value });
}

export function toggleShoutEnabled(): boolean {
    const next = !sysMenuDialogStore.state.shoutEnabled;
    setShoutEnabled(next);
    return next;
}

export function setTransparencyEnabled(value: boolean): void {
    updatePrefs({ transparencyEnabled: value });
}

/** Olympia F11 / Ctrl+W — toggle dialog + guide-map translucency. */
export function toggleTransparencyEnabled(): void {
    const next = !sysMenuDialogStore.state.transparencyEnabled;
    setTransparencyEnabled(next);
}

export function setGuideMapEnabled(value: boolean): void {
    updatePrefs({ guideMapEnabled: value });
}

export function setRainSoundsEnabled(value: boolean): void {
    updatePrefs({ rainSoundsEnabled: value });
    EventBus.emit(IN_UI_RAIN_SOUNDS_CHANGED, value);
}

export function toggleRainSoundsEnabled(): boolean {
    const next = !sysMenuDialogStore.state.rainSoundsEnabled;
    setRainSoundsEnabled(next);
    return next;
}

/**
 * SysMenu F12 shortcut labels (left of On/Off).
 * Olympia-style: Ctrl + letter only (no Alt). Keep in sync with `main.tsx`.
 */
export const SYS_MENU_SHORTCUTS = {
    detailLevel: 'Ctrl+D',
    sound: 'Ctrl+S',
    music: 'Ctrl+U',
    rainSounds: 'Ctrl+R',
    whisper: 'Ctrl+Q',
    shout: 'Ctrl+H',
    transparency: 'F11',
    /** Olympia-style tile grid (also Map debug dialog). */
    showGrid: 'Ctrl+G',
    guideMap: 'Ctrl+M',
    langTag: 'Ctrl+L',
    training: 'F10',
    sysMenu: 'F12',
} as const;
