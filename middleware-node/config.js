function getPublicBaseUrl() {
    return (process.env.MIDDLEWARE_PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '');
}

function getRpcUrl() {
    return process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
}

module.exports = {
    getPublicBaseUrl,
    getRpcUrl,
};
