using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Cash-shop gear boosts + ancient tablet buffs + service tickets.
/// Shoes/Boots: Exp+30% + HP/MP Recovery+40%. Capes: Exp+40% + HP/MP Recovery+50%.
/// Exp% from gear stacks additively (Olympia m_iAddExp = sum value*10); tablet buffs multiply separately.
/// </summary>
public static class CashShopBoosts {
    // Gear catalog ids
    public const int ShoesExpMp = 950;
    public const int ShoesExpHp = 951;
    public const int BootsExpMp = 952;
    public const int BootsExpHp = 953;
    public const int CapeExpMp = 954;
    public const int CapeExpHp = 955;

    // Tablets
    public const int ExpTablet = 1310;
    public const int HpTablet = 1311;
    public const int MpTablet = 1312;
    public const int BerserkTablet = 1313;

    // Tickets
    public const int BindingTicket = 1300;
    public const int GuildBindTicket = 1301;
    public const int UnboundTicket = 1302;
    public const int UnlearnTalentTicket = 1304;
    public const int StatChangeTicket = 1305;
    public const int NameChangeTicket = 1306;
    public const int TownChangeTicket = 1307;
    public const int GuildNameChangeTicket = 1308;
    public const int ItemNftTicket = 1309;
    // NOTE: 1314–1316 are MS22 charge wands — do not reuse those ids for tickets.
    public const int ReputationTicket = 1317;
    public const int ArmorSexChangePotion = 1318;

    public const int ExpTabletDurationMs = 30 * 60 * 1000;
    /// <summary>+200% EXP → total multiplier 3.0 (stacks with gear Exp% additively applied after).</summary>
    public const double ExpTabletMultiplier = 3.0;
    public const int HpTabletDurationMs = 15 * 60 * 1000;
    public const int MpTabletDurationMs = 30 * 60 * 1000;
    public const int BerserkTabletDurationMs = 5 * 60 * 1000;
    public const int ReputationGrant = 100;

    /// <summary>
    /// Olympia secondary Exp fragment: type 11, value*10 = Exp% (stacks additively into m_iAddExp).
    /// Regen% cannot share the secondary nibble with Exp — applied by <see cref="GetEquippedRegenBonus"/>.
    /// </summary>
    public static uint EncodeExpSecondary(int expPercent) {
        var nibble = Math.Clamp(expPercent / 10, 1, 15);
        return (uint)((ItemMagicAttribute.S_Exp << 12) | (nibble << 8));
    }

    /// <summary>
    /// Apply cash-shop affixes: Exp% on item attribute (Olympia secondary Exp).
    /// HP/MP Recovery% is catalog-id based (not flat CIC pool) — see <see cref="GetEquippedRegenBonus"/>.
    /// </summary>
    public static void ApplyGearAffixes(InventoryItemState item) {
        ArgumentNullException.ThrowIfNull(item);
        // Clear any flat CIC pool stats from older wrong grants (was HP+40 flat, not regen%).
        item.CicLevel = 0;
        item.CicStatKind = 0;
        item.CicStatValue = 0;
        switch (item.ItemId) {
            case ShoesExpMp:
            case BootsExpMp:
            case ShoesExpHp:
            case BootsExpHp:
                item.ItemAttribute = EncodeExpSecondary(30);
                break;
            case CapeExpMp:
            case CapeExpHp:
                item.ItemAttribute = EncodeExpSecondary(40);
                break;
        }
    }

    /// <summary>
    /// Extra HP/MP recovery % from equipped cash shoes/boots/cape (stacks additively).
    /// Shoes/boots: +40%. Capes: +50%. Not flat max-pool.
    /// </summary>
    public static void GetEquippedRegenBonus(GameWorldPlayer player, out int hpRegenPercent, out int mpRegenPercent) {
        ArgumentNullException.ThrowIfNull(player);
        hpRegenPercent = 0;
        mpRegenPercent = 0;
        foreach (var kv in player.InventoryManager.EquippedItems) {
            var id = kv.Value.ItemId;
            switch (id) {
                case ShoesExpHp:
                case BootsExpHp:
                    hpRegenPercent += 40;
                    break;
                case CapeExpHp:
                    hpRegenPercent += 50;
                    break;
                case ShoesExpMp:
                case BootsExpMp:
                    mpRegenPercent += 40;
                    break;
                case CapeExpMp:
                    mpRegenPercent += 50;
                    break;
            }
        }
    }

    public static bool IsCashGear(int itemId) =>
        itemId is ShoesExpMp or ShoesExpHp or BootsExpMp or BootsExpHp or CapeExpMp or CapeExpHp;

    public static bool IsTablet(int itemId) =>
        itemId is ExpTablet or HpTablet or MpTablet or BerserkTablet;

    public static bool IsServiceTicket(int itemId) =>
        itemId is UnlearnTalentTicket or StatChangeTicket or NameChangeTicket or TownChangeTicket
            or GuildNameChangeTicket or ItemNftTicket or ReputationTicket or ArmorSexChangePotion
            or BindingTicket or GuildBindTicket or UnboundTicket;

