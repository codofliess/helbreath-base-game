/**
 * Devnet $HELL SPL mint + allocation vault ATAs (MASTERPLAN §1.7).
 *
 * Allocations (1B total, 9 decimals) — PO 2026-09-29, team vesting D13:
 *   play-mine 30% (300M, 500k/day) · bonding curve 30% (300M)
 *   graduation liquidity 10–20% (HELL_GRADUATION_LIQUIDITY_PCT, default 15)
 *   team 10% (100M): cuota 1 is 1% of supply (10M) unlocked at TGE,
 *     cuotas 2–5 are 22.5M each at TGE+3 / +6 / +9 / +12 months
 *   airdrops = rest
 *
 * Usage (from middleware-node/):
 *   npm install
 *   npm run init-hell-token
 *
 * Requires game authority (same as NFT mint) with SOL for fees.
 * Writes middleware-node/.hell-token.json and prints env lines to copy.
 *
 * The team bucket is two vaults (cuota 1 vs cuotas 2–5). That split is NOT an
 * on-chain timelock. This script does NOT implement on-chain vesting unlocks,
 * pump.fun, or stake yield.
 */
const fs = require('fs');
const path = require('path');
const bs58 = require('bs58').default ?? require('bs58');
const {
    Connection,
    Keypair,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
} = require('@solana/web3.js');
const {
    TOKEN_PROGRAM_ID,
    MINT_SIZE,
    createInitializeMint2Instruction,
    createAssociatedTokenAccountInstruction,
    createMintToInstruction,
    getAssociatedTokenAddressSync,
    getMinimumBalanceForRentExemptMint,
} = require('@solana/spl-token');
const { loadOrCreateGameAuthority } = require('../authority');

const DECIMALS = 9;
const TOTAL_SUPPLY = 1_000_000_000n;
const TEAM_VESTING_INSTALLMENTS = 5;
/** Months between team cuotas after the TGE slice. Cuota 1 is offset 0. */
const TEAM_VESTING_OFFSET_MONTHS = 3;
/** Percent of total supply that leaves the team bucket unlocked at TGE. */
const TEAM_TGE_UNLOCK_PCT = 1;
const ALLOCATIONS = buildAllocations(process.env.HELL_GRADUATION_LIQUIDITY_PCT);

/**
 * Five team cuotas. Cuota 1 is TEAM_TGE_UNLOCK_PCT of total supply at the TGE, with no lock.
 * Cuotas 2–5 split the rest of `teamTokens` in equal amounts, every TEAM_VESTING_OFFSET_MONTHS.
 */
function teamVestingSchedule(teamTokens, totalSupply = TOTAL_SUPPLY) {
    const team = typeof teamTokens === 'bigint' ? teamTokens : BigInt(teamTokens);
    const supply = typeof totalSupply === 'bigint' ? totalSupply : BigInt(totalSupply);
    const unlocked = (supply * BigInt(TEAM_TGE_UNLOCK_PCT)) / 100n;
    const laterCount = TEAM_VESTING_INSTALLMENTS - 1;
    const locked = team - unlocked;
    if (unlocked <= 0n || locked <= 0n || locked % BigInt(laterCount) !== 0n) {
        throw new Error(`Team vesting does not split: team ${team}, unlocked ${unlocked}, locked ${locked}`);
    }
    const eachLocked = locked / BigInt(laterCount);
    const schedule = [];
    for (let i = 0; i < TEAM_VESTING_INSTALLMENTS; i++) {
        const offsetMonths = i * TEAM_VESTING_OFFSET_MONTHS;
        schedule.push({
            cuota: i + 1,
            offsetMonths,
            tokens: i === 0 ? unlocked : eachLocked,
            atTge: offsetMonths === 0,
        });
    }
    return schedule;
}

function scheduleForJson(schedule) {
    return schedule.map((row) => ({
        cuota: row.cuota,
        offsetMonths: row.offsetMonths,
        tokens: Number(row.tokens),
        atTge: row.atTge,
    }));
}

function buildAllocations(liquidityPctRaw) {
    const liquidityPct = liquidityPctRaw === undefined || liquidityPctRaw === '' ? 15 : Number(liquidityPctRaw);
    if (!Number.isInteger(liquidityPct) || liquidityPct < 10 || liquidityPct > 20) {
        throw new Error(`HELL_GRADUATION_LIQUIDITY_PCT must be an integer 10..20 (got ${liquidityPctRaw})`);
    }
    const pct = (p) => (TOTAL_SUPPLY * BigInt(p)) / 100n;
    const mining = pct(30);
    const bondingCurve = pct(30);
    const liquidity = pct(liquidityPct);
    const teamBucket = pct(10);
    const teamSchedule = teamVestingSchedule(teamBucket);
    const teamTge = teamSchedule[0].tokens;
    const teamLocked = teamBucket - teamTge;
    const airdrops = TOTAL_SUPPLY - mining - bondingCurve - liquidity - teamBucket;
    return [
        { key: 'mining', label: 'Play-mine escrow (500k/day)', tokens: mining },
        { key: 'bondingCurve', label: 'Bonding curve', tokens: bondingCurve },
        { key: 'liquidity', label: 'Graduation liquidity (other DEX pools)', tokens: liquidity },
        { key: 'team', label: 'Team cuota 1 (TGE, sin lock)', tokens: teamTge },
        { key: 'teamVesting', label: 'Team vesting cuotas 2-5 (locked)', tokens: teamLocked },
        { key: 'airdrops', label: 'Airdrops', tokens: airdrops },
    ];
}

function tokensToRaw(tokens) {
    return tokens * 10n ** BigInt(DECIMALS);
}

