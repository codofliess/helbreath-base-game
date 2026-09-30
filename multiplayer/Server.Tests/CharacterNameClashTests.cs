using System.Net.WebSockets;
using System.Text.Json;
using Npgsql;
using Server;
using Server.Helpers;
using Server.Persistence;
using Server.World.Game;
using Xunit;

namespace Server.Tests;

public class CharacterNameClashTests {
    [Fact]
    public void DbProbeFailure_IsUnavailable_NotAvailable() {
        var (available, message) = CharacterNameClash.FromDbProbe(probeCompleted: false, takenByOther: false);
        Assert.False(available);
        Assert.Equal(CharacterNameClash.UnavailableMessage, message);
    }

    [Fact]
    public void DbProbeTaken_RejectsName() {
        var (available, message) = CharacterNameClash.FromDbProbe(probeCompleted: true, takenByOther: true);
        Assert.False(available);
        Assert.Equal(CharacterNameClash.TakenMessage, message);
    }

    [Fact]
    public void Reserve_SecondWallet_IsTaken() {
        var existing = new CharacterRow(Guid.NewGuid(), "wallet-a", "Hero", false);
        var decision = CharacterNameClash.DecideReserve(existing, "wallet-b");
        Assert.Equal(ReserveDecisionKind.Taken, decision.Kind);
    }

    [Fact]
    public void Reserve_SameWalletPlaceholder_IsAlreadyOwned() {
        var existing = new CharacterRow(Guid.NewGuid(), "wallet-a", "Hero", true);
        var decision = CharacterNameClash.DecideReserve(existing, "wallet-a");
        Assert.Equal(ReserveDecisionKind.AlreadyOwned, decision.Kind);
        Assert.True(decision.ExistingIsReservationOnly);
        Assert.True(CharacterNameClash.IsNewCharacterReserveAccepted(
            CharacterReserveResult.AlreadyOwned(decision.ExistingId!.Value, decision.ExistingIsReservationOnly)));
    }

    [Fact]
    public void Reserve_RealCharacterOnSameWallet_IsNotANewCreate() {
        var id = Guid.NewGuid();
        var decision = CharacterNameClash.DecideReserve(new CharacterRow(id, "wallet-a", "Hero", false), "wallet-a");
        var result = CharacterReserveResult.AlreadyOwned(id, decision.ExistingIsReservationOnly);
        Assert.False(CharacterNameClash.IsNewCharacterReserveAccepted(result));
        Assert.Equal(CharacterNameClash.AlreadyYoursMessage, result.Message);
    }

    [Fact]
    public void SaveDecision_OtherWallet_IsClash_AndSkipsJson() {
        var decision = CharacterNameClash.DecideSave(new CharacterRow(Guid.NewGuid(), "wallet-b", "Hero", false), "wallet-a");
        Assert.Equal(SaveDecisionKind.Clash, decision.Kind);
        Assert.False(CharacterNameClash.ShouldWriteJsonMirror(CharacterSaveStatus.NameClash));
        Assert.True(CharacterNameClash.ShouldWriteJsonMirror(CharacterSaveStatus.Failed));
        Assert.True(CharacterNameClash.ShouldWriteJsonMirror(CharacterSaveStatus.Saved));
    }

    [Fact]
    public void SaveSuppression_SkipsUntilBackoffElapses() {
        var now = DateTimeOffset.Parse("2026-09-30T12:00:00Z");
        Assert.True(CharacterNameClash.IsSaveSuppressed(now.AddMinutes(10), now));
        Assert.False(CharacterNameClash.IsSaveSuppressed(now.AddMinutes(-1), now));
        Assert.False(CharacterNameClash.IsSaveSuppressed(null, now));
    }

    [Fact]
    public void ClashLog_DoesNotEmitAgainInsideTheWindow() {
        var log = new Dictionary<string, long>();
        Assert.True(CharacterNameClashLog.ShouldEmit(log, "wallet-a", "Hero", nowMs: 1_000));
        Assert.False(CharacterNameClashLog.ShouldEmit(log, "wallet-a", "HERO", nowMs: 1_000 + 30_000));
        Assert.True(CharacterNameClashLog.ShouldEmit(log, "wallet-a", "Hero", nowMs: 1_000 + CharacterNameClashLog.IntervalMs));
        Assert.True(CharacterNameClashLog.ShouldEmit(log, "wallet-b", "Hero", nowMs: 1_000 + 30_000));
    }

