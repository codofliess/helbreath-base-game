/**
 * Helbreath Olympia spell roster — IDs match Magic.cfg magic numbers.
 * Circle = tens digit + 1 (0–9 → circle 1, 10–19 → circle 2, … 90–99 → circle 10).
 */

export type SpellEffectType =
    | 'energy'
    | 'fire'
    | 'ice'
    | 'lightning'
    | 'poison'
    | 'holy'
    | 'dark'
    | 'earth'
    | 'meteor'
    | 'blizzard'
    | 'physical'
    | 'none';

export type SpellTargetType = 'self' | 'entity' | 'ground' | 'field';

export type SpellCategory = 'offensive' | 'heal' | 'buff' | 'utility' | 'summon' | 'field';

/** How the spell is obtained — shop/drop lists filled in a later pass. */
export type SpellAcquisition = 'default' | 'shop' | 'drop';

export interface SpellConfig {
    /** Helbreath magic ID (Magic.cfg) */
    id: number;
    name: string;
    circle: number;
    baseDamage: number;
    mpCost: number;
    effectType: SpellEffectType;
    targetType: SpellTargetType;
    category: SpellCategory;
    /** Whether combat VFX exists in the client */
    hasVfx: boolean;
    acquisition: SpellAcquisition;
}

export function getSpellCircle(magicId: number): number {
    return magicId < 10 ? 1 : Math.floor(magicId / 10) + 1;
}

export const SPELL_MAGIC_MISSILE_ID = 0;
export const SPELL_HEAL_ID = 1;
export const SPELL_CREATE_FOOD_ID = 2;
export const SPELL_ENERGY_BOLT_ID = 10;
export const SPELL_STAMINA_DRAIN_ID = 11;
export const SPELL_RECALL_ID = 12;
export const SPELL_DEFENSE_SHIELD_ID = 13;
export const SPELL_CELEBRATING_LIGHT_ID = 14;
export const SPELL_FIRE_BALL_ID = 20;
export const SPELL_GREAT_HEAL_ID = 21;
export const SPELL_STAMINA_RECOVERY_ID = 23;
export const SPELL_PROTECTION_FROM_ARROW_ID = 24;
export const SPELL_HOLD_PERSON_ID = 25;
export const SPELL_POSSESSION_ID = 26;
export const SPELL_POISON_ID = 27;
export const SPELL_GREAT_STAMINA_RECOVERY_ID = 28;
export const SPELL_FIRE_STRIKE_ID = 30;
export const SPELL_SUMMON_CREATURE_ID = 31;
export const SPELL_INVISIBILITY_ID = 32;
export const SPELL_PROTECTION_FROM_MAGIC_ID = 33;
export const SPELL_DETECT_INVISIBILITY_ID = 34;
export const SPELL_PARALYZE_ID = 35;
export const SPELL_CURE_ID = 36;
export const SPELL_LIGHTNING_ARROW_ID = 37;
export const SPELL_TREMOR_ID = 38;
export const SPELL_FIRE_WALL_ID = 40;
export const SPELL_FIRE_FIELD_ID = 41;
export const SPELL_CONFUSE_LANGUAGE_ID = 42;
export const SPELL_LIGHTNING_ID = 43;
export const SPELL_GREAT_DEFENSE_SHIELD_ID = 44;
export const SPELL_CHILL_WIND_ID = 45;
export const SPELL_POISON_CLOUD_ID = 46;
export const SPELL_TRIPLE_ENERGY_BOLT_ID = 47;
export const SPELL_BERSERK_ID = 50;
export const SPELL_LIGHTNING_BOLT_ID = 51;
export const SPELL_MASS_POISON_ID = 53;
export const SPELL_SPIKE_FIELD_ID = 54;
export const SPELL_ICE_STORM_ID = 55;
export const SPELL_MASS_LIGHTNING_ARROW_ID = 56;
export const SPELL_ICE_STRIKE_ID = 57;
export const SPELL_ENERGY_STRIKE_ID = 60;
export const SPELL_MASS_FIRE_STRIKE_ID = 61;
export const SPELL_CONFUSION_ID = 62;
export const SPELL_MASS_CHILL_WIND_ID = 63;
export const SPELL_EARTHWORM_STRIKE_ID = 64;
export const SPELL_ABSOLUTE_MAGIC_PROTECTION_ID = 65;
export const SPELL_ARMOR_BREAK_ID = 66;
export const SPELL_SCAN_ID = 67;
export const SPELL_BLOODY_SHOCK_WAVE_ID = 70;
export const SPELL_MASS_CONFUSION_ID = 71;
export const SPELL_MASS_ICE_STRIKE_ID = 72;
export const SPELL_CLOUD_KILL_ID = 73;
export const SPELL_LIGHTNING_STRIKE_ID = 74;
export const SPELL_CANCELLATION_ID = 76;
export const SPELL_ILLUSION_MOVEMENT_ID = 77;
export const SPELL_HASTE_ID = 78;
export const SPELL_ILLUSION_ID = 80;
export const SPELL_METEOR_STRIKE_ID = 81;
export const SPELL_MASS_MAGIC_MISSILE_ID = 82;
export const SPELL_INHIBITION_CASTING_ID = 83;
export const SPELL_MASS_ILLUSION_ID = 90;
export const SPELL_BLIZZARD_ID = 91;
export const SPELL_RESURRECTION_ID = 94;
export const SPELL_MASS_ILLUSION_MOVEMENT_ID = 95;
export const SPELL_EARTH_SHOCK_WAVE_ID = 96;
/** Olympia extension — rare drop (Nizie, Ice Wyvern, Abaddon, etc.) */
export const SPELL_MASS_BLIZZARD_ID = 97;

