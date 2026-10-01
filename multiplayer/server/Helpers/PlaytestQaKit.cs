using Server.Auth;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Local PLAYTEST kit for a wallet-less bot seat. Grants the client-visible Big Red Potion
/// (item 164) and the mage book the rules bot can choose from, before the join snapshot.
/// Live login is unchanged: this does not run in production and does not skip the wallet check.
/// </summary>
public static class PlaytestQaKit {
    public const int BigRedPotionItemId = 164;
    public const int PotionQuantity = 20;

    /// <summary>Olympia Magic.cfg Fire Strike. <see cref="MagicTower.OlympiaToServerSpellId"/> maps it to server spell 2.</summary>
    public const int FireStrikeOlympiaId = 30;

    /// <summary>
    /// Olympia Magic.cfg ids the local mage seat may cast. Each one is in
    /// <see cref="MagicTower.OlympiaToServerSpellId"/>. Staminar-Drain (11) is not, so it is not granted.
    /// </summary>
    public static readonly int[] GrantedOlympiaSpellIds = [
        FireStrikeOlympiaId, // 30 Fire Strike → server 2, mana 36
        1,                    // Heal → server 29, mana 15
        13,                   // Defense Shield → server 32, mana 19
        35,                   // Paralyze → server 27, mana 35
        91,                   // Blizzard → server 21, mana 170
        32,                   // Invisibility → server 24, mana 31
    ];

    private static readonly string[] LiveSecretNames = [
        "WALLET_AUTH_SECRET",
        "DATABASE_URL",
        "HELL_MINT",
        "MARKET_MIDDLEWARE_URL",
        "SOLANA_RPC_URL",
    ];

    public static bool IsRequested {
        get {
            var flag = Environment.GetEnvironmentVariable("PLAYTEST") ?? "";
            return flag is "1" or "true" or "TRUE" or "yes" or "YES";
        }
    }

    /// <summary>True when PLAYTEST was requested next to a live secret or a production host.</summary>
    public static bool HasUnsafePlaytestConfiguration() {
        if (!IsRequested) {
            return false;
        }
        if (WalletAuthValidator.IsProductionHost) {
            return true;
        }
        foreach (var name in LiveSecretNames) {
            if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(name))) {
                return true;
            }
        }
        return false;
    }

    /// <summary>Refuses to boot a PLAYTEST process that can see live secrets. Does not print secret values.</summary>
    public static void ThrowIfUnsafe() {
        if (!IsRequested) {
            return;
        }
        if (WalletAuthValidator.IsProductionHost) {
            throw new InvalidOperationException("PLAYTEST=1 is refused on a production host.");
        }
        foreach (var name in LiveSecretNames) {
            if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(name))) {
                throw new InvalidOperationException(
                    $"PLAYTEST=1 is refused because {name} is set. Local wallet-less play does not run next to live secrets.");
            }
        }
    }

    /// <summary>Local kit is on only when PLAYTEST=1, the host is not production, and no live secret is set.</summary>
    public static bool IsEnabled => IsRequested && !HasUnsafePlaytestConfiguration();

    /// <summary>Idempotent. Bot seats only. A character that already holds item 164 is not given another stack.</summary>
    public static void Apply(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        if (!IsEnabled || !player.IsBotActor) {
            return;
        }
        foreach (var olympiaId in GrantedOlympiaSpellIds) {
            if (!MagicTower.OlympiaToServerSpellId.ContainsKey(olympiaId)) {
                continue;
            }
            if (!player.HasLearnedOlympiaSpell(olympiaId)) {
                player.LearnOlympiaSpell(olympiaId);
            }
        }
        if (player.InventoryManager.CountItem(BigRedPotionItemId) > 0) {
            return;
        }
        if (!player.InventoryManager.TryGrantBagStack(BigRedPotionItemId, PotionQuantity)) {
            Console.WriteLine($"[PlaytestQaKit] Item {BigRedPotionItemId} is missing from the catalog. No potions granted.");
            return;
        }
        Console.WriteLine(
            $"[PlaytestQaKit] {player.CharacterName} granted item {BigRedPotionItemId} x{PotionQuantity} and mage spells {string.Join(",", GrantedOlympiaSpellIds)}.");
    }
}
