using Npgsql;

namespace Server.Persistence;

/// <summary>How a name probe against PostgreSQL finished.</summary>
public enum CharacterReserveStatus {
    Reserved,
    AlreadyOwned,
    Taken,
    Unavailable,
}

/// <summary>Result of inserting the character row at creation time.</summary>
public readonly record struct CharacterReserveResult(
    CharacterReserveStatus Status,
    Guid? CharacterId,
    bool ExistingIsReservationOnly,
    string Message) {
    public static CharacterReserveResult Reserved(Guid id) =>
        new(CharacterReserveStatus.Reserved, id, false, "Name reserved.");

    public static CharacterReserveResult AlreadyOwned(Guid id, bool reservationOnly) =>
        new(
            CharacterReserveStatus.AlreadyOwned,
            id,
            reservationOnly,
            reservationOnly ? "Name reserved." : CharacterNameClash.AlreadyYoursMessage);

    public static CharacterReserveResult Taken() =>
        new(CharacterReserveStatus.Taken, null, false, CharacterNameClash.TakenMessage);

    public static CharacterReserveResult Unavailable() =>
        new(CharacterReserveStatus.Unavailable, null, false, CharacterNameClash.CreateUnavailableMessage);
}

/// <summary>Branch taken while deciding whether a new name may be inserted.</summary>
public enum ReserveDecisionKind {
    Insert,
    AlreadyOwned,
    Taken,
}

/// <summary>Pure reserve decision before an insert id exists.</summary>
public readonly record struct ReserveDecision(ReserveDecisionKind Kind, Guid? ExistingId, bool ExistingIsReservationOnly);

/// <summary>Whether a login that already has a snapshot may enter the world.</summary>
public enum CharacterLoginStatus {
    Ok,
    BlockTaken,
    BlockUnavailable,
}

/// <summary>Name re-check for a character loaded from JSON or from an unverified id.</summary>
public readonly record struct CharacterLoginResult(CharacterLoginStatus Status, Guid? CharacterId, string Message) {
    public static CharacterLoginResult Ok(Guid id) => new(CharacterLoginStatus.Ok, id, "");

    public static CharacterLoginResult BlockTaken() =>
        new(CharacterLoginStatus.BlockTaken, null, CharacterNameClash.JsonLoginTakenMessage);

    public static CharacterLoginResult BlockUnavailable() =>
        new(CharacterLoginStatus.BlockUnavailable, null, CharacterNameClash.JsonLoginUnavailableMessage);
}

/// <summary>Outcome of one character snapshot write.</summary>
public enum CharacterSaveStatus {
    Saved,
    NameClash,
    Failed,
}

/// <summary>Save result. <see cref="CharacterSaveStatus.NameClash"/> must not write the JSON mirror.</summary>
public readonly record struct CharacterSaveResult(CharacterSaveStatus Status, Guid? CharacterId, string? Error) {
    public static CharacterSaveResult Saved(Guid id) => new(CharacterSaveStatus.Saved, id, null);

    public static CharacterSaveResult JsonOnly(Guid? existingId) => new(CharacterSaveStatus.Saved, existingId, null);

    public static CharacterSaveResult NameClash() => new(CharacterSaveStatus.NameClash, null, "23505");

    public static CharacterSaveResult Failed(string error) => new(CharacterSaveStatus.Failed, null, error);
}

/// <summary>Branch for a save once the lowercase name row (if any) is known.</summary>
public enum SaveDecisionKind {
    Insert,
    Update,
    Clash,
}

/// <summary>Pure save decision. Update and clash carry the existing row id.</summary>
public readonly record struct SaveDecision(SaveDecisionKind Kind, Guid? Id);

/// <summary>Admin rename outcome across the database, JSON mirror, and live session.</summary>
public enum CharacterRenameStatus {
    Renamed,
    Taken,
    NotFound,
    InvalidName,
    Unavailable,
}

/// <summary>What the admin rename changed. Taken and not-found leave every store untouched.</summary>
public readonly record struct CharacterRenameOutcome(
    CharacterRenameStatus Status,
    Guid? CharacterId,
    string Message,
    bool JsonUpdated,
    bool LiveUpdated) {
    public static CharacterRenameOutcome Renamed(Guid id, bool jsonUpdated, bool liveUpdated) =>
        new(CharacterRenameStatus.Renamed, id, "Character renamed.", jsonUpdated, liveUpdated);

    public static CharacterRenameOutcome Taken() =>
        new(CharacterRenameStatus.Taken, null, CharacterNameClash.TakenMessage, false, false);

    public static CharacterRenameOutcome NotFound() =>
        new(CharacterRenameStatus.NotFound, null, "Character not found.", false, false);

    public static CharacterRenameOutcome Invalid(string message) =>
        new(CharacterRenameStatus.InvalidName, null, message, false, false);

    public static CharacterRenameOutcome Unavailable() =>
        new(CharacterRenameStatus.Unavailable, null, "Character rename is temporarily unavailable.", false, false);
}

/// <summary>JSON body for <c>POST /api/admin/characters/rename</c>.</summary>
public sealed class RenameCharacterBody {
    public string? Wallet { get; set; }
    public string? CurrentName { get; set; }
    public string? NewName { get; set; }
}

/// <summary>
/// Case-insensitive display-name rules shared by creation, JSON login, and save.
/// PostgreSQL enforces the same rule with <c>idx_characters_name_ci</c>.
/// </summary>
public static class CharacterNameClash {
    public const string UniqueViolationSqlState = "23505";
    public const string GlobalNameIndex = "idx_characters_name_ci";
    public const string TakenMessage = "That name is already taken.";
    public const string AlreadyYoursMessage = "You already have a character with that name.";
    public const string UnavailableMessage = "Name check is temporarily unavailable. Try again.";
    public const string CreateUnavailableMessage = "Character creation is temporarily unavailable. Try again.";
    public const string JsonLoginTakenMessage = "Name already used by another account. Ask an admin to rename it.";
    public const string JsonLoginUnavailableMessage = "Could not verify this character name. Try again later.";

