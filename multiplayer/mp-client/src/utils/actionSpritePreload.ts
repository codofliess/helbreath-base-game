import type { PhaserSceneLike } from '../game/phaserHubTypes';

import { AssetType, getPlayerItemAppearanceAssetData, type AssetData } from '../constants/Assets';
import {
    EFFECT_ENERGY_BOLT_EXPLOSION,
    EFFECT_FIRE_BALL_EXPLOSION,
    EFFECT_ICE_STRIKE_LARGE_SHARD,
    EFFECT_LIGHTNING_ARC,
    EFFECT_MASS_CHILL_WIND_DROPLET,
    EFFECT_POISON_CLOUD,
    EFFECT_SPIKE_FIELD,
    ENERGY_BOLT_PROJECTILE,
    getEffectByKey,
} from '../constants/Effects';
import { getGenericSpellVfx } from '../constants/SpellEffects';
import {
    SPELL_CHILL_WIND_ID,
    SPELL_ENERGY_BOLT_ID,
    SPELL_ENERGY_STRIKE_ID,
    SPELL_FIRE_BALL_ID,
    SPELL_FIRE_STRIKE_ID,
    SPELL_FIRE_WALL_ID,
    SPELL_ICE_STORM_ID,
    SPELL_ICE_STRIKE_ID,
    SPELL_LIGHTNING_BOLT_ID,
    SPELL_LIGHTNING_STRIKE_ID,
    SPELL_MASS_CHILL_WIND_ID,
    SPELL_MASS_FIRE_STRIKE_ID,
    SPELL_MASS_ICE_STRIKE_ID,
    SPELL_MASS_LIGHTNING_ARROW_ID,
    SPELL_POISON_CLOUD_ID,
    SPELL_SPIKE_FIELD_ID,
    SPELL_TRIPLE_ENERGY_BOLT_ID,
} from '../constants/Spells';
import { SpriteType } from '../game/assets/HBSprite';
import { fetchGameAssetArrayBuffer } from './gameAssetHttp';
import { loadSpriteAssetOnDemand } from './SpriteHttpLoader';

/**
 * Sheets the live client must have cached before the player runs, shows gear, or
 * casts. Olympia (`reference/Client.cpp` MakeSprite item-equipM/W, then
 * DrawObject_OnRun → PutSpriteFast) draws those frames on the action frame
 * because the pak surfaces are already open. This client only decoded idle body
 * sheets at enter and held clothes until `MAP_ENTER_HEAVY_DECODE_MS`.
 *
 * Human run is `HUMAN_SPRITESHEET_BASE[Run]` (32) plus 8 facings.
 * Armour run is sheet 4; idle combat stand is sheet 1 (attack mode defaults on).
 * Weapon run is armament state 6 × 8 facings.
 */

/** Body run facings. Idle 0–7 stay on the enter path. */
export const HUMAN_RUN_SHEETS = [32, 33, 34, 35, 36, 37, 38, 39] as const;

/** Armour / hair / underwear: peace stand, combat stand, run. Not bow/melee/cast. */
export const ARMOUR_ACTION_SHEETS = [0, 1, 4] as const;

/** Weapon idle-combat state and run state (8 facings each). */
const WEAPON_IDLE_COMBAT_STATE = 1;
const WEAPON_RUN_STATE = 6;

/** Angel idle/run shares state 5 (sheets 40–47). */
const ACCESSORY_ACTION_SHEETS = [40, 41, 42, 43, 44, 45, 46, 47] as const;

/**
 * Unique spell VFX sheets decoded ahead of a cast. The full catalog OOMs enter;
 * shortcuts and the starter combat spells fit under this cap.
 */
export const MAX_SPELL_EFFECT_PRELOAD_SHEETS = 12;

export type EquippedActionLayer = {
    spriteName: string;
    kind: 'armour' | 'weapon' | 'shield' | 'accessory';
    packBase?: number;
};

export type ActionPreloadLook = {
    humanSpriteName: string;
    hairSpriteName: string;
    underwearSpriteName: string;
    hairStyleIndex: number;
    underwearColorIndex: number;
    equipment: readonly EquippedActionLayer[];
};

