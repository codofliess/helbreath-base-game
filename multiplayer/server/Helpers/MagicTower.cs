using System.Collections.Generic;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Gandalf / Magic Tower: proximity-checked classic spell purchases (gold from bag).
/// Client sends <see cref="CityNpcServiceRequest"/> with action <c>open</c> or <c>buy_spell</c>
/// (spell id in <c>donate_gold</c> = Olympia Magic.cfg id).
/// </summary>
public static class MagicTower {
    public const int GandalfCatalogNpcId = 1;
    /// <summary>Chebyshev cells — slightly looser than shop so buy works while the dialog is open.</summary>
    public const int MaxInteractDistance = 4;

    /// <summary>
    /// Olympia Magic.cfg id → gold cost (classic Magic Tower). Subset of full roster sold at the tower.
    /// </summary>
    public static readonly IReadOnlyDictionary<int, int> SpellGoldPrices = new Dictionary<int, int> {
        [0] = 100,   // Magic Missile
        [1] = 100,   // Heal
        [2] = 100,   // Create Food
        [10] = 200,  // Energy Bolt
        [11] = 200,  // Stamina Drain
        [12] = 120,  // Recall
        [13] = 200,  // Defense Shield
        [14] = 400,  // Celebrating Light
        [20] = 500,  // Fire Ball
        [21] = 500,  // Great Heal
        [23] = 300,  // Stamina Recovery
        [24] = 300,  // Protection From Arrow
        [25] = 500,  // Hold Person
        [26] = 500,  // Possession
        [27] = 700,  // Poison
        [28] = 800,  // Great Stamina Recovery
        [30] = 1000, // Fire Strike
        [31] = 1000, // Summon Creature
        [32] = 800,  // Invisibility
        [33] = 850,  // Protection From Magic
        [34] = 700,  // Detect Invisibility
        [35] = 1000, // Paralyze
        [36] = 700,  // Cure
        [37] = 1100, // Lightning Arrow
        [38] = 1000, // Tremor
        [40] = 1200, // Fire Wall
        [41] = 1400, // Fire Field
        [42] = 1300, // Confuse Language
        [43] = 1700, // Lightning
        [44] = 1500, // Great Defense Shield
        [45] = 2000, // Chill Wind
        [46] = 1800, // Poison Cloud
        [47] = 1700, // Triple Energy Bolt
        [50] = 2200, // Berserk
        [51] = 2500, // Lightning Bolt
        [53] = 2100,
        [54] = 2300,
        [55] = 2500,
        [56] = 3000,
        [57] = 4200,
        [60] = 5000,
        [61] = 6000,
        [62] = 7500,
        [63] = 9800,
        [64] = 12000,
        [65] = 13500,
        [66] = 20000,
        [67] = 7500,
        [70] = 8000,
        [71] = 15000,
        [72] = 21000,
        [73] = 20000,
        [74] = 35000,
        [76] = 50000,
        [77] = 27000,
        [78] = 30000,
        [80] = 27000,
        [81] = 40000,
        [82] = 45000,
        [83] = 50000,
        [90] = 35000,
        [91] = 43000,
        [94] = 60000,
        [95] = 27000,
        [96] = 55000,
        [97] = 60000,
    };

