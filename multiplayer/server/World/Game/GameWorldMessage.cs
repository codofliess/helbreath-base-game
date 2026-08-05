using Server;
using Mmorpg.Network;

namespace Server.World.Game;

/// <summary>Base type for messages delivered to a single <see cref="GameWorld"/> mailbox.</summary>
public abstract record GameWorldMessage;

/// <summary>Persisted character settings and location captured from a <see cref="GameWorldPlayer"/> for disk saves, login restore, and world transfer handoff.</summary>
public sealed record PersistedInventoryItem(
    int ItemId,
    long ItemUid,
    int? BagX,
    int? BagY,
    int Quantity,
    int BagZIndex,
    ItemEffectConfig[]? EffectOverrides,
    uint ItemAttribute = 0,
    int ItemColor = 0,
    int CurLifeSpan = 0,
    int MaxLifeSpan = 0,
    int BindState = 0,
    string BoundGuildId = "",
    int CicLevel = 0,
    int CicStatKind = 0,
    int CicStatValue = 0,
    int SiphonLevel = 0);

/// <summary>Persisted equipped item row keyed by server slot name (for example <c>weapon</c> or <c>ring-left</c>).</summary>
public sealed record PersistedEquippedItem(
    int ItemId,
    long ItemUid,
    int? BagX,
    int? BagY,
    ItemEffectConfig[]? EffectOverrides,
    uint ItemAttribute = 0,
    int ItemColor = 0,
    int CurLifeSpan = 0,
    int MaxLifeSpan = 0,
    int BindState = 0,
    string BoundGuildId = "",
    int CicLevel = 0,
    int CicStatKind = 0,
    int CicStatValue = 0,
    int SiphonLevel = 0);

/// <summary>Persisted equipped item row keyed by server slot name (for example <c>weapon</c> or <c>ring-left</c>); omits bag-only runtime fields like quantity and z-order.</summary>
public sealed record PersistedEquippedInventoryItem(
    string Slot,
    PersistedEquippedItem Item);

/// <summary>Lifetime credited kills for one catalog monster id; persisted with the character.</summary>
public sealed record PersistedMonsterKill(int MonsterId, long Kills);

