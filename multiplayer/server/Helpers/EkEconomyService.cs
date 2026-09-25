using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Server.Helpers;

/// <summary>
/// Dual EK ledger (earned vs purchased), EK NFT bind/consume stubs, hero-set unbind fees, and raid-master spend.
/// Extends the gameplay EK counter in <see cref="PvpAcademy"/>: that counter is imported once into <c>earned</c>.
/// Nothing in this type opens a chain client or captures USD. <c>emitir=false</c> keeps every fee and mint/burn as an audit stub.
/// </summary>
public sealed class EkEconomyService {
    public const int LedgerVersion = 2;
    const int MaxIdLength = 128;
    const int MaxSetPieces = 32;

    static readonly JsonSerializerOptions JsonOpts = new() {
        PropertyNamingPolicy = null,
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    readonly object gate = new();
    readonly EkEconomyConfig config;
    readonly string? ledgerPath;
    readonly Dictionary<string, AccountState> accounts = new(StringComparer.Ordinal);
    readonly Dictionary<string, NftState> nfts = new(StringComparer.Ordinal);
    readonly Dictionary<string, PieceState> pieces = new(StringComparer.Ordinal);
    readonly Dictionary<string, ReceiptState> receipts = new(StringComparer.Ordinal);
    readonly List<AuditState> audit = new();
    long nextAuditId = 1;

    public EkEconomyService(EkEconomyConfig config, string? ledgerPath = null) {
        ArgumentNullException.ThrowIfNull(config);
        config.Validate();
        this.config = config;
        this.ledgerPath = string.IsNullOrWhiteSpace(ledgerPath) ? null : ledgerPath;
    }

    public EkEconomyConfig Config => config;

    /// <summary>Loads a ledger file (including a v1 single <c>balance</c>) or starts empty when the file is missing.</summary>
    public static EkEconomyService Load(string? ledgerPath, EkEconomyConfig config) {
        var service = new EkEconomyService(config, ledgerPath);
        if (service.ledgerPath is not null && File.Exists(service.ledgerPath)) {
            service.LoadFromDisk();
        }
        return service;
    }

    public long GetEarned(string playerId) {
        lock (gate) {
            return TryAccount(playerId, out var account) ? account.Earned : 0;
        }
    }

    public long GetPurchased(string playerId) {
        lock (gate) {
            return TryAccount(playerId, out var account) ? account.Purchased : 0;
        }
    }

    public long GetGold(string playerId) {
        lock (gate) {
            return TryAccount(playerId, out var account) ? account.Gold : 0;
        }
    }

    public long GetMaterial(string playerId, string materialId) {
        lock (gate) {
            if (!TryAccount(playerId, out var account)) {
                return 0;
            }
            var key = NormalizeId(materialId);
            return account.Materials.TryGetValue(key, out var qty) ? qty : 0;
        }
    }

    public bool IsPieceBound(string pieceUid) {
        lock (gate) {
            var id = NormalizeId(pieceUid);
            return pieces.TryGetValue(id, out var piece) && piece.Bound;
        }
    }

    public EkNftView? GetNft(string nftId) {
        lock (gate) {
            var id = NormalizeId(nftId);
            return nfts.TryGetValue(id, out var nft) ? ToView(nft) : null;
        }
    }

    /// <summary>Current earned balances, highest first. Purchased EKs are not a ranking score.</summary>
    public IReadOnlyList<EkRankingEntry> KillerRanking() {
        lock (gate) {
            return accounts.Values
                .Where(account => account.Earned > 0)
                .OrderByDescending(account => account.Earned)
                .ThenBy(account => account.PlayerId, StringComparer.Ordinal)
                .Select(account => new EkRankingEntry(account.PlayerId, account.Earned))
                .ToList();
        }
    }

    public IReadOnlyList<EkAuditEntry> AuditLog() {
        lock (gate) {
            return audit.Select(ToAudit).ToList();
        }
    }

    /// <summary>
    /// Copies a pre-split single balance into <c>earned</c>. A later import of the same lifetime does not add twice.
    /// Existing purchased EKs are left alone.
    /// </summary>
    public void ImportLegacyBalances(IReadOnlyDictionary<string, long> lifetimeEarnedByPlayer) {
        ArgumentNullException.ThrowIfNull(lifetimeEarnedByPlayer);
        lock (gate) {
            foreach (var pair in lifetimeEarnedByPlayer) {
                var playerId = NormalizeId(pair.Key);
                if (playerId.Length == 0 || pair.Value < 0) {
                    continue;
                }
                var account = GetOrCreate(playerId);
                if (!account.AcademySynced) {
                    account.Earned = checked(account.Earned + pair.Value);
                    account.GameplayCursor = pair.Value;
                    account.AcademySynced = true;
                    continue;
                }
                if (pair.Value > account.GameplayCursor) {
                    var gap = pair.Value - account.GameplayCursor;
                    account.Earned = checked(account.Earned + gap);
                    account.GameplayCursor = pair.Value;
                }
            }
            PersistUnlocked();
        }
    }

    /// <summary>Gameplay EK (open world or academy). Increases earned only. Idempotent on <paramref name="idempotencyKey"/>.</summary>
    public EkEconomyResult CreditGameplayEk(string playerId, long amount, string idempotencyKey) {
        return Mutate("credit_gameplay", playerId, idempotencyKey, () => {
            if (amount <= 0) {
                return Fail(EkEconomyCodes.InvalidAmount, "credit_gameplay", playerId, 0, 0);
            }
            var account = GetOrCreate(NormalizeId(playerId));
            var beforeEarned = account.Earned;
            var beforePurchased = account.Purchased;
            account.Earned = checked(account.Earned + amount);
            account.GameplayCursor = checked(account.GameplayCursor + amount);
            account.AcademySynced = true;
            return Success(
                "credit_gameplay",
                account,
                amount,
                fee: null,
                nftId: null,
                beforeEarned,
                beforePurchased,
                miningApplied: false,
                miningCredits: 0);
        });
    }

    /// <summary>Stores game gold on the ledger so raid master can debit it. Not a USD balance.</summary>
    public void SetGameGold(string playerId, long gold) {
        if (gold < 0) {
            throw new ArgumentOutOfRangeException(nameof(gold));
        }
        lock (gate) {
            if (!TryNormalizePlayer(playerId, out var id)) {
                throw new ArgumentException("Invalid player id.", nameof(playerId));
            }
            GetOrCreate(id).Gold = gold;
            PersistUnlocked();
        }
    }

    /// <summary>Stores a non-EK raid material (relics, stones, …). Not a USD balance.</summary>
    public void SetGameMaterial(string playerId, string materialId, long quantity) {
        if (quantity < 0) {
            throw new ArgumentOutOfRangeException(nameof(quantity));
        }
        lock (gate) {
            if (!TryNormalizePlayer(playerId, out var id) || !TryNormalizePlayer(materialId, out var material)) {
                throw new ArgumentException("Invalid id.");
            }
            GetOrCreate(id).Materials[material] = quantity;
            PersistUnlocked();
        }
    }

    /// <summary>Registers a persistent hero piece. Tournament loadout pieces cannot be unbound for sale.</summary>
    public void GrantHeroPiece(string playerId, string pieceUid, int itemId, bool tournamentLoadout = false) {
        lock (gate) {
            if (!TryNormalizePlayer(playerId, out var owner) || !TryNormalizePlayer(pieceUid, out var uid)) {
                throw new ArgumentException("Invalid id.");
            }
            pieces[uid] = new PieceState {
                PieceUid = uid,
                OwnerId = owner,
                ItemId = itemId,
                Bound = true,
                TournamentLoadout = tournamentLoadout,
            };
            PersistUnlocked();
        }
    }

    /// <summary>
    /// Binds <paramref name="amount"/> EKs into one local NFT stub and assesses a single flat fee.
    /// Amounts below <c>ek_nft_min_amount</c> are rejected. The craft source comes from config;
    /// unspecified source fail-closes without moving EKs.
    /// </summary>
    public EkEconomyResult CraftEkNft(string playerId, long amount, string idempotencyKey) {
        return Mutate("craft_ek_nft", playerId, idempotencyKey, () => {
            if (amount <= 0) {
                return Fail(EkEconomyCodes.InvalidAmount, "craft_ek_nft", playerId, amount, 0);
            }
            if (RefuseRealEmission(playerId, "craft_ek_nft", amount, out var refused)) {
                return refused;
            }
            if (amount < config.EkNftMinAmount) {
                return Fail(EkEconomyCodes.BelowMin, "craft_ek_nft", playerId, amount, 0);
            }
            var source = NormalizeCraftSource(config.EkNftCraftSource);
            if (source is null) {
                return Fail(EkEconomyCodes.CraftSourceUnspecified, "craft_ek_nft", playerId, amount, 0);
            }
            var account = GetOrCreate(NormalizeId(playerId));
            if (!TryPlanCraftDebit(account, amount, source, out var fromPurchased, out var fromEarned)) {
                return Fail(EkEconomyCodes.InsufficientEk, "craft_ek_nft", playerId, amount, 0);
            }
            var beforeEarned = account.Earned;
            var beforePurchased = account.Purchased;
            account.Earned -= fromEarned;
            account.Purchased -= fromPurchased;
            var nft = new NftState {
                Id = "eknft-" + Guid.NewGuid().ToString("N"),
                Amount = amount,
                CrafterId = account.PlayerId,
                HolderId = account.PlayerId,
                Burned = false,
                CraftKey = idempotencyKey.Trim(),
            };
            nfts[nft.Id] = nft;
            var fee = StubFee(EkEconomyConfig.EkNftBindFeeKey, config.Fees.EkNftBindUsd, 1);
            return Success(
                "craft_ek_nft",
                account,
                amount,
                fee,
                nft.Id,
                beforeEarned,
                beforePurchased,
                miningApplied: false,
                miningCredits: 0);
        });
    }

    /// <summary>
    /// Burns the NFT stub once and credits its EK amount to the consumer's purchased balance.
    /// Purchased EK does not mine, grant tokens, apply attributes, raise <see cref="EkAura"/>,
    /// call <see cref="HellMiningStore"/>, or change killer ranking. That is a hard rule, not config.
    /// </summary>
    public EkEconomyResult ConsumeEkNft(string playerId, string nftId, string idempotencyKey) {
        return Mutate("consume_ek_nft", playerId, idempotencyKey, () => {
            if (RefuseRealEmission(playerId, "consume_ek_nft", 0, out var refused)) {
                return refused;
            }
            var id = NormalizeId(nftId);
            if (!nfts.TryGetValue(id, out var nft)) {
                return Fail(EkEconomyCodes.NftNotFound, "consume_ek_nft", playerId, 0, 0);
            }
            if (nft.Burned) {
                return Fail(EkEconomyCodes.NftAlreadyBurned, "consume_ek_nft", playerId, nft.Amount, 0, nft.Id);
            }
            var account = GetOrCreate(NormalizeId(playerId));
            var beforeEarned = account.Earned;
            var beforePurchased = account.Purchased;
            account.Purchased = checked(account.Purchased + nft.Amount);
            nft.Burned = true;
            nft.HolderId = account.PlayerId;
            // Spend-only balance. Do not call HellMiningStore EK hooks or EkAura.NotifyEarned.
            return Success(
                "consume_ek_nft",
                account,
                nft.Amount,
                fee: null,
                nft.Id,
                beforeEarned,
                beforePurchased,
                miningApplied: false,
                miningCredits: 0);
        });
    }

    /// <summary>Unbinds one hero-set piece for sale and assesses one flat fee.</summary>
    public EkEconomyResult UnbindHeroPiece(string playerId, string pieceUid, string idempotencyKey) {
        return Mutate("unbind_hero_piece", playerId, idempotencyKey, () => {
            if (RefuseRealEmission(playerId, "unbind_hero_piece", 0, out var refused)) {
                return refused;
            }
            if (!TryTakePieces(playerId, [pieceUid], out var taken, out var error, out var nftHint)) {
                return Fail(error, "unbind_hero_piece", playerId, 0, 0, nftHint);
            }
            taken[0].Bound = false;
            var fee = StubFee(EkEconomyConfig.HeroSetPieceUnbindFeeKey, config.Fees.HeroSetPieceUnbindUsd, 1);
            var account = GetOrCreate(NormalizeId(playerId));
            return Success("unbind_hero_piece", account, 1, fee, null, account.Earned, account.Purchased, false, 0);
        });
    }

    /// <summary>Unbinds every listed piece or none of them. Fee count is N, the piece count, times the flat unit.</summary>
    public EkEconomyResult SellHeroSet(string playerId, IReadOnlyList<string> pieceUids, string idempotencyKey) {
        return Mutate("sell_hero_set", playerId, idempotencyKey, () => {
            if (RefuseRealEmission(playerId, "sell_hero_set", 0, out var refused)) {
                return refused;
            }
            if (!TryTakePieces(playerId, pieceUids, out var taken, out var error, out _)) {
                return Fail(error, "sell_hero_set", playerId, pieceUids?.Count ?? 0, 0);
            }
            foreach (var piece in taken) {
                piece.Bound = false;
            }
            var fee = StubFee(
                EkEconomyConfig.HeroSetPieceUnbindFeeKey,
                config.Fees.HeroSetPieceUnbindUsd,
                taken.Count);
            var account = GetOrCreate(NormalizeId(playerId));
            return Success("sell_hero_set", account, taken.Count, fee, null, account.Earned, account.Purchased, false, 0);
        });
    }

    /// <summary>
    /// Spends EK (both buckets, config order), gold, and other materials for a raid-master contribution.
    /// The whole debit commits or none of it does.
    /// Spending purchased EK does not call <see cref="HellMiningStore"/> or <see cref="EkAura"/>.
    /// </summary>
    public EkEconomyResult ContributeRaidMaster(
        string playerId,
        long ekCost,
        long goldCost,
        IReadOnlyDictionary<string, long>? otherCosts,
        string idempotencyKey) {
        return Mutate("raid_master", playerId, idempotencyKey, () => {
            if (ekCost < 0 || goldCost < 0) {
                return Fail(EkEconomyCodes.InvalidAmount, "raid_master", playerId, ekCost, 0);
            }
            if (RefuseRealEmission(playerId, "raid_master", ekCost, out var refused)) {
                return refused;
            }
            if (!EkEconomyConfig.TryNormalizeSpendOrder(config.RaidMasterSpendOrder, out var order, out _)) {
                return Fail(EkEconomyCodes.RaidOrderInvalid, "raid_master", playerId, ekCost, 0);
            }
            var account = GetOrCreate(NormalizeId(playerId));
            if (account.Earned + account.Purchased < ekCost) {
                return Fail(EkEconomyCodes.InsufficientEk, "raid_master", playerId, ekCost, 0);
            }
            if (account.Gold < goldCost) {
                return Fail(EkEconomyCodes.InsufficientGold, "raid_master", playerId, ekCost, 0);
            }
            var materialPlan = new List<(string Key, long Qty)>();
            if (otherCosts is not null) {
                foreach (var pair in otherCosts) {
                    if (pair.Value < 0) {
                        return Fail(EkEconomyCodes.InvalidAmount, "raid_master", playerId, ekCost, 0);
                    }
                    if (pair.Value == 0) {
                        continue;
                    }
                    var key = NormalizeId(pair.Key);
                    if (key.Length == 0) {
                        return Fail(EkEconomyCodes.InvalidAmount, "raid_master", playerId, ekCost, 0);
                    }
                    var have = account.Materials.TryGetValue(key, out var qty) ? qty : 0;
                    if (have < pair.Value) {
                        return Fail(EkEconomyCodes.InsufficientMaterial, "raid_master", playerId, ekCost, 0);
                    }
                    materialPlan.Add((key, pair.Value));
                }
            }
            var beforeEarned = account.Earned;
            var beforePurchased = account.Purchased;
            var remaining = ekCost;
            foreach (var bucket in order) {
                if (remaining == 0) {
                    break;
                }
                if (bucket == "purchased") {
                    var take = Math.Min(account.Purchased, remaining);
                    account.Purchased -= take;
                    remaining -= take;
                } else {
                    var take = Math.Min(account.Earned, remaining);
                    account.Earned -= take;
                    remaining -= take;
                }
            }
            if (remaining != 0) {
                account.Earned = beforeEarned;
                account.Purchased = beforePurchased;
                return Fail(EkEconomyCodes.InsufficientEk, "raid_master", playerId, ekCost, 0);
            }
            account.Gold -= goldCost;
            foreach (var (key, qty) in materialPlan) {
                account.Materials[key] = account.Materials[key] - qty;
            }
            return Success(
                "raid_master",
                account,
                ekCost,
                fee: null,
                nftId: null,
                beforeEarned,
                beforePurchased,
                miningApplied: false,
                miningCredits: 0);
        });
    }

    /// <summary>
    /// Explicit attempt to move USD or submit a mint/burn. Always refused.
    /// <c>emitir=false</c> blocks the attempt; <c>emitir=true</c> is also refused because this build has no rail.
    /// </summary>
    public EkEconomyResult TryInvokeRealRail(string playerId, string idempotencyKey) {
        return Mutate("real_rail", playerId, idempotencyKey, () => {
            var code = config.Emitir ? EkEconomyCodes.RealEmissionRefused : EkEconomyCodes.RealMovementBlocked;
            return Fail(code, "real_rail", playerId, 0, 0);
        });
    }

    EkEconomyResult Mutate(string op, string playerId, string idempotencyKey, Func<Mutation> apply) {
        lock (gate) {
            if (!TryNormalizePlayer(playerId, out var player)) {
                return ToResult(Fail(EkEconomyCodes.InvalidPlayer, op, playerId ?? "", 0, 0), replay: false);
            }
            if (!TryNormalizePlayer(idempotencyKey, out var key)) {
                return ToResult(Fail(EkEconomyCodes.InvalidKey, op, player, 0, 0), replay: false);
            }
            if (receipts.TryGetValue(key, out var existing)) {
                if (!string.Equals(existing.Op, op, StringComparison.Ordinal) ||
                    !string.Equals(existing.PlayerId, player, StringComparison.Ordinal)) {
                    return ToResult(Fail(EkEconomyCodes.IdempotencyConflict, op, player, 0, 0), replay: false);
                }
                return ToResult(existing, replay: true);
            }
            var backup = SnapshotUnlocked();
            try {
                var mutation = apply();
                mutation.PlayerId = player;
                mutation.IdempotencyKey = key;
                if (mutation.Op.Length == 0) {
                    mutation.Op = op;
                }
                AppendAudit(mutation);
                receipts[key] = ToReceipt(mutation);
                PersistUnlocked();
                return ToResult(mutation, replay: false);
            } catch (Exception ex) {
                RestoreUnlocked(backup);
                return new EkEconomyResult {
                    Ok = false,
                    Code = "persist_failed",
                    Op = op,
                    RealMoneyMoved = false,
                    ChainSubmitted = false,
                    ChainTxId = null,
                    Detail = ex.Message,
                };
            }
        }
    }

    bool RefuseRealEmission(string playerId, string op, long amount, out Mutation refused) {
        if (!config.Emitir) {
            refused = null!;
            return false;
        }
        refused = Fail(EkEconomyCodes.RealEmissionRefused, op, playerId, amount, 0);
        return true;
    }

    bool TryTakePieces(
        string playerId,
        IReadOnlyList<string>? pieceUids,
        out List<PieceState> taken,
        out string error,
        out string? hint) {
        taken = new List<PieceState>();
        hint = null;
        error = EkEconomyCodes.EmptySet;
        if (pieceUids is null || pieceUids.Count == 0) {
            return false;
        }
        if (pieceUids.Count > MaxSetPieces) {
            error = EkEconomyCodes.InvalidAmount;
            return false;
        }
        var owner = NormalizeId(playerId);
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var raw in pieceUids) {
            var uid = NormalizeId(raw);
            if (uid.Length == 0 || !seen.Add(uid)) {
                error = EkEconomyCodes.DuplicatePiece;
                return false;
            }
            if (!pieces.TryGetValue(uid, out var piece)) {
                error = EkEconomyCodes.PieceNotFound;
                return false;
            }
            if (!string.Equals(piece.OwnerId, owner, StringComparison.Ordinal)) {
                error = EkEconomyCodes.PieceNotOwned;
                return false;
            }
            if (piece.TournamentLoadout) {
                error = EkEconomyCodes.TournamentLoadout;
                return false;
            }
            if (!piece.Bound) {
                error = EkEconomyCodes.PieceAlreadyUnbound;
                return false;
            }
            if (!HeroFactionKit.IsHeroFactionItem(piece.ItemId)) {
                error = EkEconomyCodes.NotHeroPiece;
                return false;
            }
            taken.Add(piece);
        }
        error = "";
        return true;
    }