export type ActionSpriteJob = {
    asset: AssetData;
    sheets: number[];
};

const binaryPrimePromises = new Map<string, Promise<void>>();

const DEDICATED_EFFECT_KEYS: Partial<Record<number, readonly string[]>> = {
    [SPELL_ENERGY_BOLT_ID]: [ENERGY_BOLT_PROJECTILE, EFFECT_ENERGY_BOLT_EXPLOSION],
    [SPELL_TRIPLE_ENERGY_BOLT_ID]: [ENERGY_BOLT_PROJECTILE, EFFECT_ENERGY_BOLT_EXPLOSION],
    [SPELL_ENERGY_STRIKE_ID]: [ENERGY_BOLT_PROJECTILE],
    [SPELL_FIRE_BALL_ID]: [EFFECT_FIRE_BALL_EXPLOSION],
    [SPELL_FIRE_STRIKE_ID]: [EFFECT_FIRE_BALL_EXPLOSION],
    [SPELL_MASS_FIRE_STRIKE_ID]: [EFFECT_FIRE_BALL_EXPLOSION],
    [SPELL_FIRE_WALL_ID]: [EFFECT_FIRE_BALL_EXPLOSION],
    [SPELL_POISON_CLOUD_ID]: [EFFECT_POISON_CLOUD],
    [SPELL_LIGHTNING_BOLT_ID]: [EFFECT_LIGHTNING_ARC],
    [SPELL_LIGHTNING_STRIKE_ID]: [EFFECT_LIGHTNING_ARC],
    [SPELL_MASS_LIGHTNING_ARROW_ID]: [EFFECT_LIGHTNING_ARC],
    [SPELL_CHILL_WIND_ID]: [EFFECT_MASS_CHILL_WIND_DROPLET],
    [SPELL_MASS_CHILL_WIND_ID]: [EFFECT_MASS_CHILL_WIND_DROPLET],
    [SPELL_ICE_STRIKE_ID]: [EFFECT_ICE_STRIKE_LARGE_SHARD],
    [SPELL_MASS_ICE_STRIKE_ID]: [EFFECT_ICE_STRIKE_LARGE_SHARD],
    [SPELL_ICE_STORM_ID]: [EFFECT_ICE_STRIKE_LARGE_SHARD],
    [SPELL_SPIKE_FIELD_ID]: [EFFECT_SPIKE_FIELD],
};

/** Projectile atlases that are not a named effect key (Fire Ball / Fire Strike sheet 5). */
const DEDICATED_RAW_SHEETS: Partial<Record<number, ReadonlyArray<{ sprite: string; sheet: number }>>> = {
    [SPELL_FIRE_BALL_ID]: [{ sprite: 'effect', sheet: 5 }],
    [SPELL_FIRE_STRIKE_ID]: [{ sprite: 'effect', sheet: 5 }],
    [SPELL_MASS_FIRE_STRIKE_ID]: [{ sprite: 'effect', sheet: 5 }],
    [SPELL_FIRE_WALL_ID]: [{ sprite: 'effect', sheet: 5 }],
    [SPELL_ENERGY_STRIKE_ID]: [{ sprite: 'effect', sheet: 0 }],
};

function uniqueSorted(sheets: Iterable<number>): number[] {
    return [...new Set(sheets)].filter((sheet) => sheet >= 0).sort((a, b) => a - b);
}

function offsetSheets(bases: readonly number[], packBase: number): number[] {
    const pack = Math.max(0, packBase);
    return uniqueSorted(bases.map((sheet) => sheet + pack));
}

function weaponActionSheets(packBase: number): number[] {
    const pack = Math.max(0, packBase);
    const sheets: number[] = [];
    for (let dir = 0; dir < 8; dir += 1) {
        sheets.push(pack + WEAPON_IDLE_COMBAT_STATE * 8 + dir);
        sheets.push(pack + WEAPON_RUN_STATE * 8 + dir);
    }
    return uniqueSorted(sheets);
}

