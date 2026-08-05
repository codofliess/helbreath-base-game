import { Store } from '@tanstack/react-store';

/** One stack from the server (isShard = gemas de armas / primary). */
export interface EnchantMaterialRow {
    isShard: boolean;
    type: number;
    level: number;
    count: number;
    name: string;
}

/** Species column in the Olympia-style matrix. */
export interface EnchantSpeciesDef {
    type: number;
    /** Short header (matches Olympia bag labels). */
    label: string;
    /** Full name for tooltips. */
    fullName: string;
}

/**
 * Tiers as rows (Olympia bag shows 1…N down the left).
 * No vortex / purity “Gem” column — we cap at 15 for normal magic only.
 */
export const ENCHANT_TIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;

/**
 * Gemas de armas = primary shards (weapon magic).
 * No vortex purity gem path.
 */
export const WEAPON_GEM_SPECIES: EnchantSpeciesDef[] = [
    { type: 1, label: 'Crit', fullName: 'Critical Hit Damage' },
    { type: 2, label: 'Poison', fullName: 'Poisoning' },
    { type: 3, label: 'Right', fullName: 'Righteous' },
    { type: 4, label: 'Crit%', fullName: 'Critical Increase Chance' },
    { type: 5, label: 'Agile', fullName: 'Agile' },
    { type: 6, label: 'Light', fullName: 'Light' },
    { type: 7, label: 'Ancient', fullName: 'Ancient' },
    { type: 8, label: 'Sharp', fullName: 'Sharp / Endurance' },
    { type: 9, label: 'Cast%', fullName: 'Magic Casting Probability' },
    // No Mana Converting on weapons/wands (not a classic weapon primary; TransMana is armor).
    // Special 4th-slot gems: Mana/HP Vamping (not "Siphoning").
    { type: 20, label: 'MVamp', fullName: 'Mana Vamping' },
    { type: 21, label: 'HPVamp', fullName: 'HP Vamping' },
];

/**
 * Gemas de ropa = secondary fragments (armor / cape / shield / helm / boots…).
 * Headers mirror Olympia Enchanting Bag (no Gem / vortex column).
 * Escudos = ropa.
 */
export const ARMOR_GEM_SPECIES: EnchantSpeciesDef[] = [
    { type: 1, label: 'PsnRes', fullName: 'Poison Resistance' },
    { type: 2, label: 'HitP', fullName: 'Hitting Probability' },
    { type: 3, label: 'DefRatio', fullName: 'Defense Ratio' },
    { type: 4, label: 'HPRec', fullName: 'HP Recovery' },
    { type: 5, label: 'SPRec', fullName: 'SP Recovery' },
    { type: 6, label: 'MPRec', fullName: 'MP Recovery' },
    { type: 7, label: 'MagRes', fullName: 'Magic Resistance' },
    { type: 8, label: 'AbsPhy', fullName: 'Physical Absorption' },
    { type: 9, label: 'AbsMag', fullName: 'Magic Absorption' },
    { type: 10, label: 'CAD', fullName: 'Consecutive Attack Damage' },
    { type: 11, label: 'Exp', fullName: 'Experience' },
    { type: 12, label: 'Gold', fullName: 'Gold' },
];

/** 0 = gemas de armas (shards), 1 = gemas de ropa (fragments). */
export type EnchantGemTab = 0 | 1;

interface EnchantBagDialogState {
    isOpen: boolean;
    materials: EnchantMaterialRow[];
    tab: EnchantGemTab;
    selectedType: number | null;
    selectedLevel: number | null;
    statusMessage: string;
}

export const enchantBagDialogStore = new Store<EnchantBagDialogState>({
    isOpen: false,
    materials: [],
    tab: 1, // default to ropa (what the Olympia screenshot shows)
    selectedType: null,
    selectedLevel: null,
    statusMessage: '',
});

export function materialKey(row: Pick<EnchantMaterialRow, 'isShard' | 'type' | 'level'>): string {
    return `${row.isShard ? 's' : 'f'}-${row.type}-${row.level}`;
}

/** Olympia combine cost by display level. */
export function getRequiredCountForUpgrade(level: number): number {
    if (level >= 1 && level <= 5) {
        return 4;
    }
    if (level > 5 && level <= 10) {
        return 3;
    }
    return 2;
}

export function getSpeciesForTab(tab: EnchantGemTab): EnchantSpeciesDef[] {
    return tab === 0 ? WEAPON_GEM_SPECIES : ARMOR_GEM_SPECIES;
}

export function getOwnedCount(
    materials: EnchantMaterialRow[],
    isWeaponGem: boolean,
    type: number,
    level: number,
): number {
    const row = materials.find(
        (m) => m.isShard === isWeaponGem && m.type === type && m.level === level,
    );
    return row?.count ?? 0;
}

export function toggleEnchantBagDialog(): void {
    enchantBagDialogStore.setState((s) => ({ ...s, isOpen: !s.isOpen }));
}

export function setEnchantBagDialogOpen(value: boolean): void {
    enchantBagDialogStore.setState((s) => ({ ...s, isOpen: value }));
}

export function setEnchantBagTab(tab: EnchantGemTab): void {
    enchantBagDialogStore.setState((s) => ({
        ...s,
        tab,
        selectedType: null,
        selectedLevel: null,
    }));
}

export function setEnchantBagSelection(type: number | null, level: number | null): void {
    enchantBagDialogStore.setState((s) => ({
        ...s,
        selectedType: type,
        selectedLevel: level,
    }));
}

export function setEnchantBagStatusMessage(message: string): void {
    enchantBagDialogStore.setState((s) => ({ ...s, statusMessage: message }));
}

export function setEnchantMaterials(
    materials: Array<{
        isShard: boolean;
        type: number;
        level: number;
        count: number;
        name: string;
    }>,
): void {
    const rows: EnchantMaterialRow[] = materials
        .filter((m) => m.count > 0 && m.level > 0)
        .map((m) => ({
            isShard: !!m.isShard,
            type: m.type,
            level: m.level,
            count: m.count,
            name: m.name || (m.isShard ? `Arma#${m.type}` : `Ropa#${m.type}`),
        }));

    enchantBagDialogStore.setState((s) => ({ ...s, materials: rows }));
}

export function countOwnedSpecies(materials: EnchantMaterialRow[], isWeaponGem: boolean): number {
    const types = new Set(
        materials.filter((m) => m.isShard === isWeaponGem && m.count > 0).map((m) => m.type),
    );
    return types.size;
}
