const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

describe('resolveDatabaseUrl', () => {
  const envKeys = [
    'DATABASE_URL',
    'POSTGRES_CONNECTION_STRING',
    'DATABASE_PRIVATE_URL',
    'DATABASE_PUBLIC_URL',
    'PGHOST',
    'PGUSER',
    'PGPASSWORD',
    'PGDATABASE',
    'PGPORT',
    'POSTGRES_HOST',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
    'POSTGRES_PORT',
  ];

  /** @type {NodeJS.ProcessEnv} */
  let saved;

  beforeEach(() => {
    saved = { ...process.env };
    for (const key of envKeys) {
      delete process.env[key];
    }
    delete require.cache[require.resolve('../persistence.js')];
  });

  afterEach(() => {
    process.env = saved;
    delete require.cache[require.resolve('../persistence.js')];
  });

  it('returns DATABASE_URL when set', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@db.internal:5432/helbreath';
    const { resolveDatabaseUrl } = require('../persistence.js');
    assert.equal(resolveDatabaseUrl(), 'postgresql://user:pass@db.internal:5432/helbreath');
  });

  it('builds URL from PG* components (Railway plugin style)', () => {
    process.env.PGHOST = 'postgres.railway.internal';
    process.env.PGUSER = 'postgres';
    process.env.PGPASSWORD = 's3cret';
    process.env.PGDATABASE = 'railway';
    process.env.PGPORT = '5432';
    const { resolveDatabaseUrl } = require('../persistence.js');
    assert.equal(
      resolveDatabaseUrl(),
      'postgresql://postgres:s3cret@postgres.railway.internal:5432/railway',
    );
  });

  it('returns null when nothing configured', () => {
    const { resolveDatabaseUrl } = require('../persistence.js');
    assert.equal(resolveDatabaseUrl(), null);
  });
});

describe('isPostgresConfigured', () => {
  /** @type {NodeJS.ProcessEnv} */
  let saved;

  beforeEach(() => {
    saved = { ...process.env };
    delete process.env.DATABASE_URL;
    delete require.cache[require.resolve('../persistence.js')];
  });

  afterEach(() => {
    process.env = saved;
    delete require.cache[require.resolve('../persistence.js')];
  });

  it('is false without env', () => {
    const { isPostgresConfigured } = require('../persistence.js');
    assert.equal(isPostgresConfigured(), false);
  });

  it('is true with DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    const { isPostgresConfigured } = require('../persistence.js');
    assert.equal(isPostgresConfigured(), true);
  });
});
