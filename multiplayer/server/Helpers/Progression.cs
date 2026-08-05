using System.Linq;
using Mmorpg.Network;
using Server.Persistence;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Olympia-style character progression: cumulative exp curve (Client.cpp iGetLevelExp), rebirth pacing,
/// per-monster lifetime kill counters, and guaranteed-reward milestones from <c>Progression.json</c>.
/// Initialized once at startup; the exp table is immutable afterwards.
/// </summary>
public static class Progression {
    /// <summary>Cumulative exp required to reach each level (index = level); index 0 and 1 are 0.</summary>
    private static long[] expTable = [];
    private static ProgressionConfig? config;
    private static Dictionary<string, KillMilestoneConfig> milestonesById = new(StringComparer.Ordinal);

    public static ProgressionConfig? Config => config;

    public static void Initialize(ProgressionConfig progressionConfig) {
        ArgumentNullException.ThrowIfNull(progressionConfig);
        if (progressionConfig.MaxLevel < 1 || progressionConfig.MaxRebirth < 0) {
            throw new InvalidOperationException("Progression.json maxLevel must be >= 1 and maxRebirth >= 0.");
        }

        config = progressionConfig;
        // +1 beyond max: Olympia majestic unit = table[maxLevel+1] - table[maxLevel] (bCheckLevelUp / AddGizon).
        expTable = BuildExpTable(progressionConfig.MaxLevel + 1);
        milestonesById = new Dictionary<string, KillMilestoneConfig>(StringComparer.Ordinal);
        foreach (var milestone in progressionConfig.Milestones) {
            if (string.IsNullOrWhiteSpace(milestone.Id) || milestone.RewardItemIds.Length == 0 || milestone.Required < 1) {
                throw new InvalidOperationException($"Progression.json milestone '{milestone.Id}' is invalid.");
            }
            if (milestone.Kind == 0 && milestone.MonsterId is null) {
                throw new InvalidOperationException($"Progression.json kill milestone '{milestone.Id}' requires monsterId.");
            }
            if (!milestonesById.TryAdd(milestone.Id, milestone)) {
                throw new InvalidOperationException($"Duplicate milestone id '{milestone.Id}' in Progression.json.");
            }
        }
    }

    /// <summary>Olympia Client.cpp: f(L) = f(L-1) + L * (50 + L * (L/17)^2) with integer division.</summary>
    private static long[] BuildExpTable(int maxLevel) {
        var table = new long[maxLevel + 1];
        for (var level = 1; level <= maxLevel; level++) {
            var seventeenth = level / 17;
            table[level] = table[level - 1] + level * (50L + (long)level * seventeenth * seventeenth);
        }
        return table;
    }

    /// <summary>Cumulative exp required to reach <paramref name="level"/> at a given rebirth (each rebirth scales the curve).</summary>
    public static long GetExpForLevel(int level, int rebirth) {
        if (config is null || level <= 1) {
            return 0;
        }

        // Allow maxLevel+1 for Olympia majestic unit (table[max+1] − table[max]).
        var maxIndex = expTable.Length > 0 ? expTable.Length - 1 : config.MaxLevel;
        var clamped = Math.Min(level, maxIndex);
        var multiplier = 1.0 + config.RebirthExpMultiplierStep * Math.Max(0, rebirth);
        return (long)(expTable[clamped] * multiplier);
    }

    /// <summary>
    /// Exp required for 1 majestic / gizon at full max level (Olympia <c>bCheckLevelUp</c> at cap:
    /// <c>next = table[max+1]</c>, reset to <c>table[max]</c>). Used for both max-level and Block Level.
    /// </summary>
    public static long GetOlympiaMajesticExpUnit(int rebirth = 0) {
        if (config is null) {
            return 1;
        }
        return Math.Max(
            1L,
            GetExpForLevel(config.MaxLevel + 1, rebirth) - GetExpForLevel(config.MaxLevel, rebirth));
    }

    /// <summary>
    /// Olympia wiki rebirth cost to go from current rebirth → next:
    /// majestics = next × 5, gold = min(next × 200_000, 1_000_000).
    /// </summary>
    public static void GetOlympiaRebirthCost(int currentRebirth, out int goldCost, out int majesticCost) {
        var next = Math.Max(1, currentRebirth + 1);
        majesticCost = next * 5;
        goldCost = Math.Min(next * 200_000, 1_000_000);
    }

