const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { mplBubblegum } = require('@metaplex-foundation/mpl-bubblegum');
const { mplTokenMetadata } = require('@metaplex-foundation/mpl-token-metadata');
const { createSignerFromKeypair, keypairIdentity } = require('@metaplex-foundation/umi');
const { web3JsEddsa } = require('@metaplex-foundation/umi-eddsa-web3js');
const { getRpcUrl } = require('./config');

function buildUmi(gameAuthority) {
    const umi = createUmi(getRpcUrl()).use(web3JsEddsa()).use(mplBubblegum()).use(mplTokenMetadata());
    const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(gameAuthority.secretKey));
    umi.use(keypairIdentity(createSignerFromKeypair(umi, keypair)));
    return umi;
}

module.exports = { buildUmi };
