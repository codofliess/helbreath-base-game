using Server.Helpers;
using Xunit;

namespace Server.Tests;

public sealed class MobSpecialtyTests {
    public MobSpecialtyTests() {
        var candidates = new[] {
            Path.Combine(AppContext.BaseDirectory, "Config"),
            Path.Combine(Directory.GetCurrentDirectory(), "Config"),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "server", "Config")),
        };
        var configDir = candidates.FirstOrDefault(d => File.Exists(Path.Combine(d, "MobSpecialties.json")))
            ?? candidates[0];
        MobSpecialty.Initialize(configDir);
    }

    const int OrcId = 40;
    const int SlimeId = 1;
    const int EttinId = 0;

    [Fact]
    public void StakeBonus_ZeroAndSteps() {
        Assert.Equal("$HELBREATH", MobSpecialty.StakeTokenTicker);
        Assert.Equal(20_000L, MobSpecialty.StakePerLevel);
        Assert.Equal(0, MobSpecialty.StakeBonusLevels(0));
        Assert.Equal(0, MobSpecialty.StakeBonusLevels(19_999));
        Assert.Equal(1, MobSpecialty.StakeBonusLevels(20_000));
        Assert.Equal(10, MobSpecialty.StakeBonusLevels(200_000));
        Assert.Equal(12, MobSpecialty.StakeBonusLevels(240_000));
        Assert.Equal(0, MobSpecialty.EffectiveLevel(0, 0));
        Assert.Equal(1, MobSpecialty.EffectiveLevel(0, 20_000));
        Assert.Equal(10, MobSpecialty.EffectiveLevel(0, 200_000));
    }

    [Fact]
    public void EarlyGroup_Kill8Plus240kStake_Is20OnEveryMember() {
        Assert.Equal("early", MobSpecialty.GroupKeyFor(OrcId));
        Assert.Equal("early", MobSpecialty.GroupKeyFor(SlimeId));
        Assert.Equal("mid_frost", MobSpecialty.GroupKeyFor(EttinId));

        var baseKills = MobSpecialty.GetDef(OrcId).BaseKills;
        Assert.Equal(125, baseKills);
        var killsFor8 = MobSpecialty.ThresholdForLevel(baseKills, 8);
        Assert.Equal(125L * 64, killsFor8);
        Assert.Equal(8, MobSpecialty.SpecialtyLevelFromKills(killsFor8, baseKills));

        var kills = new Dictionary<int, long> { [OrcId] = killsFor8 };
        var orc = MobSpecialty.ComputeFromKills(kills, OrcId, 240_000);
        var slime = MobSpecialty.ComputeFromKills(kills, SlimeId, 240_000);
        var ettin = MobSpecialty.ComputeFromKills(kills, EttinId, 240_000);

        Assert.Equal(8, orc.SpecialtyLevel);
        Assert.Equal(12, orc.StakeBonusLevels);
        Assert.Equal(20, orc.EffectiveLevel);
        Assert.Equal(8, slime.SpecialtyLevel);
        Assert.Equal(20, slime.EffectiveLevel);
        Assert.Equal(0, ettin.SpecialtyLevel);
        Assert.Equal(12, ettin.StakeBonusLevels);
        Assert.Equal(12, ettin.EffectiveLevel);
    }

    [Fact]
    public void GroupedModel_OrcKillsRaiseSlime_NotEttin() {
        var kills = new Dictionary<int, long> { [OrcId] = MobSpecialty.ThresholdForLevel(125, 3) };
        var slime = MobSpecialty.ComputeFromKills(kills, SlimeId, 0);
        var ettin = MobSpecialty.ComputeFromKills(kills, EttinId, 0);
        Assert.Equal(3, slime.SpecialtyLevel);
        Assert.Equal(3, slime.EffectiveLevel);
        Assert.Equal(0, ettin.SpecialtyLevel);
        Assert.Equal(0, ettin.EffectiveLevel);
    }

    [Fact]
    public void NoStake_KillLevelOnly() {
        var kills = new Dictionary<int, long> { [OrcId] = MobSpecialty.ThresholdForLevel(125, 8) };
        var snap = MobSpecialty.ComputeFromKills(kills, OrcId, 0);
        Assert.Equal(8, snap.SpecialtyLevel);
        Assert.Equal(0, snap.StakeBonusLevels);
        Assert.Equal(8, snap.EffectiveLevel);
    }
}
