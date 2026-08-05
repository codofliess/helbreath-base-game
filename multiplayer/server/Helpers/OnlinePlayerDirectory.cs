using System;
using System.Collections.Generic;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Cross-world lookup of connected players for auction settle / bid refunds.
/// Register on world join; unregister on leave / disconnect.
/// </summary>
public static class OnlinePlayerDirectory {
    static readonly object Gate = new();
    static readonly Dictionary<string, GameWorldPlayer> PlayersByKey =
        new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Builds a stable wallet+character key for directory lookups.</summary>
    public static string MakeKey(string accountWallet, string characterName) {
        return $"{(accountWallet ?? string.Empty).Trim()}|{(characterName ?? string.Empty).Trim()}";
    }

    /// <summary>Registers or refreshes the live player reference.</summary>
    public static void Register(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        if (string.IsNullOrWhiteSpace(player.AccountWallet) || string.IsNullOrWhiteSpace(player.CharacterName)) {
            return;
        }

        lock (Gate) {
            PlayersByKey[MakeKey(player.AccountWallet, player.CharacterName)] = player;
        }
    }

    /// <summary>Removes the player when they leave a world or disconnect.</summary>
    public static void Unregister(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        if (string.IsNullOrWhiteSpace(player.AccountWallet) || string.IsNullOrWhiteSpace(player.CharacterName)) {
            return;
        }

        var key = MakeKey(player.AccountWallet, player.CharacterName);
        lock (Gate) {
            if (PlayersByKey.TryGetValue(key, out var current) && ReferenceEquals(current, player)) {
                PlayersByKey.Remove(key);
            }
        }
    }

    /// <summary>Resolves an online player by wallet + character name.</summary>
    public static bool TryGet(string accountWallet, string characterName, out GameWorldPlayer? player) {
        lock (Gate) {
            return PlayersByKey.TryGetValue(MakeKey(accountWallet, characterName), out player);
        }
    }

    /// <summary>Resolves the first online player matching character name (case-insensitive).</summary>
    public static bool TryGetByCharacterName(string characterName, out GameWorldPlayer? player) {
        player = null;
        var name = (characterName ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(name)) {
            return false;
        }

        lock (Gate) {
            foreach (var kv in PlayersByKey) {
                var p = kv.Value;
                if (p is null || p.Disconnected) {
                    continue;
                }
                if (string.Equals(p.CharacterName?.Trim(), name, StringComparison.OrdinalIgnoreCase)) {
                    player = p;
                    return true;
                }
            }
        }
        return false;
    }

    /// <summary>
    /// True when an online session uses this display name under a different wallet
    /// (case-insensitive). Same wallet is not treated as taken.
    /// </summary>
    public static bool IsDisplayNameTakenByOtherWallet(string accountWallet, string characterName) {
        var wallet = (accountWallet ?? string.Empty).Trim();
        var name = (characterName ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(name)) {
            return false;
        }

        lock (Gate) {
            foreach (var kv in PlayersByKey) {
                var player = kv.Value;
                if (player is null || string.IsNullOrWhiteSpace(player.CharacterName)) {
                    continue;
                }
                if (!string.Equals(player.CharacterName.Trim(), name, StringComparison.OrdinalIgnoreCase)) {
                    continue;
                }
                if (!string.Equals((player.AccountWallet ?? string.Empty).Trim(), wallet, StringComparison.Ordinal)) {
                    return true;
                }
            }
        }

        return false;
    }
}
