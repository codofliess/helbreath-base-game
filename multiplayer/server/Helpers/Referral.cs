using System;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Referral facade: attribution on auth, invitee gold/tablets, L150 locked token pack (10k referrer + 5k guild).
/// </summary>
public static class Referral {
    public static void Initialize(string charsDirectory) => ReferralStore.Initialize(charsDirectory);

    public static void Tick(long nowMs) => ReferralStore.Tick(nowMs);

    /// <summary>
    /// After character is in world: ensure code, apply ?ref=, grant pending invitee rewards, snapshot guild.
    /// </summary>
    public static void OnPlayerEnteredWorld(GameWorldRef wr, GameWorldPlayer player, string? referralCodeFromAuth) {
        ArgumentNullException.ThrowIfNull(player);
        var wallet = player.AccountWallet;
        if (string.IsNullOrWhiteSpace(wallet)) {
            return;
        }

        ReferralStore.RememberGuild(wallet, player.GuildId);
        var code = ReferralStore.GetOrCreateCode(wallet, player.CharacterName);
        if (!string.IsNullOrEmpty(code)) {
            Notify(player, $"Your code: {code} — share https://play.chainlords.net/?ref={code}");
        }

        if (!string.IsNullOrWhiteSpace(referralCodeFromAuth)) {
            if (ReferralStore.TryAttribute(wallet, referralCodeFromAuth, out var msg)) {
                Notify(player, "Welcome via referral! Starter gold + tablets unlock as you level.");
                Console.WriteLine($"[Referral] {player.CharacterName}: {msg}");
            }
        }

        ReferralStore.NoteWalletMaxLevel(wallet, player.Level);
        TryGrantInviteeGold(wr, player);
        TryGrantLevelTablets(wr, player, ReferralStore.LevelTabletsEarly, ReferralStore.RewardInviteeTabs40);
        TryGrantLevelTablets(wr, player, ReferralStore.LevelTabletsMid, ReferralStore.RewardInviteeTabs120);
        TryGrantTokenPackIfEligible(player);
    }

    public static void OnProgression(GameWorldRef wr, GameWorldPlayer player, bool leveledUp) {
        ArgumentNullException.ThrowIfNull(player);
        if (string.IsNullOrWhiteSpace(player.AccountWallet)) {
            return;
        }
        ReferralStore.RememberGuild(player.AccountWallet, player.GuildId);
        ReferralStore.NoteWalletMaxLevel(player.AccountWallet, player.Level);
        if (!leveledUp) {
            return;
        }
        TryGrantLevelTablets(wr, player, ReferralStore.LevelTabletsEarly, ReferralStore.RewardInviteeTabs40);
        TryGrantLevelTablets(wr, player, ReferralStore.LevelTabletsMid, ReferralStore.RewardInviteeTabs120);
        TryGrantTokenPackIfEligible(player);
    }

    static void TryGrantInviteeGold(GameWorldRef wr, GameWorldPlayer player) {
        if (!ReferralStore.TryGetAttribution(player.AccountWallet, out _)) {
            return;
        }
        if (ReferralStore.IsRewardGranted(player.AccountWallet, ReferralStore.RewardInviteeGold)) {
            return;
        }
        if (!player.InventoryManager.TryCreateItemStack(GroundItemPickup.GoldItemId, ReferralStore.InviteeGold, out var mut)) {
            Notify(player, "Referral gold pending — free bag space and relog.");
            return;
        }
        if (!ReferralStore.TryMarkRewardGranted(player.AccountWallet, ReferralStore.RewardInviteeGold)) {
            return;
        }
        Inventory.ApplyInventoryMutation(wr, player, mut);
        Notify(player, $"+{ReferralStore.InviteeGold} gold (referral welcome).");
        Console.WriteLine($"[Referral] Gold → {player.CharacterName}");
    }

    static void TryGrantLevelTablets(GameWorldRef wr, GameWorldPlayer player, int requiredLevel, string rewardKind) {
        if (!ReferralStore.TryGetAttribution(player.AccountWallet, out _)) {
            return;
        }
        var maxLvl = Math.Max(player.Level, ReferralStore.GetWalletMaxLevel(player.AccountWallet));
        if (maxLvl < requiredLevel) {
            return;
        }
        if (ReferralStore.IsRewardGranted(player.AccountWallet, rewardKind)) {
            return;
        }
        if (!player.InventoryManager.TryCreateItemStack(
                ReferralStore.ExpTabletItemId,
                ReferralStore.ExpTabletCount,
                out var mut)) {
            Notify(player, $"Referral Exp Tablets (L{requiredLevel}) pending — free bag space and relog.");
            return;
        }
        if (!ReferralStore.TryMarkRewardGranted(player.AccountWallet, rewardKind)) {
            return;
        }
        Inventory.ApplyInventoryMutation(wr, player, mut);
        Notify(player, $"+{ReferralStore.ExpTabletCount} Exp Tablets (referral L{requiredLevel}).");
        Console.WriteLine($"[Referral] Tablets L{requiredLevel} → {player.CharacterName}");
    }

    static void TryGrantTokenPackIfEligible(GameWorldPlayer player) {
        if (!ReferralStore.TryGetAttribution(player.AccountWallet, out var attr)) {
            return;
        }
        var maxLvl = Math.Max(player.Level, ReferralStore.GetWalletMaxLevel(player.AccountWallet));
        if (maxLvl < ReferralStore.LevelTokenPack) {
            return;
        }
        if (ReferralStore.IsRewardGranted(player.AccountWallet, ReferralStore.RewardTokenPackL150)) {
            return;
        }

        // Guild share uses referrer's last known guild (snapshot on their logins).
        var referrerGuild = ReferralStore.GetLastGuild(attr.ReferrerWallet);
        if (!ReferralStore.TryGrantTokenPackL150(
                player.AccountWallet,
                attr.ReferrerWallet,
                referrerGuild,
                out var msg)) {
            if (!msg.Contains("Already", StringComparison.OrdinalIgnoreCase)) {
                Console.WriteLine($"[Referral] Token pack skip {player.CharacterName}: {msg}");
            }
            return;
        }
        Notify(player, "L150 referral milestone reached — inviter/guild locked $HELL grants queued (30 days).");
        Console.WriteLine($"[Referral] Token pack L150 referred={player.CharacterName}: {msg}");
    }

    static void Notify(GameWorldPlayer player, string text) {
        if (player.Disconnected) {
            return;
        }
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateChatMessageReceived("System", nowMs, $"[Referral] {text}"));
    }
}
