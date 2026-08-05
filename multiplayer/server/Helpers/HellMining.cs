using System;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Play-mine $HELL gameplay facade: credit hooks, status/claim packets, and world tick settle.
/// Stake does not mint (C1). Copy stays utility/mining — no ROI framing.
/// Testing week: login / 1cr per hour online / HP-weighted farm (cap 100/species) / diversity / EK credits;
/// settle → pending for TGE airdrop.
/// </summary>
public static class HellMining {
    static string? lastReportDayWritten;

    /// <summary>Periodic settle + persist for the mining ledger; writes yesterday's report once after settle.</summary>
    public static void TickWorld(long nowMs) {
        HellMiningStore.Tick(nowMs);
        var yesterday = DateTimeOffset.FromUnixTimeMilliseconds(nowMs).UtcDateTime.Date.AddDays(-1)
            .ToString("yyyy-MM-dd");
        if (!string.Equals(lastReportDayWritten, yesterday, StringComparison.Ordinal)) {
            HellMiningStore.WriteDayReportFiles(yesterday);
            lastReportDayWritten = yesterday;
        }
    }

    /// <summary>First join of the day → +1 participation credit.</summary>
    public static void OnPlayerJoined(GameWorldPlayer player) {
        if (player is null || string.IsNullOrWhiteSpace(player.AccountWallet)) {
            return;
        }
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var result = HellMiningStore.RecordDailyPresence(player.AccountWallet, player.CharacterName, nowMs);
        if (result.Applied) {
            SendStatus(player, nowMs, result.Message);
        }
    }

    /// <summary>1-minute heartbeat: session minutes + 1 credit per full hour online (AFK counts).</summary>
    public static void OnSessionMinute(GameWorldPlayer player) {
        if (player is null || string.IsNullOrWhiteSpace(player.AccountWallet)) {
            return;
        }
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var result = HellMiningStore.RecordConnectedMinutes(player.AccountWallet, player.CharacterName, 1, nowMs);
        if (result.Applied) {
            SendStatus(player, nowMs, result.Message);
        }
    }

    /// <summary>Monster kill: testing = HP-weighted farm credits, max 100 kills/species + diversity double.</summary>
    public static void OnMonsterKilled(GameWorldPlayer killer, int catalogMonsterId = 0, int monsterMaxHp = 0) {
        if (killer is null || string.IsNullOrWhiteSpace(killer.AccountWallet)) {
            return;
        }
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var result = HellMiningStore.RecordMonsterKill(killer.AccountWallet, nowMs, catalogMonsterId, monsterMaxHp);
        if (result.Applied) {
            SendStatus(killer, nowMs, result.Message);
        }
    }

    /// <summary>
    /// Eligible open-world EK.
    /// Testing week: +10 credits each (max 10/day), no direct tokens, does not count for post-TGE ladders.
    /// After testing: legendary / top-100 direct-token paths.
    /// </summary>
    public static void OnEnemyKillAwarded(
        GameWorldPlayer killer,
        int? victimCityKillerRank,
        EkScreenshotRarity rarity) {
        if (killer is null || string.IsNullOrWhiteSpace(killer.AccountWallet)) {
            return;
        }
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var ekCredit = HellMiningStore.RecordEkCount(killer.AccountWallet, killer.CharacterName, nowMs);
        string? note = ekCredit.Applied ? ekCredit.Message : null;

        if (!HellMiningStore.IsTestingWeekActive(nowMs)) {
            if (rarity == EkScreenshotRarity.Legendary) {
                var leg = HellMiningStore.RecordLegendaryEk(killer.AccountWallet, nowMs);
                if (leg.Applied) {
                    note = leg.Message;
                }
            } else if (victimCityKillerRank is >= 1 and <= 100) {
                var top = HellMiningStore.RecordTop100Ek(killer.AccountWallet, nowMs);
                if (top.Applied) {
                    note = top.Message;
                }
            }
        }

        if (note is not null) {
            SendStatus(killer, nowMs, note);
        }
    }

    /// <summary>Timed Challenge clear → credits (and post-testing direct tokens).</summary>
    public static void OnEventParticipation(GameWorldPlayer player) {
        if (player is null || string.IsNullOrWhiteSpace(player.AccountWallet)) {
            return;
        }
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var result = HellMiningStore.RecordEventParticipation(player.AccountWallet, nowMs);
        if (result.Applied) {
            SendStatus(player, nowMs, result.Message);
        }
    }

    /// <summary>Client asks for pending $HELL / today's credits (SysMenu).</summary>
    public static void HandleStatusRequest(GameWorldPlayer player, HellMiningStatusRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        _ = request;
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        SendStatus(player, nowMs, message: null);
    }

    /// <summary>
    /// MVP claim guidance: pending stays server-side until middleware POST /hell/claim pays SPL.
    /// </summary>
    public static void HandleClaimRequest(GameWorldPlayer player, HellMiningClaimRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var snap = HellMiningStore.GetSnapshot(player.AccountWallet, nowMs);
        if (!snap.ClaimAvailable) {
            var pendingOnly =
                "Redeem at TGE / airdrop when the $HELL mint is live. Your testing-week credits convert to pending mining balance on each UTC day settle.";
            NetworkManager.SendToPlayer(player, new ServerMessage {
                HellMiningClaimResult = new HellMiningClaimResult {
                    Ok = false,
                    Message = pendingOnly,
                    PendingHell = snap.PendingHell,
                    ClaimedAmount = 0,
                },
            });
            SendStatus(player, nowMs, pendingOnly);
            return;
        }

        var amount = request.Amount > 0 ? request.Amount : snap.PendingHell;
        var message =
            $"Mint is live. Use middleware POST /hell/claim with your wallet session to receive up to {amount} SPL $HELL from the play-mine escrow. Utility mining only — not a salary or investment return.";
        NetworkManager.SendToPlayer(player, new ServerMessage {
            HellMiningClaimResult = new HellMiningClaimResult {
                Ok = true,
                Message = message,
                PendingHell = snap.PendingHell,
                ClaimedAmount = 0,
            },
        });
        SendStatus(player, nowMs, message);
    }

    public static void SendStatus(GameWorldPlayer player, long nowMs, string? message) {
        var snap = HellMiningStore.GetSnapshot(player.AccountWallet, nowMs);
        var defaultNote = HellMiningStore.IsTestingWeekActive(nowMs)
            ? "Testing week: +1 login, +1/hour online (AFK counts), farm by monster HP (cap 100/species), diversity & EKs. Settled daily → pending for TGE/airdrop — not a salary or investment return."
            : "Pending $HELL from play-mine credits. Redeemable when the token mint is live — not a salary or investment return.";
        var status = new HellMiningStatus {
            PendingHell = snap.PendingHell,
            ClaimedHell = snap.ClaimedHell,
            RemainingPool = snap.RemainingPool,
            UtcDay = snap.UtcDay,
            TodayCredits = snap.TodayCredits,
            TodayMonsterKills = snap.TodayMonsterKills,
            TodayMonsterCreditGranted = snap.TodayMonsterCreditGranted,
            TodayDirectTokens = snap.TodayDirectTokens,
            TodaySettled = snap.TodaySettled,
            ClaimAvailable = snap.ClaimAvailable,
            Note = string.IsNullOrWhiteSpace(message) ? defaultNote : message,
        };
        NetworkManager.SendToPlayer(player, new ServerMessage { HellMiningStatus = status });
    }
}
