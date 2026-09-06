const crypto = require('crypto');
const bs58 = require('bs58').default ?? require('bs58');
const nacl = require('tweetnacl');
const { secp256k1 } = require('@noble/curves/secp256k1.js');
const { keccak_256 } = require('@noble/hashes/sha3.js');
const { getPool, isPostgresConfigured } = require('./persistence');

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const BOT_ENROLL_WINDOW_MS = 10 * 60 * 1000;
const BOT_ENROLL_MAX_PER_WINDOW = 10;
const SUPPORTED_CHAINS = Object.freeze(['sol', 'rh', 'base']);

const DEV_FALLBACK_SECRET = 'helbreath-dev-auth-secret-change-me';

/** @type {Map<string, { chainId: string, address: string, addressKey: string, expiresAt: number }>} */
const challenges = new Map();
/** @type {Map<string, { playerId: string, actorKind: 'human' | 'bot' }>} */
const playersMem = new Map();
/** @type {Map<string, { chainId: string, address: string, addressKey: string, playerId: string }>} */
const bindingsMem = new Map();
/** @type {Map<string, number[]>} */
const botEnrollHits = new Map();

function isProductionEnv() {
    const nodeEnv = (process.env.NODE_ENV || process.env.ASPNETCORE_ENVIRONMENT || '').toLowerCase();
    return nodeEnv === 'production';
}

function isDevelopmentEnv() {
    const nodeEnv = (process.env.NODE_ENV || process.env.ASPNETCORE_ENVIRONMENT || '').toLowerCase();
    return nodeEnv === 'development';
}

function allowInsecureRequested() {
    return process.env.ALLOW_INSECURE_AUTH === '1' || process.env.ALLOW_INSECURE_AUTH === 'true';
}

function getAuthSecret() {
    const fromEnv = (process.env.WALLET_AUTH_SECRET || '').trim();
    if (fromEnv) {
        return fromEnv;
    }
    if (isProductionEnv()) {
        throw new Error(
            'WALLET_AUTH_SECRET is required in production (fail-closed). ALLOW_INSECURE_AUTH is forbidden in production.'
        );
    }
    if (isDevelopmentEnv() || allowInsecureRequested()) {
        if (!getAuthSecret._warned) {
            console.warn(
                '[auth] WARNING: WALLET_AUTH_SECRET unset — using insecure dev default. Do not expose this host publicly.'
            );
            getAuthSecret._warned = true;
        }
        return DEV_FALLBACK_SECRET;
    }
    throw new Error(
        'WALLET_AUTH_SECRET is required (set a strong secret shared with the game server). ' +
            'For local-only: NODE_ENV=development or ALLOW_INSECURE_AUTH=1 (never in production).'
    );
}

function hmacPayload(payload) {
    return crypto.createHmac('sha256', getAuthSecret()).update(payload).digest('base64url');
}

function timingSafeEqualStr(a, b) {
    try {
        const ba = Buffer.from(String(a || ''));
        const bb = Buffer.from(String(b || ''));
        if (ba.length !== bb.length) {
            return false;
        }
        return crypto.timingSafeEqual(ba, bb);
    } catch {
        return false;
    }
}

function pruneChallenges() {
    const now = Date.now();
    for (const [key, entry] of challenges) {
        if (entry.expiresAt <= now) {
            challenges.delete(key);
        }
    }
}

function normalizeChainId(raw, { defaultSol = false } = {}) {
    const c = String(raw || '').trim().toLowerCase();
    if (!c && defaultSol) {
        return 'sol';
    }
    if (SUPPORTED_CHAINS.includes(c)) {
        return c;
    }
    return null;
}

function isEvmChain(chainId) {
    return chainId === 'rh' || chainId === 'base';
}

function keccakUtf8(text) {
    return keccak_256(new TextEncoder().encode(text));
}

/** EIP-55 checksum. Compare via addressKey (lowercase hex), store/emit checksum. */
function toChecksumAddress(address) {
    const hex = String(address || '').trim().replace(/^0x/i, '').toLowerCase();
    if (!/^[0-9a-f]{40}$/.test(hex)) {
        return null;
    }
    const hash = Buffer.from(keccakUtf8(hex)).toString('hex');
    let out = '0x';
    for (let i = 0; i < hex.length; i += 1) {
        out += parseInt(hash[i], 16) >= 8 ? hex[i].toUpperCase() : hex[i];
    }
    return out;
}

