using System.Text.Json;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Phase-1 prize bag + DC combat snapshot for ArenaPact.
/// Custody is off-chain ledger first; on-chain transfers land later.
/// Source of truth for settle: game server only.
/// </summary>
public static class ArenaPrizeEscrow {
    public const string BagDrafting = "drafting";
    public const string BagLocked = "locked";
    public const string BagEditing = "editing";
    public const string BagLiveFrozen = "live_frozen";
    public const string BagDcGrace = "dc_grace";
    public const string BagSettled = "settled";
    public const string BagRefunded = "refunded";

    public const int DefaultDcGraceMinutes = 120;

    static readonly object ConfigGate = new();
    static ArenaPrizeConfig? cachedConfig;
    static DateTime configLoadedUtc = DateTime.MinValue;

    // —— DTOs ——

    public sealed class PrizeAssetPolicy {
        public string AssetId { get; set; } = "";
        public string Kind { get; set; } = "spl";
        public string Chain { get; set; } = "solana";
        public string MintOrProgramId { get; set; } = "";
        public string OriginLabel { get; set; } = "";
        public int Decimals { get; set; }
        public long MinPledge { get; set; } = 1;
        public long MaxPledge { get; set; } = long.MaxValue;
        public bool Enabled { get; set; } = true;
    }

    public sealed class HouseSponsorConfig {
        public bool Enabled { get; set; }
        public string AssetId { get; set; } = "HELL";
        public long AmountPerDuel { get; set; }
        public long MaxTotalBudget { get; set; }
    }

    public sealed class ArenaPrizeConfig {
        public List<PrizeAssetPolicy> Assets { get; set; } = new();
        public HouseSponsorConfig HouseSponsor { get; set; } = new();
        public int DcGraceMinutes { get; set; } = DefaultDcGraceMinutes;
        public int MaxBagEdits { get; set; } = 5;
    }

    public sealed class PrizePledgeLine {
        public string AssetId { get; set; } = "";
        public long Amount { get; set; }
        /// <summary>Wallet or character that pledged (captain).</summary>
        public string CaptainName { get; set; } = "";
        public string Wallet { get; set; } = "";
        public int Team { get; set; }
        /// <summary>Optional on-chain asset instance id (cNFT asset id / mint).</summary>
        public string? InstanceId { get; set; }
    }

    /// <summary>Per-match prize bag (two captain sides + optional house).</summary>
    public sealed class PrizeBag {
        public string State { get; set; } = BagDrafting;
        public List<PrizePledgeLine> Pledges { get; } = new();
        public List<PrizePledgeLine> HousePledges { get; } = new();
        /// <summary>Captain character names that still need re-OK after edit.</summary>
        public HashSet<string> PendingConfirmNames { get; } = new(StringComparer.OrdinalIgnoreCase);
        public int EditCount { get; set; }
        public string? WinnerCaptainName { get; set; }
        public string? SettleReason { get; set; }
        public long SettledAtMs { get; set; }
    }

    public sealed class BuffSnapshot {
        public int EffectType { get; set; }
        public int Group { get; set; }
        public int RemainingMs { get; set; }
        public double MovementSpeedModifier { get; set; }
        public double AttackSpeedModifier { get; set; }
        public double CastSpeedModifier { get; set; }
        public int PoisonLevel { get; set; }
    }

    public sealed class GearDurabilitySnapshot {
        public string Slot { get; set; } = "";
        public long ItemUid { get; set; }
        public int ItemId { get; set; }
        public int CurLifeSpan { get; set; }
        public int MaxLifeSpan { get; set; }
    }

    public sealed class PotSnapshot {
        public long ItemUid { get; set; }
        public int ItemId { get; set; }
        public int Quantity { get; set; }
    }

