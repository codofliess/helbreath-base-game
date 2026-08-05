using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Server.Helpers;

/// <summary>
/// Wallet referral ledger (JSON under Chars/). Codes are fixed per wallet; rewards are idempotent.
/// Token grants are locked 30 days then moved to pending $HELL (referrer) / guild treasury (guild).
/// </summary>
public static class ReferralStore {
    public const long ReferralPoolDefault = 50_000_000L;
    public const long ReferrerTokenGrant = 10_000L;
    public const long GuildTokenGrant = 5_000L;
    public const int LockDays = 30;
    public const int InviteeGold = 20_000;
    public const int ExpTabletItemId = 1310;
    public const int ExpTabletCount = 3;
    public const int LevelTabletsEarly = 40;
    public const int LevelTabletsMid = 120;
    public const int LevelTokenPack = 150;

    public const string RewardInviteeGold = "invitee_gold_l1";
    public const string RewardInviteeTabs40 = "invitee_tablets_l40";
    public const string RewardInviteeTabs120 = "invitee_tablets_l120";
    public const string RewardTokenPackL150 = "token_pack_l150";

    static readonly object Gate = new();
    static ReferralFile file = new();
    static string? persistDirectory;
    static long lastPersistMs;
    static long lastTickMs;

    static readonly JsonSerializerOptions JsonOptions = new() {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static void Initialize(string charsDirectory) {
        ArgumentException.ThrowIfNullOrWhiteSpace(charsDirectory);
        Directory.CreateDirectory(charsDirectory);
        persistDirectory = charsDirectory;
        lock (Gate) {
            file = new ReferralFile();
            TryLoadLocked();
            if (file.RemainingPool <= 0 && file.Codes.Count == 0 && file.Attributions.Count == 0) {
                file.RemainingPool = ReferralPoolDefault;
            }
            PersistLocked();
        }
        Console.WriteLine(
            $"[Referral] Initialized pool={file.RemainingPool:N0} codes={file.Codes.Count} attrs={file.Attributions.Count}.");
    }

    public static void Tick(long nowMs) {
        lock (Gate) {
            if (nowMs - lastTickMs < 10_000) {
                return;
            }
            lastTickMs = nowMs;
            ProcessUnlocksLocked(nowMs);
            if (nowMs - lastPersistMs >= 20_000) {
                PersistLocked();
            }
        }
    }

    /// <summary>
    /// Stable code for a wallet (created once). Prefer <paramref name="preferredCharacterName"/> as
    /// <c>NAME-XXXX</c> (display name + 4-char suffix). If a code already exists it is never changed.
    /// </summary>
    public static string GetOrCreateCode(string? accountWallet, string? preferredCharacterName = null) {
        var wallet = NormalizeWallet(accountWallet);
        if (string.IsNullOrEmpty(wallet)) {
            return string.Empty;
        }
        lock (Gate) {
            if (file.WalletToCode.TryGetValue(wallet, out var existing) && !string.IsNullOrEmpty(existing)) {
                return existing;
            }
            var code = GenerateCodeLocked(wallet, preferredCharacterName);
            file.WalletToCode[wallet] = code;
            file.Codes[code] = wallet;
            PersistLocked();
            return code;
        }
    }

    /// <summary>If wallet has no code yet and a character name is known, mint NAME-XXXX.</summary>
    public static string EnsureCodeWithName(string? accountWallet, string? characterName) {
        return GetOrCreateCode(accountWallet, characterName);
    }

    public static bool TryResolveCode(string? code, out string referrerWallet) {
        referrerWallet = string.Empty;
        var c = NormalizeCode(code);
        if (string.IsNullOrEmpty(c)) {
            return false;
        }
        lock (Gate) {
            if (!file.Codes.TryGetValue(c, out var w) || string.IsNullOrEmpty(w)) {
                return false;
            }
            referrerWallet = w;
            return true;
        }
    }

    /// <summary>
    /// First-touch attribution. Returns true when a new attribution was written.
    /// </summary>
    public static bool TryAttribute(string? referredWallet, string? referralCode, out string message) {
        message = string.Empty;
        var referred = NormalizeWallet(referredWallet);
        var code = NormalizeCode(referralCode);
        if (string.IsNullOrEmpty(referred) || string.IsNullOrEmpty(code)) {
            message = "Missing wallet or code.";
            return false;
        }
        lock (Gate) {
            if (file.Attributions.ContainsKey(referred)) {
                message = "Already attributed.";
                return false;
            }
            if (!file.Codes.TryGetValue(code, out var referrer) || string.IsNullOrEmpty(referrer)) {
                message = "Unknown referral code.";
                return false;
            }
            if (string.Equals(referrer, referred, StringComparison.Ordinal)) {
                message = "Cannot refer yourself.";
                return false;
            }
            // Ensure referred wallet also has a stable code for when they share later.
            _ = GetOrCreateCodeLocked(referred, preferredName: null);
            file.Attributions[referred] = new ReferralAttribution {
                ReferredWallet = referred,
                ReferrerWallet = referrer,
                RefCodeUsed = code,
                AttributedAtUtc = DateTimeOffset.UtcNow.ToString("o"),
            };
            PersistLocked();
            message = $"Attributed to {Tail(referrer, 8)}…";
            Console.WriteLine($"[Referral] Attribution {Tail(referred, 8)}… ← {Tail(referrer, 8)}… code={code}");
            return true;
        }
    }

    public static bool TryGetAttribution(string? referredWallet, out ReferralAttribution attr) {
        attr = new ReferralAttribution();
        var referred = NormalizeWallet(referredWallet);
        if (string.IsNullOrEmpty(referred)) {
            return false;
        }
        lock (Gate) {
            if (!file.Attributions.TryGetValue(referred, out var a) || a is null) {
                return false;
            }
            attr = a;
            return true;
        }
    }

    public static void NoteWalletMaxLevel(string? accountWallet, int level) {
        var wallet = NormalizeWallet(accountWallet);
        if (string.IsNullOrEmpty(wallet) || level <= 0) {
            return;
        }
        lock (Gate) {
            if (!file.WalletMaxLevel.TryGetValue(wallet, out var cur) || level > cur) {
                file.WalletMaxLevel[wallet] = level;
                // Persist lazily on next grant/tick.
            }
        }
    }

    public static int GetWalletMaxLevel(string? accountWallet) {
        var wallet = NormalizeWallet(accountWallet);
        if (string.IsNullOrEmpty(wallet)) {
            return 0;
        }
        lock (Gate) {
            return file.WalletMaxLevel.TryGetValue(wallet, out var lvl) ? lvl : 0;
        }
    }

    public static bool IsRewardGranted(string? referredWallet, string rewardKind) {
        var referred = NormalizeWallet(referredWallet);
        if (string.IsNullOrEmpty(referred) || string.IsNullOrEmpty(rewardKind)) {
            return false;
        }
        lock (Gate) {
            return file.GrantedRewards.Contains(RewardKey(referred, rewardKind));
        }
    }

    public static bool TryMarkRewardGranted(string? referredWallet, string rewardKind) {
        var referred = NormalizeWallet(referredWallet);
        if (string.IsNullOrEmpty(referred) || string.IsNullOrEmpty(rewardKind)) {
            return false;
        }
        lock (Gate) {
            var key = RewardKey(referred, rewardKind);
            if (file.GrantedRewards.Contains(key)) {
                return false;
            }
            file.GrantedRewards.Add(key);
            PersistLocked();
            return true;
        }
    }

    /// <summary>
    /// L150 pack: lock 10k referrer + 5k guild for 30 days from referral pool.
    /// Guild share returns to pool if referrer has no guild.
    /// </summary>
    public static bool TryGrantTokenPackL150(
        string? referredWallet,
        string? referrerWallet,
        string? referrerGuildId,
        out string message) {
        message = string.Empty;
        var referred = NormalizeWallet(referredWallet);
        var referrer = NormalizeWallet(referrerWallet);
        if (string.IsNullOrEmpty(referred) || string.IsNullOrEmpty(referrer)) {
            message = "Missing wallets.";
            return false;
        }
        var guildId = (referrerGuildId ?? string.Empty).Trim();
        lock (Gate) {
            var key = RewardKey(referred, RewardTokenPackL150);
            if (file.GrantedRewards.Contains(key)) {
                message = "Already granted.";
                return false;
            }
            // Always reserve full pack; if no guild, guild share returns to pool immediately after.
            var need = ReferrerTokenGrant + GuildTokenGrant;
            if (file.RemainingPool < need) {
                message = "Referral token pool empty.";
                Console.WriteLine($"[Referral] Pool empty — cannot grant L150 pack for {Tail(referred, 8)}…");
                return false;
            }

            file.RemainingPool -= need;
            file.GrantedRewards.Add(key);
            var unlockAt = DateTimeOffset.UtcNow.AddDays(LockDays);
            var unlockIso = unlockAt.ToString("o");

            file.LockedGrants.Add(new LockedTokenGrant {
                Id = Guid.NewGuid().ToString("N"),
                ReferredWallet = referred,
                BeneficiaryKind = "referrer",
                BeneficiaryId = referrer,
                Amount = ReferrerTokenGrant,
                LockedUntilUtc = unlockIso,
                Status = "locked",
            });

            if (!string.IsNullOrEmpty(guildId)) {
                file.LockedGrants.Add(new LockedTokenGrant {
                    Id = Guid.NewGuid().ToString("N"),
                    ReferredWallet = referred,
                    BeneficiaryKind = "guild",
                    BeneficiaryId = guildId,
                    Amount = GuildTokenGrant,
                    LockedUntilUtc = unlockIso,
                    Status = "locked",
                });
            } else {
                // No guild at claim: return guild share to pool.
                file.RemainingPool += GuildTokenGrant;
            }

            PersistLocked();
            message = string.IsNullOrEmpty(guildId)
                ? $"+{ReferrerTokenGrant} $HELL locked 30d (no guild for +{GuildTokenGrant})"
                : $"+{ReferrerTokenGrant}/+{GuildTokenGrant} $HELL locked 30d";
            Console.WriteLine(
                $"[Referral] L150 pack referred={Tail(referred, 8)}… referrer={Tail(referrer, 8)}… guild={guildId} poolLeft={file.RemainingPool}");
            return true;
        }
    }

    public static long GetLockedHell(string? walletOrGuild, string kind) {
        var id = kind == "guild"
            ? (walletOrGuild ?? string.Empty).Trim()
            : NormalizeWallet(walletOrGuild);
        if (string.IsNullOrEmpty(id)) {
            return 0;
        }
        lock (Gate) {
            return file.LockedGrants
                .Where(g => g.Status == "locked"
                    && string.Equals(g.BeneficiaryKind, kind, StringComparison.Ordinal)
                    && string.Equals(g.BeneficiaryId, id, StringComparison.OrdinalIgnoreCase))
                .Sum(g => g.Amount);
        }
    }

    public static long GetGuildTreasury(string? guildId) {
        var id = (guildId ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(id)) {
            return 0;
        }
        lock (Gate) {
            return file.GuildTreasury.TryGetValue(id, out var v) ? v : 0;
        }
    }

    static void ProcessUnlocksLocked(long nowMs) {
        var now = DateTimeOffset.FromUnixTimeMilliseconds(nowMs);
        var dirty = false;
        foreach (var g in file.LockedGrants) {
            if (g.Status != "locked") {
                continue;
            }
            if (!DateTimeOffset.TryParse(g.LockedUntilUtc, out var until) || until > now) {
                continue;
            }
            if (string.Equals(g.BeneficiaryKind, "referrer", StringComparison.Ordinal)) {
                HellMiningStore.GrantPendingHell(g.BeneficiaryId, g.Amount);
                g.Status = "unlocked_pending";
                dirty = true;
                Console.WriteLine($"[Referral] Unlocked {g.Amount} → referrer pending {Tail(g.BeneficiaryId, 8)}…");
            } else if (string.Equals(g.BeneficiaryKind, "guild", StringComparison.Ordinal)) {
                var gid = g.BeneficiaryId ?? string.Empty;
                if (!file.GuildTreasury.ContainsKey(gid)) {
                    file.GuildTreasury[gid] = 0;
                }
                file.GuildTreasury[gid] = SaturateAdd(file.GuildTreasury[gid], g.Amount);
                g.Status = "unlocked_guild_treasury";
                dirty = true;
                Console.WriteLine($"[Referral] Unlocked {g.Amount} → guild treasury {gid}");
            }
        }
        if (dirty) {
            PersistLocked();
        }
    }

    static string GenerateCodeLocked(string wallet, string? preferredCharacterName) {
        var pepper = Environment.GetEnvironmentVariable("REFERRAL_PEPPER") ?? "chainlords-ref-v1";
        var slug = SanitizeNameSlug(preferredCharacterName);
        for (var i = 0; i < 12; i++) {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"{pepper}:{wallet}:{slug}:{i}"));
            var suffix = ToCodeAlphabet(bytes, 4);
            var code = string.IsNullOrEmpty(slug) ? ToCodeAlphabet(bytes, 8) : $"{slug}-{suffix}";
            if (!file.Codes.ContainsKey(code)) {
                return code;
            }
        }
        var rnd = new byte[8];
        RandomNumberGenerator.Fill(rnd);
        var fallbackSlug = string.IsNullOrEmpty(slug) ? "REF" : slug;
        return $"{fallbackSlug}-{ToCodeAlphabet(rnd, 4)}";
    }

    /// <summary>A–Z / 0–9 only, max 12 chars (Helbreath names are short).</summary>
    public static string SanitizeNameSlug(string? name) {
        if (string.IsNullOrWhiteSpace(name)) {
            return string.Empty;
        }
        var sb = new StringBuilder(12);
        foreach (var ch in name.Trim().ToUpperInvariant()) {
            if ((ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9')) {
                sb.Append(ch);
                if (sb.Length >= 12) {
                    break;
                }
            }
        }
        return sb.ToString();
    }

    static string GetOrCreateCodeLocked(string wallet, string? preferredName) {
        if (file.WalletToCode.TryGetValue(wallet, out var existing) && !string.IsNullOrEmpty(existing)) {
            return existing;
        }
        var code = GenerateCodeLocked(wallet, preferredName);
        file.WalletToCode[wallet] = code;
        file.Codes[code] = wallet;
        return code;
    }

    static string ToCodeAlphabet(byte[] bytes, int len) {
        // Crockford-ish base32 without ambiguous chars.
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var sb = new StringBuilder(len);
        for (var i = 0; i < len; i++) {
            sb.Append(alphabet[bytes[i % bytes.Length] % alphabet.Length]);
        }
        return sb.ToString();
    }

    static string RewardKey(string referred, string kind) => $"{referred}|{kind}";

    static string NormalizeWallet(string? wallet) => (wallet ?? string.Empty).Trim();

    static string NormalizeCode(string? code) {
        // Accept full URLs or bare codes; strip ?ref= / trailing junk.
        var raw = (code ?? string.Empty).Trim();
        if (raw.Length == 0) {
            return string.Empty;
        }
        try {
            if (raw.Contains("ref=", StringComparison.OrdinalIgnoreCase)) {
                var idx = raw.IndexOf("ref=", StringComparison.OrdinalIgnoreCase);
                raw = raw[(idx + 4)..];
                var amp = raw.IndexOfAny(['&', '#', ' ', '?']);
                if (amp >= 0) {
                    raw = raw[..amp];
                }
            }
            // path form /?ref=CODE already handled; also allow play.chainlords.net/?ref=CODE
            if (raw.Contains('/')) {
                var last = raw.Split('/').LastOrDefault() ?? raw;
                raw = last;
            }
        } catch {
            // fall through
        }
        return raw.Trim().Trim('"').ToUpperInvariant();
    }

    static string Tail(string value, int n) {
        if (string.IsNullOrEmpty(value)) {
            return string.Empty;
        }
        return value.Length <= n ? value : value[^n..];
    }

    static long SaturateAdd(long a, long b) {
        try {
            return checked(a + b);
        } catch (OverflowException) {
            return long.MaxValue;
        }
    }

    static void TryLoadLocked() {
        if (persistDirectory is null) {
            return;
        }
        var path = Path.Combine(persistDirectory, "referrals.json");
        if (!File.Exists(path)) {
            return;
        }
        try {
            var json = File.ReadAllText(path);
            var loaded = JsonSerializer.Deserialize<ReferralFile>(json, JsonOptions);
            if (loaded is not null) {
                file = loaded;
                file.Codes ??= new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                file.WalletToCode ??= new Dictionary<string, string>(StringComparer.Ordinal);
                file.Attributions ??= new Dictionary<string, ReferralAttribution>(StringComparer.Ordinal);
                file.GrantedRewards ??= new HashSet<string>(StringComparer.Ordinal);
                file.WalletMaxLevel ??= new Dictionary<string, int>(StringComparer.Ordinal);
                file.LockedGrants ??= new List<LockedTokenGrant>();
                file.GuildTreasury ??= new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
                file.LastGuildByWallet ??= new Dictionary<string, string>(StringComparer.Ordinal);
            }
        } catch (Exception ex) {
            Console.Error.WriteLine($"[Referral] Load failed: {ex.Message}");
        }
    }

    public static void RememberGuild(string? accountWallet, string? guildId) {
        var wallet = NormalizeWallet(accountWallet);
        var g = (guildId ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(wallet) || string.IsNullOrEmpty(g)) {
            return;
        }
        lock (Gate) {
            file.LastGuildByWallet[wallet] = g;
        }
    }

    public static string GetLastGuild(string? accountWallet) {
        var wallet = NormalizeWallet(accountWallet);
        if (string.IsNullOrEmpty(wallet)) {
            return string.Empty;
        }
        lock (Gate) {
            return file.LastGuildByWallet.TryGetValue(wallet, out var g) ? g : string.Empty;
        }
    }

    static void PersistLocked() {
        if (persistDirectory is null) {
            return;
        }
        try {
            var path = Path.Combine(persistDirectory, "referrals.json");
            var tmp = path + ".tmp";
            File.WriteAllText(tmp, JsonSerializer.Serialize(file, JsonOptions));
            File.Move(tmp, path, overwrite: true);
            lastPersistMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        } catch (Exception ex) {
            Console.Error.WriteLine($"[Referral] Persist failed: {ex.Message}");
        }
    }
}

