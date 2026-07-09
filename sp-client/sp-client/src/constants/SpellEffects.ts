/**
 * Spell VFX routing — maps spell IDs to dedicated CastManager handlers,
 * reusable spell classes, or generic effect keys.
 */

import {
    EFFECT_ABSOLUTE_MAGIC_PROTECTION,
    EFFECT_BERSERK,
    EFFECT_CANCELLATION,
    EFFECT_CELEBRATING_LIGHT_1,
    EFFECT_DEFENSE_SHIELD,
    EFFECT_EARTH_SHOCK_WAVE_DUST,
    EFFECT_HEAL,
    EFFECT_HOLD_TWIST,
    EFFECT_ILLUSION_MOVEMENT_BASE,
    EFFECT_ILLUSION_MOVEMENT_TORRENT,
    EFFECT_INHIBITION_CASTING_1,
    EFFECT_INVISIBILITY,
    EFFECT_MASS_ILLUSION_MOVEMENT_BASE,
    EFFECT_PARALYZE,
    EFFECT_POISON_DEBUFF,
    EFFECT_PROTECTION_FROM_ARROWS_BUFF,
    EFFECT_PROTECTION_RING,
    EFFECT_RESURRECTION,
    EFFECT_SNOOZE,
    EFFECT_SPARKLE,
    EFFECT_STAMINA_DRAIN,
    EFFECT_STAMINA_RECOVERY,
    EFFECT_UNKNOWN_DEBUFF_1,
    EFFECT_UNKNOWN_RECOVERY,
    EFFECT_UNKNOWN_SMALL_RECOVERY_1,
    EFFECT_BLUE_APPARITION,
    EFFECT_BLUE_ARROW_POINTER,
} from './Effects';
import {
    SPELL_ABSOLUTE_MAGIC_PROTECTION_ID,
    SPELL_ARMOR_BREAK_ID,
    SPELL_BERSERK_ID,
    SPELL_BLOODY_SHOCK_WAVE_ID,
    SPELL_BLIZZARD_ID,
    SPELL_CANCELLATION_ID,
    SPELL_CELEBRATING_LIGHT_ID,
    SPELL_CHILL_WIND_ID,
    SPELL_CLOUD_KILL_ID,
    SPELL_CONFUSE_LANGUAGE_ID,
    SPELL_CONFUSION_ID,
    SPELL_CREATE_FOOD_ID,
    SPELL_CURE_ID,
    SPELL_DEFENSE_SHIELD_ID,
    SPELL_DETECT_INVISIBILITY_ID,
    SPELL_EARTH_SHOCK_WAVE_ID,
    SPELL_EARTHWORM_STRIKE_ID,
    SPELL_ENERGY_BOLT_ID,
    SPELL_ENERGY_STRIKE_ID,
    SPELL_FIRE_BALL_ID,
    SPELL_FIRE_FIELD_ID,
    SPELL_FIRE_STRIKE_ID,
    SPELL_FIRE_WALL_ID,
    SPELL_GREAT_DEFENSE_SHIELD_ID,
    SPELL_GREAT_HEAL_ID,
    SPELL_GREAT_STAMINA_RECOVERY_ID,
    SPELL_HASTE_ID,
    SPELL_HEAL_ID,
    SPELL_HOLD_PERSON_ID,
    SPELL_ICE_STORM_ID,
    SPELL_ICE_STRIKE_ID,
    SPELL_ILLUSION_ID,
    SPELL_ILLUSION_MOVEMENT_ID,
    SPELL_INHIBITION_CASTING_ID,
    SPELL_INVISIBILITY_ID,
    SPELL_LIGHTNING_ARROW_ID,
    SPELL_LIGHTNING_BOLT_ID,
    SPELL_LIGHTNING_ID,
    SPELL_LIGHTNING_STRIKE_ID,
    SPELL_MAGIC_MISSILE_ID,
    SPELL_MASS_BLIZZARD_ID,
    SPELL_MASS_CHILL_WIND_ID,
    SPELL_MASS_CONFUSION_ID,
    SPELL_MASS_FIRE_STRIKE_ID,
    SPELL_MASS_ICE_STRIKE_ID,
    SPELL_MASS_ILLUSION_ID,
    SPELL_MASS_ILLUSION_MOVEMENT_ID,
    SPELL_MASS_LIGHTNING_ARROW_ID,
    SPELL_MASS_MAGIC_MISSILE_ID,
    SPELL_MASS_POISON_ID,
    SPELL_METEOR_STRIKE_ID,
    SPELL_PARALYZE_ID,
    SPELL_POISON_CLOUD_ID,
    SPELL_POISON_ID,
    SPELL_POSSESSION_ID,
    SPELL_PROTECTION_FROM_ARROW_ID,
    SPELL_PROTECTION_FROM_MAGIC_ID,
    SPELL_RECALL_ID,
    SPELL_RESURRECTION_ID,
    SPELL_SCAN_ID,
    SPELL_SPIKE_FIELD_ID,
    SPELL_STAMINA_DRAIN_ID,
    SPELL_STAMINA_RECOVERY_ID,
    SPELL_SUMMON_CREATURE_ID,
    SPELL_TREMOR_ID,
    SPELL_TRIPLE_ENERGY_BOLT_ID,
} from './Spells';

