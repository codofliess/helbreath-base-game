import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  bandFor, cityRanking, computeApplicableWeights, computeKillWeights, DEFAULT_RULES, EK_RANKING_WINDOW_DAYS, indexCredited,
  validateBands, weightsFingerprint, type EkRulesVersion, type LedgerKill,
} from '../src/shared/ek-weights';
import { payoutPreview } from '../src/server/admin/payout';
import { createPublicApp } from '../src/server/public/app';
import { createSampleRepo } from '../src/server/public/repo';
import { createAdminApp } from '../src/server/admin/app';
import { createSampleAdminRepo } from '../src/server/admin/repo';
import { devHs256Verifier } from '../src/server/admin/auth';
import { SignJWT } from 'jose';
import type { CharacterResponse, KillListResponse, KillStatus, RankingsResponse } from '../src/shared/public-types';
import type { InvestigationFlag } from '../src/shared/private-types';
import { forbiddenIn, sampleData, TEST_OPEN_POLICY } from './helpers';

const DAY = 86_400_000;
const T0 = Date.parse('2026-06-01T00:00:00Z');
let seq = 0;
const kill = (attacker: string, victim: string, day: number, status: KillStatus = 'credited', extraMs = 0): LedgerKill => ({
  combat_id: createHash('sha256').update(`t${seq++}`).digest('hex'), attacker_pubkey: attacker, victim_pubkey: victim,
  killed_at: new Date(T0 + day * DAY + extraMs).toISOString(), status,
});
// Aresden: A1..A12 ; Elvine: B1..B5
const city = (p: string) => (p.startsWith('A') ? 'aresden' : p.startsWith('B') ? 'elvine' : undefined);
const weightOf = (ks: LedgerKill[], k: LedgerKill, rules = DEFAULT_RULES) => computeKillWeights(ks, city, rules).find((w) => w.combat_id === k.combat_id)!;

describe('bands', () => {
  it('maps ranks to 3/2/1 and unranked to the open band', () => {
    expect([1, 10, 11, 30, 31, 500, null].map((r) => bandFor(r, DEFAULT_RULES.bands).weight)).toEqual([3, 3, 2, 2, 1, 1, 1]);
  });
  it('validates bands', () => {
    expect(() => validateBands([{ rank_from: 2, rank_to: null, weight: 1, label: 'x' }])).toThrow();
    expect(() => validateBands([{ rank_from: 1, rank_to: 10, weight: 3, label: 'a' }, { rank_from: 12, rank_to: null, weight: 1, label: 'b' }])).toThrow(/contiguous/);
    expect(() => validateBands([{ rank_from: 1, rank_to: 10, weight: 3, label: 'a' }])).toThrow(/open-ended/);
  });
  it('window is the fixed 30-day rule', () => { expect(EK_RANKING_WINDOW_DAYS).toBe(30); expect(DEFAULT_RULES.ranking_window_days).toBe(30); });
});

