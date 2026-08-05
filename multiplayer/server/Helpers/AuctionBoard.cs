using System;
using System.Collections.Generic;
using System.Linq;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Trade / auction board MVP: timed bids + limit sells, seller access rules, 5% commission debt.
/// Gold settlement is server-authoritative bag gold (item 90) — on-chain $HELL not wired (C6 preference).
/// </summary>
public static class AuctionBoard {
    const int MinDurationHours = 1;
    const int MaxDurationHours = 168;
    const int DefaultLimitShelfHours = 72;
    const int MaxBlockedEntries = 16;

    /// <summary>World tick: expire / settle / return escrow when parties are in this world.</summary>
    public static void TickWorld(GameWorldRef wr) {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        AuctionBoardStore.Tick(nowMs);

        foreach (var work in AuctionBoardStore.GetListingsNeedingWork()) {
            if (work.PendingSettle) {
                TrySettleTimedAuction(wr, work.ListingId, nowMs);
            }
        }

        foreach (var player in wr.World.EnumerateConnectedPlayers()) {
            ApplyPendingCreditsAndFees(wr, player);
            TryReturnSellerEscrowInWorld(wr, player);
        }

        // Mobile market side door: sync listings + auto-deliver paid desk claims.
        MarketSideDoor.Tick(wr);
    }

    public static void HandleBrowseRequest(GameWorldRef wr, GameWorldPlayer player, AuctionBoardBrowseRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);
        if (!IsRequestForCurrentWorld(wr, request.GameWorldId)) {
            return;
        }

