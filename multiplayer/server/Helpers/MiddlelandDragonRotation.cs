using System;
using System.Globalization;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Middleland scheduled dragon rotation (Nemesis-style colors, no Elementalist mob).
/// Every 4 hours UTC a single dragon spawns; the daily order is shuffled so the same
/// color does not always land on the same local night for a given timezone.
/// Six slots/day × five dragons ≈ each color at least once per day, with one random extra.
/// </summary>
public static class MiddlelandDragonRotation {
    public const string WorldId = "middleland";

    /// <summary>Earth, Illusion, Lightning, Poison, Black — catalog ids 110–114.</summary>
    public static readonly int[] DragonCatalogIds = [110, 111, 112, 113, 114];

    const int SlotHours = 4;
    const int SlotsPerDay = 24 / SlotHours; // 6
    const int TickMs = 30_000;

    /// <summary>Loose spawn pads across Middleland so fights are not always same tile.</summary>
    static readonly (int X, int Y)[] SpawnPads = [
        (248, 248),
        (280, 220),
        (220, 280),
        (300, 260),
        (200, 240),
        (260, 300),
        (320, 200),
        (180, 300),
    ];

    /// <summary>Start the 30s checker on Middleland only (call from <see cref="GameWorld"/> ctor).</summary>
    public static void Start(GameWorldRef wr) {
        if (!string.Equals(wr.WorldId, WorldId, StringComparison.Ordinal)) {
            return;
        }

        // Fire once shortly after boot so a reboot mid-slot still fills the slot.
        wr.Scheduler.SetTimeout(5_000, () => Tick(wr));
        wr.Scheduler.SetInterval(TickMs, () => Tick(wr));
        Console.WriteLine(
            $"[MiddlelandDragonRotation] Started on '{WorldId}' — 1 dragon / {SlotHours}h, daily shuffle for TZ fairness.");
    }

    static void Tick(GameWorldRef wr) {
        try {
            var world = wr.World;
            if (world is null) {
                return;
            }

            var utc = DateTime.UtcNow;
            var dayKey = utc.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            var slot = utc.Hour / SlotHours; // 0..5
            var catalogId = PickDragonForSlot(utc.Date, slot);

            if (world.TryFindLivingMonsterByCatalogIds(DragonCatalogIds, out _, out _)) {
                // Already up (this or prior slot) — leave it until killed.
                return;
            }

            // One spawn attempt per day-slot; if players killed it, wait for next slot.
            if (world.TryGetDragonRotationSpawnedSlot(out var spawnedDay, out var spawnedSlot) &&
                string.Equals(spawnedDay, dayKey, StringComparison.Ordinal) &&
                spawnedSlot == slot) {
                return;
            }

            if (!world.TrySpawnCatalogMonsterAtPads(catalogId, SpawnPads, out var monsterId, out var name, out var sx, out var sy)) {
                Console.WriteLine(
                    $"[MiddlelandDragonRotation] Failed to spawn catalog {catalogId} for slot {slot} on {dayKey}.");
                return;
            }

            world.MarkDragonRotationSpawned(dayKey, slot, catalogId, monsterId);
            var msg =
                $"[Dragon] A {name} has appeared in Middleland near ({sx},{sy})! (slot {slot + 1}/{SlotsPerDay} UTC)";
            Console.WriteLine($"[MiddlelandDragonRotation] {msg}");
            BroadcastToWorld(world, msg);
        } catch (Exception ex) {
            Console.WriteLine($"[MiddlelandDragonRotation] Tick error: {ex.Message}");
        }
    }

    /// <summary>
    /// Deterministic daily shuffle of the 5 dragons into the first 5 of 6 slots;
    /// the 6th slot is a second appearance of a dragon chosen by day-seed (still fair long-term).
    /// </summary>
    public static int PickDragonForSlot(DateTime utcDate, int slot) {
        if (slot < 0 || slot >= SlotsPerDay) {
            slot = Math.Clamp(slot, 0, SlotsPerDay - 1);
        }

        var seed = utcDate.Year * 10_000 + utcDate.Month * 100 + utcDate.Day;
        var order = (int[])DragonCatalogIds.Clone();
        var rng = new Random(seed);
        for (var i = order.Length - 1; i > 0; i--) {
            var j = rng.Next(i + 1);
            (order[i], order[j]) = (order[j], order[i]);
        }

        if (slot < order.Length) {
            return order[slot];
        }

        // Extra 6th slot: pick among the five using a different stream.
        return order[rng.Next(order.Length)];
    }

    static void BroadcastToWorld(GameWorld world, string text) {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var packet = NetworkManager.CreateChatMessageReceived("System", nowMs, text);
        foreach (var player in world.EnumerateConnectedPlayers()) {
            if (player.Disconnected) {
                continue;
            }
            NetworkManager.SendToPlayer(player, packet);
        }
    }
}
