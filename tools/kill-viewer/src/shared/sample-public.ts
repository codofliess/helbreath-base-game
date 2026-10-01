/**
 * Deterministic SAMPLE / MOCK public slice (fictional names, fake pubkeys).
 * Generated at runtime for tests and local preview — fixtures are not committed.
 * PUBLIC-SAFE: no map / location / coordinates.
 */
import { createHash } from 'node:crypto';
import { ITEM_CATALOG } from './items';
import { DEFAULT_RULES, type City, type EkRulesVersion } from './ek-weights';
import type { ItemDrop, KillStatus, RawKill } from './public-types';
import type { LedgerCharacter } from './ek-ledger';

export const SAMPLE_NOTICE = 'SAMPLE / MOCK DATA — fictional characters, fake pubkeys & signatures. Not real game data.';

/** Cities are DATA (names configurable). Second city shown as Elvine until the owner decides. */
export const SAMPLE_CITIES: City[] = [
  { city_id: 'aresden', name: 'Aresden' },
  { city_id: 'elvine', name: 'Elvine' },
];

export interface SamplePayoutPeriod {
  period_id: string;
  start: string;
  end: string;
  closed_at: string | null;
  rules_version: string | null;
}

export interface PublicSampleData {
  _notice: string;
  cities: City[];
  ek_rules_versions: EkRulesVersion[];
  payout_periods: SamplePayoutPeriod[];
  characters: LedgerCharacter[];
  kills: RawKill[];
  /** Plant tags only (no coordinates). Used by the admin-only location generator. */
  drafts: SampleDraft[];
}

export interface SampleDraft {
  attacker: string;
  victim: string;
  t: number;
  burned?: boolean;
  drops: { zem: { dropped: boolean; amount: number }; items: ItemDrop[] };
  plant?: 'funnel' | 'trade';
}