        ApplyPendingCreditsAndFees(wr, player);
        TryReturnSellerEscrowInWorld(wr, player);
        SendSnapshot(player, "Auction board loaded.");
    }

    public static void HandleCreateRequest(GameWorldRef wr, GameWorldPlayer player, AuctionBoardCreateRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);
        if (!IsRequestForCurrentWorld(wr, request.GameWorldId)) {
            return;
        }

        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (!TryEnsureCanTrade(player, nowMs, out var blockReason)) {
            SendActionResult(player, ok: false, blockReason);
            return;
        }

        var mode = request.Mode switch {
            AuctionListingMode.Time => AuctionListingModeKind.Time,
            AuctionListingMode.Limit => AuctionListingModeKind.Limit,
            _ => (AuctionListingModeKind)0,
        };
        if (mode is not (AuctionListingModeKind.Time or AuctionListingModeKind.Limit)) {
            SendActionResult(player, ok: false, "Choose time auction or limit sell.");
            return;
        }

        if (mode == AuctionListingModeKind.Limit && request.ListPriceGold < 1) {
            SendActionResult(player, ok: false, "Limit sell needs a list price (gold).");
            return;
        }

        if (mode == AuctionListingModeKind.Time && request.MinBidGold < 1 && request.ListPriceGold < 1) {
            SendActionResult(player, ok: false, "Timed auction needs a minimum bid.");
            return;
        }

        var access = request.Access ?? new AuctionAccessRules();
        if (access.OnlyOwnGuild && string.IsNullOrWhiteSpace(player.GuildId)) {
            SendActionResult(player, ok: false, "Guild required for 'only own guild' (Fase H stub — set guild id first).");
            return;
        }

        // Peek first: soul/guild-bound must not leave the player economy via auction.
        InventoryItemState? listedPeek = null;
        foreach (var bag in player.InventoryManager.BagItems) {
            if (bag.ItemUid == request.ItemUid) {
                listedPeek = bag;
                break;
            }
        }
        if (listedPeek is null) {
            SendActionResult(player, ok: false, "That item is not in your bag.");
            return;
        }
        if (ItemBind.IsTransferBlocked(listedPeek)) {
            SendActionResult(player, ok: false, "Soulbound / guild-bound items cannot be auctioned. Unbind first (GM/captain for guild).");
            return;
        }

        if (!player.InventoryManager.TryExtractBagItemForWarehouse(request.ItemUid, out var extracted, out var bagResult) ||
            extracted is null) {
            SendActionResult(player, ok: false, "That item is not in your bag.");
            return;
        }

        if (extracted.ItemId == GroundItemPickup.GoldItemId) {
            if (player.InventoryManager.TryInsertWarehouseItemIntoBag(extracted, out var rollbackGold)) {
                Inventory.ApplyInventoryMutation(wr, player, rollbackGold);
            }
            SendActionResult(player, ok: false, "Cannot list gold stacks on the auction board.");
            return;
        }

        Inventory.ApplyInventoryMutation(wr, player, bagResult);

        var durationHours = mode == AuctionListingModeKind.Time
            ? Math.Clamp(request.DurationHours <= 0 ? 24 : request.DurationHours, MinDurationHours, MaxDurationHours)
            : DefaultLimitShelfHours;
        var minBid = mode == AuctionListingModeKind.Time
            ? Math.Max(1, request.MinBidGold > 0 ? request.MinBidGold : request.ListPriceGold)
            : 0;
        var listPrice = Math.Max(0, request.ListPriceGold);
        var itemName = wr.ItemsById.TryGetValue(extracted.ItemId, out var def) ? def.Name : $"Item {extracted.ItemId}";

        var listing = new AuctionListingRecord {
            ListingId = Guid.NewGuid().ToString("N"),
            SellerWallet = player.AccountWallet,
            SellerName = player.CharacterName,
            SellerCity = ResolveCity(wr, player),
            SellerGuildId = player.GuildId ?? string.Empty,
            Mode = mode,
            ItemId = extracted.ItemId,
            ItemUid = extracted.ItemUid,
            Quantity = extracted.Quantity,
            ItemAttribute = extracted.ItemAttribute,
            ItemColor = extracted.ItemColor,
            CurLifeSpan = extracted.CurLifeSpan,
            MaxLifeSpan = extracted.MaxLifeSpan,
            ListPriceGold = listPrice,
            MinBidGold = minBid,
            CreatedAtMs = nowMs,
            ExpiresAtMs = nowMs + durationHours * 3_600_000L,
            Status = "active",
            ItemName = itemName,
            OnlyOwnCity = access.OnlyOwnCity,
            OnlyOwnGuild = access.OnlyOwnGuild,
            RequireFullLevelAndRep100 = access.RequireFullLevelAndRep100,
            BlockedGuildIds = SanitizeNameList(access.BlockedGuildIds),
            BlockedPlayerNames = SanitizeNameList(access.BlockedPlayerNames),
            EscrowItem = ToEscrow(extracted),
        };

        var created = AuctionBoardStore.AddListing(listing);
        SendActionResult(player, ok: true, $"Listed {extracted.Quantity}× {itemName}.", created);
        SendSnapshot(player, "Listing created.");
    }

    public static void HandleBidRequest(GameWorldRef wr, GameWorldPlayer player, AuctionBoardBidRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);
        if (!IsRequestForCurrentWorld(wr, request.GameWorldId)) {
            return;
        }

        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (!TryEnsureCanTrade(player, nowMs, out var blockReason)) {
            SendActionResult(player, ok: false, blockReason);
            return;
        }

        if (!AuctionBoardStore.TryGetListing(request.ListingId, out var listing) || listing is null) {
            SendActionResult(player, ok: false, "Listing not found.");
            return;
        }

        if (!string.Equals(listing.Status, "active", StringComparison.OrdinalIgnoreCase) ||
            listing.Mode != AuctionListingModeKind.Time) {
            SendActionResult(player, ok: false, "That listing is not open for bids.");
            return;
        }

        if (nowMs >= listing.ExpiresAtMs) {
            SendActionResult(player, ok: false, "Auction already expired.");
            return;
        }

        if (IsSameSeller(listing, player)) {
            SendActionResult(player, ok: false, "You cannot bid on your own listing.");
            return;
        }

        if (!TryValidateBuyerAccess(listing, wr, player, out var accessError)) {
            SendActionResult(player, ok: false, accessError);
            return;
        }

        var bid = request.BidGold;
        var minRequired = listing.CurrentBidGold > 0
            ? listing.CurrentBidGold + 1
            : Math.Max(1, listing.MinBidGold);
        if (bid < minRequired) {
            SendActionResult(player, ok: false, $"Bid at least {minRequired} gold.");
            return;
        }

        if (!player.InventoryManager.TrySpendGold(bid, out var spendResult)) {
            SendActionResult(player, ok: false, "Not enough gold for that bid.");
            return;
        }
        Inventory.ApplyInventoryMutation(wr, player, spendResult);

        var previousWallet = listing.CurrentBidderWallet;
        var previousName = listing.CurrentBidderName;
        var previousBid = listing.CurrentBidGold;

        var updated = AuctionBoardStore.TryUpdateListing(request.ListingId, live => {
            if (!string.Equals(live.Status, "active", StringComparison.OrdinalIgnoreCase) ||
                live.CurrentBidGold != listing.CurrentBidGold) {
                return false;
            }
            live.CurrentBidGold = bid;
            live.CurrentBidderWallet = player.AccountWallet;
            live.CurrentBidderName = player.CharacterName;
            return true;
        });

        if (!updated) {
            if (player.InventoryManager.TryCreateItemStack(GroundItemPickup.GoldItemId, bid, out var refund)) {
                Inventory.ApplyInventoryMutation(wr, player, refund);
            }
            SendActionResult(player, ok: false, "Bid race lost — try again.");
            return;
        }

        if (previousBid > 0 && !string.IsNullOrWhiteSpace(previousWallet)) {
            CreditGold(wr, previousWallet, previousName, previousBid);
        }

        AuctionBoardStore.TryGetListing(request.ListingId, out var fresh);
        SendActionResult(player, ok: true, $"Bid placed: {bid} gold.", fresh);
        SendSnapshot(player, "Bid accepted.");
    }

    public static void HandleBuyRequest(GameWorldRef wr, GameWorldPlayer player, AuctionBoardBuyRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);
        if (!IsRequestForCurrentWorld(wr, request.GameWorldId)) {
            return;
        }

        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (!TryEnsureCanTrade(player, nowMs, out var blockReason)) {
            SendActionResult(player, ok: false, blockReason);
            return;
        }

        if (!AuctionBoardStore.TryGetListing(request.ListingId, out var listing) || listing is null) {
            SendActionResult(player, ok: false, "Listing not found.");
            return;
        }

        if (!string.Equals(listing.Status, "active", StringComparison.OrdinalIgnoreCase) ||
            listing.Mode != AuctionListingModeKind.Limit) {
            SendActionResult(player, ok: false, "That listing is not a limit sell.");
            return;
        }

        if (nowMs >= listing.ExpiresAtMs) {
            SendActionResult(player, ok: false, "Listing expired.");
            return;
        }

        if (IsSameSeller(listing, player)) {
            SendActionResult(player, ok: false, "You cannot buy your own listing.");
            return;
        }

        if (!TryValidateBuyerAccess(listing, wr, player, out var accessError)) {
            SendActionResult(player, ok: false, accessError);
            return;
        }

        var price = Math.Max(1, listing.ListPriceGold);
        if (!player.InventoryManager.TrySpendGold(price, out var spendResult)) {
            SendActionResult(player, ok: false, $"Need {price} gold.");
            return;
        }
        Inventory.ApplyInventoryMutation(wr, player, spendResult);

        if (!TryDeliverEscrowToBuyer(wr, player, listing, out var deliverError)) {
            if (player.InventoryManager.TryCreateItemStack(GroundItemPickup.GoldItemId, price, out var refund)) {
                Inventory.ApplyInventoryMutation(wr, player, refund);
            }
            SendActionResult(player, ok: false, deliverError);
            return;
        }

        AuctionBoardStore.TryUpdateListing(request.ListingId, live => {
            live.Status = "sold";
            live.EscrowItem = null;
            live.PendingSettle = false;
            live.PendingReturnEscrow = false;
            return true;
        });

        SettleSaleProceeds(wr, listing.SellerWallet, listing.SellerName, price, player.LastKnownIp);
        SendActionResult(player, ok: true, $"Purchased {listing.ItemName} for {price} gold.");
        SendSnapshot(player, "Purchase complete.");
    }

    public static void HandleCancelRequest(GameWorldRef wr, GameWorldPlayer player, AuctionBoardCancelRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);
        if (!IsRequestForCurrentWorld(wr, request.GameWorldId)) {
            return;
        }

        if (!AuctionBoardStore.TryGetListing(request.ListingId, out var listing) || listing is null) {
            SendActionResult(player, ok: false, "Listing not found.");
            return;
        }

        if (!IsSameSeller(listing, player)) {
            SendActionResult(player, ok: false, "Only the seller can cancel.");
            return;
        }

        if (!string.Equals(listing.Status, "active", StringComparison.OrdinalIgnoreCase)) {
            SendActionResult(player, ok: false, "Listing is not active.");
            return;
        }

        if (listing.Mode == AuctionListingModeKind.Time && listing.CurrentBidGold > 0) {
            SendActionResult(player, ok: false, "Cannot cancel a timed auction after bids.");
            return;
        }

        if (!TryReturnEscrowToPlayer(wr, player, listing, out var returnError)) {
            SendActionResult(player, ok: false, returnError);
            return;
        }

        AuctionBoardStore.TryUpdateListing(request.ListingId, live => {
            live.Status = "cancelled";
            live.EscrowItem = null;
            live.PendingReturnEscrow = false;
            return true;
        });

        SendActionResult(player, ok: true, "Listing cancelled — item returned.");
        SendSnapshot(player, "Listing cancelled.");
    }

    public static void HandleSettleDebtRequest(GameWorldRef wr, GameWorldPlayer player, AuctionBoardSettleDebtRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);
        if (!IsRequestForCurrentWorld(wr, request.GameWorldId)) {
            return;
        }

        ApplyPendingCreditsAndFees(wr, player);

        var debt = AuctionBoardStore.GetDebt(player.AccountWallet, player.CharacterName);
        if (debt is null || debt.AmountGold <= 0) {
            SendActionResult(player, ok: true, "No auction fee debt.");
            SendSnapshot(player, "No debt.");
            return;
        }

        if (!player.InventoryManager.TrySpendGold(debt.AmountGold, out var spendResult)) {
            SendActionResult(player, ok: false, $"Need {debt.AmountGold} gold to settle fee debt.");
            return;
        }
        Inventory.ApplyInventoryMutation(wr, player, spendResult);
        AuctionBoardStore.ClearDebt(player.AccountWallet, player.CharacterName);
        SendActionResult(player, ok: true, $"Settled {debt.AmountGold} gold fee debt.");
        SendSnapshot(player, "Debt settled.");
    }

    static void TrySettleTimedAuction(GameWorldRef wr, string listingId, long nowMs) {
        if (!AuctionBoardStore.TryGetListing(listingId, out var listing) || listing is null || listing.EscrowItem is null) {
            return;
        }

        var bid = listing.CurrentBidGold;
        var buyerWallet = listing.CurrentBidderWallet;
        var buyerName = listing.CurrentBidderName;
        if (bid <= 0 || string.IsNullOrWhiteSpace(buyerWallet)) {
            AuctionBoardStore.TryUpdateListing(listingId, live => {
                live.Status = "expired";
                live.PendingSettle = false;
                live.PendingReturnEscrow = live.EscrowItem is not null;
                return true;
            });
            return;
        }

        if (!OnlinePlayerDirectory.TryGet(buyerWallet, buyerName, out var buyer) || buyer is null) {
            return;
        }

        // Buyer must be in this ticking world so inventory sync uses the correct GameWorldRef.
        if (!wr.World.TryGetPlayerBySessionId(buyer.SessionId, out _)) {
            return;
        }

        if (!TryDeliverEscrowToBuyer(wr, buyer, listing, out _)) {
            return;
        }

        AuctionBoardStore.TryUpdateListing(listingId, live => {
            live.Status = "sold";
            live.EscrowItem = null;
            live.PendingSettle = false;
            live.PendingReturnEscrow = false;
            return true;
        });

        SettleSaleProceeds(wr, listing.SellerWallet, listing.SellerName, bid, buyer.LastKnownIp);
        SendActionResult(buyer, ok: true, $"Won auction for {listing.ItemName} ({bid} gold).");
    }

    static void TryReturnSellerEscrowInWorld(GameWorldRef wr, GameWorldPlayer player) {
        foreach (var listing in AuctionBoardStore.GetListingsNeedingEscrowReturn()) {
            if (!IsSameSeller(listing, player) || listing.EscrowItem is null) {
                continue;
            }
            if (!TryReturnEscrowToPlayer(wr, player, listing, out _)) {
                continue;
            }
            AuctionBoardStore.TryUpdateListing(listing.ListingId, live => {
                if (string.Equals(live.Status, "active", StringComparison.OrdinalIgnoreCase)) {
                    live.Status = "expired";
                }
                live.EscrowItem = null;
                live.PendingReturnEscrow = false;
                return true;
            });
        }
    }

    /// <summary>
    /// Credits full sale gold to seller, then charges 5% commission from wallet (debt if short).
    /// </summary>
    static void SettleSaleProceeds(
        GameWorldRef wr,
        string sellerWallet,
        string sellerName,
        int grossGold,
        string? ipHint) {
        if (grossGold <= 0) {
            return;
        }

        CreditGold(wr, sellerWallet, sellerName, grossGold);
        var fee = ComputeFee(grossGold);
        if (fee <= 0) {
            return;
        }

        if (OnlinePlayerDirectory.TryGet(sellerWallet, sellerName, out var seller) &&
            seller is not null &&
            wr.World.TryGetPlayerBySessionId(seller.SessionId, out _)) {
            ChargeCommission(wr, seller, fee, ipHint);
            return;
        }

        AuctionBoardStore.AddPendingFeeCharge(sellerWallet, sellerName, fee, ipHint);
    }

    static void ChargeCommission(GameWorldRef wr, GameWorldPlayer seller, int fee, string? ipHint) {
        if (seller.InventoryManager.TrySpendGold(fee, out var spend)) {
            Inventory.ApplyInventoryMutation(wr, seller, spend);
            return;
        }

        // Partial: spend what they have, debt the rest (negative balance mock).
        var available = SumGold(seller);
        if (available > 0 && seller.InventoryManager.TrySpendGold(available, out var partial)) {
            Inventory.ApplyInventoryMutation(wr, seller, partial);
            fee -= available;
        }
        if (fee > 0) {
            OpenOrIncreaseDebt(seller.AccountWallet, seller.CharacterName, fee, seller.LastKnownIp ?? ipHint);
        }
    }

    static void ApplyPendingCreditsAndFees(GameWorldRef wr, GameWorldPlayer player) {
        var fee = AuctionBoardStore.TakePendingFeeCharge(player.AccountWallet, player.CharacterName, out var feeIp);
        if (fee > 0) {
            ChargeCommission(wr, player, fee, feeIp ?? player.LastKnownIp);
        }

        var gold = AuctionBoardStore.TakePendingGold(player.AccountWallet, player.CharacterName);
        if (gold <= 0) {
            return;
        }
        if (player.InventoryManager.TryCreateItemStack(GroundItemPickup.GoldItemId, gold, out var grant)) {
            Inventory.ApplyInventoryMutation(wr, player, grant);
        } else {
            AuctionBoardStore.AddPendingGold(player.AccountWallet, player.CharacterName, gold);
        }
    }

    static void CreditGold(GameWorldRef wr, string wallet, string name, int gold) {
        if (gold <= 0) {
            return;
        }
        if (OnlinePlayerDirectory.TryGet(wallet, name, out var player) &&
            player is not null &&
            wr.World.TryGetPlayerBySessionId(player.SessionId, out _) &&
            player.InventoryManager.TryCreateItemStack(GroundItemPickup.GoldItemId, gold, out var grant)) {
            Inventory.ApplyInventoryMutation(wr, player, grant);
            return;
        }
        AuctionBoardStore.AddPendingGold(wallet, name, gold);
    }

    static void OpenOrIncreaseDebt(string wallet, string name, int fee, string? ip) {
        var existing = AuctionBoardStore.GetDebt(wallet, name);
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        AuctionBoardStore.SetDebt(new AuctionDebtRecord {
            AccountWallet = wallet,
            CharacterName = name,
            AmountGold = (existing?.AmountGold ?? 0) + fee,
            DueAtMs = existing is { DueAtMs: > 0 } ? existing.DueAtMs : nowMs + AuctionBoardStore.DebtGraceMs,
            LastKnownIp = string.IsNullOrWhiteSpace(existing?.LastKnownIp) ? (ip ?? "") : existing!.LastKnownIp,
            Blocked = existing?.Blocked ?? false,
        });
    }

    static int SumGold(GameWorldPlayer player) => player.InventoryManager.CountGold();

    static bool TryDeliverEscrowToBuyer(
        GameWorldRef wr,
        GameWorldPlayer buyer,
        AuctionListingRecord listing,
        out string error) {
        error = string.Empty;
        if (listing.EscrowItem is null) {
            error = "Escrow missing.";
            return false;
        }

        var item = FromEscrow(listing.EscrowItem);
        if (!buyer.InventoryManager.TryInsertWarehouseItemIntoBag(item, out var bagResult)) {
            error = "Buyer bag cannot hold that item.";
            return false;
        }
        Inventory.ApplyInventoryMutation(wr, buyer, bagResult);
        return true;
    }

    static bool TryReturnEscrowToPlayer(
        GameWorldRef wr,
        GameWorldPlayer player,
        AuctionListingRecord listing,
        out string error) {
        error = string.Empty;
        if (listing.EscrowItem is null) {
            error = "Nothing to return.";
            return false;
        }
        var item = FromEscrow(listing.EscrowItem);
        if (!player.InventoryManager.TryInsertWarehouseItemIntoBag(item, out var bagResult)) {
            error = "Your bag cannot hold the returned item.";
            return false;
        }
        Inventory.ApplyInventoryMutation(wr, player, bagResult);
        return true;
    }

    static bool TryValidateBuyerAccess(
        AuctionListingRecord listing,
        GameWorldRef wr,
        GameWorldPlayer buyer,
        out string error) {
        error = string.Empty;
        var buyerCity = ResolveCity(wr, buyer);
        var buyerGuild = buyer.GuildId ?? string.Empty;
        var buyerName = buyer.CharacterName ?? string.Empty;

        if (listing.BlockedPlayerNames.Any(n =>
                string.Equals(n, buyerName, StringComparison.OrdinalIgnoreCase))) {
            error = "Seller blocked your character.";
            return false;
        }

        if (!string.IsNullOrWhiteSpace(buyerGuild) &&
            listing.BlockedGuildIds.Any(g => string.Equals(g, buyerGuild, StringComparison.OrdinalIgnoreCase))) {
            error = "Seller blocked your guild.";
            return false;
        }

        if (listing.OnlyOwnCity) {
            if (string.IsNullOrWhiteSpace(listing.SellerCity) ||
                string.Equals(listing.SellerCity, "traveler", StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(listing.SellerCity, buyerCity, StringComparison.OrdinalIgnoreCase)) {
                error = "Seller only sells to their own city.";
                return false;
            }
        }

        if (listing.OnlyOwnGuild) {
            if (string.IsNullOrWhiteSpace(listing.SellerGuildId)) {
                error = "Seller guild filter invalid (no guild on listing).";
                return false;
            }
            if (string.IsNullOrWhiteSpace(buyerGuild)) {
                error = "Guild required to buy this listing (Fase H stub).";
                return false;
            }
            if (!string.Equals(listing.SellerGuildId, buyerGuild, StringComparison.OrdinalIgnoreCase)) {
                error = "Seller only sells to their own guild.";
                return false;
            }
        }

        if (listing.RequireFullLevelAndRep100) {
            if (buyer.Level < AuctionBoardStore.FullLevelThreshold ||
                buyer.Reputation < AuctionBoardStore.MinReputationForAntiAlt) {
                error =
                    $"Requires level ≥ {AuctionBoardStore.FullLevelThreshold} and reputation ≥ {AuctionBoardStore.MinReputationForAntiAlt} (anti-alt).";
                return false;
            }
        }

        return true;
    }

    static bool TryEnsureCanTrade(GameWorldPlayer player, long nowMs, out string error) {
        error = string.Empty;
        if (AuctionBoardStore.IsIpBlocked(player.LastKnownIp)) {
            error = "This IP is blocked from the auction board (overdue fee debt).";
            return false;
        }
        if (AuctionBoardStore.IsCharacterTradeBlocked(player.AccountWallet, player.CharacterName, nowMs)) {
            error = "Character blocked from trade until auction fee debt is settled.";
            return false;
        }
        return true;
    }

    static string ResolveCity(GameWorldRef wr, GameWorldPlayer player) {
        if (!string.IsNullOrWhiteSpace(player.CitizenshipSide)) {
            return player.CitizenshipSide;
        }
        return CityNpcServices.ResolveCitizenshipSidePublic(wr.WorldId);
    }

    static bool IsSameSeller(AuctionListingRecord listing, GameWorldPlayer player) =>
        string.Equals(listing.SellerWallet, player.AccountWallet, StringComparison.OrdinalIgnoreCase) &&
        string.Equals(listing.SellerName, player.CharacterName, StringComparison.OrdinalIgnoreCase);

    static List<string> SanitizeNameList(IEnumerable<string>? names) {
        if (names is null) {
            return new List<string>();
        }
        return names
            .Select(n => (n ?? string.Empty).Trim())
            .Where(n => n.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(MaxBlockedEntries)
            .ToList();
    }

    static int ComputeFee(int grossGold) {
        if (grossGold <= 0) {
            return 0;
        }
        var fee = (int)((long)grossGold * AuctionBoardStore.CommissionPercent / 100L);
        return Math.Max(1, fee);
    }

    static AuctionEscrowItem ToEscrow(InventoryItemState item) => new() {
        ItemId = item.ItemId,
        ItemUid = item.ItemUid,
        Quantity = item.Quantity,
        ItemAttribute = item.ItemAttribute,
        ItemColor = item.ItemColor,
        CurLifeSpan = item.CurLifeSpan,
        MaxLifeSpan = item.MaxLifeSpan,
        EffectOverrides = item.EffectOverrides,
    };

    static InventoryItemState FromEscrow(AuctionEscrowItem escrow) =>
        new(
            escrow.ItemId,
            escrow.ItemUid,
            bagX: 0,
            bagY: 0,
            escrow.Quantity,
            bagZIndex: 0,
            escrow.EffectOverrides,
            escrow.ItemAttribute,
            escrow.ItemColor,
            escrow.CurLifeSpan,
            escrow.MaxLifeSpan);

    static bool IsRequestForCurrentWorld(GameWorldRef wr, string requestWorldId) =>
        string.Equals(requestWorldId, wr.WorldId, StringComparison.Ordinal);

    static void SendSnapshot(GameWorldPlayer player, string message) {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var debt = AuctionBoardStore.GetDebt(player.AccountWallet, player.CharacterName);
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateAuctionBoardSnapshot(
                AuctionBoardStore.GetActiveListings(),
                message,
                debt?.AmountGold ?? 0,
                debt?.DueAtMs ?? 0,
                AuctionBoardStore.IsCharacterTradeBlocked(player.AccountWallet, player.CharacterName, nowMs) ||
                AuctionBoardStore.IsIpBlocked(player.LastKnownIp),
                AuctionBoardStore.SettlementNoteMock));
    }

    static void SendActionResult(
        GameWorldPlayer player,
        bool ok,
        string message,
        AuctionListingRecord? listing = null) {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var debt = AuctionBoardStore.GetDebt(player.AccountWallet, player.CharacterName);
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateAuctionBoardActionResult(
                ok,
                message,
                listing,
                debt?.AmountGold ?? 0,
                debt?.DueAtMs ?? 0,
                AuctionBoardStore.IsCharacterTradeBlocked(player.AccountWallet, player.CharacterName, nowMs) ||
                AuctionBoardStore.IsIpBlocked(player.LastKnownIp)));
    }
}
