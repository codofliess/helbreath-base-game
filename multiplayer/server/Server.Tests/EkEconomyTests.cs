using Server.Helpers;
using Xunit;

namespace Server.Tests;

/// <summary>
/// EK NFT craft debit uses <c>ek_nft_craft_source=earned</c> only as a test fixture.
/// Production <c>Config/EkEconomy.json</c> leaves that key null (fail closed). It is not the product rule.
/// </summary>
public class EkEconomyTests {
    const decimal FlatUsd = 5m;

    [Fact]
    public void Config_file_defaults_are_flat_fees_min_50_and_emitir_false() {
        var path = ConfigPath();
        var json = File.ReadAllText(path);
        Assert.Equal("fees.ek_nft_bind_usd", EkEconomyConfig.EkNftBindFeeKey);
        Assert.Equal("fees.hero_set_piece_unbind_usd", EkEconomyConfig.HeroSetPieceUnbindFeeKey);
        Assert.Contains("ek_nft_bind_usd", json);
        Assert.Contains("hero_set_piece_unbind_usd", json);
        Assert.Contains("ek_nft_min_amount", json);

        var config = EkEconomyConfig.LoadOrDefault(path);
        Assert.False(config.Emitir);
        Assert.Equal(50, config.EkNftMinAmount);
        Assert.Equal(FlatUsd, config.Fees.EkNftBindUsd);
        Assert.Equal(FlatUsd, config.Fees.HeroSetPieceUnbindUsd);
        Assert.Equal(new[] { "purchased", "earned" }, config.RaidMasterSpendOrder);
        Assert.True(string.IsNullOrWhiteSpace(config.EkNftCraftSource));
        Assert.False(config.PurchasedEkMiningEnabled);
    }

    [Fact]
    public void Craft_49_fails_and_does_not_debit_or_charge() {
        var svc = FixtureEarned();
        svc.CreditGameplayEk("ada", 100, "earn-ada");
        var result = svc.CraftEkNft("ada", 49, "craft-49");

        Assert.False(result.Ok);
        Assert.Equal(EkEconomyCodes.BelowMin, result.Code);
        Assert.Null(result.Fee);
        Assert.Null(result.NftId);
        Assert.Equal(100, svc.GetEarned("ada"));
        Assert.Equal(0, svc.GetPurchased("ada"));
        AssertNoRealMovement(result);
        Assert.Single(svc.AuditLog(), row => row.IdempotencyKey == "craft-49");

        var replay = svc.CraftEkNft("ada", 49, "craft-49");
        Assert.True(replay.Replay);
        Assert.False(replay.Ok);
        Assert.Equal(100, svc.GetEarned("ada"));
        Assert.Single(svc.AuditLog(), row => row.IdempotencyKey == "craft-49");
    }

    [Fact]
    public void Craft_50_and_137_each_charge_one_flat_fee() {
        var svc = FixtureEarned();
        svc.CreditGameplayEk("ada", 50 + 137, "earn-ada");

        var fifty = svc.CraftEkNft("ada", 50, "craft-50");
        var oneThirtySeven = svc.CraftEkNft("ada", 137, "craft-137");

        Assert.True(fifty.Ok);
        Assert.True(oneThirtySeven.Ok);
        AssertFlatFee(fifty, EkEconomyConfig.EkNftBindFeeKey, 1);
        AssertFlatFee(oneThirtySeven, EkEconomyConfig.EkNftBindFeeKey, 1);
        Assert.NotEqual(fifty.NftId, oneThirtySeven.NftId);
        Assert.StartsWith("eknft-", fifty.NftId);
        Assert.StartsWith("eknft-", oneThirtySeven.NftId);
        Assert.Equal(0, svc.GetEarned("ada"));
        Assert.Equal(0, svc.GetPurchased("ada"));
        AssertNoRealMovement(fifty);
        AssertNoRealMovement(oneThirtySeven);

        var replay = svc.CraftEkNft("ada", 137, "craft-137");
        Assert.True(replay.Replay);
        Assert.Equal(oneThirtySeven.NftId, replay.NftId);
        Assert.Equal(0, svc.GetEarned("ada"));
        Assert.Single(svc.AuditLog(), row => row.IdempotencyKey == "craft-137" && row.Ok);
    }

