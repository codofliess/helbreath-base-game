using System;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Aresden/Elvine Garden (areuni / elvuni) contribution quests (Olympia unicorn + troll).
/// Rewards: city contribution points + pending $HELL sized so that at $1M market cap
/// and ~400M circulating (mining pool), 1 quest ≈ $1 (400 HELL).
/// </summary>
public static class GardenQuests {
    public const int GardenWardenCatalogNpcId = 17;
    public const int UnicornMonsterId = 59;
    public const int TrollMonsterId = 58;

    /// <summary>Unicorn garden quest kill count.</summary>
    public const int UnicornKillsRequired = 50;

    /// <summary>Troll garden quest kill count.</summary>
    public const int TrollKillsRequired = 500;

    /// <summary>Classic contribution points per completed garden quest.</summary>
    public const int ContributionReward = 50;

    /// <summary>Pending $HELL per completed garden quest (temporary prize until MC pricing is locked).</summary>
    public const long HellRewardPerQuest = 1000;

    public const string QuestUnicorn = "garden_unicorn";
    public const string QuestTroll = "garden_troll";

    public static bool IsGardenWorld(string? worldId) =>
        string.Equals(worldId, "areuni", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(worldId, "elvuni", StringComparison.OrdinalIgnoreCase);

    public static bool IsGardenWarden(int catalogNpcId) => catalogNpcId == GardenWardenCatalogNpcId;

    /// <summary>Hooks CityNpcServiceRequest for Garden Warden (open / accept / status).</summary>
    public static bool TryHandleService(
        GameWorldRef wr,
        GameWorldPlayer player,
        CityNpcServiceRequest request,
        int catalogNpcId) {
        if (!IsGardenWarden(catalogNpcId) || !IsGardenWorld(wr.WorldId)) {
            return false;
        }

        var action = (request.Action ?? "open").Trim().ToLowerInvariant();
        switch (action) {
            case "" or "open" or "status":
                Reply(player, StatusText(player));
                return true;
            case "accept_unicorn":
                Accept(player, QuestUnicorn);
                return true;
            case "accept_troll":
                Accept(player, QuestTroll);
                return true;
            case "abandon":
                player.ClearGardenQuest();
                Reply(player, "Garden quest abandoned.");
                return true;
            default:
                Reply(player, "Use the buttons: Unicorns, Trolls, or Abandon.");
                return true;
        }
    }

    public static void OnMonsterKilled(GameWorldPlayer killer, int catalogMonsterId) {
        ArgumentNullException.ThrowIfNull(killer);
        var quest = killer.GardenQuestId;
        if (string.IsNullOrEmpty(quest)) {
            return;
        }

        if (quest == QuestUnicorn && catalogMonsterId != UnicornMonsterId) {
            return;
        }
        if (quest == QuestTroll && catalogMonsterId != TrollMonsterId) {
            return;
        }

        var need = KillsRequiredFor(quest);
        var next = killer.GardenQuestProgress + 1;
        killer.SetGardenQuestProgress(next);
        if (next < need) {
            // Silent progress — no chat spam; only dialog on completion (Olympia-style).
            return;
        }

        // Complete — show NPC dialog box (not only system chat).
        killer.ClearGardenQuest();
        killer.AddContribution(ContributionReward);
        HellMiningStore.GrantPendingHell(killer.AccountWallet, HellRewardPerQuest);
        Reply(
            killer,
            $"Garden quest complete!\n\n" +
            $"+{ContributionReward} contribution\n" +
            $"+{HellRewardPerQuest} pending $HELL\n\n" +
            "Talk to the Garden Warden for another hunt.");
        Console.WriteLine(
            $"[Garden] {killer.CharacterName} completed {quest} +contrib={ContributionReward} +hell={HellRewardPerQuest}.");
    }

    static void Accept(GameWorldPlayer player, string questId) {
        if (!string.IsNullOrEmpty(player.GardenQuestId) && player.GardenQuestId != questId) {
            Reply(player, $"Finish or abandon your current quest ({QuestLabel(player.GardenQuestId)}) first.");
            return;
        }
        player.SetGardenQuest(questId, progress: 0);
        var need = KillsRequiredFor(questId);
        Reply(
            player,
            $"Accepted: kill {need} {QuestLabel(questId)}. " +
            $"Reward: {ContributionReward} contribution + {HellRewardPerQuest} $HELL.");
    }

    static string StatusText(GameWorldPlayer player) {
        var q = player.GardenQuestId;
        if (string.IsNullOrEmpty(q)) {
            return "Hunt Unicorns (50) or Trolls (500) for the city (Olympia Garden quests). " +
                   $"Each completion: {ContributionReward} contribution + {HellRewardPerQuest} pending $HELL.";
        }
        var need = KillsRequiredFor(q);
        return $"Active: {QuestLabel(q)} {player.GardenQuestProgress}/{need}. " +
               "Kills auto-complete the quest. Use Abandon to cancel.";
    }

    static int KillsRequiredFor(string questId) => questId switch {
        QuestUnicorn => UnicornKillsRequired,
        QuestTroll => TrollKillsRequired,
        _ => UnicornKillsRequired,
    };

    static string QuestLabel(string questId) => questId switch {
        QuestUnicorn => "Unicorns",
        QuestTroll => "Trolls",
        _ => questId,
    };

    static void Reply(GameWorldPlayer player, string message) {
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateCityNpcServiceResult(
                ok: true,
                message,
                role: "garden-warden",
                npcName: "Garden Warden",
                guildInterestRegistered: false,
                cityServicesSummary: message,
                citizenshipSide: player.CitizenshipSide ?? "",
                hp: player.Hp,
                maxHp: player.MaxHp,
                goldSpent: 0,
                crusadeStatus: "",
                blessed: false));
        NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(message));
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateChatMessageReceived(
                "Garden Warden",
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                message,
                channel: ChatChannel.Nearby));
    }

    static void Chat(GameWorldPlayer player, string message) {
        NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(message));
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateChatMessageReceived(
                "Garden Warden",
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                message,
                channel: ChatChannel.Nearby));
    }
}
