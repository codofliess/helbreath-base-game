using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace Server.Helpers;

/// <summary>
/// Public landing metrics: unique players seen online in the last 4h + EKs in the last 4h.
/// Cheap rolling ledgers; landing can poll every few minutes without load.
/// </summary>
public static class RealmStats {
    public static readonly TimeSpan Window = TimeSpan.FromHours(4);

    /// <summary>networkId (wallet) → last time they had a live session sample.</summary>
    static readonly ConcurrentDictionary<string, long> LastSeenOnlineMs = new(StringComparer.Ordinal);

    /// <summary>UTC ms timestamps of eligible open-world EKs.</summary>
    static readonly ConcurrentQueue<long> EkTimestampsMs = new();

    static long NowMs() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    public sealed record Snapshot(
        int OnlineNow,
        int PlayersOnLast4h,
        int EksLast4h,
        DateTimeOffset UpdatedAtUtc);

    public readonly record struct PlayerSessionView(bool Connected, string WorldId, string NetworkId);

    /// <summary>Mark wallets currently connected (call from realm sample loop).</summary>
    public static void NoteOnlinePresence(IEnumerable<PlayerSessionView> sessions) {
        var now = NowMs();
        foreach (var s in sessions) {
            if (!s.Connected) {
                continue;
            }
            var id = (s.NetworkId ?? string.Empty).Trim();
            if (id.Length == 0) {
                continue;
            }
            LastSeenOnlineMs[id] = now;
        }
        PrunePresence(now);
    }

    /// <summary>Record one eligible open-world Enemy Kill.</summary>
    public static void RecordEnemyKill() {
        var now = NowMs();
        EkTimestampsMs.Enqueue(now);
        PruneEks(now);
    }

    static void PrunePresence(long nowMs) {
        var cutoff = nowMs - (long)Window.TotalMilliseconds;
        foreach (var kv in LastSeenOnlineMs) {
            if (kv.Value < cutoff) {
                LastSeenOnlineMs.TryRemove(kv.Key, out _);
            }
        }
    }

    static void PruneEks(long nowMs) {
        var cutoff = nowMs - (long)Window.TotalMilliseconds;
        while (EkTimestampsMs.TryPeek(out var t) && t < cutoff) {
            EkTimestampsMs.TryDequeue(out _);
        }
    }

    public static Snapshot Compute(IEnumerable<PlayerSessionView> sessions) {
        var list = sessions as IList<PlayerSessionView> ?? sessions.ToList();
        NoteOnlinePresence(list);

        var now = NowMs();
        PrunePresence(now);
        PruneEks(now);

        var onlineNow = 0;
        foreach (var s in list) {
            if (s.Connected) {
                onlineNow++;
            }
        }

        return new Snapshot(
            OnlineNow: onlineNow,
            PlayersOnLast4h: LastSeenOnlineMs.Count,
            EksLast4h: EkTimestampsMs.Count,
            UpdatedAtUtc: DateTimeOffset.UtcNow);
    }

    /// <summary>
    /// Logs every 10 minutes; optionally POSTs to landing-api when REALM_STATS_* env set.
    /// </summary>
    public static async Task RunPushLoopAsync(
        Func<IReadOnlyList<PlayerSessionView>> snapshotSessions,
        CancellationToken cancellationToken) {
        var pushUrl = (Environment.GetEnvironmentVariable("REALM_STATS_PUSH_URL") ?? string.Empty).Trim();
        var secret = (Environment.GetEnvironmentVariable("REALM_STATS_SECRET") ?? string.Empty).Trim();
        var pushEnabled = !string.IsNullOrWhiteSpace(pushUrl) && !string.IsNullOrWhiteSpace(secret);
        if (!pushEnabled) {
            Console.WriteLine(
                "[RealmStats] External push disabled (optional REALM_STATS_PUSH_URL + REALM_STATS_SECRET). "
                + "Serving GET /api/realm-stats; sample every 60s; log every 10 min.");
        }

        using var http = pushEnabled ? new HttpClient { Timeout = TimeSpan.FromSeconds(12) } : null;
        if (http is not null) {
            http.DefaultRequestHeaders.TryAddWithoutValidation("X-Realm-Stats-Secret", secret);
        }

        var ticks = 0;
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(60));
        try {
            var boot = Compute(snapshotSessions());
            Console.WriteLine(
                $"[RealmStats] boot onlineNow={boot.OnlineNow} on4h={boot.PlayersOnLast4h} ek4h={boot.EksLast4h}");
            if (http is not null && pushEnabled) {
                await PushOnceAsync(http, pushUrl, boot).ConfigureAwait(false);
            }
        } catch (Exception ex) {
            Console.Error.WriteLine($"[RealmStats] Initial sample failed: {ex.Message}");
        }

        while (await timer.WaitForNextTickAsync(cancellationToken).ConfigureAwait(false)) {
            ticks++;
            try {
                var snap = Compute(snapshotSessions());
                if (ticks == 1 || ticks % 10 == 0) {
                    Console.WriteLine(
                        $"[RealmStats] onlineNow={snap.OnlineNow} on4h={snap.PlayersOnLast4h} ek4h={snap.EksLast4h}");
                }
                if (http is not null && pushEnabled) {
                    await PushOnceAsync(http, pushUrl, snap).ConfigureAwait(false);
                }
            } catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) {
                throw;
            } catch (Exception ex) {
                Console.Error.WriteLine($"[RealmStats] Sample/push failed: {ex.Message}");
            }
        }
    }

    static async Task PushOnceAsync(HttpClient http, string pushUrl, Snapshot snap) {
        var payload = new PushBody(
            snap.OnlineNow,
            snap.PlayersOnLast4h,
            snap.EksLast4h,
            snap.UpdatedAtUtc);
        using var response = await http.PostAsJsonAsync(pushUrl, payload).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode) {
            var body = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            throw new InvalidOperationException($"HTTP {(int)response.StatusCode}: {body}");
        }
    }

    sealed record PushBody(
        [property: JsonPropertyName("online")] int Online,
        [property: JsonPropertyName("playersOnLast4h")] int PlayersOnLast4h,
        [property: JsonPropertyName("eksLast4h")] int EksLast4h,
        [property: JsonPropertyName("updatedAtUtc")] DateTimeOffset UpdatedAtUtc);
}
