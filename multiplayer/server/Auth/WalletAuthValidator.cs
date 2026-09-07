using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Server.Auth;

/// <summary>
/// Validates wallet session tokens issued by middleware-node (HMAC).
/// Prefers v2 JSON claims (<c>playerId</c>, <c>actorKind</c>, <c>boundChains</c>); falls back to legacy <c>wallet:exp</c>.
/// </summary>
public static class WalletAuthValidator {
    private static readonly JsonSerializerOptions SessionJsonOptions = new() {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public static bool IsRequired =>
        !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("WALLET_AUTH_SECRET"));

    /// <summary>True when ASPNETCORE_ENVIRONMENT / DOTNET_ENVIRONMENT / NODE_ENV is production.</summary>
    public static bool IsProductionHost {
        get {
            return IsProductionValue(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"))
                || IsProductionValue(Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT"))
                || IsProductionValue(Environment.GetEnvironmentVariable("NODE_ENV"));
        }
    }

    /// <summary>Fail-closed at process start: production must have <c>WALLET_AUTH_SECRET</c>.</summary>
    public static void EnsureProductionSecretOrThrow() {
        if (IsProductionHost && !IsRequired) {
            throw new InvalidOperationException(
                "WALLET_AUTH_SECRET is required in production (fail-closed). " +
                "ALLOW_INSECURE_AUTH is forbidden in production.");
        }
    }

    /// <summary>SoT claims copied from a validated session v2 token. Legacy tokens yield empty player id + human.</summary>
    public readonly record struct WalletSessionClaims(string PlayerId, string ActorKind);

    public static bool TryValidate(string walletPubkey, string authToken, out string? errorMessage) {
        return TryValidate(walletPubkey, authToken, out errorMessage, out _);
    }

    public static bool TryValidate(
        string walletPubkey,
        string authToken,
        out string? errorMessage,
        out WalletSessionClaims claims) {
        errorMessage = null;
        claims = new WalletSessionClaims("", "human");

        if (!IsRequired) {
            if (IsProductionHost) {
                errorMessage =
                    "Server misconfiguration: WALLET_AUTH_SECRET is required in production. " +
                    "ALLOW_INSECURE_AUTH is forbidden in production.";
                return false;
            }

            var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "";
            var allowInsecure = string.Equals(
                Environment.GetEnvironmentVariable("ALLOW_INSECURE_AUTH"),
                "1",
                StringComparison.OrdinalIgnoreCase)
                || string.Equals(
                    Environment.GetEnvironmentVariable("ALLOW_INSECURE_AUTH"),
                    "true",
                    StringComparison.OrdinalIgnoreCase);
            if (string.Equals(env, "Development", StringComparison.OrdinalIgnoreCase) || allowInsecure) {
                return true;
            }
            errorMessage =
                "Server misconfiguration: WALLET_AUTH_SECRET is required outside Development. " +
                "Set the secret (shared with middleware) or ALLOW_INSECURE_AUTH=1 for emergency local only.";
            return false;
        }

        if (string.IsNullOrWhiteSpace(walletPubkey)) {
            errorMessage = "Wallet id is required when wallet auth is enabled.";
            return false;
        }

        if (string.IsNullOrWhiteSpace(authToken)) {
            errorMessage = "Wallet auth token is required.";
            return false;
        }

        var parts = authToken.Split('.', 2);
        if (parts.Length != 2) {
            errorMessage = "Invalid auth token format.";
            return false;
        }

        string payload;
        try {
            payload = Encoding.UTF8.GetString(Convert.FromBase64String(PadBase64(parts[0])));
        } catch (FormatException) {
            errorMessage = "Invalid auth token payload.";
            return false;
        }

        var secret = Environment.GetEnvironmentVariable("WALLET_AUTH_SECRET")?.Trim();
        if (string.IsNullOrEmpty(secret)) {
            errorMessage = "Server misconfiguration: WALLET_AUTH_SECRET is required.";
            return false;
        }

        var expectedSig = Convert.ToBase64String(
            HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(payload)))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');

        // Constant-time signature compare (mitigates timing oracle on token sig).
        if (!FixedTimeEqualsAscii(parts[1], expectedSig)) {
            errorMessage = "Auth token signature mismatch.";
            return false;
        }

        if (payload.StartsWith('{')) {
            return TryValidateV2(walletPubkey.Trim(), payload, out errorMessage, out claims);
        }

        return TryValidateLegacy(walletPubkey.Trim(), payload, out errorMessage, out claims);
    }

    private static bool TryValidateV2(
        string walletPubkey,
        string payload,
        out string? errorMessage,
        out WalletSessionClaims claims) {
        claims = new WalletSessionClaims("", "human");
        errorMessage = null;
        SessionV2? session;
        try {
            session = JsonSerializer.Deserialize<SessionV2>(payload, SessionJsonOptions);
        } catch (JsonException) {
            errorMessage = "Invalid auth token payload.";
            return false;
        }

        if (session is null || session.V != 2 || string.IsNullOrWhiteSpace(session.PlayerId)) {
            errorMessage = "Invalid auth token payload.";
            return false;
        }

        if (session.Exp <= DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()) {
            errorMessage = "Auth token expired or wallet mismatch.";
            return false;
        }

        var wallets = session.Wallets ?? Array.Empty<SessionWalletV2>();
        var boundChains = session.BoundChains;
        if (boundChains is null || boundChains.Length == 0) {
            boundChains = wallets
                .Select(w => w.ChainId)
                .OfType<string>()
                .Where(c => c.Length > 0)
                .Distinct(StringComparer.Ordinal)
                .ToArray();
        }

        // Bind-before-world: enroll-bot / register without a wallet bind cannot enter the world.
        if (boundChains.Length == 0 || wallets.Length == 0) {
            errorMessage = "Wallet binding required before entering the world.";
            return false;
        }

        if (!SessionIncludesWallet(wallets, walletPubkey)) {
            errorMessage = "Auth token expired or wallet mismatch.";
            return false;
        }

        var actorKind = string.Equals(session.ActorKind, "bot", StringComparison.OrdinalIgnoreCase)
            ? "bot"
            : "human";
        claims = new WalletSessionClaims(session.PlayerId.Trim(), actorKind);
        return true;
    }

    private static bool TryValidateLegacy(
        string walletPubkey,
        string payload,
        out string? errorMessage,
        out WalletSessionClaims claims) {
        claims = new WalletSessionClaims("", "human");
        var segments = payload.Split(':', 2);
        if (segments.Length != 2 ||
            !string.Equals(segments[0], walletPubkey, StringComparison.Ordinal) ||
            !long.TryParse(segments[1], out var expiresAtMs) ||
            expiresAtMs <= DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()) {
            errorMessage = "Auth token expired or wallet mismatch.";
            return false;
        }

        errorMessage = null;
        return true;
    }

    private static bool SessionIncludesWallet(SessionWalletV2[] wallets, string walletPubkey) {
        foreach (var w in wallets) {
            var addr = w.Address ?? "";
            if (addr.Length == 0) {
                continue;
            }
            if (string.Equals(addr, walletPubkey, StringComparison.Ordinal)
                || string.Equals(addr, walletPubkey, StringComparison.OrdinalIgnoreCase)) {
                return true;
            }
        }
        return false;
    }

    private static bool IsProductionValue(string? value) {
        return string.Equals(value, "Production", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "production", StringComparison.OrdinalIgnoreCase);
    }

    private static bool FixedTimeEqualsAscii(string a, string b) {
        var ba = Encoding.UTF8.GetBytes(a ?? "");
        var bb = Encoding.UTF8.GetBytes(b ?? "");
        if (ba.Length != bb.Length) {
            _ = CryptographicOperations.FixedTimeEquals(ba, ba);
            return false;
        }
        return CryptographicOperations.FixedTimeEquals(ba, bb);
    }

    private static string PadBase64(string base64Url) {
        var padded = base64Url.Replace('-', '+').Replace('_', '/');
        return padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
    }

    private sealed class SessionV2 {
        [JsonPropertyName("v")]
        public int V { get; set; }

        public string? PlayerId { get; set; }

        public string? ActorKind { get; set; }

        public string[]? BoundChains { get; set; }

        public SessionWalletV2[]? Wallets { get; set; }

        public long Exp { get; set; }
    }

    private sealed class SessionWalletV2 {
        public string? ChainId { get; set; }

        public string? Address { get; set; }
    }
}
