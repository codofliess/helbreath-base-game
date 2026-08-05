/**
 * Testing-week play-mine credit rules (Discord / chainlords.net #news / HellMiningStore).
 * Shown in the always-on top-left testnet HUD while the public test runs.
 */
export interface TestnetCreditRule {
    id: string;
    /** Short label for the checklist row. */
    label: string;
    /** Detail / how to earn. */
    detail: string;
}

/** Ordered checklist matching Discord / week1-content-pack credit posts. */
export const TESTNET_CREDIT_CHECKLIST: TestnetCreditRule[] = [
    {
        id: 'login',
        label: 'Login / join',
        detail: '+1 credit first presence of the UTC day',
    },
    {
        id: 'online',
        label: 'Online / AFK hours',
        detail: '+1 credit per full hour connected (AFK counts, up to 24/day)',
    },
    {
        id: 'farm',
        label: 'Farm kills',
        detail: 'HP-weighted farm credits; first 100 kills per monster species count',
    },
    {
        id: 'diversity',
        label: 'Monster diversity',
        detail: '10+ different monster classes → double all day credits',
    },
    {
        id: 'ek',
        label: 'Enemy Kills (testing)',
        detail: '+10 credits per EK, max 10/day (testing ladder only)',
    },
    {
        id: 'challenge',
        label: 'Timed Challenge clear',
        detail: 'Event participation credits once per day when available',
    },
];

export const TESTNET_DISCORD_URL = 'https://discord.gg/F4NwwbfKtj';
export const TESTNET_NEWS_URL = 'https://chainlords.net/#news';
export const TESTNET_X_HANDLE = '@ChainLordsHQ';
