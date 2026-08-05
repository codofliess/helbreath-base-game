import { DEBUG_KEY } from "./RegistryKeys";

/** Phaser registry: `changedata-{registryKey}` (see `RegistryKeys.ts`). */
export const IN_DEBUG_MODE_CHANGE = `changedata-${DEBUG_KEY}`;

/** EventBus IN (React → Phaser): UI and tooling driving the game scene. */
export const IN_UI_CHANGE_MOVEMENT_SPEED = 'ui-change-player-movement-speed';
/** React → Phaser: full melee swing duration in ms (200–2000). */
export const IN_UI_CHANGE_ATTACK_SPEED = 'ui-change-player-attack-speed';
export const IN_UI_CHANGE_ATTACK_RANGE = 'ui-change-player-attack-range';
/** React → Phaser: stun duration slider (ms, 100–2000). */
export const IN_UI_CHANGE_STUN_DURATION = 'ui-change-player-stun-duration';
export const IN_UI_CHANGE_DAMAGE = 'ui-change-player-damage';
export const IN_UI_CHANGE_ATTACK_TYPE = 'ui-change-player-attack-type';
export const IN_UI_CHANGE_ALLOW_DASH_ATTACK = 'ui-change-player-allow-dash-attack';
export const IN_UI_CHANGE_CAST_SPEED = 'ui-change-player-cast-speed';
export const IN_UI_CHANGE_ATTACK_MODE = 'ui-change-player-attack-mode';
export const IN_UI_CHANGE_SAFE_ATTACK_MODE = 'ui-change-player-safe-attack-mode';
export const IN_UI_TOGGLE_COMBAT_MODE = 'ui-toggle-combat-mode';
export const IN_UI_TOGGLE_SAFE_ATTACK_MODE = 'ui-toggle-safe-attack-mode';
export const IN_UI_CHANGE_RUN_MODE = 'ui-change-player-run-mode';
export const IN_UI_CHANGE_GENDER = 'ui-change-player-gender';
export const IN_UI_CHANGE_SKIN_COLOR = 'ui-change-player-skin-color';
export const IN_UI_CHANGE_UNDERWEAR_COLOR = 'ui-change-player-underwear-color';
export const IN_UI_CHANGE_HAIR_STYLE = 'ui-change-player-hair-style';
export const IN_UI_CHANGE_CAMERA_ZOOM = 'ui-change-camera-zoom';
export const IN_UI_CHANGE_MUSIC_VOLUME = 'ui-change-music-volume';
export const IN_UI_CHANGE_SOUND_VOLUME = 'ui-change-sound-volume';
/** SysMenu Music On/Off — payload: boolean (true = allow BGM). */
export const IN_UI_CHANGE_MUSIC_ENABLED = 'ui-change-music-enabled';
/** SysMenu Sound On/Off — payload: boolean (true = allow SFX). */
export const IN_UI_CHANGE_SOUND_ENABLED = 'ui-change-sound-enabled';
export const IN_UI_MUTE_ALL_SOUNDS = 'ui-mute-all-sounds';
export const IN_UI_UNMUTE_ALL_SOUNDS = 'ui-unmute-all-sounds';
export const IN_UI_PLAY_MUSIC = 'ui-toggle-play-music';
export const IN_UI_CHANGE_PLAY_MAP_MUSIC = 'play-map-music-changed';
/** SysMenu Detail Level 0|1|2 — visual quality (weather particles, etc.). */
export const IN_UI_CHANGE_DETAIL_LEVEL = 'ui-change-detail-level';
export const IN_UI_CHANGE_CAMERA_FOLLOW_PLAYER = 'ui-change-camera-follow-player';
export const IN_UI_CHANGE_CAMERA_SHAKE = 'ui-change-camera-shake';
export const IN_UI_CHANGE_POST_PROCESSING = 'ui-change-post-processing';
export const IN_UI_CHANGE_MAP = 'ui-change-map';
export const IN_UI_TOGGLE_RENDER_MAP_TILES = 'ui-toggle-render-map-tiles';
export const IN_UI_TOGGLE_RENDER_MAP_OBJECTS = 'ui-toggle-render-map-objects';
export const IN_UI_TOGGLE_DEBUG_MODE = 'ui-toggle-debug-mode';
export const IN_UI_TOGGLE_NON_MOVABLE_CELLS_HIGHLIGHT = 'ui-toggle-non-movable-cells-highlight';
export const IN_UI_TOGGLE_TELEPORT_CELLS_HIGHLIGHT = 'ui-toggle-teleport-cells-highlight';
export const IN_UI_TOGGLE_SERVER_TELEPORT_CELLS_HIGHLIGHT = 'ui-toggle-server-teleport-cells-highlight';
export const IN_UI_TOGGLE_WATER_CELLS_HIGHLIGHT = 'ui-toggle-water-cells-highlight';
export const IN_UI_TOGGLE_FARMABLE_CELLS_HIGHLIGHT = 'ui-toggle-farmable-cells-highlight';
export const IN_UI_TOGGLE_GRID_DISPLAY = 'ui-toggle-grid-display';
export const IN_UI_GROUND_ITEM_DISPLAY_SIZE_CHANGED = 'ui-ground-item-display-size-changed';
/** @deprecated Use IN_UI_GROUND_ITEM_DISPLAY_SIZE_CHANGED */
export const IN_UI_TOGGLE_DISPLAY_LARGE_ITEMS = IN_UI_GROUND_ITEM_DISPLAY_SIZE_CHANGED;
export const IN_UI_CHANGE_WEATHER = 'ui-change-weather';

