using System.Collections.Generic;
using System.Linq;
using System.Threading.RateLimiting;
using Mmorpg.Network;
using Server.Helpers;
using Server.Utils;
using Server.World;

namespace Server.World.Game;

/// <summary>
/// Per-session avatar on a map: grid position, visibility set, ping samples, movement anti-cheat, optional spawn protection,
/// combat interrupt stunlock timing for movement validation, and one authoritative per-player inventory.
/// Connection callbacks may be cleared while the entity remains for reconnect grace.
/// </summary>
public class GameWorldPlayer : GameWorldActionableEntity {
    private Action<ServerMessage>? sendMessage;
    private Action<string?>? requestDisconnect;
    private readonly Action<WorldTransferDestination> requestWorldChange;
    /// <summary>Invoked when combat damage cancels a pending timed logout (clears session logout deadline and notifies the client).</summary>
    private readonly Action interruptLogoutDueToCombat;
    /// <summary>Other player ids currently considered within this client's view radius (server authority).</summary>
    private readonly HashSet<long> playersInRange = new();
    /// <summary>Monster ids currently within this client's view radius (server authority).</summary>
    private readonly HashSet<long> monstersInRange = new();
    /// <summary>NPC instance ids currently within this client's view radius (server authority).</summary>
    private readonly HashSet<long> npcsInRange = new();
    /// <summary>Ground effect ids currently within this client's view radius (server authority).</summary>
    private readonly HashSet<long> groundEffectsInRange = new();
    /// <summary>Top-most ground item ids currently within this client's view radius (server authority).</summary>
    private readonly HashSet<long> groundItemsInRange = new();
    private readonly MovementSpeedViolationCheckConfig movementSpeedViolationCheckConfig;
    /// <summary>Fraction of each base timing (ms) withheld in addition to <see cref="GetCappedPingVariance"/> for anti-cheat slack; from <c>Settings.json</c> <c>timings.antiHackTimingLagFactor</c>.</summary>
    private readonly double antiHackTimingLagFactor;
    private readonly PlayerPingTracker playerPingTracker;
    /// <summary>Sliding-window limiter for rapid successive moves; recreated when paralysis resets the window.</summary>
    private SlidingWindowRateLimiter movementSpeedViolations;

    /// <summary>Authoritative current HP; reduced by combat hits. Reset to <see cref="maxHp"/> on <see cref="SetInitialState"/>.</summary>
    private int hp;
    /// <summary>Authoritative max HP for this session; sent in <see cref="Mmorpg.Network.InitialState"/> and <see cref="Mmorpg.Network.HpUpdated"/>.</summary>
    private int maxHp;
    /// <summary>Authoritative current / max MP (Olympia Mag*2 + Level*2 + Int/2).</summary>
    private int mp;
    private int maxMp;
    /// <summary>Authoritative current / max SP (Olympia Level*2 + Str*2).</summary>
    private int sp;
    private int maxSp;
    /// <summary>When true, this avatar joined from the traveler client — soft combat and limited spells.</summary>
    private bool travelerMode;
    /// <summary>Olympia Magic.cfg ids purchased at Magic Tower (Gandalf).</summary>
    private readonly HashSet<int> learnedOlympiaSpellIds = new();
    /// <summary>Base run ms/tile (walk = ×2). ~260 matches Olympia feel better than 220.</summary>
    private int movementSpeedMs = 260;
    /// <summary>Unix ms of the last accepted movement request for delta-based speed checks.</summary>
    private long lastMovementRequestMs;
    /// <summary>Ms since epoch of the last move/cast/attack/chat used by AFK tools when AFK-on-map is disabled.</summary>
    private long lastGameplayActivityMs;
    /// <summary>Ms since epoch of the last soft-offline XP drip tick (0 = never).</summary>
    private long lastSoftOfflineDripMs;
    /// <summary>True after an AFK warning chat was sent until the player acts again.</summary>
    private bool afkWarned;
    /// <summary>Ms since epoch of the last successful player attack damage delivery (scheduler callback); null until the first delivery this connection or after dash resets cadence.</summary>
    private long? lastPlayerAttackDamageDeliveredMs;
    private bool runningMode = true;
    private bool attackMode = true;
    /// <summary>Olympia Safe Attack: when true, PvP damage to non-enemy citizenship is rejected.</summary>
    private bool safeAttackMode = false;
    /// <summary>While active, movement requests snap the player back without consuming violations.</summary>
    private DateTimeOffset? serverForcedParalysisUntil;
    /// <summary>When set and <c>now</c> is before this instant, the combat interrupt stunlock window is still active for movement checks.</summary>
    private DateTimeOffset? combatInterruptStunlockUntil;
    /// <summary>Until this instant, server rejects non-pickup player actions after an accepted <see cref="Mmorpg.Network.PlayerPickupRequested"/>; lockout duration uses animation ms minus lag factor and <see cref="GetCappedPingVariance"/>.</summary>
    private DateTimeOffset? pickupDurationUntil;
    /// <summary>Until this instant, server rejects other player actions after an accepted <see cref="Mmorpg.Network.PlayerBowStanceRequested"/>; lockout duration uses animation ms minus lag factor and <see cref="GetCappedPingVariance"/>.</summary>
    private DateTimeOffset? bowStanceDurationUntil;
    /// <summary>When true, movement is rejected until protection is cleared (timer or first move).</summary>
    private bool spawnProtection;
    /// <summary>Interrupt stunlock duration (ms) from the last combat hit; cleared when <see cref="combatInterruptStunlockUntil"/> elapses.</summary>
    private int stunlockDurationMs;
    /// <summary>Increments on each combat hit that is not <see cref="Server.AttackType.NoInterrupt"/>; pending player-attack callbacks compare against a captured snapshot.</summary>
    private int interruptedCount;
    /// <summary>Ms of monster stunlock when this player lands <see cref="Server.AttackType.Stun"/> and <see cref="GameWorldMonster.TryApplyStunlock"/> succeeds; clamped 100–2000.</summary>
    private int attackStunDurationMs = 500;
    /// <summary>Chebyshev cells: authoritative melee reach vs monsters (sent in <see cref="Mmorpg.Network.InitialState"/>).</summary>
    private int attackRangeCells = 3;
    /// <summary>Authoritative melee damage vs monsters.</summary>
    private int damage = 100;
    /// <summary>Base time between melee attempts in ms; lag-compensation delay uses half this value.</summary>
    private int attackSpeedMs = 600;
    /// <summary>Full spell cast bar duration in ms; sent in <see cref="Mmorpg.Network.InitialState"/>; server clamps 200–2000.</summary>
    private int castSpeedMs = 1200;
    /// <summary>Persisted local-player hit mode selection mirrored back to the client UI; current combat validation still uses packet-provided attack type.</summary>
    private int attackType = (int)Server.AttackType.Stun;
    /// <summary>Persisted local-player preference for dash-attacks; currently mirrored to the client UI only.</summary>
    private bool allowDashAttack = true;
    /// <summary>Last spell selected by the player for the current cast flow; cleared on cancel or after the cast resolves.</summary>
    private int? requestedSpellId;
    /// <summary>Unix ms when the last accepted <see cref="Mmorpg.Network.SpellCastStartRequest"/> was processed; used for cast-request interval checks.</summary>
    private long? lastSpellCastStartMs;
    /// <summary>Per-player authoritative bag and equipment state; persisted across logout and world transfer.</summary>
    private readonly InventoryManager inventoryManager;
    /// <summary>0 = male, 1 = female; matches <see cref="Mmorpg.Network.PlayerGender"/>.</summary>
    private int genderValue;
    /// <summary>0 = light, 1 = tanned, 2 = dark; matches <see cref="Mmorpg.Network.PlayerSkinColor"/>.</summary>
    private int skinColorValue;
    /// <summary>Hair style index 0–7 (client Style 1–8).</summary>
    private int hairStyleIndex;
    /// <summary>Underwear palette index 0–7.</summary>
    private int underwearColorIndex;
    /// <summary>Client-supplied character display name from authenticate; persisted in <see cref="PlayerPersistenceState"/>.</summary>
    private string characterName = "";
    /// <summary>Account id from authenticate (Solana wallet pubkey when wallet login is used).</summary>
    private string accountWallet = "";
    /// <summary>Lifetime exp within the current rebirth cycle; resets to 0 on rebirth. Persisted.</summary>
    private long exp;
    /// <summary>Current level (1..Progression max); derived from <see cref="exp"/> via the Olympia curve on award. Persisted.</summary>
    private int level = 1;
    /// <summary>Completed rebirth count (0..Progression max). Persisted.</summary>
    private int rebirth;
    /// <summary>Olympia majestic / gizon points for angel + DK upgrades. Persisted.</summary>
    private int majesticPoints;
    /// <summary>Chain Lords Block Level: when true, kill exp converts to majestics instead of levels. Persisted.</summary>
    private bool levelBlocked;
    /// <summary>Pre-rebirth snapshot for cancel/rollback. Cleared after successful cancel. Persisted.</summary>
    private PersistedRebirthRollbackSnapshot? rebirthRollback;
    /// <summary>Lifetime credited monster kills keyed by catalog monster id (survives rebirth). Persisted.</summary>
    private readonly Dictionary<int, long> monsterKills = new();
    /// <summary>Mock / ledger $HELL staked for specialty level offset (floor/100k → +10 levels). Persisted.</summary>
    private long stakedHell;
    /// <summary>Olympia shards/fragments: key = (isShard, type, level) → count. Persisted.</summary>
    private readonly Dictionary<(bool IsShard, int Type, int Level), int> enchantMaterials = new();
    /// <summary>Milestone ids already claimed by this character (guaranteed rewards are one-time). Persisted.</summary>
    private readonly HashSet<string> claimedMilestones = new(StringComparer.Ordinal);
    /// <summary>SELECTCHAR desk slot 0–3. Persisted.</summary>
    private int slotIndex;
    /// <summary>Lifetime hours played before this session. Persisted; session elapsed is added on save.</summary>
    private double hoursPlayed;
    /// <summary>UTC instant when this session started (for hours-played accumulation).</summary>
    private DateTimeOffset sessionStartedAtUtc = DateTimeOffset.UtcNow;
    /// <summary>Classic STR/VIT/DEX/INT/MAG/CHR shown on SELECTCHAR. Persisted; default 10.</summary>
    private int str = 10;
    private int vit = 10;
    private int dex = 10;
    private int intel = 10;
    private int mag = 10;
    private int chr = 10;
    /// <summary>Olympia hunger 0–100 (100 = full). Persisted.</summary>
    private int hungerStatus = 100;
    /// <summary>Session: once-only tip when casting unequips a non-Devlin shield (no spam mid-fight).</summary>
    public bool HasSeenShieldCastHint { get; set; }