function canonicalizeAddress(chainId, address) {
    const raw = String(address || '').trim();
    if (!raw) {
        return null;
    }
    if (chainId === 'sol') {
        try {
            const bytes = bs58.decode(raw);
            if (bytes.length !== 32) {
                return null;
            }
            return { address: raw, addressKey: raw };
        } catch {
            return null;
        }
    }
    if (isEvmChain(chainId)) {
        const checksum = toChecksumAddress(raw);
        if (!checksum) {
            return null;
        }
        return { address: checksum, addressKey: checksum.toLowerCase() };
    }
    return null;
}

function bindingMapKey(chainId, addressKey) {
    return `${chainId}:${addressKey}`;
}

/**
 * Exact UTF-8 the wallet must sign. MUST include chainId, challengeId, and expiry (anti-replay).
 */
function buildChallengeMessage({ chainId, challengeId, address, expiresAt }) {
    return [
        'Helbreath ChainLords login',
        `chainId=${chainId}`,
        `challengeId=${challengeId}`,
        `address=${address}`,
        `expiresAt=${expiresAt}`,
    ].join('\n');
}

function challengeMessageHasRequiredFields(message) {
    const text = String(message || '');
    return (
        /(^|\n)chainId=\S+/.test(text) &&
        /(^|\n)challengeId=\S+/.test(text) &&
        /(^|\n)expiresAt=\d+/.test(text)
    );
}

/** Bytes Phantom / Solana wallets sign via signMessage (wallet-standard envelope). */
function buildSolanaSignMessagePayload(messageBytes) {
    const prefix = new TextEncoder().encode('Solana Signed Message:\n');
    const lengthBytes = new Uint8Array(2);
    lengthBytes[0] = messageBytes.length & 0xff;
    lengthBytes[1] = (messageBytes.length >> 8) & 0xff;

    const payload = new Uint8Array(1 + prefix.length + 2 + messageBytes.length);
    payload[0] = 0xff;
    payload.set(prefix, 1);
    payload.set(lengthBytes, 1 + prefix.length);
    payload.set(messageBytes, 1 + prefix.length + 2);
    return payload;
}

function decodeSignature(signatureEncoded) {
    const encoded = String(signatureEncoded || '').trim();
    if (!encoded) {
        return null;
    }

    const fromBase64 = Buffer.from(encoded, 'base64');
    if (fromBase64.length === 64) {
        return fromBase64;
    }

    try {
        const fromBase58 = Buffer.from(bs58.decode(encoded));
        if (fromBase58.length === 64) {
            return fromBase58;
        }
    } catch {
        // fall through
    }

    return null;
}

function verifySolSignature(address, message, signatureEncoded) {
    try {
        const messageBytes = new TextEncoder().encode(message);
        const signature = decodeSignature(signatureEncoded);
        if (!signature) {
            return false;
        }
        const publicKey = bs58.decode(address);
        const signedPayload = buildSolanaSignMessagePayload(messageBytes);
        return (
            nacl.sign.detached.verify(messageBytes, signature, publicKey) ||
            nacl.sign.detached.verify(signedPayload, signature, publicKey)
        );
    } catch {
        return false;
    }
}

function hashPersonalMessage(message) {
    const body = Buffer.from(String(message), 'utf8');
    const prefix = Buffer.from(`\x19Ethereum Signed Message:\n${body.length}`, 'utf8');
    return keccak_256(Buffer.concat([prefix, body]));
}

function decodeEvmSignature(signatureEncoded) {
    let hex = String(signatureEncoded || '').trim();
    if (hex.startsWith('0x') || hex.startsWith('0X')) {
        hex = hex.slice(2);
    }
    if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length !== 130) {
        const buf = Buffer.from(String(signatureEncoded || ''), 'base64');
        if (buf.length === 65) {
            return buf;
        }
        return null;
    }
    return Buffer.from(hex, 'hex');
}