/** SysMenu Rain sounds toggle — WeatherManager starts/stops loop SFX. Payload: boolean. */
export const IN_UI_RAIN_SOUNDS_CHANGED = 'ui-rain-sounds-changed';

/**
 * Game viewport size changed (e.g. expanded-vision fullscreen / exit).
 * GameWorld re-centers camera and resizes overlays. No payload.
 */
export const IN_UI_GAME_VIEWPORT_RESIZED = 'ui-game-viewport-resized';

/** Server broadcast: authoritative weather for the current game world (see WeatherChanged). */
export const OUT_WEATHER_SYNCED = 'out-weather-synced';
export const IN_UI_CAMERA_MOVE_UP = 'ui-camera-move-up';
export const IN_UI_CAMERA_MOVE_DOWN = 'ui-camera-move-down';
export const IN_UI_CAMERA_MOVE_LEFT = 'ui-camera-move-left';
export const IN_UI_CAMERA_MOVE_RIGHT = 'ui-camera-move-right';
export const IN_UI_REQUEST_PLAYER_LOGOUT = 'ui-request-player-logout';
/** Emitted when user clicks "Make server cell occupied" - GameWorld enters mode to capture next left click and send coords to server */
export const IN_UI_MAKE_SERVER_CELL_OCCUPIED_MODE = 'ui-make-server-cell-occupied-mode';
/** Emitted when user clicks "Teleport to cell" - GameWorld captures next left click and sends coords as a server teleport request */
export const IN_UI_PLAYER_TELEPORT_REQUEST_MODE = 'ui-player-teleport-request-mode';
/** Emitted when player previous action grace period slider changes. Payload: number (ms). */
export const IN_UI_CHANGE_GRACE_PERIOD = 'ui-change-grace-period';
/** Emitted by React UI to briefly suppress leaked pointer input reaching Phaser after dismissing a dialog. Payload: number (ms). */
export const IN_UI_SUPPRESS_POINTER_INPUT = 'ui-suppress-pointer-input';
/** React → Phaser (login): connect to game server. Payload: ConnectToServerPayload */
export const IN_UI_CONNECT_TO_SERVER = 'ui-connect-to-server';
/** Phaser SELECTCHAR → React: Start / Create on occupied or empty slot. Payload: SelectCharActionPayload */
export const OUT_UI_SELECTCHAR_ACTION = 'ui-selectchar-action';
/** Phaser SELECTCHAR → React: Exit / back to hub. */
export const OUT_UI_SELECTCHAR_BACK = 'ui-selectchar-back';
/** Phaser Create Character → React: confirm new character and connect. */
export const OUT_UI_CREATECHAR_CONFIRM = 'ui-createchar-confirm';
/** Phaser Create Character → React: cancel back to SELECTCHAR desk. */
export const OUT_UI_CREATECHAR_CANCEL = 'ui-createchar-cancel';
/** Phaser Arena SELECTCHAR → React: Enter / Save / Delete / Load / Select. */
export const OUT_UI_ARENA_ACTION = 'ui-arena-action';
/** Phaser Arena SELECTCHAR → React: Exit / back to hub. */
export const OUT_UI_ARENA_BACK = 'ui-arena-back';
/** Server → React: arena pact match snapshot. */
export const ARENA_PACT_STATE_RECEIVED = 'arena-pact-state-received';
/** Server → React: open pact list. */
export const ARENA_PACT_LIST_RECEIVED = 'arena-pact-list-received';

export type SelectCharActionKind = 'start' | 'create';

export interface SelectCharActionPayload {
    kind: SelectCharActionKind;
    slotIndex: number;
}

export type ArenaDeskActionKind = 'enter' | 'enter-bleeding' | 'save' | 'delete' | 'load' | 'select';

export interface ArenaDeskActionPayload {
    kind: ArenaDeskActionKind;
    deskIndex: number;
}

/** Appearance + name chosen on the classic Create Character desk. */
export interface CreateCharConfirmPayload {
    slotIndex: number;
    characterName: string;
    gender: 'male' | 'female';
    skinColor: 'light' | 'tanned' | 'dark';
    hairStyleIndex: number;
    underwearColorIndex: number;
    str: number;
    vit: number;
    dex: number;
    int: number;
    mag: number;
    chr: number;
}

