using System.Net;
using Server.Helpers;
using Xunit;

namespace Server.Tests;

/// <summary>Playtest door must stay inert unless PLAYTEST=1. Env mutations are serialized.</summary>
[Collection("PlaytestEnv")]
public sealed class PlaytestModeTests {
    [Fact]
    public void IsEnabledFlag_IsFalse_WhenUnsetOrJunk() {
        Assert.False(PlaytestMode.IsEnabledFlag(null));
        Assert.False(PlaytestMode.IsEnabledFlag(""));
        Assert.False(PlaytestMode.IsEnabledFlag("0"));
        Assert.False(PlaytestMode.IsEnabledFlag("false"));
        Assert.False(PlaytestMode.IsEnabledFlag("production"));
    }

    [Fact]
    public void IsEnabledFlag_IsTrue_OnlyForExplicitOnValues() {
        Assert.True(PlaytestMode.IsEnabledFlag("1"));
        Assert.True(PlaytestMode.IsEnabledFlag("true"));
        Assert.True(PlaytestMode.IsEnabledFlag("YES"));
    }

    [Fact]
    public void TryValidate_WhenPlaytestUnset_IsInertEvenWithBypassToken() {
        using (PlaytestEnv.Set(null)) {
            Assert.False(PlaytestMode.IsEnabled);
            Assert.False(PlaytestMode.TryValidate("playtest-a", PlaytestMode.AuthToken, out _, out var error));
            Assert.Equal("Playtest door is off.", error);
            Assert.False(PlaytestMode.LoopbackBindConfirmed);
            Assert.False(PlaytestMode.TryResolveSeededGuild("playtest-a", out var guildId, out _));
            Assert.Equal("", guildId);
            Assert.Equal("Chars", PlaytestMode.CharsDirectoryName);
        }
    }

    [Fact]
    public void TryAuthorize_WhenPlaytestUnset_DoesNotAcceptBypassTokenAsWallet() {
        using (PlaytestEnv.Set(null)) {
        // Without WALLET_AUTH_SECRET and without Development/ALLOW_INSECURE, this fails closed.
        var previousEnv = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        var previousInsecure = Environment.GetEnvironmentVariable("ALLOW_INSECURE_AUTH");
        var previousSecret = Environment.GetEnvironmentVariable("WALLET_AUTH_SECRET");
        try {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Staging");
            Environment.SetEnvironmentVariable("ALLOW_INSECURE_AUTH", null);
            Environment.SetEnvironmentVariable("WALLET_AUTH_SECRET", null);
            Assert.False(PlaytestMode.TryAuthorize("playtest-a", PlaytestMode.AuthToken, out _));
        } finally {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", previousEnv);
            Environment.SetEnvironmentVariable("ALLOW_INSECURE_AUTH", previousInsecure);
            Environment.SetEnvironmentVariable("WALLET_AUTH_SECRET", previousSecret);
        }
        }
    }

    [Fact]
    public void Seed_WhenPlaytestOn_PutsAAndCInSameGuild_BInAnother_NoPartyOnSeats() {
        using (PlaytestEnv.Set("1")) {
        PlaytestMode.ConfirmLoopbackBind(PlaytestMode.ListenUrl);
        Assert.True(PlaytestMode.LoopbackBindConfirmed);
        Assert.True(PlaytestMode.IsEnabled);
        Assert.True(PlaytestMode.TryGetSeatByKey("a", out var seatA));
        Assert.True(PlaytestMode.TryGetSeatByKey("b", out var seatB));
        Assert.True(PlaytestMode.TryGetSeatByKey("c", out var seatC));
        Assert.True(PlaytestMode.TryGetSeatByKey("elon", out var elon));
        Assert.Equal(seatA.AccountId, elon.AccountId);

        Assert.Equal(PlaytestMode.QaGuildOneId, seatA.GuildId);
        Assert.Equal(PlaytestMode.QaGuildOneId, seatC.GuildId);
        Assert.Equal(PlaytestMode.QaGuildTwoId, seatB.GuildId);
        Assert.Equal(seatA.GuildId, seatC.GuildId);
        Assert.NotEqual(seatA.GuildId, seatB.GuildId);
        Assert.NotEqual(seatA.CharacterName, seatB.CharacterName);
        Assert.NotEqual(seatA.AccountId, seatC.AccountId);

        Assert.True(PlaytestMode.TryValidate(seatA.AccountId, PlaytestMode.AuthToken, out var validated, out _));
        Assert.Equal("ElonQa", validated.CharacterName);
        Assert.False(PlaytestMode.TryValidate("random-wallet", PlaytestMode.AuthToken, out _, out _));

        Assert.True(PlaytestMode.TryResolveSeededGuild(seatA.AccountId, out var guildA, out _));
        Assert.True(PlaytestMode.TryResolveSeededGuild(seatC.AccountId, out var guildC, out _));
        Assert.True(PlaytestMode.TryResolveSeededGuild(seatB.AccountId, out var guildB, out _));
        Assert.Equal(guildA, guildC);
        Assert.NotEqual(guildA, guildB);
        Assert.Equal("CharsPlaytest", PlaytestMode.CharsDirectoryName);
        }
    }

