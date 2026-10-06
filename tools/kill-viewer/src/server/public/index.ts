// PUBLIC API entrypoint (separately deployable). Env (names only, no values committed):
//   PUBLIC_DB_URL                    postgres URL for role viewer_ro (unset => SAMPLE banner / generated preview)
//   PUBLIC_PORT                      default 8787
//   PUBLIC_STATIC_DIR                optional, serve built public viewer (dist/public)
//   PUBLIC_TIME_ROUND_MINUTES        required for finer buckets; unset => UTC-day coarsening (fail closed)
//   PUBLIC_PUBLISH_DELAY_HOURS       required; unset => hide all kills (fail closed). No duration decided.
//   PUBLIC_LOOT_REVEAL_DELAY_HOURS   required; unset => hide loot (fail closed)
//   KILL_LEDGER_ONCHAIN_DEPLOYED     default false — on-chain subtitle/footer stay off
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { policyFromEnv } from '../../shared/publish-policy';
import { createPublicApp } from './app';
import { createPgRepo, createSampleRepo } from './repo';

const env = process.env;
const repo = env.PUBLIC_DB_URL ? createPgRepo(env.PUBLIC_DB_URL) : createSampleRepo();
const app = createPublicApp(repo, policyFromEnv(env));
if (env.PUBLIC_STATIC_DIR) {
  app.use('/*', serveStatic({ root: env.PUBLIC_STATIC_DIR }));
  app.get('*', serveStatic({ path: `${env.PUBLIC_STATIC_DIR}/index.html` }));
}
const port = Number(env.PUBLIC_PORT ?? 8787);
serve({ fetch: app.fetch, port, hostname: env.PUBLIC_HOST ?? '127.0.0.1' });
console.log(`[public-api] listening :${port} (${repo.sample ? 'SAMPLE data' : 'postgres viewer_ro'})`);
