/**
 * Training Arena preset catalog + tip protocols (static play suggestions, not AI).
 * Keep `id` / composition in sync with `multiplayer/server/Helpers/TrainingArena.cs`.
 * See `docs/TRAINING-ARENA.md`.
 */

export type TrainingDummyRole = 'war' | 'mage';

export interface TrainingDummySpec {
    role: TrainingDummyRole;
    count: number;
}

export interface TrainingPreset {
    id: string;
    label: string;
    summary: string;
    dummies: TrainingDummySpec[];
    /** Ordered tip protocol lines shown in the Training dialog. */
    tips: string[];
}

export const TRAINING_WORLD_ID = 'training';

export const TRAINING_PRESETS: TrainingPreset[] = [
    {
        id: 'mage_chase_1',
        label: '1 Mage chase',
        summary: 'One mage dummy runs you — freeze / Lize / kite.',
        dummies: [{ role: 'mage', count: 1 }],
        tips: [
            'freeze → Lize → kite',
            'hold cast → side-step',
            'reset distance on miss',
            're-freeze before they close',
        ],
    },
    {
        id: 'war_chase_1',
        label: '1 War chase',
        summary: 'One war dummy melee pressure — hold / side-step.',
        dummies: [{ role: 'war', count: 1 }],
        tips: [
            'hold → side-step',
            'backstep → re-engage',
            "don't tank free hits",
            'kite short, then punish',
        ],
    },
    {
        id: 'war_chase_2',
        label: '2 Wars chase',
        summary: 'Two wars — split aggro and kite angles.',
        dummies: [{ role: 'war', count: 2 }],
        tips: [
            'never get sandwiched',
            'kite one, peek the other',
            'hold → side-step → reset',
            'use terrain / corners',
        ],
    },
    {
        id: 'mage_chase_2',
        label: '2 Mages chase',
        summary: 'Two mages — prioritize freezes and spacing.',
        dummies: [{ role: 'mage', count: 2 }],
        tips: [
            'freeze primary → Lize',
            'keep both off your cast line',
            'kite wide arcs',
            're-freeze on break',
        ],
    },
    {
        id: 'mix_war_mage_1',
        label: 'Mix War + Mage',
        summary: 'Melee + ranged pressure — classic mix drills.',
        dummies: [
            { role: 'war', count: 1 },
            { role: 'mage', count: 1 },
        ],
        tips: [
            'freeze mage first',
            'kite war while mage locked',
            're-freeze on break',
            'hold → side-step vs war gap-close',
        ],
    },
];

/** Farm barracks tip sheets (arefarm / elvfarm). Same protocol pattern as arena presets. */
export const FARM_BARRACKS_PRESETS: TrainingPreset[] = [
    {
        id: 'farm_dummy_barracks',
        label: 'Dummy Barracks',
        summary: 'Static Training Dummies on the farm — learn swing timing without chase.',
        dummies: [{ role: 'war', count: 6 }],
        tips: [
            'stand still and learn attack cadence',
            'practice facing / side-step without pressure',
            'no chase — safe warm-up before mercs',
            'talk to the Drillmaster for reminders',
        ],
    },
    {
        id: 'farm_merc_war',
        label: 'Merc Warriors',
        summary: 'Farm Mercenary Warriors chase like players — melee PvP practice + XP on kill.',
        dummies: [{ role: 'war', count: 4 }],
        tips: [
            'hold → side-step on gap-close',
            "don't tank free hits",
            'kite short, then punish',
            'reset if sandwiched by two wars',
        ],
    },
    {
        id: 'farm_merc_mage',
        label: 'Merc Mages',
        summary:
            'Mercenary Mages chase with Chill Wind + Energy Bolt — practice the full CC protocol + XP on kill.',
        dummies: [{ role: 'mage', count: 3 }],
        tips: [
            '1) Chill Wind first (slow)',
            '2) Paralyze next (lock)',
            '3) PFA / DS to deny enemy PFM — only when you have those spells',
            '4) burst while locked; re-Chill on break',
            'kite their cast line — they mix Chill Wind and Energy Bolt',
        ],
    },
    {
        id: 'farm_cc_protocol',
        label: 'Attack protocol',
        summary:
            'Chain Lord attack tip sheet for farm mercs / open PvP: Chill → Paralyze → PFA/DS (deny PFM).',
        dummies: [
            { role: 'war', count: 1 },
            { role: 'mage', count: 1 },
        ],
        tips: [
            '1) Chill Wind first (slow)',
            '2) Paralyze (lock)',
            '3) PFA / DS to deny enemy PFM — skip until you learn those spells',
            '4) burst / kite while locked; re-slow on break',
            'mix: lock the mage first, then kite the war',
        ],
    },
];

export type TrainingPresetGroup = 'arena' | 'farm';

export function getTrainingPreset(id: string): TrainingPreset | undefined {
    return TRAINING_PRESETS.find((p) => p.id === id) ?? FARM_BARRACKS_PRESETS.find((p) => p.id === id);
}

export function getPresetsForGroup(group: TrainingPresetGroup): TrainingPreset[] {
    return group === 'farm' ? FARM_BARRACKS_PRESETS : TRAINING_PRESETS;
}
