/**
 * Olympia-style compact numeric formatting (bag gold, Required Exp polish).
 */

/** Abbreviate stack counts for bag gold (Olympia: `2.2M`, `1M`, small amounts raw). */
export function formatOlympiaCompactAmount(n: number): string {
    if (!Number.isFinite(n) || n < 0) {
        return '0';
    }
    const v = Math.floor(n);
    if (v < 10_000) {
        return String(v);
    }
    if (v < 1_000_000) {
        const k = v / 1000;
        return k < 100 ? `${k.toFixed(1).replace(/\.0$/, '')}k` : `${Math.round(k)}k`;
    }
    const m = v / 1_000_000;
    if (m < 10) {
        return `${m.toFixed(1).replace(/\.0$/, '')}M`;
    }
    return `${m.toFixed(m < 100 ? 1 : 0).replace(/\.0$/, '')}M`;
}

/**
 * In-game hour 1–24. Full day = 48 real minutes (2 min per game hour), client-local
 * until server snapshot hour is wired (Parity P1.5).
 */
export function getOlympiaGameHour(nowMs: number = Date.now()): number {
    const dayMs = 48 * 60 * 1000;
    const hourIndex = Math.floor(((nowMs % dayMs) / dayMs) * 24);
    return hourIndex + 1;
}

/** Night overlay strength 0–1 from game hour (peak around hour 1 / midnight). */
export function getOlympiaNightStrength(gameHour: number): number {
    const h = ((gameHour - 1) % 24) + 1;
    if (h >= 7 && h <= 17) {
        return 0;
    }
    if (h === 6 || h === 18) {
        return 0.12;
    }
    if (h === 5 || h === 19) {
        return 0.22;
    }
    if (h === 4 || h === 20) {
        return 0.3;
    }
    return 0.38;
}