    /// <summary>
    /// After bag consume: apply tablet/ticket effects. Returns true if handled (caller should not treat as plain potion).
    /// </summary>
    public static bool TryApplyConsumable(GameWorldRef wr, GameWorldPlayer player, int itemId) {
        ArgumentNullException.ThrowIfNull(player);
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        switch (itemId) {
            case ExpTablet:
                player.CashExpTabletExpiresAtMs = Math.Max(player.CashExpTabletExpiresAtMs, now + ExpTabletDurationMs);
                // Foot aura (Olympia-style status ring). No movement/attack modifiers.
                player.ApplyTemporaryEffect(
                    wr,
                    TemporaryEffectType.ExpBoost,
                    group: 20,
                    ExpTabletDurationMs,
                    movementSpeedModifier: 0,
                    attackSpeedModifier: 0,
                    castSpeedModifier: 0);
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                    "Exp Tablet: +200% EXP for 30 minutes."));
                Progression.SendProgressionUpdated(player, leveledUp: false);
                return true;

            case HpTablet:
                player.CashHpTabletExpiresAtMs = Math.Max(player.CashHpTabletExpiresAtMs, now + HpTabletDurationMs);
                PlayerDerivedStats.Refresh(player, fillIncreasedPools: true);
                NetworkManager.SendToPlayer(player, NetworkManager.CreateHpUpdated(player.Hp, player.MaxHp));
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                    "HP Tablet: 2× max HP and +50% regen for 15 minutes."));
                Progression.SendProgressionUpdated(player, leveledUp: false);
                return true;

            case MpTablet:
                player.CashMpTabletExpiresAtMs = Math.Max(player.CashMpTabletExpiresAtMs, now + MpTabletDurationMs);
                player.FillMp();
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                    "MP Tablet: unlimited mana for 30 minutes."));
                Progression.SendProgressionUpdated(player, leveledUp: false);
                return true;

            case BerserkTablet:
                player.ApplyTemporaryEffect(
                    wr,
                    TemporaryEffectType.Berserk,
                    group: 0,
                    BerserkTabletDurationMs,
                    movementSpeedModifier: 0,
                    attackSpeedModifier: -0.2,
                    castSpeedModifier: 0);
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                    "Berserk Tablet: Berserk for 5 minutes."));
                return true;

            case ReputationTicket:
                player.AddReputation(ReputationGrant);
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                    $"+{ReputationGrant} reputation."));
                Progression.SendProgressionUpdated(player, leveledUp: false);
                return true;

            case TownChangeTicket:
                // Flip citizenship aresden ↔ elvine and recall to new city pad.
                var side = (player.CitizenshipSide ?? "").Trim().ToLowerInvariant();
                var next = side == "aresden" ? "elvine" : "aresden";
                player.SetCitizenshipSide(next);
                if (Recall.TryPickRandomCityPad(next, out var tx, out var ty)) {
                    player.RequestWorldChange(new WorldTransferDestination(next, tx, ty));
                }
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                    $"Town Change: you are now a citizen of {next}."));
                Progression.SendProgressionUpdated(player, leveledUp: false);
                return true;

            case ArmorSexChangePotion:
            case 274: // Sex Change Potion — flip gender stamp for armor fit
                player.ToggleGenderPresentation();
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                    "Sex presentation flipped for armor fit."));
                Progression.SendProgressionUpdated(player, leveledUp: false);
                return true;

            case UnlearnTalentTicket:
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                    "Unlearn Talent Ticket: open Magic Tower / talent UI and unlearn (ticket consumed)."));
                return true;

            case StatChangeTicket:
                // Full free respec: all primary stats → 10; LU recalculates so player re-spends via F5 Level Set.
                if (!player.TryApplyFullStatRespecToBase()) {
                    NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                        "Stat Change Ticket failed — stats unchanged."));
                    return true; // still consume? return true without consume path is wrong — caller already consumed
                }
                Inventory.UnequipItemsInvalidForStats(wr, player);
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                    "Stat Change Ticket: all stats reset to 10. Open F5 Level Set to re-allocate free points."));
                Progression.SendProgressionUpdated(player, leveledUp: false);
                return true;

            case NameChangeTicket:
            case GuildNameChangeTicket:
            case ItemNftTicket:
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                    "Ticket consumed — name/guild/NFT services finalize via support desk this testing week."));
                return true;

            case BindingTicket:
            case GuildBindTicket:
            case UnboundTicket:
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                    "Bind ticket in bag — use Item Bind UI (right-click gear) with this seal."));
                return true;
        }

        return false;
    }

    public static double GetExpMultiplier(GameWorldPlayer player) {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (player.CashExpTabletExpiresAtMs > now) {
            return ExpTabletMultiplier;
        }
        return 1.0;
    }

    public static bool HasHpTablet(GameWorldPlayer player) {
        return player.CashHpTabletExpiresAtMs > DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    public static bool HasMpTablet(GameWorldPlayer player) {
        return player.CashMpTabletExpiresAtMs > DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }
}