/** Payload for IN_UI_CONNECT_TO_SERVER */
export interface ConnectToServerPayload {
    host: string;
    port: number;
    characterName: string;
    /** SELECTCHAR desk slot 0–3 (create / claim). */
    slotIndex?: number;
    /** World path always prefers traveler for new/returning World logins. */
    preferredInitialWorldId?: string;
    /** Create-character appearance (new chars only). */
    gender?: 'male' | 'female';
    skinColor?: 'light' | 'tanned' | 'dark';
    hairStyleIndex?: number;
    underwearColorIndex?: number;
    /** Create-character point-buy (new chars only; classic sum 70). */
    str?: number;
    vit?: number;
    dex?: number;
    int?: number;
    mag?: number;
    chr?: number;
    walletSession?: {
        wallet: string;
        token: string;
        expiresAt: number;
    };
    /**
     * Arena Pre-Ready kit JSON (validated server-side on tournament-arena entry).
     * When set with preferredInitialWorldId = arena map, server applies kit loadout.
     */
    arenaKitJson?: string;
}

/** Emitted when the WebSocket connection is closed (server shutdown, network loss, etc.) */
export const SOCKET_DISCONNECTED = 'socket-disconnected';
/**
 * InitialState: gender-resolved equipped item appearance basenames to prefetch lazily.
 * LoginScreen queues on `game.registry`; GameWorld drains on create (parallel with map load).
 */