    static bool TryPlanCraftDebit(AccountState account, long amount, string source, out long fromPurchased, out long fromEarned) {
        fromPurchased = 0;
        fromEarned = 0;
        switch (source) {
            case EkEconomyConfig.CraftSourceEarned:
                if (account.Earned < amount) {
                    return false;
                }
                fromEarned = amount;
                return true;
            case EkEconomyConfig.CraftSourcePurchased:
                if (account.Purchased < amount) {
                    return false;
                }
                fromPurchased = amount;
                return true;
            case EkEconomyConfig.CraftSourcePurchasedThenEarned: {
                var takePurchased = Math.Min(account.Purchased, amount);
                var takeEarned = amount - takePurchased;
                if (account.Earned < takeEarned) {
                    return false;
                }
                fromPurchased = takePurchased;
                fromEarned = takeEarned;
                return true;
            }
            case EkEconomyConfig.CraftSourceEarnedThenPurchased: {
                var takeEarned = Math.Min(account.Earned, amount);
                var takePurchased = amount - takeEarned;
                if (account.Purchased < takePurchased) {
                    return false;
                }
                fromEarned = takeEarned;
                fromPurchased = takePurchased;
                return true;
            }
            default:
                return false;
        }
    }

    static string? NormalizeCraftSource(string? source) {
        var value = (source ?? "").Trim().ToLowerInvariant();
        return value switch {
            EkEconomyConfig.CraftSourceEarned => value,
            EkEconomyConfig.CraftSourcePurchased => value,
            EkEconomyConfig.CraftSourcePurchasedThenEarned => value,
            EkEconomyConfig.CraftSourceEarnedThenPurchased => value,
            _ => null,
        };
    }