/** Convert personal_sign r||s||v (v=27/28 or 0/1) to noble recovered recovery||r||s. */
function toNobleRecoveredSignature(sig65) {
    if (!sig65 || sig65.length !== 65) {
        return null;
    }
    const last = sig65[64];
    const first = sig65[0];
    const ethV = last === 27 || last === 28 || last === 0 || last === 1;
    if (ethV) {
        const recId = last >= 27 ? last - 27 : last;
        return Buffer.concat([Buffer.from([recId]), sig65.subarray(0, 64)]);
    }
    if (first === 0 || first === 1) {
        return Buffer.from(sig65);
    }
    return null;
}

function recoverEvmAddress(message, signatureEncoded) {
    try {
        const sig65 = decodeEvmSignature(signatureEncoded);
        const recovered = toNobleRecoveredSignature(sig65);
        if (!recovered) {
            return null;
        }
        const msgHash = hashPersonalMessage(message);
        const pub = secp256k1.recoverPublicKey(recovered, msgHash, { prehash: false });
        const uncompressed = secp256k1.Point.fromBytes(pub).toBytes(false);
        const addrBytes = keccak_256(uncompressed.slice(1)).slice(-20);
        return toChecksumAddress(`0x${Buffer.from(addrBytes).toString('hex')}`);
    } catch {
        return null;
    }
}

/** EIP-191 personal_sign recover — same path for `rh` and `base` (no RPC). */
function verifyEvmSignature(address, message, signatureEncoded) {
    const recovered = recoverEvmAddress(message, signatureEncoded);
    if (!recovered) {
        return false;
    }
    return recovered.toLowerCase() === String(address).toLowerCase();
}

function verifyRhSignature(address, message, signatureEncoded) {
    return verifyEvmSignature(address, message, signatureEncoded);
}

function verifyWalletSignature(chainId, address, message, signatureEncoded) {
    if (!challengeMessageHasRequiredFields(message)) {
        return false;
    }
    if (chainId === 'sol') {
        return verifySolSignature(address, message, signatureEncoded);
    }
    if (isEvmChain(chainId)) {
        return verifyEvmSignature(address, message, signatureEncoded);
    }
    return false;
}

