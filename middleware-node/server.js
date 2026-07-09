const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Connection, Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = 3001;

// Genera una clave temporal cada vez que arranca (perfecto para desarrollo)
const GAME_AUTHORITY = Keypair.generate();

console.log('🔑 Game Authority Public Key (dev):', GAME_AUTHORITY.publicKey.toBase58());
console.log('⚠️ Esta clave cambia cada vez que reiniciás el servidor (solo para testing)');

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Endpoint que recibe los rare drops desde el servidor Helbreath
app.post('/drop', async (req, res) => {
    try {
        const { player_pubkey, item_name, uri, stats, drop_id } = req.body;

        const voucher = {
            player: player_pubkey,
            item_name: item_name,
            uri: uri,
            stats: stats || [],
            drop_id: drop_id,
            expiry: Math.floor(Date.now() / 1000) + 86400, // 24 horas
        };

        const message = Buffer.from(JSON.stringify(voucher));
        const signature = GAME_AUTHORITY.signMessage(message);

        res.json({
            success: true,
            voucher: voucher,
            signature: bs58.encode(signature),
            game_authority: GAME_AUTHORITY.publicKey.toBase58()
        });
    } catch (error) {
        console.error('Error generating voucher:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Middleware Helbreath corriendo en http://localhost:${PORT}`);
    console.log('✅ Listo para recibir rare drops del servidor C#');
});