using System;
using System.Collections.Generic;
using System.Threading;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Minimal in-memory party MVP: create / join-by-code / leave / invite-by-name.
/// <c>/invite</c> and the F5 Party panel share create and join-by-code; invite only
/// adds an online-target prompt. Credits Beginner Path <c>create_or_join_party</c>
/// on successful create or join.
/// </summary>
public static class Party {
    public const string InviteUsageMessage = "Type /invite followed by a name.";
    public const string PartyFullMessage = "Your party is full.";
    public const string PartyChatNeedInviteMessage =
        "You're not in a party. Type /invite and a name to start one.";

    private const int MaxMembers = 8;
    private const int PartyCodeLength = 5;

    private static readonly object Gate = new();
    private static readonly Dictionary<string, PartyInstance> PartiesByCode =
        new(StringComparer.OrdinalIgnoreCase);
    private static readonly Dictionary<Guid, string> PartyCodeBySessionId = new();
    private static readonly Dictionary<Guid, PendingInvite> PendingByInviteeSessionId = new();
    private static int nextCodeSeed;

    /// <summary>Creates a solo party for the player (fails if already in one).</summary>
    public static void HandleCreateRequest(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);

        lock (Gate) {
            if (PartyCodeBySessionId.ContainsKey(player.SessionId)) {
                SendStateLocked(player, "Already in a party — leave first to create another.");
                return;
            }

            CreatePartyLocked(player);
        }

