const { Connection } = require('@solana/web3.js');
const { loadOrCreateGameAuthority } = require('../authority');
const { createDevnetVerifiedCollection } = require('../collection');

async function main() {
    const authority = loadOrCreateGameAuthority();
    const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');

    console.log('Creating verified Helbreath devnet collection + Bubblegum tree…');
    console.log('Authority:', authority.publicKey.toBase58());
    console.log('RPC:', process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com');
    console.log('Public metadata base:', process.env.MIDDLEWARE_PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`);
    if (process.env.HELBREATH_COLLECTION_MINT) {
        console.log('Reusing collection mint from HELBREATH_COLLECTION_MINT:', process.env.HELBREATH_COLLECTION_MINT);
    } else {
        console.log('Tip: if collection NFT already exists, set HELBREATH_COLLECTION_MINT to skip recreating it.');
    }

    const result = await createDevnetVerifiedCollection(authority, connection);

    console.log('\nDevnet verified collection initialized.\n');
    console.log('Saved to middleware-node/.helbreath-devnet-collection.json\n');
    console.log('Optional env overrides (already loaded from file if unset):\n');
    console.log(`HELBREATH_COLLECTION_MINT=${result.rare.collectionMint}`);
    console.log(`HELBREATH_MERKLE_TREE=${result.rare.merkleTree}`);
    console.log(`HELBREATH_LEGENDARY_COLLECTION_MINT=${result.super_rare.collectionMint}`);
    console.log(`HELBREATH_LEGENDARY_MERKLE_TREE=${result.super_rare.merkleTree}`);
    console.log('HELBREATH_MINT_MODE=onchain');
    console.log(`SOLANA_RPC_URL=${result.rpcUrl}`);
    console.log('\nCollection mint:', result.rare.collectionMint);
    console.log('Rare merkle tree:', result.rare.merkleTree);
    console.log('Legendary collection mint:', result.super_rare.collectionMint);
    console.log('Legendary merkle tree:', result.super_rare.merkleTree);
}

main().catch((error) => {
    console.error('init-devnet-collection failed:', error);
    process.exit(1);
});
