using System.Text.Json;
using System.Text.Json.Serialization;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Applies an Arena Pre-Ready kit (starter + catalog) when entering a tournament arena world.
/// Validates kit JSON against <see cref="ArenaKitCatalog"/>; falls back is handled by caller.
/// </summary>
public static class ArenaLoadout {
    private static readonly JsonSerializerOptions JsonOptions = new() {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    private static ArenaKitCatalogConfig? catalog;
    private static Dictionary<string, ArenaCatalogSkuConfig>? skuById;
    private static readonly object Gate = new();

    public static void Configure(ArenaKitCatalogConfig config) {
        ArgumentNullException.ThrowIfNull(config);
        lock (Gate) {
            catalog = config;
            skuById = new Dictionary<string, ArenaCatalogSkuConfig>(StringComparer.OrdinalIgnoreCase);
            if (config.Catalog is not null) {
                foreach (var row in config.Catalog) {
                    if (!string.IsNullOrWhiteSpace(row.Sku)) {
                        skuById[row.Sku.Trim()] = row;
                    }
                }
            }
            Console.WriteLine(
                $"[ArenaLoadout] Catalog loaded: {skuById.Count} skus, starter credits {config.StarterCredits}, level {config.Level}.");
        }
    }

    public static bool IsConfigured {
        get {
            lock (Gate) {
                return catalog is not null;
            }
        }
    }

    /// <summary>
    /// Parses and validates kit JSON then applies stats / skills / gear to <paramref name="player"/>.
    /// Returns false when JSON is missing/invalid (caller should use Tournament.json fallback).
    /// </summary>
    public static bool TryApply(GameWorldPlayer player, string? kitJson, IReadOnlyDictionary<int, ItemConfig> itemsById) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(itemsById);

        ArenaKitCatalogConfig cat;
        Dictionary<string, ArenaCatalogSkuConfig> skus;
        lock (Gate) {
            if (catalog is null || skuById is null) {
                return false;
            }
            cat = catalog;
            skus = skuById;
        }

        if (string.IsNullOrWhiteSpace(kitJson)) {
            return false;
        }

        ArenaKitDto? kit;
        try {
            kit = JsonSerializer.Deserialize<ArenaKitDto>(kitJson, JsonOptions);
        } catch (Exception ex) {
            Console.WriteLine($"[ArenaLoadout] Kit JSON parse failed for '{player.CharacterName}': {ex.Message}");
            return false;
        }

        if (kit is null) {
            Console.WriteLine($"[ArenaLoadout] Kit rejected for '{player.CharacterName}': null kit.");
            return false;
        }
        if (!ValidateKit(kit, cat, skus, out var error)) {
            Console.WriteLine($"[ArenaLoadout] Kit rejected for '{player.CharacterName}': {error}");
            return false;
        }

        ApplyValidated(player, kit, cat, skus, itemsById);
        return true;
    }

    private static bool ValidateKit(
        ArenaKitDto kit,
        ArenaKitCatalogConfig cat,
        Dictionary<string, ArenaCatalogSkuConfig> skus,
        out string error) {
        error = "";
        var name = (kit.Name ?? "").Trim();
        if (name.Length < 2 || name.Length > 10) {
            error = "Name must be 2–10 characters.";
            return false;
        }

        var stats = kit.Stats ?? new ArenaKitStatsDto();
        var sum = stats.Str + stats.Vit + stats.Dex + stats.Int + stats.Mag + stats.Chr;
        var total = cat.StatTotalPoints > 0 ? cat.StatTotalPoints : 517;
        var min = cat.StatMinPer > 0 ? cat.StatMinPer : 10;
        if (sum != total) {
            error = $"Stats must total {total} (got {sum}).";
            return false;
        }
        if (stats.Str < min || stats.Vit < min || stats.Dex < min || stats.Int < min || stats.Mag < min || stats.Chr < min) {
            error = $"Each stat min {min}.";
            return false;
        }

        // Skills are optional: incomplete / unknown (e.g. skill 15 Physical Absorption) never reject the kit.
        // ApplyValidated will sanitize picks.

        var pots = kit.Potions ?? new ArenaPotionPickDto();
        var pool = cat.PotionPool > 0 ? cat.PotionPool : 30;
        if (pots.Red + pots.Blue + pots.GreenCandy != pool) {
            error = $"Potions must total {pool}.";
            return false;
        }

        var path = (kit.Path ?? "mage").Trim().ToLowerInvariant();
        if (path is not ("mage" or "war")) {
            error = "Path must be mage or war.";
            return false;
        }
        if (path == "mage") {
            var free = (kit.FreeMageSpell ?? "").Trim().ToLowerInvariant();
            if (free is not ("blizzard" or "esw")) {
                error = "Mages must pick free spell: blizzard or esw.";
                return false;
            }
        }

        var credits = cat.StarterCredits > 0 ? cat.StarterCredits : 1000;
        var spend = 0;
        foreach (var p in kit.CatalogPurchases ?? []) {
            if (string.IsNullOrWhiteSpace(p.Sku)) {
                continue;
            }
            // Legacy SKUs (set-hp50-war, etc.) are free bag now — skip, do not reject the kit.
            if (!skus.TryGetValue(p.Sku.Trim(), out var row)) {
                Console.WriteLine($"[ArenaLoadout] Ignoring unknown/removed catalog sku '{p.Sku}'.");
                continue;
            }
            var qty = Math.Max(1, p.Qty);
            spend += row.Cost * qty;
        }
        if (spend > credits) {
            error = $"Catalog over budget: {spend}/{credits}.";
            return false;
        }

        return true;
    }