describe('weights', () => {
  it('only credited kills are weighted; same-city unset => 0; opposing top10 = 3; 11–30 = 2', () => {
    const ks: LedgerKill[] = [];
    for (let i = 1; i <= 12; i++) for (let n = 0; n < 13 - i; n++) ks.push(kill(`A${i}`, `B${(n % 5) + 1}`, 1, 'credited', i * 1000 + n));
    const vsTop = kill('B1', 'A1', 5), vs11 = kill('B1', 'A11', 5), sameCity = kill('A2', 'A1', 5);
    const pairLimited = kill('B2', 'A1', 5, 'pair_limit_reached'), burned = kill('B3', 'A1', 5, 'kill_burned'), gap = kill('B4', 'A1', 5, 'rejected_level_gap');
    ks.push(vsTop, vs11, sameCity, pairLimited, burned, gap);
    expect(weightOf(ks, vsTop)).toMatchObject({ victim_rank_snapshot: 1, weight: 3, band_label: 'Top 10 kill', cross_city: true });
    expect(weightOf(ks, vs11)).toMatchObject({ victim_rank_snapshot: 11, weight: 2, band_label: 'Top 30 kill' });
    expect(weightOf(ks, sameCity)).toMatchObject({ weight: 0, cross_city: false, band_label: 'Same city' });
    expect(weightOf(ks, sameCity, { ...DEFAULT_RULES, same_city_weight: 1 })).toMatchObject({ weight: 1, cross_city: false });
    for (const k of [pairLimited, burned, gap]) expect(weightOf(ks, k).weight).toBe(0);
  });

  it('non-credited kills never count toward the ranking basis', () => {
    const ks = [kill('A1', 'B1', 1, 'pair_limit_reached'), kill('A1', 'B2', 1, 'kill_burned'), kill('A2', 'B1', 1)];
    const r = cityRanking(indexCredited(ks), city, 'aresden', T0 + 2 * DAY);
    expect(r.map((x) => x.pubkey)).toEqual(['A2']);
  });

  it('rank is snapshotted strictly before killed_at, in the victim\'s own city', () => {
    const k1 = kill('A1', 'B1', 1);
    const simultaneous = kill('B2', 'A1', 1); // same instant as A1's first kill -> not yet counted
    const later = kill('B2', 'A1', 2);
    const ks = [k1, simultaneous, later];
    expect(weightOf(ks, simultaneous).victim_rank_snapshot).toBeNull();
    expect(weightOf(ks, later).victim_rank_snapshot).toBe(1);
  });

  it('ties: equal count -> whoever reached it earliest ranks higher', () => {
    const ks = [kill('A1', 'B1', 1, 'credited', 5000), kill('A2', 'B1', 1, 'credited', 1000)];
    const r = cityRanking(indexCredited(ks), city, 'aresden', T0 + 2 * DAY);
    expect(r.map((x) => [x.pubkey, x.rank])).toEqual([['A2', 1], ['A1', 2]]);
  });

  it('kills older than 30 days drop out: new-kill snapshots change, past kills do not', () => {
    const ks: LedgerKill[] = [];
    for (let n = 0; n < 5; n++) ks.push(kill('A1', 'B1', 0, 'credited', n)); // A1: 5 kills on day 0
    for (let n = 0; n < 3; n++) ks.push(kill('A2', 'B2', 20, 'credited', n)); // A2: 3 kills on day 20
    const early = kill('B3', 'A1', 25); // A1 rank 1 at day 25 -> 3 EK
    ks.push(early);
    const before = weightOf(ks, early);
    expect(before).toMatchObject({ victim_rank_snapshot: 1, weight: 3 });

    // Boundary (window is [t-30d, t)): at day 30 + 3ms, A1's kills at +3ms/+4ms are still inside (the +3ms one exactly on
    // the edge) => 2 kills < A2's 3 => rank 2. At day 30 + 5ms all five have dropped out => unranked.
    const atBoundary = kill('B4', 'A1', 30, 'credited', 3);
    const justAfter = kill('B5', 'A1', 30, 'credited', 5);
    const late = kill('B3', 'A1', 31);   // day-0 kills now older than 30d -> A1 unranked -> 1 EK
    const vsA2 = kill('B3', 'A2', 31);   // A2 now #1 in Aresden -> 3 EK
    const all = [...ks, atBoundary, justAfter, late, vsA2];
    expect(weightOf(all, atBoundary)).toMatchObject({ victim_rank_snapshot: 2, weight: 3 });
    expect(weightOf(all, justAfter)).toMatchObject({ victim_rank_snapshot: null, weight: 1 });
    expect(weightOf(all, late)).toMatchObject({ victim_rank_snapshot: null, weight: 1 });
    expect(weightOf(all, vsA2)).toMatchObject({ victim_rank_snapshot: 1, weight: 3 });
    // ...and the past kill keeps its snapshot/weight after the ranking moved.
    expect(weightOf(all, early)).toEqual(before);
  });

  it('adding future kills never changes past weights (snapshot, not live)', () => {
    const data = sampleData;
    const cm = new Map<string, string>(data.characters.map((c) => [c.pubkey, c.city_id ?? '']));
    const co = (p: string) => cm.get(p);
    const cutoff = '2026-09-18T00:00:00.000Z';
    const past = (data.kills as LedgerKill[]).filter((k) => k.killed_at < cutoff);
    const a = computeKillWeights(past, co, DEFAULT_RULES);
    const b = computeKillWeights(data.kills as LedgerKill[], co, DEFAULT_RULES, { to: cutoff });
    expect(weightsFingerprint(b)).toBe(weightsFingerprint(a));
  });
});

