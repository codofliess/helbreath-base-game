using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Allowlisted agent skill-pack shop. Packs are licenses to grind the existing F8 / Olympia
/// masteries (<see cref="Skills"/>) — not a second XP track. Purchase is <c>buy_nft</c> with
/// pending $HELL (<see cref="HellMiningStore"/>, cash-shop currency 2). Staking $HELBREATH
/// is Olympia monster-group expertise (<see cref="MobSpecialty"/>), not a shop rail.
/// </summary>
public static class AgentSkillShop {
    public const string TokenTicker = "$HELL";
    public const string RailBuyNft = "buy_nft";
    public const string RailStake = "stake";
    public const string RailGrant = "grant";
    public const string TierBasic = "basic";
    public const string TierAdvanced = "advanced";

    static readonly object LoadGate = new();
    static readonly HashSet<string> AllowedTags = new(StringComparer.Ordinal) {
        "gather", "craft", "combat", "academy",
    };
    static readonly JsonSerializerOptions JsonOptions = new() {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    static List<AgentSkillShopCatalogEntry> catalog = [];
    static Dictionary<string, AgentSkillShopCatalogEntry> byId = new(StringComparer.Ordinal);
    static string loadedTicker = TokenTicker;
    static bool loaded;

    /// <summary>Loads Config/AgentSkillShop.json or the Skills.cs fallback catalog.</summary>
    public static void EnsureLoaded() {
        if (loaded) {
            return;
        }
        lock (LoadGate) {
            if (loaded) {
                return;
            }
            catalog = BuildFallbackCatalog();
            byId = IndexById(catalog);
            loadedTicker = TokenTicker;

            var path = Path.Combine(AppContext.BaseDirectory, "Config", "AgentSkillShop.json");
            if (!File.Exists(path)) {
                path = Path.Combine(Directory.GetCurrentDirectory(), "Config", "AgentSkillShop.json");
            }
            if (File.Exists(path)) {
                try {
                    var file = JsonSerializer.Deserialize<AgentSkillShopFile>(File.ReadAllText(path), JsonOptions);
                    if (file?.Entries is { Count: > 0 }) {
                        var parsed = new List<AgentSkillShopCatalogEntry>(file.Entries.Count);
                        foreach (var raw in file.Entries) {
                            if (TrySanitizeEntry(raw, out var entry)) {
                                parsed.Add(entry);
                            }
                        }
                        if (parsed.Count > 0) {
                            catalog = parsed;
                            byId = IndexById(catalog);
                        }
                    }
                    if (!string.IsNullOrWhiteSpace(file?.TokenTicker)) {
                        loadedTicker = file.TokenTicker.Trim();
                    }
                    Console.WriteLine($"[AgentSkillShop] Loaded {catalog.Count} pack(s) from {path}; ticker={loadedTicker}.");
                } catch (Exception ex) {
                    Console.WriteLine($"[AgentSkillShop] Failed to parse {path} ({ex.Message}); using fallback catalog ({catalog.Count}).");
                }
            } else {
                Console.WriteLine($"[AgentSkillShop] Config/AgentSkillShop.json missing — fallback catalog ({catalog.Count}) from Skills.cs.");
            }
            loaded = true;
        }
    }

    public static string GetTokenTicker() {
        EnsureLoaded();
        return loadedTicker;
    }

    public static IReadOnlyList<AgentSkillShopCatalogEntry> GetCatalog() {
        EnsureLoaded();
        return catalog;
    }

    /// <summary>True when <paramref name="skillId"/> is an allowlisted pack or alias.</summary>
    public static bool IsCatalogSkillId(string? skillId) => TryResolve(skillId, out _);

    /// <summary>Resolves aliases (starter.gather.mine → f8.mining.basic). Returns the canonical entry.</summary>
    public static bool TryResolve(string? skillId, out AgentSkillShopCatalogEntry entry) {
        EnsureLoaded();
        entry = null!;
        if (string.IsNullOrWhiteSpace(skillId)) {
            return false;
        }
        var id = skillId.Trim();
        if (!byId.TryGetValue(id, out var found)) {
            return false;
        }
        if (!string.IsNullOrEmpty(found.AliasOf)) {
            if (!byId.TryGetValue(found.AliasOf, out var canonical) || !string.IsNullOrEmpty(canonical.AliasOf)) {
                return false;
            }
            entry = canonical;
            return true;
        }
        entry = found;
        return true;
    }

    public static string ResolveCanonicalId(string? skillId) =>
        TryResolve(skillId, out var entry) ? entry.Id : "";

    public static bool TryGetOlympiaSkillId(string? skillId, out int olympiaSkillId) {
        if (TryResolve(skillId, out var entry)) {
            olympiaSkillId = entry.OlympiaSkillId;
            return entry.OlympiaSkillId >= 0;
        }
        olympiaSkillId = -1;
        return false;
    }

    /// <summary>Grant-only packs may arrive on AuthenticateRequest. Paid packs require this shop.</summary>
    public static bool IsGrantOnly(string? skillId) =>
        TryResolve(skillId, out var entry) && entry.PriceHell <= 0;

    /// <summary>
    /// Pays pending $HELL and binds a pack. Client-supplied loadouts cannot call this —
    /// only the shop packet path (or tests) does.
    /// </summary>
    public static bool TryAcquire(
        string? controllerKind,
        string? accountWallet,
        IReadOnlyList<PersistedAgentSkillSlot>? current,
        string? skillId,
        string? rail,
        out PersistedAgentSkillSlot[] nextSkills,
        out string message) {
        nextSkills = current is null ? [] : current.ToArray();
        message = "";

        if (!AgentPlayerProfile.IsAgentController(controllerKind)) {
            message = "Only declared agent characters can buy skill packs.";
            return false;
        }

        var railNorm = (rail ?? "").Trim().ToLowerInvariant();
        if (railNorm == RailStake) {
            message = "Staking does not equip skill packs. Buy the NFT Skill with pending $HELL; stake $HELBREATH for Olympia monster-group expertise.";
            return false;
        }
        if (railNorm != RailBuyNft) {
            message = "Skill shop rail is buy_nft only.";
            return false;
        }
        if (!TryResolve(skillId, out var entry)) {
            message = "Unknown skill pack.";
            return false;
        }

        var have = NormalizeEquipped(current);
        if (have.Any(s => string.Equals(s.SkillId, entry.Id, StringComparison.Ordinal))) {
            message = "That pack is already equipped.";
            return false;
        }
        if (have.Count >= AgentPlayerProfile.MaxSkillSlots) {
            message = $"Agent loadout is full ({AgentPlayerProfile.MaxSkillSlots} slots).";
            return false;
        }

        var cost = entry.PriceHell;
        if (cost <= 0) {
            message = "That pack is grant-only (not for sale).";
            return false;
        }

        if (!HellMiningStore.TrySpendPending(accountWallet, cost, out var spendMsg)) {
            message = spendMsg;
            return false;
        }

        var added = new PersistedAgentSkillSlot(entry.Id, "", Consumed: true, Rail: RailBuyNft, StakeHell: 0);
        nextSkills = [.. have, added];
        message = $"Bound {entry.DisplayName} for {cost} pending {loadedTicker}. NFT mint is a post-test stub — training continues on this character.";
        return true;
    }

    /// <summary>
    /// Shop is buy_nft only. If a leftover <c>stake</c> slot remains from an earlier stub, refund pending $HELL
    /// and drop the pack so it cannot gate mining/alchemy. F8 XP on the blob is unchanged.
    /// </summary>
    public static bool TryUnstake(
        string? controllerKind,
        string? accountWallet,
        IReadOnlyList<PersistedAgentSkillSlot>? current,
        string? skillId,
        out PersistedAgentSkillSlot[] nextSkills,
        out string message) {
        nextSkills = current is null ? [] : current.ToArray();
        message = "";

        if (!TryResolve(skillId, out var entry)) {
            message = "Unknown skill pack. Skill shop is buy_nft only — stake $HELBREATH for Olympia expertise.";
            return false;
        }

        var have = NormalizeEquipped(current);
        var idx = have.FindIndex(s =>
            string.Equals(s.SkillId, entry.Id, StringComparison.Ordinal) &&
            string.Equals(s.Rail, RailStake, StringComparison.Ordinal));
        if (idx < 0) {
            message = "Skill shop is buy_nft only. Stake $HELBREATH raises Olympia monster-group expertise, not F8 packs.";
            return false;
        }

        var slot = have[idx];
        var refund = slot.StakeHell > 0 ? slot.StakeHell : 0;
        have.RemoveAt(idx);
        if (refund > 0) {
            HellMiningStore.RefundPendingSpend(accountWallet, refund);
        }
        nextSkills = have.ToArray();
        message = $"Removed leftover shop-stake on {entry.DisplayName}; refunded {refund} pending {loadedTicker}. Packs are buy_nft only.";
        return true;
    }

    public static AgentSkillShopState BuildState(
        string? accountWallet,
        IEnumerable<PersistedAgentSkillSlot>? equipped) {
        EnsureLoaded();
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var pending = string.IsNullOrWhiteSpace(accountWallet)
            ? 0
            : HellMiningStore.GetSnapshot(accountWallet, nowMs).PendingHell;

        var state = new AgentSkillShopState {
            PendingHell = pending,
            TokenTicker = loadedTicker,
        };
        foreach (var entry in catalog) {
            state.Catalog.Add(ToProtoEntry(entry));
        }
        foreach (var slot in NormalizeEquipped(equipped)) {
            state.Equipped.Add(ToProtoSlot(slot));
        }
        return state;
    }

    public static void HandleGetState(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        NetworkManager.SendToPlayer(player, new ServerMessage {
            AgentSkillShopState = BuildState(player.AccountWallet, player.AgentProfile?.Skills),
        });
    }

    public static void HandleAcquire(GameWorldPlayer player, AgentSkillShopAcquireRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);
        if (player.IsDead) {
            SendResult(player, false, "Cannot shop while dead.");
            return;
        }
        var current = player.AgentProfile;
        if (!TryAcquire(
                current?.ControllerKind,
                player.AccountWallet,
                current?.Skills,
                request.SkillId,
                request.Rail,
                out var next,
                out var message)) {
            SendResult(player, false, message);
            return;
        }
        ApplyLoadout(player, current, next);
        SendResult(player, true, message);
    }

