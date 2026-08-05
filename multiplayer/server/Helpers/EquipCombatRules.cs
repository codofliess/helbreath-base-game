using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Olympia equip / cast weapon &amp; shield rules:
/// STR/level gates (Item.cfg weight÷100 + level), cast only bare-hands / wand-staff / short-sword / fencing,
/// auto-unequip shield on cast except Superior/Exceptional Devlin Shield.
/// </summary>
public static class EquipCombatRules {
    /// <summary>Catalog Devlin family (Olympia rare casting shields).</summary>
    public const int DevlinShieldId = 1320;
    public const int SuperiorDevlinShieldId = 1321;
    public const int ExceptionalDevlinShieldId = 1322;

    /// <summary>True if equipped gear fails Str/level/stat gates (must strip or block use).</summary>
    public static bool CanUseEquippedItem(GameWorldPlayer player, InventoryItemState item, out string error) =>
        Inventory.CanPlayerEquipItem(player, item, out error);

    /// <summary>
    /// Olympia: Short-Sword (skill 7) and Fencing (skill 9) never trigger high-damage
    /// DamageMove / pateo on players — multi-crit trains stay stuck to the target.
    /// Bare hands / other weapons still patean at the damage threshold.
    /// </summary>
    public static bool IsShortSwordOrFencingWeapon(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        if (!player.InventoryManager.EquippedItems.TryGetValue("weapon", out var weapon) || weapon is null) {
            return false;
        }

        var skill = ItemEquipCatalog.GetRelatedSkill(weapon.ItemId);
        return skill is ItemEquipCatalog.SkillShortSword or ItemEquipCatalog.SkillFencing;
    }

    /// <summary>
    /// Olympia PlayerMagicHandler weapon gate (product + classic):
    /// bare hands OK; RHAND only if Wand/Staff (skill 21 / effect 13) or Short-Sword (7) or Fencing (9).
    /// TWOHAND never OK for cast.
    /// </summary>
    public static bool CanCastWithCurrentWeapon(GameWorldPlayer player, out string error) {
        error = "";
        ArgumentNullException.ThrowIfNull(player);

        if (!player.InventoryManager.EquippedItems.TryGetValue("weapon", out var weapon) || weapon is null) {
            return true; // bare hands
        }

        // Must meet Str/level to keep using it.
        if (!CanUseEquippedItem(player, weapon, out error)) {
            return false;
        }

        var id = weapon.ItemId;
        var skill = ItemEquipCatalog.GetRelatedSkill(id);
        var effect = ItemEquipCatalog.GetEffectType(id);
        var equipPos = ItemEquipCatalog.GetEquipPos(id);

        // Two-hand weapons never cast (Olympia: TWOHAND blocks magic).
        if (equipPos == ItemEquipCatalog.EquipPosTwoHand) {
            error = "You cannot cast spells while wielding a two-handed weapon.";
            return false;
        }

        // Wand / staff (effect type 13 mana-save or relatedSkill 21).
        if (effect is 13 or 20 || skill == ItemEquipCatalog.SkillStaffWand) {
            return true;
        }

        // Name fallback for charge wands / custom ids without cfg skill.
        if (TryGetItemName(player, id, out var name) &&
            name.Contains("Wand", StringComparison.OrdinalIgnoreCase)) {
            return true;
        }

        // Short sword / fencing (Olympia skills 7 / 9) — CL product: allow cast with these.
        if (skill is ItemEquipCatalog.SkillShortSword or ItemEquipCatalog.SkillFencing) {
            return true;
        }

        // Dagger is also short-blade skill 7 in Item.cfg.
        if (skill == ItemEquipCatalog.SkillShortSword) {
            return true;
        }

        error = "You can only cast bare-handed, with a wand/staff, short sword, or fencing weapon.";
        return false;
    }

    /// <summary>
    /// Olympia rare cast-with-shield: Devlin / Superior Devlin / Exceptional Devlin (1320–1322).
    /// All other shields auto-unequip (Olympia releases LHAND on cast).
    /// </summary>
    public static bool IsCastAllowedShield(InventoryItemState shield) =>
        shield.ItemId is DevlinShieldId or SuperiorDevlinShieldId or ExceptionalDevlinShieldId;

    /// <summary>
    /// Before cast: strip illegal weapon (to bag) and unequip non-Devlin shield.
    /// Returns false if cast must fail (weapon class illegal and could not clear).
    /// </summary>
    public static bool PrepareForSpellCast(GameWorldRef wr, GameWorldPlayer player, out string error) {
        error = "";
        ArgumentNullException.ThrowIfNull(wr);
        ArgumentNullException.ThrowIfNull(player);

        // Strip any equipped gear that fails Str/level (heavy BBH without Str, etc.).
        Inventory.UnequipItemsInvalidForStats(wr, player);

        if (!CanCastWithCurrentWeapon(player, out error)) {
            // Try unequip illegal weapon so player is not stuck — still fail this cast.
            if (player.InventoryManager.EquippedItems.TryGetValue("weapon", out var badWeapon) && badWeapon is not null) {
                if (player.InventoryManager.TryUnequipItem("weapon", badWeapon.ItemUid, bagX: null, bagY: null, out var mut)) {
                    Inventory.ApplyInventoryMutation(wr, player, mut);
                }
            }
            return false;
        }

        // Shield: keep only Devlin family; otherwise auto-unequip (Olympia LHAND block).
        // Toast once per session so players learn, then silent (no spam mid-fight).
        if (player.InventoryManager.EquippedItems.TryGetValue("shield", out var shield) && shield is not null) {
            if (!IsCastAllowedShield(shield)) {
                if (player.InventoryManager.TryUnequipItem("shield", shield.ItemUid, bagX: null, bagY: null, out var shieldMut)) {
                    Inventory.ApplyInventoryMutation(wr, player, shieldMut);
                    if (!player.HasSeenShieldCastHint) {
                        player.HasSeenShieldCastHint = true;
                        NetworkManager.SendToPlayer(
                            player,
                            NetworkManager.CreateSendMessage(
                                "Your shield was put away to cast. (Devlin Shield can stay equipped. This tip shows once.)"));
                    }
                }
            }
        }

        return true;
    }

    /// <summary>Before melee: refuse hits if equipped weapon fails Str/level (and strip it).</summary>
    public static bool PrepareForMelee(GameWorldRef wr, GameWorldPlayer player, out string error) {
        error = "";
        ArgumentNullException.ThrowIfNull(wr);
        ArgumentNullException.ThrowIfNull(player);

        Inventory.UnequipItemsInvalidForStats(wr, player);

        if (!player.InventoryManager.EquippedItems.TryGetValue("weapon", out var weapon) || weapon is null) {
            return true; // bare hand
        }

        if (CanUseEquippedItem(player, weapon, out error)) {
            return true;
        }

        if (player.InventoryManager.TryUnequipItem("weapon", weapon.ItemUid, bagX: null, bagY: null, out var mut)) {
            Inventory.ApplyInventoryMutation(wr, player, mut);
        }
        NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(error));
        return false;
    }

    static bool TryGetItemName(GameWorldPlayer player, int itemId, out string name) {
        name = "";
        if (player.InventoryManager.TryGetItemConfig(itemId, out var def) && def is not null) {
            name = def.Name ?? "";
            return name.Length > 0;
        }
        return false;
    }
}
