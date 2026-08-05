using Server.Auth;
using Server.Persistence;
using Server.Utils;
using Server.World;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>Records rare ground pickups into PostgreSQL drop_ledger when persistence is enabled.</summary>
public static class NftDropLedger {
    public static void TryRecordPickup(GameWorldRef wr, GameWorldPlayer player, InventoryItemState item) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(item);

        var persistence = GamePersistence.Current;
        if (persistence is null) {
            return;
        }

        if (!WalletPubkey.IsLikelySolanaPubkey(player.AccountWallet)) {
            return;
        }

        if (!wr.ItemsById.TryGetValue(item.ItemId, out var itemConfig)) {
            return;
        }

        var nftTier = NftDropEvaluator.EvaluateNftTier(item.ItemId, item.ItemAttribute, item.CicLevel);
        if (nftTier is null) {
            return;
        }

        _ = Task.Run(async () => {
            try {
                var dropId = await persistence.InsertDropLedgerAsync(
                    player.AccountWallet,
                    player.CharacterName,
                    item,
                    sourceMonsterId: null,
                    sourceMap: wr.Map,
                    isNftCandidate: true,
                    nftTier: nftTier).ConfigureAwait(false);
                if (dropId.HasValue) {
                    Console.WriteLine(
                        $"[NftDropLedger] Recorded {nftTier} drop {dropId.Value} itemUid={item.ItemUid} wallet={player.AccountWallet[..Math.Min(8, player.AccountWallet.Length)]}…");
                }
            } catch (Exception ex) {
                Console.Error.WriteLine($"[NftDropLedger] Failed to record drop for itemUid={item.ItemUid}: {ex.Message}");
            }
        });
    }
}
