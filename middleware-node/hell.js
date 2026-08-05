/**
 * $HELL play-mine claim helpers (SPL transfer from mining escrow vault).
 * Pending balances live in the game server ledger (Chars/hell-mining.json).
 * Stake does not mint (C1). Not an investment / ROI product.
 */
const fs = require('fs');
const path = require('path');
const bs58 = require('bs58').default ?? require('bs58');
const {
    Keypair,
    PublicKey,
    Transaction,
    sendAndConfirmTransaction,
} = require('@solana/web3.js');
const {
    createAssociatedTokenAccountInstruction,
    createTransferInstruction,
    getAccount,
    getAssociatedTokenAddressSync,
    TokenAccountNotFoundError,
} = require('@solana/spl-token');
const { verifyToken } = require('./auth');

const TOKEN_PATH = path.join(__dirname, '.hell-token.json');

function loadHellTokenConfig() {
    if (process.env.HELL_MINT) {
        return {
            mint: process.env.HELL_MINT,
            decimals: Number(process.env.HELL_DECIMALS || 9),
            miningTokenAccount: process.env.HELL_MINING_TOKEN_ACCOUNT || null,
            miningVaultOwnerSecret: process.env.HELL_MINING_VAULT_OWNER_SECRET || null,
        };
    }
    if (!fs.existsSync(TOKEN_PATH)) {
        return null;
    }
    try {
        const raw = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
        return {
            mint: raw.mint,
            decimals: raw.decimals ?? 9,
            miningTokenAccount: raw.vaults?.mining?.tokenAccount ?? null,
            miningVaultOwnerSecret: raw.vaults?.mining?.ownerSecretKeyBase58 ?? null,
        };
    } catch {
        return null;
    }
}

function ledgerPath() {
    if (process.env.HELL_MINING_LEDGER_PATH) {
        return path.resolve(process.env.HELL_MINING_LEDGER_PATH);
    }
    return path.resolve(__dirname, '../multiplayer/server/Chars/hell-mining.json');
}

function tokensToRaw(tokens, decimals) {
    return BigInt(tokens) * 10n ** BigInt(decimals);
}

function readLedger() {
    const p = ledgerPath();
    if (!fs.existsSync(p)) {
        return { path: p, file: { remainingPool: 400_000_000, wallets: {}, days: {} } };
    }
    return { path: p, file: JSON.parse(fs.readFileSync(p, 'utf8')) };
}

function writeLedger(filePath, file) {
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(file, null, 2), 'utf8');
    fs.copyFileSync(tmp, filePath);
    fs.unlinkSync(tmp);
}

function normalizeWallet(wallet) {
    return String(wallet || '').trim();
}

/**
 * Reserve pending from ledger and transfer SPL $HELL from mining vault → user ATA.
 * Requires wallet session token (same as drop claim).
 */
async function claimPendingHell({ connection, wallet, sessionToken, amount }) {
    const cfg = loadHellTokenConfig();
    if (!cfg?.mint || !cfg.miningVaultOwnerSecret || !cfg.miningTokenAccount) {
        return {
            ok: false,
            status: 503,
            error: 'HELL mint / mining vault not configured. Run npm run init-hell-token and set env vars.',
        };
    }
    if (!verifyToken(wallet, sessionToken)) {
        return { ok: false, status: 401, error: 'Invalid or expired wallet session.' };
    }

    const w = normalizeWallet(wallet);
    const { path: filePath, file } = readLedger();
    file.wallets = file.wallets || {};
    const rowKey = Object.keys(file.wallets).find((k) => k.toLowerCase() === w.toLowerCase()) || w;
    const row = file.wallets[rowKey] || { wallet: w, pendingHell: 0, claimedHell: 0 };
    const pending = Number(row.pendingHell || 0);
    const claimAmount = amount && amount > 0 ? Number(amount) : pending;
    if (!Number.isFinite(claimAmount) || claimAmount <= 0) {
        return { ok: false, status: 400, error: 'Nothing to claim.' };
    }
    if (claimAmount > pending) {
        return { ok: false, status: 400, error: 'Insufficient pending $HELL.' };
    }

    row.pendingHell = pending - claimAmount;
    row.claimedHell = Number(row.claimedHell || 0) + claimAmount;
    file.wallets[rowKey] = row;
    writeLedger(filePath, file);

    try {
        const mint = new PublicKey(cfg.mint);
        const user = new PublicKey(w);
        const vaultOwner = Keypair.fromSecretKey(bs58.decode(cfg.miningVaultOwnerSecret));
        const source = new PublicKey(cfg.miningTokenAccount);
        const dest = getAssociatedTokenAddressSync(mint, user, false);

        const tx = new Transaction();
        try {
            await getAccount(connection, dest);
        } catch (err) {
            if (err instanceof TokenAccountNotFoundError || /could not find account/i.test(String(err))) {
                tx.add(createAssociatedTokenAccountInstruction(vaultOwner.publicKey, dest, user, mint));
            } else {
                throw err;
            }
        }
        tx.add(createTransferInstruction(source, dest, vaultOwner.publicKey, tokensToRaw(claimAmount, cfg.decimals)));
        const signature = await sendAndConfirmTransaction(connection, tx, [vaultOwner]);

        return {
            ok: true,
            status: 200,
            mint: cfg.mint,
            amount: claimAmount,
            pendingHell: row.pendingHell,
            claimedHell: row.claimedHell,
            signature,
            note: 'Play-mine utility payout. Not a salary, APY, or investment return.',
        };
    } catch (error) {
        // Refund ledger if chain transfer failed.
        row.pendingHell = Number(row.pendingHell || 0) + claimAmount;
        row.claimedHell = Math.max(0, Number(row.claimedHell || 0) - claimAmount);
        file.wallets[rowKey] = row;
        writeLedger(filePath, file);
        return {
            ok: false,
            status: 500,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

function registerHellRoutes(app, connection) {
    app.get('/hell/status', (req, res) => {
        const cfg = loadHellTokenConfig();
        const wallet = normalizeWallet(req.query.wallet);
        let pending = null;
        let claimed = null;
        if (wallet) {
            const { file } = readLedger();
            const row = Object.values(file.wallets || {}).find(
                (r) => normalizeWallet(r.wallet).toLowerCase() === wallet.toLowerCase(),
            );
            pending = row ? Number(row.pendingHell || 0) : 0;
            claimed = row ? Number(row.claimedHell || 0) : 0;
        }
        res.json({
            ok: true,
            mint: cfg?.mint ?? null,
            decimals: cfg?.decimals ?? 9,
            miningConfigured: Boolean(cfg?.mint && cfg?.miningTokenAccount),
            ledgerPath: ledgerPath(),
            pendingHell: pending,
            claimedHell: claimed,
            note: 'Pending $HELL from play-mine. Redeemable when mint is live — utility mining, not ROI.',
        });
    });

    app.post('/hell/claim', async (req, res) => {
        const wallet = normalizeWallet(req.body?.wallet);
        const sessionToken = req.body?.sessionToken || req.headers['x-wallet-session'];
        const amount = req.body?.amount;
        const result = await claimPendingHell({ connection, wallet, sessionToken, amount });
        res.status(result.status || (result.ok ? 200 : 400)).json(result);
    });
}

module.exports = {
    loadHellTokenConfig,
    registerHellRoutes,
    claimPendingHell,
};
