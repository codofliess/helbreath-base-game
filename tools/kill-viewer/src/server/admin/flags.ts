// Investigation heuristics (admin only). Signals for intentional losses, gold/item gifting, pay-for-play.
// Thresholds are starting points; tune with real data.
import type { KillDrops } from '../../shared/public-types';
import type { FullKill, InvestigationFlag } from '../../shared/private-types';

/** Rough Zem-equivalent value per item (SAMPLE numbers). Admin-side only. */
export const ITEM_VALUE_ZEM: Record<number, number> = {
  101: 300, 102: 350, 110: 4_000, 120: 25_000, 130: 120_000, 201: 400, 210: 3_500, 220: 20_000,
  301: 6_000, 310: 150_000, 401: 20, 402: 25, 501: 50, 510: 30_000, 601: 2_500,
};
export function dropValueZem(d: KillDrops): number {
  const items = d.items.filter((i) => !i.bound).reduce((s, i) => s + (ITEM_VALUE_ZEM[i.item_id] ?? 0) * i.qty, 0);
  return (d.zem.dropped ? d.zem.amount : 0) + items;
}

export interface FlagThresholds {
  repeatedPairMin: number; // pair kills (any status) in window
  sameKillerShare: number; // share of victim's deaths from one killer
  sameKillerMinDeaths: number;
  mapClusterMin: number; // pair kills on same map within radius
  mapClusterRadius: number;
  valuableDropZem: number; // a drop worth >= this is "valuable"
  lootFunnelMin: number; // valuable drops from same victim to same killer
  topRankMax: number; // victim rank snapshot <= this counts as 'top' (EK bands pay 3x/2x)
  topRankDeathMin: number; // deaths of a top player to the same opposing killer within the lookback
  topRankLookbackDays: number;
}
export const DEFAULT_THRESHOLDS: FlagThresholds = {
  repeatedPairMin: 6, sameKillerShare: 0.5, sameKillerMinDeaths: 6, mapClusterMin: 4, mapClusterRadius: 12,
  valuableDropZem: 20_000, lootFunnelMin: 3, topRankMax: 30, topRankDeathMin: 5, topRankLookbackDays: 14,
};

const sev = (v: number, med: number, high: number) => (v >= high ? 'high' : v >= med ? 'medium' : 'low') as InvestigationFlag['severity'];

