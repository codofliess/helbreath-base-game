// ADMIN repository: reads public_ledger + internal_ops as ops_admin; appends to internal_ops.audit_log.
import pg from 'pg';
import { buildEkView } from '../../shared/ek-ledger';
import { generatePublicSample } from '../../shared/sample-public';
import type { PayoutPeriod, PayoutPreview } from './payout';
import { payoutPreview, PAYOUT_FORMULA } from './payout';
import type { AuditEntry, FullKill } from '../../shared/private-types';
import { generateSampleLocations } from './sample-locations';

export interface FullKillFilter { q?: string; map_id?: string; sinceDays?: number; limit: number; }

export interface AdminRepo {
  readonly sample: boolean;
  listFullKills(f: FullKillFilter): Promise<FullKill[]>;
  appendAudit(e: AuditEntry): Promise<void>;
  listAudit(limit: number): Promise<AuditEntry[]>;
  payoutPeriods(): Promise<PayoutPeriod[]>;
  /** READ-ONLY preview. ratePerEk has NO default: undefined => amounts are null (formula only). */
  payoutPreview(periodId: string, ratePerEk: number | undefined): Promise<PayoutPreview>;
}

function filterFull(rows: FullKill[], f: FullKillFilter) {
  const since = f.sinceDays ? Date.now() - f.sinceDays * 86_400_000 : 0;
  const n = f.q?.toLowerCase();
  return rows.filter((k) => Date.parse(k.killed_at) >= since && (!f.map_id || k.location?.map_id === f.map_id) &&
    (!n || k.attacker_name.toLowerCase().includes(n) || k.victim_name.toLowerCase().includes(n))).slice(0, f.limit);
}

export function createSampleAdminRepo(): AdminRepo {
  const data = generatePublicSample();
  const view = buildEkView(data.characters, data.kills, data.ek_rules_versions, data.cities);
  const pub = view.kills;
  const locs = new Map(generateSampleLocations(data).map((l) => [l.combat_id, l]));
  const full: FullKill[] = pub.map((k) => {
    const l = locs.get(k.combat_id);
    return { ...k, location: l ? { map_id: l.map_id, x: l.x, y: l.y, recorded_at: l.recorded_at } : null };
  }).sort((a, b) => b.killed_at.localeCompare(a.killed_at));
  const audit: AuditEntry[] = []; // append-only: only push, never mutate/splice
  return {
    sample: true,
    async listFullKills(f) { return filterFull(full, { ...f, sinceDays: f.sinceDays ?? 0 }); },
    async appendAudit(e) { audit.push(Object.freeze({ ...e, id: audit.length + 1 })); },
    async listAudit(limit) { return audit.slice(-limit).reverse(); },
    async payoutPeriods() { return data.payout_periods; },
    async payoutPreview(periodId, rate) {
      const period = data.payout_periods.find((p) => p.period_id === periodId);
      if (!period) throw new Error('unknown period');
      const names = new Map(data.characters.map((c) => [c.pubkey, c.name]));
      return payoutPreview(period, pub.map((k) => ({ attacker_pubkey: k.attacker_pubkey, killed_at: k.killed_at, weight: k.ek.weight, rules_version: k.ek.rules_version })), names, rate);
    },
  };
}

export function createPgAdminRepo(connectionString: string): AdminRepo {
  const pool = new pg.Pool({ connectionString, max: 5, application_name: 'kill-viewer-admin' });
  return {
    sample: false,
    async listFullKills(f) {
      const args: unknown[] = []; const w: string[] = ['true'];
      if (f.sinceDays) { args.push(f.sinceDays); w.push(`killed_at >= now() - make_interval(days => $${args.length})`); }
      if (f.map_id) { args.push(f.map_id); w.push(`map_id = $${args.length}`); }
      if (f.q) { args.push(`%${f.q}%`); w.push(`(attacker_name ILIKE $${args.length} OR victim_name ILIKE $${args.length})`); }
      args.push(f.limit);
      const r = await pool.query(`SELECT combat_id, batch_id, tx_signature, attacker_pubkey, attacker_name, attacker_level,
          victim_pubkey, victim_name, victim_level, killed_at, day::text AS day, status::text AS status, drops, attacker_city, victim_city, ek,
          map_id, x, y, location_recorded_at
        FROM internal_ops.v_kill_full WHERE ${w.join(' AND ')} ORDER BY killed_at DESC LIMIT $${args.length}`, args);
      return r.rows.map(({ map_id, x, y, location_recorded_at, ...k }) => ({
        ...k, killed_at: new Date(k.killed_at).toISOString(),
        location: map_id ? { map_id, x, y, recorded_at: new Date(location_recorded_at).toISOString() } : null,
      }));
    },
    async appendAudit(e) {
      await pool.query(`INSERT INTO internal_ops.audit_log (actor_sub, actor_email, actor_ip, action, params, rows_returned)
        VALUES ($1,$2,$3,$4,$5,$6)`, [e.actor_sub, e.actor_email, e.actor_ip, e.action, JSON.stringify(e.params), e.rows_returned]);
    },
    async listAudit(limit) {
      const r = await pool.query(`SELECT id, at, actor_sub, actor_email, host(actor_ip) AS actor_ip, action, params, rows_returned
        FROM internal_ops.audit_log ORDER BY id DESC LIMIT $1`, [limit]);
      return r.rows;
    },
    async payoutPeriods() {
      return (await pool.query(`SELECT period_id, period_start AS start, period_end AS "end", closed_at, rules_version FROM public_ledger.payout_periods ORDER BY period_start DESC`)).rows;
    },
    async payoutPreview(periodId, rate) {
      const p = (await pool.query(`SELECT period_id, period_start AS start, period_end AS "end", closed_at, rules_version FROM public_ledger.payout_periods WHERE period_id=$1`, [periodId])).rows[0];
      if (!p) throw new Error('unknown period');
      const r = await pool.query(`SELECT pubkey, name, ek_sum::float8 AS ek_sum, preview_amount::float8 AS preview_amount FROM internal_ops.payout_preview($1, $2)`, [periodId, rate ?? null]);
      return { emitir: false, period: p, rules_version: p.rules_version, rate_per_ek: rate ?? null, formula: PAYOUT_FORMULA, rows: r.rows };
    },
  };
}
