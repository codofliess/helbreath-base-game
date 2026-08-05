using System.Text.Json;
using System.Text.Json.Serialization;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Guild-hall / city-hall Cashier: dual market (genuine USDC/USDT vs pending $HELL).
/// All SKUs accept stablecoin. $HELL only when <see cref="CashShopSku.PriceHell"/> &gt; 0
/// (combos + stones). Individual shoes/boots/cape and seals are stablecoin-only.
/// Fake SPL mints are rejected via allowlist.
/// </summary>
public static class CashShop {
    public const int CashierCatalogNpcId = 14;
    public const int MaxInteractDistance = 3;

    /// <summary>1 = stablecoin (USDC/USDT), 2 = $HELL pending credits.</summary>
    public const int CurrencyStablecoin = 1;
    public const int CurrencyHell = 2;

    static CashShopFile? config;
    static readonly object loadGate = new();

    public static void EnsureLoaded() {
        if (config is not null) {
            return;
        }
        lock (loadGate) {
            if (config is not null) {
                return;
            }
            var path = Path.Combine(AppContext.BaseDirectory, "Config", "CashShop.json");
            if (!File.Exists(path)) {
                path = Path.Combine(Directory.GetCurrentDirectory(), "Config", "CashShop.json");
            }
            if (!File.Exists(path)) {
                Console.WriteLine("[CashShop] Config/CashShop.json missing — cash shop disabled.");
                config = new CashShopFile();
                return;
            }
            var json = File.ReadAllText(path);
            config = JsonSerializer.Deserialize<CashShopFile>(json, new JsonSerializerOptions {
                PropertyNameCaseInsensitive = true,
                ReadCommentHandling = JsonCommentHandling.Skip,
                AllowTrailingCommas = true,
            }) ?? new CashShopFile();
            Console.WriteLine($"[CashShop] Loaded {config.Skus.Count} SKU(s); cashier NPC catalog id {config.CashierCatalogNpcId}.");
        }
    }

    public static IReadOnlyList<CashShopSku> GetSkus() {
        EnsureLoaded();
        return config!.Skus;
    }

    public static bool IsGenuineStablecoinMint(string mintAddress) {
        EnsureLoaded();
        var mint = (mintAddress ?? "").Trim();
        if (mint.Length < 32) {
            return false;
        }
        foreach (var cluster in config!.GenuineStablecoinMints.Values) {
            foreach (var allowed in cluster.Values) {
                if (string.Equals(allowed, mint, StringComparison.Ordinal)) {
                    return true;
                }
            }
        }
        return false;
    }

    public static string? ResolveStablecoinSymbol(string mintAddress) {
        EnsureLoaded();
        var mint = (mintAddress ?? "").Trim();
        foreach (var cluster in config!.GenuineStablecoinMints.Values) {
            foreach (var (symbol, address) in cluster) {
                if (string.Equals(address, mint, StringComparison.Ordinal)) {
                    return symbol;
                }
            }
        }
        return null;
    }

