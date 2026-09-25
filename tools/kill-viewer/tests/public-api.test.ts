import { describe, expect, it } from 'vitest';
import { createPublicApp } from '../src/server/public/app';
import { createSampleRepo } from '../src/server/public/repo';
import { assertNoForbiddenKeys } from '../src/server/public/serialize';
import { FAIL_CLOSED_POLICY } from '../src/shared/publish-policy';
import type { CharacterResponse, KillListResponse, PublicKill } from '../src/shared/public-types';
import { SAMPLE_MAP_IDS } from '../src/server/admin/sample-locations';
import { forbiddenIn, sampleData, TEST_OPEN_POLICY } from './helpers';

const repo = createSampleRepo(sampleData);
const app = createPublicApp(repo, TEST_OPEN_POLICY);
const get = async <T>(p: string) => { const r = await app.request(p); expect(r.status).toBe(200); return { body: (await r.json()) as T, text: '' }; };
const raw = async (p: string) => (await app.request(p)).text();
const chars = sampleData.characters.slice(0, 20);

const endpoints = ['/api/health', '/api/kills?limit=200', '/api/kills?limit=200&offset=200', '/api/kills?status=pair_limit_reached',
  '/api/kills?q=gold', '/api/characters?q=', '/api/rankings', '/api/cities', ...chars.map((c) => `/api/characters/${encodeURIComponent(c.name)}`)];

describe('public API — privacy', () => {
  it.each(endpoints)('%s has no map/location/x/y keys', async (p) => {
    const r = await app.request(p);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(forbiddenIn(body)).toEqual([]);
  });
  it.each(endpoints)('%s raw JSON contains no private map ids', async (p) => {
    const text = await raw(p);
    for (const m of SAMPLE_MAP_IDS) expect(text).not.toMatch(new RegExp(`\\b${m}\\b`));
    expect(text).not.toMatch(/"(map_id|location|x|y|coords|recorded_at)"\s*:/);
  });
  it('serializer strips unknown fields even if the repo leaks them', async () => {
    const leaky = createSampleRepo(sampleData);
    const orig = leaky.listKills.bind(leaky);
    leaky.listKills = async (f) => { const r = await orig(f); return { ...r, items: r.items.map((k) => ({ ...k, map_id: 'bisle', x: 1, y: 2, location: { map_id: 'bisle' } }) as PublicKill) }; };
    const r = await createPublicApp(leaky, TEST_OPEN_POLICY).request('/api/kills?limit=5');
    expect(forbiddenIn(await r.json())).toEqual([]);
  });
  it('runtime tripwire throws on forbidden keys', () => {
    expect(() => assertNoForbiddenKeys({ items: [{ drops: {}, location: {} }] })).toThrow(/location/);
    expect(() => assertNoForbiddenKeys({ a: [{ X: 1 }] })).toThrow();
  });
});

describe('public API — fail-closed publish policy', () => {
  it('unset delay hides every kill', async () => {
    const r = await createPublicApp(repo, FAIL_CLOSED_POLICY).request('/api/kills?limit=200');
    const body = (await r.json()) as KillListResponse;
    expect(body.total).toBe(0);
    expect(body.items).toEqual([]);
  });
  it('unset loot delay hides loot even when kills are published', async () => {
    const r = await createPublicApp(repo, { ...TEST_OPEN_POLICY, lootRevealDelayHours: null }).request('/api/kills?limit=50');
    const body = (await r.json()) as KillListResponse;
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((k) => k.loot_revealed === false && k.drops.items.length === 0 && k.drops.zem.dropped === false)).toBe(true);
  });
  it('unset round size coarsens times to the UTC day', async () => {
    const r = await createPublicApp(repo, { ...TEST_OPEN_POLICY, roundMinutes: null }).request('/api/kills?limit=20');
    const body = (await r.json()) as KillListResponse;
    expect(body.items.every((k) => k.killed_at.endsWith('T00:00:00.000Z'))).toBe(true);
  });
});

describe('public API — content', () => {
  it('every kill carries public drops (Zem + items)', async () => {
    const { body } = await get<KillListResponse>('/api/kills?limit=200');
    expect(body.items.length).toBeGreaterThan(100);
    for (const k of body.items) {
      expect(k.drops).toBeDefined();
      expect(k.loot_revealed).toBe(true);
      expect(typeof k.drops.zem.dropped).toBe('boolean');
      expect(typeof k.drops.zem.amount).toBe('number');
      expect(Array.isArray(k.drops.items)).toBe(true);
      if (!k.drops.zem.dropped) expect(k.drops.zem.amount).toBe(0);
      for (const i of k.drops.items) {
        expect(Object.keys(i).sort()).toEqual(['bound', 'category', 'item_id', 'name', 'qty', 'rarity']);
        expect(i.qty).toBeGreaterThan(0);
      }
    }
    expect(body.items.some((k) => k.drops.zem.dropped && k.drops.zem.amount > 0)).toBe(true);
    expect(body.items.some((k) => k.drops.items.length > 0)).toBe(true);
    expect(body.items.some((k) => k.drops.items.some((i) => i.bound))).toBe(true);
  });
  it('kill entries expose exactly the public slice', async () => {
    const { body } = await get<KillListResponse>('/api/kills?limit=1');
    expect(Object.keys(body.items[0]).sort()).toEqual(['attacker_city', 'attacker_level', 'attacker_name', 'attacker_pubkey', 'batch_id', 'combat_id', 'day',
      'drops', 'ek', 'killed_at', 'loot_revealed', 'status', 'tx_signature', 'victim_city', 'victim_level', 'victim_name', 'victim_pubkey']);
    expect(Object.keys(body.items[0].ek).sort()).toEqual(['band_label', 'cross_city', 'rules_version', 'victim_rank_snapshot', 'weight']);
    expect(body.sample).toBe(true);
  });
  it('character endpoint returns deaths and kills with drops', async () => {
    const { body } = await get<CharacterResponse>('/api/characters/GoldMule_77');
    expect(body.character.name).toBe('GoldMule_77');
    expect(body.deaths.length).toBeGreaterThan(5);
    expect(body.deaths.every((k) => k.victim_name === 'GoldMule_77' && k.drops)).toBe(true);
    expect(body.deaths.some((k) => k.status === 'pair_limit_reached')).toBe(true);
  });
  it('unknown character -> 404', async () => { expect((await app.request('/api/characters/nobody_here')).status).toBe(404); });
  it('optional time rounding knob rounds timestamps', async () => {
    const r = await createPublicApp(createSampleRepo(sampleData), { ...TEST_OPEN_POLICY, roundMinutes: 60 }).request('/api/kills?limit=20');
    const body = (await r.json()) as KillListResponse;
    expect(body.items.every((k) => k.killed_at.endsWith(':00:00.000Z'))).toBe(true);
  });
  it('public app has no admin routes', async () => {
    for (const p of ['/admin/api/kills', '/admin/api/flags', '/admin/api/audit']) expect((await app.request(p)).status).toBe(404);
  });
  it('health reports sample banner source and fail-closed defaults when unset', async () => {
    const closed = await createPublicApp(repo, FAIL_CLOSED_POLICY).request('/api/health');
    const h = await closed.json();
    expect(h.sample).toBe(true);
    expect(h.onchain_deployed).toBe(false);
    expect(h.publish_delay_hours).toBeNull();
    expect(h.loot_reveal_delay_hours).toBeNull();
  });
});
