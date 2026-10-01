// PUBLIC API serializer: explicit allowlist. Any field not listed here can never leave the public API.
import { FORBIDDEN_PUBLIC_KEYS, type CharacterSummary, type CityRanking, type KillDrops, type PublicEk, type PublicKill } from '../../shared/public-types';
import type { PublishPolicy } from '../../shared/publish-policy';

export function toPublicKill(r: PublicKill): PublicKill {
  return {
    combat_id: r.combat_id,
    batch_id: r.batch_id,
    tx_signature: r.tx_signature ?? null,
    attacker_pubkey: r.attacker_pubkey,
    attacker_name: r.attacker_name,
    attacker_level: Number(r.attacker_level),
    victim_pubkey: r.victim_pubkey,
    victim_name: r.victim_name,
    victim_level: Number(r.victim_level),
    killed_at: new Date(r.killed_at).toISOString(),
    day: typeof r.day === 'string' ? r.day.slice(0, 10) : new Date(r.day as unknown as Date).toISOString().slice(0, 10),
    status: r.status,
    drops: toPublicDrops(r.drops),
    loot_revealed: true,
    attacker_city: r.attacker_city ?? null,
    victim_city: r.victim_city ?? null,
    ek: toPublicEk(r.ek),
  };
}

function toPublicEk(e: PublicEk | null | undefined): PublicEk {
  return {
    weight: Number(e?.weight ?? 0),
    victim_rank_snapshot: e?.victim_rank_snapshot == null ? null : Number(e.victim_rank_snapshot),
    band_label: e?.band_label ?? null,
    cross_city: Boolean(e?.cross_city),
    rules_version: String(e?.rules_version ?? ''),
  };
}

export function toPublicCharacter(c: CharacterSummary): CharacterSummary {
  return {
    pubkey: c.pubkey, name: c.name, level: Number(c.level), kills_credited: Number(c.kills_credited), deaths: Number(c.deaths),
    city_id: c.city_id ?? null, ek_total: Number(c.ek_total ?? 0), city_rank: c.city_rank == null ? null : Number(c.city_rank),
  };
}

export function toPublicRanking(r: CityRanking): CityRanking {
  return {
    city_id: r.city_id, city_name: r.city_name, as_of: r.as_of, window_days: Number(r.window_days),
    rows: r.rows.map((x) => ({ rank: Number(x.rank), pubkey: x.pubkey, name: x.name, level: Number(x.level),
      credited_kills: Number(x.credited_kills), weighted_ek: Number(x.weighted_ek) })),
  };
}

function toPublicDrops(d: KillDrops | null | undefined): KillDrops {
  return {
    zem: { dropped: Boolean(d?.zem?.dropped), amount: Number(d?.zem?.amount ?? 0) },
    items: (d?.items ?? []).map((i) => ({
      item_id: Number(i.item_id), name: String(i.name), qty: Number(i.qty), bound: Boolean(i.bound),
      rarity: i.rarity, category: i.category,
    })),
  };
}

const HIDDEN_DROPS: KillDrops = { zem: { dropped: false, amount: 0 }, items: [] };

/** Runtime tripwire: throws if any forbidden key appears anywhere in a response payload. */
export function assertNoForbiddenKeys(value: unknown, path = '$'): void {
  if (Array.isArray(value)) return value.forEach((v, i) => assertNoForbiddenKeys(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_PUBLIC_KEYS.includes(k.toLowerCase())) throw new Error(`forbidden key "${k}" at ${path}`);
      assertNoForbiddenKeys(v, `${path}.${k}`);
    }
  }
}

/** Fail-closed: unset round size coarsens to the UTC day. Positive minutes floor to that bucket. */
export function applyTimePolicy(k: PublicKill, roundMinutes: number | null): PublicKill {
  const minutes = roundMinutes === null || roundMinutes <= 0 ? 1440 : roundMinutes;
  const ms = minutes * 60_000;
  const t = Math.floor(Date.parse(k.killed_at) / ms) * ms;
  return { ...k, killed_at: new Date(t).toISOString() };
}

export function applyPublishPolicy(k: PublicKill, policy: PublishPolicy, nowMs = Date.now()): PublicKill {
  const raw = toPublicKill(k);
  const rounded = applyTimePolicy(raw, policy.roundMinutes);
  const lootCutoff = policy.lootRevealDelayHours === null ? -Infinity : nowMs - policy.lootRevealDelayHours * 3_600_000;
  const revealed = Date.parse(k.killed_at) <= lootCutoff;
  if (!revealed) return { ...rounded, loot_revealed: false, drops: HIDDEN_DROPS };
  return { ...rounded, loot_revealed: true };
}
