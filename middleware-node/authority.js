const bs58 = require('bs58').default ?? require('bs58');
const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const AUTHORITY_FILE = path.join(__dirname, '.game-authority.json');

function loadOrCreateGameAuthority() {
    const fromEnv = process.env.GAME_AUTHORITY_SECRET?.trim();
    if (fromEnv) {
        return Keypair.fromSecretKey(bs58.decode(fromEnv));
    }

    if (fs.existsSync(AUTHORITY_FILE)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(AUTHORITY_FILE, 'utf8'));
            if (Array.isArray(parsed.secretKey) && parsed.secretKey.length === 64) {
                return Keypair.fromSecretKey(Uint8Array.from(parsed.secretKey));
            }
        } catch (error) {
            console.warn('[authority] Failed to read .game-authority.json:', error.message);
        }
    }

    const generated = Keypair.generate();
    try {
        fs.writeFileSync(
            AUTHORITY_FILE,
            JSON.stringify({ secretKey: Array.from(generated.secretKey) }, null, 2),
        );
        console.log('[authority] Generated new game authority keypair at', AUTHORITY_FILE);
    } catch (error) {
        console.warn('[authority] Could not persist keypair:', error.message);
    }

    return generated;
}

module.exports = { loadOrCreateGameAuthority };
