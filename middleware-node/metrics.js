/**
 * In-process counters for mint/claim ops visibility (reset on process restart).
 * Exposed via GET /metrics and embedded in GET /health.
 */
const counters = {
    claims_attempt: 0,
    claims_ok: 0,
    claims_rejected: 0,
    claims_error: 0,
    /** Another worker already holds nft_claim_lease_until (or in-process lock). */
    claim_lease_rejected: 0,
    /** On-chain mint succeeded but ledger UPDATE lost the race or failed to apply. */
    mint_orphan_db_race: 0,
};

function inc(name, by = 1) {
    if (Object.prototype.hasOwnProperty.call(counters, name)) {
        counters[name] += by;
    }
}

function snapshot() {
    return { ...counters, uptime_s: Math.floor(process.uptime()) };
}

module.exports = {
    counters,
    inc,
    snapshot,
};
