using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Olympia-style MS22 charge wands: equipped weapon holds CurLifeSpan/MaxLifeSpan charges
/// for a single high spell (Inhibition / Cancellation / Mass Illusion Movement).
/// </summary>
public static class ChargeWand {
    public const int WandInhibitionItemId = 1314;
    public const int WandCancellationItemId = 1315;
    public const int WandMimItemId = 1316;

    public const int SpellInhibition = 46;
    public const int SpellCancellation = 45;
    public const int SpellMassIllusionMovement = 49;

    public const int DefaultMaxCharges = 200;

    /// <summary>Server spell id unlocked by this charge-wand item, or null.</summary>
    public static int? SpellIdForItem(int itemId) => itemId switch {
        WandInhibitionItemId => SpellInhibition,
        WandCancellationItemId => SpellCancellation,
        WandMimItemId => SpellMassIllusionMovement,
        _ => null,
    };

    /// <summary>True if equipped weapon is a charge wand for <paramref name="spellId"/> with charges left.</summary>
    public static bool TryGetEquippedChargeWand(GameWorldPlayer player, int spellId, out InventoryItemState? wand) {
        wand = null;
        ArgumentNullException.ThrowIfNull(player);
        if (!player.InventoryManager.EquippedItems.TryGetValue("weapon", out var weapon) || weapon is null) {
            return false;
        }

        if (SpellIdForItem(weapon.ItemId) != spellId) {
            return false;
        }

        if (weapon.CurLifeSpan < 1) {
            return false;
        }

        wand = weapon;
        return true;
    }

    /// <summary>Allow cast if learned normally OR charge wand has charges.</summary>
    public static bool AllowsSpellCast(GameWorldPlayer player, int spellId) {
        ArgumentNullException.ThrowIfNull(player);
        // Arena: Inhibition / Cancellation / Sleep ONLY via kit credit uses — not free book, not MS22 bypass.
        if (player.InTournamentArena && GameWorldPlayer.IsArenaCreditGatedSpell(spellId)) {
            return player.GetArenaPerUseSpellCharges(spellId) > 0;
        }

        if (player.IsSpellAllowed(spellId)) {
            return true;
        }

        return TryGetEquippedChargeWand(player, spellId, out _);
    }

    /// <summary>
    /// After a successful cast of a charge-wand spell: if the cast was only possible via wand
    /// (or always when wand is equipped for that spell), burn one charge.
    /// </summary>
    public static void TryConsumeChargeAfterCast(GameWorldPlayer player, int spellId) {
        if (!TryGetEquippedChargeWand(player, spellId, out var wand) || wand is null) {
            return;
        }

        // Always consume when the matching charge wand is equipped (Olympia feel: charges fuel the cast).
        if (wand.CurLifeSpan > 0) {
            wand.CurLifeSpan -= 1;
        }
    }

    /// <summary>Ensure drop/spawn has 200/200 charges.</summary>
    public static void EnsureFullCharges(InventoryItemState item, ItemConfig? config) {
        if (SpellIdForItem(item.ItemId) is null) {
            return;
        }

        var max = config?.MaxLifeSpan is int m && m > 0 ? m : DefaultMaxCharges;
        item.MaxLifeSpan = max;
        if (item.CurLifeSpan <= 0 || item.CurLifeSpan > max) {
            item.CurLifeSpan = max;
        }
    }
}