function jobForNamedSprite(spriteName: string, sheets: readonly number[]): ActionSpriteJob {
    return {
        asset: getPlayerItemAppearanceAssetData(spriteName),
        sheets: uniqueSorted(sheets),
    };
}

function effectJob(sprite: string, sheet: number): ActionSpriteJob {
    return {
        asset: {
            key: `sprite-${sprite}`,
            fileName: `${sprite}.spr`,
            assetType: AssetType.SPRITE,
            spriteType: SpriteType.Effect,
        },
        sheets: [sheet],
    };
}

/**
 * Body run facings, hair/underwear run sheet, and equipped stand+run sheets.
 * Does not include the 16s enter gate.
 */
export function buildBodyAndEquipmentJobs(look: ActionPreloadLook): ActionSpriteJob[] {
    const jobs: ActionSpriteJob[] = [
        jobForNamedSprite(look.humanSpriteName, HUMAN_RUN_SHEETS),
    ];
    const hairStyle = Math.max(0, Math.min(7, look.hairStyleIndex | 0));
    if (hairStyle !== 2 && look.hairSpriteName) {
        jobs.push(jobForNamedSprite(look.hairSpriteName, [hairStyle * 12 + 4]));
    }
    const underwearColor = Math.max(0, Math.min(7, look.underwearColorIndex | 0));
    if (look.underwearSpriteName) {
        jobs.push(jobForNamedSprite(look.underwearSpriteName, [underwearColor * 12 + 4]));
    }
    for (const layer of look.equipment) {
        if (!layer.spriteName) {
            continue;
        }
        const pack = Math.max(0, layer.packBase ?? 0);
        if (layer.kind === 'weapon') {
            jobs.push(jobForNamedSprite(layer.spriteName, weaponActionSheets(pack)));
        } else if (layer.kind === 'shield') {
            jobs.push(jobForNamedSprite(layer.spriteName, offsetSheets([0, 1, WEAPON_RUN_STATE], pack)));
        } else if (layer.kind === 'accessory') {
            jobs.push(jobForNamedSprite(layer.spriteName, ACCESSORY_ACTION_SHEETS));
        } else {
            jobs.push(jobForNamedSprite(layer.spriteName, offsetSheets(ARMOUR_ACTION_SHEETS, pack)));
        }
    }
    return dedupeJobs(jobs);
}

function pushEffectKey(target: Map<string, { sprite: string; sheet: number }>, key: string): void {
    const config = getEffectByKey(key);
    if (!config) {
        return;
    }
    const id = `${config.sprite}:${config.spriteSheetIndex}`;
    if (!target.has(id)) {
        target.set(id, { sprite: config.sprite, sheet: config.spriteSheetIndex });
    }
}

function pushRaw(
    target: Map<string, { sprite: string; sheet: number }>,
    sprite: string,
    sheet: number,
): void {
    const id = `${sprite}:${sheet}`;
    if (!target.has(id)) {
        target.set(id, { sprite, sheet });
    }
}

/** One sheet per VFX the spell actually draws, in spell-id order, capped. */
export function buildSpellEffectJobs(spellIds: readonly number[]): ActionSpriteJob[] {
    const sheets = new Map<string, { sprite: string; sheet: number }>();
    for (const spellId of spellIds) {
        if (sheets.size >= MAX_SPELL_EFFECT_PRELOAD_SHEETS) {
            break;
        }
        const generic = getGenericSpellVfx(spellId);
        if (generic?.kind === 'energy-bolt' || generic?.kind === 'energy-strike') {
            pushEffectKey(sheets, ENERGY_BOLT_PROJECTILE);
            pushEffectKey(sheets, EFFECT_ENERGY_BOLT_EXPLOSION);
        } else if (generic?.kind === 'lightning-bolt') {
            pushEffectKey(sheets, EFFECT_LIGHTNING_ARC);
        } else if (generic?.kind === 'poison-cloud') {
            pushEffectKey(sheets, EFFECT_POISON_CLOUD);
        } else if (generic?.effectKey) {
            pushEffectKey(sheets, generic.effectKey);
        } else if (generic?.effectKeys) {
            for (const key of generic.effectKeys) {
                pushEffectKey(sheets, key);
            }
        }
        const dedicated = DEDICATED_EFFECT_KEYS[spellId];
        if (dedicated) {
            for (const key of dedicated) {
                pushEffectKey(sheets, key);
            }
        }
        const raw = DEDICATED_RAW_SHEETS[spellId];
        if (raw) {
            for (const row of raw) {
                pushRaw(sheets, row.sprite, row.sheet);
            }
        }
    }
    const jobs: ActionSpriteJob[] = [];
    for (const row of sheets.values()) {
        if (jobs.length >= MAX_SPELL_EFFECT_PRELOAD_SHEETS) {
            break;
        }
        jobs.push(effectJob(row.sprite, row.sheet));
    }
    return dedupeJobs(jobs);
}