    [Fact]
    public void TryValidate_WhenPlaytestOnWithoutLoopbackBind_StaysInert() {
        using (PlaytestEnv.Set("1")) {
            PlaytestMode.ResetLoopbackBindConfirmation();
            Assert.False(PlaytestMode.TryValidate("playtest-a", PlaytestMode.AuthToken, out _, out var error));
            Assert.Equal("Playtest door refused: server is not bound to loopback only.", error);
        }
    }

    [Fact]
    public void ConfirmLoopbackBind_WhenPlaytestOn_RejectsNonLoopbackAndWildcard() {
        using (PlaytestEnv.Set("1")) {
            Assert.False(PlaytestMode.IsLoopbackOnlyListenUrl("http://0.0.0.0:31337", out _));
            Assert.False(PlaytestMode.IsLoopbackOnlyListenUrl("http://*:31337", out _));
            Assert.False(PlaytestMode.IsLoopbackOnlyListenUrl("http://+:1337", out _));
            Assert.False(PlaytestMode.IsLoopbackOnlyListenUrl("http://8.8.8.8:31337", out _));
            Assert.True(PlaytestMode.IsLoopbackOnlyListenUrl("http://127.0.0.1:31337", out _));
            Assert.True(PlaytestMode.IsLoopbackOnlyListenUrl("http://[::1]:31337", out _));
            Assert.True(PlaytestMode.IsLoopbackOnlyListenUrl("http://localhost:31337", out _));

            var thrown = Assert.Throws<InvalidOperationException>(
                () => PlaytestMode.ConfirmLoopbackBind("http://0.0.0.0:31337"));
            Assert.Contains("loopback only", thrown.Message, StringComparison.Ordinal);
            Assert.False(PlaytestMode.LoopbackBindConfirmed);
        }
    }

    [Fact]
    public void ConfirmLoopbackBind_WhenPlaytestUnset_DoesNotThrowOnPublicBind() {
        using (PlaytestEnv.Set(null)) {
            PlaytestMode.ConfirmLoopbackBind("http://0.0.0.0:1337");
            Assert.False(PlaytestMode.LoopbackBindConfirmed);
        }
    }

    [Fact]
    public void ThrowIfUnsafeConfiguration_WhenPlaytestOn_RejectsAspNetCoreUrlsOverride() {
        using (PlaytestEnv.Set("1")) {
            var previousUrls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS");
            var previousEnv = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
            string[] secretNames = ["WALLET_AUTH_SECRET", "DATABASE_URL", "HELL_MINT", "MARKET_MIDDLEWARE_URL", "SOLANA_RPC_URL"];
            var previousSecrets = secretNames.ToDictionary(n => n, Environment.GetEnvironmentVariable);
            try {
                Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Development");
                foreach (var name in secretNames) {
                    Environment.SetEnvironmentVariable(name, null);
                }
                Environment.SetEnvironmentVariable("ASPNETCORE_URLS", "http://0.0.0.0:31337");
                var thrown = Assert.Throws<InvalidOperationException>(PlaytestMode.ThrowIfUnsafeConfiguration);
                Assert.Contains("ASPNETCORE_URLS", thrown.Message, StringComparison.Ordinal);
            } finally {
                Environment.SetEnvironmentVariable("ASPNETCORE_URLS", previousUrls);
                Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", previousEnv);
                foreach (var kv in previousSecrets) {
                    Environment.SetEnvironmentVariable(kv.Key, kv.Value);
                }
                PlaytestMode.ResetLoopbackBindConfirmation();
            }
        }
    }

    [Fact]
    public void IsLoopback_AcceptsV4AndV6() {
        Assert.True(PlaytestMode.IsLoopback(IPAddress.Loopback));
        Assert.True(PlaytestMode.IsLoopback(IPAddress.IPv6Loopback));
        Assert.False(PlaytestMode.IsLoopback(IPAddress.Parse("8.8.8.8")));
        Assert.False(PlaytestMode.IsLoopback(null));
    }
}

[CollectionDefinition("PlaytestEnv", DisableParallelization = true)]
public sealed class PlaytestEnvCollection : ICollectionFixture<PlaytestEnv> {
}

/// <summary>Restores PLAYTEST after each test that mutates it.</summary>
public sealed class PlaytestEnv : IDisposable {
    public static IDisposable Set(string? value) => new PlaytestEnvScope(value);

    public void Dispose() {
    }

    sealed class PlaytestEnvScope : IDisposable {
        readonly string? previous;

        public PlaytestEnvScope(string? value) {
            previous = Environment.GetEnvironmentVariable("PLAYTEST");
            Environment.SetEnvironmentVariable("PLAYTEST", value);
        }

        public void Dispose() {
            Environment.SetEnvironmentVariable("PLAYTEST", previous);
            PlaytestMode.ResetLoopbackBindConfirmation();
        }
    }
}
