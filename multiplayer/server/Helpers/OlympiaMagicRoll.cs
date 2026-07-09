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
            OlympiaItemEffectType.Defense => RollDefense(genLevel),
            _ => new OlympiaMagicRollResult(0, 0),
        };
    }

    static OlympiaMagicRollResult RollAttackWeapon(int genLevel) {
        var color = 0;
        uint type = 0;
        uint value = 1;

        var iResult = Random.Shared.Next(1, 10001);
        if (iResult is >= 1 and <= 299) {
            type = 6;
            color = 2;
        } else if (iResult is >= 300 and <= 999) {
            type = 8;
            color = 3;
        } else if (iResult is >= 1000 and <= 2499) {
            type = 1;
            color = 5;
        } else if (iResult is >= 2500 and <= 4499) {
            type = 5;
            color = 1;
        } else if (iResult is >= 4500 and <= 6499) {
            type = 3;
            color = 7;
        } else if (iResult is >= 6500 and <= 8099) {
            type = 2;
            color = 4;
        } else if (iResult is >= 8100 and <= 9699) {
            type = 7;
            color = 6;
        } else {
            type = 9;
            color = 8;
        }

        value = RollAttributeValue();
        value = type switch {
            1 when value <= 5 => 5,
            2 when value <= 4 => 4,
            6 when value <= 4 => 4,
            8 when value <= 2 => 2,
            _ => value,
        };
        if (genLevel <= 2 && value > 7) {
            value = 7;
        }

        uint attribute = (type << 20) | (value << 16);

        if (Random.Shared.Next(1, 10001) >= 6000) {
            iResult = Random.Shared.Next(1, 10001);
            if (iResult is >= 1 and <= 4999) {
                type = 2;
            } else if (iResult is >= 5000 and <= 8499) {
                type = 10;
            } else if (iResult is >= 8500 and <= 9499) {
                type = 12;
            } else {
                type = 11;
            }

            value = RollAttributeValue();
            value = type switch {
                2 when value <= 3 => 3,
                10 when value > 7 => 7,
                11 => 2,
                12 => 5,
                _ => value,
            };
            if (genLevel <= 2 && value > 7) {
                value = 7;
            }

            attribute |= (type << 12) | (value << 8);
        }

        return new OlympiaMagicRollResult(attribute, color);
    }

    static OlympiaMagicRollResult RollManaSaveWeapon(int genLevel) {
        const int color = 5;
        uint type = 10;
        var value = RollAttributeValue();
        if (genLevel <= 2 && value > 7) {
            value = 7;
        }

        uint attribute = (type << 20) | (value << 16);

        if (Random.Shared.Next(1, 10001) >= 6000) {
            var iResult = Random.Shared.Next(1, 10001);
            if (iResult is >= 1 and <= 4999) {
                type = 2;
            } else if (iResult is >= 5000 and <= 8499) {
                type = 10;
            } else if (iResult is >= 8500 and <= 9499) {
                type = 12;
            } else {
                type = 11;
            }

            value = RollAttributeValue();
            if (genLevel <= 2 && value > 7) {
                value = 7;
            }

            value = type switch {
                2 when value <= 3 => 3,
                10 when value > 7 => 7,
                11 => 2,
                12 => 5,
                _ => value,
            };

            attribute |= (type << 12) | (value << 8);
        }

        return new OlympiaMagicRollResult(attribute, color);
    }

    static OlympiaMagicRollResult RollDefense(int genLevel) {
        uint type;
        uint value;
        var iResult = Random.Shared.Next(1, 10001);
        if (iResult is >= 1 and <= 5999) {
            type = 8;
        } else if (iResult is >= 6000 and <= 8999) {
            type = 6;
        } else if (iResult is >= 9000 and <= 9554) {
            type = 11;
        } else {
            type = 12;
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
        if (genLevel <= 2 && value > 7) {
            value = 7;
        }

        uint attribute = (type << 20) | (value << 16);

        if (Random.Shared.Next(1, 10001) >= 6000) {
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
            } else if (iResult is >= 9400 and <= 9799) {
                type = 8;
            } else {
                type = 9;
            }

            value = RollAttributeValue();
            value = type switch {
                1 or 3 or 7 or 8 or 9 when value <= 3 => 3,
                _ => value,
            };
            if (genLevel <= 2 && value > 7) {
                value = 7;
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