    public static void HandleBuyRequest(GameWorldRef wr, GameWorldPlayer player, BuyCashShopItemRequest request) {
        EnsureLoaded();
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        if (player.IsDead) {
            Send(player, ok: false, "Cannot shop while dead.");
            return;
        }

        // Remote open (F12 Cash / catalog UI): npc_id 0 when AllowRemoteOpen.
        var remoteOk = config!.AllowRemoteOpen && request.NpcId == 0;
        if (!remoteOk) {
            if (!wr.NpcsByNpcId.TryGetValue(request.NpcId, out var npc) ||
                npc.CatalogNpcId != (config.CashierCatalogNpcId > 0 ? config.CashierCatalogNpcId : CashierCatalogNpcId)) {
                Send(player, ok: false, "Talk to the Cashier or open Cash (green F12).");
                return;
            }

            var dist = Math.Max(Math.Abs(player.PosX - npc.PosX), Math.Abs(player.PosY - npc.PosY));
            var maxDist = config.MaxInteractDistance > 0 ? config.MaxInteractDistance : MaxInteractDistance;
            if (dist > maxDist) {
                Send(player, ok: false, "Move closer to the Cashier.");
                return;
            }
        }

        var skuId = (request.SkuId ?? "").Trim();
        var sku = config.Skus.FirstOrDefault(s => string.Equals(s.SkuId, skuId, StringComparison.OrdinalIgnoreCase));
        if (sku is null) {
            Send(player, ok: false, "Unknown product.");
            return;
        }

        var qty = request.Quantity <= 0 ? 1 : Math.Min(request.Quantity, 20);
        var currency = request.Currency;

        if (currency == CurrencyHell) {
            var hellCost = (long)sku.PriceHell * qty;
            if (hellCost <= 0 || sku.PriceHell <= 0) {
                Send(player, ok: false, "Stablecoin only (USDC/USDT) — this product does not accept $HELL.");
                return;
            }
            if (!HellMiningStore.TrySpendPending(player.AccountWallet, hellCost, out var hellMsg)) {
                Send(player, ok: false, hellMsg);
                return;
            }
            if (!TryGrant(wr, player, sku, qty, out var grantErr)) {
                HellMiningStore.RefundPendingSpend(player.AccountWallet, hellCost);
                Send(player, ok: false, grantErr);
                return;
            }
            Send(player, ok: true, $"Purchased {sku.Name} ×{qty} for {hellCost} pending $HELL.");
            return;
        }

        if (currency != CurrencyStablecoin) {
            Send(player, ok: false, "Choose Stablecoin Market or $HELL Market.");
            return;
        }

        var mint = (request.StablecoinMint ?? "").Trim();
        if (!IsGenuineStablecoinMint(mint)) {
            Send(player, ok: false, "Only genuine USDC or USDT (allowlisted mint) accepted — fake tokens rejected.");
            return;
        }
        var symbol = ResolveStablecoinSymbol(mint) ?? "stablecoin";
        var usdCents = (long)sku.PriceStableUsdCents * qty;
        if (usdCents <= 0) {
            Send(player, ok: false, "Invalid stablecoin price.");
            return;
        }

        // Production: verify SPL transfer signature → treasury (env CASH_SHOP_TREASURY_WALLET).
        // Fallback: HELL market; or CASH_SHOP_ALLOW_DEV_GRANT=1 for testing-week free grants.
        var proof = (request.PaymentTxSignature ?? "").Trim();
        var treasury = (config.TreasuryWallet ?? "").Trim();
        if (string.IsNullOrEmpty(treasury)) {
            treasury = (Environment.GetEnvironmentVariable("CASH_SHOP_TREASURY_WALLET") ?? "").Trim();
        }

        var allowDev =
            string.Equals(Environment.GetEnvironmentVariable("CASH_SHOP_ALLOW_DEV_GRANT"), "1", StringComparison.Ordinal) ||
            (config.AllowDevGrantWithoutChainTx &&
             string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase) &&
             (AdminSecurity.CanUseGmTools(player) || AdminSecurity.AllowOpenGmSandbox));

        if (!string.IsNullOrEmpty(proof) && !string.IsNullOrEmpty(treasury)) {
            if (!CashShopPayment.TryVerifyStablecoinTransfer(
                    proof,
                    mint,
                    treasury,
                    usdCents,
                    out var verifyErr)) {
                Send(player, ok: false, verifyErr);
                Console.WriteLine($"[CashShop] On-chain verify failed sku={sku.SkuId} player={player.CharacterName}: {verifyErr}");
                return;
            }
        } else if (!allowDev) {
            Send(player, ok: false,
                string.IsNullOrEmpty(treasury)
                    ? $"Set CASH_SHOP_TREASURY_WALLET for USDT pays, or use $HELL market ({usdCents / 100.0:0.##} {symbol} listed)."
                    : $"Submit a Solana transfer signature of {usdCents / 100.0:0.##} {symbol} to treasury, or pay with $HELL.");
            return;
        }

        if (!TryGrant(wr, player, sku, qty, out var err2)) {
            Send(player, ok: false, err2);
            return;
        }

