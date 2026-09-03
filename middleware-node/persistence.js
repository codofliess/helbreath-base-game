const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let pool;
/** @type {boolean | null} */
let postgresReady = null;
/** @type {Promise<boolean> | null} */
let postgresCheckPromise = null;

/**
 * Resolve Postgres URL from Railway / standard env aliases.
 * Never log the returned string (contains credentials).
 */
function resolveDatabaseUrl() {
    const direct =
        process.env.DATABASE_URL ||
        process.env.POSTGRES_CONNECTION_STRING ||
        process.env.DATABASE_PRIVATE_URL ||
        process.env.DATABASE_PUBLIC_URL;
    if (direct && String(direct).trim()) {
        return String(direct).trim();
    }

    const host = process.env.PGHOST || process.env.POSTGRES_HOST;
    const user = process.env.PGUSER || process.env.POSTGRES_USER;
    const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
    const database = process.env.PGDATABASE || process.env.POSTGRES_DB || 'railway';
    const port = process.env.PGPORT || process.env.POSTGRES_PORT || '5432';

    if (host && user && password) {
        const encUser = encodeURIComponent(user);
        const encPass = encodeURIComponent(password);
        return `postgresql://${encUser}:${encPass}@${host}:${port}/${database}`;
    }

    return null;
}

function getPool() {
    if (pool) {
        return pool;
    }

    const connectionString = resolveDatabaseUrl();
    if (!connectionString) {
        return null;
    }

    pool = new Pool({
        connectionString,
        max: Number(process.env.PG_POOL_MAX || 10),
        connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 10000),
        idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
    });

    pool.on('error', (error) => {
        console.error('[persistence] Pool error:', error.message);
        postgresReady = false;
    });

    return pool;
}

async function pingPostgres() {
    const db = getPool();
    if (!db) {
        postgresReady = false;
        return false;
    }

    try {
        await db.query('SELECT 1 AS ok');
        postgresReady = true;
        return true;
    } catch (error) {
        console.error('[persistence] Ping failed:', error.message);
        postgresReady = false;
        return false;
    }
}

function isPostgresConfigured() {
    return Boolean(resolveDatabaseUrl());
}

async function isPostgresReady() {
    if (!isPostgresConfigured()) {
        return false;
    }
    if (postgresReady === true) {
        return true;
    }
    if (!postgresCheckPromise) {
        postgresCheckPromise = pingPostgres().finally(() => {
            postgresCheckPromise = null;
        });
    }
    return postgresCheckPromise;
}

/**
 * Locate schema.sql for Railway Root Directory `/middleware-node` and local monorepo checkouts.
 * Railway only copies the service root, so `../multiplayer/...` is `/multiplayer/...` and missing.
 */
function resolveSchemaPath() {
    const fromEnv = (process.env.SCHEMA_SQL_PATH || '').trim();
    const candidates = [
        fromEnv,
        path.join(__dirname, 'Persistence', 'schema.sql'),
        path.join(process.cwd(), 'Persistence', 'schema.sql'),
        path.join(__dirname, '..', 'multiplayer', 'server', 'Persistence', 'schema.sql'),
        path.join(process.cwd(), '..', 'multiplayer', 'server', 'Persistence', 'schema.sql'),
    ].filter(Boolean);

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}

async function ensureSchema() {
    const db = getPool();
    if (!db) {
        return false;
    }

    const schemaPath = resolveSchemaPath();
    if (!schemaPath) {
        console.warn('[persistence] schema.sql not found (tried Persistence/schema.sql and monorepo multiplayer path)');
        return false;
    }

    const sql = fs.readFileSync(schemaPath, 'utf8');
    await db.query(sql);
    console.log('[persistence] Schema applied.');
    postgresReady = true;
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
    resolveDatabaseUrl,
    resolveSchemaPath,
    getPool,
    pingPostgres,
    isPostgresConfigured,
    isPostgresReady,
    ensureSchema,
    listUnclaimedDrops,
    getDropById,
    tryAcquireClaimLease,
    releaseClaimLease,
    markDropClaimed,
};
