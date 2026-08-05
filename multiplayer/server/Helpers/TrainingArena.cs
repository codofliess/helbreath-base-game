using System;
using System.Collections.Generic;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Training-arena preset catalog and ApplyPreset spawn/chase wiring. Composition/tip IDs stay in sync with
/// <c>mp-client/src/constants/TrainingPresets.ts</c>; see <c>docs/TRAINING-ARENA.md</c>.
/// Reuses farm merc catalog monsters (War/Mage) + <see cref="MonsterChase"/> — does not touch farm barracks dwells.
/// </summary>
public static class TrainingArena {
    public const string WorldId = "training";

    /// <summary>Catalog id for Mercenary Warrior (melee chase) — same as farm barracks War mercs.</summary>
    public const int WarMonsterCatalogId = 62;

    /// <summary>Catalog id for Mercenary Mage (ranged chase) — same as farm barracks Mage mercs.</summary>
    public const int MageMonsterCatalogId = 63;

    /// <summary>Chebyshev search radius when placing dummies near the applying player.</summary>
    private const int SpawnSearchRadius = 12;

    /// <summary>Dummy combat role for tip sheets and AI metadata (War = melee chase, Mage = ranged chase).</summary>
    public enum DummyRole {
        War = 0,
        Mage = 1,
    }

    /// <summary>One dummy slot in a training preset.</summary>
    public sealed record DummySpec(DummyRole Role, int Count);

    /// <summary>Named preset: stable id, human label, dummy composition.</summary>
    public sealed record Preset(string Id, string Label, IReadOnlyList<DummySpec> Dummies);

    private static readonly Preset[] Presets = [
        new("mage_chase_1", "1 Mage chase", [new DummySpec(DummyRole.Mage, 1)]),
        new("war_chase_1", "1 War chase", [new DummySpec(DummyRole.War, 1)]),
        new("war_chase_2", "2 Wars chase", [new DummySpec(DummyRole.War, 2)]),
        new("mage_chase_2", "2 Mages chase", [new DummySpec(DummyRole.Mage, 2)]),
        new("mix_war_mage_1", "Mix War + Mage", [
            new DummySpec(DummyRole.War, 1),
            new DummySpec(DummyRole.Mage, 1),
        ]),
    ];

    private static readonly Dictionary<string, Preset> PresetsById =
        new(StringComparer.Ordinal);

    static TrainingArena() {
        foreach (var preset in Presets) {
            PresetsById[preset.Id] = preset;
        }
    }

    /// <summary>All known training presets (extensible catalog).</summary>
    public static IReadOnlyList<Preset> AllPresets => Presets;

    /// <summary>Looks up a preset by stable id.</summary>
    public static bool TryGetPreset(string presetId, out Preset preset) {
        if (string.IsNullOrWhiteSpace(presetId)) {
            preset = null!;
            return false;
        }

        return PresetsById.TryGetValue(presetId, out preset!);
    }

    /// <summary>True when <paramref name="worldId"/> is the dedicated training arena map.</summary>
    public static bool IsTrainingWorld(string worldId) =>
        string.Equals(worldId, WorldId, StringComparison.Ordinal);