    static FeeAssessment StubFee(string key, decimal unitUsd, int count) {
        var usd = unitUsd * count;
        return new FeeAssessment(key, usd, count);
    }

    Mutation Success(
        string op,
        AccountState account,
        long amount,
        FeeAssessment? fee,
        string? nftId,
        long earnedBefore,
        long purchasedBefore,
        bool miningApplied,
        int miningCredits) {
        return new Mutation {
            Ok = true,
            Code = EkEconomyCodes.Ok,
            Op = op,
            PlayerId = account.PlayerId,
            Amount = amount,
            Fee = fee,
            NftId = nftId,
            EarnedBefore = earnedBefore,
            EarnedAfter = account.Earned,
            PurchasedBefore = purchasedBefore,
            PurchasedAfter = account.Purchased,
            GoldAfter = account.Gold,
            MiningApplied = miningApplied,
            MiningCredits = miningCredits,
            RealMoneyMoved = false,
            ChainSubmitted = false,
            ChainTxId = null,
        };
    }

    Mutation Fail(string code, string op, string playerId, long amount, int feeCount, string? nftId = null) {
        TryAccount(playerId, out var account);
        return new Mutation {
            Ok = false,
            Code = code,
            Op = op,
            PlayerId = NormalizeId(playerId),
            Amount = amount,
            Fee = null,
            NftId = nftId,
            EarnedBefore = account?.Earned ?? 0,
            EarnedAfter = account?.Earned ?? 0,
            PurchasedBefore = account?.Purchased ?? 0,
            PurchasedAfter = account?.Purchased ?? 0,
            GoldAfter = account?.Gold ?? 0,
            MiningApplied = false,
            MiningCredits = 0,
            RealMoneyMoved = false,
            ChainSubmitted = false,
            ChainTxId = null,
            DetailCode = code,
        };
    }