    [Fact]
    public void UniqueViolation_Detects23505AndMappedConflict() {
        Assert.True(CharacterNameClash.IsUniqueViolation(new CharacterUniqueConflictException()));
        var postgres = new PostgresException(
            "duplicate key value violates unique constraint \"idx_characters_name_ci\"",
            "ERROR",
            "ERROR",
            "23505");
        Assert.True(CharacterNameClash.IsUniqueViolation(postgres));
        Assert.True(CharacterNameClash.IsUniqueViolation(new InvalidOperationException("wrapped", postgres)));
        Assert.False(CharacterNameClash.IsUniqueViolation(new InvalidOperationException("down")));
    }

    [Fact]
    public void Sql_UpdatesById_AndDoesNotUseNameConflictTarget() {
        Assert.Contains("WHERE id = @id AND account_wallet = @wallet", CharacterSql.UpdateById);
        Assert.DoesNotContain("ON CONFLICT (account_wallet, name)", CharacterSql.UpdateById);
        Assert.DoesNotContain("ON CONFLICT (account_wallet, name)", CharacterSql.Insert);
        Assert.Contains("RETURNING id", CharacterSql.Insert);
        Assert.Contains("jsonb_set", CharacterSql.Rename);
        Assert.Contains("'{CharacterName}'", CharacterSql.Rename);
        Assert.Contains("WHERE id = @id", CharacterSql.Rename);
        Assert.Contains("LOWER(name) = LOWER(@name)", CharacterSql.FindByLowerName);
    }

    [Fact]
    public async Task NameCheck_WhenProbeThrows_IsUnavailable() {
        var (available, message) = await GamePersistence.CheckCharacterNameAvailabilityAsync(
            new ThrowingNameProbe(),
            Path.GetTempPath(),
            "wallet-a",
            "Hero");
        Assert.False(available);
        Assert.Equal(CharacterNameClash.UnavailableMessage, message);
    }

    [Fact]
    public async Task NameCheck_WhenProbeSaysTaken_Rejects() {
        var (available, _) = await GamePersistence.CheckCharacterNameAvailabilityAsync(
            new FixedNameProbe(taken: true),
            Path.GetTempPath(),
            "wallet-a",
            "Hero");
        Assert.False(available);
    }

    [Fact]
    public async Task NameCheck_InvalidFormat_DoesNotCallProbe() {
        var probe = new ThrowingNameProbe();
        var (available, message) = await GamePersistence.CheckCharacterNameAvailabilityAsync(
            probe,
            Path.GetTempPath(),
            "wallet-a",
            "1");
        Assert.False(available);
        Assert.False(probe.Called);
        Assert.NotEqual(CharacterNameClash.UnavailableMessage, message);
    }

    [Fact]
    public async Task Reserve_OtherWallet_DoesNotInsert() {
        var repo = new FakeCharacterRepository();
        repo.Rows.Add(Stored("wallet-a", "Hero"));
        var book = new CharacterIdentityBook(repo);

        var result = await book.ReserveAsync("wallet-b", "hero", Seed("hero"), 0);

        Assert.Equal(CharacterReserveStatus.Taken, result.Status);
        Assert.Equal(0, repo.InsertAttempts);
        Assert.Single(repo.Rows);
    }

    [Fact]
    public async Task Reserve_UniqueRace_BecomesTaken() {
        var repo = new FakeCharacterRepository {
            FindMisses = 1,
            ThrowUniqueOnInsert = true,
        };
        repo.Rows.Add(Stored("wallet-a", "Hero"));
        var book = new CharacterIdentityBook(repo);

        var result = await book.ReserveAsync("wallet-b", "Hero", Seed("Hero"), 0);

        Assert.Equal(CharacterReserveStatus.Taken, result.Status);
        Assert.Equal("wallet-a", repo.Rows[0].Wallet);
    }

