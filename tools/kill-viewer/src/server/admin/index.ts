// ADMIN API entrypoint (separately deployable; bind to an internal host/VPN only). Env names (no values committed):
//   ADMIN_DB_URL            postgres URL for role ops_admin (unset => SAMPLE data, non-production only)
//   ADMIN_PORT / ADMIN_HOST default 8788 / 127.0.0.1
//   ADMIN_OIDC_ISSUER, ADMIN_OIDC_AUDIENCE, ADMIN_OIDC_JWKS_URL   staff IdP
//   ADMIN_ROLE_CLAIM (default "roles"), ADMIN_REQUIRED_ROLE (default "ops_admin")
//   ADMIN_IP_ALLOWLIST      comma-separated IPs / IPv4 CIDRs (empty => deny all)
//   ADMIN_TRUST_PROXY       "1" to take client IP from X-Forwarded-For (only behind your own proxy)
//   ADMIN_DEV_JWT_SECRET    local dev only (ignored when NODE_ENV=production)
//   ADMIN_STATIC_DIR        optional, serve built admin UI (dist/admin) under /admin/
import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { serveStatic } from '@hono/node-server/serve-static';
import { createAdminApp } from './app';
import { verifierFromEnv } from './auth';
import { createPgAdminRepo, createSampleAdminRepo } from './repo';

const env = process.env;
if (!env.ADMIN_DB_URL && env.NODE_ENV === 'production') throw new Error('ADMIN_DB_URL required in production');
const repo = env.ADMIN_DB_URL ? createPgAdminRepo(env.ADMIN_DB_URL) : createSampleAdminRepo();
const app = createAdminApp(repo, {
  verifier: verifierFromEnv(env),
  roleClaim: env.ADMIN_ROLE_CLAIM ?? 'roles',
  requiredRole: env.ADMIN_REQUIRED_ROLE ?? 'ops_admin',
  ipAllowlist: (env.ADMIN_IP_ALLOWLIST ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  getClientIp: (c) => (env.ADMIN_TRUST_PROXY === '1' && c.req.header('x-forwarded-for')?.split(',')[0].trim()) || getConnInfo(c).remote.address || '',
});
if (env.ADMIN_STATIC_DIR) {
  const dir = env.ADMIN_STATIC_DIR;
  app.use('/admin/*', serveStatic({ root: dir, rewriteRequestPath: (p) => p.replace(/^\/admin/, '') }));
  app.get('/admin', serveStatic({ path: `${dir}/index.html` }));
}
const port = Number(env.ADMIN_PORT ?? 8788);
serve({ fetch: app.fetch, port, hostname: env.ADMIN_HOST ?? '127.0.0.1' });
console.log(`[admin-api] listening ${env.ADMIN_HOST ?? '127.0.0.1'}:${port} (${repo.sample ? 'SAMPLE data' : 'postgres ops_admin'})`);
