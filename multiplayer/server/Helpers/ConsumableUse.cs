using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Olympia <c>UseItemHandler</c> potion effects (<c>DEF_ITEMEFFECTTYPE_HP/MP/SP</c>).
/// Formulas from <c>reference/Item.cfg</c> (Value1dValue2+Value3) + Server.cpp dice roll.
/// </summary>
public static class ConsumableUse {
    public enum VitalPool {
        None = 0,
        Hp = 1,
        Mp = 2,
        Sp = 3,
    }

    /// <summary>
    /// Applies consumable restore after the bag item was removed.
    /// Sends HP/MP/SP updates to the client (ProgressionUpdated carries full vitals).
    /// Returns which pool was restored (0 = no vitals change — item still consumed).
    /// </summary>
    public static VitalPool ApplyAfterConsume(GameWorldPlayer player, int itemId) {
        ArgumentNullException.ThrowIfNull(player);

        // Top fish buffs (CL): Gold Carp hardest, Green Carp 2nd.
        var hour = TimeSpan.FromHours(1);
        if (itemId == 572) {
            // Gold Carp: +10% hit prob 1h + zero hunger 1h.
            player.ApplyGoldCarpBuff(hour);
            Progression.SendProgressionUpdated(player, leveledUp: false);
            Console.WriteLine($"[Hunger] {player.CharacterName} Gold Carp → HR+10% + no hunger 1h.");
            return VitalPool.None;
        }
        if (itemId == 571) {
            // Green Carp: no hunger 1h + half SP cost 1h.
            player.ApplyGreenCarpBuff(hour);
            Progression.SendProgressionUpdated(player, leveledUp: false);
            Console.WriteLine($"[Hunger] {player.CharacterName} Green Carp → no hunger + half SP cost 1h.");
            return VitalPool.None;
        }

        // Olympia DEF_ITEMEFFECTTYPE_HPSTOCK (food / Create Food meats & baguette + other fish).
        if (Hunger.TryApplyFood(player, itemId, out var restored)) {
            Progression.SendProgressionUpdated(player, leveledUp: false);
            Console.WriteLine(
                $"[Hunger] {player.CharacterName} ate item {itemId} +{restored} hunger → {player.HungerStatus}%.");
            return VitalPool.None;
        }

        if (!TryGetOlympiaPotionFormula(itemId, out var pool, out var diceCount, out var diceSides, out var bonus)) {
            return VitalPool.None;
        }

        var amount = RollDice(diceCount, diceSides) + bonus;
        if (amount <= 0) {
            return VitalPool.None;
        }

        switch (pool) {
            case VitalPool.Hp:
                if (player.IsDead) {
                    return VitalPool.None;
                }
                if (player.Hp < player.MaxHp) {
                    player.ApplyHeal(amount);
                }
                NetworkManager.SendToPlayer(player, NetworkManager.CreateHpUpdated(player.Hp, player.MaxHp));
                Party.NotifyVitalsChanged(player);
                Progression.SendProgressionUpdated(player, leveledUp: false);
                return VitalPool.Hp;

            case VitalPool.Mp:
                if (player.Mp < player.MaxMp) {
                    player.ApplyMpRestore(amount);
                }
                Progression.SendProgressionUpdated(player, leveledUp: false);
                return VitalPool.Mp;

            case VitalPool.Sp:
                if (player.Sp < player.MaxSp) {
                    player.ApplySpRestore(amount);
                }
                // Poison clear handled by caller (needs GameWorldRef).
                Progression.SendProgressionUpdated(player, leveledUp: false);
                return VitalPool.Sp;

            default:
                return VitalPool.None;
        }
    }

    /// <summary>
    /// Olympia Item.cfg potions (effect type 4=HP, 5=MP, 6=SP).
    /// Red 91: 2d12+10 · BigRed 92: 3d8+40 · Blue 93: 2d12+10 · BigBlue 94: 4d8+50 ·
    /// Green 95: 2d12+10 · BigGreen 96: 4d8+50.
    /// </summary>
    public static bool TryGetOlympiaPotionFormula(
        int itemId,
        out VitalPool pool,
        out int diceCount,
        out int diceSides,
        out int bonus) {
        pool = VitalPool.None;
        diceCount = 0;
        diceSides = 0;
        bonus = 0;

        switch (itemId) {
            case 91: // RedPotion
                pool = VitalPool.Hp;
                diceCount = 2;
                diceSides = 12;
                bonus = 10;
                return true;
            case 92: // BigRedPotion
                pool = VitalPool.Hp;
                diceCount = 3;
                diceSides = 8;
                bonus = 40;
                return true;
            case 93: // BluePotion
                pool = VitalPool.Mp;
                diceCount = 2;
                diceSides = 12;
                bonus = 10;
                return true;
            case 94: // BigBluePotion
                pool = VitalPool.Mp;
                diceCount = 4;
                diceSides = 8;
                bonus = 50;
                return true;
            case 95: // GreenPotion
                pool = VitalPool.Sp;
                diceCount = 2;
                diceSides = 12;
                bonus = 10;
                return true;
            case 96: // BigGreenPotion
                pool = VitalPool.Sp;
                diceCount = 4;
                diceSides = 8;
                bonus = 50;
                return true;
            case 390: // Power Green (if present in catalog)
                pool = VitalPool.Sp;
                diceCount = 4;
                diceSides = 10;
                bonus = 40;
                return true;
            case 391: // Super Power Green
                pool = VitalPool.Sp;
                diceCount = 5;
                diceSides = 10;
                bonus = 60;
                return true;
            case 840: // Super Red Potion (CL cash / drop)
                pool = VitalPool.Hp;
                diceCount = 5;
                diceSides = 10;
                bonus = 80;
                return true;
            case 841: // Super Blue Potion
                pool = VitalPool.Mp;
                diceCount = 5;
                diceSides = 10;
                bonus = 80;
                return true;
            case 842: // Super Green Potion
                pool = VitalPool.Sp;
                diceCount = 5;
                diceSides = 10;
                bonus = 80;
                return true;
            default:
                return false;
        }
    }

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
