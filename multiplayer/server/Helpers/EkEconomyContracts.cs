namespace Server.Helpers;

/// <summary>Stable result codes for the EK economy ledger. Callers branch on <see cref="Code"/>, not on message text.</summary>
public static class EkEconomyCodes {
    public const string Ok = "ok";
    public const string BelowMin = "below_min";
    public const string CraftSourceUnspecified = "craft_source_unspecified";
    public const string InsufficientEk = "insufficient_ek";
    public const string InsufficientGold = "insufficient_gold";
    public const string InsufficientMaterial = "insufficient_material";
    public const string NftNotFound = "nft_not_found";
    public const string NftAlreadyBurned = "nft_already_burned";
    public const string IdempotencyConflict = "idempotency_conflict";
    public const string RealMovementBlocked = "real_movement_blocked";
    public const string RealEmissionRefused = "real_emission_refused";
    public const string NotHeroPiece = "not_hero_piece";
    public const string PieceNotFound = "piece_not_found";
    public const string PieceNotOwned = "piece_not_owned";
    public const string PieceAlreadyUnbound = "piece_already_unbound";
    public const string TournamentLoadout = "tournament_loadout";
    public const string EmptySet = "empty_set";
    public const string DuplicatePiece = "duplicate_piece";
    public const string InvalidAmount = "invalid_amount";
    public const string InvalidKey = "invalid_key";
    public const string InvalidPlayer = "invalid_player";
    public const string RaidOrderInvalid = "raid_order_invalid";
}

/// <summary>
/// Flat fee assessment. <see cref="Collected"/> is always false: this build records the USD amount and does not capture it.
/// </summary>
public sealed class FeeAssessment {
    public FeeAssessment(string key, decimal usd, int count) {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        if (count < 1) {
            throw new ArgumentOutOfRangeException(nameof(count));
        }
        if (usd < 0) {
            throw new ArgumentOutOfRangeException(nameof(usd));
        }
        Key = key;
        Usd = usd;
        Count = count;
        Collected = false;
    }

    public string Key { get; }
    public decimal Usd { get; }
    public int Count { get; }
    /// <summary>Always false. No payment rail is invoked.</summary>
    public bool Collected { get; }
}

/// <summary>One auditable economy operation. Replay of the same idempotency key does not append another row.</summary>
public sealed class EkAuditEntry {
    public long Id { get; init; }
    public string AtUtc { get; init; } = "";
    public string Op { get; init; } = "";
    public string PlayerId { get; init; } = "";
    public string IdempotencyKey { get; init; } = "";
    public bool Ok { get; init; }
    public string Code { get; init; } = "";
    public long Amount { get; init; }
    public string? FeeKey { get; init; }
    public decimal FeeUsd { get; init; }
    public int FeeCount { get; init; }
    public bool FeeCollected { get; init; }
    public bool RealMoneyMoved { get; init; }
    public bool ChainSubmitted { get; init; }
    public string? ChainTxId { get; init; }
    public string? NftId { get; init; }
    public long EarnedBefore { get; init; }
    public long EarnedAfter { get; init; }
    public long PurchasedBefore { get; init; }
    public long PurchasedAfter { get; init; }
    public bool MiningApplied { get; init; }
    public int MiningCredits { get; init; }
}

/// <summary>Killer ranking row. Score is the current earned balance only.</summary>
public readonly record struct EkRankingEntry(string PlayerId, long Earned);

/// <summary>Local EK NFT stub. <see cref="ChainMint"/> is always null.</summary>
public sealed class EkNftView {
    public string Id { get; init; } = "";
    public long Amount { get; init; }
    public string CrafterId { get; init; } = "";
    public string? HolderId { get; init; }
    public bool Burned { get; init; }
    public string? ChainMint { get; init; }
}

/// <summary>Outcome of one ledger operation. Real-money and chain fields stay negative.</summary>
public sealed class EkEconomyResult {
    public bool Ok { get; init; }
    public bool Replay { get; init; }
    public string Code { get; init; } = "";
    public string Op { get; init; } = "";
    public string? NftId { get; init; }
    public FeeAssessment? Fee { get; init; }
    public bool RealMoneyMoved { get; init; }
    public bool ChainSubmitted { get; init; }
    public string? ChainTxId { get; init; }
    public long EarnedAfter { get; init; }
    public long PurchasedAfter { get; init; }
    public long GoldAfter { get; init; }
    public bool MiningApplied { get; init; }
    public int MiningCredits { get; init; }
    public string? Detail { get; init; }
}
