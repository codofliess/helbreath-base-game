using Server;

namespace Server.Helpers;

/// <summary>Olympia <c>Item.cfg</c> effect types used by <c>NpcDeadItemGenerator</c> magic rolls.</summary>
public static class OlympiaItemEffectType {
    public const int Attack = 1;
    public const int Defense = 2;
    public const int AttackManaSave = 13;
}

/// <summary>Result of an Olympia-style magic attribute roll for a dropped item instance.</summary>
public readonly record struct OlympiaMagicRollResult(uint Attribute, int Color);

/// <summary>
/// Ports Helbreath Olympia <c>NpcDeadItemGenerator</c> attribute rolls (Server.cpp ~48720–49005).
/// Bit layout matches client <c>GetItemName</c>: primary type/value at bits 20–23 / 16–19,
/// secondary at 12–15 / 8–11, rep damage suffix at 28–31.
/// </summary>
public static class OlympiaMagicRoll {
    public static int ResolveEffectType(ItemConfig item) {
        if (item.OlympiaEffectType is int explicitType) {
            return explicitType;
        }

        return item.ItemType switch {
            "weapon" when item.Name.Contains("Wand", StringComparison.OrdinalIgnoreCase) => OlympiaItemEffectType.AttackManaSave,
            "weapon" => OlympiaItemEffectType.Attack,
            "shield" or "armor" or "hauberk" or "leggings" or "boots" or "helmet" or "cape" => OlympiaItemEffectType.Defense,
            _ => 0,
        };
    }

    public static bool ShouldRollMagic(ItemConfig item) => ResolveEffectType(item) != 0;

    public static OlympiaMagicRollResult Roll(ItemConfig item, int genLevel) {
        var effectType = ResolveEffectType(item);
        if (effectType == 0) {
            return new OlympiaMagicRollResult(0, 0);
        }

        return effectType switch {
            OlympiaItemEffectType.Attack => RollAttackWeapon(genLevel),
            OlympiaItemEffectType.AttackManaSave => RollManaSaveWeapon(genLevel),
            OlympiaItemEffectType.Defense => RollDefense(item, genLevel),
            _ => new OlympiaMagicRollResult(0, 0),
        };
    }

    /// <summary>
    /// Harder mobs (higher gen) roll stronger attribute values more often.
    /// gen 1–3: classic Olympia caps; gen 5–7: floor ~3–4; gen 8–10: floor ~5–7 (stated gear feels richer).
    /// Absolute nibble cap for *7 defense fragments is 13 (display 91); PA/MA nibble 13 (display 39≈40).
    /// </summary>
    static uint ScaleAttributeValueForGen(uint value, int genLevel) {
        if (genLevel <= 2) {
            return value > 7 ? 7u : value;
        }

        if (genLevel <= 4) {
            return value;
        }

        if (genLevel <= 6) {
            // Mid farm: nudge low rolls up.
            if (value < 3) {
                value = (uint)Random.Shared.Next(3, 8);
            }
            return value;
        }

        if (genLevel <= 8) {
            // Hellclaw / TW / Demon band: stronger stated gear.
            if (value < 5) {
                value = (uint)Random.Shared.Next(5, 10);
            } else if (Random.Shared.Next(1, 101) <= 35) {
                value = Math.Min(12u, value + 1);
            }
            return value;
        }

        // Gen 9–10 / GG / Ettin / Abby multi-drop: high stated rolls preferred.
        if (value < 6) {
            value = (uint)Random.Shared.Next(6, 12);
        } else if (Random.Shared.Next(1, 101) <= 45) {
            value = Math.Min(12u, value + (uint)Random.Shared.Next(1, 3));
        }
        return value;
    }

