using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Server.Helpers;

/// <summary>
/// Keeps Cash Shop $HELL prices roughly USD-stable. The market alone sets USD/HELL; the server
/// never trades or quotes the token. It only moves its internal anchor when the median market price
/// has drifted more than <see cref="RepegThreshold"/> from the current anchor, and SKU $HELL prices
/// scale by <c>designUsdPerHell / anchorUsdPerHell</c>.
/// Price source: <c>HELL_USD_PRICE</c> (static override) or the DexScreener pair with the deepest
/// USD liquidity for <c>HELL_MINT</c> (<c>HELL_PRICE_FEED_URL</c> overrides, <c>{mint}</c> placeholder;
/// <c>HELL_PRICE_FEED=off</c> disables).
/// </summary>
public static class HellPriceAnchor {
    public const double RepegThreshold = 0.20;
    public const int SampleWindow = 6;
    public const int MinSamplesForRepeg = 3;
    public static readonly TimeSpan SampleInterval = TimeSpan.FromMinutes(10);
    const string DefaultFeedUrl = "https://api.dexscreener.com/tokens/v1/solana/{mint}";
    const double MaxPriceFactor = 1e9;

    static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(10) };
    static readonly object Gate = new();
    static readonly JsonSerializerOptions JsonOptions = new() {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    static HellPriceAnchorFile file = new();
    static string? persistDirectory;
    static double designUsdPerHell = 0.001;

    public static void Initialize(string charsDirectory, double designUsd) {
        ArgumentException.ThrowIfNullOrWhiteSpace(charsDirectory);
        Directory.CreateDirectory(charsDirectory);
        lock (Gate) {
            persistDirectory = charsDirectory;
            designUsdPerHell = IsUsablePrice(designUsd) ? designUsd : 0.001;
            file = new HellPriceAnchorFile();
            TryLoadLocked();
            if (!IsUsablePrice(file.AnchorUsdPerHell)) {
                file.AnchorUsdPerHell = designUsdPerHell;
                file.AnchoredAtMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            }
            file.Samples ??= new List<HellPriceSample>();
            PersistLocked();
            Console.WriteLine(
                $"[HellPrice] anchor={FormatUsd(file.AnchorUsdPerHell)} USD/HELL design={FormatUsd(designUsdPerHell)} " +
                $"factor=x{PriceFactorLocked():0.####} · re-peg when median drifts >{RepegThreshold:P0}.");
        }
    }

    public static double AnchorUsdPerHell {
        get {
            lock (Gate) {
                return file.AnchorUsdPerHell;
            }
        }
    }

    /// <summary>
    /// Config $HELL price (priced at the design USD/HELL) converted to today's anchor. Returns 0 for
    /// stablecoin-only SKUs or when the factor would overflow.
    /// </summary>
    public static long ScaleDesignPrice(long designPriceHell) {
        if (designPriceHell <= 0) {
            return 0;
        }
        double factor;
        lock (Gate) {
            factor = PriceFactorLocked();
        }
        var scaled = Math.Ceiling(designPriceHell * factor - 1e-9);
        return scaled is >= 1 and < long.MaxValue / 64 ? (long)scaled : 0;
    }

    /// <summary>Adds one market sample; returns true when it moved the anchor.</summary>
    public static bool ObserveMarketPrice(double usdPerHell, long nowMs) {
        if (!IsUsablePrice(usdPerHell)) {
            return false;
        }
        lock (Gate) {
            file.Samples ??= new List<HellPriceSample>();
            file.Samples.Add(new HellPriceSample { AtMs = nowMs, UsdPerHell = usdPerHell });
            if (file.Samples.Count > SampleWindow) {
                file.Samples.RemoveRange(0, file.Samples.Count - SampleWindow);
            }
            var repegged = false;
            if (file.Samples.Count >= MinSamplesForRepeg) {
                var median = Median(file.Samples.Select(s => s.UsdPerHell));
                var drift = median / file.AnchorUsdPerHell - 1.0;
                if (Math.Abs(drift) > RepegThreshold) {
                    var before = file.AnchorUsdPerHell;
                    file.AnchorUsdPerHell = median;
                    file.AnchoredAtMs = nowMs;
                    file.RepegCount++;
                    repegged = true;
                    Console.WriteLine(
                        $"[HellPrice] Re-peg {FormatUsd(before)} → {FormatUsd(median)} USD/HELL " +
                        $"(median of {file.Samples.Count}, drift {drift:+0.0%;-0.0%}) · Cash Shop $HELL prices x{PriceFactorLocked():0.####} of config.");
                }
            }
            PersistLocked();
            return repegged;
        }
    }

    public static async Task RunFeedLoopAsync(CancellationToken cancellationToken) {
        var staticRaw = (Environment.GetEnvironmentVariable("HELL_USD_PRICE") ?? "").Trim();
        double? staticPrice = double.TryParse(staticRaw, NumberStyles.Float, CultureInfo.InvariantCulture, out var s) && IsUsablePrice(s)
            ? s
            : null;
        var feedOff = string.Equals((Environment.GetEnvironmentVariable("HELL_PRICE_FEED") ?? "").Trim(), "off", StringComparison.OrdinalIgnoreCase);
        var mint = (Environment.GetEnvironmentVariable("HELL_MINT") ?? "").Trim();
        var urlTemplate = (Environment.GetEnvironmentVariable("HELL_PRICE_FEED_URL") ?? "").Trim();
        if (urlTemplate.Length == 0) {
            urlTemplate = DefaultFeedUrl;
        }

        if (staticPrice is null && (feedOff || mint.Length == 0)) {
            Console.WriteLine(
                "[HellPrice] Market feed off (set HELL_MINT, or HELL_USD_PRICE for a static price) — Cash Shop keeps the current anchor.");
            return;
        }
        Console.WriteLine(staticPrice is double p
            ? $"[HellPrice] Using HELL_USD_PRICE={FormatUsd(p)} every {SampleInterval.TotalMinutes:0}m."
            : $"[HellPrice] Sampling market price for HELL_MINT every {SampleInterval.TotalMinutes:0}m.");

        using var timer = new PeriodicTimer(SampleInterval);
        do {
            try {
                var price = staticPrice ?? await FetchMarketPriceAsync(urlTemplate.Replace("{mint}", mint, StringComparison.Ordinal), mint, cancellationToken).ConfigureAwait(false);
                if (price is double usd) {
                    ObserveMarketPrice(usd, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
                }
            } catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) {
                return;
            } catch (Exception ex) {
                Console.Error.WriteLine($"[HellPrice] Sample failed: {ex.Message}");
            }
            try {
                if (!await timer.WaitForNextTickAsync(cancellationToken).ConfigureAwait(false)) {
                    return;
                }
            } catch (OperationCanceledException) {
                return;
            }
        } while (true);
    }

    static async Task<double?> FetchMarketPriceAsync(string url, string mint, CancellationToken cancellationToken) {
        using var response = await Http.GetAsync(url, cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode) {
            Console.Error.WriteLine($"[HellPrice] Feed HTTP {(int)response.StatusCode}.");
            return null;
        }
        var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        return ParseDeepestPairPriceUsd(body, mint);
    }

    /// <summary>
    /// DexScreener pairs payload (bare array or <c>{"pairs":[...]}</c>) → USD price of the pair with the
    /// most USD liquidity where <paramref name="mint"/> is the base token.
    /// </summary>
    public static double? ParseDeepestPairPriceUsd(string json, string mint) {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        JsonElement pairs;
        if (root.ValueKind == JsonValueKind.Array) {
            pairs = root;
        } else if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("pairs", out var p) && p.ValueKind == JsonValueKind.Array) {
            pairs = p;
        } else {
            return null;
        }

        double? best = null;
        var bestLiquidity = -1.0;
        foreach (var pair in pairs.EnumerateArray()) {
            if (pair.ValueKind != JsonValueKind.Object) {
                continue;
            }
            if (!pair.TryGetProperty("baseToken", out var baseToken) ||
                !baseToken.TryGetProperty("address", out var addr) ||
                !string.Equals(addr.GetString(), mint, StringComparison.Ordinal)) {
                continue;
            }
            if (!TryReadNumber(pair, "priceUsd", out var price) || !IsUsablePrice(price)) {
                continue;
            }
            var liquidity = pair.TryGetProperty("liquidity", out var liq) && TryReadNumber(liq, "usd", out var l) ? l : 0;
            if (liquidity > bestLiquidity) {
                bestLiquidity = liquidity;
                best = price;
            }
        }
        return best;
    }

    static bool TryReadNumber(JsonElement obj, string name, out double value) {
        value = 0;
        if (obj.ValueKind != JsonValueKind.Object || !obj.TryGetProperty(name, out var el)) {
            return false;
        }
        return el.ValueKind switch {
            JsonValueKind.Number => el.TryGetDouble(out value),
            JsonValueKind.String => double.TryParse(el.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out value),
            _ => false,
        };
    }

    static double PriceFactorLocked() {
        var factor = designUsdPerHell / file.AnchorUsdPerHell;
        return double.IsFinite(factor) && factor > 0 ? Math.Min(factor, MaxPriceFactor) : 1.0;
    }

    static bool IsUsablePrice(double usd) => double.IsFinite(usd) && usd > 0;

    static double Median(IEnumerable<double> values) {
        var sorted = values.OrderBy(v => v).ToArray();
        var mid = sorted.Length / 2;
        return sorted.Length % 2 == 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2.0;
    }

    static string FormatUsd(double usd) => usd.ToString("0.##########", CultureInfo.InvariantCulture);

    static void TryLoadLocked() {
        if (persistDirectory is null) {
            return;
        }
        var path = Path.Combine(persistDirectory, "hell-price-anchor.json");
        if (!File.Exists(path)) {
            return;
        }
        try {
            var loaded = JsonSerializer.Deserialize<HellPriceAnchorFile>(File.ReadAllText(path), JsonOptions);
            if (loaded is not null) {
                file = loaded;
            }
        } catch (Exception ex) {
            Console.WriteLine($"[HellPrice] Load failed: {ex.Message}");
        }
    }

    static void PersistLocked() {
        if (persistDirectory is null) {
            return;
        }
        try {
            var path = Path.Combine(persistDirectory, "hell-price-anchor.json");
            var tmp = path + ".tmp";
            File.WriteAllText(tmp, JsonSerializer.Serialize(file, JsonOptions));
            File.Copy(tmp, path, overwrite: true);
            try {
                File.Delete(tmp);
            } catch {
                // ignore
            }
        } catch (Exception ex) {
            Console.WriteLine($"[HellPrice] Persist failed: {ex.Message}");
        }
    }
}

public sealed class HellPriceAnchorFile {
    public double AnchorUsdPerHell { get; set; }
    public long AnchoredAtMs { get; set; }
    public int RepegCount { get; set; }
    public List<HellPriceSample>? Samples { get; set; } = new();
}

public sealed class HellPriceSample {
    public long AtMs { get; set; }
    public double UsdPerHell { get; set; }
}
