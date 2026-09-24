using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// PLAYTEST=1 only. Fresh seat characters get a combat-ready kit from the master item catalog.
/// This server has no level or progression: HP stays at the session max (1000) and melee damage is set to the master cap (1000).
/// Equipped: Aresden hero warrior set plus Barbarian Battle Hammer (id 1, blocks shield — Giant Battle Hammer equivalent).
/// Bag: Aresden hero mage pieces and Merien Shield (id 39). Hammer stays equipped so the shield is not worn with it.
/// Applied only when bag and paperdoll are both empty, so later GM edits persist.
/// </summary>
public static class PlaytestQaKit {
    const int HeroHelmetId = 15;
    const int HeroArmorId = 8;
    const int HeroHauberkId = 10;
    const int HeroLeggingsId = 13;
    const int LongBootsId = 26;
    const int BarbarianBattleHammerId = 1;
    const int HeroRobeId = 17;
    const int HeroCapId = 20;
    const int HeroCapeId = 22;
    const int MerienShieldId = 39;
    const int BigRedPotionId = 164;

    const int MasterMaxDamage = 1000;
    const int MeleeRangeCells = 2;
    const int AttackSpeedMs = 400;
    const int MovementSpeedMs = 160;
    const int CastSpeedMs = 700;

    /// <param name="replaceSeedLoadout">True when this join has no save yet. The inventory constructor seeds a starter paperdoll; that is replaced by the QA kit.</param>
    public static void ApplyIfFresh(GameWorldPlayer player, bool replaceSeedLoadout) {
        if (!PlaytestMode.IsEnabled || !PlaytestMode.IsSeatCharacter(player.CharacterName) || !replaceSeedLoadout) {
            return;
        }

        player.InventoryManager.ClearItems();

        player.SetAttackDamage(MasterMaxDamage);
        player.SetAttackRangeCells(MeleeRangeCells);
        player.SetAttackSpeedMs(AttackSpeedMs);
        player.SetMovementSpeedMs(MovementSpeedMs);
        player.SetCastSpeedMs(CastSpeedMs);

        var equipped = new (int Id, string Slot)[] {
            (HeroHelmetId, "helmet"),
            (HeroArmorId, "armor"),
            (HeroHauberkId, "hauberk"),
            (HeroLeggingsId, "leggings"),
            (LongBootsId, "boots"),
            (BarbarianBattleHammerId, "weapon"),
        };
        foreach (var (id, slot) in equipped) {
            EnsureInBag(player, id);
            TryEquip(player, id, slot);
        }

        EnsureInBag(player, HeroRobeId);
        EnsureInBag(player, HeroCapId);
        EnsureInBag(player, HeroCapeId);
        EnsureInBag(player, MerienShieldId);
        for (var i = 0; i < 5; i++) {
            EnsureInBag(player, BigRedPotionId);
        }

        Console.WriteLine(
            $"[PLAYTEST] {player.CharacterName} kit: master-max melee (dmg {MasterMaxDamage}, hp session max), " +
            "hero war on (15/8/10/13/26), hammer 1 equipped, mage 17/20/22 + Merien 39 in bag.");
    }

    static void EnsureInBag(GameWorldPlayer player, int itemId) {
        player.InventoryManager.TryCreateItem(itemId, effectOverrides: null, out _);
    }

    static void TryEquip(GameWorldPlayer player, int itemId, string slot) {
        foreach (var bag in player.InventoryManager.BagItems) {
            if (bag.ItemId != itemId) {
                continue;
            }
            player.InventoryManager.TryEquipItem(bag.ItemUid, slot, player.GenderValue, out _);
            return;
        }
    }
}
