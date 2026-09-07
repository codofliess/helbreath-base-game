using Server.Helpers;
using Xunit;

namespace Server.Tests;

public sealed class GuildProgressionTests : IDisposable {
    public GuildProgressionTests() {
        GuildProgression.ResetForTests();
        var configDir = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "server", "Config"));
        if (File.Exists(Path.Combine(configDir, "GuildProgression.json"))) {
            GuildProgression.Initialize(configDir);
        }
    }

    public void Dispose() => GuildProgression.ResetForTests();

    [Fact]
    public void StakeBonus_StepsMatchPersonalTwentyK() {
        Assert.Equal("$HELBREATH", GuildProgression.StakeTokenTicker);
        Assert.Equal(20_000L, GuildProgression.StakePerGuildLevel);
        Assert.Equal(0, GuildProgression.StakeBonusLevels(0));
        Assert.Equal(0, GuildProgression.StakeBonusLevels(19_999));
        Assert.Equal(1, GuildProgression.StakeBonusLevels(20_000));
        Assert.Equal(10, GuildProgression.StakeBonusLevels(200_000));
        Assert.Equal(12, GuildProgression.StakeBonusLevels(240_000));
    }

    [Fact]
    public void Activity_ContributionEksGoldMajestics_MakeLevels() {
        // 800 + 20*80 + 200_000/10_000 + 10*25 = 2670 → L5 (2500) not L6 (3600)
        var points = GuildProgression.ActivityPoints(800, 20, 200_000, 10);
        Assert.Equal(2670, points);
        Assert.Equal(5, GuildProgression.ActivityLevelFromPoints(points));
        Assert.Equal(0, GuildProgression.ActivityLevelFromPoints(0));
        Assert.Equal(1, GuildProgression.ActivityLevelFromPoints(100));
    }

    [Fact]
    public void Effective_ActivityPlusCollectiveStake() {
        var snap = GuildProgression.Compute(800, 20, 200_000, 10, 240_000);
        Assert.Equal(5, snap.ActivityLevel);
        Assert.Equal(12, snap.StakeBonusLevels);
        Assert.Equal(17, snap.EffectiveLevel);
        Assert.Equal(6, snap.Huntmaster);
        Assert.Equal(5, snap.Raidmaster);
        Assert.Equal(6, snap.Captains);
        Assert.Contains("icebound", snap.Teleports);
        Assert.Contains("toh2", snap.Teleports);
        Assert.DoesNotContain("toh3", snap.Teleports);
    }

    [Fact]
    public void StakeOnly_StillUnlocksHuntmasterAndCaptains() {
        var snap = GuildProgression.Compute(0, 0, 0, 0, 200_000);
        Assert.Equal(0, snap.ActivityLevel);
        Assert.Equal(10, snap.StakeBonusLevels);
        Assert.Equal(10, snap.EffectiveLevel);
        Assert.Equal(5, snap.Huntmaster);
        Assert.Equal(4, snap.Raidmaster);
        Assert.Equal(5, snap.Captains);
        Assert.Contains("promiseland", snap.Teleports);
    }

    [Fact]
    public void MemberStakes_SumIntoGuildLevel() {
        GuildProgression.AddActivity("legion", contribution: 800, enemyKills: 20, gold: 200_000, majestics: 10);
        GuildProgression.RememberMemberStake("legion", "walletA", 80_000);
        GuildProgression.RememberMemberStake("legion", "walletB", 160_000);
        var snap = GuildProgression.ComputeGuild("legion");
        Assert.Equal(5, snap.ActivityLevel);
        Assert.Equal(12, snap.StakeBonusLevels);
        Assert.Equal(17, snap.EffectiveLevel);
        Assert.True(GuildProgression.CanGuildTeleport("legion", "icebound"));
        Assert.False(GuildProgression.CanGuildTeleport("legion", "toh3"));
    }

    [Fact]
    public void EmptyGuild_HallOnly() {
        var snap = GuildProgression.ComputeGuild("");
        Assert.Equal(0, snap.EffectiveLevel);
        Assert.Equal(0, snap.Captains);
        Assert.Contains("aregldhall", snap.Teleports);
        Assert.False(GuildProgression.CanGuildTeleport("", "middleland"));
    }
}