function signSession(claims) {
    const payloadObj = {
        v: 2,
        playerId: claims.playerId,
        actorKind: claims.actorKind,
        boundChains: claims.boundChains || [],
        wallets: claims.wallets || [],
        exp: claims.expiresAtMs,
    };
    const payload = JSON.stringify(payloadObj);
    const sig = hmacPayload(payload);
    return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

function parseSession(token) {
    if (!token || typeof token !== 'string') {
        return null;
    }
    const parts = token.split('.');
    if (parts.length !== 2) {
        return null;
    }
    let payload;
    try {
        payload = Buffer.from(parts[0], 'base64url').toString('utf8');
    } catch {
        return null;
    }
    let expectedSig;
    try {
        expectedSig = hmacPayload(payload);
    } catch {
        return null;
    }
    if (!timingSafeEqualStr(parts[1], expectedSig)) {
        return null;
    }

    if (payload.startsWith('{')) {
        try {
            const obj = JSON.parse(payload);
            const exp = Number(obj.exp);
            if (obj.v !== 2 || !obj.playerId || !Number.isFinite(exp) || exp <= Date.now()) {
                return null;
            }
            const actorKind = obj.actorKind === 'bot' ? 'bot' : 'human';
            const wallets = Array.isArray(obj.wallets) ? obj.wallets : [];
            const boundChains = Array.isArray(obj.boundChains)
                ? obj.boundChains
                : [...new Set(wallets.map((w) => w.chainId))];
            return {
                v: 2,
                playerId: String(obj.playerId),
                actorKind,
                boundChains,
                wallets,
                exp,
            };
        } catch {
            return null;
        }
    }

    const [tokenWallet, expStr] = payload.split(':');
    const exp = Number.parseInt(expStr, 10);
    if (!tokenWallet || !Number.isFinite(exp) || exp <= Date.now()) {
        return null;
    }
    return {
        v: 1,
        playerId: null,
        actorKind: 'human',
        boundChains: ['sol'],
        wallets: [{ chainId: 'sol', address: tokenWallet }],
        wallet: tokenWallet,
        exp,
    };
}

function sessionIncludesWallet(session, wallet) {
    if (!session || !wallet) {
        return false;
    }
    const want = String(wallet).trim();
    if (session.v === 1) {
        return session.wallet === want;
    }
    return (session.wallets || []).some((w) => {
        const addr = String(w.address || '');
        return addr === want || addr.toLowerCase() === want.toLowerCase();
    });
}

function verifyToken(wallet, token) {
    const session = parseSession(token);
    if (!session) {
        return false;
    }
    return sessionIncludesWallet(session, wallet);
}

function isWalletAuthRequired() {
    return Boolean(process.env.WALLET_AUTH_SECRET?.trim());
}

function failClosedMisconfigPayload() {
    return {
        success: false,
        error: 'Server misconfiguration: WALLET_AUTH_SECRET required (ALLOW_INSECURE_AUTH forbidden in production)',
    };
}

function authSecretOr503(res) {
    try {
        getAuthSecret();
        return true;
    } catch (err) {
        res.status(503).json({ success: false, error: err.message });
        return false;
    }
}

/** Express middleware: require a valid token for the requested wallet (fail-closed when secret required). */
function requireWalletToken(req, res, next) {
    const wallet = String(req.query.wallet || req.body?.wallet || req.headers['x-wallet'] || '').trim();
    const token = String(
        req.headers['x-wallet-token'] || req.headers['x-auth-token'] || req.body?.token || ''
    ).trim();

    if (!isWalletAuthRequired()) {
        if (isProductionEnv() || (!isDevelopmentEnv() && !allowInsecureRequested())) {
            res.status(503).json(failClosedMisconfigPayload());
            return;
        }
        if (wallet) {
            req.wallet = wallet;
        }
        next();
        return;
    }

    const session = parseSession(token);
    if (!session || (wallet && !sessionIncludesWallet(session, wallet))) {
        res.status(401).json({ success: false, error: 'Wallet auth token required or invalid' });
        return;
    }

    req.wallet = wallet || session.wallets?.[0]?.address || session.wallet;
    req.playerId = session.playerId;
    req.actorKind = session.actorKind;
    req.boundChains = session.boundChains;
    req.authSession = session;
    next();
}

function listBindingsForPlayerSync(playerId) {
    const out = [];
    for (const row of bindingsMem.values()) {
        if (row.playerId === playerId) {
            out.push({ chainId: row.chainId, address: row.address });
        }
    }
    return out;
}

function assertPersistentSotForProduction() {
    if (isProductionEnv() && !isPostgresConfigured()) {
        const err = new Error(
            'DATABASE_URL is required in production (player/wallet SoT). In-memory bindings are local-dev only.'
        );
        err.code = 'SOT_MEM_FORBIDDEN';
        throw err;
    }
}

async function pgAvailable() {
    assertPersistentSotForProduction();
    return isPostgresConfigured() && Boolean(getPool());
}

async function pgGetPlayer(playerId) {
    const db = getPool();
    if (!db) {
        return null;
    }
    const result = await db.query('SELECT id, actor_kind FROM players WHERE id = $1 LIMIT 1', [playerId]);
    const row = result.rows[0];
    if (!row) {
        return null;
    }
    return { playerId: row.id, actorKind: row.actor_kind === 'bot' ? 'bot' : 'human' };
}

async function pgGetByWallet(chainId, addressKey) {
    const db = getPool();
    if (!db) {
        return null;
    }
    const result = await db.query(
        `SELECT p.id, p.actor_kind, b.chain_id, b.address
         FROM wallet_bindings b
         JOIN players p ON p.id = b.player_id
         WHERE b.chain_id = $1 AND b.address_key = $2
         LIMIT 1`,
        [chainId, addressKey]
    );
    const row = result.rows[0];
    if (!row) {
        return null;
    }
    return {
        playerId: row.id,
        actorKind: row.actor_kind === 'bot' ? 'bot' : 'human',
        chainId: row.chain_id,
        address: row.address,
    };
}

async function pgListBindings(playerId) {
    const db = getPool();
    if (!db) {
        return [];
    }
    const result = await db.query(
        'SELECT chain_id, address FROM wallet_bindings WHERE player_id = $1 ORDER BY bound_at ASC',
        [playerId]
    );
    return result.rows.map((r) => ({ chainId: r.chain_id, address: r.address }));
}

async function getPlayer(playerId) {
    if (await pgAvailable()) {
        const row = await pgGetPlayer(playerId);
        if (row) {
            playersMem.set(row.playerId, row);
        }
        return row;
    }
    return playersMem.get(playerId) || null;
}

async function getByWallet(chainId, addressKey) {
    if (await pgAvailable()) {
        const row = await pgGetByWallet(chainId, addressKey);
        if (row) {
            playersMem.set(row.playerId, { playerId: row.playerId, actorKind: row.actorKind });
            bindingsMem.set(bindingMapKey(chainId, addressKey), {
                chainId,
                address: row.address,
                addressKey,
                playerId: row.playerId,
            });
        }
        return row;
    }
    const bind = bindingsMem.get(bindingMapKey(chainId, addressKey));
    if (!bind) {
        return null;
    }
    const player = playersMem.get(bind.playerId);
    if (!player) {
        return null;
    }
    return { ...player, chainId: bind.chainId, address: bind.address };
}

async function listBindings(playerId) {
    if (await pgAvailable()) {
        return pgListBindings(playerId);
    }
    return listBindingsForPlayerSync(playerId);
}

async function registerPlayer(actorKind) {
    const kind = actorKind === 'bot' ? 'bot' : 'human';
    if (await pgAvailable()) {
        const db = getPool();
        const result = await db.query(
            `INSERT INTO players (actor_kind) VALUES ($1) RETURNING id, actor_kind`,
            [kind]
        );
        const row = result.rows[0];
        const player = { playerId: row.id, actorKind: row.actor_kind === 'bot' ? 'bot' : 'human' };
        playersMem.set(player.playerId, player);
        return player;
    }
    const player = { playerId: crypto.randomUUID(), actorKind: kind };
    playersMem.set(player.playerId, player);
    return player;
}

/**
 * Bind address to playerId or reject. UNIQUE (chainId, addressKey); no steal.
 */
async function bindOrReject(playerId, chainId, address, addressKey) {
    const key = bindingMapKey(chainId, addressKey);

    if (await pgAvailable()) {
        const db = getPool();
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            const existing = await client.query(
                `SELECT player_id, address FROM wallet_bindings
                 WHERE chain_id = $1 AND address_key = $2
                 FOR UPDATE`,
                [chainId, addressKey]
            );
            if (existing.rows[0]) {
                const owner = existing.rows[0].player_id;
                if (owner !== playerId) {
                    await client.query('ROLLBACK');
                    return { ok: false, status: 409, error: 'Wallet already bound to another player' };
                }
                await client.query('COMMIT');
                return { ok: true, chainId, address: existing.rows[0].address, playerId };
            }
            await client.query(
                `INSERT INTO wallet_bindings (chain_id, address, address_key, player_id)
                 VALUES ($1, $2, $3, $4)`,
                [chainId, address, addressKey, playerId]
            );
            await client.query('COMMIT');
            bindingsMem.set(key, { chainId, address, addressKey, playerId });
            return { ok: true, chainId, address, playerId };
        } catch (err) {
            try {
                await client.query('ROLLBACK');
            } catch {
                // ignore
            }
            if (err && err.code === '23505') {
                return { ok: false, status: 409, error: 'Wallet already bound to another player' };
            }
            throw err;
        } finally {
            client.release();
        }
    }

    const existing = bindingsMem.get(key);
    if (existing) {
        if (existing.playerId !== playerId) {
            return { ok: false, status: 409, error: 'Wallet already bound to another player' };
        }
        return { ok: true, chainId, address: existing.address, playerId };
    }
    bindingsMem.set(key, { chainId, address, addressKey, playerId });
    return { ok: true, chainId, address, playerId };
}