    /// <summary>Combat context for DC resume — includes buffs good and bad.</summary>
    public sealed class FighterCombatSnapshot {
        public string CharacterName { get; set; } = "";
        public int Team { get; set; }
        public int Hp { get; set; }
        public int MaxHp { get; set; }
        public int Mp { get; set; }
        public int MaxMp { get; set; }
        public int Sp { get; set; }
        public int MaxSp { get; set; }
        public int WorldX { get; set; }
        public int WorldY { get; set; }
        public int Facing { get; set; }
        public long CapturedAtMs { get; set; }
        public List<BuffSnapshot> Buffs { get; set; } = new();
        public List<GearDurabilitySnapshot> Gear { get; set; } = new();
        public List<PotSnapshot> Pots { get; set; } = new();
    }

    public sealed class MatchCombatContext {
        /// <summary>Snapshots keyed by character name (lower).</summary>
        public Dictionary<string, FighterCombatSnapshot> ByName { get; } =
            new(StringComparer.OrdinalIgnoreCase);
        public string? DcCharacterName { get; set; }
        public int DcTeam { get; set; } = -1;
        public long DcGraceEndsAtMs { get; set; }
        public long DcStartedAtMs { get; set; }
        /// <summary>Append-only second samples while live/dc_grace (compressed after settle).</summary>
        public List<string> TickLog { get; } = new();
        public bool Compressed { get; set; }
    }

    // —— Config ——

    public static ArenaPrizeConfig GetConfig() {
        lock (ConfigGate) {
            if (cachedConfig is not null && (DateTime.UtcNow - configLoadedUtc).TotalSeconds < 30) {
                return cachedConfig;
            }
            cachedConfig = LoadConfigUnlocked();
            configLoadedUtc = DateTime.UtcNow;
            return cachedConfig;
        }
    }

    static ArenaPrizeConfig LoadConfigUnlocked() {
        try {
            var path = Path.Combine(AppContext.BaseDirectory, "Config", "ArenaPrizeWhitelist.json");
            if (!File.Exists(path)) {
                path = Path.Combine(Directory.GetCurrentDirectory(), "Config", "ArenaPrizeWhitelist.json");
            }
            if (File.Exists(path)) {
                var json = File.ReadAllText(path);
                var cfg = JsonSerializer.Deserialize<ArenaPrizeConfig>(json, new JsonSerializerOptions {
                    PropertyNameCaseInsensitive = true,
                });
                if (cfg is not null) {
                    return cfg;
                }
            }
        } catch (Exception ex) {
            Console.Error.WriteLine($"[ArenaPrizeEscrow] Config load failed: {ex.Message}");
        }
        return new ArenaPrizeConfig {
            Assets = new List<PrizeAssetPolicy> {
                new() { AssetId = "HELL", Kind = "spl", OriginLabel = "HELL", Enabled = true, MinPledge = 1, MaxPledge = 100_000_000 },
                new() { AssetId = "USDC", Kind = "spl", OriginLabel = "USDC", Enabled = true, Decimals = 6 },
                new() { AssetId = "USDT", Kind = "spl", OriginLabel = "USDT", Enabled = true, Decimals = 6 },
                new() { AssetId = "SOL", Kind = "native_sol", OriginLabel = "SOL", Enabled = true, Decimals = 9 },
            },
            DcGraceMinutes = DefaultDcGraceMinutes,
            MaxBagEdits = 5,
        };
    }

    public static bool IsAssetAllowed(string assetId, out PrizeAssetPolicy? policy, out string error) {
        policy = null;
        error = "";
        if (string.IsNullOrWhiteSpace(assetId)) {
            error = "Asset id required.";
            return false;
        }
        var cfg = GetConfig();
        policy = cfg.Assets.FirstOrDefault(a =>
            a.Enabled && string.Equals(a.AssetId, assetId.Trim(), StringComparison.OrdinalIgnoreCase));
        if (policy is null) {
            error = $"Asset '{assetId}' is not on the arena prize whitelist.";
            return false;
        }
        // Hard block BTC/ETH even if someone adds them to JSON by mistake.
        if (policy.AssetId.Contains("BTC", StringComparison.OrdinalIgnoreCase) ||
            policy.AssetId.Contains("ETH", StringComparison.OrdinalIgnoreCase) ||
            policy.OriginLabel.Contains("BTC", StringComparison.OrdinalIgnoreCase) ||
            policy.OriginLabel.Contains("ETH", StringComparison.OrdinalIgnoreCase)) {
            error = "BTC/ETH are not allowed in arena prize bags.";
            policy = null;
            return false;
        }
        return true;
    }

