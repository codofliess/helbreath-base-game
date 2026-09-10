using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Join-time path hints so Magias testers can reach Elvine streets / Gandalf
/// instead of treating Garden or Hunt Zone as the city.
/// </summary>
public static class CityEscape {
    /// <summary>One system line after join / transfer onto garden, huntzone, or home city.</summary>
    public static void NotifyOnJoin(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        var worldId = wr.WorldId ?? "";

        string? hint = null;
        if (string.Equals(worldId, "elvuni", StringComparison.OrdinalIgnoreCase)) {
            hint = "Elvine Garden (hostile) — not city streets. Blue wall east (176,20-28) → Hunt Zone 1, then south gate to Elvine. Restart! also returns to Elvine plaza. Gandalf is in the Wizard Tower door (180,77).";
        } else if (string.Equals(worldId, "areuni", StringComparison.OrdinalIgnoreCase)) {
            hint = "Aresden Garden (hostile) — not city streets. Blue tiles north (y=20) → Hunt Zone 2, then city. Restart! returns to Aresden plaza. Gandalf is in the Wizard Tower.";
        } else if (string.Equals(worldId, "huntzone1", StringComparison.OrdinalIgnoreCase)) {
            hint = "Hunt Zone 1. South blue tiles (y=179) → Elvine city. West blue tiles (x=20) are the Garden (Giant Tree / Unicorn). Restart! returns to Elvine plaza. Gandalf: Wizard Tower door (180,77).";
        } else if (string.Equals(worldId, "huntzone2", StringComparison.OrdinalIgnoreCase)) {
            hint = "Hunt Zone 2. North/city-side blue tiles return to Aresden. South blue tiles are the Garden. Restart! returns to Aresden plaza.";
        } else if (string.Equals(worldId, "elvine", StringComparison.OrdinalIgnoreCase)) {
            hint = "Elvine city. Magic Tower (Gandalf) door at (180,77) — learn Fire Strike there. City Hall (Kennedy) can teleport you to the tower.";
        } else if (string.Equals(worldId, "elvwzdtwr", StringComparison.OrdinalIgnoreCase)
            || string.Equals(worldId, "arewzdtwr", StringComparison.OrdinalIgnoreCase)) {
            hint = "Wizard Tower. Talk to Gandalf to buy / learn circle spells (Fire Strike, Recall, Triple Energy Bolt).";
        }

        if (string.IsNullOrEmpty(hint)) {
            return;
        }

        NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(hint));
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateChatMessageReceived(
                "System",
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                hint));
    }
}
