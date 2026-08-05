using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Public stream cartelera: World MMORPG Go-Live + (future) tournament slots.
/// PVP duel streams live primarily on ArenaPact; this directory merges for /api/streams.
/// </summary>
public static class StreamDirectory {
    public const int DefaultTtlHours = 6;
    public const int MaxActivePerPlayer = 1;
    public const int MaxTitleLen = 80;

    private static readonly ConcurrentDictionary<string, Broadcast> ById = new(StringComparer.OrdinalIgnoreCase);
    private static readonly ConcurrentDictionary<Guid, string> IdBySession = new();
    private static long _seq;
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(10) };

    public sealed class Broadcast {
        public required string Id { get; init; }
        /// <summary>world | tournament | other</summary>
        public required string Kind { get; set; }
        public required string Title { get; set; }
        public required string CharacterName { get; set; }
        public string Wallet { get; set; } = "";
        public Guid SessionId { get; set; }
        public string? StreamUrl { get; set; }
        public string? StreamPlatform { get; set; }
        public string WorldId { get; set; } = "";
        public long StartedAtMs { get; init; }
        public long ExpiresAtMs { get; set; }
        public bool Active { get; set; } = true;
    }

    public sealed class BroadcastDto {
        public required string Id { get; init; }
        public required string Kind { get; init; }
        public required string Title { get; init; }
        public required string CharacterName { get; init; }
        public string? StreamUrl { get; init; }
        public string? StreamPlatform { get; init; }
        public string WorldId { get; init; } = "";
        public long StartedAtMs { get; init; }
        public long ExpiresAtMs { get; init; }
        public string Status { get; init; } = "live";
    }

    public static void HandleAnnounce(GameWorldRef wr, GameWorldPlayer player, StreamBroadcastRequest req) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(req);
        PurgeExpired();

        var kind = NormalizeKind(req.Kind);
        var active = req.Active;
        var url = NormalizeStreamUrl(req.StreamUrl);
        var title = (req.Title ?? "").Trim();
        if (title.Length == 0) {
            title = kind switch {
                "tournament" => $"Tournament · {player.CharacterName}",
                "world" => $"World · {player.CharacterName}",
                _ => $"Live · {player.CharacterName}",
            };
        }
        if (title.Length > MaxTitleLen) {
            title = title[..MaxTitleLen];
        }

        if (!active) {
            if (IdBySession.TryRemove(player.SessionId, out var stopId) &&
                ById.TryRemove(stopId, out var stopped)) {
                stopped.Active = false;
                SendAck(player, stopped, "Stream removed from cartelera.");
            } else {
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                    "[Stream] No active broadcast to stop."));
            }
            _ = wr;
            return;
        }

        if (url is null) {
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                "[Stream] Need a valid https stream URL (Twitch / YouTube / Discord invite)."));
            return;
        }

        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        // Optional display only — world id not always on player entity.
        var worldId = "";
        _ = wr;

        if (IdBySession.TryGetValue(player.SessionId, out var existingId) &&
            ById.TryGetValue(existingId, out var existing)) {
            existing.Title = title;
            existing.StreamUrl = url;
            existing.StreamPlatform = DetectPlatform(url);
            existing.WorldId = worldId;
            existing.CharacterName = player.CharacterName;
            existing.ExpiresAtMs = now + DefaultTtlHours * 3600_000L;
            existing.Active = true;
            existing.Kind = kind;
            SendAck(player, existing, "Stream updated on cartelera.");
            NotifyDiscord(existing, updated: true);
            _ = wr;
            return;
        }

        var id = $"stream-{Interlocked.Increment(ref _seq):x}-{now:x}";
        var b = new Broadcast {
            Id = id,
            Kind = kind,
            Title = title,
            CharacterName = player.CharacterName,
            Wallet = player.AccountWallet ?? "",
            SessionId = player.SessionId,
            StreamUrl = url,
            StreamPlatform = DetectPlatform(url),
            WorldId = worldId,
            StartedAtMs = now,
            ExpiresAtMs = now + DefaultTtlHours * 3600_000L,
            Active = true,
        };
        ById[id] = b;
        IdBySession[player.SessionId] = id;
        SendAck(player, b, "You're LIVE on the cartelera (World / multi-cam).");
        NotifyDiscord(b, updated: false);
        _ = wr;
    }

    public static void OnPlayerLeft(GameWorldPlayer player) {
        if (!IdBySession.TryRemove(player.SessionId, out var id)) {
            return;
        }
        ById.TryRemove(id, out _);
    }

    public static IReadOnlyList<BroadcastDto> ListLive(string? kindFilter = null) {
        PurgeExpired();
        var list = new List<BroadcastDto>();
        foreach (var b in ById.Values) {
            if (!b.Active) {
                continue;
            }
            if (!string.IsNullOrWhiteSpace(kindFilter) &&
                !string.Equals(b.Kind, kindFilter, StringComparison.OrdinalIgnoreCase)) {
                continue;
            }
            list.Add(ToDto(b));
        }
        return list.OrderByDescending(x => x.StartedAtMs).ToList();
    }

    /// <summary>Unified payload for landing + Discord + Watch multi-stage UI.</summary>
    public static object BuildCarteleraSnapshot() {
        PurgeExpired();
        var pvpUpcoming = ArenaPact.ListPublicUpcoming();
        var pvpLive = ArenaPact.ListPublicLive();
        var worldLive = ListLive("world");
        var tournamentLive = ListLive("tournament");
        var otherLive = ListLive("other");

        return new {
            // Stage is always "present" — UI shows multi-cam shell even when empty (apagada).
            stageReady = true,
            powered = true,
            note = "Cartelera multi-cam: PVP duels · World MMORPG · Tournaments. Empty slots stay visible until streams schedule.",
            updatedAtUtc = DateTime.UtcNow,
            source = "game-server",
            stages = new {
                pvp = new {
                    enabled = true,
                    label = "PVP Duels",
                    live = pvpLive,
                    upcoming = pvpUpcoming,
                },
                world = new {
                    enabled = true,
                    label = "Helbreath World",
                    description = "Hunting, raiding, open-world — anyone can Go Live from in-game.",
                    live = worldLive,
                },
                tournament = new {
                    enabled = true,
                    label = "Tournaments",
                    description = "Brackets & event streams (schedule via Go Live kind=tournament or future board).",
                    live = tournamentLive,
                    upcoming = Array.Empty<object>(),
                },
                other = new {
                    enabled = true,
                    label = "Other",
                    live = otherLive,
                },
            },
            // Flat list for simple consumers (www.chainlords.net hero).
            allLive = BuildFlatLive(pvpLive, worldLive, tournamentLive, otherLive),
        };
    }

    private static List<object> BuildFlatLive(
        IReadOnlyList<ArenaPact.PublicDuelDto> pvp,
        IReadOnlyList<BroadcastDto> world,
        IReadOnlyList<BroadcastDto> tourney,
        IReadOnlyList<BroadcastDto> other) {
        var list = new List<object>();
        foreach (var d in pvp) {
            list.Add(new {
                kind = "pvp",
                id = d.MatchId,
                title = d.Title,
                status = d.Status,
                characterName = d.HostName,
                watchUrl = d.WatchUrl,
                streamUrl = d.GlobalStreamUrl,
                fighters = d.Fighters,
            });
        }
        foreach (var w in world) {
            list.Add(new {
                kind = "world",
                id = w.Id,
                title = w.Title,
                status = "live",
                characterName = w.CharacterName,
                watchUrl = (string?)null,
                streamUrl = w.StreamUrl,
                worldId = w.WorldId,
            });
        }
        foreach (var t in tourney) {
            list.Add(new {
                kind = "tournament",
                id = t.Id,
                title = t.Title,
                status = "live",
                characterName = t.CharacterName,
                streamUrl = t.StreamUrl,
            });
        }
        foreach (var o in other) {
            list.Add(new {
                kind = "other",
                id = o.Id,
                title = o.Title,
                status = "live",
                characterName = o.CharacterName,
                streamUrl = o.StreamUrl,
            });
        }
        return list;
    }

    private static void SendAck(GameWorldPlayer player, Broadcast b, string msg) {
        NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage($"[Stream] {msg} ({b.Kind}: {b.Title})"));
        NetworkManager.SendToPlayer(player, new ServerMessage {
            StreamBroadcastState = new StreamBroadcastState {
                BroadcastId = b.Id,
                Kind = b.Kind,
                Title = b.Title,
                CharacterName = b.CharacterName,
                StreamUrl = b.StreamUrl ?? "",
                StreamPlatform = b.StreamPlatform ?? "",
                WorldId = b.WorldId,
                StartedAtMs = b.StartedAtMs,
                ExpiresAtMs = b.ExpiresAtMs,
                Active = b.Active,
            },
        });
    }

    private static BroadcastDto ToDto(Broadcast b) => new() {
        Id = b.Id,
        Kind = b.Kind,
        Title = b.Title,
        CharacterName = b.CharacterName,
        StreamUrl = b.StreamUrl,
        StreamPlatform = b.StreamPlatform,
        WorldId = b.WorldId,
        StartedAtMs = b.StartedAtMs,
        ExpiresAtMs = b.ExpiresAtMs,
        Status = "live",
    };

    private static void PurgeExpired() {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        foreach (var kv in ById) {
            if (kv.Value.ExpiresAtMs < now || !kv.Value.Active) {
                ById.TryRemove(kv.Key, out _);
                IdBySession.TryRemove(kv.Value.SessionId, out _);
            }
        }
    }

    private static string NormalizeKind(string? k) {
        var s = (k ?? "world").Trim().ToLowerInvariant();
        return s switch {
            "tournament" or "tourney" or "bracket" => "tournament",
            "pvp" or "duel" => "world", // pvp duels use ArenaPact; redirect free announces to world label
            "other" or "misc" => "other",
            _ => "world",
        };
    }

    private static string? NormalizeStreamUrl(string? raw) {
        if (string.IsNullOrWhiteSpace(raw)) {
            return null;
        }
        var u = raw.Trim();
        if (u.Length > 400) {
            u = u[..400];
        }
        if (!Uri.TryCreate(u, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)) {
            return null;
        }
        return uri.ToString();
    }

    private static string? DetectPlatform(string? url) {
        if (string.IsNullOrWhiteSpace(url)) {
            return null;
        }
        var u = url.ToLowerInvariant();
        if (u.Contains("twitch")) {
            return "twitch";
        }
        if (u.Contains("youtube") || u.Contains("youtu.be")) {
            return "youtube";
        }
        if (u.Contains("discord")) {
            return "discord";
        }
        return "other";
    }

    private static void NotifyDiscord(Broadcast b, bool updated) {
        var webhook = Environment.GetEnvironmentVariable("DISCORD_PVP_WEBHOOK_URL")?.Trim()
                      ?? Environment.GetEnvironmentVariable("DISCORD_WEBHOOK_URL")?.Trim();
        if (string.IsNullOrWhiteSpace(webhook)) {
            return;
        }
        _ = Task.Run(async () => {
            try {
                var kindLabel = b.Kind switch {
                    "tournament" => "Tournament",
                    "world" => "Helbreath World",
                    _ => "Live",
                };
                var embed = new Dictionary<string, object?> {
                    ["title"] = updated ? $"📡 Updated · {b.Title}" : $"📡 LIVE · {kindLabel}",
                    ["description"] =
                        $"**{b.CharacterName}** is streaming ({kindLabel})\n" +
                        (string.IsNullOrWhiteSpace(b.WorldId) ? "" : $"World: `{b.WorldId}`\n") +
                        $"Watch: {b.StreamUrl}\n" +
                        $"Cartelera: https://play.chainlords.net/?watch=streams",
                    ["color"] = b.Kind == "tournament" ? 0x9B59B6 : 0x3498DB,
                    ["timestamp"] = DateTime.UtcNow.ToString("o"),
                    ["footer"] = new { text = "Chain Lords · Live cartelera" },
                };
                using var content = new StringContent(
                    JsonSerializer.Serialize(new { embeds = new[] { embed } }),
                    Encoding.UTF8,
                    "application/json");
                await Http.PostAsync(webhook, content).ConfigureAwait(false);
            } catch (Exception ex) {
                Console.WriteLine($"[StreamDirectory] Discord notify: {ex.Message}");
            }
        });
    }
}
