using System;
using System.Collections.Generic;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Optional beginner training path (levels 1→80): quest catalog from <c>BeginnerPath.json</c>,
/// enroll/abandon without penalty, and progress hooks for kills / world visits / NPC talk /
/// shop buys / party create-join / training ApplyPreset. Soft <c>ui_action</c> remains for
/// future gates that cannot be verified server-side. See <c>docs/BEGINNER-PATH-1-80.md</c>.
/// </summary>
public static class BeginnerPath {
    public const int EnzuCatalogNpcId = 11;
    public const int DrillmasterCatalogNpcId = 12;
    public const int MercCaptainCatalogNpcId = 13;

    private static BeginnerPathConfig? config;
    private static readonly Dictionary<string, BeginnerQuestConfig> questsById =
        new(StringComparer.Ordinal);
    private static readonly List<BeginnerQuestConfig> orderedLiveQuests = [];

    /// <summary>Loads and validates the beginner-path catalog once at server startup.</summary>
    public static void Initialize(BeginnerPathConfig pathConfig) {
        ArgumentNullException.ThrowIfNull(pathConfig);
        config = pathConfig;
        questsById.Clear();
        orderedLiveQuests.Clear();
        if (pathConfig.Quests is null || pathConfig.Quests.Length == 0) {
            throw new InvalidOperationException("BeginnerPath.json must define at least one quest.");
        }

        foreach (var quest in pathConfig.Quests) {
            if (string.IsNullOrWhiteSpace(quest.Id) || string.IsNullOrWhiteSpace(quest.ObjectiveKind)) {
                throw new InvalidOperationException($"BeginnerPath quest '{quest.Id}' is missing id or objectiveKind.");
            }
            if (quest.Required < 1) {
                throw new InvalidOperationException($"BeginnerPath quest '{quest.Id}' required must be >= 1.");
            }
            if (!questsById.TryAdd(quest.Id, quest)) {
                throw new InvalidOperationException($"Duplicate BeginnerPath quest id '{quest.Id}'.");
            }
            if (IsLive(quest)) {
                ValidateLiveObjective(quest);
                orderedLiveQuests.Add(quest);
            }
        }
    }

    /// <summary>True when the catalog finished loading.</summary>
    public static bool IsReady => config is not null;

    /// <summary>Sends a full <see cref="BeginnerPathState"/> snapshot to the player.</summary>
    public static void SendState(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        NetworkManager.SendToPlayer(player, NetworkManager.CreateBeginnerPathState(BuildState(player)));
    }

    /// <summary>Enrols or re-enrols the player on the first incomplete live quest.</summary>
    public static void HandleEnrollRequest(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        if (!IsReady) {
            return;
        }

        player.SetBeginnerAbandoned(false);
        player.SetBeginnerEnrolled(true);

        if (string.IsNullOrWhiteSpace(player.BeginnerActiveQuestId) ||
            !questsById.TryGetValue(player.BeginnerActiveQuestId, out var active) ||
            !IsLive(active) ||
            player.HasCompletedBeginnerQuest(active.Id)) {
            AssignNextLiveQuest(player);
        }

        TryCompleteEnrollObjective(player);
        SendState(player);
    }

    /// <summary>Abandons the path with no XP/world/item penalty; completed quests are kept.</summary>
    public static void HandleAbandonRequest(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        player.SetBeginnerAbandoned(true);
        player.ClearBeginnerActiveQuest();
        SendState(player);
    }

    /// <summary>Credits talk objectives (Enzu / Drillmaster / Merc Captain) and may advance the path.</summary>
    public static void HandleTalkRequest(GameWorldPlayer player, BeginnerPathTalkRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);
        if (!IsPathActive(player) || !TryGetActiveLiveQuest(player, out var quest)) {
            SendState(player);
            return;
        }

        if (!string.Equals(quest.ObjectiveKind, "talk_npc", StringComparison.OrdinalIgnoreCase)) {
            SendState(player);
            return;
        }

