using System.Text.RegularExpressions;
using Server.Utils;

namespace Server.World.Game;

/// <summary>
/// Loads .amd map files and extracts occupancy data for game world collision/movement.
/// </summary>
public static class Map {
    private const int HeaderSize = 256;
    private const byte BlockedFlag = 0x80; // Bit 7: 1 = blocked, 0 = move allowed
    private const byte TeleportFlag = 0x40; // Bit 6: blue teleport tile in classic .amd
    /// <summary>Classic Helbreath deep-water tileset; never a valid standing cell.</summary>
    private const short WaterSprite = 19;
    /// <summary>
    /// Shore / shallow tileset used on coastal maps (e.g. traveler <c>default</c>).
    /// Often walkable in the .amd flags but looks like water — reject for spawn.
    /// </summary>
    private const short ShoreSprite = 18;

    /// <summary>
    /// Loads an .amd map file and returns a GameWorldOccupancyTracker with blocked cells marked occupied.
    /// Movement uses the classic AMD blocked bit (0x80) only — same as Olympia/Helbreath. Water/shore
    /// sprites without that bit are walkable (Middleland east island bridge near 458,249 → Icebound pads).
    /// Sprite 18/19 are still marked wet so spawns never land on them
    /// (<see cref="GameWorldOccupancyTracker.IsFreeDryCell"/>).
    /// AMD teleport-flag tiles (bit 0x40) are merged into spawn teleport cells so landings never sit on
    /// unwired blue pads (common near farm↔promiseland gates).
    /// </summary>
    /// <param name="mapsDirectory">Directory containing .amd files (e.g. Config/maps)</param>
    /// <param name="mapName">Map file name without extension (e.g. aresden)</param>
    public static GameWorldOccupancyTracker LoadOccupancy(
        string mapsDirectory,
        string mapName,
        IEnumerable<WorldLocationConfig>? teleportCells = null) {
        var path = Path.Combine(mapsDirectory, $"{mapName}.amd");
        var bytes = File.ReadAllBytes(path);

        if (bytes.Length < HeaderSize) {
            throw new InvalidOperationException($"Map file '{path}' is too small to contain a valid header.");
        }

        var headerText = System.Text.Encoding.ASCII.GetString(bytes.AsSpan(0, HeaderSize));
        ParseHeader(headerText, out var sizeX, out var sizeY, out var tileSize);

        if (sizeX <= 0 || sizeY <= 0 || tileSize <= 0) {
            throw new InvalidOperationException($"Invalid map dimensions in '{path}': {sizeX}x{sizeY}, tileSize={tileSize}");
        }

        var expectedDataSize = sizeX * sizeY * tileSize;
        if (bytes.Length < HeaderSize + expectedDataSize) {
            throw new InvalidOperationException($"Map file '{path}' is too small for dimensions {sizeX}x{sizeY} with tileSize {tileSize}.");
        }

        var blockedCells = new List<(int X, int Y)>();
        var wetCells = new List<(int X, int Y)>();
        var teleFlagCells = new List<(int X, int Y)>();
        var offset = HeaderSize;

        for (var y = 0; y < sizeY; y++) {
            for (var x = 0; x < sizeX; x++) {
                var sprite = BitConverter.ToInt16(bytes, offset);
                var flags = bytes[offset + 8];
                var isWet = sprite == WaterSprite || sprite == ShoreSprite;
                var isTeleportFlag = (flags & TeleportFlag) != 0;
                // Classic Helbreath: movement blocked only by map bit 0x80 (not by water sprite alone).
                var isBlocked = (flags & BlockedFlag) != 0;
                if (isBlocked) {
                    blockedCells.Add((x, y));
                }
                if (isWet) {
                    wetCells.Add((x, y));
                }
                // AMD teleport-bit tiles look blue even when GameWorlds omits them — never spawn onto them.
                if (isTeleportFlag) {
                    teleFlagCells.Add((x, y));
                }
                offset += tileSize;
            }
        }

        var allTeleportCells = new List<(int X, int Y)>();
        if (teleportCells is not null) {
            allTeleportCells.AddRange(teleportCells.Select(cell => (cell.X, cell.Y)));
        }
        allTeleportCells.AddRange(teleFlagCells);

        return new GameWorldOccupancyTracker(
            sizeX,
            sizeY,
            blockedCells,
            allTeleportCells,
            wetCells);
    }

    /// <summary>Token-scans the 256-byte ASCII header for MAPSIZEX, MAPSIZEY, and TILESIZE key=value triples.</summary>
    private static void ParseHeader(string headerText, out int sizeX, out int sizeY, out int tileSize) {
        sizeX = 0;
        sizeY = 0;
        tileSize = 0;

        var normalized = headerText.Replace('\0', ' ');
        var tokens = Regex.Split(normalized, @"\s+").Where(t => t.Length > 0).ToArray();

        for (var i = 0; i < tokens.Length; i++) {
            var token = tokens[i];
            if (i + 2 >= tokens.Length) {
                continue;
            }

            if (tokens[i + 1] != "=") {
                continue;
            }

            if (!int.TryParse(tokens[i + 2], out var value)) {
                continue;
            }

            switch (token) {
                case "MAPSIZEX":
                    sizeX = value;
                    break;
                case "MAPSIZEY":
                    sizeY = value;
                    break;
                case "TILESIZE":
                    tileSize = value;
                    break;
            }
        }
    }
}
