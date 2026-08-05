using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Olympia hunger (<c>m_iHungerStatus</c> 0–100) + food (DEF_ITEMEFFECTTYPE_HPSTOCK).
/// Drain: every <see cref="HungerTickMs"/> −1 when level ≥ <see cref="HungerLevelLimit"/> (admins exempt N/A).
/// Food: <c>hunger += iDice(v1,v2)+v3</c> clamped 0–100 (Item.cfg).
/// </summary>
public static class Hunger {
    /// <summary>Olympia <c>DEF_HUNGERTIME</c> — 60s between hunger ticks.</summary>
    public const int HungerTickMs = 60_000;

    /// <summary>
    /// Olympia <c>DEF_LEVELLIMIT</c>: below this level hunger does not drain
    /// (newbies stay full until they leave the protected band).
    /// </summary>
    public const int HungerLevelLimit = 20;

    public const int MaxHunger = 100;

    /// <summary>
    /// Tick one player: if enough time elapsed since last hunger clock, −1 (when level ≥ limit).
    /// Returns true when hunger value changed.
    /// </summary>
    public static bool TryTickDrain(GameWorldPlayer player, DateTimeOffset nowUtc) {
        ArgumentNullException.ThrowIfNull(player);
        if (player.IsDead || player.Disconnected) {
            return false;
        }

        var elapsed = (nowUtc - player.LastHungerTickUtc).TotalMilliseconds;
        if (elapsed < HungerTickMs) {
            return false;
        }

        // Always advance the clock so we don't catch up many points after AFK lag.
        player.SetLastHungerTickUtc(nowUtc);

        // Gold/Green Carp: zero hunger drain for the buff hour (keep full).
        if (player.HasFoodNoHunger) {
            if (player.HungerStatus < MaxHunger) {
                player.SetHungerStatus(MaxHunger);
                return true;
            }
            return false;
        }

        if (player.Level < HungerLevelLimit) {
            return false;
        }

        if (player.HungerStatus <= 0) {
            return false;
        }

        player.SetHungerStatus(player.HungerStatus - 1);
        return true;
    }

    /// <summary>Apply Olympia food restore: <c>iDice(v1,v2)+v3</c> to hunger (and optional HPstock later).</summary>
    public static bool TryApplyFood(GameWorldPlayer player, int itemId, out int restored) {
        ArgumentNullException.ThrowIfNull(player);
        restored = 0;
        if (!TryGetFoodFormula(itemId, out var diceCount, out var diceSides, out var bonus)) {
            return false;
        }

        restored = RollDice(diceCount, diceSides) + bonus;
        if (restored == 0) {
            // Still "food" — allow 0 restore edge cases (shouldn't happen).
            return true;
        }

        var next = player.HungerStatus + restored;
        if (next > MaxHunger) {
            next = MaxHunger;
        }
        if (next < 0) {
            next = 0;
        }
        player.SetHungerStatus(next);
        return true;
    }

    /// <summary>
    /// Olympia Item.cfg / Item2.cfg effect type 7 (HPSTOCK) formulas for edible food.
    /// Baguette 2d8+10, Meat 4d8+10, Fish 4d8+10, specialty meats larger dice.
    /// </summary>
    public static bool TryGetFoodFormula(int itemId, out int diceCount, out int diceSides, out int bonus) {
        diceCount = 0;
        diceSides = 0;
        bonus = 0;
        switch (itemId) {
            case 98: // Baguette
                diceCount = 2; diceSides = 8; bonus = 10; return true;
            case 99: // Meat
                diceCount = 4; diceSides = 8; bonus = 10; return true;
            case 100: // Fish
                diceCount = 4; diceSides = 8; bonus = 10; return true;
            case 101: // Red Fish
                diceCount = 8; diceSides = 4; bonus = 60; return true;
            case 102: // Green Fish
                diceCount = 8; diceSides = 4; bonus = 40; return true;
            case 103: // Yellow Fish
                diceCount = 8; diceSides = 4; bonus = 30; return true;
            case 570: // Red Carp
                diceCount = 8; diceSides = 4; bonus = 30; return true;
            case 571: // Green Carp (special buff handled before dice path)
                diceCount = 8; diceSides = 4; bonus = 40; return true;
            case 572: // Gold Carp (special buff handled before dice path)
                diceCount = 8; diceSides = 4; bonus = 60; return true;
            case 573: // Crucian Carp
                diceCount = 8; diceSides = 4; bonus = 0; return true;
            case 575: // Salmon
                diceCount = 8; diceSides = 4; bonus = 10; return true;
            case 188: // Snake Meat
                diceCount = 4; diceSides = 8; bonus = 20; return true;
            case 197: // Cyclops Meat
                diceCount = 4; diceSides = 8; bonus = 30; return true;
            case 206: // Orc Meat
                diceCount = 2; diceSides = 4; bonus = 5; return true;
            case 211: // Ogre Meat
                diceCount = 4; diceSides = 8; bonus = 50; return true;
            case 216: // Scorpion Meat
                diceCount = 4; diceSides = 8; bonus = 25; return true;
            case 223: // Troll Meat
                diceCount = 8; diceSides = 4; bonus = 50; return true;
            case 542: // Demon Meat
                diceCount = 4; diceSides = 8; bonus = 50; return true;
            case 546: // Unicorn Meat
                diceCount = 4; diceSides = 8; bonus = 50; return true;
            case 550: // Werewolf Meat
                diceCount = 8; diceSides = 4; bonus = 50; return true;
            default:
                return false;
        }
    }

    public static bool IsFoodItem(int itemId) => TryGetFoodFormula(itemId, out _, out _, out _);

    static int RollDice(int count, int sides) {
        if (count <= 0 || sides <= 0) {
            return 0;
        }
        var total = 0;
        for (var i = 0; i < count; i++) {
            total += Random.Shared.Next(1, sides + 1);
        }
        return total;
    }
}
