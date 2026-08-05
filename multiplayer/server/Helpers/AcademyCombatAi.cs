using System;
using System.Collections.Generic;
using Mmorpg.Network;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Priority combat AI for PvP Academy Hard/Elite duelists — better than Unicorn random ES/melee/Para.
/// Runtime is a scripted policy (fast, deterministic). Grok designs/updates the policy offline;
/// it does not run per tick in production (latency + cost).
/// Catalog ids: 102 Hard Veteran, 103 Elite Contender (see Monsters.json).
/// </summary>
public static class AcademyCombatAi {
    public const int CatalogHard = 102;
    public const int CatalogElite = 103;
    public const int CatalogIntermediate = 101;
    public const int CatalogEasy = 100;

    public const int SpellEnergyStrike = 11;
    public const int SpellChillWind = 3;
    public const int SpellFireStrike = 2;
    public const int SpellLightningBolt = 6;
    public const int SpellParalyze = 27;
    public const int SpellEnergyBolt = 0;
    public const int SpellTripleEnergy = 5;

    public static bool IsAcademyDuelist(int catalogMonsterId) =>
        catalogMonsterId is CatalogEasy or CatalogIntermediate or CatalogHard or CatalogElite;

    public static bool IsElitePriorityCaster(int catalogMonsterId) =>
        catalogMonsterId is CatalogHard or CatalogElite;

    /// <summary>
    /// Among spells that already passed probability rolls, pick by tactical priority vs target state.
    /// Unicorn-class random pick is worse because it wastes Para when already locked / ignores setup.
    /// </summary>
    public static MonsterSpellEntry PickSpell(
        GameWorldMonster caster,
        GameWorldRef wr,
        List<MonsterSpellEntry> candidates,
        Random random) {
        ArgumentNullException.ThrowIfNull(candidates);
        if (candidates.Count == 0) {
            throw new ArgumentException("candidates empty", nameof(candidates));
        }

        if (!IsElitePriorityCaster(caster.CatalogMonsterId)) {
            return candidates[random.Next(candidates.Count)];
        }

        GameWorldPlayer? target = null;
        if (caster.TargetedPlayerId is long pid &&
            wr.World.TryGetConnectedPlayerById(pid, out var p) &&
            !p.IsDead) {
            target = p;
        }

        // Priority for Elite/Hard:
        // 1) Paralyze if target not already paralyzed
        // 2) Chill if not chilled (setup for kite / land)
        // 3) Energy Strike / Triple Energy (main pressure)
        // 4) Fire Strike / Lightning
        // 5) fallback random
        if (target is not null && !target.HasTemporaryEffect(TemporaryEffectType.Paralyze)) {
            var para = Find(candidates, SpellParalyze);
            if (para is not null && (caster.CatalogMonsterId != CatalogHard || random.NextDouble() < 0.55)) {
                return para;
            }
        }

        if (target is not null && !target.HasTemporaryEffect(TemporaryEffectType.Chill)) {
            var chill = Find(candidates, SpellChillWind);
            if (chill is not null && random.NextDouble() < 0.7) {
                return chill;
            }
        }

        var es = Find(candidates, SpellEnergyStrike) ?? Find(candidates, SpellTripleEnergy);
        if (es is not null && random.NextDouble() < 0.75) {
            return es;
        }

        var fire = Find(candidates, SpellFireStrike) ?? Find(candidates, SpellLightningBolt);
        if (fire is not null && random.NextDouble() < 0.5) {
            return fire;
        }

        return candidates[random.Next(candidates.Count)];
    }

    static MonsterSpellEntry? Find(List<MonsterSpellEntry> list, int spellId) {
        foreach (var e in list) {
            if (e.SpellId == spellId) {
                return e;
            }
        }
        return null;
    }
}
