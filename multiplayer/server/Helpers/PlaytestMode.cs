using System.Net;
using System.Net.Sockets;
using Server.Auth;
using Server.World.Game;

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

    /// <summary>Persisted <see cref="GameWorldPlayer.GuildId"/> for seats A and C.</summary>
    public const string QaGuildOneId = "QA Guild One";

    /// <summary>Persisted <see cref="GameWorldPlayer.GuildId"/> for seat B (different guild; no party seed).</summary>
    public const string QaGuildTwoId = "QA Guild Two";

    public readonly record struct Seat(
        string SeatKey,
        string AccountId,
        string CharacterName,
        string AgentLabel,
        string GuildId,
        int GuildRank);

    /// <summary>
    /// Three simultaneous seats. A and C share <see cref="QaGuildOneId"/>; B is <see cref="QaGuildTwoId"/>.
    /// Party is never pre-formed. Aliases: elon→a, maggy→b, pist→c.
    /// </summary>
    public static readonly Seat[] Seats = [
        new("a", "playtest-a", "ElonQa", "Seat A (Elon)", QaGuildOneId, ItemBind.GuildRankMaster),
        new("b", "playtest-b", "MaggyQa", "Seat B (Maggy)", QaGuildTwoId, ItemBind.GuildRankMaster),
        new("c", "playtest-c", "PistQa", "Seat C (PIST)", QaGuildOneId, ItemBind.GuildRankMember),
    ];

    static readonly Dictionary<string, string> SeatAliases = new(StringComparer.OrdinalIgnoreCase) {
        ["elon"] = "a",
        ["maggy"] = "b",
        ["pist"] = "c",
    };

    public static bool IsEnabled {
        get {
            var flag = Environment.GetEnvironmentVariable("PLAYTEST") ?? "";
            return IsEnabledFlag(flag);
        }
    }

    /// <summary>Pure flag parse so tests can assert fail-closed without mutating process env when unused.</summary>
    public static bool IsEnabledFlag(string? flag) {
        var value = (flag ?? "").Trim();
        return value is "1" or "true" or "TRUE" or "yes" or "YES";
    }

    /// <summary>JSON save directory so playtest never writes live <c>Chars/</c>.</summary>
    public static string CharsDirectoryName => IsEnabled ? "CharsPlaytest" : "Chars";

    /// <summary>
    /// True only after <see cref="ConfirmLoopbackBind"/> accepted a 127.0.0.1/::1 listen URL.
    /// PLAYTEST=1 without this confirmation stays inert (no auth bypass).
    /// </summary>
    static bool loopbackBindConfirmed;

    public static bool LoopbackBindConfirmed => loopbackBindConfirmed;

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

    /// <summary>
    /// True when <paramref name="url"/> is HTTP(S) on 127.0.0.1, localhost, or ::1 only.
    /// Wildcards (<c>*</c>, <c>+</c>), <c>0.0.0.0</c>, <c>::</c>, and any public host fail closed.
    /// </summary>
    public static bool IsLoopbackOnlyListenUrl(string? url, out string? errorMessage) {
        errorMessage = null;
        var raw = (url ?? "").Trim();
        if (raw.Length == 0) {
            errorMessage = "listen URL is empty.";
            return false;
        }
        if (raw.Contains('*', StringComparison.Ordinal) || raw.Contains('+', StringComparison.Ordinal)) {
            errorMessage = $"listen URL '{raw}' is a wildcard bind, not loopback.";
            return false;
        }
        if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)) {
            errorMessage = $"listen URL '{raw}' is not an absolute http(s) URI.";
            return false;
        }
        var host = uri.IdnHost;
        if (string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)) {
            return true;
        }
        if (!IPAddress.TryParse(host, out var address) || !IsLoopback(address)) {
            errorMessage = $"listen URL '{raw}' binds '{host}', not 127.0.0.1/::1.";
            return false;
        }
        return true;
    }

    /// <summary>
    /// PLAYTEST=1 may listen only on loopback. Logs and throws otherwise; does not enable the bypass.
    /// No-op when PLAYTEST is unset (live bind 0.0.0.0 is unchanged).
    /// </summary>
    public static void ConfirmLoopbackBind(string? listenUrl) {
        if (!IsEnabled) {
            loopbackBindConfirmed = false;
            return;
        }
        if (!IsLoopbackOnlyListenUrl(listenUrl, out var errorMessage)) {
            loopbackBindConfirmed = false;
            var message =
                "PLAYTEST=1 refused to start: the game must bind loopback only (127.0.0.1 or ::1), " +
                $"regardless of the PLAYTEST flag. {errorMessage}";
            Console.Error.WriteLine($"[PLAYTEST] {message}");
            throw new InvalidOperationException(message);
        }
        loopbackBindConfirmed = true;
    }

    /// <summary>Clears bind confirmation (tests / process teardown).</summary>
    public static void ResetLoopbackBindConfirmation() {
        loopbackBindConfirmed = false;
    }

    static void ThrowIfUrlOverridesAreNotLoopback() {
        string[] names = ["ASPNETCORE_URLS", "DOTNET_URLS"];
        foreach (var name in names) {
            var raw = Environment.GetEnvironmentVariable(name);
            if (string.IsNullOrWhiteSpace(raw)) {
                continue;
            }
            foreach (var part in raw.Split([';', ','], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)) {
                if (!IsLoopbackOnlyListenUrl(part, out var errorMessage)) {
                    var message =
                        $"PLAYTEST=1 refused to start: {name}='{raw}' is not loopback-only. {errorMessage}";
                    Console.Error.WriteLine($"[PLAYTEST] {message}");
                    throw new InvalidOperationException(message);
                }
            }
        }
    }

    public static string CanonicalSeatKey(string? rawKey) {
        var key = (rawKey ?? "").Trim().ToLowerInvariant();
        if (key.Length == 0) {
            return "a";
        }
        if (SeatAliases.TryGetValue(key, out var mapped)) {
            return mapped;
        }
        return key;
    }

    public static bool TryGetSeatByKey(string? seatKey, out Seat seat) {
        seat = default;
        var key = CanonicalSeatKey(seatKey);
        foreach (var candidate in Seats) {
            if (string.Equals(candidate.SeatKey, key, StringComparison.OrdinalIgnoreCase)) {
                seat = candidate;
                return true;
            }
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
    /// When the door is off this always fails — the token is never a live auth path.
    /// </summary>
    public static bool TryValidate(string? accountId, string? authToken, out Seat seat, out string? errorMessage) {
        seat = default;
        errorMessage = null;
        if (!IsEnabled) {
            errorMessage = "Playtest door is off.";
            return false;
        }
        if (!loopbackBindConfirmed) {
            errorMessage = "Playtest door refused: server is not bound to loopback only.";
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
    /// PLAYTEST=1: only allowlisted seats. PLAYTEST unset: unchanged wallet HMAC path.
    /// Never falls through to Development insecure auth while the door is on.
    /// </summary>
    public static bool TryAuthorize(string? accountId, string? authToken, out string? errorMessage) {
        if (IsEnabled) {
            return TryValidate(accountId, authToken, out _, out errorMessage);
        }
        return WalletAuthValidator.TryValidate((accountId ?? "").Trim(), authToken ?? "", out errorMessage);
    }

    /// <summary>Guild id/rank for a seat when the door is on; otherwise inert.</summary>
    public static bool TryResolveSeededGuild(string? accountId, out string guildId, out int guildRank) {
        guildId = "";
        guildRank = 0;
        if (!IsEnabled) {
            return false;
        }
        if (!TryGetSeatByAccount(accountId, out var seat) || string.IsNullOrEmpty(seat.GuildId)) {
            return false;
        }
        guildId = seat.GuildId;
        guildRank = seat.GuildRank;
        return true;
    }

    /// <summary>Applies QA guild membership. No-op when PLAYTEST is unset. Does not form a party.</summary>
    public static void ApplyGuildSeed(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        if (!TryResolveSeededGuild(player.AccountWallet, out var guildId, out var guildRank)) {
            return;
        }
        player.SetGuildId(guildId);
        player.SetGuildRank(guildRank);
    }

    /// <summary>
    /// Abort if PLAYTEST=1 is combined with production, live auth, Postgres, a token mint, or market middleware.
    /// </summary>
    public static void ThrowIfUnsafeConfiguration() {
        if (!IsEnabled) {
            loopbackBindConfirmed = false;
            return;
        }

        if (WalletAuthValidator.IsProductionHost) {
            throw new InvalidOperationException(
                "PLAYTEST=1 is forbidden when ASPNETCORE_ENVIRONMENT / DOTNET_ENVIRONMENT / NODE_ENV is production.");
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

        ThrowIfUrlOverridesAreNotLoopback();
        ConfirmLoopbackBind(ListenUrl);

        var seatList = string.Join(", ", Array.ConvertAll(Seats, s => $"{s.SeatKey}={s.CharacterName}/{s.GuildId}"));
        Console.WriteLine(
            $"[PLAYTEST] Isolated multi-seat door ON. listen={ListenUrl} seats=[{seatList}] saves=./{CharsDirectoryName}/ " +
            "No wallet, no middleware, no party seed. Loopback only.");
    }
}