    [Fact]
    public async Task Reserve_DatabaseDown_IsUnavailable() {
        var repo = new FakeCharacterRepository { ThrowOnFind = true };
        var book = new CharacterIdentityBook(repo);

        var result = await book.ReserveAsync("wallet-a", "Hero", Seed("Hero"), 0);

        Assert.Equal(CharacterReserveStatus.Unavailable, result.Status);
        Assert.Equal(0, repo.InsertAttempts);
    }

    [Fact]
    public async Task JsonLogin_Clash_BlocksAndDoesNotInsert() {
        var repo = new FakeCharacterRepository();
        repo.Rows.Add(Stored("wallet-a", "Hero"));
        var book = new CharacterIdentityBook(repo);
        var loaded = Seed("Hero") with { Level = 12, Exp = 50 };

        var result = await book.ReconcileAsync("wallet-b", "HERO", loaded);

        Assert.Equal(CharacterLoginStatus.BlockTaken, result.Status);
        Assert.Equal(CharacterNameClash.JsonLoginTakenMessage, result.Message);
        Assert.Equal(0, repo.InsertAttempts);
        Assert.Equal(12, loaded.Level);
        Assert.Single(repo.Rows);
    }

    [Fact]
    public async Task JsonLogin_DatabaseDown_BlocksAndDoesNotInsert() {
        var repo = new FakeCharacterRepository { ThrowOnFind = true };
        var book = new CharacterIdentityBook(repo);

        var result = await book.ReconcileAsync("wallet-b", "Hero", Seed("Hero"));

        Assert.Equal(CharacterLoginStatus.BlockUnavailable, result.Status);
        Assert.Equal(0, repo.InsertAttempts);
    }

    [Fact]
    public async Task JsonLogin_FreeName_InsertsRow() {
        var repo = new FakeCharacterRepository();
        var book = new CharacterIdentityBook(repo);
        var loaded = Seed("Hero") with { Level = 4, NameReservationOnly = false };

        var result = await book.ReconcileAsync("wallet-b", "Hero", loaded);

        Assert.Equal(CharacterLoginStatus.Ok, result.Status);
        Assert.NotNull(result.CharacterId);
        var row = Assert.Single(repo.Rows);
        Assert.Equal("wallet-b", row.Wallet);
        Assert.Equal("Hero", row.Name);
        Assert.False(row.State.NameReservationOnly);
        Assert.Equal(4, row.State.Level);
    }

    [Fact]
    public async Task Save_ById_UpdatesSameRow_WhenCaseDiffers() {
        var repo = new FakeCharacterRepository();
        var existing = Stored("wallet-a", "Hero");
        repo.Rows.Add(existing);
        var book = new CharacterIdentityBook(repo);
        var state = Seed("HERO") with { CharacterDbId = existing.Id, Level = 9, Exp = 80 };

        var saved = await book.SaveAsync("wallet-a", "HERO", state, 1);

        Assert.Equal(CharacterSaveStatus.Saved, saved.Status);
        Assert.Equal(existing.Id, saved.CharacterId);
        Assert.Single(repo.Rows);
        Assert.Equal("Hero", repo.Rows[0].Name);
        Assert.Equal(9, repo.Rows[0].State.Level);
        Assert.Equal(0, repo.InsertAttempts);
    }

    [Fact]
    public async Task Save_OtherWalletOwnsLowerName_IsClash() {
        var repo = new FakeCharacterRepository();
        repo.Rows.Add(Stored("wallet-a", "Hero"));
        var book = new CharacterIdentityBook(repo);

        var saved = await book.SaveAsync("wallet-b", "hero", Seed("hero") with { Level = 3 }, 0);

        Assert.Equal(CharacterSaveStatus.NameClash, saved.Status);
        Assert.Equal(0, repo.InsertAttempts);
        Assert.Equal(1, repo.Rows[0].State.Level);
    }

