// Dev-server regression: Vite's proxy key '/api' matches the client module by prefix
// (/api.ts, and also /apiClient.ts) and forwards it to :8787. The page stays blank.
// This must pass with nothing listening on 8787.
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createServer as createViteServer, type ViteDevServer } from 'vite';

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      s.close(() => resolvePort(port));
    });
    s.on('error', reject);
  });
}

describe('vite public dev proxy', () => {
  let server: ViteDevServer | undefined;
  let port = 0;

  afterAll(async () => { await server?.close(); });

  it('serves the API client module as JavaScript, not a proxied 404', async () => {
    port = await freePort();
    server = await createViteServer({
      configFile: resolve('vite.public.config.ts'),
      logLevel: 'error',
      server: { port, strictPort: true, host: '127.0.0.1' },
    });
    await server.listen();
    const r = await fetch(`http://127.0.0.1:${port}/apiClient.ts`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type') ?? '').toMatch(/text\/javascript/);
    const body = await r.text();
    expect(body).toMatch(/export/);
    expect(body).toMatch(/\/api\/health/);
  }, 30_000);
});
