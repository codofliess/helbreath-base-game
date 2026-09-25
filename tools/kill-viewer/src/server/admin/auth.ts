// STAFF auth for the admin API: OIDC/JWT with role claim + IP allowlist. Fail closed.
import type { MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export interface StaffIdentity { sub: string; email: string | null; roles: string[]; ip: string; }
export type TokenVerifier = (token: string) => Promise<JWTPayload>;

export interface AuthConfig {
  verifier: TokenVerifier | null; // null => no IdP configured => reject everything
  requiredRole: string;
  roleClaim: string;
  ipAllowlist: string[]; // exact IPv4/IPv6 or IPv4 CIDR. Empty => deny all.
  getClientIp: (c: Parameters<MiddlewareHandler>[0]) => string;
}

/** Env names only: ADMIN_OIDC_ISSUER, ADMIN_OIDC_AUDIENCE, ADMIN_OIDC_JWKS_URL, ADMIN_DEV_JWT_SECRET (non-production only). */
export function verifierFromEnv(env: NodeJS.ProcessEnv): TokenVerifier | null {
  const issuer = env.ADMIN_OIDC_ISSUER, audience = env.ADMIN_OIDC_AUDIENCE;
  if (env.ADMIN_OIDC_JWKS_URL && issuer && audience) {
    const jwks = createRemoteJWKSet(new URL(env.ADMIN_OIDC_JWKS_URL));
    return async (t) => (await jwtVerify(t, jwks, { issuer, audience, algorithms: ['RS256', 'ES256'] })).payload;
  }
  if (env.NODE_ENV !== 'production' && env.ADMIN_DEV_JWT_SECRET) {
    console.warn('[admin-api] DEV HS256 verifier enabled (ADMIN_DEV_JWT_SECRET). Never in production.');
    return devHs256Verifier(env.ADMIN_DEV_JWT_SECRET);
  }
  return null;
}
export function devHs256Verifier(secret: string): TokenVerifier {
  const key = new TextEncoder().encode(secret);
  return async (t) => (await jwtVerify(t, key, { issuer: 'chainlords-dev', audience: 'kill-viewer-admin', algorithms: ['HS256'] })).payload;
}

function ipv4ToInt(ip: string) { const p = ip.split('.').map(Number); return p.length === 4 && p.every((n) => n >= 0 && n <= 255) ? ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0 : null; }
export function ipAllowed(ip: string, list: string[]): boolean {
  const norm = ip.replace(/^::ffff:/, '');
  return list.some((entry) => {
    if (!entry.includes('/')) return entry === norm;
    const [base, bitsS] = entry.split('/'); const bits = Number(bitsS);
    const a = ipv4ToInt(norm), b = ipv4ToInt(base);
    if (a === null || b === null || !(bits >= 0 && bits <= 32)) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (a & mask) === (b & mask);
  });
}

export function staffAuth(cfg: AuthConfig): MiddlewareHandler<{ Variables: { staff: StaffIdentity } }> {
  return async (c, next) => {
    const ip = cfg.getClientIp(c);
    if (!ipAllowed(ip, cfg.ipAllowlist)) return c.json({ error: 'forbidden_ip' }, 403);
    if (!cfg.verifier) return c.json({ error: 'auth_not_configured' }, 503);
    const h = c.req.header('authorization') ?? '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token) return c.json({ error: 'unauthenticated' }, 401);
    let payload: JWTPayload;
    try { payload = await cfg.verifier(token); } catch { return c.json({ error: 'invalid_token' }, 401); }
    const raw = payload[cfg.roleClaim];
    const roles = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? [raw] : [];
    if (!roles.includes(cfg.requiredRole) || !payload.sub) return c.json({ error: 'insufficient_role' }, 403);
    c.set('staff', { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email : null, roles, ip });
    await next();
  };
}