    /// <summary>
    /// Olympia Magic.cfg id → multiplayer Spells.json catalog id (combat-authoritative set).
    /// Must stay aligned with client <c>OlympiaServerSpellMap.ts</c>. Missing entries take gold on Learn
    /// but never unlock cast (e.g. Energy Strike 60 → 11 was absent → 5000 gold + uncastable + book wipe on resync).
    /// </summary>
    public static readonly IReadOnlyDictionary<int, int> OlympiaToServerSpellId = new Dictionary<int, int> {
        [10] = 0,  // Energy Bolt
        [20] = 1,  // Fire Ball
        [30] = 2,  // Fire Strike
        [45] = 3,  // Chill Wind
        [46] = 4,  // Poison Cloud
        [47] = 5,  // Triple Energy Bolt
        [51] = 6,  // Lightning Bolt
        [54] = 7,  // Spike Field
        [41] = 8,  // Fire Field
        [55] = 9,  // Ice Storm
        [57] = 10, // Ice Strike
        [60] = 11, // Energy Strike
        [61] = 12, // Mass Fire Strike
        [63] = 13, // Mass Chill Wind
        [64] = 14, // Earthworm Strike
        [66] = 15, // Armor Break
        [70] = 16, // Bloody Shock Wave
        [72] = 17, // Mass Ice Strike
        [74] = 18, // Lightning Strike
        [81] = 19, // Meteor Strike
        [56] = 20, // Mass Lightning Arrow → Mass Lightning Strike
        [91] = 21, // Blizzard
        [96] = 22, // Earth Shock Wave
        [97] = 23, // Mass Blizzard
        [32] = 24, // Invisibility
        [50] = 25, // Berserk
        [26] = 26, // Possession
        [35] = 27, // Paralyze
        [25] = 28, // Hold Person
        [1] = 29,  // Heal
        [21] = 30, // Great Heal
        [2] = 31,  // Create Food
        [13] = 32, // Defense Shield
        [44] = 33, // Great Defense Shield
        [24] = 34, // Protection From Arrow
        [33] = 35, // Protection From Magic
        [65] = 36, // Absolute Magic Protection
        [27] = 37, // Poison
        [36] = 38, // Cure
        [53] = 39, // Mass Poison
        [42] = 40, // Confuse Language
        [62] = 41, // Confusion
        [71] = 42, // Mass Confusion
        [80] = 43, // Illusion
        [90] = 44, // Mass Illusion
        [76] = 45, // Cancellation
        [83] = 46, // Inhibition Casting
        [31] = 47, // Summon Creature
        [77] = 48, // Illusion Movement
        [95] = 49, // Mass Illusion Movement
        [12] = 50, // Recall — farm under 80 / city at 80+
        [78] = 51, // Haste — run speed only; same-city allies (not self)
    };

    public static bool TryHandleCityService(
        GameWorldRef wr,
        GameWorldPlayer player,
        CityNpcServiceRequest request) {
        if (!wr.NpcsByNpcId.TryGetValue(request.NpcId, out var npc) ||
            npc.CatalogNpcId != GandalfCatalogNpcId) {
            return false;
        }

        var dist = Math.Max(Math.Abs(player.PosX - npc.PosX), Math.Abs(player.PosY - npc.PosY));
        if (dist > MaxInteractDistance) {
            Send(player, ok: false, "Move closer to Gandalf.", goldBalance: CountGold(player), learned: player.GetLearnedOlympiaSpellIds());
            return true;
        }

        var actionRaw = (request.Action ?? string.Empty).Trim();
        var action = actionRaw.ToLowerInvariant();
        Console.WriteLine(
            $"[MagicTower] {player.CharacterName} action='{actionRaw}' gold={CountGold(player)} hasDonate={request.HasDonateGold} donate={request.DonateGold}");

        if (action is "" or "open") {
            Send(
                player,
                ok: true,
                "Magic Tower — Learn spends bag gold; Unlearn frees the book slot (no refund).",
                goldBalance: CountGold(player),
                learned: player.GetLearnedOlympiaSpellIds());
            return true;
        }

        // Prefer spell id in action: "learn:1" / "unlearn:10" (reliable; optional donate_gold is flaky with 0).
        if (TryParseSpellAction(action, "learn", out var learnId) ||
            TryParseSpellAction(action, "buy_spell", out learnId) ||
            TryParseSpellAction(action, "buy", out learnId) ||
            (action is "buy_spell" or "buy" or "learn" && TryGetDonateSpellId(request, out learnId))) {
            HandleBuySpell(wr, player, learnId);
            return true;
        }

        if (TryParseSpellAction(action, "unlearn", out var unlearnId) ||
            TryParseSpellAction(action, "unlearn_spell", out unlearnId) ||
            TryParseSpellAction(action, "forget", out unlearnId) ||
            (action is "unlearn_spell" or "unlearn" or "forget" && TryGetDonateSpellId(request, out unlearnId))) {
            HandleUnlearnSpell(wr, player, unlearnId);
            return true;
        }

        Send(player, ok: false, $"Unknown Magic Tower action '{actionRaw}'.", goldBalance: CountGold(player), learned: player.GetLearnedOlympiaSpellIds());
        return true;
    }

    /// <summary>Parses <c>learn:12</c> / <c>unlearn:12</c> style actions.</summary>
    static bool TryParseSpellAction(string actionLower, string verb, out int spellId) {
        spellId = -1;
        var prefix = verb + ":";
        if (!actionLower.StartsWith(prefix, StringComparison.Ordinal)) {
            return false;
        }
        return int.TryParse(actionLower.AsSpan(prefix.Length), out spellId);
    }