/** Spells handled by the dedicated switch in CastManager.executeDedicatedSpell */
export const DEDICATED_CAST_SPELL_IDS: ReadonlySet<number> = new Set([
    SPELL_EARTH_SHOCK_WAVE_ID,
    SPELL_BLOODY_SHOCK_WAVE_ID,
    SPELL_LIGHTNING_BOLT_ID,
    SPELL_LIGHTNING_STRIKE_ID,
    SPELL_MASS_LIGHTNING_ARROW_ID,
    SPELL_FIRE_FIELD_ID,
    SPELL_ENERGY_STRIKE_ID,
    SPELL_ENERGY_BOLT_ID,
    SPELL_TRIPLE_ENERGY_BOLT_ID,
    SPELL_FIRE_BALL_ID,
    SPELL_FIRE_STRIKE_ID,
    SPELL_MASS_FIRE_STRIKE_ID,
    SPELL_FIRE_WALL_ID,
    SPELL_CHILL_WIND_ID,
    SPELL_MASS_CHILL_WIND_ID,
    SPELL_POISON_CLOUD_ID,
    SPELL_SPIKE_FIELD_ID,
    SPELL_ICE_STORM_ID,
    SPELL_ICE_STRIKE_ID,
    SPELL_MASS_ICE_STRIKE_ID,
    SPELL_METEOR_STRIKE_ID,
    SPELL_EARTHWORM_STRIKE_ID,
    SPELL_ARMOR_BREAK_ID,
    SPELL_BLIZZARD_ID,
    SPELL_MASS_BLIZZARD_ID,
]);

/** Spells with logic only — no combat VFX needed */
export const UTILITY_ONLY_SPELL_IDS: ReadonlySet<number> = new Set([
    SPELL_RECALL_ID,
    SPELL_CREATE_FOOD_ID,
]);

export type GenericSpellVfxKind =
    | 'energy-bolt'
    | 'lightning-bolt'
    | 'energy-strike'
    | 'poison-cloud'
    | 'effect'
    | 'effects';

export interface GenericSpellVfxConfig {
    kind: GenericSpellVfxKind;
    effectKey?: string;
    effectKeys?: string[];
    infiniteLoop?: boolean;
    /** Play at caster position instead of target (self-buffs) */
    atCaster?: boolean;
}

