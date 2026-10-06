// Runs db/schema.sql on a throwaway local Postgres (embedded-postgres, 127.0.0.1, random ephemeral password,
// temp dir, deleted afterwards) and proves the SQL matches the pure TS implementation.
// Skip with SKIP_PG_INTEGRATION=1.
import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computeKillWeights, DEFAULT_RULES, type LedgerKill } from '../src/shared/ek-weights';
import { createPgRepo } from '../src/server/public/repo';
import { forbiddenIn, sampleData } from './helpers';

const data = sampleData;
const cityMap = new Map<string, string>(data.characters.map((c: any) => [c.pubkey, c.city_id]));
const cityOf = (p: string) => cityMap.get(p);
const skip = process.env.SKIP_PG_INTEGRATION === '1';

describe.skipIf(skip)('Postgres schema (embedded, local only)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kv-pg-'));
  const password = randomBytes(18).toString('hex'); // ephemeral, never persisted
  const port = 55000 + Math.floor(Math.random() * 5000);
  const server = new EmbeddedPostgres({ databaseDir: dir, port, user: 'postgres', password, persistent: false, onLog: () => {}, onError: () => {} });
  let db: pg.Client;
  const q = (sql: string, args: unknown[] = []) => db.query(sql, args);

  beforeAll(async () => {
    await server.initialise(); await server.start(); await server.createDatabase('killviewer');
    db = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', password, database: 'killviewer' });
    await db.connect();
    await q("SET TIME ZONE 'UTC'");
    await q(readFileSync('db/schema.sql', 'utf8'));
    await q(`INSERT INTO public_ledger.cities (city_id, name, sort_order) SELECT e.value->>'city_id', e.value->>'name', e.ord FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY AS e(value, ord)`, [JSON.stringify(data.cities)]);
    await q(`INSERT INTO public_ledger.characters (pubkey, name, city_id, level) SELECT pubkey, name, city_id, level FROM jsonb_to_recordset($1::jsonb) AS t(pubkey text, name text, city_id text, level int)`, [JSON.stringify(data.characters)]);
    await q(`INSERT INTO public_ledger.kills (combat_id, batch_id, tx_signature, attacker_pubkey, victim_pubkey, attacker_level, victim_level, killed_at, status)
      SELECT combat_id, batch_id, tx_signature, attacker_pubkey, victim_pubkey, attacker_level, victim_level, killed_at, status::public_ledger.kill_status
      FROM jsonb_to_recordset($1::jsonb) AS t(combat_id text, batch_id text, tx_signature text, attacker_pubkey text, victim_pubkey text, attacker_level int, victim_level int, killed_at timestamptz, status text)`, [JSON.stringify(data.kills)]);
    await q(`INSERT INTO public_ledger.kill_drops (combat_id, zem_dropped, zem_amount)
      SELECT k->>'combat_id', (k->'drops'->'zem'->>'dropped')::bool, (k->'drops'->'zem'->>'amount')::bigint FROM jsonb_array_elements($1::jsonb) k`, [JSON.stringify(data.kills)]);
    await q(`INSERT INTO public_ledger.kill_drop_items (combat_id, line_no, item_id, item_name, qty, bound, rarity, category)
      SELECT k->>'combat_id', i.n, (i.it->>'item_id')::int, i.it->>'name', (i.it->>'qty')::int, (i.it->>'bound')::bool, i.it->>'rarity', i.it->>'category'
      FROM jsonb_array_elements($1::jsonb) k, jsonb_array_elements(k->'drops'->'items') WITH ORDINALITY AS i(it, n)`, [JSON.stringify(data.kills)]);
    await q(`INSERT INTO public_ledger.payout_periods (period_id, period_start, period_end) VALUES ('P-A', '2026-09-01T03:00Z', '2026-09-15T03:00Z'), ('P-B', '2026-09-15T03:00Z', '2026-10-01T03:00Z')`);
  }, 120_000);
  afterAll(async () => { await db?.end().catch(() => {}); await server.stop().catch(() => {}); rmSync(dir, { recursive: true, force: true }); });

  const sqlWeights = async (version = 'ek-v1') => (await q(`SELECT combat_id, victim_rank_snapshot, weight::float8 AS weight FROM public_ledger.kill_weights WHERE rules_version=$1`, [version])).rows as { combat_id: string; victim_rank_snapshot: number | null; weight: number }[];

  it('recompute_weights == pure TS computeKillWeights, row by row', async () => {
    const n = (await q(`SELECT public_ledger.recompute_weights('ek-v1', '-infinity', 'infinity') AS n`)).rows[0].n;
    expect(n).toBe(data.kills.length);
    const ts = new Map(computeKillWeights(data.kills as LedgerKill[], cityOf, DEFAULT_RULES).map((w) => [w.combat_id, w]));
    const rows = await sqlWeights();
    expect(rows.length).toBe(ts.size);
    for (const r of rows) {
      const t = ts.get(r.combat_id)!;
      expect([r.combat_id, r.victim_rank_snapshot, r.weight]).toEqual([t.combat_id, t.victim_rank_snapshot, t.weight]);
    }
  }, 120_000);

  it('recompute is deterministic and a partial-range recompute equals the full one', async () => {
    const before = JSON.stringify((await sqlWeights()).sort((a, b) => (a.combat_id < b.combat_id ? -1 : 1)));
    await q(`SELECT public_ledger.recompute_weights('ek-v1', '2026-09-10T00:00Z', '2026-09-20T00:00Z')`);
    await q(`SELECT public_ledger.recompute_weights('ek-v1', '-infinity', 'infinity')`);
    const after = JSON.stringify((await sqlWeights()).sort((a, b) => (a.combat_id < b.combat_id ? -1 : 1)));
    expect(after).toBe(before);
  }, 120_000);

  it('changing bands + recompute gives the expected new totals', async () => {
    const tot = async () => Number((await q(`SELECT sum(weight) s FROM public_ledger.kill_weights WHERE rules_version='ek-v1'`)).rows[0].s);
    const top10 = Number((await q(`SELECT count(*) n FROM public_ledger.kill_weights WHERE rules_version='ek-v1' AND weight=3 AND cross_city`)).rows[0].n);
    const old = await tot();
    await q(`UPDATE public_ledger.ek_weight_bands SET weight = 5 WHERE version='ek-v1' AND rank_from=1`);
    await q(`SELECT public_ledger.recompute_weights('ek-v1', '-infinity', 'infinity')`);
    expect(await tot()).toBe(old + 2 * top10);
    await q(`UPDATE public_ledger.ek_weight_bands SET weight = 3 WHERE version='ek-v1' AND rank_from=1`);
    await q(`SELECT public_ledger.recompute_weights('ek-v1', '-infinity', 'infinity')`);
    expect(await tot()).toBe(old);
  }, 120_000);

  it('rejects invalid bands and a non-30-day window', async () => {
    await expect(q(`INSERT INTO public_ledger.ek_rules_versions (version, effective_from, ranking_window_days) VALUES ('bad', '2030-01-01Z', 365)`)).rejects.toThrow(/check/i);
    await q(`INSERT INTO public_ledger.ek_rules_versions (version, effective_from) VALUES ('gap', '2031-01-01Z')`);
    await q(`INSERT INTO public_ledger.ek_weight_bands VALUES ('gap', '2031-01-01Z', 1, 10, 3, 'a'), ('gap', '2031-01-01Z', 12, NULL, 1, 'b')`);
    await expect(q(`SELECT public_ledger.recompute_weights('gap', '-infinity', 'infinity')`)).rejects.toThrow(/contiguous/);
  });

  it('public pg repo (as viewer_ro) returns EK + no location keys; viewer_ro cannot touch internal_ops', async () => {
    const vpw = randomBytes(12).toString('hex');
    await q(`ALTER ROLE viewer_ro PASSWORD '${vpw}'`);
    await q(`GRANT CONNECT ON DATABASE killviewer TO viewer_ro`);
    const repo = createPgRepo(`postgres://viewer_ro:${vpw}@127.0.0.1:${port}/killviewer`);
    const list = await repo.listKills({ limit: 200, offset: 0, publishedBefore: new Date() });
    expect(list.items.length).toBe(200);
    expect(forbiddenIn(list.items)).toEqual([]);
    const ts = new Map(computeKillWeights(data.kills as LedgerKill[], cityOf, DEFAULT_RULES).map((w) => [w.combat_id, w]));
    for (const k of list.items) expect(Number(k.ek.weight)).toBe(ts.get(k.combat_id)!.weight);
    const rk = await repo.rankings(new Date('2026-09-25T21:00:00Z'), 30);
    expect(rk.cities.map((c) => c.city_id)).toEqual(['aresden', 'elvine']);
    expect(rk.cities[0].rows[0].rank).toBe(1);
    await repo.close?.();
    const vro = new pg.Client({ host: '127.0.0.1', port, user: 'viewer_ro', password: vpw, database: 'killviewer' });
    await vro.connect();
    await expect(vro.query('SELECT * FROM internal_ops.kill_location')).rejects.toThrow(/permission denied/);
    await expect(vro.query(`SELECT * FROM internal_ops.payout_preview('P-A', NULL)`)).rejects.toThrow(/permission denied/);
    await expect(vro.query(`SELECT public_ledger.recompute_weights('ek-v1','-infinity','infinity')`)).rejects.toThrow(/permission denied/);
    await vro.end();
  }, 120_000);

  it('payout_preview: closed periods only, rate has no default, amounts NULL without a rate, frozen after close', async () => {
    await expect(q(`SELECT * FROM internal_ops.payout_preview('P-A', NULL)`)).rejects.toThrow(/not closed/);
    await expect(q(`SELECT * FROM internal_ops.payout_preview('P-A')`)).rejects.toThrow(/does not exist/); // no default rate
    await q(`SELECT public_ledger.close_payout_period('P-A', 'ek-v1')`);
    const rows = (await q(`SELECT pubkey, ek_sum::float8 ek, preview_amount, emitir FROM internal_ops.payout_preview('P-A', NULL)`)).rows;
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.every((r) => r.preview_amount === null && r.emitir === false)).toBe(true);
    const expected = computeKillWeights(data.kills as LedgerKill[], cityOf, DEFAULT_RULES, { from: '2026-09-01T03:00:00Z', to: '2026-09-15T03:00:00Z' })
      .reduce((s, w) => s + w.weight, 0);
    expect(rows.reduce((s, r) => s + r.ek, 0)).toBe(expected);
    // frozen: cannot recompute or edit bands of the frozen version
    await expect(q(`SELECT public_ledger.recompute_weights('ek-v1', '-infinity', 'infinity')`)).rejects.toThrow(/closed payout period/);
    await expect(q(`UPDATE public_ledger.ek_weight_bands SET weight=4 WHERE version='ek-v1' AND rank_from=1`)).rejects.toThrow(/frozen/);
    await expect(q(`DELETE FROM public_ledger.kill_weights WHERE killed_at >= '2026-09-02Z' AND killed_at < '2026-09-03Z' AND rules_version='ek-v1'`)).rejects.toThrow(/frozen/);
    // open period outside the frozen range can still be recomputed
    await q(`SELECT public_ledger.recompute_weights('ek-v1', '2026-09-15T03:00Z', 'infinity')`);
  }, 120_000);
});