    /// <summary>Level reached with <paramref name="exp"/> at the given rebirth, capped at max level.</summary>
    public static int GetLevelForExp(long exp, int rebirth) {
        if (config is null) {
            return 1;
        }

        var level = 1;
        while (level < config.MaxLevel && exp >= GetExpForLevel(level + 1, rebirth)) {
            level++;
        }
        return level;
    }

    /// <summary>
    /// Olympia Client.cpp NotifyMsg_LevelUp: unspent attribute points =
    /// <c>level*3 - ((str+vit+dex+int+mag+chr) - 70) - 3</c> plus rebirth LU bonus
    /// (6 pts × rebirth ≈ +2 effective levels each → 10 RB ≈ L170 at max L150).
    /// </summary>
    public static int GetLuPoints(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        var sumStats = player.Str + player.Vit + player.Dex + player.Int + player.Mag + player.Chr;
        var rebirthLu = config is null ? 0 : Math.Max(0, config.RebirthLuPoints) * Math.Max(0, player.Rebirth);
        return Math.Max(0, player.Level * 3 - (sumStats - 70) - 3 + rebirthLu);
    }

    /// <summary>Olympia <c>iGetMaxHP</c>: <c>Vit*3 + Level*2 + (Str+AngelicStr)/2</c>.</summary>
    public static int CalcMaxHp(int vit, int level, int strIncludingAngelic) =>
        vit * 3 + level * 2 + strIncludingAngelic / 2;

    /// <summary>Olympia <c>iGetMaxMP</c>: <c>2*(Mag+AngelicMag) + 2*Level + (Int+AngelicInt)/2</c>.</summary>
    public static int CalcMaxMp(int magIncludingAngelic, int level, int intIncludingAngelic) =>
        2 * magIncludingAngelic + 2 * level + intIncludingAngelic / 2;

    /// <summary>Olympia <c>iGetMaxSP</c>: <c>2*(Str+AngelicStr) + 2*Level</c>.</summary>
    public static int CalcMaxSp(int level, int strIncludingAngelic) =>
        2 * strIncludingAngelic + 2 * level;

    /// <summary>Classic Helbreath / Olympia per-stat soft cap for Level Set allocation.</summary>
    public const int MaxStat = 200;

    /// <summary>Credits a monster kill to <paramref name="killer"/>: Olympia Npc.cfg exp + GetExp level boost, then level/majestic sync.</summary>
    public static void HandleMonsterKilled(GameWorldRef wr, GameWorldPlayer killer, GameWorldMonster monster) {
        ArgumentNullException.ThrowIfNull(killer);
        ArgumentNullException.ThrowIfNull(monster);
        if (config is null) {
            return;
        }

        var expAward = CalculateOlympiaKillExp(wr, killer, monster);
        // Olympia: m_iAddExp is the SUM of all gear Exp% (secondary type 11 value*10).
        // iExp += iExp * m_iAddExp / 100  → additive gear % on base kill exp.
        var gearPct = PlayerDerivedStats.GetGearExpBonusPercent(killer);
        if (gearPct > 0) {
            expAward += (long)Math.Max(0, Math.Round(expAward * (gearPct / 100.0)));
        }
        // Timed challenge + Exp Tablet multiply after gear (buffs stack with clothing Exp).
        var mult = TimedChallenge.GetExpMultiplier(killer) * CashShopBoosts.GetExpMultiplier(killer);
        if (mult > 1.0) {
            expAward = (long)Math.Max(1, Math.Round(expAward * mult));
        }

        // Chain Lords Block Level OR Olympia max-level: excess exp → majestic (same exp unit as full max).
        var leveledUp = false;
        if (killer.LevelBlocked || killer.Level >= config.MaxLevel) {
            ApplyMajesticFromExp(killer, expAward);
            SendProgressionUpdated(killer, leveledUp: false);
        } else {
            var newLevel = GetLevelForExp(
                killer.Exp > long.MaxValue - expAward ? long.MaxValue : killer.Exp + expAward,
                killer.Rebirth);
            leveledUp = killer.AddExp(expAward, newLevel);
            // Crossing max level mid-award: clamp and convert remainder to majestics.
            if (leveledUp && killer.Level >= config.MaxLevel) {
                var capExp = GetExpForLevel(config.MaxLevel, killer.Rebirth);
                if (killer.Exp > capExp) {
                    var overflow = killer.Exp - capExp;
                    killer.ClampExpTo(capExp);
                    ApplyMajesticFromExp(killer, overflow);
                }
            }
            SendProgressionUpdated(killer, leveledUp);
        }

        var kills = killer.RecordMonsterKill(monster.CatalogMonsterId);
        var monsterName = wr.MonstersById.TryGetValue(monster.CatalogMonsterId, out var monsterConfig)
            ? monsterConfig.Name
            : monster.Name;
        var specialty = MobSpecialty.Compute(killer, monster.CatalogMonsterId);
        NetworkManager.SendToPlayer(killer, NetworkManager.CreateMonsterKillsUpdated(
            monster.CatalogMonsterId,
            monsterName,
            kills,
            killer.TotalMonsterKills(),
            specialty.SpecialtyLevel,
            specialty.EffectiveLevel,
            specialty.NextKills,
            specialty.StakeBonusLevels,
            specialty.BonusSummary));

        BeginnerPath.OnMonsterKilled(killer, monster.CatalogMonsterId);
        GardenQuests.OnMonsterKilled(killer, monster.CatalogMonsterId);
        HellMining.OnMonsterKilled(killer, monster.CatalogMonsterId, monster.MaxHp);
        Referral.OnProgression(wr, killer, leveledUp);
    }