    [Fact]
    public void Craft_source_unspecified_fail_closes_without_moving_eks() {
        var svc = ProductionConfigService();
        svc.CreditGameplayEk("ada", 200, "earn-ada");
        var result = svc.CraftEkNft("ada", 50, "craft-open");

        Assert.False(result.Ok);
        Assert.Equal(EkEconomyCodes.CraftSourceUnspecified, result.Code);
        Assert.Null(result.Fee);
        Assert.Null(result.NftId);
        Assert.Equal(200, svc.GetEarned("ada"));
        Assert.Equal(0, svc.GetPurchased("ada"));
        AssertNoRealMovement(result);
    }

    [Fact]
    public void Consume_burns_nft_and_credits_purchased_not_ranking() {
        var svc = FixtureEarned();
        svc.CreditGameplayEk("ada", 80, "earn-ada");
        svc.CreditGameplayEk("grind", 3, "earn-grind");
        var crafted = svc.CraftEkNft("ada", 50, "craft-50");
        Assert.True(crafted.Ok);

        var consumed = svc.ConsumeEkNft("bob", crafted.NftId!, "consume-1");

        Assert.True(consumed.Ok);
        Assert.Equal(50, svc.GetPurchased("bob"));
        Assert.Equal(0, svc.GetEarned("bob"));
        Assert.Equal(30, svc.GetEarned("ada"));
        Assert.False(consumed.MiningApplied);
        Assert.Equal(0, consumed.MiningCredits);
        var nft = svc.GetNft(crafted.NftId!);
        Assert.NotNull(nft);
        Assert.True(nft!.Burned);
        Assert.Null(nft.ChainMint);
        Assert.Equal("bob", nft.HolderId);

        var ranking = svc.KillerRanking();
        Assert.Equal(30, ranking.Single(row => row.PlayerId == "ada").Earned);
        Assert.Equal(3, ranking.Single(row => row.PlayerId == "grind").Earned);
        Assert.DoesNotContain(ranking, row => row.PlayerId == "bob");
        Assert.Equal(33, ranking.Sum(row => row.Earned));
        AssertNoRealMovement(consumed);
    }

    [Fact]
    public void Double_consume_fails_and_idempotent_replay_does_not_double_credit() {
        var svc = FixtureEarned();
        svc.CreditGameplayEk("ada", 50, "earn-ada");
        var crafted = svc.CraftEkNft("ada", 50, "craft-50");
        var first = svc.ConsumeEkNft("bob", crafted.NftId!, "consume-1");
        Assert.True(first.Ok);

        var replay = svc.ConsumeEkNft("bob", crafted.NftId!, "consume-1");
        Assert.True(replay.Ok);
        Assert.True(replay.Replay);
        Assert.Equal(50, svc.GetPurchased("bob"));

        var second = svc.ConsumeEkNft("cara", crafted.NftId!, "consume-2");
        Assert.False(second.Ok);
        Assert.Equal(EkEconomyCodes.NftAlreadyBurned, second.Code);
        Assert.Equal(50, svc.GetPurchased("bob"));
        Assert.Equal(0, svc.GetPurchased("cara"));
        Assert.Equal(0, svc.GetEarned("bob"));
        Assert.Single(svc.AuditLog(), row => row.IdempotencyKey == "consume-1");
    }