    private static void ApplyValidated(
        GameWorldPlayer player,
        ArenaKitDto kit,
        ArenaKitCatalogConfig cat,
        Dictionary<string, ArenaCatalogSkuConfig> skus,
        IReadOnlyDictionary<int, ItemConfig> itemsById) {
        var level = cat.Level > 0 ? cat.Level : 150;
        var stats = kit.Stats ?? new ArenaKitStatsDto();
        player.ApplyArenaProfile(
            level,
            stats.Str,
            stats.Vit,
            stats.Dex,
            stats.Int,
            stats.Mag,
            stats.Chr);

        // Skills: optional picks — sanitize allowlist + overlaps (100% wins). Incomplete is fine.
        var allowed = cat.PvpSkillIds is { Length: > 0 }
            ? cat.PvpSkillIds.ToHashSet()
            : new HashSet<int> { 4, 6, 9, 10, 11, 12, 13, 14, 16, 17, 18 };
        var pick100 = cat.SkillsPick100 > 0 ? cat.SkillsPick100 : 4;
        var pick50 = cat.SkillsPick50 > 0 ? cat.SkillsPick50 : 4;
        for (var i = 0; i < Skills.SkillCount; i++) {
            player.SetSkillLevel(i, 0);
        }
        var used = new HashSet<int>();
        var n100 = 0;
        foreach (var id in kit.Skills100 ?? []) {
            if (!allowed.Contains(id) || !used.Add(id) || n100 >= pick100) {
                continue; // strip skill 15 Physical Absorption etc. silently
            }
            player.SetSkillLevel(id, 100);
            n100++;
        }
        var n50 = 0;
        foreach (var id in kit.Skills50 ?? []) {
            if (!allowed.Contains(id) || !used.Add(id) || n50 >= pick50) {
                continue;
            }
            player.SetSkillLevel(id, 50);
            n50++;
        }

        // Appearance from kit when provided.
        var gender = string.Equals(kit.Gender, "female", StringComparison.OrdinalIgnoreCase) ? 1 : 0;
        player.SetAppearance(
            gender,
            Math.Clamp(kit.SkinColor, 0, 2),
            Math.Clamp(kit.HairStyleIndex, 0, 7),
            Math.Clamp(kit.UnderwearColorIndex, 0, 7));

        // Crit regen: 5 / 30s / cap 15 in arena.
        var crit = cat.CritRegen;
        var charges = crit?.ChargesPerTick > 0 ? crit.ChargesPerTick : 5;
        var intervalMs = crit?.IntervalMs > 0 ? crit.IntervalMs : 30_000;
        var maxCharges = crit?.MaxCharges > 0 ? crit.MaxCharges : 15;
        player.EnableArenaCritRegen(charges, intervalMs / 1000, maxCharges);

        // Combat book for arena — NOT free Inhib/Cancel/Sleep (those need kit credit uses).
        var path = (kit.Path ?? "mage").Trim().ToLowerInvariant();
        player.ClearArenaPerUseSpellCharges();
        GrantFullArenaSpellBook(player);
        if (path == "mage") {
            var free = (kit.FreeMageSpell ?? "blizzard").Trim().ToLowerInvariant();
            // Olympia Magic.cfg ids: Blizzard 91, Energy Strike 60 (Mass Blizzard 97 stays free for now).
            player.LearnOlympiaSpell(free == "esw" ? 60 : 91);
        }

        // Build inventory: starter gear + catalog + potions + free bag items.
        var equipped = new Dictionary<string, InventoryItemState>(StringComparer.OrdinalIgnoreCase);
        var bag = new List<InventoryItemState>();
        long NextUid() => player.InventoryManager.CreateItemUidPublic();

        void PutEquipped(int itemId, string slot, uint attr = 0, int maxLife = 0, int cicLevel = 0, int cicKind = 0, int cicVal = 0) {
            if (itemId == 400 || !itemsById.TryGetValue(itemId, out var def)) {
                return; // never equip plain Cape
            }
            var type = string.IsNullOrWhiteSpace(slot) ? def.ItemType : slot;
            // Map jewelry slots.
            if (type is "ring") {
                type = equipped.ContainsKey("ring-left") ? "ring-right" : "ring-left";
            }
            if (type is "accessory" or "necklace") {
                // keep as-is
            }
            var item = new InventoryItemState(
                itemId,
                NextUid(),
                bagX: null,
                bagY: null,
                quantity: 1,
                bagZIndex: 0,
                effectOverrides: null,
                itemAttribute: attr,
                maxLifeSpan: maxLife,
                curLifeSpan: maxLife > 0 ? maxLife : 0,
                cicLevel: cicLevel,
                cicStatKind: cicKind,
                cicStatValue: cicVal);
            item.EnsureCatalogDurability(def);
            if (maxLife > 0) {
                item.MaxLifeSpan = maxLife;
                item.CurLifeSpan = maxLife;
            }
            equipped[type] = item;
        }

        void PutBag(int itemId, int qty, uint attr = 0, int maxLife = 0) {
            // Hard ban plain Cape (400) with or without magic — arena uses 402 + attrs only.
            if (qty < 1 || itemId == 400 || !itemsById.TryGetValue(itemId, out var def)) {
                return;
            }
            if (itemId == 402 && attr == 0) {
                // Never put a bare "Cape" lookalike with zero magic either.
                return;
            }
            var (bx, by) = player.InventoryManager.AllocateBagSlotPublic(bag.Count);
            var item = new InventoryItemState(
                itemId,
                NextUid(),
                bx,
                by,
                quantity: qty,
                bagZIndex: bag.Count,
                effectOverrides: null,
                itemAttribute: attr,
                maxLifeSpan: maxLife,
                curLifeSpan: maxLife > 0 ? maxLife : 0);
            item.EnsureCatalogDurability(def);
            if (maxLife > 0) {
                item.MaxLifeSpan = maxLife;
                item.CurLifeSpan = maxLife;
            }
            bag.Add(item);
        }

        // —— Starter Hero set (full 5-piece). Equip only — no bag copies (avoids duplicate clutter).
        EquipPathHeroSetForced(path, gender, PutEquipped);
        var hero = ResolveHeroSet(cat.Starter, path, gender);
        if (hero is not null) {
            foreach (var piece in hero) {
                if (piece.ItemId <= 0) {
                    continue;
                }
                if (path == "mage" && IsWarHeroCorePiece(piece.ItemId)) {
                    continue;
                }
                if (path == "war" && IsMageHeroCorePiece(piece.ItemId)) {
                    continue;
                }
                PutEquipped(piece.ItemId, piece.Slot ?? "");
            }
        }
        EquipPathHeroSetForced(path, gender, PutEquipped);
        if (cat.Starter?.FixedEquipped is not null) {
            foreach (var fx in cat.Starter.FixedEquipped) {
                if (fx.ItemId <= 0) {
                    continue;
                }
                var maxLife = fx.MaxLifeSpan ?? 0;
                PutEquipped(fx.ItemId, fx.Slot ?? "", attr: 0, maxLife: maxLife);
            }
        }
        EnsureHeroHauberkEquipped(path, gender, PutEquipped);

        // Free stat capes only — never grant a plain “Cape” (item 400) with no magic.
        // CIC+7 may also carry HP Recovery 50%. Second free cape: MC + MP Recovery 50%.
        if (cat.Starter?.FreeCapesInBag is not null) {
            foreach (var cape in cat.Starter.FreeCapesInBag) {
                if (cape.ItemId <= 0 || cape.ItemId == 400) {
                    continue; // never plain Cape
                }
                var cic = Math.Clamp(cape.CriticalIncrease, 0, 15);
                var hasMc = cape.ManaConvertPct > 0;
                var hasHp = cape.HpRegenPct > 0;
                var hasMp = cape.MpRegenPct > 0;
                if (cic <= 0 && !hasMc && !hasHp && !hasMp) {
                    continue;
                }

                int pType;
                int pVal;
                int sType;
                int sVal;
                if (cic > 0) {
                    // Armor Charge Critical (type 12) — total CIC soft-cap 20.
                    // Secondary HP Recovery 50% when configured (nibble 7 → ~49%).
                    pType = 12;
                    pVal = cic;
                    sType = hasHp ? ItemMagicAttribute.S_HpRegen : 0;
                    sVal = sType > 0 ? 7 : 0;
                } else {
                    // MC primary (soft-cap 13 in calc) + optional MP regen secondary 7 (~49%).
                    pType = hasMc ? ItemMagicAttribute.P_ManaConverting : 0;
                    pVal = hasMc ? Math.Clamp(cape.ManaConvertPct > 13 ? 13 : Math.Max(1, cape.ManaConvertPct / 1), 1, 13) : 0;
                    if (hasMc && cape.ManaConvertPct >= 15) {
                        pVal = 13; // Olympia MC equip soft-cap; labeled MCon15 product
                    } else if (hasMc && cape.ManaConvertPct > 0) {
                        pVal = Math.Clamp(cape.ManaConvertPct, 1, 13);
                    }
                    sType = hasMp ? ItemMagicAttribute.S_MpRegen : hasHp ? ItemMagicAttribute.S_HpRegen : 0;
                    sVal = sType > 0 ? 7 : 0;
                }
                if (pType == 0 && sType == 0) {
                    continue;
                }
                var attr = Enchanting.Encode(pType, pVal, sType, sVal, 0);
                if (attr == 0) {
                    continue;
                }
                PutBag(cape.ItemId, 1, attr);
            }
        }

        // Free HP50 + MP50 armor for THIS path only (mage ≠ war pieces). No cross-path clutter.
        GrantFreeArmorSetsInBag(
            cat.Starter?.FreeArmorInBag,
            path,
            gender,
            itemsById,
            PutBag);

        // Angelics +15 (upgrade nibble 14 → bonus 15).
        if (cat.Starter?.AngelsInBag is not null) {
            foreach (var angel in cat.Starter.AngelsInBag) {
                if (angel.ItemId <= 0) {
                    continue;
                }
                var plus = angel.MajesticPlus > 0 ? angel.MajesticPlus : 15;
                // bonus = upgrade + 1 → upgrade = plus - 1
                var attr = MajesticUpgrade.SetUpgradeLevel(0, Math.Max(0, plus - 1));
                PutBag(angel.ItemId, 1, attr);
            }
        }

        // Potions from kit pick.
        var potChoices = cat.Starter?.PotionChoices;
        int RedId() => potChoices?.FirstOrDefault(p => p.Sku == "big-red")?.ItemId ?? 92;
        int BlueId() => potChoices?.FirstOrDefault(p => p.Sku == "big-blue")?.ItemId ?? 94;
        int CandyId() => potChoices?.FirstOrDefault(p => p.Sku == "green-candy")?.ItemId ?? 782;
        var pots = kit.Potions ?? new ArenaPotionPickDto();
        if (pots.Red > 0) {
            PutBag(RedId(), pots.Red);
        }
        if (pots.Blue > 0) {
            PutBag(BlueId(), pots.Blue);
        }
        if (pots.GreenCandy > 0) {
            PutBag(CandyId(), pots.GreenCandy);
        }

        // Expand catalog purchases (bundles → pieces).
        var expanded = ExpandPurchases(kit.CatalogPurchases ?? [], skus);
        var merienSaDuration = 0;
        var merienSaCooldown = 0;

        foreach (var (sku, qty) in expanded) {
            if (!skus.TryGetValue(sku, out var row)) {
                continue;
            }

            // Per-use spells: credit charges for this arena entry (Inhib / Cancel / Sleep).
            if (row.PerUse == true && !string.IsNullOrWhiteSpace(row.SpellName)) {
                if (TryMapArenaPerUseSpell(row.SpellName!, out var olympiaId, out var serverSpellId)) {
                    var uses = Math.Max(1, qty);
                    if (olympiaId >= 0) {
                        player.LearnOlympiaSpell(olympiaId);
                    }
                    player.AddArenaPerUseSpellCharges(serverSpellId, uses);
                    Console.WriteLine(
                        $"[ArenaLoadout] Credit spell '{row.SpellName}' serverId={serverSpellId} +{uses} use(s) for '{player.CharacterName}'.");
                }
                continue;
            }

            if (row.ItemId is not int itemId || itemId <= 0) {
                // Constructed armor pieces without base id — go to BAG (never auto-overwrite equip).
                ApplyConstructedArmorToBag(gender, sku, itemsById, PutBag);
                continue;
            }
            if (itemId == 400) {
                // Never grant plain Cape — skip even if a bad catalog row sneaks in.
                continue;
            }

            var attr = BuildCatalogAttr(row);
            var isWeapon = string.Equals(itemsById.GetValueOrDefault(itemId)?.ItemType, "weapon", StringComparison.OrdinalIgnoreCase);
            var isShield = string.Equals(itemsById.GetValueOrDefault(itemId)?.ItemType, "shield", StringComparison.OrdinalIgnoreCase);
            var isRing = string.Equals(itemsById.GetValueOrDefault(itemId)?.ItemType, "ring", StringComparison.OrdinalIgnoreCase);

            if (row.SaDurationMs is int saDur && saDur > 0) {
                merienSaDuration = Math.Max(merienSaDuration, saDur / 1000);
            }
            if (row.SaCooldownMs is int saCd && saCd > 0) {
                merienSaCooldown = Math.Max(merienSaCooldown, saCd / 1000);
            }

            for (var i = 0; i < qty; i++) {
                if (isWeapon || isShield || isRing) {
                    // Equip first weapon/shield/ring; extras go bag.
                    var slot = isWeapon ? "weapon" : isShield ? "shield" : "ring";
                    if (isWeapon && !equipped.ContainsKey("weapon")) {
                        PutEquipped(itemId, "weapon", attr);
                    } else if (isShield && !equipped.ContainsKey("shield")) {
                        PutEquipped(itemId, "shield", attr);
                    } else if (isRing) {
                        if (!equipped.ContainsKey("ring-left")) {
                            PutEquipped(itemId, "ring-left", attr);
                        } else if (!equipped.ContainsKey("ring-right")) {
                            PutEquipped(itemId, "ring-right", attr);
                        } else {
                            PutBag(itemId, 1, attr);
                        }
                    } else {
                        PutBag(itemId, 1, attr);
                    }
                } else if (row.Stackable == true) {
                    PutBag(itemId, Math.Max(1, qty));
                    break; // already added full qty
                } else {
                    PutBag(itemId, 1, attr);
                }
            }
        }

        if (merienSaDuration > 0 || merienSaCooldown > 0) {
            player.SetArenaSpecialAbilityTiming(
                durationSec: merienSaDuration > 0 ? merienSaDuration : 20,
                cooldownSec: merienSaCooldown > 0 ? merienSaCooldown : 300);
        }

        player.InventoryManager.ReplaceEquippedAndBag(equipped, bag);
        player.RecalcOlympiaVitalsWithAngelic(fillIncreasedPools: true);
        // Olympia full Hero set bonus (war HR/AP, mage +dmg) — requires helm+body+hauberk+legs.
        var heroBonus = HeroSetBonus.Recompute(player);
        // Full-speed cast when Magic skill 100% or Mag ≥ 50 (authoritative).
        PlayerDerivedStats.ApplyAuthoritativeCastSpeed(player);
        // SA recompute is done by caller with a real GameWorldRef after entry.

        var helmId = equipped.TryGetValue("helmet", out var helmEq) ? helmEq.ItemId : 0;
        var armorId = equipped.TryGetValue("armor", out var armEq) ? armEq.ItemId : 0;
        var hauberkId = equipped.TryGetValue("hauberk", out var hauEq) ? hauEq.ItemId : 0;
        Console.WriteLine(
            $"[ArenaLoadout] Applied kit '{kit.Name}' path={path} to '{player.CharacterName}' " +
            $"(lvl {level}, {equipped.Count} eq, {bag.Count} bag, heroSet={heroBonus}, " +
            $"helm={helmId}, armor={armorId}, hauberk={hauberkId}).");
    }

