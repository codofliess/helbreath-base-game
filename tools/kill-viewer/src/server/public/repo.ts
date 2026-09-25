// PUBLIC ledger repository. Reads ONLY public_ledger (viewer_ro credentials). No location code path exists here.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import type { CharacterSummary, CityRanking, KillStatus, PublicKill, RawKill } from '../../shared/public-types';
import { buildEkView, type LedgerCharacter } from '../../shared/ek-ledger';
import type { City, EkRulesVersion } from '../../shared/ek-weights';
import { generatePublicSample, type PublicSampleData } from '../../shared/sample-public';

export interface KillFilter { q?: string; status?: KillStatus; limit: number; offset: number; publishedBefore: Date; }

export interface PublicLedgerRepo {
  readonly sample: boolean;
  listKills(f: KillFilter): Promise<{ total: number; items: PublicKill[] }>;
  searchCharacters(q: string, limit: number): Promise<CharacterSummary[]>;
  characterHistory(name: string, publishedBefore: Date): Promise<{ character: CharacterSummary; deaths: PublicKill[]; kills: PublicKill[] } | null>;
  cities(): Promise<City[]>;
  rankings(asOf: Date, limit: number): Promise<{ rules: EkRulesVersion; cities: CityRanking[] }>;
  close?(): Promise<void>;
}

function loadPublicSample(): PublicSampleData {
  const file = resolve(process.env.PUBLIC_SAMPLE_FILE ?? 'sample/public/kills.sample.json');
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as PublicSampleData;
  return generatePublicSample();
}

export function createSampleRepo(data: PublicSampleData = loadPublicSample()): PublicLedgerRepo {
  const view = buildEkView(data.characters, data.kills as RawKill[], data.ek_rules_versions, data.cities);
  const kills = view.kills;
  const visible = (before: Date) => kills.filter((k) => Date.parse(k.killed_at) <= before.getTime());
  const summary = (c: LedgerCharacter, before: Date): CharacterSummary => {
    const v = visible(before);
    return {
      pubkey: c.pubkey, name: c.name, level: c.level, city_id: c.city_id,
      kills_credited: v.filter((k) => k.attacker_pubkey === c.pubkey && k.status === 'credited').length,
      deaths: v.filter((k) => k.victim_pubkey === c.pubkey).length,
      ek_total: v.filter((k) => k.attacker_pubkey === c.pubkey).reduce((s, k) => s + k.ek.weight, 0),
      city_rank: view.currentRank(c.pubkey, before),
    };
  };
  return {
    sample: true,
    async listKills({ q, status, limit, offset, publishedBefore }) {
      const needle = q?.toLowerCase();
      const rows = visible(publishedBefore).filter((k) =>
        (!status || k.status === status) &&
        (!needle || k.attacker_name.toLowerCase().includes(needle) || k.victim_name.toLowerCase().includes(needle)));
      return { total: rows.length, items: rows.slice(offset, offset + limit) };
    },
    async searchCharacters(q, limit) {
      const n = q.toLowerCase();
      return data.characters.filter((c) => c.name.toLowerCase().includes(n)).slice(0, limit).map((c) => summary(c, new Date()));
    },
    async characterHistory(name, before) {
      const c = data.characters.find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (!c) return null;
      const v = visible(before);
      return { character: summary(c, before), deaths: v.filter((k) => k.victim_pubkey === c.pubkey), kills: v.filter((k) => k.attacker_pubkey === c.pubkey) };
    },
    async cities() { return data.cities; },
    async rankings(asOf, limit) { return { rules: view.current, cities: view.rankings(asOf, limit) }; },
  };
}

const COLS = `combat_id, batch_id, tx_signature, attacker_pubkey, attacker_name, attacker_level,
  victim_pubkey, victim_name, victim_level, killed_at, day::text AS day, status::text AS status, drops,
  attacker_city, victim_city, ek`;