export const PLAYER_ITEM_APPEARANCE_PREFETCH_REQUESTED = 'player-item-appearance-prefetch-requested';
export interface PlayerItemAppearancePrefetchEventData {
    spriteNames: string[];
}
export const INITIAL_GAME_WORLD_STATE_RECEIVED = 'initial-game-world-state-received';
export const RESET_POSITION_RECEIVED = 'reset-position-received';
/** Self only: server confirmed admin teleport. Payload: { x: number; y: number } */
export const PLAYER_TELEPORTED_RECEIVED = 'player-teleported-received';
export const POSITION_CORRECTED_RECEIVED = 'position-corrected-received';
/** Server revealed other players in view. Payload: Player[] (bulk). */
export const PLAYER_JOINED_RECEIVED = 'player-joined-received';
/** Server applied a temporary effect to a player (viewers + subject). Payload: { playerId: string; temporaryEffectType: number } */
export const TEMPORARY_EFFECT_APPLIED_FOR_PLAYER_RECEIVED = 'temporary-effect-applied-for-player-received';
/** Server removed a temporary effect from a player. Payload: { playerId: string; temporaryEffectType: number } */
export const TEMPORARY_EFFECT_EXPIRED_FOR_PLAYER_RECEIVED = 'temporary-effect-expired-for-player-received';
/** Server applied a temporary effect to a monster. Payload: { monsterId: string; temporaryEffectType: number } */
export const TEMPORARY_EFFECT_APPLIED_FOR_MONSTER_RECEIVED = 'temporary-effect-applied-for-monster-received';
/** Server removed a temporary effect from a monster. Payload: { monsterId: string; temporaryEffectType: number } */
export const TEMPORARY_EFFECT_EXPIRED_FOR_MONSTER_RECEIVED = 'temporary-effect-expired-for-monster-received';
/** Server one-shot effect at a grid cell (e.g. buff cast VFX). Payload: { effectKey: string; x: number; y: number } */
export const CAST_EFFECT_RECEIVED = 'cast-effect-received';
/** ESC / UI: force-cancel local spell cast bar + notify server. */
export const IN_UI_FORCE_CANCEL_CAST = 'ui-force-cancel-cast';
/** Arm/disarm Super Attack (crit). Payload: { armed: boolean }. */
export const IN_UI_SET_SUPER_ATTACK_ARMED = 'ui-set-super-attack-armed';
/** Server spawned or revealed monsters nearby. Payload: MonsterEnteredRangeEventData[] */
export const MONSTER_ENTERED_RANGE_RECEIVED = 'monster-entered-range-received';
/** Server reports monsters no longer in view. Payload: string[] (monster ids). */
export const MONSTERS_LEFT_RANGE_RECEIVED = 'monsters-left-range-received';
/** Server spawned or revealed NPCs nearby. Payload: NpcEnteredRangeEventData[] */
export const NPC_ENTERED_RANGE_RECEIVED = 'npc-entered-range-received';
/** Server reports NPCs no longer in view. Payload: string[] (npc instance ids). */
export const NPCS_LEFT_RANGE_RECEIVED = 'npcs-left-range-received';
/** Server revealed or created ground-state updates in view (effects and/or a top-most ground item). Payload: GroundStateCellEventData[] */
export const GROUND_STATES_ENTERED_RANGE_RECEIVED = 'ground-states-entered-range-received';
/** Server removed specific ground-state entries from view (effects and/or a top-most ground item). Payload: GroundStateCellRemovedEventData[] */
export const GROUND_STATES_LEFT_RANGE_RECEIVED = 'ground-states-left-range-received';
/** Server-authoritative monster step for clients in view. Payload: MonsterMovedEventData */
export const MONSTER_MOVED_RECEIVED = 'monster-moved-received';
/** Server monster melee swing. Payload: MonsterAttackedEventData */
export const MONSTER_ATTACKED_RECEIVED = 'monster-attacked-received';
/** Server monster melee swing against another monster. Payload: MonsterAttackedMonsterEventData */
export const MONSTER_ATTACKED_MONSTER_RECEIVED = 'monster-attacked-monster-received';
/** Server monster damage on a player (viewers + victim). Payload: PlayerReceiveDamageEventData */
export const PLAYER_RECEIVE_DAMAGE_RECEIVED = 'player-receive-damage-received';
/** Self player only: authoritative HP/max after monster hit. Payload: { hp: number; maxHp: number } */
export const HP_UPDATED_RECEIVED = 'hp-updated-received';
/** Self only: full progression snapshot on join. Payload: ProgressionState (generated proto type). */
export const PROGRESSION_STATE_RECEIVED = 'progression-state-received';
/** Self only: incremental exp/level/rebirth update. Payload: ProgressionUpdated (generated proto type). */
export const PROGRESSION_UPDATED_RECEIVED = 'progression-updated-received';
/** Self only: kill counter change after a credited monster death. Payload: MonsterKillsUpdated (generated proto type). */
export const MONSTER_KILLS_UPDATED_RECEIVED = 'monster-kills-updated-received';
/** Self only: milestone claim outcome. Payload: KillMilestoneClaimResult (generated proto type). */
export const KILL_MILESTONE_CLAIM_RESULT_RECEIVED = 'kill-milestone-claim-result-received';
/** Self only: beginner path 1→80 snapshot. Payload: BeginnerPathState (generated proto type). */
export const BEGINNER_PATH_STATE_RECEIVED = 'beginner-path-state-received';
/** Self only: minimal party create/join/leave snapshot. Payload: PartyState (generated proto type). */
export const PARTY_STATE_RECEIVED = 'party-state-received';
/** Server: a player died (viewers + victim). Payload: PlayerDiedEventData */
export const PLAYER_DIED_RECEIVED = 'player-died-received';
/** Self only: open-world PvP Enemy Kill awarded (EK screenshot). Payload: EnemyKillAwardedEventData */
export const ENEMY_KILL_AWARDED_RECEIVED = 'enemy-kill-awarded-received';
/** Server: a player resurrected (viewers + subject). Payload: PlayerResurrectedEventData */
export const PLAYER_RESURRECTED_RECEIVED = 'player-resurrected-received';
/** Server damage on a monster (viewers). Payload: MonsterTakeDamageEventData */
export const MONSTER_TAKE_DAMAGE_RECEIVED = 'monster-take-damage-received';
/** Server monster damage on another monster (viewers). Payload: MonsterTakeDamageByMonsterEventData */
export const MONSTER_TAKE_DAMAGE_BY_MONSTER_RECEIVED = 'monster-take-damage-by-monster-received';
/** Server damage on a player from another player (viewers + victim). Payload: PlayerTakeDamageEventData */
export const PLAYER_TAKE_DAMAGE_RECEIVED = 'player-take-damage-received';
/** Server reports monster reached 0 HP. Payload: MonsterDiedEventData */
export const MONSTER_DIED_RECEIVED = 'monster-died-received';
/** Server reports other players left view. Payload: string[] (player ids). */
export const PLAYER_LEFT_RECEIVED = 'player-left-received';
export const PLAYER_MOVED_RECEIVED = 'player-moved-received';
/** Another player attacked (melee/bow); payload: PlayerAttackedMonsterEventData */
export const PLAYER_ATTACKED_MONSTER_RECEIVED = 'player-attacked-monster-received';
/** Another player attacked another player (melee/bow); payload: PlayerAttackedPlayerEventData */
export const PLAYER_ATTACKED_PLAYER_RECEIVED = 'player-attacked-player-received';
/** Another player performed pickup; payload: PlayerPickupPerformedEventData */
export const PLAYER_PICKUP_PERFORMED_RECEIVED = 'player-pickup-performed-received';
/** Another player entered bow stance; payload: PlayerBowStancePerformedEventData */
export const PLAYER_BOW_STANCE_PERFORMED_RECEIVED = 'player-bow-stance-performed-received';
export const PLAYER_MOVEMENT_STATE_CHANGED_RECEIVED = 'player-movement-state-changed-received';
export const PLAYER_ATTACK_MODE_CHANGED_RECEIVED = 'player-attack-mode-changed-received';
export const PLAYER_IDLE_DIRECTION_CHANGED_RECEIVED = 'player-idle-direction-changed-received';
/** Remote player gender/skin/hair/underwear updated. Payload: PlayerAppearanceChangedEventData */
export const PLAYER_APPEARANCE_CHANGED_RECEIVED = 'player-appearance-changed-received';
export const PLAYER_DISCONNECTED_RECEIVED = 'player-disconnected-received';
export const PLAYER_RECONNECTED_RECEIVED = 'player-reconnected-received';
/** Emitted when server sends spawn protection enabled. Payload: { playerId: string } */
export const PLAYER_SPAWN_PROTECTION_ENABLED_RECEIVED = 'player-spawn-protection-enabled-received';
/** Emitted when server sends spawn protection disabled. Payload: { playerId: string } */
export const PLAYER_SPAWN_PROTECTION_DISABLED_RECEIVED = 'player-spawn-protection-disabled-received';
/** Emitted when server sends a message to display (e.g. warning). Payload: { message: string } */
export const SERVER_MESSAGE_RECEIVED = 'server-message-received';
/**
 * Emitted when server broadcasts a chat message.
 * Payload: { senderCharacterName, timestampMs, message, sourceLanguageTag?, channel?, whisperTargetCharacterName? }
 */
