import { TemporaryEffectType } from '../Types';
import { partyStore } from '../ui/store/Party.store';
import type { Player } from '../game/objects/Player';

/** FOE affiliation color from Olympia DrawObjectName (_iGetFOE). */
export type PlayerHoverFoe = -1 | 0 | 1;

/**
 * Builds Olympia DrawObjectName hover fields for a player under the cursor.
 * Affiliation colors: enemy red, neutral blue, ally/self green.
 */
export function buildPlayerHoverDisplay(
    hovered: Player,
    localPlayer: Player | undefined,
): {
    displayName: string;
    guildLine?: string;
    affiliation: string;
    affiliationColor: { r: number; g: number; b: number };
    foe: PlayerHoverFoe;
} {
    const baseName = hovered.getCharacterName() || 'Unknown';
    let displayName = baseName;

    const partyNames = partyStore.state.memberNames;
    if (partyNames.some((n) => n === baseName)) {
        displayName += ', Party Member';
    }
    if (hovered.hasTemporaryEffect(TemporaryEffectType.Berserk)) {
        displayName += ' Berserk';
    }
    if (hovered.hasTemporaryEffect(TemporaryEffectType.Chill)) {
        displayName += ' Frozen';
    }

    const isSelf = localPlayer !== undefined && hovered === localPlayer;
    const guildLine: string | undefined = undefined;

    const side = normalizeSide(hovered.getCitizenshipSide());
    const affiliation = affiliationLabel(side);
    const foe = resolvePlayerHoverFoe(localPlayer?.getCitizenshipSide(), side, isSelf);
    const affiliationColor =
        foe < 0
            ? { r: 255, g: 0, b: 0 }
            : foe === 0
              ? { r: 50, g: 50, b: 255 }
              : { r: 30, g: 200, b: 30 };

    return { displayName, guildLine, affiliation, affiliationColor, foe };
}

function normalizeSide(side: string | undefined): 'aresden' | 'elvine' | 'traveler' {
    const s = (side ?? '').trim().toLowerCase();
    if (s === 'aresden' || s === 'elvine') {
        return s;
    }
    return 'traveler';
}

/**
 * Olympia DrawObjectName affiliation strings (DEF_MSG_* / DRAW_OBJECT_NAME60).
 * Traveller spelling is classic British (Olympia). Hunter/soldier/PK flags not wired yet → Civilian.
 */
function affiliationLabel(side: 'aresden' | 'elvine' | 'traveler'): string {
    switch (side) {
        case 'aresden':
            return 'Aresden Civilian';
        case 'elvine':
            return 'Elvine Civilian';
        default:
            return 'Traveller';
    }
}

/**
 * Olympia _iGetFOE simplified for traveler citizenship:
 * opposing cities = enemy (−1), traveler involved = neutral (0), same city / self = ally (1).
 */
export function resolvePlayerHoverFoe(
    localSideRaw: string | undefined,
    otherSideRaw: string | undefined,
    isSelf: boolean,
): PlayerHoverFoe {
    if (isSelf) {
        return 1;
    }
    const localSide = normalizeSide(localSideRaw);
    const otherSide = normalizeSide(otherSideRaw);
    if (localSide === 'traveler' || otherSide === 'traveler') {
        return 0;
    }
    if (localSide !== otherSide) {
        return -1;
    }
    return 1;
}
