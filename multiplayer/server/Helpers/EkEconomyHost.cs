namespace Server.Helpers;

/// <summary>
/// Process-wide EK economy ledger. Gameplay credits from <see cref="PvpAcademy"/> land in the earned balance.
/// Purchased NFT EKs never enter that path and do not call <see cref="HellMining"/>.
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
        service.ImportLegacyBalances(legacyEarnedByPlayer);
        current = service;
        Console.WriteLine(
            $"[EkEconomy] emitir={config.Emitir} min={config.EkNftMinAmount} " +
            $"bindUsd={config.Fees.EkNftBindUsd} unbindUsd={config.Fees.HeroSetPieceUnbindUsd} " +
            $"craftSource={(string.IsNullOrWhiteSpace(config.EkNftCraftSource) ? "unspecified" : config.EkNftCraftSource)} " +
            $"purchasedMining={config.PurchasedEkMiningEnabled} legacyPlayers={legacyEarnedByPlayer.Count}.");
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
}
