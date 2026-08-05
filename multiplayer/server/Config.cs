using System.Text.Json;
using Mmorpg.Network;
using Server.Utils;

namespace Server;

/// <summary>
/// Loads JSON configuration from the <c>Config/</c> directory next to the process working directory.
/// Validates <see cref="SettingsConfig"/> invariants after deserialization.
/// </summary>
public static class Config {
    /// <summary>Deserializer options shared by all config file loads.</summary>
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    /// <summary>Reads a JSON file from <c>Config/{fileName}</c> and deserializes it, or throws if null.</summary>
    private static async Task<T> LoadJsonAsync<T>(string fileName, string description) where T : class {
        var path = Path.Combine(Directory.GetCurrentDirectory(), "Config", fileName);
        var json = await File.ReadAllTextAsync(path);
        return JsonSerializer.Deserialize<T>(json, JsonOptions)
            ?? throw new InvalidOperationException($"Failed to load {description} from {path}.");
    }

    public static Task<GameWorldConfig[]> LoadGameWorldsConfig() =>
        LoadJsonAsync<GameWorldConfig[]>("GameWorlds.json", "game worlds");

    public static Task<MonsterConfig[]> LoadMonstersConfig() =>
        LoadJsonAsync<MonsterConfig[]>("Monsters.json", "monsters");

    public static Task<SpellConfig[]> LoadSpellsConfig() =>
        LoadJsonAsync<SpellConfig[]>("Spells.json", "spells");

    public static Task<ItemConfig[]> LoadItemsConfig() =>
        LoadJsonAsync<ItemConfig[]>("Items.json", "items");

    public static Task<NpcConfig[]> LoadNpcsConfig() =>
        LoadJsonAsync<NpcConfig[]>("NPCs.json", "npcs");

    public static Task<ProgressionConfig> LoadProgressionConfig() =>
        LoadJsonAsync<ProgressionConfig>("Progression.json", "progression");

    public static Task<BeginnerPathConfig> LoadBeginnerPathConfig() =>
        LoadJsonAsync<BeginnerPathConfig>("BeginnerPath.json", "beginner path");

    public static Task<TournamentConfig> LoadTournamentConfig() =>
        LoadJsonAsync<TournamentConfig>("Tournament.json", "tournament");

    /// <summary>Arena Pre-Ready kit catalog (starter + credit shop + maps).</summary>
    public static Task<ArenaKitCatalogConfig> LoadArenaKitCatalogConfig() =>
        LoadJsonAsync<ArenaKitCatalogConfig>("ArenaKitCatalog.json", "arena kit catalog");

    /// <summary>Loads mutable GM anti-bot / AFK / tournament-AI tool flags from <c>AntiBotTools.json</c>.</summary>
    public static Task<AntiBotToolsConfig> LoadAntiBotToolsConfig() =>
        LoadJsonAsync<AntiBotToolsConfig>("AntiBotTools.json", "anti-bot tools");

    /// <summary>Writes <paramref name="config"/> back to <c>Config/AntiBotTools.json</c> so GM toggles survive restart.</summary>
    public static async Task SaveAntiBotToolsConfigAsync(AntiBotToolsConfig config, CancellationToken cancellationToken = default) {
        ArgumentNullException.ThrowIfNull(config);
        var path = Path.Combine(Directory.GetCurrentDirectory(), "Config", "AntiBotTools.json");
        var json = JsonSerializer.Serialize(config, new JsonSerializerOptions {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        });
        await File.WriteAllTextAsync(path, json, cancellationToken);
    }

    /// <summary>Validates NPC catalog entries and builds id lookup for summon and <see cref="Mmorpg.Network.InitialState"/> directory.</summary>
    public static IReadOnlyDictionary<int, NpcConfig> BuildNpcCatalog(NpcConfig[] npcs) {
        ArgumentNullException.ThrowIfNull(npcs);
        if (npcs.Length == 0) {
            return new Dictionary<int, NpcConfig>();
        }

        var idSet = new HashSet<int>();
        for (var i = 0; i < npcs.Length; i++) {
            var n = npcs[i];
            if (string.IsNullOrWhiteSpace(n.Name)) {
                throw new InvalidOperationException($"NPCs.json entry at index {i} has an empty name.");
            }
            if (!idSet.Add(n.Id)) {
                throw new InvalidOperationException($"Duplicate NPC id {n.Id} in NPCs.json.");
            }
        }

        for (var i = 0; i < npcs.Length; i++) {
            if (!idSet.Contains(i)) {
                throw new InvalidOperationException(
                    $"NPCs.json ids must be the contiguous range 0..{npcs.Length - 1} (missing id {i}).");
            }
        }

        return npcs.ToDictionary(n => n.Id);
    }