public sealed class ReferralFile {
    public long RemainingPool { get; set; }
    public Dictionary<string, string> Codes { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, string> WalletToCode { get; set; } = new(StringComparer.Ordinal);
    public Dictionary<string, ReferralAttribution> Attributions { get; set; } = new(StringComparer.Ordinal);
    public HashSet<string> GrantedRewards { get; set; } = new(StringComparer.Ordinal);
    public Dictionary<string, int> WalletMaxLevel { get; set; } = new(StringComparer.Ordinal);
    public List<LockedTokenGrant> LockedGrants { get; set; } = new();
    public Dictionary<string, long> GuildTreasury { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    /// <summary>Last non-empty guild id seen for a wallet (for offline L150 guild share).</summary>
    public Dictionary<string, string> LastGuildByWallet { get; set; } = new(StringComparer.Ordinal);
}

public sealed class ReferralAttribution {
    public string ReferredWallet { get; set; } = string.Empty;
    public string ReferrerWallet { get; set; } = string.Empty;
    public string RefCodeUsed { get; set; } = string.Empty;
    public string AttributedAtUtc { get; set; } = string.Empty;
}

public sealed class LockedTokenGrant {
    public string Id { get; set; } = string.Empty;
    public string ReferredWallet { get; set; } = string.Empty;
    public string BeneficiaryKind { get; set; } = string.Empty; // referrer | guild
    public string BeneficiaryId { get; set; } = string.Empty;
    public long Amount { get; set; }
    public string LockedUntilUtc { get; set; } = string.Empty;
    public string Status { get; set; } = "locked";
}
