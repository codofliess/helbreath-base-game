using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Cruchi: every bot is <c>actorKind: bot</c> (middleware enroll-bot, or a local PLAYTEST seat
/// when wallet auth is off). Bots are excluded from rankings, airdrops, economy, and transferable loot.
/// Wallet-less login stays local. Live still requires a wallet (<see cref="Auth.WalletAuthValidator"/>).
/// </summary>
public static class BotActor {
    public const string KindBot = "bot";
    public const string KindHuman = "human";

    public static bool IsBot(GameWorldPlayer? player) =>
        player is not null && player.IsBotActor;

    public static bool ExcludedFromRankings(GameWorldPlayer? player) => IsBot(player);

    public static bool ExcludedFromAirdrops(GameWorldPlayer? player) => IsBot(player);

    public static bool ExcludedFromEconomy(GameWorldPlayer? player) => IsBot(player);

    /// <summary>Loot a bot would drop or carry must not become transferable to another player.</summary>
    public static bool LootMustNotTransfer(GameWorldPlayer? player) => IsBot(player);
}
