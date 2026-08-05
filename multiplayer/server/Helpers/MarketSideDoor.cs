using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Bridges in-game auction board ↔ middleware market side door (mobile landing / Discord).
/// Syncs active listings; delivers paid mobile claims into bag when the player is online.
/// </summary>
public static class MarketSideDoor {
    static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(12) };
    static long lastSyncMs;
    static long lastDeliverSweepMs;

    static string MiddlewareBase() =>
        (Environment.GetEnvironmentVariable("MARKET_MIDDLEWARE_URL")
         ?? Environment.GetEnvironmentVariable("MIDDLEWARE_URL")
         ?? "http://127.0.0.1:3001").Trim().TrimEnd('/');

    static string SyncSecret() =>
        (Environment.GetEnvironmentVariable("MARKET_SYNC_SECRET")
         ?? Environment.GetEnvironmentVariable("REALM_STATS_SECRET")
         ?? string.Empty).Trim();

    /// <summary>Call from auction tick / world tick (throttled).</summary>
    public static void Tick(GameWorldRef wr) {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (nowMs - lastSyncMs >= 30_000) {
            lastSyncMs = nowMs;
            _ = SyncListingsAsync();
        }

        if (nowMs - lastDeliverSweepMs >= 15_000) {
            lastDeliverSweepMs = nowMs;
            foreach (var player in wr.World.EnumerateConnectedPlayers()) {
                TryDeliverDeskClaims(wr, player);
            }
        }
    }

    /// <summary>Deliver pending mobile purchases for this wallet into bag.</summary>
    public static void TryDeliverDeskClaims(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        var wallet = player.AccountWallet?.Trim() ?? string.Empty;
        if (wallet.Length < 32) {
            return;
        }

        var secret = SyncSecret();
        if (string.IsNullOrWhiteSpace(secret)) {
            return;
        }

        try {
            var claims = FetchDeskClaimsAsync(wallet, secret).GetAwaiter().GetResult();
            if (claims.Count == 0) {
                return;
            }

            foreach (var claim in claims) {
                // Cap quantity to prevent middleware spoof of huge stacks if secret leaks partially.
                var qty = Math.Clamp(claim.Quantity, 1, 99);
                claim.Quantity = qty;
                if (claim.ItemId <= 0 || string.IsNullOrWhiteSpace(claim.ClaimId)) {
                    continue;
                }

                // Confirm first (marks claimed on middleware) then grant. If grant fails after confirm,
                // log for ops — better than grant-then-fail-confirm which left free items in bag.
                if (!ConfirmClaimAsync(wallet, claim.ClaimId, player.CharacterName ?? "", toWarehouse: false, secret)
                        .GetAwaiter().GetResult()) {
                    Console.WriteLine(
                        $"[MarketSideDoor] Confirm claim failed/already taken claim={claim.ClaimId} char={player.CharacterName}");
                    continue;
                }

                if (!TryGrantClaimItem(wr, player, claim, out var err)) {
                    Console.WriteLine(
                        $"[MarketSideDoor] CRITICAL grant after confirm failed claim={claim.ClaimId} " +
                        $"char={player.CharacterName} item={claim.ItemId}x{qty}: {err} — manual re-credit needed");
                    continue;
                }

                var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                NetworkManager.SendToPlayer(
                    player,
                    NetworkManager.CreateChatMessageReceived(
                        "System",
                        nowMs,
                        $"Delivery desk: received {claim.Quantity}× {claim.ItemName} (mobile market)."));
                Console.WriteLine(
                    $"[MarketSideDoor] Delivered {claim.Quantity}× {claim.ItemName} → {player.CharacterName} ({wallet[..Math.Min(6, wallet.Length)]}…)");
            }
        } catch (Exception ex) {
            Console.WriteLine($"[MarketSideDoor] Deliver error: {ex.Message}");
        }
    }

    static bool TryGrantClaimItem(GameWorldRef wr, GameWorldPlayer player, DeskClaimDto claim, out string error) {
        error = string.Empty;
        var qty = Math.Max(1, claim.Quantity);
        if (!player.InventoryManager.TryCreateItemStack(claim.ItemId, qty, out var bagResult)) {
            error = "Bag full or invalid item id.";
            return false;
        }
        Inventory.ApplyInventoryMutation(wr, player, bagResult);
        return true;
    }

    public static async Task SyncListingsAsync() {
        var secret = SyncSecret();
        if (string.IsNullOrWhiteSpace(secret)) {
            return;
        }

        try {
            var active = AuctionBoardStore.GetActiveListings();
            var payload = new {
                listings = active.Select(l => new {
                    listingId = l.ListingId,
                    itemId = l.ItemId,
                    itemName = l.ItemName,
                    quantity = l.Quantity,
                    listPriceGold = l.ListPriceGold > 0 ? l.ListPriceGold : l.MinBidGold,
                    sellerName = l.SellerName,
                    sellerWallet = l.SellerWallet,
                    sellerCity = l.SellerCity,
                    mode = l.Mode.ToString().ToLowerInvariant(),
                    status = "active",
                    createdAtMs = l.CreatedAtMs,
                    expiresAtMs = l.ExpiresAtMs,
                    itemUid = l.ItemUid,
                    itemAttribute = l.ItemAttribute,
                    itemColor = l.ItemColor,
                    curLifeSpan = l.CurLifeSpan,
                    maxLifeSpan = l.MaxLifeSpan,
                }).ToList(),
            };

            using var req = new HttpRequestMessage(HttpMethod.Post, $"{MiddlewareBase()}/market/game/sync-listings") {
                Content = JsonContent.Create(payload),
            };
            req.Headers.TryAddWithoutValidation("X-Market-Sync-Secret", secret);
            using var res = await Http.SendAsync(req).ConfigureAwait(false);
            if (!res.IsSuccessStatusCode) {
                var body = await res.Content.ReadAsStringAsync().ConfigureAwait(false);
                Console.WriteLine($"[MarketSideDoor] Sync failed HTTP {(int)res.StatusCode}: {body}");
            }
        } catch (Exception ex) {
            Console.WriteLine($"[MarketSideDoor] Sync error: {ex.Message}");
        }
    }

    static async Task<List<DeskClaimDto>> FetchDeskClaimsAsync(string wallet, string secret) {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"{MiddlewareBase()}/market/game/desk/{Uri.EscapeDataString(wallet)}");
        req.Headers.TryAddWithoutValidation("X-Market-Sync-Secret", secret);
        using var res = await Http.SendAsync(req).ConfigureAwait(false);
        if (!res.IsSuccessStatusCode) {
            return new List<DeskClaimDto>();
        }
        var json = await res.Content.ReadAsStringAsync().ConfigureAwait(false);
        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("claims", out var arr) || arr.ValueKind != JsonValueKind.Array) {
            return new List<DeskClaimDto>();
        }
        var list = new List<DeskClaimDto>();
        foreach (var el in arr.EnumerateArray()) {
            list.Add(new DeskClaimDto {
                ClaimId = el.GetProperty("claimId").GetString() ?? "",
                OrderId = el.TryGetProperty("orderId", out var o) ? o.GetString() ?? "" : "",
                ItemId = el.TryGetProperty("itemId", out var id) ? id.GetInt32() : 0,
                ItemName = el.TryGetProperty("itemName", out var n) ? n.GetString() ?? "Item" : "Item",
                Quantity = el.TryGetProperty("quantity", out var q) ? q.GetInt32() : 1,
            });
        }
        return list.Where(c => !string.IsNullOrWhiteSpace(c.ClaimId) && c.ItemId > 0).ToList();
    }

    static async Task<bool> ConfirmClaimAsync(string wallet, string claimId, string characterName, bool toWarehouse, string secret) {
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{MiddlewareBase()}/market/game/desk-claim") {
            Content = JsonContent.Create(new {
                wallet,
                claimId,
                characterName,
                toWarehouse,
            }),
        };
        req.Headers.TryAddWithoutValidation("X-Market-Sync-Secret", secret);
        using var res = await Http.SendAsync(req).ConfigureAwait(false);
        return res.IsSuccessStatusCode;
    }

    sealed class DeskClaimDto {
        public string ClaimId { get; set; } = "";
        public string OrderId { get; set; } = "";
        public int ItemId { get; set; }
        public string ItemName { get; set; } = "";
        public int Quantity { get; set; } = 1;
    }
}
