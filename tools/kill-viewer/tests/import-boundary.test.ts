// Static guarantee: public API + public web code never import location/admin code, nor mention private fields.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const walk = (p: string): string[] => statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => walk(join(p, f))) : [p];
const publicFiles = [...walk('src/server/public'), ...walk('web/public'), 'src/shared/public-types.ts', 'src/shared/items.ts', 'src/shared/sample-public.ts', 'src/shared/publish-policy.ts'].filter((f) => /\.(ts|tsx)$/.test(f));

describe('public code import boundary', () => {
  it.each(publicFiles)('%s imports nothing private', (f) => {
    const src = readFileSync(f, 'utf8');
    const imports = [...src.matchAll(/(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1] ?? m[2]);
    for (const i of imports) expect(i).not.toMatch(/private|admin|internal|location|sample\/private/);
  });
  it.each(publicFiles)('%s mentions no private fields', (f) => {
    const src = readFileSync(f, 'utf8').replace(/FORBIDDEN_PUBLIC_KEYS\s*=\s*\[[^\]]*\]/, '');
    expect(src).not.toMatch(/map_id|kill_location|internal_ops|v_kill_full|recorded_at|KillLocation|FullKill|ADMIN_/);
  });
});
