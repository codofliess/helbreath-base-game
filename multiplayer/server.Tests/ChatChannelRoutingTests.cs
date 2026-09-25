using Mmorpg.Network;
using Server;
using Server.Helpers;
using Server.World;
using Server.World.Global;
using Xunit;

namespace Server.Tests;

/// <summary>
/// Server-side isolation for guild and party chat. Delivery must not rely on the client.
/// </summary>
public sealed class ChatChannelRoutingTests : IDisposable {
    private readonly WorldWorker worker;
    private readonly GlobalWorld world;

    public ChatChannelRoutingTests() {
        worker = new WorldWorker("chat-routing-tests", TimeSpan.FromMilliseconds(50));
        world = new GlobalWorld("chat-test", CreateSettings());
        worker.RegisterWorld(world);
    }

    public void Dispose() {
        worker.Dispose();
    }

    [Fact]
    public async Task GuildChat_IsNotDelivered_ToDifferentGuild() {
        var senderId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var senderInbox = new List<ServerMessage>();
        var otherInbox = new List<ServerMessage>();

        await ConnectAsync(senderId, "Alice", senderInbox.Add, guildId: "guild-a");
        await ConnectAsync(otherId, "Bob", otherInbox.Add, guildId: "guild-b");

        await SendChatAsync(senderId, "guild secret", ChatChannel.Guild);

        Assert.Contains(senderInbox, IsChat("guild secret", ChatChannel.Guild));
        Assert.DoesNotContain(otherInbox, IsChat("guild secret", ChatChannel.Guild));
        Assert.DoesNotContain(otherInbox, m => m.PayloadCase == ServerMessage.PayloadOneofCase.ChatMessageReceived);
    }

    [Fact]
    public async Task GuildChat_IsDelivered_ToSameGuildIncludingSender() {
        var senderId = Guid.NewGuid();
        var allyId = Guid.NewGuid();
        var senderInbox = new List<ServerMessage>();
        var allyInbox = new List<ServerMessage>();

        await ConnectAsync(senderId, "Alice", senderInbox.Add, guildId: "guild-a");
        await ConnectAsync(allyId, "Carol", allyInbox.Add, guildId: "guild-a");

        await SendChatAsync(senderId, "guild hello", ChatChannel.Guild);

        Assert.Contains(senderInbox, IsChat("guild hello", ChatChannel.Guild));
        Assert.Contains(allyInbox, IsChat("guild hello", ChatChannel.Guild));
    }

    [Fact]
    public async Task PartyChat_IsNotDelivered_ToDifferentParty() {
        var senderId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var senderInbox = new List<ServerMessage>();
        var otherInbox = new List<ServerMessage>();

        await ConnectAsync(senderId, "Alice", senderInbox.Add);
        await ConnectAsync(otherId, "Bob", otherInbox.Add);
        ChatMembership.SetParty(senderId, "PARTY1");
        ChatMembership.SetParty(otherId, "PARTY2");

        await SendChatAsync(senderId, "party secret", ChatChannel.Party);

        Assert.Contains(senderInbox, IsChat("party secret", ChatChannel.Party));
        Assert.DoesNotContain(otherInbox, IsChat("party secret", ChatChannel.Party));
        Assert.DoesNotContain(otherInbox, m => m.PayloadCase == ServerMessage.PayloadOneofCase.ChatMessageReceived);
    }

    [Fact]
    public async Task PartyChat_IsDelivered_ToSamePartyIncludingSender() {
        var senderId = Guid.NewGuid();
        var allyId = Guid.NewGuid();
        var senderInbox = new List<ServerMessage>();
        var allyInbox = new List<ServerMessage>();

        await ConnectAsync(senderId, "Alice", senderInbox.Add);
        await ConnectAsync(allyId, "Carol", allyInbox.Add);
        ChatMembership.SetParty(senderId, "PARTY1");
        ChatMembership.SetParty(allyId, "PARTY1");

        await SendChatAsync(senderId, "party hello", ChatChannel.Party);

        Assert.Contains(senderInbox, IsChat("party hello", ChatChannel.Party));
        Assert.Contains(allyInbox, IsChat("party hello", ChatChannel.Party));
    }

    [Fact]
    public async Task PartyChat_DoesNotParseInviteSubcommand_DeliversTextAsChat() {
        var senderId = Guid.NewGuid();
        var allyId = Guid.NewGuid();
        var senderInbox = new List<ServerMessage>();
        var allyInbox = new List<ServerMessage>();

        await ConnectAsync(senderId, "Alice", senderInbox.Add);
        await ConnectAsync(allyId, "Juan", allyInbox.Add);
        ChatMembership.SetParty(senderId, "PARTY1");
        ChatMembership.SetParty(allyId, "PARTY1");

        await SendChatAsync(senderId, "invite Juan to the raid", ChatChannel.Party);

        Assert.Contains(senderInbox, IsChat("invite Juan to the raid", ChatChannel.Party));
        Assert.Contains(allyInbox, IsChat("invite Juan to the raid", ChatChannel.Party));
        Assert.DoesNotContain(senderInbox, m =>
            m.PayloadCase == ServerMessage.PayloadOneofCase.SendMessage &&
            m.SendMessage.Message == Party.InviteSentMessage("Juan"));
        Assert.DoesNotContain(allyInbox, m => m.PayloadCase == ServerMessage.PayloadOneofCase.PartyInvitePrompt);
    }

