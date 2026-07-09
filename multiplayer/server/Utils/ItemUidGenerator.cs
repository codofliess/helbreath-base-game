namespace Server.Utils;

/// <summary>Allocates unique runtime item instance ids for bag and ground loot.</summary>
public static class ItemUidGenerator {
    public static long Allocate() => BitConverter.ToInt64(Guid.NewGuid().ToByteArray(), 0);
}