    /// <summary>Olympia m_iSuperAttackLeft — critical/super-attack charges (session). Cap = Level/10.</summary>
    private int superAttackLeft;
    /// <summary>Olympia m_iSuperAttackCount — passive regen tick counter (every 12 → +1 charge).</summary>
    private int superAttackTickCount;
    /// <summary>
    /// When true, the next confirmed melee hits consume Super Attack charges (crit).
    /// Olympia: player arms SA deliberately — never auto-fire just because charges exist.
    /// </summary>
    private bool superAttackArmed;
    /// <summary>Olympia m_iComboAttackCount 1–4 for CAD consecutive attack bonus.</summary>
    private int comboAttackCount;
    /// <summary>UTC of last hunger drain tick (DEF_HUNGERTIME clock).</summary>
    private DateTimeOffset lastHungerTickUtc = DateTimeOffset.UtcNow;
    /// <summary>Olympia skill masteries 0–100 (Mining=0, Fishing=1, …).</summary>
    private readonly int[] skillLevels = new int[Helpers.Skills.SkillCount];
    /// <summary>Equipped special ability type (Item.cfg m_sSpecialEffect); 0 = none.</summary>
    private int specialAbilityType;
    /// <summary>Active duration seconds from Item.cfg m_sSpecialEffectValue1.</summary>
    private int specialAbilityDurationSec;
    /// <summary>Equip slot string of the SA item (weapon / armor / shield).</summary>
    private string? specialAbilityEquipSlot;
    /// <summary>UTC ms when active SA ends; 0 if not active.</summary>
    private long specialAbilityActiveUntilMs;
    /// <summary>UTC ms when cooldown ends (can activate again); 0 = ready.</summary>
    private long specialAbilityCooldownUntilMs;
    /// <summary>True after we already sent the "ready" notify for the current cooldown cycle.</summary>
    private bool specialAbilityReadyNotified = true;
    /// <summary>Gold Carp: suppress hunger drain + force full hunger until this UTC.</summary>
    private DateTimeOffset foodNoHungerUntilUtc = DateTimeOffset.MinValue;
    /// <summary>Green Carp: half stamina consumption until this UTC.</summary>
    private DateTimeOffset foodHalfSpUntilUtc = DateTimeOffset.MinValue;
    /// <summary>Gold Carp: +10% hitting probability until this UTC.</summary>
    private DateTimeOffset foodHitBonusUntilUtc = DateTimeOffset.MinValue;
    private DateTimeOffset nextGatherAllowedUtc = DateTimeOffset.MinValue;
    /// <summary>Optional beginner path enrolled flag. Persisted.</summary>
    private bool beginnerEnrolled;
    /// <summary>True when the player abandoned beginner training (no penalty). Persisted.</summary>
    private bool beginnerAbandoned;
    /// <summary>Active beginner quest id, or null when idle / abandoned / path exhausted. Persisted.</summary>
    private string? beginnerActiveQuestId;
    /// <summary>Progress counter toward the active beginner quest objective. Persisted.</summary>
    private int beginnerProgress;
    /// <summary>Completed beginner quest ids (kept after abandon). Persisted.</summary>
    private readonly HashSet<string> beginnerCompletedQuestIds = new(StringComparer.Ordinal);
    /// <summary>William warehouse stacks (classic bank). Persisted; not used inside tournament arena.</summary>
    private readonly List<InventoryItemState> warehouseItems = new();
    /// <summary>Howard guild registry interest flag (beginner path / pre-Fase H). Persisted.</summary>
    private bool guildInterestRegistered;
    /// <summary>Citizenship side for auction city gates (aresden / elvine / traveler).</summary>
    private string citizenshipSide = "";
    /// <summary>Fase H guild id stub for auction guild filters.</summary>
    private string guildId = "";
    /// <summary>0=none, 1=member, 2=captain, 3=guild master. Persisted stub.</summary>
    private int guildRank;
    /// <summary>Reputation stub for auction anti-alt (not combat-fed yet).</summary>
    private int reputation;
    /// <summary>City contribution (Garden unicorn/troll quests, etc.).</summary>
    private int contribution;
    /// <summary>Active Garden quest id or empty.</summary>
    private string gardenQuestId = "";
    /// <summary>Kill progress on active Garden quest.</summary>
    private int gardenQuestProgress;
    /// <summary>Last known remote IP for auction debt enforcement.</summary>
    private string lastKnownIp = "";
    /// <summary>Session-local Training Arena chase-dummy monster ids (not persisted; cleared on leave / re-apply).</summary>
    private readonly List<long> trainingDummyMonsterIds = new();
    /// <summary>Session-local Timed Challenge Mode 1 runner monster ids (not persisted).</summary>
    private readonly List<long> timedChallengeMonsterIds = new();
    /// <summary>Active timed challenge run, or null when idle.</summary>
    private TimedChallenge.ActiveRun? timedChallengeRun;
    /// <summary>Ms since epoch when +50% EXP boost from timed challenge expires (0 = none).</summary>
    private long timedChallengeExpBoostExpiresAtMs;
    /// <summary>Cash-shop Exp Tablet (+200% EXP) expiry (0 = none).</summary>
    private long cashExpTabletExpiresAtMs;
    /// <summary>Cash-shop HP Tablet (2× max HP + regen) expiry.</summary>
    private long cashHpTabletExpiresAtMs;
    /// <summary>Cash-shop MP Tablet (free mana) expiry.</summary>
    private long cashMpTabletExpiresAtMs;
    /// <summary>Session-local party code when in a party (not persisted; cleared on leave / disconnect).</summary>
    private string? partyCode;
    /// <summary>Real character snapshot stashed while inside a tournament arena world; when set, <see cref="CreatePersistenceState"/> returns this instead of live arena state so tournament loadouts never persist.</summary>
    private PlayerPersistenceState? tournamentStash;
    /// <summary>Validated Arena Pre-Ready kit JSON (re-applied on every tournament-arena entry/transfer).</summary>
    private string? arenaKitJson;
    /// <summary>Live pact on Bleeding Island arena — cannot re-enter safe pad until cleared.</summary>
    private bool arenaSafeZoneLocked;
    /// <summary>Arena crit regen: charges added per tick interval (0 = classic Level/10 regen).</summary>
    private int arenaCritChargesPerTick;
    /// <summary>Arena crit regen interval in whole seconds (e.g. 30).</summary>
    private int arenaCritIntervalSec;
    /// <summary>Arena crit charge cap (e.g. 15). 0 = use Level/10.</summary>
    private int arenaCritCap;
    /// <summary>Arena Merien SA duration override (seconds). 0 = catalog default.</summary>
    private int arenaSaDurationSec;
    /// <summary>Arena Merien SA cooldown override (seconds). 0 = catalog 20 min.</summary>
    private int arenaSaCooldownSec;
    /// <summary>
    /// Arena kit credit spells: server spell id → remaining casts this entry.
    /// Inhibition / Cancellation / Sleep only castable when charges &gt; 0 (bought with kit credits).
    /// </summary>
    private readonly Dictionary<int, int> arenaPerUseSpellCharges = new();
    /// <summary>Olympia m_cHeroArmourBonus: 0 none, 1 war full set, 2 mage full set.</summary>
    private int heroArmourBonus;
    /// <summary>Player id of the most recent PvP attacker; paired with <see cref="lastPlayerAttackerAtMs"/> for kill attribution on death.</summary>
    private long lastPlayerAttackerId;
    /// <summary>Display name of the most recent PvP attacker (captured at hit time; attacker may disconnect before the death).</summary>
    private string lastPlayerAttackerName = "";
    /// <summary>Environment.TickCount64 of the most recent PvP hit; attribution expires after <see cref="PlayerAttackerAttributionWindowMs"/>.</summary>
    private long lastPlayerAttackerAtMs;

    /// <summary>PvP kill attribution window: a death within this many ms of the last player hit credits that attacker.</summary>
    private const long PlayerAttackerAttributionWindowMs = 10_000;

    public Guid SessionId { get; }
    public long PlayerId { get; }

    protected override TemporaryEffectEntityKind EntityKind => TemporaryEffectEntityKind.Player;
    protected override long EntityId => PlayerId;
    public IReadOnlyCollection<long> PlayersInRange => playersInRange;
    public IReadOnlyCollection<long> MonstersInRange => monstersInRange;
    public IReadOnlyCollection<long> NpcsInRange => npcsInRange;
    public IReadOnlyCollection<long> GroundEffectsInRange => groundEffectsInRange;
    public IReadOnlyCollection<long> GroundItemsInRange => groundItemsInRange;
    /// <summary>Training Arena dummies spawned for this session via ApplyPreset (empty outside world <c>training</c>).</summary>
    public IReadOnlyList<long> TrainingDummyMonsterIds => trainingDummyMonsterIds;
    /// <summary>Timed Challenge Mode 1 runner monster ids for this session.</summary>
    public IReadOnlyList<long> TimedChallengeMonsterIds => timedChallengeMonsterIds;
    /// <summary>Active timed challenge run, or null when idle.</summary>
    public TimedChallenge.ActiveRun? TimedChallengeRun => timedChallengeRun;
    /// <summary>Ms since epoch when timed-challenge EXP boost expires (0 = none).</summary>
    public long TimedChallengeExpBoostExpiresAtMs {
        get => timedChallengeExpBoostExpiresAtMs;
        set => timedChallengeExpBoostExpiresAtMs = value;
    }
    public long CashExpTabletExpiresAtMs {
        get => cashExpTabletExpiresAtMs;
        set => cashExpTabletExpiresAtMs = value;
    }
    public long CashHpTabletExpiresAtMs {
        get => cashHpTabletExpiresAtMs;
        set => cashHpTabletExpiresAtMs = value;
    }
    public long CashMpTabletExpiresAtMs {
        get => cashMpTabletExpiresAtMs;
        set => cashMpTabletExpiresAtMs = value;
    }
    /// <summary>Current party code, or null when not in a party (session-local).</summary>
    public string? PartyCode => partyCode;

    public int Hp => hp;
    public int MaxHp => maxHp;

    /// <summary>Olympia equipped SA type (1–5 attack, 50–52 defense); 0 = none.</summary>
    public int SpecialAbilityType => specialAbilityType;
    /// <summary>Configured active duration (seconds) for the equipped SA item.</summary>
    public int SpecialAbilityDurationSec => specialAbilityDurationSec;
    public string? SpecialAbilityEquipSlot => specialAbilityEquipSlot;
    public bool IsSpecialAbilityActive =>
        specialAbilityActiveUntilMs > 0 &&
        DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() < specialAbilityActiveUntilMs;
    public bool IsSpecialAbilityCooldownReady =>
        specialAbilityCooldownUntilMs <= 0 ||
        DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() >= specialAbilityCooldownUntilMs;
    public int SpecialAbilityCooldownRemainingSec {
        get {
            if (IsSpecialAbilityCooldownReady) {
                return 0;
            }
            var leftMs = specialAbilityCooldownUntilMs - DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            return Math.Max(0, (int)Math.Ceiling(leftMs / 1000.0));
        }
    }

    public void SetSpecialAbilityEquipped(int abilityType, int durationSec, string? equipSlot) {
        specialAbilityType = Math.Max(0, abilityType);
        specialAbilityDurationSec = Math.Max(0, durationSec);
        specialAbilityEquipSlot = equipSlot;
        if (specialAbilityType == 0) {
            specialAbilityActiveUntilMs = 0;
        }
    }

    public void ActivateSpecialAbility(long nowMs, int durationSec, int cooldownSec) {
        specialAbilityActiveUntilMs = nowMs + Math.Max(1, durationSec) * 1000L;
        // Olympia: cooldown starts at activation (not when the buff ends).
        specialAbilityCooldownUntilMs = nowMs + Math.Max(1, cooldownSec) * 1000L;
        specialAbilityReadyNotified = false;
    }

    public void ClearSpecialAbilityActive() {
        specialAbilityActiveUntilMs = 0;
    }

    public void StartSpecialAbilityCooldown(long nowMs, int cooldownSec) {
        specialAbilityActiveUntilMs = 0;
        specialAbilityCooldownUntilMs = nowMs + Math.Max(1, cooldownSec) * 1000L;
        specialAbilityReadyNotified = false;
    }

    /// <summary>Returns true if the active window just expired (cooldown already running from activate).</summary>
    public bool TryExpireSpecialAbility(long nowMs, out bool justExpired) {
        justExpired = false;
        if (specialAbilityActiveUntilMs > 0 && nowMs >= specialAbilityActiveUntilMs) {
            specialAbilityActiveUntilMs = 0;
            justExpired = true;
            return true;
        }
        return false;
    }

    /// <summary>Returns true once when cooldown elapses (for ready notify).</summary>
    public bool TryMarkSpecialAbilityReady(long nowMs) {
        if (specialAbilityReadyNotified) {
            return false;
        }
        if (specialAbilityType == 0) {
            return false;
        }
        if (specialAbilityCooldownUntilMs > 0 && nowMs >= specialAbilityCooldownUntilMs) {
            specialAbilityCooldownUntilMs = 0;
            specialAbilityReadyNotified = true;
            return true;
        }
        return false;
    }
    public int Mp => mp;
    public int MaxMp => maxMp;
    public int Sp => sp;
    public int MaxSp => maxSp;
    /// <summary>Olympia super-attack / critical charges remaining.</summary>
    public int SuperAttackLeft => superAttackLeft;
    /// <summary>Max super-attack charges (Level/10, min 1; arena kit may raise cap to 15).</summary>
    public int MaxSuperAttack => arenaCritCap > 0 ? arenaCritCap : Math.Max(1, level / 10);
    /// <summary>Arena SA cooldown override seconds (0 = default catalog).</summary>
    public int ArenaSpecialAbilityCooldownSec => arenaSaCooldownSec;
    /// <summary>Pending arena kit JSON for re-apply on arena world entry.</summary>
    public string? ArenaKitJson => arenaKitJson;
    /// <summary>Olympia full Hero set: 0 none, 1 war (+100 HR / +5 AP), 2 mage (+4 dmg).</summary>
    public int HeroArmourBonus => heroArmourBonus;

    public void SetHeroArmourBonus(int bonus) {
        heroArmourBonus = bonus is 1 or 2 ? bonus : 0;
    }
    /// <summary>True when the player armed Super Attack (crit will consume charges on hit).</summary>
    public bool SuperAttackArmed => superAttackArmed;

    public void SetSuperAttackArmed(bool armed) {
        superAttackArmed = armed && superAttackLeft > 0;
    }
    /// <summary>Current melee combo chain count (1–4) for CAD.</summary>
    public int ComboAttackCount => comboAttackCount;
    /// <summary>True when this session must not use GM sandbox combat/spell privileges.</summary>
    public bool TravelerMode => travelerMode;
    /// <summary>True when <see cref="hp"/> is below 1 (lethal threshold).</summary>
    public bool IsDead => hp < 1;
    public bool Disconnected { get; private set; }
    public bool RunningMode => runningMode;
    public bool AttackMode => attackMode;
    /// <summary>Olympia Safe Attack flag (Home key); independent of <see cref="AttackMode"/>.</summary>
    public bool SafeAttackMode => safeAttackMode;
    public int BaseMovementSpeedMs => movementSpeedMs;

    /// <summary>Final ms per tile (run/walk base with temporary-effect modifiers); matches client tile duration.</summary>
    public int MovementSpeedMs =>
        Math.Clamp(
            TemporaryEffectSpeedModifierMath.ApplyModifierSumToDurationMs(
                runningMode ? movementSpeedMs : movementSpeedMs * 2,
                temporaryEffectMovementSpeedModifierSum),
            100,
            1000);

    /// <summary>Base melee cadence ms from UI/persistence before temporary-effect modifiers.</summary>
    public int BaseAttackSpeedMs => attackSpeedMs;

    /// <summary>Base spell cast bar ms from UI/persistence before temporary-effect modifiers.</summary>
    public int BaseCastSpeedMs => castSpeedMs;
    public double PingVariance => playerPingTracker.PingVariance;
    public long LastPingTimeMs => playerPingTracker.LastPingTimeMs;
    /// <summary>Ms since epoch of last gameplay activity for AFK tooling.</summary>
    public long LastGameplayActivityMs => lastGameplayActivityMs;
    /// <summary>Ms since epoch of last soft-offline XP drip; writable by anti-bot soft offline drip.</summary>
    public long LastSoftOfflineDripMs {
        get => lastSoftOfflineDripMs;
        set => lastSoftOfflineDripMs = value;
    }
    /// <summary>Whether an AFK warning was already sent for the current idle streak.</summary>
    public bool AfkWarned {
        get => afkWarned;
        set => afkWarned = value;
    }
    public bool SpawnProtection => spawnProtection;
    /// <summary>Combat interrupt stunlock duration (ms) for the active window; 0 when not stunlocked.</summary>
    public int StunlockDurationMs => stunlockDurationMs;