    /// <summary>Mage: Cap+Robe+Hauberk+Legs+Boots. War: Helm+Armor+Hauberk+Legs+Boots.</summary>
    private static void EquipPathHeroSetForced(
        string path,
        int gender,
        Action<int, string, uint, int, int, int, int> putEquipped) {
        foreach (var (id, slot) in PathHeroPieces(path, gender)) {
            putEquipped(id, slot, 0, 0, 0, 0, 0);
        }
    }

    private static void EnsureHeroHauberkEquipped(
        string path,
        int gender,
        Action<int, string, uint, int, int, int, int> putEquipped) {
        var isFemale = gender == 1;
        var hauberkId = isFemale ? 420 : 419; // a Hero Hauberk W/M
        putEquipped(hauberkId, "hauberk", 0, 0, 0, 0, 0);
        // Mage also re-force robe on body slot so it is never left empty after bag swaps.
        if (path == "mage") {
            putEquipped(isFemale ? 416 : 415, "armor", 0, 0, 0, 0, 0);
        }
    }

    private static (int Id, string Slot)[] PathHeroPieces(string path, int gender) {
        var isFemale = gender == 1;
        var isMage = path == "mage";
        return isMage
            ? isFemale
                ? [(408, "helmet"), (416, "armor"), (420, "hauberk"), (424, "leggings"), (451, "boots")]
                : [(407, "helmet"), (415, "armor"), (419, "hauberk"), (423, "leggings"), (451, "boots")]
            : isFemale
                ? [(404, "helmet"), (412, "armor"), (420, "hauberk"), (424, "leggings"), (451, "boots")]
                : [(403, "helmet"), (411, "armor"), (419, "hauberk"), (423, "leggings"), (451, "boots")];
    }

