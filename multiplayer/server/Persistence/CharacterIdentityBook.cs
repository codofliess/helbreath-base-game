using Server.World.Game;

namespace Server.Persistence;

/// <summary>
/// Creates, adopts, saves, and renames character rows so the lowercase unique index is enforced
/// before two wallets can both keep the name.
/// </summary>
public sealed class CharacterIdentityBook {
    readonly ICharacterRepository repository;

    public CharacterIdentityBook(ICharacterRepository repository) {
        ArgumentNullException.ThrowIfNull(repository);
        this.repository = repository;
    }

    /// <summary>Placeholder snapshot stored on the row that claims the name. The first real save replaces it.</summary>
    public static PlayerPersistenceState CreateReservationSeed(
        string worldId,
        string characterName,
        int slotIndex,
        int gender,
        int skin,
        int hair,
        int underwear,
        int str,
        int vit,
        int dex,
        int intel,
        int mag,
        int chr) {
        return new PlayerPersistenceState(
            string.IsNullOrWhiteSpace(worldId) ? "traveler" : worldId.Trim(),
            0,
            0,
            260,
            1200,
            800,
            1,
            8,
            500,
            (int)Server.AttackType.Stun,
            true,
            true,
            false,
            GenderValue: Math.Clamp(gender, 0, 1),
            SkinColorValue: Math.Clamp(skin, 0, 2),
            HairStyleIndex: Math.Clamp(hair, 0, 7),
            UnderwearColorIndex: Math.Clamp(underwear, 0, 7),
            CharacterName: (characterName ?? string.Empty).Trim(),
            SlotIndex: Math.Clamp(slotIndex, 0, 3),
            Str: str > 0 ? str : 10,
            Vit: vit > 0 ? vit : 10,
            Dex: dex > 0 ? dex : 10,
            Int: intel > 0 ? intel : 10,
            Mag: mag > 0 ? mag : 10,
            Chr: chr > 0 ? chr : 10,
            NameReservationOnly: true);
    }

    /// <summary>Inserts the name or reports that another wallet already owns it. Database errors are unavailable.</summary>
    public async Task<CharacterReserveResult> ReserveAsync(
        string wallet,
        string name,
        PlayerPersistenceState seed,
        int slotIndex,
        CancellationToken cancellationToken = default) {
        wallet = (wallet ?? string.Empty).Trim();
        name = (name ?? string.Empty).Trim();
        try {
            var existing = await repository.FindByLowerNameAsync(name, cancellationToken).ConfigureAwait(false);
            var decision = CharacterNameClash.DecideReserve(existing, wallet);
            if (decision.Kind == ReserveDecisionKind.Taken) {
                return CharacterReserveResult.Taken();
            }
            if (decision.Kind == ReserveDecisionKind.AlreadyOwned) {
                return CharacterReserveResult.AlreadyOwned(decision.ExistingId!.Value, decision.ExistingIsReservationOnly);
            }

            try {
                var claimed = seed with {
                    CharacterName = name,
                    NameReservationOnly = true,
                };
                var id = await repository.InsertAsync(wallet, name, claimed, Math.Clamp(slotIndex, 0, 3), cancellationToken)
                    .ConfigureAwait(false);
                return CharacterReserveResult.Reserved(id);
            } catch (CharacterUniqueConflictException) {
                var raced = await repository.FindByLowerNameAsync(name, cancellationToken).ConfigureAwait(false);
                var afterRace = CharacterNameClash.DecideReserve(raced, wallet);
                if (afterRace.Kind == ReserveDecisionKind.AlreadyOwned && afterRace.ExistingId is Guid owned) {
                    return CharacterReserveResult.AlreadyOwned(owned, afterRace.ExistingIsReservationOnly);
                }
                return CharacterReserveResult.Taken();
            }
        } catch (Exception ex) when (ex is not OperationCanceledException) {
            Console.Error.WriteLine($"[Persistence] Name reserve failed for '{name}': {ex.Message}");
            return CharacterReserveResult.Unavailable();
        }
    }

