using System.Text.Json;
using System.Text.Json.Serialization;

namespace Server.Helpers;

/// <summary>
/// Off-chain EK / hero-set fee config. Amounts are never hardcoded in the ledger operations.
/// <see cref="Emitir"/> false means this process must not move money or submit a chain transaction.
/// </summary>
public sealed class EkEconomyConfig {
    public const string EkNftBindFeeKey = "fees.ek_nft_bind_usd";
    public const string HeroSetPieceUnbindFeeKey = "fees.hero_set_piece_unbind_usd";
    public const string CraftSourceEarned = "earned";
    public const string CraftSourcePurchased = "purchased";
    public const string CraftSourcePurchasedThenEarned = "purchased_then_earned";
    public const string CraftSourceEarnedThenPurchased = "earned_then_purchased";

    static readonly JsonSerializerOptions JsonOpts = new() {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    /// <summary>When false, fee capture and mint/burn stay local stubs. This build has no payment or chain rail either way.</summary>
    [JsonPropertyName("emitir")]
    public bool Emitir { get; init; }

    /// <summary>Minimum EK amount on one NFT. Any amount at or above this is accepted; there are no fixed packs.</summary>
    [JsonPropertyName("ek_nft_min_amount")]
    public long EkNftMinAmount { get; init; } = 50;

    [JsonPropertyName("fees")]
    public EkEconomyFees Fees { get; init; } = EkEconomyFees.CreateDefault();

    /// <summary>
    /// Raid-master EK debit order. Default is purchased, then earned.
    /// Both buckets are valid spend. Ranking still reads only the earned balance.
    /// </summary>
    [JsonPropertyName("raid_master_spend_order")]
    public string[] RaidMasterSpendOrder { get; init; } = ["purchased", "earned"];

    /// <summary>
    /// Which balance funds an EK NFT craft: earned, purchased, purchased_then_earned, or earned_then_purchased.
    /// Null or empty is unspecified and fail-closed (no EK moved). The product owner has not closed this rule.
    /// </summary>
    [JsonPropertyName("ek_nft_craft_source")]
    public string? EkNftCraftSource { get; init; }

    public static EkEconomyConfig CreateDefault() => new() {
        Emitir = false,
        EkNftMinAmount = 50,
        Fees = EkEconomyFees.CreateDefault(),
        RaidMasterSpendOrder = ["purchased", "earned"],
        EkNftCraftSource = null,
    };

    /// <summary>Loads <paramref name="path"/> or returns <see cref="CreateDefault"/> when the file is missing.</summary>
    public static EkEconomyConfig LoadOrDefault(string path) {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        if (!File.Exists(path)) {
            return CreateDefault();
        }
        var json = File.ReadAllText(path);
        var loaded = JsonSerializer.Deserialize<EkEconomyConfig>(json, JsonOpts) ?? CreateDefault();
        loaded.Validate();
        return loaded;
    }

    public EkEconomyConfig WithCraftSource(string? craftSource) => new() {
        Emitir = Emitir,
        EkNftMinAmount = EkNftMinAmount,
        Fees = Fees,
        RaidMasterSpendOrder = RaidMasterSpendOrder,
        EkNftCraftSource = craftSource,
    };

    public EkEconomyConfig WithEmitir(bool emitir) => new() {
        Emitir = emitir,
        EkNftMinAmount = EkNftMinAmount,
        Fees = Fees,
        RaidMasterSpendOrder = RaidMasterSpendOrder,
        EkNftCraftSource = EkNftCraftSource,
    };

    public EkEconomyConfig WithSpendOrder(string[] order) => new() {
        Emitir = Emitir,
        EkNftMinAmount = EkNftMinAmount,
        Fees = Fees,
        RaidMasterSpendOrder = order,
        EkNftCraftSource = EkNftCraftSource,
    };

    /// <summary>Rejects a config that would hide a negative fee or a zero minimum. Does not invent a craft-source side.</summary>
    public void Validate() {
        if (EkNftMinAmount < 1) {
            throw new InvalidOperationException("ek_nft_min_amount must be at least 1.");
        }
        if (Fees is null) {
            throw new InvalidOperationException("fees config is missing.");
        }
        if (Fees.EkNftBindUsd < 0 || Fees.HeroSetPieceUnbindUsd < 0) {
            throw new InvalidOperationException("USD fees cannot be negative.");
        }
        if (!TryNormalizeSpendOrder(RaidMasterSpendOrder, out _, out var error)) {
            throw new InvalidOperationException(error);
        }
    }

    /// <summary>
    /// Accepts only a permutation of purchased and earned so a raid cannot silently skip a bucket.
    /// </summary>
    public static bool TryNormalizeSpendOrder(string[]? order, out string[] normalized, out string error) {
        normalized = [];
        error = "";
        if (order is null || order.Length != 2) {
            error = "raid_master_spend_order must list purchased and earned.";
            return false;
        }
        var a = (order[0] ?? "").Trim().ToLowerInvariant();
        var b = (order[1] ?? "").Trim().ToLowerInvariant();
        if (a == b ||
            a is not ("purchased" or "earned") ||
            b is not ("purchased" or "earned")) {
            error = "raid_master_spend_order must be a permutation of purchased and earned.";
            return false;
        }
        normalized = [a, b];
        return true;
    }
}

/// <summary>Flat USD fees. Collection is a stub; these numbers are audit amounts, not a charge.</summary>
public sealed class EkEconomyFees {
    [JsonPropertyName("ek_nft_bind_usd")]
    public decimal EkNftBindUsd { get; init; } = 5m;

    [JsonPropertyName("hero_set_piece_unbind_usd")]
    public decimal HeroSetPieceUnbindUsd { get; init; } = 5m;

    public static EkEconomyFees CreateDefault() => new() {
        EkNftBindUsd = 5m,
        HeroSetPieceUnbindUsd = 5m,
    };
}