/// <summary>Persisted character settings and location captured from a <see cref="GameWorldPlayer"/> for disk saves, login restore, and world transfer handoff. Optional <c>FacingDirection</c> is grid facing 0–7; absent in older JSON files.</summary>
public sealed record PlayerPersistenceState(
    string GameWorldId,
    int X,
    int Y,
    int MovementSpeedMs,
    int CastSpeedMs,
    int AttackSpeedMs,
    int AttackRange,
    int Damage,
    int StunDuration,
    int AttackType,
    bool AttackMode,
    bool RunMode,
    bool AllowDashAttack,
    /// <summary>0 = male, 1 = female; matches <see cref="Mmorpg.Network.PlayerGender"/>.</summary>
    int GenderValue = 0,
    /// <summary>0 = light, 1 = tanned, 2 = dark; matches <see cref="Mmorpg.Network.PlayerSkinColor"/>.</summary>
    int SkinColorValue = 0,
    /// <summary>Hair style index 0–7 (client Style 1–8).</summary>
    int HairStyleIndex = 0,
    /// <summary>Underwear palette index 0–7.</summary>
    int UnderwearColorIndex = 0,
    int? FacingDirection = null,
    PersistedInventoryItem[]? BagItems = null,
    PersistedEquippedInventoryItem[]? EquippedItems = null,
    string CharacterName = "",
    /// <summary>Exp within the current rebirth cycle (Olympia curve).</summary>
    long Exp = 0,
    int Level = 1,
    int Rebirth = 0,
    PersistedMonsterKill[]? MonsterKills = null,
    /// <summary>Milestone ids already claimed (guaranteed rewards are one-time per character).</summary>
    string[]? ClaimedMilestones = null,
    /// <summary>SELECTCHAR desk slot 0–3.</summary>
    int SlotIndex = 0,
    /// <summary>Lifetime hours played (fractional); incremented on each save from session elapsed time.</summary>
    double HoursPlayed = 0,
    /// <summary>Classic starting/current stats shown on SELECTCHAR (default 10).</summary>
    int Str = 10,
    int Vit = 10,
    int Dex = 10,
    int Int = 10,
    int Mag = 10,
    int Chr = 10,
    /// <summary>Optional beginner path 1→80 progress flags (see <c>docs/BEGINNER-PATH-1-80.md</c>).</summary>
    PersistedBeginnerPathState? BeginnerPath = null,
    /// <summary>William warehouse stacks (classic bank); null/empty for characters that never deposited.</summary>
    PersistedInventoryItem[]? WarehouseItems = null,
    /// <summary>Howard guild-hall interest register (beginner path / pre-Fase H stub). Persisted.</summary>
    bool GuildInterestRegistered = false,
    /// <summary>Citizenship side stamp for auction city gates (aresden / elvine / traveler). Persisted.</summary>
    string CitizenshipSide = "",
    /// <summary>Fase H guild id stub for auction guild gates; empty until real guilds exist. Persisted.</summary>
    string GuildId = "",
    /// <summary>0=none, 1=member, 2=captain, 3=guild master. Persisted stub until full guilds.</summary>
    int GuildRank = 0,
    /// <summary>Helbreath-style reputation stub for auction anti-alt gate; not combat-fed yet. Persisted.</summary>
    int Reputation = 0,
    /// <summary>Olympia Safe Attack mode (Home key). Persisted.</summary>
    bool SafeAttackMode = false,
    /// <summary>Olympia majestic / gizon points for angel + DK weapon upgrades. Persisted.</summary>
    int MajesticPoints = 0,
    /// <summary>Olympia Magic.cfg spell ids learned at the Magic Tower (Gandalf). Persisted.</summary>
    int[]? LearnedOlympiaSpellIds = null,
    /// <summary>Chain Lords Block Level: freeze level; new exp → majestic. Persisted.</summary>
    bool LevelBlocked = false,
    /// <summary>Olympia <c>m_iHungerStatus</c> 0–100 (100 = full). Persisted.</summary>
    int HungerStatus = 100,
    /// <summary>Skill masteries 0–100 (SKILLCFG order). Null = all zeros.</summary>
    int[]? SkillLevels = null,
    /// <summary>Mock / ledger $HELL staked for specialty utility (floor/100k → +10 levels). Not yield.</summary>
    long StakedHell = 0,
    /// <summary>Olympia shards/fragments inventory (disenchant materials). Null = empty.</summary>
    PersistedEnchantMaterial[]? EnchantMaterials = null,
    /// <summary>City contribution (Garden quests, etc.). Persisted.</summary>
    int Contribution = 0,
    /// <summary>Active Garden quest id (garden_unicorn / garden_troll) or empty.</summary>
    string GardenQuestId = "",
    /// <summary>Kills toward the active Garden quest.</summary>
    int GardenQuestProgress = 0,
    /// <summary>Pre-rebirth snapshot for cancel/rollback (Olympia-like undo). Null = no cancel available.</summary>
    PersistedRebirthRollbackSnapshot? RebirthRollback = null);

/// <summary>Full character progression snapshot taken immediately before a successful rebirth.</summary>
public sealed record PersistedRebirthRollbackSnapshot(
    int Rebirth,
    int Level,
    long Exp,
    int MajesticPoints,
    int Str,
    int Vit,
    int Dex,
    int Int,
    int Mag,
    int Chr,
    bool LevelBlocked = false);

/// <summary>One stack of Olympia enchant material (shard or fragment) at a given type+level.</summary>
public sealed record PersistedEnchantMaterial(
    bool IsShard,
    int Type,
    int Level,
    int Count);

/// <summary>Persisted beginner-path flags stored inside <see cref="PlayerPersistenceState"/> / <c>state_json</c>.</summary>
public sealed record PersistedBeginnerPathState(
    bool Enrolled = false,
    bool Abandoned = false,
    string? ActiveQuestId = null,
    int Progress = 0,
    string[]? CompletedQuestIds = null);

/// <summary>One equipped slot for SELECTCHAR walk preview (slot name + catalog item id).</summary>
public sealed record CharacterListEquipPreview(string Slot, int ItemId);

/// <summary>Lightweight SELECTCHAR desk row for CharacterListResponse (includes visible equip for menu preview).</summary>
public sealed record CharacterListEntry(
    int SlotIndex,
    string Name,
    int Level,
    long Exp,
    int Rebirth,
    double HoursPlayed,
    int Str,
    int Vit,
    int Dex,
    int Int,
    int Mag,
    int Chr,
    int GenderValue = 0,
    int SkinColorValue = 0,
    int HairStyleIndex = 0,
    int UnderwearColorIndex = 0,
    IReadOnlyList<CharacterListEquipPreview>? Equipped = null,
    /// <summary>aresden | elvine | traveler (from state_json CitizenshipSide).</summary>
    string CitizenshipSide = "");

