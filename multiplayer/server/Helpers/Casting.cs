using System.Collections.Generic;
using Mmorpg.Network;
using Server;
using Server.World;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Authoritative spell casting for a single map: cast-start/cancel fan-out, cast resolution (rectangle, cone, linear AoE, single-cell, and ground effects),
/// projectile-delayed damage scheduling where applicable, and deferred damage delivery using combat rules.
/// </summary>
public static class Casting {
    /// <summary>Client <c>EFFECT_INVISIBILITY</c> key for <see cref="CastEffect"/>.</summary>
    private const string InvisibilityCastEffectKey = "invisibility";

    /// <summary>Client <c>EFFECT_BERSERK</c> key for <see cref="CastEffect"/>.</summary>
    private const string BerserkCastEffectKey = "berserk";

    /// <summary>Client <c>EFFECT_PARALYZE</c> key for <see cref="CastEffect"/>.</summary>
    private const string ParalyzeCastEffectKey = "paralyze";

    /// <summary>Client <c>EFFECT_HOLD_TWIST</c> key for Hold Person <see cref="CastEffect"/>.</summary>
    private const string HoldPersonCastEffectKey = "hold-twist";

    /// <summary>Client heal / shield / status cast-effect keys.</summary>
    private const string HealCastEffectKey = "heal";
    private const string DefenseShieldCastEffectKey = "defense-shield";
    private const string ProtectFromArrowCastEffectKey = "protection-from-arrows-buff";
    private const string ProtectFromMagicCastEffectKey = "protection-ring";
    private const string AbsoluteMagicProtectCastEffectKey = "absolute-magic-protection";
    private const string PoisonCastEffectKey = "poison-debuff";
    private const string ConfuseCastEffectKey = "unknown-debuff-1";
    private const string ConfusionCastEffectKey = "snooze";
    private const string IllusionCastEffectKey = "blue-apparition";
    private const string CancellationCastEffectKey = "cancellation";
    private const string InhibitionCastEffectKey = "inhibition-casting-1";
    private const string SummonCastEffectKey = "blue-apparition";

    /// <summary>Server catalog id for Hold Person (shorter HOLDOBJECT; same <see cref="TemporaryEffectType.Paralyze"/>).</summary>
    private const int HoldPersonSpellId = 28;

    /// <summary>Client <c>EFFECT_SNOOZE</c> key for Possession pickup VFX.</summary>
    private const string PossessionCastEffectKey = "snooze";

