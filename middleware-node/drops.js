const bs58 = require('bs58').default ?? require('bs58');

const {
    listUnclaimedDrops,
    getDropById,
    tryAcquireClaimLease,
    releaseClaimLease,
    markDropClaimed,
} = require('./persistence');
const { requireWalletToken } = require('./auth');
const { mintDropCompressedNft } = require('./mint');
const { inc } = require('./metrics');

/** In-process claim locks — fast path for double-click / same-instance races. */
const claimingDrops = new Set();

function registerDropRoutes(app, gameAuthority, connection) {
    app.get('/drops', requireWalletToken, async (req, res) => {
        try {
            const wallet = String(req.query.wallet || '').trim();
            if (!wallet) {
                res.status(400).json({ success: false, error: 'wallet query param required' });
                return;
            }

            const drops = await listUnclaimedDrops(wallet);
            res.json({ success: true, wallet, drops });
        } catch (error) {
            console.error('[drops] list failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/drops/:dropId/voucher', requireWalletToken, async (req, res) => {
        try {
            const drop = await getDropById(req.params.dropId);
            if (!drop) {
                res.status(404).json({ success: false, error: 'Drop not found' });
                return;
            }

            // Only the drop owner may mint a voucher (prevents free authority signatures).
            const authWallet = String(req.wallet || req.authWallet || req.body?.wallet || '').trim();
            if (!authWallet || drop.account_wallet !== authWallet) {
                res.status(403).json({ success: false, error: 'Not your drop' });
                return;
            }

            if (drop.nft_claimed_at) {
                res.status(409).json({ success: false, error: 'Drop already claimed' });
                return;
            }

            if (!drop.is_nft_candidate) {
                res.status(400).json({ success: false, error: 'Drop is not an NFT candidate' });
                return;
            }

            const voucher = {
                player: drop.account_wallet,
                item_id: drop.item_id,
                item_uid: String(drop.item_uid),
                item_attribute: drop.item_attribute,
                item_color: drop.item_color,
                drop_id: drop.id,
                nft_tier: drop.nft_tier ?? 'rare',
                source_map: drop.source_map,
                expiry: Math.floor(Date.now() / 1000) + 86400,
            };

            const message = Buffer.from(JSON.stringify(voucher));
            const signature = gameAuthority.signMessage(message);

            res.json({
                success: true,
                voucher,
                signature: bs58.encode(signature),
                game_authority: gameAuthority.publicKey.toBase58(),
            });
        } catch (error) {
            console.error('[drops] voucher failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/drops/:dropId/claim', requireWalletToken, async (req, res) => {
        const dropId = req.params.dropId;
        inc('claims_attempt');

        let leaseHeld = false;
        try {
            const wallet = String(req.body?.wallet || '').trim();
            if (!wallet) {
                inc('claims_rejected');
                res.status(400).json({ success: false, error: 'wallet required' });
                return;
            }

            const drop = await getDropById(dropId);
            if (!drop) {
                inc('claims_rejected');
                res.status(404).json({ success: false, error: 'Drop not found' });
                return;
            }

            if (drop.account_wallet !== wallet) {
                inc('claims_rejected');
                res.status(403).json({ success: false, error: 'Drop does not belong to this wallet' });
                return;
            }

            if (drop.nft_claimed_at) {
                inc('claims_rejected');
                res.status(409).json({ success: false, error: 'Drop already claimed' });
                return;
            }

            if (!drop.is_nft_candidate) {
                inc('claims_rejected');
                res.status(400).json({ success: false, error: 'Drop is not an NFT candidate' });
                return;
            }

            if (claimingDrops.has(drop.id)) {
                inc('claim_lease_rejected');
                inc('claims_rejected');
                res.status(409).json({ success: false, error: 'Claim already in progress' });
                return;
            }

            claimingDrops.add(drop.id);

            // DB lease before mint: blocks other middleware replicas from minting the same drop_id.
            const leased = await tryAcquireClaimLease(drop.id);
            if (!leased) {
                claimingDrops.delete(drop.id);
                const again = await getDropById(drop.id);
                if (again?.nft_claimed_at) {
                    inc('claims_rejected');
                    res.status(409).json({ success: false, error: 'Drop already claimed' });
                    return;
                }
                inc('claim_lease_rejected');
                inc('claims_rejected');
                res.status(409).json({ success: false, error: 'Claim already in progress' });
                return;
            }
            leaseHeld = true;

            let mintResult;
            try {
                console.log(`[drops] claim start drop=${drop.id} wallet=${wallet} tier=${drop.nft_tier}`);
                mintResult = await mintDropCompressedNft(gameAuthority, connection, drop);
                const updated = await markDropClaimed(drop.id, mintResult.assetId);
                leaseHeld = false;

                if (!updated) {
                    // Should be rare with lease held; still possible via legacy /claimed racing.
                    inc('mint_orphan_db_race');
                    console.error(
                        `[drops] CRITICAL mint succeeded but ledger claim lost drop=${drop.id} `
                        + `assetId=${mintResult.assetId} signature=${mintResult.signature} mode=${mintResult.mode}`,
                    );
                    inc('claims_rejected');
                    res.status(409).json({
                        success: false,
                        error: 'Drop already claimed',
                        orphanMintAddress: mintResult.assetId,
                        orphanSignature: mintResult.signature,
                    });
                    return;
                }

                inc('claims_ok');
                console.log(
                    `[drops] claim ok drop=${drop.id} assetId=${mintResult.assetId} mode=${mintResult.mode}`,
                );
                res.json({
                    success: true,
                    dropId: drop.id,
                    mintAddress: mintResult.assetId,
                    mintMode: mintResult.mode,
                    signature: mintResult.signature,
                    collectionMint: mintResult.collectionMint,
                    explorerUrl: mintResult.explorerUrl,
                });
            } catch (mintError) {
                if (leaseHeld) {
                    await releaseClaimLease(drop.id);
                    leaseHeld = false;
                }
                throw mintError;
            } finally {
                claimingDrops.delete(drop.id);
            }
        } catch (error) {
            claimingDrops.delete(dropId);
            if (leaseHeld) {
                try {
                    await releaseClaimLease(dropId);
                } catch (releaseError) {
                    console.error('[drops] lease release failed:', releaseError);
                }
            }
            inc('claims_error');
            console.error('[drops] claim failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/drops/:dropId/claimed', requireWalletToken, async (req, res) => {
        try {
            const wallet = String(req.body?.wallet || '').trim();
            const { mint_address: mintAddress } = req.body || {};

            if (!mintAddress) {
                res.status(400).json({ success: false, error: 'mint_address required' });
                return;
            }

            const drop = await getDropById(req.params.dropId);
            if (!drop) {
                res.status(404).json({ success: false, error: 'Drop not found or already claimed' });
                return;
            }

            if (wallet && drop.account_wallet !== wallet) {
                res.status(403).json({ success: false, error: 'Drop does not belong to this wallet' });
                return;
            }

            // When wallet is omitted, still require a valid session token (requireWalletToken)
            // but refuse anonymous ownership overwrite — prefer explicit wallet match.
            if (!wallet) {
                res.status(400).json({ success: false, error: 'wallet required' });
                return;
            }

            const updated = await markDropClaimed(req.params.dropId, mintAddress);
            if (!updated) {
                res.status(404).json({ success: false, error: 'Drop not found or already claimed' });
                return;
            }

            console.log(`[drops] marked claimed drop=${req.params.dropId} mint=${mintAddress}`);
            res.json({ success: true });
        } catch (error) {
            console.error('[drops] claimed failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Legacy endpoint kept for compatibility with early integrations.
    app.post('/drop', async (req, res) => {
        try {
            const { player_pubkey, item_name, uri, stats, drop_id } = req.body;
            const voucher = {
                player: player_pubkey,
                item_name: item_name,
                uri: uri,
                stats: stats || [],
                drop_id: drop_id,
                expiry: Math.floor(Date.now() / 1000) + 86400,
            };

            const message = Buffer.from(JSON.stringify(voucher));
            const signature = gameAuthority.signMessage(message);

            res.json({
                success: true,
                voucher,
                signature: bs58.encode(signature),
                game_authority: gameAuthority.publicKey.toBase58(),
            });
        } catch (error) {
            console.error('Error generating voucher:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
}

module.exports = { registerDropRoutes };
