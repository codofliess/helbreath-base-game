using System.Text.Json;
using Npgsql;
using Server.World.Game;

namespace Server.Persistence;

/// <summary>PostgreSQL implementation of <see cref="ICharacterRepository"/>.</summary>
public sealed class NpgsqlCharacterRepository : ICharacterRepository {
    static readonly JsonSerializerOptions JsonOptions = new() {
        WriteIndented = false,
        PropertyNameCaseInsensitive = true,
    };

    readonly NpgsqlDataSource dataSource;

    public NpgsqlCharacterRepository(NpgsqlDataSource dataSource) {
        ArgumentNullException.ThrowIfNull(dataSource);
        this.dataSource = dataSource;
    }

    public Task<CharacterRow?> FindByLowerNameAsync(string name, CancellationToken cancellationToken = default) =>
        FindOneAsync(CharacterSql.FindByLowerName, command => {
            command.Parameters.AddWithValue("name", (name ?? string.Empty).Trim());
        }, cancellationToken);

    public async Task<CharacterRow?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default) {
        const string sql = """
            SELECT id, account_wallet, name,
                   COALESCE(state_json->>'NameReservationOnly', '') = 'true' AS reservation_only
            FROM characters
            WHERE id = @id
            LIMIT 1
            """;
        return await FindOneAsync(sql, command => {
            command.Parameters.AddWithValue("id", id);
        }, cancellationToken).ConfigureAwait(false);
    }

    public async Task<CharacterRow?> FindByWalletAndLowerNameAsync(
        string wallet,
        string name,
        CancellationToken cancellationToken = default) {
        const string sql = """
            SELECT id, account_wallet, name,
                   COALESCE(state_json->>'NameReservationOnly', '') = 'true' AS reservation_only
            FROM characters
            WHERE account_wallet = @wallet AND LOWER(name) = LOWER(@name)
            LIMIT 1
            """;
        return await FindOneAsync(sql, command => {
            command.Parameters.AddWithValue("wallet", (wallet ?? string.Empty).Trim());
            command.Parameters.AddWithValue("name", (name ?? string.Empty).Trim());
        }, cancellationToken).ConfigureAwait(false);
    }

    public async Task<Guid> InsertAsync(
        string wallet,
        string name,
        PlayerPersistenceState state,
        int slotIndex,
        CancellationToken cancellationToken = default) {
        ArgumentNullException.ThrowIfNull(state);
        wallet = wallet.Trim();
        name = name.Trim();
        var json = JsonSerializer.Serialize(state, JsonOptions);

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        try {
            await LockNameAsync(connection, transaction, name, cancellationToken).ConfigureAwait(false);
            const string accountSql = """
                INSERT INTO accounts (wallet_pubkey, last_login_at)
                VALUES (@wallet, NOW())
                ON CONFLICT (wallet_pubkey) DO UPDATE SET last_login_at = NOW()
                """;
            await using (var account = new NpgsqlCommand(accountSql, connection, transaction)) {
                account.Parameters.AddWithValue("wallet", wallet);
                await account.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
            }

            await using var insert = new NpgsqlCommand(CharacterSql.Insert, connection, transaction);
            BindSnapshot(insert, wallet, name, state, json, slotIndex);
            var id = (Guid)(await insert.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false))!;
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return id;
        } catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation) {
            await SafeRollbackAsync(transaction, cancellationToken).ConfigureAwait(false);
            throw new CharacterUniqueConflictException(ex);
        }
    }

    public async Task<bool> UpdateByIdAsync(
        Guid id,
        string wallet,
        PlayerPersistenceState state,
        int slotIndex,
        CancellationToken cancellationToken = default) {
        ArgumentNullException.ThrowIfNull(state);
        var json = JsonSerializer.Serialize(state, JsonOptions);
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(CharacterSql.UpdateById, connection);
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("wallet", wallet.Trim());
        command.Parameters.AddWithValue("worldId", state.GameWorldId);
        command.Parameters.AddWithValue("x", state.X);
        command.Parameters.AddWithValue("y", state.Y);
        command.Parameters.AddWithValue("stateJson", json);
        command.Parameters.AddWithValue("slotIndex", Math.Clamp(slotIndex, 0, 3));
        command.Parameters.AddWithValue("hoursPlayed", Math.Max(0, state.HoursPlayed));
        var updated = await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
        return updated > 0;
    }

    public async Task<CharacterRenameWriteResult> RenameAsync(
        Guid id,
        string wallet,
        string currentName,
        string newName,
        CancellationToken cancellationToken = default) {
        wallet = wallet.Trim();
        currentName = currentName.Trim();
        newName = newName.Trim();

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        try {
            await LockNamePairAsync(connection, transaction, currentName, newName, cancellationToken).ConfigureAwait(false);
            const string conflictSql = """
                SELECT 1
                FROM characters
                WHERE LOWER(name) = LOWER(@newName) AND id <> @id
                LIMIT 1
                """;
            await using (var conflict = new NpgsqlCommand(conflictSql, connection, transaction)) {
                conflict.Parameters.AddWithValue("newName", newName);
                conflict.Parameters.AddWithValue("id", id);
                var taken = await conflict.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);
                if (taken is not null) {
                    await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
                    return CharacterRenameWriteResult.Taken;
                }
            }

            await using var rename = new NpgsqlCommand(CharacterSql.Rename, connection, transaction);
            rename.Parameters.AddWithValue("id", id);
            rename.Parameters.AddWithValue("wallet", wallet);
            rename.Parameters.AddWithValue("currentName", currentName);
            rename.Parameters.AddWithValue("newName", newName);
            var updated = await rename.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return updated > 0 ? CharacterRenameWriteResult.Updated : CharacterRenameWriteResult.Missing;
        } catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation) {
            await SafeRollbackAsync(transaction, cancellationToken).ConfigureAwait(false);
            return CharacterRenameWriteResult.Taken;
        }
    }

    async Task<CharacterRow?> FindOneAsync(
        string sql,
        Action<NpgsqlCommand> bind,
        CancellationToken cancellationToken) {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        bind(command);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        if (!await reader.ReadAsync(cancellationToken).ConfigureAwait(false)) {
            return null;
        }
        return new CharacterRow(
            reader.GetGuid(0),
            reader.GetString(1),
            reader.GetString(2),
            !reader.IsDBNull(3) && reader.GetBoolean(3));
    }

    static void BindSnapshot(
        NpgsqlCommand command,
        string wallet,
        string name,
        PlayerPersistenceState state,
        string json,
        int slotIndex) {
        command.Parameters.AddWithValue("wallet", wallet);
        command.Parameters.AddWithValue("name", name);
        command.Parameters.AddWithValue("worldId", state.GameWorldId);
        command.Parameters.AddWithValue("x", state.X);
        command.Parameters.AddWithValue("y", state.Y);
        command.Parameters.AddWithValue("stateJson", json);
        command.Parameters.AddWithValue("slotIndex", Math.Clamp(slotIndex, 0, 3));
        command.Parameters.AddWithValue("hoursPlayed", Math.Max(0, state.HoursPlayed));
    }

    static async Task LockNameAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string name,
        CancellationToken cancellationToken) {
        await using var command = new NpgsqlCommand(CharacterSql.LockName, connection, transaction);
        command.Parameters.AddWithValue("name", name);
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    static async Task LockNamePairAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string currentName,
        string newName,
        CancellationToken cancellationToken) {
        var first = currentName;
        var second = newName;
        if (string.Compare(first, second, StringComparison.OrdinalIgnoreCase) > 0) {
            (first, second) = (second, first);
        }
        await LockNameAsync(connection, transaction, first, cancellationToken).ConfigureAwait(false);
        if (!CharacterNameClash.SameName(first, second)) {
            await LockNameAsync(connection, transaction, second, cancellationToken).ConfigureAwait(false);
        }
    }

    static async Task SafeRollbackAsync(NpgsqlTransaction transaction, CancellationToken cancellationToken) {
        try {
            await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
        } catch (Exception ex) when (ex is not OperationCanceledException) {
            // The original unique-violation is the error that matters.
        }
    }
}
