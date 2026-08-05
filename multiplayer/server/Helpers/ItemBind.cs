using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Soul / Guild / Unbind seals (~USD 5). Bind state is server-authoritative on each
/// <see cref="InventoryItemState"/>. Guildbound items may only be unbound by guild master or captains.
/// </summary>
public static class ItemBind {
    public const int SoulBindSealItemId = 960;
    public const int GuildBindSealItemId = 961;
    public const int UnbindSealItemId = 962;

    public const int ActionSoulBind = 1;
    public const int ActionGuildBind = 2;
    public const int ActionUnbind = 3;

    public const int BindStateUnbound = 0;
    public const int BindStateSoulbound = 1;
    public const int BindStateGuildbound = 2;

    public const int GuildRankNone = 0;
    public const int GuildRankMember = 1;
    public const int GuildRankCaptain = 2;
    public const int GuildRankMaster = 3;

    public static bool IsSealItemId(int itemId) =>
        itemId is SoulBindSealItemId or GuildBindSealItemId or UnbindSealItemId;

    /// <summary>Soul/guild bound gear cannot leave the holder (drop, auction, sell, warehouse trade paths).</summary>
    public static bool IsTransferBlocked(InventoryItemState item) =>
        item.BindState is BindStateSoulbound or BindStateGuildbound;

    public static bool IsGuildOfficer(GameWorldPlayer player) =>
        !string.IsNullOrWhiteSpace(player.GuildId)
        && player.GuildRank is GuildRankCaptain or GuildRankMaster;

    public static void HandleRequest(GameWorldRef wr, GameWorldPlayer player, ItemBindRequest request) {
        ArgumentNullException.ThrowIfNull(wr);
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        if (player.IsDead) {
            Send(player, ok: false, "Cannot bind while dead.", request.ItemUid, 0, "");
            return;
        }

        if (!TryFindItem(player, request.ItemUid, out var item, out var equippedSlot)) {
            Send(player, ok: false, "Item not found in bag or equipment.", request.ItemUid, 0, "");
            return;
        }

        if (IsSealItemId(item.ItemId) || item.ItemId == GroundItemPickup.GoldItemId) {
            Send(player, ok: false, "That item cannot be bound.", request.ItemUid, item.BindState, item.BoundGuildId);
            return;
        }

        switch (request.Action) {
            case ActionSoulBind:
                ApplySoulBind(wr, player, item, equippedSlot);
                break;
            case ActionGuildBind:
                ApplyGuildBind(wr, player, item, equippedSlot);
                break;
            case ActionUnbind:
                ApplyUnbind(wr, player, item, equippedSlot);
                break;
            default:
                Send(player, ok: false, "Unknown bind action.", request.ItemUid, item.BindState, item.BoundGuildId);
                break;
        }
    }

    static void ApplySoulBind(GameWorldRef wr, GameWorldPlayer player, InventoryItemState item, string? equippedSlot) {
        if (item.BindState == BindStateSoulbound) {
            Send(player, ok: false, "Already soulbound.", item.ItemUid, item.BindState, item.BoundGuildId);
            return;
        }

        if (item.BindState == BindStateGuildbound) {
            Send(player, ok: false, "Unbind the guild seal first, then soul-bind.", item.ItemUid, item.BindState, item.BoundGuildId);
            return;
        }

        if (!TryConsumeSeal(wr, player, SoulBindSealItemId, out var fail)) {
            Send(player, ok: false, fail, item.ItemUid, item.BindState, item.BoundGuildId);
            return;
        }

        item.BindState = BindStateSoulbound;
        item.BoundGuildId = "";
        NotifyItemUpdated(wr, player, item, equippedSlot);
        Send(player, ok: true, "Soulbound — will not drop on death; not tradeable until Unbind Seal.", item.ItemUid, item.BindState, item.BoundGuildId);
    }

