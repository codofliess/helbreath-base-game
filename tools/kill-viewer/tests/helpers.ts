import { FORBIDDEN_PUBLIC_KEYS } from '../src/shared/public-types';
import { TEST_OPEN_POLICY } from '../src/shared/publish-policy';
import { generatePublicSample } from '../src/shared/sample-public';

export { TEST_OPEN_POLICY };
export const sampleData = generatePublicSample();

export function collectKeys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => collectKeys(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); collectKeys(x, out); }
  return out;
}
export const forbiddenIn = (v: unknown) => [...collectKeys(v)].filter((k) => FORBIDDEN_PUBLIC_KEYS.includes(k.toLowerCase()) || /map|locat|coord/i.test(k));
