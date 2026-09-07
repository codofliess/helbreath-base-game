using Server.Helpers;
using Server.World.Game;
using Xunit;

namespace Server.Tests;

public sealed class AgentSkillShopTests : IDisposable {
    readonly string charsDir;

    public AgentSkillShopTests() {
        charsDir = Path.Combine(Path.GetTempPath(), "agent-skill-shop-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(charsDir);
        HellMiningStore.Initialize(charsDir);
        AgentSkillShop.EnsureLoaded();
    }

    public void Dispose() {
        try {
            Directory.Delete(charsDir, recursive: true);
        } catch (IOException) {
        }
    }

    [Fact]
    public void Catalog_MapsEveryOlympiaMastery() {
        var catalog = AgentSkillShop.GetCatalog();
        Assert.Equal(AgentSkillShop.TokenTicker, AgentSkillShop.GetTokenTicker());
        for (var i = 0; i < Skills.SkillCount; i++) {
            var name = Skills.Names[i];
            var slug = name.Trim().ToLowerInvariant().Replace(' ', '-');
            var basic = catalog.Single(e => e.Id == $"f8.{slug}.basic");
            var advanced = catalog.Single(e => e.Id == $"f8.{slug}.advanced");
            Assert.Equal(i, basic.OlympiaSkillId);
            Assert.Equal(i, advanced.OlympiaSkillId);
            Assert.Equal(AgentSkillShop.TierBasic, basic.Tier);
            Assert.Equal(AgentSkillShop.TierAdvanced, advanced.Tier);
            Assert.True(basic.PriceHell > 0 && basic.PriceHell < advanced.PriceHell);
        }
        Assert.True(AgentSkillShop.TryResolve("starter.gather.mine", out var mine));
        Assert.Equal("f8.mining.basic", mine.Id);
        Assert.True(AgentSkillShop.TryGetOlympiaSkillId("starter.gather.fish", out var fishId));
        Assert.Equal(Skills.Fishing, fishId);
        Assert.True(AgentSkillShop.IsGrantOnly("starter.academy.easy"));
        Assert.False(AgentSkillShop.IsGrantOnly("f8.mining.basic"));
        Assert.False(AgentSkillShop.IsCatalogSkillId("not.a.skill"));
        Assert.False(AgentSkillShop.IsCatalogSkillId("f8.invented.basic"));
    }

    [Fact]
    public void TryAcquire_RejectsUnknownAndHumanWithoutSpending() {
        const string wallet = "ShopTestWalletHuman111111111111111111111";
        HellMiningStore.GrantPendingHell(wallet, 10_000);
        var before = HellMiningStore.GetSnapshot(wallet, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()).PendingHell;

        var unknown = AgentSkillShop.TryAcquire(
            AgentPlayerProfile.ControllerAgent,
            wallet,
            [],
            "evil.forged.pack",
            AgentSkillShop.RailBuyNft,
            out var nextUnknown,
            out var unknownMsg);
        Assert.False(unknown);
        Assert.Contains("Unknown", unknownMsg, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(nextUnknown);

        var human = AgentSkillShop.TryAcquire(
            AgentPlayerProfile.ControllerHuman,
            wallet,
            [],
            "f8.mining.basic",
            AgentSkillShop.RailBuyNft,
            out _,
            out var humanMsg);
        Assert.False(human);
        Assert.Contains("agent", humanMsg, StringComparison.OrdinalIgnoreCase);

        var grantOnly = AgentSkillShop.TryAcquire(
            AgentPlayerProfile.ControllerAgent,
            wallet,
            [],
            "starter.academy.easy",
            AgentSkillShop.RailBuyNft,
            out _,
            out var grantMsg);
        Assert.False(grantOnly);
        Assert.Contains("grant-only", grantMsg, StringComparison.OrdinalIgnoreCase);

        var after = HellMiningStore.GetSnapshot(wallet, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()).PendingHell;
        Assert.Equal(before, after);
    }

    [Fact]
    public void TryAcquire_BuyNftSpendsPendingAndMarksConsumed() {
        const string wallet = "ShopTestWalletBuyNft1111111111111111111";
        HellMiningStore.GrantPendingHell(wallet, 200);
        var ok = AgentSkillShop.TryAcquire(
            AgentPlayerProfile.ControllerAgent,
            wallet,
            [new PersistedAgentSkillSlot("starter.academy.easy", "", false, AgentSkillShop.RailGrant)],
            "starter.gather.mine",
            AgentSkillShop.RailBuyNft,
            out var next,
            out var message);
        Assert.True(ok, message);
        Assert.Contains("f8.mining.basic", next.Select(s => s.SkillId));
        var bought = next.Single(s => s.SkillId == "f8.mining.basic");
        Assert.Equal(AgentSkillShop.RailBuyNft, bought.Rail);
        Assert.True(bought.Consumed);
        Assert.Equal("", bought.NftMint);
        Assert.Contains("post-test", message, StringComparison.OrdinalIgnoreCase);
        var pending = HellMiningStore.GetSnapshot(wallet, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()).PendingHell;
        Assert.Equal(150, pending);
    }

    [Fact]
    public void TryAcquire_StakeThenUnstakeRefundsAndKeepsOtherSlots() {
        const string wallet = "ShopTestWalletStake11111111111111111111";
        HellMiningStore.GrantPendingHell(wallet, 500);
        var buy = AgentSkillShop.TryAcquire(
            AgentPlayerProfile.ControllerAgent,
            wallet,
            [],
            "f8.mining.basic",
            AgentSkillShop.RailStake,
            out var staked,
            out var stakeMsg);
        Assert.True(buy, stakeMsg);
        Assert.Equal(AgentSkillShop.RailStake, staked.Single().Rail);
        Assert.Equal(50, staked.Single().StakeHell);
        Assert.False(staked.Single().Consumed);
        Assert.Equal(450, HellMiningStore.GetSnapshot(wallet, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()).PendingHell);

        var unstakeUnknown = AgentSkillShop.TryUnstake(
            AgentPlayerProfile.ControllerAgent,
            wallet,
            staked,
            "f8.alchemy.basic",
            out _,
            out var missMsg);
        Assert.False(unstakeUnknown);
        Assert.Contains("No live stake", missMsg, StringComparison.OrdinalIgnoreCase);

        var unstake = AgentSkillShop.TryUnstake(
            AgentPlayerProfile.ControllerAgent,
            wallet,
            staked,
            "f8.mining.basic",
            out var after,
            out var unstakeMsg);
        Assert.True(unstake, unstakeMsg);
        Assert.Empty(after);
        Assert.Equal(500, HellMiningStore.GetSnapshot(wallet, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()).PendingHell);
    }

    [Fact]
    public void TryAcquire_RejectsDuplicateAndBadRail() {
        const string wallet = "ShopTestWalletDup1111111111111111111111";
        HellMiningStore.GrantPendingHell(wallet, 500);
        Assert.True(AgentSkillShop.TryAcquire(
            AgentPlayerProfile.ControllerAgent,
            wallet,
            [],
            "f8.fishing.basic",
            AgentSkillShop.RailBuyNft,
            out var first,
            out _));
        var dup = AgentSkillShop.TryAcquire(
            AgentPlayerProfile.ControllerAgent,
            wallet,
            first,
            "starter.gather.fish",
            AgentSkillShop.RailStake,
            out _,
            out var dupMsg);
        Assert.False(dup);
        Assert.Contains("already equipped", dupMsg, StringComparison.OrdinalIgnoreCase);
        Assert.False(AgentSkillShop.TryAcquire(
            AgentPlayerProfile.ControllerAgent,
            wallet,
            first,
            "f8.alchemy.basic",
            "forged_rail",
            out _,
            out var railMsg));
        Assert.Contains("buy_nft or stake", railMsg, StringComparison.OrdinalIgnoreCase);
    }
}
