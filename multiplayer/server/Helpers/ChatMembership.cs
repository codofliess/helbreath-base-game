using System.Collections.Concurrent;

namespace Server.Helpers;

/// <summary>
/// Cross-world guild and party membership used by <see cref="World.Global.GlobalWorld"/> chat routing.
/// Written from game-world join/leave and character load; read from the global chat worker.
/// </summary>
public static class ChatMembership {
    /// <summary>Session → guild id. Empty/missing means the player has no guild.</summary>
    private static readonly ConcurrentDictionary<Guid, string> GuildIdBySession = new();
    /// <summary>Session → party code. Empty/missing means the player has no party.</summary>
    private static readonly ConcurrentDictionary<Guid, string> PartyCodeBySession = new();

    /// <summary>Records or clears the player's guild id for chat scoping.</summary>
    public static void SetGuild(Guid sessionId, string? guildId) {
        var value = (guildId ?? string.Empty).Trim();
        if (value.Length == 0) {
            GuildIdBySession.TryRemove(sessionId, out _);
            return;
        }

        GuildIdBySession[sessionId] = value;
    }

    /// <summary>Records or clears the player's party code for chat scoping.</summary>
    public static void SetParty(Guid sessionId, string? partyCode) {
        var value = (partyCode ?? string.Empty).Trim();
        if (value.Length == 0) {
            PartyCodeBySession.TryRemove(sessionId, out _);
            return;
        }

        PartyCodeBySession[sessionId] = value;
    }

    /// <summary>Drops guild and party entries when a session is fully removed.</summary>
    public static void Clear(Guid sessionId) {
        GuildIdBySession.TryRemove(sessionId, out _);
        PartyCodeBySession.TryRemove(sessionId, out _);
    }

    public static string GetGuildId(Guid sessionId) {
        return GuildIdBySession.TryGetValue(sessionId, out var guildId) ? guildId : string.Empty;
    }

    public static string GetPartyCode(Guid sessionId) {
        return PartyCodeBySession.TryGetValue(sessionId, out var partyCode) ? partyCode : string.Empty;
    }

    public static bool SameGuild(Guid sessionId, string guildId) {
        if (string.IsNullOrEmpty(guildId)) {
            return false;
        }

        return string.Equals(GetGuildId(sessionId), guildId, StringComparison.OrdinalIgnoreCase);
    }

    public static bool SameParty(Guid sessionId, string partyCode) {
        if (string.IsNullOrEmpty(partyCode)) {
            return false;
        }

        return string.Equals(GetPartyCode(sessionId), partyCode, StringComparison.OrdinalIgnoreCase);
    }
}
