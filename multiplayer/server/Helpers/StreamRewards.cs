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
        var live = EarliestXLive(player.AccountWallet);
        if (live is null || nowMs - live.Value.SinceMs < XLiveMinutesRequired * 60_000L) {
            return;
        }

        var result = HellMiningStore.AwardXStreamDay(
            player.AccountWallet,
            player.CharacterName,
            StreamLinks.CanonicalXKey(live.Value.Url),
            nowMs);
        if (string.IsNullOrWhiteSpace(result.Message)) {
            return;
        }
        var noticeKey = $"{HellMiningStore.UtcDayKey(nowMs)}|{result.Message}";
        if (LastNoticeByWallet.TryGetValue(player.AccountWallet, out var last) &&
            string.Equals(last, noticeKey, StringComparison.Ordinal)) {
            return;
        }
        LastNoticeByWallet[player.AccountWallet] = noticeKey;
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateChatMessageReceived("System", nowMs, $"[Stream] {result.Message}"));
        if (result.Applied) {
            HellMining.SendStatus(player, nowMs, result.Message);
            Console.WriteLine(
                $"[StreamRewards] X live verified wallet={Mask(player.AccountWallet)} granted={result.TokensAdded} since={live.Value.SinceMs}");
        }
    }

    static (string Url, long SinceMs)? EarliestXLive(string wallet) {
        var world = StreamDirectory.GetXLiveForWallet(wallet);
        var duel = ArenaPact.GetPublicXLiveForWallet(wallet);
        if (world is null) {
            return duel;
        }
        if (duel is null) {
            return world;
        }
        return world.Value.SinceMs <= duel.Value.SinceMs ? world : duel;
    }

    static string Mask(string wallet) =>
        wallet.Length <= 8 ? wallet : $"{wallet[..4]}…{wallet[^4..]}";
}
