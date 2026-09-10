/**
 * Guide-map pins for Magias / city learn: Wizard Tower door and garden exits.
 * Coords are walkable approach tiles (not the blue warp cell itself).
 */
export interface CityLandmark {
    id: string;
    label: string;
    x: number;
    y: number;
    /** Short minimap glyph */
    glyph: string;
}

const LANDMARKS_BY_MAP: Record<string, readonly CityLandmark[]> = {
    elvine: [
        {
            id: 'elvine-gandalf',
            label: 'Gandalf · Wizard Tower door (learn Fire Strike)',
            x: 181,
            y: 78,
            glyph: 'G',
        },
    ],
    aresden: [
        {
            id: 'aresden-gandalf',
            label: 'Gandalf · Wizard Tower door',
            x: 56,
            y: 116,
            glyph: 'G',
        },
    ],
    elvuni: [
        {
            id: 'elvuni-exit',
            label: 'Exit → Hunt Zone 1 (then south to Elvine city)',
            x: 175,
            y: 24,
            glyph: 'E',
        },
    ],
    areuni: [
        {
            id: 'areuni-exit',
            label: 'Exit → Hunt Zone 2 (then Aresden city)',
            x: 86,
            y: 21,
            glyph: 'E',
        },
    ],
    huntzone1: [
        {
            id: 'hz1-elvine',
            label: 'Elvine city gate (south)',
            x: 51,
            y: 178,
            glyph: 'C',
        },
        {
            id: 'hz1-garden',
            label: 'Garden (hostile) — west wall',
            x: 21,
            y: 52,
            glyph: 'W',
        },
    ],
};

function normalizeMapName(mapName: string | undefined): string {
    if (!mapName) {
        return '';
    }
    const base = mapName.replace(/\.(amd|txt)$/i, '').trim().toLowerCase();
    const slash = base.lastIndexOf('/');
    return slash >= 0 ? base.slice(slash + 1) : base;
}

export function getCityLandmarksForMap(mapName: string | undefined): readonly CityLandmark[] {
    return LANDMARKS_BY_MAP[normalizeMapName(mapName)] ?? [];
}
