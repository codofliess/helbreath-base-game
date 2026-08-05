using System.Security.Cryptography;
using System.Text;

namespace Server.Auth;

/// <summary>Validates wallet session tokens issued by middleware-node after Sign-In With Solana.</summary>
public static class WalletAuthValidator {
    public static bool IsRequired =>
        !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("WALLET_AUTH_SECRET"));

    public static bool TryValidate(string walletPubkey, string authToken, out string? errorMessage) {
        errorMessage = null;

        if (!IsRequired) {
            // Fail closed outside Development: missing WALLET_AUTH_SECRET = open account takeover.
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

        var secret = Environment.GetEnvironmentVariable("WALLET_AUTH_SECRET")
            ?? throw new InvalidOperationException("WALLET_AUTH_SECRET must be set when wallet auth is required.");

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

        var segments = payload.Split(':', 2);
        if (segments.Length != 2 ||
            !string.Equals(segments[0], walletPubkey, StringComparison.Ordinal) ||
            !long.TryParse(segments[1], out var expiresAtMs) ||
            expiresAtMs <= DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()) {
            errorMessage = "Auth token expired or wallet mismatch.";
            return false;
        }

        return true;
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
        var padded = base64Url.Replace('-', '+').Replace('/', '_');
        return padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
    }
}
