/**
 * Weighted kill-value (EK) — PURE, deterministic functions. Server-side ranking/weighting only; nothing on-chain.
 * Mirrors db/schema.sql (public_ledger.city_ranking / recompute_weights). Public-safe: no location data.
 *
 * Rules (Martín): killing a player ranked 1–10 in the OPPOSING city's kill ranking = 3 EK, 11–30 = 2 EK, else 1 EK.
 *  - Ranking basis: count of CREDITED raw kills (not weighted) per city, over a ROLLING 30-DAY window (fixed rule;
 *    no lifetime/season mode). Snapshot rank at killed_at = rank over credited kills in [killed_at - 30d, killed_at).
 *  - Victim rank is SNAPSHOTTED at killed_at (kills strictly before killed_at), in the victim's OWN city.
 *  - Ties: higher count first, then whoever reached that count earliest (time of their latest in-window credited kill), then pubkey.
 *  - Only credited kills are weighted; pair-limit / level-gap / burned = 0.
 *  - Same-city kills = same_city_weight (UNSET / owner decision). null => weight 0 (fail closed). Unranked victims fall into the open-ended band.
 */
import type { KillStatus } from './public-types';

export interface EkBand { rank_from: number; rank_to: number | null; weight: number; label: string; }
export interface EkRulesVersion {
  version: string;
  effective_from: string; // ISO; the version applies to kills with killed_at >= effective_from (until the next version)
  /** Rolling window in days. Fixed rule confirmed by Martín: 30 (no lifetime / season mode). Stored per version for traceability. */
  ranking_window_days: number;
  /** Owner decision — null means unset (fail closed: same-city credited kills weigh 0). */
  same_city_weight: number | null;
  bands: EkBand[];
}
export interface City { city_id: string; name: string; }
export interface LedgerKill {
  combat_id: string; attacker_pubkey: string; victim_pubkey: string; killed_at: string; status: KillStatus;
}
export type CityOf = (pubkey: string) => string | undefined;

export interface RankEntry { rank: number; pubkey: string; credited_kills: number; reached_at: string; }
export interface KillWeight {
  combat_id: string;
  rules_version: string;
  attacker_city: string | null;
  victim_city: string | null;
  cross_city: boolean;
  victim_rank_snapshot: number | null;
  band_label: string | null;
  weight: number;
}

/** Fixed rule (Martín, 2026-09-25): rolling 30 days of credited kills per city. */
export const EK_RANKING_WINDOW_DAYS = 30;

export const DEFAULT_RULES: EkRulesVersion = {
  version: 'ek-v1', effective_from: '2026-01-01T00:00:00.000Z', ranking_window_days: EK_RANKING_WINDOW_DAYS, same_city_weight: null,
  bands: [
    { rank_from: 1, rank_to: 10, weight: 3, label: 'Top 10 kill' },
    { rank_from: 11, rank_to: 30, weight: 2, label: 'Top 30 kill' },
    { rank_from: 31, rank_to: null, weight: 1, label: 'Standard' },
  ],
};

const DAY_MS = 86_400_000;
/** Code-point string compare (matches Postgres COLLATE "C"), never locale-dependent. */
export const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Validates bands: start at 1, contiguous, non-overlapping, last one open-ended, weights >= 0. */
export function validateBands(bands: EkBand[]): void {
  const b = [...bands].sort((x, y) => x.rank_from - y.rank_from);
  if (!b.length || b[0].rank_from !== 1) throw new Error('bands must start at rank 1');
  b.forEach((band, i) => {
    if (band.weight < 0 || !Number.isFinite(band.weight)) throw new Error('band weight must be >= 0');
    const last = i === b.length - 1;
    if (last ? band.rank_to !== null : band.rank_to === null) throw new Error('only the last band may be open-ended');
    if (!last && b[i + 1].rank_from !== (band.rank_to as number) + 1) throw new Error('bands must be contiguous');
  });
}

export function bandFor(rank: number | null, bands: EkBand[]): EkBand {
  const b = [...bands].sort((x, y) => x.rank_from - y.rank_from);
  if (rank === null) return b[b.length - 1]; // unranked -> open-ended ("anything else")
  return b.find((x) => rank >= x.rank_from && (x.rank_to === null || rank <= x.rank_to)) ?? b[b.length - 1];
}

/** Index of credited kills sorted by time (deterministic tie order by combat_id). */
export interface CreditedIndex { times: number[]; kills: LedgerKill[]; }
export function indexCredited(kills: LedgerKill[]): CreditedIndex {
  const c = kills.filter((k) => k.status === 'credited')
    .sort((a, b) => Date.parse(a.killed_at) - Date.parse(b.killed_at) || cmp(a.combat_id, b.combat_id));
  return { kills: c, times: c.map((k) => Date.parse(k.killed_at)) };
}
const lowerBound = (a: number[], v: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; } return lo; };

