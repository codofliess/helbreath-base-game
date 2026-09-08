using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// City-locked Hero kit ids. <c>a Hero *</c> / Aresden cape = Aresden; <c>e Hero *</c> / Elvine cape = Elvine.
/// One character kit is one side only — never both.
/// </summary>
public static class HeroFactionKit {
    public const string Aresden = "aresden";
    public const string Elvine = "elvine";

    /// <summary>Aresden catalog id → Elvine sibling (same slot + gender).</summary>
    static readonly Dictionary<int, int> AresdenToElvine = new() {
        [400] = 401, // Hero Cape
        [403] = 405, // Helm(M)
        [404] = 406, // Helm(W)
        [407] = 409, // Cap(M)
        [408] = 410, // Cap(W)
        [411] = 413, // Armor(M)
        [412] = 414, // Armor(W)
        [415] = 417, // Robe(M)
        [416] = 418, // Robe(W)
        [419] = 421, // Hauberk(M)
        [420] = 422, // Hauberk(W)
        [423] = 425, // Leggings(M)
        [424] = 426, // Leggings(W)
        [427] = 428, // Hero Cape+1
    };

    static readonly Dictionary<int, int> ElvineToAresden = AresdenToElvine
        .ToDictionary(kv => kv.Value, kv => kv.Key);

    /// <summary>Aresden / Elvine when <paramref name="itemId"/> is a city Hero piece; otherwise null.</summary>
    public static string? FactionOf(int itemId) {
        if (AresdenToElvine.ContainsKey(itemId)) {
            return Aresden;
        }
        if (ElvineToAresden.ContainsKey(itemId)) {
            return Elvine;
        }
        return null;
    }

    public static bool IsHeroFactionItem(int itemId) => FactionOf(itemId) is not null;

    /// <summary>Rewrite a Hero piece to <paramref name="side"/>. Neutral ids are unchanged.</summary>
    public static int ToSide(int itemId, string side) {
        var want = Normalize(side);
        var have = FactionOf(itemId);
        if (want is null || have is null || have == want) {
            return itemId;
        }
        if (want == Elvine) {
            return AresdenToElvine.TryGetValue(itemId, out var elv) ? elv : itemId;
        }
        return ElvineToAresden.TryGetValue(itemId, out var are) ? are : itemId;
    }

    public static string? Normalize(string? side) {
        var s = (side ?? string.Empty).Trim().ToLowerInvariant();
        return s is Aresden or Elvine ? s : null;
    }

    /// <summary>
    /// Lock side: citizenship papers first, else majority of <paramref name="itemIds"/>,
    /// else the first Hero id. Null = no papers and no Hero pieces.
    /// </summary>
    public static string? ResolveSide(string? citizenshipSide, IEnumerable<int> itemIds) {
        var papers = Normalize(citizenshipSide);
        if (papers is not null) {
            return papers;
        }

        var aresden = 0;
        var elvine = 0;
        string? first = null;
        foreach (var id in itemIds) {
            var faction = FactionOf(id);
            if (faction is null) {
                continue;
            }
            first ??= faction;
            if (faction == Aresden) {
                aresden++;
            } else {
                elvine++;
            }
        }
        if (aresden > elvine) {
            return Aresden;
        }
        if (elvine > aresden) {
            return Elvine;
        }
        return first;
    }

    /// <summary>Equip gate: city papers lock the kit; travelers lock to owned Hero majority / first piece.</summary>
    public static bool CanEquipOnKit(int itemId, string? citizenshipSide, IEnumerable<int> ownedItemIds) {
        var faction = FactionOf(itemId);
        if (faction is null) {
            return true;
        }
        var side = ResolveSide(citizenshipSide, ownedItemIds);
        return side is null || faction == side;
    }

    /// <summary>
    /// Rewrites bag + equipped city Hero ids on a persisted snapshot so arena stash / dual-write
    /// cannot restore a mixed Elvine+Aresden kit.
    /// </summary>
    public static PlayerPersistenceState RewritePersistence(PlayerPersistenceState state) {
        ArgumentNullException.ThrowIfNull(state);
        var ids = new List<int>();
        if (state.EquippedItems is { Length: > 0 }) {
            foreach (var row in state.EquippedItems) {
                if (row.Item.ItemId > 0) {
                    ids.Add(row.Item.ItemId);
                }
            }
        }
        if (state.BagItems is { Length: > 0 }) {
            foreach (var bag in state.BagItems) {
                if (bag.ItemId > 0) {
                    ids.Add(bag.ItemId);
                }
            }
        }

        var side = ResolveSide(state.CitizenshipSide, ids);
        if (side is null) {
            return state;
        }

        var bagItems = state.BagItems;
        if (bagItems is { Length: > 0 }) {
            var next = new PersistedInventoryItem[bagItems.Length];
            var changed = false;
            for (var i = 0; i < bagItems.Length; i++) {
                var id = ToSide(bagItems[i].ItemId, side);
                if (id != bagItems[i].ItemId) {
                    next[i] = bagItems[i] with { ItemId = id };
                    changed = true;
                } else {
                    next[i] = bagItems[i];
                }
            }
            if (changed) {
                bagItems = next;
            }
        }

        var equipped = state.EquippedItems;
        if (equipped is { Length: > 0 }) {
            var next = new PersistedEquippedInventoryItem[equipped.Length];
            var changed = false;
            for (var i = 0; i < equipped.Length; i++) {
                var id = ToSide(equipped[i].Item.ItemId, side);
                if (id != equipped[i].Item.ItemId) {
                    next[i] = equipped[i] with { Item = equipped[i].Item with { ItemId = id } };
                    changed = true;
                } else {
                    next[i] = equipped[i];
                }
            }
            if (changed) {
                equipped = next;
            }
        }

        if (ReferenceEquals(bagItems, state.BagItems) && ReferenceEquals(equipped, state.EquippedItems)) {
            return state;
        }
        return state with { BagItems = bagItems, EquippedItems = equipped };
    }
}
