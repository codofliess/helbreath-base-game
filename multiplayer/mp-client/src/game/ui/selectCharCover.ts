import { getItemById } from '../../constants/Items';
import type { CharacterMonsterGroupTier, CharacterSlotSummary } from '../../utils/characterListApi';
import { normalizeCitizenshipSide } from '../../utils/characterListApi';
import { heroItemToSide, resolveHeroKitSide } from '../../utils/heroFactionKit';
import { OLYMPIA_SUPER_RARE_ITEM_IDS } from '../../utils/olympiaDropRules';

export interface EquippedCover {
    legendary: string[];
    rare: string[];
}

/**
 * Equipped names for the character cover.
 * Legendary ids come from the Olympia catalog. Other equipped pieces are listed as rare
 * because the character list has no magic-roll attribute.
 */
export function classifyEquippedCover(
    slot: Pick<CharacterSlotSummary, 'equipped' | 'citizenshipSide'>,
): EquippedCover {
    const legendary: string[] = [];
    const rare: string[] = [];
    const rawIds = (slot.equipped ?? []).map((eq) => eq?.itemId ?? 0).filter((id) => id > 0);
    const kitSide = resolveHeroKitSide(slot.citizenshipSide, rawIds);
    for (const eq of slot.equipped ?? []) {
        if (!eq?.itemId) {
            continue;
        }
        const itemId = kitSide ? heroItemToSide(eq.itemId, kitSide) : eq.itemId;
        const def = getItemById(itemId);
        const name = def?.name?.trim() || `Item ${itemId}`;
        if (OLYMPIA_SUPER_RARE_ITEM_IDS.has(itemId)) {
            legendary.push(name);
        } else {
            rare.push(name);
        }
    }
    return { legendary, rare };
}

export function citySealLabel(citizenshipSide: string | undefined): string {
    const city = normalizeCitizenshipSide(citizenshipSide);
    if (city === 'aresden') {
        return 'Aresden (War)';
    }
    if (city === 'elvine') {
        return 'Elvine (Grace)';
    }
    return 'Traveler';
}

/** One cover line. Level 0 is a real specialty (no credited kills), not a placeholder. */
export function formatMonsterGroupLine(tier: Pick<CharacterMonsterGroupTier, 'label' | 'level' | 'leadName'>): string {
    const label = tier.label.trim() || 'Group';
    const level = Number.isFinite(tier.level) ? Math.max(0, tier.level) : 0;
    const lead = (tier.leadName ?? '').trim();
    if (lead && level > 0) {
        return `${label} · L${level} · ${lead}`;
    }
    return `${label} · L${level}`;
}

export function formatPendingNftLine(itemName: string, nftTier: 'rare' | 'super_rare', quantity: number): string {
    const tier = nftTier === 'super_rare' ? 'Legendary' : 'Rare';
    const qty = quantity > 1 ? ` ×${quantity}` : '';
    return `${itemName}${qty} · ${tier}`;
}