    private static bool IsWarHeroCorePiece(int itemId) =>
        itemId is 403 or 404 or 405 or 406 or 411 or 412 or 413 or 414;

    private static bool IsMageHeroCorePiece(int itemId) =>
        itemId is 407 or 408 or 409 or 410 or 415 or 416 or 417 or 418;

    /// <summary>
    /// Dual-magic armor attr so client tooltips show magic (primary Endurance + secondary DR/HP/MP/MR).
    /// Secondary-only (pType=0) was invisible in bag hover → “ropa normal de blacksmith”.
    /// </summary>
    private static uint EncodeArmorMagicSecondary(int secondaryType, int secondaryNibble = 7) {
        // Primary Endurance (type 8) value 1 — valid on defense gear; secondary fragment = power.
        return Enchanting.Encode(
            ItemMagicAttribute.P_SharpOrEndurance,
            1,
            secondaryType,
            Math.Clamp(secondaryNibble, 1, 13),
            0);
    }

    private static List<(string Sku, int Qty)> ExpandPurchases(
        IEnumerable<ArenaCatalogPurchaseDto> purchases,
        Dictionary<string, ArenaCatalogSkuConfig> skus) {
        var list = new List<(string, int)>();
        foreach (var p in purchases) {
            if (string.IsNullOrWhiteSpace(p.Sku) || !skus.TryGetValue(p.Sku.Trim(), out var row)) {
                continue;
            }
            var qty = Math.Max(1, p.Qty);
            if (row.BundleSkus is { Length: > 0 }) {
                foreach (var child in row.BundleSkus) {
                    if (!string.IsNullOrWhiteSpace(child)) {
                        list.Add((child.Trim(), qty));
                    }
                }
            } else {
                list.Add((row.Sku, qty));
            }
        }
        return list;
    }

