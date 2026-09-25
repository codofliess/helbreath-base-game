import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const built = existsSync('dist/public') && existsSync('dist/server/public-api.mjs');
describe.skipIf(!built)('built artifacts (run `npm run build` first)', () => {
  it('public web bundle + public API artifact reference no location fields', () => {
    const r = spawnSync('node', ['scripts/check-public-bundle.mjs'], { encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
  });
  it('negative control: the checker DOES flag the admin artifacts', () => {
    const r = spawnSync('node', ['scripts/check-public-bundle.mjs', 'dist/admin', 'dist/server/admin-api.mjs'], { encoding: 'utf8' });
    expect(r.status).not.toBe(0);
  });
});

describe('db/schema.sql', () => {
  const sql = readFileSync('db/schema.sql', 'utf8');
  const noComments = sql.replace(/--.*$/gm, '');
  it('public_ledger tables have no location columns', () => {
    const pub = [...noComments.matchAll(/CREATE (?:TABLE|VIEW) public_ledger\.[\s\S]*?;\n/g)].map((m) => m[0]).join('\n');
    expect(pub.length).toBeGreaterThan(100);
    expect(pub).not.toMatch(/map_id|\bx\s+int|\by\s+int|location/i);
    expect(pub).toMatch(/kill_drops/);
  });
  it('viewer_ro gets nothing in internal_ops; join view lives in internal_ops', () => {
    const grants = noComments.split('\n').filter((l) => /GRANT/.test(l) && /viewer_ro/.test(l));
    expect(grants.length).toBeGreaterThan(0);
    for (const g of grants) expect(g).not.toMatch(/internal_ops/);
    expect(noComments).toMatch(/CREATE VIEW internal_ops\.v_kill_full/);
    expect(noComments).not.toMatch(/CREATE VIEW public_ledger\.[^;]*kill_location/);
  });
  it('audit_log is append-only', () => {
    expect(noComments).toMatch(/BEFORE UPDATE OR DELETE OR TRUNCATE ON internal_ops\.audit_log/);
    expect(noComments).toMatch(/GRANT INSERT ON internal_ops\.audit_log TO ops_admin/);
  });
});