    [Fact]
    public void Parallel_consume_burns_once() {
        var svc = FixtureEarned();
        svc.CreditGameplayEk("ada", 50, "earn-ada");
        var crafted = svc.CraftEkNft("ada", 50, "craft-50");
        var start = new Barrier(2);
        var results = new EkEconomyResult[2];
        var threads = new Thread[2];
        for (var i = 0; i < 2; i++) {
            var index = i;
            threads[i] = new Thread(() => {
                start.SignalAndWait();
                results[index] = svc.ConsumeEkNft("bob", crafted.NftId!, "consume-" + index);
            });
            threads[i].Start();
        }
        Assert.True(threads[0].Join(TimeSpan.FromSeconds(5)));
        Assert.True(threads[1].Join(TimeSpan.FromSeconds(5)));

        Assert.Equal(1, results.Count(result => result.Ok && !result.Replay));
        Assert.Equal(50, svc.GetPurchased("bob"));
        Assert.True(svc.GetNft(crafted.NftId!)!.Burned);
    }

    [Fact]
    public void Ranking_ignores_purchased_eks() {
        var svc = FixtureEarned();
        svc.CreditGameplayEk("killer", 7, "earn-killer");
        svc.CreditGameplayEk("seller", 90, "earn-seller");
        var crafted = svc.CraftEkNft("seller", 80, "craft-80");
        var consumed = svc.ConsumeEkNft("buyer", crafted.NftId!, "consume-buyer");
        Assert.True(consumed.Ok);
        Assert.Equal(80, svc.GetPurchased("buyer"));

        var ranking = svc.KillerRanking();
        Assert.Equal(new[] { "seller", "killer" }, ranking.Select(row => row.PlayerId).ToArray());
        Assert.Equal(10, ranking[0].Earned);
        Assert.Equal(7, ranking[1].Earned);
        Assert.DoesNotContain(ranking, row => row.PlayerId == "buyer");
        Assert.Equal(svc.GetEarned("seller") + svc.GetEarned("killer"), ranking.Sum(row => row.Earned));
    }

    [Fact]
    public void Raid_master_spends_purchased_then_earned_and_gold_and_materials() {
        var svc = FixtureEarned();
        svc.CreditGameplayEk("ada", 90, "earn-ada");
        var crafted = svc.CraftEkNft("ada", 60, "craft-60");
        Assert.True(svc.ConsumeEkNft("ada", crafted.NftId!, "consume-ada").Ok);
        Assert.Equal(30, svc.GetEarned("ada"));
        Assert.Equal(60, svc.GetPurchased("ada"));
        svc.SetGameGold("ada", 100);
        svc.SetGameMaterial("ada", "relic", 2);

        var spent = svc.ContributeRaidMaster(
            "ada",
            ekCost: 80,
            goldCost: 25,
            otherCosts: new Dictionary<string, long> { ["relic"] = 1 },
            "raid-1");

        Assert.True(spent.Ok);
        Assert.Null(spent.Fee);
        Assert.Equal(0, svc.GetPurchased("ada"));
        Assert.Equal(10, svc.GetEarned("ada"));
        Assert.Equal(75, svc.GetGold("ada"));
        Assert.Equal(1, svc.GetMaterial("ada", "relic"));
        Assert.Equal(10, svc.KillerRanking().Single().Earned);
        AssertNoRealMovement(spent);

        var blocked = svc.ContributeRaidMaster(
            "ada",
            ekCost: 5,
            goldCost: 1,
            otherCosts: new Dictionary<string, long> { ["relic"] = 5 },
            "raid-short");
        Assert.False(blocked.Ok);
        Assert.Equal(EkEconomyCodes.InsufficientMaterial, blocked.Code);
        Assert.Equal(10, svc.GetEarned("ada"));
        Assert.Equal(0, svc.GetPurchased("ada"));
        Assert.Equal(75, svc.GetGold("ada"));
        Assert.Equal(1, svc.GetMaterial("ada", "relic"));
    }

    [Fact]
    public void Raid_master_spend_order_is_configurable() {
        var config = EkEconomyConfig.LoadOrDefault(ConfigPath())
            .WithCraftSource(EkEconomyConfig.CraftSourceEarned)
            .WithSpendOrder(["earned", "purchased"]);
        var svc = new EkEconomyService(config);
        svc.CreditGameplayEk("ada", 80, "earn-ada");
        var crafted = svc.CraftEkNft("ada", 50, "craft-50");
        Assert.True(svc.ConsumeEkNft("ada", crafted.NftId!, "consume-ada").Ok);

        var spent = svc.ContributeRaidMaster("ada", ekCost: 40, goldCost: 0, otherCosts: null, "raid-order");

        Assert.True(spent.Ok);
        Assert.Equal(0, svc.GetEarned("ada"));
        Assert.Equal(40, svc.GetPurchased("ada"));
        Assert.Empty(svc.KillerRanking());
    }

