const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Connection } = require('@solana/web3.js');

const { registerAuthRoutes } = require('./auth');
const { registerDropRoutes } = require('./drops');
const { registerTournamentRoutes, startEloDecayJob } = require('./tournaments');
const { getPool, ensureSchema } = require('./persistence');
const { registerMetadataRoutes } = require('./metadata');
const { registerChatTranslateRoutes } = require('./chatTranslate');
const { registerEkScreenshotRoutes } = require('./ekScreenshots');
const { loadOrCreateGameAuthority } = require('./authority');
const { getMintMode } = require('./mint');
const { getCollectionConfig } = require('./collection');
const { getRpcUrl } = require('./config');
const { snapshot: metricsSnapshot } = require('./metrics');
const { registerHellRoutes, loadHellTokenConfig } = require('./hell');
const { registerMarketRoutes } = require('./market');
const { registerAssistantRoutes } = require('./assistantIngame');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '8mb' }));

const PORT = process.env.PORT || 3001;
const GAME_AUTHORITY = loadOrCreateGameAuthority();
const rpcUrl = getRpcUrl();
const connection = new Connection(rpcUrl, 'confirmed');
const collectionConfig = getCollectionConfig();
const hellConfig = loadHellTokenConfig();

console.log('🔑 Game Authority Public Key:', GAME_AUTHORITY.publicKey.toBase58());
console.log(`🌐 Solana RPC: ${rpcUrl}`);
console.log(`🌿 Mint mode: ${getMintMode()}`);
if (hellConfig?.mint) {
    console.log(`🔥 $HELL mint: ${hellConfig.mint}`);
} else {
    console.log('ℹ️ No $HELL mint — run npm run init-hell-token (devnet) when ready');
}if (collectionConfig) {
    console.log(`📦 Collection mint: ${collectionConfig.collectionMint}`);
    console.log(`🌳 Merkle tree: ${collectionConfig.merkleTree}`);
} else {
    console.log('ℹ️ No collection configured — run npm run init-devnet-collection for verified devnet cNFTs');
}

if (getPool()) {
    void ensureSchema().catch((error) => {
        console.error('[persistence] Schema apply failed:', error);
    });
    console.log('🗄️ PostgreSQL connected (drop ledger enabled)');
} else {
    console.log('ℹ️ PostgreSQL not configured — drop ledger API returns empty until DATABASE_URL is set');
}

// Launch security banners
if (!(process.env.WALLET_AUTH_SECRET || '').trim()) {
    console.warn(
        '[SECURITY] WARNING: WALLET_AUTH_SECRET unset — set a strong secret shared with the game server before public traffic.'
    );
}
const marketPayMode = (process.env.MARKET_PAY_MODE || 'live').toLowerCase();
const allowDevPay = marketPayMode === 'dev' && (process.env.ALLOW_MARKET_DEV_PAY === '1' || process.env.ALLOW_MARKET_DEV_PAY === 'true');
console.log(`[SECURITY] Market PAY_MODE=${marketPayMode} allowDevPay=${allowDevPay} requireAuth=${process.env.MARKET_REQUIRE_AUTH !== '0'}`);
if (allowDevPay) {
    console.warn('[SECURITY] WARNING: market pay-dev is ENABLED — free purchases possible. Disable for public soft test.');
}

registerAuthRoutes(app);
registerMetadataRoutes(app);
registerDropRoutes(app, GAME_AUTHORITY, connection);
registerTournamentRoutes(app);
registerChatTranslateRoutes(app);
registerEkScreenshotRoutes(app);
registerHellRoutes(app, connection);
registerMarketRoutes(app);
registerAssistantRoutes(app);
startEloDecayJob();

app.get('/health', (_req, res) => {
    res.json({
        ok: true,
        postgres: Boolean(getPool()),
        mintMode: getMintMode(),
        gameAuthority: GAME_AUTHORITY.publicKey.toBase58(),
        collectionMint: collectionConfig?.collectionMint ?? null,
        merkleTree: collectionConfig?.merkleTree ?? null,
        hellMint: hellConfig?.mint ?? null,
        eloDecayJob: true,
        market: true,
        metrics: metricsSnapshot(),
    });
});

app.get('/metrics', (_req, res) => {
    res.json({
        ok: true,
        mintMode: getMintMode(),
        postgres: Boolean(getPool()),
        ...metricsSnapshot(),
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Middleware Helbreath corriendo en http://localhost:${PORT}`);
    console.log('✅ Auth: /auth/challenge, /auth/verify');
    console.log('✅ Drops: GET /drops?wallet=..., POST /drops/:id/claim');
    console.log('✅ Metadata: GET /metadata/collection, GET /metadata/:dropId');
    console.log('✅ Tournaments: GET /leaderboard, /tournaments, /hall-of-fame, /prizes');
    console.log('✅ Arena week: GET /arena/week, POST /arena/week/register (1v1 + 3v3 inscription)');
    console.log('✅ Chat translate: POST /chat/translate (LibreTranslate proxy or demo phrases)');
    console.log('✅ EK screenshots: GET/POST /ek-screenshots (in-memory gallery stub)');
    console.log('✅ $HELL: GET /hell/status, POST /hell/claim (play-mine pending → SPL when mint set)');
    console.log('✅ Market: GET /market/search, POST /market/quote|orders|advisor, desk claims');
    console.log('✅ Elo decay: timer + POST /admin/decay-run (lazy read-path kept)');
    console.log('✅ Ops: GET /health, GET /metrics');
});