        if (quest.CatalogNpcId is int requiredNpc && requiredNpc != request.CatalogNpcId) {
            SendState(player);
            return;
        }

        CreditProgress(player, quest, amount: 1);
        SendState(player);
    }

    /// <summary>Credits soft UI objectives (<c>ui_action</c>) when the client reports a matching action id.</summary>
    public static void HandleUiActionRequest(GameWorldPlayer player, BeginnerPathUiActionRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);
        if (!IsPathActive(player) || string.IsNullOrWhiteSpace(request.ActionId) ||
            !TryGetActiveLiveQuest(player, out var quest)) {
            SendState(player);
            return;
        }

        if (!string.Equals(quest.ObjectiveKind, "ui_action", StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(quest.UiActionId, request.ActionId, StringComparison.OrdinalIgnoreCase)) {
            SendState(player);
            return;
        }

        CreditProgress(player, quest, amount: 1);
        SendState(player);
    }

    /// <summary>Advances kill / mob_kills objectives after a credited monster death.</summary>
    public static void OnMonsterKilled(GameWorldPlayer killer, int catalogMonsterId) {
        ArgumentNullException.ThrowIfNull(killer);
        if (!IsPathActive(killer) || !TryGetActiveLiveQuest(killer, out var quest)) {
            return;
        }

        if (string.Equals(quest.ObjectiveKind, "mob_kills", StringComparison.OrdinalIgnoreCase)) {
            CreditProgress(killer, quest, amount: 1);
            SendState(killer);
            return;
        }

        if (!string.Equals(quest.ObjectiveKind, "kill", StringComparison.OrdinalIgnoreCase) ||
            quest.MonsterId is not int monsterId ||
            monsterId != catalogMonsterId) {
            return;
        }

        CreditProgress(killer, quest, amount: 1);
        SendState(killer);
    }

    /// <summary>Credits <c>create_or_join_party</c> after a successful party create or join.</summary>
    public static void OnPartyJoinedOrCreated(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        if (!IsPathActive(player) || !TryGetActiveLiveQuest(player, out var quest)) {
            return;
        }

        if (!string.Equals(quest.ObjectiveKind, "create_or_join_party", StringComparison.OrdinalIgnoreCase)) {
            return;
        }

        CreditProgress(player, quest, amount: 1);
        SendState(player);
    }

    /// <summary>
    /// Credits guild-hint progress when Howard registers guild interest
    /// (<c>talk_npc</c> catalog 2 / Guild Hall desk).
    /// </summary>
    public static void OnGuildHallInterest(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        if (!IsPathActive(player) || !TryGetActiveLiveQuest(player, out var quest)) {
            return;
        }

        var isHowardTalk = string.Equals(quest.ObjectiveKind, "talk_npc", StringComparison.OrdinalIgnoreCase)
            && quest.CatalogNpcId is int catalogNpcId
            && catalogNpcId == CityNpcServices.HowardCatalogNpcId;

        if (!isHowardTalk) {
            return;
        }

        CreditProgress(player, quest, amount: 1);
        SendState(player);
    }

    /// <summary>Advances visit_world objectives when the player enters a matching world.</summary>
    public static void OnWorldEntered(GameWorldPlayer player, string worldId) {
        ArgumentNullException.ThrowIfNull(player);
        if (string.IsNullOrWhiteSpace(worldId) || !IsPathActive(player) ||
            !TryGetActiveLiveQuest(player, out var quest)) {
            return;
        }

        if (!string.Equals(quest.ObjectiveKind, "visit_world", StringComparison.OrdinalIgnoreCase) ||
            quest.WorldIds is null || quest.WorldIds.Length == 0) {
            return;
        }

        var matched = false;
        foreach (var id in quest.WorldIds) {
            if (string.Equals(id, worldId, StringComparison.OrdinalIgnoreCase)) {
                matched = true;
                break;
            }
        }
        if (!matched) {
            return;
        }

        CreditProgress(player, quest, amount: 1);
        SendState(player);
    }

    /// <summary>Advances buy_item objectives after a successful Shop Keeper purchase.</summary>
    public static void OnShopItemPurchased(GameWorldPlayer player, int itemId) {
        ArgumentNullException.ThrowIfNull(player);
        if (!IsPathActive(player) || !TryGetActiveLiveQuest(player, out var quest)) {
            return;
        }

        if (!string.Equals(quest.ObjectiveKind, "buy_item", StringComparison.OrdinalIgnoreCase) ||
            quest.ItemIds is null || quest.ItemIds.Length == 0) {
            return;
        }

        var matched = false;
        foreach (var id in quest.ItemIds) {
            if (id == itemId) {
                matched = true;
                break;
            }
        }
        if (!matched) {
            return;
        }

        CreditProgress(player, quest, amount: 1);
        SendState(player);
    }

    /// <summary>
    /// Credits <c>apply_training_preset</c> when Training Arena ApplyPreset succeeds
    /// (at least one chase dummy spawned).
    /// </summary>
    public static void OnTrainingPresetApplied(GameWorldPlayer player, string presetId) {
        ArgumentNullException.ThrowIfNull(player);
        if (string.IsNullOrWhiteSpace(presetId) || !IsPathActive(player) ||
            !TryGetActiveLiveQuest(player, out var quest)) {
            return;
        }

        if (!string.Equals(quest.ObjectiveKind, "apply_training_preset", StringComparison.OrdinalIgnoreCase)) {
            return;
        }

        CreditProgress(player, quest, amount: 1);
        SendState(player);
    }

    private static bool IsPathActive(GameWorldPlayer player) =>
        IsReady && player.BeginnerEnrolled && !player.BeginnerAbandoned;

    private static void ValidateLiveObjective(BeginnerQuestConfig quest) {
        var kind = quest.ObjectiveKind;
        if (string.Equals(kind, "kill", StringComparison.OrdinalIgnoreCase) && quest.MonsterId is null) {
            throw new InvalidOperationException($"BeginnerPath quest '{quest.Id}' kill requires monsterId.");
        }
        if (string.Equals(kind, "visit_world", StringComparison.OrdinalIgnoreCase) &&
            (quest.WorldIds is null || quest.WorldIds.Length == 0)) {
            throw new InvalidOperationException($"BeginnerPath quest '{quest.Id}' visit_world requires worldIds.");
        }
        if (string.Equals(kind, "talk_npc", StringComparison.OrdinalIgnoreCase) && quest.CatalogNpcId is null) {
            throw new InvalidOperationException($"BeginnerPath quest '{quest.Id}' talk_npc requires catalogNpcId.");
        }
        if (string.Equals(kind, "buy_item", StringComparison.OrdinalIgnoreCase) &&
            (quest.ItemIds is null || quest.ItemIds.Length == 0)) {
            throw new InvalidOperationException($"BeginnerPath quest '{quest.Id}' buy_item requires itemIds.");
        }
        if (string.Equals(kind, "ui_action", StringComparison.OrdinalIgnoreCase) &&
            string.IsNullOrWhiteSpace(quest.UiActionId)) {
            throw new InvalidOperationException($"BeginnerPath quest '{quest.Id}' ui_action requires uiActionId.");
        }
        if (string.Equals(kind, "create_or_join_party", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(kind, "mob_kills", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(kind, "apply_training_preset", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(kind, "enroll", StringComparison.OrdinalIgnoreCase)) {
            return;
        }
        if (string.Equals(kind, "stub", StringComparison.OrdinalIgnoreCase)) {
            throw new InvalidOperationException($"BeginnerPath quest '{quest.Id}' is marked live but objectiveKind is stub.");
        }
    }

    private static void CreditProgress(GameWorldPlayer player, BeginnerQuestConfig quest, int amount) {
        var next = player.BeginnerProgress + Math.Max(1, amount);
        if (next > quest.Required) {
            next = quest.Required;
        }
        player.SetBeginnerProgress(next);
        if (next >= quest.Required) {
            CompleteActiveQuest(player, quest);
        }
    }

    private static void TryCompleteEnrollObjective(GameWorldPlayer player) {
        if (!TryGetActiveLiveQuest(player, out var quest)) {
            return;
        }
        if (!string.Equals(quest.ObjectiveKind, "enroll", StringComparison.OrdinalIgnoreCase)) {
            return;
        }
        player.SetBeginnerProgress(1);
        CompleteActiveQuest(player, quest);
    }

    private static void CompleteActiveQuest(GameWorldPlayer player, BeginnerQuestConfig quest) {
        player.MarkBeginnerQuestCompleted(quest.Id);
        AssignNextLiveQuest(player);
    }

    private static void AssignNextLiveQuest(GameWorldPlayer player) {
        foreach (var quest in orderedLiveQuests) {
            if (player.HasCompletedBeginnerQuest(quest.Id)) {
                continue;
            }
            player.SetBeginnerActiveQuest(quest.Id, progress: 0);
            return;
        }
        player.ClearBeginnerActiveQuest();
    }

    private static bool TryGetActiveLiveQuest(GameWorldPlayer player, out BeginnerQuestConfig quest) {
        quest = null!;
        if (string.IsNullOrWhiteSpace(player.BeginnerActiveQuestId)) {
            return false;
        }
        if (!questsById.TryGetValue(player.BeginnerActiveQuestId, out quest!)) {
            return false;
        }
        return IsLive(quest);
    }

    private static bool IsLive(BeginnerQuestConfig quest) =>
        string.Equals(quest.Status, "live", StringComparison.OrdinalIgnoreCase);

    /// <summary>Builds the network snapshot for UI (Quest panel + hints).</summary>
    public static BeginnerPathState BuildState(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        var state = new BeginnerPathState {
            Enrolled = player.BeginnerEnrolled,
            Abandoned = player.BeginnerAbandoned,
            Progress = player.BeginnerProgress,
            CanEnroll = !player.BeginnerEnrolled || player.BeginnerAbandoned ||
                string.IsNullOrWhiteSpace(player.BeginnerActiveQuestId),
            StatusMessage = BuildStatusMessage(player),
        };

        foreach (var id in player.BeginnerCompletedQuestIds) {
            state.CompletedQuestIds.Add(id);
        }

        if (!string.IsNullOrWhiteSpace(player.BeginnerActiveQuestId) &&
            questsById.TryGetValue(player.BeginnerActiveQuestId, out var active)) {
            state.ActiveQuestId = active.Id;
            state.ActiveQuestTitle = active.Title ?? active.Id;
            state.ActiveQuestHint = active.Hint ?? "";
            state.Required = active.Required;
            state.ObjectiveKind = active.ObjectiveKind;
            if (!string.IsNullOrWhiteSpace(active.UiActionId)) {
                state.UiActionId = active.UiActionId;
            }
        }

        foreach (var quest in config?.Quests ?? []) {
            if (IsLive(quest) || player.HasCompletedBeginnerQuest(quest.Id)) {
                continue;
            }
            state.NextStubTitle = quest.Title ?? quest.Id;
            break;
        }

        return state;
    }

    private static string BuildStatusMessage(GameWorldPlayer player) {
        if (player.BeginnerAbandoned) {
            return "Beginner training abandoned — play freely. Re-enroll anytime with Enzu or Quest (F5).";
        }
        if (!player.BeginnerEnrolled) {
            return "Optional beginner training (1→80). Enroll to get guided farm / barracks tips.";
        }
        if (string.IsNullOrWhiteSpace(player.BeginnerActiveQuestId)) {
            return "Beginner path 1→80 complete. Training Arena + Farm Barracks tips stay in Shift+F10.";
        }
        return "Beginner training active. Abandon anytime with no penalty.";
    }
}