    /// <summary>
    /// Olympia MSGID_STATECHANGEPOINT ("talents" respec): spend 1 majestic to remove 3 allocated stat points
    /// (stats A/B/C each −1, floor 10). Free points become spendable via Level Set.
    /// </summary>
    public static void HandleMajesticStatRespecRequest(GameWorldRef wr, GameWorldPlayer player, MajesticStatRespecRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        if (player.MajesticPoints < 1) {
            SendMajesticStatRespec(player, false, "Need 1 majestic point.");
            return;
        }

        var drops = new[] { request.StatA, request.StatB, request.StatC };
        var delta = new int[6]; // Str Vit Dex Int Mag Chr
        foreach (var s in drops) {
            if (s < 0 || s > 5) {
                SendMajesticStatRespec(player, false, "Invalid stat id (0–5).");
                return;
            }
            delta[s]++;
        }
        if (delta.Sum() != 3) {
            SendMajesticStatRespec(player, false, "Select exactly 3 stat points to free.");
            return;
        }

        var nextStr = player.Str - delta[0];
        var nextVit = player.Vit - delta[1];
        var nextDex = player.Dex - delta[2];
        var nextInt = player.Int - delta[3];
        var nextMag = player.Mag - delta[4];
        var nextChr = player.Chr - delta[5];
        if (nextStr < 10 || nextVit < 10 || nextDex < 10 || nextInt < 10 || nextMag < 10 || nextChr < 10) {
            SendMajesticStatRespec(player, false, "Cannot reduce a stat below 10.");
            return;
        }
        if (nextStr > MaxStat || nextVit > MaxStat || nextDex > MaxStat ||
            nextInt > MaxStat || nextMag > MaxStat || nextChr > MaxStat) {
            SendMajesticStatRespec(player, false, $"Stat cannot exceed {MaxStat}.");
            return;
        }

        if (!player.TrySpendMajesticPoints(1)) {
            SendMajesticStatRespec(player, false, "Need 1 majestic point.");
            return;
        }
        // Must allow lowering stats (Level Set API only allows increases).
        if (!player.TryApplyStatRespec(nextStr, nextVit, nextDex, nextInt, nextMag, nextChr)) {
            player.AddMajesticPoints(1);
            SendMajesticStatRespec(player, false, "Could not apply respec.");
            return;
        }

        // Majestic respec can lower Str — strip weapons/armor the player can no longer wear.
        Inventory.UnequipItemsInvalidForStats(wr, player);

        SendProgressionUpdated(player, leveledUp: false);
        SendMajesticStatRespec(player, true, null);
        Console.WriteLine(
            $"[Progression] {player.CharacterName} majestic respec −{delta[0]}/{delta[1]}/{delta[2]}/{delta[3]}/{delta[4]}/{delta[5]} maj={player.MajesticPoints}.");
    }

