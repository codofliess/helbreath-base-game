namespace Server.Helpers;

/// <summary>
/// Olympia NPC buy-back gold quote from <c>Server.cpp</c> ReqSellItemPrice / confirm
/// (category 1–10 durability + magic attribute premiums; category 11–50 half list price).
/// </summary>
public static class OlympiaSellPrice {
    /// <summary>
    /// Primary magic type multipliers (dwSWEType >> 20) used when computing attribute premiums.
    /// </summary>
    static int PrimaryTypeMultiplier(uint sweType) {
        return sweType switch {
            6 => 2,  // Light
            8 => 2,  // Sharp / Endurance
            5 => 3,  // Agile
            1 => 4,  // Critical
            7 => 5,  // Ancient
            2 => 6,  // Poisoning
            3 => 15, // Righteous
            9 => 20, // Casting Prob.
            _ => 1,
        };
    }

    /// <summary>
    /// Secondary magic type multipliers (dwSWEType >> 12).
    /// </summary>
    static int SecondaryTypeMultiplier(uint sweType) {
        return sweType switch {
            1 or 12 => 2,
            2 or 3 or 4 or 5 or 6 or 7 => 4,
            8 or 9 or 10 or 11 => 6,
            _ => 1,
        };
    }

    /// <summary>
    /// Value-nibble → percent addend (cases 1–13 in Olympia sell).
    /// </summary>
    static double ValuePercent(uint sweValue) {
        return sweValue switch {
            1 => 10.0,
            2 => 20.0,
            3 => 30.0,
            4 => 35.0,
            5 => 40.0,
            6 => 50.0,
            7 => 100.0,
            8 => 200.0,
            9 => 300.0,
            10 => 400.0,
            11 => 500.0,
            12 => 700.0,
            13 => 900.0,
            _ => 0.0,
        };
    }

    /// <summary>
    /// Builds one attribute premium branch: <c>add = price*mul + price*mul*(pct/100)</c>,
    /// then retains two-thirds (<c>add - add/3</c>) as in Olympia v2.03.
    /// </summary>
    static int AttributePremium(int basePrice, int typeMul, uint sweValue) {
        if (basePrice <= 0 || typeMul <= 0) {
            return 0;
        }

        var pct = ValuePercent(sweValue);
        if (pct <= 0.0 && sweValue == 0) {
            return 0;
        }

        var d1 = (double)basePrice * typeMul;
        var d3 = d1 * (pct / 100.0);
        var add = (int)(d1 + d3);
        return add - (add / 3);
    }

    /// <summary>
    /// Quotes gold for selling <paramref name="quantity"/> of one bag stack.
    /// Returns false when the item cannot be sold (bad category, broken weapon, or zero quote).
    /// </summary>
    /// <param name="listPrice">Olympia <c>m_wPrice</c> / Items.json price.</param>
    /// <param name="category">Olympia item category (1–10 gear, 11–50 consumables/misc).</param>
    /// <param name="itemAttribute">Olympia <c>m_dwAttribute</c> (magic nibbles + upgrade).</param>
    /// <param name="curLifeSpan">Current durability; ignored for category 11–50.</param>
    /// <param name="maxLifeSpan">Max durability; ignored for category 11–50.</param>
    /// <param name="quantity">Stack count (≥ 1).</param>
    /// <param name="gold">Gold the seller receives.</param>
    /// <param name="error">Human-readable reject reason when returning false.</param>
    public static bool TryQuote(
            int listPrice,
            int category,
            uint itemAttribute,
            int curLifeSpan,
            int maxLifeSpan,
            int quantity,
            out int gold,
            out string error) {
        gold = 0;
        error = string.Empty;
        var qty = Math.Max(1, quantity);

        if (category < 1 || category > 50) {
            error = "That item cannot be sold for gold.";
            return false;
        }

        // Upgrade suffix (+1…+15) from high nibble — scales list price before buy-back math.
        var upgrade = (itemAttribute & 0xF0000000u) >> 28;
        var effectiveList = listPrice > 0
            ? (int)Math.Min(int.MaxValue, (long)listPrice * (1 + (int)upgrade))
            : 0;

        int unitPrice;
        if (category >= 11 && category <= 50) {
            unitPrice = effectiveList > 0 ? Math.Max(1, effectiveList / 2) : 0;
        } else {
            // Category 1–10: weapons/armor — durability-scaled half price + magic premiums.
            // Truly broken = tracked durability that hit 0 (maxLife > 1, cur = 0).
            // Drops / pickups with untracked lifespan (max<=1, cur=0) are NOT broken —
            // Items.json often omits maxLifeSpan so Cur stays 0 until filled from Item.cfg.
            if (curLifeSpan <= 0 && maxLifeSpan > 1) {
                error = "Broken items cannot be sold.";
                return false;
            }

            if (effectiveList <= 0) {
                error = "That item has no sell value.";
                return false;
            }

            // Untracked durability → price as full (Olympia full-life gear).
            var remain = curLifeSpan > 0 ? (double)curLifeSpan : 1.0;
            var max = maxLifeSpan > 1 ? (double)maxLifeSpan : 1.0;
            if (remain > max) {
                remain = max;
            }
            var basePrice = (int)((remain / max) * 0.5 * effectiveList);
            if (basePrice <= 0) {
                basePrice = 1;
            }

            var add1 = 0;
            var add2 = 0;
            if ((itemAttribute & 0x00F00000u) != 0) {
                var sweType = (itemAttribute & 0x00F00000u) >> 20;
                var sweValue = (itemAttribute & 0x000F0000u) >> 16;
                add1 = AttributePremium(basePrice, PrimaryTypeMultiplier(sweType), sweValue);
            }

            if ((itemAttribute & 0x0000F000u) != 0) {
                var sweType = (itemAttribute & 0x0000F000u) >> 12;
                var sweValue = (itemAttribute & 0x00000F00u) >> 8;
                add2 = AttributePremium(basePrice, SecondaryTypeMultiplier(sweType), sweValue);
            }

            unitPrice = basePrice + add1 + add2;
        }

        if (unitPrice <= 0) {
            error = "That item has no sell value.";
            return false;
        }

        if (unitPrice > 1_000_000) {
            unitPrice = 1_000_000;
        }

        long gross = (long)unitPrice * qty;
        gold = gross > int.MaxValue ? int.MaxValue : (int)gross;
        if (gold <= 0) {
            error = "That item has no sell value.";
            return false;
        }

        return true;
    }
}
