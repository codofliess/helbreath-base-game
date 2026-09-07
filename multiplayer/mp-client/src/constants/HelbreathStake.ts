/** Character `StakedHell` ledger — $HELBREATH, not pending $HELL cash-shop credits. */
export const HELBREATH_TOKEN_TICKER = '$HELBREATH';

/** +1 Olympia group expertise level on every segment per this many tokens. */
export const HELBREATH_STAKE_PER_EXPERTISE_LEVEL = 20_000;

export function helbreathStakeBonusLevels(stakedHelbreath: number): number {
    if (!Number.isFinite(stakedHelbreath) || stakedHelbreath <= 0) {
        return 0;
    }
    return Math.floor(stakedHelbreath / HELBREATH_STAKE_PER_EXPERTISE_LEVEL);
}
