using System.Security.Cryptography;
using System.Text;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Production gate for GM sandbox tooling (teleport, free items, kill-all, combat stat overrides, etc.).
/// Client-claimed <c>playerMode=gm</c> alone is never enough: wallet must be allowlisted, or
/// Development + <c>ALLOW_OPEN_GM_SANDBOX=true</c> for local tooling.
/// </summary>
public static class AdminSecurity {
    private static readonly object Gate = new();
    private static HashSet<string>? allowlistCache;
    private static string? allowlistRawCache;

    /// <summary>
    /// Comma/semicolon/whitespace-separated base58 wallets in <c>GM_WALLET_ALLOWLIST</c>
    /// (or legacy <c>GM_WALLETS</c>). Empty = no GM wallets (safe default for launch).
    /// </summary>
    public static bool IsGmWallet(string? walletPubkey) {
        if (string.IsNullOrWhiteSpace(walletPubkey)) {
            return false;
        }
        var key = walletPubkey.Trim();
        var set = GetAllowlist();
        return set.Contains(key);
    }

    /// <summary>
    /// Local open sandbox: only when ASPNETCORE_ENVIRONMENT=Development AND ALLOW_OPEN_GM_SANDBOX=1/true.
    /// Never enable on production hosts.
    /// </summary>
    public static bool AllowOpenGmSandbox {
        get {
            var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "";
            if (!string.Equals(env, "Development", StringComparison.OrdinalIgnoreCase)) {
                return false;
            }
            var flag = Environment.GetEnvironmentVariable("ALLOW_OPEN_GM_SANDBOX") ?? "";
            return flag is "1" or "true" or "TRUE" or "yes" or "YES";
        }
    }

    /// <summary>
    /// True when this session may use GM-only packets. Requires non-traveler mode AND
    /// (allowlisted wallet OR open-dev sandbox).
    /// </summary>
    public static bool CanUseGmTools(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        if (player.TravelerMode) {
            return false;
        }
        if (IsGmWallet(player.AccountWallet)) {
            return true;
        }
        return AllowOpenGmSandbox;
    }

    /// <summary>
    /// Forces traveler mode for any wallet that is not GM-allowlisted (and not open-dev sandbox).
    /// Prevents client spoof of <c>playerMode=gm</c> into free CreateItem / teleport / kill-all.
    /// </summary>
    public static bool ShouldForceTravelerMode(string? walletPubkey, bool clientRequestedTravelerMode) {
        if (clientRequestedTravelerMode) {
            return true;
        }
        if (IsGmWallet(walletPubkey)) {
            return false;
        }
        if (AllowOpenGmSandbox) {
            return false;
        }
        return true;
    }

    /// <summary>No-op gate: returns false and logs once-style when GM tools are refused.</summary>
    public static bool RejectIfNotGm(GameWorldPlayer player, string toolName) {
        if (CanUseGmTools(player)) {
            return false;
        }
        Console.WriteLine(
            $"[AdminSecurity] Denied GM tool '{toolName}' for wallet={Truncate(player.AccountWallet)} " +
            $"char='{player.CharacterName}' traveler={player.TravelerMode}.");
        return true;
    }

    /// <summary>Constant-time string compare for auth tokens (UTF-8 bytes).</summary>
    public static bool FixedTimeEqualsUtf8(string a, string b) {
        var ba = Encoding.UTF8.GetBytes(a ?? "");
        var bb = Encoding.UTF8.GetBytes(b ?? "");
        if (ba.Length != bb.Length) {
            // Still run a compare to reduce length oracle slightly.
            return CryptographicOperations.FixedTimeEquals(ba, ba) & false;
        }
        return CryptographicOperations.FixedTimeEquals(ba, bb);
    }

    static HashSet<string> GetAllowlist() {
        var raw = Environment.GetEnvironmentVariable("GM_WALLET_ALLOWLIST")
                  ?? Environment.GetEnvironmentVariable("GM_WALLETS")
                  ?? "";
        lock (Gate) {
            if (allowlistCache is not null && string.Equals(allowlistRawCache, raw, StringComparison.Ordinal)) {
                return allowlistCache;
            }
            var set = new HashSet<string>(StringComparer.Ordinal);
            foreach (var part in raw.Split(new[] { ',', ';', ' ', '\t', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)) {
                var w = part.Trim();
                if (w.Length >= 32) {
                    set.Add(w);
                }
            }
            allowlistRawCache = raw;
            allowlistCache = set;
            return set;
        }
    }

    static string Truncate(string? wallet) {
        if (string.IsNullOrEmpty(wallet)) {
            return "(none)";
        }
        return wallet.Length <= 8 ? wallet : wallet[..6] + "…";
    }
}