export const CHAT_MESSAGE_RECEIVED = 'chat-message-received';
/** React → Phaser: manual screenshot of the game canvas (PrintScreen / SysRq). */
export const IN_UI_TAKE_SCREENSHOT = 'ui-take-screenshot';
/** Emitted when server applies paralysis. Payload: { durationSeconds: number } */
export const PLAYER_PARALYZED_RECEIVED = 'player-paralyzed-received';
export const SERVER_INVENTORY_SNAPSHOT_RECEIVED = 'server-inventory-snapshot-received';
export const SERVER_ITEM_ADDED_TO_BAG_RECEIVED = 'server-item-added-to-bag-received';
export const SERVER_ITEM_REMOVED_FROM_BAG_RECEIVED = 'server-item-removed-from-bag-received';
export const SERVER_ITEM_MOVED_IN_BAG_RECEIVED = 'server-item-moved-in-bag-received';
export const SERVER_ITEM_EQUIPPED_RECEIVED = 'server-item-equipped-received';
export const SERVER_ITEM_UNEQUIPPED_RECEIVED = 'server-item-unequipped-received';
/** Self-only durability update. Payload: { itemUid: string; curLifeSpan: number; maxLifeSpan: number }. */
export const SERVER_ITEM_LIFE_SPAN_UPDATED_RECEIVED = 'server-item-life-span-updated-received';
export const REMOTE_PLAYER_ITEM_EQUIPPED_RECEIVED = 'remote-player-item-equipped-received';
export const REMOTE_PLAYER_ITEM_UNEQUIPPED_RECEIVED = 'remote-player-item-unequipped-received';
export const IN_UI_SUMMON_MONSTER = 'ui-summon-monster';
export const IN_UI_SUMMON_NPC = 'ui-summon-npc';
export const IN_UI_CAST_EFFECT = 'ui-cast-effect';
export const IN_UI_CAST_SPELL = 'ui-cast-spell';
export const IN_UI_KILL_ALL_NPCS = 'ui-kill-all-npcs';
export const IN_UI_KILL_ALL_EFFECTS = 'ui-kill-all-effects';
export const IN_UI_PLAYER_RESURRECT = 'ui-player-resurrect';
/** UI requests server-authoritative resurrection (DeathDialog Resurrect button). */
export const IN_UI_REQUEST_SERVER_RESURRECT = 'ui-request-server-resurrect';
/** UI claims a completed kill/rebirth milestone. Payload: { milestoneId: string; chosenItemId: number } */
export const IN_UI_CLAIM_KILL_MILESTONE = 'ui-claim-kill-milestone';
/** UI → NetworkManager: enroll / re-enroll optional beginner path. */
export const IN_UI_BEGINNER_PATH_ENROLL = 'ui-beginner-path-enroll';
/** UI → NetworkManager: abandon beginner path (no penalty). */
export const IN_UI_BEGINNER_PATH_ABANDON = 'ui-beginner-path-abandon';
/** UI / NPC talk → NetworkManager: credit talk objective. Payload: { catalogNpcId: number }. */
export const IN_UI_BEGINNER_PATH_TALK = 'ui-beginner-path-talk';
/** UI → NetworkManager: soft UI objective. Payload: { actionId: string }. */
export const IN_UI_BEGINNER_PATH_UI_ACTION = 'ui-beginner-path-ui-action';
/** UI → NetworkManager: create a solo party (Beginner Path + F5 Party). */
export const IN_UI_CREATE_PARTY = 'ui-create-party';
/** UI → NetworkManager: join a party by code. Payload: { partyCode: string }. */
export const IN_UI_JOIN_PARTY = 'ui-join-party';
/** UI → NetworkManager: leave the current party. */
export const IN_UI_LEAVE_PARTY = 'ui-leave-party';
/** UI requests a rebirth (requires max level; server validates). */
export const IN_UI_REQUEST_REBIRTH = 'ui-request-rebirth';
/** Cancel last rebirth → restore L max of previous RB (snapshot / avance). */
export const IN_UI_REQUEST_REBIRTH_ROLLBACK = 'ui-request-rebirth-rollback';
/** UI toggles Chain Lords Block Level (exp → majestic while ON). Payload: { blocked: boolean }. */
export const IN_UI_SET_LEVEL_BLOCK = 'ui-set-level-block';
/** UI → NetworkManager: confirm F5 Level Set deltas (Olympia MSGID_LEVELUPSETTINGS). Payload: LevelUpSettingsRequest fields. */
export const IN_UI_LEVEL_UP_SETTINGS = 'ui-level-up-settings';
/** Server → UI: Level Set applied (stats + LU + vitals). Payload: LevelUpSettingsApplied. */
export const LEVEL_UP_SETTINGS_APPLIED_RECEIVED = 'level-up-settings-applied-received';
/** UI → NetworkManager: majestic/gizon upgrade on bag/equipped item. Payload: { itemUid: string }. */
export const IN_UI_MAJESTIC_UPGRADE = 'ui-majestic-upgrade';
/** Server → UI: majestic upgrade result. Payload: MajesticUpgradeResult. */
export const MAJESTIC_UPGRADE_RESULT_RECEIVED = 'majestic-upgrade-result-received';
/** UI → NetworkManager: Olympia disenchant item → shards/fragments. Payload: { itemUid: string }. */
export const IN_UI_ITEM_DISENCHANT = 'ui-item-disenchant';
/** UI → NetworkManager: apply shard (0) or fragment (1) +1. Payload: { itemUid: string; kind: number }. */
export const IN_UI_ITEM_ENCHANT = 'ui-item-enchant';
/** UI → NetworkManager: combine materials. Payload: { kind, type, level, mode }. */
export const IN_UI_ENCHANT_MATERIAL_UPGRADE = 'ui-enchant-material-upgrade';
/** UI → NetworkManager: refresh materials list. */
export const IN_UI_GET_ENCHANT_MATERIALS = 'ui-get-enchant-materials';
/** Server → UI: materials snapshot. */
export const ENCHANT_MATERIALS_STATE_RECEIVED = 'enchant-materials-state-received';
/** Server → UI: disenchant/enchant/combine result. */
export const ENCHANT_RESULT_RECEIVED = 'enchant-result-received';
/** UI → NetworkManager: majestic respec 3 stats. Payload: { statA, statB, statC }. */
export const IN_UI_MAJESTIC_STAT_RESPEC = 'ui-majestic-stat-respec';
/** Server → UI: respec result. */
export const MAJESTIC_STAT_RESPEC_RESULT_RECEIVED = 'majestic-stat-respec-result-received';
/** UI → NetworkManager: Xelima/Merien stone upgrade. Payload: { itemUid: string; useIntegrityStone?: boolean }. */
export const IN_UI_STONE_ITEM_UPGRADE = 'ui-stone-item-upgrade';
/** Server → UI: stone upgrade result. Payload: StoneItemUpgradeResult. */
export const STONE_ITEM_UPGRADE_RESULT_RECEIVED = 'stone-item-upgrade-result-received';
/** UI → NetworkManager: merge 2 CIC pieces. Payload: { itemUidA: string; itemUidB: string }. */
export const IN_UI_CIC_ITEM_MERGE = 'ui-cic-item-merge';
/** Server → UI: CIC merge result. */
export const CIC_ITEM_MERGE_RESULT_RECEIVED = 'cic-item-merge-result-received';
/** UI → NetworkManager: upgrade Mana/HP Siphon gem. Payload: { itemUid: string }. */
export const IN_UI_SIPHON_GEM_UPGRADE = 'ui-siphon-gem-upgrade';
/** Server → UI: siphon gem upgrade result. */
export const SIPHON_GEM_UPGRADE_RESULT_RECEIVED = 'siphon-gem-upgrade-result-received';

