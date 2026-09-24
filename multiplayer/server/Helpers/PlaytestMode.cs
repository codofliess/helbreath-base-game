using System.Net;
using System.Net.Sockets;

namespace Server.Helpers;

/// <summary>
/// Isolated playtest door (PLAYTEST=1): loopback only, no wallets, no live secrets.
/// Each seat is a distinct account and character. Saves never touch live <c>Chars/</c>.
/// </summary>
public static class PlaytestMode {
    /// <summary>Shared bypass token — accepted only when <see cref="IsEnabled"/>.</summary>
    public const string AuthToken = "playtest-bypass-token";

    /// <summary>Game listener when the door is on. Not the live <c>Settings.json</c> port.</summary>
    public const int ListenPort = 31337;

    public const string ListenUrl = "http://127.0.0.1:31337";

    public readonly record struct Seat(string SeatKey, string AccountId, string CharacterName, string AgentLabel);

    /// <summary>One distinct character per sandbox seat. Account id is the authenticate <c>id</c>.</summary>
    public static readonly Seat[] Seats = [
        new("elon", "playtest-elonqa", "ElonQa", "Elon"),
        new("maggy", "playtest-maggy", "MaggyQa", "Maggy"),
        new("pist", "playtest-pist", "PistQa", "PIST"),
        new("stalk", "playtest-stalk", "StalkQa", "Stalk Bot"),
        new("pulpo", "playtest-pulpo", "PulpoQa", "Pulpo"),
        new("proj", "playtest-proj", "ProjQa", "Projects Manager"),
        new("paio", "playtest-paio", "PaioQa", "PaioPez"),
    ];

    public static bool IsEnabled {
        get {
            var flag = Environment.GetEnvironmentVariable("PLAYTEST") ?? "";
            return flag is "1" or "true" or "TRUE" or "yes" or "YES";
        }
    }

    /// <summary>JSON save directory so playtest never writes live <c>Chars/</c>.</summary>
    public static string CharsDirectoryName => IsEnabled ? "CharsPlaytest" : "Chars";

    public static bool IsLoopback(IPAddress? address) {
        if (address is null) {
            return false;
        }
        if (IPAddress.IsLoopback(address)) {
            return true;
        }
        if (address.AddressFamily == AddressFamily.InterNetworkV6 && address.IsIPv4MappedToIPv6) {
            return IPAddress.IsLoopback(address.MapToIPv4());
        }
        return false;
    }

    public static bool TryGetSeatByAccount(string? accountId, out Seat seat) {
        seat = default;
        var id = (accountId ?? "").Trim();
        if (id.Length == 0) {
            return false;
        }
        foreach (var candidate in Seats) {
            if (string.Equals(candidate.AccountId, id, StringComparison.Ordinal)) {
                seat = candidate;
                return true;
            }
        }
        return false;
    }

    public static bool IsSeatCharacter(string? characterName) {
        var name = (characterName ?? "").Trim();
        if (name.Length == 0) {
            return false;
        }
        foreach (var candidate in Seats) {
            if (string.Equals(candidate.CharacterName, name, StringComparison.Ordinal)) {
                return true;
            }
        }
        return false;
    }

    /// <summary>
    /// Accepts only an allowlisted account plus the shared bypass token.
    /// </summary>
    public static bool TryValidate(string? accountId, string? authToken, out Seat seat, out string? errorMessage) {
        seat = default;
        errorMessage = null;
        if (!IsEnabled) {
            errorMessage = "Playtest door is off.";
            return false;
        }
        if (!string.Equals((authToken ?? "").Trim(), AuthToken, StringComparison.Ordinal)) {
            errorMessage = "Playtest door rejected the auth token.";
            return false;
        }
        if (!TryGetSeatByAccount(accountId, out seat)) {
            errorMessage = "Playtest door only accepts isolated seat accounts.";
            return false;
        }
        return true;
    }

    /// <summary>
    /// Abort if PLAYTEST=1 is combined with live auth, Postgres, a token mint, or market middleware.
    /// </summary>
    public static void ThrowIfUnsafeConfiguration() {
        if (!IsEnabled) {
            return;
        }

        static bool Set(string name) =>
            !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(name));

        if (Set("WALLET_AUTH_SECRET") ||
            Set("DATABASE_URL") ||
            Set("HELL_MINT") ||
            Set("MARKET_MIDDLEWARE_URL") ||
            Set("SOLANA_RPC_URL")) {
            throw new InvalidOperationException(
                "PLAYTEST=1 refuses to start with WALLET_AUTH_SECRET, DATABASE_URL, HELL_MINT, MARKET_MIDDLEWARE_URL, or SOLANA_RPC_URL. " +
                "This door is isolated from live. Unset those variables.");
        }

        var seatList = string.Join(", ", Array.ConvertAll(Seats, s => $"{s.SeatKey}={s.CharacterName}"));
        Console.WriteLine(
            $"[PLAYTEST] Isolated multi-seat door ON. listen={ListenUrl} seats=[{seatList}] saves=./{CharsDirectoryName}/ " +
            "No wallet, no middleware. Loopback only.");
    }
}