describe('determinism + recompute', () => {
  const data = sampleData;
  const cm = new Map<string, string>(data.characters.map((c) => [c.pubkey, c.city_id ?? '']));
  const co = (p: string) => cm.get(p);
  const kills = data.kills as LedgerKill[];

  it('same input (any order) -> identical output', () => {
    const shuffled = [...kills].sort(() => Math.random() - 0.5);
    expect(weightsFingerprint(computeKillWeights(shuffled, co, DEFAULT_RULES))).toBe(weightsFingerprint(computeKillWeights(kills, co, DEFAULT_RULES)));
  });
  it('partial-range recompute equals the full recompute for those rows', () => {
    const full = computeKillWeights(kills, co, DEFAULT_RULES).filter((w) => { const k = kills.find((x) => x.combat_id === w.combat_id)!; return k.killed_at >= '2026-09-10' && k.killed_at < '2026-09-20'; });
    const part = computeKillWeights(kills, co, DEFAULT_RULES, { from: '2026-09-10', to: '2026-09-20' });
    expect(weightsFingerprint(part)).toBe(weightsFingerprint(full));
  });
  it('changing bands + recompute gives the expected new totals', () => {
    const old = computeKillWeights(kills, co, DEFAULT_RULES);
    const sum = (ws: typeof old) => ws.reduce((s, w) => s + w.weight, 0);
    const top10 = old.filter((w) => w.cross_city && w.weight === 3).length, top30 = old.filter((w) => w.cross_city && w.weight === 2).length;
    expect(top10).toBeGreaterThan(10); expect(top30).toBeGreaterThan(10);
    const v2: EkRulesVersion = { ...DEFAULT_RULES, version: 'ek-v2-test', bands: [
      { rank_from: 1, rank_to: 10, weight: 5, label: 'Top 10 kill' }, { rank_from: 11, rank_to: 30, weight: 2, label: 'Top 30 kill' }, { rank_from: 31, rank_to: null, weight: 1, label: 'Standard' }] };
    const neu = computeKillWeights(kills, co, v2);
    expect(sum(neu)).toBe(sum(old) + 2 * top10);
    expect(neu.every((w) => w.rules_version === 'ek-v2-test')).toBe(true);
    // ranks are band-independent
    expect(neu.map((w) => w.victim_rank_snapshot)).toEqual(old.map((w) => w.victim_rank_snapshot));
  });
  it('versions apply from their effective_from onward', () => {
    const v2: EkRulesVersion = { ...DEFAULT_RULES, version: 'ek-v2', effective_from: '2026-09-20T00:00:00.000Z',
      bands: DEFAULT_RULES.bands.map((b) => (b.rank_from === 1 ? { ...b, weight: 4 } : b)) };
    const m = computeApplicableWeights(kills, co, [DEFAULT_RULES, v2]);
    for (const k of kills) expect(m.get(k.combat_id)!.rules_version).toBe(k.killed_at >= v2.effective_from ? 'ek-v2' : 'ek-v1');
  });
});

describe('payout preview (read-only)', () => {
  const ws = [
    { attacker_pubkey: 'A1', killed_at: '2026-09-02T00:00:00Z', weight: 3, rules_version: 'ek-v1' },
    { attacker_pubkey: 'A1', killed_at: '2026-09-03T00:00:00Z', weight: 2, rules_version: 'ek-v1' },
    { attacker_pubkey: 'A2', killed_at: '2026-09-03T00:00:00Z', weight: 1, rules_version: 'ek-v1' },
    { attacker_pubkey: 'A2', killed_at: '2026-09-03T00:00:00Z', weight: 9, rules_version: 'ek-v2' }, // other version: ignored
    { attacker_pubkey: 'A2', killed_at: '2026-09-20T00:00:00Z', weight: 3, rules_version: 'ek-v1' }, // outside period
  ];
  const closed = { period_id: 'P', start: '2026-09-01T00:00:00Z', end: '2026-09-15T00:00:00Z', closed_at: '2026-09-15T01:00:00Z', rules_version: 'ek-v1' };
  const names = new Map([['A1', 'Alpha'], ['A2', 'Beta']]);
  it('refuses open periods', () => { expect(() => payoutPreview({ ...closed, closed_at: null, rules_version: null }, ws, names)).toThrow(/not closed/); });
  it('no rate -> formula + EK sums, amounts null, emitir=false', () => {
    const p = payoutPreview(closed, ws, names);
    expect(p.emitir).toBe(false); expect(p.rate_per_ek).toBeNull(); expect(p.formula).toMatch(/rate_per_ek × Σ/);
    expect(p.rows).toEqual([{ pubkey: 'A1', name: 'Alpha', ek_sum: 5, preview_amount: null }, { pubkey: 'A2', name: 'Beta', ek_sum: 1, preview_amount: null }]);
  });
  it('explicit rate parameter -> amount = rate × Σweight', () => {
    expect(payoutPreview(closed, ws, names, 7).rows.map((r) => r.preview_amount)).toEqual([35, 7]);
    expect(() => payoutPreview(closed, ws, names, -1)).toThrow();
  });
});

