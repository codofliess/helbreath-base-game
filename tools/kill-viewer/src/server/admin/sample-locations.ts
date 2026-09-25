// ADMIN-ONLY: SAMPLE private slice (kill location). Never imported by the public API or public bundle.
import type { KillLocation } from '../../shared/private-types';
import type { PublicSampleData } from '../../shared/sample-public';

/** Fictional map ids used only in generated admin fixtures + the public-bundle denylist. */
export const SAMPLE_MAP_BOUNDS: Record<string, [number, number]> = {
  middleland: [250, 250], huntzone1: [120, 120], huntzone3: [120, 120], arefarm: [180, 180],
  elvfarm: [180, 180], dglv2: [100, 100], bisle: [140, 140],
};
export const SAMPLE_MAP_IDS = Object.keys(SAMPLE_MAP_BOUNDS);

export function generateSampleLocations(data: PublicSampleData, seed0 = 1337): KillLocation[] {
  let seed = seed0;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  // Advance the same RNG stream as generatePublicSample so leftover entropy is unused but stable.
  // Locations are assigned from drafts + kills (already generated); we only need a fresh local stream.
  void seed0;
  let locSeed = seed0 ^ 0x51a2c3d4;
  const lrnd = () => {
    locSeed = (locSeed + 0x6d2b79f5) | 0;
    let t = Math.imul(locSeed ^ (locSeed >>> 15), 1 | locSeed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const lint = (lo: number, hi: number) => lo + Math.floor(lrnd() * (hi - lo + 1));
  const lpick = <T>(a: T[]) => a[Math.floor(lrnd() * a.length)];
  void rnd; void pick; void int;

  return data.kills.map((k, idx) => {
    const plant = data.drafts[idx]?.plant;
    const map_id = plant === 'funnel' ? 'bisle' : plant === 'trade' ? 'dglv2' : lpick(SAMPLE_MAP_IDS);
    const [mx, my] = SAMPLE_MAP_BOUNDS[map_id];
    const x = plant === 'funnel' ? lint(60, 66) : plant === 'trade' ? lint(40, 45) : lint(5, mx - 5);
    const y = plant === 'funnel' ? lint(88, 94) : plant === 'trade' ? lint(40, 45) : lint(5, my - 5);
    return { combat_id: k.combat_id, map_id, x, y, recorded_at: new Date(Date.parse(k.killed_at) + 1000).toISOString() };
  });
}
