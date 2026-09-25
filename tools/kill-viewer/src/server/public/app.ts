// PUBLIC API. Imports: public types + public repo ONLY. (tests/import-boundary.test.ts enforces this.)
import { Hono } from 'hono';
import { KILL_STATUSES, type KillStatus } from '../../shared/public-types';
import { FAIL_CLOSED_POLICY, formatDelayPhrase, publishedBefore, type PublishPolicy } from '../../shared/publish-policy';
import type { PublicLedgerRepo } from './repo';
import { applyPublishPolicy, assertNoForbiddenKeys, toPublicCharacter, toPublicRanking } from './serialize';

export function createPublicApp(repo: PublicLedgerRepo, policy: PublishPolicy = FAIL_CLOSED_POLICY) {
  const app = new Hono();
  const cutoff = () => publishedBefore(new Date(), policy.publishDelayHours);
  const out = (k: Parameters<typeof applyPublishPolicy>[0]) => applyPublishPolicy(k, policy);
  const json = (c: any, body: unknown) => { assertNoForbiddenKeys(body); return c.json(body); };
  const publicConfig = () => ({
    onchain_deployed: policy.onchainDeployed,
    publish_delay_hours: policy.publishDelayHours,
    time_round_minutes: policy.roundMinutes,
    loot_reveal_delay_hours: policy.lootRevealDelayHours,
    delay_phrase: formatDelayPhrase(policy.publishDelayHours),
    loot_delay_phrase: formatDelayPhrase(policy.lootRevealDelayHours),
  });

  app.use('*', async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    if (c.req.path.startsWith('/api/')) c.header('Cache-Control', 'public, max-age=15');
  });

  app.get('/api/health', (c) => c.json({ ok: true, sample: repo.sample, ...publicConfig() }));

  app.get('/api/kills', async (c) => {
    const q = (c.req.query('q') ?? '').trim().slice(0, 32) || undefined;
    const s = c.req.query('status');
    const status = KILL_STATUSES.includes(s as KillStatus) ? (s as KillStatus) : undefined;
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 50) || 50, 1), 200);
    const offset = Math.max(Number(c.req.query('offset') ?? 0) || 0, 0);
    const r = await repo.listKills({ q, status, limit, offset, publishedBefore: cutoff() });
    return json(c, { sample: repo.sample, total: r.total, items: r.items.map(out), ...publicConfig() });
  });

  app.get('/api/characters', async (c) => {
    const q = (c.req.query('q') ?? '').trim().slice(0, 32);
    return json(c, { sample: repo.sample, items: (await repo.searchCharacters(q, 20)).map(toPublicCharacter) });
  });

  app.get('/api/characters/:name', async (c) => {
    const r = await repo.characterHistory(c.req.param('name').slice(0, 32), cutoff());
    if (!r) return c.json({ error: 'not_found' }, 404);
    return json(c, { sample: repo.sample, character: toPublicCharacter(r.character), deaths: r.deaths.map(out), kills: r.kills.map(out), ...publicConfig() });
  });

  app.get('/api/cities', async (c) => json(c, { sample: repo.sample, items: (await repo.cities()).map((x) => ({ city_id: x.city_id, name: x.name })) }));

  app.get('/api/rankings', async (c) => {
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 30) || 30, 1), 30);
    const r = await repo.rankings(cutoff(), limit);
    return json(c, {
      sample: repo.sample,
      rules: { version: r.rules.version, window_days: r.rules.ranking_window_days, same_city_weight: r.rules.same_city_weight,
        bands: r.rules.bands.map((b) => ({ rank_from: b.rank_from, rank_to: b.rank_to, weight: b.weight, label: b.label })) },
      cities: r.cities.map(toPublicRanking),
      ...publicConfig(),
    });
  });

  app.onError((err, c) => { console.error('[public-api]', err.message); return c.json({ error: 'internal' }, 500); });
  return app;
}