    [Fact]
    public async Task Save_InsertUniqueRace_IsClash() {
        var repo = new FakeCharacterRepository {
            FindMisses = 1,
            ThrowUniqueOnInsert = true,
        };
        repo.Rows.Add(Stored("wallet-a", "Hero"));
        var book = new CharacterIdentityBook(repo);

        var saved = await book.SaveAsync("wallet-b", "Hero", Seed("Hero"), 0);

        Assert.Equal(CharacterSaveStatus.NameClash, saved.Status);
    }

    [Fact]
    public async Task DualSave_NameClash_DoesNotWriteJson() {
        var dir = NewCharsDir();
        try {
            var saver = new FakeSaver { Next = CharacterSaveResult.NameClash() };
            var result = await GamePersistence.SaveCharacterDualAsync(
                saver, dir, "wallet-a", "Hero", Seed("Hero"));

            Assert.Equal(CharacterSaveStatus.NameClash, result.Status);
            Assert.False(File.Exists(Path.Combine(dir, "wallet-a.json")));
            Assert.Equal(1, saver.Saves);
        } finally {
            Directory.Delete(dir, recursive: true);
        }
    }

    [Fact]
    public async Task DualSave_OtherDatabaseFailure_StillWritesJson() {
        var dir = NewCharsDir();
        try {
            var saver = new FakeSaver { Next = CharacterSaveResult.Failed("connection reset") };
            var result = await GamePersistence.SaveCharacterDualAsync(
                saver, dir, "wallet-a", "Hero", Seed("Hero") with { Level = 6 });

            Assert.Equal(CharacterSaveStatus.Saved, result.Status);
            var json = await File.ReadAllTextAsync(Path.Combine(dir, "wallet-a.json"));
            Assert.Contains("\"CharacterName\": \"Hero\"", json);
            Assert.Contains("\"Level\": 6", json);
        } finally {
            Directory.Delete(dir, recursive: true);
        }
    }

    [Fact]
    public async Task Rename_UpdatesDatabaseJsonAndLiveSession_Together() {
        var dir = NewCharsDir();
        try {
            var repo = new FakeCharacterRepository();
            var existing = Stored("wallet-a", "Hero");
            existing.State = existing.State with { Level = 15, Exp = 100 };
            repo.Rows.Add(existing);
            GamePersistence.TryRewriteCharacterNameInJson(dir, "wallet-a", "Nobody", "Hero", existing.Id);
            WriteJson(dir, "wallet-a", existing.State);
            WriteJson(dir, "wallet-b", Seed("Other"));

            var session = NewSession("wallet-a", "Hero");
            var liveCalls = 0;
            var book = new CharacterIdentityBook(repo);
            var outcome = await book.RenameAsync(
                dir,
                "wallet-a",
                "Hero",
                "Nova",
                liveSessionPresent: true,
                liveSnapshot: null,
                applyLive: id => {
                    liveCalls++;
                    Assert.Equal(existing.Id, id);
                    Assert.True(CharacterLiveRename.TryUpdateSession(session, "wallet-a", "Hero", "Nova", id));
                    return Task.FromResult(true);
                });

            Assert.Equal(CharacterRenameStatus.Renamed, outcome.Status);
            Assert.True(outcome.JsonUpdated);
            Assert.True(outcome.LiveUpdated);
            Assert.Equal(1, liveCalls);
            Assert.Equal("Nova", repo.Rows[0].Name);
            Assert.Equal("Nova", repo.Rows[0].State.CharacterName);
            Assert.Equal(15, repo.Rows[0].State.Level);
            Assert.Equal(existing.Id, repo.Rows[0].State.CharacterDbId);

            var rewritten = JsonSerializer.Deserialize<PlayerPersistenceState>(
                await File.ReadAllTextAsync(Path.Combine(dir, "wallet-a.json")),
                JsonOptions);
            Assert.Equal("Nova", rewritten!.CharacterName);
            Assert.Equal(existing.Id, rewritten.CharacterDbId);
            Assert.Equal(15, rewritten.Level);

            var other = JsonSerializer.Deserialize<PlayerPersistenceState>(
                await File.ReadAllTextAsync(Path.Combine(dir, "wallet-b.json")),
                JsonOptions);
            Assert.Equal("Other", other!.CharacterName);
            Assert.Equal("Nova", session.CharacterName);
            Assert.Equal(existing.Id, session.CharacterDbId);
            Assert.Null(session.NameClashRetryAtUtc);
        } finally {
            Directory.Delete(dir, recursive: true);
        }
    }

