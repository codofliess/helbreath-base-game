using System;
using System.Collections.Generic;
using System.Threading;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Minimal in-memory party MVP: create / join-by-code / leave. Credits Beginner Path
/// <c>create_or_join_party</c> on successful create or join. Not a full matchmaking system.
/// </summary>
public static class Party {
    private const int MaxMembers = 8;
    private const int PartyCodeLength = 5;

    private static readonly object Gate = new();
    private static readonly Dictionary<string, PartyInstance> PartiesByCode =
        new(StringComparer.OrdinalIgnoreCase);
    private static readonly Dictionary<Guid, string> PartyCodeBySessionId = new();
    private static int nextCodeSeed;

    /// <summary>Creates a solo party for the player (fails if already in one).</summary>
    public static void HandleCreateRequest(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);

        lock (Gate) {
            if (PartyCodeBySessionId.ContainsKey(player.SessionId)) {
                SendStateLocked(player, "Already in a party — leave first to create another.");
                return;
            }

            var code = AllocateCodeLocked();
            var party = new PartyInstance(code, player.SessionId);
            party.Members[player.SessionId] = player;
            PartiesByCode[code] = party;
            PartyCodeBySessionId[player.SessionId] = code;
            player.SetPartyCode(code);
            BroadcastStateLocked(party, $"Party created. Code: {code}");
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
            BroadcastStateLocked(party, $"{player.CharacterName} joined the party.");
        }

        BeginnerPath.OnPartyJoinedOrCreated(player);
    }

    /// <summary>Leaves the current party; if the leader leaves, promotes another member or dissolves.</summary>
    public static void HandleLeaveRequest(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        LeaveInternal(player, notifyMessage: $"{player.CharacterName} left the party.");
    }

    /// <summary>Called when a player is fully removed from a world after disconnect grace.</summary>
    public static void OnPlayerRemoved(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        LeaveInternal(player, notifyMessage: $"{player.CharacterName} disconnected.");
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
}