export const SPELLS: SpellConfig[] = [
    // Circle 1
    { id: 0, name: 'Magic Missile', baseDamage: 8, mpCost: 8, effectType: 'energy', targetType: 'entity', category: 'offensive', circle: 1, hasVfx: true, acquisition: 'shop' },
    { id: 1, name: 'Heal', baseDamage: 0, mpCost: 15, effectType: 'holy', targetType: 'self', category: 'heal', circle: 1, hasVfx: true, acquisition: 'shop' },
    { id: 2, name: 'Create Food', baseDamage: 0, mpCost: 18, effectType: 'none', targetType: 'ground', category: 'utility', circle: 1, hasVfx: false, acquisition: 'shop' },
    // Circle 2
    { id: 10, name: 'Energy Bolt', baseDamage: 45, mpCost: 15, effectType: 'energy', targetType: 'entity', category: 'offensive', circle: 2, hasVfx: true, acquisition: 'shop' },
    { id: 11, name: 'Stamina Drain', baseDamage: 0, mpCost: 14, effectType: 'dark', targetType: 'entity', category: 'offensive', circle: 2, hasVfx: true, acquisition: 'shop' },
    { id: 12, name: 'Recall', baseDamage: 0, mpCost: 15, effectType: 'none', targetType: 'self', category: 'utility', circle: 2, hasVfx: false, acquisition: 'shop' },
    { id: 13, name: 'Defense Shield', baseDamage: 0, mpCost: 19, effectType: 'holy', targetType: 'self', category: 'buff', circle: 2, hasVfx: true, acquisition: 'shop' },
    { id: 14, name: 'Celebrating Light', baseDamage: 0, mpCost: 20, effectType: 'holy', targetType: 'self', category: 'utility', circle: 2, hasVfx: true, acquisition: 'shop' },
    // Circle 3
    { id: 20, name: 'Fire Ball', baseDamage: 68, mpCost: 27, effectType: 'fire', targetType: 'entity', category: 'offensive', circle: 3, hasVfx: true, acquisition: 'shop' },
    { id: 21, name: 'Great Heal', baseDamage: 0, mpCost: 28, effectType: 'holy', targetType: 'self', category: 'heal', circle: 3, hasVfx: true, acquisition: 'shop' },
    { id: 23, name: 'Stamina Recovery', baseDamage: 0, mpCost: 20, effectType: 'holy', targetType: 'self', category: 'heal', circle: 3, hasVfx: true, acquisition: 'shop' },
    { id: 24, name: 'Protection From Arrow', baseDamage: 0, mpCost: 22, effectType: 'holy', targetType: 'self', category: 'buff', circle: 3, hasVfx: true, acquisition: 'shop' },
    { id: 25, name: 'Hold Person', baseDamage: 0, mpCost: 24, effectType: 'dark', targetType: 'entity', category: 'offensive', circle: 3, hasVfx: true, acquisition: 'shop' },
    { id: 26, name: 'Possession', baseDamage: 0, mpCost: 25, effectType: 'dark', targetType: 'entity', category: 'offensive', circle: 3, hasVfx: true, acquisition: 'shop' },
    { id: 27, name: 'Poison', baseDamage: 40, mpCost: 28, effectType: 'poison', targetType: 'entity', category: 'offensive', circle: 3, hasVfx: true, acquisition: 'shop' },
    { id: 28, name: 'Great Stamina Recovery', baseDamage: 0, mpCost: 45, effectType: 'holy', targetType: 'self', category: 'heal', circle: 3, hasVfx: true, acquisition: 'shop' },
    // Circle 4
    { id: 30, name: 'Fire Strike', baseDamage: 95, mpCost: 36, effectType: 'fire', targetType: 'entity', category: 'offensive', circle: 4, hasVfx: true, acquisition: 'shop' },
    { id: 31, name: 'Summon Creature', baseDamage: 0, mpCost: 35, effectType: 'dark', targetType: 'self', category: 'summon', circle: 4, hasVfx: true, acquisition: 'shop' },
    { id: 32, name: 'Invisibility', baseDamage: 0, mpCost: 31, effectType: 'dark', targetType: 'self', category: 'buff', circle: 4, hasVfx: true, acquisition: 'shop' },
    { id: 33, name: 'Protection From Magic', baseDamage: 0, mpCost: 35, effectType: 'holy', targetType: 'self', category: 'buff', circle: 4, hasVfx: true, acquisition: 'shop' },
    { id: 34, name: 'Detect Invisibility', baseDamage: 0, mpCost: 33, effectType: 'holy', targetType: 'self', category: 'utility', circle: 4, hasVfx: true, acquisition: 'shop' },
    { id: 35, name: 'Paralyze', baseDamage: 0, mpCost: 35, effectType: 'dark', targetType: 'entity', category: 'offensive', circle: 4, hasVfx: true, acquisition: 'shop' },
    { id: 36, name: 'Cure', baseDamage: 0, mpCost: 32, effectType: 'holy', targetType: 'entity', category: 'heal', circle: 4, hasVfx: true, acquisition: 'shop' },
    { id: 37, name: 'Lightning Arrow', baseDamage: 55, mpCost: 32, effectType: 'lightning', targetType: 'entity', category: 'offensive', circle: 4, hasVfx: true, acquisition: 'shop' },
    { id: 38, name: 'Tremor', baseDamage: 80, mpCost: 34, effectType: 'earth', targetType: 'ground', category: 'offensive', circle: 4, hasVfx: true, acquisition: 'shop' },
    // Circle 5
    { id: 40, name: 'Fire Wall', baseDamage: 35, mpCost: 42, effectType: 'fire', targetType: 'ground', category: 'field', circle: 5, hasVfx: true, acquisition: 'shop' },
    { id: 41, name: 'Fire Field', baseDamage: 35, mpCost: 48, effectType: 'fire', targetType: 'ground', category: 'field', circle: 5, hasVfx: true, acquisition: 'shop' },
    { id: 42, name: 'Confuse Language', baseDamage: 0, mpCost: 40, effectType: 'dark', targetType: 'entity', category: 'offensive', circle: 5, hasVfx: true, acquisition: 'shop' },
    { id: 43, name: 'Lightning', baseDamage: 90, mpCost: 44, effectType: 'lightning', targetType: 'entity', category: 'offensive', circle: 5, hasVfx: true, acquisition: 'shop' },
    { id: 44, name: 'Great Defense Shield', baseDamage: 0, mpCost: 45, effectType: 'holy', targetType: 'self', category: 'buff', circle: 5, hasVfx: true, acquisition: 'shop' },
    { id: 45, name: 'Chill Wind', baseDamage: 55, mpCost: 48, effectType: 'ice', targetType: 'ground', category: 'offensive', circle: 5, hasVfx: true, acquisition: 'shop' },
    { id: 46, name: 'Poison Cloud', baseDamage: 40, mpCost: 48, effectType: 'poison', targetType: 'ground', category: 'field', circle: 5, hasVfx: true, acquisition: 'shop' },
    { id: 47, name: 'Triple Energy Bolt', baseDamage: 135, mpCost: 40, effectType: 'energy', targetType: 'entity', category: 'offensive', circle: 5, hasVfx: true, acquisition: 'shop' },
    // Circle 6
    { id: 50, name: 'Berserk', baseDamage: 0, mpCost: 57, effectType: 'fire', targetType: 'self', category: 'buff', circle: 6, hasVfx: true, acquisition: 'shop' },
    { id: 51, name: 'Lightning Bolt', baseDamage: 110, mpCost: 58, effectType: 'lightning', targetType: 'entity', category: 'offensive', circle: 6, hasVfx: true, acquisition: 'shop' },
    { id: 53, name: 'Mass Poison', baseDamage: 60, mpCost: 54, effectType: 'poison', targetType: 'ground', category: 'offensive', circle: 6, hasVfx: true, acquisition: 'shop' },
    { id: 54, name: 'Spike Field', baseDamage: 80, mpCost: 56, effectType: 'earth', targetType: 'ground', category: 'field', circle: 6, hasVfx: true, acquisition: 'shop' },
    { id: 55, name: 'Ice Storm', baseDamage: 120, mpCost: 58, effectType: 'ice', targetType: 'ground', category: 'field', circle: 6, hasVfx: true, acquisition: 'shop' },
    { id: 56, name: 'Mass Lightning Arrow', baseDamage: 140, mpCost: 55, effectType: 'lightning', targetType: 'entity', category: 'offensive', circle: 6, hasVfx: true, acquisition: 'shop' },
    { id: 57, name: 'Ice Strike', baseDamage: 150, mpCost: 59, effectType: 'ice', targetType: 'ground', category: 'offensive', circle: 6, hasVfx: true, acquisition: 'shop' },
    // Circle 7
    { id: 60, name: 'Energy Strike', baseDamage: 165, mpCost: 65, effectType: 'energy', targetType: 'ground', category: 'offensive', circle: 7, hasVfx: true, acquisition: 'shop' },
    { id: 61, name: 'Mass Fire Strike', baseDamage: 210, mpCost: 80, effectType: 'fire', targetType: 'entity', category: 'offensive', circle: 7, hasVfx: true, acquisition: 'shop' },
    { id: 62, name: 'Confusion', baseDamage: 0, mpCost: 78, effectType: 'dark', targetType: 'ground', category: 'offensive', circle: 7, hasVfx: true, acquisition: 'shop' },
    { id: 63, name: 'Mass Chill Wind', baseDamage: 180, mpCost: 90, effectType: 'ice', targetType: 'ground', category: 'offensive', circle: 7, hasVfx: true, acquisition: 'shop' },
    { id: 64, name: 'Earthworm Strike', baseDamage: 195, mpCost: 80, effectType: 'earth', targetType: 'ground', category: 'offensive', circle: 7, hasVfx: true, acquisition: 'shop' },
    { id: 65, name: 'Absolute Magic Protection', baseDamage: 0, mpCost: 90, effectType: 'holy', targetType: 'self', category: 'buff', circle: 7, hasVfx: true, acquisition: 'shop' },
    { id: 66, name: 'Armor Break', baseDamage: 0, mpCost: 90, effectType: 'physical', targetType: 'entity', category: 'offensive', circle: 7, hasVfx: true, acquisition: 'shop' },
    { id: 67, name: 'Scan', baseDamage: 0, mpCost: 50, effectType: 'none', targetType: 'entity', category: 'utility', circle: 7, hasVfx: true, acquisition: 'shop' },
    // Circle 8
    { id: 70, name: 'Bloody Shock Wave', baseDamage: 230, mpCost: 120, effectType: 'dark', targetType: 'ground', category: 'offensive', circle: 8, hasVfx: true, acquisition: 'shop' },
    { id: 71, name: 'Mass Confusion', baseDamage: 0, mpCost: 125, effectType: 'dark', targetType: 'ground', category: 'offensive', circle: 8, hasVfx: true, acquisition: 'shop' },
    { id: 72, name: 'Mass Ice Strike', baseDamage: 260, mpCost: 120, effectType: 'ice', targetType: 'ground', category: 'offensive', circle: 8, hasVfx: true, acquisition: 'shop' },
    { id: 73, name: 'Cloud Kill', baseDamage: 100, mpCost: 130, effectType: 'poison', targetType: 'ground', category: 'field', circle: 8, hasVfx: true, acquisition: 'shop' },
    { id: 74, name: 'Lightning Strike', baseDamage: 245, mpCost: 90, effectType: 'lightning', targetType: 'ground', category: 'offensive', circle: 8, hasVfx: true, acquisition: 'shop' },
    { id: 76, name: 'Cancellation', baseDamage: 0, mpCost: 120, effectType: 'dark', targetType: 'entity', category: 'offensive', circle: 8, hasVfx: true, acquisition: 'shop' },
    { id: 77, name: 'Illusion Movement', baseDamage: 0, mpCost: 130, effectType: 'dark', targetType: 'ground', category: 'offensive', circle: 8, hasVfx: true, acquisition: 'shop' },
    { id: 78, name: 'Haste', baseDamage: 0, mpCost: 60, effectType: 'holy', targetType: 'entity', category: 'buff', circle: 8, hasVfx: true, acquisition: 'shop' },
    // Circle 9
    { id: 80, name: 'Illusion', baseDamage: 0, mpCost: 143, effectType: 'dark', targetType: 'ground', category: 'offensive', circle: 9, hasVfx: true, acquisition: 'shop' },
    { id: 81, name: 'Meteor Strike', baseDamage: 320, mpCost: 120, effectType: 'meteor', targetType: 'ground', category: 'offensive', circle: 9, hasVfx: true, acquisition: 'shop' },
    { id: 82, name: 'Mass Magic Missile', baseDamage: 200, mpCost: 160, effectType: 'energy', targetType: 'ground', category: 'offensive', circle: 9, hasVfx: true, acquisition: 'shop' },
    { id: 83, name: 'Inhibition Casting', baseDamage: 0, mpCost: 180, effectType: 'dark', targetType: 'entity', category: 'offensive', circle: 9, hasVfx: true, acquisition: 'shop' },
    // Circle 10
    { id: 90, name: 'Mass Illusion', baseDamage: 0, mpCost: 200, effectType: 'dark', targetType: 'ground', category: 'offensive', circle: 10, hasVfx: true, acquisition: 'shop' },
    { id: 91, name: 'Blizzard', baseDamage: 310, mpCost: 170, effectType: 'blizzard', targetType: 'ground', category: 'offensive', circle: 10, hasVfx: true, acquisition: 'shop' },
    { id: 94, name: 'Resurrection', baseDamage: 0, mpCost: 200, effectType: 'holy', targetType: 'entity', category: 'heal', circle: 10, hasVfx: true, acquisition: 'shop' },
    { id: 95, name: 'Mass Illusion Movement', baseDamage: 0, mpCost: 200, effectType: 'dark', targetType: 'ground', category: 'offensive', circle: 10, hasVfx: true, acquisition: 'shop' },
    { id: 96, name: 'Earth Shock Wave', baseDamage: 270, mpCost: 180, effectType: 'earth', targetType: 'ground', category: 'offensive', circle: 10, hasVfx: true, acquisition: 'shop' },
    { id: 97, name: 'Mass Blizzard', baseDamage: 380, mpCost: 130, effectType: 'blizzard', targetType: 'ground', category: 'offensive', circle: 10, hasVfx: true, acquisition: 'shop' },
];

export const SPELL_CIRCLE_COUNT = 10;

export function getSpellById(id: number): SpellConfig | undefined {
    return SPELLS.find((s) => s.id === id);
}

export function getSpellsByCircle(circle: number): SpellConfig[] {
    return SPELLS.filter((s) => s.circle === circle);
}

export function getSpellCircles(): number[] {
    return Array.from({ length: SPELL_CIRCLE_COUNT }, (_, i) => i + 1);
}