function dedupeJobs(jobs: readonly ActionSpriteJob[]): ActionSpriteJob[] {
    const byKey = new Map<string, ActionSpriteJob>();
    for (const job of jobs) {
        const id = job.asset.key;
        const existing = byKey.get(id);
        if (!existing) {
            byKey.set(id, { asset: job.asset, sheets: uniqueSorted(job.sheets) });
            continue;
        }
        existing.sheets = uniqueSorted([...existing.sheets, ...job.sheets]);
    }
    return [...byKey.values()];
}

async function primeSpriteBinary(scene: PhaserSceneLike, asset: AssetData): Promise<void> {
    if (scene.cache?.binary?.exists?.(asset.key)) {
        return;
    }
    const existing = binaryPrimePromises.get(asset.key);
    if (existing) {
        return existing;
    }
    const promise = (async () => {
        if (scene.cache.binary.exists(asset.key)) {
            return;
        }
        const buffer = await fetchGameAssetArrayBuffer('sprites', asset.fileName);
        if (!scene.cache.binary.exists(asset.key)) {
            scene.cache.binary.add(asset.key, buffer);
        }
    })().finally(() => {
        binaryPrimePromises.delete(asset.key);
    });
    binaryPrimePromises.set(asset.key, promise);
    return promise;
}

type SceneQueue = {
    jobs: ActionSpriteJob[];
    flush: Promise<void> | undefined;
};

const queues = new WeakMap<object, SceneQueue>();

/**
 * Fetch `.spr` bytes in parallel, then decode the requested sheets one at a time
 * ahead of queued tile work. Already-registered sheets are skipped by the loader.
 */
export function preloadActionSpriteJobs(
    scene: PhaserSceneLike,
    jobs: readonly ActionSpriteJob[],
): Promise<void> {
    let queue = queues.get(scene);
    if (!queue) {
        queue = { jobs: [], flush: undefined };
        queues.set(scene, queue);
    }
    if (jobs.length > 0) {
        queue.jobs.push(...jobs);
    }
    if (queue.jobs.length === 0) {
        return queue.flush ?? Promise.resolve();
    }
    if (queue.flush) {
        return queue.flush;
    }
    const run = flushActionSpriteQueue(scene, queue).finally(() => {
        const current = queues.get(scene);
        if (current) {
            current.flush = undefined;
            if (current.jobs.length > 0) {
                void preloadActionSpriteJobs(scene, []);
            }
        }
    });
    queue.flush = run;
    return run;
}

async function flushActionSpriteQueue(scene: PhaserSceneLike, queue: SceneQueue): Promise<void> {
    while (queue.jobs.length > 0) {
        const batch = dedupeJobs(queue.jobs);
        queue.jobs = [];
        await Promise.all(
            batch.map(async (job) => {
                try {
                    await primeSpriteBinary(scene, job.asset);
                } catch (error) {
                    console.warn(`[actionSpritePreload] fetch skipped ${job.asset.fileName}`, error);
                }
            }),
        );
        for (const job of batch) {
            try {
                await loadSpriteAssetOnDemand(scene, job.asset, {
                    sheetIndices: new Set(job.sheets),
                    priority: true,
                });
            } catch (error) {
                console.warn(`[actionSpritePreload] decode skipped ${job.asset.fileName}`, error);
            }
        }
    }
}
