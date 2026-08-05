using System.Net.Http;
using System.Text;
using System.Text.Json;

namespace Server.Helpers;

/// <summary>
/// Production SPL stablecoin payment verify (Solana JSON-RPC).
/// Confirms <paramref name="signature"/> is a successful tx that moves ≥ expected amount of
/// allowlisted mint to the treasury wallet. Funds may later be swept to exchange wallets.
/// </summary>
public static class CashShopPayment {
    static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(20) };

    /// <summary>USDT/USDC use 6 decimals → 1 USD cent = 10_000 base units.</summary>
    public static long ExpectedTokenAmount(long usdCents) => Math.Max(1, usdCents * 10_000L);

    public static bool TryVerifyStablecoinTransfer(
        string signature,
        string mint,
        string treasuryWallet,
        long usdCents,
        out string error) {
        error = "";
        signature = (signature ?? "").Trim();
        mint = (mint ?? "").Trim();
        treasuryWallet = (treasuryWallet ?? "").Trim();
        if (signature.Length < 32) {
            error = "Missing payment transaction signature.";
            return false;
        }
        if (treasuryWallet.Length < 32) {
            error = "Treasury wallet not configured (CASH_SHOP_TREASURY_WALLET).";
            return false;
        }

        var rpc = (Environment.GetEnvironmentVariable("SOLANA_RPC_URL") ?? "https://api.mainnet-beta.solana.com").Trim();
        var need = ExpectedTokenAmount(usdCents);

        try {
            var body = JsonSerializer.Serialize(new {
                jsonrpc = "2.0",
                id = 1,
                method = "getTransaction",
                @params = new object[] {
                    signature,
                    new {
                        encoding = "jsonParsed",
                        maxSupportedTransactionVersion = 0,
                        commitment = "confirmed",
                    },
                },
            });
            using var req = new HttpRequestMessage(HttpMethod.Post, rpc) {
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            };
            using var resp = Http.Send(req);
            var json = resp.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            if (!resp.IsSuccessStatusCode) {
                error = $"RPC HTTP {(int)resp.StatusCode}.";
                return false;
            }

            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("result", out var result) ||
                result.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined) {
                error = "Transaction not found / not confirmed yet. Wait and retry.";
                return false;
            }

            if (result.TryGetProperty("meta", out var meta) &&
                meta.TryGetProperty("err", out var errEl) &&
                errEl.ValueKind is not JsonValueKind.Null and not JsonValueKind.Undefined) {
                error = "On-chain transaction failed.";
                return false;
            }

            // Sum token balance increases on treasury for the mint.
            long gained = 0;
            if (meta.TryGetProperty("postTokenBalances", out var post) &&
                meta.TryGetProperty("preTokenBalances", out var pre) &&
                post.ValueKind == JsonValueKind.Array &&
                pre.ValueKind == JsonValueKind.Array) {
                var preMap = new Dictionary<string, long>(StringComparer.Ordinal);
                foreach (var row in pre.EnumerateArray()) {
                    if (!TryReadTokenBal(row, mint, treasuryWallet, out var key, out var amt)) {
                        continue;
                    }
                    preMap[key] = amt;
                }
                foreach (var row in post.EnumerateArray()) {
                    if (!TryReadTokenBal(row, mint, treasuryWallet, out var key, out var amt)) {
                        continue;
                    }
                    preMap.TryGetValue(key, out var before);
                    var delta = amt - before;
                    if (delta > 0) {
                        gained += delta;
                    }
                }
            }

            if (gained < need) {
                error = $"Treasury received {gained} base units of mint; need ≥ {need} for this SKU.";
                return false;
            }

            Console.WriteLine(
                $"[CashShopPayment] OK sig={signature[..Math.Min(12, signature.Length)]}… mint={mint[..Math.Min(8, mint.Length)]}… " +
                $"treasury+={gained} need={need}");
            return true;
        } catch (Exception ex) {
            error = $"Payment verify error: {ex.Message}";
            return false;
        }
    }

    static bool TryReadTokenBal(JsonElement row, string mint, string owner, out string key, out long amount) {
        key = "";
        amount = 0;
        if (!row.TryGetProperty("mint", out var mintEl) ||
            !string.Equals(mintEl.GetString(), mint, StringComparison.Ordinal)) {
            return false;
        }
        if (!row.TryGetProperty("owner", out var ownerEl) ||
            !string.Equals(ownerEl.GetString(), owner, StringComparison.Ordinal)) {
            return false;
        }
        var accountIndex = row.TryGetProperty("accountIndex", out var ai) ? ai.GetInt32() : -1;
        key = $"{owner}:{accountIndex}";
        if (row.TryGetProperty("uiTokenAmount", out var ui) &&
            ui.TryGetProperty("amount", out var amtEl) &&
            long.TryParse(amtEl.GetString(), out var raw)) {
            amount = raw;
            return true;
        }
        return false;
    }
}
