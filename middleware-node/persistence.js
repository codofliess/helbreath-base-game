const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let pool;

function getPool() {
    if (pool) {
        return pool;
    }

    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING;
    if (!connectionString) {
        return null;
    }

    pool = new Pool({ connectionString });
    return pool;
}

async function ensureSchema() {
    const db = getPool();
    if (!db) {
        return false;
    }

    const schemaPath = path.join(__dirname, '..', 'multiplayer', 'server', 'Persistence', 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
        console.warn(`[persistence] schema.sql not found at ${schemaPath}`);
        return false;
    }

    const sql = fs.readFileSync(schemaPath, 'utf8');
    await db.query(sql);
    console.log('[persistence] Schema applied.');
    return true;
}

async function listUnclaimedDrops(wallet) {
    const db = getPool();
    if (!db) {
        return [];
    }

    const result = await db.query(
        `SELECT id, item_uid, item_id, item_attribute, item_color, quantity,
                source_monster_id, source_map, nft_tier, created_at
         FROM drop_ledger
         WHERE account_wallet = $1 AND is_nft_candidate = TRUE AND nft_claimed_at IS NULL
         ORDER BY created_at DESC`,
        [wallet],
    );
    return result.rows;
}

async function getDropById(dropId) {
    const db = getPool();
    if (!db) {
        return null;
    }

    const result = await db.query(
        `SELECT * FROM drop_ledger WHERE id = $1 LIMIT 1`,
        [dropId],
    );
    return result.rows[0] ?? null;
}

/**
 * Cross-replica single-flight: only one worker holds a live lease on an unclaimed drop.
 * Lease TTL covers mint RPC latency; crashed workers free the row when the lease expires.
 */
async function tryAcquireClaimLease(dropId, leaseSeconds = 120) {
    const db = getPool();
    if (!db) {
        return null;
    }

    const ttl = Math.max(30, Math.min(600, Number(leaseSeconds) || 120));
    const result = await db.query(
        `UPDATE drop_ledger
         SET nft_claim_lease_until = NOW() + ($2::text || ' seconds')::interval
         WHERE id = $1
           AND is_nft_candidate = TRUE
           AND nft_claimed_at IS NULL
           AND (nft_claim_lease_until IS NULL OR nft_claim_lease_until < NOW())
         RETURNING *`,
        [dropId, String(ttl)],
    );
    return result.rows[0] ?? null;
}

async function releaseClaimLease(dropId) {
    const db = getPool();
    if (!db) {
        return false;
    }

    const result = await db.query(
        `UPDATE drop_ledger
         SET nft_claim_lease_until = NULL
         WHERE id = $1 AND nft_claimed_at IS NULL`,
        [dropId],
    );
    return result.rowCount > 0;
}

async function markDropClaimed(dropId, mintAddress) {
    const db = getPool();
    if (!db) {
        return false;
    }

    const result = await db.query(
        `UPDATE drop_ledger
         SET nft_claimed_at = NOW(),
             nft_mint_address = $2,
             nft_claim_lease_until = NULL
         WHERE id = $1 AND nft_claimed_at IS NULL`,
        [dropId, mintAddress],
    );
    return result.rowCount > 0;
}

module.exports = {
    getPool,
    ensureSchema,
    listUnclaimedDrops,
    getDropById,
    tryAcquireClaimLease,
    releaseClaimLease,
    markDropClaimed,
};