    /// <summary>Authoritative spell-start selection: remembers the requested spell id and fans out cast-start visuals to nearby players.</summary>
    public static void HandleSpellCastStartRequest(
        GameWorldRef wr,
        IReadOnlyDictionary<int, SpellConfig> spellsById,
        GameWorldPlayer player,
        SpellCastStartRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(spellsById);

        if (player.IsDead) {
            return;
        }
        if (player.HasTemporaryEffect(TemporaryEffectType.Inhibition)) {
            return;
        }
        // Learned tower spell OR equipped MS22 charge wand for that spell.
        // Arena: Inhib/Cancel/Sleep require kit credit charges.
        if (!ChargeWand.AllowsSpellCast(player, request.SpellId)) {
            if (player.InTournamentArena && GameWorldPlayer.IsArenaCreditGatedSpell(request.SpellId)) {
                NetworkManager.SendToPlayer(
                    player,
                    NetworkManager.CreateSendMessage(
                        "That spell is locked in Arena — buy uses with kit credits (Create/Edit Fighter catalog)."));
            }
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSpellCastFailed());
            return;
        }
        if (!spellsById.TryGetValue(request.SpellId, out var spell)) {
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSpellCastFailed());
            return;
        }

        // INT gate — hard fail 100% when effective INT (base + Angelic INT if equipped) is short.
        if (spell.RequiredInt is int needInt) {
            var haveInt = PlayerDerivedStats.EffectiveInt(player);
            if (haveInt < needInt) {
                PlayerDerivedStats.GetAngelicBonuses(player, out _, out _, out var angelInt, out _);
                NetworkManager.SendToPlayer(
                    player,
                    NetworkManager.CreateSendMessage(
                        $"{spell.Name}: need INT {needInt} (you have {haveInt}" +
                        (angelInt > 0 ? $", incl. Angel INT +{angelInt}" : ", equip Angelic Pandent(INT) if needed") +
                        "). Cast failed."));
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSpellCastFailed());
                return;
            }
        }
        // Keep cast speed honest vs Magic 100% / Mag ≥ 50 rule.
        PlayerDerivedStats.ApplyAuthoritativeCastSpeed(player);

        // Weapon class + shield auto-unequip (Devlin Superior/Exceptional exception).
        if (!EquipCombatRules.PrepareForSpellCast(wr, player, out var equipErr)) {
            if (!string.IsNullOrEmpty(equipErr)) {
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(equipErr));
            }
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSpellCastFailed());
            return;
        }

        if (player.SpawnProtection) {
            Spawn.DisableSpawnProtectionAndNotify(wr, player);
        }

        AntiBotTools.NoteGameplayActivity(player);
        TemporaryEffects.BreakInvisibilityIfPresent(wr, player);

        player.SetRequestedSpellId(request.SpellId);
        player.RecordSpellCastStartTimeMs(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        var startedMessage = NetworkManager.CreateSpellCastStarted(player.PlayerId, spell.Name, player.CastSpeedMs);
        foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId)) {
            NetworkManager.SendToPlayer(nearbyPlayer, startedMessage);
        }
    }

    /// <summary>Cancels the current requested spell, if any, and fans out cast-cancel visuals to nearby players.</summary>
    public static void HandleSpellCastCancelRequest(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);

        if (!player.RequestedSpellId.HasValue) {
            return;
        }

        player.ClearRequestedSpell();
        var cancelledMessage = NetworkManager.CreateSpellCastCancelled(player.PlayerId);
        // Caster must receive cancel too — otherwise client cast bar can stick after right-click/ESC.
        NetworkManager.SendToPlayer(player, cancelledMessage);
        foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId)) {
            NetworkManager.SendToPlayer(nearbyPlayer, cancelledMessage);
        }
    }

    /// <summary>Resolves the currently requested spell and broadcasts the authoritative cast event to nearby players and the caster.</summary>
    public static void HandleSpellCastRequest(
        GameWorldRef wr,
        string worldIdForLogging,
        IReadOnlyDictionary<int, SpellConfig> spellsById,
        GameWorldPlayer player,
        SpellCastRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(spellsById);

        if (player.IsDead) {
            return;
        }
        if (player.HasTemporaryEffect(TemporaryEffectType.Inhibition)) {
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSpellCastFailed());
            player.ClearRequestedSpell();
            return;
        }

        if (!player.RequestedSpellId.HasValue) {
            Console.WriteLine(
                $"[GameWorld:{worldIdForLogging}] Spell cast request without pending spell: player {player.PlayerId} target=({request.X},{request.Y}) (violation).");
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSpellCastFailed());
            return;
        }
        if (!spellsById.TryGetValue(player.RequestedSpellId.Value, out var spell)) {
            player.ClearRequestedSpell();
            return;
        }

        if (spell.RequiredInt is int needIntResolve) {
            var haveInt = PlayerDerivedStats.EffectiveInt(player);
            if (haveInt < needIntResolve) {
                NetworkManager.SendToPlayer(
                    player,
                    NetworkManager.CreateSendMessage(
                        $"{spell.Name}: need INT {needIntResolve} (you have {haveInt}). Cast failed 100%."));
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSpellCastFailed());
                player.ClearRequestedSpell();
                return;
            }
        }

        // Re-check weapon class + auto-unequip non-Devlin shield at resolve (client could re-equip mid-cast).
        if (!EquipCombatRules.PrepareForSpellCast(wr, player, out var resolveEquipErr)) {
            if (!string.IsNullOrEmpty(resolveEquipErr)) {
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(resolveEquipErr));
            }
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSpellCastFailed());
            player.ClearRequestedSpell();
            return;
        }

        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        AntiBotTools.NoteGameplayActivity(player);
        if (player.IsSpellCastTimingViolation(nowMs, out var minIntervalMs, out var actualElapsedSinceStartMs)) {
            var actualPart = actualElapsedSinceStartMs is double elapsed
                ? $"actualElapsedMs={elapsed:0.##}"
                : "actualElapsedMs=n/a (no cast start)";
            Console.WriteLine(
                $"[GameWorld:{worldIdForLogging}] Spell cast too quick: player {player.PlayerId} ({actualPart}, minIntervalMs={minIntervalMs:0.##}, pingVariance={player.PingVariance:0.##}, cappedPingVarianceMs={player.GetCappedPingVariance():0.##}, castSpeedMs={player.CastSpeedMs}).");
            var elapsedForTelemetry = actualElapsedSinceStartMs is double e ? (long)e : -1;
            AntiBotTools.NoteTournamentCast(
                player,
                worldIdForLogging,
                wr.World.IsTournamentArena,
                elapsedForTelemetry,
                player.CastSpeedMs);
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSpellCastFailed());
            player.ClearRequestedSpell();
            return;
        }

        var targetX = request.X;
        var targetY = request.Y;
        TryApplySpellAimAssist(wr, player, spell, request, ref targetX, ref targetY);

        var settings = wr.Settings;
        // Utility/self spells (Recall, buffs, food, possession) must not fail the camera-range gate —
        // after a world transfer the client often still clicks stale pixels.
        var isSelfOrUtility =
            spell.Recall == true ||
            spell.PickupGroundItem == true ||
            spell.CreateFood == true ||
            spell.SummonCreature == true ||
            (!spell.DamageType.HasValue &&
             Math.Abs(targetX - player.PosX) <= 1 &&
             Math.Abs(targetY - player.PosY) <= 1);
        if (!isSelfOrUtility &&
            (Math.Abs(targetX - player.PosX) > settings.Radius.CameraRadiusX ||
             Math.Abs(targetY - player.PosY) > settings.Radius.CameraRadiusY)) {
            Console.WriteLine(
                $"[GameWorld:{worldIdForLogging}] Spell cast target out of camera range: player {player.PlayerId} target=({targetX},{targetY}) pos=({player.PosX},{player.PosY}) cameraRadius=({settings.Radius.CameraRadiusX},{settings.Radius.CameraRadiusY}).");
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSpellCastFailed());
            player.ClearRequestedSpell();
            return;
        }

        // CreateFood / Summon: snap to caster (utility).
        // Recall: ONLY when aimed on self (≤1 cell) — never auto-recall from clicking anywhere.
        if (spell.CreateFood == true || spell.SummonCreature == true) {
            targetX = player.PosX;
            targetY = player.PosY;
        }
        if (spell.Recall == true) {
            if (Math.Abs(targetX - player.PosX) > 1 || Math.Abs(targetY - player.PosY) > 1) {
                NetworkManager.SendToPlayer(
                    player,
                    NetworkManager.CreateSendMessage("Cast Recall on yourself (click your character)."));
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSpellCastFailed());
                player.ClearRequestedSpell();
                return;
            }
            targetX = player.PosX;
            targetY = player.PosY;
        }

        // Olympia cast probability (Magic skill × circle table + INT/level). Fail = fizzle, no MP spent later path.
        if (!MagicCastSuccess.RollCastSuccess(player, spell.Id, wr.World.CurrentWeather)) {
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSpellCastFailed());
            // Small magic skill drip even on fail (practice), like combat soft grind.
            if (Random.Shared.Next(1, 101) <= 5) {
                Skills.GrantSkillXp(player, Skills.Magic, 1);
                Skills.SendSkillsState(player);
            }
            player.ClearRequestedSpell();
            return;
        }

        // MP cost with Mana Save (necklace MS, etc.). Cap save 80%. Fail if insufficient MP.
        var manaCost = PlayerDerivedStats.ComputeSpellManaCost(player, spell.Id);
        if (!player.TrySpendMp(manaCost)) {
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSpellCastFailed());
            player.ClearRequestedSpell();
            return;
        }
        Progression.SendProgressionUpdated(player, leveledUp: false);

        // Successful cast: soft train Magic skill (cap Mag*2 like Olympia).
        if (Random.Shared.Next(1, 101) <= 12) {
            var magCap = Math.Min(Skills.MaxLevel, Math.Max(20, PlayerDerivedStats.EffectiveMag(player) * 2));
            var cur = player.GetSkillLevel(Skills.Magic);
            if (cur < magCap) {
                Skills.GrantSkillXp(player, Skills.Magic, 1);
                Skills.SendSkillsState(player);
            }
        }

        player.ClearRequestedSpell();
        TemporaryEffects.BreakInvisibilityIfPresent(wr, player);

        // Arena credit spells: burn one kit use after successful cast.
        if (player.InTournamentArena && GameWorldPlayer.IsArenaCreditGatedSpell(spell.Id)) {
            if (player.TryConsumeArenaPerUseSpellCharge(spell.Id)) {
                var left = player.GetArenaPerUseSpellCharges(spell.Id);
                NetworkManager.SendToPlayer(
                    player,
                    NetworkManager.CreateSendMessage(
                        left > 0
                            ? $"[Arena] {spell.Name}: {left} use(s) left this entry."
                            : $"[Arena] {spell.Name}: no uses left (buy more with kit credits)."));
            }
        }

        // MS22 charge wands: burn one charge after a successful cast of Inhib/Cancel/MIM (world only).
        if (!player.InTournamentArena) {
            ChargeWand.TryConsumeChargeAfterCast(player, spell.Id);
        }

        // Self-paralyze / Hold Person: any other successful magic frees the caster
        // (Olympia: FW/FF on self or casting while locked ends HOLDOBJECT on self).
        if (spell.Id != 27 && spell.Id != HoldPersonSpellId &&
            player.HasTemporaryEffect(TemporaryEffectType.Paralyze)) {
            player.RemoveTemporaryEffect(wr, TemporaryEffectType.Paralyze, broadcastExpired: true);
        }

        if (spell.PickupGroundItem == true) {
            ResolvePossessionPickup(wr, player, targetX, targetY, spell);
            return;
        }

        if (spell.Recall == true) {
            // Self-only utility: land on guarded farm/city teleporter pad (never wild).
            var castFx = NetworkManager.CreateCastDirectionalAoeSpell(
                player.PlayerId,
                spell.Id,
                player.PosX,
                player.PosY,
                player.PosX,
                player.PosY);
            NetworkManager.SendToPlayer(player, castFx);
            foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId)) {
                NetworkManager.SendToPlayer(nearbyPlayer, castFx);
            }

            if (!Recall.TryExecute(wr, player, out _)) {
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSpellCastFailed());
            }
            return;
        }

        if (!spell.DamageType.HasValue) {
            // Body click on tall mobs/players maps to a cell north of feet — snap before VFX + apply.
            if (spell.ClearTemporaryEffects == true) {
                // Cancellation: self / friends / enemies / monsters; prefer entity under cursor, else loose self pad.
                TemporaryEffects.TrySnapCancellationOrSelfTarget(wr, player, ref targetX, ref targetY);
            } else {
                TemporaryEffects.TrySnapBuffTargetToEntityBody(wr, ref targetX, ref targetY);
            }

            var buffCastMessage = NetworkManager.CreateCastDirectionalAoeSpell(
                player.PlayerId,
                spell.Id,
                player.PosX,
                player.PosY,
                targetX,
                targetY);
            NetworkManager.SendToPlayer(player, buffCastMessage);
            foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId)) {
                NetworkManager.SendToPlayer(nearbyPlayer, buffCastMessage);
            }

            // Entity-targeted buffs/cancels: only draw cast VFX when someone is under the cell.
            // Prevents PFM/DS protection-ring looping forever on empty grid clicks.
            var needsEntity =
                spell.ClearTemporaryEffects == true ||
                spell.CurePoison == true ||
                spell.HealDiceCount is not null ||
                spell.TemporaryEffects is { Length: > 0 };
            var showCastFx =
                !needsEntity ||
                spell.CreateFood == true ||
                spell.SummonCreature == true ||
                TemporaryEffects.HasEntityAtCellOrBody(wr, targetX, targetY);
            if (showCastFx) {
                FanOutBuffCastEffects(wr, player, spell, targetX, targetY);
            }
            TemporaryEffects.ResolveUtilityOrBuffSpellAtCell(wr, player, spell, targetX, targetY);
            return;
        }

        switch (spell.DamageType!.Value) {
            case (int)DamageType.RectangleAoe: {
                    var aoeRadius = Math.Max(0, spell.AoeRadius ?? 0);
                    var castAoeSpellMessage = NetworkManager.CreateCastAoeSpell(
                        player.PlayerId,
                        spell.Id,
                        targetX,
                        targetY);
                    NetworkManager.SendToPlayer(player, castAoeSpellMessage);
                    foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId)) {
                        NetworkManager.SendToPlayer(nearbyPlayer, castAoeSpellMessage);
                    }

                    if (spell.ProjectileSpeed is int projectileSpeedPxPerSec) {
                        var delayMs = spell.ProjectileDistance is int fixedDistancePx
                            ? Projectile.ComputeTravelTimeFromPixelDistance(fixedDistancePx, projectileSpeedPxPerSec)
                            : Projectile.ComputeTravelTime(player.PosX, player.PosY, targetX, targetY, projectileSpeedPxPerSec);
                        var casterId = player.PlayerId;
                        var targetPlayerIds = new List<long>();
                        foreach (var targetPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(targetX, targetY, excludeDisconnected: false)) {
                            if (targetPlayer.PlayerId == player.PlayerId) {
                                continue;
                            }
                            if (!IsWithinSpellDamageArea(targetPlayer.PosX, targetPlayer.PosY, targetX, targetY, aoeRadius)) {
                                continue;
                            }

                            targetPlayerIds.Add(targetPlayer.PlayerId);
                        }

                        var targetMonsterIds = new List<long>();
                        foreach (var targetMonster in wr.MonsterSpatialGrid.GetNearbyMonsters(targetX, targetY)) {
                            if (!IsWithinSpellDamageArea(targetMonster.PosX, targetMonster.PosY, targetX, targetY, aoeRadius)) {
                                continue;
                            }

                            targetMonsterIds.Add(targetMonster.MonsterId);
                        }

                        wr.Scheduler.SetTimeout(delayMs, () => DeliverDeferredSpellDamage(wr, casterId, targetPlayerIds, targetMonsterIds, ResolveSpellAttackType(spell), spell.Id));
                    } else {
                        ApplyRectangleSpellDamage(wr, player, targetX, targetY, aoeRadius, ResolveSpellAttackType(spell), spell);
                    }

                    break;
                }
            case (int)DamageType.ConeAoe: {
                    var castDirectionalAoeSpellMessage = NetworkManager.CreateCastDirectionalAoeSpell(
                        player.PlayerId,
                        spell.Id,
                        player.PosX,
                        player.PosY,
                        targetX,
                        targetY);
                    NetworkManager.SendToPlayer(player, castDirectionalAoeSpellMessage);
                    foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId)) {
                        NetworkManager.SendToPlayer(nearbyPlayer, castDirectionalAoeSpellMessage);
                    }

                    // Olympia ICE_LINEAR (Blizzard): path multi-hit when maxHitsPerTarget is set; else unique cone cells.
                    var coneCollected = spell.MaxHitsPerTarget is > 0
                        ? TryCollectOlympiaLinearMultiHitTargets(wr, player.PlayerId, player.PosX, player.PosY, targetX, targetY, spell, excludeCasterPlayerId: player.PlayerId, out var coneCasterId, out var coneTargetPlayerIds, out var coneTargetMonsterIds)
                        : TryCollectConeSpellDamageTargets(wr, player, targetX, targetY, spell, out coneCasterId, out coneTargetPlayerIds, out coneTargetMonsterIds);
                    if (coneCollected) {
                        wr.Scheduler.SetTimeout(settings.Timings.BlizzardSpellDamageDelayMs, () => DeliverDeferredSpellDamage(wr, coneCasterId, coneTargetPlayerIds, coneTargetMonsterIds, ResolveSpellAttackType(spell), spell.Id));
                    }

                    break;
                }
            case (int)DamageType.LinearAoe: {
                    var linearCastMessage = NetworkManager.CreateCastDirectionalAoeSpell(
                        player.PlayerId,
                        spell.Id,
                        player.PosX,
                        player.PosY,
                        targetX,
                        targetY);
                    NetworkManager.SendToPlayer(player, linearCastMessage);
                    foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId)) {
                        NetworkManager.SendToPlayer(nearbyPlayer, linearCastMessage);
                    }

                    var linearCollected = spell.MaxHitsPerTarget is > 0
                        ? TryCollectOlympiaLinearMultiHitTargets(wr, player.PlayerId, player.PosX, player.PosY, targetX, targetY, spell, excludeCasterPlayerId: player.PlayerId, out var linearCasterId, out var linearTargetPlayerIds, out var linearTargetMonsterIds)
                        : TryCollectLinearAoeSpellDamageTargets(wr, player, targetX, targetY, spell, out linearCasterId, out linearTargetPlayerIds, out linearTargetMonsterIds);
                    if (linearCollected && spell.Duration is int linearDurationMs) {
                        var delayMs = linearDurationMs / 2;
                        wr.Scheduler.SetTimeout(delayMs, () => DeliverDeferredSpellDamage(wr, linearCasterId, linearTargetPlayerIds, linearTargetMonsterIds, ResolveSpellAttackType(spell), spell.Id));
                    }

                    break;
                }
            case (int)DamageType.SingleCell: {
                    var singleCellCastMessage = NetworkManager.CreateCastDirectionalAoeSpell(
                        player.PlayerId,
                        spell.Id,
                        player.PosX,
                        player.PosY,
                        targetX,
                        targetY);
                    NetworkManager.SendToPlayer(player, singleCellCastMessage);
                    foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId)) {
                        NetworkManager.SendToPlayer(nearbyPlayer, singleCellCastMessage);
                    }

                    ApplyRectangleSpellDamage(wr, player, targetX, targetY, 0, ResolveSpellAttackType(spell), spell);
                    break;
                }
            case (int)DamageType.GroundEffect:
                ApplyGroundEffectSpell(wr, player, targetX, targetY, spell);
                break;
        }
    }

    /// <summary>
    /// Olympia <c>ICE_LINEAR</c> / <c>DAMAGE_LINEAR</c> multi-hit collection.
    /// Samples path points with Bresenham steps i=2..9 (center + 4 orthogonals per sample), stops near aim,
    /// then adds one end-area hit when <see cref="SpellConfig.AoeRadius"/> is set. Same entity can accrue
    /// multiple hits; list is expanded with duplicates so deferred delivery re-rolls MR per hit.
    /// Capped by <see cref="SpellConfig.MaxHitsPerTarget"/>.
    /// </summary>
    private static bool TryCollectOlympiaLinearMultiHitTargets(
        GameWorldRef wr,
        long casterPlayerIdForOut,
        int casterX,
        int casterY,
        int targetX,
        int targetY,
        SpellConfig spell,
        long? excludeCasterPlayerId,
        out long casterPlayerId,
        out List<long> targetPlayerIds,
        out List<long> targetMonsterIds) {
        casterPlayerId = casterPlayerIdForOut;
        targetPlayerIds = new List<long>();
        targetMonsterIds = new List<long>();
        if (spell.MaxHitsPerTarget is not int maxHits || maxHits < 1) {
            return false;
        }

        var playerHitCounts = new Dictionary<long, int>();
        var monsterHitCounts = new Dictionary<long, int>();

        void TryAccruePlayer(long playerId) {
            if (excludeCasterPlayerId is long ex && playerId == ex) {
                return;
            }
            playerHitCounts.TryGetValue(playerId, out var count);
            if (count >= maxHits) {
                return;
            }
            playerHitCounts[playerId] = count + 1;
        }

        void TryAccrueMonster(long monsterId) {
            monsterHitCounts.TryGetValue(monsterId, out var count);
            if (count >= maxHits) {
                return;
            }
            monsterHitCounts[monsterId] = count + 1;
        }

        void AccrueEntitiesAtOrthogonalPlus(int cx, int cy, HashSet<long> seenPlayers, HashSet<long> seenMonsters) {
            AccrueEntitiesAtCell(wr, cx, cy, seenPlayers, seenMonsters, TryAccruePlayer, TryAccrueMonster);
            AccrueEntitiesAtCell(wr, cx - 1, cy, seenPlayers, seenMonsters, TryAccruePlayer, TryAccrueMonster);
            AccrueEntitiesAtCell(wr, cx + 1, cy, seenPlayers, seenMonsters, TryAccruePlayer, TryAccrueMonster);
            AccrueEntitiesAtCell(wr, cx, cy - 1, seenPlayers, seenMonsters, TryAccruePlayer, TryAccrueMonster);
            AccrueEntitiesAtCell(wr, cx, cy + 1, seenPlayers, seenMonsters, TryAccruePlayer, TryAccrueMonster);
        }

        // Olympia: for (i = 2; i < 10; i++) GetPoint2(...). Samples must span the FULL ray
        // (not just the first 8 tiles from caster) — otherwise long-range Blizzard only ever
        // lands the end-area hit once. Map i=2..9 onto steps along the chebyshev distance.
        var rayDist = Math.Max(Math.Abs(targetX - casterX), Math.Abs(targetY - casterY));
        if (rayDist < 1) {
            rayDist = 1;
        }
        for (var i = 2; i < 10; i++) {
            // steps in 1..rayDist so late samples land near / on the aim cell.
            var steps = Math.Max(1, (i * rayDist) / 9);
            GetBresenhamPointAfterSteps(casterX, casterY, targetX, targetY, steps, out var sampleX, out var sampleY);
            var seenPlayers = new HashSet<long>();
            var seenMonsters = new HashSet<long>();
            AccrueEntitiesAtOrthogonalPlus(sampleX, sampleY, seenPlayers, seenMonsters);
        }

        // End-area rectangle (Magic.cfg range2/3 → aoeRadius on our catalog).
        if (spell.AoeRadius is int endRadius && endRadius >= 0) {
            var seenPlayersEnd = new HashSet<long>();
            var seenMonstersEnd = new HashSet<long>();
            var minX = targetX - endRadius;
            var maxX = targetX + endRadius;
            var minY = targetY - endRadius;
            var maxY = targetY + endRadius;
            foreach (var p in wr.PlayerSpatialGrid.GetPlayersInRectangle(minX, minY, maxX, maxY, excludeDisconnected: false)) {
                if (Location.GetDistance(p.PosX, p.PosY, targetX, targetY) > endRadius) {
                    continue;
                }
                if (!seenPlayersEnd.Add(p.PlayerId)) {
                    continue;
                }
                TryAccruePlayer(p.PlayerId);
            }
            foreach (var m in wr.MonsterSpatialGrid.GetMonstersInRectangle(minX, minY, maxX, maxY)) {
                if (Location.GetDistance(m.PosX, m.PosY, targetX, targetY) > endRadius) {
                    continue;
                }
                if (!seenMonstersEnd.Add(m.MonsterId)) {
                    continue;
                }
                TryAccrueMonster(m.MonsterId);
            }
        }

        // Olympia residual spot at exact aim cell (value4-6 dice there; we re-use area dice).
        // Only targets standing on the aim tile get this extra hit — rewards good aim.
        {
            var seenPlayersAim = new HashSet<long>();
            var seenMonstersAim = new HashSet<long>();
            AccrueEntitiesAtCell(wr, targetX, targetY, seenPlayersAim, seenMonstersAim, TryAccruePlayer, TryAccrueMonster);
        }

        foreach (var (id, count) in playerHitCounts) {
            for (var h = 0; h < count; h++) {
                targetPlayerIds.Add(id);
            }
        }
        foreach (var (id, count) in monsterHitCounts) {
            for (var h = 0; h < count; h++) {
                targetMonsterIds.Add(id);
            }
        }

        return targetPlayerIds.Count > 0 || targetMonsterIds.Count > 0;
    }

    private static void AccrueEntitiesAtCell(
        GameWorldRef wr,
        int cellX,
        int cellY,
        HashSet<long> seenPlayers,
        HashSet<long> seenMonsters,
        Action<long> tryAccruePlayer,
        Action<long> tryAccrueMonster) {
        if (cellX < 0 || cellY < 0 ||
            cellX >= wr.OccupancyTracker.SizeX ||
            cellY >= wr.OccupancyTracker.SizeY) {
            return;
        }

        foreach (var p in wr.PlayerSpatialGrid.GetPlayersInRectangle(cellX, cellY, cellX, cellY, excludeDisconnected: false)) {
            if (p.PosX != cellX || p.PosY != cellY) {
                continue;
            }
            if (!seenPlayers.Add(p.PlayerId)) {
                continue;
            }
            tryAccruePlayer(p.PlayerId);
        }

        foreach (var m in wr.MonsterSpatialGrid.GetMonstersInRectangle(cellX, cellY, cellX, cellY)) {
            if (m.PosX != cellX || m.PosY != cellY) {
                continue;
            }
            if (!seenMonsters.Add(m.MonsterId)) {
                continue;
            }
            tryAccrueMonster(m.MonsterId);
        }
    }

    /// <summary>Walks <paramref name="steps"/> Bresenham iterations from start toward end (Olympia GetPoint2-style).</summary>
    private static void GetBresenhamPointAfterSteps(int x0, int y0, int x1, int y1, int steps, out int x, out int y) {
        x = x0;
        y = y0;
        if (steps <= 0 || (x0 == x1 && y0 == y1)) {
            return;
        }

        var dx = Math.Abs(x1 - x0);
        var dy = Math.Abs(y1 - y0);
        var sx = x0 < x1 ? 1 : -1;
        var sy = y0 < y1 ? 1 : -1;
        var err = dx - dy;
        for (var s = 0; s < steps; s++) {
            if (x == x1 && y == y1) {
                return;
            }

            var e2 = 2 * err;
            if (e2 >= -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 <= dx) {
                err += dx;
                y += sy;
            }
        }
    }

    /// <summary>When the spell supports aim assist and the request includes a resolvable id, replaces the cast grid cell with that entity's position.</summary>
    private static void TryApplySpellAimAssist(
        GameWorldRef wr,
        GameWorldPlayer caster,
        SpellConfig spell,
        SpellCastRequest request,
        ref int targetX,
        ref int targetY) {
        if (spell.AimAssist != true) {
            return;
        }

        var allowSelfTarget = !spell.DamageType.HasValue;
        if (request.HasMonsterId) {
            if (wr.World.TryGetMonsterByMonsterId(request.MonsterId, out var monster) && !monster.Dead) {
                if (monster.HasTemporaryEffect(TemporaryEffectType.Invisibility) && !SpellAimAssist.AllowsInvisibleMonsterTarget(monster)) {
                    return;
                }

                targetX = monster.PosX;
                targetY = monster.PosY;
                return;
            }
        }

        if (request.HasPlayerId &&
            wr.World.TryGetConnectedPlayerById(request.PlayerId, out var targetPlayer) &&
            !targetPlayer.Disconnected &&
            !targetPlayer.IsDead &&
            (allowSelfTarget || targetPlayer.PlayerId != caster.PlayerId) &&
            !targetPlayer.SpawnProtection) {
            if (targetPlayer.HasTemporaryEffect(TemporaryEffectType.Invisibility) && !SpellAimAssist.AllowsInvisiblePlayerTarget(caster, targetPlayer)) {
                return;
            }

            targetX = targetPlayer.PosX;
            targetY = targetPlayer.PosY;
        }
    }

    /// <summary>
    /// Applies spell damage to recipients captured at cast time after the scheduled delay; skips the caster if invalid and targets that are disconnected, dead, or spawn-protected.
    /// </summary>
    private static void DeliverDeferredSpellDamage(
        GameWorldRef wr,
        long casterPlayerId,
        List<long> targetPlayerIds,
        List<long> targetMonsterIds,
        AttackType attackType,
        int spellId) {
        if (!wr.World.TryGetConnectedPlayerById(casterPlayerId, out var caster) || caster.Disconnected || caster.IsDead) {
            return;
        }

        if (!wr.SpellsById.TryGetValue(spellId, out var spell)) {
            return;
        }

        foreach (var playerId in targetPlayerIds) {
            if (playerId == casterPlayerId) {
                continue;
            }
            if (!wr.World.TryGetConnectedPlayerById(playerId, out var targetPlayer) || targetPlayer.Disconnected || targetPlayer.IsDead || targetPlayer.SpawnProtection) {
                continue;
            }
            if (TemporaryEffects.IsMagicBlockedByProtect(targetPlayer, spellId)) {
                continue;
            }

            Combat.ApplyPlayerSpellDamageToPlayer(wr, caster, targetPlayer, attackType, spell);
            if (spell.ArmorLifeDecrement is int armorShred && armorShred > 0) {
                TemporaryEffects.ApplyArmorLifeDecrement(wr, targetPlayer, armorShred);
            }
            TemporaryEffects.ApplySpellTemporaryEffectsOnHit(wr, spell, targetPlayer, caster);
        }

        foreach (var monsterId in targetMonsterIds) {
            if (!wr.World.TryGetMonsterByMonsterId(monsterId, out var targetMonster) || targetMonster.Dead) {
                continue;
            }
            if (TemporaryEffects.IsMagicBlockedByProtect(targetMonster, spellId)) {
                continue;
            }

            Combat.ApplyPlayerSpellDamageToMonster(wr, caster, targetMonster, attackType, spell);
            TemporaryEffects.ApplySpellTemporaryEffectsOnHit(wr, spell, targetMonster);
        }
    }

    /// <summary>Applies spell damage to every living player and monster whose authoritative cell falls inside the target-centered Chebyshev square.</summary>
    private static void ApplyRectangleSpellDamage(
        GameWorldRef wr,
        GameWorldPlayer caster,
        int targetX,
        int targetY,
        int aoeRadius,
        AttackType attackType,
        SpellConfig spell) {
        foreach (var targetPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(targetX, targetY, excludeDisconnected: false)) {
            if (targetPlayer.PlayerId == caster.PlayerId) {
                continue;
            }
            if (!IsWithinSpellDamageArea(targetPlayer.PosX, targetPlayer.PosY, targetX, targetY, aoeRadius)) {
                continue;
            }

            if (TemporaryEffects.IsMagicBlockedByProtect(targetPlayer, spell.Id)) {
                continue;
            }

            Combat.ApplyPlayerSpellDamageToPlayer(wr, caster, targetPlayer, attackType, spell);
            if (spell.ArmorLifeDecrement is int armorShred && armorShred > 0) {
                TemporaryEffects.ApplyArmorLifeDecrement(wr, targetPlayer, armorShred);
            }
            TemporaryEffects.ApplySpellTemporaryEffectsOnHit(wr, spell, targetPlayer, caster);
        }

        foreach (var targetMonster in wr.MonsterSpatialGrid.GetNearbyMonsters(targetX, targetY)) {
            if (!IsWithinSpellDamageArea(targetMonster.PosX, targetMonster.PosY, targetX, targetY, aoeRadius)) {
                continue;
            }
            if (TemporaryEffects.IsMagicBlockedByProtect(targetMonster, spell.Id)) {
                continue;
            }

            Combat.ApplyPlayerSpellDamageToMonster(wr, caster, targetMonster, attackType, spell);
            TemporaryEffects.ApplySpellTemporaryEffectsOnHit(wr, spell, targetMonster);
        }
    }

    /// <summary>Fans out cast-effect VFX keys for buff / utility spells to nearby players.</summary>
    private static void FanOutBuffCastEffects(
        GameWorldRef wr,
        GameWorldPlayer caster,
        SpellConfig spell,
        int targetX,
        int targetY) {
        string? effectKey = null;
        if (spell.HealDiceCount is not null) {
            effectKey = HealCastEffectKey;
        } else if (spell.CurePoison == true) {
            effectKey = HealCastEffectKey;
        } else if (spell.ClearTemporaryEffects == true) {
            effectKey = CancellationCastEffectKey;
        } else if (spell.SummonCreature == true) {
            effectKey = SummonCastEffectKey;
        } else if (spell.CreateFood == true) {
            effectKey = null;
        } else if (spell.TemporaryEffects is { Length: > 0 } rows) {
            effectKey = rows[0].Type switch {
                (int)TemporaryEffectType.Invisibility => InvisibilityCastEffectKey,
                (int)TemporaryEffectType.Berserk => BerserkCastEffectKey,
                (int)TemporaryEffectType.Paralyze => spell.Id == HoldPersonSpellId
                    ? HoldPersonCastEffectKey
                    : ParalyzeCastEffectKey,
                (int)TemporaryEffectType.Poison => PoisonCastEffectKey,
                (int)TemporaryEffectType.ConfuseLanguage => ConfuseCastEffectKey,
                (int)TemporaryEffectType.Confusion => ConfusionCastEffectKey,
                (int)TemporaryEffectType.Illusion => IllusionCastEffectKey,
                (int)TemporaryEffectType.IllusionMovement => IllusionCastEffectKey,
                (int)TemporaryEffectType.Inhibition => InhibitionCastEffectKey,
                (int)TemporaryEffectType.ProtectFromArrow => ProtectFromArrowCastEffectKey,
                (int)TemporaryEffectType.ProtectFromMagic => ProtectFromMagicCastEffectKey,
                (int)TemporaryEffectType.DefenseShield => DefenseShieldCastEffectKey,
                (int)TemporaryEffectType.GreatDefenseShield => DefenseShieldCastEffectKey,
                (int)TemporaryEffectType.AbsoluteMagicProtect => AbsoluteMagicProtectCastEffectKey,
                // Haste reuses a light recovery flash on the target cell (no dedicated sheet yet).
                (int)TemporaryEffectType.Haste => HealCastEffectKey,
                _ => null,
            };
        }

        if (effectKey is null) {
            return;
        }

        var castEffectMessage = NetworkManager.CreateCastEffect(wr.WorldId, effectKey, targetX, targetY);
        NetworkManager.SendToPlayer(caster, castEffectMessage);
        foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(caster.PosX, caster.PosY, caster.SessionId)) {
            NetworkManager.SendToPlayer(nearbyPlayer, castEffectMessage);
        }
    }

    /// <summary>Spell hit mode from <see cref="SpellConfig.AttackType"/> (default <see cref="AttackType.Interrupt"/>). Ground-effect spells map <see cref="AttackType.Knockback"/> to <see cref="AttackType.Stun"/>.</summary>
    private static AttackType ResolveSpellAttackType(SpellConfig spell) {
        var raw = (AttackType)(spell.AttackType ?? (int)AttackType.Interrupt);
        if (spell.DamageType == (int)DamageType.GroundEffect && raw == AttackType.Knockback) {
            return AttackType.Stun;
        }

        return raw;
    }

    /// <summary>Builds cone-affected cells and records which players and monsters would take damage at this moment (used for deferred Blizzard delivery).</summary>
    private static bool TryCollectConeSpellDamageTargets(
        GameWorldRef wr,
        GameWorldPlayer caster,
        int targetX,
        int targetY,
        SpellConfig spell,
        out long casterPlayerId,
        out List<long> targetPlayerIds,
        out List<long> targetMonsterIds) {
        casterPlayerId = caster.PlayerId;
        targetPlayerIds = new List<long>();
        targetMonsterIds = new List<long>();
        if (!TryBuildConeSpellAffectedCells(wr, caster.PosX, caster.PosY, targetX, targetY, spell, out var minX, out var minY, out var maxX, out var maxY)) {
            return false;
        }

        foreach (var targetPlayer in wr.PlayerSpatialGrid.GetPlayersInRectangle(minX, minY, maxX, maxY, excludeDisconnected: false)) {
            if (targetPlayer.PlayerId == caster.PlayerId) {
                continue;
            }
            if (!wr.SpellAffectedCellsScratch.Contains((targetPlayer.PosX, targetPlayer.PosY))) {
                continue;
            }

            targetPlayerIds.Add(targetPlayer.PlayerId);
        }

        foreach (var targetMonster in wr.MonsterSpatialGrid.GetMonstersInRectangle(minX, minY, maxX, maxY)) {
            if (!wr.SpellAffectedCellsScratch.Contains((targetMonster.PosX, targetMonster.PosY))) {
                continue;
            }

            targetMonsterIds.Add(targetMonster.MonsterId);
        }

        return true;
    }

    /// <summary>True when a cell falls within the target-centered spell square defined by <paramref name="aoeRadius"/>.</summary>
    private static bool IsWithinSpellDamageArea(int cellX, int cellY, int targetX, int targetY, int aoeRadius) {
        return Location.GetDistance(cellX, cellY, targetX, targetY) <= aoeRadius;
    }

    /// <summary>Places one ground-effect instance on each covered cell and broadcasts only the successfully created effects.</summary>
    private static void ApplyGroundEffectSpell(GameWorldRef wr, GameWorldPlayer caster, int targetX, int targetY, SpellConfig spell) {
        if (spell.Group is not int group || spell.Duration is not int durationMs) {
            return;
        }

        var aoeRadius = Math.Max(0, spell.AoeRadius ?? 0);
        var tickRateMs = spell.TickRate;
        var resolvedAttackType = ResolveSpellAttackType(spell);
        var createdEffects = new List<GroundEffectState>();
        var minX = Math.Max(0, targetX - aoeRadius);
        var minY = Math.Max(0, targetY - aoeRadius);
        var maxX = Math.Min(wr.OccupancyTracker.SizeX - 1, targetX + aoeRadius);
        var maxY = Math.Min(wr.OccupancyTracker.SizeY - 1, targetY + aoeRadius);
        for (var cellY = minY; cellY <= maxY; cellY++) {
            for (var cellX = minX; cellX <= maxX; cellX++) {
                if (!IsWithinSpellDamageArea(cellX, cellY, targetX, targetY, aoeRadius)) {
                    continue;
                }

                // Snapshot Olympia magic damage at cast (not melee STR / caster.Damage).
                var groundDamage = PlayerDerivedStats.RollMagicDamage(caster, spell);
                if (!wr.GroundStateTracker.TryAddEffect(
                        spell.Id,
                        ResolveGroundEffectType(spell),
                        caster.PlayerId,
                        cellX,
                        cellY,
                        group,
                        tickRateMs,
                        durationMs,
                        groundDamage,
                        resolvedAttackType,
                        out var createdEffect) ||
                    createdEffect is null) {
                    continue;
                }

                createdEffects.Add(createdEffect);
            }
        }

        if (createdEffects.Count > 0) {
            GroundStateVisibility.BroadcastGroundEffectsCreated(wr, createdEffects);
        }
    }

    /// <summary>Resolves the visual/gameplay ground-effect kind created by this spell.</summary>
    private static GroundEffectType ResolveGroundEffectType(SpellConfig spell) {
        return spell.Id switch {
            8 => GroundEffectType.Fire,
            4 => GroundEffectType.Poison, // Poison Cloud 3×3
            53 => GroundEffectType.Poison, // Cloud Kill 5×5 (same PCLOUD visual, larger field)
            7 => GroundEffectType.SpikeField,
            9 => GroundEffectType.IceStorm,
            _ => throw new InvalidOperationException($"Unhandled ground-effect spell id {spell.Id} ({spell.Name})."),
        };
    }

    /// <summary>Builds the set of grid cells covered by the sampled expanding circles used for cone-style Blizzard visuals and returns the inclusive bounding box.</summary>
    private static bool TryBuildConeSpellAffectedCells(
        GameWorldRef wr,
        int casterX,
        int casterY,
        int targetX,
        int targetY,
        SpellConfig spell,
        out int minX,
        out int minY,
        out int maxX,
        out int maxY) {
        wr.SpellAffectedCellsScratch.Clear();
        minX = 0;
        minY = 0;
        maxX = -1;
        maxY = -1;

        if (!spell.EmissionSteps.HasValue ||
            !spell.StartRadius.HasValue ||
            !spell.EndRadius.HasValue ||
            !spell.StartShards.HasValue ||
            !spell.EndShards.HasValue) {
            return false;
        }

        var emissionSteps = spell.EmissionSteps.Value;
        var startRadius = spell.StartRadius.Value;
        var endRadius = spell.EndRadius.Value;
        var startShards = spell.StartShards.Value;
        var endShards = spell.EndShards.Value;
        var mapMaxX = Math.Max(0, wr.OccupancyTracker.SizeX - 1);
        var mapMaxY = Math.Max(0, wr.OccupancyTracker.SizeY - 1);
        var hasAnyCell = false;

        for (var step = 0; step < emissionSteps; step++) {
            var progress = emissionSteps > 1 ? (double)step / (emissionSteps - 1) : 1d;
            var radius = (int)Math.Floor(startRadius + (endRadius - startRadius) * progress);
            var shardCount = (int)Math.Round(startShards + (endShards - startShards) * progress, MidpointRounding.AwayFromZero);
            if (shardCount <= 0) {
                continue;
            }

            var centerX = casterX + (targetX - casterX) * progress;
            var centerY = casterY + (targetY - casterY) * progress;
            var stepMinX = Math.Max(0, (int)Math.Floor(centerX - radius));
            var stepMaxX = Math.Min(mapMaxX, (int)Math.Ceiling(centerX + radius));
            var stepMinY = Math.Max(0, (int)Math.Floor(centerY - radius));
            var stepMaxY = Math.Min(mapMaxY, (int)Math.Ceiling(centerY + radius));
            var radiusSquared = radius * radius;

            for (var cellY = stepMinY; cellY <= stepMaxY; cellY++) {
                for (var cellX = stepMinX; cellX <= stepMaxX; cellX++) {
                    var dx = cellX - centerX;
                    var dy = cellY - centerY;
                    if ((dx * dx) + (dy * dy) > radiusSquared) {
                        continue;
                    }

                    wr.SpellAffectedCellsScratch.Add((cellX, cellY));
                    if (!hasAnyCell) {
                        minX = cellX;
                        minY = cellY;
                        maxX = cellX;
                        maxY = cellY;
                        hasAnyCell = true;
                    } else {
                        minX = Math.Min(minX, cellX);
                        minY = Math.Min(minY, cellY);
                        maxX = Math.Max(maxX, cellX);
                        maxY = Math.Max(maxY, cellY);
                    }
                }
            }
        }

        return hasAnyCell;
    }

    /// <summary>Builds the thickened line (orthogonal ±1 per Bresenham step), optional target-centered AoE, and records which players and monsters would take damage at cast time.</summary>
    private static bool TryCollectLinearAoeSpellDamageTargets(
        GameWorldRef wr,
        GameWorldPlayer caster,
        int targetX,
        int targetY,
        SpellConfig spell,
        out long casterPlayerId,
        out List<long> targetPlayerIds,
        out List<long> targetMonsterIds) {
        casterPlayerId = caster.PlayerId;
        targetPlayerIds = new List<long>();
        targetMonsterIds = new List<long>();
        if (!TryBuildLinearAoeAffectedCells(wr, caster.PosX, caster.PosY, targetX, targetY, spell, out var minX, out var minY, out var maxX, out var maxY)) {
            return false;
        }

        foreach (var targetPlayer in wr.PlayerSpatialGrid.GetPlayersInRectangle(minX, minY, maxX, maxY, excludeDisconnected: false)) {
            if (targetPlayer.PlayerId == caster.PlayerId) {
                continue;
            }
            if (!wr.SpellAffectedCellsScratch.Contains((targetPlayer.PosX, targetPlayer.PosY))) {
                continue;
            }

            targetPlayerIds.Add(targetPlayer.PlayerId);
        }

        foreach (var targetMonster in wr.MonsterSpatialGrid.GetMonstersInRectangle(minX, minY, maxX, maxY)) {
            if (!wr.SpellAffectedCellsScratch.Contains((targetMonster.PosX, targetMonster.PosY))) {
                continue;
            }

            targetMonsterIds.Add(targetMonster.MonsterId);
        }

        return true;
    }

    /// <summary>
    /// Fills <see cref="GameWorldRef.SpellAffectedCellsScratch"/> with: (1) a thickened Bresenham beam (center cell plus four orthogonals at each step),
    /// (2) when <paramref name="spell"/>.<see cref="SpellConfig.AoeRadius"/> is set, all cells within Chebyshev distance of the target cell (same rule as rectangle AoE).
    /// </summary>
    private static bool TryBuildLinearAoeAffectedCells(
        GameWorldRef wr,
        int casterX,
        int casterY,
        int targetX,
        int targetY,
        SpellConfig spell,
        out int minX,
        out int minY,
        out int maxX,
        out int maxY) {
        wr.SpellAffectedCellsScratch.Clear();
        minX = 0;
        minY = 0;
        maxX = -1;
        maxY = -1;
        var mapMaxX = Math.Max(0, wr.OccupancyTracker.SizeX - 1);
        var mapMaxY = Math.Max(0, wr.OccupancyTracker.SizeY - 1);
        var hasAnyCell = false;

        var x0 = casterX;
        var y0 = casterY;
        var x1 = targetX;
        var y1 = targetY;
        var dx = Math.Abs(x1 - x0);
        var dy = Math.Abs(y1 - y0);
        var sx = x0 < x1 ? 1 : -1;
        var sy = y0 < y1 ? 1 : -1;
        var err = dx - dy;
        var x = x0;
        var y = y0;

        while (true) {
            AddLinearAoeOrthogonalPlus(wr, x, y, 0, 0, mapMaxX, mapMaxY, ref minX, ref minY, ref maxX, ref maxY, ref hasAnyCell);

            if (x == x1 && y == y1) {
                break;
            }

            var e2 = 2 * err;
            if (e2 >= -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 <= dx) {
                err += dx;
                y += sy;
            }
        }

        if (spell.AoeRadius is int aoeRadius && aoeRadius >= 0) {
            for (var cy = targetY - aoeRadius; cy <= targetY + aoeRadius; cy++) {
                for (var cx = targetX - aoeRadius; cx <= targetX + aoeRadius; cx++) {
                    if (Location.GetDistance(cx, cy, targetX, targetY) > aoeRadius) {
                        continue;
                    }

                    TryAddLinearAoeCell(wr, cx, cy, 0, 0, mapMaxX, mapMaxY, ref minX, ref minY, ref maxX, ref maxY, ref hasAnyCell);
                }
            }
        }

        return hasAnyCell;
    }

    private static void AddLinearAoeOrthogonalPlus(
        GameWorldRef wr,
        int cx,
        int cy,
        int mapMinX,
        int mapMinY,
        int mapMaxX,
        int mapMaxY,
        ref int minX,
        ref int minY,
        ref int maxX,
        ref int maxY,
        ref bool hasAnyCell) {
        TryAddLinearAoeCell(wr, cx, cy, mapMinX, mapMinY, mapMaxX, mapMaxY, ref minX, ref minY, ref maxX, ref maxY, ref hasAnyCell);
        TryAddLinearAoeCell(wr, cx - 1, cy, mapMinX, mapMinY, mapMaxX, mapMaxY, ref minX, ref minY, ref maxX, ref maxY, ref hasAnyCell);
        TryAddLinearAoeCell(wr, cx + 1, cy, mapMinX, mapMinY, mapMaxX, mapMaxY, ref minX, ref minY, ref maxX, ref maxY, ref hasAnyCell);
        TryAddLinearAoeCell(wr, cx, cy - 1, mapMinX, mapMinY, mapMaxX, mapMaxY, ref minX, ref minY, ref maxX, ref maxY, ref hasAnyCell);
        TryAddLinearAoeCell(wr, cx, cy + 1, mapMinX, mapMinY, mapMaxX, mapMaxY, ref minX, ref minY, ref maxX, ref maxY, ref hasAnyCell);
    }

    private static void TryAddLinearAoeCell(
        GameWorldRef wr,
        int cellX,
        int cellY,
        int mapMinX,
        int mapMinY,
        int mapMaxX,
        int mapMaxY,
        ref int minX,
        ref int minY,
        ref int maxX,
        ref int maxY,
        ref bool hasAnyCell) {
        if (cellX < mapMinX || cellX > mapMaxX || cellY < mapMinY || cellY > mapMaxY) {
            return;
        }

        if (!wr.SpellAffectedCellsScratch.Add((cellX, cellY))) {
            return;
        }

        if (!hasAnyCell) {
            minX = maxX = cellX;
            minY = maxY = cellY;
            hasAnyCell = true;
        } else {
            minX = Math.Min(minX, cellX);
            minY = Math.Min(minY, cellY);
            maxX = Math.Max(maxX, cellX);
            maxY = Math.Max(maxY, cellY);
        }
    }

    /// <summary>Authoritative monster spell resolution: broadcasts monster cast packets to viewers and applies damage using <paramref name="damage"/> for all targets (same roll as player spell damage).</summary>
    public static void ApplyMonsterSpell(
        GameWorldRef wr,
        GameWorldMonster caster,
        SpellConfig spell,
        int targetX,
        int targetY,
        int damage) {
        ArgumentNullException.ThrowIfNull(caster);
        ArgumentNullException.ThrowIfNull(spell);

        var settings = wr.Settings;
        if (Math.Abs(targetX - caster.PosX) > settings.Radius.CameraRadiusX || Math.Abs(targetY - caster.PosY) > settings.Radius.CameraRadiusY) {
            return;
        }

        // Hostile status-only spells (Paralyze, etc.) — no DamageType.
        if (!spell.DamageType.HasValue) {
            if (Config.IsHostileDebuffSpellConfig(spell)) {
                ApplyMonsterHostileDebuff(wr, caster, spell, targetX, targetY);
            }
            return;
        }

        var attackType = ResolveSpellAttackType(spell);
        switch (spell.DamageType.Value) {
            case (int)DamageType.RectangleAoe: {
                    var aoeRadius = Math.Max(0, spell.AoeRadius ?? 0);
                    var castAoeSpellMessage = NetworkManager.CreateMonsterCastAoeSpell(
                        caster.MonsterId,
                        spell.Id,
                        targetX,
                        targetY);
                    foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(caster.PosX, caster.PosY, null, excludeDisconnected: true)) {
                        NetworkManager.SendToPlayer(nearbyPlayer, castAoeSpellMessage);
                    }

                    if (spell.ProjectileSpeed is int projectileSpeedPxPerSec) {
                        var delayMs = spell.ProjectileDistance is int fixedDistancePx
                            ? Projectile.ComputeTravelTimeFromPixelDistance(fixedDistancePx, projectileSpeedPxPerSec)
                            : Projectile.ComputeTravelTime(caster.PosX, caster.PosY, targetX, targetY, projectileSpeedPxPerSec);
                        var casterMonsterId = caster.MonsterId;
                        var targetPlayerIds = new List<long>();
                        foreach (var targetPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(targetX, targetY, excludeDisconnected: false)) {
                            if (!IsWithinSpellDamageArea(targetPlayer.PosX, targetPlayer.PosY, targetX, targetY, aoeRadius)) {
                                continue;
                            }

                            targetPlayerIds.Add(targetPlayer.PlayerId);
                        }

                        var targetMonsterIds = new List<long>();
                        foreach (var targetMonster in wr.MonsterSpatialGrid.GetNearbyMonsters(targetX, targetY)) {
                            if (targetMonster.MonsterId == caster.MonsterId) {
                                continue;
                            }
                            if (!IsWithinSpellDamageArea(targetMonster.PosX, targetMonster.PosY, targetX, targetY, aoeRadius)) {
                                continue;
                            }

                            targetMonsterIds.Add(targetMonster.MonsterId);
                        }

                        wr.Scheduler.SetTimeout(delayMs, () => DeliverDeferredMonsterSpellDamage(wr, casterMonsterId, targetPlayerIds, targetMonsterIds, attackType, damage, spell.Id));
                    } else {
                        ApplyRectangleMonsterSpellDamage(wr, caster, targetX, targetY, aoeRadius, attackType, damage, spell);
                    }

                    break;
                }
            case (int)DamageType.ConeAoe: {
                    var castDirectionalAoeSpellMessage = NetworkManager.CreateMonsterCastDirectionalAoeSpell(
                        caster.MonsterId,
                        spell.Id,
                        caster.PosX,
                        caster.PosY,
                        targetX,
                        targetY);
                    foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(caster.PosX, caster.PosY, null, excludeDisconnected: true)) {
                        NetworkManager.SendToPlayer(nearbyPlayer, castDirectionalAoeSpellMessage);
                    }

                    var coneCollected = spell.MaxHitsPerTarget is > 0
                        ? TryCollectOlympiaLinearMultiHitTargets(wr, 0, caster.PosX, caster.PosY, targetX, targetY, spell, excludeCasterPlayerId: null, out _, out var coneTargetPlayerIds, out var coneTargetMonsterIds)
                        : TryCollectConeSpellDamageTargetsMonster(wr, caster, targetX, targetY, spell, out coneTargetPlayerIds, out coneTargetMonsterIds);
                    if (coneCollected) {
                        wr.Scheduler.SetTimeout(settings.Timings.BlizzardSpellDamageDelayMs, () => DeliverDeferredMonsterSpellDamage(wr, caster.MonsterId, coneTargetPlayerIds, coneTargetMonsterIds, attackType, damage, spell.Id));
                    }

                    break;
                }
            case (int)DamageType.LinearAoe: {
                    var linearCastMessage = NetworkManager.CreateMonsterCastDirectionalAoeSpell(
                        caster.MonsterId,
                        spell.Id,
                        caster.PosX,
                        caster.PosY,
                        targetX,
                        targetY);
                    foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(caster.PosX, caster.PosY, null, excludeDisconnected: true)) {
                        NetworkManager.SendToPlayer(nearbyPlayer, linearCastMessage);
                    }

                    var linearCollected = spell.MaxHitsPerTarget is > 0
                        ? TryCollectOlympiaLinearMultiHitTargets(wr, 0, caster.PosX, caster.PosY, targetX, targetY, spell, excludeCasterPlayerId: null, out _, out var linearTargetPlayerIds, out var linearTargetMonsterIds)
                        : TryCollectLinearAoeSpellDamageTargetsMonster(wr, caster, targetX, targetY, spell, out linearTargetPlayerIds, out linearTargetMonsterIds);
                    if (linearCollected && spell.Duration is int linearDurationMs) {
                        var delayMs = linearDurationMs / 2;
                        wr.Scheduler.SetTimeout(delayMs, () => DeliverDeferredMonsterSpellDamage(wr, caster.MonsterId, linearTargetPlayerIds, linearTargetMonsterIds, attackType, damage, spell.Id));
                    }

                    break;
                }
            case (int)DamageType.SingleCell: {
                    var singleCellCastMessage = NetworkManager.CreateMonsterCastDirectionalAoeSpell(
                        caster.MonsterId,
                        spell.Id,
                        caster.PosX,
                        caster.PosY,
                        targetX,
                        targetY);
                    foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(caster.PosX, caster.PosY, null, excludeDisconnected: true)) {
                        NetworkManager.SendToPlayer(nearbyPlayer, singleCellCastMessage);
                    }

                    ApplyRectangleMonsterSpellDamage(wr, caster, targetX, targetY, 0, attackType, damage, spell);
                    break;
                }
            default:
                throw new InvalidOperationException($"Monster spell {spell.Id} ({spell.Name}) has unsupported damageType {spell.DamageType}.");
        }
    }

    private static void DeliverDeferredMonsterSpellDamage(
        GameWorldRef wr,
        long casterMonsterId,
        List<long> targetPlayerIds,
        List<long> targetMonsterIds,
        AttackType attackType,
        int damage,
        int spellId) {
        if (!wr.World.TryGetMonsterByMonsterId(casterMonsterId, out var caster) || caster.Dead) {
            return;
        }

        if (!wr.SpellsById.TryGetValue(spellId, out var spell)) {
            return;
        }

        // Town/farm guards (Friendly) never damage players — even LB AoE splash while fighting mobs.
        var hitPlayers = caster.Allegiance != MonsterAllegiance.Friendly;
        foreach (var playerId in targetPlayerIds) {
            if (!hitPlayers) {
                break;
            }
            if (!wr.World.TryGetConnectedPlayerById(playerId, out var targetPlayer) || targetPlayer.Disconnected || targetPlayer.IsDead || targetPlayer.SpawnProtection) {
                continue;
            }

            Combat.ApplyMonsterSpellDamageToPlayer(wr, caster, targetPlayer, damage, attackType);
            TemporaryEffects.ApplySpellTemporaryEffectsOnHit(wr, spell, targetPlayer);
        }

        foreach (var monsterId in targetMonsterIds) {
            if (!wr.World.TryGetMonsterByMonsterId(monsterId, out var targetMonster) || targetMonster.Dead) {
                continue;
            }

            Combat.ApplyMonsterSpellDamageToMonster(wr, caster, targetMonster, damage, attackType);
            TemporaryEffects.ApplySpellTemporaryEffectsOnHit(wr, spell, targetMonster);
        }
    }

    /// <summary>Monster Paralyze / hostile debuff: single-cell player target (academy elite / unicorn kit).</summary>
    private static void ApplyMonsterHostileDebuff(
        GameWorldRef wr,
        GameWorldMonster caster,
        SpellConfig spell,
        int targetX,
        int targetY) {
        var castMsg = NetworkManager.CreateMonsterCastAoeSpell(caster.MonsterId, spell.Id, targetX, targetY);
        foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(caster.PosX, caster.PosY, null, excludeDisconnected: true)) {
            NetworkManager.SendToPlayer(nearbyPlayer, castMsg);
        }

        if (caster.Allegiance == MonsterAllegiance.Friendly) {
            return;
        }

        foreach (var targetPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(targetX, targetY, excludeDisconnected: false)) {
            if (targetPlayer.PosX != targetX || targetPlayer.PosY != targetY || targetPlayer.IsDead) {
                continue;
            }
            TemporaryEffects.ApplySpellTemporaryEffectsOnHit(wr, spell, targetPlayer);
            return;
        }
    }

    private static void ApplyRectangleMonsterSpellDamage(
        GameWorldRef wr,
        GameWorldMonster caster,
        int targetX,
        int targetY,
        int aoeRadius,
        AttackType attackType,
        int damage,
        SpellConfig spell) {
        // Friendly sentries (city/farm guards) never damage players (anti-AFK splash from LB).
        if (caster.Allegiance != MonsterAllegiance.Friendly) {
            foreach (var targetPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(targetX, targetY, excludeDisconnected: false)) {
                if (!IsWithinSpellDamageArea(targetPlayer.PosX, targetPlayer.PosY, targetX, targetY, aoeRadius)) {
                    continue;
                }

                Combat.ApplyMonsterSpellDamageToPlayer(wr, caster, targetPlayer, damage, attackType);
                TemporaryEffects.ApplySpellTemporaryEffectsOnHit(wr, spell, targetPlayer);
            }
        }

        foreach (var targetMonster in wr.MonsterSpatialGrid.GetNearbyMonsters(targetX, targetY)) {
            if (targetMonster.MonsterId == caster.MonsterId) {
                continue;
            }
            if (!IsWithinSpellDamageArea(targetMonster.PosX, targetMonster.PosY, targetX, targetY, aoeRadius)) {
                continue;
            }

            Combat.ApplyMonsterSpellDamageToMonster(wr, caster, targetMonster, damage, attackType);
            TemporaryEffects.ApplySpellTemporaryEffectsOnHit(wr, spell, targetMonster);
        }
    }

    private static bool TryCollectConeSpellDamageTargetsMonster(
        GameWorldRef wr,
        GameWorldMonster caster,
        int targetX,
        int targetY,
        SpellConfig spell,
        out List<long> targetPlayerIds,
        out List<long> targetMonsterIds) {
        targetPlayerIds = new List<long>();
        targetMonsterIds = new List<long>();
        if (!TryBuildConeSpellAffectedCells(wr, caster.PosX, caster.PosY, targetX, targetY, spell, out var minX, out var minY, out var maxX, out var maxY)) {
            return false;
        }

        foreach (var targetPlayer in wr.PlayerSpatialGrid.GetPlayersInRectangle(minX, minY, maxX, maxY, excludeDisconnected: false)) {
            if (!wr.SpellAffectedCellsScratch.Contains((targetPlayer.PosX, targetPlayer.PosY))) {
                continue;
            }

            targetPlayerIds.Add(targetPlayer.PlayerId);
        }

        foreach (var targetMonster in wr.MonsterSpatialGrid.GetMonstersInRectangle(minX, minY, maxX, maxY)) {
            if (targetMonster.MonsterId == caster.MonsterId) {
                continue;
            }
            if (!wr.SpellAffectedCellsScratch.Contains((targetMonster.PosX, targetMonster.PosY))) {
                continue;
            }

            targetMonsterIds.Add(targetMonster.MonsterId);
        }

        return true;
    }

    private static bool TryCollectLinearAoeSpellDamageTargetsMonster(
        GameWorldRef wr,
        GameWorldMonster caster,
        int targetX,
        int targetY,
        SpellConfig spell,
        out List<long> targetPlayerIds,
        out List<long> targetMonsterIds) {
        targetPlayerIds = new List<long>();
        targetMonsterIds = new List<long>();
        if (!TryBuildLinearAoeAffectedCells(wr, caster.PosX, caster.PosY, targetX, targetY, spell, out var minX, out var minY, out var maxX, out var maxY)) {
            return false;
        }

        foreach (var targetPlayer in wr.PlayerSpatialGrid.GetPlayersInRectangle(minX, minY, maxX, maxY, excludeDisconnected: false)) {
            if (!wr.SpellAffectedCellsScratch.Contains((targetPlayer.PosX, targetPlayer.PosY))) {
                continue;
            }

            targetPlayerIds.Add(targetPlayer.PlayerId);
        }

        foreach (var targetMonster in wr.MonsterSpatialGrid.GetMonstersInRectangle(minX, minY, maxX, maxY)) {
            if (targetMonster.MonsterId == caster.MonsterId) {
                continue;
            }
            if (!wr.SpellAffectedCellsScratch.Contains((targetMonster.PosX, targetMonster.PosY))) {
                continue;
            }

            targetMonsterIds.Add(targetMonster.MonsterId);
        }

        return true;
    }

    /// <summary>Olympia Possession: remote pickup of the top-most ground item on the target cell.</summary>
    private static void ResolvePossessionPickup(
        GameWorldRef wr,
        GameWorldPlayer player,
        int targetX,
        int targetY,
        SpellConfig spell) {
        var castMessage = NetworkManager.CreateCastDirectionalAoeSpell(
            player.PlayerId,
            spell.Id,
            player.PosX,
            player.PosY,
            targetX,
            targetY);
        NetworkManager.SendToPlayer(player, castMessage);
        foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId)) {
            NetworkManager.SendToPlayer(nearbyPlayer, castMessage);
        }

        GroundItemPickup.TryPickupTopItemAtCell(wr, player, targetX, targetY);

        var effectMessage = NetworkManager.CreateCastEffect(wr.WorldId, PossessionCastEffectKey, targetX, targetY);
        NetworkManager.SendToPlayer(player, effectMessage);
        foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId)) {
            NetworkManager.SendToPlayer(nearbyPlayer, effectMessage);
        }
    }
}
