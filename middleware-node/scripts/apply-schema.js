#!/usr/bin/env node
/**
 * Apply Persistence/schema.sql when DATABASE_URL is configured.
 * Railway Root Directory is middleware-node (packaged copy); local also tries the C# schema path.
 * Safe to run on every deploy (idempotent CREATE IF NOT EXISTS).
 */
const { ensureSchema, getPool, resolveDatabaseUrl } = require('../persistence');

async function main() {
  const url = resolveDatabaseUrl();
  if (!url) {
    console.log('[apply-schema] DATABASE_URL not set — skipping (middleware runs without Postgres).');
    process.exit(0);
  }

  const pool = getPool();
  if (!pool) {
    console.error('[apply-schema] Failed to create pool.');
    process.exit(1);
  }

  try {
    await pool.query('SELECT 1');
    const ok = await ensureSchema();
    if (!ok) {
      console.error('[apply-schema] Schema apply returned false.');
      process.exit(1);
    }
    console.log('[apply-schema] OK');
    process.exit(0);
  } catch (error) {
    console.error('[apply-schema] Failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

void main();