    [Fact]
    public void Unbind_piece_charges_one_fee_and_sell_whole_set_charges_n_fees() {
        var svc = FixtureEarned();
        svc.GrantHeroPiece("ada", "helm", 403);
        var one = svc.UnbindHeroPiece("ada", "helm", "unbind-helm");
        Assert.True(one.Ok);
        AssertFlatFee(one, EkEconomyConfig.HeroSetPieceUnbindFeeKey, 1);
        Assert.False(svc.IsPieceBound("helm"));
        AssertNoRealMovement(one);

        var again = svc.UnbindHeroPiece("ada", "helm", "unbind-helm-2");
        Assert.False(again.Ok);
        Assert.Equal(EkEconomyCodes.PieceAlreadyUnbound, again.Code);
        Assert.Null(again.Fee);

        var pieceIds = new[] { "cape", "cap", "robe", "hauberk", "legs" };
        var itemIds = new[] { 400, 407, 415, 419, 423 };
        for (var i = 0; i < pieceIds.Length; i++) {
            svc.GrantHeroPiece("ada", pieceIds[i], itemIds[i]);
        }
        var sold = svc.SellHeroSet("ada", pieceIds, "sell-set");
        Assert.True(sold.Ok);
        AssertFlatFee(sold, EkEconomyConfig.HeroSetPieceUnbindFeeKey, pieceIds.Length);
        Assert.Equal(FlatUsd * pieceIds.Length, sold.Fee!.Usd);
        Assert.All(pieceIds, id => Assert.False(svc.IsPieceBound(id)));
        Assert.Single(svc.AuditLog(), row => row.Op == "sell_hero_set" && row.Ok);

        var replay = svc.SellHeroSet("ada", pieceIds, "sell-set");
        Assert.True(replay.Replay);
        Assert.Single(svc.AuditLog(), row => row.Op == "sell_hero_set" && row.Ok);
    }

    [Fact]
    public void Sell_set_is_atomic_and_rejects_non_hero_or_tournament_pieces() {
        var svc = FixtureEarned();
        svc.GrantHeroPiece("ada", "helm", 403);
        svc.GrantHeroPiece("ada", "armor", 411);
        svc.GrantHeroPiece("ada", "dagger", 1);
        var mixed = svc.SellHeroSet("ada", ["helm", "armor", "dagger"], "sell-mixed");
        Assert.False(mixed.Ok);
        Assert.Equal(EkEconomyCodes.NotHeroPiece, mixed.Code);
        Assert.Null(mixed.Fee);
        Assert.True(svc.IsPieceBound("helm"));
        Assert.True(svc.IsPieceBound("armor"));
        Assert.True(svc.IsPieceBound("dagger"));

        svc.GrantHeroPiece("ada", "arena-helm", 405, tournamentLoadout: true);
        var arena = svc.UnbindHeroPiece("ada", "arena-helm", "unbind-arena");
        Assert.False(arena.Ok);
        Assert.Equal(EkEconomyCodes.TournamentLoadout, arena.Code);
        Assert.Null(arena.Fee);
        Assert.True(svc.IsPieceBound("arena-helm"));
    }

