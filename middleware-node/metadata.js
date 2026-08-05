const { getDropById } = require('./persistence');

const { getCollectionConfigForTier, TIER_SUPER_RARE } = require('./collection');

const { getPublicBaseUrl } = require('./config');



function buildRareCollectionMetadata() {

    return {

        name: 'Helbreath Chain Lord Rare',

        symbol: 'HBRARE',

        description: 'Magic-roll gear from Helbreath Chain Lord — frequent rare drops minted as compressed NFTs on Solana.',

        image: `${getPublicBaseUrl()}/metadata/collection/rare/image.svg`,

        external_url: 'https://helbreath.io',

        seller_fee_basis_points: 0,

        properties: {

            category: 'image',

            creators: [],

        },

    };

}



function buildLegendaryCollectionMetadata() {

    return {

        name: 'Helbreath Chain Lord Legendary',

        symbol: 'HBLEGEND',

        description: 'Endgame Chain Lord items — Devastator, Berserk Wand, Giant Battle Hammer, Xelima/Merien/Dark Knight gear.',

        image: `${getPublicBaseUrl()}/metadata/collection/legendary/image.svg`,

        external_url: 'https://helbreath.io',

        seller_fee_basis_points: 0,

        properties: {

            category: 'image',

            creators: [],

        },

    };

}



function buildCollectionImageSvg(title, subtitle, accent) {

    return `<?xml version="1.0" encoding="UTF-8"?>

<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">

  <rect width="512" height="512" fill="#120c06"/>

  <rect x="28" y="28" width="456" height="456" rx="28" fill="#2d1810" stroke="${accent}" stroke-width="10"/>

  <text x="256" y="230" fill="#ffd700" font-family="serif" font-size="34" text-anchor="middle">Helbreath</text>

  <text x="256" y="280" fill="${accent}" font-family="serif" font-size="24" text-anchor="middle">${title}</text>

  <text x="256" y="340" fill="#8b6914" font-family="serif" font-size="16" text-anchor="middle">${subtitle}</text>

</svg>`;

}



function tierLabel(nftTier) {

    return nftTier === TIER_SUPER_RARE ? 'Legendary' : 'Rare';

}



function buildDropMetadata(drop, collectionMint) {

    const isLegendary = drop.nft_tier === TIER_SUPER_RARE;

    const tier = tierLabel(drop.nft_tier);

    const itemName = `Helbreath ${tier} #${drop.item_id}`;

    const collectionName = isLegendary ? 'Helbreath Chain Lord Legendary' : 'Helbreath Chain Lord Rare';



    const metadata = {

        name: itemName,

        symbol: isLegendary ? 'HBLEGEND' : 'HBRARE',

        description: `${tier} Helbreath Chain Lord drop minted as a verified compressed NFT.`,

        image: `${getPublicBaseUrl()}/metadata/${drop.id}/image.svg`,

        external_url: 'https://helbreath.io',

        attributes: [

            { trait_type: 'tier', value: tier },

            { trait_type: 'item_id', value: String(drop.item_id) },

            { trait_type: 'item_uid', value: String(drop.item_uid) },

            { trait_type: 'item_attribute', value: String(drop.item_attribute) },

            { trait_type: 'item_color', value: String(drop.item_color) },

            { trait_type: 'character', value: drop.character_name },

            { trait_type: 'source_map', value: drop.source_map || 'unknown' },

            { trait_type: 'drop_id', value: drop.id },

        ],

    };



    const resolvedCollectionMint = collectionMint ?? getCollectionConfigForTier(drop.nft_tier)?.collectionMint;

    if (resolvedCollectionMint) {

        metadata.collection = {

            name: collectionName,

            family: 'Helbreath',

        };

    }



    return metadata;

}



function buildPlaceholderSvg(drop) {

    const isLegendary = drop.nft_tier === TIER_SUPER_RARE;

    const accent = isLegendary ? '#e040fb' : '#c9a227';

    const label = `HB #${drop.item_id}`;

    const tier = tierLabel(drop.nft_tier);

    return `<?xml version="1.0" encoding="UTF-8"?>

<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">

  <rect width="512" height="512" fill="#1a1208"/>

  <rect x="24" y="24" width="464" height="464" rx="24" fill="#2d1810" stroke="${accent}" stroke-width="8"/>

  <text x="256" y="240" fill="#ffd700" font-family="serif" font-size="42" text-anchor="middle">${label}</text>

  <text x="256" y="300" fill="${accent}" font-family="serif" font-size="22" text-anchor="middle">Helbreath ${tier}</text>

</svg>`;

}



function registerMetadataRoutes(app) {

    app.get('/metadata/collection', (_req, res) => {

        res.json(buildRareCollectionMetadata());

    });



    app.get('/metadata/collection/rare', (_req, res) => {

        res.json(buildRareCollectionMetadata());

    });



    app.get('/metadata/collection/legendary', (_req, res) => {

        res.json(buildLegendaryCollectionMetadata());

    });



    app.get('/metadata/collection/image.svg', (_req, res) => {

        res.setHeader('Content-Type', 'image/svg+xml');

        res.send(buildCollectionImageSvg('Chain Lord Rare', 'Verified cNFT Collection', '#c9a227'));

    });



    app.get('/metadata/collection/rare/image.svg', (_req, res) => {

        res.setHeader('Content-Type', 'image/svg+xml');

        res.send(buildCollectionImageSvg('Chain Lord Rare', 'Magic-roll drops', '#c9a227'));

    });



    app.get('/metadata/collection/legendary/image.svg', (_req, res) => {

        res.setHeader('Content-Type', 'image/svg+xml');

        res.send(buildCollectionImageSvg('Chain Lord Legendary', 'Endgame gear', '#e040fb'));

    });



    app.get('/metadata/:dropId', async (req, res) => {

        if (req.params.dropId === 'collection') {

            res.json(buildRareCollectionMetadata());

            return;

        }



        try {

            const drop = await getDropById(req.params.dropId);

            if (!drop) {

                res.status(404).json({ error: 'Drop not found' });

                return;

            }

            res.json(buildDropMetadata(drop));

        } catch (error) {

            console.error('[metadata] failed:', error);

            res.status(500).json({ error: error.message });

        }

    });



    app.get('/metadata/:dropId/image.svg', async (req, res) => {

        if (req.params.dropId === 'collection') {

            res.setHeader('Content-Type', 'image/svg+xml');

            res.send(buildCollectionImageSvg('Chain Lord Rare', 'Verified cNFT Collection', '#c9a227'));

            return;

        }



        try {

            const drop = await getDropById(req.params.dropId);

            if (!drop) {

                res.status(404).send('Not found');

                return;

            }

            res.setHeader('Content-Type', 'image/svg+xml');

            res.send(buildPlaceholderSvg(drop));

        } catch (error) {

            console.error('[metadata] image failed:', error);

            res.status(500).send('Error');

        }

    });

}



module.exports = {

    buildDropMetadata,

    buildLegendaryCollectionMetadata,

    buildRareCollectionMetadata,

    getPublicBaseUrl,

    registerMetadataRoutes,

};