/// <summary>State carried across worlds during a transfer: session identity plus the player settings snapshot to reapply in the target world.</summary>
public sealed record TransferredPlayerState(
    Guid SessionId,
    PlayerPersistenceState State,
    bool TravelerMode = false,
    string AccountWallet = "",
    string? RemoteIp = null,
    /// <summary>Arena Pre-Ready kit JSON (re-applied on tournament arena entry after transfer).</summary>
    string? ArenaKitJson = null);

/// <summary>Authoritative destination chosen by the source world; spawn coordinates are optional for non-teleport transfers.</summary>
public sealed record WorldTransferDestination(string WorldId, int? SpawnX, int? SpawnY);

/// <summary>First-time join: session id plus outbound hooks installed on the WebSocket connection.</summary>
public sealed record PlayerConnectedMessage(
    Guid SessionId,
    Action<ServerMessage> SendMessage,
    Action<string?> RequestDisconnect,
    Action<WorldTransferDestination> RequestWorldChange,
    PlayerPersistenceState? PersistedState,
    string CharacterName,
    string AccountWallet,
    /// <summary>Clears pending logout and notifies client when combat damage cancels a timed logout.</summary>
    Action InterruptLogoutDueToCombat,
    /// <summary>SELECTCHAR desk slot 0–3 from authenticate (used when creating a new character).</summary>
    int SlotIndex = 0,
    /// <summary>Create-character appearance; null fields keep server defaults.</summary>
    int? Gender = null,
    int? SkinColor = null,
    int? HairStyleIndex = null,
    int? UnderwearColorIndex = null,
    /// <summary>When true, strip GM sandbox powers and only grant traveler starter spells.</summary>
    bool TravelerMode = false,
    /// <summary>Create-character point-buy; null fields keep server defaults (10).</summary>
    int? Str = null,
    int? Vit = null,
    int? Dex = null,
    int? Int = null,
    int? Mag = null,
    int? Chr = null,
    /// <summary>Client remote IP for auction fee-debt IP blocks (MVP).</summary>
    string? RemoteIp = null,
    /// <summary>Optional ?ref= code from AuthenticateRequest (first-touch attribution).</summary>
    string? ReferralCode = null,
    /// <summary>Optional Arena Pre-Ready kit JSON (applied on tournament-arena entry).</summary>
    string? ArenaKitJson = null) : GameWorldMessage;

/// <summary>Existing in-world player attached a new socket after disconnect grace.</summary>
public sealed record PlayerReconnectedMessage(
    Guid SessionId,
    Action<ServerMessage> SendMessage,
    Action<string?> RequestDisconnect,
    Action<WorldTransferDestination> RequestWorldChange,
    string CharacterName,
    string AccountWallet,
    /// <summary>Client remote IP for auction fee-debt IP blocks (MVP).</summary>
    string? RemoteIp = null) : GameWorldMessage;

/// <summary>Socket closed; <paramref name="SessionRemainsActive"/> controls whether others still see a disconnected ghost in range.</summary>
public sealed record PlayerDisconnectedMessage(Guid SessionId, bool SessionRemainsActive) : GameWorldMessage;

/// <summary>Emitted by cleanup when the reconnect window expired—world should remove the player entity.</summary>
public sealed record RemoveDisconnectedPlayerMessage(Guid SessionId) : GameWorldMessage;

/// <summary>Gameplay packet from an authenticated client already bound to this world.</summary>
public sealed record ClientPacketMessage(Guid SessionId, ClientMessage Message) : GameWorldMessage;

/// <summary>Ask a world to snapshot the current player settings and location for immediate persistence in <c>Server.cs</c>.</summary>
public sealed record SavePlayerStateRequestMessage(
    Guid SessionId,
    TaskCompletionSource<PlayerPersistenceState?> Completion) : GameWorldMessage;

/// <summary>Ask source world to remove the player and signal <see cref="Completion"/> with transfer payload.</summary>
public sealed record TransferPlayerOutMessage(
    Guid SessionId,
    string TargetWorldId,
    TaskCompletionSource<TransferredPlayerState?> Completion) : GameWorldMessage;

/// <summary>Ask target world to spawn the player using preserved state and the same send/disconnect hooks.</summary>
public sealed record TransferPlayerInMessage(
    TransferredPlayerState Player,
    int? SpawnX,
    int? SpawnY,
    Action<ServerMessage> SendMessage,
    Action<string?> RequestDisconnect,
    Action<WorldTransferDestination> RequestWorldChange,
    Action InterruptLogoutDueToCombat) : GameWorldMessage;