    private static uint BuildCatalogAttr(ArenaCatalogSkuConfig row) {
        var plus = row.Plus ?? 0;
        // Default: upgrade nibble only. Specific skus add HR / magic attrs.
        var attr = MajesticUpgrade.SetUpgradeLevel(0, Math.Clamp(plus, 0, 15));
        var sku = (row.Sku ?? "").Trim().ToLowerInvariant();
        if (sku == "wand-ms22-cp40-hr91-p5") {
            // Casting Prob primary (flat +14 hit), Hit Prob secondary ~91 (13*7), +5 upgrade.
            attr = Enchanting.Encode(ItemMagicAttribute.P_CastingProb, 1, ItemMagicAttribute.S_HitProb, 13, 5);
        } else if (sku == "blood-rapier-p7") {
            attr = Enchanting.Encode(ItemMagicAttribute.P_SharpOrEndurance, 2, ItemMagicAttribute.S_HitProb, 10, 7);
        } else if (sku == "cape-mcon15-dr70") {
            // MCon soft-cap 13 in equip calc; DR secondary nibble 10 → 70%.
            attr = Enchanting.Encode(ItemMagicAttribute.P_ManaConverting, 13, ItemMagicAttribute.S_DefenseRatio, 10, 0);
        } else if (sku == "cape-mcon15-mr70") {
            attr = Enchanting.Encode(ItemMagicAttribute.P_ManaConverting, 13, ItemMagicAttribute.S_MagicResist, 10, 0);
        } else if (sku.StartsWith("piece-dr50-", StringComparison.Ordinal)) {
            attr = EncodeArmorMagicSecondary(ItemMagicAttribute.S_DefenseRatio, 7);
        } else if (sku.StartsWith("piece-mr50-", StringComparison.Ordinal)) {
            attr = EncodeArmorMagicSecondary(ItemMagicAttribute.S_MagicResist, 7);
        } else if (plus > 0) {
            attr = MajesticUpgrade.SetUpgradeLevel(0, plus);
        }
        return attr;
    }

