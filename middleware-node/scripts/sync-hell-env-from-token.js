/**
 * Copy public + claim env from .hell-token.json into middleware-node/.env.
 * Does not print secrets. .env is gitignored.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const tokenPath = path.join(root, '.hell-token.json');
const envPath = path.join(root, '.env');

if (!fs.existsSync(tokenPath)) {
    console.error('Missing .hell-token.json — run npm run init-hell-token first');
    process.exit(1);
}

const j = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

function upsert(envText, key, value) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(envText)) {
        return envText.replace(re, line);
    }
    return envText.trimEnd() + (envText.endsWith('\n') || envText.length === 0 ? '' : '\n') + line + '\n';
}

let env = existing;
if (!env.includes('DATABASE_URL=')) {
    env += (env && !env.endsWith('\n') ? '\n' : '') +
        'DATABASE_URL=postgresql://helbreath:helbreath@localhost:5432/helbreath\n';
}
if (!env.includes('HELBREATH_MINT_MODE=')) {
    env += 'HELBREATH_MINT_MODE=onchain\n';
}
if (!env.includes('PORT=')) {
    env += 'PORT=3001\n';
}

// Vault set differs between mints (pre-2026-09-29: team/liquidity/dao/growth/mining;
// now: mining/bondingCurve/liquidity/team/airdrops).
const vaultKey = (key) => `HELL_${key.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}_TOKEN_ACCOUNT`;
const vaultPairs = Object.fromEntries(
    Object.entries(j.vaults || {}).map(([key, vault]) => [vaultKey(key), vault.tokenAccount]),
);

const pairs = {
    SOLANA_RPC_URL: j.rpcUrl || 'https://api.devnet.solana.com',
    HELL_MINT: j.mint,
    HELL_DECIMALS: String(j.decimals ?? 9),
    HELL_MINING_VAULT_OWNER_SECRET: j.vaults.mining.ownerSecretKeyBase58,
    ...vaultPairs,
    HELL_MINING_LEDGER_PATH: '../multiplayer/server/Chars/hell-mining.json',
};

for (const [k, v] of Object.entries(pairs)) {
    env = upsert(env, k, v);
}

fs.writeFileSync(envPath, env.endsWith('\n') ? env : env + '\n', 'utf8');

console.log('Wrote middleware-node/.env (secrets not printed)');
console.log('HELL_MINT=' + j.mint);
console.log('HELL_DECIMALS=' + (j.decimals ?? 9));
console.log('mintAuthority=' + j.mintAuthority);
for (const [k, v] of Object.entries(vaultPairs)) {
    console.log(`${k}=${v}`);
}
console.log('Also set HELL_MINT on the C# game server process for SysMenu claimAvailable.');