    [Fact]
    public void Emitir_false_blocks_real_movement_on_every_operation() {
        var svc = FixtureEarned();
        Assert.False(svc.Config.Emitir);
        svc.CreditGameplayEk("ada", 80, "earn-ada");
        svc.SetGameGold("ada", 10);
        svc.GrantHeroPiece("ada", "helm", 403);
        svc.GrantHeroPiece("ada", "armor", 411);

        var crafted = svc.CraftEkNft("ada", 50, "craft-50");
        var consumed = svc.ConsumeEkNft("bob", crafted.NftId!, "consume-1");
        var unbound = svc.UnbindHeroPiece("ada", "helm", "unbind-1");
        var sold = svc.SellHeroSet("ada", ["armor"], "sell-1");
        var raid = svc.ContributeRaidMaster("ada", 5, 1, null, "raid-1");
        var earnedBeforeRail = svc.GetEarned("ada");
        var purchasedBeforeRail = svc.GetPurchased("bob");
        var rail = svc.TryInvokeRealRail("ada", "rail-1");

        Assert.True(crafted.Ok);
        Assert.True(consumed.Ok);
        Assert.True(unbound.Ok);
        Assert.True(sold.Ok);
        Assert.True(raid.Ok);
        Assert.False(rail.Ok);
        Assert.Equal(EkEconomyCodes.RealMovementBlocked, rail.Code);
        Assert.Equal(earnedBeforeRail, svc.GetEarned("ada"));
        Assert.Equal(purchasedBeforeRail, svc.GetPurchased("bob"));
        Assert.Null(svc.GetNft(crafted.NftId!)!.ChainMint);

        foreach (var result in new[] { crafted, consumed, unbound, sold, raid, rail }) {
            AssertNoRealMovement(result);
        }
        Assert.All(svc.AuditLog(), row => {
            Assert.False(row.RealMoneyMoved);
            Assert.False(row.ChainSubmitted);
            Assert.Null(row.ChainTxId);
            Assert.False(row.FeeCollected);
        });
    }

    [Fact]
    public void Emitir_true_refuses_the_operation_and_still_moves_no_money() {
        var config = EkEconomyConfig.LoadOrDefault(ConfigPath())
            .WithCraftSource(EkEconomyConfig.CraftSourceEarned)
            .WithEmitir(true);
        var svc = new EkEconomyService(config);
        svc.CreditGameplayEk("ada", 80, "earn-ada");
        var crafted = svc.CraftEkNft("ada", 50, "craft-50");
        var rail = svc.TryInvokeRealRail("ada", "rail-1");

        Assert.False(crafted.Ok);
        Assert.Equal(EkEconomyCodes.RealEmissionRefused, crafted.Code);
        Assert.Null(crafted.NftId);
        Assert.Equal(80, svc.GetEarned("ada"));
        Assert.False(rail.Ok);
        Assert.Equal(EkEconomyCodes.RealEmissionRefused, rail.Code);
        AssertNoRealMovement(crafted);
        AssertNoRealMovement(rail);
        Assert.All(svc.AuditLog(), row => Assert.False(row.RealMoneyMoved));
    }

    [Fact]
    public void Purchased_ek_mining_stays_off_even_if_the_flag_is_enabled() {
        var off = FixtureEarned();
        off.CreditGameplayEk("ada", 50, "earn-ada");
        var nft = off.CraftEkNft("ada", 50, "craft-50");
        var consumed = off.ConsumeEkNft("bob", nft.NftId!, "consume-1");
        Assert.True(consumed.Ok);
        Assert.False(consumed.MiningApplied);
        Assert.Equal(0, consumed.MiningCredits);
        Assert.Null(consumed.Detail);

        var on = new EkEconomyService(
            EkEconomyConfig.LoadOrDefault(ConfigPath())
                .WithCraftSource(EkEconomyConfig.CraftSourceEarned)
                .WithPurchasedMining(true));
        on.CreditGameplayEk("ada", 50, "earn-ada");
        var nftOn = on.CraftEkNft("ada", 50, "craft-50");
        var consumedOn = on.ConsumeEkNft("bob", nftOn.NftId!, "consume-1");
        Assert.True(consumedOn.Ok);
        Assert.False(consumedOn.MiningApplied);
        Assert.Equal(0, consumedOn.MiningCredits);
        Assert.Equal(EkEconomyCodes.PurchasedMiningNotImplemented, consumedOn.Detail);
        Assert.Equal(50, on.GetPurchased("bob"));
        Assert.Equal(0, on.GetEarned("bob"));
    }

