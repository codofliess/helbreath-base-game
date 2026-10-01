namespace Server.Helpers;

/// <summary>Stream URL classification shared by the cartelera (<see cref="StreamDirectory"/>) and Arena pacts.</summary>
public static class StreamLinks {
    public const string PlatformX = "x";

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

    /// <summary>Canonical form used to stop one X stream from paying more than one wallet a day.</summary>
    public static string CanonicalXKey(string url) {
        if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri)) {
            return url.Trim().ToLowerInvariant();
        }
        var parts = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length >= 3 && string.Equals(parts[1], "status", StringComparison.OrdinalIgnoreCase)) {
            return $"x/status/{parts[2]}";
        }
        if (parts.Length >= 3 && string.Equals(parts[1], "broadcasts", StringComparison.OrdinalIgnoreCase)) {
            return $"x/broadcasts/{parts[2]}";
        }
        return $"x{uri.AbsolutePath.ToLowerInvariant().TrimEnd('/')}";
    }

    static bool IsXHost(string host) {
        var h = host.ToLowerInvariant();
        return h is "x.com" or "twitter.com" or "mobile.x.com" or "mobile.twitter.com" or "www.x.com" or "www.twitter.com";
    }
}