/** Fallback VFX for spells without a dedicated CastManager case */
export const GENERIC_SPELL_VFX: Partial<Record<number, GenericSpellVfxConfig>> = {
    [SPELL_MAGIC_MISSILE_ID]: { kind: 'energy-bolt' },
    [SPELL_HEAL_ID]: { kind: 'effect', effectKey: EFFECT_HEAL, atCaster: true },
    [SPELL_STAMINA_DRAIN_ID]: { kind: 'effect', effectKey: EFFECT_STAMINA_DRAIN },
    [SPELL_DEFENSE_SHIELD_ID]: { kind: 'effect', effectKey: EFFECT_DEFENSE_SHIELD, atCaster: true },
    [SPELL_CELEBRATING_LIGHT_ID]: { kind: 'effect', effectKey: EFFECT_CELEBRATING_LIGHT_1, atCaster: true },
    [SPELL_GREAT_HEAL_ID]: { kind: 'effect', effectKey: EFFECT_UNKNOWN_RECOVERY, atCaster: true },
    [SPELL_STAMINA_RECOVERY_ID]: { kind: 'effect', effectKey: EFFECT_STAMINA_RECOVERY, atCaster: true },
    [SPELL_PROTECTION_FROM_ARROW_ID]: { kind: 'effect', effectKey: EFFECT_PROTECTION_FROM_ARROWS_BUFF, atCaster: true },
    [SPELL_HOLD_PERSON_ID]: { kind: 'effect', effectKey: EFFECT_HOLD_TWIST },
    [SPELL_POSSESSION_ID]: { kind: 'effect', effectKey: EFFECT_SNOOZE },
    [SPELL_POISON_ID]: { kind: 'effect', effectKey: EFFECT_POISON_DEBUFF },
    [SPELL_GREAT_STAMINA_RECOVERY_ID]: { kind: 'effect', effectKey: EFFECT_UNKNOWN_SMALL_RECOVERY_1, atCaster: true },
    [SPELL_SUMMON_CREATURE_ID]: { kind: 'effect', effectKey: EFFECT_BLUE_APPARITION, atCaster: true },
    [SPELL_INVISIBILITY_ID]: { kind: 'effect', effectKey: EFFECT_INVISIBILITY, atCaster: true },
    [SPELL_PROTECTION_FROM_MAGIC_ID]: { kind: 'effect', effectKey: EFFECT_PROTECTION_RING, atCaster: true },
    [SPELL_DETECT_INVISIBILITY_ID]: { kind: 'effect', effectKey: EFFECT_SPARKLE, atCaster: true },
    [SPELL_PARALYZE_ID]: { kind: 'effect', effectKey: EFFECT_PARALYZE },
    [SPELL_CURE_ID]: { kind: 'effect', effectKey: EFFECT_HEAL },
    [SPELL_LIGHTNING_ARROW_ID]: { kind: 'energy-bolt' },
    [SPELL_TREMOR_ID]: { kind: 'effect', effectKey: EFFECT_EARTH_SHOCK_WAVE_DUST },
    [SPELL_CONFUSE_LANGUAGE_ID]: { kind: 'effect', effectKey: EFFECT_UNKNOWN_DEBUFF_1 },
    [SPELL_LIGHTNING_ID]: { kind: 'lightning-bolt' },
    [SPELL_GREAT_DEFENSE_SHIELD_ID]: { kind: 'effect', effectKey: EFFECT_DEFENSE_SHIELD, atCaster: true },
    [SPELL_BERSERK_ID]: { kind: 'effect', effectKey: EFFECT_BERSERK, atCaster: true },
    [SPELL_MASS_POISON_ID]: { kind: 'poison-cloud' },
    [SPELL_CONFUSION_ID]: { kind: 'effect', effectKey: EFFECT_SNOOZE },
    [SPELL_ABSOLUTE_MAGIC_PROTECTION_ID]: { kind: 'effect', effectKey: EFFECT_ABSOLUTE_MAGIC_PROTECTION, atCaster: true },
    [SPELL_SCAN_ID]: { kind: 'effect', effectKey: EFFECT_BLUE_ARROW_POINTER },
    [SPELL_MASS_CONFUSION_ID]: { kind: 'effect', effectKey: EFFECT_SNOOZE },
    [SPELL_CLOUD_KILL_ID]: { kind: 'poison-cloud' },
    [SPELL_CANCELLATION_ID]: { kind: 'effect', effectKey: EFFECT_CANCELLATION },
    [SPELL_ILLUSION_MOVEMENT_ID]: {
        kind: 'effects',
        effectKeys: [EFFECT_ILLUSION_MOVEMENT_BASE, EFFECT_ILLUSION_MOVEMENT_TORRENT],
    },
    [SPELL_HASTE_ID]: { kind: 'effect', effectKey: EFFECT_UNKNOWN_SMALL_RECOVERY_1, atCaster: true },
    [SPELL_ILLUSION_ID]: { kind: 'effect', effectKey: EFFECT_BLUE_APPARITION },
    [SPELL_MASS_MAGIC_MISSILE_ID]: { kind: 'energy-strike' },
    [SPELL_INHIBITION_CASTING_ID]: { kind: 'effect', effectKey: EFFECT_INHIBITION_CASTING_1 },
    [SPELL_MASS_ILLUSION_ID]: { kind: 'effect', effectKey: EFFECT_MASS_ILLUSION_MOVEMENT_BASE },
    [SPELL_RESURRECTION_ID]: { kind: 'effect', effectKey: EFFECT_RESURRECTION },
    [SPELL_MASS_ILLUSION_MOVEMENT_ID]: { kind: 'effect', effectKey: EFFECT_MASS_ILLUSION_MOVEMENT_BASE },
};

export function hasDedicatedCastHandler(spellId: number): boolean {
    return DEDICATED_CAST_SPELL_IDS.has(spellId);
}

export function isUtilityOnlySpell(spellId: number): boolean {
    return UTILITY_ONLY_SPELL_IDS.has(spellId);
}

export function getGenericSpellVfx(spellId: number): GenericSpellVfxConfig | undefined {
    return GENERIC_SPELL_VFX[spellId];
}

/** Self-cast heal/buff spells that auto-confirm without a ground click */
export function isSelfCastHealOrBuff(spellId: number): boolean {
    const vfx = GENERIC_SPELL_VFX[spellId];
    return vfx?.atCaster === true;
}