    /// <summary>
    /// JSON (or an unverified id) must match the database before play.
    /// A clash blocks login. A database error blocks login. A free name inserts the row.
    /// </summary>
    public async Task<CharacterLoginResult> ReconcileAsync(
        string wallet,
        string name,
        PlayerPersistenceState loaded,
        CancellationToken cancellationToken = default) {
        ArgumentNullException.ThrowIfNull(loaded);
        wallet = (wallet ?? string.Empty).Trim();
        name = (name ?? string.Empty).Trim();
        try {
            if (loaded.CharacterDbId is Guid claimedId && claimedId != Guid.Empty) {
                var byId = await repository.FindByIdAsync(claimedId, cancellationToken).ConfigureAwait(false);
                if (byId is not null &&
                    CharacterNameClash.SameWallet(byId.Wallet, wallet) &&
                    CharacterNameClash.SameName(byId.Name, name)) {
                    return CharacterLoginResult.Ok(byId.Id);
                }
            }

            var byName = await repository.FindByLowerNameAsync(name, cancellationToken).ConfigureAwait(false);
            if (byName is not null && !CharacterNameClash.SameWallet(byName.Wallet, wallet)) {
                return CharacterLoginResult.BlockTaken();
            }
            if (byName is not null) {
                return CharacterLoginResult.Ok(byName.Id);
            }

            try {
                var adopted = loaded with {
                    CharacterName = name,
                    NameReservationOnly = false,
                    CharacterDbId = null,
                };
                var id = await repository.InsertAsync(
                        wallet,
                        name,
                        adopted,
                        Math.Clamp(loaded.SlotIndex, 0, 3),
                        cancellationToken)
                    .ConfigureAwait(false);
                return CharacterLoginResult.Ok(id);
            } catch (CharacterUniqueConflictException) {
                return CharacterLoginResult.BlockTaken();
            }
        } catch (Exception ex) when (ex is not OperationCanceledException) {
            Console.Error.WriteLine($"[Persistence] JSON login name check failed for '{name}': {ex.Message}");
            return CharacterLoginResult.BlockUnavailable();
        }
    }

    /// <summary>Updates by id when this wallet owns the row. A lowercase name owned by someone else is a clash.</summary>
    public async Task<CharacterSaveResult> SaveAsync(
        string wallet,
        string name,
        PlayerPersistenceState state,
        int slotIndex,
        CancellationToken cancellationToken = default) {
        ArgumentNullException.ThrowIfNull(state);
        wallet = (wallet ?? string.Empty).Trim();
        name = (name ?? string.Empty).Trim();
        slotIndex = Math.Clamp(slotIndex, 0, 3);
        try {
            if (state.CharacterDbId is Guid id && id != Guid.Empty) {
                var byId = await repository.FindByIdAsync(id, cancellationToken).ConfigureAwait(false);
                if (byId is not null && CharacterNameClash.SameWallet(byId.Wallet, wallet)) {
                    var stamped = state.CharacterDbId == id ? state : state with { CharacterDbId = id };
                    var updated = await repository.UpdateByIdAsync(id, wallet, stamped, slotIndex, cancellationToken)
                        .ConfigureAwait(false);
                    if (updated) {
                        return CharacterSaveResult.Saved(id);
                    }
                }
            }

            var byName = await repository.FindByLowerNameAsync(name, cancellationToken).ConfigureAwait(false);
            var decision = CharacterNameClash.DecideSave(byName, wallet);
            switch (decision.Kind) {
                case SaveDecisionKind.Clash:
                    return CharacterSaveResult.NameClash();
                case SaveDecisionKind.Update when decision.Id is Guid ownedId: {
                    var stamped = state with { CharacterDbId = ownedId };
                    var updated = await repository.UpdateByIdAsync(ownedId, wallet, stamped, slotIndex, cancellationToken)
                        .ConfigureAwait(false);
                    return updated
                        ? CharacterSaveResult.Saved(ownedId)
                        : CharacterSaveResult.Failed("Character row disappeared during save.");
                }
                case SaveDecisionKind.Insert:
                    try {
                        var inserted = state with { NameReservationOnly = false };
                        var newId = await repository.InsertAsync(wallet, name, inserted, slotIndex, cancellationToken)
                            .ConfigureAwait(false);
                        return CharacterSaveResult.Saved(newId);
                    } catch (CharacterUniqueConflictException) {
                        var again = await repository.FindByLowerNameAsync(name, cancellationToken).ConfigureAwait(false);
                        var second = CharacterNameClash.DecideSave(again, wallet);
                        if (second.Kind == SaveDecisionKind.Update && second.Id is Guid racedId) {
                            var stamped = state with { CharacterDbId = racedId };
                            var updated = await repository.UpdateByIdAsync(racedId, wallet, stamped, slotIndex, cancellationToken)
                                .ConfigureAwait(false);
                            return updated
                                ? CharacterSaveResult.Saved(racedId)
                                : CharacterSaveResult.NameClash();
                        }
                        return CharacterSaveResult.NameClash();
                    }
                default:
                    return CharacterSaveResult.Failed("Unhandled character save decision.");
            }
        } catch (Exception ex) when (ex is not OperationCanceledException) {
            return CharacterSaveResult.Failed(ex.Message);
        }
    }

