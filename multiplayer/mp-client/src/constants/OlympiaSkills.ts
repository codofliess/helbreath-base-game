/** Helbreath Olympia skill names (SKILLCFG order; levels synced from server later). */
export interface OlympiaSkillEntry {
    id: number;
    name: string;
    /** Mastery 0–100; server sync will overwrite stubs. */
    level: number;
    usable: boolean;
    /**
     * Effect text shown once mastery reaches {@link SKILL_MAX_LEVEL}.
     * Keep short — room to expand (bonuses, unlocks) later.
     */
    description: string;
}

/** Classic Helbreath mastery cap (Super Attack / full effect unlock). */
export const SKILL_MAX_LEVEL = 100;

export const OLYMPIA_SKILLS: OlympiaSkillEntry[] = [
    {
        id: 0,
        name: 'Mining',
        level: 0,
        usable: true,
        description:
            'Gather ore from coal/crystal nodes. At 100%: rare Merien/Xelima stones & Zems (low rate). Skill cNFT tradeable post-test (mid market value).',
    },
    {
        id: 1,
        name: 'Fishing',
        level: 0,
        usable: true,
        description:
            'Fish beside water with a rod. Gold Carp = +10% hit + no hunger 1h; Green Carp = no hunger + half SP 1h. At 100%: rare stones/zems/rings/MS shield/Flam+3. Skill cNFT post-test.',
    },
    {
        id: 2,
        name: 'Farming',
        level: 0,
        usable: true,
        description: 'Harvest crops from tilled fields. Higher mastery improves harvest yield.',
    },
    {
        id: 3,
        name: 'Construction',
        level: 0,
        usable: true,
        description: 'Build and repair structures. Required for crusade and town construction tasks.',
    },
    {
        id: 4,
        name: 'Magic',
        level: 20,
        usable: true,
        description:
            'Spell casting mastery. Free baseline 20% (Olympia GetMagicAbility). Higher mastery improves magic hit and enables stronger circles over time.',
    },
    {
        id: 5,
        name: 'Magical Chemistry',
        level: 0,
        usable: true,
        description: 'Mix reagents into potions. Higher mastery unlocks stronger recipes and reduces fail chance.',
    },
    {
        id: 6,
        name: 'Hammer Mastery',
        level: 0,
        usable: true,
        description:
            'Improves accuracy and damage with hammers (Hammer, Battle Hammer, Giant Battle Hammer, Barbarian Hammer). At 100%: Super Attack while using a hammer.',
    },
    {
        id: 7,
        name: 'Manufacture',
        level: 0,
        usable: true,
        description:
            'Craft gear and goods from materials. At 100%: Super craft path + skill cNFT tradeable post-test (expected highest skill-NFT market price).',
    },
    {
        id: 8,
        name: 'Alchemy',
        level: 0,
        usable: true,
        description: 'Refine alchemical products. Complements Magical Chemistry for potion work.',
    },
    {
        id: 9,
        name: 'Sword Mastery',
        level: 0,
        usable: true,
        description:
            'Improves accuracy and damage with swords. At 100%: Super Attack + skill cNFT tradeable post-test (expected cheap on market).',
    },
    {
        id: 10,
        name: 'Axe Mastery',
        level: 0,
        usable: true,
        description: 'Improves accuracy and damage with axes. At 100% enables Super Attack while using an axe.',
    },
    {
        id: 11,
        name: 'Bow Mastery',
        level: 0,
        usable: true,
        description: 'Improves accuracy and damage with bows. At 100% enables Super Attack while using a bow.',
    },
    {
        id: 12,
        name: 'Staff Mastery',
        level: 0,
        usable: true,
        description: 'Improves accuracy and damage with staves. At 100% enables Super Attack while using a staff.',
    },
    {
        id: 13,
        name: 'Shield Mastery',
        level: 0,
        usable: true,
        description: 'Improves block chance and shield defense. Higher mastery reduces damage taken while blocking.',
    },
    {
        id: 14,
        name: 'Magic Resistance',
        level: 0,
        usable: true,
        description: 'Reduces magical damage taken. Higher mastery strengthens resistance to spells.',
    },
    {
        id: 15,
        name: 'Physical Absorption',
        level: 0,
        usable: true,
        description: 'Absorbs a portion of physical damage. Higher mastery increases absorption amount.',
    },
    {
        id: 16,
        name: 'Poison Resistance',
        level: 0,
        usable: true,
        description: 'Reduces poison damage and duration. Higher mastery improves recovery from poison.',
    },
    {
        id: 17,
        name: 'Fencing',
        level: 0,
        usable: true,
        description:
            'Rapier mastery. At 100%: Super Attack with rapiers (Blood / Xelima / Knight). Strong pick for mages with high-HR rapiers.',
    },
    {
        id: 18,
        name: 'Pretend Corpse',
        level: 0,
        usable: true,
        description:
            'Play dead to drop combat targeters. Classic Helbreath survival skill — high mastery shortens recovery / improves success.',
    },
];

export function getOlympiaSkillById(id: number): OlympiaSkillEntry | undefined {
    return OLYMPIA_SKILLS.find((skill) => skill.id === id);
}

export function isSkillAtMax(skill: OlympiaSkillEntry): boolean {
    return skill.level >= SKILL_MAX_LEVEL;
}
