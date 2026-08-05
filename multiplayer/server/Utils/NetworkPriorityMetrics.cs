using System.Diagnostics;
using System.Text.Json;

namespace Server.Utils;

/// <summary>
/// Process-wide counters for priority-queue A/B reporting (journal + JSON under Chars/reports).
/// Safe to call from many connections; Interlocked only.
/// </summary>
public static class NetworkPriorityMetrics {
    static long outboundHigh;
    static long outboundNormal;
    static long outboundHighWhenNormalPending;
    static long flushCycles;
    static long normalSentAfterHighDrain;
    static readonly long startedAtUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    static long lastReportUnixMs = startedAtUnixMs;
    static readonly object ReportGate = new();

    public static void RecordOutboundEnqueued(NetworkPriority.Class cls, bool otherQueueHadPending) {
        if (cls == NetworkPriority.Class.High) {
            Interlocked.Increment(ref outboundHigh);
            if (otherQueueHadPending) {
                Interlocked.Increment(ref outboundHighWhenNormalPending);
            }
        } else {
            Interlocked.Increment(ref outboundNormal);
        }
    }

    public static void RecordFlushCycle(int highSent, int normalSent) {
        Interlocked.Increment(ref flushCycles);
        if (normalSent > 0 && highSent > 0) {
            Interlocked.Add(ref normalSentAfterHighDrain, normalSent);
        }
    }

    public static object Snapshot() {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        return new {
            utcNow = DateTimeOffset.UtcNow.ToString("o"),
            uptimeSec = (now - startedAtUnixMs) / 1000.0,
            outboundHigh = Interlocked.Read(ref outboundHigh),
            outboundNormal = Interlocked.Read(ref outboundNormal),
            /// How often a combat packet was enqueued while meta packets were already waiting (queue pressure signal).
            highEnqueuedWhileNormalPending = Interlocked.Read(ref outboundHighWhenNormalPending),
            flushCycles = Interlocked.Read(ref flushCycles),
            normalSentAfterHighDrain = Interlocked.Read(ref normalSentAfterHighDrain),
        };
    }

    /// <summary>Periodic journal + JSON report (call from background loop).</summary>
    public static void MaybeWriteReport(string reportsDirectory, int minIntervalSec = 300) {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        lock (ReportGate) {
            if (now - lastReportUnixMs < minIntervalSec * 1000L) {
                return;
            }
            lastReportUnixMs = now;
        }

        try {
            var snap = Snapshot();
            var json = JsonSerializer.Serialize(snap, new JsonSerializerOptions { WriteIndented = true });
            Console.WriteLine(
                $"[NetworkPriority] high={Interlocked.Read(ref outboundHigh)} normal={Interlocked.Read(ref outboundNormal)} " +
                $"highWhileNormalPending={Interlocked.Read(ref outboundHighWhenNormalPending)} flushes={Interlocked.Read(ref flushCycles)}");
            Directory.CreateDirectory(reportsDirectory);
            var day = DateTimeOffset.UtcNow.ToString("yyyy-MM-dd");
            var path = Path.Combine(reportsDirectory, $"net-priority-{day}.json");
            // Append-friendly: write latest snapshot + history line in a sidecar log.
            File.WriteAllText(path, json);
            File.AppendAllText(
                Path.Combine(reportsDirectory, $"net-priority-{day}.log"),
                $"{DateTimeOffset.UtcNow:o} {json.Replace('\n', ' ').Replace('\r', ' ')}{Environment.NewLine}");
        } catch (Exception ex) {
            Console.Error.WriteLine($"[NetworkPriority] report failed: {ex.Message}");
        }
    }
}