    void AppendAudit(Mutation mutation) {
        if (mutation.RealMoneyMoved || mutation.ChainSubmitted || mutation.ChainTxId is not null) {
            throw new InvalidOperationException("Real money or chain movement is not implemented.");
        }
        if (mutation.Fee is { Collected: true }) {
            throw new InvalidOperationException("Fee collection is not implemented.");
        }
        audit.Add(new AuditState {
            Id = nextAuditId++,
            AtUtc = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture),
            Op = mutation.Op,
            PlayerId = mutation.PlayerId,
            IdempotencyKey = mutation.IdempotencyKey,
            Ok = mutation.Ok,
            Code = mutation.DetailCode ?? mutation.Code,
            Amount = mutation.Amount,
            FeeKey = mutation.Fee?.Key,
            FeeUsd = mutation.Fee?.Usd ?? 0,
            FeeCount = mutation.Fee?.Count ?? 0,
            FeeCollected = false,
            RealMoneyMoved = false,
            ChainSubmitted = false,
            ChainTxId = null,
            NftId = mutation.NftId,
            EarnedBefore = mutation.EarnedBefore,
            EarnedAfter = mutation.EarnedAfter,
            PurchasedBefore = mutation.PurchasedBefore,
            PurchasedAfter = mutation.PurchasedAfter,
            MiningApplied = mutation.MiningApplied,
            MiningCredits = mutation.MiningCredits,
        });
    }

    static EkEconomyResult ToResult(Mutation mutation, bool replay) => new() {
        Ok = mutation.Ok,
        Replay = replay,
        Code = mutation.DetailCode ?? mutation.Code,
        Op = mutation.Op,
        NftId = mutation.NftId,
        Fee = mutation.Fee,
        RealMoneyMoved = false,
        ChainSubmitted = false,
        ChainTxId = null,
        EarnedAfter = mutation.EarnedAfter,
        PurchasedAfter = mutation.PurchasedAfter,
        GoldAfter = mutation.GoldAfter,
        MiningApplied = mutation.MiningApplied,
        MiningCredits = mutation.MiningCredits,
        Detail = mutation.Note ?? mutation.DetailCode,
    };

    static EkEconomyResult ToResult(ReceiptState receipt, bool replay) => new() {
        Ok = receipt.Ok,
        Replay = replay,
        Code = receipt.Code,
        Op = receipt.Op,
        NftId = receipt.NftId,
        Fee = receipt.FeeCount > 0 && receipt.FeeKey is not null
            ? new FeeAssessment(receipt.FeeKey, receipt.FeeUsd, receipt.FeeCount)
            : null,
        RealMoneyMoved = false,
        ChainSubmitted = false,
        ChainTxId = null,
        EarnedAfter = receipt.EarnedAfter,
        PurchasedAfter = receipt.PurchasedAfter,
        GoldAfter = receipt.GoldAfter,
        MiningApplied = receipt.MiningApplied,
        MiningCredits = receipt.MiningCredits,
    };

    static ReceiptState ToReceipt(Mutation mutation) => new() {
        Op = mutation.Op,
        PlayerId = mutation.PlayerId,
        Ok = mutation.Ok,
        Code = mutation.DetailCode ?? mutation.Code,
        NftId = mutation.NftId,
        FeeKey = mutation.Fee?.Key,
        FeeUsd = mutation.Fee?.Usd ?? 0,
        FeeCount = mutation.Fee?.Count ?? 0,
        EarnedAfter = mutation.EarnedAfter,
        PurchasedAfter = mutation.PurchasedAfter,
        GoldAfter = mutation.GoldAfter,
        MiningApplied = mutation.MiningApplied,
        MiningCredits = mutation.MiningCredits,
    };

    bool TryAccount(string playerId, out AccountState account) {
        var id = NormalizeId(playerId);
        return accounts.TryGetValue(id, out account!);
    }

    AccountState GetOrCreate(string normalizedPlayerId) {
        if (!accounts.TryGetValue(normalizedPlayerId, out var account)) {
            account = new AccountState { PlayerId = normalizedPlayerId };
            accounts[normalizedPlayerId] = account;
        }
        return account;
    }

    static bool TryNormalizePlayer(string? value, out string normalized) {
        normalized = NormalizeId(value);
        return normalized.Length is > 0 and <= MaxIdLength;
    }

    static string NormalizeId(string? value) {
        var text = (value ?? "").Trim();
        if (text.Length == 0) {
            return "";
        }
        foreach (var ch in text) {
            if (char.IsControl(ch)) {
                return "";
            }
        }
        return text;
    }

    static EkNftView ToView(NftState nft) => new() {
        Id = nft.Id,
        Amount = nft.Amount,
        CrafterId = nft.CrafterId,
        HolderId = nft.HolderId,
        Burned = nft.Burned,
        ChainMint = null,
    };

    static EkAuditEntry ToAudit(AuditState row) => new() {
        Id = row.Id,
        AtUtc = row.AtUtc,
        Op = row.Op,
        PlayerId = row.PlayerId,
        IdempotencyKey = row.IdempotencyKey,
        Ok = row.Ok,
        Code = row.Code,
        Amount = row.Amount,
        FeeKey = row.FeeKey,
        FeeUsd = row.FeeUsd,
        FeeCount = row.FeeCount,
        FeeCollected = false,
        RealMoneyMoved = false,
        ChainSubmitted = false,
        ChainTxId = null,
        NftId = row.NftId,
        EarnedBefore = row.EarnedBefore,
        EarnedAfter = row.EarnedAfter,
        PurchasedBefore = row.PurchasedBefore,
        PurchasedAfter = row.PurchasedAfter,
        MiningApplied = row.MiningApplied,
        MiningCredits = row.MiningCredits,
    };

    string SnapshotUnlocked() => JsonSerializer.Serialize(CaptureUnlocked(), JsonOpts);

    void RestoreUnlocked(string json) {
        var state = JsonSerializer.Deserialize<LedgerState>(json, JsonOpts) ?? new LedgerState();
        ReplaceUnlocked(state);
    }

    LedgerState CaptureUnlocked() => new() {
        Version = LedgerVersion,
        NextAuditId = nextAuditId,
        Accounts = accounts.Values.Select(account => account.Copy()).ToList(),
        Nfts = nfts.Values.Select(nft => nft.Copy()).ToList(),
        Pieces = pieces.Values.Select(piece => piece.Copy()).ToList(),
        Receipts = receipts.Select(pair => {
            var copy = pair.Value.Copy();
            copy.Key = pair.Key;
            return copy;
        }).ToList(),
        Audit = audit.Select(row => row.Copy()).ToList(),
    };

    void ReplaceUnlocked(LedgerState state) {
        accounts.Clear();
        nfts.Clear();
        pieces.Clear();
        receipts.Clear();
        audit.Clear();
        nextAuditId = state.NextAuditId <= 0 ? 1 : state.NextAuditId;
        foreach (var account in state.Accounts ?? []) {
            if (string.IsNullOrWhiteSpace(account.PlayerId)) {
                continue;
            }
            account.Materials ??= new Dictionary<string, long>(StringComparer.Ordinal);
            accounts[account.PlayerId] = account;
        }
        foreach (var nft in state.Nfts ?? []) {
            if (!string.IsNullOrWhiteSpace(nft.Id)) {
                nfts[nft.Id] = nft;
            }
        }
        foreach (var piece in state.Pieces ?? []) {
            if (!string.IsNullOrWhiteSpace(piece.PieceUid)) {
                pieces[piece.PieceUid] = piece;
            }
        }
        foreach (var receipt in state.Receipts ?? []) {
            if (!string.IsNullOrWhiteSpace(receipt.Key)) {
                receipts[receipt.Key] = receipt;
            }
        }
        if (state.Audit is not null) {
            audit.AddRange(state.Audit);
        }
    }

    void LoadFromDisk() {
        var json = File.ReadAllText(ledgerPath!);
        ReplaceUnlocked(Migrate(json));
    }

    static LedgerState Migrate(string json) {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var state = new LedgerState { Version = LedgerVersion, NextAuditId = 1 };
        if (root.TryGetProperty("nextAuditId", out var next) && next.TryGetInt64(out var nextId) && nextId > 0) {
            state.NextAuditId = nextId;
        }
        if (root.TryGetProperty("accounts", out var accountsNode)) {
            if (accountsNode.ValueKind == JsonValueKind.Object) {
                foreach (var property in accountsNode.EnumerateObject()) {
                    state.Accounts.Add(ReadAccount(property.Name, property.Value));
                }
            } else if (accountsNode.ValueKind == JsonValueKind.Array) {
                foreach (var element in accountsNode.EnumerateArray()) {
                    var id = ReadString(element, "playerId");
                    if (id.Length > 0) {
                        state.Accounts.Add(ReadAccount(id, element));
                    }
                }
            }
        }
        AddRange(state.Nfts, root, "nfts", element => new NftState {
            Id = ReadString(element, "id"),
            Amount = ReadLong(element, "amount"),
            CrafterId = ReadString(element, "crafterId"),
            HolderId = ReadNullableString(element, "holderId"),
            Burned = ReadBool(element, "burned"),
            CraftKey = ReadString(element, "craftKey"),
        });
        AddRange(state.Pieces, root, "pieces", element => new PieceState {
            PieceUid = ReadString(element, "pieceUid"),
            OwnerId = ReadString(element, "ownerId"),
            ItemId = (int)ReadLong(element, "itemId"),
            Bound = !element.TryGetProperty("bound", out _) || ReadBool(element, "bound"),
            TournamentLoadout = ReadBool(element, "tournamentLoadout"),
        });
        AddRange(state.Receipts, root, "receipts", element => new ReceiptState {
            Key = ReadString(element, "key"),
            Op = ReadString(element, "op"),
            PlayerId = ReadString(element, "playerId"),
            Ok = ReadBool(element, "ok"),
            Code = ReadString(element, "code"),
            NftId = ReadNullableString(element, "nftId"),
            FeeKey = ReadNullableString(element, "feeKey"),
            FeeUsd = ReadDecimal(element, "feeUsd"),
            FeeCount = (int)ReadLong(element, "feeCount"),
            EarnedAfter = ReadLong(element, "earnedAfter"),
            PurchasedAfter = ReadLong(element, "purchasedAfter"),
            GoldAfter = ReadLong(element, "goldAfter"),
            MiningApplied = ReadBool(element, "miningApplied"),
            MiningCredits = (int)ReadLong(element, "miningCredits"),
        });
        AddRange(state.Audit, root, "audit", element => new AuditState {
            Id = ReadLong(element, "id"),
            AtUtc = ReadString(element, "atUtc"),
            Op = ReadString(element, "op"),
            PlayerId = ReadString(element, "playerId"),
            IdempotencyKey = ReadString(element, "idempotencyKey"),
            Ok = ReadBool(element, "ok"),
            Code = ReadString(element, "code"),
            Amount = ReadLong(element, "amount"),
            FeeKey = ReadNullableString(element, "feeKey"),
            FeeUsd = ReadDecimal(element, "feeUsd"),
            FeeCount = (int)ReadLong(element, "feeCount"),
            FeeCollected = false,
            RealMoneyMoved = false,
            ChainSubmitted = false,
            NftId = ReadNullableString(element, "nftId"),
            EarnedBefore = ReadLong(element, "earnedBefore"),
            EarnedAfter = ReadLong(element, "earnedAfter"),
            PurchasedBefore = ReadLong(element, "purchasedBefore"),
            PurchasedAfter = ReadLong(element, "purchasedAfter"),
            MiningApplied = ReadBool(element, "miningApplied"),
            MiningCredits = (int)ReadLong(element, "miningCredits"),
        });
        return state;
    }

    static AccountState ReadAccount(string playerId, JsonElement element) {
        var hasEarned = TryReadLong(element, "earned", out var earned);
        var legacy = FirstLegacyBalance(element);
        var purchased = TryReadLong(element, "purchased", out var purchasedValue) ? purchasedValue : 0;
        var account = new AccountState {
            PlayerId = playerId,
            Purchased = purchased,
            Gold = TryReadLong(element, "gold", out var gold) ? gold : 0,
            GameplayCursor = TryReadLong(element, "gameplayCursor", out var cursor) ? cursor : 0,
            AcademySynced = ReadBool(element, "academySynced"),
        };
        if (hasEarned) {
            account.Earned = earned;
        } else if (legacy.HasValue) {
            account.Earned = legacy.Value;
            account.Purchased = 0;
            account.GameplayCursor = legacy.Value;
            account.AcademySynced = true;
        }
        if (element.TryGetProperty("materials", out var materials) && materials.ValueKind == JsonValueKind.Object) {
            foreach (var property in materials.EnumerateObject()) {
                if (property.Value.TryGetInt64(out var qty)) {
                    account.Materials[property.Name] = qty;
                }
            }
        }
        return account;
    }

    static long? FirstLegacyBalance(JsonElement element) {
        foreach (var name in new[] { "balance", "ek", "ekCount" }) {
            if (TryReadLong(element, name, out var value)) {
                return value;
            }
        }
        return null;
    }

    static void AddRange<T>(List<T> target, JsonElement root, string name, Func<JsonElement, T> map) {
        if (!root.TryGetProperty(name, out var node) || node.ValueKind != JsonValueKind.Array) {
            return;
        }
        foreach (var element in node.EnumerateArray()) {
            target.Add(map(element));
        }
    }

    static string ReadString(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? ""
            : "";

    static string? ReadNullableString(JsonElement element, string name) {
        if (!element.TryGetProperty(name, out var value) || value.ValueKind == JsonValueKind.Null) {
            return null;
        }
        return value.ValueKind == JsonValueKind.String ? value.GetString() : null;
    }

    static bool ReadBool(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) &&
        value.ValueKind is JsonValueKind.True or JsonValueKind.False &&
        value.GetBoolean();

    static long ReadLong(JsonElement element, string name) =>
        TryReadLong(element, name, out var value) ? value : 0;

    static bool TryReadLong(JsonElement element, string name, out long value) {
        value = 0;
        if (!element.TryGetProperty(name, out var node)) {
            return false;
        }
        if (node.ValueKind == JsonValueKind.Number && node.TryGetInt64(out value)) {
            return true;
        }
        return node.ValueKind == JsonValueKind.String &&
               long.TryParse(node.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out value);
    }

    static decimal ReadDecimal(JsonElement element, string name) {
        if (!element.TryGetProperty(name, out var node)) {
            return 0;
        }
        if (node.ValueKind == JsonValueKind.Number && node.TryGetDecimal(out var value)) {
            return value;
        }
        return 0;
    }

    void PersistUnlocked() {
        if (ledgerPath is null) {
            return;
        }
        var directory = Path.GetDirectoryName(ledgerPath);
        if (!string.IsNullOrEmpty(directory)) {
            Directory.CreateDirectory(directory);
        }
        var json = JsonSerializer.Serialize(CaptureUnlocked(), JsonOpts);
        var temp = ledgerPath + ".tmp";
        File.WriteAllText(temp, json);
        File.Move(temp, ledgerPath, overwrite: true);
    }

    sealed class Mutation {
        public bool Ok { get; set; }
        public string Code { get; set; } = "";
        public string? DetailCode { get; set; }
        public string Op { get; set; } = "";
        public string PlayerId { get; set; } = "";
        public string IdempotencyKey { get; set; } = "";
        public long Amount { get; set; }
        public FeeAssessment? Fee { get; set; }
        public string? NftId { get; set; }
        public long EarnedBefore { get; set; }
        public long EarnedAfter { get; set; }
        public long PurchasedBefore { get; set; }
        public long PurchasedAfter { get; set; }
        public long GoldAfter { get; set; }
        public bool MiningApplied { get; set; }
        public int MiningCredits { get; set; }
        public string? Note { get; set; }
        public bool RealMoneyMoved { get; set; }
        public bool ChainSubmitted { get; set; }
        public string? ChainTxId { get; set; }
    }

    sealed class LedgerState {
        [JsonPropertyName("version")]
        public int Version { get; set; } = LedgerVersion;

        [JsonPropertyName("nextAuditId")]
        public long NextAuditId { get; set; } = 1;

        [JsonPropertyName("accounts")]
        public List<AccountState> Accounts { get; set; } = new();

        [JsonPropertyName("nfts")]
        public List<NftState> Nfts { get; set; } = new();

        [JsonPropertyName("pieces")]
        public List<PieceState> Pieces { get; set; } = new();

        [JsonPropertyName("receipts")]
        public List<ReceiptState> Receipts { get; set; } = new();

        [JsonPropertyName("audit")]
        public List<AuditState> Audit { get; set; } = new();
    }

    sealed class AccountState {
        [JsonPropertyName("playerId")]
        public string PlayerId { get; set; } = "";

        [JsonPropertyName("earned")]
        public long Earned { get; set; }

        [JsonPropertyName("purchased")]
        public long Purchased { get; set; }

        [JsonPropertyName("gold")]
        public long Gold { get; set; }

        [JsonPropertyName("gameplayCursor")]
        public long GameplayCursor { get; set; }

        [JsonPropertyName("academySynced")]
        public bool AcademySynced { get; set; }

        [JsonPropertyName("materials")]
        public Dictionary<string, long> Materials { get; set; } = new(StringComparer.Ordinal);

        public AccountState Copy() => new() {
            PlayerId = PlayerId,
            Earned = Earned,
            Purchased = Purchased,
            Gold = Gold,
            GameplayCursor = GameplayCursor,
            AcademySynced = AcademySynced,
            Materials = new Dictionary<string, long>(Materials, StringComparer.Ordinal),
        };
    }

    sealed class NftState {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("amount")]
        public long Amount { get; set; }

        [JsonPropertyName("crafterId")]
        public string CrafterId { get; set; } = "";

        [JsonPropertyName("holderId")]
        public string? HolderId { get; set; }

        [JsonPropertyName("burned")]
        public bool Burned { get; set; }

        [JsonPropertyName("craftKey")]
        public string CraftKey { get; set; } = "";

        public NftState Copy() => new() {
            Id = Id,
            Amount = Amount,
            CrafterId = CrafterId,
            HolderId = HolderId,
            Burned = Burned,
            CraftKey = CraftKey,
        };
    }

    sealed class PieceState {
        [JsonPropertyName("pieceUid")]
        public string PieceUid { get; set; } = "";

        [JsonPropertyName("ownerId")]
        public string OwnerId { get; set; } = "";

        [JsonPropertyName("itemId")]
        public int ItemId { get; set; }

        [JsonPropertyName("bound")]
        public bool Bound { get; set; } = true;

        [JsonPropertyName("tournamentLoadout")]
        public bool TournamentLoadout { get; set; }

        public PieceState Copy() => new() {
            PieceUid = PieceUid,
            OwnerId = OwnerId,
            ItemId = ItemId,
            Bound = Bound,
            TournamentLoadout = TournamentLoadout,
        };
    }

    sealed class ReceiptState {
        [JsonPropertyName("key")]
        public string Key { get; set; } = "";

        [JsonPropertyName("op")]
        public string Op { get; set; } = "";

        [JsonPropertyName("playerId")]
        public string PlayerId { get; set; } = "";

        [JsonPropertyName("ok")]
        public bool Ok { get; set; }

        [JsonPropertyName("code")]
        public string Code { get; set; } = "";

        [JsonPropertyName("nftId")]
        public string? NftId { get; set; }

        [JsonPropertyName("feeKey")]
        public string? FeeKey { get; set; }

        [JsonPropertyName("feeUsd")]
        public decimal FeeUsd { get; set; }

        [JsonPropertyName("feeCount")]
        public int FeeCount { get; set; }

        [JsonPropertyName("earnedAfter")]
        public long EarnedAfter { get; set; }

        [JsonPropertyName("purchasedAfter")]
        public long PurchasedAfter { get; set; }

        [JsonPropertyName("goldAfter")]
        public long GoldAfter { get; set; }

        [JsonPropertyName("miningApplied")]
        public bool MiningApplied { get; set; }

        [JsonPropertyName("miningCredits")]
        public int MiningCredits { get; set; }

        public ReceiptState Copy() => new() {
            Key = Key,
            Op = Op,
            PlayerId = PlayerId,
            Ok = Ok,
            Code = Code,
            NftId = NftId,
            FeeKey = FeeKey,
            FeeUsd = FeeUsd,
            FeeCount = FeeCount,
            EarnedAfter = EarnedAfter,
            PurchasedAfter = PurchasedAfter,
            GoldAfter = GoldAfter,
            MiningApplied = MiningApplied,
            MiningCredits = MiningCredits,
        };
    }

    sealed class AuditState {
        [JsonPropertyName("id")]
        public long Id { get; set; }

        [JsonPropertyName("atUtc")]
        public string AtUtc { get; set; } = "";

        [JsonPropertyName("op")]
        public string Op { get; set; } = "";

        [JsonPropertyName("playerId")]
        public string PlayerId { get; set; } = "";

        [JsonPropertyName("idempotencyKey")]
        public string IdempotencyKey { get; set; } = "";

        [JsonPropertyName("ok")]
        public bool Ok { get; set; }

        [JsonPropertyName("code")]
        public string Code { get; set; } = "";

        [JsonPropertyName("amount")]
        public long Amount { get; set; }

        [JsonPropertyName("feeKey")]
        public string? FeeKey { get; set; }

        [JsonPropertyName("feeUsd")]
        public decimal FeeUsd { get; set; }

        [JsonPropertyName("feeCount")]
        public int FeeCount { get; set; }

        [JsonPropertyName("feeCollected")]
        public bool FeeCollected { get; set; }

        [JsonPropertyName("realMoneyMoved")]
        public bool RealMoneyMoved { get; set; }

        [JsonPropertyName("chainSubmitted")]
        public bool ChainSubmitted { get; set; }

        [JsonPropertyName("chainTxId")]
        public string? ChainTxId { get; set; }

        [JsonPropertyName("nftId")]
        public string? NftId { get; set; }

        [JsonPropertyName("earnedBefore")]
        public long EarnedBefore { get; set; }

        [JsonPropertyName("earnedAfter")]
        public long EarnedAfter { get; set; }

        [JsonPropertyName("purchasedBefore")]
        public long PurchasedBefore { get; set; }

        [JsonPropertyName("purchasedAfter")]
        public long PurchasedAfter { get; set; }

        [JsonPropertyName("miningApplied")]
        public bool MiningApplied { get; set; }

        [JsonPropertyName("miningCredits")]
        public int MiningCredits { get; set; }

        public AuditState Copy() => new() {
            Id = Id,
            AtUtc = AtUtc,
            Op = Op,
            PlayerId = PlayerId,
            IdempotencyKey = IdempotencyKey,
            Ok = Ok,
            Code = Code,
            Amount = Amount,
            FeeKey = FeeKey,
            FeeUsd = FeeUsd,
            FeeCount = FeeCount,
            FeeCollected = false,
            RealMoneyMoved = false,
            ChainSubmitted = false,
            ChainTxId = null,
            NftId = NftId,
            EarnedBefore = EarnedBefore,
            EarnedAfter = EarnedAfter,
            PurchasedBefore = PurchasedBefore,
            PurchasedAfter = PurchasedAfter,
            MiningApplied = MiningApplied,
            MiningCredits = MiningCredits,
        };
    }
}