export function createPgRepo(connectionString: string): PublicLedgerRepo {
  const pool = new pg.Pool({ connectionString, max: 10, application_name: 'kill-viewer-public',
    options: '-c search_path=public_ledger -c default_transaction_read_only=on' });
  const summaryById = async (where: string, arg: string, before: Date): Promise<CharacterSummary | null> => {
    const r = await pool.query(
      `SELECT c.pubkey, c.name, c.level, c.city_id,
         (SELECT COALESCE(sum((v.ek->>'weight')::numeric),0) FROM public_ledger.v_kills_public v WHERE v.attacker_pubkey=c.pubkey AND v.killed_at <= $2)::float8 AS ek_total,
         (SELECT r.rank FROM public_ledger.city_ranking(c.city_id, $2) r WHERE r.pubkey=c.pubkey)::int AS city_rank,
         (SELECT count(*) FROM public_ledger.kills k WHERE k.attacker_pubkey=c.pubkey AND k.status='credited' AND k.killed_at <= $2)::int AS kills_credited,
         (SELECT count(*) FROM public_ledger.kills k WHERE k.victim_pubkey=c.pubkey AND k.killed_at <= $2)::int AS deaths
       FROM public_ledger.characters c WHERE ${where} LIMIT 1`, [arg, before]);
    return r.rows[0] ?? null;
  };
  return {
    sample: false,
    async listKills({ q, status, limit, offset, publishedBefore }) {
      const args: unknown[] = [publishedBefore]; const w = ['killed_at <= $1'];
      if (status) { args.push(status); w.push(`status = $${args.length}::public_ledger.kill_status`); }
      if (q) { args.push(`%${q}%`); w.push(`(attacker_name ILIKE $${args.length} OR victim_name ILIKE $${args.length})`); }
      const where = w.join(' AND ');
      const total = await pool.query(`SELECT count(*)::int AS n FROM public_ledger.v_kills_public WHERE ${where}`, args);
      args.push(limit, offset);
      const rows = await pool.query(`SELECT ${COLS} FROM public_ledger.v_kills_public WHERE ${where}
        ORDER BY killed_at DESC LIMIT $${args.length - 1} OFFSET $${args.length}`, args);
      return { total: total.rows[0].n, items: rows.rows };
    },
    async searchCharacters(q, limit) {
      const r = await pool.query(`SELECT name FROM public_ledger.characters WHERE name ILIKE $1 ORDER BY name LIMIT $2`, [`%${q}%`, limit]);
      const out: CharacterSummary[] = [];
      for (const row of r.rows) { const s = await summaryById('c.name = $1', row.name, new Date()); if (s) out.push(s); }
      return out;
    },
    async characterHistory(name, before) {
      const character = await summaryById('lower(c.name) = lower($1)', name, before);
      if (!character) return null;
      const q = (col: string) => pool.query(`SELECT ${COLS} FROM public_ledger.v_kills_public WHERE ${col} = $1 AND killed_at <= $2 ORDER BY killed_at DESC LIMIT 500`, [character.pubkey, before]);
      const [d, k] = await Promise.all([q('victim_pubkey'), q('attacker_pubkey')]);
      return { character, deaths: d.rows, kills: k.rows };
    },
    async close() { await pool.end(); },
    async cities() { return (await pool.query('SELECT city_id, name FROM public_ledger.cities ORDER BY sort_order, city_id')).rows; },
    async rankings(asOf, limit) {
      const rv = await pool.query(`SELECT version, effective_from, ranking_window_days, same_city_weight FROM public_ledger.ek_rules_versions
        WHERE effective_from <= $1 ORDER BY effective_from DESC LIMIT 1`, [asOf]);
      const v = rv.rows[0];
      const bands = (await pool.query(`SELECT rank_from, rank_to, weight::float8 AS weight, label FROM public_ledger.ek_weight_bands WHERE version=$1 ORDER BY rank_from`, [v.version])).rows;
      const rules: EkRulesVersion = {
        version: v.version, effective_from: new Date(v.effective_from).toISOString(), ranking_window_days: v.ranking_window_days,
        same_city_weight: v.same_city_weight == null ? null : Number(v.same_city_weight), bands,
      };
      const cities: CityRanking[] = [];
      for (const c of await this.cities()) {
        const r = await pool.query(`SELECT r.rank, r.pubkey, ch.name, ch.level, r.credited_kills,
            COALESCE((SELECT sum((k.ek->>'weight')::numeric) FROM public_ledger.v_kills_public k WHERE k.attacker_pubkey=r.pubkey
              AND k.killed_at >= $2::timestamptz - make_interval(hours => $3 * 24) AND k.killed_at < $2), 0)::float8 AS weighted_ek
          FROM public_ledger.city_ranking($1, $2) r JOIN public_ledger.characters ch ON ch.pubkey=r.pubkey ORDER BY r.rank LIMIT $4`,
          [c.city_id, asOf, rules.ranking_window_days, limit]);
        cities.push({ city_id: c.city_id, city_name: c.name, as_of: asOf.toISOString(), window_days: rules.ranking_window_days, rows: r.rows });
      }
      return { rules, cities };
    },
  };
}