/** City ranking as of `at` (exclusive): credited kills in [at - window, at) by attackers of `city`. */
export function cityRanking(idx: CreditedIndex, cityOf: CityOf, city: string, at: number, windowDays: number = EK_RANKING_WINDOW_DAYS): RankEntry[] {
  if (!(windowDays > 0)) throw new Error('ranking window must be > 0 days');
  const start = lowerBound(idx.times, at - windowDays * DAY_MS), end = lowerBound(idx.times, at);
  const agg = new Map<string, { n: number; last: number }>();
  for (let i = start; i < end; i++) {
    const k = idx.kills[i];
    if (cityOf(k.attacker_pubkey) !== city) continue;
    const e = agg.get(k.attacker_pubkey);
    if (e) { e.n++; e.last = idx.times[i]; } else agg.set(k.attacker_pubkey, { n: 1, last: idx.times[i] });
  }
  return [...agg.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[1].last - b[1].last || cmp(a[0], b[0]))
    .map(([pubkey, e], i) => ({ rank: i + 1, pubkey, credited_kills: e.n, reached_at: new Date(e.last).toISOString() }));
}

/**
 * Deterministic weights for all kills in [from, to) under ONE rules version.
 * Ranking context always uses the FULL ledger (so a partial recompute equals a full one for the same rows).
 */
export function computeKillWeights(kills: LedgerKill[], cityOf: CityOf, rules: EkRulesVersion, range: { from?: string; to?: string } = {}): KillWeight[] {
  validateBands(rules.bands);
  if (!(rules.ranking_window_days > 0)) throw new Error('ranking_window_days must be > 0');
  const idx = indexCredited(kills);
  const lo = range.from ? Date.parse(range.from) : -Infinity, hi = range.to ? Date.parse(range.to) : Infinity;
  const cache = new Map<string, Map<string, number>>(); // `${city}|${at}` -> pubkey -> rank
  return kills
    .filter((k) => { const t = Date.parse(k.killed_at); return t >= lo && t < hi; })
    .sort((a, b) => Date.parse(a.killed_at) - Date.parse(b.killed_at) || cmp(a.combat_id, b.combat_id))
    .map((k) => {
      const at = Date.parse(k.killed_at);
      const vc = cityOf(k.victim_pubkey) ?? null, ac = cityOf(k.attacker_pubkey) ?? null;
      let rank: number | null = null;
      if (vc) {
        const key = `${vc}|${at}`;
        let m = cache.get(key);
        if (!m) { m = new Map(cityRanking(idx, cityOf, vc, at, rules.ranking_window_days).map((r) => [r.pubkey, r.rank])); cache.set(key, m); }
        rank = m.get(k.victim_pubkey) ?? null;
      }
      const cross = Boolean(ac && vc && ac !== vc);
      let weight = 0, band_label: string | null = null;
      if (k.status === 'credited') {
        if (cross) { const b = bandFor(rank, rules.bands); weight = b.weight; band_label = b.label; }
        else { weight = rules.same_city_weight ?? 0; band_label = 'Same city'; }
      }
      return { combat_id: k.combat_id, rules_version: rules.version, attacker_city: ac, victim_city: vc, cross_city: cross, victim_rank_snapshot: rank, band_label, weight };
    });
}

/** Which rules version applies to a kill: latest effective_from <= killed_at. */
export function applicableVersion(versions: EkRulesVersion[], killedAt: string): EkRulesVersion | undefined {
  const t = Date.parse(killedAt);
  return [...versions].filter((v) => Date.parse(v.effective_from) <= t).sort((a, b) => Date.parse(b.effective_from) - Date.parse(a.effective_from))[0];
}

/** Weights for every kill, each under its applicable version (what the public viewer shows). */
export function computeApplicableWeights(kills: LedgerKill[], cityOf: CityOf, versions: EkRulesVersion[]): Map<string, KillWeight> {
  const out = new Map<string, KillWeight>();
  for (const v of versions) {
    const next = versions.filter((x) => Date.parse(x.effective_from) > Date.parse(v.effective_from)).map((x) => x.effective_from).sort()[0];
    for (const w of computeKillWeights(kills, cityOf, v, { from: v.effective_from, to: next })) out.set(w.combat_id, w);
  }
  return out;
}

/** Stable fingerprint (for determinism tests / recompute verification). */
export function weightsFingerprint(ws: KillWeight[]): string {
  return [...ws].sort((a, b) => cmp(a.combat_id, b.combat_id))
    .map((w) => `${w.combat_id}:${w.rules_version}:${w.victim_rank_snapshot ?? '-'}:${w.weight}`).join('|');
}