    /// <summary>
    /// Soft + hard caps for defense secondary fragments by monster gen.
    /// Prevents slime/low-tier from rolling wood MR91; PA/MA 25+ only Unicorn/Demon+ (gen ≥ 8).
    /// Display: *7 stats → nibble*7 (max 91); PA/MA → nibble*3 (max 39 ≈ 40).
    /// </summary>
    static uint CapDefenseSecondaryNibble(uint secondaryType, uint value, int genLevel) {
        // PA (8) / MA (9): high absorption only from Unicorn / Demon / Hellclaw band (gen ≥ 8).
        if (secondaryType is 8 or 9) {
            if (genLevel < 8) {
                // Re-roll would be ideal; caller re-picks type. Cap to low floor if still present.
                return Math.Min(value, 4u); // display ≤ 12 — weak scrap only
            }
            // gen ≥ 8: allow full band; nibble 9+ → display 27+; clamp ≤ 13 (39).
            return Math.Clamp(value, 1u, 13u);
        }

        // *7 fragments (PR/DR/HP/SP/MP/MR): gen-scaled max so low mobs cannot drop top rolls.
        var maxNibble = genLevel switch {
            <= 2 => 5u,  // ≤ 35
            <= 4 => 7u,  // ≤ 49
            <= 6 => 10u, // ≤ 70
            _ => 13u,    // ≤ 91 hard cap
        };
        return Math.Clamp(value, 1u, maxNibble);
    }

    /// <summary>True when gen can roll high PA/MA (25+ display needs nibble ≥ 9 → gen ≥ 8).</summary>
    static bool CanRollHighAbsorption(int genLevel) => genLevel >= 8;

    /// <summary>Higher gen → more dual-magic rolls (secondary stats).</summary>
    static bool RollDualMagic(int genLevel) {
        // Base Olympia ~40% (roll ≥ 6000 of 10000). Harder mobs push toward ~55–65%.
        var threshold = genLevel switch {
            <= 3 => 6000,
            <= 5 => 5500,
            <= 7 => 5000,
            <= 9 => 4500,
            _ => 4000,
        };
        return Random.Shared.Next(1, 10001) >= threshold;
    }

