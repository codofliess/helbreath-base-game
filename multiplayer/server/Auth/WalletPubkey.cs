namespace Server.Auth;

/// <summary>Lightweight Solana wallet pubkey shape checks (base58, no UUID/hyphens).</summary>
public static class WalletPubkey {
    public static bool IsLikelySolanaPubkey(string? value) {
        if (string.IsNullOrWhiteSpace(value)) {
            return false;
        }

        var trimmed = value.Trim();
        if (trimmed.Length is < 32 or > 44) {
            return false;
        }

        if (trimmed.Contains('-')) {
            return false;
        }

        return IsBase58(trimmed);
    }

    static bool IsBase58(ReadOnlySpan<char> value) {
        foreach (var ch in value) {
            if (!IsBase58Char(ch)) {
                return false;
            }
        }

        return true;
    }

    static bool IsBase58Char(char ch) =>
        ch is >= '1' and <= '9'
            or >= 'A' and <= 'H'
            or >= 'J' and <= 'N'
            or >= 'P' and <= 'Z'
            or >= 'a' and <= 'k'
            or >= 'm' and <= 'z';
}
