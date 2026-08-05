import { evaluateOlympiaNftTier, type OlympiaNftTier } from './olympiaDropRules';

/** Stone Of Xelima — upgrade mat (Items.json id 656). */
export const RECYCLE_STONE_XELIMA_ID = 656;
/** Stone Of Merien — upgrade mat (Items.json id 657). */
export const RECYCLE_STONE_MERIEN_ID = 657;
/** Crystal — generic fragment mat (Items.json id 358). */
export const RECYCLE_CRYSTAL_ID = 358;

export interface OlympiaRecycleEstimate {
    /** Primary magic roll intensity (m_dwAttribute shard nibble). */
    shards: number;
    /** Secondary magic roll intensity (m_dwAttribute fragment nibble). */
    fragments: number;
    /** Estimated Crystal stacks recovered. */
    crystals: number;
    stoneXelima: number;
    stoneMerien: number;
    /** Human-readable summary for toast / detail panel. */
    summary: string;
    /** True until server RecycleBagItem is wired. */
    isStub: true;
}

/**
 * Approximate Olympia-style recycle yield from an item's magic attribute bitfield.
 *
 * Olympia stores magic as m_dwAttribute nibbles (see OlympiaItemName / NftDropEvaluator):
 * primary type/value ≈ "shard" line, secondary type/value ≈ "fragment" line.
 * There is no authored recycle table in this repo yet — this MVP maps those nibbles
 * onto Crystal + upgrade stones so the UI can show a concrete estimate.
 */
export function estimateOlympiaItemRecycle(args: {
    itemId: number;
    itemAttribute?: number;
    nftTier?: OlympiaNftTier | null;
}): OlympiaRecycleEstimate {
    const attr = args.itemAttribute ?? 0;
    const primaryType = (attr >> 20) & 0xf;
    const primaryValue = (attr >> 16) & 0xf;
    const secondaryType = (attr >> 12) & 0xf;
    const secondaryValue = (attr >> 8) & 0xf;
    const rep = (attr >> 28) & 0xf;
    const tier = args.nftTier ?? evaluateOlympiaNftTier(args.itemId, attr);

    const shards = primaryType !== 0 ? Math.max(1, primaryValue) : 0;
    const fragments = secondaryType !== 0 ? Math.max(1, secondaryValue) : 0;

    let crystals = 1 + shards + fragments;
    if (rep >= 6) {
        crystals += 2;
    }

    let stoneXelima = 0;
    let stoneMerien = 0;
    if (tier === 'super_rare') {
        stoneXelima = 1;
        stoneMerien = 1;
    } else if (tier === 'rare' || fragments > 0) {
        stoneXelima = shards > 0 ? 1 : 0;
        stoneMerien = fragments > 0 ? 1 : 0;
    }

    const parts: string[] = [`${crystals}× Crystal`];
    if (stoneXelima > 0) {
        parts.push(`${stoneXelima}× Stone of Xelima`);
    }
    if (stoneMerien > 0) {
        parts.push(`${stoneMerien}× Stone of Merien`);
    }
    if (shards > 0 || fragments > 0) {
        parts.push(`(shard ${shards} / fragment ${fragments})`);
    }

    return {
        shards,
        fragments,
        crystals,
        stoneXelima,
        stoneMerien,
        summary: parts.join(' · '),
        isStub: true,
    };
}