    [Fact]
    public async Task Rename_TakenName_ChangesNothing() {
        var dir = NewCharsDir();
        try {
            var repo = new FakeCharacterRepository();
            var hero = Stored("wallet-a", "Hero");
            repo.Rows.Add(hero);
            repo.Rows.Add(Stored("wallet-b", "Nova"));
            WriteJson(dir, "wallet-a", hero.State);
            var session = NewSession("wallet-a", "Hero");
            var book = new CharacterIdentityBook(repo);

            var outcome = await book.RenameAsync(
                dir,
                "wallet-a",
                "Hero",
                "Nova",
                liveSessionPresent: true,
                liveSnapshot: null,
                applyLive: _ => throw new InvalidOperationException("live rename should not run"));

            Assert.Equal(CharacterRenameStatus.Taken, outcome.Status);
            Assert.False(outcome.JsonUpdated);
            Assert.False(outcome.LiveUpdated);
            Assert.Equal(0, repo.RenameAttempts);
            Assert.Equal("Hero", repo.Rows[0].Name);
            Assert.Equal("Hero", session.CharacterName);
            var json = JsonSerializer.Deserialize<PlayerPersistenceState>(
                await File.ReadAllTextAsync(Path.Combine(dir, "wallet-a.json")),
                JsonOptions);
            Assert.Equal("Hero", json!.CharacterName);
        } finally {
            Directory.Delete(dir, recursive: true);
        }
    }

    [Fact]
    public async Task Rename_UniqueRaceOnWrite_DoesNotTouchJsonOrLive() {
        var dir = NewCharsDir();
        try {
            var repo = new FakeCharacterRepository { ForceRenameResult = CharacterRenameWriteResult.Taken };
            var hero = Stored("wallet-a", "Hero");
            repo.Rows.Add(hero);
            WriteJson(dir, "wallet-a", hero.State);
            var book = new CharacterIdentityBook(repo);
            var live = false;

            var outcome = await book.RenameAsync(
                dir,
                "wallet-a",
                "Hero",
                "Nova",
                liveSessionPresent: true,
                liveSnapshot: null,
                applyLive: _ => {
                    live = true;
                    return Task.FromResult(true);
                });

            Assert.Equal(CharacterRenameStatus.Taken, outcome.Status);
            Assert.False(live);
            Assert.Equal("Hero", repo.Rows[0].Name);
            var json = JsonSerializer.Deserialize<PlayerPersistenceState>(
                await File.ReadAllTextAsync(Path.Combine(dir, "wallet-a.json")),
                JsonOptions);
            Assert.Equal("Hero", json!.CharacterName);
        } finally {
            Directory.Delete(dir, recursive: true);
        }
    }

    [Fact]
    public async Task Rename_JsonOnlyCharacter_InsertsRowUnderNewName() {
        var dir = NewCharsDir();
        try {
            WriteJson(dir, "wallet-b", Seed("Hero") with { Level = 8 });
            var repo = new FakeCharacterRepository();
            var book = new CharacterIdentityBook(repo);

            var outcome = await book.RenameAsync(
                dir, "wallet-b", "Hero", "Nova", liveSessionPresent: false, liveSnapshot: null, applyLive: null);

            Assert.Equal(CharacterRenameStatus.Renamed, outcome.Status);
            var row = Assert.Single(repo.Rows);
            Assert.Equal("Nova", row.Name);
            Assert.Equal(8, row.State.Level);
            Assert.Equal("Nova", row.State.CharacterName);
            var json = JsonSerializer.Deserialize<PlayerPersistenceState>(
                await File.ReadAllTextAsync(Path.Combine(dir, "wallet-b.json")),
                JsonOptions);
            Assert.Equal("Nova", json!.CharacterName);
            Assert.Equal(row.Id, json.CharacterDbId);
        } finally {
            Directory.Delete(dir, recursive: true);
        }
    }