    /// <summary>
    /// Free HP50 + MP50 armor for the kit path only (mage ≠ war).
    /// Mage: Hat/Chain/Hauberk/PlateLegs. War: Wings/Plate/Hauberk/PlateLegs.
    /// </summary>
    private static void GrantFreeArmorSetsInBag(
        ArenaFreeArmorSetConfig[]? sets,
        string path,
        int gender,
        IReadOnlyDictionary<int, ItemConfig> itemsById,
        Action<int, int, uint, int> putBag) {
        var isMage = path == "mage";
        // Prefer catalog rows filtered by path; fallback to hardcoded path sets.
        var filtered = (sets ?? Array.Empty<ArenaFreeArmorSetConfig>())
            .Where(s => {
                var id = (s.Id ?? "").Trim().ToLowerInvariant();
                if (id.Length == 0) {
                    return false;
                }
                if (isMage) {
                    return id.StartsWith("mage-", StringComparison.Ordinal);
                }
                return id.StartsWith("war-", StringComparison.Ordinal);
            })
            .ToArray();
        if (filtered.Length == 0) {
            filtered = DefaultFreeArmorSetsForPath(path);
        }

        var isFemale = gender == 1;
        var grantedKeys = new HashSet<string>(StringComparer.Ordinal); // dedupe itemId+magic
        foreach (var set in filtered) {
            if (set.Pieces is null || set.Pieces.Length == 0) {
                continue;
            }
            var magic = (set.Magic ?? "").Trim().ToLowerInvariant();
            int sType = magic switch {
                "mp50" or "mp" => ItemMagicAttribute.S_MpRegen,
                "hp50" or "hp" => ItemMagicAttribute.S_HpRegen,
                _ => ItemMagicAttribute.S_HpRegen,
            };
            var attr = EncodeArmorMagicSecondary(sType, 7);
            if (attr == 0) {
                continue;
            }
            foreach (var piece in set.Pieces) {
                var itemId = isFemale
                    ? (piece.ItemIdFemale > 0 ? piece.ItemIdFemale : piece.ItemIdMale)
                    : (piece.ItemIdMale > 0 ? piece.ItemIdMale : piece.ItemIdFemale);
                if (itemId <= 0 || itemId == 400) {
                    continue;
                }
                if (!itemsById.ContainsKey(itemId)) {
                    continue;
                }
                var key = $"{itemId}:{sType}";
                if (!grantedKeys.Add(key)) {
                    continue; // no duplicate same piece+magic
                }
                putBag(itemId, 1, attr, 0);
            }
        }
    }

