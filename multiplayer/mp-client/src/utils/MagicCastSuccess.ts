/**
 * Olympia magic cast success % (Client.cpp DrawDialogBox_Magic).
 * Shown under each magic circle in F7; server rolls the same formula.
 */

/** Circle 1–10 base points before Magic-skill %. */
export const CIRCLE_BASE_PROB = [0, 300, 250, 200, 150, 100, 80, 70, 60, 50, 40] as const;

/** Penalty band when casting above player level/10. */
export const CIRCLE_LEVEL_PENALTY = [0, 5, 5, 8, 8, 10, 14, 28, 32, 36, 40] as const;

export type MagicWeatherKind = 'dry' | 'light' | 'medium' | 'heavy';

/**
 * @param magicSkill  Magic mastery 0–100 (skill id 4)
 * @param intelligence INT (effective)
 * @param level character level
 * @param circle 1–10
 */
export function computeMagicCastSuccessPercent(
    magicSkill: number,
    intelligence: number,
    level: number,
    circle: number,
    weather: MagicWeatherKind = 'dry',
    lowSp = false,
): number {
    const c = Math.max(1, Math.min(10, Math.floor(circle)));
    const skill = magicSkill <= 0 ? 1 : magicSkill;
    let result = Math.floor((skill / 100) * CIRCLE_BASE_PROB[c]);

    if (intelligence > 50) {
        result += Math.floor((intelligence - 50) / 2);
    }

    const levelBand = Math.floor(level / 10);
    if (c !== levelBand) {
        if (c > levelBand) {
            const dV1 = level - levelBand * 10;
            const dV2 = Math.abs(c - levelBand) * CIRCLE_LEVEL_PENALTY[c];
            const dV3 = Math.max(1, Math.abs(c - levelBand) * 10);
            const dV4 = (dV1 / dV3) * dV2;
            result -= Math.abs(Math.abs(c - levelBand) * CIRCLE_LEVEL_PENALTY[c] - Math.floor(dV4));
        } else {
            result += 5 * Math.abs(c - levelBand);
        }
    }

    if (weather === 'light') {
        result = result - Math.floor(result / 24);
    } else if (weather === 'medium') {
        result = result - Math.floor(result / 12);
    } else if (weather === 'heavy') {
        result = result - Math.floor(result / 5);
    }

    if (result > 100) {
        result = 100;
    }
    if (lowSp) {
        result = Math.floor((result * 9) / 10);
    }
    if (result < 1) {
        result = 1;
    }
    return result;
}