    static bool TryGetDonateSpellId(CityNpcServiceRequest request, out int spellId) {
        spellId = -1;
        if (!request.HasDonateGold) {
            return false;
        }
        spellId = request.DonateGold;
        return spellId >= 0;
    }

    static void HandleBuySpell(GameWorldRef wr, GameWorldPlayer player, int olympiaSpellId) {
        if (!SpellGoldPrices.TryGetValue(olympiaSpellId, out var cost)) {
            Send(player, ok: false, "That spell is not sold here.", goldBalance: CountGold(player), learned: player.GetLearnedOlympiaSpellIds());
            return;
        }

        if (player.HasLearnedOlympiaSpell(olympiaSpellId)) {
            Send(player, ok: false, "You already know that magic.", goldBalance: CountGold(player), learned: player.GetLearnedOlympiaSpellIds());
            return;
        }

        var have = player.InventoryManager.CountGold();
        if (!player.InventoryManager.TrySpendGold(cost, out var spendResult)) {
            Send(
                player,
                ok: false,
                $"Need {cost} gold (you have {have}).",
                goldBalance: have,
                learned: player.GetLearnedOlympiaSpellIds());
            return;
        }

        Inventory.ApplyInventoryMutation(wr, player, spendResult);
        player.LearnOlympiaSpell(olympiaSpellId);

        // Push updated spell directory so client can cast newly unlocked combat spells without relog.
        ResyncTravelerSpells(wr, player);

        var spellName = olympiaSpellId.ToString();
        // Prefer catalog name when we have a server mapping.
        if (OlympiaToServerSpellId.TryGetValue(olympiaSpellId, out var sid) &&
            wr.SpellsById.TryGetValue(sid, out var cfg)) {
            spellName = cfg.Name;
        }

        Send(
            player,
            ok: true,
            $"Learned {spellName} for {cost} gold.",
            goldBalance: CountGold(player),
            learned: player.GetLearnedOlympiaSpellIds(),
            goldSpent: cost);
    }

    static void HandleUnlearnSpell(GameWorldRef wr, GameWorldPlayer player, int olympiaSpellId) {
        if (olympiaSpellId < 0) {
            Send(player, ok: false, "Pick a spell to unlearn.", goldBalance: CountGold(player), learned: player.GetLearnedOlympiaSpellIds());
            return;
        }

        if (!player.UnlearnOlympiaSpell(olympiaSpellId)) {
            Send(player, ok: false, "You do not have that magic memorized.", goldBalance: CountGold(player), learned: player.GetLearnedOlympiaSpellIds());
            return;
        }

        // Drop from traveler combat directory so client cannot cast after Unlearn.
        ResyncTravelerSpells(wr, player);

        // No gold refund — same as forgetting a scroll/manual in classic play.
        Send(
            player,
            ok: true,
            "Spell unlearned (no gold refund).",
            goldBalance: CountGold(player),
            learned: player.GetLearnedOlympiaSpellIds());
    }

    /// <summary>
    /// Re-sends traveler spell directory (Energy Bolt + Magic Tower unlocks) via InitialState
    /// so the client spell table and server allowlist stay aligned without relog.
    /// </summary>
    public static void ResyncTravelerSpells(GameWorldRef wr, GameWorldPlayer player) {
        if (!player.TravelerMode) {
            return;
        }

        Spawn.SendInitialState(wr, player, includeSpells: true);
    }

    static int CountGold(GameWorldPlayer player) => player.InventoryManager.CountGold();

    static void Send(
        GameWorldPlayer player,
        bool ok,
        string message,
        int goldBalance,
        IReadOnlyCollection<int> learned,
        int goldSpent = 0) {
        var learnedCsv = learned.Count == 0 ? "" : string.Join(',', learned);
        // For magic-shop, GoldSpent carries current bag gold balance so the client always has a number
        // even if it fails to parse cityServicesSummary.
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateCityNpcServiceResult(
                ok,
                message,
                role: "magic-shop",
                npcName: "Gandalf",
                guildInterestRegistered: player.GuildInterestRegistered,
                cityServicesSummary: $"gold={goldBalance};learned={learnedCsv}",
                citizenshipSide: player.CitizenshipSide ?? "",
                hp: player.Hp,
                maxHp: player.MaxHp,
                goldSpent: goldBalance,
                crusadeStatus: goldSpent > 0 ? $"spent={goldSpent}" : string.Empty,
                blessed: false));
    }
}
