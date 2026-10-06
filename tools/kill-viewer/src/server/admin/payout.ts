// READ-ONLY payout PREVIEW. emitir = false. There is NO money-movement code anywhere in this project.
// No payout rate is defined anywhere: the rate is a required parameter with NO default. Without it, amounts are null.

export interface PayoutPeriod { period_id: string; start: string; end: string; closed_at: string | null; rules_version: string | null; }
export interface PayoutRow { pubkey: string; name: string; ek_sum: number; preview_amount: number | null; }
export interface PayoutPreview { emitir: false; period: PayoutPeriod; rules_version: string; rate_per_ek: number | null; formula: string; rows: PayoutRow[]; }
export interface WeightedKill { attacker_pubkey: string; killed_at: string; weight: number; rules_version: string; }

export const PAYOUT_FORMULA =
  'preview_amount(player) = rate_per_ek × Σ kill_weights.weight (attacker = player, period_start ≤ killed_at < period_end, rules_version = version frozen at period close)';

export function payoutPreview(period: PayoutPeriod, weights: WeightedKill[], names: Map<string, string>, ratePerEk?: number): PayoutPreview {
  if (!period.closed_at || !period.rules_version) throw new Error('period not closed: preview only runs on closed, frozen periods');
  if (ratePerEk !== undefined && !(Number.isFinite(ratePerEk) && ratePerEk >= 0)) throw new Error('rate_per_ek must be a finite number >= 0');
  const from = Date.parse(period.start), to = Date.parse(period.end);
  const sums = new Map<string, number>();
  for (const w of weights) {
    const t = Date.parse(w.killed_at);
    if (t < from || t >= to || w.rules_version !== period.rules_version || w.weight <= 0) continue;
    sums.set(w.attacker_pubkey, (sums.get(w.attacker_pubkey) ?? 0) + w.weight);
  }
  const rows = [...sums.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([pubkey, ek_sum]) => ({ pubkey, name: names.get(pubkey) ?? pubkey, ek_sum, preview_amount: ratePerEk === undefined ? null : ek_sum * ratePerEk }));
  return { emitir: false, period, rules_version: period.rules_version, rate_per_ek: ratePerEk ?? null, formula: PAYOUT_FORMULA, rows };
}
