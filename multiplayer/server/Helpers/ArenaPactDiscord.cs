using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Server.Helpers;

/// <summary>
/// Publishes public PVP duels to Discord:
/// - Channel webhook embed (DISCORD_PVP_WEBHOOK_URL or DISCORD_WEBHOOK_URL)
/// - Optional Guild Scheduled Event (DISCORD_BOT_TOKEN + DISCORD_GUILD_ID)
/// </summary>
public static class ArenaPactDiscord {
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(12) };
    private static string? _webhookUrl;
    private static string? _botToken;
    private static string? _guildId;
    private static string _watchBase = "https://play.chainlords.net";
    private static bool _loaded;

    public static void EnsureLoaded() {
        if (_loaded) {
            return;
        }
        _loaded = true;
        _webhookUrl = FirstEnv("DISCORD_PVP_WEBHOOK_URL", "DISCORD_WEBHOOK_URL");
        _botToken = Environment.GetEnvironmentVariable("DISCORD_BOT_TOKEN")?.Trim();
        _guildId = Environment.GetEnvironmentVariable("DISCORD_GUILD_ID")?.Trim();
        var baseUrl = Environment.GetEnvironmentVariable("CHAINLORDS_PUBLIC_URL")?.Trim();
        if (!string.IsNullOrWhiteSpace(baseUrl)) {
            _watchBase = baseUrl.TrimEnd('/');
        }
        if (!string.IsNullOrWhiteSpace(_webhookUrl)) {
            Console.WriteLine("[ArenaPactDiscord] PVP webhook configured.");
        }
        if (!string.IsNullOrWhiteSpace(_botToken) && !string.IsNullOrWhiteSpace(_guildId)) {
            Console.WriteLine("[ArenaPactDiscord] Scheduled Events bot configured.");
        }
    }

    private static string? FirstEnv(params string[] keys) {
        foreach (var k in keys) {
            var v = Environment.GetEnvironmentVariable(k)?.Trim();
            if (!string.IsNullOrWhiteSpace(v)) {
                return v;
            }
        }
        return null;
    }

    public static string BuildWatchUrl(string matchId) =>
        $"{_watchBase}/?watch={Uri.EscapeDataString(matchId)}";

    public static void NotifyPublicDuelCreated(ArenaPact.PublicDuelDto duel) {
        EnsureLoaded();
        if (!duel.IsPublic) {
            return;
        }
        _ = Task.Run(async () => {
            try {
                await PostWebhookAsync(duel).ConfigureAwait(false);
                await CreateScheduledEventAsync(duel).ConfigureAwait(false);
            } catch (Exception ex) {
                Console.WriteLine($"[ArenaPactDiscord] Notify failed: {ex.Message}");
            }
        });
    }

    public static void NotifyPublicDuelLive(ArenaPact.PublicDuelDto duel) {
        EnsureLoaded();
        if (!duel.IsPublic || string.IsNullOrWhiteSpace(_webhookUrl)) {
            return;
        }
        _ = Task.Run(async () => {
            try {
                var embed = new Dictionary<string, object?> {
                    ["title"] = $"🔴 LIVE · {duel.Title}",
                    ["description"] = BuildDescription(duel, live: true),
                    ["color"] = 0xE74C3C,
                    ["url"] = duel.WatchUrl,
                    ["timestamp"] = DateTime.UtcNow.ToString("o"),
                };
                await PostJsonAsync(_webhookUrl!, new { embeds = new[] { embed }, content = "🔴 **PVP duel is LIVE** — Watch multi-cam:" }).ConfigureAwait(false);
            } catch (Exception ex) {
                Console.WriteLine($"[ArenaPactDiscord] Live notify failed: {ex.Message}");
            }
        });
    }

    private static string BuildDescription(ArenaPact.PublicDuelDto d, bool live) {
        var fighters = string.Join(" vs ", d.Fighters.Select(f => f.Name));
        var stake = d.StakeAmount > 0
            ? $"Bolsa **{d.StakeAmount} {d.StakeAssetId ?? "USDT"}** each"
            : "For **Honor**";
        var streams = new List<string>();
        if (!string.IsNullOrWhiteSpace(d.GlobalStreamUrl)) {
            streams.Add($"🌐 Global cam: {d.GlobalStreamUrl}");
        }
        foreach (var f in d.Fighters.Where(x => !string.IsNullOrWhiteSpace(x.StreamUrl))) {
            streams.Add($"📷 POV {f.Name}: {f.StreamUrl}");
        }
        var streamBlock = streams.Count > 0 ? "\n" + string.Join("\n", streams) : "\n_No streams linked yet — fighters can set POV URLs in-game._";
        var when = DateTimeOffset.FromUnixTimeMilliseconds(d.OpensAtMs).UtcDateTime.ToString("yyyy-MM-dd HH:mm") + " UTC";
        return
            $"**{fighters}**\n" +
            $"Map: `{d.MapId}` · {stake}\n" +
            (live ? "Status: **LIVE**\n" : $"Opens: **{when}** · `{d.Status}`\n") +
            $"Watch: {d.WatchUrl}" +
            streamBlock;
    }

    private static async Task PostWebhookAsync(ArenaPact.PublicDuelDto duel) {
        if (string.IsNullOrWhiteSpace(_webhookUrl)) {
            return;
        }
        var embed = new Dictionary<string, object?> {
            ["title"] = $"⚔️ {duel.Title}",
            ["description"] = BuildDescription(duel, live: false),
            ["color"] = 0xC9A227,
            ["url"] = duel.WatchUrl,
            ["footer"] = new { text = "Chain Lords · PVP cartelera" },
            ["timestamp"] = DateTimeOffset.FromUnixTimeMilliseconds(duel.OpensAtMs).UtcDateTime.ToString("o"),
        };
        await PostJsonAsync(_webhookUrl!, new {
            content = "📅 **New PVP duel on the cartelera** (Discord Event if bot configured)",
            embeds = new[] { embed },
        }).ConfigureAwait(false);
    }

    private static async Task CreateScheduledEventAsync(ArenaPact.PublicDuelDto duel) {
        if (string.IsNullOrWhiteSpace(_botToken) || string.IsNullOrWhiteSpace(_guildId)) {
            return;
        }
        // External event (location = watch URL). Start must be in the future for Discord.
        var start = DateTimeOffset.FromUnixTimeMilliseconds(duel.OpensAtMs);
        if (start < DateTimeOffset.UtcNow.AddMinutes(1)) {
            start = DateTimeOffset.UtcNow.AddMinutes(2);
        }
        var end = start.AddMinutes(30);
        var body = new Dictionary<string, object?> {
            ["name"] = Truncate(duel.Title, 100),
            ["description"] = Truncate(BuildDescription(duel, live: false), 1000),
            ["scheduled_start_time"] = start.UtcDateTime.ToString("o"),
            ["scheduled_end_time"] = end.UtcDateTime.ToString("o"),
            ["privacy_level"] = 2, // GUILD_ONLY
            ["entity_type"] = 3, // EXTERNAL
            ["entity_metadata"] = new { location = Truncate(duel.WatchUrl ?? _watchBase, 100) },
        };
        using var req = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://discord.com/api/v10/guilds/{_guildId}/scheduled-events");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bot", _botToken);
        req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        using var res = await Http.SendAsync(req).ConfigureAwait(false);
        if (!res.IsSuccessStatusCode) {
            var err = await res.Content.ReadAsStringAsync().ConfigureAwait(false);
            Console.WriteLine($"[ArenaPactDiscord] Scheduled event HTTP {(int)res.StatusCode}: {err}");
        } else {
            Console.WriteLine($"[ArenaPactDiscord] Scheduled event created for {duel.MatchId}");
        }
    }

    private static async Task PostJsonAsync(string url, object payload) {
        using var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        using var res = await Http.PostAsync(url, content).ConfigureAwait(false);
        if (!res.IsSuccessStatusCode) {
            var err = await res.Content.ReadAsStringAsync().ConfigureAwait(false);
            Console.WriteLine($"[ArenaPactDiscord] Webhook HTTP {(int)res.StatusCode}: {err}");
        }
    }

    private static string Truncate(string? s, int max) {
        s ??= "";
        return s.Length <= max ? s : s[..(max - 1)] + "…";
    }
}
