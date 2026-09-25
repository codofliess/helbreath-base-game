using Mmorpg.Network;
using Server;
using Server.Helpers;
using Server.World.Game;
using Xunit;

namespace Server.Tests;

/// <summary>
/// <c>/invite</c> uses <see cref="Party"/> create/join (same as the F5 Party panel).
/// </summary>
public sealed class PartyInviteTests : IDisposable {
    private readonly List<GameWorldPlayer> players = [];

    public PartyInviteTests() {
        Party.ResetTransientState();
    }

    public void Dispose() {
        foreach (var player in players) {
            OnlinePlayerDirectory.Unregister(player);
            ChatMembership.Clear(player.SessionId);
        }

        Party.ResetTransientState();
    }

    [Fact]
    public void Invite_WithNoName_SendsUsage() {
        var (alice, inbox) = CreateOnline("Alice");

        Party.HandleInviteRequest(alice, characterName: "  ");

        Assert.Contains(inbox, SystemMessage(Party.InviteUsageMessage));
        Assert.DoesNotContain(inbox, m => m.PayloadCase == ServerMessage.PayloadOneofCase.PartyInvitePrompt);
    }

    [Fact]
    public void Invite_NameNotFound_SendsOffline() {
        var (alice, inbox) = CreateOnline("Alice");

        Party.HandleInviteRequest(alice, "Ghost");

        Assert.Contains(inbox, SystemMessage(Party.OfflineMessage("Ghost")));
    }

    [Fact]
    public void Invite_TargetOffline_SendsOffline() {
        var (alice, inbox) = CreateOnline("Alice");
        var (bob, _) = CreateOnline("Bob");
        bob.DetachConnection();

        Party.HandleInviteRequest(alice, "Bob");

        Assert.Contains(inbox, SystemMessage(Party.OfflineMessage("Bob")));
    }

    [Fact]
    public void Invite_TargetAlreadyInParty_SendsAlreadyInParty() {
        var (alice, inbox) = CreateOnline("Alice");
        var (carol, carolInbox) = CreateOnline("Carol");
        Party.HandleCreateRequest(carol);

        Party.HandleInviteRequest(alice, "Carol");

        Assert.Contains(inbox, SystemMessage(Party.AlreadyInPartyMessage("Carol")));
        Assert.DoesNotContain(carolInbox, m => m.PayloadCase == ServerMessage.PayloadOneofCase.PartyInvitePrompt);
    }

    [Fact]
    public void Invite_SenderPartyFull_SendsPartyFull() {
        var (leader, inbox) = CreateOnline("Leader");
        Party.HandleCreateRequest(leader);
        var code = leader.PartyCode!;
        for (var i = 0; i < 7; i++) {
            var (member, _) = CreateOnline($"Fill{i}");
            Party.HandleJoinRequest(member, new JoinPartyRequest { PartyCode = code });
        }

        var (target, targetInbox) = CreateOnline("Eve");
        Party.HandleInviteRequest(leader, "Eve");

        Assert.Contains(inbox, SystemMessage(Party.PartyFullMessage));
        Assert.DoesNotContain(targetInbox, m => m.PayloadCase == ServerMessage.PayloadOneofCase.PartyInvitePrompt);
    }

    [Fact]
    public void Invite_OnlineTarget_SendsAckAndPrompt() {
        var (alice, aliceInbox) = CreateOnline("Alice");
        var (bob, bobInbox) = CreateOnline("Bob");

        Party.HandleInviteRequest(alice, "Bob");

        Assert.Contains(aliceInbox, SystemMessage(Party.InviteSentMessage("Bob")));
        Assert.Contains(bobInbox, m =>
            m.PayloadCase == ServerMessage.PayloadOneofCase.PartyInvitePrompt &&
            m.PartyInvitePrompt.InviterName == "Alice" &&
            m.PartyInvitePrompt.Message == Party.InvitePromptMessage("Alice") &&
            !string.IsNullOrWhiteSpace(m.PartyInvitePrompt.PartyCode));
        Assert.False(string.IsNullOrWhiteSpace(alice.PartyCode));
    }

    [Fact]
    public void Invite_Decline_NotifiesSender() {
        var (alice, aliceInbox) = CreateOnline("Alice");
        var (bob, _) = CreateOnline("Bob");
        Party.HandleInviteRequest(alice, "Bob");
        aliceInbox.Clear();

        Party.HandleInviteResponse(bob, new RespondPartyInviteRequest { Accept = false });

        Assert.Contains(aliceInbox, SystemMessage(Party.DeclinedMessage("Bob")));
        Assert.Null(bob.PartyCode);
    }

    [Fact]
    public void Invite_AcceptResponse_JoinsViaHandleJoinRequest() {
        var (alice, _) = CreateOnline("Alice");
        var (bob, _) = CreateOnline("Bob");
        Party.HandleInviteRequest(alice, "Bob");

        Party.HandleInviteResponse(bob, new RespondPartyInviteRequest { Accept = true });

        Assert.Equal(alice.PartyCode, bob.PartyCode);
        Assert.False(string.IsNullOrWhiteSpace(bob.PartyCode));
    }

    [Fact]
    public void Invite_JoinByCode_UsesSamePathAsPartyUi() {
        var (alice, _) = CreateOnline("Alice");
        var (bob, bobInbox) = CreateOnline("Bob");
        Party.HandleInviteRequest(alice, "Bob");
        var prompt = bobInbox.Single(m => m.PayloadCase == ServerMessage.PayloadOneofCase.PartyInvitePrompt);

        Party.HandleJoinRequest(bob, new JoinPartyRequest { PartyCode = prompt.PartyInvitePrompt.PartyCode });

        Assert.Equal(alice.PartyCode, bob.PartyCode);
        Assert.False(string.IsNullOrWhiteSpace(bob.PartyCode));
    }

    private (GameWorldPlayer Player, List<ServerMessage> Inbox) CreateOnline(string name) {
        var inbox = new List<ServerMessage>();
        var sessionId = Guid.NewGuid();
        var player = new GameWorldPlayer(
            sessionId,
            inbox.Add,
            _ => { },
            _ => { },
            () => { },
            new Dictionary<int, ItemConfig>(),
            new MovementSpeedViolationCheckConfig(false, 10, 1, 1, 1, 20),
            pingVarianceSampleSize: 20,
            antiHackTimingLagFactor: 1.0);
        player.SetCharacterName(name);
        player.SetAccountWallet($"wallet-{sessionId:N}");
        OnlinePlayerDirectory.Register(player);
        players.Add(player);
        return (player, inbox);
    }

    private static Predicate<ServerMessage> SystemMessage(string text) {
        return m =>
            m.PayloadCase == ServerMessage.PayloadOneofCase.SendMessage &&
            m.SendMessage.Message == text;
    }
}
