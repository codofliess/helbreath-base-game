using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using Server.World;

namespace Server.Helpers;

/// <summary>
/// Durable in-memory auction board + fee-debt ledger.
/// Primary persistence: JSON under Chars/ (works without Postgres / traveler mode).
/// </summary>
public static class AuctionBoardStore {
    public const int CommissionPercent = 5;
    /// <summary>Debt must be settled within this window or char/IP trade is blocked (&lt; 3 days).</summary>
    public const int DebtGraceMs = (3 * 24 * 60 * 60 * 1000) - 60_000;
    public const int FullLevelThreshold = 140;
    public const int MinReputationForAntiAlt = 100;
    public const string SettlementNoteMock =
        "MVP: settles bag gold (item 90). On-chain $HELL / non-custodial wallet settle = not wired (C6 preference).";

    static readonly object Gate = new();
    static readonly Dictionary<string, AuctionListingRecord> Listings = new(StringComparer.OrdinalIgnoreCase);
    static readonly Dictionary<string, AuctionDebtRecord> Debts = new(StringComparer.OrdinalIgnoreCase);
    static readonly HashSet<string> BlockedIps = new(StringComparer.OrdinalIgnoreCase);
    static readonly Dictionary<string, long> PendingGoldCredits = new(StringComparer.OrdinalIgnoreCase);
    static readonly Dictionary<string, PendingFeeCharge> PendingFeeCharges = new(StringComparer.OrdinalIgnoreCase);
    static string? persistDirectory;
    static long lastPersistMs;
    static long lastTickMs;

