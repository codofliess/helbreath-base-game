const fs = require('fs');

const path = require('path');

const { generateSigner, percentAmount } = require('@metaplex-foundation/umi');

const { mplBubblegum, createTree } = require('@metaplex-foundation/mpl-bubblegum');

const { createNft } = require('@metaplex-foundation/mpl-token-metadata');

const { getPublicBaseUrl, getRpcUrl } = require('./config');

const { buildUmi } = require('./umi');



const COLLECTION_CONFIG_FILE = path.join(__dirname, '.helbreath-devnet-collection.json');



const TIER_RARE = 'rare';

const TIER_SUPER_RARE = 'super_rare';



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

                console.log('[collection] Devnet airdrop confirmed for game authority');

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



function loadCollectionConfigFromFile() {

    if (!fs.existsSync(COLLECTION_CONFIG_FILE)) {

        return null;

    }



    try {

        return JSON.parse(fs.readFileSync(COLLECTION_CONFIG_FILE, 'utf8'));

    } catch (error) {

        console.warn('[collection] Failed to read config file:', error.message);

        return null;

    }

}



function saveCollectionConfig(config) {

    fs.writeFileSync(COLLECTION_CONFIG_FILE, JSON.stringify(config, null, 2));

}



function normalizeTierConfig(raw, tierKey) {

    if (!raw) {

        return null;

    }



    const nested = raw[tierKey];

    if (nested?.merkleTree && nested?.collectionMint) {

        return {

            merkleTree: nested.merkleTree,

            collectionMint: nested.collectionMint,

            rpcUrl: nested.rpcUrl ?? raw.rpcUrl ?? getRpcUrl(),

        };

    }



    if (tierKey === TIER_RARE && raw.merkleTree && raw.collectionMint) {

        return {

            merkleTree: raw.merkleTree,

            collectionMint: raw.collectionMint,

            rpcUrl: raw.rpcUrl ?? getRpcUrl(),

        };

    }



    return null;

}



function getCollectionConfigForTier(nftTier) {

    const tierKey = nftTier === TIER_SUPER_RARE ? TIER_SUPER_RARE : TIER_RARE;



    const fromEnv = tierKey === TIER_SUPER_RARE

        ? {

            merkleTree: process.env.HELBREATH_LEGENDARY_MERKLE_TREE?.trim(),

            collectionMint: process.env.HELBREATH_LEGENDARY_COLLECTION_MINT?.trim(),

            rpcUrl: getRpcUrl(),

        }

        : {

            merkleTree: process.env.HELBREATH_MERKLE_TREE?.trim(),

            collectionMint: process.env.HELBREATH_COLLECTION_MINT?.trim(),

            rpcUrl: getRpcUrl(),

        };



    if (fromEnv.merkleTree && fromEnv.collectionMint) {

        return fromEnv;

    }



    const fromFile = loadCollectionConfigFromFile();

    const normalized = normalizeTierConfig(fromFile, tierKey);

    if (normalized) {

        return normalized;

    }



    if (tierKey === TIER_SUPER_RARE) {

        return normalizeTierConfig(fromFile, TIER_RARE);

    }



    return null;

}



/** @deprecated Use getCollectionConfigForTier('rare') */

function getCollectionConfig() {

    return getCollectionConfigForTier(TIER_RARE);

}



function getDevnetAssetExplorerUrl(assetId) {

    const cluster = getRpcUrl().includes('devnet') ? 'devnet' : 'mainnet';

    return `https://solana.fm/address/${assetId}?cluster=${cluster}-solana`;

}



async function createTierCollection(umi, tierKey, name, symbol, metadataPath) {

    const existingFile = loadCollectionConfigFromFile();

    const existingTier = existingFile?.[tierKey];



    let collectionMintAddress = tierKey === TIER_RARE

        ? process.env.HELBREATH_COLLECTION_MINT?.trim()

        : process.env.HELBREATH_LEGENDARY_COLLECTION_MINT?.trim();



    if (!collectionMintAddress && existingTier?.collectionMint) {

        collectionMintAddress = existingTier.collectionMint;

        console.log(`[collection] Reusing ${tierKey} collection mint:`, collectionMintAddress);

    }



    if (!collectionMintAddress) {

        const collectionMint = generateSigner(umi);

        const collectionUri = `${getPublicBaseUrl()}/metadata/${metadataPath}`;



        await createNft(umi, {

            mint: collectionMint,

            name,

            symbol,

            uri: collectionUri,

            sellerFeeBasisPoints: percentAmount(0),

            isCollection: true,

        }).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });



        collectionMintAddress = collectionMint.publicKey.toString();

        console.log(`[collection] ${tierKey} collection mint created:`, collectionMintAddress);

    }



    const merkleTree = generateSigner(umi);

    console.log(`[collection] Creating ${tierKey} Bubblegum merkle tree…`);

    const treeBuilder = await createTree(umi, {

        merkleTree,

        maxDepth: 14,

        maxBufferSize: 64,

    });

    await treeBuilder.sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });



    return {

        collectionMint: collectionMintAddress,

        merkleTree: merkleTree.publicKey.toString(),

    };

}



async function createDevnetVerifiedCollection(gameAuthority, connection) {

    await ensureDevnetAirdrop(connection, gameAuthority.publicKey);

    const umi = buildUmi(gameAuthority);



    console.log('[collection] Creating Rare + Legendary verified collections…');



    const rare = await createTierCollection(

        umi,

        TIER_RARE,

        'Helbreath Chain Lord Rare',

        'HBRARE',

        'collection/rare',

    );



    const superRare = await createTierCollection(

        umi,

        TIER_SUPER_RARE,

        'Helbreath Chain Lord Legendary',

        'HBLEGEND',

        'collection/legendary',

    );



    const config = {

        rare,

        super_rare: superRare,

        collectionMint: rare.collectionMint,

        merkleTree: rare.merkleTree,

        authority: gameAuthority.publicKey.toBase58(),

        rpcUrl: getRpcUrl(),

        createdAt: new Date().toISOString(),

    };



    saveCollectionConfig(config);

    return config;

}



module.exports = {

    TIER_RARE,

    TIER_SUPER_RARE,

    createDevnetVerifiedCollection,

    getCollectionConfig,

    getCollectionConfigForTier,

    getDevnetAssetExplorerUrl,

    loadCollectionConfigFromFile,

    saveCollectionConfig,

};