    public static void HandleUnstake(GameWorldPlayer player, AgentSkillShopUnstakeRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);
        if (player.IsDead) {
            SendResult(player, false, "Cannot unstake while dead.");
            return;
        }
        var current = player.AgentProfile;
        if (!TryUnstake(
                current?.ControllerKind,
                player.AccountWallet,
                current?.Skills,
                request.SkillId,
                out var next,
                out var message)) {
            SendResult(player, false, message);
            return;
        }
        ApplyLoadout(player, current, next);
        SendResult(player, true, message);
    }

    public static AgentSkillLoadoutSlot ToProtoSlot(PersistedAgentSkillSlot slot) {
        var proto = new AgentSkillLoadoutSlot {
            SkillId = slot.SkillId ?? "",
            Consumed = slot.Consumed,
        };
        if (!string.IsNullOrEmpty(slot.NftMint)) {
            proto.NftMint = slot.NftMint;
        }
        if (!string.IsNullOrEmpty(slot.Rail)) {
            proto.Rail = slot.Rail;
        }
        if (slot.StakeHell > 0) {
            proto.StakeHell = slot.StakeHell;
        }
        return proto;
    }

    static void ApplyLoadout(GameWorldPlayer player, PersistedAgentProfile? current, PersistedAgentSkillSlot[] next) {
        var baseProfile = current ?? new PersistedAgentProfile(AgentPlayerProfile.ControllerAgent);
        player.SetAgentProfile(baseProfile with { Skills = next });
    }

    static void SendResult(GameWorldPlayer player, bool ok, string message) {
        NetworkManager.SendToPlayer(player, new ServerMessage {
            AgentSkillShopResult = new AgentSkillShopResult {
                Ok = ok,
                Error = message ?? "",
                Shop = BuildState(player.AccountWallet, player.AgentProfile?.Skills),
            },
        });
    }

    static List<PersistedAgentSkillSlot> NormalizeEquipped(IEnumerable<PersistedAgentSkillSlot>? slots) {
        var list = new List<PersistedAgentSkillSlot>(AgentPlayerProfile.MaxSkillSlots);
        var seen = new HashSet<string>(StringComparer.Ordinal);
        if (slots is null) {
            return list;
        }
        foreach (var slot in slots) {
            if (!TryResolve(slot.SkillId, out var entry) || !seen.Add(entry.Id)) {
                continue;
            }
            list.Add(slot with { SkillId = entry.Id });
        }
        return list;
    }

    static Mmorpg.Network.AgentSkillShopEntry ToProtoEntry(AgentSkillShopCatalogEntry entry) {
        var proto = new Mmorpg.Network.AgentSkillShopEntry {
            SkillId = entry.Id,
            DisplayName = entry.DisplayName,
            Tier = entry.Tier,
            OlympiaSkillId = entry.OlympiaSkillId,
            PriceHell = entry.PriceHell,
            StakeHell = entry.StakeHell,
            AliasOf = entry.AliasOf ?? "",
        };
        foreach (var tag in entry.Tags) {
            proto.Tags.Add(tag);
        }
        return proto;
    }

    static Dictionary<string, AgentSkillShopCatalogEntry> IndexById(List<AgentSkillShopCatalogEntry> entries) {
        var map = new Dictionary<string, AgentSkillShopCatalogEntry>(StringComparer.Ordinal);
        foreach (var entry in entries) {
            map[entry.Id] = entry;
        }
        return map;
    }

    static bool TrySanitizeEntry(AgentSkillShopCatalogEntry raw, out AgentSkillShopCatalogEntry entry) {
        entry = raw;
        var id = (raw.Id ?? "").Trim();
        if (id.Length == 0 || id.Length > AgentPlayerProfile.MaxSkillIdChars) {
            return false;
        }
        var tier = (raw.Tier ?? "").Trim().ToLowerInvariant();
        if (tier is not (TierBasic or TierAdvanced)) {
            return false;
        }
        if (raw.OlympiaSkillId < -1 || raw.OlympiaSkillId >= Skills.SkillCount) {
            return false;
        }
        var tags = new List<string>();
        foreach (var tag in raw.Tags ?? []) {
            var t = (tag ?? "").Trim().ToLowerInvariant();
            if (AllowedTags.Contains(t) && !tags.Contains(t, StringComparer.Ordinal)) {
                tags.Add(t);
            }
        }
        if (tags.Count == 0) {
            return false;
        }
        var aliasOf = (raw.AliasOf ?? "").Trim();
        if (aliasOf.Length > AgentPlayerProfile.MaxSkillIdChars) {
            aliasOf = "";
        }
        if (raw.PriceHell < 0 || raw.StakeHell < 0) {
            return false;
        }
        entry = new AgentSkillShopCatalogEntry {
            Id = id,
            DisplayName = string.IsNullOrWhiteSpace(raw.DisplayName) ? id : raw.DisplayName.Trim(),
            Tier = tier,
            Tags = tags.ToArray(),
            OlympiaSkillId = raw.OlympiaSkillId,
            PriceHell = raw.PriceHell,
            StakeHell = raw.StakeHell,
            AliasOf = aliasOf,
        };
        return true;
    }

    /// <summary>Built from <see cref="Skills.Names"/> so the shop cannot invent a second mastery table.</summary>
    static List<AgentSkillShopCatalogEntry> BuildFallbackCatalog() {
        var list = new List<AgentSkillShopCatalogEntry>(Skills.SkillCount * 2 + 8);
        for (var i = 0; i < Skills.SkillCount; i++) {
            var name = i < Skills.Names.Length ? Skills.Names[i] : $"Skill {i}";
            var slug = Slug(name);
            var tag = TagForOlympia(i);
            var (basicPrice, advancedPrice) = PricesForOlympia(i, tag);
            list.Add(Pack($"f8.{slug}.basic", $"{name} (Basic)", TierBasic, tag, i, basicPrice));
            list.Add(Pack($"f8.{slug}.advanced", $"{name} (Advanced)", TierAdvanced, tag, i, advancedPrice));
        }
        list.Add(Pack("starter.academy.easy", "Academy Easy (starter grant)", TierBasic, "academy", -1, 0, extraTag: "combat"));
        list.Add(Pack("starter.academy.hard", "Academy Hard", TierAdvanced, "academy", -1, 300, extraTag: "combat"));
        list.Add(Pack("starter.pvp.kite", "PvP Kite (Basic)", TierBasic, "combat", -1, 75));
        list.Add(new AgentSkillShopCatalogEntry {
            Id = "starter.gather.mine",
            DisplayName = "Gather Mine (alias)",
            Tier = TierBasic,
            Tags = ["gather"],
            OlympiaSkillId = Skills.Mining,
            PriceHell = 50,
            StakeHell = 0,
            AliasOf = "f8.mining.basic",
        });
        list.Add(new AgentSkillShopCatalogEntry {
            Id = "starter.gather.fish",
            DisplayName = "Gather Fish (alias)",
            Tier = TierBasic,
            Tags = ["gather"],
            OlympiaSkillId = Skills.Fishing,
            PriceHell = 50,
            StakeHell = 0,
            AliasOf = "f8.fishing.basic",
        });
        return list;
    }

    static AgentSkillShopCatalogEntry Pack(
        string id,
        string display,
        string tier,
        string tag,
        int olympia,
        long price,
        string? extraTag = null) {
        string[] tags = extraTag is null ? [tag] : [tag, extraTag];
        return new AgentSkillShopCatalogEntry {
            Id = id,
            DisplayName = display,
            Tier = tier,
            Tags = tags,
            OlympiaSkillId = olympia,
            PriceHell = price,
            StakeHell = 0,
        };
    }

    static string TagForOlympia(int skillId) => skillId switch {
        Skills.Mining or Skills.Fishing or 2 => "gather",
        3 or 5 or Skills.Manufacture or Skills.Alchemy => "craft",
        _ => "combat",
    };

    static (long Basic, long Advanced) PricesForOlympia(int skillId, string tag) {
        if (tag == "gather") {
            return skillId is Skills.Mining or Skills.Fishing ? (50, 400) : (40, 250);
        }
        if (tag == "craft") {
            return skillId switch {
                Skills.Manufacture => (80, 800),
                Skills.Alchemy => (80, 700),
                _ => (80, 600),
            };
        }
        return skillId switch {
            Skills.Fencing => (60, 500),
            Skills.Magic or Skills.HammerMastery or Skills.LongSword
                or Skills.AxeMastery or Skills.BowMastery or Skills.StaffMastery => (50, 400),
            _ => (40, 250),
        };
    }

    static string Slug(string name) {
        var sb = new StringBuilder(name.Length);
        foreach (var ch in name.Trim().ToLowerInvariant()) {
            if (char.IsLetterOrDigit(ch)) {
                sb.Append(ch);
            } else if (char.IsWhiteSpace(ch) || ch == '-') {
                if (sb.Length > 0 && sb[^1] != '-') {
                    sb.Append('-');
                }
            }
        }
        return sb.ToString().Trim('-');
    }
}

/// <summary>On-disk catalog file (Config/AgentSkillShop.json).</summary>
public sealed class AgentSkillShopFile {
    public string TokenTicker { get; set; } = AgentSkillShop.TokenTicker;
    public List<AgentSkillShopCatalogEntry> Entries { get; set; } = [];
}

/// <summary>One allowlisted pack. <c>AliasOf</c> points at the canonical id when set.</summary>
public sealed class AgentSkillShopCatalogEntry {
    public string Id { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Tier { get; set; } = AgentSkillShop.TierBasic;
    public string[] Tags { get; set; } = [];
    [JsonPropertyName("olympiaSkillId")]
    public int OlympiaSkillId { get; set; } = -1;
    public long PriceHell { get; set; }
    public long StakeHell { get; set; }
    public string AliasOf { get; set; } = "";
}