    static readonly JsonSerializerOptions JsonOptions = new() {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    /// <summary>Loads JSON state from the server Chars directory (or creates empty).</summary>
    public static void Initialize(string charsDirectory) {
        ArgumentException.ThrowIfNullOrWhiteSpace(charsDirectory);
        Directory.CreateDirectory(charsDirectory);
        persistDirectory = charsDirectory;
        lock (Gate) {
            Listings.Clear();
            Debts.Clear();
            BlockedIps.Clear();
            PendingGoldCredits.Clear();
            PendingFeeCharges.Clear();
            TryLoadLocked();
        }
        Console.WriteLine(
            $"[AuctionBoard] Initialized ({Listings.Count} listings, {Debts.Count} debts). {SettlementNoteMock}");
    }

    /// <summary>Periodic expire / debt enforcement / flush. Safe to call from any world tick.</summary>
    public static void Tick(long nowMs) {
        lock (Gate) {
            if (nowMs - lastTickMs < 5_000) {
                return;
            }
            lastTickMs = nowMs;
            ExpireDueListingsLocked(nowMs);
            EnforceOverdueDebtsLocked(nowMs);
            if (nowMs - lastPersistMs >= 15_000) {
                PersistLocked();
                lastPersistMs = nowMs;
            }
        }
    }

    public static bool IsIpBlocked(string? ip) {
        if (string.IsNullOrWhiteSpace(ip)) {
            return false;
        }
        lock (Gate) {
            return BlockedIps.Contains(ip.Trim());
        }
    }

    public static bool IsCharacterTradeBlocked(string accountWallet, string characterName, long nowMs) {
        lock (Gate) {
            if (!Debts.TryGetValue(DebtKey(accountWallet, characterName), out var debt)) {
                return false;
            }
            return debt.Blocked || (debt.AmountGold > 0 && debt.DueAtMs > 0 && nowMs >= debt.DueAtMs);
        }
    }

    public static AuctionDebtRecord? GetDebt(string accountWallet, string characterName) {
        lock (Gate) {
            return Debts.TryGetValue(DebtKey(accountWallet, characterName), out var debt) ? CloneDebt(debt) : null;
        }
    }

    public static IReadOnlyList<AuctionListingRecord> GetActiveListings() {
        lock (Gate) {
            return Listings.Values
                .Where(l => string.Equals(l.Status, "active", StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(l => l.CreatedAtMs)
                .Select(CloneListing)
                .ToList();
        }
    }

    /// <summary>Listings that need timed settle or escrow return (may be active or expired).</summary>
    public static IReadOnlyList<AuctionListingRecord> GetListingsNeedingWork() {
        lock (Gate) {
            return Listings.Values
                .Where(l => l.PendingSettle || l.PendingReturnEscrow)
                .Select(CloneListing)
                .ToList();
        }
    }

    public static IReadOnlyList<AuctionListingRecord> GetListingsNeedingEscrowReturn() {
        lock (Gate) {
            return Listings.Values
                .Where(l => l.PendingReturnEscrow && l.EscrowItem is not null)
                .Select(CloneListing)
                .ToList();
        }
    }

    public static bool TryGetListing(string listingId, out AuctionListingRecord? listing) {
        lock (Gate) {
            if (Listings.TryGetValue(listingId, out var found)) {
                listing = CloneListing(found);
                return true;
            }
            listing = null;
            return false;
        }
    }

    /// <summary>Mutates a listing under the store lock; returns false if missing.</summary>
    public static bool TryUpdateListing(string listingId, Func<AuctionListingRecord, bool> mutate) {
        ArgumentNullException.ThrowIfNull(mutate);
        lock (Gate) {
            if (!Listings.TryGetValue(listingId, out var listing)) {
                return false;
            }
            var ok = mutate(listing);
            if (ok) {
                PersistLocked();
            }
            return ok;
        }
    }

    public static AuctionListingRecord AddListing(AuctionListingRecord listing) {
        ArgumentNullException.ThrowIfNull(listing);
        lock (Gate) {
            Listings[listing.ListingId] = listing;
            PersistLocked();
            return CloneListing(listing);
        }
    }

    public static void SetDebt(AuctionDebtRecord debt) {
        ArgumentNullException.ThrowIfNull(debt);
        lock (Gate) {
            Debts[DebtKey(debt.AccountWallet, debt.CharacterName)] = debt;
            PersistLocked();
        }
    }

    public static void ClearDebt(string accountWallet, string characterName) {
        lock (Gate) {
            Debts.Remove(DebtKey(accountWallet, characterName));
            PersistLocked();
        }
    }

    public static void AddPendingGold(string accountWallet, string characterName, int gold) {
        if (gold <= 0) {
            return;
        }
        lock (Gate) {
            var key = DebtKey(accountWallet, characterName);
            PendingGoldCredits.TryGetValue(key, out var existing);
            PendingGoldCredits[key] = existing + gold;
            PersistLocked();
        }
    }

    /// <summary>Takes and clears pending gold credit for an offline seller / outbid refund.</summary>
    public static int TakePendingGold(string accountWallet, string characterName) {
        lock (Gate) {
            var key = DebtKey(accountWallet, characterName);
            if (!PendingGoldCredits.TryGetValue(key, out var gold) || gold <= 0) {
                return 0;
            }
            PendingGoldCredits.Remove(key);
            PersistLocked();
            return gold > int.MaxValue ? int.MaxValue : (int)gold;
        }
    }

    /// <summary>Queues a commission debit to apply when the seller next interacts (has GameWorldRef).</summary>
    public static void AddPendingFeeCharge(string accountWallet, string characterName, int fee, string? ip) {
        if (fee <= 0) {
            return;
        }
        lock (Gate) {
            var key = DebtKey(accountWallet, characterName);
            if (PendingFeeCharges.TryGetValue(key, out var existing)) {
                existing.AmountGold += fee;
                if (string.IsNullOrWhiteSpace(existing.LastKnownIp) && !string.IsNullOrWhiteSpace(ip)) {
                    existing.LastKnownIp = ip.Trim();
                }
            } else {
                PendingFeeCharges[key] = new PendingFeeCharge {
                    AmountGold = fee,
                    LastKnownIp = ip?.Trim() ?? string.Empty,
                };
            }
            PersistLocked();
        }
    }

    public static int TakePendingFeeCharge(string accountWallet, string characterName, out string? ip) {
        ip = null;
        lock (Gate) {
            var key = DebtKey(accountWallet, characterName);
            if (!PendingFeeCharges.TryGetValue(key, out var charge) || charge.AmountGold <= 0) {
                return 0;
            }
            PendingFeeCharges.Remove(key);
            ip = charge.LastKnownIp;
            PersistLocked();
            return charge.AmountGold;
        }
    }

    public static void BlockIp(string? ip) {
        if (string.IsNullOrWhiteSpace(ip)) {
            return;
        }
        lock (Gate) {
            BlockedIps.Add(ip.Trim());
            PersistLocked();
        }
    }

    public static string DebtKey(string accountWallet, string characterName) =>
        OnlinePlayerDirectory.MakeKey(accountWallet, characterName);

    static void ExpireDueListingsLocked(long nowMs) {
        foreach (var listing in Listings.Values) {
            if (!string.Equals(listing.Status, "active", StringComparison.OrdinalIgnoreCase)) {
                continue;
            }
            if (listing.ExpiresAtMs <= 0 || nowMs < listing.ExpiresAtMs) {
                continue;
            }
            if (listing.Mode == AuctionListingModeKind.Time &&
                listing.CurrentBidGold > 0 &&
                !string.IsNullOrWhiteSpace(listing.CurrentBidderWallet)) {
                listing.PendingSettle = true;
                continue;
            }
            listing.Status = "expired";
            listing.PendingReturnEscrow = listing.EscrowItem is not null;
        }
    }

    static void EnforceOverdueDebtsLocked(long nowMs) {
        foreach (var debt in Debts.Values) {
            if (debt.AmountGold <= 0 || debt.DueAtMs <= 0 || nowMs < debt.DueAtMs) {
                continue;
            }
            debt.Blocked = true;
            if (!string.IsNullOrWhiteSpace(debt.LastKnownIp)) {
                BlockedIps.Add(debt.LastKnownIp.Trim());
            }
        }
    }

    static void TryLoadLocked() {
        if (persistDirectory is null) {
            return;
        }
        var path = Path.Combine(persistDirectory, "auction-board.json");
        if (!File.Exists(path)) {
            return;
        }
        try {
            var json = File.ReadAllText(path);
            var file = JsonSerializer.Deserialize<AuctionBoardPersistFile>(json, JsonOptions);
            if (file is null) {
                return;
            }
            if (file.Listings is not null) {
                foreach (var listing in file.Listings) {
                    if (!string.IsNullOrWhiteSpace(listing.ListingId)) {
                        Listings[listing.ListingId] = listing;
                    }
                }
            }
            if (file.Debts is not null) {
                foreach (var debt in file.Debts) {
                    Debts[DebtKey(debt.AccountWallet, debt.CharacterName)] = debt;
                }
            }
            if (file.BlockedIps is not null) {
                foreach (var ip in file.BlockedIps) {
                    if (!string.IsNullOrWhiteSpace(ip)) {
                        BlockedIps.Add(ip.Trim());
                    }
                }
            }
            if (file.PendingGoldCredits is not null) {
                foreach (var pair in file.PendingGoldCredits) {
                    PendingGoldCredits[pair.Key] = pair.Value;
                }
            }
            if (file.PendingFeeCharges is not null) {
                foreach (var pair in file.PendingFeeCharges) {
                    PendingFeeCharges[pair.Key] = pair.Value;
                }
            }
        } catch (Exception ex) {
            Console.WriteLine($"[AuctionBoard] Failed to load auction-board.json: {ex.Message}");
        }
    }

    static void PersistLocked() {
        if (persistDirectory is null) {
            return;
        }
        var path = Path.Combine(persistDirectory, "auction-board.json");
        var tmp = path + ".tmp";
        var file = new AuctionBoardPersistFile {
            Listings = Listings.Values.Select(CloneListing).ToList(),
            Debts = Debts.Values.Select(CloneDebt).ToList(),
            BlockedIps = BlockedIps.ToList(),
            PendingGoldCredits = new Dictionary<string, long>(PendingGoldCredits, StringComparer.OrdinalIgnoreCase),
            PendingFeeCharges = new Dictionary<string, PendingFeeCharge>(PendingFeeCharges, StringComparer.OrdinalIgnoreCase),
        };
        try {
            File.WriteAllText(tmp, JsonSerializer.Serialize(file, JsonOptions));
            File.Copy(tmp, path, overwrite: true);
            File.Delete(tmp);
        } catch (Exception ex) {
            Console.WriteLine($"[AuctionBoard] Failed to persist auction-board.json: {ex.Message}");
        }
    }

    static AuctionListingRecord CloneListing(AuctionListingRecord src) => new() {
        ListingId = src.ListingId,
        SellerWallet = src.SellerWallet,
        SellerName = src.SellerName,
        SellerCity = src.SellerCity,
        SellerGuildId = src.SellerGuildId,
        Mode = src.Mode,
        ItemId = src.ItemId,
        ItemUid = src.ItemUid,
        Quantity = src.Quantity,
        ItemAttribute = src.ItemAttribute,
        ItemColor = src.ItemColor,
        CurLifeSpan = src.CurLifeSpan,
        MaxLifeSpan = src.MaxLifeSpan,
        ListPriceGold = src.ListPriceGold,
        MinBidGold = src.MinBidGold,
        CurrentBidGold = src.CurrentBidGold,
        CurrentBidderWallet = src.CurrentBidderWallet,
        CurrentBidderName = src.CurrentBidderName,
        CreatedAtMs = src.CreatedAtMs,
        ExpiresAtMs = src.ExpiresAtMs,
        Status = src.Status,
        ItemName = src.ItemName,
        OnlyOwnCity = src.OnlyOwnCity,
        OnlyOwnGuild = src.OnlyOwnGuild,
        RequireFullLevelAndRep100 = src.RequireFullLevelAndRep100,
        BlockedGuildIds = src.BlockedGuildIds?.ToList() ?? new List<string>(),
        BlockedPlayerNames = src.BlockedPlayerNames?.ToList() ?? new List<string>(),
        EscrowItem = src.EscrowItem is null ? null : CloneEscrow(src.EscrowItem),
        PendingSettle = src.PendingSettle,
        PendingReturnEscrow = src.PendingReturnEscrow,
    };

    static AuctionEscrowItem CloneEscrow(AuctionEscrowItem src) => new() {
        ItemId = src.ItemId,
        ItemUid = src.ItemUid,
        Quantity = src.Quantity,
        ItemAttribute = src.ItemAttribute,
        ItemColor = src.ItemColor,
        CurLifeSpan = src.CurLifeSpan,
        MaxLifeSpan = src.MaxLifeSpan,
        EffectOverrides = src.EffectOverrides,
    };

    static AuctionDebtRecord CloneDebt(AuctionDebtRecord src) => new() {
        AccountWallet = src.AccountWallet,
        CharacterName = src.CharacterName,
        AmountGold = src.AmountGold,
        DueAtMs = src.DueAtMs,
        LastKnownIp = src.LastKnownIp,
        Blocked = src.Blocked,
    };
}

public enum AuctionListingModeKind {
    Time = 1,
    Limit = 2,
}

/// <summary>Persisted auction listing + short-lived item escrow snapshot.</summary>
public sealed class AuctionListingRecord {
    public string ListingId { get; set; } = "";
    public string SellerWallet { get; set; } = "";
    public string SellerName { get; set; } = "";
    public string SellerCity { get; set; } = "";
    public string SellerGuildId { get; set; } = "";
    public AuctionListingModeKind Mode { get; set; }
    public int ItemId { get; set; }
    public long ItemUid { get; set; }
    public int Quantity { get; set; } = 1;
    public uint ItemAttribute { get; set; }
    public int ItemColor { get; set; }
    public int CurLifeSpan { get; set; }
    public int MaxLifeSpan { get; set; }
    public int ListPriceGold { get; set; }
    public int MinBidGold { get; set; }
    public int CurrentBidGold { get; set; }
    public string CurrentBidderWallet { get; set; } = "";
    public string CurrentBidderName { get; set; } = "";
    public long CreatedAtMs { get; set; }
    public long ExpiresAtMs { get; set; }
    public string Status { get; set; } = "active";
    public string ItemName { get; set; } = "";
    public bool OnlyOwnCity { get; set; }
    public bool OnlyOwnGuild { get; set; }
    public bool RequireFullLevelAndRep100 { get; set; }
    public List<string> BlockedGuildIds { get; set; } = new();
    public List<string> BlockedPlayerNames { get; set; } = new();
    public AuctionEscrowItem? EscrowItem { get; set; }
    public bool PendingSettle { get; set; }
    public bool PendingReturnEscrow { get; set; }
}

/// <summary>Escrowed bag stack held until settle / cancel / expire return.</summary>
public sealed class AuctionEscrowItem {
    public int ItemId { get; set; }
    public long ItemUid { get; set; }
    public int Quantity { get; set; }
    public uint ItemAttribute { get; set; }
    public int ItemColor { get; set; }
    public int CurLifeSpan { get; set; }
    public int MaxLifeSpan { get; set; }
    public ItemEffectConfig[]? EffectOverrides { get; set; }
}

/// <summary>Commission debt ledger row (negative wallet balance mock for MVP gold).</summary>
public sealed class AuctionDebtRecord {
    public string AccountWallet { get; set; } = "";
    public string CharacterName { get; set; } = "";
    public int AmountGold { get; set; }
    public long DueAtMs { get; set; }
    public string LastKnownIp { get; set; } = "";
    public bool Blocked { get; set; }
}

/// <summary>Deferred 5% commission debit applied when the seller has a live world context.</summary>
public sealed class PendingFeeCharge {
    public int AmountGold { get; set; }
    public string LastKnownIp { get; set; } = "";
}

sealed class AuctionBoardPersistFile {
    public List<AuctionListingRecord>? Listings { get; set; }
    public List<AuctionDebtRecord>? Debts { get; set; }
    public List<string>? BlockedIps { get; set; }
    public Dictionary<string, long>? PendingGoldCredits { get; set; }
    public Dictionary<string, PendingFeeCharge>? PendingFeeCharges { get; set; }
}