export function computeFlags(kills: FullKill[], t: FlagThresholds = DEFAULT_THRESHOLDS): InvestigationFlag[] {
  const flags: InvestigationFlag[] = [];
  const pairs = new Map<string, FullKill[]>();
  const byVictim = new Map<string, FullKill[]>();
  for (const k of kills) {
    const key = `${k.attacker_name}\u0000${k.victim_name}`;
    (pairs.get(key) ?? pairs.set(key, []).get(key)!).push(k);
    (byVictim.get(k.victim_name) ?? byVictim.set(k.victim_name, []).get(k.victim_name)!).push(k);
  }

  for (const [, ks] of pairs) {
    const { attacker_name, victim_name } = ks[0];
    const ids = ks.map((k) => k.combat_id);
    // 1) Repeated pair kills (includes PairLimitReached rejects: repeated attempts are themselves a signal).
    if (ks.length >= t.repeatedPairMin) {
      const rejected = ks.filter((k) => k.status === 'pair_limit_reached').length;
      flags.push({ kind: 'repeated_pair', severity: sev(ks.length, t.repeatedPairMin * 1.5, t.repeatedPairMin * 2), attacker_name, victim_name,
        detail: `${ks.length} kills of the same pair (${rejected} hit PairLimitReached)`, combat_ids: ids, metrics: { kills: ks.length, pair_limit_reached: rejected } });
    }
    // 3) Map cluster: many pair kills on the same map within a small radius.
    const byMap = new Map<string, FullKill[]>();
    for (const k of ks) if (k.location) (byMap.get(k.location.map_id) ?? byMap.set(k.location.map_id, []).get(k.location.map_id)!).push(k);
    for (const [map, mk] of byMap) {
      if (mk.length < t.mapClusterMin) continue;
      const cx = mk.reduce((s, k) => s + k.location!.x, 0) / mk.length, cy = mk.reduce((s, k) => s + k.location!.y, 0) / mk.length;
      const near = mk.filter((k) => Math.hypot(k.location!.x - cx, k.location!.y - cy) <= t.mapClusterRadius);
      if (near.length >= t.mapClusterMin) flags.push({ kind: 'map_cluster', severity: sev(near.length, t.mapClusterMin * 2, t.mapClusterMin * 3), attacker_name, victim_name,
        detail: `${near.length} kills on ${map} within ${t.mapClusterRadius} tiles of (${Math.round(cx)},${Math.round(cy)})`,
        combat_ids: near.map((k) => k.combat_id), metrics: { map_id: map, kills: near.length, cx: Math.round(cx), cy: Math.round(cy) } });
    }
    // 4) Loot funneling: same killer repeatedly receiving valuable drops from same victim.
    const valuable = ks.filter((k) => dropValueZem(k.drops) >= t.valuableDropZem);
    if (valuable.length >= t.lootFunnelMin) {
      const total = valuable.reduce((s, k) => s + dropValueZem(k.drops), 0);
      flags.push({ kind: 'loot_funneling', severity: sev(valuable.length, t.lootFunnelMin * 2, t.lootFunnelMin * 3), attacker_name, victim_name,
        detail: `${valuable.length} valuable drops (≈${total.toLocaleString('en-US')} Zem-equiv.) from ${victim_name} to ${attacker_name}`,
        combat_ids: valuable.map((k) => k.combat_id), metrics: { valuable_drops: valuable.length, total_value_zem: total } });
    }
  }
  // 2) Same victim dying to the same killer often.
  for (const [victim, ks] of byVictim) {
    if (ks.length < t.sameKillerMinDeaths) continue;
    const counts = new Map<string, number>();
    ks.forEach((k) => counts.set(k.attacker_name, (counts.get(k.attacker_name) ?? 0) + 1));
    const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const share = n / ks.length;
    if (share >= t.sameKillerShare) flags.push({ kind: 'victim_same_killer', severity: sev(share, 0.65, 0.8), attacker_name: top, victim_name: victim,
      detail: `${Math.round(share * 100)}% of ${victim}'s ${ks.length} deaths are to ${top}`,
      combat_ids: ks.filter((k) => k.attacker_name === top).map((k) => k.combat_id), metrics: { deaths: ks.length, by_top_killer: n, share: Number(share.toFixed(2)) } });
  }
  // 5) Top-rank death selling: a top-30 player (rank snapshot at kill time) repeatedly dying to the same OPPOSING-city killer.
  //    EK bands pay 3x/2x for these victims => incentive to sell deaths. Counts attempts too (pair-limit rejects),
  //    but weights already inherit KillBurned / PairLimitReached / level-gap rejections (they are 0 EK).
  const latest = kills.reduce((m, k) => Math.max(m, Date.parse(k.killed_at)), 0);
  const lookFrom = latest - t.topRankLookbackDays * 86_400_000;
  for (const [, ks] of pairs) {
    const top = ks.filter((k) => k.ek?.cross_city && k.ek.victim_rank_snapshot !== null && k.ek.victim_rank_snapshot <= t.topRankMax && Date.parse(k.killed_at) >= lookFrom);
    if (top.length < t.topRankDeathMin) continue;
    const ek = top.reduce((s, k) => s + k.ek.weight, 0);
    const best = Math.min(...top.map((k) => k.ek.victim_rank_snapshot as number));
    const credited = top.filter((k) => k.status === 'credited').length;
    flags.push({ kind: 'top_rank_death_selling', severity: sev(top.length, t.topRankDeathMin * 1.5, t.topRankDeathMin * 2.5),
      attacker_name: top[0].attacker_name, victim_name: top[0].victim_name,
      detail: `${top[0].victim_name} (rank ≤${t.topRankMax}, best #${best}) died ${top.length}× to ${top[0].attacker_name} in ${t.topRankLookbackDays}d; ${credited} credited = ${ek} EK`,
      combat_ids: top.map((k) => k.combat_id), metrics: { deaths_while_top: top.length, credited, weighted_ek: ek, best_rank: best } });
  }
  const order = { high: 0, medium: 1, low: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}
