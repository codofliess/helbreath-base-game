namespace Server.Utils;



/// <summary>

/// Tracks which cells are occupied and which are free for a given game world.

/// Uses map-blocked cells as initially occupied; supports runtime setOccupied/setFree for entities.

/// Single-thread access only.

/// </summary>

public sealed class GameWorldOccupancyTracker {

    private readonly int sizeX;

    private readonly int sizeY;

    /// <summary>Row-major <c>occupiedCells[y * sizeX + x]</c>; true means blocked or standing player.</summary>

    private readonly bool[] occupiedCells;

    /// <summary>Row-major teleport flags used to avoid spawning directly onto transfer trigger cells.</summary>

    private readonly bool[] teleportCells;

    /// <summary>Row-major wet flags (deep water sprite 19 + shore sprite 18) — never a player spawn cell.</summary>

    private readonly bool[] wetCells;

    /// <summary>Count of true entries for diagnostics.</summary>

    private int occupiedCount;



    public GameWorldOccupancyTracker(

        int sizeX,

        int sizeY,

        IEnumerable<(int X, int Y)> initiallyOccupied,

        IEnumerable<(int X, int Y)>? teleportCells = null,

        IEnumerable<(int X, int Y)>? wetCells = null) {

        if (sizeX <= 0 || sizeY <= 0) {

            throw new ArgumentOutOfRangeException(nameof(sizeX), "Map dimensions must be greater than zero.");

        }



        this.sizeX = sizeX;

        this.sizeY = sizeY;

        occupiedCells = new bool[sizeX * sizeY];

        this.teleportCells = new bool[sizeX * sizeY];

        this.wetCells = new bool[sizeX * sizeY];



        foreach (var cell in initiallyOccupied) {

            if (TryGetIndex(cell.X, cell.Y, out var index) && !occupiedCells[index]) {

                occupiedCells[index] = true;

                occupiedCount++;

            }

        }



        if (teleportCells is not null) {

            foreach (var cell in teleportCells) {

                if (TryGetIndex(cell.X, cell.Y, out var index)) {

                    this.teleportCells[index] = true;

                }

            }

        }



        if (wetCells is not null) {

            foreach (var cell in wetCells) {

                if (TryGetIndex(cell.X, cell.Y, out var index)) {

                    this.wetCells[index] = true;

                }

            }

        }

    }



    public int SizeX => sizeX;

    public int SizeY => sizeY;

    public int OccupiedCount => occupiedCount;



    public void SetOccupied(int x, int y) {

        if (TryGetIndex(x, y, out var index) && !occupiedCells[index]) {

            occupiedCells[index] = true;

            occupiedCount++;

        }

    }



    public void SetFree(int x, int y) {

        if (TryGetIndex(x, y, out var index) && occupiedCells[index]) {

            occupiedCells[index] = false;

            occupiedCount--;

        }

    }



    public bool IsFree(int x, int y) {

        return TryGetIndex(x, y, out var index) && !occupiedCells[index];

    }



    /// <summary>True when the cell uses water or shore ground sprites (not a dry spawn).</summary>

    public bool IsWetCell(int x, int y) {

        return TryGetIndex(x, y, out var index) && wetCells[index];

    }



    public bool IsFreeAndNotTeleportCell(int x, int y) {

        return TryGetIndex(x, y, out var index) && !occupiedCells[index] && !teleportCells[index];

    }



    /// <summary>Free, dry land, not a teleport trigger — used for death respawn near a corpse.</summary>

    public bool IsFreeDryCell(int x, int y) {

        return TryGetIndex(x, y, out var index)

            && !occupiedCells[index]

            && !teleportCells[index]

            && !wetCells[index];

    }



    /// <summary>True when the cell is free, dry, not a teleport trigger, and not adjacent to one (Chebyshev distance 1).</summary>

    public bool IsFreeSpawnCell(int x, int y) {

        if (!IsFreeDryCell(x, y)) {

            return false;

        }



        return !IsAdjacentToTeleportCell(x, y);

    }



    public bool IsAdjacentToTeleportCell(int x, int y) {

        for (var dy = -1; dy <= 1; dy++) {

            for (var dx = -1; dx <= 1; dx++) {

                if (dx == 0 && dy == 0) {

                    continue;

                }



                var nx = x + dx;

                var ny = y + dy;

                if (TryGetIndex(nx, ny, out var index) && teleportCells[index]) {

                    return true;

                }

            }

        }



        return false;

    }



    private bool TryGetIndex(int x, int y, out int index) {

        if ((uint)x >= (uint)sizeX || (uint)y >= (uint)sizeY) {

            index = -1;

            return false;

        }



        index = (y * sizeX) + x;

        return true;

    }

}


