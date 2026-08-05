using System;

namespace Server.Helpers;

/// <summary>
/// Olympia <c>Server.cpp</c> NBA magic ladder (~10648–10815) + mana costs from <c>Magic.cfg</c>.
/// When a monster has <c>magicLevel != 0</c>, cast selection prefers this ladder over random <c>spells[]</c>.
/// Magic range: |dx| ≤ 9 and |dy| ≤ 7; 50% attempt per AI tick; cast recovery +2000 ms (Olympia <c>m_dwTime + 2000</c>).
/// Mana regen: every <see cref="ManaRegenIntervalMs"/> add 1d(maxMana/5), capped at maxMana.
/// </summary>
public static class OlympiaMonsterMagic {
    /// <summary>Olympia <c>DEF_MPUPTIME</c> (~15s) between NPC mana ticks.</summary>
    public const int ManaRegenIntervalMs = 15_000;

    /// <summary>Olympia cast gate after a successful NPC spell.</summary>
    public const int CastRecoveryMs = 2_000;

    /// <summary>Olympia magic engage rectangle (cells from caster to target).</summary>
    public const int MagicRangeX = 9;
    public const int MagicRangeY = 7;

    // Multiplayer Spells.json ids (see OlympiaServerSpellMap / Magic.cfg).
    public const int SpellEnergyBolt = 0;       // Magic-Missile + Energy-Bolt collapse
    public const int SpellFireBall = 1;
    public const int SpellFireStrike = 2;
    public const int SpellLightningBolt = 6;    // Lightning-Arrow / Lightning / Lightning-Bolt
    public const int SpellIceStrike = 10;
    public const int SpellEnergyStrike = 11;
    public const int SpellMassFireStrike = 12;
    public const int SpellMassChillWind = 13;
    public const int SpellBloodyShockWave = 16;
    public const int SpellLightningStrike = 18;
    public const int SpellMeteorStrike = 19;
    public const int SpellBlizzard = 21;
    public const int SpellEarthShockWave = 22;
    public const int SpellParalyze = 27;

    /// <summary>Magic.cfg mana costs for ladder spells (Olympia ids → server catalog).</summary>
    public static int ManaCost(int serverSpellId) => serverSpellId switch {
        SpellEnergyBolt => 15,          // Energy-Bolt; Magic-Missile was 8 — use EB cost when casting EB
        SpellFireBall => 27,
        SpellFireStrike => 36,
        SpellLightningBolt => 58,       // Lightning-Bolt; Lightning=44, LA=32 approximated up
        SpellIceStrike => 59,
        SpellEnergyStrike => 65,
        SpellMassFireStrike => 80,
        SpellMassChillWind => 90,
        SpellBloodyShockWave => 120,
        SpellLightningStrike => 90,
        SpellMeteorStrike => 120,
        SpellBlizzard => 170,
        SpellEarthShockWave => 180,
        SpellParalyze => 35,
        _ => 20,
    };

    /// <summary>True when target is inside Olympia magic rectangle (not counting adjacency).</summary>
    public static bool InMagicRectangle(int casterX, int casterY, int targetX, int targetY) =>
        Math.Abs(casterX - targetX) <= MagicRangeX && Math.Abs(casterY - targetY) <= MagicRangeY;

    /// <summary>Olympia casts only when not adjacent (melee cell uses physical attack).</summary>
    public static bool IsAdjacent(int casterX, int casterY, int targetX, int targetY) =>
        Math.Abs(casterX - targetX) <= 1 && Math.Abs(casterY - targetY) <= 1;

