import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { createAdminApp } from '../src/server/admin/app';
import { devHs256Verifier, ipAllowed } from '../src/server/admin/auth';
import { createSampleAdminRepo } from '../src/server/admin/repo';
import type { AuditEntry, FullKill, InvestigationFlag } from '../src/shared/private-types';

const TEST_SECRET = 'test-only-not-a-secret-value-0123456789'; // test fixture, not a real credential
const key = new TextEncoder().encode(TEST_SECRET);
const token = (claims: Record<string, unknown>, sub = 'staff-123') =>
  new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setIssuer('chainlords-dev').setAudience('kill-viewer-admin').setExpirationTime('5m').sign(key);

function mk(ip = '10.0.0.5', repo = createSampleAdminRepo()) {
  const app = createAdminApp(repo, { verifier: devHs256Verifier(TEST_SECRET), requiredRole: 'ops_admin', roleClaim: 'roles', ipAllowlist: ['10.0.0.0/24', '127.0.0.1'], getClientIp: () => ip });
  return { app, repo };
}
const auth = async (roles: string[] = ['ops_admin']) => ({ authorization: `Bearer ${await token({ roles, email: 'gm@example.invalid' })}` });

describe('admin API gating', () => {
  it('rejects IPs outside allowlist even with valid token', async () => {
    const { app } = mk('203.0.113.9');
    expect((await app.request('/admin/api/kills', { headers: await auth() })).status).toBe(403);
  });
  it('401 without token, 401 bad token, 403 without role', async () => {
    const { app } = mk();
    expect((await app.request('/admin/api/kills')).status).toBe(401);
    expect((await app.request('/admin/api/kills', { headers: { authorization: 'Bearer nope' } })).status).toBe(401);
    expect((await app.request('/admin/api/kills', { headers: await auth(['player']) })).status).toBe(403);
  });
  it('503 when no IdP configured (fail closed)', async () => {
    const app = createAdminApp(createSampleAdminRepo(), { verifier: null, requiredRole: 'ops_admin', roleClaim: 'roles', ipAllowlist: ['10.0.0.5'], getClientIp: () => '10.0.0.5' });
    expect((await app.request('/admin/api/kills', { headers: await auth() })).status).toBe(503);
  });
  it('ip allowlist matcher', () => {
    expect(ipAllowed('::ffff:10.0.0.7', ['10.0.0.0/24'])).toBe(true);
    expect(ipAllowed('10.0.1.7', ['10.0.0.0/24'])).toBe(false);
    expect(ipAllowed('1.2.3.4', [])).toBe(false);
  });
});

describe('admin API data + audit', () => {
  it('returns full rows with location and writes an audit entry (who/what/when)', async () => {
    const { app, repo } = mk();
    const r = await app.request('/admin/api/kills?q=GoldMule', { headers: await auth() });
    expect(r.status).toBe(200);
    const { items } = (await r.json()) as { items: FullKill[] };
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].location?.map_id).toBeTruthy();
    const log = await repo.listAudit(10);
    expect(log[0]).toMatchObject({ actor_sub: 'staff-123', actor_email: 'gm@example.invalid', actor_ip: '10.0.0.5', action: 'list_full_kills', rows_returned: items.length });
    expect(log[0].params).toMatchObject({ q: 'GoldMule' });
    expect(Date.parse(log[0].at)).toBeGreaterThan(0);
  });
  it('fails closed (500, no data) if the audit write fails', async () => {
    const repo = createSampleAdminRepo();
    repo.appendAudit = async (_e: AuditEntry) => { throw new Error('db down'); };
    const { app } = mk('10.0.0.5', repo);
    const r = await app.request('/admin/api/kills', { headers: await auth() });
    expect(r.status).toBe(500);
    expect(await r.text()).not.toMatch(/map_id/);
  });
  it('flags planted patterns incl. loot funneling', async () => {
    const { app } = mk();
    const { flags } = (await (await app.request('/admin/api/flags', { headers: await auth() })).json()) as { flags: InvestigationFlag[] };
    const has = (kind: string, a: string, v: string) => flags.some((f) => f.kind === kind && f.attacker_name === a && f.victim_name === v);
    expect(has('loot_funneling', 'RichBuyer', 'GoldMule_77')).toBe(true);
    expect(has('map_cluster', 'RichBuyer', 'GoldMule_77')).toBe(true);
    expect(has('repeated_pair', 'RichBuyer', 'GoldMule_77')).toBe(true);
    expect(has('victim_same_killer', 'NightMoth', 'Thessaly')).toBe(true);
  });
});
