using System.Linq;
using System.Text.Json;
using Npgsql;
using Server.Helpers;
using Server.Utils;
using Server.World.Game;

namespace Server.Persistence;

/// <summary>Optional PostgreSQL persistence for wallet accounts, character snapshots, and NFT drop ledger rows.</summary>
public sealed class GamePersistenceService : IAsyncDisposable {
    private static readonly JsonSerializerOptions JsonOptions = new() {
        WriteIndented = false,
        PropertyNameCaseInsensitive = true,
    };

    private readonly NpgsqlDataSource dataSource;

    private GamePersistenceService(NpgsqlDataSource dataSource) {
        this.dataSource = dataSource;
    }

    public static GamePersistenceService? TryCreateFromEnvironment() {
        var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL")
            ?? Environment.GetEnvironmentVariable("POSTGRES_CONNECTION_STRING");
        if (string.IsNullOrWhiteSpace(connectionString)) {
            return null;
        }

        connectionString = NormalizeConnectionString(connectionString.Trim());
        var dataSource = NpgsqlDataSource.Create(connectionString);
        Console.WriteLine("[Persistence] PostgreSQL enabled.");
        return new GamePersistenceService(dataSource);
    }

    /// <summary>Accepts libpq URI (<c>postgresql://</c>) or standard Npgsql key/value strings.</summary>
    private static string NormalizeConnectionString(string raw) {
        if (!raw.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            && !raw.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)) {
            return raw;
        }

