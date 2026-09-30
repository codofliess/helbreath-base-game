namespace Server.Helpers;

/// <summary>
/// EK aura and attribute signal. The ground ring is not drawn here.
/// <see cref="NotifyEarned"/> is the only entry. Purchased EK credit and spend must not call it.
/// Hard rule, not config.
/// </summary>
public static class EkAura {
    /// <summary>Observes <see cref="NotifyEarned"/>. Null outside tests.</summary>
    public static Action<string>? Observer { get; set; }

    /// <summary>
    /// Signals the EK aura and attributes for gameplay-earned EK.
    /// Purchased balances must not call this.
    /// </summary>
    public static void NotifyEarned(string playerId) {
        Observer?.Invoke(playerId);
    }
}