    /// <summary>Generation counter for interrupting hits; <see cref="RegisterNonNoInterruptDamage"/> increments. Starts at 0; reset with connection state.</summary>
    public int InterruptedCount => interruptedCount;

    /// <summary>Chebyshev cells: authoritative melee reach vs monsters (sent in <see cref="Mmorpg.Network.InitialState"/>).</summary>
    public int AttackRange => attackRangeCells;

    /// <summary>Authoritative melee damage vs monsters until per-player stats exist.</summary>
    public int Damage => damage;

    /// <summary>Effective time between melee attempts in ms (base + temporary-effect modifiers + Agile weapon).</summary>
    public int AttackSpeedMs {
        get {
            var ms = TemporaryEffectSpeedModifierMath.ApplyModifierSumToDurationMs(
                attackSpeedMs,
                temporaryEffectAttackSpeedModifierSum);
            // Agile primary on weapon: physical swing faster (Olympia Attack Speed-1).
            var agile = Helpers.ItemMagicAttribute.ComputeEquippedBonuses(this).AgileAttackSpeedMsReduce;
            if (agile > 0) {
                ms -= agile;
            }
            return Math.Clamp(ms, 200, 2000);
        }
    }

    /// <summary>Monster stunlock duration (ms) for this player’s Stun hits; sent in <see cref="Mmorpg.Network.InitialState"/>.</summary>
    public int AttackStunDurationMs => attackStunDurationMs;

    /// <summary>Effective spell cast bar duration in ms (base + temporary-effect modifiers).</summary>
    public int CastSpeedMs =>
        Math.Clamp(
            TemporaryEffectSpeedModifierMath.ApplyModifierSumToDurationMs(castSpeedMs, temporaryEffectCastSpeedModifierSum),
            200,
            2000);
    /// <summary>Persisted local-player hit mode selection mirrored to the client UI.</summary>
    public int AttackType => attackType;
    /// <summary>Persisted local-player dash-attack toggle mirrored to the client UI.</summary>
    public bool AllowDashAttack => allowDashAttack;
    public int? RequestedSpellId => requestedSpellId;
    public InventoryManager InventoryManager => inventoryManager;

    /// <summary>Classic warehouse stacks for William (deposit/withdraw); empty until first deposit.</summary>
    public IReadOnlyList<InventoryItemState> WarehouseItems => warehouseItems;

    /// <summary>0 = male, 1 = female; matches <see cref="Mmorpg.Network.PlayerGender"/>.</summary>
    public int GenderValue => genderValue;

    /// <summary>0 = light, 1 = tanned, 2 = dark; matches <see cref="Mmorpg.Network.PlayerSkinColor"/>.</summary>
    public int SkinColorValue => skinColorValue;

    /// <summary>Hair style index 0–7.</summary>
    public int HairStyleIndex => hairStyleIndex;

    /// <summary>Underwear palette index 0–7.</summary>
    public int UnderwearColorIndex => underwearColorIndex;

    /// <summary>Client-supplied character display name from authenticate; persisted with player saves.</summary>
    public string CharacterName => characterName;
    public string AccountWallet => accountWallet;

    public long Exp => exp;
    public int Level => level;
    public int Rebirth => rebirth;
    /// <summary>Olympia majestic / gizon points (angel + Dark Knight upgrades).</summary>
    public int MajesticPoints => majesticPoints;
    /// <summary>Chain Lords Block Level: freeze leveling; new exp → majestic.</summary>
    public bool LevelBlocked => levelBlocked;
    /// <summary>True when a pre-rebirth snapshot exists (can cancel last rebirth).</summary>
    public bool HasRebirthRollback => rebirthRollback is not null;
    /// <summary>Mock / ledger $HELL staked for specialty utility (no yield). floor(staked/100k)*10 effective levels.</summary>
    public long StakedHell => stakedHell;
    /// <summary>Classic STR (create-char / SELECTCHAR).</summary>
    public int Str => str;
    /// <summary>Classic VIT (create-char / SELECTCHAR).</summary>
    public int Vit => vit;
    /// <summary>Classic DEX (create-char / SELECTCHAR).</summary>
    public int Dex => dex;
    /// <summary>Classic INT (create-char / SELECTCHAR).</summary>
    public int Int => intel;
    /// <summary>Classic MAG (create-char / SELECTCHAR).</summary>
    public int Mag => mag;
    /// <summary>Classic CHR (create-char / SELECTCHAR).</summary>
    public int Chr => chr;
    /// <summary>Olympia <c>m_iHungerStatus</c> 0–100 (100 = full).</summary>
    public int HungerStatus => hungerStatus;
    public DateTimeOffset LastHungerTickUtc => lastHungerTickUtc;

    public void SetHungerStatus(int value) {
        hungerStatus = Math.Clamp(value, 0, Helpers.Hunger.MaxHunger);
    }

    /// <summary>Sets mock/ledger staked $HELL used only for specialty effective level offset.</summary>
    public void SetStakedHell(long amount) {
        stakedHell = Math.Max(0, amount);
    }

    public void SetLastHungerTickUtc(DateTimeOffset utc) {
        lastHungerTickUtc = utc;
    }

    public int GetSkillLevel(int skillId) {
        if (skillId < 0 || skillId >= skillLevels.Length) {
            return 0;
        }
        return skillLevels[skillId];
    }

    public void SetSkillLevel(int skillId, int level) {
        if (skillId < 0 || skillId >= skillLevels.Length) {
            return;
        }
        skillLevels[skillId] = Math.Clamp(level, 0, Helpers.Skills.MaxLevel);
    }

    public int[] SnapshotSkillLevels() {
        var copy = new int[skillLevels.Length];
        Array.Copy(skillLevels, copy, skillLevels.Length);
        return copy;
    }

    public bool TryBeginGather(TimeSpan cooldown) {
        var now = DateTimeOffset.UtcNow;
        if (now < nextGatherAllowedUtc) {
            return false;
        }
        nextGatherAllowedUtc = now.Add(cooldown);
        return true;
    }

    public bool HasFoodNoHunger => DateTimeOffset.UtcNow < foodNoHungerUntilUtc;
    public bool HasFoodHalfSp => DateTimeOffset.UtcNow < foodHalfSpUntilUtc;
    public bool HasFoodHitBonus => DateTimeOffset.UtcNow < foodHitBonusUntilUtc;

    public void ApplyGoldCarpBuff(TimeSpan duration) {
        var until = DateTimeOffset.UtcNow.Add(duration);
        foodNoHungerUntilUtc = until;
        foodHitBonusUntilUtc = until;
        SetHungerStatus(Helpers.Hunger.MaxHunger);
    }

    public void ApplyGreenCarpBuff(TimeSpan duration) {
        var until = DateTimeOffset.UtcNow.Add(duration);
        foodNoHungerUntilUtc = until;
        foodHalfSpUntilUtc = until;
        SetHungerStatus(Helpers.Hunger.MaxHunger);
    }

    public IReadOnlyDictionary<int, long> MonsterKills => monsterKills;
    public IReadOnlyCollection<string> ClaimedMilestones => claimedMilestones;
    public bool BeginnerEnrolled => beginnerEnrolled;
    public bool BeginnerAbandoned => beginnerAbandoned;
    public string? BeginnerActiveQuestId => beginnerActiveQuestId;
    public int BeginnerProgress => beginnerProgress;
    public IReadOnlyCollection<string> BeginnerCompletedQuestIds => beginnerCompletedQuestIds;
    /// <summary>True when the player registered guild interest with Howard.</summary>
    public bool GuildInterestRegistered => guildInterestRegistered;
    /// <summary>Citizenship side stamp (aresden / elvine / traveler) for auction city gates.</summary>
    public string CitizenshipSide => citizenshipSide;
    /// <summary>Fase H guild id stub; empty until real guilds exist.</summary>
    public string GuildId => guildId;

    /// <summary>0=none, 1=member, 2=captain, 3=guild master.</summary>
    public int GuildRank => guildRank;
    /// <summary>Reputation stub for auction anti-alt (not combat-fed yet).</summary>
    public int Reputation => reputation;
    /// <summary>City contribution points (Garden quests).</summary>
    public int Contribution => contribution;
    /// <summary>Active Garden quest id (garden_unicorn / garden_troll) or empty.</summary>
    public string GardenQuestId => gardenQuestId;
    /// <summary>Kills toward active Garden quest.</summary>
    public int GardenQuestProgress => gardenQuestProgress;
    /// <summary>Last known remote IP (auction fee-debt IP block MVP).</summary>
    public string LastKnownIp => lastKnownIp;

    public GameWorldPlayer(
        Guid sessionId,
        Action<ServerMessage> sendMessage,
        Action<string?> requestDisconnect,
        Action<WorldTransferDestination> requestWorldChange,
        Action interruptLogoutDueToCombat,
        IReadOnlyDictionary<int, ItemConfig> itemsById,
        Server.MovementSpeedViolationCheckConfig violationCheckConfig,
        int pingVarianceSampleSize,
        double antiHackTimingLagFactor) {
        ArgumentNullException.ThrowIfNull(sendMessage);
        ArgumentNullException.ThrowIfNull(requestDisconnect);
        ArgumentNullException.ThrowIfNull(requestWorldChange);
        ArgumentNullException.ThrowIfNull(interruptLogoutDueToCombat);
        ArgumentNullException.ThrowIfNull(itemsById);
        ArgumentNullException.ThrowIfNull(violationCheckConfig);
        SessionId = sessionId;
        PlayerId = BitConverter.ToInt64(sessionId.ToByteArray(), 0);
        this.interruptLogoutDueToCombat = interruptLogoutDueToCombat;
        this.requestWorldChange = requestWorldChange;
        this.movementSpeedViolationCheckConfig = violationCheckConfig;
        this.antiHackTimingLagFactor = antiHackTimingLagFactor;
        inventoryManager = new InventoryManager(itemsById);
        playerPingTracker = new PlayerPingTracker(pingVarianceSampleSize);
        movementSpeedViolations = CreateMovementSpeedViolationsLimiter(violationCheckConfig);
        lastGameplayActivityMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        SetFacingDirection(1);
        AttachConnection(sendMessage, requestDisconnect);
    }

    /// <summary>Builds a rate limiter from config segments-per-window settings.</summary>
    private static SlidingWindowRateLimiter CreateMovementSpeedViolationsLimiter(MovementSpeedViolationCheckConfig config) {
        return new SlidingWindowRateLimiter(new SlidingWindowRateLimiterOptions {
            PermitLimit = config.Limit,
            Window = TimeSpan.FromSeconds(config.Window),
            SegmentsPerWindow = config.SegmentsPerWindow,
        });
    }

    public void SetSpawnProtection(bool value) {
        spawnProtection = value;
    }

    public void AttachConnection(Action<ServerMessage> sendMessage, Action<string?> requestDisconnect) {
        ArgumentNullException.ThrowIfNull(sendMessage);
        ArgumentNullException.ThrowIfNull(requestDisconnect);

        this.sendMessage = sendMessage;
        this.requestDisconnect = requestDisconnect;
        Disconnected = false;
        ResetConnectionState();
    }

    public void DetachConnection() {
        sendMessage = null;
        requestDisconnect = null;
        Disconnected = true;
        ClearPlayersInRange();
        ResetConnectionState();
    }

    public void SetMovementSpeedMs(int ms) {
        var clamped = Math.Clamp(ms, 100, 500);
        if (movementSpeedMs == clamped) {
            return;
        }

        movementSpeedMs = clamped;
        InvalidateMovementCadenceBaselineAfterEffectiveSpeedChange();
    }

    public void SetRunningMode(bool value) {
        if (runningMode == value) {
            return;
        }

        runningMode = value;
        InvalidateMovementCadenceBaselineAfterEffectiveSpeedChange();
    }

    public void SetAttackMode(bool value) {
        attackMode = value;
    }

    /// <summary>Sets Olympia Safe Attack mode (blocks non-enemy PvP while armed).</summary>
    public void SetSafeAttackMode(bool value) {
        safeAttackMode = value;
    }

    /// <summary>Updates stunlock duration from the client UI when sync is enabled; clamps to 100–2000 ms.</summary>
    public void SetAttackStunDurationMs(int ms) {
        attackStunDurationMs = Math.Clamp(ms, 100, 2000);
    }

    /// <summary>Updates melee cadence from the client UI when sync is enabled; clamps to 200–2000 ms (matches client attack speed slider).</summary>
    public void SetAttackSpeedMs(int ms) {
        attackSpeedMs = Math.Clamp(ms, 200, 2000);
    }

    /// <summary>Updates melee reach from the client UI when sync is enabled; clamps to 1–20 cells.</summary>
    public void SetAttackRangeCells(int cells) {
        attackRangeCells = Math.Clamp(cells, 1, 20);
    }

    /// <summary>Updates melee damage vs monsters from the client UI when sync is enabled; clamps to 1–1000.</summary>
    public void SetAttackDamage(int value) {
        damage = Math.Clamp(value, 1, 1000);
    }

    /// <summary>Updates spell cast duration from the client UI when sync is enabled; clamps to 200–2000 ms.</summary>
    public void SetCastSpeedMs(int ms) {
        // Cannot cast faster than Mag/Magic-skill allows (Magic 100% → full speed even if Mag < 50).
        var fastest = Helpers.PlayerDerivedStats.FastestAllowedCastSpeedMs(this);
        castSpeedMs = Math.Clamp(ms, fastest, 2000);
    }

