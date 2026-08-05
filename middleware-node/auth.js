const crypto = require('crypto');
const bs58 = require('bs58').default ?? require('bs58');
const nacl = require('tweetnacl');

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const challenges = new Map();

const DEV_FALLBACK_SECRET = 'helbreath-dev-auth-secret-change-me';

function getAuthSecret() {
    const fromEnv = (process.env.WALLET_AUTH_SECRET || '').trim();
    if (fromEnv) {
        return fromEnv;
    }
    // Fail closed outside Development — never mint/verify tokens with a public default in prod.
    const nodeEnv = (process.env.NODE_ENV || process.env.ASPNETCORE_ENVIRONMENT || '').toLowerCase();
    const allowInsecure = process.env.ALLOW_INSECURE_AUTH === '1' || process.env.ALLOW_INSECURE_AUTH === 'true';
    if (nodeEnv === 'production' || (nodeEnv !== 'development' && !allowInsecure)) {
        throw new Error(
            'WALLET_AUTH_SECRET is required (set a strong secret shared with the game server). ' +
            'For local-only: NODE_ENV=development or ALLOW_INSECURE_AUTH=1.'
        );
    }
    if (!getAuthSecret._warned) {
        console.warn(
            '[auth] WARNING: WALLET_AUTH_SECRET unset — using insecure dev default. Do not expose this host publicly.'
        );
        getAuthSecret._warned = true;
    }
    return DEV_FALLBACK_SECRET;
}

function pruneChallenges() {
    const now = Date.now();
    for (const [key, entry] of challenges) {
        if (entry.expiresAt <= now) {
            challenges.delete(key);
        }
    }
}

function signToken(wallet, expiresAtMs) {
    const payload = `${wallet}:${expiresAtMs}`;
    const sig = crypto.createHmac('sha256', getAuthSecret()).update(payload).digest('base64url');
    return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

function verifyToken(wallet, token) {
    if (!token || typeof token !== 'string') {
        return false;
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
        return false;
    }

    const payload = Buffer.from(parts[0], 'base64url').toString('utf8');
    const expectedSig = crypto.createHmac('sha256', getAuthSecret()).update(payload).digest('base64url');
    // Constant-time compare when lengths match.
    try {
        const a = Buffer.from(parts[1]);
        const b = Buffer.from(expectedSig);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            return false;
        }
    } catch {
        return false;
    }

    const [tokenWallet, expStr] = payload.split(':');
    if (tokenWallet !== wallet) {
        return false;
    }

    const exp = Number.parseInt(expStr, 10);
    return Number.isFinite(exp) && exp > Date.now();
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

function verifyWalletSignature(wallet, challenge, signatureEncoded) {
    try {
        const message = new TextEncoder().encode(`Helbreath login: ${challenge}`);
        const signature = decodeSignature(signatureEncoded);
        if (!signature) {
            return false;
        }

        const publicKey = bs58.decode(wallet);
        const signedPayload = buildSolanaSignMessagePayload(message);

        // Phantom classic signMessage signs the raw UTF-8 bytes; wallet-standard wraps them.
        return nacl.sign.detached.verify(message, signature, publicKey)
            || nacl.sign.detached.verify(signedPayload, signature, publicKey);
    } catch {
        return false;
    }
}

function isWalletAuthRequired() {
    return Boolean(process.env.WALLET_AUTH_SECRET?.trim());
}

/** Express middleware: require a valid token for the requested wallet (fail-closed when secret required). */
function requireWalletToken(req, res, next) {
    const wallet = String(req.query.wallet || req.body?.wallet || req.headers['x-wallet'] || '').trim();
    const token = String(
        req.headers['x-wallet-token'] || req.headers['x-auth-token'] || req.body?.token || ''
    ).trim();

    if (!isWalletAuthRequired()) {
        const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
        const allowInsecure = process.env.ALLOW_INSECURE_AUTH === '1' || process.env.ALLOW_INSECURE_AUTH === 'true';
        if (nodeEnv === 'production' || (nodeEnv !== 'development' && !allowInsecure)) {
            res.status(503).json({
                success: false,
                error: 'Server misconfiguration: WALLET_AUTH_SECRET required',
            });
            return;
        }
        // Dev without secret: pass through but still bind wallet when provided.
        if (wallet) {
            req.wallet = wallet;
        }
        next();
        return;
    }

    if (!wallet || !verifyToken(wallet, token)) {
        res.status(401).json({ success: false, error: 'Wallet auth token required or invalid' });
        return;
    }

    req.wallet = wallet;
    next();
}

function registerAuthRoutes(app) {
    app.get('/auth/challenge', (req, res) => {
        const wallet = String(req.query.wallet || '').trim();
        if (!wallet) {
            res.status(400).json({ success: false, error: 'wallet query param required' });
            return;
        }

        pruneChallenges();
        const challenge = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + CHALLENGE_TTL_MS;
        challenges.set(challenge, { wallet, expiresAt });

        res.json({
            success: true,
            challenge,
            expiresAt,
            message: `Helbreath login: ${challenge}`,
        });
    });

    app.post('/auth/verify', (req, res) => {
        const { wallet, challenge, signature } = req.body || {};
        if (!wallet || !challenge || !signature) {
            res.status(400).json({ success: false, error: 'wallet, challenge, and signature required' });
            return;
        }

        const entry = challenges.get(challenge);
        if (!entry || entry.expiresAt <= Date.now() || entry.wallet !== wallet) {
            res.status(401).json({ success: false, error: 'Invalid or expired challenge' });
            return;
        }

        if (!verifyWalletSignature(wallet, challenge, signature)) {
            res.status(401).json({ success: false, error: 'Signature verification failed' });
            return;
        }

        challenges.delete(challenge);
        const tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
        const token = signToken(wallet, tokenExpiresAt);

        res.json({
            success: true,
            wallet,
            token,
            expiresAt: tokenExpiresAt,
        });
    });

    app.post('/auth/validate', (req, res) => {
        const { wallet, token } = req.body || {};
        res.json({ success: verifyToken(wallet, token) });
    });
}

module.exports = {
    registerAuthRoutes,
    verifyToken,
    isWalletAuthRequired,
    requireWalletToken,
};