    /// <summary>
    /// Pick a spell for this magic level given current mana. Returns false when no affordable spell.
    /// Mirrors <c>switch (m_cMagicLevel)</c> in Server.cpp NBA.
    /// </summary>
    public static bool TryPickSpell(
        int magicLevel,
        int currentMana,
        Random random,
        bool targetAlreadyParalyzed,
        out int spellId,
        out int manaCost) {
        spellId = -1;
        manaCost = 0;

        if (magicLevel == 0) {
            return false;
        }

        // Negative ML (city guards): 43 Lightning → 37 LA → 0 MM  (healing-ish offensive fallback ladder)
        if (magicLevel < 0) {
            if (CanAfford(SpellLightningBolt, currentMana, out manaCost)) {
                spellId = SpellLightningBolt;
                return true;
            }
            if (CanAfford(SpellEnergyBolt, currentMana, out manaCost)) {
                spellId = SpellEnergyBolt;
                return true;
            }
            return false;
        }

        int picked = -1;
        switch (magicLevel) {
            case 1:
                if (CanAfford(SpellEnergyBolt, currentMana, out _)) {
                    picked = SpellEnergyBolt;
                }
                break;

            case 2:
                if (CanAfford(SpellEnergyBolt, currentMana, out _)) {
                    picked = SpellEnergyBolt;
                }
                break;

            case 3: // Orc-Mage
                if (CanAfford(SpellFireBall, currentMana, out _)) {
                    picked = SpellFireBall;
                } else if (CanAfford(SpellEnergyBolt, currentMana, out _)) {
                    picked = SpellEnergyBolt;
                }
                break;

            case 4:
                if (CanAfford(SpellFireStrike, currentMana, out _)) {
                    picked = SpellFireStrike;
                } else if (CanAfford(SpellLightningBolt, currentMana, out _)) {
                    picked = SpellLightningBolt;
                } else if (CanAfford(SpellFireBall, currentMana, out _)) {
                    picked = SpellFireBall;
                } else if (CanAfford(SpellEnergyBolt, currentMana, out _)) {
                    picked = SpellEnergyBolt;
                }
                break;

            case 5: // Rudolph, Cannibal-Plant, Cyclops, Hellbound, Tentocle
                if (CanAfford(SpellLightningBolt, currentMana, out _)) {
                    picked = SpellLightningBolt;
                } else if (CanAfford(SpellFireStrike, currentMana, out _)) {
                    picked = SpellFireStrike;
                } else if (CanAfford(SpellFireBall, currentMana, out _)) {
                    picked = SpellFireBall;
                } else if (CanAfford(SpellEnergyBolt, currentMana, out _)) {
                    picked = SpellEnergyBolt;
                }
                break;

            case 6: // Tentocle high / Liche
                if (CanAfford(SpellLightningBolt, currentMana, out _)) {
                    picked = SpellLightningBolt;
                } else if (CanAfford(SpellFireStrike, currentMana, out _)) {
                    picked = SpellFireStrike;
                } else if (CanAfford(SpellFireBall, currentMana, out _)) {
                    picked = SpellFireBall;
                } else if (CanAfford(SpellEnergyBolt, currentMana, out _)) {
                    picked = SpellEnergyBolt;
                }
                break;

            case 7: // Barlog, Demon, Fire-Wyvern, MasterMage-Orc, Gagoyle, GHK, …
                // BSW only on 1/5 (iDice(1,5)==3)
                if (CanAfford(SpellBloodyShockWave, currentMana, out _) && random.Next(1, 6) == 3) {
                    picked = SpellBloodyShockWave;
                } else if (CanAfford(SpellMassFireStrike, currentMana, out _)) {
                    picked = SpellMassFireStrike;
                } else if (CanAfford(SpellEnergyStrike, currentMana, out _)) {
                    picked = SpellEnergyStrike;
                } else if (CanAfford(SpellLightningBolt, currentMana, out _)) {
                    picked = SpellLightningBolt;
                }
                break;

            case 8: // Unicorn, Centaurus, Giant-Lizard
                // Paralyze on 1/3 (iDice(1,3)==2), skip if already held (AI≥2)
                if (CanAfford(SpellParalyze, currentMana, out _) &&
                    !targetAlreadyParalyzed &&
                    random.Next(1, 4) == 2) {
                    picked = SpellParalyze;
                } else if (CanAfford(SpellEnergyStrike, currentMana, out _)) {
                    picked = SpellEnergyStrike;
                } else if (CanAfford(SpellLightningBolt, currentMana, out _)) {
                    picked = SpellLightningBolt;
                } else if (CanAfford(SpellFireStrike, currentMana, out _)) {
                    // Olympia uses Lightning(43) as last fallthrough; FS as close mid-tier damage
                    picked = SpellFireStrike;
                }
                break;

            case 9: // Tigerworm
                if (CanAfford(SpellLightningStrike, currentMana, out _) && random.Next(1, 4) == 2) {
                    picked = SpellLightningStrike;
                }
                break;

            case 10: // Frost, Nizie — ladder empty; ice special handled separately
            case 11: // Ice-Golem
                break;

            case 12: // Wyvern
                if (CanAfford(SpellBlizzard, currentMana, out _) && random.Next(1, 4) == 2) {
                    picked = SpellBlizzard;
                } else if (CanAfford(SpellMassChillWind, currentMana, out _)) {
                    picked = SpellMassChillWind;
                }
                break;

            case 13: // Abaddon
                if (CanAfford(SpellEarthShockWave, currentMana, out _) && random.Next(1, 4) == 2) {
                    picked = SpellEarthShockWave;
                } else if (CanAfford(SpellMeteorStrike, currentMana, out _)) {
                    picked = SpellMeteorStrike;
                }
                break;

            default:
                // High custom ML (Academy Elite etc.): use case 8 kit as baseline
                if (magicLevel > 13) {
                    return TryPickSpell(8, currentMana, random, targetAlreadyParalyzed, out spellId, out manaCost);
                }
                break;
        }

        if (picked < 0) {
            return false;
        }

        spellId = picked;
        manaCost = ManaCost(picked);
        return currentMana >= manaCost;
    }