    /// <summary>
    /// Validates and applies a chase-dummy preset: despawns prior session dummies, spawns War/Mage catalog
    /// monsters near the player, and lets <see cref="MonsterChase"/> aggro (clears spawn protection first).
    /// </summary>
    public static void HandleApplyPresetRequest(
        GameWorldRef wr,
        GameWorldPlayer player,
        ApplyTrainingPresetRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        if (player.IsDead) {
            Reply(player, ok: false, request.PresetId, 0, "Cannot apply preset while dead.");
            return;
        }

        if (!IsTrainingWorld(wr.WorldId)) {
            Reply(player, ok: false, request.PresetId, 0, "Training presets only work in the Training Arena world.");
            return;
        }

        if (!string.IsNullOrWhiteSpace(request.GameWorldId) &&
            !string.Equals(request.GameWorldId, wr.WorldId, StringComparison.Ordinal)) {
            Reply(player, ok: false, request.PresetId, 0, "Stale world — enter Training Arena and try again.");
            return;
        }

        if (!TryGetPreset(request.PresetId, out var preset)) {
            Reply(player, ok: false, request.PresetId, 0, $"Unknown preset '{request.PresetId}'.");
            return;
        }

        DespawnPlayerTrainingDummies(wr, player);

        if (player.SpawnProtection) {
            Spawn.DisableSpawnProtectionAndNotify(wr, player);
        }

        var spawned = 0;
        foreach (var spec in preset.Dummies) {
            var catalogId = CatalogIdForRole(spec.Role);
            for (var i = 0; i < spec.Count; i++) {
                if (!wr.World.TrySpawnCatalogMonsterNearPlayer(
                        player,
                        catalogId,
                        SpawnSearchRadius,
                        out var monsterId)) {
                    Console.WriteLine(
                        $"[TrainingArena] Failed to spawn {spec.Role} (catalog {catalogId}) for player '{player.PlayerId}' preset '{preset.Id}' after {spawned} ok.");
                    break;
                }

                player.AddTrainingDummyMonsterId(monsterId);
                spawned++;
            }
        }

        // Ensure chase picks the applying player once dummies are in their visibility set.
        MonsterChase.EvaluateChaseForPlayer(wr, player);

        if (spawned == 0) {
            Reply(player, ok: false, preset.Id, 0, "No free cells near you to spawn dummies.");
            return;
        }

        Console.WriteLine(
            $"[TrainingArena] Applied '{preset.Id}' for player '{player.PlayerId}': spawned {spawned} dummy(ies).");
        Reply(player, ok: true, preset.Id, spawned, $"Spawned {spawned} chase dummy(ies) — {preset.Label}.");
        BeginnerPath.OnTrainingPresetApplied(player, preset.Id);
    }

    /// <summary>Removes living training dummies owned by this player (re-apply / leave world). Does not touch farm dwell monsters.</summary>
    public static void DespawnPlayerTrainingDummies(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);

        var ids = player.TrainingDummyMonsterIds;
        if (ids.Count == 0) {
            return;
        }

        // Snapshot then clear so RemoveMonster cannot re-enter a mutating list.
        var snapshot = new long[ids.Count];
        for (var i = 0; i < ids.Count; i++) {
            snapshot[i] = ids[i];
        }
        player.ClearTrainingDummyMonsterIds();

        foreach (var monsterId in snapshot) {
            if (!wr.MonstersByMonsterId.TryGetValue(monsterId, out var monster)) {
                continue;
            }

            wr.World.DespawnMonsterImmediate(monster);
        }
    }

    /// <summary>Legacy helper: validates world + preset id without spawning (kept for call sites that only need a gate).</summary>
    public static bool TryApplyPreset(string worldId, string presetId) {
        if (!IsTrainingWorld(worldId)) {
            Console.WriteLine($"[TrainingArena] Refuse ApplyPreset outside training world (worldId={worldId}).");
            return false;
        }

        if (!TryGetPreset(presetId, out var preset)) {
            Console.WriteLine($"[TrainingArena] Unknown presetId '{presetId}'.");
            return false;
        }

        Console.WriteLine($"[TrainingArena] TryApplyPreset gate ok for '{preset.Id}' ({preset.Label}).");
        return true;
    }

    private static int CatalogIdForRole(DummyRole role) => role switch {
        DummyRole.War => WarMonsterCatalogId,
        DummyRole.Mage => MageMonsterCatalogId,
        _ => WarMonsterCatalogId,
    };

    private static void Reply(GameWorldPlayer player, bool ok, string presetId, int spawnedCount, string message) {
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateTrainingPresetApplied(ok, message, presetId ?? "", spawnedCount));
    }
}