    static void SendMajesticStatRespec(GameWorldPlayer player, bool success, string? error) {
        NetworkManager.SendToPlayer(player, new ServerMessage {
            MajesticStatRespecResult = new MajesticStatRespecResult {
                Success = success,
                Message = error ?? "",
                Str = player.Str,
                Vit = player.Vit,
                Dex = player.Dex,
                Intel = player.Int,
                Mag = player.Mag,
                Chr = player.Chr,
                MajesticPoints = player.MajesticPoints,
                LuPoints = GetLuPoints(player),
                TalentsSummary = player.BuildTalentsSummary(),
            },
        });
    }

    /// <summary>Applies F5 Level Set deltas when they fit the current LU pool and per-stat cap.</summary>
    public static void HandleLevelUpSettingsRequest(GameWorldRef wr, GameWorldPlayer player, LevelUpSettingsRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        if (request.Str < 0 || request.Vit < 0 || request.Dex < 0 ||
            request.Intel < 0 || request.Mag < 0 || request.Chr < 0) {
            SendLevelUpSettingsApplied(player, success: false, "Invalid allocation (negative delta).");
            return;
        }

        var spent = request.Str + request.Vit + request.Dex + request.Intel + request.Mag + request.Chr;
        if (spent == 0) {
            SendLevelUpSettingsApplied(player, success: true, error: null);
            return;
        }

        var available = GetLuPoints(player);
        if (spent > available) {
            SendLevelUpSettingsApplied(player, success: false, "Not enough level-up points.");
            return;
        }

        var nextStr = player.Str + request.Str;
        var nextVit = player.Vit + request.Vit;
        var nextDex = player.Dex + request.Dex;
        var nextInt = player.Int + request.Intel;
        var nextMag = player.Mag + request.Mag;
        var nextChr = player.Chr + request.Chr;
        if (nextStr > MaxStat || nextVit > MaxStat || nextDex > MaxStat ||
            nextInt > MaxStat || nextMag > MaxStat || nextChr > MaxStat) {
            SendLevelUpSettingsApplied(player, success: false, $"Stat cannot exceed {MaxStat}.");
            return;
        }

        if (!player.TryApplyLevelUpStats(nextStr, nextVit, nextDex, nextInt, nextMag, nextChr)) {
            SendLevelUpSettingsApplied(player, success: false, "Could not apply level-up stats.");
            return;
        }

        // If Str/level no longer meet gear floors (respec path also uses this), strip illegal equipment.
        Inventory.UnequipItemsInvalidForStats(wr, player);

        // TryApplyLevelUpStats already refreshes angelic vitals + melee.
        SendLevelUpSettingsApplied(player, success: true, error: null);
        Console.WriteLine(
            $"[Progression] {player.CharacterName} Level Set +{request.Str}/{request.Vit}/{request.Dex}/{request.Intel}/{request.Mag}/{request.Chr} (LU left {GetLuPoints(player)}).");
    }

    /// <summary>Full snapshot for the joining player: exp/level/rebirth plus kill counters and milestone progress.</summary>
    public static void SendProgressionState(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        if (config is null) {
            return;
        }

        NetworkManager.SendToPlayer(player, NetworkManager.CreateProgressionState(wr, player, config, milestonesById.Values));
    }

    /// <summary>Validates and grants a one-time milestone reward chosen by the player; records super-rare rewards in the NFT drop ledger.</summary>
    public static void HandleClaimKillMilestoneRequest(GameWorldRef wr, GameWorldPlayer player, ClaimKillMilestoneRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        if (!milestonesById.TryGetValue(request.MilestoneId, out var milestone)) {
            SendClaimResult(player, request.MilestoneId, false, null, "Unknown milestone.");
            return;
        }
        if (player.HasClaimedMilestone(milestone.Id)) {
            SendClaimResult(player, milestone.Id, false, null, "Milestone already claimed.");
            return;
        }
        if (GetMilestoneProgress(player, milestone) < milestone.Required) {
            SendClaimResult(player, milestone.Id, false, null, "Milestone not completed yet.");
            return;
        }
        if (Array.IndexOf(milestone.RewardItemIds, request.ChosenItemId) < 0) {
            SendClaimResult(player, milestone.Id, false, null, "Item is not part of this milestone's rewards.");
            return;
        }
        if (!player.InventoryManager.TryCreateItem(request.ChosenItemId, effectOverrides: null, out var mutation)) {
            SendClaimResult(player, milestone.Id, false, null, "Could not create the reward item.");
            return;
        }

        player.MarkMilestoneClaimed(milestone.Id);
        Inventory.ApplyInventoryMutation(wr, player, mutation);
        SendClaimResult(player, milestone.Id, true, request.ChosenItemId, null);

        foreach (var added in mutation.AddedToBag) {
            if (added.ItemId == request.ChosenItemId) {
                NftDropLedger.TryRecordPickup(wr, player, added);
                break;
            }
        }
        Console.WriteLine($"[Progression] {player.CharacterName} claimed milestone '{milestone.Id}' → item {request.ChosenItemId}.");
    }

