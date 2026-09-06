const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const nacl = require('tweetnacl');
const bs58 = require('bs58').default ?? require('bs58');
const { secp256k1 } = require('@noble/curves/secp256k1.js');
const { keccak_256 } = require('@noble/hashes/sha3.js');

const AUTH_PATH = require.resolve('../auth.js');

function loadAuth() {
    delete require.cache[AUTH_PATH];
    return require('../auth.js');
}

function evmAddressFromSecret(secretKey) {
    const pub = secp256k1.getPublicKey(secretKey, false);
    const uncompressed = pub.length === 65 ? pub : secp256k1.Point.fromBytes(pub).toBytes(false);
    return '0x' + Buffer.from(keccak_256(uncompressed.slice(1)).slice(-20)).toString('hex');
}

function signPersonal(message, secretKey) {
    const auth = require('../auth.js');
    const msgHash = auth.hashPersonalMessage(message);
    const recovered = secp256k1.sign(msgHash, secretKey, { prehash: false, format: 'recovered' });
    // personal_sign wire format: r||s||v with v = 27+recId
    const recId = recovered[0];
    const rs = recovered.subarray(1);
    const sig65 = Buffer.concat([Buffer.from(rs), Buffer.from([27 + recId])]);
    return '0x' + sig65.toString('hex');
}

async function listen(app) {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    return { server, url: `http://127.0.0.1:${port}` };
}