    private static ArenaFreeArmorSetConfig[] DefaultFreeArmorSetsForPath(string path) {
        if (path == "mage") {
            return
            [
                new ArenaFreeArmorSetConfig("mage-hp50", "Mage HP50", "hp50", [
                    new ArenaFreeArmorPieceConfig("helmet", 753, 757),
                    new ArenaFreeArmorPieceConfig("armor", 456, 476),
                    new ArenaFreeArmorPieceConfig("hauberk", 454, 472),
                    new ArenaFreeArmorPieceConfig("leggings", 462, 483),
                ]),
                new ArenaFreeArmorSetConfig("mage-mp50", "Mage MP50", "mp50", [
                    new ArenaFreeArmorPieceConfig("helmet", 753, 757),
                    new ArenaFreeArmorPieceConfig("armor", 456, 476),
                    new ArenaFreeArmorPieceConfig("hauberk", 454, 472),
                    new ArenaFreeArmorPieceConfig("leggings", 462, 483),
                ]),
            ];
        }
        return
        [
            new ArenaFreeArmorSetConfig("war-hp50", "War HP50", "hp50", [
                new ArenaFreeArmorPieceConfig("helmet", 751, 755),
                new ArenaFreeArmorPieceConfig("armor", 458, 478),
                new ArenaFreeArmorPieceConfig("hauberk", 454, 472),
                new ArenaFreeArmorPieceConfig("leggings", 462, 483),
            ]),
            new ArenaFreeArmorSetConfig("war-mp50", "War MP50", "mp50", [
                new ArenaFreeArmorPieceConfig("helmet", 751, 755),
                new ArenaFreeArmorPieceConfig("armor", 458, 478),
                new ArenaFreeArmorPieceConfig("hauberk", 454, 472),
                new ArenaFreeArmorPieceConfig("leggings", 462, 483),
            ]),
        ];
    }

    /// <summary>
    /// Catalog DR/MR pieces → bag with correct base items (Hat/Chain/Wings/Plate…) and ~50% magic.
    /// HP/MP sets are free (not sold). Capes use explicit sku attrs via itemId path.
    /// </summary>
    private static void ApplyConstructedArmorToBag(
        int gender,
        string sku,
        IReadOnlyDictionary<int, ItemConfig> itemsById,
        Action<int, int, uint, int> putBag) {
        // Map piece skus → base item + secondary magic ~50% (nibble 7 → 49%).
        // NEVER item 400 plain Cape.
        int sType;
        int itemId;
        switch (sku.ToLowerInvariant()) {
            case "piece-dr50-hat":
                sType = ItemMagicAttribute.S_DefenseRatio;
                itemId = gender == 1 ? 757 : 753; // Wizard-Hat
                break;
            case "piece-dr50-chain":
                sType = ItemMagicAttribute.S_DefenseRatio;
                itemId = gender == 1 ? 476 : 456; // Chain Mail
                break;
            case "piece-dr50-hauberk":
                sType = ItemMagicAttribute.S_DefenseRatio;
                itemId = gender == 1 ? 472 : 454;
                break;
            case "piece-dr50-legs":
                sType = ItemMagicAttribute.S_DefenseRatio;
                itemId = gender == 1 ? 483 : 462;
                break;
            case "piece-mr50-wings":
                sType = ItemMagicAttribute.S_MagicResist;
                itemId = gender == 1 ? 755 : 751; // Wings-Helm
                break;
            case "piece-mr50-plate":
                sType = ItemMagicAttribute.S_MagicResist;
                itemId = gender == 1 ? 478 : 458; // Plate Mail
                break;
            case "piece-mr50-hauberk":
                sType = ItemMagicAttribute.S_MagicResist;
                itemId = gender == 1 ? 472 : 454;
                break;
            case "piece-mr50-legs":
                sType = ItemMagicAttribute.S_MagicResist;
                itemId = gender == 1 ? 483 : 462;
                break;
            // Legacy HP skus removed from shop — if old kits still list them, grant nothing (free sets cover this).
            case "piece-hp50":
            case "set-hp50-war":
            case "set-hp50-mage":
                return;
            default:
                return;
        }

        if (itemId <= 0 || itemId == 400 || !itemsById.ContainsKey(itemId)) {
            return;
        }
        // Dual magic so pieces are NOT plain blacksmith clothes in tooltip/name.
        // DR50 / MR50 → secondary nibble 7 ≈ 49%.
        var attr = EncodeArmorMagicSecondary(sType, 7);
        if (attr == 0) {
            return;
        }
        putBag(itemId, 1, attr, 0);
    }

    private static ArenaStarterEquipConfig[]? ResolveHeroSet(ArenaStarterConfig? starter, string path, int gender) {
        if (starter is null) {
            return null;
        }
        var isMage = path == "mage";
        var isFemale = gender == 1;
        if (isMage) {
            return (isFemale ? starter.HeroSetMageFemale : starter.HeroSetMageMale)
                ?? (isFemale ? starter.HeroSetFemale : starter.HeroSetMale);
        }
        return (isFemale ? starter.HeroSetWarFemale : starter.HeroSetWarMale)
            ?? (isFemale ? starter.HeroSetFemale : starter.HeroSetMale);
    }

