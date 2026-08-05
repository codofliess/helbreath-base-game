import { Store } from '@tanstack/react-store';

const STORAGE_PREFIX = 'hb-hud-tutorial-v1:';

export type HudTutorialStepId =
    | 'fullscreen'
    | 'sys'
    | 'f5'
    | 'f6'
    | 'f7'
    | 'f8'
    | 'f9'
    | 'f10'
    | 'mode'
    | 'binds'
    | 'gauges'
    | 'done';

export interface HudTutorialStep {
    id: HudTutorialStepId;
    /** Matches `data-tutorial-id` on the dock control. */
    targetId: string;
    title: string;
    body: string;
    /** Optional keyboard hint shown under the body. */
    shortcut?: string;
}

/** Ordered tour — starts at fullscreen (far right), then walks left through the dock. */
export const HUD_TUTORIAL_STEPS: readonly HudTutorialStep[] = [
    {
        id: 'fullscreen',
        targetId: 'fullscreen',
        title: 'Pantalla completa',
        body: 'Este botón (a la derecha del dock) entra o sale de fullscreen. Recomendado la primera vez para ver mejor el mundo.',
        shortcut: 'Click en ⛶',
    },
    {
        id: 'sys',
        targetId: 'f12',
        title: 'Menú de sistema (F12)',
        body: 'Opciones: sonido, música, minimapa, transparencia y salida. Todo lo de configuración del cliente está acá.',
        shortcut: 'F12',
    },
    {
        id: 'f5',
        targetId: 'f5',
        title: 'Personaje (F5)',
        body: 'Stats, level-up, party y el paper-doll. Revisá fuerza, magia y puntos sin gastar.',
        shortcut: 'F5',
    },
    {
        id: 'f6',
        targetId: 'f6',
        title: 'Bolsa (F6)',
        body: 'Inventario: arrastrá items, doble clic para equipar, y el oro se apila solo. El suelo vacío de la bag mueve la ventana.',
        shortcut: 'F6',
    },
    {
        id: 'f7',
        targetId: 'f7',
        title: 'Magia (F7)',
        body: 'Libro de hechizos por círculo. Elegí un spell y click en el mundo (o target) para castear.',
        shortcut: 'F7',
    },
    {
        id: 'f8',
        targetId: 'f8',
        title: 'Skills (F8)',
        body: 'Progreso de skills de combate y oficios. Suben con uso.',
        shortcut: 'F8',
    },
    {
        id: 'f9',
        targetId: 'f9',
        title: 'Chat (F9) y Enter',
        body: 'F9 abre el log de canales. En el mundo, Enter abre la barra de escritura justo encima del dock (como Olympia). Esc cancela.',
        shortcut: 'F9 · Enter · Esc',
    },
    {
        id: 'f10',
        targetId: 'f10',
        title: 'Academy (F10)',
        body: 'Training y challenges. Shift+F10 abre torneos cuando estén activos.',
        shortcut: 'F10',
    },
    {
        id: 'mode',
        targetId: 'combat-mode',
        title: 'Modo de combate',
        body: 'Peace / Attack / Safe. En Peace no atacás por error a otros jugadores. Tab cambia Peace ↔ Attack.',
        shortcut: 'Click · Tab',
    },
    {
        id: 'binds',
        targetId: 'binds',
        title: 'Atajos F1–F3',
        body: 'Slots rápidos de hechizos o items. Seleccioná un spell o item y Ctrl+F1/F2/F3 para guardarlo. Luego solo F1–F3 lo usa.',
        shortcut: 'Ctrl+F1…F3 · F1…F3',
    },
    {
        id: 'gauges',
        targetId: 'gauges',
        title: 'Barras HP / MP / SP / EXP',
        body: 'Vida, maná, stamina y experiencia. Insert = potiones rojas (HP), Delete = azules (MP), Home = verdes (SP).',
        shortcut: 'Insert · Delete · Home',
    },
] as const;

interface HudTutorialState {
    /** Tour is actively showing steps. */
    active: boolean;
    stepIndex: number;
    /** Character this run is for (dedupe per char). */
    characterKey: string | null;
}

const initialState: HudTutorialState = {
    active: false,
    stepIndex: 0,
    characterKey: null,
};

export const hudTutorialStore = new Store<HudTutorialState>(initialState);

function storageKey(characterKey: string): string {
    return `${STORAGE_PREFIX}${characterKey.trim().toLowerCase()}`;
}

export function isHudTutorialCompleted(characterKey: string): boolean {
    if (!characterKey.trim()) {
        return true;
    }
    try {
        return localStorage.getItem(storageKey(characterKey)) === '1';
    } catch {
        return false;
    }
}

export function markHudTutorialCompleted(characterKey: string): void {
    if (!characterKey.trim()) {
        return;
    }
    try {
        localStorage.setItem(storageKey(characterKey), '1');
    } catch {
        // ignore quota / private mode
    }
}

/**
 * Start traveler HUD tour once per character at low level.
 * Returns false if already done, level too high, or invalid name.
 * Force (ignore level + done): `?hudTutorial=1` or localStorage `hb-hud-tutorial-force=1`.
 */
export function tryStartHudTutorial(characterName: string, level: number): boolean {
    const key = characterName.trim();
    if (!key) {
        return false;
    }

    let force = false;
    try {
        force =
            localStorage.getItem('hb-hud-tutorial-force') === '1' ||
            (typeof window !== 'undefined' &&
                new URLSearchParams(window.location.search).get('hudTutorial') === '1');
    } catch {
        force = false;
    }

    if (!force) {
        if (level > 5) {
            return false;
        }
        if (isHudTutorialCompleted(key)) {
            return false;
        }
    }

    hudTutorialStore.setState(() => ({
        active: true,
        stepIndex: 0,
        characterKey: key,
    }));
    return true;
}

export function advanceHudTutorial(): void {
    hudTutorialStore.setState((s) => {
        if (!s.active) {
            return s;
        }
        const next = s.stepIndex + 1;
        if (next >= HUD_TUTORIAL_STEPS.length) {
            if (s.characterKey) {
                markHudTutorialCompleted(s.characterKey);
            }
            return { active: false, stepIndex: 0, characterKey: null };
        }
        return { ...s, stepIndex: next };
    });
}

export function skipHudTutorial(): void {
    hudTutorialStore.setState((s) => {
        if (s.characterKey) {
            markHudTutorialCompleted(s.characterKey);
        }
        return { active: false, stepIndex: 0, characterKey: null };
    });
}

export function getHudTutorialStep(): HudTutorialStep | null {
    const { active, stepIndex } = hudTutorialStore.state;
    if (!active) {
        return null;
    }
    return HUD_TUTORIAL_STEPS[stepIndex] ?? null;
}
