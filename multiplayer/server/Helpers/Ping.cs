using Mmorpg.Network;
using Server;
using Server.World;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>Ping RTT sampling, queue-depth reporting, and periodic disconnects for clients that stop sending pings.</summary>
public static class Ping {
    public static void HandlePingRequest(GameWorldRef wr, GameWorldPlayer playerConnection, PingRequest pingRequest) {
        var gameWorldQueueLength = wr.IncomingReader.Count;
        var playersInMap = wr.World.ConnectedPlayerCount;
        NetworkManager.SendToPlayer(playerConnection, NetworkManager.CreatePingResponse(pingRequest.Sequence, gameWorldQueueLength, playersInMap, playerConnection.PingVariance));
        playerConnection.GetPingDeltaAndUpdateLastPingMs(wr.Settings.Ping.Interval);
    }

    /// <summary>
    /// Scheduler callback: disconnects players who have not sent a ping within timeout ms.
    /// Variance disconnect uses the latest interval delta (not the historical max in the sample window) and
    /// never fires tighter than timeout — a single PVE hitch of a few seconds must not kick a focused client.
    /// Window-max variance remains on the player for movement/cast slack.
    /// </summary>
    public static void CheckPingVarianceAndDisconnectExcessive(GameWorldRef wr) {
        var maxPingVariance = wr.Settings.Ping.AllowedVariance;
        var maxPingTimeout = wr.Settings.Ping.Timeout;
        var varianceDisconnectLimit = Math.Max(maxPingVariance, maxPingTimeout);
        var currentMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        foreach (var player in wr.World.EnumerateConnectedPlayers()) {
            if (player.Disconnected) {
                continue;
            }
            if (player.LastPingTimeMs <= 0) {
                continue;
            }
            if (currentMs - player.LastPingTimeMs > maxPingTimeout) {
                Console.WriteLine($"[GameWorld:{wr.WorldId}] Player {player.PlayerId} disconnected due to not receiving ping in time (last ping: {currentMs - player.LastPingTimeMs}ms ago, max: {maxPingTimeout}ms)");
                player.RequestDisconnect("You were disconnected due to not receiving ping in time. Most likely cause was because the game browser tab was suspended.");
                continue;
            }
            if (player.LastIntervalDeltaMs <= varianceDisconnectLimit) {
                continue;
            }

            Console.WriteLine($"[GameWorld:{wr.WorldId}] Player {player.PlayerId} disconnected due to having too high ping variance (latest interval delta: {player.LastIntervalDeltaMs}ms, limit: {varianceDisconnectLimit}ms, window max: {player.PingVariance:F2})");
            player.RequestDisconnect("You were disconnected due to having too high ping. Most likely cause was because the game browser tab was suspended.");
        }
    }
}
