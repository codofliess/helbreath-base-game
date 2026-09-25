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
        using var _ = PlaytestEnv.Set(null);
        Assert.False(PlaytestMode.IsEnabled);
        Assert.False(PlaytestMode.TryValidate("playtest-a", PlaytestMode.AuthToken, out _, out var error));
        Assert.Equal("Playtest door is off.", error);
        Assert.False(PlaytestMode.TryResolveSeededGuild("playtest-a", out var guildId, out _));
        Assert.Equal("", guildId);
        Assert.Equal("Chars", PlaytestMode.CharsDirectoryName);
    }

    [Fact]
    public void TryAuthorize_WhenPlaytestUnset_DoesNotAcceptBypassTokenAsWallet() {
        using var _ = PlaytestEnv.Set(null);
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

    [Fact]
    public void Seed_WhenPlaytestOn_PutsAAndCInSameGuild_BInAnother_NoPartyOnSeats() {
        using var _ = PlaytestEnv.Set("1");
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
        }
    }
}