function readSessionFromRequest(req) {
    const token = String(
        req.headers['x-wallet-token'] || req.headers['x-auth-token'] || req.body?.token || ''
    ).trim();
    if (!token) {
        return null;
    }
    return parseSession(token);
}

function clientIp(req) {
    return String(req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
        .split(',')[0]
        .trim();
}

function botEnrollRateLimited(ip) {
    const now = Date.now();
    const hits = (botEnrollHits.get(ip) || []).filter((t) => now - t < BOT_ENROLL_WINDOW_MS);
    if (hits.length >= BOT_ENROLL_MAX_PER_WINDOW) {
        botEnrollHits.set(ip, hits);
        return true;
    }
    hits.push(now);
    botEnrollHits.set(ip, hits);
    return false;
}

function botEnrollSecretOk(provided) {
    const expected = (process.env.BOT_ENROLL_SECRET || process.env.ADMIN_SECRET || '').trim();
    if (!expected) {
        return false;
    }
    return timingSafeEqualStr(provided, expected);
}

function issueChallenge({ chainId, address, addressKey }) {
    pruneChallenges();
    const challengeId = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + CHALLENGE_TTL_MS;
    const message = buildChallengeMessage({ chainId, challengeId, address, expiresAt });
    challenges.set(challengeId, { chainId, address, addressKey, expiresAt });
    return { challengeId, chainId, address, expiresAt, message };
}

async function issueSessionResponse(playerId) {
    const player = await getPlayer(playerId);
    if (!player) {
        return null;
    }
    const wallets = await listBindings(playerId);
    const boundChains = [...new Set(wallets.map((w) => w.chainId))];
    const tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
    const token = signSession({
        playerId: player.playerId,
        actorKind: player.actorKind,
        boundChains,
        wallets,
        expiresAtMs: tokenExpiresAt,
    });
    const primary = wallets[0]?.address || null;
    return {
        success: true,
        playerId: player.playerId,
        actorKind: player.actorKind,
        boundChains,
        wallets,
        wallet: primary,
        token,
        expiresAt: tokenExpiresAt,
    };
}

function registerAuthRoutes(app) {
    const handleChallenge = (req, res) => {
        const chainId = normalizeChainId(req.query.chainId || req.body?.chainId, { defaultSol: true });
        if (!chainId) {
            res.status(400).json({ success: false, error: 'chainId must be sol, rh, or base' });
            return;
        }
        const addressRaw = String(
            req.query.address || req.body?.address || req.query.wallet || req.body?.wallet || ''
        ).trim();
        const canonical = canonicalizeAddress(chainId, addressRaw);
        if (!canonical) {
            res.status(400).json({
                success: false,
                error: chainId === 'sol' ? 'wallet/address query param required' : 'valid EVM address required',
            });
            return;
        }

        const issued = issueChallenge({
            chainId,
            address: canonical.address,
            addressKey: canonical.addressKey,
        });
        res.json({
            success: true,
            challenge: issued.challengeId,
            challengeId: issued.challengeId,
            chainId: issued.chainId,
            address: issued.address,
            expiresAt: issued.expiresAt,
            message: issued.message,
        });
    };

    app.get('/auth/challenge', handleChallenge);
    app.post('/auth/challenge', handleChallenge);

    app.post('/auth/verify', async (req, res) => {
        if (!authSecretOr503(res)) {
            return;
        }
        const body = req.body || {};
        const chainId = normalizeChainId(body.chainId, { defaultSol: true });
        if (!chainId) {
            res.status(400).json({ success: false, error: 'chainId must be sol, rh, or base' });
            return;
        }

        const addressRaw = String(body.address || body.wallet || '').trim();
        const challengeId = String(body.challengeId || body.challenge || '').trim();
        const signature = body.signature;
        if (!addressRaw || !challengeId || !signature) {
            res.status(400).json({
                success: false,
                error: 'wallet/address, challenge/challengeId, and signature required',
            });
            return;
        }

        if (body.actorKind != null && String(body.actorKind).trim() !== '') {
            res.status(403).json({
                success: false,
                error: 'actorKind cannot be set from signature or verify body; public register is human',
            });
            return;
        }

        const canonical = canonicalizeAddress(chainId, addressRaw);
        if (!canonical) {
            res.status(400).json({ success: false, error: 'Invalid address for chain' });
            return;
        }

        const entry = challenges.get(challengeId);
        if (
            !entry ||
            entry.expiresAt <= Date.now() ||
            entry.chainId !== chainId ||
            entry.addressKey !== canonical.addressKey
        ) {
            res.status(401).json({ success: false, error: 'Invalid or expired challenge' });
            return;
        }

        const message = buildChallengeMessage({
            chainId: entry.chainId,
            challengeId,
            address: entry.address,
            expiresAt: entry.expiresAt,
        });
        if (!verifyWalletSignature(chainId, canonical.address, message, signature)) {
            res.status(401).json({ success: false, error: 'Signature verification failed' });
            return;
        }

        challenges.delete(challengeId);

        try {
            const existing = await getByWallet(chainId, canonical.addressKey);
            const currentSession = readSessionFromRequest(req);

            let playerId;
            if (existing) {
                if (currentSession?.playerId && currentSession.playerId !== existing.playerId) {
                    res.status(409).json({
                        success: false,
                        error: 'Wallet already bound to another player',
                    });
                    return;
                }
                playerId = existing.playerId;
            } else if (currentSession?.playerId) {
                const bind = await bindOrReject(
                    currentSession.playerId,
                    chainId,
                    canonical.address,
                    canonical.addressKey
                );
                if (!bind.ok) {
                    res.status(bind.status).json({ success: false, error: bind.error });
                    return;
                }
                playerId = currentSession.playerId;
            } else {
                const created = await registerPlayer('human');
                const bind = await bindOrReject(
                    created.playerId,
                    chainId,
                    canonical.address,
                    canonical.addressKey
                );
                if (!bind.ok) {
                    res.status(bind.status).json({ success: false, error: bind.error });
                    return;
                }
                playerId = created.playerId;
            }

            const session = await issueSessionResponse(playerId);
            res.json(session);
        } catch (err) {
            if (err && err.code === 'SOT_MEM_FORBIDDEN') {
                res.status(503).json({ success: false, error: err.message });
                return;
            }
            console.error('[auth] verify failed:', err.message);
            res.status(500).json({ success: false, error: 'Auth verify failed' });
        }
    });

    app.post('/auth/enroll-bot', async (req, res) => {
        if (!authSecretOr503(res)) {
            return;
        }
        const provided = String(
            req.headers['x-bot-enroll-secret'] || req.body?.secret || req.body?.botEnrollSecret || ''
        ).trim();
        if (!botEnrollSecretOk(provided)) {
            res.status(403).json({
                success: false,
                error: 'Bot enrollment denied (requires BOT_ENROLL_SECRET or ADMIN_SECRET)',
            });
            return;
        }
        const ip = clientIp(req);
        if (botEnrollRateLimited(ip)) {
            res.status(429).json({ success: false, error: 'Bot enrollment rate limited' });
            return;
        }
        try {
            const player = await registerPlayer('bot');
            const session = await issueSessionResponse(player.playerId);
            res.json(session);
        } catch (err) {
            if (err && err.code === 'SOT_MEM_FORBIDDEN') {
                res.status(503).json({ success: false, error: err.message });
                return;
            }
            console.error('[auth] enroll-bot failed:', err.message);
            res.status(500).json({ success: false, error: 'Bot enrollment failed' });
        }
    });

    app.post('/auth/validate', (req, res) => {
        if (!authSecretOr503(res)) {
            return;
        }
        const { wallet, token } = req.body || {};
        const session = parseSession(token);
        const ok = Boolean(session && (!wallet || sessionIncludesWallet(session, wallet)));
        res.json({
            success: ok,
            playerId: ok ? session.playerId : undefined,
            actorKind: ok ? session.actorKind : undefined,
            boundChains: ok ? session.boundChains : undefined,
        });
    });
}

function resetAuthStateForTests() {
    challenges.clear();
    playersMem.clear();
    bindingsMem.clear();
    botEnrollHits.clear();
    getAuthSecret._warned = false;
}

module.exports = {
    registerAuthRoutes,
    verifyToken,
    parseSession,
    signSession,
    isWalletAuthRequired,
    requireWalletToken,
    getAuthSecret,
    buildChallengeMessage,
    challengeMessageHasRequiredFields,
    canonicalizeAddress,
    verifySolSignature,
    verifyRhSignature,
    verifyEvmSignature,
    recoverEvmAddress,
    hashPersonalMessage,
    bindOrReject,
    registerPlayer,
    getByWallet,
    listBindings,
    resetAuthStateForTests,
    SUPPORTED_CHAINS,
};