        var tag = allowDev && string.IsNullOrEmpty(proof) ? "(dev grant) " : "";
        Send(player, ok: true, $"{tag}Purchased {sku.Name} ×{qty} for {usdCents / 100.0:0.##} {symbol}.");
    }

    static bool TryGrant(GameWorldRef wr, GameWorldPlayer player, CashShopSku sku, int packs, out string error) {
        error = "";
        for (var p = 0; p < packs; p++) {
            if (!GrantOnePack(wr, player, sku.ItemId, Math.Max(1, sku.Quantity), sku.SoulboundOnGrant, out error)) {
                return false;
            }
            if (sku.BonusItemId is int bonusId && bonusId > 0) {
                if (!GrantOnePack(wr, player, bonusId, 1, sku.SoulboundOnGrant, out error)) {
                    return false;
                }
            }
        }
        return true;
    }

    static bool GrantOnePack(GameWorldRef wr, GameWorldPlayer player, int itemId, int quantity, bool soulbound, out string error) {
        error = "";
        // Carry-weight gate: bulk stone packs were filling bags past max and locking players.
        if (!PlayerDerivedStats.CanCarryAdditional(player, itemId, Math.Max(1, quantity))) {
            error =
                $"Too heavy! Weight {PlayerDerivedStats.CurrentCarryWeightStones(player)}/{PlayerDerivedStats.MaxCarryWeightStones(player)} stone. " +
                "Drop or use items / raise Str or Level, then try again.";
            return false;
        }
        if (!player.InventoryManager.TryCreateItemStack(itemId, quantity, out var grantResult)) {
            error = "Your bag is full.";
            return false;
        }
        Inventory.ApplyInventoryMutation(wr, player, grantResult);
        if (CashShopBoosts.IsCashGear(itemId)) {
            InventoryItemState? last = null;
            foreach (var bag in player.InventoryManager.BagItems) {
                if (bag.ItemId == itemId) {
                    last = bag;
                }
            }
            if (last is not null) {
                CashShopBoosts.ApplyGearAffixes(last);
                var mutAffix = new InventoryMutationResult();
                mutAffix.AddedToBag.Add(last.Clone());
                Inventory.ApplyInventoryMutation(wr, player, mutAffix);
                PlayerDerivedStats.Refresh(player, fillIncreasedPools: true);
            }
        }
        if (soulbound) {
            // Mark newly granted stack(s) soulbound (match by item id, last added).
            foreach (var bag in player.InventoryManager.BagItems) {
                if (bag.ItemId != itemId || bag.BindState != ItemBind.BindStateUnbound) {
                    continue;
                }
                bag.BindState = ItemBind.BindStateSoulbound;
                bag.BoundGuildId = "";
                var mut = new InventoryMutationResult();
                mut.AddedToBag.Add(bag.Clone());
                Inventory.ApplyInventoryMutation(wr, player, mut);
                break;
            }
        }
        return true;
    }

    static void Send(GameWorldPlayer player, bool ok, string message) {
        NetworkManager.SendToPlayer(
            player,
            new ServerMessage {
                BuyCashShopItemResult = new BuyCashShopItemResult {
                    Ok = ok,
                    Message = message ?? "",
                },
            });
    }
}

public sealed class CashShopFile {
    public int CashierCatalogNpcId { get; set; } = 14;
    public int MaxInteractDistance { get; set; } = 3;
    /// <summary>When true, buy requests with NpcId=0 work without standing at the Cashier NPC (F12 Cash).</summary>
    public bool AllowRemoteOpen { get; set; } = true;
    public bool AllowDevGrantWithoutChainTx { get; set; } = true;
    public string TreasuryWallet { get; set; } = "";
    public Dictionary<string, Dictionary<string, string>> GenuineStablecoinMints { get; set; } = new();
    public List<CashShopSku> Skus { get; set; } = new();
}

public sealed class CashShopSku {
    public string SkuId { get; set; } = "";
    public int ItemId { get; set; }
    public int? BonusItemId { get; set; }
    public string Name { get; set; } = "";
    public string Category { get; set; } = "boosts";
    public int Quantity { get; set; } = 1;
    public int PriceStableUsdCents { get; set; }
    public int PriceHell { get; set; }
    public bool SoulboundOnGrant { get; set; }
}
