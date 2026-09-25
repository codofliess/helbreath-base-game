using Server.Persistence;

namespace Server.Helpers;

/// <summary>
/// Process-wide EK economy ledger. Gameplay credits from <see cref="PvpAcademy"/> land in the earned balance.
/// Purchased EK is spend-only: it does not call <see cref="HellMiningStore"/> or <see cref="EkAura"/>.
/// </summary>
public static class EkEconomyHost {
    static EkEconomyService? current;

    public static bool IsReady => current is not null;

    public static void Initialize(
        string ledgerPath,
        EkEconomyConfig config,
        IReadOnlyDictionary<string, long> legacyEarnedByPlayer) {
        ArgumentException.ThrowIfNullOrWhiteSpace(ledgerPath);
        ArgumentNullException.ThrowIfNull(config);
        ArgumentNullException.ThrowIfNull(legacyEarnedByPlayer);
        var service = EkEconomyService.Load(ledgerPath, config);
        service.BalanceProjection = ProjectBalance;
        service.ImportLegacyBalances(legacyEarnedByPlayer);
        current = service;
        Console.WriteLine(
            $"[EkEconomy] emitir={config.Emitir} min={config.EkNftMinAmount} " +
            $"bindUsd={config.Fees.EkNftBindUsd} unbindUsd={config.Fees.HeroSetPieceUnbindUsd} " +
            $"craftSource={(string.IsNullOrWhiteSpace(config.EkNftCraftSource) ? "unspecified" : config.EkNftCraftSource)} " +
            $"legacyPlayers={legacyEarnedByPlayer.Count}.");
    }

    /// <summary>Idempotent earned credit for a gameplay EK. No-op until <see cref="Initialize"/>.</summary>
    public static void CreditGameplayEk(string playerId, long amount, string idempotencyKey) {
        var service = current;
        if (service is null || amount <= 0 || string.IsNullOrWhiteSpace(playerId)) {
            return;
        }
        try {
            var result = service.CreditGameplayEk(playerId, amount, idempotencyKey);
            if (!result.Ok) {
                Console.WriteLine($"[EkEconomy] gameplay credit skipped: {result.Code}");
            }
        } catch (Exception ex) {
            Console.WriteLine($"[EkEconomy] gameplay credit failed: {ex.Message}");
        }
    }

    /// <summary>
    /// Records the config fee for a seal <see cref="ItemBind"/> already consumed.
    /// No-op until <see cref="Initialize"/>. Never throws back into the bind packet.
    /// </summary>
    public static void RecordSealStubFee(
        string playerId,
        int sealItemId,
        bool guildBoundHeroPiece,
        string idempotencyKey) {
        var service = current;
        if (service is null || string.IsNullOrWhiteSpace(playerId)) {
            return;
        }
        try {
            var result = service.RecordSealStubFee(playerId, sealItemId, guildBoundHeroPiece, idempotencyKey);
            if (!result.Ok && !result.Replay) {
                Console.WriteLine($"[EkEconomy] seal stub skipped: {result.Code}");
            }
        } catch (Exception ex) {
            Console.WriteLine($"[EkEconomy] seal stub failed: {ex.Message}");
        }
    }

    static void ProjectBalance(string playerId, long earned, long purchased) {
        var persistence = GamePersistence.Current;
        if (persistence is null) {
            return;
        }
        _ = Task.Run(async () => {
            try {
                await persistence.UpsertEkBalanceAsync(playerId, earned, purchased).ConfigureAwait(false);
            } catch (Exception ex) {
                Console.Error.WriteLine($"[EkEconomy] ek_balances upsert failed for '{playerId}': {ex.Message}");
            }
        });
    }
}
