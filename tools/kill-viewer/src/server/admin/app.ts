// ADMIN / OPS API (staff only). Separate entrypoint, port and host from the public API.
import { Hono } from 'hono';
import type { AuditEntry } from '../../shared/private-types';
import { staffAuth, type AuthConfig, type StaffIdentity } from './auth';
import { computeFlags, DEFAULT_THRESHOLDS } from './flags';
import type { AdminRepo } from './repo';

type Env = { Variables: { staff: StaffIdentity } };

export function createAdminApp(repo: AdminRepo, auth: AuthConfig) {
  const app = new Hono<Env>();
  app.use('*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
    c.header('X-Robots-Tag', 'noindex, nofollow');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'no-referrer');
  });
  app.use('/admin/api/*', staffAuth(auth));

  /** Every read touching location goes through here: query -> append audit (must succeed) -> respond. */
  async function audited<T>(staff: StaffIdentity, action: string, params: Record<string, unknown>, run: () => Promise<T>, count: (r: T) => number) {
    const result = await run();
    const entry: AuditEntry = { at: new Date().toISOString(), actor_sub: staff.sub, actor_email: staff.email, actor_ip: staff.ip, action, params, rows_returned: count(result) };
    await repo.appendAudit(entry); // throws => onError => 500, data never returned (fail closed)
    return result;
  }

  app.get('/admin/api/whoami', (c) => c.json({ staff: c.get('staff'), sample: repo.sample }));

  app.get('/admin/api/kills', async (c) => {
    const params = { q: c.req.query('q')?.slice(0, 32) || undefined, map_id: c.req.query('map_id')?.slice(0, 32) || undefined,
      sinceDays: Number(c.req.query('since_days') ?? 0) || undefined, limit: Math.min(Number(c.req.query('limit') ?? 200) || 200, 1000) };
    const rows = await audited(c.get('staff'), 'list_full_kills', params, () => repo.listFullKills(params), (r) => r.length);
    return c.json({ sample: repo.sample, items: rows });
  });

  app.get('/admin/api/flags', async (c) => {
    const params = { sinceDays: Number(c.req.query('since_days') ?? 0) || undefined, limit: 10_000 };
    const flags = await audited(c.get('staff'), 'investigation_flags', { ...params, thresholds: DEFAULT_THRESHOLDS },
      async () => computeFlags(await repo.listFullKills(params)), (r) => r.length);
    return c.json({ sample: repo.sample, thresholds: DEFAULT_THRESHOLDS, flags });
  });

  // Reading the audit log is itself audited.
  app.get('/admin/api/audit', async (c) => {
    const rows = await audited(c.get('staff'), 'read_audit_log', {}, () => repo.listAudit(200), (r) => r.length);
    return c.json({ items: rows });
  });

  // Payout PREVIEW (read-only; emitir=false). rate_per_ek has no default — omit it to get the formula + EK sums only.
  app.get('/admin/api/payout-periods', async (c) => c.json({ items: await repo.payoutPeriods() }));
  app.get('/admin/api/payout-preview', async (c) => {
    const periodId = c.req.query('period_id') ?? '';
    const rateQ = c.req.query('rate_per_ek');
    const rate = rateQ === undefined || rateQ === '' ? undefined : Number(rateQ);
    try {
      const preview = await audited(c.get('staff'), 'payout_preview', { periodId, rate_per_ek: rate ?? null }, () => repo.payoutPreview(periodId, rate), (r) => r.rows.length);
      return c.json(preview);
    } catch (e) { return c.json({ error: (e as Error).message }, 400); }
  });

  app.onError((err, c) => { console.error('[admin-api]', err.message); return c.json({ error: 'internal' }, 500); });
  return app;
}
