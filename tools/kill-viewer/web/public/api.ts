// Public viewer data access. Talks only to the public API (/api/*).
import type { CharacterResponse, CharacterSummary, KillListResponse, KillStatus, RankingsResponse } from '../../src/shared/public-types';

export interface PublicConfig {
  sample?: boolean;
  onchain_deployed: boolean;
  publish_delay_hours: number | null;
  time_round_minutes: number | null;
  loot_reveal_delay_hours: number | null;
  delay_phrase: string;
  loot_delay_phrase: string;
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<T>;
}
export const api = {
  health: () => get<PublicConfig & { ok: boolean; sample: boolean }>('/api/health'),
  kills: (q: string, status: KillStatus | '', offset = 0) =>
    get<KillListResponse & PublicConfig>(`/api/kills?limit=40&offset=${offset}&q=${encodeURIComponent(q)}${status ? `&status=${status}` : ''}`),
  characters: (q: string) => get<{ sample: boolean; items: CharacterSummary[] }>(`/api/characters?q=${encodeURIComponent(q)}`),
  rankings: () => get<RankingsResponse & PublicConfig>('/api/rankings'),
  cities: () => get<{ sample: boolean; items: { city_id: string; name: string }[] }>('/api/cities'),
  character: (name: string) => get<CharacterResponse & PublicConfig>(`/api/characters/${encodeURIComponent(name)}`),
};
