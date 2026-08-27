namespace Server;

/// <summary>
/// Isolated playtest host: env-gated name login for a single test character.
/// Default (production) process leaves this disabled; auth stays client-supplied <c>networkId</c>.
/// Never enable on play.chainlords.net.
/// </summary>
public sealed class PlaytestRuntime {
    public const string ForbiddenProductionPlayHost = "play.chainlords.net";

    public const string DefaultCharacterName = "Elon";

    public const string DefaultNetworkId = "playtest-elon";

    public bool Enabled { get; }

    public string CharacterName { get; }

    public string NetworkId { get; }

    public bool ResetCharacter { get; }

    public int? ListenPort { get; }

    private PlaytestRuntime(bool enabled, string characterName, string networkId, bool resetCharacter, int? listenPort) {
        Enabled = enabled;
        CharacterName = characterName;
        NetworkId = networkId;
        ResetCharacter = resetCharacter;
        ListenPort = listenPort;
    }

    /// <summary>Reads <c>PLAYTEST</c> and related env vars. Missing or empty <c>PLAYTEST</c> means disabled.</summary>
    public static PlaytestRuntime FromEnvironment() {
        var enabled = EnvFlag("PLAYTEST");
        var characterName = EnvString("PLAYTEST_CHARACTER_NAME", DefaultCharacterName);
        var networkId = EnvString("PLAYTEST_NETWORK_ID", DefaultNetworkId);
        var resetCharacter = !EnvPresent("PLAYTEST_RESET_CHARACTER") || EnvFlag("PLAYTEST_RESET_CHARACTER");
        int? listenPort = null;
        var portText = Environment.GetEnvironmentVariable("PLAYTEST_LISTEN_PORT");
        if (!string.IsNullOrWhiteSpace(portText) && int.TryParse(portText.Trim(), out var parsedPort) && parsedPort is >= 1 and <= 65535) {
            listenPort = parsedPort;
        }

        return new PlaytestRuntime(enabled, characterName, networkId, enabled && resetCharacter, listenPort);
    }

    /// <summary>Aborts process start when playtest is aimed at the live play host.</summary>
    public void AbortIfBoundToForbiddenProductionHost() {
        if (!Enabled) {
            return;
        }

        foreach (var host in EnumerateConfiguredHostnames()) {
            if (IsForbiddenProductionPlayHost(host)) {
                throw new InvalidOperationException(
                    $"PLAYTEST must never run on {ForbiddenProductionPlayHost} (matched host '{host}'). Use a separate host or local ports.");
            }
        }
    }

    /// <summary>Deletes the playtest character save so the tester joins with a clean new avatar.</summary>
    public void ResetCharacterSaveIfRequested(string charsDirectory) {
        if (!Enabled || !ResetCharacter) {
            return;
        }

        if (string.IsNullOrWhiteSpace(NetworkId) ||
            NetworkId.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 ||
            NetworkId.Contains(Path.DirectorySeparatorChar) ||
            NetworkId.Contains(Path.AltDirectorySeparatorChar)) {
            Console.Error.WriteLine($"[Server] PLAYTEST refusing to reset save for invalid network id '{NetworkId}'.");
            return;
        }

        var savePath = Path.Combine(charsDirectory, $"{NetworkId}.json");
        try {
            if (File.Exists(savePath)) {
                File.Delete(savePath);
                Console.WriteLine($"[Server] PLAYTEST reset character save '{savePath}'.");
            } else {
                Console.WriteLine($"[Server] PLAYTEST clean character '{CharacterName}' (no prior save).");
            }
        } catch (Exception ex) {
            Console.Error.WriteLine($"[Server] PLAYTEST failed to reset character save '{savePath}': {ex.Message}");
        }
    }

    /// <summary>When enabled, only the configured test character and network id may authenticate.</summary>
    public bool TryValidateAuthentication(string networkId, string characterName, out string? errorMessage) {
        errorMessage = null;
        if (!Enabled) {
            return true;
        }

        if (!string.Equals(networkId.Trim(), NetworkId, StringComparison.Ordinal)) {
            errorMessage = "This playtest host only accepts the configured test character.";
            return false;
        }

        if (!string.Equals(characterName.Trim(), CharacterName, StringComparison.OrdinalIgnoreCase)) {
            errorMessage = "This playtest host only accepts the configured test character.";
            return false;
        }

        return true;
    }

    public static bool IsForbiddenProductionPlayHost(string host) {
        if (string.IsNullOrWhiteSpace(host)) {
            return false;
        }

        var normalized = host.Trim().TrimEnd('.').ToLowerInvariant();
        return normalized == ForbiddenProductionPlayHost
            || normalized.EndsWith($".{ForbiddenProductionPlayHost}", StringComparison.Ordinal);
    }

    private static IEnumerable<string> EnumerateConfiguredHostnames() {
        yield return Environment.GetEnvironmentVariable("GAME_PUBLIC_HOSTNAME") ?? string.Empty;
        yield return Environment.GetEnvironmentVariable("PUBLIC_HOSTNAME") ?? string.Empty;
        yield return Environment.GetEnvironmentVariable("VIRTUAL_HOST") ?? string.Empty;
        yield return Environment.GetEnvironmentVariable("PLAYTEST_PUBLIC_HOST") ?? string.Empty;
        yield return Environment.GetEnvironmentVariable("HOSTNAME") ?? string.Empty;
        string? dnsHost = null;
        try {
            dnsHost = System.Net.Dns.GetHostName();
        } catch (Exception) {
        }
        if (!string.IsNullOrEmpty(dnsHost)) {
            yield return dnsHost;
        }
    }

    private static bool EnvPresent(string name) {
        return !string.IsNullOrEmpty(Environment.GetEnvironmentVariable(name));
    }

    private static bool EnvFlag(string name) {
        var value = Environment.GetEnvironmentVariable(name)?.Trim();
        return string.Equals(value, "1", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "true", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "yes", StringComparison.OrdinalIgnoreCase);
    }

    private static string EnvString(string name, string fallback) {
        var value = Environment.GetEnvironmentVariable(name)?.Trim();
        return string.IsNullOrEmpty(value) ? fallback : value;
    }
}