    [Fact]
    public void Legacy_single_balance_migrates_to_earned_and_does_not_double() {
        var dir = Path.Combine(Path.GetTempPath(), "ek-economy-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, "ledger.json");
        File.WriteAllText(path, """
            {
              "version": 1,
              "accounts": {
                "ada": { "balance": 80 }
              }
            }
            """);

        var config = EkEconomyConfig.LoadOrDefault(ConfigPath());
        var loaded = EkEconomyService.Load(path, config);
        Assert.Equal(80, loaded.GetEarned("ada"));
        Assert.Equal(0, loaded.GetPurchased("ada"));

        loaded.ImportLegacyBalances(new Dictionary<string, long> { ["ada"] = 80 });
        Assert.Equal(80, loaded.GetEarned("ada"));
        Assert.Equal(0, loaded.GetPurchased("ada"));

        var reloaded = EkEconomyService.Load(path, config);
        Assert.Equal(80, reloaded.GetEarned("ada"));
        Assert.Equal(0, reloaded.GetPurchased("ada"));

        reloaded.ImportLegacyBalances(new Dictionary<string, long> { ["ada"] = 85, ["bea"] = 4 });
        Assert.Equal(85, reloaded.GetEarned("ada"));
        Assert.Equal(4, reloaded.GetEarned("bea"));
        Assert.Equal(0, reloaded.GetPurchased("ada"));
        Assert.Equal(0, reloaded.GetPurchased("bea"));
        Assert.Equal(new[] { "ada", "bea" }, reloaded.KillerRanking().Select(row => row.PlayerId).ToArray());
    }

    [Fact]
    public void Persisted_nft_cannot_be_burned_twice_after_reload() {
        var dir = Path.Combine(Path.GetTempPath(), "ek-economy-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, "ledger.json");
        var config = EkEconomyConfig.LoadOrDefault(ConfigPath()).WithCraftSource(EkEconomyConfig.CraftSourceEarned);
        var svc = EkEconomyService.Load(path, config);
        svc.CreditGameplayEk("ada", 50, "earn-ada");
        var crafted = svc.CraftEkNft("ada", 50, "craft-50");
        var reloaded = EkEconomyService.Load(path, config);
        var consumed = reloaded.ConsumeEkNft("bob", crafted.NftId!, "consume-1");
        Assert.True(consumed.Ok);
        var again = EkEconomyService.Load(path, config);
        var second = again.ConsumeEkNft("bob", crafted.NftId!, "consume-2");
        Assert.False(second.Ok);
        Assert.Equal(EkEconomyCodes.NftAlreadyBurned, second.Code);
        Assert.Equal(50, again.GetPurchased("bob"));
    }

    static EkEconomyService FixtureEarned() =>
        new(EkEconomyConfig.LoadOrDefault(ConfigPath()).WithCraftSource(EkEconomyConfig.CraftSourceEarned));

    static EkEconomyService ProductionConfigService() =>
        new(EkEconomyConfig.LoadOrDefault(ConfigPath()));

    static string ConfigPath() {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null) {
            var candidate = Path.Combine(dir.FullName, "Config", "EkEconomy.json");
            if (File.Exists(candidate)) {
                return candidate;
            }
            dir = dir.Parent;
        }
        throw new FileNotFoundException("Config/EkEconomy.json");
    }

    static void AssertFlatFee(EkEconomyResult result, string key, int count) {
        Assert.NotNull(result.Fee);
        Assert.Equal(key, result.Fee!.Key);
        Assert.Equal(count, result.Fee.Count);
        Assert.Equal(FlatUsd * count, result.Fee.Usd);
        Assert.False(result.Fee.Collected);
    }

    static void AssertNoRealMovement(EkEconomyResult result) {
        Assert.False(result.RealMoneyMoved);
        Assert.False(result.ChainSubmitted);
        Assert.Null(result.ChainTxId);
        if (result.Fee is not null) {
            Assert.False(result.Fee.Collected);
        }
    }
}
