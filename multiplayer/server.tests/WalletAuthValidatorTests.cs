using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Server.Auth;
using Xunit;

namespace Server.Tests;

public class WalletAuthValidatorTests {
    [Fact]
    public void TryValidate_V2BotSession_CopiesActorKindAndRejectsClientForgePath() {
        var secret = "agent-player-test-secret";
        var previous = Environment.GetEnvironmentVariable("WALLET_AUTH_SECRET");
        Environment.SetEnvironmentVariable("WALLET_AUTH_SECRET", secret);
        try {
            var wallet = "4R7FsyC85Yic3hGz7yWAt7HbV5A1qtC7UQi13Hsv5r7K";
            var token = SignV2(secret, new {
                v = 2,
                playerId = "11111111-1111-1111-1111-111111111111",
                actorKind = "bot",
                boundChains = new[] { "sol" },
                wallets = new[] { new { chainId = "sol", address = wallet } },
                exp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + 60_000,
            });

            var ok = WalletAuthValidator.TryValidate(wallet, token, out var error, out var claims);
            Assert.True(ok, error);
            Assert.Equal("bot", claims.ActorKind);
            Assert.Equal("11111111-1111-1111-1111-111111111111", claims.PlayerId);
        } finally {
            Environment.SetEnvironmentVariable("WALLET_AUTH_SECRET", previous);
        }
    }

    [Fact]
    public void TryValidate_V2WithoutWallets_RejectsBindBeforeWorld() {
        var secret = "agent-player-test-secret";
        var previous = Environment.GetEnvironmentVariable("WALLET_AUTH_SECRET");
        Environment.SetEnvironmentVariable("WALLET_AUTH_SECRET", secret);
        try {
            var token = SignV2(secret, new {
                v = 2,
                playerId = "11111111-1111-1111-1111-111111111111",
                actorKind = "bot",
                boundChains = Array.Empty<string>(),
                wallets = Array.Empty<object>(),
                exp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + 60_000,
            });

            var ok = WalletAuthValidator.TryValidate("any", token, out var error, out var claims);
            Assert.False(ok);
            Assert.Contains("Wallet binding", error, StringComparison.OrdinalIgnoreCase);
            Assert.Equal("human", claims.ActorKind);
        } finally {
            Environment.SetEnvironmentVariable("WALLET_AUTH_SECRET", previous);
        }
    }

    static string SignV2(string secret, object claims) {
        var json = JsonSerializer.Serialize(claims);
        var payloadB64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(json))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
        var sig = Convert.ToBase64String(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(json)))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
        return $"{payloadB64}.{sig}";
    }
}
