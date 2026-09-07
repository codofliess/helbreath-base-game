/** Collective $HELBREATH pledged by guild members — not pending $HELL, not personal Olympia. */

export const GUILD_STAKE_TOKEN = '$HELBREATH';
export const GUILD_STAKE_PER_LEVEL = 20_000;
export const GUILD_MAX_LEVEL = 40;
export const GUILD_ACTIVITY_POINTS_PER_LEVEL = 100;
export const GUILD_CONTRIBUTION_WEIGHT = 1;
export const GUILD_EK_WEIGHT = 80;
export const GUILD_GOLD_PER_POINT = 10_000;
export const GUILD_MAJESTIC_WEIGHT = 25;

export interface GuildUnlockRank {
    minLevel: number;
    huntmaster: number;
    raidmaster: number;
    captains: number;
    teleports: string[];
}

export const GUILD_UNLOCK_RANKS: GuildUnlockRank[] = [
    { minLevel: 0, huntmaster: 0, raidmaster: 0, captains: 0, teleports: ['aregldhall', 'elvgldhall'] },
    { minLevel: 1, huntmaster: 1, raidmaster: 0, captains: 1, teleports: ['middleland'] },
    { minLevel: 3, huntmaster: 2, raidmaster: 1, captains: 2, teleports: ['huntzone1', 'huntzone2'] },
    { minLevel: 5, huntmaster: 3, raidmaster: 2, captains: 3, teleports: ['icebound', 'huntzone3'] },
    { minLevel: 8, huntmaster: 4, raidmaster: 3, captains: 4, teleports: ['procella', 'toh1'] },
    { minLevel: 10, huntmaster: 5, raidmaster: 4, captains: 5, teleports: ['promiseland', 'abaddon'] },
    { minLevel: 15, huntmaster: 6, raidmaster: 5, captains: 6, teleports: ['toh2', 'infernia-a'] },
    { minLevel: 20, huntmaster: 8, raidmaster: 6, captains: 8, teleports: ['toh3', 'dglv2'] },
];

export interface GuildProgressionInput {
    contribution: number;
    enemyKills: number;
    gold: number;
    majestics: number;
    stakedHelbreath: number;
}

export interface GuildProgressionSnapshot {
    activityLevel: number;
    stakeBonusLevels: number;
    effectiveLevel: number;
    activityPoints: number;
    stakedHelbreath: number;
    huntmaster: number;
    raidmaster: number;
    captains: number;
    teleports: string[];
}

export function guildStakeBonusLevels(stakedHelbreath: number): number {
    if (!Number.isFinite(stakedHelbreath) || stakedHelbreath <= 0) {
        return 0;
    }
    return Math.min(GUILD_MAX_LEVEL, Math.floor(stakedHelbreath / GUILD_STAKE_PER_LEVEL));
}

export function guildActivityPoints(input: Omit<GuildProgressionInput, 'stakedHelbreath'>): number {
    const goldPts = GUILD_GOLD_PER_POINT > 0 ? Math.floor(Math.max(0, input.gold) / GUILD_GOLD_PER_POINT) : 0;
    return Math.max(
        0,
        Math.max(0, input.contribution) * GUILD_CONTRIBUTION_WEIGHT +
            Math.max(0, input.enemyKills) * GUILD_EK_WEIGHT +
            goldPts +
            Math.max(0, input.majestics) * GUILD_MAJESTIC_WEIGHT,
    );
}

export function guildActivityLevelFromPoints(points: number): number {
    if (points <= 0) {
        return 0;
    }
    let level = 0;
    for (let l = 1; l <= GUILD_MAX_LEVEL; l++) {
        if (points < GUILD_ACTIVITY_POINTS_PER_LEVEL * l * l) {
            break;
        }
        level = l;
    }
    return level;
}

export function resolveGuildUnlocks(effectiveLevel: number): {
    huntmaster: number;
    raidmaster: number;
    captains: number;
    teleports: string[];
} {
    let huntmaster = 0;
    let raidmaster = 0;
    let captains = 0;
    const maps = new Set<string>();
    for (const rank of GUILD_UNLOCK_RANKS) {
        if (effectiveLevel < rank.minLevel) {
            continue;
        }
        huntmaster = Math.max(huntmaster, rank.huntmaster);
        raidmaster = Math.max(raidmaster, rank.raidmaster);
        captains = Math.max(captains, rank.captains);
        for (const map of rank.teleports) {
            maps.add(map);
        }
    }
    return { huntmaster, raidmaster, captains, teleports: [...maps].sort() };
}

export function computeGuildProgression(input: GuildProgressionInput): GuildProgressionSnapshot {
    const activityPoints = guildActivityPoints(input);
    const activityLevel = guildActivityLevelFromPoints(activityPoints);
    const stakeBonusLevels = guildStakeBonusLevels(input.stakedHelbreath);
    const effectiveLevel = Math.min(GUILD_MAX_LEVEL, activityLevel + stakeBonusLevels);
    const unlocks = resolveGuildUnlocks(effectiveLevel);
    return {
        activityLevel,
        stakeBonusLevels,
        effectiveLevel,
        activityPoints,
        stakedHelbreath: Math.max(0, input.stakedHelbreath),
        ...unlocks,
    };
}
