using System.Collections.Generic;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Olympia-style skill masteries (0–100). Gathering skills: Mining (0), Fishing (1).
/// At 100%: rare gather loot unlocks; skill may later mint as tradeable cNFT (post-test).
/// </summary>
public static class Skills {
    public const int SkillCount = 19;
    public const int MaxLevel = 100;

    /// <summary>Default skill floor for all skills (shop skill manuals removed; everyone starts trained to 20%).</summary>
    public const int StartingSkillLevel = 20;

    /// <summary>Olympia free Magic baseline (GetMagicAbilityHandler sets skill 4 → 20). Alias of <see cref="StartingSkillLevel"/>.</summary>
    public const int StartingMagicLevel = StartingSkillLevel;

    public const int Mining = 0;
    public const int Fishing = 1;
    public const int Manufacture = 7;
    /// <summary>Olympia skill index 8 — Alchemy (enchant / disenchant drip).</summary>
    public const int Alchemy = 8;
    /// <summary>Olympia skill index 4 — Magic (not a manual skill; free 20% on first grant).</summary>
    public const int Magic = 4;
    /// <summary>
    /// CL index 6 — Hammer Mastery (Olympia relatedSkill / Hammer Attack Manual = 14).
    /// Combat hammers: 760 Hammer, 761 Battle Hammer, 762 GBH, 843 Barbarian Hammer.
    /// </summary>
    public const int HammerMastery = 6;
    public const int LongSword = 9; // Sword Mastery in catalog
    public const int AxeMastery = 10;
    public const int BowMastery = 11;
    public const int StaffMastery = 12;
    public const int ShieldMastery = 13;
    public const int MagicResistance = 14;
    public const int PhysicalAbsorption = 15;
    public const int PoisonResistance = 16;
    /// <summary>Rapier / fencing mastery (Arena + combat). Trains on rapier hits.</summary>
    public const int Fencing = 17;
    /// <summary>Pretend Corpse (play dead) — Arena PvP pick; world usable later.</summary>
    public const int PretendCorpse = 18;

    public static readonly string[] Names = [
        "Mining", "Fishing", "Farming", "Construction", "Magic",
        "Magical Chemistry", "Hammer Mastery", "Manufacture", "Alchemy",
        "Sword Mastery", "Axe Mastery", "Bow Mastery", "Staff Mastery",
        "Shield Mastery", "Magic Resistance", "Physical Absorption", "Poison Resistance",
        "Fencing", "Pretend Corpse",
    ];

    public static void SendSkillsState(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        var state = new SkillsState();
        for (var i = 0; i < SkillCount; i++) {
            var level = player.GetSkillLevel(i);
            state.Skills.Add(new SkillEntry {
                SkillId = i,
                Name = i < Names.Length ? Names[i] : $"Skill {i}",
                Level = level,
                Maxed = level >= MaxLevel,
            });
        }
        NetworkManager.SendToPlayer(player, new ServerMessage { SkillsState = state });
    }

    public static void HandleGetSkillsState(GameWorldPlayer player) {
        SendSkillsState(player);
    }

    public static void HandleGatherRequest(GameWorldRef wr, GameWorldPlayer player, SkillGatherRequest request) {
        ArgumentNullException.ThrowIfNull(wr);
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        if (request.SkillId == Fishing) {
            Gathering.TryFish(wr, player);
            return;
        }
        if (request.SkillId == Mining) {
            Gathering.TryMine(wr, player);
            return;
        }
        SendGatherResult(player, false, "Only Mining and Fishing gathers are available.", request.SkillId, player.GetSkillLevel(request.SkillId), 0, "", false);
    }

    public static void SendGatherResult(
            GameWorldPlayer player,
            bool ok,
            string message,
            int skillId,
            int skillLevel,
            int itemId,
            string itemName,
            bool rareLoot) {
        NetworkManager.SendToPlayer(player, new ServerMessage {
            SkillGatherResult = new SkillGatherResult {
                Ok = ok,
                Message = message ?? string.Empty,
                SkillId = skillId,
                SkillLevel = skillLevel,
                ItemId = itemId,
                ItemName = itemName ?? string.Empty,
                RareLoot = rareLoot,
            },
        });
    }

    /// <summary>Grant skill XP (1–3 typical); clamps at 100.</summary>
    public static int GrantSkillXp(GameWorldPlayer player, int skillId, int amount = 1) {
        if (skillId < 0 || skillId >= SkillCount || amount <= 0) {
            return player.GetSkillLevel(skillId);
        }
        var cur = player.GetSkillLevel(skillId);
        if (cur >= MaxLevel) {
            return MaxLevel;
        }
        var next = Math.Min(MaxLevel, cur + amount);
        player.SetSkillLevel(skillId, next);
        // Magic 100% unlocks full cast speed even without Mag 50.
        if (skillId == Magic && next >= 100) {
            PlayerDerivedStats.ApplyAuthoritativeCastSpeed(player);
        }
        return next;
    }

    /// <summary>
    /// Ensures every skill is at least <see cref="StartingSkillLevel"/> (20%).
    /// Skill manuals were removed from the shop — all masteries start usable.
    /// Higher trained values are never lowered. Returns true if any skill was raised.
    /// </summary>
    public static bool ApplyStartingDefaults(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        var changed = false;
        for (var i = 0; i < SkillCount; i++) {
            if (player.GetSkillLevel(i) < StartingSkillLevel) {
                player.SetSkillLevel(i, StartingSkillLevel);
                changed = true;
            }
        }
        return changed;
    }
}