    public static bool SameWallet(string? left, string? right) =>
        string.Equals((left ?? string.Empty).Trim(), (right ?? string.Empty).Trim(), StringComparison.Ordinal);

    public static bool SameName(string? left, string? right) =>
        string.Equals((left ?? string.Empty).Trim(), (right ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase);

    /// <summary>True for PostgreSQL unique violations and the repository's mapped conflict.</summary>
    public static bool IsUniqueViolation(Exception? error) {
        for (var current = error; current is not null; current = current.InnerException) {
            if (current is CharacterUniqueConflictException) {
                return true;
            }
            if (current is PostgresException postgres &&
                string.Equals(postgres.SqlState, UniqueViolationSqlState, StringComparison.Ordinal)) {
                return true;
            }
        }
        return false;
    }

    /// <summary>
    /// A failed or unfinished database probe is not "available".
    /// Only a completed probe that found no other wallet may proceed.
    /// </summary>
    public static (bool Available, string Message) FromDbProbe(bool probeCompleted, bool takenByOther) {
        if (!probeCompleted) {
            return (false, UnavailableMessage);
        }
        if (takenByOther) {
            return (false, TakenMessage);
        }
        return (true, "Name is available.");
    }

    /// <summary>Null row means the name can be inserted. Same wallet keeps its row. Any other wallet blocks.</summary>
    public static ReserveDecision DecideReserve(CharacterRow? existing, string wallet) {
        if (existing is null) {
            return new ReserveDecision(ReserveDecisionKind.Insert, null, false);
        }
        if (!SameWallet(existing.Wallet, wallet)) {
            return new ReserveDecision(ReserveDecisionKind.Taken, existing.Id, false);
        }
        return new ReserveDecision(ReserveDecisionKind.AlreadyOwned, existing.Id, existing.NameReservationOnly);
    }

    /// <summary>Create may proceed only for a fresh insert or a placeholder row this wallet already holds.</summary>
    public static bool IsNewCharacterReserveAccepted(CharacterReserveResult result) =>
        result.Status == CharacterReserveStatus.Reserved
        || (result.Status == CharacterReserveStatus.AlreadyOwned && result.ExistingIsReservationOnly);

    /// <summary>Another wallet's lowercase name is a clash. This wallet updates the existing row.</summary>
    public static SaveDecision DecideSave(CharacterRow? byLowerName, string wallet) {
        if (byLowerName is null) {
            return new SaveDecision(SaveDecisionKind.Insert, null);
        }
        if (!SameWallet(byLowerName.Wallet, wallet)) {
            return new SaveDecision(SaveDecisionKind.Clash, byLowerName.Id);
        }
        return new SaveDecision(SaveDecisionKind.Update, byLowerName.Id);
    }

    /// <summary>Name-clash saves must not refresh <c>Chars/&lt;wallet&gt;.json</c>.</summary>
    public static bool ShouldWriteJsonMirror(CharacterSaveStatus status) =>
        status != CharacterSaveStatus.NameClash;

    /// <summary>True while the session should skip autosave after a name clash.</summary>
    public static bool IsSaveSuppressed(DateTimeOffset? retryAtUtc, DateTimeOffset now) =>
        retryAtUtc is { } until && now < until;

    /// <summary>True when <paramref name="occupied"/> is a different character row.</summary>
    public static bool IsNameOwnedByOther(CharacterRow? occupied, Guid? selfId) {
        if (occupied is null) {
            return false;
        }
        return selfId is not Guid id || occupied.Id != id;
    }

    /// <summary>Placeholder rows stay off the SELECTCHAR desk until the first real save.</summary>
    public static bool ShouldHideFromCharacterList(bool nameReservationOnly) => nameReservationOnly;
}

/// <summary>
/// One log line per wallet+name for each backoff window, so a clashing autosave does not print every 30s.
/// </summary>
public static class CharacterNameClashLog {
    public const long IntervalMs = 10 * 60 * 1000;

    static readonly object Gate = new();
    static readonly Dictionary<string, long> ProcessLogAtMs = new(StringComparer.Ordinal);

    public static string Key(string? wallet, string? name) =>
        $"{(wallet ?? string.Empty).Trim()}\n{(name ?? string.Empty).Trim().ToLowerInvariant()}";

    /// <summary>Records <paramref name="nowMs"/> when the line should be printed. Mutates <paramref name="lastEmitAtMs"/>.</summary>
    public static bool ShouldEmit(
        IDictionary<string, long> lastEmitAtMs,
        string wallet,
        string name,
        long nowMs,
        long intervalMs = IntervalMs) {
        ArgumentNullException.ThrowIfNull(lastEmitAtMs);
        var key = Key(wallet, name);
        if (lastEmitAtMs.TryGetValue(key, out var last) && nowMs >= last && nowMs - last < intervalMs) {
            return false;
        }
        lastEmitAtMs[key] = nowMs;
        return true;
    }

    public static bool ShouldEmitNow(string wallet, string name) {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        lock (Gate) {
            return ShouldEmit(ProcessLogAtMs, wallet, name, now, IntervalMs);
        }
    }

    public static void Clear(string wallet, string name) {
        lock (Gate) {
            ProcessLogAtMs.Remove(Key(wallet, name));
        }
    }
}