describe('public API — EK + rankings', () => {
  const app = createPublicApp(createSampleRepo(sampleData), TEST_OPEN_POLICY);
  it('rankings: top ≤30 per city, contiguous ranks, sorted by raw credited kills, no private keys', async () => {
    const r = (await (await app.request('/api/rankings')).json()) as RankingsResponse;
    expect(forbiddenIn(r)).toEqual([]);
    expect(r.rules.window_days).toBe(30);
    expect(r.rules.bands.map((b) => b.weight)).toEqual([3, 2, 1]);
    expect(r.cities.map((c) => c.city_name)).toEqual(['Aresden', 'Elvine']);
    for (const c of r.cities) {
      expect(c.rows.length).toBe(30);
      c.rows.forEach((row, i) => { expect(row.rank).toBe(i + 1); if (i) expect(row.credited_kills).toBeLessThanOrEqual(c.rows[i - 1].credited_kills); });
      expect(c.rows.some((row) => row.weighted_ek > row.credited_kills)).toBe(true);
    }
  });
  it('kills carry EK weights with Top 10 badges; character has weighted total', async () => {
    const list = (await (await app.request('/api/kills?limit=200')).json()) as KillListResponse;
    expect(list.items.some((k) => k.ek.band_label === 'Top 10 kill' && k.ek.weight === 3)).toBe(true);
    expect(list.items.filter((k) => k.status !== 'credited').every((k) => k.ek.weight === 0)).toBe(true);
    const c = (await (await app.request('/api/characters/Sable_Rogue')).json()) as CharacterResponse;
    expect(c.character.ek_total).toBe(c.kills.reduce((s, k) => s + k.ek.weight, 0));
    expect(c.character.ek_total).toBeGreaterThan(c.character.kills_credited);
    expect(c.character.city_id).toBe('elvine');
  });
});

describe('admin — top-rank death selling + payout endpoint', () => {
  const secret = 'test-only-not-a-secret-value-abcdefghij';
  const app = createAdminApp(createSampleAdminRepo(), { verifier: devHs256Verifier(secret), requiredRole: 'ops_admin', roleClaim: 'roles', ipAllowlist: ['127.0.0.1'], getClientIp: () => '127.0.0.1' });
  const hdr = async () => ({ authorization: `Bearer ${await new SignJWT({ roles: ['ops_admin'] }).setProtectedHeader({ alg: 'HS256' }).setSubject('s').setIssuer('chainlords-dev').setAudience('kill-viewer-admin').setExpirationTime('5m').sign(new TextEncoder().encode(secret))}` });
  it('flags Kaelthorn (top-10) repeatedly dying to Sable_Rogue', async () => {
    const { flags } = (await (await app.request('/admin/api/flags', { headers: await hdr() })).json()) as { flags: InvestigationFlag[] };
    const f = flags.find((x) => x.kind === 'top_rank_death_selling' && x.victim_name === 'Kaelthorn' && x.attacker_name === 'Sable_Rogue');
    expect(f).toBeDefined();
    expect(Number(f!.metrics.best_rank)).toBeLessThanOrEqual(10);
  });
  it('payout preview: closed period ok w/o rate (null amounts), open period rejected', async () => {
    const ok = await (await app.request('/admin/api/payout-preview?period_id=SAMPLE-2026-09-A', { headers: await hdr() })).json();
    expect(ok.emitir).toBe(false); expect(ok.rate_per_ek).toBeNull(); expect(ok.rows.every((r: any) => r.preview_amount === null)).toBe(true);
    expect((await app.request('/admin/api/payout-preview?period_id=SAMPLE-2026-09-B', { headers: await hdr() })).status).toBe(400);
  });
});
