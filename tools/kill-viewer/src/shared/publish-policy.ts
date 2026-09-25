/**
 * Fail-closed public publish policy.
 * Delay durations are NOT decided: unset env => hide (kills / loot).
 * Times are rounded; if the round size is unset, coarsen to the UTC day.
 */

export interface PublishPolicy {
  /** Minutes to floor killed_at. null = fail-closed UTC-day coarsening (no finer default decided). */
  roundMinutes: number | null;
  /** Hours to withhold a kill. null = hide every kill. 0 is an explicit "publish immediately" (tests / local override). */
  publishDelayHours: number | null;
  /** Hours to withhold loot. null = hide loot. 0 is an explicit "reveal immediately". */
  lootRevealDelayHours: number | null;
  /** Player-facing on-chain subtitle/footer. Default false — no contract is deployed. */
  onchainDeployed: boolean;
}

export const FAIL_CLOSED_POLICY: PublishPolicy = {
  roundMinutes: null,
  publishDelayHours: null,
  lootRevealDelayHours: null,
  onchainDeployed: false,
};

/** Explicit open policy for tests that need to inspect generated sample rows. */
export const TEST_OPEN_POLICY: PublishPolicy = {
  roundMinutes: 60,
  publishDelayHours: 0,
  lootRevealDelayHours: 0,
  onchainDeployed: false,
};

/** Blank / missing / non-finite => null (fail closed). "0" is a real zero. */
export function parseOptionalNumberEnv(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function parseOnchainFlag(raw: string | undefined): boolean {
  if (raw === undefined || raw.trim() === '') return false;
  return raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'yes';
}

export function policyFromEnv(env: NodeJS.ProcessEnv = process.env): PublishPolicy {
  return {
    roundMinutes: parseOptionalNumberEnv(env.PUBLIC_TIME_ROUND_MINUTES),
    publishDelayHours: parseOptionalNumberEnv(env.PUBLIC_PUBLISH_DELAY_HOURS),
    lootRevealDelayHours: parseOptionalNumberEnv(env.PUBLIC_LOOT_REVEAL_DELAY_HOURS),
    onchainDeployed: parseOnchainFlag(env.KILL_LEDGER_ONCHAIN_DEPLOYED),
  };
}

/** Unset delay => epoch (nothing is old enough to publish). */
export function publishedBefore(now: Date, delayHours: number | null): Date {
  if (delayHours === null) return new Date(0);
  return new Date(now.getTime() - delayHours * 3_600_000);
}

export function formatDelayPhrase(hours: number | null): string {
  if (hours === null) return '{delay}';
  if (hours === 1) return '1 hour';
  return `${hours} hours`;
}