    static bool IsShield(ItemConfig item) =>
        string.Equals(item.ItemType, "shield", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Weapon primary SWE (Server.cpp attack table) + item name color.
    /// Type 4 "Strong" is intentionally never rolled (disabled for weapons on this server).
    /// Colors: Light=2 Sharp=3 Critical=5 Agile=1 Righteous=7 Poison=4 Ancient=6 CastingProb=8.
    /// Secondary (~40%+ by gen): Hitting Probability / CAD / Exp / Gold(Rep) with product values +1..+7.
    /// </summary>
    static OlympiaMagicRollResult RollAttackWeapon(int genLevel) {
        var color = 0;
        uint type = 0;
        uint value = 1;

        // Olympia dice → type + cColor (no type 4 Strong).
        var iResult = Random.Shared.Next(1, 10001);
        if (iResult is >= 1 and <= 299) {
            type = 6; // Light — less Str to equip / full swing
            color = 2;
        } else if (iResult is >= 300 and <= 999) {
            type = 8; // Sharp
            color = 3;
        } else if (iResult is >= 1000 and <= 2499) {
            type = 1; // Critical
            color = 5;
        } else if (iResult is >= 2500 and <= 4499) {
            type = 5; // Agile — physical attack speed
            color = 1;
        } else if (iResult is >= 4500 and <= 6499) {
            type = 3; // Righteous ("Right")
            color = 7;
        } else if (iResult is >= 6500 and <= 8099) {
            type = 2; // Poisoning (min value 4 → 20% poison dmg, up to 70%)
            color = 4;
        } else if (iResult is >= 8100 and <= 9699) {
            type = 7; // Ancient
            color = 6;
        } else {
            type = 9; // Casting Probability (not Strong)
            color = 8;
        }

        value = RollAttributeValue();
        value = type switch {
            1 when value <= 5 => 5,
            2 when value <= 4 => 4, // poison floor → 20%
            6 when value <= 4 => 4,
            8 when value <= 2 => 2,
            _ => value,
        };
        // Poison cap display 70% → nibble ≤ 14, but attribute nibble is 4 bits → max 15; keep ≤ 14.
        if (type == 2 && value > 14) {
            value = 14;
        }
        value = ScaleAttributeValueForGen(value, genLevel);
        if (type == 2) {
            value = Math.Clamp(value, 4u, 14u);
        }

        uint attribute = (type << 20) | (value << 16);

        if (RollDualMagic(genLevel)) {
            // Olympia weapon secondary: HR 50% / CAD 35% / Gold(Rep) 10% / Exp 5%.
            iResult = Random.Shared.Next(1, 10001);
            if (iResult is >= 1 and <= 4999) {
                type = 2; // Hitting Probability
            } else if (iResult is >= 5000 and <= 8499) {
                type = 10; // CAD
            } else if (iResult is >= 8500 and <= 9499) {
                type = 12; // Gold / Rep-style
            } else {
                type = 11; // Experience
            }

            value = RollWeaponSecondaryValue(type, genLevel);
            attribute |= (type << 12) | (value << 8);
        }

        return new OlympiaMagicRollResult(attribute, color);
    }

    /// <summary>
    /// Wands (effect type 13): base MS0/10/20/22 comes from the catalog name / Item.cfg.
    /// Magic primary (product + user Olympia design): Casting Prob / HP Vamp / MP Vamp — NOT Sharp/Strong.
    /// Secondary: HR / CAD / Exp / Gold(Rep) with product values +1..+7.
    /// Named rares (Berserk/Kloness/MS22 charge) never enter this path (IsPureRareDrop).
    /// </summary>
    static OlympiaMagicRollResult RollManaSaveWeapon(int genLevel) {
        uint type;
        int color;
        // Primary: CP ~40%, HP Vamp ~30%, MP Vamp ~30%
        var iResult = Random.Shared.Next(1, 10001);
        if (iResult <= 4000) {
            type = 9; // Casting Probability
            color = 8;
        } else if (iResult <= 7000) {
            type = 4; // HP Vamp (type 4 Strong is melee-only disabled; wands reuse nibble)
            color = 5;
        } else {
            type = 6; // MP Vamp on wands (melee type 6 = Light; equip/name special-case wands)
            color = 1;
        }

        var value = RollAttributeValue();
        value = type switch {
            9 when value <= 1 => 1,
            4 when value <= 2 => 2,
            6 when value <= 2 => 2,
            _ => value,
        };
        value = ScaleAttributeValueForGen(value, genLevel);
        // Primary nibble is 4 bits (0–15); keep CP/vamp readable.
        if (value > 13) {
            value = 13;
        }

        uint attribute = (type << 20) | (value << 16);

        if (RollDualMagic(genLevel)) {
            // Same secondary bag as melee weapons (Olympia MANASAVE secondary table).
            iResult = Random.Shared.Next(1, 10001);
            if (iResult is >= 1 and <= 4999) {
                type = 2; // Hitting Probability
            } else if (iResult is >= 5000 and <= 8499) {
                type = 10; // CAD
            } else if (iResult is >= 8500 and <= 9499) {
                type = 12; // Gold / Rep
            } else {
                type = 11; // Experience
            }

            value = RollWeaponSecondaryValue(type, genLevel);
            attribute |= (type << 12) | (value << 8);
        }

        return new OlympiaMagicRollResult(attribute, color);
    }

    /// <summary>
    /// Weapon/wand secondary values: product rule +1..+7 for HR / CAD / Exp / Gold(Rep).
    /// Olympia floors (HR min 3, CAD max 7, Exp fixed-ish, Gold mid) preserved inside that band.
    /// </summary>
    static uint RollWeaponSecondaryValue(uint type, int genLevel) {
        var value = RollAttributeValue();
        value = type switch {
            2 when value <= 3 => 3, // Hitting Probability floor
            10 when value > 7 => 7, // CAD classic cap
            11 when value <= 2 => 2, // Exp
            12 when value <= 2 => 2, // Gold/Rep
            _ => value,
        };
        value = ScaleAttributeValueForGen(value, genLevel);
        // Product: all four secondary weapon stats display as +1..+7.
        return Math.Clamp(value, 1u, 7u);
    }

    /// <summary>
    /// Defense gear magic rolls. Shields use a restricted primary/secondary set
    /// (no Poison primary, no PA secondary). Body armor keeps classic Olympia defense table.
    /// </summary>
    static OlympiaMagicRollResult RollDefense(ItemConfig item, int genLevel) {
        return IsShield(item) ? RollShield(genLevel) : RollBodyDefense(genLevel);
    }

    /// <summary>
    /// Shields: primary Endurance / Light / Mana Convert (11) / Charge Crit (12) / Critical.
    /// (never Poison). Secondary: PR / DR / HP / SP / MP / MR / MA — <b>no PA</b>.
    /// Note: primary 11/12 equip as TransMana / ChargeCritical (Server.cpp), not Exp/Gold.
    /// </summary>
    static OlympiaMagicRollResult RollShield(int genLevel) {
        // Primary weights: Endu ~45%, Light ~25%, ManaConv ~12%, ChargeCrit ~8%, Critical ~5%, type10 ~5%.
        uint type;
        var iResult = Random.Shared.Next(1, 10001);
        if (iResult <= 4500) {
            type = 8; // Endurance
        } else if (iResult <= 7000) {
            type = 6; // Light
        } else if (iResult <= 8200) {
            type = 11; // Mana Converting (equip TransMana)
        } else if (iResult <= 9000) {
            type = 12; // Charge Critical
        } else if (iResult <= 9500) {
            type = 1; // Critical (shield bash / rare)
        } else {
            type = 10; // also Mana Converting (wand-style id; equip treats as TransMana)
        }

        var value = RollAttributeValue();
        value = type switch {
            6 when value <= 4 => 4,
            8 when value <= 2 => 2,
            1 when value <= 5 => 5,
            10 when value > 7 => 7,
            11 or 12 => Math.Max(1u, (value + 1) / 2),
            _ => value,
        };
        if ((type is 11 or 12) && genLevel <= 3 && value > 2) {
            value = 2;
        }
        value = ScaleAttributeValueForGen(value, genLevel);
        // Endurance primary: nibble ≤ 13 → ≤ 91% (never ×15).
        if (type == 8) {
            value = Math.Min(value, 13u);
        }

        uint attribute = (type << 20) | (value << 16);

        // Dual magic — secondary never PA (type 8). Rate rises with gen.
        if (RollDualMagic(genLevel)) {
            // PR 1, DR 3, HP 4, SP 5, MP 6, MR 7, MA 9 (no PA 8, no CAD 10, no Exp/Gold secondary).
            // MA only Unicorn/Demon+ (gen ≥ 8); otherwise re-map to MR.
            iResult = Random.Shared.Next(1, 10001);
            if (iResult <= 1500) {
                type = 1; // Poison Resistance
            } else if (iResult <= 3500) {
                type = 3; // Defense Ratio
            } else if (iResult <= 5000) {
                type = 4; // HP Recovery
            } else if (iResult <= 6200) {
                type = 5; // SP Recovery
            } else if (iResult <= 7600) {
                type = 6; // MP Recovery
            } else if (iResult <= 9000) {
                type = 7; // Magic Resistance
            } else if (CanRollHighAbsorption(genLevel)) {
                type = 9; // Magic Absorption
            } else {
                type = 7; // MA locked — fall back to MR
            }

            value = RollAttributeValue();
            value = type switch {
                1 or 3 or 7 or 9 when value <= 3 => 3,
                _ => value,
            };
            value = ScaleAttributeValueForGen(value, genLevel);
            value = CapDefenseSecondaryNibble(type, value, genLevel);

            attribute |= (type << 12) | (value << 8);
        }

        return new OlympiaMagicRollResult(attribute, 0);
    }

    /// <summary>
    /// Body armor / hose / helm / cape — classic Olympia DEFENSE table (includes PA secondary).
    /// Primary: Endurance(8) ~60%, Light(6) ~30%, ManaConv(11) ~5.5%, ChargeCrit(12) ~4.5%.
    /// </summary>
    static OlympiaMagicRollResult RollBodyDefense(int genLevel) {
        uint type;
        uint value;
        var iResult = Random.Shared.Next(1, 10001);
        if (iResult is >= 1 and <= 5999) {
            type = 8; // Endurance
        } else if (iResult is >= 6000 and <= 8999) {
            type = 6; // Light
        } else if (iResult is >= 9000 and <= 9554) {
            type = 11; // Mana Converting (equip TransMana — classic client mislabels as Exp)
        } else {
            type = 12; // Charge Critical (classic client mislabels as Gold)
        }

        value = RollAttributeValue();
        if (type is 6 && value <= 4) {
            value = 4;
        } else if (type is 8 && value <= 2) {
            value = 2;
        } else if (type is 11 or 12) {
            value = Math.Max(1u, (value + 1) / 2);
            if (genLevel <= 3 && value > 2) {
                value = 2;
            }
        }
        value = ScaleAttributeValueForGen(value, genLevel);
        // Endurance primary: nibble ≤ 13 → display/effect ≤ 91% (never ×15 → 135%).
        if (type == 8) {
            value = Math.Min(value, 13u);
        }

        uint attribute = (type << 20) | (value << 16);

        if (RollDualMagic(genLevel)) {
            iResult = Random.Shared.Next(1, 10001);
            if (iResult is >= 1 and <= 999) {
                type = 3;
            } else if (iResult is >= 1000 and <= 3999) {
                type = 1;
            } else if (iResult is >= 4000 and <= 5499) {
                type = 5;
            } else if (iResult is >= 5500 and <= 6499) {
                type = 4;
            } else if (iResult is >= 6500 and <= 7499) {
                type = 6;
            } else if (iResult is >= 7500 and <= 9399) {
                type = 7;
            } else if (iResult is >= 9400 and <= 9799 && CanRollHighAbsorption(genLevel)) {
                type = 8; // PA — Unicorn/Demon+ only (gen ≥ 8)
            } else if (CanRollHighAbsorption(genLevel)) {
                type = 9; // MA — same band
            } else {
                // Low-gen: never PA/MA — re-roll into MR (most common high-end armor secondary).
                type = 7;
            }

            value = RollAttributeValue();
            value = type switch {
                1 or 3 or 7 or 8 or 9 when value <= 3 => 3,
                _ => value,
            };
            value = ScaleAttributeValueForGen(value, genLevel);
            value = CapDefenseSecondaryNibble(type, value, genLevel);

            // PA/MA 25+ requires nibble ≥ 9; only allow that band on gen ≥ 8.
            if ((type is 8 or 9) && value >= 9 && genLevel < 8) {
                value = 8;
            }

            attribute |= (type << 12) | (value << 8);
        }

        return new OlympiaMagicRollResult(attribute, 0);
    }

    static uint RollAttributeValue() {
        var iResult = Random.Shared.Next(1, 30001);
        if (iResult < 10000) return 1;
        if (iResult < 17400) return 2;
        if (iResult < 22400) return 3;
        if (iResult < 25400) return 4;
        if (iResult < 27400) return 5;
        if (iResult < 28400) return 6;
        if (iResult < 28900) return 7;
        if (iResult < 29300) return 8;
        if (iResult < 29600) return 9;
        if (iResult < 29800) return 10;
        if (iResult < 29900) return 11;
        if (iResult < 29970) return 12;
        return 13;
    }
}