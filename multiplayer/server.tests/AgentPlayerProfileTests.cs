using Server.Helpers;
using Server.World.Game;
using Xunit;

namespace Server.Tests;

public class AgentPlayerProfileTests {
    [Fact]
    public void TryBuild_HumanWithNoPayload_ReturnsNull() {
        var profile = AgentPlayerProfile.TryBuild(
            "human",
            "",
            [],
            starterPackId: null,
            nowMs: 1,
            defaultAgentWhenBotAccount: false);
        Assert.Null(profile);
    }

    [Fact]
    public void TryBuild_AgentWithoutSkills_GetsStarterPack() {
        var profile = AgentPlayerProfile.TryBuild(
            "agent",
            "  kite then para  ",
            [],
            starterPackId: null,
            nowMs: 10,
            defaultAgentWhenBotAccount: false);
        Assert.NotNull(profile);
        Assert.Equal(AgentPlayerProfile.ControllerAgent, profile!.ControllerKind);
        Assert.Equal("kite then para", profile.OwnerPrompt);
        Assert.Equal(AgentPlayerProfile.DefaultStarterPackId, profile.StarterPackId);
        Assert.Single(profile.Skills!);
        Assert.Equal(AgentPlayerProfile.DefaultStarterPackId, profile.Skills![0].SkillId);
    }

    [Fact]
    public void TryBuild_DropsUnknownSkillIdsAndInjectionControls() {
        var profile = AgentPlayerProfile.TryBuild(
            "agent",
            "hello\u0001world",
            [
                new PersistedAgentSkillSlot("starter.pvp.kite"),
                new PersistedAgentSkillSlot("not.a.skill"),
                new PersistedAgentSkillSlot("starter.pvp.kite"),
            ],
            starterPackId: "evil.pack",
            nowMs: 20,
            defaultAgentWhenBotAccount: false);
        Assert.NotNull(profile);
        Assert.Equal("helloworld", profile!.OwnerPrompt);
        Assert.Single(profile.Skills!);
        Assert.Equal("starter.pvp.kite", profile.Skills![0].SkillId);
        Assert.Equal("", profile.StarterPackId);
    }

    [Fact]
    public void TryBuild_BotAccountDefaultsToAgent() {
        var profile = AgentPlayerProfile.TryBuild(
            controllerKind: null,
            ownerPrompt: null,
            skills: null,
            starterPackId: null,
            nowMs: 30,
            defaultAgentWhenBotAccount: true);
        Assert.NotNull(profile);
        Assert.Equal(AgentPlayerProfile.ControllerAgent, profile!.ControllerKind);
    }

    [Fact]
    public void TryMerge_RateLimitsOwnerWrites() {
        var first = AgentPlayerProfile.TryBuild(
            "agent",
            "v1",
            null,
            null,
            nowMs: 1000,
            defaultAgentWhenBotAccount: false)!;
        var second = AgentPlayerProfile.TryBuild(
            "agent",
            "v2",
            null,
            null,
            nowMs: 1000 + AgentPlayerProfile.ProfileWriteCooldownMs - 1,
            defaultAgentWhenBotAccount: false)!;

        var ok = AgentPlayerProfile.TryMerge(first, second, second.LastWriteMs, out var next, out var reason);
        Assert.False(ok);
        Assert.Equal(first, next);
        Assert.Contains("rate limited", reason, StringComparison.OrdinalIgnoreCase);
    }
}