    /// <summary>Updates the persisted local-player hit mode selection; invalid values fall back to <see cref="Server.AttackType.Stun"/>.</summary>
    public void SetAttackType(int value) {
        attackType = Enum.IsDefined(typeof(Server.AttackType), value)
            ? value
            : (int)Server.AttackType.Stun;
    }

    /// <summary>Updates the persisted local-player dash-attack preference mirrored to the client UI.</summary>
    public void SetAllowDashAttack(bool value) {
        allowDashAttack = value;
    }

    /// <summary>Sets gender, skin, hair, and underwear indices from client or persistence; clamps to wire ranges.</summary>
    public void SetAppearance(int gender, int skinColor, int hairIdx, int underwearIdx) {
        genderValue = gender is 0 or 1 ? gender : 0;
        skinColorValue = skinColor is >= 0 and <= 2 ? skinColor : 0;
        hairStyleIndex = Math.Clamp(hairIdx, 0, 7);
        underwearColorIndex = Math.Clamp(underwearIdx, 0, 7);
    }

    /// <summary>
    /// Classic create-character point-buy: each stat 10–14 and sum exactly 70.
    /// When any value is null or the set is invalid, keeps current defaults (all 10).
    /// </summary>
    public void TryApplyCreateCharacterStats(int? createStr, int? createVit, int? createDex, int? createInt, int? createMag, int? createChr) {
        if (createStr is null || createVit is null || createDex is null || createInt is null || createMag is null || createChr is null) {
            return;
        }

        var nextStr = createStr.Value;
        var nextVit = createVit.Value;
        var nextDex = createDex.Value;
        var nextInt = createInt.Value;
        var nextMag = createMag.Value;
        var nextChr = createChr.Value;
        if (!IsValidCreateCharacterStat(nextStr) ||
            !IsValidCreateCharacterStat(nextVit) ||
            !IsValidCreateCharacterStat(nextDex) ||
            !IsValidCreateCharacterStat(nextInt) ||
            !IsValidCreateCharacterStat(nextMag) ||
            !IsValidCreateCharacterStat(nextChr)) {
            return;
        }

        if (nextStr + nextVit + nextDex + nextInt + nextMag + nextChr != 70) {
            return;
        }

        str = nextStr;
        vit = nextVit;
        dex = nextDex;
        intel = nextInt;
        mag = nextMag;
        chr = nextChr;
        RecalcOlympiaVitals(fillIncreasedPools: true);
    }

    private static bool IsValidCreateCharacterStat(int value) => value is >= 10 and <= 14;

    /// <summary>
    /// Applies absolute STR/VIT/DEX/INT/MAG/CHR after a validated Level Set spend (already capped and LU-budgeted).
    /// Only allows increasing (or equal) stats — never decreases.
    /// </summary>
    public bool TryApplyLevelUpStats(int nextStr, int nextVit, int nextDex, int nextInt, int nextMag, int nextChr) {
        if (nextStr < str || nextVit < vit || nextDex < dex || nextInt < intel || nextMag < mag || nextChr < chr) {
            return false;
        }

        str = nextStr;
        vit = nextVit;
        dex = nextDex;
        intel = nextInt;
        mag = nextMag;
        chr = nextChr;
        Helpers.PlayerDerivedStats.Refresh(this, fillIncreasedPools: true);
        return true;
    }

    /// <summary>
    /// Absolute stat write for respec / Stat Change Ticket (may lower stats). Caller enforces floors/caps/LU budget.
    /// </summary>
    public bool TryApplyStatRespec(int nextStr, int nextVit, int nextDex, int nextInt, int nextMag, int nextChr) {
        if (nextStr < 10 || nextVit < 10 || nextDex < 10 || nextInt < 10 || nextMag < 10 || nextChr < 10) {
            return false;
        }

        str = nextStr;
        vit = nextVit;
        dex = nextDex;
        intel = nextInt;
        mag = nextMag;
        chr = nextChr;
        Helpers.PlayerDerivedStats.Refresh(this, fillIncreasedPools: true);
        return true;
    }

    /// <summary>Stat Change Ticket: all primary stats → 10 so F5 Level Set can re-spend LU.</summary>
    public bool TryApplyFullStatRespecToBase() =>
        TryApplyStatRespec(10, 10, 10, 10, 10, 10);

    /// <summary>
    /// Recomputes max HP/MP/SP from Olympia formulas (base stats only). Prefer
    /// <see cref="RecalcOlympiaVitalsWithAngelic"/> so equipped Angelic pendants apply.
    /// </summary>
    public void RecalcOlympiaVitals(bool fillIncreasedPools) {
        RecalcOlympiaVitalsWithAngelic(fillIncreasedPools);
    }

    /// <summary>
    /// Olympia vitals with angelic STR/INT/MAG from equipped pendants.
    /// HP: Vit*3 + Level*2 + (Str+A)/2 · MP: 2*(Mag+A)+2*Level+(Int+A)/2 · SP: 2*(Str+A)+2*Level.
    /// </summary>
    public void RecalcOlympiaVitalsWithAngelic(bool fillIncreasedPools) {
        Helpers.PlayerDerivedStats.GetAngelicBonuses(this, out var aStr, out _, out var aInt, out var aMag);
        Helpers.PlayerDerivedStats.GetCicEquippedBonuses(this, out var cicHp, out var cicSp, out var cicMp);
        var nextMaxHp = Progression.CalcMaxHp(vit, level, str + aStr) + cicHp;
        var nextMaxMp = Progression.CalcMaxMp(mag + aMag, level, intel + aInt) + cicMp;
        var nextMaxSp = Progression.CalcMaxSp(level, str + aStr) + cicSp;
        // Cash HP tablet: 2× max HP while active.
        if (Helpers.CashShopBoosts.HasHpTablet(this)) {
            nextMaxHp *= 2;
        }
        if (fillIncreasedPools) {
            if (nextMaxHp > maxHp) {
                hp += nextMaxHp - maxHp;
            }
            if (nextMaxMp > maxMp) {
                mp += nextMaxMp - maxMp;
            }
            if (nextMaxSp > maxSp) {
                sp += nextMaxSp - maxSp;
            }
        }

        maxHp = Math.Max(1, nextMaxHp);
        maxMp = Math.Max(1, nextMaxMp);
        maxSp = Math.Max(1, nextMaxSp);
        hp = Math.Clamp(hp, 0, maxHp);
        mp = Math.Clamp(mp, 0, maxMp);
        sp = Math.Clamp(sp, 0, maxSp);
    }

    /// <summary>Arena DC resume: force pools from combat snapshot (does not recalc gear).</summary>
    public void ForceCombatPools(int nextHp, int nextMaxHp, int nextMp, int nextMaxMp, int nextSp, int nextMaxSp) {
        maxHp = Math.Max(1, nextMaxHp);
        maxMp = Math.Max(0, nextMaxMp);
        maxSp = Math.Max(0, nextMaxSp);
        hp = Math.Clamp(nextHp, 0, maxHp);
        mp = Math.Clamp(nextMp, 0, maxMp);
        sp = Math.Clamp(nextSp, 0, maxSp);
    }

    /// <summary>
    /// UI/sync estimate of melee damage (does not drive rolls — <see cref="Helpers.PlayerDerivedStats.RollMeleeDamage"/> uses Item.cfg dice).
    /// </summary>
    public void RecalculateMeleeDamageFromStats() {
        damage = Helpers.PlayerDerivedStats.EstimateMeleeDamage(this);
    }

    public void SetRequestedSpellId(int spellId) {
        requestedSpellId = spellId;
    }

    /// <summary>Records server time of the last accepted spell cast start (for <see cref="IsSpellCastTimingViolation"/>).</summary>
    public void RecordSpellCastStartTimeMs(long unixMs) {
        lastSpellCastStartMs = unixMs;
    }

    /// <summary>
    /// True when <paramref name="nowMs"/> is before <see cref="lastSpellCastStartMs"/> plus cast duration minus lag factor and capped ping variance, or when no start was recorded.
    /// </summary>
    /// <param name="actualElapsedSinceStartMs"><see cref="nowMs"/> minus <see cref="lastSpellCastStartMs"/> when a start was recorded; otherwise null.</param>
    public bool IsSpellCastTimingViolation(long nowMs, out double minIntervalMs, out double? actualElapsedSinceStartMs) {
        minIntervalMs = ComputeMinRequiredTimeMs(CastSpeedMs);
        if (!lastSpellCastStartMs.HasValue) {
            actualElapsedSinceStartMs = null;
            return true;
        }

        actualElapsedSinceStartMs = nowMs - lastSpellCastStartMs.Value;
        return nowMs < lastSpellCastStartMs.Value + minIntervalMs;
    }

    public void ClearRequestedSpell() {
        requestedSpellId = null;
    }

    /// <summary>Clears pending spell selection and cast-start timing when the player takes combat damage that is not <see cref="Server.AttackType.NoInterrupt"/>.</summary>
    public void ClearSpellCastStateOnInterruptingDamage() {
        requestedSpellId = null;
        lastSpellCastStartMs = null;
    }

