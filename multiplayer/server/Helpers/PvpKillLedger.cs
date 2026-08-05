using Server.Auth;
using Server.Persistence;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>Records player-vs-player kills into PostgreSQL pvp_kills (with Elo rating updates for rated arena kills) when persistence is enabled.</summary>
public static class PvpKillLedger {
    public static void TryRecordKill(GameWorldRef wr, GameWorldPlayer killer, GameWorldPlayer victim, bool rated) {
        ArgumentNullException.ThrowIfNull(killer);
        ArgumentNullException.ThrowIfNull(victim);

        var persistence = GamePersistence.Current;
        if (persistence is null) {
            return;
        }

        // Both identities are captured on the world thread; the insert runs off-thread.
        var worldId = wr.WorldId;
        var killerWallet = killer.AccountWallet;
        var killerName = killer.CharacterName;
        var victimWallet = victim.AccountWallet;
        var victimName = victim.CharacterName;

        // Rating updates require two real, distinct wallets; unrated kills are still logged for history.
        var applyRating = rated
            && WalletPubkey.IsLikelySolanaPubkey(killerWallet)
            && WalletPubkey.IsLikelySolanaPubkey(victimWallet)
            && !string.Equals(killerWallet, victimWallet, StringComparison.Ordinal);

        _ = Task.Run(async () => {
            try {
                await persistence.RecordPvpKillAsync(
                    worldId,
                    killerWallet,
                    killerName,
                    victimWallet,
                    victimName,
                    applyRating).ConfigureAwait(false);
                Console.WriteLine(
                    $"[PvpKillLedger] Recorded {(applyRating ? "rated" : "unrated")} kill '{killerName}' → '{victimName}' on '{worldId}'.");
            } catch (Exception ex) {
                Console.Error.WriteLine($"[PvpKillLedger] Failed to record kill '{killerName}' → '{victimName}': {ex.Message}");
            }
        });
    }
}