    /// <summary>Validates monster entries and builds sprite and numeric-id lookup tables used by summon and dwell spawning.</summary>
    public static (IReadOnlyDictionary<string, MonsterConfig> BySprite, IReadOnlyDictionary<int, MonsterConfig> ById) BuildMonsterCatalog(MonsterConfig[] monsters) {
        ArgumentNullException.ThrowIfNull(monsters);
        if (monsters.Length == 0) {
            return (
                new Dictionary<string, MonsterConfig>(StringComparer.OrdinalIgnoreCase),
                new Dictionary<int, MonsterConfig>());
        }

        var idSet = new HashSet<int>();
        for (var i = 0; i < monsters.Length; i++) {
            var m = monsters[i];
            if (string.IsNullOrWhiteSpace(m.Name)) {
                throw new InvalidOperationException($"Monsters.json entry at index {i} has an empty name.");
            }
            if (string.IsNullOrWhiteSpace(m.Sprite)) {
                throw new InvalidOperationException($"Monsters.json entry at index {i} has an empty sprite.");
            }
            if (m.MovementSpeed < 0) {
                throw new InvalidOperationException($"Monsters.json entry at index {i} has negative movementSpeed ({m.MovementSpeed}).");
            }
            if (!idSet.Add(m.Id)) {
                throw new InvalidOperationException($"Duplicate monster id {m.Id} in Monsters.json.");
            }
            if (m.ChaseDistance is int cd && cd < 0) {
                throw new InvalidOperationException($"Monsters.json entry at index {i} has negative chaseDistance ({cd}).");
            }
            if (m.ChaseMaxDistance is int cmd && cmd < 0) {
                throw new InvalidOperationException($"Monsters.json entry at index {i} has negative chaseMaxDistance ({cmd}).");
            }
            if (m.AttackRange is int ar && ar < 0) {
                throw new InvalidOperationException($"Monsters.json entry at index {i} has negative attackRange ({ar}).");
            }
            if (m.AttackSpeed is int asp && asp <= 0) {
                throw new InvalidOperationException($"Monsters.json entry at index {i} has non-positive attackSpeed ({asp}).");
            }
            if (m.AttackDamageMin is int dmin && m.AttackDamageMax is int dmax && dmin > dmax) {
                throw new InvalidOperationException(
                    $"Monsters.json entry at index {i} has attackDamageMin ({dmin}) greater than attackDamageMax ({dmax}).");
            }
            if (m.AttackRecoveryTime is int art && art < 0) {
                throw new InvalidOperationException($"Monsters.json entry at index {i} has negative attackRecoveryTime ({art}).");
            }
            if (m.MinIdleTime is int mint && mint < 0) {
                throw new InvalidOperationException($"Monsters.json entry at index {i} has negative minIdleTime ({mint}).");
            }
            if (m.MaxIdleTime is int maxit && maxit < 0) {
                throw new InvalidOperationException($"Monsters.json entry at index {i} has negative maxIdleTime ({maxit}).");
            }
            if (m.MinIdleTime is int mint2 && m.MaxIdleTime is int maxit2 && mint2 > maxit2) {
                throw new InvalidOperationException(
                    $"Monsters.json entry at index {i} has minIdleTime ({mint2}) greater than maxIdleTime ({maxit2}).");
            }
            if (m.AttackType is int aty && aty != (int)AttackType.NoInterrupt && aty != (int)AttackType.Interrupt && aty != (int)AttackType.Stun && aty != (int)AttackType.Knockback) {
                throw new InvalidOperationException(
                    $"Monsters.json entry at index {i} has attackType ({aty}); expected {(int)AttackType.NoInterrupt}, {(int)AttackType.Interrupt}, {(int)AttackType.Stun}, or {(int)AttackType.Knockback}.");
            }
            if (m.Allegiance is int allegiance &&
                allegiance != (int)MonsterAllegiance.Hostile &&
                allegiance != (int)MonsterAllegiance.Neutral &&
                allegiance != (int)MonsterAllegiance.Friendly) {
                throw new InvalidOperationException(
                    $"Monsters.json entry at index {i} has allegiance ({allegiance}); expected {(int)MonsterAllegiance.Hostile}, {(int)MonsterAllegiance.Neutral}, or {(int)MonsterAllegiance.Friendly}.");
            }
            if (m.AttackStunDuration is int asd && asd < 0) {
                throw new InvalidOperationException($"Monsters.json entry at index {i} has negative attackStunDuration ({asd}).");
            }
            if (m.Hp is int hpp && hpp <= 0) {
                throw new InvalidOperationException($"Monsters.json entry at index {i} has non-positive hp ({hpp}).");
            }
            if (m.CorpseDecayTime is int cdt && cdt < 0) {
                throw new InvalidOperationException($"Monsters.json entry at index {i} has negative corpseDecayTime ({cdt}).");
            }
            if (m.RespawnTime is int rt && rt < 0) {
                throw new InvalidOperationException($"Monsters.json entry at index {i} has negative respawnTime ({rt}).");
            }
            if (m.HitsToAggro is int hta && hta < 1) {
                throw new InvalidOperationException($"Monsters.json entry at index {i} has non-positive hitsToAggro ({hta}).");
            }
            if (m.Spells is { Length: > 0 } spellList) {
                for (var s = 0; s < spellList.Length; s++) {
                    var e = spellList[s];
                    if (e.CastProbability < 0 || e.CastProbability > 1) {
                        throw new InvalidOperationException(
                            $"Monsters.json entry at index {i} spells[{s}] has castProbability ({e.CastProbability}); expected 0..1.");
                    }
                }
            }
        }

        // Ids need only be unique (not contiguous 0..N-1). Academy/specials may use 100+.
        // Spawns and lookups use ById; gaps are allowed.

        var byId = monsters.ToDictionary(m => m.Id);
        var bySprite = monsters
            .GroupBy(m => m.Sprite.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        return (bySprite, byId);
    }

    /// <summary>Ensures each monster <c>spells</c> entry references a defined spell and rejects <see cref="DamageType.GroundEffect"/> (monster ground effects are not implemented).</summary>
    public static void ValidateMonsterSpellReferences(IReadOnlyDictionary<int, MonsterConfig> monstersById, IReadOnlyDictionary<int, SpellConfig> spellsById) {
        ArgumentNullException.ThrowIfNull(monstersById);
        ArgumentNullException.ThrowIfNull(spellsById);
        foreach (var kv in monstersById) {
            var m = kv.Value;
            if (m.Spells is not { Length: > 0 } spellList) {
                continue;
            }

            for (var s = 0; s < spellList.Length; s++) {
                var e = spellList[s];
                if (!spellsById.TryGetValue(e.SpellId, out var spell)) {
                    throw new InvalidOperationException(
                        $"Monsters.json entry id {m.Id} spells[{s}] references unknown spellId {e.SpellId}.");
                }

                if (!spell.DamageType.HasValue) {
                    // Allow hostile debuffs (Paralyze, etc.) for academy / elite mobs; reject self-buffs (PFM/DS).
                    if (!IsHostileDebuffSpellConfig(spell)) {
                        throw new InvalidOperationException(
                            $"Monsters.json entry id {m.Id} spells[{s}] uses buff/self spell {e.SpellId} ({spell.Name}); monsters may only cast damage spells or hostile debuffs (e.g. Paralyze).");
                    }
                } else if (spell.DamageType == (int)DamageType.GroundEffect) {
                    throw new InvalidOperationException(
                        $"Monsters.json entry id {m.Id} spells[{s}] uses spellId {e.SpellId} ({spell.Name}) with GroundEffect; monster spells cannot use ground-effect spells.");
                }
            }
        }
    }

    /// <summary>Paralyze / poison / chill-style status spells monsters may cast on players (not self PFM/DS).</summary>
    public static bool IsHostileDebuffSpellConfig(SpellConfig spell) {
        if (spell.TemporaryEffects is not { Length: > 0 } rows) {
            return false;
        }
        foreach (var row in rows) {
            var t = row.Type;
            if (t is (int)TemporaryEffectType.Poison
                or (int)TemporaryEffectType.ConfuseLanguage
                or (int)TemporaryEffectType.Confusion
                or (int)TemporaryEffectType.Illusion
                or (int)TemporaryEffectType.IllusionMovement
                or (int)TemporaryEffectType.Inhibition
                or (int)TemporaryEffectType.Paralyze
                or (int)TemporaryEffectType.Chill
                or (int)TemporaryEffectType.Sleep) {
                return true;
            }
        }
        return false;
    }

    /// <summary>Validates optional <c>movementSpeedModifier</c> / <c>attackSpeedModifier</c> / <c>castSpeedModifier</c> on a spell temporary-effect row.</summary>
    private static void ValidateSpellTimedEffectSpeedModifiers(int spellIndex, int spellId, SpellTimedEffectSpec row) {
        CheckOptionalSpeedModifier(spellIndex, spellId, "movementSpeedModifier", row.MovementSpeedModifier);
        CheckOptionalSpeedModifier(spellIndex, spellId, "attackSpeedModifier", row.AttackSpeedModifier);
        CheckOptionalSpeedModifier(spellIndex, spellId, "castSpeedModifier", row.CastSpeedModifier);
    }

    private static void CheckOptionalSpeedModifier(int spellIndex, int spellId, string jsonName, double? value) {
        if (!value.HasValue) {
            return;
        }

        var v = value.Value;
        if (double.IsNaN(v) || double.IsInfinity(v)) {
            throw new InvalidOperationException(
                $"Spells.json entry at index {spellIndex} (id {spellId}) temporaryEffects has non-finite {jsonName}.");
        }

        if (v < TemporaryEffectSpeedModifierMath.MinModifier || v > TemporaryEffectSpeedModifierMath.MaxModifier) {
            throw new InvalidOperationException(
                $"Spells.json entry at index {spellIndex} (id {spellId}) temporaryEffects {jsonName} ({v}) must be between {TemporaryEffectSpeedModifierMath.MinModifier} and {TemporaryEffectSpeedModifierMath.MaxModifier}.");
        }
    }

    /// <summary>Validates spell entries and builds an id lookup table used by spell casting handlers and server config packets.</summary>
    public static IReadOnlyDictionary<int, SpellConfig> BuildSpellCatalog(SpellConfig[] spells) {
        ArgumentNullException.ThrowIfNull(spells);
        if (spells.Length == 0) {
            return new Dictionary<int, SpellConfig>();
        }

        var idSet = new HashSet<int>();
        for (var i = 0; i < spells.Length; i++) {
            var spell = spells[i];
            if (string.IsNullOrWhiteSpace(spell.Name)) {
                throw new InvalidOperationException($"Spells.json entry at index {i} has an empty name.");
            }
            if (!idSet.Add(spell.Id)) {
                throw new InvalidOperationException($"Duplicate spell id {spell.Id} in Spells.json.");
            }
            if (!spell.DamageType.HasValue) {
                if (spell.PickupGroundItem == true) {
                    if (spell.TemporaryEffects is not null) {
                        throw new InvalidOperationException(
                            $"Spells.json entry at index {i} (id {spell.Id}) is a ground-item pickup spell and must not define temporaryEffects.");
                    }
                    if (spell.AoeRadius is not null) {
                        throw new InvalidOperationException(
                            $"Spells.json entry at index {i} (id {spell.Id}) is a ground-item pickup spell and must not define aoeRadius.");
                    }
                } else if (spell.HealDiceCount is not null) {
                    if (spell.HealDiceCount <= 0 || spell.HealDiceSides is not int sides || sides <= 0) {
                        throw new InvalidOperationException(
                            $"Spells.json entry at index {i} (id {spell.Id}) heal dice must be positive (count/sides).");
                    }
                    if (spell.TemporaryEffects is not null) {
                        throw new InvalidOperationException(
                            $"Spells.json entry at index {i} (id {spell.Id}) heal spell must not define temporaryEffects.");
                    }
                } else if (spell.CreateFood == true || spell.CurePoison == true || spell.ClearTemporaryEffects == true ||
                           spell.SummonCreature == true || spell.Recall == true) {
                    if (spell.TemporaryEffects is not null) {
                        throw new InvalidOperationException(
                            $"Spells.json entry at index {i} (id {spell.Id}) utility spell must not define temporaryEffects.");
                    }
                } else if (spell.TemporaryEffects is not { Length: > 0 } buffRows) {
                    throw new InvalidOperationException(
                        $"Spells.json entry at index {i} (id {spell.Id}) has no damageType and must define temporaryEffects or a utility flag.");
                } else {
                    foreach (var row in buffRows) {
                        ValidateSpellTimedEffectSpeedModifiers(i, spell.Id, row);
                        if (row.Group < 0) {
                            throw new InvalidOperationException(
                                $"Spells.json entry at index {i} (id {spell.Id}) has negative group ({row.Group}).");
                        }
                        if (row.Duration <= 0) {
                            throw new InvalidOperationException(
                                $"Spells.json entry at index {i} (id {spell.Id}) temporary effect must define positive duration (ms).");
                        }
                        if (row.Type == (int)TemporaryEffectType.Poison && (spell.PoisonLevel is not int pl || pl <= 0)) {
                            throw new InvalidOperationException(
                                $"Spells.json entry at index {i} (id {spell.Id}) Poison temporary effect requires positive poisonLevel.");
                        }
                    }
                }
            } else if (spell.PickupGroundItem == true) {
                throw new InvalidOperationException(
                    $"Spells.json entry at index {i} (id {spell.Id}) defines pickupGroundItem but also has damageType.");
            } else if (spell.DamageType != (int)DamageType.RectangleAoe &&
                spell.DamageType != (int)DamageType.ConeAoe &&
                spell.DamageType != (int)DamageType.LinearAoe &&
                spell.DamageType != (int)DamageType.SingleCell &&
                spell.DamageType != (int)DamageType.GroundEffect) {
                throw new InvalidOperationException(
                    $"Spells.json entry at index {i} has damageType ({spell.DamageType}); expected {(int)DamageType.RectangleAoe}, {(int)DamageType.ConeAoe}, {(int)DamageType.LinearAoe}, {(int)DamageType.SingleCell}, or {(int)DamageType.GroundEffect}.");
            }
            if (spell.DamageType.HasValue && spell.TemporaryEffects is not null) {
                foreach (var row in spell.TemporaryEffects) {
                    ValidateSpellTimedEffectSpeedModifiers(i, spell.Id, row);
                    if (row.Type == (int)TemporaryEffectType.Invisibility) {
                        throw new InvalidOperationException(
                            $"Spells.json entry at index {i} (id {spell.Id}) must not define Invisibility in temporaryEffects on a damage spell.");
                    }
                    if (row.Type != (int)TemporaryEffectType.Chill &&
                        row.Type != (int)TemporaryEffectType.Poison) {
                        throw new InvalidOperationException(
                            $"Spells.json entry at index {i} (id {spell.Id}) has unsupported on-hit temporary effect type {row.Type}.");
                    }
                    if (row.Type == (int)TemporaryEffectType.Poison && (spell.PoisonLevel is not int plHit || plHit <= 0)) {
                        throw new InvalidOperationException(
                            $"Spells.json entry at index {i} (id {spell.Id}) Poison on-hit requires positive poisonLevel.");
                    }
                    if (row.Group < 0) {
                        throw new InvalidOperationException(
                            $"Spells.json entry at index {i} (id {spell.Id}) has negative group ({row.Group}).");
                    }
                    if (row.Duration <= 0) {
                        throw new InvalidOperationException(
                            $"Spells.json entry at index {i} (id {spell.Id}) temporary effect must define positive duration (ms).");
                    }
                }
            }
            if (spell.AoeRadius is int aoeRadius && aoeRadius < 0) {
                throw new InvalidOperationException($"Spells.json entry at index {i} has negative aoeRadius ({aoeRadius}).");
            }
            if (spell.ArmorLifeDecrement is int armorLifeDecrement && armorLifeDecrement < 0) {
                throw new InvalidOperationException($"Spells.json entry at index {i} has negative armorLifeDecrement ({armorLifeDecrement}).");
            }
            if (spell.MaxHitsPerTarget is int maxHitsPerTarget && maxHitsPerTarget < 1) {
                throw new InvalidOperationException($"Spells.json entry at index {i} has non-positive maxHitsPerTarget ({maxHitsPerTarget}).");
            }
            if (spell.MaxHitsPerTarget is not null &&
                spell.DamageType is int multiHitDt &&
                multiHitDt != (int)DamageType.ConeAoe &&
                multiHitDt != (int)DamageType.LinearAoe) {
                throw new InvalidOperationException(
                    $"Spells.json entry at index {i} (id {spell.Id}) maxHitsPerTarget is only valid for ConeAoe or LinearAoe.");
            }
            if (spell.Group is int group && group < 0) {
                throw new InvalidOperationException($"Spells.json entry at index {i} has negative group ({group}).");
            }
            if (spell.ProjectileSpeed is int projectileSpeed && projectileSpeed <= 0) {
                throw new InvalidOperationException($"Spells.json entry at index {i} has non-positive projectileSpeed ({projectileSpeed}).");
            }
            if (spell.ProjectileDistance is int projectileDistance && projectileDistance <= 0) {
                throw new InvalidOperationException($"Spells.json entry at index {i} has non-positive projectileDistance ({projectileDistance}).");
            }
            if (spell.ProjectileDistance is not null && spell.ProjectileSpeed is null) {
                throw new InvalidOperationException(
                    $"Spells.json entry at index {i} defines projectileDistance but does not define projectileSpeed (required for travel-time delay).");
            }
            if (spell.EmissionSteps is int emissionSteps && emissionSteps <= 0) {
                throw new InvalidOperationException($"Spells.json entry at index {i} has non-positive emissionSteps ({emissionSteps}).");
            }
            if (spell.StartRadius is int startRadius && startRadius < 0) {
                throw new InvalidOperationException($"Spells.json entry at index {i} has negative startRadius ({startRadius}).");
            }
            if (spell.EndRadius is int endRadius && endRadius < 0) {
                throw new InvalidOperationException($"Spells.json entry at index {i} has negative endRadius ({endRadius}).");
            }
            if (spell.StartRadius is int startRadiusValue &&
                spell.EndRadius is int endRadiusValue &&
                startRadiusValue > endRadiusValue) {
                throw new InvalidOperationException(
                    $"Spells.json entry at index {i} has startRadius ({startRadiusValue}) greater than endRadius ({endRadiusValue}).");
            }
            if (spell.StartShards is int startShards && startShards < 0) {
                throw new InvalidOperationException($"Spells.json entry at index {i} has negative startShards ({startShards}).");
            }
            if (spell.EndShards is int endShards && endShards < 0) {
                throw new InvalidOperationException($"Spells.json entry at index {i} has negative endShards ({endShards}).");
            }

            if (spell.DamageType == (int)DamageType.ConeAoe) {
                if (spell.ProjectileSpeed is null ||
                    spell.EmissionSteps is null ||
                    spell.StartRadius is null ||
                    spell.EndRadius is null ||
                    spell.StartShards is null ||
                    spell.EndShards is null) {
                    throw new InvalidOperationException(
                        $"Spells.json entry at index {i} uses ConeAoe and must define projectileSpeed, emissionSteps, startRadius, endRadius, startShards, and endShards.");
                }
            }

            if (spell.DamageType == (int)DamageType.LinearAoe) {
                if (spell.Duration is null) {
                    throw new InvalidOperationException(
                        $"Spells.json entry at index {i} uses LinearAoe and must define duration (ms).");
                }
                if (spell.Duration <= 0) {
                    throw new InvalidOperationException($"Spells.json entry at index {i} has non-positive duration ({spell.Duration}).");
                }
            }

            if (spell.DamageType == (int)DamageType.SingleCell) {
                if (spell.AoeRadius is not null) {
                    throw new InvalidOperationException(
                        $"Spells.json entry at index {i} uses SingleCell and must not define aoeRadius.");
                }
                if (spell.Duration is not null) {
                    throw new InvalidOperationException(
                        $"Spells.json entry at index {i} uses SingleCell and must not define duration (not a linear AoE spell).");
                }
            }

            if (spell.DamageType == (int)DamageType.GroundEffect) {
                if (spell.Group is null) {
                    throw new InvalidOperationException(
                        $"Spells.json entry at index {i} uses GroundEffect and must define group.");
                }
                if (spell.Duration is null) {
                    throw new InvalidOperationException(
                        $"Spells.json entry at index {i} uses GroundEffect and must define duration (ms).");
                }
                var duration = spell.Duration.Value;
                if (duration <= 0) {
                    throw new InvalidOperationException($"Spells.json entry at index {i} has non-positive duration ({spell.Duration}).");
                }
                if (spell.TickRate is int tickRate) {
                    if (tickRate <= 0) {
                        throw new InvalidOperationException($"Spells.json entry at index {i} has non-positive tickRate ({spell.TickRate}).");
                    }
                    if (duration % tickRate != 0) {
                        throw new InvalidOperationException(
                            $"Spells.json entry at index {i} uses GroundEffect and must define duration divisible by tickRate.");
                    }
                }
            }

            if (spell.AttackType is int saty &&
                saty != (int)AttackType.NoInterrupt &&
                saty != (int)AttackType.Interrupt &&
                saty != (int)AttackType.Stun &&
                saty != (int)AttackType.Knockback) {
                throw new InvalidOperationException(
                    $"Spells.json entry at index {i} has attackType ({saty}); expected {(int)AttackType.NoInterrupt}, {(int)AttackType.Interrupt}, {(int)AttackType.Stun}, or {(int)AttackType.Knockback}.");
            }
        }

        return spells.ToDictionary(spell => spell.Id);
    }

    /// <summary>Validates item entries and builds an id lookup table used for <see cref="Mmorpg.Network.InitialState"/> item directory payloads.</summary>
    public static IReadOnlyDictionary<int, ItemConfig> BuildItemCatalog(ItemConfig[] items) {
        ArgumentNullException.ThrowIfNull(items);
        if (items.Length == 0) {
            return new Dictionary<int, ItemConfig>();
        }

        var idSet = new HashSet<int>();
        for (var i = 0; i < items.Length; i++) {
            var item = items[i];
            if (string.IsNullOrWhiteSpace(item.Name)) {
                throw new InvalidOperationException($"Items.json entry at index {i} has an empty name.");
            }
            if (string.IsNullOrWhiteSpace(item.ItemType)) {
                throw new InvalidOperationException($"Items.json entry at index {i} has an empty itemType.");
            }
            if (!idSet.Add(item.Id)) {
                throw new InvalidOperationException($"Duplicate item id {item.Id} in Items.json.");
            }
            if (item.WeaponType is int wt &&
                wt != (int)ItemWeaponType.Melee &&
                wt != (int)ItemWeaponType.Bow) {
                throw new InvalidOperationException(
                    $"Items.json entry id {item.Id} has weaponType {wt}; expected {(int)ItemWeaponType.Melee} or {(int)ItemWeaponType.Bow}.");
            }
            if (item.Gender is int g && g is not (0 or 1)) {
                throw new InvalidOperationException(
                    $"Items.json entry id {item.Id} has gender {g}; expected 0 (male) or 1 (female).");
            }
        }

        return items.ToDictionary(entry => entry.Id);
    }

    /// <summary>Ensures dwell area entries reference catalog ids and sane counts before worlds are constructed.</summary>
    public static void ValidateGameWorldDwellAreas(GameWorldConfig gw, IReadOnlyDictionary<int, MonsterConfig> monstersById) {
        ArgumentNullException.ThrowIfNull(gw);
        ArgumentNullException.ThrowIfNull(monstersById);
        if (gw.DwellAreas is null || gw.DwellAreas.Length == 0) {
            return;
        }

        for (var i = 0; i < gw.DwellAreas.Length; i++) {
            var d = gw.DwellAreas[i];
            if (d.Count < 1) {
                throw new InvalidOperationException(
                    $"Game world '{gw.Id}' dwellAreas[{i}].count must be at least 1.");
            }
            if (!monstersById.ContainsKey(d.MonsterId)) {
                throw new InvalidOperationException(
                    $"Game world '{gw.Id}' dwellAreas[{i}].monsterId {d.MonsterId} is not defined in Monsters.json.");
            }
        }
    }

    /// <summary>Validates optional <c>npcs</c> entries: catalog id, facing 0–7, and unique grid cells per world.</summary>
    public static void ValidateGameWorldNpcPlacements(GameWorldConfig gw, IReadOnlyDictionary<int, NpcConfig> npcsById) {
        ArgumentNullException.ThrowIfNull(gw);
        ArgumentNullException.ThrowIfNull(npcsById);
        if (gw.Npcs is null || gw.Npcs.Length == 0) {
            return;
        }

        var seen = new HashSet<(int X, int Y)>();
        for (var i = 0; i < gw.Npcs.Length; i++) {
            var p = gw.Npcs[i];
            if (p.Direction < 0 || p.Direction > 7) {
                throw new InvalidOperationException(
                    $"Game world '{gw.Id}' npcs[{i}].direction must be 0–7 (got {p.Direction}).");
            }

            if (!npcsById.ContainsKey(p.NpcId)) {
                throw new InvalidOperationException(
                    $"Game world '{gw.Id}' npcs[{i}].npcId {p.NpcId} is not defined in NPCs.json.");
            }

            if (!seen.Add((p.X, p.Y))) {
                throw new InvalidOperationException(
                    $"Game world '{gw.Id}' has two or more npcs at ({p.X}, {p.Y}).");
            }
        }
    }

    /// <summary>Rejects NPC placements on cells listed in <see cref="GameWorldConfig.TeleportLocs"/> (server-declared teleport sources).</summary>
    public static void ValidateGameWorldNpcNotOnTeleportCells(GameWorldConfig gw) {
        ArgumentNullException.ThrowIfNull(gw);
        if (gw.Npcs is null || gw.Npcs.Length == 0) {
            return;
        }

        if (gw.TeleportLocs is null || gw.TeleportLocs.Length == 0) {
            return;
        }

        var teleportCells = new HashSet<(int X, int Y)>();
        foreach (var tl in gw.TeleportLocs) {
            foreach (var loc in tl.Locs) {
                teleportCells.Add((loc.X, loc.Y));
            }
        }

        for (var i = 0; i < gw.Npcs.Length; i++) {
            var p = gw.Npcs[i];
            if (teleportCells.Contains((p.X, p.Y))) {
                throw new InvalidOperationException(
                    $"Game world '{gw.Id}' npcs[{i}] at ({p.X}, {p.Y}) conflicts with a teleport source cell.");
            }
        }
    }

    /// <summary>Ensures each configured NPC lies within the loaded map dimensions.</summary>
    public static void ValidateGameWorldNpcBounds(GameWorldConfig gw, GameWorldOccupancyTracker tracker) {
        ArgumentNullException.ThrowIfNull(gw);
        ArgumentNullException.ThrowIfNull(tracker);
        if (gw.Npcs is null || gw.Npcs.Length == 0) {
            return;
        }

        var maxX = tracker.SizeX - 1;
        var maxY = tracker.SizeY - 1;
        for (var i = 0; i < gw.Npcs.Length; i++) {
            var p = gw.Npcs[i];
            if (p.X < 0 || p.X > maxX || p.Y < 0 || p.Y > maxY) {
                throw new InvalidOperationException(
                    $"Game world '{gw.Id}' npcs[{i}] at ({p.X}, {p.Y}) is outside map bounds 0..{maxX} x 0..{maxY}.");
            }
        }
    }

    public static async Task<SettingsConfig> LoadSettings() {
        var settings = await LoadJsonAsync<SettingsConfig>("Settings.json", "settings");
        if (settings.Port is < 1 or > 65535) {
            throw new ArgumentOutOfRangeException(nameof(settings.Port), "Port must be between 1 and 65535 inclusive.");
        }
        if (settings.LogoutTime < 0) {
            throw new ArgumentOutOfRangeException(nameof(settings.LogoutTime), "Logout time must be zero or greater.");
        }
        ArgumentNullException.ThrowIfNull(settings.Threads);
        var th = settings.Threads;
        if (th.GameWorldWorkers < 1) {
            throw new ArgumentOutOfRangeException(nameof(th.GameWorldWorkers), "Game world workers must be at least 1.");
        }
        if (th.GlobalWorldWorkerThread is int globalWorldWorkerThread && globalWorldWorkerThread < 0) {
            throw new ArgumentOutOfRangeException(nameof(th.GlobalWorldWorkerThread), "Global world worker thread must be zero or greater when set.");
        }
        if (settings.ChatMessageMaxLength <= 0) {
            throw new ArgumentOutOfRangeException(nameof(settings.ChatMessageMaxLength), "Chat message max length must be greater than zero.");
        }
        ArgumentNullException.ThrowIfNull(settings.GameWorld);
        var gwHost = settings.GameWorld;
        if (gwHost.TickInterval <= 0) {
            throw new ArgumentOutOfRangeException(nameof(gwHost.TickInterval), "Game world tick interval must be greater than zero.");
        }
        if (gwHost.IncomingMessagesQueueSize <= 0) {
            throw new ArgumentOutOfRangeException(nameof(gwHost.IncomingMessagesQueueSize), "Game world incoming messages queue size must be greater than zero.");
        }
        if (gwHost.IncomingMessagesBatchSizePerDispatch <= 0) {
            throw new ArgumentOutOfRangeException(nameof(gwHost.IncomingMessagesBatchSizePerDispatch), "Game world incoming messages batch size per dispatch must be greater than zero.");
        }
        if (settings.MaxCellsJumpDistance < 0) {
            throw new ArgumentOutOfRangeException(nameof(settings.MaxCellsJumpDistance), "Max cells jump distance must be zero or greater.");
        }
        if (settings.MaxConsecutiveOutboundSendFailures < 0) {
            throw new ArgumentOutOfRangeException(
                nameof(settings.MaxConsecutiveOutboundSendFailures),
                "Max consecutive outbound send failures must be zero or greater (zero disables the circuit breaker).");
        }
        ArgumentNullException.ThrowIfNull(settings.Radius);
        var rad = settings.Radius;
        if (rad.ViewRadiusX < 0) {
            throw new ArgumentOutOfRangeException(nameof(rad.ViewRadiusX), "View radius X must be zero or greater.");
        }
        if (rad.ViewRadiusY < 0) {
            throw new ArgumentOutOfRangeException(nameof(rad.ViewRadiusY), "View radius Y must be zero or greater.");
        }
        if (rad.CameraRadiusX < 0) {
            throw new ArgumentOutOfRangeException(nameof(rad.CameraRadiusX), "Camera radius X must be zero or greater.");
        }
        if (rad.CameraRadiusY < 0) {
            throw new ArgumentOutOfRangeException(nameof(rad.CameraRadiusY), "Camera radius Y must be zero or greater.");
        }
        ArgumentNullException.ThrowIfNull(settings.Ping);
        var ping = settings.Ping;
        if (ping.VarianceSampleSize <= 0) {
            throw new ArgumentOutOfRangeException(nameof(ping.VarianceSampleSize), "Ping variance sample size must be greater than zero.");
        }
        if (ping.AllowedVariance < 0) {
            throw new ArgumentOutOfRangeException(nameof(ping.AllowedVariance), "Ping allowed variance must be zero or greater.");
        }
        if (ping.Timeout <= 0) {
            throw new ArgumentOutOfRangeException(nameof(ping.Timeout), "Ping timeout must be greater than zero.");
        }
        ArgumentNullException.ThrowIfNull(settings.Timings);
        var tm = settings.Timings;
        if (tm.DisconnectTime <= 0) {
            throw new ArgumentOutOfRangeException(nameof(tm.DisconnectTime), "Disconnect time must be greater than zero.");
        }
        if (tm.SpawnProtectionTime < 0) {
            throw new ArgumentOutOfRangeException(nameof(tm.SpawnProtectionTime), "Spawn protection time must be zero or greater.");
        }
        if (tm.KnockbackTimeMs <= 0) {
            throw new ArgumentOutOfRangeException(nameof(tm.KnockbackTimeMs), "Knockback time must be greater than zero.");
        }
        var vc = settings.MovementSpeedViolationsChecker;
        if (vc.Limit <= 0) {
            throw new ArgumentOutOfRangeException(nameof(vc.Limit), "Movement speed violation limit must be greater than zero.");
        }
        if (vc.Window <= 0) {
            throw new ArgumentOutOfRangeException(nameof(vc.Window), "Movement speed violation window must be greater than zero.");
        }
        if (vc.SegmentsPerWindow <= 0) {
            throw new ArgumentOutOfRangeException(nameof(vc.SegmentsPerWindow), "Movement speed violation segments per window must be greater than zero.");
        }
        if (vc.ParalysisDuration < 0) {
            throw new ArgumentOutOfRangeException(nameof(vc.ParalysisDuration), "Paralysis duration must be zero or greater.");
        }
        if (vc.MaxPingVariance < 0) {
            throw new ArgumentOutOfRangeException(nameof(vc.MaxPingVariance), "Max ping variance must be zero or greater.");
        }
        ArgumentNullException.ThrowIfNull(settings.Debug);
        ArgumentNullException.ThrowIfNull(settings.MonsterDefaults);
        var md = settings.MonsterDefaults;
        if (md.ChaseDistance < 0) {
            throw new ArgumentOutOfRangeException(nameof(md.ChaseDistance), "Default monster chase distance must be zero or greater.");
        }
        if (md.ChaseMaxDistance is int dmm && dmm < 0) {
            throw new ArgumentOutOfRangeException(nameof(md.ChaseMaxDistance), "Default monster chase max distance must be zero or greater when set.");
        }
        if (md.AttackSpeed <= 0) {
            throw new ArgumentOutOfRangeException(nameof(md.AttackSpeed), "Default monster attack speed must be greater than zero.");
        }
        if (md.AttackDamageMin > md.AttackDamageMax) {
            throw new ArgumentOutOfRangeException(
                nameof(md.AttackDamageMin),
                "Default monster attack damage min must not exceed default monster attack damage max.");
        }
        if (md.AttackRecoveryTime < 0) {
            throw new ArgumentOutOfRangeException(nameof(md.AttackRecoveryTime), "Default monster attack recovery time must be zero or greater.");
        }
        if (md.MinIdleTime < 0) {
            throw new ArgumentOutOfRangeException(nameof(md.MinIdleTime), "Default monster min idle time must be zero or greater.");
        }
        if (md.MaxIdleTime < 0) {
            throw new ArgumentOutOfRangeException(nameof(md.MaxIdleTime), "Default monster max idle time must be zero or greater.");
        }
        if (md.MinIdleTime > md.MaxIdleTime) {
            throw new ArgumentOutOfRangeException(
                nameof(md.MinIdleTime),
                "Default monster min idle time must not exceed default monster max idle time.");
        }
        if (tm.ArrowSpeed <= 0) {
            throw new ArgumentOutOfRangeException(nameof(tm.ArrowSpeed), "Arrow speed must be greater than zero.");
        }
        if (md.Hp <= 0) {
            throw new ArgumentOutOfRangeException(nameof(md.Hp), "Default monster HP must be greater than zero.");
        }
        if (md.CorpseDecayTime <= 0) {
            throw new ArgumentOutOfRangeException(nameof(md.CorpseDecayTime), "Default monster corpse decay time must be greater than zero.");
        }
        if (md.RespawnTime <= 0) {
            throw new ArgumentOutOfRangeException(nameof(md.RespawnTime), "Default monster respawn time must be greater than zero.");
        }
        if (tm.PlayerPickupAnimationTime <= 0) {
            throw new ArgumentOutOfRangeException(nameof(tm.PlayerPickupAnimationTime), "Player pickup animation time must be greater than zero.");
        }
        if (tm.PlayerBowAnimationTime <= 0) {
            throw new ArgumentOutOfRangeException(nameof(tm.PlayerBowAnimationTime), "Player bow animation time must be greater than zero.");
        }
        if (settings.MaxDroppedItemsInStack <= 0) {
            throw new ArgumentOutOfRangeException(nameof(settings.MaxDroppedItemsInStack), "Max dropped items in stack must be greater than zero.");
        }
        if (tm.BlizzardSpellDamageDelayMs < 0) {
            throw new ArgumentOutOfRangeException(nameof(tm.BlizzardSpellDamageDelayMs), "Blizzard spell damage delay must be zero or greater.");
        }
        if (tm.AntiHackTimingLagFactor < 0 || tm.AntiHackTimingLagFactor > 1) {
            throw new ArgumentOutOfRangeException(nameof(tm.AntiHackTimingLagFactor), "Anti-hack timing lag factor must be between zero and one inclusive.");
        }
        return settings;
    }
}

/// <summary>Single world-grid coordinate used in config-defined teleports.</summary>
public record WorldLocationConfig(int X, int Y);

/// <summary>Teleport destination world id plus preferred spawn cell in that world.</summary>
public record GameWorldTeleportTargetConfig(string WorldId, WorldLocationConfig Loc);

/// <summary>Config-defined mapping from one or more source cells to a destination world/cell.</summary>
public record GameWorldTeleportConfig(WorldLocationConfig[] Locs, GameWorldTeleportTargetConfig Target);

/// <summary>Resolved teleport destination with the target world's map asset name for client preloading.</summary>
public record GameWorldTeleportTarget(string WorldId, string MapName, WorldLocationConfig Loc);

/// <summary>Resolved teleport set for one world: many source cells that share one target destination.</summary>
public record GameWorldTeleportSet(WorldLocationConfig[] Locs, GameWorldTeleportTarget Target);

/// <summary>Server-authoritative NPC catalog entry for summon UI and validation; client maps <c>id</c> to sprite locally.</summary>
public record NpcConfig(int Id, string Name);

/// <summary>Optional spell cast entry for <see cref="MonsterConfig.Spells"/>: <c>spellId</c> matches <c>Spells.json</c>; <c>castProbability</c> is an independent roll each AI tick (0–1).</summary>
public record MonsterSpellEntry(int SpellId, double CastProbability);

/// <summary>
/// One loot row for <see cref="MonsterConfig.Loot"/>: <c>chance</c> is 0–1.
/// Gold and multi-drop bosses (Wyvern/Abaddon) still roll each row independently;
/// normal monsters cap accepted non-gold rows to one primary + one rare (see <c>MonsterLoot</c>).
/// </summary>
public record MonsterLootEntry(int ItemId, double Chance, int MinQuantity = 1, int MaxQuantity = 1);

/// <summary>Server-authoritative monster catalog entry: stable id for world dwell config, display name, client sprite id, default step duration in ms (0 = no movement; melee when a player is in range still applies), optional chase distance in Chebyshev cells (default at spawn when omitted), optional max chase follow distance in cells, optional melee attack range in cells (default 1 when omitted), optional attack animation duration in ms, optional damage roll bounds (defaults from settings when omitted), optional post-hit AI idle gate extension in ms (defaults from settings when omitted), optional wander rest duration bounds in ms (defaults from settings when omitted), optional hit mode (<see cref="AttackType"/>, default <see cref="AttackType.NoInterrupt"/>), optional auto-aggro allegiance (<see cref="MonsterAllegiance"/>, default <see cref="MonsterAllegiance.Hostile"/>), optional player stunlock duration in ms after a <see cref="AttackType.Stun"/> hit only (ignored for <see cref="AttackType.Interrupt"/>; default 100 when omitted; JSON <c>attackStunDuration</c>), optional ranged attacks (JSON <c>rangedAttack</c>) using <c>arrowSpeed</c> for damage delay, optional <see cref="Spells"/> for AI spell casts.</summary>
public record MonsterConfig(
    int Id,
    string Name,
    string Sprite,
    int MovementSpeed,
    int? ChaseDistance = null,
    int? ChaseMaxDistance = null,
    int? AttackRange = null,
    int? AttackSpeed = null,
    int? AttackDamageMin = null,
    int? AttackDamageMax = null,
    int? AttackRecoveryTime = null,
    int? MinIdleTime = null,
    int? MaxIdleTime = null,
    int? AttackType = null,
    int? Allegiance = null,
    int? AttackStunDuration = null,
    /// <summary>When true, damage to players uses arrow travel delay after half swing (see <c>arrowSpeed</c> in settings); clients show arrow VFX from <see cref="Mmorpg.Network.MonsterAttacked"/>.</summary>
    bool? RangedAttack = null,
    /// <summary>Max HP when omitted; uses <c>monsterDefaults.hp</c> in <c>Settings.json</c>.</summary>
    int? Hp = null,
    /// <summary>Corpse linger duration in ms before server removal when omitted; uses <c>monsterDefaults.corpseDecayTime</c> in <c>Settings.json</c>.</summary>
    int? CorpseDecayTime = null,
    /// <summary>Delay in ms before a dwell-spawned monster respawns after corpse removal when omitted; uses <c>monsterDefaults.respawnTime</c> in <c>Settings.json</c>.</summary>
    int? RespawnTime = null,
    /// <summary>Optional AI spell list; each entry references <c>Spells.json</c> by id (ground-effect spells are rejected at startup).</summary>
    MonsterSpellEntry[]? Spells = null,
    /// <summary>Optional death loot table; see <see cref="MonsterLootEntry"/> / <c>MonsterLoot</c> for roll caps.</summary>
    MonsterLootEntry[]? Loot = null,
    /// <summary>Olympia loot gen tier (1–10); caps magic attribute values on drops. Ettin=10.</summary>
    int? GenLevel = null,
    /// <summary>Olympia <c>Npc.cfg</c> magic level (ML). Positive = offensive ladder; negative = guard ladder; 0 = no magic AI.</summary>
    int? MagicLevel = null,
    /// <summary>Olympia max mana pool for NPC casts; regen ticks when |ML| &gt; 0.</summary>
    int? MaxMana = null,
    /// <summary>Olympia magic hit ratio (MHR) used as spell accuracy seed (stored for parity / future resist rolls).</summary>
    int? MagicHitRatio = null,
    /// <summary>
    /// Player damage hits required before this monster retaliates (damage aggro). Default 1.
    /// Unicorns use 2: stay passive on the first hit, chase only after the second hit from that player.
    /// Only meaningful for <see cref="MonsterAllegiance.Neutral"/> (hostiles auto-aggro on sight).
    /// </summary>
    int? HitsToAggro = null);

/// <summary>One guaranteed-reward milestone row in <c>Progression.json</c>: kill-count (<c>kind</c> 0, uses <c>monsterId</c>) or rebirth (<c>kind</c> 1). The player picks one item from <c>rewardItemIds</c> when claiming.</summary>
public record KillMilestoneConfig(
    string Id,
    int Kind,
    int? MonsterId,
    long Required,
    int[] RewardItemIds);

/// <summary>Olympia-style progression tunables from <c>Progression.json</c>: exp curve caps, rebirth pacing, and guaranteed-reward milestones.</summary>
public record ProgressionConfig(
    int MaxLevel,
    int MaxRebirth,
    /// <summary>
    /// Live Olympia scale after NpcExpCatalog base (capped ExpDice×HD + rare overrides).
    /// Calibrated L33 RB0: Slime≈1140, Ant≈3400, Orc≈3500, Scorpion≈5940, Cyclops≈17000. Factor 65.
    /// </summary>
    double MonsterExpFactor,
    /// <summary>
    /// Extra scale on required exp curve per rebirth: required *= (1 + step × rebirth).
    /// Olympia live uses 0 (curve unchanged); exp rate is reduced via <see cref="RebirthExpObtainRate"/> instead.
    /// </summary>
    double RebirthExpMultiplierStep,
    KillMilestoneConfig[] Milestones,
    /// <summary>Unspent LU points granted per rebirth (6 × 10 RB ≈ +20 effective levels → L150 ≈ L170 stats).</summary>
    int RebirthLuPoints = 6,
    /// <summary>
    /// Olympia wiki: exp obtained *= rate^rebirth (default 0.8 → RB1=80%, RB2=64%, …).
    /// At <see cref="FullExpObtainFromLevel"/> and above, obtained rate is forced to 100%.
    /// </summary>
    double RebirthExpObtainRate = 0.8,
    /// <summary>Olympia wiki: “Experience is 100% at 140 regardless of rebirth.”</summary>
    int FullExpObtainFromLevel = 140,
    /// <summary>
    /// Chain Lords: level after rebirth (not Olympia L1). Default 79 — mid bracket before PL caps.
    /// </summary>
    int RebirthResetLevel = 79);

/// <summary>One beginner-path quest row from <c>BeginnerPath.json</c> (optional guided 1→80 training).</summary>
public record BeginnerQuestConfig(
    string Id,
    string Tier,
    string Status,
    int LevelGuideMin,
    int LevelGuideMax,
    string Title,
    string Hint,
    string ObjectiveKind,
    int Required,
    int? MonsterId = null,
    string[]? WorldIds = null,
    int? CatalogNpcId = null,
    /// <summary>Shop item catalog ids that credit a <c>buy_item</c> objective (any match).</summary>
    int[]? ItemIds = null,
    /// <summary>Client UI action id for <c>ui_action</c> objectives (e.g. <c>open_party</c>).</summary>
    string? UiActionId = null);

/// <summary>Catalog root for the optional beginner training path.</summary>
public record BeginnerPathConfig(BeginnerQuestConfig[] Quests);

/// <summary>Ranged vs melee for catalog <c>weaponType</c> (JSON and <see cref="Mmorpg.Network.ItemDirectoryEntry"/>).</summary>
public enum ItemWeaponType {
    Melee = 0,
    Bow = 1,
}

/// <summary>One effect row in <c>Items.json</c>; <c>effect</c> matches the client ItemEffect index (0 = STORM_BRINGER … 5 = TINT_APPEARANCE).</summary>
public record ItemEffectConfig(int Effect, int? EffectColor = null);

/// <summary>Server-authoritative item row from <c>Items.json</c> (stable id matches the client sprite registry).</summary>
public record ItemConfig(
    int Id,
    string Name,
    string ItemType,
    string[]? BlockedItemSlots = null,
    bool? Stackable = null,
    bool? Consumable = null,
    ItemEffectConfig[]? Effects = null,
    /// <summary>0 = melee, 1 = bow; omit from JSON for melee.</summary>
    int? WeaponType = null,
    /// <summary>When set, only this gender may equip the item; 0 = male, 1 = female (matches <see cref="Mmorpg.Network.PlayerGender"/>).</summary>
    int? Gender = null,
    /// <summary>Olympia <c>Item.cfg</c> effect type for magic rolls (1=attack, 2=defense, 13=mana-save wand). Inferred from <c>itemType</c> when omitted.</summary>
    int? OlympiaEffectType = null,
    /// <summary>Olympia <c>m_wMaxLifeSpan</c>; durable gear uses values &gt; 1.</summary>
    int? MaxLifeSpan = null,
    /// <summary>Olympia list price (gold) used for Tom repair cost.</summary>
    int? Price = null,
    /// <summary>Olympia item category (1–10 = Tom weapons/shields/armor; 46 = rings Shop Keeper repairs).</summary>
    int? Category = null);

/// <summary>One timed effect row from <c>Spells.json</c> <c>temporaryEffects</c>; <c>duration</c> is ms. Optional modifiers are additive to 1 for speed: effective duration ms = base / (1 + sum(modifiers)); see <see cref="TemporaryEffectSpeedModifierMath"/>.</summary>
public record SpellTimedEffectSpec(
    int Type,
    int Group,
    int Duration,
    double? MovementSpeedModifier = null,
    double? AttackSpeedModifier = null,
    double? CastSpeedModifier = null);

/// <summary>Server-authoritative spell catalog entry loaded from <c>Spells.json</c>.</summary>
/// <remarks>For <see cref="DamageType.LinearAoe"/>, <c>projectileSpeed</c> is optional (omitted when the server does not need travel-time delay for damage; clients may use it for visuals when set). For <see cref="DamageType.SingleCell"/>, omit <c>aoeRadius</c> and <c>duration</c>; damage resolves immediately on cast. For <see cref="DamageType.GroundEffect"/>, define <c>group</c> and <c>duration</c>; <c>tickRate</c> is optional and, when set, makes the effect deal periodic damage. When <c>tickRate</c> is omitted, the effect is step-on-only until expiry. <c>aoeRadius</c> is optional and expands placement around the target cell. For <see cref="DamageType.RectangleAoe"/> with projectile-delayed damage, when <c>projectileDistance</c> is set, travel time uses that fixed pixel distance instead of caster-to-target distance. Optional <c>attackType</c> matches <see cref="AttackType"/> (default <see cref="AttackType.Interrupt"/> when omitted). <see cref="DamageType.GroundEffect"/> with <see cref="AttackType.Knockback"/> is applied as <see cref="AttackType.Stun"/> using the caster&apos;s <c>attackStunDuration</c>. Buff-only spells omit <c>damageType</c> and use <c>temporaryEffects</c>, heal dice, create-food, cure, cancellation, or summon flags. Damage spells may list <c>temporaryEffects</c> for on-hit debuffs (e.g. Chill). For <see cref="DamageType.GroundEffect"/>, those debuffs apply each time damage is delivered (each periodic tick or step-on hit), subject to group stacking rules.</remarks>
public record SpellConfig(
    int Id,
    string Name,
    /// <summary>Omitted for buff-only spells (see <c>temporaryEffects</c>).</summary>
    int? DamageType = null,
    /// <summary>How spell damage applies on targets (<see cref="AttackType"/>); default <see cref="AttackType.Interrupt"/> when omitted from JSON.</summary>
    int? AttackType = null,
    int? AoeRadius = null,
    int? Group = null,
    int? TickRate = null,
    int? ProjectileSpeed = null,
    /// <summary>When set with <c>projectileSpeed</c> for rectangle AoE, damage delay uses this pixel distance (same units as <see cref="Server.Helpers.Projectile"/> tile math) instead of caster-to-target distance.</summary>
    int? ProjectileDistance = null,
    int? EmissionSteps = null,
    int? StartRadius = null,
    int? EndRadius = null,
    int? StartShards = null,
    int? EndShards = null,
    /// <summary>Linear AoE: destination linger duration in ms; server applies damage after <c>duration / 2</c> from cast resolution.</summary>
    int? Duration = null,
    /// <summary>When true, clients may send optional aim-assist target ids on <c>SpellCastRequest</c> to snap the cast cell to that entity.</summary>
    bool? AimAssist = null,
    /// <summary>Buff-only and/or on-hit timed effects; JSON <c>temporaryEffects</c>; each <c>duration</c> is ms.</summary>
    SpellTimedEffectSpec[]? TemporaryEffects = null,
    /// <summary>When true, cast resolves by picking up the top-most ground item on the target cell (Possession).</summary>
    bool? PickupGroundItem = null,
    /// <summary>Olympia Magic.cfg effect4/5/6: <c>iDice(count, sides) + bonus</c> before Mag scaling.</summary>
    int? DamageDiceCount = null,
    int? DamageDiceSides = null,
    int? DamageDiceBonus = null,
    /// <summary>Olympia HPUP_SPOT heal: <c>iDice(healDiceCount, healDiceSides) + healBonus</c>.</summary>
    int? HealDiceCount = null,
    int? HealDiceSides = null,
    int? HealBonus = null,
    /// <summary>When true, drops Meat or Baguette on the target cell (Olympia CREATE food).</summary>
    bool? CreateFood = null,
    /// <summary>When true, removes Poison temporary effect from the target (Olympia Cure).</summary>
    bool? CurePoison = null,
    /// <summary>When true, clears all temporary effects on the target (Olympia Cancellation).</summary>
    bool? ClearTemporaryEffects = null,
    /// <summary>When true, spawns a friendly follower near the caster (Olympia Summon-Creature; tier from caster level).</summary>
    bool? SummonCreature = null,
    /// <summary>When true, recalls the caster to the guarded farm (L&lt;80) or city (L≥80) teleporter pad.</summary>
    bool? Recall = null,
    /// <summary>Olympia poison level for <see cref="TemporaryEffectType.Poison"/> DoT ticks (<c>iDice(1, poisonLevel)</c>).</summary>
    int? PoisonLevel = null,
    /// <summary>Olympia <c>ArmorLifeDecrement</c> amount (Magic.cfg value10); Armor Break uses 15.</summary>
    int? ArmorLifeDecrement = null,
    /// <summary>
    /// Olympia ICE_LINEAR / DAMAGE_LINEAR multi-hit cap per target (path samples + end area; each hit re-rolls MR).
    /// Blizzard ~5, Bloody Shock Wave / FOT-like ~4, Earth Shock Wave ~6. Omit for single-hit unique targets.
    /// </summary>
    int? MaxHitsPerTarget = null,
    /// <summary>Flat +N to magic hit chance (e.g. Mass Blizzard +10).</summary>
    int? HitChanceBonus = null,
    /// <summary>Post-dice damage scale (e.g. Mass Blizzard 1.05 = +5% vs normal Blizzard).</summary>
    double? DamageMultiplier = null,
    /// <summary>
    /// Minimum effective INT (angel + gear) required to cast. e.g. Cancellation / Inhibition Casting = 215
    /// so the mage needs Angel +15 INT active.
    /// </summary>
    int? RequiredInt = null);

/// <summary>Optional axis-aligned dwell rectangle in map tiles; when omitted, worlds use full map bounds for that dwell entry.</summary>
public record GameWorldDwellAreaBoundsConfig(int X1, int Y1, int X2, int Y2);

/// <summary>Spawn rule: place <see cref="Count"/> instances of the catalog monster inside the area (or whole map).</summary>
public record GameWorldDwellAreaConfig(int MonsterId, int Count, GameWorldDwellAreaBoundsConfig? Area = null);

/// <summary>One catalog NPC placed at world creation; <see cref="Direction"/> is grid facing 0–7 (matches client direction indices).</summary>
public record GameWorldNpcPlacementConfig(int NpcId, int X, int Y, int Direction);

/// <summary>Static pickaxe/mining node placement (Promise Land Dungeons coal/crystal). Server may enforce interact later.</summary>
public record GameWorldMiningNodeConfig(
    /// <summary>0 = coal / common ore, 1 = crystal (rare).</summary>
    int Kind,
    int X,
    int Y);

/// <summary>Static definition of one playable world instance (id, display name, map asset, optional fixed worker, optional teleports, optional monster dwell spawns, optional fixed NPC placements).</summary>
public record GameWorldConfig(
    string Id,
    string Name,
    string Map,
    string? Music = null,
    int? WorkerThread = null,
    GameWorldTeleportConfig[]? TeleportLocs = null,
    GameWorldDwellAreaConfig[]? DwellAreas = null,
    GameWorldNpcPlacementConfig[]? Npcs = null,
    /// <summary>When true this world is a tournament arena: entrants get the standardized max-level loadout from <c>Tournament.json</c> and their real character state is stashed and restored on exit.</summary>
    bool? TournamentArena = null,
    /// <summary>When true this world is the skill-practice training arena (dummies / tip protocols). Does not apply tournament loadout or rated Elo — see <c>docs/TRAINING-ARENA.md</c>.</summary>
    bool? TrainingArena = null,
    /// <summary>Optional map default weather string matching client modes (<c>dry</c>, <c>rain-light</c>, … <c>snow-heavy</c>). Applied at world construction.</summary>
    string? DefaultWeather = null,
    /// <summary>Max character level allowed to enter / stay (inclusive). Null = no cap. PL outdoor 110, PL Dungeons 120.</summary>
    int? MaxPlayerLevel = null,
    /// <summary>Min character level allowed to enter (inclusive). Null = no floor.</summary>
    int? MinPlayerLevel = null,
    /// <summary>Optional mining node placements (coal / crystal) for dungeon maps.</summary>
    GameWorldMiningNodeConfig[]? MiningNodes = null);

/// <summary>One equipped slot of the standardized tournament loadout; exactly one of <see cref="Any"/> or the gender pair should be set.</summary>
public record TournamentLoadoutEquipEntry(int? Any = null, int? Male = null, int? Female = null);

/// <summary>One bag stack granted with the tournament loadout (e.g. potions).</summary>
public record TournamentLoadoutBagEntry(int ItemId, int Quantity);

/// <summary>Standardized equal-footing loadout applied to every player entering a tournament arena world (<c>Tournament.json</c>).</summary>
public record TournamentLoadoutConfig(TournamentLoadoutEquipEntry[] Equipped, TournamentLoadoutBagEntry[]? BagItems = null);

/// <summary>Tournament arena tunables from <c>Tournament.json</c>: the equal-footing loadout every entrant receives.</summary>
public record TournamentConfig(TournamentLoadoutConfig Loadout);

/// <summary>Arena crit regen override (e.g. +5 every 30s, cap 15).</summary>
public record ArenaCritRegenConfig(int ChargesPerTick = 5, int IntervalMs = 30000, int MaxCharges = 15);

/// <summary>One starter equip piece (hero set / fixed jewelry).</summary>
public record ArenaStarterEquipConfig(int ItemId, string? Slot = null, string? Name = null, string? Note = null, int? MaxLifeSpan = null);

/// <summary>
/// Free bag cape. Prefer CIC (Charge Critical, Olympia cap total 20) and/or MC + MP regen.
/// Plain capes with no magic must not be granted. CIC free cape may also carry HP regen 50%.
/// </summary>
public record ArenaFreeCapeConfig(
    int ItemId,
    string? Name = null,
    int ManaConvertPct = 0,
    int HpRegenPct = 0,
    int MpRegenPct = 0,
    /// <summary>Critical Increase / Charge Critical nibble (1–15; total equip CIC soft-capped at 20).</summary>
    int CriticalIncrease = 0);

/// <summary>One piece inside a free armor set (gender-resolved item ids).</summary>
public record ArenaFreeArmorPieceConfig(
    string? Slot = null,
    int ItemIdMale = 0,
    int ItemIdFemale = 0,
    string? Name = null);

/// <summary>
/// Free armor set granted in bag for every arena fighter (HP50 / MP50 mage+war layouts).
/// Not purchased with credits.
/// </summary>
public record ArenaFreeArmorSetConfig(
    string? Id = null,
    string? Label = null,
    /// <summary>hp50 | mp50</summary>
    string? Magic = null,
    ArenaFreeArmorPieceConfig[]? Pieces = null);

/// <summary>Free angelic pendant granted in bag at +MajesticPlus.</summary>
public record ArenaAngelConfig(int ItemId, string? Name = null, int MajesticPlus = 15);

/// <summary>Potion choice for the free pool (red/blue/candy).</summary>
public record ArenaPotionChoiceConfig(int ItemId, string? Sku = null, string? Name = null, int? SpRestorePct = null);

/// <summary>Starter block of <c>ArenaKitCatalog.json</c>.</summary>
public record ArenaStarterConfig(
    ArenaStarterEquipConfig[]? HeroSetMale = null,
    ArenaStarterEquipConfig[]? HeroSetFemale = null,
    /// <summary>Olympia war Hero: Helm + Armor (high DR/PA). Prefer over legacy heroSet* when path=war.</summary>
    ArenaStarterEquipConfig[]? HeroSetWarMale = null,
    ArenaStarterEquipConfig[]? HeroSetWarFemale = null,
    /// <summary>Olympia mage Hero: Cap + Robe. Prefer when path=mage.</summary>
    ArenaStarterEquipConfig[]? HeroSetMageMale = null,
    ArenaStarterEquipConfig[]? HeroSetMageFemale = null,
    ArenaStarterEquipConfig[]? FixedEquipped = null,
    ArenaFreeCapeConfig[]? FreeCapesInBag = null,
    /// <summary>Free HP50/MP50 armor sets (both mage + war layouts) in bag for everyone.</summary>
    ArenaFreeArmorSetConfig[]? FreeArmorInBag = null,
    ArenaAngelConfig[]? AngelsInBag = null,
    ArenaPotionChoiceConfig[]? PotionChoices = null);

/// <summary>One credit-shop SKU.</summary>
public record ArenaCatalogSkuConfig(
    string Sku,
    string? Label = null,
    int Cost = 0,
    string[]? Tags = null,
    int? ItemId = null,
    int? Plus = null,
    bool? PerUse = null,
    bool? Stackable = null,
    int? DurationMs = null,
    int? SaDurationMs = null,
    int? SaCooldownMs = null,
    int? ArenaUsesPerRound = null,
    string[]? BundleSkus = null,
    string? Note = null,
    string? SpellName = null);

/// <summary>Full <c>ArenaKitCatalog.json</c> root.</summary>
public record ArenaKitCatalogConfig(
    int Version = 1,
    int StarterCredits = 1000,
    int StatTotalPoints = 517,
    int StatMinPer = 10,
    int Level = 150,
    ArenaCritRegenConfig? CritRegen = null,
    int PotionPool = 30,
    int SkillsPick100 = 4,
    int SkillsPick50 = 4,
    int[]? PvpSkillIds = null,
    int[]? GatheringSkillIdsExcluded = null,
    ArenaStarterConfig? Starter = null,
    ArenaCatalogSkuConfig[]? Catalog = null);

/// <summary>
/// Mutable GM anti-bot / capacity / tournament-AI tool flags and tunables (<c>AntiBotTools.json</c>).
/// Defaults match product philosophy: AFK on map allowed; other gates off until ops enable them.
/// </summary>
public record AntiBotToolsConfig(
    bool GuildPriorityIngress = false,
    bool NewPlayerSegment = false,
    bool ClaimTimeSybilGate = false,
    bool IndustrialMultiBoxLimits = false,
    bool AfkOnMapAllowed = true,
    bool TournamentInhumanPlayTelemetry = false,
    bool TournamentHighStakesMode = false,
    bool SoftOfflineProgression = false,
    int MaxConcurrentSessions = 8,
    int ActionRateCeilingPerMin = 600,
    int AfkWarnAfterMs = 300_000,
    int AfkKickAfterMs = 600_000,
    int SoftOfflineXpPerTick = 1,
    int SoftOfflineTickMs = 60_000,
    int NearCapacityOnline = 3500,
    string UpdatedBy = "bootstrap",
    long UpdatedAtMs = 0);

/// <summary>Thresholds for detecting impossibly fast movement and applying server-side paralysis.</summary>
public record MovementSpeedViolationCheckConfig(bool Verbose, int Limit, int Window, int SegmentsPerWindow, int ParalysisDuration, int MaxPingVariance);

/// <summary>Ping policy from <c>ping</c> in <c>Settings.json</c> (RTT sampling, disconnect thresholds).</summary>
public record PingConfig(int AllowedVariance, int Timeout, int Interval, int VarianceSampleSize);

/// <summary>Tick cadence and per-<see cref="Server.World.Game.GameWorld"/> incoming message channel sizing; JSON <c>gameWorld</c> in <c>Settings.json</c>.</summary>
public record GameWorldRuntimeSettings(int TickInterval, int IncomingMessagesQueueSize, int IncomingMessagesBatchSizePerDispatch);

/// <summary>Developer diagnostics; JSON <c>debug</c> in <c>Settings.json</c>.</summary>
/// <remarks>When <see cref="ProfileMonstersAILoop"/> is true, each game world logs aggregate monster AI loop time about once per second.</remarks>
public record DebugConfig(bool EnableGcLogs, bool ProfileMonstersAILoop);

/// <summary>View and spell-target radii in grid cells; JSON <c>radius</c> in <c>Settings.json</c>.</summary>
/// <remarks><see cref="CameraRadiusX"/> and <see cref="CameraRadiusY"/> bound how far from the caster’s tile a spell cast’s requested target coordinates may be (axis-aligned, same convention as view radii).</remarks>
public record RadiusConfig(int ViewRadiusX, int ViewRadiusY, int CameraRadiusX, int CameraRadiusY);

/// <summary>Session, animation, and anti-cheat timing slack; JSON <c>timings</c> in <c>Settings.json</c>.</summary>
public record TimingsConfig(
    int DisconnectTime,
    int ArrowSpeed,
    int BlizzardSpellDamageDelayMs,
    int PlayerPickupAnimationTime,
    int PlayerBowAnimationTime,
    int SpawnProtectionTime,
    int KnockbackTimeMs,
    double AntiHackTimingLagFactor);

/// <summary>Worker pool layout; JSON <c>threads</c> in <c>Settings.json</c>.</summary>
public record ThreadsConfig(int GameWorldWorkers, int? GlobalWorldWorkerThread);

/// <summary>Defaults under <c>monsterDefaults</c> in <c>Settings.json</c> when <c>Monsters.json</c> omits the corresponding field.</summary>
/// <remarks><see cref="ChaseMaxDistance"/> when <see langword="null"/> (omit from JSON) applies no server-wide max follow default—only catalog <c>chaseMaxDistance</c> and visibility; when set, used when the catalog omits <c>chaseMaxDistance</c>.</remarks>
public record MonsterDefaultsConfig(
    int ChaseDistance = 6,
    int? ChaseMaxDistance = null,
    int AttackSpeed = 600,
    int AttackDamageMin = 1,
    int AttackDamageMax = 5,
    int AttackRecoveryTime = 400,
    int MinIdleTime = 0,
    int MaxIdleTime = 5000,
    int Hp = 100,
    int CorpseDecayTime = 3000,
    int RespawnTime = 3000);

/// <summary>Runtime tuning for networking, visibility, tick rate, spawn, and anti-cheat checks.</summary>
/// <remarks><see cref="Port"/> is the HTTP listener port (all interfaces). <see cref="MonsterDefaults"/> (<see cref="MonsterDefaultsConfig"/>) supplies server-wide monster catalog fallbacks. <see cref="MonsterDefaultsConfig.ChaseMaxDistance"/> when <see langword="null"/> applies no max-follow default for omitted catalog <c>chaseMaxDistance</c>. <see cref="Radius"/> (<see cref="RadiusConfig"/>) defines visibility view radii and camera-bounded spell targets.</remarks>
public record SettingsConfig(
    int Port,
    TimingsConfig Timings,
    ThreadsConfig Threads,
    int ChatMessageMaxLength,
    int LogoutTime,
    PingConfig Ping,
    GameWorldRuntimeSettings GameWorld,
    bool CourseCorrection,
    RadiusConfig Radius,
    string InitialMap,
    bool SpawnToRandomMap,
    MovementSpeedViolationCheckConfig MovementSpeedViolationsChecker,
    DebugConfig Debug,
    MonsterDefaultsConfig MonsterDefaults,
    bool SpawnInMiddle = true,
    int MaxCellsJumpDistance = 3,
    /// <summary>Maximum number of dropped bag entries retained on one ground cell; only the newest top entry is visible.</summary>
    int MaxDroppedItemsInStack = 10,
    /// <summary>When true, serialize outbound protobuf with <c>MessageExtensions.WriteTo(Span&lt;byte&gt;)</c> instead of <see cref="System.IO.MemoryStream"/> + <see cref="Google.Protobuf.CodedOutputStream"/>; JSON <c>enableZeroCopyProtobufTransfer</c> in <c>Settings.json</c>. Produces less garbage, but in benchmarks reduces throughput versus the stream path.</summary>
    bool EnableZeroCopyProtobufTransfer = false,
    /// <summary>After this many consecutive outbound encode/send failures (excluding cancellation), cancel the connection receive loop. Zero disables the circuit breaker. JSON <c>maxConsecutiveOutboundSendFailures</c>.</summary>
    int MaxConsecutiveOutboundSendFailures = 10,
    /// <summary>
    /// Single WebSocket dual outbound queues: combat/movement/vitals before chat/auction/warehouse.
    /// Rollback: set <c>enableMessagePriorityQueue</c> false in Settings.json and restart.
    /// </summary>
    bool EnableMessagePriorityQueue = true);