    public void SetInitialState(int x, int y) {
        SetGridPosition(x, y);
        // GM sandbox default; traveler join paths replace via RecalcOlympiaVitals / ApplyTraveler*.
        hp = 1000;
        maxHp = 1000;
        mp = 500;
        maxMp = 500;
        sp = 500;
        maxSp = 500;
        NoteGameplayActivity(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
    }

    /// <summary>
    /// Soft starter tunables for a brand-new character entering the traveler zone
    /// (replaces the default GM-style HP/damage and multi-weapon seed loadout).
    /// </summary>
    public void ApplyTravelerNewCharacterDefaults() {
        RecalcOlympiaVitals(fillIncreasedPools: false);
        hp = maxHp;
        mp = maxMp;
        sp = maxSp;
        SetAttackDamage(8);
        SetAttackRangeCells(1);
        SetAttackSpeedMs(800);
        SetMovementSpeedMs(260);
        inventoryManager.ApplyTravelerStarterLoadout();
    }

    /// <summary>
    /// Marks the session as traveler and forces soft combat defaults after a persisted load,
    /// so GM sandbox OP combat stats cannot leak into the :8081 experience. HP/MP/SP follow Olympia formulas.
    /// Does <b>not</b> wipe bag/equipment — traveler saves use a separate <c>.traveler.json</c> file;
    /// resetting to starter loadout here was deleting gold and drops every login.
    /// </summary>
    public void ApplyTravelerModeConstraints() {
        travelerMode = true;
        RecalcOlympiaVitals(fillIncreasedPools: false);
        hp = maxHp;
        mp = maxMp;
        sp = maxSp;
        SetAttackDamage(8);
        SetAttackRangeCells(1);
        SetAttackSpeedMs(800);
        SetCastSpeedMs(1200);
        SetAttackStunDurationMs(500);
        SetAllowDashAttack(false);
        // Olympia-feel run (~260 ms/tile); walk = ×2. Overrides stale 220 saves.
        SetMovementSpeedMs(260);
        // Keep persisted bag (gold, potions, gear). Starter kit only for brand-new chars.
        inventoryManager.ConsolidateStackableBagItems();
    }

    /// <summary>
    /// Server spell ids that require Arena kit credit purchases (per-use charges).
    /// Cancellation 45, Inhibition Casting 46, Sleep 52.
    /// </summary>
    public static bool IsArenaCreditGatedSpell(int spellId) =>
        spellId is 45 or 46 or 52;

    public void ClearArenaPerUseSpellCharges() => arenaPerUseSpellCharges.Clear();

    public void AddArenaPerUseSpellCharges(int spellId, int qty) {
        if (spellId < 0 || qty <= 0) {
            return;
        }
        arenaPerUseSpellCharges.TryGetValue(spellId, out var cur);
        arenaPerUseSpellCharges[spellId] = cur + qty;
    }

    public int GetArenaPerUseSpellCharges(int spellId) =>
        arenaPerUseSpellCharges.TryGetValue(spellId, out var n) ? Math.Max(0, n) : 0;

    /// <summary>Consume one credit-use charge after a successful arena cast. False if none left.</summary>
    public bool TryConsumeArenaPerUseSpellCharge(int spellId) {
        if (!arenaPerUseSpellCharges.TryGetValue(spellId, out var n) || n < 1) {
            return false;
        }
        n -= 1;
        if (n <= 0) {
            arenaPerUseSpellCharges.Remove(spellId);
        } else {
            arenaPerUseSpellCharges[spellId] = n;
        }
        return true;
    }

    /// <summary>
    /// Traveler combat spells: Energy Bolt (server catalog id 0) plus Magic Tower unlocks.
    /// While a Timed Challenge Mode 1 run is active, protocol spells (Chill / Paralyze / DS / Poison) are allowed.
    /// Utility spells (Recall, etc.) require Magic Tower learn → server catalog id via OlympiaToServerSpellId.
    /// </summary>
    public bool IsSpellAllowed(int spellId) {
        // Arena: full combat book EXCEPT credit-gated utility (Inhib / Cancel / Sleep) — need kit charges.
        if (InTournamentArena) {
            if (IsArenaCreditGatedSpell(spellId)) {
                return GetArenaPerUseSpellCharges(spellId) > 0;
            }
            return true;
        }

        if (!travelerMode || PlaytestMode.AllowsSandboxSelfEdit(AccountWallet)) {
            return true;
        }

        if (spellId == 0) {
            return true;
        }

        if (timedChallengeRun is not null) {
            // Server catalog: Chill Wind 3, Paralyze 27, Hold 28, DS 32, Great DS 33, Poison 37.
            if (spellId is 3 or 27 or 28 or 32 or 33 or 37) {
                return true;
            }
        }

        // Purchased at Gandalf: Olympia Magic.cfg id → server Spells.json id.
        foreach (var olympiaId in learnedOlympiaSpellIds) {
            if (Helpers.MagicTower.OlympiaToServerSpellId.TryGetValue(olympiaId, out var serverId) &&
                serverId == spellId) {
                return true;
            }
        }

        return false;
    }

    /// <summary>Olympia Magic.cfg ids learned at the Magic Tower.</summary>
    public IReadOnlyCollection<int> GetLearnedOlympiaSpellIds() => learnedOlympiaSpellIds;

    public bool HasLearnedOlympiaSpell(int olympiaSpellId) => learnedOlympiaSpellIds.Contains(olympiaSpellId);

    public void LearnOlympiaSpell(int olympiaSpellId) {
        if (olympiaSpellId >= 0) {
            learnedOlympiaSpellIds.Add(olympiaSpellId);
        }
    }

    /// <summary>Removes a Magic Tower spell from the learned set (no gold refund).</summary>
    public bool UnlearnOlympiaSpell(int olympiaSpellId) {
        return learnedOlympiaSpellIds.Remove(olympiaSpellId);
    }

    /// <summary>Flags traveler mode without rewriting combat (used when reconnecting an in-world traveler session).</summary>
    public void SetTravelerMode(bool enabled) {
        travelerMode = enabled;
    }

    /// <summary>
    /// Re-applies soft HP pools after world transfer without resetting bag/equipment
    /// (CreatePlayer always seeds the GM 1000/1000 HP defaults).
    /// </summary>
    public void RestoreTravelerCombatPools() {
        travelerMode = true;
        RecalcOlympiaVitals(fillIncreasedPools: false);
        hp = maxHp;
        mp = maxMp;
        sp = maxSp;
        SetAttackDamage(8);
        SetAttackRangeCells(1);
        SetAttackSpeedMs(800);
    }

    /// <summary>Applies persisted player-configurable settings after spawn creation while keeping clamp logic centralized in the existing setters.</summary>
    public void ApplyPersistedState(PlayerPersistenceState state) {
        ArgumentNullException.ThrowIfNull(state);
        SetMovementSpeedMs(state.MovementSpeedMs);
        SetCastSpeedMs(state.CastSpeedMs);
        SetAttackSpeedMs(state.AttackSpeedMs);
        SetAttackRangeCells(state.AttackRange);
        SetAttackDamage(state.Damage);
        SetAttackStunDurationMs(state.StunDuration);
        SetAttackMode(state.AttackMode);
        SetSafeAttackMode(state.SafeAttackMode);
        SetRunningMode(state.RunMode);
        SetAttackType(state.AttackType);
        SetAllowDashAttack(state.AllowDashAttack);
        SetAppearance(state.GenderValue, state.SkinColorValue, state.HairStyleIndex, state.UnderwearColorIndex);
        if (state.FacingDirection.HasValue) {
            SetFacingDirection(state.FacingDirection.Value);
        }
        if (state.BagItems is not null || state.EquippedItems is not null) {
            inventoryManager.LoadFromPersistence(state.BagItems, state.EquippedItems);
            inventoryManager.TryUnequipAllGenderMismatchedEquipment(genderValue, out _);
            inventoryManager.TryUnequipAllTypeMismatchedEquipment(out _);
        }
        if (!string.IsNullOrWhiteSpace(state.CharacterName)) {
            SetCharacterName(state.CharacterName);
        }
        exp = Math.Max(0, state.Exp);
        level = Math.Max(1, state.Level);
        rebirth = Math.Max(0, state.Rebirth);
        majesticPoints = Math.Max(0, state.MajesticPoints);
        levelBlocked = state.LevelBlocked;
        rebirthRollback = state.RebirthRollback;
        stakedHell = Math.Max(0, state.StakedHell);
        monsterKills.Clear();
        if (state.MonsterKills is not null) {
            foreach (var row in state.MonsterKills) {
                if (row.Kills > 0) {
                    monsterKills[row.MonsterId] = row.Kills;
                }
            }
        }
        claimedMilestones.Clear();
        if (state.ClaimedMilestones is not null) {
            foreach (var id in state.ClaimedMilestones) {
                if (!string.IsNullOrWhiteSpace(id)) {
                    claimedMilestones.Add(id);
                }
            }
        }
        slotIndex = Math.Clamp(state.SlotIndex, 0, 3);
        hoursPlayed = Math.Max(0, state.HoursPlayed);
        sessionStartedAtUtc = DateTimeOffset.UtcNow;
        str = state.Str > 0 ? state.Str : 10;
        vit = state.Vit > 0 ? state.Vit : 10;
        dex = state.Dex > 0 ? state.Dex : 10;
        intel = state.Int > 0 ? state.Int : 10;
        mag = state.Mag > 0 ? state.Mag : 10;
        chr = state.Chr > 0 ? state.Chr : 10;
        // Missing/0 in old saves → start full (Olympia login default 100).
        hungerStatus = state.HungerStatus > 0
            ? Math.Clamp(state.HungerStatus, 0, Helpers.Hunger.MaxHunger)
            : Helpers.Hunger.MaxHunger;
        lastHungerTickUtc = DateTimeOffset.UtcNow;
        Array.Clear(skillLevels);
        if (state.SkillLevels is not null) {
            for (var i = 0; i < skillLevels.Length && i < state.SkillLevels.Length; i++) {
                skillLevels[i] = Math.Clamp(state.SkillLevels[i], 0, Helpers.Skills.MaxLevel);
            }
        }
        Helpers.PlayerDerivedStats.Refresh(this, fillIncreasedPools: false);
        hp = maxHp;
        mp = maxMp;
        sp = maxSp;
        beginnerEnrolled = false;
        beginnerAbandoned = false;
        beginnerActiveQuestId = null;
        beginnerProgress = 0;
        beginnerCompletedQuestIds.Clear();
        if (state.BeginnerPath is not null) {
            beginnerEnrolled = state.BeginnerPath.Enrolled;
            beginnerAbandoned = state.BeginnerPath.Abandoned;
            beginnerActiveQuestId = string.IsNullOrWhiteSpace(state.BeginnerPath.ActiveQuestId)
                ? null
                : state.BeginnerPath.ActiveQuestId;
            beginnerProgress = Math.Max(0, state.BeginnerPath.Progress);
            if (state.BeginnerPath.CompletedQuestIds is not null) {
                foreach (var id in state.BeginnerPath.CompletedQuestIds) {
                    if (!string.IsNullOrWhiteSpace(id)) {
                        beginnerCompletedQuestIds.Add(id);
                    }
                }
            }
        }
        LoadWarehouseFromPersistence(state.WarehouseItems);
        guildInterestRegistered = state.GuildInterestRegistered;
        citizenshipSide = state.CitizenshipSide ?? string.Empty;
        guildId = state.GuildId ?? string.Empty;
        guildRank = Math.Clamp(state.GuildRank, 0, 3);
        reputation = Math.Max(0, state.Reputation);
        contribution = Math.Max(0, state.Contribution);
        gardenQuestId = state.GardenQuestId ?? "";
        gardenQuestProgress = Math.Max(0, state.GardenQuestProgress);
        learnedOlympiaSpellIds.Clear();
        if (state.LearnedOlympiaSpellIds is not null) {
            foreach (var id in state.LearnedOlympiaSpellIds) {
                if (id >= 0) {
                    learnedOlympiaSpellIds.Add(id);
                }
            }
        }
        enchantMaterials.Clear();
        if (state.EnchantMaterials is not null) {
            foreach (var row in state.EnchantMaterials) {
                if (row.Type > 0 && row.Level > 0 && row.Count > 0) {
                    enchantMaterials[(row.IsShard, row.Type, row.Level)] = row.Count;
                }
            }
        }
    }

    /// <summary>Sets Howard guild-hall interest flag (persisted with the character).</summary>
    public void SetGuildInterestRegistered(bool value) => guildInterestRegistered = value;

    /// <summary>Updates citizenship side used by auction city gates (persisted).</summary>
    public void SetCitizenshipSide(string side) => citizenshipSide = side?.Trim() ?? string.Empty;

    /// <summary>Sets Fase H guild id stub for auction guild filters (persisted).</summary>
    public void SetGuildId(string id) => guildId = id?.Trim() ?? string.Empty;

    /// <summary>Sets guild rank stub (0–3). Captain/master may unbind guild-bound items.</summary>
    public void SetGuildRank(int rank) => guildRank = Math.Clamp(rank, 0, 3);

    /// <summary>Sets reputation stub for auction anti-alt (persisted; not combat-fed yet).</summary>
    public void SetReputation(int value) => reputation = Math.Max(0, value);

    public void AddReputation(int amount) {
        if (amount <= 0) {
            return;
        }
        reputation = reputation > int.MaxValue - amount ? int.MaxValue : reputation + amount;
    }

    /// <summary>Flip male/female presentation for armor sex-change consumables.</summary>
    public void ToggleGenderPresentation() {
        genderValue = genderValue == 0 ? 1 : 0;
        inventoryManager.TryUnequipAllGenderMismatchedEquipment(genderValue, out _);
    }

    public void FillMp() {
        mp = maxMp;
    }

    public void AddContribution(int delta) {
        if (delta == 0) {
            return;
        }
        contribution = Math.Max(0, contribution + delta);
    }

    public void SetGardenQuest(string questId, int progress) {
        gardenQuestId = questId ?? "";
        gardenQuestProgress = Math.Max(0, progress);
    }

    public void SetGardenQuestProgress(int progress) => gardenQuestProgress = Math.Max(0, progress);

    public void ClearGardenQuest() {
        gardenQuestId = "";
        gardenQuestProgress = 0;
    }

    /// <summary>Updates last known remote IP for auction debt enforcement.</summary>
    public void SetLastKnownIp(string? ip) => lastKnownIp = ip?.Trim() ?? string.Empty;

    /// <summary>Replaces live warehouse contents from a persisted snapshot (login / world transfer).</summary>
    public void LoadWarehouseFromPersistence(PersistedInventoryItem[]? persisted) {
        warehouseItems.Clear();
        if (persisted is null || persisted.Length == 0) {
            return;
        }

        foreach (var row in persisted) {
            if (row.Quantity < 1) {
                continue;
            }
            warehouseItems.Add(InventoryItemState.FromPersistedItem(row));
        }
    }

    /// <summary>Serializes warehouse stacks for character save / transfer.</summary>
    public PersistedInventoryItem[]? CreatePersistedWarehouseItems() {
        if (warehouseItems.Count == 0) {
            return null;
        }

        var rows = new PersistedInventoryItem[warehouseItems.Count];
        for (var i = 0; i < warehouseItems.Count; i++) {
            rows[i] = warehouseItems[i].ToPersistedItem();
        }
        return rows;
    }

    /// <summary>Adds one extracted bag stack to warehouse when under the slot cap.</summary>
    public bool TryDepositToWarehouse(InventoryItemState item, int maxSlots) {
        ArgumentNullException.ThrowIfNull(item);
        if (warehouseItems.Count >= maxSlots) {
            return false;
        }

        warehouseItems.Add(item);
        return true;
    }

    /// <summary>Removes one warehouse stack by uid for bag withdraw.</summary>
    public bool TryWithdrawFromWarehouse(long itemUid, out InventoryItemState? item) {
        item = null;
        for (var i = 0; i < warehouseItems.Count; i++) {
            if (warehouseItems[i].ItemUid != itemUid) {
                continue;
            }

            item = warehouseItems[i];
            warehouseItems.RemoveAt(i);
            return true;
        }

        return false;
    }

    /// <summary>Assigns the SELECTCHAR desk slot when creating a new character (no persisted state yet).</summary>
    public void SetSlotIndex(int index) {
        slotIndex = Math.Clamp(index, 0, 3);
    }

    public bool InTournamentArena => tournamentStash is not null;

    /// <summary>When true, movement into Bleeding Island arena safe pad is blocked (live duel).</summary>
    public bool ArenaSafeZoneLocked => arenaSafeZoneLocked;

    public void SetArenaSafeZoneLocked(bool locked) {
        arenaSafeZoneLocked = locked;
    }

    /// <summary>Stores kit JSON to re-apply whenever this session enters a tournament arena world.</summary>
    public void SetArenaKitJson(string? kitJson) {
        arenaKitJson = string.IsNullOrWhiteSpace(kitJson) ? null : kitJson.Trim();
    }

    /// <summary>Arena crit: +charges every intervalSec, cap maxCharges (e.g. 5 / 30s / 15).</summary>
    public void EnableArenaCritRegen(int chargesPerTick, int intervalSec, int maxCharges) {
        arenaCritChargesPerTick = Math.Max(0, chargesPerTick);
        arenaCritIntervalSec = Math.Max(1, intervalSec);
        arenaCritCap = Math.Max(0, maxCharges);
        superAttackLeft = Math.Min(superAttackLeft, MaxSuperAttack);
        if (superAttackLeft < Math.Min(5, MaxSuperAttack)) {
            superAttackLeft = Math.Min(5, MaxSuperAttack);
        }
    }

    /// <summary>Arena Merien SA timing (e.g. 20s active / 5 min CD).</summary>
    public void SetArenaSpecialAbilityTiming(int durationSec, int cooldownSec) {
        arenaSaDurationSec = Math.Max(0, durationSec);
        arenaSaCooldownSec = Math.Max(0, cooldownSec);
        if (arenaSaDurationSec > 0 && specialAbilityType > 0) {
            specialAbilityDurationSec = arenaSaDurationSec;
        }
    }

    /// <summary>Absolute L150 kit stats (no LU budget check — arena only).</summary>
    public void ApplyArenaProfile(int arenaLevel, int nextStr, int nextVit, int nextDex, int nextInt, int nextMag, int nextChr) {
        level = Math.Max(1, arenaLevel);
        exp = 0;
        str = Math.Max(10, nextStr);
        vit = Math.Max(10, nextVit);
        dex = Math.Max(10, nextDex);
        intel = Math.Max(10, nextInt);
        mag = Math.Max(10, nextMag);
        chr = Math.Max(10, nextChr);
        RecalcOlympiaVitalsWithAngelic(fillIncreasedPools: true);
    }

    /// <summary>
    /// Applies the standardized tournament arena state: stashes the real character (restored via <see cref="CreatePersistenceState"/>
    /// on save or transfer out), resets combat tunables to server defaults, sets max level, and swaps in the equal-footing loadout.
    /// When <see cref="arenaKitJson"/> is set and valid, <see cref="Helpers.ArenaLoadout"/> replaces the equal loadout.
    /// </summary>
    public void EnterTournamentArena(
        PlayerPersistenceState? realState,
        IReadOnlyList<int> equippedItemIds,
        IReadOnlyList<TournamentLoadoutBagEntry>? bagEntries,
        int maxLevel,
        IReadOnlyDictionary<int, ItemConfig>? itemsById = null) {
        tournamentStash = realState;
        SetMovementSpeedMs(220);
        SetCastSpeedMs(1200);
        SetAttackSpeedMs(600);
        SetAttackRangeCells(3);
        SetAttackDamage(100);
        SetAttackStunDurationMs(500);
        level = Math.Max(1, maxLevel);
        exp = 0;

        if (itemsById is not null &&
            !string.IsNullOrWhiteSpace(arenaKitJson) &&
            Helpers.ArenaLoadout.TryApply(this, arenaKitJson, itemsById)) {
            // Kit path already grants full book; keep idempotent.
            Helpers.ArenaLoadout.GrantFullArenaSpellBook(this);
            return;
        }

        // Fallback equal-footing Tournament.json loadout (path-aware when kit JSON peeks as mage).
        arenaCritChargesPerTick = 0;
        arenaCritIntervalSec = 0;
        arenaCritCap = 0;
        inventoryManager.ApplyTournamentLoadout(equippedItemIds, bagEntries);
        Helpers.ArenaLoadout.GrantFullArenaSpellBook(this);
    }

    /// <summary>Records the most recent PvP hit for kill attribution on death.</summary>
    public void RegisterPlayerAttacker(long attackerPlayerId, string attackerName) {
        lastPlayerAttackerId = attackerPlayerId;
        lastPlayerAttackerName = attackerName;
        lastPlayerAttackerAtMs = Environment.TickCount64;
    }

    /// <summary>True when a player hit landed within the attribution window; outputs the attacker identity captured at hit time.</summary>
    public bool TryGetRecentPlayerAttacker(out long attackerPlayerId, out string attackerName) {
        attackerPlayerId = lastPlayerAttackerId;
        attackerName = lastPlayerAttackerName;
        return lastPlayerAttackerId != 0 &&
            Environment.TickCount64 - lastPlayerAttackerAtMs <= PlayerAttackerAttributionWindowMs;
    }

    /// <summary>Captures the current world-backed player settings and location for persistence; inside a tournament arena this returns the stashed real character instead.</summary>
    public PlayerPersistenceState CreatePersistenceState(string gameWorldId) {
        ArgumentException.ThrowIfNullOrWhiteSpace(gameWorldId);
        if (tournamentStash is not null) {
            return tournamentStash;
        }
        return new PlayerPersistenceState(
            gameWorldId,
            posX,
            posY,
            movementSpeedMs,
            castSpeedMs,
            attackSpeedMs,
            attackRangeCells,
            damage,
            attackStunDurationMs,
            attackType,
            attackMode,
            runningMode,
            allowDashAttack,
            genderValue,
            skinColorValue,
            hairStyleIndex,
            underwearColorIndex,
            FacingDirection,
            inventoryManager.CreatePersistedBagItems(),
            inventoryManager.CreatePersistedEquippedItems(),
            characterName,
            exp,
            level,
            rebirth,
            CreatePersistedMonsterKills(),
            claimedMilestones.Count == 0 ? null : claimedMilestones.ToArray(),
            slotIndex,
            hoursPlayed + Math.Max(0, (DateTimeOffset.UtcNow - sessionStartedAtUtc).TotalHours),
            str,
            vit,
            dex,
            intel,
            mag,
            chr,
            CreatePersistedBeginnerPath(),
            CreatePersistedWarehouseItems(),
            guildInterestRegistered,
            citizenshipSide,
            guildId,
            guildRank,
            reputation,
            safeAttackMode,
            majesticPoints,
            learnedOlympiaSpellIds.Count == 0 ? null : learnedOlympiaSpellIds.ToArray(),
            levelBlocked,
            hungerStatus,
            SnapshotSkillLevels(),
            stakedHell,
            SnapshotPersistedEnchantMaterials(),
            contribution,
            gardenQuestId,
            gardenQuestProgress,
            rebirthRollback);
    }

    /// <summary>Add Olympia shard/fragment stack (disenchant / craft).</summary>
    public void AddEnchantMaterial(bool isShard, int type, int level, int count) {
        if (type <= 0 || level <= 0 || count <= 0) {
            return;
        }
        var key = (isShard, type, level);
        enchantMaterials.TryGetValue(key, out var cur);
        enchantMaterials[key] = cur + count;
    }

    /// <summary>Spend material; returns false if not enough.</summary>
    public bool TrySpendEnchantMaterial(bool isShard, int type, int level, int count) {
        if (type <= 0 || level <= 0 || count <= 0) {
            return false;
        }
        var key = (isShard, type, level);
        if (!enchantMaterials.TryGetValue(key, out var cur) || cur < count) {
            return false;
        }
        var next = cur - count;
        if (next <= 0) {
            enchantMaterials.Remove(key);
        } else {
            enchantMaterials[key] = next;
        }
        return true;
    }

    public IReadOnlyList<(bool IsShard, int Type, int Level, int Count)> SnapshotEnchantMaterials() {
        if (enchantMaterials.Count == 0) {
            return Array.Empty<(bool, int, int, int)>();
        }
        return enchantMaterials
            .Where(kv => kv.Value > 0)
            .Select(kv => (kv.Key.IsShard, kv.Key.Type, kv.Key.Level, kv.Value))
            .OrderBy(r => r.IsShard ? 0 : 1)
            .ThenBy(r => r.Type)
            .ThenBy(r => r.Level)
            .ToArray();
    }

    private PersistedEnchantMaterial[]? SnapshotPersistedEnchantMaterials() {
        var rows = SnapshotEnchantMaterials();
        if (rows.Count == 0) {
            return null;
        }
        return rows.Select(r => new PersistedEnchantMaterial(r.IsShard, r.Type, r.Level, r.Count)).ToArray();
    }

    /// <summary>Olympia F5 "Talents" line: top combat stats summary.</summary>
    public string BuildTalentsSummary() {
        // Rank primary attributes for display (War/Tank/Mage-ish).
        var pairs = new (string Name, int V)[] {
            ("Str", str), ("Vit", vit), ("Dex", dex), ("Int", intel), ("Mag", mag), ("Chr", chr),
        };
        var top = pairs.OrderByDescending(p => p.V).Take(3).ToArray();
        return string.Join("/", top.Select(p => p.Name));
    }

    private PersistedBeginnerPathState? CreatePersistedBeginnerPath() {
        if (!beginnerEnrolled && !beginnerAbandoned && beginnerCompletedQuestIds.Count == 0 &&
            string.IsNullOrWhiteSpace(beginnerActiveQuestId) && beginnerProgress == 0) {
            return null;
        }

        return new PersistedBeginnerPathState(
            beginnerEnrolled,
            beginnerAbandoned,
            beginnerActiveQuestId,
            beginnerProgress,
            beginnerCompletedQuestIds.Count == 0 ? null : beginnerCompletedQuestIds.ToArray());
    }

    private PersistedMonsterKill[]? CreatePersistedMonsterKills() {
        if (monsterKills.Count == 0) {
            return null;
        }

        var rows = new PersistedMonsterKill[monsterKills.Count];
        var i = 0;
        foreach (var (monsterId, kills) in monsterKills) {
            rows[i++] = new PersistedMonsterKill(monsterId, kills);
        }
        return rows;
    }

    /// <summary>Adds credited exp (already scaled by progression rules) and recomputes level; returns true when at least one level was gained.</summary>
    public bool AddExp(long amount, int newLevel) {
        if (amount <= 0) {
            return false;
        }

        exp = exp > long.MaxValue - amount ? long.MaxValue : exp + amount;
        if (newLevel <= level) {
            return false;
        }

        level = newLevel;
        Helpers.PlayerDerivedStats.Refresh(this, fillIncreasedPools: true);
        return true;
    }

    /// <summary>Increments the lifetime kill counter for one catalog monster id and returns the new count.</summary>
    public long RecordMonsterKill(int catalogMonsterId) {
        monsterKills.TryGetValue(catalogMonsterId, out var current);
        var next = current >= long.MaxValue - 1 ? long.MaxValue : current + 1;
        monsterKills[catalogMonsterId] = next;
        return next;
    }

    /// <summary>Total credited kills across all monster types.</summary>
    public long TotalMonsterKills() {
        long sum = 0;
        foreach (var kills in monsterKills.Values) {
            sum = sum > long.MaxValue - kills ? long.MaxValue : sum + kills;
        }
        return sum;
    }

    public bool HasClaimedMilestone(string milestoneId) => claimedMilestones.Contains(milestoneId);

    public void MarkMilestoneClaimed(string milestoneId) {
        claimedMilestones.Add(milestoneId);
    }

    public void SetBeginnerEnrolled(bool value) => beginnerEnrolled = value;

    public void SetBeginnerAbandoned(bool value) => beginnerAbandoned = value;

    public void SetBeginnerActiveQuest(string questId, int progress) {
        beginnerActiveQuestId = questId;
        beginnerProgress = Math.Max(0, progress);
    }

    public void SetBeginnerProgress(int progress) => beginnerProgress = Math.Max(0, progress);

    public void ClearBeginnerActiveQuest() {
        beginnerActiveQuestId = null;
        beginnerProgress = 0;
    }

    public bool HasCompletedBeginnerQuest(string questId) =>
        !string.IsNullOrWhiteSpace(questId) && beginnerCompletedQuestIds.Contains(questId);

    public void MarkBeginnerQuestCompleted(string questId) {
        if (!string.IsNullOrWhiteSpace(questId)) {
            beginnerCompletedQuestIds.Add(questId);
        }
    }

    /// <summary>
    /// Applies a rebirth: increments rebirth counter and resets to the Chain Lords restart level
    /// (default L79) with the matching cumulative exp floor. Clears Block Level.
    /// Saves a full pre-rebirth snapshot so the player can cancel (return to L max of previous RB).
    /// </summary>
    public void ApplyRebirth(int resetLevel, long resetExp) {
        // Snapshot before mutating — cancel restores this (avance + L150 of previous RB).
        rebirthRollback = new PersistedRebirthRollbackSnapshot(
            Rebirth: rebirth,
            Level: level,
            Exp: exp,
            MajesticPoints: majesticPoints,
            Str: str,
            Vit: vit,
            Dex: dex,
            Int: intel,
            Mag: mag,
            Chr: chr,
            LevelBlocked: levelBlocked);
        rebirth++;
        level = Math.Max(1, resetLevel);
        exp = Math.Max(0, resetExp);
        levelBlocked = false;
        Helpers.PlayerDerivedStats.Refresh(this, fillIncreasedPools: false);
        hp = maxHp;
        mp = maxMp;
        sp = maxSp;
    }

    /// <summary>
    /// Undo last rebirth: always drop <b>exactly one</b> rebirth (RB N → N−1) and land at
    /// <b>max level</b> of that previous RB (product: L150). Never jump to RB0 from a mid-RB snap.
    /// Snapshot (if present and matching) restores stats/maj; otherwise keep current avance.
    /// </summary>
    public bool TryApplyRebirthRollback(int maxLevel, long maxLevelExpFloor, out string error) {
        error = "";
        if (rebirth <= 0) {
            error = "No rebirth to cancel.";
            return false;
        }

        var cap = Math.Max(1, maxLevel);
        // Product rule: cancel always undoes exactly one rebirth (RB5 → RB4, never snap.Rebirth=0).
        // A stale/corrupt snapshot with Rebirth=0 used to wipe high-RB characters to RB0.
        var targetRebirth = Math.Max(0, rebirth - 1);
        var snap = rebirthRollback;
        var snapMatches = snap is { } s && s.Rebirth == targetRebirth;

        rebirth = targetRebirth;
        level = cap;
        exp = Math.Max(0, maxLevelExpFloor);

        if (snapMatches && snap is { } good) {
            // Prefer snapshot exp if it is already at/above L-max floor for that RB.
            exp = Math.Max(Math.Max(0, good.Exp), Math.Max(0, maxLevelExpFloor));
            majesticPoints = Math.Max(0, good.MajesticPoints);
            str = Math.Max(10, good.Str);
            vit = Math.Max(10, good.Vit);
            dex = Math.Max(10, good.Dex);
            intel = Math.Max(10, good.Int);
            mag = Math.Max(10, good.Mag);
            chr = Math.Max(10, good.Chr);
            levelBlocked = good.LevelBlocked;
        } else {
            // No usable snap (legacy / corrupt / multi-RB without matching snap): keep stats & maj.
            levelBlocked = false;
        }

        rebirthRollback = null;

        Helpers.PlayerDerivedStats.Refresh(this, fillIncreasedPools: true);
        hp = maxHp;
        mp = maxMp;
        sp = maxSp;
        return true;
    }

    /// <summary>Toggles Chain Lords Block Level (exp → majestic while frozen).</summary>
    public void SetLevelBlocked(bool blocked) {
        levelBlocked = blocked;
    }

    /// <summary>Clamps cumulative exp (used at max level when converting overflow to majestics).</summary>
    public void ClampExpTo(long value) {
        exp = Math.Max(0, value);
    }

    /// <summary>Force level + exp (rebirth cancel must land at max L of previous RB).</summary>
    public void ForceLevelAndExp(int newLevel, long newExp) {
        level = Math.Max(1, newLevel);
        exp = Math.Max(0, newExp);
    }

    /// <summary>Force rebirth counter (defensive clamp after cancel/rollback).</summary>
    public void ForceRebirth(int newRebirth) {
        rebirth = Math.Max(0, newRebirth);
    }

    /// <summary>Adds Olympia majestic / gizon points (angel + DK upgrades).</summary>
    public void AddMajesticPoints(int amount) {
        if (amount <= 0) {
            return;
        }
        majesticPoints = majesticPoints > int.MaxValue - amount ? int.MaxValue : majesticPoints + amount;
    }

    /// <summary>Spends majestic points; returns false if the balance is insufficient.</summary>
    public bool TrySpendMajesticPoints(int amount) {
        if (amount <= 0) {
            return true;
        }
        if (majesticPoints < amount) {
            return false;
        }
        majesticPoints -= amount;
        return true;
    }

    /// <summary>Sets the display name from authenticate or loaded persistence.</summary>
    public void SetCharacterName(string name) {
        characterName = string.IsNullOrWhiteSpace(name) ? "" : name.Trim();
    }

    public void SetAccountWallet(string wallet) {
        accountWallet = string.IsNullOrWhiteSpace(wallet) ? "" : wallet.Trim();
    }

    /// <summary>Records move/cast/attack/chat activity and clears the AFK warning latch.</summary>
    public void NoteGameplayActivity(long nowMs) {
        lastGameplayActivityMs = nowMs > 0 ? nowMs : DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        afkWarned = false;
    }

    /// <summary>Subtracts damage from <see cref="hp"/> (floors at 0).</summary>
    public void ApplyDamage(int damage) {
        if (damage <= 0 || IsDead) {
            return;
        }

        hp = Math.Max(0, hp - damage);
    }

    /// <summary>Olympia poison DoT: subtracts damage but never kills (floors at 1 HP).</summary>
    public void ApplyPoisonDamage(int damage) {
        if (damage <= 0 || IsDead) {
            return;
        }

        hp = Math.Max(1, hp - damage);
    }

    /// <summary>Olympia HPUP_SPOT heal: adds HP up to <see cref="MaxHp"/>.</summary>
    public void ApplyHeal(int amount) {
        if (amount <= 0 || IsDead) {
            return;
        }

        hp = Math.Min(maxHp, hp + amount);
    }

    /// <summary>Olympia potion MP restore: adds MP up to <see cref="MaxMp"/>.</summary>
    public void ApplyMpRestore(int amount) {
        if (amount <= 0 || IsDead) {
            return;
        }

        mp = Math.Min(maxMp, mp + amount);
    }

    /// <summary>Olympia potion SP restore: adds SP up to <see cref="MaxSp"/>.</summary>
    public void ApplySpRestore(int amount) {
        if (amount <= 0 || IsDead) {
            return;
        }

        sp = Math.Min(maxSp, sp + amount);
    }

    /// <summary>
    /// Passive Super Attack charge regen (Olympia ~every 12 second-ticks → +1, cap Level/10).
    /// Call from the ~1s vital/time tick path.
    /// </summary>
    public bool TickSuperAttackRegen() {
        if (IsDead || Disconnected) {
            return false;
        }
        superAttackTickCount++;
        // Arena kit: +N charges every intervalSec (default 5 / 30s), cap arenaCritCap.
        if (InTournamentArena && arenaCritChargesPerTick > 0 && arenaCritIntervalSec > 0) {
            if (superAttackTickCount < arenaCritIntervalSec) {
                return false;
            }
            superAttackTickCount = 0;
            var max = MaxSuperAttack;
            if (superAttackLeft >= max) {
                return false;
            }
            superAttackLeft = Math.Min(max, superAttackLeft + arenaCritChargesPerTick);
            return true;
        }
        // Classic Olympia: base every 12s → +1 charge, cap Level/10.
        // Charge Critical / CIC gear (total soft-cap 20) speeds regen up to 2× (every 6s at CIC20).
        // Matches product note: CIC20 = fastest SA charge recharge allowed.
        var cic = 0;
        try {
            cic = Math.Clamp(Helpers.ItemMagicAttribute.ComputeEquippedBonuses(this).ChargeCritical, 0, 20);
        } catch {
            cic = 0;
        }
        var intervalSec = Math.Max(6, 12 - (cic * 6) / 20);
        if (superAttackTickCount < intervalSec) {
            return false;
        }
        superAttackTickCount = 0;
        var classicMax = MaxSuperAttack;
        if (superAttackLeft >= classicMax) {
            return false;
        }
        superAttackLeft++;
        return true;
    }

    /// <summary>Charge Critical gear: chance to gain one super-attack charge on damage taken.</summary>
    public bool TryGainChargeCritical(int chargeCriticalPercent) {
        if (chargeCriticalPercent <= 0 || IsDead) {
            return false;
        }
        if (Random.Shared.Next(1, 101) > Math.Clamp(chargeCriticalPercent, 1, 100)) {
            return false;
        }
        if (superAttackLeft >= MaxSuperAttack) {
            return false;
        }
        superAttackLeft++;
        return true;
    }

    /// <summary>
    /// Consume one super-attack charge for a critical melee swing.
    /// Only when <see cref="SuperAttackArmed"/> and charges remain (manual arm — not auto).
    /// Returns true when a charge was spent (caller should apply level% damage bonus).
    /// Disarms when charges hit 0.
    /// </summary>
    public bool TryConsumeSuperAttackCharge() {
        if (!superAttackArmed || superAttackLeft <= 0) {
            return false;
        }
        superAttackLeft--;
        if (superAttackLeft < 0) {
            superAttackLeft = 0;
        }
        if (superAttackLeft == 0) {
            superAttackArmed = false;
        }
        return true;
    }

    /// <summary>On successful melee hit: advance combo 1→2→3→4→1 (Olympia).</summary>
    public void NoteMeleeComboHit() {
        comboAttackCount++;
        if (comboAttackCount < 1) {
            comboAttackCount = 1;
        }
        if (comboAttackCount > 4) {
            comboAttackCount = 1;
        }
    }

    /// <summary>On melee miss: reset combo chain.</summary>
    public void ResetMeleeCombo() {
        comboAttackCount = 0;
    }

    /// <summary>Spend MP for a spell after mana-save reduction. Returns false if insufficient MP.</summary>
    public bool TrySpendMp(int amount) {
        // Cash MP tablet: unlimited mana for duration.
        if (Helpers.CashShopBoosts.HasMpTablet(this)) {
            return true;
        }
        if (amount <= 0) {
            return true;
        }
        if (mp < amount) {
            return false;
        }
        mp -= amount;
        return true;
    }

    /// <summary>Invoked from combat fan-out after HP loss; clears pending timed logout server-side when applicable.</summary>
    public void NotifyCombatDamageMayCancelLogout() {
        interruptLogoutDueToCombat();
    }

    /// <summary>Restores HP to max after resurrection; clears dead state.</summary>
    public void ApplyResurrection() {
        hp = maxHp;
    }

    public void SetPosition(int x, int y) {
        SetGridPosition(x, y);
    }

    /// <summary>Applies server-side standstill: resets the violation limiter so the next window starts clean after <paramref name="until"/>.</summary>
    public void SetServerForcedParalysisUntil(DateTimeOffset until) {
        serverForcedParalysisUntil = until;
        movementSpeedViolations.Dispose();
        movementSpeedViolations = CreateMovementSpeedViolationsLimiter(movementSpeedViolationCheckConfig);
    }

    public bool IsServerForcedParalysisActive() {
        return serverForcedParalysisUntil.HasValue && DateTimeOffset.UtcNow < serverForcedParalysisUntil.Value;
    }

    /// <summary>Non-negative ping variance capped by <see cref="MovementSpeedViolationCheckConfig.MaxPingVariance"/>; used for movement speed and stunlock checks.</summary>
    public double GetCappedPingVariance() {
        return Math.Min(Math.Max(0, PingVariance), movementSpeedViolationCheckConfig.MaxPingVariance);
    }

    /// <summary>Minimum required time (ms) for <paramref name="baseMs"/> after subtracting <see cref="antiHackTimingLagFactor"/> and <see cref="GetCappedPingVariance"/>.</summary>
    private double ComputeMinRequiredTimeMs(int baseMs) {
        return Math.Max(0, baseMs - baseMs * antiHackTimingLagFactor - GetCappedPingVariance());
    }

    /// <summary>
    /// Expected minimum wall-clock gap (ms) between accepted movement steps for the player's current effective speed and lag slack.
    /// Exposed for diagnostics (<see cref="movementSpeedViolationCheckConfig.Verbose"/>).
    /// </summary>
    public double GetMovementCadenceMinRequiredMs() => ComputeMinRequiredTimeMs(MovementSpeedMs);

    /// <summary>
    /// Clears the last-movement timestamp so the next accepted step gets <c>deltaMs == 0</c> and skips cadence comparison.
    /// Required when <see cref="MovementSpeedMs"/> semantics change without a matching client gap (run/walk toggle, base speed change, or temporary movement-speed modifiers).
    /// </summary>
    private void InvalidateMovementCadenceBaselineAfterEffectiveSpeedChange() {
        lastMovementRequestMs = 0;
    }

    protected override void OnTemporaryEffectMovementSpeedModifierSumChanged() {
        InvalidateMovementCadenceBaselineAfterEffectiveSpeedChange();
    }

    /// <summary>True while <paramref name="nowUtc"/> is before pickup lockout ends; clears expired state.</summary>
    public bool IsPickupActionBlocking(DateTimeOffset nowUtc) {
        if (!pickupDurationUntil.HasValue) {
            return false;
        }

        if (nowUtc >= pickupDurationUntil.Value) {
            pickupDurationUntil = null;
            return false;
        }

        return true;
    }

    /// <summary>Starts pickup lockout: <paramref name="animationTimeMs"/> minus lag factor and <see cref="GetCappedPingVariance"/>, floored at zero.</summary>
    public void BeginPickupActionLockout(int animationTimeMs) {
        var durationMs = ComputeMinRequiredTimeMs(animationTimeMs);
        pickupDurationUntil = DateTimeOffset.UtcNow.AddMilliseconds(durationMs);
    }

    /// <summary>Clears pickup lockout when the player takes an interrupting combat hit (<see cref="AttackType"/> other than <see cref="AttackType.NoInterrupt"/>).</summary>
    public void ClearPickupActionLockout() {
        pickupDurationUntil = null;
    }

    /// <summary>True while bow stance lockout is active; clears expired state.</summary>
    public bool IsBowStanceActionBlocking(DateTimeOffset nowUtc) {
        if (!bowStanceDurationUntil.HasValue) {
            return false;
        }

        if (nowUtc >= bowStanceDurationUntil.Value) {
            bowStanceDurationUntil = null;
            return false;
        }

        return true;
    }

    /// <summary>Starts bow stance lockout: <paramref name="animationTimeMs"/> minus lag factor and <see cref="GetCappedPingVariance"/>, floored at zero.</summary>
    public void BeginBowStanceActionLockout(int animationTimeMs) {
        var durationMs = ComputeMinRequiredTimeMs(animationTimeMs);
        bowStanceDurationUntil = DateTimeOffset.UtcNow.AddMilliseconds(durationMs);
    }

    /// <summary>Clears bow stance lockout when the player takes an interrupting combat hit (<see cref="AttackType"/> other than <see cref="AttackType.NoInterrupt"/>).</summary>
    public void ClearBowStanceActionLockout() {
        bowStanceDurationUntil = null;
    }

    /// <summary>True while pickup or bow stance lockout blocks other player actions.</summary>
    public bool IsPickupOrBowStanceLockoutActive(DateTimeOffset nowUtc) {
        return IsPickupActionBlocking(nowUtc) || IsBowStanceActionBlocking(nowUtc);
    }

    /// <summary>Call when this player receives combat damage with an attack mode other than <see cref="Server.AttackType.NoInterrupt"/>.</summary>
    public void RegisterNonNoInterruptDamage() {
        interruptedCount++;
    }

    /// <summary>Starts or refreshes the interrupt stunlock window from a combat hit.</summary>
    public void RegisterCombatInterruptStunlock(int stunDurationMs) {
        if (stunDurationMs <= 0) {
            return;
        }

        stunlockDurationMs = stunDurationMs;
        combatInterruptStunlockUntil = DateTimeOffset.UtcNow.AddMilliseconds(stunDurationMs);
    }

    /// <summary>
    /// True when a movement request arrives before <c>stunlockDurationMs - stunlockDurationMs * antiHackTimingLagFactor - GetCappedPingVariance()</c> has elapsed since stunlock started.
    /// Clears stunlock state once <see cref="combatInterruptStunlockUntil"/> has passed.
    /// When returning <see langword="true"/>, <paramref name="cappedPingVariance"/> and <paramref name="requiredWaitMs"/> are set for logging.
    /// </summary>
    public bool IsMovementStunlockViolation(long nowUnixMs, out double cappedPingVariance, out double requiredWaitMs) {
        cappedPingVariance = 0;
        requiredWaitMs = 0;
        if (!combatInterruptStunlockUntil.HasValue) {
            return false;
        }

        var now = DateTimeOffset.FromUnixTimeMilliseconds(nowUnixMs);
        if (now >= combatInterruptStunlockUntil.Value) {
            combatInterruptStunlockUntil = null;
            stunlockDurationMs = 0;
            return false;
        }

        cappedPingVariance = GetCappedPingVariance();
        requiredWaitMs = ComputeMinRequiredTimeMs(stunlockDurationMs);
        if (requiredWaitMs <= 0) {
            return false;
        }

        var firstAllowedAt = combatInterruptStunlockUntil.Value.AddMilliseconds(-(cappedPingVariance + stunlockDurationMs * antiHackTimingLagFactor));
        return now < firstAllowedAt;
    }

    /// <summary>Milliseconds left until <see cref="combatInterruptStunlockUntil"/>; 0 when none or already elapsed.</summary>
    public int GetRemainingCombatStunlockMs(DateTimeOffset nowUtc) {
        if (!combatInterruptStunlockUntil.HasValue || nowUtc >= combatInterruptStunlockUntil.Value) {
            return 0;
        }

        var ms = (combatInterruptStunlockUntil.Value - nowUtc).TotalMilliseconds;
        return (int)Math.Max(0, Math.Min(int.MaxValue, ms));
    }

    /// <summary>
    /// Returns the ping delta (|delta - pingIntervalMs|) and updates last ping time.
    /// Returns null on the first ping when no previous time exists.
    /// </summary>
    public long? GetPingDeltaAndUpdateLastPingMs(int pingIntervalMs) {
        return playerPingTracker.RecordPingAndGetDelta(pingIntervalMs);
    }

    public long GetAndUpdateLastMovementRequestMs() {
        var currentMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var delta = lastMovementRequestMs == 0 ? 0 : currentMs - lastMovementRequestMs;
        lastMovementRequestMs = currentMs;
        return delta;
    }

    /// <summary>
    /// Returns false when <paramref name="deltaMs"/> is below the allowed minimum cadence too often (sliding window); caller applies paralysis.
    /// Otherwise returns true (accepted cadence, or forgiven within window).
    /// </summary>
    public bool CheckMovementSpeedViolation(long deltaMs) {
        var minRequiredMs = GetMovementCadenceMinRequiredMs();
        if (deltaMs >= minRequiredMs) {
            return true;
        }

        using var lease = movementSpeedViolations.AttemptAcquire(1);
        if (lease.IsAcquired) {
            if (movementSpeedViolationCheckConfig.Verbose) {
                Console.WriteLine(
                    $"[GameWorldPlayer:{PlayerId}] Movement speed violation forgiven (sliding window). " +
                    $"deltaMs={deltaMs} minRequiredMs={minRequiredMs:F1} effectiveMovementMs={MovementSpeedMs} runningMode={runningMode} baseMovementMs={movementSpeedMs}");
            }
            return true;
        }

        if (movementSpeedViolationCheckConfig.Verbose) {
            Console.WriteLine(
                $"[GameWorldPlayer:{PlayerId}] Movement speed violation limit exhausted → paralysis. " +
                $"deltaMs={deltaMs} minRequiredMs={minRequiredMs:F1} effectiveMovementMs={MovementSpeedMs} runningMode={runningMode} baseMovementMs={movementSpeedMs}");
        }

        return false;
    }

    /// <summary>
    /// If enough wall-clock time has passed since the last successful melee damage delivery (vs <see cref="AttackSpeedMs"/> minus lag factor and capped ping variance),
    /// records <paramref name="nowMs"/> as the new delivery time and returns <see langword="true"/>. Otherwise returns <see langword="false"/> without updating state.
    /// </summary>
    public bool TryRecordPlayerAttackDamageDelivery(long nowMs, out double minIntervalMs, out double elapsedSinceLastDeliveryMs) {
        minIntervalMs = ComputeMinRequiredTimeMs(AttackSpeedMs);
        elapsedSinceLastDeliveryMs = 0;
        if (lastPlayerAttackDamageDeliveredMs.HasValue) {
            elapsedSinceLastDeliveryMs = nowMs - lastPlayerAttackDamageDeliveredMs.Value;
            // Small jitter slack: scheduler + ping often lands 1–10ms early and used to skip real hits.
            if (elapsedSinceLastDeliveryMs + AttackCadenceJitterSlackMs(minIntervalMs) < minIntervalMs) {
                return false;
            }
        }

        lastPlayerAttackDamageDeliveredMs = nowMs;
        return true;
    }

    private long? lastPlayerAttackRequestMs;

    /// <summary>
    /// Gate at attack-packet intake (before animation fan-out). Rejects double-clicks that arrive
    /// faster than one full swing — stops dual scheduled damage and dual attack VFX.
    /// </summary>
    public bool TryBeginAttackRequest(long nowMs, out double minIntervalMs, out double elapsedSinceLastRequestMs) {
        // Full swing interval (not /2): one client click must never schedule two hits.
        // Use lag-aware minimum like damage delivery so haste/ping match; add jitter slack so
        // client locks that fire 2–8ms early (Rafita: elapsed 526 vs min 533) are not dropped —
        // those rejects felt like "4 hits then frozen for ~1s".
        minIntervalMs = ComputeMinRequiredTimeMs(AttackSpeedMs);
        elapsedSinceLastRequestMs = 0;
        if (lastPlayerAttackRequestMs.HasValue) {
            elapsedSinceLastRequestMs = nowMs - lastPlayerAttackRequestMs.Value;
            if (elapsedSinceLastRequestMs + AttackCadenceJitterSlackMs(minIntervalMs) < minIntervalMs) {
                return false;
            }
        }

        lastPlayerAttackRequestMs = nowMs;
        return true;
    }

    /// <summary>
    /// Forgiveness for timer/network jitter between client swing lock and server gate.
    /// ~8% of interval, clamped 40–90ms — still rejects true double-speed (~half interval).
    /// </summary>
    private static double AttackCadenceJitterSlackMs(double minIntervalMs) {
        if (minIntervalMs <= 0) {
            return 0;
        }
        return Math.Clamp(minIntervalMs * 0.08, 40.0, 90.0);
    }

    /// <summary>Clears the last recorded player attack damage delivery so the next regular attack does not inherit cadence timing from a dash hit.</summary>
    public void ClearLastPlayerAttackDamageDeliveryTime() {
        lastPlayerAttackDamageDeliveredMs = null;
    }

    public void Send(ServerMessage message) {
        ArgumentNullException.ThrowIfNull(message);
        if (Disconnected || sendMessage is null) {
            return;
        }

        sendMessage(message);
    }

    public bool IsPlayerInRange(long playerId) {
        return playersInRange.Contains(playerId);
    }

    public bool AddPlayerInRange(long playerId) {
        return playersInRange.Add(playerId);
    }

    public bool RemovePlayerInRange(long playerId) {
        return playersInRange.Remove(playerId);
    }

    public void ReplacePlayersInRange(IEnumerable<long> playerIds) {
        ArgumentNullException.ThrowIfNull(playerIds);

        playersInRange.Clear();
        foreach (var playerId in playerIds) {
            playersInRange.Add(playerId);
        }
    }

    public void ClearPlayersInRange() {
        playersInRange.Clear();
    }

    public bool IsMonsterInRange(long monsterId) {
        return monstersInRange.Contains(monsterId);
    }

    public bool AddMonsterInRange(long monsterId) {
        return monstersInRange.Add(monsterId);
    }

    public bool RemoveMonsterInRange(long monsterId) {
        return monstersInRange.Remove(monsterId);
    }

    public void ReplaceMonstersInRange(IEnumerable<long> monsterIds) {
        ArgumentNullException.ThrowIfNull(monsterIds);

        monstersInRange.Clear();
        foreach (var monsterId in monsterIds) {
            monstersInRange.Add(monsterId);
        }
    }

    public void ClearMonstersInRange() {
        monstersInRange.Clear();
    }

    /// <summary>Records a Training Arena dummy spawned for this player (despawned on re-apply or world leave).</summary>
    public void AddTrainingDummyMonsterId(long monsterId) {
        trainingDummyMonsterIds.Add(monsterId);
    }

    /// <summary>Clears the Training Arena dummy id list without despawning (caller removes monsters).</summary>
    public void ClearTrainingDummyMonsterIds() {
        trainingDummyMonsterIds.Clear();
    }

    /// <summary>Records a Timed Challenge runner spawned for this player.</summary>
    public void AddTimedChallengeMonsterId(long monsterId) {
        timedChallengeMonsterIds.Add(monsterId);
    }

    /// <summary>Removes one Timed Challenge runner id after protocol complete or despawn.</summary>
    public void RemoveTimedChallengeMonsterId(long monsterId) {
        timedChallengeMonsterIds.Remove(monsterId);
    }

    /// <summary>Clears Timed Challenge runner ids without despawning (caller removes monsters).</summary>
    public void ClearTimedChallengeMonsterIds() {
        timedChallengeMonsterIds.Clear();
    }

    /// <summary>Attaches an active timed challenge run.</summary>
    public void SetTimedChallengeRun(TimedChallenge.ActiveRun run) {
        timedChallengeRun = run;
    }

    /// <summary>Clears the active timed challenge run and runner id list.</summary>
    public void ClearTimedChallengeRun() {
        timedChallengeRun = null;
        timedChallengeMonsterIds.Clear();
    }

    /// <summary>Sets the session-local party code after create/join.</summary>
    public void SetPartyCode(string code) => partyCode = string.IsNullOrWhiteSpace(code) ? null : code;

    /// <summary>Clears party membership on leave / disconnect.</summary>
    public void ClearPartyCode() => partyCode = null;

    public bool IsNpcInRange(long npcId) {
        return npcsInRange.Contains(npcId);
    }

    public bool AddNpcInRange(long npcId) {
        return npcsInRange.Add(npcId);
    }

    public bool RemoveNpcInRange(long npcId) {
        return npcsInRange.Remove(npcId);
    }

    public void ReplaceNpcsInRange(IEnumerable<long> npcIds) {
        ArgumentNullException.ThrowIfNull(npcIds);

        npcsInRange.Clear();
        foreach (var npcId in npcIds) {
            npcsInRange.Add(npcId);
        }
    }

    public void ClearNpcsInRange() {
        npcsInRange.Clear();
    }

    public bool IsGroundEffectInRange(long groundEffectId) {
        return groundEffectsInRange.Contains(groundEffectId);
    }

    public bool AddGroundEffectInRange(long groundEffectId) {
        return groundEffectsInRange.Add(groundEffectId);
    }

    public bool RemoveGroundEffectInRange(long groundEffectId) {
        return groundEffectsInRange.Remove(groundEffectId);
    }

    public void ReplaceGroundEffectsInRange(IEnumerable<long> groundEffectIds) {
        ArgumentNullException.ThrowIfNull(groundEffectIds);

        groundEffectsInRange.Clear();
        foreach (var groundEffectId in groundEffectIds) {
            groundEffectsInRange.Add(groundEffectId);
        }
    }

    public void ClearGroundEffectsInRange() {
        groundEffectsInRange.Clear();
    }

    public bool IsGroundItemInRange(long groundItemUid) {
        return groundItemsInRange.Contains(groundItemUid);
    }

    public bool AddGroundItemInRange(long groundItemUid) {
        return groundItemsInRange.Add(groundItemUid);
    }

    public bool RemoveGroundItemInRange(long groundItemUid) {
        return groundItemsInRange.Remove(groundItemUid);
    }

    public void ReplaceGroundItemsInRange(IEnumerable<long> groundItemUids) {
        ArgumentNullException.ThrowIfNull(groundItemUids);

        groundItemsInRange.Clear();
        foreach (var groundItemUid in groundItemUids) {
            groundItemsInRange.Add(groundItemUid);
        }
    }

    public void ClearGroundItemsInRange() {
        groundItemsInRange.Clear();
    }

    protected override int GetEffectiveMovementSpeedMsForBroadcast() => MovementSpeedMs;

    protected override int GetEffectiveAttackSpeedMsForBroadcast() => AttackSpeedMs;

    protected override int? GetEffectiveCastSpeedMsForBroadcast() => CastSpeedMs;

    /// <summary>Fills <see cref="PlayerEnteredRange.ActiveTemporaryEffects"/> for visibility snapshots.</summary>
    public void FillActiveTemporaryEffects(PlayerEnteredRange snapshot) {
        ArgumentNullException.ThrowIfNull(snapshot);
        CopyActiveTemporaryEffectTypesTo(snapshot.ActiveTemporaryEffects);
    }

    public void RequestDisconnect(string? message = null) {
        if (Disconnected || requestDisconnect is null) {
            return;
        }

        requestDisconnect(message);
    }

    public void RequestWorldChange(WorldTransferDestination destination) {
        if (Disconnected) {
            return;
        }

        requestWorldChange(destination);
    }

    /// <summary>Clears per-connection timing/ping state after reconnect or detach.</summary>
    private void ResetConnectionState() {
        lastMovementRequestMs = 0;
        lastPlayerAttackDamageDeliveredMs = null;
        playerPingTracker.Reset();
        combatInterruptStunlockUntil = null;
        stunlockDurationMs = 0;
        interruptedCount = 0;
        pickupDurationUntil = null;
        bowStanceDurationUntil = null;
        lastSpellCastStartMs = null;
    }
}
