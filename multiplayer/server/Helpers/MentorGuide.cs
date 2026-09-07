using System.Collections.Concurrent;
using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Server.Helpers;

/// <summary>
/// New-player mentor: local beginner-path / auction answers, optional xAI Grok 4.6 (reasoning low).
/// Local answers always work and are the fallback when no API key or the chat call fails.
/// </summary>
public static class MentorGuide {
    public const string DefaultModel = "grok-4.6";
    public const string ChatCompletionsUrl = "https://api.x.ai/v1/chat/completions";
    public const int MaxMessageChars = 500;
    public const int RateLimitMaxHits = 20;
    public const int RateLimitWindowMs = 60_000;

    /// <summary>Shared HTTP client for optional Grok calls (process lifetime).</summary>
    static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(18) };

    /// <summary>IP → recent request timestamps (ms since epoch). In-memory; resets on process restart.</summary>
    static readonly ConcurrentDictionary<string, ConcurrentQueue<long>> HitsByIp =
        new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Classifies a player line as follow-me, market price, or open chat.</summary>
    public static MentorIntent ClassifyIntent(string? message) {
        var folded = Fold(message);
        if (folded.Length == 0) {
            return MentorIntent.Guide;
        }

        if (IsPriceIntent(folded)) {
            return MentorIntent.Price;
        }

        if (IsGuideIntent(folded)) {
            return MentorIntent.Guide;
        }

        return MentorIntent.Chat;
    }

    /// <summary>
    /// Next recommended beginner step from live catalog bands and optional active quest.
    /// </summary>
    public static MentorNowAdvice RecommendNow(int level, bool enrolled, string? activeTitle, string? activeHint) {
        var title = (activeTitle ?? "").Trim();
        var hint = (activeHint ?? "").Trim();
        if (enrolled && title.Length > 0) {
            return new MentorNowAdvice {
                Title = title,
                Hint = hint,
                QuestId = "",
                LevelGuideMin = 0,
                LevelGuideMax = 0,
                Enrolled = true,
                UsedActiveQuest = true,
            };
        }

        var quest = BeginnerPath.RecommendQuestForLevel(level);
        if (quest is null) {
            return new MentorNowAdvice {
                Title = "Camino principiante",
                Hint = enrolled
                    ? "El camino 1→80 está completo. Arena (Shift+F10) y farm barracks siguen disponibles."
                    : "Inscríbete con Enzu en la granja (F5 Quest). Es opcional y sin penalización.",
                Enrolled = enrolled,
            };
        }

        var useHint = quest.Hint ?? "";
        if (!enrolled && !string.Equals(quest.ObjectiveKind, "enroll", StringComparison.OrdinalIgnoreCase)) {
            useHint = "Primero inscríbete con Enzu en la granja (F5 Quest), luego: " + useHint;
        }

        return new MentorNowAdvice {
            Title = quest.Title ?? quest.Id,
            Hint = useHint,
            QuestId = quest.Id,
            LevelGuideMin = quest.LevelGuideMin,
            LevelGuideMax = quest.LevelGuideMax,
            Enrolled = enrolled,
        };
    }

    /// <summary>Local-only reply used by tests and as Grok fallback.</summary>
    public static MentorChatReply AnswerLocal(MentorChatRequest request) {
        ArgumentNullException.ThrowIfNull(request);
        var intent = ClassifyIntent(request.Message);
        return intent switch {
            MentorIntent.Price => new MentorChatReply {
                Reply = FormatPriceReply(request.Message),
                Source = "local",
                Kind = "price",
            },
            MentorIntent.Guide => new MentorChatReply {
                Reply = FormatGuideReply(request),
                Source = "local",
                Kind = "guide",
            },
            _ => new MentorChatReply {
                Reply = FormatOpenChatReply(request),
                Source = "local",
                Kind = "chat",
            },
        };
    }

    /// <summary>Tries Grok 4.6 (low) when an API key is set; otherwise returns <see cref="AnswerLocal"/>.</summary>
    public static async Task<MentorChatReply> ChatAsync(MentorChatRequest request, CancellationToken ct = default) {
        ArgumentNullException.ThrowIfNull(request);
        request.Message = Truncate((request.Message ?? "").Trim(), MaxMessageChars);
        var local = AnswerLocal(request);
        var key = ReadApiKey();
        if (string.IsNullOrWhiteSpace(key)) {
            return local;
        }

        try {
            var grok = await TryAskGrokAsync(key, request, local, ct).ConfigureAwait(false);
            if (!string.IsNullOrWhiteSpace(grok)) {
                return new MentorChatReply {
                    Reply = Truncate(grok.Trim(), 2000),
                    Source = "grok",
                    Kind = local.Kind,
                };
            }
        } catch (Exception ex) {
            Console.WriteLine($"[Mentor] Grok call failed; using local answer. {ex.Message}");
        }

        return local;
    }

    /// <summary>Simple per-IP sliding window. Returns false when the caller should receive 429.</summary>
    public static bool TryAcceptRequest(string? ip, out string? limitedMessage) {
        limitedMessage = null;
        var key = string.IsNullOrWhiteSpace(ip) ? "unknown" : ip.Trim();
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var queue = HitsByIp.GetOrAdd(key, _ => new ConcurrentQueue<long>());
        queue.Enqueue(nowMs);
        while (queue.TryPeek(out var oldest) && nowMs - oldest > RateLimitWindowMs) {
            queue.TryDequeue(out _);
        }

        if (queue.Count <= RateLimitMaxHits) {
            return true;
        }

        limitedMessage = "Demasiadas preguntas seguidas. Espera un momento e inténtalo de nuevo.";
        return false;
    }

    /// <summary>Clears the in-memory rate window (unit tests only).</summary>
    public static void ResetRateLimitForTests() {
        HitsByIp.Clear();
    }

    static string FormatGuideReply(MentorChatRequest request) {
        var advice = RecommendNow(
            request.Level > 0 ? request.Level : 1,
            request.Enrolled,
            request.ActiveTitle,
            request.ActiveHint);
        var name = string.IsNullOrWhiteSpace(request.PlayerName) ? "aventurero" : request.PlayerName.Trim();
        var world = string.IsNullOrWhiteSpace(request.WorldId) ? "" : $" Estás en {request.WorldId.Trim()}.";
        var band = advice.LevelGuideMin > 0
            ? $" (guía nv. {advice.LevelGuideMin}–{advice.LevelGuideMax})"
            : "";
        return
            $"{name}, esto es lo que más te conviene ahora mismo.{world}\n" +
            $"• {advice.Title}{band}\n" +
            $"{advice.Hint}";
    }

    static string FormatOpenChatReply(MentorChatRequest request) {
        var guide = FormatGuideReply(request);
        return
            "Puedo ayudarte con el siguiente paso, precios aproximados del mercado, o lo que preguntes.\n" +
            "Si no hay clave Grok, uso la guía local:\n" +
            guide;
    }

    static string FormatPriceReply(string? message) {
        var itemQuery = ExtractItemQuery(message);
        var listings = AuctionBoardStore.GetActiveListings();
        if (listings.Count == 0) {
            return itemQuery.Length > 0
                ? $"No hay listings activos ahora para «{itemQuery}». El precio del mercado es aproximado cuando hay ofertas en el tablero."
                : "No hay listings activos en el tablero ahora. Cualquier precio de mercado sería aproximado cuando alguien publique.";
        }

        var matched = new List<(string Name, int Gold)>();
        foreach (var listing in listings) {
            var name = (listing.ItemName ?? "").Trim();
            if (name.Length == 0) {
                continue;
            }

            if (itemQuery.Length > 0 && !NamesOverlap(name, itemQuery)) {
                continue;
            }

            var gold = listing.CurrentBidGold > 0 ? listing.CurrentBidGold : listing.ListPriceGold;
            if (gold <= 0) {
                gold = listing.ListPriceGold;
            }

            if (gold > 0) {
                matched.Add((name, gold));
            }
        }

        if (matched.Count == 0) {
            var sample = SummarizeListings(listings, maxRows: 4);
            return itemQuery.Length > 0
                ? $"No vi «{itemQuery}» en el tablero. Precio aproximado no disponible para ese ítem. Muestra actual: {sample}"
                : $"Precios aproximados del tablero ahora: {sample}";
        }

        var min = matched.Min(m => m.Gold);
        var max = matched.Max(m => m.Gold);
        var avg = (int)Math.Clamp(Math.Round(matched.Average(m => (double)m.Gold)), 1, int.MaxValue);
        var label = itemQuery.Length > 0 ? itemQuery : matched[0].Name;
        if (min == max) {
            return
                $"El mercado paga un precio aproximado de {min} oro por «{label}» " +
                $"({matched.Count} listing{(matched.Count == 1 ? "" : "s")} activo{(matched.Count == 1 ? "" : "s")}).";
        }

        return
            $"El mercado paga un precio aproximado de {avg} oro por «{label}» " +
            $"(rango {min}–{max}, {matched.Count} listings). Es aproximado; las ofertas cambian.";
    }

    static string SummarizeListings(IReadOnlyList<AuctionListingRecord> listings, int maxRows) {
        var parts = new List<string>();
        foreach (var listing in listings) {
            if (parts.Count >= maxRows) {
                break;
            }

            var name = (listing.ItemName ?? "").Trim();
            if (name.Length == 0) {
                continue;
            }

            var gold = listing.CurrentBidGold > 0 ? listing.CurrentBidGold : listing.ListPriceGold;
            if (gold <= 0) {
                continue;
            }

            parts.Add($"{name} ~ {gold} oro");
        }

        return parts.Count == 0 ? "sin precios útiles" : string.Join("; ", parts);
    }

    static string BuildAuctionContext(int maxRows) {
        var listings = AuctionBoardStore.GetActiveListings();
        if (listings.Count == 0) {
            return "(sin listings activos)";
        }

        return SummarizeListings(listings, maxRows);
    }

    static async Task<string?> TryAskGrokAsync(
        string apiKey,
        MentorChatRequest request,
        MentorChatReply local,
        CancellationToken ct) {
        var model = ResolveModel();
        var advice = RecommendNow(
            request.Level > 0 ? request.Level : 1,
            request.Enrolled,
            request.ActiveTitle,
            request.ActiveHint);
        var system = new StringBuilder();
        system.AppendLine("Eres el mentor de nuevos jugadores de Helbreath / Chain Lords.");
        system.AppendLine("Responde en español, breve y práctico (4–8 líneas como máximo).");
        system.AppendLine("Si piden que los sigas o qué hacer ahora / lo que más conviene, da los siguientes pasos recomendados.");
        system.AppendLine("Si preguntan qué paga el mercado por un ítem, da un valor APROXIMADO usando solo las cotizaciones del contexto.");
        system.AppendLine("No inventes listings, exploits, cheats ni formas de romper el juego.");
        system.AppendLine("No bloquees ni desaconsejes teleports de ciudad.");
        system.AppendLine();
        system.AppendLine("Contexto del jugador:");
        system.AppendLine($"- Nombre: {TrimOrDash(request.PlayerName)}");
        system.AppendLine($"- Nivel: {(request.Level > 0 ? request.Level : 1)}");
        system.AppendLine($"- Mundo: {TrimOrDash(request.WorldId)}");
        system.AppendLine($"- Camino principiante inscrito: {(request.Enrolled ? "sí" : "no")}");
        system.AppendLine($"- Misión activa: {TrimOrDash(request.ActiveTitle)} — {TrimOrDash(request.ActiveHint)}");
        system.AppendLine($"- Siguiente paso local: {advice.Title} — {advice.Hint}");
        system.AppendLine($"- Cotizaciones aproximadas del tablero: {BuildAuctionContext(16)}");
        system.AppendLine($"- Respuesta local de respaldo: {local.Reply}");

        var payload = new {
            model,
            reasoning_effort = "low",
            max_completion_tokens = 800,
            messages = new object[] {
                new { role = "system", content = system.ToString() },
                new { role = "user", content = string.IsNullOrWhiteSpace(request.Message) ? "Guíame." : request.Message },
            },
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, ChatCompletionsUrl);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        req.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        using var resp = await Http.SendAsync(req, ct).ConfigureAwait(false);
        var json = await resp.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        if (!resp.IsSuccessStatusCode) {
            Console.WriteLine($"[Mentor] Grok HTTP {(int)resp.StatusCode}.");
            return null;
        }

        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("choices", out var choices) ||
            choices.ValueKind != JsonValueKind.Array ||
            choices.GetArrayLength() == 0) {
            return null;
        }

        var msg = choices[0].GetProperty("message");
        if (!msg.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.String) {
            return null;
        }

        var text = content.GetString();
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    static string ResolveModel() {
        var raw = (Environment.GetEnvironmentVariable("MENTOR_GROK_MODEL") ?? DefaultModel).Trim();
        if (raw.Length == 0 || raw.Contains("fast", StringComparison.OrdinalIgnoreCase)) {
            return DefaultModel;
        }

        return raw;
    }

    static string? ReadApiKey() {
        var xai = (Environment.GetEnvironmentVariable("XAI_API_KEY") ?? "").Trim();
        if (xai.Length > 0) {
            return xai;
        }

        var grok = (Environment.GetEnvironmentVariable("GROK_API_KEY") ?? "").Trim();
        return grok.Length > 0 ? grok : null;
    }

    static bool IsGuideIntent(string folded) {
        return ContainsAny(
            folded,
            "sigueme",
            "explicame",
            "conviene",
            "que hago",
            "quehago",
            "guiame",
            "follow me",
            "lo que mas me conviene",
            "lo que tengo que hacer",
            "proximo paso",
            "siguiente paso",
            "que hago ahora");
    }

    static bool IsPriceIntent(string folded) {
        return ContainsAny(
            folded,
            "precio",
            "price",
            "mercado",
            "pagan",
            "cuanto pagan",
            "cuanto vale",
            "cuanto esta",
            "cotiz",
            "listing",
            "subasta",
            "cuanto por");
    }

    static bool ContainsAny(string haystack, params string[] needles) {
        foreach (var needle in needles) {
            if (haystack.Contains(needle, StringComparison.Ordinal)) {
                return true;
            }
        }

        return false;
    }

    static string ExtractItemQuery(string? message) {
        var raw = (message ?? "").Trim();
        if (raw.Length == 0) {
            return "";
        }

        var quoted = ExtractQuoted(raw);
        if (quoted.Length > 0) {
            return Truncate(quoted, 80);
        }

        var folded = Fold(raw);
        foreach (var marker in new[] { "por ", "de ", "for ", "item ", "item:", "pagan " }) {
            var idx = folded.LastIndexOf(marker, StringComparison.Ordinal);
            if (idx < 0) {
                continue;
            }

            var start = idx + marker.Length;
            if (start >= folded.Length) {
                continue;
            }

            var tail = folded[start..].Trim();
            tail = StripPriceTail(tail);
            if (tail.Length >= 2) {
                return Truncate(tail, 80);
            }
        }

        var leftover = StripPriceTail(folded);
        leftover = leftover
            .Replace("el ", " ", StringComparison.Ordinal)
            .Replace("la ", " ", StringComparison.Ordinal)
            .Replace("un ", " ", StringComparison.Ordinal)
            .Replace("una ", " ", StringComparison.Ordinal)
            .Trim();
        return leftover.Length >= 2 ? Truncate(leftover, 80) : "";
    }

    static string StripPriceTail(string folded) {
        return folded
            .Replace("en el mercado", " ", StringComparison.Ordinal)
            .Replace("del mercado", " ", StringComparison.Ordinal)
            .Replace("mercado", " ", StringComparison.Ordinal)
            .Replace("precio aproximado", " ", StringComparison.Ordinal)
            .Replace("precio", " ", StringComparison.Ordinal)
            .Replace("price", " ", StringComparison.Ordinal)
            .Replace("cuanto pagan", " ", StringComparison.Ordinal)
            .Replace("cuanto vale", " ", StringComparison.Ordinal)
            .Replace("cuanto esta", " ", StringComparison.Ordinal)
            .Replace("cuanto por", " ", StringComparison.Ordinal)
            .Replace("pagan", " ", StringComparison.Ordinal)
            .Replace("subasta", " ", StringComparison.Ordinal)
            .Replace("listing", " ", StringComparison.Ordinal)
            .Replace("oro", " ", StringComparison.Ordinal)
            .Replace("gold", " ", StringComparison.Ordinal)
            .Replace("?", " ")
            .Replace("¿", " ")
            .Replace("!", " ")
            .Trim();
    }

    static string ExtractQuoted(string raw) {
        foreach (var pair in new[] { ('«', '»'), ('"', '"'), ('“', '”'), ('\'', '\'') }) {
            var start = raw.IndexOf(pair.Item1);
            if (start < 0) {
                continue;
            }

            var end = raw.IndexOf(pair.Item2, start + 1);
            if (end <= start + 1) {
                continue;
            }

            return raw[(start + 1)..end].Trim();
        }

        return "";
    }

    static bool NamesOverlap(string itemName, string query) {
        var a = Fold(itemName);
        var b = Fold(query);
        if (a.Length == 0 || b.Length == 0) {
            return false;
        }

        return a.Contains(b, StringComparison.Ordinal) || b.Contains(a, StringComparison.Ordinal);
    }

    static string Fold(string? text) {
        var normalized = (text ?? "").Trim().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var ch in normalized) {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark) {
                sb.Append(char.ToLowerInvariant(ch));
            }
        }

        return sb.ToString().Normalize(NormalizationForm.FormC);
    }

    static string Truncate(string text, int max) {
        if (text.Length <= max) {
            return text;
        }

        return text[..max];
    }

    static string TrimOrDash(string? value) {
        var t = (value ?? "").Trim();
        return t.Length == 0 ? "—" : t;
    }
}

/// <summary>Inbound JSON for <c>POST /api/mentor/chat</c>.</summary>
public sealed class MentorChatRequest {
    public string Message { get; set; } = "";
    public string? PlayerName { get; set; }
    public int Level { get; set; } = 1;
    public string? WorldId { get; set; }
    public bool Enrolled { get; set; }
    public string? ActiveTitle { get; set; }
    public string? ActiveHint { get; set; }
}

/// <summary>Outbound JSON for the mentor chat endpoint.</summary>
public sealed class MentorChatReply {
    public string Reply { get; set; } = "";
    public string Source { get; set; } = "local";
    public string Kind { get; set; } = "chat";
}

/// <summary>Next beginner step for follow-me / “qué hago ahora”.</summary>
public sealed class MentorNowAdvice {
    public string Title { get; set; } = "";
    public string Hint { get; set; } = "";
    public string QuestId { get; set; } = "";
    public int LevelGuideMin { get; set; }
    public int LevelGuideMax { get; set; }
    public bool Enrolled { get; set; }
    public bool UsedActiveQuest { get; set; }
}

/// <summary>Local classifier for mentor questions.</summary>
public enum MentorIntent {
    Guide = 0,
    Price = 1,
    Chat = 2,
}