    // —— Bag FSM ——

    public static PrizeBag CreateEmptyBag() => new();

    public static bool TryPledge(
            PrizeBag bag,
            string captainName,
            string wallet,
            int team,
            string assetId,
            long amount,
            string? instanceId,
            out string error) {
        error = "";
        if (bag.State is not (BagDrafting or BagEditing)) {
            error = $"Cannot pledge while bag is '{bag.State}'.";
            return false;
        }
        if (!IsAssetAllowed(assetId, out var policy, out error) || policy is null) {
            return false;
        }
        if (amount < policy.MinPledge || amount > policy.MaxPledge) {
            error = $"Amount out of range for {policy.OriginLabel} ({policy.MinPledge}–{policy.MaxPledge}).";
            return false;
        }

        // Replace same captain+asset line.
        bag.Pledges.RemoveAll(p =>
            p.Team == team &&
            string.Equals(p.CaptainName, captainName, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(p.AssetId, assetId, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(p.InstanceId ?? "", instanceId ?? "", StringComparison.Ordinal));

        bag.Pledges.Add(new PrizePledgeLine {
            AssetId = policy.AssetId,
            Amount = amount,
            CaptainName = captainName,
            Wallet = wallet ?? "",
            Team = team,
            InstanceId = instanceId,
        });
        return true;
    }

    public static bool TryClearCaptainPledges(PrizeBag bag, string captainName, out string error) {
        error = "";
        if (bag.State is not (BagDrafting or BagEditing)) {
            error = $"Cannot clear pledges while bag is '{bag.State}'.";
            return false;
        }
        bag.Pledges.RemoveAll(p =>
            string.Equals(p.CaptainName, captainName, StringComparison.OrdinalIgnoreCase));
        return true;
    }

    /// <summary>Both captains accepted / re-OK → lock bag (inject house sponsor if enabled).</summary>
    public static bool TryLockBag(PrizeBag bag, out string error) {
        error = "";
        if (bag.State is not (BagDrafting or BagEditing)) {
            error = $"Cannot lock bag in state '{bag.State}'.";
            return false;
        }

        // Honor path: empty bag is allowed (no stake).
        ApplyHouseSponsorIfNeeded(bag);
        bag.PendingConfirmNames.Clear();
        bag.State = BagLocked;
        return true;
    }

    static void ApplyHouseSponsorIfNeeded(PrizeBag bag) {
        var cfg = GetConfig();
        var hs = cfg.HouseSponsor;
        if (hs is null || !hs.Enabled || hs.AmountPerDuel <= 0) {
            return;
        }
        if (!IsAssetAllowed(hs.AssetId, out var policy, out _) || policy is null) {
            return;
        }
        bag.HousePledges.Clear();
        bag.HousePledges.Add(new PrizePledgeLine {
            AssetId = policy.AssetId,
            Amount = hs.AmountPerDuel,
            CaptainName = "HOUSE",
            Wallet = "",
            Team = -1,
        });
    }

    public static bool TryBeginEdit(PrizeBag bag, string captainName, out string error) {
        error = "";
        if (bag.State is not (BagLocked or BagDrafting or BagEditing)) {
            error = $"Cannot edit bag in state '{bag.State}'.";
            return false;
        }
        if (bag.State == BagLiveFrozen || bag.State == BagDcGrace || bag.State == BagSettled) {
            error = "Prize bag is frozen during the duel.";
            return false;
        }
        var cfg = GetConfig();
        if (bag.EditCount >= Math.Max(1, cfg.MaxBagEdits)) {
            error = $"Max bag edits ({cfg.MaxBagEdits}) reached.";
            return false;
        }
        bag.EditCount++;
        bag.State = BagEditing;
        bag.PendingConfirmNames.Clear();
        // Caller should re-add both captains to PendingConfirmNames.
        return true;
    }

    public static void RequireReconfirmFrom(PrizeBag bag, IEnumerable<string> captainNames) {
        bag.PendingConfirmNames.Clear();
        foreach (var n in captainNames) {
            if (!string.IsNullOrWhiteSpace(n)) {
                bag.PendingConfirmNames.Add(n.Trim());
            }
        }
    }

    public static bool TryCaptainConfirm(PrizeBag bag, string captainName, out string error) {
        error = "";
        if (bag.State != BagEditing && bag.State != BagDrafting) {
            error = "No bag confirmation pending.";
            return false;
        }
        bag.PendingConfirmNames.Remove(captainName);
        if (bag.PendingConfirmNames.Count == 0) {
            return TryLockBag(bag, out error);
        }
        return true;
    }

    public static void FreezeForLive(PrizeBag bag) {
        if (bag.State is BagLocked or BagDrafting) {
            if (bag.State == BagDrafting) {
                ApplyHouseSponsorIfNeeded(bag);
            }
            bag.State = BagLiveFrozen;
        } else if (bag.State == BagLocked) {
            bag.State = BagLiveFrozen;
        }
    }

    public static void MarkDcGrace(PrizeBag bag) {
        if (bag.State is BagLiveFrozen or BagLocked) {
            bag.State = BagDcGrace;
        }
    }

    public static void ResumeFromDc(PrizeBag bag) {
        if (bag.State == BagDcGrace) {
            bag.State = BagLiveFrozen;
        }
    }

    public static bool TrySettle(
            PrizeBag bag,
            string winnerCaptainName,
            string reason,
            out string error) {
        error = "";
        if (bag.State is BagSettled or BagRefunded) {
            error = "Bag already closed.";
            return false;
        }
        bag.WinnerCaptainName = winnerCaptainName;
        bag.SettleReason = reason;
        bag.SettledAtMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        bag.State = BagSettled;
        // Phase 1: ledger only — on-chain transfer later.
        Console.WriteLine(
            $"[ArenaPrizeEscrow] SETTLED winner={winnerCaptainName} reason={reason} pledges={bag.Pledges.Count} house={bag.HousePledges.Count}");
        return true;
    }

    public static bool TryRefund(PrizeBag bag, string reason, out string error) {
        error = "";
        if (bag.State is BagSettled or BagRefunded) {
            error = "Bag already closed.";
            return false;
        }
        bag.SettleReason = reason;
        bag.SettledAtMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        bag.State = BagRefunded;
        Console.WriteLine($"[ArenaPrizeEscrow] REFUNDED reason={reason}");
        return true;
    }

    // —— Combat snapshot / DC ——

    public static FighterCombatSnapshot CaptureFighter(GameWorldPlayer player, int team) {
        ArgumentNullException.ThrowIfNull(player);
        var snap = new FighterCombatSnapshot {
            CharacterName = player.CharacterName,
            Team = team,
            Hp = player.Hp,
            MaxHp = player.MaxHp,
            Mp = player.Mp,
            MaxMp = player.MaxMp,
            Sp = player.Sp,
            MaxSp = player.MaxSp,
            WorldX = player.PosX,
            WorldY = player.PosY,
            Facing = player.FacingDirection,
            CapturedAtMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        };

        foreach (var buff in player.SnapshotActiveTemporaryEffectsForArena()) {
            snap.Buffs.Add(buff);
        }

        foreach (var (slot, item) in player.InventoryManager.EquippedItems) {
            if (item.MaxLifeSpan > 1 || item.CurLifeSpan > 0) {
                snap.Gear.Add(new GearDurabilitySnapshot {
                    Slot = slot,
                    ItemUid = item.ItemUid,
                    ItemId = item.ItemId,
                    CurLifeSpan = item.CurLifeSpan,
                    MaxLifeSpan = item.MaxLifeSpan,
                });
            }
        }

        // Potions / consumables in bag (stack qty).
        foreach (var item in player.InventoryManager.BagItems) {
            if (player.InventoryManager.TryGetItemConfig(item.ItemId, out var def) &&
                def is not null &&
                (def.Consumable == true || string.Equals(def.ItemType, "misc", StringComparison.OrdinalIgnoreCase))) {
                // Prefer HP/MP potions by name heuristic + consumable flag.
                var name = def.Name ?? "";
                if (def.Consumable == true ||
                    name.Contains("Potion", StringComparison.OrdinalIgnoreCase) ||
                    name.Contains("Pill", StringComparison.OrdinalIgnoreCase)) {
                    snap.Pots.Add(new PotSnapshot {
                        ItemUid = item.ItemUid,
                        ItemId = item.ItemId,
                        Quantity = Math.Max(1, item.Quantity),
                    });
                }
            }
        }

        return snap;
    }

    public static void ApplyFighterSnapshot(GameWorldRef wr, GameWorldPlayer player, FighterCombatSnapshot snap) {
        ArgumentNullException.ThrowIfNull(wr);
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(snap);

        player.ForceCombatPools(
            Math.Clamp(snap.Hp, 1, Math.Max(1, snap.MaxHp)),
            Math.Max(1, snap.MaxHp),
            Math.Clamp(snap.Mp, 0, Math.Max(0, snap.MaxMp)),
            Math.Max(0, snap.MaxMp),
            Math.Clamp(snap.Sp, 0, Math.Max(0, snap.MaxSp)),
            Math.Max(0, snap.MaxSp));

        // Restore buffs (good and bad) with remaining time from DC snapshot.
        player.ClearAllTemporaryEffects(wr);
        foreach (var b in snap.Buffs) {
            if (b.RemainingMs <= 0) {
                continue;
            }
            var type = (TemporaryEffectType)b.EffectType;
            player.ApplyTemporaryEffect(
                wr,
                type,
                b.Group,
                b.RemainingMs,
                b.MovementSpeedModifier,
                b.AttackSpeedModifier,
                b.CastSpeedModifier,
                b.PoisonLevel);
        }

        // Gear durability
        foreach (var g in snap.Gear) {
            if (player.InventoryManager.EquippedItems.TryGetValue(g.Slot, out var eq) &&
                eq.ItemUid == g.ItemUid) {
                eq.CurLifeSpan = Math.Clamp(g.CurLifeSpan, 0, Math.Max(g.MaxLifeSpan, g.CurLifeSpan));
                eq.MaxLifeSpan = Math.Max(eq.MaxLifeSpan, g.MaxLifeSpan);
            }
        }

        // Note: pot counts are not re-materialized if already consumed mid-fight offline —
        // authoritative bag is still the inventory at disconnect; snapshot is the audit trail.
        Console.WriteLine(
            $"[ArenaPrizeEscrow] Restored combat snapshot for {player.CharacterName}: HP {snap.Hp}/{snap.MaxHp}, buffs={snap.Buffs.Count}");
    }

    public static void AppendTickSample(MatchCombatContext ctx, IEnumerable<GameWorldPlayer?> fighters, long nowMs) {
        if (ctx.Compressed) {
            return;
        }
        // Cap memory: ~2 hours at 1 Hz = 7200 lines; keep last 15 min dense if huge.
        if (ctx.TickLog.Count > 20_000) {
            ctx.TickLog.RemoveRange(0, 5_000);
        }
        foreach (var p in fighters) {
            if (p is null || p.Disconnected) {
                continue;
            }
            ctx.TickLog.Add($"{nowMs}|{p.CharacterName}|{p.Hp}|{p.Mp}|{p.Sp}|{p.PosX}|{p.PosY}");
        }
    }

    public static string CompressTickLog(MatchCombatContext ctx) {
        ctx.Compressed = true;
        var n = ctx.TickLog.Count;
        ctx.TickLog.Clear();
        return $"ticks={n};dc={ctx.DcCharacterName};graceEnds={ctx.DcGraceEndsAtMs}";
    }

    public static string SummarizeBag(PrizeBag bag) {
        var parts = bag.Pledges.Select(p => $"{p.CaptainName}:{p.AssetId}x{p.Amount}");
        var house = bag.HousePledges.Select(p => $"HOUSE:{p.AssetId}x{p.Amount}");
        return string.Join(", ", parts.Concat(house));
    }
}
