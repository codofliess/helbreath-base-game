/**
 * Devnet $HELL SPL mint + allocation vault ATAs (MASTERPLAN §1.7).
 *
 * Allocations (1B total, 9 decimals):
 *   team 100M · liquidity 300M · DAO 100M · growth 100M · play-mine escrow 400M
 *
 * Usage (from middleware-node/):
 *   npm install
 *   npm run init-hell-token
 *
 * Requires game authority (same as NFT mint) with SOL for fees.
 * Writes middleware-node/.hell-token.json and prints env lines to copy.
 *
 * Does NOT implement vesting unlocks, pump.fun, or stake yield.
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
const ALLOCATIONS = [
    { key: 'team', label: 'Team', tokens: 100_000_000n },
    { key: 'liquidity', label: 'Liquidity / market', tokens: 300_000_000n },
    { key: 'dao', label: 'DAO / guilds', tokens: 100_000_000n },
    { key: 'growth', label: 'Growth & partnerships', tokens: 100_000_000n },
    { key: 'mining', label: 'Play-mine escrow', tokens: 400_000_000n },
];

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
        note: 'Utility / play-mine token. Not an investment product. Stake does not mint (C1).',
        vaults,
    };

    fs.writeFileSync(existingPath, JSON.stringify(result, null, 2), 'utf8');
    console.log('\nSaved', existingPath);
    printEnv(result);
}

function printEnv(result) {
    console.log('\nAdd to middleware-node/.env (and set HELL_MINT on the game server for claim UI):\n');
    console.log(`HELL_MINT=${result.mint}`);
    console.log(`HELL_DECIMALS=${result.decimals ?? DECIMALS}`);
    console.log(`HELL_MINING_VAULT_OWNER_SECRET=${result.vaults.mining.ownerSecretKeyBase58}`);
    console.log(`HELL_MINING_TOKEN_ACCOUNT=${result.vaults.mining.tokenAccount}`);
    console.log(`HELL_TEAM_TOKEN_ACCOUNT=${result.vaults.team.tokenAccount}`);
    console.log(`HELL_LIQUIDITY_TOKEN_ACCOUNT=${result.vaults.liquidity.tokenAccount}`);
    console.log(`HELL_DAO_TOKEN_ACCOUNT=${result.vaults.dao.tokenAccount}`);
    console.log(`HELL_GROWTH_TOKEN_ACCOUNT=${result.vaults.growth.tokenAccount}`);
    console.log('# Optional: shared ledger path for claim (same host as game server)');
    console.log('# HELL_MINING_LEDGER_PATH=../multiplayer/server/Chars/hell-mining.json');
    console.log(`SOLANA_RPC_URL=${result.rpcUrl}`);
}

main().catch((error) => {
    console.error('init-hell-token failed:', error);
    process.exit(1);
});
