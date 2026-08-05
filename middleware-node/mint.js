const crypto = require('crypto');
const bs58 = require('bs58').default ?? require('bs58');
const {
    mintToCollectionV1,
    parseLeafFromMintToCollectionV1Transaction,
    findLeafAssetIdPda,
} = require('@metaplex-foundation/mpl-bubblegum');
const {
    publicKey,
    transactionBuilder,
} = require('@metaplex-foundation/umi');
const { buildDropMetadata } = require('./metadata');
const { getCollectionConfigForTier, getDevnetAssetExplorerUrl, TIER_SUPER_RARE } = require('./collection');
const { getRpcUrl, getPublicBaseUrl } = require('./config');
const { buildUmi } = require('./umi');

/** Bubblegum docs require finalized before parseLeaf; public RPCs may still lag after that. */
const PARSE_LEAF_MAX_ATTEMPTS = 10;
const PARSE_LEAF_BASE_DELAY_MS = 500;

function getMintMode() {
    const configured = process.env.HELBREATH_MINT_MODE?.trim().toLowerCase();
    if (configured === 'simulate' || configured === 'onchain') {
        return configured;
    }

    const collection = getCollectionConfigForTier('rare');
    return collection?.merkleTree && collection?.collectionMint ? 'onchain' : 'simulate';
}

function buildUmiForAuthority(gameAuthority) {
    return buildUmi(gameAuthority);
}

/**
 * Encode a Umi TransactionSignature (base58 string or bytes) for API / explorer use.
 * @param {string | Uint8Array} signature
 */
function signatureToBase58(signature) {
    if (typeof signature === 'string') {
        return signature;
    }
    if (signature instanceof Uint8Array || Buffer.isBuffer(signature)) {
        return bs58.encode(signature);
    }
    return String(signature);
}

/**
 * Parse mint leaf with retries — mpl-bubblegum throws "Could not get transaction from signature"
 * when rpc.getTransaction returns null (confirmed-but-not-finalized, or public RPC lag).
 * @param {import('@metaplex-foundation/umi').Umi} umi
 * @param {string | Uint8Array} signature
 */
async function parseLeafFromMintWithRetry(umi, signature) {
    let lastError;
    for (let attempt = 0; attempt < PARSE_LEAF_MAX_ATTEMPTS; attempt++) {
        try {
            return await parseLeafFromMintToCollectionV1Transaction(umi, signature);
        } catch (error) {
            lastError = error;
            const message = error instanceof Error ? error.message : String(error);
            const retryable = /could not get transaction from signature/i.test(message);
            if (!retryable || attempt === PARSE_LEAF_MAX_ATTEMPTS - 1) {
                break;
            }
            const delayMs = PARSE_LEAF_BASE_DELAY_MS * (attempt + 1);
            console.warn(
                `[mint] parseLeaf retry ${attempt + 1}/${PARSE_LEAF_MAX_ATTEMPTS} `
                + `after ${delayMs}ms (${message})`,
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    const detail = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
        `Mint landed but leaf could not be read from RPC (${detail}). `
        + `Set SOLANA_RPC_URL to a reliable provider (public api.devnet.solana.com often lags getTransaction). `
        + `Signature: ${signatureToBase58(signature)}`,
    );
}

async function ensureDevnetAirdrop(connection, pubkey) {
    try {
        const balance = await connection.getBalance(pubkey);
        if (balance >= 500_000_000) {
            return;
        }

        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const sig = await connection.requestAirdrop(pubkey, 2_000_000_000);
                await connection.confirmTransaction(sig, 'confirmed');
                console.log('[mint] Devnet airdrop confirmed for game authority');
                return;
            } catch (error) {
                if (attempt === 2) {
                    throw error;
                }
                await new Promise((resolve) => setTimeout(resolve, 1500));
            }
        }
    } catch (error) {
        const address = pubkey.toBase58();
        throw new Error(
            `Game authority ${address} needs devnet SOL. Airdrop failed: ${error.message}. `
            + 'Fund the wallet manually or retry init-devnet-collection.',
        );
    }
}

function simulateMintAddress(drop) {
    const digest = crypto
        .createHash('sha256')
        .update(`${drop.id}:${drop.item_uid}:${drop.account_wallet}`)
        .digest('hex');
    return `sim_${digest.slice(0, 44)}`;
}

async function mintDropCompressedNft(gameAuthority, connection, drop) {
    const mode = getMintMode();
    if (mode === 'simulate') {
        const assetId = simulateMintAddress(drop);
        return {
            mode: 'simulate',
            assetId,
            signature: null,
            collectionMint: getCollectionConfigForTier(drop.nft_tier)?.collectionMint ?? null,
            explorerUrl: null,
        };
    }

    const tier = drop.nft_tier === TIER_SUPER_RARE ? TIER_SUPER_RARE : 'rare';
    const collection = getCollectionConfigForTier(tier);
    if (!collection?.merkleTree || !collection?.collectionMint) {
        throw new Error(`Collection config missing for tier "${tier}". Run npm run init-devnet-collection first.`);
    }

    await ensureDevnetAirdrop(connection, gameAuthority.publicKey);

    const umi = buildUmiForAuthority(gameAuthority);
    const metadata = buildDropMetadata(drop, collection.collectionMint);
    const metadataUri = `${getPublicBaseUrl()}/metadata/${drop.id}`;

    const builder = transactionBuilder().add(
        mintToCollectionV1(umi, {
            merkleTree: publicKey(collection.merkleTree),
            collectionMint: publicKey(collection.collectionMint),
            leafOwner: publicKey(drop.account_wallet),
            metadata: {
                name: metadata.name,
                symbol: 'HB',
                uri: metadataUri,
                sellerFeeBasisPoints: 0,
                collection: {
                    key: publicKey(collection.collectionMint),
                    verified: false,
                },
                creators: [
                    {
                        address: umi.identity.publicKey,
                        verified: true,
                        share: 100,
                    },
                ],
            },
        }),
    );

    // Metaplex: parseLeafFromMintToCollectionV1Transaction requires finalized, not merely confirmed.
    const { signature } = await builder.sendAndConfirm(umi, { confirm: { commitment: 'finalized' } });
    const leaf = await parseLeafFromMintWithRetry(umi, signature);
    const leafIndex = Number(leaf.nonce);
    const [assetIdPubkey] = findLeafAssetIdPda(umi, {
        merkleTree: publicKey(collection.merkleTree),
        leafIndex,
    });
    // Prefer PDA derivation; leaf.id is the same asset id when schema parses cleanly.
    const assetId = String(assetIdPubkey ?? leaf.id);
    const signatureBase58 = signatureToBase58(signature);

    return {
        mode: 'onchain',
        assetId,
        signature: signatureBase58,
        leafIndex,
        collectionMint: collection.collectionMint,
        explorerUrl: getDevnetAssetExplorerUrl(assetId),
    };
}

module.exports = {
    ensureDevnetAirdrop,
    getMintMode,
    getRpcUrl,
    mintDropCompressedNft,
    parseLeafFromMintWithRetry,
    signatureToBase58,
};
