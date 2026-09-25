// In-memory EK view over a raw ledger (used by SAMPLE repos and tests; Postgres mode uses kill_weights + SQL functions).
import type { CityRanking, PublicKill, RawKill } from './public-types';
import { cityRanking, computeApplicableWeights, indexCredited, type City, type EkRulesVersion, type KillWeight } from './ek-weights';

export interface LedgerCharacter { name: string; level: number; pubkey: string; city_id: string | null; }

export function buildEkView(characters: LedgerCharacter[], raw: RawKill[], versions: EkRulesVersion[], cities: City[]) {
  const cityMap = new Map(characters.map((c) => [c.pubkey, c.city_id ?? undefined]));
  const cityOf = (pk: string) => cityMap.get(pk);
  const weights = computeApplicableWeights(raw, cityOf, versions);
  const idx = indexCredited(raw);
  const byPk = new Map(characters.map((c) => [c.pubkey, c]));
  const current = [...versions].sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];

  const enrich = (k: RawKill): PublicKill => {
    const w: KillWeight | undefined = weights.get(k.combat_id);
    return {
      ...k,
      loot_revealed: true,
      attacker_city: cityOf(k.attacker_pubkey) ?? null,
      victim_city: cityOf(k.victim_pubkey) ?? null,
      ek: {
        weight: w?.weight ?? 0, victim_rank_snapshot: w?.victim_rank_snapshot ?? null, band_label: w?.band_label ?? null,
        cross_city: w?.cross_city ?? false, rules_version: w?.rules_version ?? current.version,
      },
    };
  };
  const kills = raw.map(enrich).sort((a, b) => b.killed_at.localeCompare(a.killed_at));

  /** Live ranking per city as of `at` (exclusive), same function as the snapshot. */
  function rankings(at: Date, limit = 30): CityRanking[] {
    const t = at.getTime(), from = t - current.ranking_window_days * 86_400_000;
    const ekInWindow = new Map<string, number>();
    for (const k of kills) {
      const kt = Date.parse(k.killed_at);
      if (kt >= from && kt < t) ekInWindow.set(k.attacker_pubkey, (ekInWindow.get(k.attacker_pubkey) ?? 0) + k.ek.weight);
    }
    return cities.map((c) => ({
      city_id: c.city_id, city_name: c.name, as_of: at.toISOString(), window_days: current.ranking_window_days,
      rows: cityRanking(idx, cityOf, c.city_id, t, current.ranking_window_days).slice(0, limit).map((r) => ({
        rank: r.rank, pubkey: r.pubkey, name: byPk.get(r.pubkey)?.name ?? r.pubkey, level: byPk.get(r.pubkey)?.level ?? 0,
        credited_kills: r.credited_kills, weighted_ek: ekInWindow.get(r.pubkey) ?? 0,
      })),
    }));
  }
  function currentRank(pubkey: string, at: Date): number | null {
    const city = cityOf(pubkey); if (!city) return null;
    return cityRanking(idx, cityOf, city, at.getTime(), current.ranking_window_days).find((r) => r.pubkey === pubkey)?.rank ?? null;
  }
  return { kills, weights, rankings, currentRank, current, cityOf };
}