    [Fact]
    public async Task GuildChat_FromUnguildedSender_DoesNotBroadcast() {
        var senderId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var senderInbox = new List<ServerMessage>();
        var otherInbox = new List<ServerMessage>();

        await ConnectAsync(senderId, "Alice", senderInbox.Add);
        await ConnectAsync(otherId, "Bob", otherInbox.Add, guildId: "guild-b");

        await SendChatAsync(senderId, "should not leak", ChatChannel.Guild);

        Assert.DoesNotContain(senderInbox, IsChat("should not leak", ChatChannel.Guild));
        Assert.DoesNotContain(otherInbox, m => m.PayloadCase == ServerMessage.PayloadOneofCase.ChatMessageReceived);
        Assert.Contains(senderInbox, m =>
            m.PayloadCase == ServerMessage.PayloadOneofCase.SendMessage &&
            m.SendMessage.Message == "You're not in a guild. Join one to use guild chat.");
    }

    [Fact]
    public async Task PartyChat_FromUnpartiedSender_DoesNotBroadcast() {
        var senderId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var senderInbox = new List<ServerMessage>();
        var otherInbox = new List<ServerMessage>();

        await ConnectAsync(senderId, "Alice", senderInbox.Add);
        await ConnectAsync(otherId, "Bob", otherInbox.Add);
        ChatMembership.SetParty(otherId, "PARTY1");

        await SendChatAsync(senderId, "should not leak", ChatChannel.Party);

        Assert.DoesNotContain(senderInbox, IsChat("should not leak", ChatChannel.Party));
        Assert.DoesNotContain(otherInbox, m => m.PayloadCase == ServerMessage.PayloadOneofCase.ChatMessageReceived);
        Assert.Contains(senderInbox, m =>
            m.PayloadCase == ServerMessage.PayloadOneofCase.SendMessage &&
            m.SendMessage.Message == Party.PartyChatNeedInviteMessage);
    }

    [Fact]
    public async Task NearbyChat_StillBroadcastsToAllOnlinePlayers() {
        var senderId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var senderInbox = new List<ServerMessage>();
        var otherInbox = new List<ServerMessage>();

        await ConnectAsync(senderId, "Alice", senderInbox.Add, guildId: "guild-a");
        await ConnectAsync(otherId, "Bob", otherInbox.Add, guildId: "guild-b");

        await SendChatAsync(senderId, "hello nearby", ChatChannel.Nearby);

        Assert.Contains(senderInbox, IsChat("hello nearby", ChatChannel.Nearby));
        Assert.Contains(otherInbox, IsChat("hello nearby", ChatChannel.Nearby));
    }

    private async Task ConnectAsync(
        Guid sessionId,
        string characterName,
        Action<ServerMessage> inbox,
        string guildId = "") {
        await world.EnqueueAsync(new GlobalPlayerConnectedMessage(sessionId, inbox, characterName, guildId));
        world.ProcessPendingMessages();
    }

    private async Task SendChatAsync(Guid sessionId, string text, ChatChannel channel) {
        await world.EnqueueAsync(new GlobalClientPacketMessage(sessionId, new ClientMessage {
            ChatMessageSendRequest = new ChatMessageSendRequest {
                Message = text,
                Channel = channel,
            },
        }));
        world.ProcessPendingMessages();
    }

    private static Predicate<ServerMessage> IsChat(string text, ChatChannel channel) {
        return m =>
            m.PayloadCase == ServerMessage.PayloadOneofCase.ChatMessageReceived &&
            m.ChatMessageReceived.Message == text &&
            m.ChatMessageReceived.Channel == channel;
    }

    private static SettingsConfig CreateSettings() {
        return new SettingsConfig(
            Port: 1337,
            Timings: new TimingsConfig(20, 1000, 200, 400, 400, 3, 100, 0.05),
            Threads: new ThreadsConfig(1, 0),
            ChatMessageMaxLength: 500,
            LogoutTime: 5,
            Ping: new PingConfig(60000, 120000, 1000, 20),
            GameWorld: new GameWorldRuntimeSettings(50, 1024, 256),
            CourseCorrection: true,
            Radius: new RadiusConfig(18, 11, 16, 9),
            InitialMap: "aresden",
            SpawnToRandomMap: false,
            MovementSpeedViolationsChecker: new MovementSpeedViolationCheckConfig(false, 10, 1, 1, 1, 20),
            Debug: new DebugConfig(false, false),
            MonsterDefaults: new MonsterDefaultsConfig());
    }
}
