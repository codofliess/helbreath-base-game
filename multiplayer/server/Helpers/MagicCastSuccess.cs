using Mmorpg.Network;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Olympia magic cast success (Client.cpp DrawDialogBox_Magic / Server PlayerMagicHandler).
/// Base = (MagicSkill/100) * MCProb[circle], + INT bonus, level-circle penalty, weather.
/// Roll 1–100; fail if success &lt; roll (unless success ≥ 100).
/// </summary>
public static class MagicCastSuccess {
    /// <summary>Index 1–10: circle base probability points (before skill%).</summary>
    public static readonly int[] CircleBaseProb = [0, 300, 250, 200, 150, 100, 80, 70, 60, 50, 40];

    /// <summary>Index 1–10: penalty per level-band above player for that circle.</summary>
    public static readonly int[] CircleLevelPenalty = [0, 5, 5, 8, 8, 10, 14, 28, 32, 36, 40];

    static readonly Dictionary<int, int> ServerSpellToOlympiaId;

    static MagicCastSuccess() {
        ServerSpellToOlympiaId = new Dictionary<int, int>();
        foreach (var (olympiaId, serverId) in MagicTower.OlympiaToServerSpellId) {
            ServerSpellToOlympiaId[serverId] = olympiaId;
        }
        // Energy Bolt free traveler catalog id 0 = Olympia 10
        ServerSpellToOlympiaId[0] = 10;
    }

    /// <summary>Olympia Magic.cfg id for a multiplayer Spells.json id (for mana / circle tables).</summary>
    public static int OlympiaIdForServerSpell(int serverSpellId) {
        if (ServerSpellToOlympiaId.TryGetValue(serverSpellId, out var olympiaId)) {
            return olympiaId;
        }
        // Energy Bolt free traveler catalog id 0 already mapped; unknown → treat as circle-1 missile.
        return 0;
    }

    /// <summary>Olympia circle 1–10 for a multiplayer Spells.json id.</summary>
    public static int CircleForServerSpellId(int serverSpellId) {
        var olympiaId = OlympiaIdForServerSpell(serverSpellId);
        return Math.Clamp((olympiaId / 10) + 1, 1, 10);
    }

    /// <summary>Compute success chance 1–100 for the magic book footer / cast roll.</summary>
    public static int ComputeSuccessPercent(
        int magicSkillLevel,
        int intelligence,
        int level,
        int circle,
        WeatherMode weather = WeatherMode.Dry,
        bool lowSp = false) {
        circle = Math.Clamp(circle, 1, 10);
        // Soft floor: travelers often have Magic skill ~0–5, which made circle 5+ feel unusable
        // ("casting probability re bajo" — Insk). Floor 25 keeps early grind fair without maxing.
        double skill = magicSkillLevel <= 0 ? 1.0 : magicSkillLevel;
        if (skill < 25) {
            skill = 25;
        }
        var result = (int)((skill / 100.0) * CircleBaseProb[circle]);

        if (intelligence > 50) {
            result += (intelligence - 50) / 2;
        }

        var levelBand = level / 10;
        if (circle != levelBand) {
            if (circle > levelBand) {
                var dV1 = (double)(level - levelBand * 10);
                var dV2 = (double)Math.Abs(circle - levelBand) * CircleLevelPenalty[circle];
                var dV3 = (double)Math.Abs(circle - levelBand) * 10;
                if (dV3 < 1) {
                    dV3 = 1;
                }
                var dV4 = (dV1 / dV3) * dV2;
                result -= Math.Abs(Math.Abs(circle - levelBand) * CircleLevelPenalty[circle] - (int)dV4);
            } else {
                result += 5 * Math.Abs(circle - levelBand);
            }
        }

        // Olympia weather 0–3: dry / light / medium / heavy rain (snow maps as light).
        result = weather switch {
            WeatherMode.RainLight or WeatherMode.SnowLight => result - result / 24,
            WeatherMode.RainMedium or WeatherMode.SnowMedium => result - result / 12,
            WeatherMode.RainHeavy or WeatherMode.SnowHeavy => result - result / 5,
            _ => result,
        };

        if (result > 100) {
            result = 100;
        }
        if (lowSp) {
            result = result * 9 / 10;
        }
        if (result < 1) {
            result = 1;
        }
        return result;
    }

    public static int ComputeSuccessPercent(GameWorldPlayer player, int serverSpellId, WeatherMode weather) {
        ArgumentNullException.ThrowIfNull(player);
        var circle = CircleForServerSpellId(serverSpellId);
        var magicSkill = player.GetSkillLevel(Skills.Magic);
        var lowSp = player.Sp < 1;
        var chance = ComputeSuccessPercent(
            magicSkill,
            PlayerDerivedStats.EffectiveInt(player),
            player.Level,
            circle,
            weather,
            lowSp);
        // Weapon/wand primary Casting Probability (type 9) — flat % points.
        var gearCp = ItemMagicAttribute.ComputeEquippedBonuses(player).CastingProbability;
        if (gearCp > 0) {
            chance += gearCp;
            if (chance > 100) {
                chance = 100;
            }
        }
        return chance;
    }

    /// <summary>True if cast succeeds (Olympia dice 1–100).</summary>
    public static bool RollCastSuccess(GameWorldPlayer player, int serverSpellId, WeatherMode weather) {
        var chance = ComputeSuccessPercent(player, serverSpellId, weather);
        if (chance >= 100) {
            return true;
        }
        var roll = Random.Shared.Next(1, 101);
        return chance >= roll;
    }
}