    /// <summary>
    /// Map kit catalog spell name → Olympia Magic.cfg id (for learn book) + Spells.json server id (for cast gate).
    /// Olympia: Cancellation 76 → server 45, Inhibition 83 → server 46. Sleep is server-only id 52.
    /// </summary>
    private static bool TryMapArenaPerUseSpell(string spellName, out int olympiaId, out int serverSpellId) {
        olympiaId = -1;
        serverSpellId = -1;
        var key = spellName.Trim().ToLowerInvariant();
        switch (key) {
            case "inhibition casting":
            case "inhibition":
                olympiaId = 83;
                serverSpellId = 46;
                return true;
            case "cancellation":
            case "cancel":
                olympiaId = 76;
                serverSpellId = 45;
                return true;
            case "sleep":
                // Spells.json id 52 — no Magic.cfg learn id required for arena charge gate.
                olympiaId = -1;
                serverSpellId = 52;
                return true;
            case "blizzard":
                olympiaId = 91;
                serverSpellId = 21;
                return true;
            case "energy strike":
            case "energy strike wave":
            case "esw":
                olympiaId = 60;
                serverSpellId = 11;
                return true;
            default:
                return false;
        }
    }

    /// <summary>
    /// Arena combat book: all mapped combat spells EXCEPT credit-gated utility
    /// (Cancellation olympia 76, Inhibition 83). Those only unlock when kit buys uses.
    /// </summary>
    public static void GrantFullArenaSpellBook(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        foreach (var olympiaId in MagicTower.OlympiaToServerSpellId.Keys) {
            // Credit-gated: never free-learn in arena.
            if (olympiaId is 76 or 83) {
                continue;
            }
            player.LearnOlympiaSpell(olympiaId);
        }
    }

    /// <summary>
    /// When kit JSON is missing/invalid, still try to read path so Tournament fallback can equip mage Cap/Robe + wand
    /// instead of war Hero Helm + Long Sword (blocks cast → Blizzard "no me pego").
    /// </summary>
    public static string? TryPeekPath(string? kitJson) {
        if (string.IsNullOrWhiteSpace(kitJson)) {
            return null;
        }

        try {
            using var doc = JsonDocument.Parse(kitJson);
            if (doc.RootElement.TryGetProperty("path", out var pathEl) ||
                doc.RootElement.TryGetProperty("Path", out pathEl)) {
                var p = pathEl.GetString()?.Trim().ToLowerInvariant();
                if (p is "mage" or "war") {
                    return p;
                }
            }
        } catch {
            // ignore — caller uses war-safe defaults
        }

        return null;
    }

    /// <summary>
    /// Mage-safe equal-footing ids when kit fails but player is path=mage (or unknown prefers cast-safe).
    /// War path keeps Tournament.json war set (Hero Helm + Long Sword).
    /// </summary>
    public static IReadOnlyList<int> BuildFallbackEquippedIds(string? path, int genderValue, TournamentLoadoutConfig? loadout) {
        var isFemale = genderValue == 1;
        if (string.Equals(path, "mage", StringComparison.OrdinalIgnoreCase)) {
            // Cap + Robe + hauberk/legs/boots + Magic Wand(M.Shield) — NO plain cape (400).
            return isFemale
                ? new[] { 259, 416, 408, 420, 424, 451 } // wand, robe(W), cap(W), hauberk, legs, boots
                : new[] { 259, 415, 407, 419, 423, 451 };
        }

        // War / unknown: honor Tournament.json when present (filter plain cape).
        if (loadout?.Equipped is { Length: > 0 }) {
            var list = new List<int>(loadout.Equipped.Length);
            foreach (var entry in loadout.Equipped) {
                var itemId = entry.Any ?? (genderValue == 0 ? entry.Male : entry.Female);
                if (itemId.HasValue && itemId.Value != 400) {
                    list.Add(itemId.Value);
                }
            }
            if (list.Count > 0) {
                return list;
            }
        }

        // Last-ditch war set — no plain cape.
        return isFemale
            ? new[] { 19, 87, 412, 404, 420, 424, 451 }
            : new[] { 19, 87, 411, 403, 419, 423, 451 };
    }

    // —— DTOs matching client arenaKits.ts / ArenaKitCatalog.json ——

    private sealed class ArenaKitDto {
        public string? Id { get; set; }
        public string? Name { get; set; }
        public string? Path { get; set; }
        public string? Gender { get; set; }
        public int HairStyleIndex { get; set; }
        public int UnderwearColorIndex { get; set; }
        public int SkinColor { get; set; }
        public ArenaKitStatsDto? Stats { get; set; }
        public int[]? Skills100 { get; set; }
        public int[]? Skills50 { get; set; }
        public string? FreeMageSpell { get; set; }
        public ArenaPotionPickDto? Potions { get; set; }
        public ArenaCatalogPurchaseDto[]? CatalogPurchases { get; set; }
    }

    private sealed class ArenaKitStatsDto {
        public int Str { get; set; } = 10;
        public int Vit { get; set; } = 10;
        public int Dex { get; set; } = 10;
        public int Int { get; set; } = 10;
        public int Mag { get; set; } = 10;
        public int Chr { get; set; } = 10;
    }

    private sealed class ArenaPotionPickDto {
        public int Red { get; set; }
        public int Blue { get; set; }
        public int GreenCandy { get; set; }
    }

    private sealed class ArenaCatalogPurchaseDto {
        public string? Sku { get; set; }
        public int Qty { get; set; } = 1;
    }
}