/**
 * EventBus: Intra-Phaser Communication
 * Events for communication between Phaser objects (no IN/OUT prefix).
 */
export const PLAYER_POSITION_CHANGED = 'player-position-changed';
/** Player reset/snap/course correction may clear a tile still used by another actor (single boolean per cell). GameWorld re-applies monster and all player cells on HBMap. */
export const TILE_OCCUPANCY_REAPPLY_REQUESTED = 'tile-occupancy-reapply-requested';
export const MONSTER_DEAD = 'monster-dead';
export const NPC_DEAD = 'npc-dead';

/** Emitted when an item is equipped. Payload: { itemType: ItemTypes, itemId?: number, itemUid: string, effectOverrides?: Effect[] } */
export const EQUIP_ITEM = 'equip-item';

/** Emitted when an equipped item is moved to bag. Payload: { itemUid: string, itemType: ItemTypes, bagX: number, bagY: number } */
export const ITEM_MOVED_TO_BAG = 'item-moved-to-bag';

/** Emitted when bag item position is updated (reorder within bag). Payload: { itemUid: string, bagX: number, bagY: number } */
export const ITEM_BAG_POSITION_UPDATED = 'item-bag-position-updated';

/** Emitted when a single item is added to bag. Payload: { item: InventoryItem } */
export const ITEM_ADDED_TO_BAG = 'item-added-to-bag';

/** Emitted from UI when user requests to create/add item to bag. Payload: { itemId: number; effectOverrides?: Effect[] } */
export const ITEM_CREATE_REQUESTED = 'item-create-requested';

/** Emitted from UI when user drops bag item outside bag to equip. Payload: { item: InventoryItem, itemType: ItemTypes } */
export const ITEM_EQUIP_REQUESTED = 'item-equip-requested';

/** Emitted from UI when the user clicks a bag item to bring it to the front; coordinates may be omitted for reorder-only persistence. Payload: { itemUid: string } */
export const ITEM_BAG_ITEM_BRING_TO_FRONT_REQUESTED = 'item-bag-item-bring-to-front-requested';

/** Emitted from UI when user double-clicks consumable MISC item in bag. Payload: { item: InventoryItem } */
export const ITEM_CONSUMED_REQUESTED = 'item-consumed-requested';

