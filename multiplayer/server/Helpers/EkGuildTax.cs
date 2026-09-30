namespace Server.Helpers;

/// <summary>
/// First gameplay EK of the UTC day for ACTIVE KILLER / guild tax.
/// Purchased EK must not call <see cref="NotifyGameplayFirstEk"/>. That default is not a config flag.
/// </summary>
public static class EkGuildTax {
    /// <summary>Observes <see cref="NotifyGameplayFirstEk"/>. Null outside tests.</summary>
    public static Action<string, string>? FirstEkObserver { get; set; }

    /// <summary>Signals a gameplay EK that is the first one for <paramref name="utcDay"/>.</summary>
    public static void NotifyGameplayFirstEk(string playerId, string utcDay) {
        FirstEkObserver?.Invoke(playerId, utcDay);
    }
}