        BeginnerPath.OnPartyJoinedOrCreated(player);
    }

    /// <summary>Joins an existing party by short code (fails if already in a party or code unknown).</summary>
    public static void HandleJoinRequest(GameWorldPlayer player, JoinPartyRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        var code = (request.PartyCode ?? string.Empty).Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(code)) {
            SendSoloState(player, inParty: false, message: "Enter a party code to join.");
            return;
        }

        lock (Gate) {
            if (PartyCodeBySessionId.ContainsKey(player.SessionId)) {
                SendStateLocked(player, "Already in a party — leave first to join another.");
                return;
            }

            if (!PartiesByCode.TryGetValue(code, out var party)) {
                SendSoloState(player, inParty: false, message: $"No party with code '{code}'.");
                return;
            }

            if (party.Members.Count >= MaxMembers) {
                SendSoloState(player, inParty: false, message: "That party is full.");
                return;
            }

            party.Members[player.SessionId] = player;
            PartyCodeBySessionId[player.SessionId] = party.Code;
            player.SetPartyCode(party.Code);
            PendingByInviteeSessionId.Remove(player.SessionId);
            BroadcastStateLocked(party, $"{player.CharacterName} joined the party.");
        }

        BeginnerPath.OnPartyJoinedOrCreated(player);
    }

    /// <summary>
    /// Invites an online player into the sender's party, creating a solo party first when needed.
    /// Join still goes through <see cref="HandleJoinRequest"/> (same as the F5 Party panel).
    /// </summary>
    public static void HandleInviteRequest(GameWorldPlayer player, InvitePartyRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);
        HandleInviteRequest(player, request.CharacterName);
    }

    /// <summary>Invites by character name (chat <c>/invite</c> and tests).</summary>
    public static void HandleInviteRequest(GameWorldPlayer player, string? characterName) {
        ArgumentNullException.ThrowIfNull(player);

        var typedName = (characterName ?? string.Empty).Trim();
        if (typedName.Length == 0) {
            SendSystem(player, InviteUsageMessage);
            return;
        }

        if (!OnlinePlayerDirectory.TryGetByCharacterName(typedName, out var target) ||
            target is null ||
            target.Disconnected ||
            target.SessionId == player.SessionId) {
            SendSystem(player, OfflineMessage(typedName));
            return;
        }

        var displayName = DisplayName(target, typedName);
        var createdParty = false;
        string partyCode;
        string inviterName;

        lock (Gate) {
            if (PartyCodeBySessionId.ContainsKey(target.SessionId)) {
                SendSystem(player, AlreadyInPartyMessage(displayName));
                return;
            }

            if (!PartyCodeBySessionId.TryGetValue(player.SessionId, out var existingCode) ||
                !PartiesByCode.TryGetValue(existingCode, out var party)) {
                partyCode = CreatePartyLocked(player);
                createdParty = true;
                party = PartiesByCode[partyCode];
            } else {
                partyCode = existingCode;
            }

            if (party.Members.Count >= MaxMembers) {
                SendSystem(player, PartyFullMessage);
                return;
            }

            inviterName = DisplayName(player, "Player");
            PendingByInviteeSessionId[target.SessionId] = new PendingInvite(
                player.SessionId,
                partyCode,
                inviterName);
        }

        if (createdParty) {
            BeginnerPath.OnPartyJoinedOrCreated(player);
        }

        SendSystem(player, InviteSentMessage(displayName));
        NetworkManager.SendToPlayer(target, NetworkManager.CreatePartyInvitePrompt(
            inviterName,
            InvitePromptMessage(inviterName),
            partyCode));
    }

    /// <summary>
    /// Invitee accept joins via <see cref="HandleJoinRequest"/>; decline notifies the inviter.
    /// </summary>
    public static void HandleInviteResponse(GameWorldPlayer player, RespondPartyInviteRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        if (request.Accept) {
            string? code = null;
            lock (Gate) {
                if (PendingByInviteeSessionId.TryGetValue(player.SessionId, out var pending)) {
                    code = pending.PartyCode;
                }
            }

            if (string.IsNullOrWhiteSpace(code)) {
                return;
            }

            HandleJoinRequest(player, new JoinPartyRequest { PartyCode = code });
            return;
        }

        HandleInviteDecline(player);
    }

    public static string OfflineMessage(string name) => $"{name} isn't online.";

    public static string AlreadyInPartyMessage(string name) => $"{name} is already in a party.";

    public static string InviteSentMessage(string name) => $"Invite sent to {name}.";

    public static string InvitePromptMessage(string inviterName) =>
        $"{inviterName} invites you to their party.";

    public static string DeclinedMessage(string name) => $"{name} declined your invite.";

    /// <summary>Clears in-memory parties and pending invites so server tests do not leak across cases.</summary>
    public static void ResetTransientState() {
        lock (Gate) {
            PartiesByCode.Clear();
            PartyCodeBySessionId.Clear();
            PendingByInviteeSessionId.Clear();
        }
    }

    /// <summary>Leaves the current party; if the leader leaves, promotes another member or dissolves.</summary>
    public static void HandleLeaveRequest(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        LeaveInternal(player, notifyMessage: $"{player.CharacterName} left the party.");
    }

    /// <summary>Called when a player is fully removed from a world after disconnect grace.</summary>
    public static void OnPlayerRemoved(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        ClearPendingForInvitee(player.SessionId);
        LeaveInternal(player, notifyMessage: $"{player.CharacterName} disconnected.");
    }

    private static void HandleInviteDecline(GameWorldPlayer invitee) {
        PendingInvite? pending;
        lock (Gate) {
            if (!PendingByInviteeSessionId.TryGetValue(invitee.SessionId, out pending)) {
                return;
            }

            PendingByInviteeSessionId.Remove(invitee.SessionId);
        }

        GameWorldPlayer? inviter = null;
        lock (Gate) {
            if (PartyCodeBySessionId.TryGetValue(pending.InviterSessionId, out var code) &&
                PartiesByCode.TryGetValue(code, out var party) &&
                party.Members.TryGetValue(pending.InviterSessionId, out var member)) {
                inviter = member;
            }
        }

        if (inviter is null || inviter.Disconnected) {
            return;
        }

        SendSystem(inviter, DeclinedMessage(DisplayName(invitee, "Player")));
    }

    private static void ClearPendingForInvitee(Guid inviteeSessionId) {
        lock (Gate) {
            PendingByInviteeSessionId.Remove(inviteeSessionId);
        }
    }

    /// <summary>
    /// System-chat loot ping to every party member (including looter) so drops are not silent.
    /// No-op when the player is not in a party.
    /// </summary>
    public static void NotifyLootDrop(GameWorldPlayer looter, string itemName, int quantity = 1) {
        ArgumentNullException.ThrowIfNull(looter);
        if (string.IsNullOrWhiteSpace(itemName)) {
            return;
        }

        var qty = quantity > 1 ? $" x{quantity}" : "";
        var name = string.IsNullOrWhiteSpace(looter.CharacterName) ? "Player" : looter.CharacterName;
        var text = $"[Party] {name} looted {itemName}{qty}.";

        lock (Gate) {
            if (!PartyCodeBySessionId.TryGetValue(looter.SessionId, out var code) ||
                !PartiesByCode.TryGetValue(code, out var party) ||
                party.Members.Count < 2) {
                return;
            }

            foreach (var member in party.Members.Values) {
                if (member.Disconnected) {
                    continue;
                }
                NetworkManager.SendToPlayer(member, NetworkManager.CreateSendMessage(text));
            }
        }
    }

    /// <summary>
    /// Rebroadcasts party membership with fresh HP/max HP when a member's vitals change.
    /// Empty <c>message</c> so clients do not toast or spam the system log.
    /// </summary>
    public static void NotifyVitalsChanged(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);

        lock (Gate) {
            if (!PartyCodeBySessionId.TryGetValue(player.SessionId, out var code) ||
                !PartiesByCode.TryGetValue(code, out var party)) {
                return;
            }

            BroadcastStateLocked(party, message: string.Empty);
        }
    }

    private static void LeaveInternal(GameWorldPlayer player, string notifyMessage) {
        PartyInstance? party;
        lock (Gate) {
            if (!PartyCodeBySessionId.TryGetValue(player.SessionId, out var code) ||
                !PartiesByCode.TryGetValue(code, out party)) {
                player.ClearPartyCode();
                SendSoloState(player, inParty: false, message: "Not in a party.");
                return;
            }

            party.Members.Remove(player.SessionId);
            PartyCodeBySessionId.Remove(player.SessionId);
            PendingByInviteeSessionId.Remove(player.SessionId);
            player.ClearPartyCode();

            if (party.Members.Count == 0) {
                PartiesByCode.Remove(party.Code);
                SendSoloState(player, inParty: false, message: "Left party.");
                return;
            }

            if (party.LeaderSessionId == player.SessionId) {
                foreach (var remaining in party.Members.Keys) {
                    party.LeaderSessionId = remaining;
                    break;
                }
            }

            SendSoloState(player, inParty: false, message: "Left party.");
            BroadcastStateLocked(party, notifyMessage);
        }
    }

    private static string AllocateCodeLocked() {
        for (var attempt = 0; attempt < 64; attempt++) {
            var n = Interlocked.Increment(ref nextCodeSeed);
            var code = (n % 1_000_000).ToString("D5");
            if (code.Length > PartyCodeLength) {
                code = code[^PartyCodeLength..];
            }
            if (!PartiesByCode.ContainsKey(code)) {
                return code;
            }
        }

        return Guid.NewGuid().ToString("N")[..PartyCodeLength].ToUpperInvariant();
    }

    private static string CreatePartyLocked(GameWorldPlayer player) {
        var code = AllocateCodeLocked();
        var party = new PartyInstance(code, player.SessionId);
        party.Members[player.SessionId] = player;
        PartiesByCode[code] = party;
        PartyCodeBySessionId[player.SessionId] = code;
        player.SetPartyCode(code);
        BroadcastStateLocked(party, $"Party created. Code: {code}");
        return code;
    }

    private static void SendSystem(GameWorldPlayer player, string message) {
        NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(message));
    }

    private static string DisplayName(GameWorldPlayer player, string fallback) {
        return string.IsNullOrWhiteSpace(player.CharacterName) ? fallback : player.CharacterName;
    }

    private static void BroadcastStateLocked(PartyInstance party, string message) {
        foreach (var member in party.Members.Values) {
            NetworkManager.SendToPlayer(member, NetworkManager.CreatePartyState(BuildStateLocked(party, member, message)));
        }
    }

    private static void SendStateLocked(GameWorldPlayer player, string message) {
        if (!PartyCodeBySessionId.TryGetValue(player.SessionId, out var code) ||
            !PartiesByCode.TryGetValue(code, out var party)) {
            SendSoloState(player, inParty: false, message: message);
            return;
        }

        NetworkManager.SendToPlayer(player, NetworkManager.CreatePartyState(BuildStateLocked(party, player, message)));
    }

    private static void SendSoloState(GameWorldPlayer player, bool inParty, string message) {
        NetworkManager.SendToPlayer(player, NetworkManager.CreatePartyState(new PartyState {
            InParty = inParty,
            PartyCode = string.Empty,
            IsLeader = false,
            Message = message ?? string.Empty,
        }));
    }

    private static PartyState BuildStateLocked(PartyInstance party, GameWorldPlayer recipient, string message) {
        var state = new PartyState {
            InParty = true,
            PartyCode = party.Code,
            IsLeader = recipient.SessionId == party.LeaderSessionId,
            Message = message ?? string.Empty,
        };
        foreach (var member in party.Members.Values) {
            var name = string.IsNullOrWhiteSpace(member.CharacterName) ? "Player" : member.CharacterName;
            state.MemberNames.Add(name);
            state.Members.Add(new PartyMember {
                Name = name,
                Hp = member.Hp,
                MaxHp = member.MaxHp,
                IsLeader = member.SessionId == party.LeaderSessionId,
            });
        }

        return state;
    }

    private sealed class PartyInstance {
        public string Code { get; }
        public Guid LeaderSessionId { get; set; }
        public Dictionary<Guid, GameWorldPlayer> Members { get; } = new();

        public PartyInstance(string code, Guid leaderSessionId) {
            Code = code;
            LeaderSessionId = leaderSessionId;
        }
    }

    private sealed class PendingInvite {
        public Guid InviterSessionId { get; }
        public string PartyCode { get; }
        public string InviterName { get; }

        public PendingInvite(Guid inviterSessionId, string partyCode, string inviterName) {
            InviterSessionId = inviterSessionId;
            PartyCode = partyCode;
            InviterName = inviterName;
        }
    }
}