    /// <summary>
    /// Frost / Nizie special (type 63/79): when in attack range and not adjacent, 1/3 Ice-Strike if mana allows.
    /// </summary>
    public static bool TryPickFrostNizieIce(
        int currentMana,
        Random random,
        out int spellId,
        out int manaCost) {
        spellId = -1;
        manaCost = 0;
        if (random.Next(1, 4) != 2) {
            return false;
        }
        if (!CanAfford(SpellIceStrike, currentMana, out manaCost)) {
            return false;
        }
        spellId = SpellIceStrike;
        return true;
    }

    /// <summary>Builds a documentation / Monsters.json spell list for a magic level (high cast probability; ladder still selects at runtime).</summary>
    public static int[] SpellIdsForMagicLevel(int magicLevel) {
        if (magicLevel < 0) {
            return [SpellLightningBolt, SpellEnergyBolt];
        }
        return magicLevel switch {
            1 or 2 => [SpellEnergyBolt],
            3 => [SpellFireBall, SpellEnergyBolt],
            4 => [SpellFireStrike, SpellLightningBolt, SpellFireBall, SpellEnergyBolt],
            5 => [SpellLightningBolt, SpellFireStrike, SpellFireBall, SpellEnergyBolt],
            6 => [SpellLightningBolt, SpellFireStrike, SpellFireBall, SpellEnergyBolt],
            7 => [SpellBloodyShockWave, SpellMassFireStrike, SpellEnergyStrike, SpellLightningBolt],
            8 => [SpellParalyze, SpellEnergyStrike, SpellLightningBolt, SpellFireStrike],
            9 => [SpellLightningStrike],
            10 => [SpellIceStrike],
            11 => [],
            12 => [SpellBlizzard, SpellMassChillWind],
            13 => [SpellEarthShockWave, SpellMeteorStrike],
            _ when magicLevel > 13 => SpellIdsForMagicLevel(8),
            _ => [],
        };
    }

    /// <summary>True for catalog names that use Frost/Nizie ice special (ML 10 empty ladder + Ice Strike).</summary>
    public static bool IsFrostNizieCaster(string? catalogName) {
        if (string.IsNullOrWhiteSpace(catalogName)) {
            return false;
        }
        return catalogName.Equals("Frost", StringComparison.OrdinalIgnoreCase)
               || catalogName.Equals("Nizie", StringComparison.OrdinalIgnoreCase);
    }

    static bool CanAfford(int spellId, int mana, out int cost) {
        cost = ManaCost(spellId);
        return mana >= cost;
    }
}