/** Emitted when item is removed from bag (e.g. equipped). Payload: { itemUid: string } */
export const ITEM_REMOVED_FROM_BAG = 'item-removed-from-bag';

/** Emitted when bag item is grabbed or added - bring it to top (z-order). Payload: { itemUid: string } */
export const ITEM_BAG_ITEM_BROUGHT_TO_FRONT = 'item-bag-item-brought-to-front';

/** Emitted when stackable item quantity changes. Payload: { itemUid: string; quantity: number } */
export const ITEM_QUANTITY_UPDATED = 'item-quantity-updated';

/** Emitted from UI when bag item is dropped outside InventoryDialog (user intent). Payload: { itemUid: string } */
export const ITEM_DROP_TO_GROUND_REQUESTED = 'item-drop-to-ground-requested';

/** Emitted when an item lands on the ground (for Item Drops log). */
export const ITEM_DROPPED_TO_GROUND = 'item-dropped-to-ground';

/** Emitted when the player picks up a notable item from the ground. */
export const ITEM_ADD_FROM_GROUND = 'item-add-from-ground';

/** Emitted when monster attack animation hits frame 2 (player should take damage). */
export const MONSTER_ATTACK_HIT_PLAYER = 'monster-attack-hit-player';

/** Emitted when the player dies. Monsters use this to stop targeting and return to wandering. */
export const PLAYER_DIED = 'player-died';

/** Emitted when a Phaser scene is ready. React uses this to receive the current scene instance. */
export const CURRENT_SCENE_READY = 'current-scene-ready';

/** Emitted when player confirms spell target from CastReady. Payload: PlayerConfirmSpellTargetEvent */
export const PLAYER_CONFIRM_SPELL_TARGET = 'player-confirm-spell-target';
export const PLAYER_CAST_ANIMATION_STARTED = 'player-cast-animation-started';
export const SPELL_CAST_STARTED_RECEIVED = 'spell-cast-started-received';
export const SPELL_CAST_CANCELLED_RECEIVED = 'spell-cast-cancelled-received';
/** Self only: server rejected cast request (too soon after cast start). No payload. */
export const SPELL_CAST_FAILED_RECEIVED = 'spell-cast-failed-received';
export const CAST_AOE_SPELL_RECEIVED = 'cast-aoe-spell-received';
export const CAST_DIRECTIONAL_AOE_SPELL_RECEIVED = 'cast-directional-aoe-spell-received';
export const MONSTER_CAST_AOE_SPELL_RECEIVED = 'monster-cast-aoe-spell-received';
export const MONSTER_CAST_DIRECTIONAL_AOE_SPELL_RECEIVED = 'monster-cast-directional-aoe-spell-received';

/** Server answered bag quick-sell (Item Drops / context menu). Payload: SellBagItemResultEvent */
export const SELL_BAG_ITEM_RESULT = 'sell-bag-item-result';

export interface SellBagItemResultEvent {
    ok: boolean;
    message: string;
    goldGained?: number;
    itemUid?: string;
}

/** Emitted when a toast should be shown in React. Payload: ToastRequestedEvent */
export const TOAST_REQUESTED = 'toast-requested';

/** Dismiss the logout countdown info toast if it was shown with trackForLogoutDismiss. No payload. */
export const TOAST_DISMISS_LOGOUT_COUNTDOWN = 'toast-dismiss-logout-countdown';

/**
 * Append a line to the Olympia-style bottom-left system/combat log (P1.2).
 * Payload: SystemLogAppendPayload — prefer this for tips/events that should not toast.
 */
export const SYSTEM_LOG_APPEND = 'system-log-append';

export type SystemLogLineKind = 'damage' | 'heal' | 'tip' | 'event' | 'warning';

export interface SystemLogAppendPayload {
    message: string;
    kind?: SystemLogLineKind;
}

/**
 * EventBus OUT: Phaser → React
 * Events sent from Phaser scenes to React components.
 */
export const OUT_SPRITE_FRAME_EXTRACTED = 'sprite-frame-extracted';
/** React → Phaser: refresh F5 paper-doll body layers from loaded player sprites. */
export const IN_UI_PAPERDOLL_CAPTURE = 'ui-paperdoll-capture';
export const OUT_UI_HOVER_SPRITE_FRAME_DEBUG = 'ui-hover-sprite-frame-debug';
export const OUT_UI_HOVER_MONSTER = 'ui-hover-monster';
/** Phaser → React: other player under cursor. Payload: PlayerHoverInfo | undefined */
export const OUT_UI_HOVER_PLAYER = 'ui-hover-player';
/** Phaser → React: NPC under cursor. Payload: NpcHoverInfo | undefined */
export const OUT_UI_HOVER_NPC = 'ui-hover-npc';
/** Phaser → React: open Shop Keeper buy UI. Payload: { npcId: string; npcName: string }. */
export const OUT_UI_OPEN_SHOP = 'ui-open-shop';
/** Phaser → React: open Magic Tower spell shop. Payload: { npcId: string; npcName: string }. */
export const OUT_UI_OPEN_MAGIC_SHOP = 'ui-open-magic-shop';
export const OUT_UI_OPEN_CASH_SHOP = 'ui-open-cash-shop';
/** Phaser → React: open Tom blacksmith buy UI. Payload: { npcId: string; npcName: string }. */
export const OUT_UI_OPEN_BLACKSMITH = 'ui-open-blacksmith';
/** Phaser → React: open William warehouse UI. Payload: { npcId: string; npcName: string }. */
export const OUT_UI_OPEN_WAREHOUSE = 'ui-open-warehouse';
/** Phaser → React: open city NPC service UI. Payload: { npcId; npcName; role; title }. */
export const OUT_UI_OPEN_NPC_TALK = 'ui-open-npc-talk';
/** NetworkManager → NpcTalkDialog: CityNpcServiceResult snapshot. */
export const SERVER_CITY_NPC_SERVICE_RESULT = 'server-city-npc-service-result';
export const OUT_UI_HOVER_ATTACKABLE_TARGET = 'ui-hover-attackable-target';