function outPath() {
    return path.join(__dirname, '..', '.hell-token.json');
}

function encodeSecret(secretKey) {
    return bs58.encode(secretKey);
}

async function main() {
    const existingPath = outPath();
    if (fs.existsSync(existingPath) && process.env.HELL_FORCE_RECREATE !== '1') {
        const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
        console.log('Existing $HELL mint config found at .hell-token.json');
        console.log('Set HELL_FORCE_RECREATE=1 to mint a new one on devnet.\n');
        printEnv(existing);
        return;
    }

    const authority = loadOrCreateGameAuthority();
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    console.log('Creating $HELL SPL mint on Solana…');
    console.log('Authority:', authority.publicKey.toBase58());
    console.log('RPC:', rpcUrl);

    const sum = ALLOCATIONS.reduce((a, b) => a + b.tokens, 0n);
    if (sum !== TOTAL_SUPPLY) {
        throw new Error(`Allocation sum ${sum} !== total supply ${TOTAL_SUPPLY}`);
    }

    const mintKeypair = Keypair.generate();
    const lamports = await getMinimumBalanceForRentExemptMint(connection);

    const createMintIx = SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
    });
    const initMintIx = createInitializeMint2Instruction(
        mintKeypair.publicKey,
        DECIMALS,
        authority.publicKey,
        authority.publicKey,
        TOKEN_PROGRAM_ID,
    );

    const createTx = new Transaction().add(createMintIx, initMintIx);
    const createSig = await sendAndConfirmTransaction(connection, createTx, [authority, mintKeypair]);
    console.log('Mint created:', mintKeypair.publicKey.toBase58(), 'sig', createSig);

    const vaults = {};
    for (const alloc of ALLOCATIONS) {
        const vaultOwner = Keypair.generate();
        const vaultAta = getAssociatedTokenAddressSync(mintKeypair.publicKey, vaultOwner.publicKey, false);

        const setupTx = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: authority.publicKey,
                toPubkey: vaultOwner.publicKey,
                lamports: 5_000_000,
            }),
            createAssociatedTokenAccountInstruction(
                authority.publicKey,
                vaultAta,
                vaultOwner.publicKey,
                mintKeypair.publicKey,
            ),
            createMintToInstruction(
                mintKeypair.publicKey,
                vaultAta,
                authority.publicKey,
                tokensToRaw(alloc.tokens),
            ),
        );
        const sig = await sendAndConfirmTransaction(connection, setupTx, [authority]);
        vaults[alloc.key] = {
            label: alloc.label,
            tokens: Number(alloc.tokens),
            ownerPublicKey: vaultOwner.publicKey.toBase58(),
            ownerSecretKeyBase58: encodeSecret(vaultOwner.secretKey),
            tokenAccount: vaultAta.toBase58(),
            mintSig: sig,
        };
        console.log(`  ${alloc.label}: ${alloc.tokens} → ${vaultAta.toBase58()}`);
    }

    const result = {
        symbol: 'HELL',
        name: 'Helbreath Chain Lord',
        decimals: DECIMALS,
        totalSupply: Number(TOTAL_SUPPLY),
        mint: mintKeypair.publicKey.toBase58(),
        mintAuthority: authority.publicKey.toBase58(),
        freezeAuthority: authority.publicKey.toBase58(),
        rpcUrl,
        createdAt: new Date().toISOString(),
        note: 'Utility / play-mine token. Not an investment product. Stake does not mint (C1). Team cuota 1 is 1% of supply, unlocked at TGE. Cuotas 2-5 are a separate vault, not an on-chain timelock.',
        teamVestingSchedule: scheduleForJson(teamVestingSchedule(
            ALLOCATIONS.find((alloc) => alloc.key === 'team').tokens
            + ALLOCATIONS.find((alloc) => alloc.key === 'teamVesting').tokens,
        )),
        vaults,
    };

    fs.writeFileSync(existingPath, JSON.stringify(result, null, 2), 'utf8');
    console.log('\nSaved', existingPath);
    printEnv(result);
}

function vaultEnvKey(key) {
    return `HELL_${key.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}_TOKEN_ACCOUNT`;
}

function printEnv(result) {
    console.log('\nAdd to middleware-node/.env (and set HELL_MINT on the game server for claim UI):\n');
    console.log(`HELL_MINT=${result.mint}`);
    console.log(`HELL_DECIMALS=${result.decimals ?? DECIMALS}`);
    console.log('# HELL_MINING_VAULT_OWNER_SECRET: run `node scripts/sync-hell-env-from-token.js` (not printed)');
    for (const [key, vault] of Object.entries(result.vaults)) {
        console.log(`${vaultEnvKey(key)}=${vault.tokenAccount}`);
    }
    console.log('# Team cuota 1 (1% of supply, no lock) is HELL_TEAM_TOKEN_ACCOUNT; cuotas 2-5 sit in HELL_TEAM_VESTING_TOKEN_ACCOUNT. This split is NOT an on-chain timelock.');
    console.log('# Optional: shared ledger path for claim (same host as game server)');
    console.log('# HELL_MINING_LEDGER_PATH=../multiplayer/server/Chars/hell-mining.json');
    console.log(`SOLANA_RPC_URL=${result.rpcUrl}`);
}

if (require.main === module) {
    main().catch((error) => {
        console.error('init-hell-token failed:', error);
        process.exit(1);
    });
}

module.exports = {
    buildAllocations,
    teamVestingSchedule,
    scheduleForJson,
    vaultEnvKey,
    TOTAL_SUPPLY,
    TEAM_VESTING_OFFSET_MONTHS,
    TEAM_VESTING_INSTALLMENTS,
    TEAM_TGE_UNLOCK_PCT,
};