    [Fact]
    public void LiveRename_MovesOnlineDirectoryKey() {
        var player = new GameWorldPlayer(
            Guid.NewGuid(),
            _ => { },
            _ => { },
            _ => { },
            () => { },
            new Dictionary<int, ItemConfig>(),
            new MovementSpeedViolationCheckConfig(false, 10, 1000, 1, 1000, 200),
            8,
            0.1);
        player.SetAccountWallet("wallet-a");
        player.SetCharacterName("Hero");
        OnlinePlayerDirectory.Register(player);

        CharacterLiveRename.ApplyWorldPlayerRename(player, "Nova");

        Assert.False(OnlinePlayerDirectory.TryGet("wallet-a", "Hero", out _));
        Assert.True(OnlinePlayerDirectory.TryGet("wallet-a", "Nova", out var found));
        Assert.Same(player, found);
        Assert.Equal("Nova", player.CharacterName);
        OnlinePlayerDirectory.Unregister(player);
    }

    [Fact]
    public void ReservationSeed_IsHiddenFromTheCharacterList() {
        var seed = CharacterIdentityBook.CreateReservationSeed("traveler", "Hero", 0, 1, 0, 2, 3, 14, 10, 10, 10, 10, 10);
        Assert.True(seed.NameReservationOnly);
        Assert.True(CharacterNameClash.ShouldHideFromCharacterList(seed.NameReservationOnly));
        Assert.Equal("Hero", seed.CharacterName);
        Assert.Equal(14, seed.Str);
    }

    static PlayerPersistenceState Seed(string name) =>
        new(
            "traveler",
            1,
            2,
            260,
            1200,
            800,
            1,
            8,
            500,
            (int)AttackType.Stun,
            true,
            true,
            false,
            CharacterName: name,
            Level: 1);

    static StoredCharacter Stored(string wallet, string name) {
        var state = Seed(name);
        return new StoredCharacter(Guid.NewGuid(), wallet, name, state, state.SlotIndex);
    }

    static PlayerSession NewSession(string wallet, string name) =>
        new(wallet, Guid.NewGuid(), "traveler", new ClientWebSocket(), name);

