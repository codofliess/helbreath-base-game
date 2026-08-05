/**
 * Client mirror of beginner-path quest hints (server catalog is authoritative).
 * See `docs/BEGINNER-PATH-1-80.md` and `multiplayer/server/Config/BeginnerPath.json`.
 */

export const BEGINNER_PATH_NPC = {
    howard: 2,
    enzu: 11,
    drillmaster: 12,
    mercCaptain: 13,
} as const;

export const BEGINNER_PATH_MONSTER = {
    slime: 1,
    clayGolem: 12,
    trainingDummy: 42,
    mercWarrior: 62,
    mercMage: 63,
} as const;

/**
 * Soft UI action ids — reserved for future gates that cannot be verified server-side.
 * Live catalog currently uses hard objectives only (party / Howard talk / mob_kills / ApplyPreset).
 */
export const BEGINNER_PATH_UI_ACTION = {
    /** @deprecated Soft open_party replaced by create_or_join_party. */
    openParty: 'open_party',
    /** @deprecated Soft open_guild replaced by talk Howard. */
    openGuild: 'open_guild',
    /** @deprecated Soft read_ek replaced by mob_kills milestone. */
    readEk: 'read_ek',
    /** @deprecated Soft select_training_preset replaced by apply_training_preset. */
    selectTrainingPreset: 'select_training_preset',
} as const;