export function generatePublicSample(seed0 = 1337): PublicSampleData {
  let seed = seed0;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const b58 = (n: number) => Array.from({ length: n }, () => B58[Math.floor(rnd() * 58)]).join('');

  const NAMED: [string, number, number[], string, number][] = [
    ['Varkh_the_Grim', 142, [22, 3], 'aresden', 10], ['LunaSpellblade', 138, [0, 4], 'elvine', 10], ['IronTusk', 131, [13, 18], 'aresden', 7],
    ['Mireth', 127, [19, 23], 'elvine', 7], ['Kaelthorn', 145, [1, 5], 'aresden', 9], ['Sable_Rogue', 136, [23, 3], 'elvine', 6],
    ['OakenWard', 128, [14, 19], 'aresden', 4], ['Brannoc', 133, [20, 1], 'elvine', 5], ['Zyra_Ash', 129, [21, 2], 'elvine', 8],
    ['GoldMule_77', 121, [15, 18], 'aresden', 0.3], ['RichBuyer', 126, [15, 18], 'aresden', 3], ['Thessaly', 124, [18, 22], 'elvine', 1],
    ['Dunmore', 134, [20, 1], 'aresden', 5], ['NightMoth', 131, [2, 6], 'elvine', 5],
  ];
  const SYL_A = ['Ald', 'Bel', 'Cor', 'Dra', 'Eld', 'Fen', 'Gor', 'Hal', 'Ith', 'Jor', 'Kor', 'Lyr', 'Mor', 'Nym', 'Orl', 'Pyr', 'Quel', 'Ryn', 'Syl', 'Tor', 'Ul', 'Vel', 'Wyr', 'Xan', 'Yr', 'Zor'];
  const SYL_B = ['ric', 'wen', 'dor', 'mir', 'gar', 'wyn', 'thas', 'ion', 'eth', 'ak', 'is', 'orn', 'ya', 'uin', 'hel'];
  const CHARS: { name: string; level: number; hours: number[]; city_id: string; skill: number; pubkey: string }[] =
    NAMED.map(([name, level, hours, city_id, skill]) => ({ name, level, hours, city_id, skill, pubkey: b58(44) }));
  for (const city of SAMPLE_CITIES) for (let i = 0; i < 30; i++) {
    let name = ''; do { name = `${pick(SYL_A)}${pick(SYL_B)}${rnd() < 0.3 ? '_' + pick(['II', 'x', 'of' + pick(SYL_A)]) : ''}`; } while (CHARS.some((c) => c.name === name));
    const h = int(0, 23);
    CHARS.push({ name, level: int(118, 140), hours: [h, (h + int(3, 6)) % 24], city_id: city.city_id, skill: Number((0.2 + rnd() * 3.5).toFixed(2)), pubkey: b58(44) });
  }
  const byName = Object.fromEntries(CHARS.map((c) => [c.name, c]));

  const END = Date.parse('2026-09-25T21:00:00Z');
  const DAY = 86_400_000;
  const RECENT = END - 14 * DAY;
  const START = END - 45 * DAY;

  function timeInHours(h: number[], dayOffset: number, base = RECENT) {
    const [a, b] = h; const span = (b - a + 24) % 24 || 24;
    const hour = (a + int(0, span - 1)) % 24;
    const t = base + dayOffset * DAY + hour * 3_600_000 + int(0, 3599) * 1000;
    return Math.min(t, END - int(60, 3600) * 1000);
  }

  function normalDrops(): { zem: { dropped: boolean; amount: number }; items: ItemDrop[] } {
    const dropped = rnd() < 0.6;
    const items: ItemDrop[] = [];
    const n = rnd() < 0.5 ? 0 : int(1, 2);
    for (let i = 0; i < n; i++) {
      const it = rnd() < 0.8 ? pick(ITEM_CATALOG.filter((x) => x.rarity === 'common')) : pick(ITEM_CATALOG);
      items.push({ ...it, qty: it.category === 'potion' ? int(1, 10) : 1, bound: rnd() < 0.15 });
    }
    return { zem: { dropped, amount: dropped ? int(40, 1800) : 0 }, items };
  }
  function valuableDrops() {
    const valuable = ITEM_CATALOG.filter((x) => x.rarity === 'epic' || x.rarity === 'legendary');
    const items: ItemDrop[] = [{ ...pick(valuable), qty: 1, bound: false }];
    if (rnd() < 0.5) items.push({ ...ITEM_CATALOG.find((x) => x.item_id === 601)!, qty: int(3, 12), bound: false });
    return { zem: { dropped: true, amount: int(25_000, 90_000) }, items };
  }

  const drafts: SampleDraft[] = [];
  const weighted = <T>(xs: T[], w: (x: T) => number) => { const tot = xs.reduce((a, x) => a + w(x), 0); let r = rnd() * tot; for (const x of xs) { r -= w(x); if (r <= 0) return x; } return xs[xs.length - 1]; };
  const regular = CHARS.filter((c) => !['GoldMule_77', 'RichBuyer'].includes(c.name));
  for (let i = 0; i < 1500; i++) {
    const a = weighted(regular, (c) => c.skill);
    const pool = regular.filter((c) => c !== a && (rnd() < 0.8 ? c.city_id !== a.city_id : c.city_id === a.city_id));
    const v = weighted(pool.length ? pool : regular.filter((c) => c !== a), (c) => (c.name === 'Thessaly' ? 0.3 : 1));
    drafts.push({ attacker: a.name, victim: v.name, t: timeInHours(v.hours, int(0, 44), START), drops: normalDrops() });
  }
  for (let i = 0; i < 14; i++) drafts.push({ attacker: 'Sable_Rogue', victim: 'Kaelthorn', t: timeInHours([1, 5], int(2, 13)), drops: normalDrops() });
  for (let i = 0; i < 16; i++) {
    drafts.push({ attacker: 'RichBuyer', victim: 'GoldMule_77', t: timeInHours([15, 18], int(8, 13)), drops: valuableDrops(), plant: 'funnel' });
  }
  for (let i = 0; i < 20; i++) drafts.push({ attacker: 'NightMoth', victim: 'Thessaly', t: timeInHours([18, 22], int(4, 13)), drops: normalDrops() });
  for (let i = 0; i < 6; i++) {
    const [a, v] = i % 2 ? ['Dunmore', 'Brannoc'] : ['Brannoc', 'Dunmore'];
    drafts.push({ attacker: a, victim: v, t: RECENT + (9 * DAY) + i * 2_700_000 + 22 * 3_600_000, burned: i >= 3, drops: normalDrops(), plant: 'trade' });
  }
  drafts.push({ attacker: 'Kaelthorn', victim: 'GoldMule_77', t: RECENT + 5 * DAY + 16 * 3_600_000, drops: normalDrops() });
  drafts.sort((a, b) => a.t - b.t);

  const credited: Record<string, number[]> = {};
  const kills: RawKill[] = [];
  drafts.forEach((d, idx) => {
    const a = byName[d.attacker], v = byName[d.victim];
    const aLevel = a.level - int(0, 2), vLevel = v.level - int(0, 2);
    const key = `${d.attacker}>${d.victim}`;
    const prev = (credited[key] ??= []);
    let status: KillStatus;
    if (Math.abs(aLevel - vLevel) > 20) status = 'rejected_level_gap';
    else if (d.burned) status = 'kill_burned';
    else if (prev.filter((t) => d.t - t < DAY).length >= 2 || prev.filter((t) => d.t - t < 7 * DAY).length >= 10) status = 'pair_limit_reached';
    else { status = 'credited'; prev.push(d.t); }
    const combat_id = createHash('sha256').update(`sample-combat-${idx}-${d.t}`).digest('hex');
    const batchNo = Math.floor(idx / 10);
    kills.push({
      combat_id, batch_id: `SAMPLE-B${String(batchNo).padStart(4, '0')}`, tx_signature: `SAMPLE${b58(82)}`,
      attacker_pubkey: a.pubkey, attacker_name: a.name, attacker_level: aLevel,
      victim_pubkey: v.pubkey, victim_name: v.name, victim_level: vLevel,
      killed_at: new Date(d.t).toISOString(), day: new Date(d.t).toISOString().slice(0, 10), status, drops: d.drops,
    });
  });

  return {
    _notice: SAMPLE_NOTICE,
    cities: SAMPLE_CITIES,
    ek_rules_versions: [DEFAULT_RULES],
    payout_periods: [
      { period_id: 'SAMPLE-2026-09-A', start: '2026-09-01T03:00:00.000Z', end: '2026-09-15T03:00:00.000Z', closed_at: '2026-09-15T04:00:00.000Z', rules_version: DEFAULT_RULES.version },
      { period_id: 'SAMPLE-2026-09-B', start: '2026-09-15T03:00:00.000Z', end: '2026-10-01T03:00:00.000Z', closed_at: null, rules_version: null },
    ],
    characters: CHARS.map(({ name, level, pubkey, city_id }) => ({ name, level, pubkey, city_id })),
    kills,
    drafts,
  };
}