    static string NewCharsDir() {
        var dir = Path.Combine(Path.GetTempPath(), "char-clash-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        return dir;
    }

    static void WriteJson(string dir, string wallet, PlayerPersistenceState state) {
        var path = Path.Combine(dir, wallet + ".json");
        File.WriteAllText(path, JsonSerializer.Serialize(state, JsonOptions));
    }

    static readonly JsonSerializerOptions JsonOptions = new() {
        PropertyNameCaseInsensitive = true,
    };

    sealed class ThrowingNameProbe : ICharacterNameProbe {
        public bool Called { get; private set; }

        public Task<bool> IsCharacterNameTakenByOtherWalletAsync(
            string accountWallet,
            string characterName,
            CancellationToken cancellationToken = default) {
            Called = true;
            throw new IOException("database unavailable");
        }
    }

    sealed class FixedNameProbe(bool taken) : ICharacterNameProbe {
        public Task<bool> IsCharacterNameTakenByOtherWalletAsync(
            string accountWallet,
            string characterName,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(taken);
    }

    sealed class FakeSaver : ICharacterSaver {
        public CharacterSaveResult Next { get; set; } = CharacterSaveResult.NameClash();
        public int Saves { get; private set; }

        public Task UpsertAccountLoginAsync(string walletPubkey, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task<CharacterSaveResult> SaveCharacterAsync(
            string accountWallet,
            string characterName,
            PlayerPersistenceState state,
            CancellationToken cancellationToken = default) {
            Saves++;
            return Task.FromResult(Next);
        }
    }

    sealed class StoredCharacter {
        public StoredCharacter(Guid id, string wallet, string name, PlayerPersistenceState state, int slot) {
            Id = id;
            Wallet = wallet;
            Name = name;
            State = state;
            Slot = slot;
        }

        public Guid Id { get; }
        public string Wallet { get; }
        public string Name { get; set; }
        public PlayerPersistenceState State { get; set; }
        public int Slot { get; set; }
    }

    sealed class FakeCharacterRepository : ICharacterRepository {
        public List<StoredCharacter> Rows { get; } = new();
        public int InsertAttempts { get; private set; }
        public int RenameAttempts { get; private set; }
        public bool ThrowOnFind { get; set; }
        public bool ThrowUniqueOnInsert { get; set; }
        public int FindMisses { get; set; }
        public CharacterRenameWriteResult? ForceRenameResult { get; set; }

        public Task<CharacterRow?> FindByLowerNameAsync(string name, CancellationToken cancellationToken = default) {
            if (ThrowOnFind) {
                throw new IOException("database unavailable");
            }
            if (FindMisses > 0) {
                FindMisses--;
                return Task.FromResult<CharacterRow?>(null);
            }
            return Task.FromResult(ToRow(Rows.FirstOrDefault(row => CharacterNameClash.SameName(row.Name, name))));
        }

        public Task<CharacterRow?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default) {
            if (ThrowOnFind) {
                throw new IOException("database unavailable");
            }
            return Task.FromResult(ToRow(Rows.FirstOrDefault(row => row.Id == id)));
        }

        public Task<CharacterRow?> FindByWalletAndLowerNameAsync(
            string wallet,
            string name,
            CancellationToken cancellationToken = default) {
            if (ThrowOnFind) {
                throw new IOException("database unavailable");
            }
            return Task.FromResult(ToRow(Rows.FirstOrDefault(row =>
                CharacterNameClash.SameWallet(row.Wallet, wallet) &&
                CharacterNameClash.SameName(row.Name, name))));
        }

        public Task<Guid> InsertAsync(
            string wallet,
            string name,
            PlayerPersistenceState state,
            int slotIndex,
            CancellationToken cancellationToken = default) {
            InsertAttempts++;
            if (ThrowUniqueOnInsert || Rows.Any(row => CharacterNameClash.SameName(row.Name, name))) {
                throw new CharacterUniqueConflictException();
            }
            var id = Guid.NewGuid();
            Rows.Add(new StoredCharacter(id, wallet.Trim(), name.Trim(), state with { CharacterName = name.Trim() }, slotIndex));
            return Task.FromResult(id);
        }

        public Task<bool> UpdateByIdAsync(
            Guid id,
            string wallet,
            PlayerPersistenceState state,
            int slotIndex,
            CancellationToken cancellationToken = default) {
            var row = Rows.FirstOrDefault(candidate =>
                candidate.Id == id && CharacterNameClash.SameWallet(candidate.Wallet, wallet));
            if (row is null) {
                return Task.FromResult(false);
            }
            row.State = state;
            row.Slot = slotIndex;
            return Task.FromResult(true);
        }

        public Task<CharacterRenameWriteResult> RenameAsync(
            Guid id,
            string wallet,
            string currentName,
            string newName,
            CancellationToken cancellationToken = default) {
            RenameAttempts++;
            if (ForceRenameResult is { } forced) {
                return Task.FromResult(forced);
            }
            var row = Rows.FirstOrDefault(candidate =>
                candidate.Id == id &&
                CharacterNameClash.SameWallet(candidate.Wallet, wallet) &&
                CharacterNameClash.SameName(candidate.Name, currentName));
            if (row is null) {
                return Task.FromResult(CharacterRenameWriteResult.Missing);
            }
            if (Rows.Any(candidate => candidate.Id != id && CharacterNameClash.SameName(candidate.Name, newName))) {
                return Task.FromResult(CharacterRenameWriteResult.Taken);
            }
            row.Name = newName.Trim();
            row.State = row.State with { CharacterName = row.Name, CharacterDbId = row.Id };
            return Task.FromResult(CharacterRenameWriteResult.Updated);
        }

        static CharacterRow? ToRow(StoredCharacter? row) =>
            row is null ? null : new CharacterRow(row.Id, row.Wallet, row.Name, row.State.NameReservationOnly);
    }
}
