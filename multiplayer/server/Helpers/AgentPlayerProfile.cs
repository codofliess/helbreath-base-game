using System.Text;
using Mmorpg.Network;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Owner-trained agent-player profiles: per-character controller + private prompt + allowlisted skill loadout.
/// Account <c>actorKind</c> (middleware SoT) is separate — a human wallet may own agent characters.
/// Prompts never go on observer / SELECTCHAR packets.
/// </summary>
public static class AgentPlayerProfile {
    public const int MaxOwnerPromptChars = 4000;
    public const int MaxSkillSlots = 8;
    public const int MaxSkillIdChars = 64;
    public const int MaxNftMintChars = 88;
    public const int MaxStarterPackIdChars = 64;
    /// <summary>Min ms between owner prompt/loadout writes on an existing character.</summary>
    public const long ProfileWriteCooldownMs = 30_000;

    public const string ControllerHuman = "human";
    public const string ControllerAgent = "agent";
    public const string DefaultStarterPackId = "starter.academy.easy";

    /// <summary>Team catalog ids that may appear on a loadout before the NFT shop exists.</summary>
    public static readonly string[] CatalogSkillIds = [
        "starter.academy.easy",
        "starter.academy.hard",
        "starter.gather.mine",
        "starter.gather.fish",
        "starter.pvp.kite",
    ];

    public static bool IsAgentController(string? kind) =>
        string.Equals(kind, ControllerAgent, StringComparison.OrdinalIgnoreCase);

    public static string NormalizeControllerKind(string? kind) =>
        IsAgentController(kind) ? ControllerAgent : ControllerHuman;

    public static string NormalizeActorKind(string? kind) =>
        string.Equals(kind, "bot", StringComparison.OrdinalIgnoreCase) ? "bot" : "human";

    public static bool IsCatalogSkillId(string? skillId) {
        if (string.IsNullOrWhiteSpace(skillId)) {
            return false;
        }
        var id = skillId.Trim();
        foreach (var known in CatalogSkillIds) {
            if (string.Equals(known, id, StringComparison.Ordinal)) {
                return true;
            }
        }
        return false;
    }

    /// <summary>Strips control characters (keeps newline/tab) and caps length. Never used in observer chat.</summary>
    public static string SanitizeOwnerPrompt(string? raw) {
        if (string.IsNullOrWhiteSpace(raw)) {
            return "";
        }

        var trimmed = raw.Trim();
        var sb = new StringBuilder(Math.Min(trimmed.Length, MaxOwnerPromptChars));
        foreach (var ch in trimmed) {
            if (ch is '\n' or '\r' or '\t' || !char.IsControl(ch)) {
                sb.Append(ch);
                if (sb.Length >= MaxOwnerPromptChars) {
                    break;
                }
            }
        }
        return sb.ToString();
    }

    public static IEnumerable<PersistedAgentSkillSlot> FromProtoSlots(IEnumerable<AgentSkillLoadoutSlot>? slots) {
        if (slots is null) {
            yield break;
        }
        foreach (var slot in slots) {
            yield return new PersistedAgentSkillSlot(
                slot.SkillId ?? "",
                slot.HasNftMint ? slot.NftMint : "",
                slot.Consumed);
        }
    }

    public static PersistedAgentSkillSlot[] SanitizeSkills(IEnumerable<PersistedAgentSkillSlot>? slots) {
        if (slots is null) {
            return [];
        }

        var seen = new HashSet<string>(StringComparer.Ordinal);
        var list = new List<PersistedAgentSkillSlot>(MaxSkillSlots);
        foreach (var slot in slots) {
            if (list.Count >= MaxSkillSlots) {
                break;
            }
            var id = (slot.SkillId ?? string.Empty).Trim();
            if (id.Length > MaxSkillIdChars || !IsCatalogSkillId(id) || !seen.Add(id)) {
                continue;
            }
            var mint = (slot.NftMint ?? string.Empty).Trim();
            if (mint.Length > MaxNftMintChars) {
                mint = mint[..MaxNftMintChars];
            }
            list.Add(new PersistedAgentSkillSlot(id, mint, slot.Consumed));
        }
        return list.ToArray();
    }

    /// <summary>
    /// Builds a persistable profile from an owner write. Unknown skill ids are dropped.
    /// Empty agent loadout gets the team starter pack so training can continue from a known kit.
    /// </summary>
    public static PersistedAgentProfile? TryBuild(
        string? controllerKind,
        string? ownerPrompt,
        IEnumerable<PersistedAgentSkillSlot>? skills,
        string? starterPackId,
        long nowMs,
        bool defaultAgentWhenBotAccount) {
        var kind = NormalizeControllerKind(controllerKind);
        if (kind == ControllerHuman && defaultAgentWhenBotAccount) {
            kind = ControllerAgent;
        }

        var sanitizedSkills = SanitizeSkills(skills);
        var prompt = SanitizeOwnerPrompt(ownerPrompt);
        var pack = (starterPackId ?? string.Empty).Trim();
        if (pack.Length > MaxStarterPackIdChars || (pack.Length > 0 && !IsCatalogSkillId(pack))) {
            pack = "";
        }

        if (kind == ControllerHuman && prompt.Length == 0 && sanitizedSkills.Length == 0 && pack.Length == 0) {
            return null;
        }

        if (kind == ControllerAgent && sanitizedSkills.Length == 0) {
            pack = pack.Length > 0 ? pack : DefaultStarterPackId;
            sanitizedSkills = [new PersistedAgentSkillSlot(pack, "", Consumed: false)];
        }

        return new PersistedAgentProfile(kind, prompt, sanitizedSkills, pack, nowMs);
    }

    /// <summary>Applies an owner patch when the write cooldown has elapsed.</summary>
    public static bool TryMerge(
        PersistedAgentProfile? current,
        PersistedAgentProfile incoming,
        long nowMs,
        out PersistedAgentProfile next,
        out string rejectReason) {
        ArgumentNullException.ThrowIfNull(incoming);
        next = incoming;
        rejectReason = "";

        if (current is not null &&
            current.LastWriteMs > 0 &&
            nowMs - current.LastWriteMs < ProfileWriteCooldownMs) {
            rejectReason = "Agent profile write rate limited.";
            next = current;
            return false;
        }

        next = incoming with { LastWriteMs = nowMs };
        return true;
    }
}
