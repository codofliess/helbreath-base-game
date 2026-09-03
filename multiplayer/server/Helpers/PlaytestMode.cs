namespace Server.Helpers;

/// <summary>
/// Isolated playtest door (<c>PLAYTEST=1</c>): no Phantom, no live wallets, no $HELL.
/// Must never run on the public game host. Refuses to start if production secrets/DB/mint are set.
/// </summary>
public static class PlaytestMode {
    /// <summary>Isolated account id (not a Solana pubkey). Saves go under CharsPlaytest/.</summary>
    public const string AccountId = "playtest-elonqa";

    /// <summary>Token accepted only when <see cref="IsEnabled"/>; never a live HMAC session.</summary>
    public const string AuthToken = "playtest-bypass-token";

    /// <summary>Display name distinct from live traveler characters (2–10 letters/digits).</summary>
    public const string CharacterName = "ElonQa";

    /// <summary>True when this process is the isolated playtest door.</summary>
    public static bool IsEnabled {
        get {
            var flag = Environment.GetEnvironmentVariable("PLAYTEST") ?? "";
            return flag is "1" or "true" or "TRUE" or "yes" or "YES";
        }
    }

    /// <summary>JSON save directory name so playtest never writes live <c>Chars/</c>.</summary>
    public static string CharsDirectoryName => IsEnabled ? "CharsPlaytest" : "Chars";

    /// <summary>True when this wallet id is the isolated playtest account.</summary>
    public static bool IsIsolatedAccount(string? walletPubkey) {
        return string.Equals((walletPubkey ?? "").Trim(), AccountId, StringComparison.Ordinal);
    }

    /// <summary>
    /// Accepts only the isolated playtest account+token. When playtest is on, every other
    /// id/token is rejected (Development must not become an open wallet spoof).
    /// </summary>
    public static bool TryValidate(string walletPubkey, string authToken, out string? errorMessage) {
        errorMessage = null;
        if (!IsEnabled) {
            return false;
        }

        if (IsIsolatedAccount(walletPubkey) &&
            string.Equals((authToken ?? "").Trim(), AuthToken, StringComparison.Ordinal)) {
            return true;
        }

        errorMessage = "Playtest door only accepts the isolated ElonQa account (no wallets).";
        return false;
    }

    /// <summary>
    /// Abort if PLAYTEST=1 is combined with live auth, Postgres, $HELL mint, or market middleware.
    /// No-op when playtest is off.
    /// </summary>
    public static void ThrowIfUnsafeConfiguration() {
        if (!IsEnabled) {
            return;
        }

        static bool Set(string name) =>
            !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(name));

        if (Set("WALLET_AUTH_SECRET") ||
            Set("HELL_MINT") ||
            Set("MARKET_MIDDLEWARE_URL")) {
            throw new InvalidOperationException(
                "PLAYTEST=1 refuses to start with WALLET_AUTH_SECRET, HELL_MINT, or MARKET_MIDDLEWARE_URL. " +
                "This door is isolated from live. Unset those variables (do not point this process at Hetzner/Railway prod).");
        }

        if (Set("DATABASE_URL") || Set("POSTGRES_CONNECTION_STRING")) {
            Console.WriteLine(
                "[PLAYTEST] DATABASE_URL is set but will be ignored — ElonQa is JSON-only under " +
                $"./{CharsDirectoryName}/ (Postgres character list must not win).");
        }

        Console.WriteLine(
            $"[PLAYTEST] Isolated door ON. account={AccountId} char={CharacterName} saves=./{CharsDirectoryName}/ " +
            "JSON kit wins over Postgres. No Phantom, no $HELL, no airdrop. Do not bind this process to play.chainlords.net.");
    }
}