/** Emitted when pointer is over a ground item. Payload: boolean (true when hovering) */
export const OUT_UI_HOVER_GROUND_ITEM = 'ui-hover-ground-item';
/** Phaser → React: ground item tooltip/hover payload. Payload: InventoryItemHoverInfo | undefined */
export const OUT_UI_HOVER_GROUND_ITEM_INFO = 'ui-hover-ground-item-info';
export const OUT_UI_CAST_STARTED = 'ui-cast-started';
export const OUT_UI_CAST_READY = 'ui-cast-ready';
export const OUT_UI_CAST_REMOVED = 'ui-cast-removed';
export const OUT_UI_SET_MOVEMENT_SPEED = 'ui-set-movement-speed';
export const OUT_UI_SET_ATTACK_SPEED = 'ui-set-attack-speed';
/** Server melee cadence in ms (InitialGameWorldState); display-only in Player dialog until configurable. */
export const OUT_UI_SET_ATTACK_SPEED_MS = 'ui-set-attack-speed-ms';
/** Server monster stunlock duration for Stun hits (InitialGameWorldState). */
export const OUT_UI_SET_STUN_DURATION_MS = 'ui-set-stun-duration-ms';
export const OUT_UI_SET_ATTACK_RANGE = 'ui-set-attack-range';
export const OUT_UI_SET_DAMAGE = 'ui-set-damage';
export const OUT_UI_SET_ATTACK_TYPE = 'ui-set-attack-type';
export const OUT_UI_SET_ALLOW_DASH_ATTACK = 'ui-set-allow-dash-attack';
/** Full spell cast bar duration in ms (InitialGameWorldState / local). */
export const OUT_UI_SET_CAST_SPEED = 'ui-set-cast-speed';
export const OUT_UI_SET_ATTACK_MODE = 'ui-set-attack-mode';
export const OUT_UI_SET_SAFE_ATTACK_MODE = 'ui-set-safe-attack-mode';
export const OUT_UI_SET_RUN_MODE = 'ui-set-run-mode';
export const OUT_UI_SET_GENDER = 'ui-set-gender';
export const OUT_UI_SET_SKIN_COLOR = 'ui-set-skin-color';
export const OUT_UI_SET_UNDERWEAR_COLOR = 'ui-set-underwear-color';
export const OUT_UI_SET_HAIR_STYLE = 'ui-set-hair-style';
export const OUT_UI_SET_CAMERA_ZOOM = 'ui-set-camera-zoom';
export const OUT_UI_SET_MUSIC_VOLUME = 'ui-set-music-volume';
export const OUT_UI_SET_SOUND_VOLUME = 'ui-set-sound-volume';
export const OUT_UI_SET_SELECTED_MUSIC = 'ui-set-music-changed';
export const OUT_UI_SET_SELECTED_MAP = 'ui-set-selected-map';
export const OUT_UI_SET_GAME_WORLDS = 'ui-set-game-worlds';
export const OUT_UI_SET_MONSTERS = 'ui-set-monsters';
/** Payload: { id: number; name: string }[] from InitialState npc_directory */
export const OUT_UI_SET_NPC_DIRECTORY = 'ui-set-npc-directory';
export const OUT_UI_SET_SPELLS = 'ui-set-spells';
export const OUT_UI_GAME_STATS_UPDATE = 'ui-receive-game-stats-update';
export const OUT_UI_MOUSE_POSITION_UPDATE = 'ui-receive-mouse-position-update';
export const OUT_UI_CAMERA_FOLLOW_PLAYER_CHANGED = 'ui-receive-camera-follow-player-changed';
export const OUT_UI_MINIMAP_CAPTURED = 'ui-minimap-captured';
/** Emitted when a map starts loading. Payload: { minimap, mapName, mapSizeX?, mapSizeY? } */
export const OUT_UI_MINIMAP_LOADING = 'ui-minimap-loading';
/** Phaser → React: local player died (must stay distinct from intra-Phaser `PLAYER_DIED`). */
export const OUT_UI_PLAYER_DIED = 'ui-player-died';
export const OUT_MAP_LOADED = 'map-loaded';
