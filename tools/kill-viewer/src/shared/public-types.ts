/**
 * PUBLIC slice types. Shared by the public API, the public web bundle and (read-only) the admin side.
 * RULE: nothing in this file may describe WHERE a kill happened. No map / location / coordinates.
 */

/** Mirrors the Kill Ledger v2 outcomes (events KillCredited / PairLimitReached / KillBurned / KillRejected). */
export type KillStatus = 'credited' | 'pair_limit_reached' | 'kill_burned' | 'rejected_level_gap';

export const KILL_STATUSES: KillStatus[] = ['credited', 'pair_limit_reached', 'kill_burned', 'rejected_level_gap'];

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ItemCategory = 'weapon' | 'armor' | 'jewel' | 'potion' | 'scroll' | 'material';

export interface ItemDrop {
  item_id: number;
  name: string;
  qty: number;
  /** true = character-bound item (untradeable after pickup). */
  bound: boolean;
  rarity: Rarity;
  category: ItemCategory;
}

/**
 * Loot dropped by the victim on death. Populated by the GAME SERVER into public_ledger (NOT on-chain;
 * keeps kill-report batches small/cheap). "Zem" = in-game currency (assumption: user said "SEM").
 */
export interface KillDrops {
  zem: { dropped: boolean; amount: number };
  items: ItemDrop[];
}

export interface PublicKill {
  combat_id: string; // hex of the 32-byte combat_id used on-chain
  batch_id: string; // server-signed report batch (~10 kills)
  tx_signature: string | null;
  attacker_pubkey: string;
  attacker_name: string;
  attacker_level: number;
  victim_pubkey: string;
  victim_name: string;
  victim_level: number;
  killed_at: string; // ISO-8601 UTC; clients render in viewer's local tz
  day: string; // YYYY-MM-DD (UTC day, as indexed)
  status: KillStatus;
  drops: KillDrops;
  /** false when loot delay is unset or the kill is still inside the loot-reveal window. */
  loot_revealed: boolean;
  attacker_city: string | null; // city_id (names via /api/cities; configurable data)
  victim_city: string | null;
  /** Weighted kill value (server-side, off-chain). */
  ek: PublicEk;
}

export interface PublicEk {
  weight: number; // 0 for non-credited
  victim_rank_snapshot: number | null; // victim's rank in their OWN city at killed_at (rolling 30d credited kills)
  band_label: string | null; // e.g. 'Top 10 kill'
  cross_city: boolean;
  rules_version: string;
}

/** Raw ledger row (indexer + server drops), before city/EK enrichment. */
export type RawKill = Omit<PublicKill, 'attacker_city' | 'victim_city' | 'ek' | 'loot_revealed'>;

export interface CityRankingRow {
  rank: number;
  pubkey: string;
  name: string;
  level: number;
  credited_kills: number; // raw credited kills in the rolling window (ranking basis)
  weighted_ek: number; // sum of EK weights of this player's kills in the same window
}
export interface CityRanking { city_id: string; city_name: string; as_of: string; window_days: number; rows: CityRankingRow[]; }
export interface RankingsResponse {
  sample: boolean;
  rules: { version: string; window_days: number; same_city_weight: number | null; bands: { rank_from: number; rank_to: number | null; weight: number; label: string }[] };
  cities: CityRanking[];
}

export interface CharacterSummary {
  pubkey: string;
  name: string;
  level: number;
  kills_credited: number;
  deaths: number;
  city_id: string | null;
  ek_total: number; // all-time sum of EK weights (credited kills)
  city_rank: number | null; // current rank in own city (rolling 30d)
}

export interface KillListResponse {
  sample: boolean;
  total: number;
  items: PublicKill[];
}

export interface CharacterResponse {
  sample: boolean;
  character: CharacterSummary;
  deaths: PublicKill[];
  kills: PublicKill[];
}

/** Keys that must NEVER appear in any public API response or public bundle. Used by tests + runtime guard. */
export const FORBIDDEN_PUBLIC_KEYS = ['map', 'map_id', 'map_name', 'location', 'loc', 'x', 'y', 'coords', 'coordinates', 'position', 'recorded_at'];
