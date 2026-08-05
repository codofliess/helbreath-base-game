using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Olympia full Hero set bonus (<c>Server.cpp</c> <c>_cCheckHeroItemEquipped</c> / <c>m_cHeroArmourBonus</c>).
/// Requires all four pieces: helm/cap + body + hauberk + legs (boots optional).
/// <list type="bullet">
/// <item><b>1 War</b> (Helm+Armor): +100 Hit Ratio, +5 physical AP (iAP_SM/L)</item>
/// <item><b>2 Mage</b> (Cap+Robe): +4 damage on attacks (melee + magic paths)</item>
/// </list>
/// Base Item.cfg DR/PA still come from <see cref="ItemDefenseCatalog"/> per piece.
/// </summary>
public static class HeroSetBonus {
    /// <summary>0 = none, 1 = war full set, 2 = mage full set.</summary>
    public const int None = 0;
    public const int War = 1;
    public const int Mage = 2;

    // War sets (aresden/elvine × M/W) — helm + armor + hauberk + legs
    private static readonly (int Helm, int Armor, int Hauberk, int Legs)[] WarSets = [
        (403, 411, 419, 423), // a M
        (404, 412, 420, 424), // a W
        (405, 413, 421, 425), // e M
        (406, 414, 422, 426), // e W
    ];

    // Mage sets — cap + robe + hauberk + legs
    private static readonly (int Helm, int Armor, int Hauberk, int Legs)[] MageSets = [
        (407, 415, 419, 423), // a M
        (408, 416, 420, 424), // a W
        (409, 417, 421, 425), // e M
        (410, 418, 422, 426), // e W
    ];

    /// <summary>Olympia war set: +100 attacker hit ratio (raw scale).</summary>
    public const int WarHitRatioBonus = 100;

    /// <summary>Olympia war set: +5 attack power (flat damage).</summary>
    public const int WarAttackPowerBonus = 5;

    /// <summary>Olympia mage set: +4 damage on damage rolls.</summary>
    public const int MageDamageBonus = 4;

    /// <summary>
    /// Recompute and store on the player. Call after equip/unequip and after arena loadout.
    /// </summary>
    public static int Recompute(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        var bonus = Detect(player);
        player.SetHeroArmourBonus(bonus);
        return bonus;
    }

    /// <summary>Detect full-set type without writing player state.</summary>
    public static int Detect(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        var eq = player.InventoryManager.EquippedItems;
        if (!TryGetId(eq, "helmet", out var helm) ||
            !TryGetId(eq, "armor", out var armor) ||
            !TryGetId(eq, "hauberk", out var hauberk) ||
            !TryGetId(eq, "leggings", out var legs)) {
            return None;
        }

        foreach (var s in WarSets) {
            if (helm == s.Helm && armor == s.Armor && hauberk == s.Hauberk && legs == s.Legs) {
                return War;
            }
        }
        foreach (var s in MageSets) {
            if (helm == s.Helm && armor == s.Armor && hauberk == s.Hauberk && legs == s.Legs) {
                return Mage;
            }
        }
        return None;
    }

    private static bool TryGetId(
        System.Collections.Generic.IReadOnlyDictionary<string, Utils.InventoryItemState> eq,
        string slot,
        out int itemId) {
        itemId = 0;
        if (!eq.TryGetValue(slot, out var item) || item is null) {
            return false;
        }
        itemId = item.ItemId;
        return itemId > 0;
    }

    public static int ExtraHitRatio(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        return player.HeroArmourBonus == War ? WarHitRatioBonus : 0;
    }

    public static int ExtraPhysicalDamage(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        return player.HeroArmourBonus switch {
            War => WarAttackPowerBonus,
            Mage => MageDamageBonus,
            _ => 0,
        };
    }

    public static int ExtraMagicDamage(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        // Olympia applies +4 damage on mage-set wearer attack paths (including spell damage rolls).
        return player.HeroArmourBonus == Mage ? MageDamageBonus : 0;
    }
}
