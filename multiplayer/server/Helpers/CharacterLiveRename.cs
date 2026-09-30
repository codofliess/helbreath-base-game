using Server.Persistence;
using Server.World;
using Server.World.Game;
using Server.World.Global;

namespace Server.Helpers;

/// <summary>Applies an admin rename to the in-memory session and the world actors that display the name.</summary>
public static class CharacterLiveRename {
    /// <summary>Updates the network session under its lock. Returns false when the wallet or current name does not match.</summary>
    public static bool TryUpdateSession(
        PlayerSession session,
        string wallet,
        string currentName,
        string newName,
        Guid characterId) {
        ArgumentNullException.ThrowIfNull(session);
        lock (session.SyncRoot) {
            if (!CharacterNameClash.SameWallet(session.NetworkId, wallet) ||
                !CharacterNameClash.SameName(session.CharacterName, currentName)) {
                return false;
            }
            session.CharacterName = (newName ?? string.Empty).Trim();
            session.CharacterDbId = characterId;
            session.NameClashRetryAtUtc = null;
            return true;
        }
    }

    /// <summary>Moves the online-player directory key and the avatar's display name. Call on the world thread.</summary>
    public static void ApplyWorldPlayerRename(GameWorldPlayer player, string newName) {
        ArgumentNullException.ThrowIfNull(player);
        OnlinePlayerDirectory.Unregister(player);
        player.SetCharacterName(newName);
        OnlinePlayerDirectory.Register(player);
    }

    /// <summary>Posts rename messages to the game world and the global world and waits briefly for each.</summary>
    public static async Task<bool> TryRenameWorldActorsAsync(
        WorldRegistry registry,
        PlayerSession session,
        string newName,
        CancellationToken cancellationToken = default) {
        ArgumentNullException.ThrowIfNull(registry);
        ArgumentNullException.ThrowIfNull(session);
        string worldId;
        Guid sessionId;
        lock (session.SyncRoot) {
            worldId = session.CurrentGameWorldId;
            sessionId = session.SessionId;
        }

        var gameOk = false;
        if (!string.IsNullOrWhiteSpace(worldId)) {
            var gameDone = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            try {
                await registry.RouteGameWorldMessageAsync(
                    worldId,
                    new RenamePlayerCharacterMessage(sessionId, newName, gameDone),
                    cancellationToken).ConfigureAwait(false);
                gameOk = await WaitForRenameAsync(gameDone.Task, cancellationToken).ConfigureAwait(false);
            } catch (Exception ex) when (ex is not OperationCanceledException) {
                Console.Error.WriteLine($"[Persistence] Game-world rename failed for session {sessionId}: {ex.Message}");
            }
        }

        var globalDone = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        try {
            await registry.RouteGlobalMessageAsync(
                new RenameGlobalPlayerCharacterMessage(sessionId, newName, globalDone),
                cancellationToken).ConfigureAwait(false);
            var globalOk = await WaitForRenameAsync(globalDone.Task, cancellationToken).ConfigureAwait(false);
            return gameOk || globalOk;
        } catch (Exception ex) when (ex is not OperationCanceledException) {
            Console.Error.WriteLine($"[Persistence] Global rename failed for session {sessionId}: {ex.Message}");
            return gameOk;
        }
    }

    static async Task<bool> WaitForRenameAsync(Task<bool> task, CancellationToken cancellationToken) {
        var timeout = Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
        var finished = await Task.WhenAny(task, timeout).ConfigureAwait(false);
        if (!ReferenceEquals(finished, task)) {
            return false;
        }
        return await task.ConfigureAwait(false);
    }
}

/// <summary>Gate for the character-rename HTTP command. Closed unless an admin key is configured.</summary>
public static class CharacterAdminAuth {
    public static bool IsConfigured => ExpectedKey().Length > 0;

    public static bool IsAuthorized(string? providedHeader) {
        var expected = ExpectedKey();
        if (expected.Length == 0) {
            return false;
        }
        return AdminSecurity.FixedTimeEqualsUtf8((providedHeader ?? string.Empty).Trim(), expected);
    }

    static string ExpectedKey() =>
        (Environment.GetEnvironmentVariable("ADMIN_API_KEY")
         ?? Environment.GetEnvironmentVariable("ADMIN_SECRET")
         ?? string.Empty).Trim();
}