async function jsonReq(url, { method = 'GET', path, body, headers = {} } = {}) {
    const res = await fetch(`${url}${path}`, {
        method,
        headers: { 'content-type': 'application/json', ...headers },
        body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    return { status: res.status, json };
}

describe('multichain auth', () => {
    /** @type {NodeJS.ProcessEnv} */
    let saved;

    beforeEach(() => {
        saved = { ...process.env };
        process.env.WALLET_AUTH_SECRET = 'test-wallet-auth-secret';
        process.env.NODE_ENV = 'test';
        delete process.env.ALLOW_INSECURE_AUTH;
        delete process.env.BOT_ENROLL_SECRET;
        delete process.env.ADMIN_SECRET;
        delete process.env.DATABASE_URL;
        loadAuth().resetAuthStateForTests();
    });

    afterEach(() => {
        process.env = saved;
        delete require.cache[AUTH_PATH];
    });

    it('challenge message includes chainId, challengeId, and expiry', () => {
        const auth = loadAuth();
        const message = auth.buildChallengeMessage({
            chainId: 'rh',
            challengeId: 'abc123',
            address: '0xb603D6b2e5472beb338CE079a63FEb8663171529',
            expiresAt: 1730000000000,
        });
        assert.match(message, /chainId=rh/);
        assert.match(message, /challengeId=abc123/);
        assert.match(message, /expiresAt=1730000000000/);
        assert.equal(auth.challengeMessageHasRequiredFields(message), true);
        assert.equal(auth.challengeMessageHasRequiredFields('Helbreath login: abc123'), false);
    });

    it('fail-closed: missing WALLET_AUTH_SECRET in production (ALLOW_INSECURE_AUTH ignored)', () => {
        delete process.env.WALLET_AUTH_SECRET;
        process.env.NODE_ENV = 'production';
        process.env.ALLOW_INSECURE_AUTH = '1';
        const auth = loadAuth();
        assert.throws(() => auth.getAuthSecret(), /WALLET_AUTH_SECRET is required in production/);
        assert.throws(() => auth.getAuthSecret(), /ALLOW_INSECURE_AUTH is forbidden in production/);
    });

    it('fail-closed: production SoT requires DATABASE_URL (in-memory bindings forbidden)', async () => {
        process.env.NODE_ENV = 'production';
        delete process.env.DATABASE_URL;
        const auth = loadAuth();
        await assert.rejects(() => auth.registerPlayer('human'), /DATABASE_URL is required in production/);
    });

    it('Sol ed25519 verify still works against the new challenge message', async () => {
        const auth = loadAuth();
        const kp = nacl.sign.keyPair();
        const wallet = bs58.encode(kp.publicKey);

        const app = express();
        app.use(express.json());
        auth.registerAuthRoutes(app);
        const { server, url } = await listen(app);
        try {
            const ch = await jsonReq(url, {
                path: `/auth/challenge?chainId=sol&wallet=${encodeURIComponent(wallet)}`,
            });
            assert.equal(ch.status, 200);
            assert.equal(ch.json.chainId, 'sol');
            assert.equal(auth.challengeMessageHasRequiredFields(ch.json.message), true);

            const msgBytes = new TextEncoder().encode(ch.json.message);
            const sig = nacl.sign.detached(msgBytes, kp.secretKey);
            const verify = await jsonReq(url, {
                method: 'POST',
                path: '/auth/verify',
                body: {
                    chainId: 'sol',
                    wallet,
                    challenge: ch.json.challengeId,
                    signature: Buffer.from(sig).toString('base64'),
                },
            });
            assert.equal(verify.status, 200, JSON.stringify(verify.json));
            assert.equal(verify.json.success, true);
            assert.equal(verify.json.actorKind, 'human');
            assert.ok(verify.json.playerId);
            assert.deepEqual(verify.json.boundChains, ['sol']);
            assert.equal(auth.verifyToken(wallet, verify.json.token), true);
            const session = auth.parseSession(verify.json.token);
            assert.equal(session.playerId, verify.json.playerId);
            assert.equal(session.actorKind, 'human');
            assert.deepEqual(session.boundChains, ['sol']);
        } finally {
            server.close();
        }
    });

    it('RH personal_sign / EIP-191 happy path with fixture key', async () => {
        const auth = loadAuth();
        const { secretKey } = secp256k1.keygen();
        const address = auth.canonicalizeAddress('rh', evmAddressFromSecret(secretKey)).address;

        const app = express();
        app.use(express.json());
        auth.registerAuthRoutes(app);
        const { server, url } = await listen(app);
        try {
            const ch = await jsonReq(url, {
                method: 'POST',
                path: '/auth/challenge',
                body: { chainId: 'rh', address },
            });
            assert.equal(ch.status, 200, JSON.stringify(ch.json));
            assert.equal(ch.json.chainId, 'rh');
            assert.match(ch.json.message, /chainId=rh/);
            assert.match(ch.json.message, new RegExp(`challengeId=${ch.json.challengeId}`));
            assert.match(ch.json.message, /expiresAt=/);

            const signature = signPersonal(ch.json.message, secretKey);
            const verify = await jsonReq(url, {
                method: 'POST',
                path: '/auth/verify',
                body: {
                    chainId: 'rh',
                    address,
                    challengeId: ch.json.challengeId,
                    signature,
                },
            });
            assert.equal(verify.status, 200, JSON.stringify(verify.json));
            assert.equal(verify.json.success, true);
            assert.equal(verify.json.actorKind, 'human');
            assert.deepEqual(verify.json.boundChains, ['rh']);
            assert.equal(auth.verifyToken(address, verify.json.token), true);
        } finally {
            server.close();
        }
    });

    it('Base personal_sign / EIP-191 happy path (same verifier as RH)', async () => {
        const auth = loadAuth();
        const { secretKey } = secp256k1.keygen();
        const address = auth.canonicalizeAddress('base', evmAddressFromSecret(secretKey)).address;

        const app = express();
        app.use(express.json());
        auth.registerAuthRoutes(app);
        const { server, url } = await listen(app);
        try {
            const ch = await jsonReq(url, {
                method: 'POST',
                path: '/auth/challenge',
                body: { chainId: 'base', address },
            });
            assert.equal(ch.status, 200, JSON.stringify(ch.json));
            assert.equal(ch.json.chainId, 'base');
            assert.match(ch.json.message, /chainId=base/);
            assert.match(ch.json.message, new RegExp(`challengeId=${ch.json.challengeId}`));
            assert.match(ch.json.message, /expiresAt=/);

            const signature = signPersonal(ch.json.message, secretKey);
            const verify = await jsonReq(url, {
                method: 'POST',
                path: '/auth/verify',
                body: {
                    chainId: 'base',
                    address,
                    challengeId: ch.json.challengeId,
                    signature,
                },
            });
            assert.equal(verify.status, 200, JSON.stringify(verify.json));
            assert.equal(verify.json.success, true);
            assert.equal(verify.json.actorKind, 'human');
            assert.deepEqual(verify.json.boundChains, ['base']);
            assert.equal(auth.verifyToken(address, verify.json.token), true);
        } finally {
            server.close();
        }
    });

    it('same 0x on rh vs base via HTTP verify is two binds (no steal across chains)', async () => {
        const auth = loadAuth();
        const { secretKey } = secp256k1.keygen();
        const address = auth.canonicalizeAddress('rh', evmAddressFromSecret(secretKey)).address;

        const app = express();
        app.use(express.json());
        auth.registerAuthRoutes(app);
        const { server, url } = await listen(app);
        try {
            async function login(chainId) {
                const ch = await jsonReq(url, {
                    method: 'POST',
                    path: '/auth/challenge',
                    body: { chainId, address },
                });
                assert.equal(ch.status, 200, JSON.stringify(ch.json));
                const signature = signPersonal(ch.json.message, secretKey);
                return jsonReq(url, {
                    method: 'POST',
                    path: '/auth/verify',
                    body: { chainId, address, challengeId: ch.json.challengeId, signature },
                });
            }

            const rh = await login('rh');
            assert.equal(rh.status, 200, JSON.stringify(rh.json));
            const base = await login('base');
            assert.equal(base.status, 200, JSON.stringify(base.json));
            assert.notEqual(rh.json.playerId, base.json.playerId);
            assert.deepEqual(rh.json.boundChains, ['rh']);
            assert.deepEqual(base.json.boundChains, ['base']);
        } finally {
            server.close();
        }
    });

    it('RH signature cannot satisfy a Base challenge (anti-replay across chainId)', async () => {
        const auth = loadAuth();
        const { secretKey } = secp256k1.keygen();
        const address = auth.canonicalizeAddress('rh', evmAddressFromSecret(secretKey)).address;
        const app = express();
        app.use(express.json());
        auth.registerAuthRoutes(app);
        const { server, url } = await listen(app);
        try {
            const rhCh = await jsonReq(url, {
                method: 'POST',
                path: '/auth/challenge',
                body: { chainId: 'rh', address },
            });
            const baseCh = await jsonReq(url, {
                method: 'POST',
                path: '/auth/challenge',
                body: { chainId: 'base', address },
            });
            const rhSig = signPersonal(rhCh.json.message, secretKey);
            const replay = await jsonReq(url, {
                method: 'POST',
                path: '/auth/verify',
                body: {
                    chainId: 'base',
                    address,
                    challengeId: baseCh.json.challengeId,
                    signature: rhSig,
                },
            });
            assert.equal(replay.status, 401);
            assert.match(replay.json.error, /Signature verification failed/i);
        } finally {
            server.close();
        }
    });

    it('public register cannot set bot; enroll requires secret', async () => {
        const auth = loadAuth();
        const kp = nacl.sign.keyPair();
        const wallet = bs58.encode(kp.publicKey);
        const app = express();
        app.use(express.json());
        auth.registerAuthRoutes(app);
        const { server, url } = await listen(app);
        try {
            const ch = await jsonReq(url, {
                path: `/auth/challenge?wallet=${encodeURIComponent(wallet)}`,
            });
            const msgBytes = new TextEncoder().encode(ch.json.message);
            const sig = nacl.sign.detached(msgBytes, kp.secretKey);
            const verify = await jsonReq(url, {
                method: 'POST',
                path: '/auth/verify',
                body: {
                    wallet,
                    challenge: ch.json.challenge,
                    signature: Buffer.from(sig).toString('base64'),
                    actorKind: 'bot',
                },
            });
            assert.equal(verify.status, 403);

            const enroll = await jsonReq(url, {
                method: 'POST',
                path: '/auth/enroll-bot',
                body: { secret: 'nope' },
            });
            assert.equal(enroll.status, 403);
        } finally {
            server.close();
        }
    });

    it('same 0x on rh vs memory bind is two rows (UNIQUE chain+address)', async () => {
        const auth = loadAuth();
        const addr = auth.canonicalizeAddress('rh', '0xb603d6b2e5472beb338ce079a63feb8663171529');
        const human = await auth.registerPlayer('human');
        const a = await auth.bindOrReject(human.playerId, 'rh', addr.address, addr.addressKey);
        assert.equal(a.ok, true);
        const b = await auth.bindOrReject(human.playerId, 'base', addr.address, addr.addressKey);
        assert.equal(b.ok, true);
        const other = await auth.registerPlayer('human');
        const steal = await auth.bindOrReject(other.playerId, 'rh', addr.address, addr.addressKey);
        assert.equal(steal.ok, false);
        assert.equal(steal.status, 409);
        const listed = await auth.listBindings(human.playerId);
        assert.equal(listed.length, 2);
        assert.deepEqual(listed.map((w) => w.chainId).sort(), ['base', 'rh']);
    });
});