    static void ApplyGuildBind(GameWorldRef wr, GameWorldPlayer player, InventoryItemState item, string? equippedSlot) {
        if (string.IsNullOrWhiteSpace(player.GuildId)) {
            Send(player, ok: false, "Join a guild before using a Guild Bind Seal.", item.ItemUid, item.BindState, item.BoundGuildId);
            return;
        }

        if (item.BindState == BindStateGuildbound &&
            string.Equals(item.BoundGuildId, player.GuildId, StringComparison.OrdinalIgnoreCase)) {
            Send(player, ok: false, "Already guild-bound to your guild.", item.ItemUid, item.BindState, item.BoundGuildId);
            return;
        }

        if (item.BindState == BindStateSoulbound) {
            Send(player, ok: false, "Unbind soul first, then guild-bind.", item.ItemUid, item.BindState, item.BoundGuildId);
            return;
        }

        if (!TryConsumeSeal(wr, player, GuildBindSealItemId, out var fail)) {
            Send(player, ok: false, fail, item.ItemUid, item.BindState, item.BoundGuildId);
            return;
        }

        item.BindState = BindStateGuildbound;
        item.BoundGuildId = player.GuildId.Trim();
        NotifyItemUpdated(wr, player, item, equippedSlot);
        Send(
            player,
            ok: true,
            "Guild-bound — no death drop; only guild master/captains may Unbind. Stays in guild wallets until then.",
            item.ItemUid,
            item.BindState,
            item.BoundGuildId);
    }

    static void ApplyUnbind(GameWorldRef wr, GameWorldPlayer player, InventoryItemState item, string? equippedSlot) {
        if (item.BindState == BindStateUnbound) {
            Send(player, ok: false, "Item is already unbound.", item.ItemUid, item.BindState, item.BoundGuildId);
            return;
        }

        if (item.BindState == BindStateGuildbound) {
            if (string.IsNullOrWhiteSpace(player.GuildId) ||
                !string.Equals(item.BoundGuildId, player.GuildId, StringComparison.OrdinalIgnoreCase)) {
                Send(player, ok: false, "Only officers of this item's guild may unbind it.", item.ItemUid, item.BindState, item.BoundGuildId);
                return;
            }

            if (!IsGuildOfficer(player)) {
                Send(player, ok: false, "Only the guild master or captains may unbind guild-bound items.", item.ItemUid, item.BindState, item.BoundGuildId);
                return;
            }
        }

        if (!TryConsumeSeal(wr, player, UnbindSealItemId, out var fail)) {
            Send(player, ok: false, fail, item.ItemUid, item.BindState, item.BoundGuildId);
            return;
        }

        item.BindState = BindStateUnbound;
        item.BoundGuildId = "";
        NotifyItemUpdated(wr, player, item, equippedSlot);
        Send(player, ok: true, "Unbound — tradeable again (may drop on death without Zem).", item.ItemUid, item.BindState, item.BoundGuildId);
    }

    static bool TryConsumeSeal(GameWorldRef wr, GameWorldPlayer player, int sealItemId, out string error) {
        error = "";
        foreach (var bag in player.InventoryManager.BagItems) {
            if (bag.ItemId != sealItemId || bag.Quantity < 1) {
                continue;
            }

            if (!player.InventoryManager.TryConsumeItem(bag.ItemUid, out var mut)) {
                continue;
            }

            Inventory.ApplyInventoryMutation(wr, player, mut);
            return true;
        }

        error = sealItemId switch {
            SoulBindSealItemId => "Need a Soul Bind Seal in your bag.",
            GuildBindSealItemId => "Need a Guild Bind Seal in your bag.",
            _ => "Need an Unbind Seal in your bag.",
        };
        return false;
    }

    static bool TryFindItem(GameWorldPlayer player, long itemUid, out InventoryItemState item, out string? equippedSlot) {
        equippedSlot = null;
        foreach (var bag in player.InventoryManager.BagItems) {
            if (bag.ItemUid == itemUid) {
                item = bag;
                return true;
            }
        }

        foreach (var kv in player.InventoryManager.EquippedItems) {
            if (kv.Value.ItemUid == itemUid) {
                item = kv.Value;
                equippedSlot = kv.Key;
                return true;
            }
        }

        item = null!;
        return false;
    }

    static void NotifyItemUpdated(GameWorldRef wr, GameWorldPlayer player, InventoryItemState item, string? equippedSlot) {
        if (equippedSlot is null) {
            var mut = new InventoryMutationResult();
            mut.AddedToBag.Add(item.Clone());
            Inventory.ApplyInventoryMutation(wr, player, mut);
            return;
        }

        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateItemEquipped(player.PlayerId, equippedSlot, item));
    }

    static void Send(
        GameWorldPlayer player,
        bool ok,
        string message,
        long itemUid,
        int bindState,
        string boundGuildId) {
        NetworkManager.SendToPlayer(
            player,
            new ServerMessage {
                ItemBindResult = new ItemBindResult {
                    Ok = ok,
                    Message = message ?? "",
                    ItemUid = itemUid,
                    BindState = bindState,
                    BoundGuildId = boundGuildId ?? "",
                },
            });
    }
}