    /// <summary>
    /// Rebirth: max level + Olympia gold/majestic cost (wiki table), then Chain Lords restart at L79.
    /// </summary>
    public static void HandleRebirthRequest(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(wr);
        if (config is null) {
            return;
        }

        void Deny(string msg) {
            Console.WriteLine($"[Progression] {player.CharacterName} rebirth denied: {msg}");
            NetworkManager.SendToPlayer(
                player,
                NetworkManager.CreateChatMessageReceived(
                    "System",
                    DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    msg,
                    channel: ChatChannel.Global));
        }

        if (player.LevelBlocked) {
            Deny("Turn off Block Level before rebirthing.");
            return;
        }
        if (player.Level < config.MaxLevel) {
            Deny($"Rebirth requires level {config.MaxLevel}.");
            return;
        }
        if (player.Rebirth >= config.MaxRebirth) {
            Deny("Already at max rebirth.");
            return;
        }

        GetOlympiaRebirthCost(player.Rebirth, out var goldCost, out var majesticCost);
        if (player.MajesticPoints < majesticCost) {
            Deny($"Need {majesticCost} majestic points for rebirth (have {player.MajesticPoints}).");
            return;
        }
        if (goldCost > 0) {
            if (!player.InventoryManager.TrySpendGold(goldCost, out var spendResult)) {
                Deny($"Need {goldCost:N0} gold for rebirth.");
                return;
            }
            Inventory.ApplyInventoryMutation(wr, player, spendResult);
        }
        if (!player.TrySpendMajesticPoints(majesticCost)) {
            // Refund gold if majestics failed after gold spend (should not happen after check).
            if (goldCost > 0 && player.InventoryManager.TryCreateItemStack(90, goldCost, out var refund)) {
                Inventory.ApplyInventoryMutation(wr, player, refund);
            }
            Deny($"Need {majesticCost} majestic points for rebirth.");
            return;
        }

        var resetLevel = config.RebirthResetLevel > 0 ? config.RebirthResetLevel : 79;
        resetLevel = Math.Clamp(resetLevel, 1, config.MaxLevel);
        var nextRebirth = player.Rebirth + 1;
        var resetExp = GetExpForLevel(resetLevel, nextRebirth);
        player.ApplyRebirth(resetLevel, resetExp);
        SendProgressionUpdated(player, leveledUp: false);
        var luPer = config.RebirthLuPoints > 0 ? config.RebirthLuPoints : 6;
        Console.WriteLine(
            $"[Progression] {player.CharacterName} rebirthed to RB{player.Rebirth} at L{player.Level} (paid {goldCost}g + {majesticCost} maj, +{luPer} LU). Rollback snapshot saved (hasSnap={player.HasRebirthRollback}).");
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateChatMessageReceived(
                "System",
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                $"Rebirth {player.Rebirth} complete → L{player.Level}. Paid {goldCost:N0} gold and {majesticCost} majestics. F5 Cancel Rebirth → L{config.MaxLevel} of previous RB.",
                channel: ChatChannel.Global));
    }

    /// <summary>
    /// Cancel last rebirth: restore pre-rebirth snapshot (L max of previous RB + stats/maj).
    /// Without snapshot (legacy chars): RB−1, level = max, keep current stats/majestics.
    /// </summary>
    public static void HandleRebirthRollbackRequest(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(wr);
        if (config is null) {
            return;
        }

        void Deny(string msg) {
            Console.WriteLine($"[Progression] {player.CharacterName} rebirth-rollback denied: {msg}");
            NetworkManager.SendToPlayer(
                player,
                NetworkManager.CreateChatMessageReceived(
                    "System",
                    DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    msg,
                    channel: ChatChannel.Global));
        }

        if (player.Rebirth <= 0) {
            Deny("No rebirth to cancel.");
            return;
        }

        var maxL = config.MaxLevel;
        var beforeRb = player.Rebirth;
        // Floor exp for L-max at the RB we will restore to (current RB − 1). Always drop exactly 1.
        var restoreRb = Math.Max(0, beforeRb - 1);
        var floor = GetExpForLevel(maxL, restoreRb);
        if (!player.TryApplyRebirthRollback(maxL, floor, out var err)) {
            Deny(err);
            return;
        }

        // Defensive: guarantee L-max + exp floor for restored rebirth (never L1/L79 after cancel).
        var minExp = GetExpForLevel(maxL, restoreRb);
        // Never leave a mismatched RB (e.g. corrupt snap used to set RB0).
        if (player.Rebirth != restoreRb) {
            Console.WriteLine(
                $"[Progression] WARN {player.CharacterName} rollback RB mismatch (got {player.Rebirth}, expected {restoreRb}) — forcing {restoreRb}.");
            player.ForceRebirth(restoreRb);
        }
        player.ForceLevelAndExp(maxL, Math.Max(player.Exp, minExp));
        PlayerDerivedStats.Refresh(player, fillIncreasedPools: true);

        SendProgressionUpdated(player, leveledUp: false);
        Console.WriteLine(
            $"[Progression] {player.CharacterName} cancelled rebirth RB{beforeRb}→RB{player.Rebirth} L{player.Level} exp={player.Exp} maj={player.MajesticPoints} (snapMatch path).");
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateChatMessageReceived(
                "System",
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                $"Rebirth cancelled → RB{player.Rebirth} · L{player.Level} (max). Was RB{beforeRb}.",
                channel: ChatChannel.Global));
    }

    /// <summary>Toggles Block Level: while ON, kill exp converts to majestic points (Olympia full-level unit) instead of levels.</summary>
    public static void HandleSetLevelBlockRequest(GameWorldRef wr, GameWorldPlayer player, SetLevelBlockRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);
        _ = wr;
        if (config is null) {
            return;
        }

        var wasBlocked = player.LevelBlocked;
        player.SetLevelBlocked(request.Blocked);

        if (request.Blocked && !wasBlocked) {
            // Start majestic bank at current level floor (Olympia unit remainder tracked above floor).
            var floor = GetExpForLevel(player.Level, player.Rebirth);
            if (player.Exp < floor) {
                player.ClampExpTo(floor);
            } else {
                // Drop any level-bar remainder so bank starts clean with full-level majestic unit.
                player.ClampExpTo(floor);
            }
        } else if (!request.Blocked && wasBlocked) {
            // Flush partial majestic bank into majestics (floor division), reset exp to level floor.
            // Remainder below one full majestic unit is discarded so unblocking cannot multi-level.
            var floor = GetExpForLevel(player.Level, player.Rebirth);
            var unit = GetOlympiaMajesticExpUnit(player.Rebirth);
            var bank = Math.Max(0L, player.Exp - floor);
            var gained = (int)Math.Min(int.MaxValue, bank / unit);
            if (gained > 0) {
                player.AddMajesticPoints(gained);
            }
            player.ClampExpTo(floor);
        }

        SendProgressionUpdated(player, leveledUp: false);
        Console.WriteLine(
            $"[Progression] {player.CharacterName} level block {(request.Blocked ? "ON" : "OFF")} at L{player.Level} (maj {player.MajesticPoints}).");
    }

    /// <summary>
    /// Olympia full-kill exp: Npc.cfg dice → total <c>m_iExp</c>, then <c>GetExp</c> level≤80 boost.
    /// Death awards full pool (exp/3 + NoDieRemainExp = m_iExp when no partial drains).
    /// </summary>
    public static long CalculateOlympiaKillExp(GameWorldRef wr, GameWorldPlayer killer, GameWorldMonster monster) {
        ArgumentNullException.ThrowIfNull(killer);
        ArgumentNullException.ThrowIfNull(monster);
        Server.Utils.NpcExpCatalog.EnsureLoaded();

        var monsterName = wr.MonstersById.TryGetValue(monster.CatalogMonsterId, out var mc)
            ? mc.Name
            : monster.Name;

        long baseExp;
        if (Server.Utils.NpcExpCatalog.TryGetByCatalogName(monsterName, out var row)) {
            // Capped ExpDice×HD (+ live overrides e.g. Orc), then MonsterExpFactor.
            baseExp = Server.Utils.NpcExpCatalog.RollBaseExp(monsterName, row);
        } else {
            // Fallback when Npc.cfg has no row.
            baseExp = Math.Max(1, monster.MaxHp / 4);
        }

        // Live Olympia scale (Progression.json). L33: Slime/Ant/Orc/Scorpion/Cyclops≈17k → factor 65.
        if (config is not null && config.MonsterExpFactor > 0 && Math.Abs(config.MonsterExpFactor - 1.0) > 0.0001) {
            baseExp = Math.Max(1, (long)Math.Round(baseExp * config.MonsterExpFactor));
        }

        // Olympia SA exp (Anti-Magic/Anti-Physical Abs% etc.) before GetExp.
        baseExp = Server.Utils.MonsterSpecialAbility.ApplyExpBonus(baseExp, monster.SpecialExpBonusPercent);

        // Gear secondary Exp fragment: m_iAddExp % (value*10 per fragment).
        var gearExpPct = PlayerDerivedStats.GetGearExpBonusPercent(killer);
        if (gearExpPct > 0) {
            baseExp += (long)(baseExp * (gearExpPct / 100.0));
        }

        // 1) GetExp early-level boost (≤80)
        var afterLevelBoost = ApplyOlympiaGetExpLevelBoost(killer.Level, baseExp);
        // 2) Rebirth obtain rate 0.8^RB (wiki); 100% from level 140 up
        var afterRebirth = ApplyOlympiaRebirthObtainRate(killer.Level, killer.Rebirth, afterLevelBoost);
        return afterRebirth;
    }

    /// <summary>
    /// Olympia <c>CGame::GetExp</c> early-level bonus: if level ≤ 80,
    /// <c>exp *= 1.025 + (80 - level) * 0.025</c> (L1 → ×3, L40 → ×2.025, L80 → ×1.025).
    /// </summary>
    public static long ApplyOlympiaGetExpLevelBoost(int playerLevel, long rawExp) {
        if (rawExp <= 0) {
            return 0;
        }
        if (playerLevel > 80) {
            return rawExp;
        }
        var level = Math.Max(1, playerLevel);
        var dV2 = (80 - level) * 0.025;
        var mult = dV2 + 1.025;
        return Math.Max(1, (long)(rawExp * mult));
    }

    /// <summary>
    /// Olympia wiki rebirth table: obtained exp *= <c>rate^rebirth</c> (default 0.8),
    /// but 100% once level ≥ 140 (majestic / endgame farming).
    /// </summary>
    public static long ApplyOlympiaRebirthObtainRate(int playerLevel, int rebirth, long expAfterLevelBoost) {
        if (expAfterLevelBoost <= 0) {
            return 0;
        }
        if (config is null || rebirth <= 0) {
            return expAfterLevelBoost;
        }
        var fullFrom = config.FullExpObtainFromLevel > 0 ? config.FullExpObtainFromLevel : 140;
        if (playerLevel >= fullFrom) {
            return expAfterLevelBoost;
        }
        var rate = config.RebirthExpObtainRate > 0 ? config.RebirthExpObtainRate : 0.8;
        var mult = Math.Pow(rate, rebirth);
        return Math.Max(1, (long)Math.Round(expAfterLevelBoost * mult));
    }

    /// <summary>
    /// Olympia <c>AddGizon</c> / max-level AND Chain Lords Block Level:
    /// 1 majestic costs the same exp as a full-level "virtual level" past max
    /// (<c>table[maxLevel+1] − table[maxLevel]</c>).
    /// </summary>
    public static void ApplyMajesticFromExp(GameWorldPlayer player, long expAward) {
        ArgumentNullException.ThrowIfNull(player);
        if (config is null || expAward <= 0) {
            return;
        }

        var unit = GetOlympiaMajesticExpUnit(player.Rebirth);
        // Anchor bank: at true max level use cap exp; while Block Level use frozen level floor.
        // Remainder (exp − floor) is progress toward the next majestic with the Olympia full-level unit.
        var floorExp = player.LevelBlocked && player.Level < config.MaxLevel
            ? GetExpForLevel(player.Level, player.Rebirth)
            : GetExpForLevel(config.MaxLevel, player.Rebirth);

        if (player.Exp < floorExp) {
            player.ClampExpTo(floorExp);
        }

        var pool = Math.Max(0L, player.Exp - floorExp) + expAward;
        var gained = (int)Math.Min(int.MaxValue, pool / unit);
        if (gained > 0) {
            var before = player.MajesticPoints;
            player.AddMajesticPoints(gained);
            Console.WriteLine(
                $"[Progression] {player.CharacterName} +{gained} majestic (unit {unit}, total {player.MajesticPoints})" +
                (player.LevelBlocked ? " [block-level]" : " [max-level]") + ".");
            // First majestics ever: point to Gail angel claim (Olympia Tutelary Angel flow).
            if (before == 0 && player.MajesticPoints > 0) {
                NetworkManager.SendToPlayer(
                    player,
                    NetworkManager.CreateChatMessageReceived(
                        "System",
                        DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                        "Majestics unlocked! Talk to Gail for a Tutelary Angel (5 maj each: STR/DEX/INT/MAG), then upgrade the pendant with majestics in your bag.",
                        channel: ChatChannel.Global));
            }
        }
        player.ClampExpTo(floorExp + (pool % unit));
    }

    /// <summary>Builds and sends <see cref="ProgressionUpdated"/> with current LU points and Olympia vitals.</summary>
    public static void SendProgressionUpdated(GameWorldPlayer player, bool leveledUp) {
        ArgumentNullException.ThrowIfNull(player);
        NetworkManager.SendToPlayer(player, NetworkManager.CreateProgressionUpdated(
            player.Exp,
            player.Level,
            player.Rebirth,
            GetExpForLevel(player.Level + 1, player.Rebirth),
            GetExpForLevel(player.Level, player.Rebirth),
            leveledUp,
            GetLuPoints(player),
            player.Hp,
            player.MaxHp,
            player.Mp,
            player.MaxMp,
            player.Sp,
            player.MaxSp,
            player.MajesticPoints,
            player.LevelBlocked,
            player.HungerStatus,
            player.SuperAttackLeft,
            player.MaxSuperAttack,
            player.SuperAttackArmed));
    }

    /// <summary>Arm/disarm Super Attack (crit). Charges only spend while armed.</summary>
    public static void HandleSetSuperAttackArmed(GameWorldPlayer player, bool armed) {
        ArgumentNullException.ThrowIfNull(player);
        if (armed && player.SuperAttackLeft <= 0) {
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                "No Super Attack charges. Crits regenerate over time (max Level/10)."));
            player.SetSuperAttackArmed(false);
            SendProgressionUpdated(player, leveledUp: false);
            return;
        }
        player.SetSuperAttackArmed(armed);
        SendProgressionUpdated(player, leveledUp: false);
        NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
            armed
                ? $"Super Attack ARMED ({player.SuperAttackLeft}/{player.MaxSuperAttack}) — next melee hits crit."
                : "Super Attack disarmed."));
    }

    private static void SendLevelUpSettingsApplied(GameWorldPlayer player, bool success, string? error) {
        NetworkManager.SendToPlayer(player, NetworkManager.CreateLevelUpSettingsApplied(
            success,
            error,
            player.Level,
            player.Str,
            player.Vit,
            player.Dex,
            player.Int,
            player.Mag,
            player.Chr,
            GetLuPoints(player),
            player.Hp,
            player.MaxHp,
            player.Mp,
            player.MaxMp,
            player.Sp,
            player.MaxSp));
    }

    public static long GetMilestoneProgress(GameWorldPlayer player, KillMilestoneConfig milestone) {
        if (milestone.Kind == 1) {
            return player.Rebirth;
        }

        return milestone.MonsterId is int monsterId && player.MonsterKills.TryGetValue(monsterId, out var kills)
            ? kills
            : 0;
    }

    private static void SendClaimResult(GameWorldPlayer player, string milestoneId, bool success, int? grantedItemId, string? error) {
        NetworkManager.SendToPlayer(player, NetworkManager.CreateKillMilestoneClaimResult(milestoneId, success, grantedItemId, error));
    }
}