        var uri = new Uri(raw);
        var userInfo = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = uri.AbsolutePath.TrimStart('/'),
            Username = Uri.UnescapeDataString(userInfo[0]),
        };

        if (userInfo.Length > 1) {
            builder.Password = Uri.UnescapeDataString(userInfo[1]);
        }

        return builder.ConnectionString;
    }

    public async Task EnsureSchemaAsync(CancellationToken cancellationToken = default) {
        var schemaPath = Path.Combine(AppContext.BaseDirectory, "Persistence", "schema.sql");
        if (!File.Exists(schemaPath)) {
            schemaPath = Path.Combine(Directory.GetCurrentDirectory(), "Persistence", "schema.sql");
        }

        if (!File.Exists(schemaPath)) {
            Console.Error.WriteLine($"[Persistence] schema.sql not found at '{schemaPath}'.");
            return;
        }

        var sql = await File.ReadAllTextAsync(schemaPath, cancellationToken).ConfigureAwait(false);
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
        Console.WriteLine("[Persistence] Schema applied.");
    }

    public async Task UpsertAccountLoginAsync(string walletPubkey, CancellationToken cancellationToken = default) {
        if (string.IsNullOrWhiteSpace(walletPubkey)) {
            return;
        }

        const string sql = """
            INSERT INTO accounts (wallet_pubkey, last_login_at)
            VALUES (@wallet, NOW())
            ON CONFLICT (wallet_pubkey) DO UPDATE SET last_login_at = NOW()
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("wallet", walletPubkey.Trim());
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<PlayerPersistenceState?> LoadCharacterAsync(
        string accountWallet,
        string characterName,
        CancellationToken cancellationToken = default) {
        const string sql = """
            SELECT state_json, slot_index, hours_played
            FROM characters
            WHERE account_wallet = @wallet AND name = @name
            LIMIT 1
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("wallet", accountWallet);
        command.Parameters.AddWithValue("name", characterName);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        if (!await reader.ReadAsync(cancellationToken).ConfigureAwait(false)) {
            return null;
        }

        var json = reader.GetString(0);
        if (string.IsNullOrWhiteSpace(json)) {
            return null;
        }

        try {
            var state = JsonSerializer.Deserialize<PlayerPersistenceState>(json);
            if (state is null) {
                return null;
            }

            // Prefer dedicated columns when present (schema migration); fall back to JSON fields.
            var slotIndex = reader.IsDBNull(1) ? state.SlotIndex : reader.GetInt32(1);
            var hoursPlayed = reader.IsDBNull(2) ? state.HoursPlayed : reader.GetDouble(2);
            if (slotIndex == state.SlotIndex && Math.Abs(hoursPlayed - state.HoursPlayed) < 0.0001) {
                return state;
            }

            return state with { SlotIndex = slotIndex, HoursPlayed = hoursPlayed };
        } catch (JsonException ex) {
            Console.Error.WriteLine($"[Persistence] Failed to deserialize character '{characterName}' for '{accountWallet}': {ex.Message}");
            return null;
        }
    }

    /// <summary>
    /// True when another wallet already owns this display name (case-insensitive).
    /// Same wallet may keep / re-use its own names.
    /// </summary>
    public async Task<bool> IsCharacterNameTakenByOtherWalletAsync(
        string accountWallet,
        string characterName,
        CancellationToken cancellationToken = default) {
        var wallet = (accountWallet ?? string.Empty).Trim();
        var name = (characterName ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(name)) {
            return false;
        }

        const string sql = """
            SELECT 1
            FROM characters
            WHERE LOWER(name) = LOWER(@name)
              AND account_wallet <> @wallet
            LIMIT 1
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("name", name);
        command.Parameters.AddWithValue("wallet", wallet);
        var result = await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);
        return result is not null;
    }

    /// <summary>Lists up to 4 SELECTCHAR desk rows for a wallet (ordered by slot_index).</summary>
    public async Task<IReadOnlyList<CharacterListEntry>> ListCharactersAsync(
        string accountWallet,
        CancellationToken cancellationToken = default) {
        const string sql = """
            SELECT name, slot_index, hours_played, state_json
            FROM characters
            WHERE account_wallet = @wallet
            ORDER BY slot_index ASC, updated_at ASC
            LIMIT 4
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("wallet", accountWallet);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);

        var results = new List<CharacterListEntry>(4);
        var usedSlots = new HashSet<int>();
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false)) {
            var name = reader.GetString(0);
            var slotIndex = reader.IsDBNull(1) ? results.Count : reader.GetInt32(1);
            var hoursPlayed = reader.IsDBNull(2) ? 0d : reader.GetDouble(2);
            var json = reader.IsDBNull(3) ? null : reader.GetString(3);

            var level = 1;
            long exp = 0;
            var rebirth = 0;
            var str = 10;
            var vit = 10;
            var dex = 10;
            var intel = 10;
            var mag = 10;
            var chr = 10;
            var genderValue = 0;
            var skinColorValue = 0;
            var hairStyleIndex = 0;
            var underwearColorIndex = 0;
            List<CharacterListEquipPreview>? equipped = null;
            var citizenshipSide = "traveler";

            if (!string.IsNullOrWhiteSpace(json)) {
                try {
                    var state = JsonSerializer.Deserialize<PlayerPersistenceState>(json);
                    if (state is not null) {
                        level = Math.Max(1, state.Level);
                        exp = Math.Max(0, state.Exp);
                        rebirth = Math.Max(0, state.Rebirth);
                        str = state.Str > 0 ? state.Str : 10;
                        vit = state.Vit > 0 ? state.Vit : 10;
                        dex = state.Dex > 0 ? state.Dex : 10;
                        intel = state.Int > 0 ? state.Int : 10;
                        mag = state.Mag > 0 ? state.Mag : 10;
                        chr = state.Chr > 0 ? state.Chr : 10;
                        genderValue = Math.Clamp(state.GenderValue, 0, 1);
                        skinColorValue = Math.Clamp(state.SkinColorValue, 0, 2);
                        hairStyleIndex = Math.Clamp(state.HairStyleIndex, 0, 7);
                        underwearColorIndex = Math.Clamp(state.UnderwearColorIndex, 0, 7);
                        if (hoursPlayed <= 0 && state.HoursPlayed > 0) {
                            hoursPlayed = state.HoursPlayed;
                        }
                        if (slotIndex < 0 || slotIndex > 3) {
                            slotIndex = state.SlotIndex;
                        }
                        equipped = GamePersistence.ExtractEquipPreview(state) is { } eqList
                            ? new List<CharacterListEquipPreview>(eqList)
                            : null;
                        citizenshipSide = GamePersistence.NormalizeCitizenshipSide(state.CitizenshipSide);
                    }
                } catch (JsonException ex) {
                    Console.Error.WriteLine($"[Persistence] Failed to parse list row '{name}' for '{accountWallet}': {ex.Message}");
                }
            }

            if (slotIndex < 0 || slotIndex > 3 || usedSlots.Contains(slotIndex)) {
                for (var candidate = 0; candidate < 4; candidate++) {
                    if (!usedSlots.Contains(candidate)) {
                        slotIndex = candidate;
                        break;
                    }
                }
            }

            // Persist repaired slot when two chars shared the same slot_index (SELECTCHAR double-face bug).
            if (!reader.IsDBNull(1) && reader.GetInt32(1) != slotIndex) {
                try {
                    await RepairCharacterSlotIndexAsync(accountWallet, name, slotIndex, cancellationToken)
                        .ConfigureAwait(false);
                    Console.WriteLine(
                        $"[Persistence] Repaired slot_index for '{name}' wallet={accountWallet[..Math.Min(12, accountWallet.Length)]}… → slot {slotIndex}");
                } catch (Exception ex) {
                    Console.Error.WriteLine(
                        $"[Persistence] Failed slot repair for '{name}': {ex.Message}");
                }
            }

            usedSlots.Add(slotIndex);
            results.Add(new CharacterListEntry(
                slotIndex, name, level, exp, rebirth, hoursPlayed, str, vit, dex, intel, mag, chr,
                genderValue, skinColorValue, hairStyleIndex, underwearColorIndex, equipped, citizenshipSide));
        }

        results.Sort((a, b) => a.SlotIndex.CompareTo(b.SlotIndex));
        return results;
    }

    /// <summary>Writes a unique slot_index after collision repair (same wallet must not share slots).</summary>
    async Task RepairCharacterSlotIndexAsync(
        string accountWallet,
        string characterName,
        int slotIndex,
        CancellationToken cancellationToken) {
        const string sql = """
            UPDATE characters
            SET slot_index = @slot, updated_at = NOW()
            WHERE account_wallet = @wallet AND name = @name
            """;
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("slot", Math.Clamp(slotIndex, 0, 3));
        command.Parameters.AddWithValue("wallet", accountWallet);
        command.Parameters.AddWithValue("name", characterName);
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task SaveCharacterAsync(
        string accountWallet,
        string characterName,
        PlayerPersistenceState state,
        CancellationToken cancellationToken = default) {
        ArgumentNullException.ThrowIfNull(state);
        var hoursPlayed = Math.Max(0, state.HoursPlayed);

        // Never let two names on the same wallet share a slot forever — claim a free index if taken by another char.
        var slotIndex = await ResolveUniqueSlotIndexAsync(
                accountWallet,
                characterName,
                Math.Clamp(state.SlotIndex, 0, 3),
                cancellationToken)
            .ConfigureAwait(false);
        // PlayerPersistenceState.SlotIndex is init-only — write unique slot only on the DB row.
        var json = JsonSerializer.Serialize(state, JsonOptions);

        const string sql = """
            INSERT INTO characters (account_wallet, name, world_id, pos_x, pos_y, state_json, slot_index, hours_played, updated_at)
            VALUES (@wallet, @name, @worldId, @x, @y, @stateJson::jsonb, @slotIndex, @hoursPlayed, NOW())
            ON CONFLICT (account_wallet, name) DO UPDATE SET
                world_id = EXCLUDED.world_id,
                pos_x = EXCLUDED.pos_x,
                pos_y = EXCLUDED.pos_y,
                state_json = EXCLUDED.state_json,
                slot_index = EXCLUDED.slot_index,
                hours_played = EXCLUDED.hours_played,
                updated_at = NOW()
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("wallet", accountWallet);
        command.Parameters.AddWithValue("name", characterName);
        command.Parameters.AddWithValue("worldId", state.GameWorldId);
        command.Parameters.AddWithValue("x", state.X);
        command.Parameters.AddWithValue("y", state.Y);
        command.Parameters.AddWithValue("stateJson", json);
        command.Parameters.AddWithValue("slotIndex", slotIndex);
        command.Parameters.AddWithValue("hoursPlayed", hoursPlayed);
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Ensures this character's slot is free of other names on the same wallet.
    /// Prefer <paramref name="preferredSlot"/> when free or already owned by this name.
    /// </summary>
    async Task<int> ResolveUniqueSlotIndexAsync(
        string accountWallet,
        string characterName,
        int preferredSlot,
        CancellationToken cancellationToken) {
        preferredSlot = Math.Clamp(preferredSlot, 0, 3);
        const string sql = """
            SELECT name, slot_index
            FROM characters
            WHERE account_wallet = @wallet
            """;
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("wallet", accountWallet);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);

        var takenByOther = new HashSet<int>();
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false)) {
            var n = reader.GetString(0);
            var s = reader.IsDBNull(1) ? -1 : reader.GetInt32(1);
            if (s < 0 || s > 3) {
                continue;
            }
            if (string.Equals(n, characterName, StringComparison.OrdinalIgnoreCase)) {
                // Already ours at preferred — keep.
                if (s == preferredSlot) {
                    return preferredSlot;
                }
                continue;
            }
            takenByOther.Add(s);
        }

        if (!takenByOther.Contains(preferredSlot)) {
            return preferredSlot;
        }
        for (var candidate = 0; candidate < 4; candidate++) {
            if (!takenByOther.Contains(candidate)) {
                return candidate;
            }
        }
        return preferredSlot;
    }

    public async Task<Guid?> InsertDropLedgerAsync(
        string accountWallet,
        string characterName,
        InventoryItemState item,
        int? sourceMonsterId,
        string? sourceMap,
        bool isNftCandidate,
        string nftTier,
        CancellationToken cancellationToken = default) {
        await UpsertAccountLoginAsync(accountWallet, cancellationToken).ConfigureAwait(false);

        const string sql = """
            INSERT INTO drop_ledger (
                account_wallet, character_name, item_uid, item_id, item_attribute, item_color,
                quantity, source_monster_id, source_map, is_nft_candidate, nft_tier
            )
            VALUES (
                @wallet, @characterName, @itemUid, @itemId, @itemAttribute, @itemColor,
                @quantity, @sourceMonsterId, @sourceMap, @isNftCandidate, @nftTier
            )
            ON CONFLICT (account_wallet, item_uid) DO NOTHING
            RETURNING id
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("wallet", accountWallet);
        command.Parameters.AddWithValue("characterName", characterName);
        command.Parameters.AddWithValue("itemUid", item.ItemUid);
        command.Parameters.AddWithValue("itemId", item.ItemId);
        command.Parameters.AddWithValue("itemAttribute", (int)item.ItemAttribute);
        command.Parameters.AddWithValue("itemColor", item.ItemColor);
        command.Parameters.AddWithValue("quantity", item.Quantity);
        command.Parameters.AddWithValue("sourceMonsterId", (object?)sourceMonsterId ?? DBNull.Value);
        command.Parameters.AddWithValue("sourceMap", (object?)sourceMap ?? DBNull.Value);
        command.Parameters.AddWithValue("isNftCandidate", isNftCandidate);
        command.Parameters.AddWithValue("nftTier", nftTier);
        var result = await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);
        return result is Guid guid ? guid : null;
    }

    /// <summary>
    /// Logs one PvP kill into <c>pvp_kills</c>; when <paramref name="applyRating"/> is true (tournament arena kill with two
    /// distinct wallets) also applies an Elo K=32 exchange to <c>pvp_ratings</c> and appends both deltas to <c>rating_events</c>,
    /// all inside a single transaction.
    /// </summary>
    public async Task RecordPvpKillAsync(
        string worldId,
        string killerWallet,
        string killerName,
        string victimWallet,
        string victimName,
        bool applyRating,
        CancellationToken cancellationToken = default) {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);

        const string insertKillSql = """
            INSERT INTO pvp_kills (world_id, killer_wallet, killer_name, victim_wallet, victim_name)
            VALUES (@worldId, @killerWallet, @killerName, @victimWallet, @victimName)
            RETURNING id
            """;
        Guid killId;
        await using (var insertKill = new NpgsqlCommand(insertKillSql, connection, transaction)) {
            insertKill.Parameters.AddWithValue("worldId", worldId);
            insertKill.Parameters.AddWithValue("killerWallet", killerWallet);
            insertKill.Parameters.AddWithValue("killerName", killerName);
            insertKill.Parameters.AddWithValue("victimWallet", victimWallet);
            insertKill.Parameters.AddWithValue("victimName", victimName);
            killId = (Guid)(await insertKill.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false))!;
        }

        if (applyRating) {
            var killerRating = await ReadOrSeedRatingAsync(connection, transaction, killerWallet, killerName, cancellationToken).ConfigureAwait(false);
            var victimRating = await ReadOrSeedRatingAsync(connection, transaction, victimWallet, victimName, cancellationToken).ConfigureAwait(false);

            // Standard Elo with K=32: winner takes what the loser gives up.
            const double K = 32.0;
            var expectedKiller = 1.0 / (1.0 + Math.Pow(10.0, (victimRating - killerRating) / 400.0));
            var delta = Math.Max(1, (int)Math.Round(K * (1.0 - expectedKiller)));
            var killerAfter = killerRating + delta;
            var victimAfter = victimRating - delta;

            await ApplyRatingResultAsync(connection, transaction, killerWallet, killerName, killerAfter, won: true, cancellationToken).ConfigureAwait(false);
            await ApplyRatingResultAsync(connection, transaction, victimWallet, victimName, victimAfter, won: false, cancellationToken).ConfigureAwait(false);
            await InsertRatingEventAsync(connection, transaction, killerWallet, delta, killerAfter, killId, cancellationToken).ConfigureAwait(false);
            await InsertRatingEventAsync(connection, transaction, victimWallet, -delta, victimAfter, killId, cancellationToken).ConfigureAwait(false);
        }

        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Returns the current solo rating for the wallet, inserting the default 1200 row on first contact.</summary>
    private static async Task<int> ReadOrSeedRatingAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string wallet,
        string displayName,
        CancellationToken cancellationToken) {
        const string sql = """
            INSERT INTO pvp_ratings (wallet, mode, display_name)
            VALUES (@wallet, 'solo', @displayName)
            ON CONFLICT (wallet, mode) DO UPDATE SET display_name = EXCLUDED.display_name
            RETURNING rating
            """;
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("wallet", wallet);
        command.Parameters.AddWithValue("displayName", displayName);
        return (int)(await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false))!;
    }

    private static async Task ApplyRatingResultAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string wallet,
        string displayName,
        int newRating,
        bool won,
        CancellationToken cancellationToken) {
        const string sql = """
            UPDATE pvp_ratings SET
                rating = @rating,
                peak_rating = GREATEST(peak_rating, @rating),
                matches = matches + 1,
                wins = wins + @winInc,
                losses = losses + @lossInc,
                display_name = @displayName,
                last_match_at = NOW()
            WHERE wallet = @wallet AND mode = 'solo'
            """;
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("rating", newRating);
        command.Parameters.AddWithValue("winInc", won ? 1 : 0);
        command.Parameters.AddWithValue("lossInc", won ? 0 : 1);
        command.Parameters.AddWithValue("displayName", displayName);
        command.Parameters.AddWithValue("wallet", wallet);
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    private static async Task InsertRatingEventAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string wallet,
        int delta,
        int ratingAfter,
        Guid killId,
        CancellationToken cancellationToken) {
        const string sql = """
            INSERT INTO rating_events (wallet, mode, delta, rating_after, reason, ref_id)
            VALUES (@wallet, 'solo', @delta, @ratingAfter, 'match', @refId)
            """;
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("wallet", wallet);
        command.Parameters.AddWithValue("delta", delta);
        command.Parameters.AddWithValue("ratingAfter", ratingAfter);
        command.Parameters.AddWithValue("refId", killId);
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    public async ValueTask DisposeAsync() {
        await dataSource.DisposeAsync().ConfigureAwait(false);
    }
}

