using System.Collections.Concurrent;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Streaming on X: an X live link that has been up on the cartelera (World Go Live, or a public Arena duel)
/// for <see cref="XLiveMinutesRequired"/> minutes tops the wallet up to the full mining day
/// (<see cref="HellMiningStore.WalletDailyCap"/>). Only public cartelera listings count — that is the verification.
/// </summary>
public static class StreamRewards {
    public const int XLiveMinutesRequired = 15;

    static readonly ConcurrentDictionary<string, string> LastNoticeByWallet = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>1-minute heartbeat from the player's world.</summary>
    public static void OnSessionMinute(GameWorldPlayer player) {
        if (player is null || player.Disconnected || string.IsNullOrWhiteSpace(player.AccountWallet)) {
            return;
        }
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var minAgeMs = XLiveMinutesRequired * 60_000L;
        HellMiningCreditResult? chosen = null;
        (string Url, long SinceMs)? chosenLive = null;
        foreach (var live in EligibleXLives(player.AccountWallet)) {
            if (nowMs - live.SinceMs < minAgeMs) {
                continue;
            }
            var result = HellMiningStore.AwardXStreamDay(
                player.AccountWallet,
                player.CharacterName,
                StreamLinks.CanonicalXKey(live.Url),
                nowMs);
            if (!result.Applied &&
                string.Equals(result.Message, HellMiningStore.XStreamAlreadyPaidMessage, StringComparison.Ordinal)) {
                chosen ??= result;
                chosenLive ??= live;
                continue;
            }
            chosen = result;
            chosenLive = live;
            break;
        }
        if (chosen is not { } settled || string.IsNullOrWhiteSpace(settled.Message)) {
            return;
        }
        var noticeKey = $"{HellMiningStore.UtcDayKey(nowMs)}|{settled.Message}";
        if (LastNoticeByWallet.TryGetValue(player.AccountWallet, out var last) &&
            string.Equals(last, noticeKey, StringComparison.Ordinal)) {
            return;
        }
        LastNoticeByWallet[player.AccountWallet] = noticeKey;
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateChatMessageReceived("System", nowMs, $"[Stream] {settled.Message}"));
        if (settled.Applied && chosenLive is { } grantedLive) {
            HellMining.SendStatus(player, nowMs, settled.Message);
            Console.WriteLine(
                $"[StreamRewards] X live verified wallet={Mask(player.AccountWallet)} granted={settled.TokensAdded} since={grantedLive.SinceMs}");
        }
    }

    /// <summary>World Go Live and public-duel X links for this wallet, oldest first.</summary>
    static List<(string Url, long SinceMs)> EligibleXLives(string wallet) {
        var list = new List<(string Url, long SinceMs)>();
        list.AddRange(StreamDirectory.GetXLivesForWallet(wallet));
        list.AddRange(ArenaPact.GetPublicXLivesForWallet(wallet));
        list.Sort((a, b) => a.SinceMs.CompareTo(b.SinceMs));
        return list;
    }

    static string Mask(string wallet) =>
        wallet.Length <= 8 ? wallet : $"{wallet[..4]}…{wallet[^4..]}";
}
