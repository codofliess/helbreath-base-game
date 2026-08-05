/**
 * Character List / Create visual variants for local comparison.
 *
 * URL:  ?charUi=a | b | hybrid   (default hybrid — studio rec)
 * Also stored in localStorage `cl-char-ui` so the corner switcher sticks.
 *
 * a      = Chamber of Seals (4 equal portal seals)
 * b      = Hero Under the Goddesses (list + large stage)
 * hybrid = A + touch of B (4 seals, selected elevated/larger)
 */

export type CharUiMode = 'a' | 'b' | 'hybrid';

const STORAGE_KEY = 'cl-char-ui';
/** Studio ship choice: layout B (list + centered hero + detail). */
const DEFAULT_MODE: CharUiMode = 'b';

export function isCharUiMode(value: string | null | undefined): value is CharUiMode {
    return value === 'a' || value === 'b' || value === 'hybrid';
}

export function getCharUiMode(): CharUiMode {
    try {
        const params = new URLSearchParams(window.location.search);
        const fromUrl = params.get('charUi')?.toLowerCase();
        if (isCharUiMode(fromUrl)) {
            return fromUrl;
        }
    } catch {
        // ignore
    }
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (isCharUiMode(stored)) {
            return stored;
        }
    } catch {
        // ignore
    }
    return DEFAULT_MODE;
}

export function setCharUiMode(mode: CharUiMode): void {
    try {
        localStorage.setItem(STORAGE_KEY, mode);
    } catch {
        // ignore
    }
    try {
        const url = new URL(window.location.href);
        url.searchParams.set('charUi', mode);
        window.history.replaceState({}, '', url.toString());
    } catch {
        // ignore
    }
}

export const CHAR_UI_MODE_LABELS: Record<CharUiMode, string> = {
    a: 'A · Seals',
    b: 'B · Hero',
    hybrid: 'Hybrid',
};

/** Brand — always plural Lords. */
export const CHAIN_LORDS_BRAND = 'Helbreath - Chain Lords';
export const CHAIN_LORDS_SHORT = 'Chain Lords';