    /// <summary>
    /// Renames one character in the database (name column and <c>state_json.CharacterName</c>),
    /// then the JSON mirror, then the live session. A taken name changes nothing.
    /// </summary>
    public async Task<CharacterRenameOutcome> RenameAsync(
        string charsDirectory,
        string wallet,
        string currentName,
        string newName,
        bool liveSessionPresent,
        PlayerPersistenceState? liveSnapshot,
        Func<Guid, Task<bool>>? applyLive,
        CancellationToken cancellationToken = default) {
        wallet = (wallet ?? string.Empty).Trim();
        currentName = (currentName ?? string.Empty).Trim();
        newName = (newName ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(wallet)) {
            return CharacterRenameOutcome.Invalid("Wallet is required.");
        }
        if (!GamePersistence.IsValidCharacterNameFormat(newName, out var formatMessage)) {
            return CharacterRenameOutcome.Invalid(string.IsNullOrWhiteSpace(formatMessage)
                ? "Name is not valid."
                : formatMessage);
        }
        if (string.Equals(currentName, newName, StringComparison.Ordinal)) {
            return CharacterRenameOutcome.Invalid("Choose a different name.");
        }

        CharacterRow? owned;
        try {
            owned = await repository.FindByWalletAndLowerNameAsync(wallet, currentName, cancellationToken)
                .ConfigureAwait(false);
        } catch (Exception ex) when (ex is not OperationCanceledException) {
            Console.Error.WriteLine($"[Persistence] Rename lookup failed for '{currentName}': {ex.Message}");
            return CharacterRenameOutcome.Unavailable();
        }

        var jsonState = GamePersistence.TryReadCharacterJsonForRename(charsDirectory, wallet, currentName);
        if (owned is null && jsonState is null && liveSnapshot is null && !liveSessionPresent) {
            return CharacterRenameOutcome.NotFound();
        }

        try {
            var occupied = await repository.FindByLowerNameAsync(newName, cancellationToken).ConfigureAwait(false);
            if (CharacterNameClash.IsNameOwnedByOther(occupied, owned?.Id)) {
                return CharacterRenameOutcome.Taken();
            }
        } catch (Exception ex) when (ex is not OperationCanceledException) {
            Console.Error.WriteLine($"[Persistence] Rename name check failed for '{newName}': {ex.Message}");
            return CharacterRenameOutcome.Unavailable();
        }

        Guid id;
        try {
            if (owned is not null) {
                var write = await repository.RenameAsync(owned.Id, wallet, currentName, newName, cancellationToken)
                    .ConfigureAwait(false);
                if (write == CharacterRenameWriteResult.Taken) {
                    return CharacterRenameOutcome.Taken();
                }
                if (write == CharacterRenameWriteResult.Missing) {
                    return CharacterRenameOutcome.NotFound();
                }
                id = owned.Id;
            } else {
                var seed = liveSnapshot ?? jsonState ?? CreateReservationSeed(
                    "traveler", newName, 0, 0, 0, 0, 0, 10, 10, 10, 10, 10, 10);
                seed = seed with {
                    CharacterName = newName,
                    NameReservationOnly = false,
                    CharacterDbId = null,
                };
                try {
                    id = await repository.InsertAsync(
                            wallet,
                            newName,
                            seed,
                            Math.Clamp(seed.SlotIndex, 0, 3),
                            cancellationToken)
                        .ConfigureAwait(false);
                } catch (CharacterUniqueConflictException) {
                    return CharacterRenameOutcome.Taken();
                }
            }
        } catch (Exception ex) when (ex is not OperationCanceledException) {
            Console.Error.WriteLine($"[Persistence] Rename write failed for '{currentName}': {ex.Message}");
            return CharacterRenameOutcome.Unavailable();
        }

        var jsonUpdated = GamePersistence.TryRewriteCharacterNameInJson(
            charsDirectory, wallet, currentName, newName, id);
        var liveUpdated = false;
        if (applyLive is not null) {
            try {
                liveUpdated = await applyLive(id).ConfigureAwait(false);
            } catch (Exception ex) when (ex is not OperationCanceledException) {
                Console.Error.WriteLine($"[Persistence] Live rename failed for '{currentName}': {ex.Message}");
            }
        }

        CharacterNameClashLog.Clear(wallet, currentName);
        CharacterNameClashLog.Clear(wallet, newName);
        return CharacterRenameOutcome.Renamed(id, jsonUpdated, liveUpdated);
    }
}
