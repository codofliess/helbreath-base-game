namespace Server.Helpers;

/// <summary>Stream URL classification shared by the cartelera (<see cref="StreamDirectory"/>) and Arena pacts.</summary>
public static class StreamLinks {
    public const string PlatformX = "x";

    /// <summary>
    /// Broadcast-id and status-id of the same X live (same listing swapped between the two official URL forms).
    /// </summary>
    static readonly object AliasGate = new();
    static readonly Dictionary<string, string> AliasParent = new(StringComparer.Ordinal);

    /// <summary>twitch | youtube | discord | x | other (null for empty / unparseable).</summary>
    public static string? DetectPlatform(string? url) {
        if (string.IsNullOrWhiteSpace(url)) {
            return null;
        }
        if (Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri) && IsXHost(uri.Host)) {
            return PlatformX;
        }
        var u = url.ToLowerInvariant();
        if (u.Contains("twitch.tv") || u.Contains("twitch.com")) {
            return "twitch";
        }
        if (u.Contains("youtube.com") || u.Contains("youtu.be")) {
            return "youtube";
        }
        if (u.Contains("discord") || u.Contains("discordapp")) {
            return "discord";
        }
        return "other";
    }

    /// <summary>
    /// True for a link to one specific X live video: <c>x.com/i/broadcasts/&lt;id&gt;</c> or
    /// <c>x.com/&lt;user&gt;/status/&lt;id&gt;</c> (twitter.com too). A bare profile or home link is not a stream.
    /// </summary>
    public static bool IsXLiveUrl(string? url) {
        if (string.IsNullOrWhiteSpace(url) ||
            !Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri) ||
            !IsXHost(uri.Host)) {
            return false;
        }
        var parts = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length >= 3 &&
            string.Equals(parts[0], "i", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(parts[1], "broadcasts", StringComparison.OrdinalIgnoreCase)) {
            return parts[2].Length > 0;
        }
        return parts.Length >= 3 &&
               string.Equals(parts[1], "status", StringComparison.OrdinalIgnoreCase) &&
               parts[2].Length > 0 &&
               parts[2].All(char.IsAsciiDigit);
    }

    /// <summary>
    /// Canonical form used to stop one X stream from paying more than one wallet a day.
    /// Broadcast and status URLs that share an id collapse to the same key (<c>x/{id}</c>).
    /// </summary>
    public static string CanonicalXKey(string url) {
        if (TryGetXLiveId(url, out var id)) {
            return $"x/{id}";
        }
        if (Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri)) {
            return $"x{uri.AbsolutePath.ToLowerInvariant().TrimEnd('/')}";
        }
        return url.Trim().ToLowerInvariant();
    }

    /// <summary>
    /// Keys that identify the same X live for <see cref="HellMiningStore.AwardXStreamDay"/>:
    /// current and legacy prefixes for this id, plus a broadcast↔status pair recorded on one listing.
    /// </summary>
    public static IReadOnlyList<string> AllPaymentKeys(string urlOrKey) {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var queue = new Queue<string>();
        foreach (var k in PaymentKeys(urlOrKey)) {
            if (seen.Add(k)) {
                queue.Enqueue(k);
            }
        }
        lock (AliasGate) {
            while (queue.Count > 0) {
                var root = AliasRoot(queue.Dequeue());
                foreach (var other in AliasParent.Keys.ToList()) {
                    if (!string.Equals(AliasRoot(other), root, StringComparison.Ordinal)) {
                        continue;
                    }
                    foreach (var pk in PaymentKeys(other)) {
                        if (seen.Add(pk)) {
                            queue.Enqueue(pk);
                        }
                    }
                }
            }
        }
        return seen.ToList();
    }

    /// <summary>
    /// Same cartelera/duel slot moved between <c>/i/broadcasts/…</c> and <c>/status/…</c> — treat as one live.
    /// </summary>
    public static void RememberXLiveUrlSwap(string? previousUrl, string? nextUrl) {
        if (!IsXLiveUrl(previousUrl) || !IsXLiveUrl(nextUrl) ||
            IsBroadcastUrl(previousUrl) == IsBroadcastUrl(nextUrl)) {
            return;
        }
        var a = CanonicalXKey(previousUrl!);
        var b = CanonicalXKey(nextUrl!);
        if (string.Equals(a, b, StringComparison.Ordinal)) {
            return;
        }
        lock (AliasGate) {
            var ra = AliasRoot(a);
            var rb = AliasRoot(b);
            if (!string.Equals(ra, rb, StringComparison.Ordinal)) {
                AliasParent[rb] = ra;
            }
        }
    }

    static IReadOnlyList<string> PaymentKeys(string urlOrKey) {
        if (!TryGetXLiveId(urlOrKey, out var id)) {
            return [CanonicalXKey(urlOrKey)];
        }
        return [$"x/{id}", $"x/status/{id}", $"x/broadcasts/{id}"];
    }

    static bool TryGetXLiveId(string urlOrKey, out string id) {
        id = "";
        if (string.IsNullOrWhiteSpace(urlOrKey)) {
            return false;
        }
        var raw = urlOrKey.Trim();
        if (raw.StartsWith("x/", StringComparison.OrdinalIgnoreCase)) {
            var rest = raw[2..];
            if (rest.StartsWith("status/", StringComparison.OrdinalIgnoreCase)) {
                rest = rest["status/".Length];
            } else if (rest.StartsWith("broadcasts/", StringComparison.OrdinalIgnoreCase)) {
                rest = rest["broadcasts/".Length];
            }
            var slash = rest.IndexOf('/');
            if (slash >= 0) {
                rest = rest[..slash];
            }
            if (rest.Length == 0) {
                return false;
            }
            id = rest.ToLowerInvariant();
            return true;
        }
        if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri) || !IsXHost(uri.Host)) {
            return false;
        }
        var parts = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (IsBroadcastPath(parts) || IsStatusPath(parts)) {
            id = parts[2].ToLowerInvariant();
            return id.Length > 0;
        }
        return false;
    }

    static bool IsBroadcastUrl(string? url) =>
        url is not null &&
        Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri) &&
        IsBroadcastPath(uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries));

    static bool IsBroadcastPath(string[] parts) =>
        parts.Length >= 3 &&
        string.Equals(parts[0], "i", StringComparison.OrdinalIgnoreCase) &&
        string.Equals(parts[1], "broadcasts", StringComparison.OrdinalIgnoreCase);

    static bool IsStatusPath(string[] parts) =>
        parts.Length >= 3 &&
        string.Equals(parts[1], "status", StringComparison.OrdinalIgnoreCase) &&
        parts[2].Length > 0 &&
        parts[2].All(char.IsAsciiDigit);

    static string AliasRoot(string key) {
        if (!AliasParent.TryGetValue(key, out var parent) || string.Equals(parent, key, StringComparison.Ordinal)) {
            AliasParent[key] = key;
            return key;
        }
        return AliasParent[key] = AliasRoot(parent);
    }

    static bool IsXHost(string host) {
        var h = host.ToLowerInvariant();
        return h is "x.com" or "twitter.com" or "mobile.x.com" or "mobile.twitter.com" or "www.x.com" or "www.twitter.com";
    }
}