/// <summary>Process-wide optional persistence handle initialized at server startup.</summary>
public static class GamePersistence {
    /// <summary>Shared JSON options for dual-write traveler/character files (case-insensitive for nested snapshots).</summary>
    private static readonly JsonSerializerOptions JsonOptions = new() {
        WriteIndented = false,
        PropertyNameCaseInsensitive = true,
    };

    public static GamePersistenceService? Current { get; private set; }

    public static async Task InitializeAsync(CancellationToken cancellationToken = default) {
        if (Current is not null) {
            await Current.DisposeAsync().ConfigureAwait(false);
            Current = null;
        }

        Current = GamePersistenceService.TryCreateFromEnvironment();
        if (Current is not null) {
            await Current.EnsureSchemaAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    public static async Task SaveCharacterDualAsync(
        GamePersistenceService? persistence,
        string charsDirectory,
        string accountWallet,
        string characterName,
        PlayerPersistenceState state,
        bool travelerMode = false) {
        if (PlaytestMode.IsEnabled) {
            if (!PlaytestMode.IsIsolatedAccount(accountWallet)) {
                Console.WriteLine(
                    $"[PLAYTEST] Refusing character save for '{characterName}' — not the isolated playtest account. Postgres not written.");
                await Task.CompletedTask.ConfigureAwait(false);
                return;
            }

            if (!PlaytestElonQaKit.ShouldWriteSave(charsDirectory, state)) {
                await Task.CompletedTask.ConfigureAwait(false);
                return;
            }

            SavePlayerJson(charsDirectory, accountWallet, state, travelerMode: true);
            Console.WriteLine(
                $"[PLAYTEST] Saved JSON-only '{characterName}' L{state.Level} ({state.X},{state.Y}) — Postgres skipped.");
            await Task.CompletedTask.ConfigureAwait(false);
            return;
        }

        // Always dual-write PostgreSQL when available (including traveler). JSON remains the traveler
        // load primary / GM sandbox namespace so OP kits never mix across modes.
        if (persistence is not null) {
            try {
                await persistence.UpsertAccountLoginAsync(accountWallet).ConfigureAwait(false);
                await persistence.SaveCharacterAsync(accountWallet, characterName, state).ConfigureAwait(false);
            } catch (Exception ex) {
                Console.Error.WriteLine($"[Persistence] PostgreSQL save failed for '{accountWallet}': {ex.Message}");
            }
        }

        // Traveler sessions use a separate JSON namespace so GM sandbox OP kits are never overwritten or reloaded on :8081.
        SavePlayerJson(charsDirectory, accountWallet, state, travelerMode);
        Console.WriteLine(
            $"[Persistence] Saved {(travelerMode ? "traveler" : "character")} '{characterName}' wallet={accountWallet[..Math.Min(8, accountWallet.Length)]}… world={state.GameWorldId} L{state.Level} exp={state.Exp} ({state.X},{state.Y})");
    }

    public static async Task<PlayerPersistenceState?> LoadCharacterDualAsync(
        GamePersistenceService? persistence,
        string charsDirectory,
        string accountWallet,
        string characterName,
        bool travelerMode = false) {
        if (PlaytestMode.IsEnabled) {
            if (!PlaytestMode.IsIsolatedAccount(accountWallet)) {
                return await Task.FromResult<PlayerPersistenceState?>(null).ConfigureAwait(false);
            }

            var playtestState = PlaytestElonQaKit.LoadPreferredState(charsDirectory);
            if (string.Equals(
                    playtestState.CharacterName.Trim(),
                    characterName.Trim(),
                    StringComparison.OrdinalIgnoreCase)) {
                return await Task.FromResult(playtestState).ConfigureAwait(false);
            }

            return await Task.FromResult<PlayerPersistenceState?>(null).ConfigureAwait(false);
        }

        if (travelerMode) {
            PlayerPersistenceState? fromDb = null;
            if (persistence is not null) {
                try {
                    fromDb = await persistence.LoadCharacterAsync(accountWallet, characterName).ConfigureAwait(false);
                } catch (Exception ex) {
                    Console.Error.WriteLine($"[Persistence] PostgreSQL traveler load failed for '{accountWallet}': {ex.Message}");
                }
            }

            var travelerJson = LoadPlayerJson(charsDirectory, accountWallet, travelerMode: true);
            PlayerPersistenceState? fromJson = null;
            if (travelerJson is not null) {
                var travelerName = string.IsNullOrWhiteSpace(travelerJson.CharacterName)
                    ? accountWallet
                    : travelerJson.CharacterName.Trim();
                if (string.Equals(travelerName, characterName.Trim(), StringComparison.OrdinalIgnoreCase)) {
                    fromJson = travelerJson;
                }
            }

            // Prefer the richer / higher-progress snapshot so force-kills that only flushed one store
            // do not roll the player back (common when JSON lagged behind PG or vice versa).
            var preferred = PreferFresherPersistenceState(fromDb, fromJson);
            if (preferred is not null) {
                return preferred;
            }

            // Do not fall through to the GM sandbox save — traveler must not inherit OP kits.
            return null;
        }

        if (persistence is not null) {
            try {
                var fromDb = await persistence.LoadCharacterAsync(accountWallet, characterName).ConfigureAwait(false);
                if (fromDb is not null) {
                    return fromDb;
                }
            } catch (Exception ex) {
                Console.Error.WriteLine($"[Persistence] PostgreSQL load failed for '{accountWallet}': {ex.Message}");
            }
        }

        // Legacy one-file-per-wallet JSON: only reuse when the saved name matches the requested
        // character. Otherwise empty slots would all load the same sandbox/tester save.
        var fromJsonGm = LoadPlayerJson(charsDirectory, accountWallet, travelerMode: false);
        if (fromJsonGm is null) {
            return null;
        }

        var jsonName = string.IsNullOrWhiteSpace(fromJsonGm.CharacterName) ? accountWallet : fromJsonGm.CharacterName.Trim();
        if (!string.Equals(jsonName, characterName.Trim(), StringComparison.OrdinalIgnoreCase)) {
            return null;
        }

        return fromJsonGm;
    }

    /// <summary>
    /// Picks the snapshot with more progress (rebirth → level → exp → bag depth) so a stale mirror
    /// of dual-write cannot silently roll the character back on login.
    /// </summary>
    static PlayerPersistenceState? PreferFresherPersistenceState(
        PlayerPersistenceState? a,
        PlayerPersistenceState? b) {
        if (a is null) {
            return b;
        }
        if (b is null) {
            return a;
        }

        var scoreA = PersistenceProgressScore(a);
        var scoreB = PersistenceProgressScore(b);
        return scoreB > scoreA ? b : a;
    }

    static long PersistenceProgressScore(PlayerPersistenceState state) {
        var bag = state.BagItems?.Length ?? 0;
        var eq = state.EquippedItems?.Length ?? 0;
        long kills = 0;
        if (state.MonsterKills is not null) {
            foreach (var row in state.MonsterKills) {
                kills += Math.Max(0, row.Kills);
            }
        }
        // Prefer higher level + exp within a band; do NOT let a mid-level higher-RB snapshot
        // always beat a cancelled-rebirth L-max lower-RB state (that undid Cancel Rebirth on relog).
        // Score: level dominates within ±1 RB, then exp, then light RB bias, then inventory.
        return (long)Math.Max(1, state.Level) * 10_000_000_000L
            + Math.Max(0L, state.Exp)
            + (long)Math.Max(0, state.Rebirth) * 1_000_000L
            + kills * 10L
            + bag
            + eq;
    }

    /// <summary>
    /// Lists SELECTCHAR rows. Prefers PostgreSQL (multi-slot) for both traveler and GM accounts so
    /// creating a 2nd character does not hide the first. Falls back to the single JSON mirror.
    /// </summary>
    public static async Task<IReadOnlyList<CharacterListEntry>> ListCharactersDualAsync(
        GamePersistenceService? persistence,
        string charsDirectory,
        string accountWallet,
        bool travelerMode = false) {
        if (PlaytestMode.IsEnabled) {
            if (!PlaytestMode.IsIsolatedAccount(accountWallet)) {
                return await Task.FromResult<IReadOnlyList<CharacterListEntry>>(
                    Array.Empty<CharacterListEntry>()).ConfigureAwait(false);
            }

            var playtestState = PlaytestElonQaKit.LoadPreferredState(charsDirectory);
            return await Task.FromResult<IReadOnlyList<CharacterListEntry>>([
                EntryFromPersistenceState(
                    playtestState,
                    PlaytestMode.CharacterName,
                    0,
                    Math.Max(0, playtestState.HoursPlayed)),
            ]).ConfigureAwait(false);
        }

        // Multi-slot source of truth: PostgreSQL (Morlak slot0 + Dunga slot1 on same wallet, etc.).
        // Traveler used to only read wallet.traveler.json (one char) which made older chars "disappear".
        if (persistence is not null) {
            try {
                var fromDb = await persistence.ListCharactersAsync(accountWallet).ConfigureAwait(false);
                var valid = fromDb.Where(e => IsValidCharacterNameFormat(e.Name, out _)).ToList();
                if (valid.Count > 0) {
                    return valid;
                }
            } catch (Exception ex) {
                Console.Error.WriteLine($"[Persistence] PostgreSQL list failed for '{accountWallet}': {ex.Message}");
            }
        }

        var fromJson = LoadPlayerJson(charsDirectory, accountWallet, travelerMode);
        if (fromJson is null) {
            return Array.Empty<CharacterListEntry>();
        }

        var name = string.IsNullOrWhiteSpace(fromJson.CharacterName) ? accountWallet : fromJson.CharacterName.Trim();
        // Incomplete / auto stubs (e.g. HB_2a4bUA9C with underscore) must not appear as playable.
        if (!IsValidCharacterNameFormat(name, out _)) {
            if (travelerMode) {
                Console.WriteLine(
                    $"[Persistence] Hiding incomplete traveler save for wallet={accountWallet[..Math.Min(8, accountWallet.Length)]}… name='{name}' (Create Character required).");
            }
            return Array.Empty<CharacterListEntry>();
        }
        return [
            EntryFromPersistenceState(
                fromJson,
                name,
                Math.Clamp(fromJson.SlotIndex, 0, 3),
                Math.Max(0, fromJson.HoursPlayed)),
        ];
    }

    /// <summary>
    /// Same rules as Create Character desk: 2–10 chars, letter start, letters/digits only (no underscore).
    /// Used for name check, character list filtering, and login gate.
    /// </summary>
    public static bool IsValidCharacterNameFormat(string? characterName, out string message) {
        var name = (characterName ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(name)) {
            message = "Enter a name (at least 2 letters).";
            return false;
        }
        if (name.Length < 2) {
            message = "Name must be at least 2 characters.";
            return false;
        }
        if (name.Length > 10) {
            message = "Name must be 10 characters or fewer.";
            return false;
        }
        if (!char.IsLetter(name[0]) || !name.All(c => char.IsLetterOrDigit(c))) {
            message = "Name must start with a letter (letters/numbers only).";
            return false;
        }
        message = string.Empty;
        return true;
    }

    /// <summary>
    /// Create Character: name free for this wallet? Checks PostgreSQL, JSON Chars/, and online sessions.
    /// Same wallet re-using its own name is allowed (login/reconnect path).
    /// </summary>
    public static async Task<(bool Available, string Message)> CheckCharacterNameAvailabilityAsync(
        GamePersistenceService? persistence,
        string charsDirectory,
        string accountWallet,
        string characterName,
        Func<string, string, bool>? isOnlineNameOwnedByOtherWallet = null) {
        var wallet = (accountWallet ?? string.Empty).Trim();
        var name = (characterName ?? string.Empty).Trim();
        if (!IsValidCharacterNameFormat(name, out var formatMessage)) {
            return (false, formatMessage);
        }

        if (persistence is not null) {
            try {
                if (await persistence.IsCharacterNameTakenByOtherWalletAsync(wallet, name).ConfigureAwait(false)) {
                    return (false, "That name is already taken.");
                }
            } catch (Exception ex) {
                Console.Error.WriteLine($"[Persistence] Name check failed for '{name}': {ex.Message}");
            }
        }

        if (IsCharacterNameTakenInJsonByOtherWallet(charsDirectory, wallet, name)) {
            return (false, "That name is already taken.");
        }

        if (isOnlineNameOwnedByOtherWallet is not null && isOnlineNameOwnedByOtherWallet(wallet, name)) {
            return (false, "That name is already taken.");
        }

        return (true, "Name is available.");
    }

    /// <summary>Scans wallet JSON / traveler JSON saves for a display name owned by another wallet.</summary>
    static bool IsCharacterNameTakenInJsonByOtherWallet(string charsDirectory, string accountWallet, string characterName) {
        if (string.IsNullOrWhiteSpace(charsDirectory) || !Directory.Exists(charsDirectory)) {
            return false;
        }

        try {
            foreach (var path in Directory.EnumerateFiles(charsDirectory, "*.json")) {
                var fileName = Path.GetFileName(path);
                if (string.Equals(fileName, "auction-board.json", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(fileName, "hell-mining.json", StringComparison.OrdinalIgnoreCase)) {
                    continue;
                }

                // wallet.json or wallet.traveler.json
                var stem = fileName.EndsWith(".traveler.json", StringComparison.OrdinalIgnoreCase)
                    ? fileName[..^".traveler.json".Length]
                    : Path.GetFileNameWithoutExtension(fileName);
                if (string.Equals(stem, accountWallet, StringComparison.Ordinal)) {
                    continue;
                }

                try {
                    using var stream = File.OpenRead(path);
                    var state = JsonSerializer.Deserialize<PlayerPersistenceState>(stream);
                    var savedName = state?.CharacterName?.Trim();
                    if (!string.IsNullOrEmpty(savedName) &&
                        string.Equals(savedName, characterName, StringComparison.OrdinalIgnoreCase)) {
                        return true;
                    }
                } catch {
                    // ignore corrupt saves
                }
            }
        } catch (Exception ex) {
            Console.Error.WriteLine($"[Persistence] JSON name scan failed: {ex.Message}");
        }

        return false;
    }

    /// <summary>Builds a SELECTCHAR row from a full persistence snapshot (JSON fallback / traveler).</summary>
    static CharacterListEntry EntryFromPersistenceState(
        PlayerPersistenceState state,
        string name,
        int slotIndex,
        double hoursPlayed) {
        return new CharacterListEntry(
            slotIndex,
            name,
            Math.Max(1, state.Level),
            Math.Max(0, state.Exp),
            Math.Max(0, state.Rebirth),
            hoursPlayed,
            state.Str > 0 ? state.Str : 10,
            state.Vit > 0 ? state.Vit : 10,
            state.Dex > 0 ? state.Dex : 10,
            state.Int > 0 ? state.Int : 10,
            state.Mag > 0 ? state.Mag : 10,
            state.Chr > 0 ? state.Chr : 10,
            Math.Clamp(state.GenderValue, 0, 1),
            Math.Clamp(state.SkinColorValue, 0, 2),
            Math.Clamp(state.HairStyleIndex, 0, 7),
            Math.Clamp(state.UnderwearColorIndex, 0, 7),
            ExtractEquipPreview(state),
            NormalizeCitizenshipSide(state.CitizenshipSide));
    }

    /// <summary>aresden | elvine | traveler for SELECTCHAR city seals.</summary>
    internal static string NormalizeCitizenshipSide(string? side) {
        var s = (side ?? string.Empty).Trim().ToLowerInvariant();
        return s is "aresden" or "elvine" ? s : "traveler";
    }

    /// <summary>Visible equip rows for Olympia-style SELECTCHAR walk preview.</summary>
    internal static IReadOnlyList<CharacterListEquipPreview>? ExtractEquipPreview(PlayerPersistenceState state) {
        if (state.EquippedItems is not { Length: > 0 }) {
            return null;
        }

        var equipped = new List<CharacterListEquipPreview>(state.EquippedItems.Length);
        foreach (var row in state.EquippedItems) {
            if (string.IsNullOrWhiteSpace(row.Slot) || row.Item.ItemId <= 0) {
                continue;
            }
            equipped.Add(new CharacterListEquipPreview(row.Slot, row.Item.ItemId));
        }

        return equipped.Count > 0 ? equipped : null;
    }

    static PlayerPersistenceState? LoadPlayerJson(string charsDirectory, string networkId, bool travelerMode = false) {
        var savePath = GetPlayerSavePath(charsDirectory, networkId, travelerMode);
        if (savePath is null || !File.Exists(savePath)) {
            return null;
        }

        try {
            using var stream = File.OpenRead(savePath);
            // Case-insensitive so RebirthRollback / nested snapshot always binds.
            return JsonSerializer.Deserialize<PlayerPersistenceState>(stream, JsonOptions);
        } catch (Exception ex) {
            Console.Error.WriteLine($"[Persistence] Failed to load JSON save '{savePath}': {ex.Message}");
            return null;
        }
    }

    static void SavePlayerJson(string charsDirectory, string networkId, PlayerPersistenceState state, bool travelerMode = false) {
        var savePath = GetPlayerSavePath(charsDirectory, networkId, travelerMode);
        if (savePath is null) {
            return;
        }

        try {
            Directory.CreateDirectory(charsDirectory);
            var tempPath = $"{savePath}.{Guid.NewGuid():N}.tmp";
            var pretty = new JsonSerializerOptions(JsonOptions) { WriteIndented = true };
            var json = JsonSerializer.Serialize(state, pretty);
            File.WriteAllText(tempPath, json);
            File.Move(tempPath, savePath, overwrite: true);
        } catch (Exception ex) {
            Console.Error.WriteLine($"[Persistence] Failed to save JSON '{savePath}': {ex.Message}");
        }
    }

    static string? GetPlayerSavePath(string charsDirectory, string networkId, bool travelerMode = false) {
        if (string.IsNullOrWhiteSpace(networkId) ||
            networkId.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 ||
            networkId.Contains(Path.DirectorySeparatorChar) ||
            networkId.Contains(Path.AltDirectorySeparatorChar)) {
            return null;
        }

        var fileName = travelerMode ? $"{networkId}.traveler.json" : $"{networkId}.json";
        return Path.Combine(charsDirectory, fileName);
    }
}
