/** localStorage key for first-touch referral code from ?ref= or Character List paste. */
const STORAGE_KEY = 'cl_referral_code';

/** Accept NAME-XXXX or bare codes / full share URLs. */
export function normalizeReferralInput(raw: string | undefined | null): string | undefined {
    if (!raw) {
        return undefined;
    }
    let s = raw.trim();
    if (!s) {
        return undefined;
    }
    const refIdx = s.toLowerCase().indexOf('ref=');
    if (refIdx >= 0) {
        s = s.slice(refIdx + 4);
        const cut = s.search(/[&#?\s]/);
        if (cut >= 0) {
            s = s.slice(0, cut);
        }
    }
    s = s.replace(/^https?:\/\/[^/]+\/?/i, '').replace(/^\?ref=/i, '');
    s = s.trim().replace(/^["']|["']$/g, '').toUpperCase();
    // NAME-XXXX or 4–20 alnum/hyphen
    if (s.length >= 4 && s.length <= 24 && /^[A-Z0-9-]+$/.test(s)) {
        return s;
    }
    return undefined;
}

/**
 * Capture ?ref= from the current URL into localStorage (idempotent first-touch).
 * Call once on app boot.
 */
export function captureReferralFromUrl(): string | undefined {
    try {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('ref') || params.get('REF') || '';
        const code = normalizeReferralInput(raw);
        if (code) {
            // First-touch only: do not overwrite a code the user already applied.
            if (!localStorage.getItem(STORAGE_KEY)) {
                localStorage.setItem(STORAGE_KEY, code);
            }
            if (params.has('ref') || params.has('REF')) {
                params.delete('ref');
                params.delete('REF');
                const q = params.toString();
                const next = `${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`;
                window.history.replaceState({}, '', next);
            }
            return localStorage.getItem(STORAGE_KEY) || code;
        }
    } catch {
        /* ignore */
    }
    return getStoredReferralCode();
}

export function getStoredReferralCode(): string | undefined {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        return v && v.length > 0 ? v : undefined;
    } catch {
        return undefined;
    }
}

/** User paste on Character List — first-touch only (lifetime once per wallet server-side). */
export function applyReferralCodeFromUser(raw: string): { ok: boolean; code?: string; message: string } {
    const code = normalizeReferralInput(raw);
    if (!code) {
        return { ok: false, message: 'Invalid code. Use NAME-XXXX or the full ?ref= link.' };
    }
    try {
        const existing = localStorage.getItem(STORAGE_KEY);
        if (existing && existing !== code) {
            return {
                ok: false,
                message: `You already applied ${existing}. Each wallet can use one referral (lifetime).`,
            };
        }
        localStorage.setItem(STORAGE_KEY, code);
        return { ok: true, code, message: `Referral ${code} saved — starts when you enter the world.` };
    } catch {
        return { ok: false, message: 'Could not save referral code in this browser.' };
    }
}

export function buildShareUrl(code: string): string {
    return `https://play.chainlords.net/?ref=${encodeURIComponent(code)}`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        /* fall through */
    }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
}
