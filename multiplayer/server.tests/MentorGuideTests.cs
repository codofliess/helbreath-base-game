using Server;
using Server.Helpers;
using Xunit;

namespace Server.Tests;

[CollectionDefinition("Mentor", DisableParallelization = true)]
public class MentorCollectionDefinition;

[Collection("Mentor")]
public class MentorGuideTests : IDisposable {
    readonly string auctionDir;

    public MentorGuideTests() {
        Environment.SetEnvironmentVariable("XAI_API_KEY", null);
        Environment.SetEnvironmentVariable("GROK_API_KEY", null);
        MentorGuide.ResetRateLimitForTests();
        auctionDir = Path.Combine(Path.GetTempPath(), "hb-mentor-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(auctionDir);
        AuctionBoardStore.Initialize(auctionDir);
        BeginnerPath.Initialize(new BeginnerPathConfig([
            new BeginnerQuestConfig(
                "bp_enroll", "A", "live", 1, 1,
                "Beginner enrollment",
                "Talk to Enzu on the farm and accept beginner training.",
                "enroll", 1),
            new BeginnerQuestConfig(
                "bp_slime_5", "A", "live", 1, 5,
                "Slime hunt",
                "South of the farm: kill 5 Slimes, then check Quest (F5).",
                "kill", 5, MonsterId: 1),
            new BeginnerQuestConfig(
                "bp_merc_war_1", "B", "live", 11, 14,
                "Mercenary warrior",
                "Merc Barracks: kill 1 Mercenary Warrior.",
                "kill", 1, MonsterId: 62),
        ]));
    }

    public void Dispose() {
        try {
            if (Directory.Exists(auctionDir)) {
                Directory.Delete(auctionDir, recursive: true);
            }
        } catch {
            // temp cleanup is best-effort
        }
    }

    [Fact]
    public void FollowMe_UsesSlimeHuntAtLevel3() {
        var reply = MentorGuide.AnswerLocal(new MentorChatRequest {
            Message = "sígueme y explícame todo lo que tengo que hacer ahora / lo que más me conviene",
            Level = 3,
            PlayerName = "Elon",
            Enrolled = true,
        });
        Assert.Equal("guide", reply.Kind);
        Assert.Equal("local", reply.Source);
        Assert.Contains("Slime hunt", reply.Reply, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Slimes", reply.Reply, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void QueHago_UsesMercBandAtLevel12() {
        var reply = MentorGuide.AnswerLocal(new MentorChatRequest {
            Message = "qué hago ahora, qué me conviene",
            Level = 12,
            Enrolled = true,
        });
        Assert.Equal("guide", reply.Kind);
        Assert.Contains("Mercenary warrior", reply.Reply, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void RecommendNow_PrefersActiveTitleWhenEnrolled() {
        var advice = MentorGuide.RecommendNow(3, enrolled: true, "Dummy barracks", "Practice hits on 3 Training Dummies.");
        Assert.True(advice.UsedActiveQuest);
        Assert.Equal("Dummy barracks", advice.Title);
        Assert.Contains("Training Dummies", advice.Hint, StringComparison.Ordinal);
    }

    [Fact]
    public void Price_UsesActiveListingApproximateGold() {
        AuctionBoardStore.AddListing(new AuctionListingRecord {
            ListingId = "list-sword-1",
            ItemName = "Long Sword",
            ListPriceGold = 1200,
            CurrentBidGold = 1500,
            Status = "active",
            CreatedAtMs = 1,
        });
        AuctionBoardStore.AddListing(new AuctionListingRecord {
            ListingId = "list-sword-2",
            ItemName = "Long Sword +1",
            ListPriceGold = 2100,
            CurrentBidGold = 0,
            Status = "active",
            CreatedAtMs = 2,
        });

        var reply = MentorGuide.AnswerLocal(new MentorChatRequest {
            Message = "¿cuánto pagan por Long Sword en el mercado?",
        });
        Assert.Equal("price", reply.Kind);
        Assert.Equal("local", reply.Source);
        Assert.Contains("aproximad", reply.Reply, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("1500", reply.Reply, StringComparison.Ordinal);
        Assert.Contains("2100", reply.Reply, StringComparison.Ordinal);
    }

    [Fact]
    public void Price_NoListings_SaysApproximateUnavailable() {
        var reply = MentorGuide.AnswerLocal(new MentorChatRequest {
            Message = "precio del mercado para Potion",
        });
        Assert.Equal("price", reply.Kind);
        Assert.Contains("aproximad", reply.Reply, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("listing", reply.Reply, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ChatAsync_WithoutApiKey_ReturnsLocal() {
        var reply = await MentorGuide.ChatAsync(new MentorChatRequest {
            Message = "sígueme",
            Level = 1,
            Enrolled = false,
        });
        Assert.Equal("local", reply.Source);
        Assert.Equal("guide", reply.Kind);
        Assert.Contains("Beginner enrollment", reply.Reply, StringComparison.OrdinalIgnoreCase);
    }
}
