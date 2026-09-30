using Server.World.Game;

namespace Server.Persistence;

/// <summary>Raised when <c>idx_characters_name_ci</c> or the per-wallet name unique constraint rejects a write.</summary>
public sealed class CharacterUniqueConflictException : Exception {
    public CharacterUniqueConflictException(Exception? inner = null)
        : base("23505 duplicate key on character name", inner) {
    }
}

/// <summary>One <c>characters</c> row reduced to the fields name checks need.</summary>
public sealed record CharacterRow(Guid Id, string Wallet, string Name, bool NameReservationOnly);

/// <summary>Result of <see cref="ICharacterRepository.RenameAsync"/>.</summary>
public enum CharacterRenameWriteResult {
    Updated,
    Missing,
    Taken,
}

/// <summary>PostgreSQL (or a test double) for character identity rows.</summary>
public interface ICharacterRepository {
    Task<CharacterRow?> FindByLowerNameAsync(string name, CancellationToken cancellationToken = default);

    Task<CharacterRow?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<CharacterRow?> FindByWalletAndLowerNameAsync(string wallet, string name, CancellationToken cancellationToken = default);

    /// <summary>Inserts a row. Throws <see cref="CharacterUniqueConflictException"/> on 23505.</summary>
    Task<Guid> InsertAsync(
        string wallet,
        string name,
        PlayerPersistenceState state,
        int slotIndex,
        CancellationToken cancellationToken = default);

    Task<bool> UpdateByIdAsync(
        Guid id,
        string wallet,
        PlayerPersistenceState state,
        int slotIndex,
        CancellationToken cancellationToken = default);

    /// <summary>Updates <c>name</c> and <c>state_json.CharacterName</c> for one row.</summary>
    Task<CharacterRenameWriteResult> RenameAsync(
        Guid id,
        string wallet,
        string currentName,
        string newName,
        CancellationToken cancellationToken = default);
}

/// <summary>Save path used by the JSON mirror. Tests substitute a fake that returns a clash.</summary>
public interface ICharacterSaver {
    Task UpsertAccountLoginAsync(string walletPubkey, CancellationToken cancellationToken = default);

    Task<CharacterSaveResult> SaveCharacterAsync(
        string accountWallet,
        string characterName,
        PlayerPersistenceState state,
        CancellationToken cancellationToken = default);
}

/// <summary>Create-character name probe. A throw is treated as unavailable, not free.</summary>
public interface ICharacterNameProbe {
    Task<bool> IsCharacterNameTakenByOtherWalletAsync(
        string accountWallet,
        string characterName,
        CancellationToken cancellationToken = default);
}
