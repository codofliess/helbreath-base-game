using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using Server;
using Server.Helpers;
using Server.Utils;
using Server.World.Game;
using Xunit;

[assembly: CollectionBehavior(DisableTestParallelization = true)]

namespace Server.Tests;

/// <summary>
/// Ground-effect ticks use one Olympia magic roll per cell, then min(fullRoll, cap).
/// Energy Strike and Mass Fire Strike stay on the uncapped roll.
/// </summary>
public sealed class GroundEffectDamageCapTests {
    const int Mag = 147;
    const int Cap = 80;
    /// <summary>Flat AddMagicalDamage that makes a Mag-147 Fire Field (2d8) average exactly 250.</summary>
    const int HugeAddMagicalDamage = 237;
    const int LowAddMagicalDamage = 4;

    /// <summary>Mag-147 scale of a 2d8 total, index = dice sum. round(dice * (1 + 147/3.3/100)).</summary>
    static readonly int[] FireFieldScaledByDiceSum = [
        0, 0, 3, 4, 6, 7, 9, 10, 12, 13, 14, 16, 17, 19, 20, 22, 23,
    ];

    [Fact]
    public void FireField_Mag147Plain_AverageIs13_AndCapIsNotHit() {
        var fire = LoadSpell(8);
        Assert.Equal(2, fire.DamageDiceCount);
        Assert.Equal(8, fire.DamageDiceSides);
        Assert.Equal(0, fire.DamageDiceBonus);
        Assert.Equal((int)DamageType.GroundEffect, fire.DamageType);

        var caster = CreateCaster(addMagicalDamage: 0);
        Assert.Equal(0, ItemMagicAttribute.ComputeEquippedBonuses(caster).AddMagicalDamage);

        long tickSum = 0;
        var outcomes = 0;
        for (var a = 1; a <= 8; a++) {
            for (var b = 1; b <= 8; b++) {
                var dice = new SequenceRandom(a, b);
                var full = PlayerDerivedStats.RollMagicDamage(caster, fire, dice);
                Assert.Equal(2, dice.Consumed);
                var placed = new SequenceRandom(a, b);
                var tick = PlaceSingleCellTick(caster, fire, Cap, placed);
                Assert.Equal(2, placed.Consumed);
                var expected = FireFieldScaledByDiceSum[a + b];
                Assert.Equal(expected, full);
                Assert.Equal(full, tick);
                Assert.True(tick < Cap);
                tickSum += tick;
                outcomes++;
            }
        }

        Assert.Equal(64, outcomes);
        Assert.Equal(832, tickSum);
        Assert.Equal(13d, tickSum / (double)outcomes);
    }

    [Fact]
    public void FireField_Mag147HugeAddMagicalDamage_TickIsExactlyTheCap() {
        var fire = LoadSpell(8);
        var caster = CreateCaster(HugeAddMagicalDamage);
        Assert.Equal(HugeAddMagicalDamage, ItemMagicAttribute.ComputeEquippedBonuses(caster).AddMagicalDamage);
        Assert.Equal(0, HeroSetBonus.ExtraMagicDamage(caster));
        Assert.False(PlayerDerivedStats.HasBerserkWandEquipped(caster));
        Assert.Equal(0, PlayerDerivedStats.KlonessMagicalBonus(caster, targetPlayer: null));

        long fullSum = 0;
        var outcomes = 0;
        for (var a = 1; a <= 8; a++) {
            for (var b = 1; b <= 8; b++) {
                var full = PlayerDerivedStats.RollMagicDamage(caster, fire, new SequenceRandom(a, b));
                var tick = PlaceSingleCellTick(caster, fire, Cap, new SequenceRandom(a, b));
                var expectedFull = FireFieldScaledByDiceSum[a + b] + HugeAddMagicalDamage;
                Assert.Equal(expectedFull, full);
                Assert.True(full > Cap);
                Assert.Equal(Cap, tick);
                fullSum += full;
                outcomes++;
            }
        }

        Assert.Equal(64, outcomes);
        Assert.Equal(16000, fullSum);
        Assert.Equal(250d, fullSum / (double)outcomes);
    }

    [Fact]
    public void FireField_RollsOncePerCell() {
        var fire = LoadSpell(8);
        Assert.Equal(1, fire.AoeRadius);
        var caster = CreateCaster(addMagicalDamage: 0);
        // Nine cells, two faces each. Sums 2,3,4,5,6,7,8,9,16 in row-major order.
        var faces = new[] {
            1, 1, 1, 2, 1, 3, 1, 4, 1, 5, 1, 6, 1, 7, 1, 8, 8, 8,
        };
        var dice = new SequenceRandom(faces);
        var ticks = PlaceField(caster, fire, targetX: 8, targetY: 8, Cap, dice);
        Assert.Equal(18, dice.Consumed);
        Assert.Equal(9, ticks.Length);
        var expected = new[] { 3, 4, 6, 7, 9, 10, 12, 13, 23 };
        Assert.Equal(expected, ticks);
        Assert.NotEqual(ticks[0], ticks[^1]);
    }

    [Fact]
    public void EnergyStrike_AndMassFireStrike_MatchUncappedRoll_ForLowAndHugeAddMagicalDamage() {
        var energy = LoadSpell(11);
        var mass = LoadSpell(12);
        Assert.Equal((int)DamageType.RectangleAoe, energy.DamageType);
        Assert.Equal((int)DamageType.RectangleAoe, mass.DamageType);
        Assert.NotEqual((int)DamageType.GroundEffect, energy.DamageType);
        Assert.NotEqual((int)DamageType.GroundEffect, mass.DamageType);
        Assert.Equal(7, energy.DamageDiceCount);
        Assert.Equal(6, energy.DamageDiceSides);
        Assert.Equal(17, energy.DamageDiceBonus);
        Assert.Equal(7, mass.DamageDiceCount);
        Assert.Equal(10, mass.DamageDiceSides);
        Assert.Equal(18, mass.DamageDiceBonus);

        var plain = CreateCaster(addMagicalDamage: 0);
        var low = CreateCaster(LowAddMagicalDamage);
        var huge = CreateCaster(HugeAddMagicalDamage);

        AssertDistribution(energy, plain, add: 0, expectedWeightedSum: 16_780_893L, expectedOutcomes: 279_936);
        AssertDistribution(energy, low, add: LowAddMagicalDamage, expectedWeightedSum: 16_780_893L + (long)LowAddMagicalDamage * 279_936, expectedOutcomes: 279_936);
        AssertDistribution(energy, huge, add: HugeAddMagicalDamage, expectedWeightedSum: 83_125_725L, expectedOutcomes: 279_936);

        AssertDistribution(mass, plain, add: 0, expectedWeightedSum: 816_994_245L, expectedOutcomes: 10_000_000);
        AssertDistribution(mass, low, add: LowAddMagicalDamage, expectedWeightedSum: 816_994_245L + (long)LowAddMagicalDamage * 10_000_000, expectedOutcomes: 10_000_000);
        AssertDistribution(mass, huge, add: HugeAddMagicalDamage, expectedWeightedSum: 3_186_994_245L, expectedOutcomes: 10_000_000);

        // Anchors above the ground cap must stay on the direct-spell roll.
        Assert.Equal(85, RollFaceSum(energy, plain, faceSum: 42));
        Assert.Equal(89, RollFaceSum(energy, low, faceSum: 42));
        Assert.Equal(85 + HugeAddMagicalDamage, RollFaceSum(energy, huge, faceSum: 42));
        Assert.Equal(127, RollFaceSum(mass, plain, faceSum: 70));
        Assert.Equal(131, RollFaceSum(mass, low, faceSum: 70));
        Assert.Equal(127 + HugeAddMagicalDamage, RollFaceSum(mass, huge, faceSum: 70));
        Assert.True(85 > Cap);
        Assert.True(127 > Cap);
    }

    static void AssertDistribution(SpellConfig spell, GameWorldPlayer caster, int add, long expectedWeightedSum, int expectedOutcomes) {
        var count = spell.DamageDiceCount!.Value;
        var sides = spell.DamageDiceSides!.Value;
        var bonus = spell.DamageDiceBonus ?? 0;
        var ways = DiceWays(count, sides);
        long weightedSum = 0;
        var outcomes = 0;
        var aboveCap = 0;
        for (var faceSum = count; faceSum <= count * sides; faceSum++) {
            var weight = ways[faceSum];
            if (weight == 0) {
                continue;
            }

            var rolled = RollFaceSum(spell, caster, faceSum);
            var expected = UncappedMagicDamage(faceSum + bonus, Mag, add);
            Assert.Equal(expected, rolled);
            if (rolled > Cap) {
                aboveCap += weight;
                Assert.NotEqual(Cap, rolled);
            }

            weightedSum += (long)rolled * weight;
            outcomes += weight;
        }

        Assert.Equal(expectedOutcomes, outcomes);
        Assert.Equal(expectedWeightedSum, weightedSum);
        Assert.True(aboveCap > 0);
    }

    static int RollFaceSum(SpellConfig spell, GameWorldPlayer caster, int faceSum) {
        var count = spell.DamageDiceCount!.Value;
        var sides = spell.DamageDiceSides!.Value;
        var faces = FacesForSum(count, sides, faceSum);
        var dice = new SequenceRandom(faces);
        var rolled = PlayerDerivedStats.RollMagicDamage(caster, spell, dice);
        Assert.Equal(count, dice.Consumed);
        return rolled;
    }

    /// <summary>
    /// Same positive-path formula as <see cref="PlayerDerivedStats.RollMagicDamage"/> with no hero set,
    /// Berserk Wand, spell multiplier, or Kloness. Ground ticks then take min(this, cap); direct spells do not.
    /// </summary>
    static int UncappedMagicDamage(int diceTotal, int mag, int addMagicalDamage) {
        var magPct = mag / 3.3;
        var scaled = diceTotal + diceTotal * (magPct / 100.0);
        var damage = (int)(scaled + 0.5);
        damage += addMagicalDamage;
        return Math.Max(1, damage);
    }

    static int PlaceSingleCellTick(GameWorldPlayer caster, SpellConfig spell, int cap, Random dice) {
        var single = spell with { AoeRadius = 0 };
        var ticks = PlaceField(caster, single, targetX: 8, targetY: 8, cap, dice);
        Assert.Single(ticks);
        return ticks[0];
    }

    static int[] PlaceField(GameWorldPlayer caster, SpellConfig spell, int targetX, int targetY, int cap, Random dice) {
        var wr = CreateWorld(cap);
        Casting.ApplyGroundEffectSpell(wr, caster, targetX, targetY, spell, dice);
        var radius = Math.Max(0, spell.AoeRadius ?? 0);
        var ticks = new List<int>();
        for (var y = targetY - radius; y <= targetY + radius; y++) {
            for (var x = targetX - radius; x <= targetX + radius; x++) {
                if (Location.GetDistance(x, y, targetX, targetY) > radius) {
                    continue;
                }

                Assert.True(wr.GroundStateTracker.TryGetEffectsAtCell(x, y, out var effects));
                var effect = Assert.Single(effects!);
                ticks.Add(effect.DamagePerTick);
            }
        }

        return ticks.ToArray();
    }

    static GameWorldRef CreateWorld(int cap) {
        var occupancy = new GameWorldOccupancyTracker(16, 16, Array.Empty<(int X, int Y)>());
        var scheduler = new Scheduler();
        var tracker = new GroundStateTracker(
            occupancy.SizeX,
            occupancy.SizeY,
            viewRadiusX: 4,
            viewRadiusY: 4,
            maxDroppedItemsInStack: 10,
            scheduler,
            onTickDue: _ => { },
            onExpired: _ => { });
        return new GameWorldRef {
            OccupancyTracker = occupancy,
            Settings = LoadedSettings.Value with { GroundEffectMaxDamagePerTick = cap },
            GroundStateTracker = tracker,
            PlayerSpatialGrid = new PlayersSpatialGrid(4, 4),
            GroundEffectsViewersScratch = new Dictionary<long, GameWorldPlayer>(),
            GroundEffectsEnteredScratch = new List<GroundEffectState>(),
        };
    }

    static GameWorldPlayer CreateCaster(int addMagicalDamage) {
        var items = new Dictionary<int, ItemConfig>();
        // Distinct catalog ids so casters with different flat bonuses can be rolled in one test.
        var itemId = 990_000 + addMagicalDamage;
        if (addMagicalDamage > 0) {
            items[itemId] = new ItemConfig(itemId, "Synthetic Magical Necklace", "necklace");
            InstallAddMagicalDamage(itemId, addMagicalDamage);
        }

        var violation = new MovementSpeedViolationCheckConfig(
            Verbose: false,
            Limit: 20,
            Window: 20,
            SegmentsPerWindow: 20,
            ParalysisDuration: 0,
            MaxPingVariance: 0);
        var player = new GameWorldPlayer(
            Guid.NewGuid(),
            sendMessage: _ => { },
            requestDisconnect: _ => { },
            requestWorldChange: _ => { },
            interruptLogoutDueToCombat: () => { },
            items,
            violation,
            pingVarianceSampleSize: 4,
            antiHackTimingLagFactor: 0);
        Assert.True(player.TryApplyStatRespec(10, 10, 10, 10, Mag, 10));
        Assert.Equal(Mag, PlayerDerivedStats.EffectiveMag(player));
        if (addMagicalDamage > 0) {
            player.InventoryManager.LoadFromPersistence(
                persistedBagItems: null,
                persistedEquippedItems: [
                    new PersistedEquippedInventoryItem(
                        "necklace",
                        new PersistedEquippedItem(itemId, ItemUid: 1, BagX: null, BagY: null, EffectOverrides: null)),
                ]);
        }

        Assert.Equal(addMagicalDamage, ItemMagicAttribute.ComputeEquippedBonuses(player).AddMagicalDamage);
        Assert.Equal(0, HeroSetBonus.ExtraMagicDamage(player));
        Assert.False(PlayerDerivedStats.HasBerserkWandEquipped(player));
        Assert.Equal(0, PlayerDerivedStats.KlonessMagicalBonus(player, targetPlayer: null));
        return player;
    }

    static void InstallAddMagicalDamage(int itemId, int amount) {
        ItemAddEffectCatalog.EnsureLoaded();
        var field = typeof(ItemAddEffectCatalog).GetField("ByItemId", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(field);
        var dict = Assert.IsAssignableFrom<Dictionary<int, ItemAddEffectCatalog.AddEffect>>(field.GetValue(null));
        dict[itemId] = new ItemAddEffectCatalog.AddEffect(ItemAddEffectCatalog.SubMagicalDamage, amount);
    }

    static SpellConfig LoadSpell(int id) {
        var path = Path.Combine(ServerDirectory, "Config", "Spells.json");
        var spells = JsonSerializer.Deserialize<SpellConfig[]>(
            File.ReadAllText(path),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        Assert.NotNull(spells);
        return Assert.Single(spells, spell => spell.Id == id);
    }

    static int[] FacesForSum(int count, int sides, int faceSum) {
        if (faceSum < count || faceSum > count * sides) {
            throw new ArgumentOutOfRangeException(nameof(faceSum));
        }

        var faces = new int[count];
        var remaining = faceSum;
        for (var i = 0; i < count; i++) {
            var rest = count - i - 1;
            var face = Math.Max(1, remaining - sides * rest);
            face = Math.Min(sides, face);
            faces[i] = face;
            remaining -= face;
        }

        if (remaining != 0) {
            throw new InvalidOperationException($"Could not split {faceSum} across {count}d{sides}.");
        }

        return faces;
    }

    static int[] DiceWays(int count, int sides) {
        var ways = new int[count * sides + 1];
        ways[0] = 1;
        for (var die = 0; die < count; die++) {
            var next = new int[ways.Length];
            for (var sum = 0; sum < ways.Length; sum++) {
                var weight = ways[sum];
                if (weight == 0) {
                    continue;
                }

                for (var face = 1; face <= sides; face++) {
                    next[sum + face] += weight;
                }
            }

            ways = next;
        }

        return ways;
    }

    static readonly Lazy<SettingsConfig> LoadedSettings = new(() => {
        var previous = Directory.GetCurrentDirectory();
        try {
            Directory.SetCurrentDirectory(FindServerDirectory());
            return Config.LoadSettings().GetAwaiter().GetResult();
        } finally {
            Directory.SetCurrentDirectory(previous);
        }
    });

    static string ServerDirectory { get; } = FindServerDirectory();

    static string FindServerDirectory() {
        var roots = new[] { AppContext.BaseDirectory, Directory.GetCurrentDirectory() };
        foreach (var root in roots) {
            var dir = new DirectoryInfo(root);
            for (var i = 0; i < 8 && dir is not null; i++) {
                if (IsServerProject(dir.FullName)) {
                    return dir.FullName;
                }

                var sibling = Path.Combine(dir.FullName, "server");
                if (IsServerProject(sibling)) {
                    return sibling;
                }

                dir = dir.Parent;
            }
        }

        throw new InvalidOperationException("Could not locate multiplayer/server.");
    }

    static bool IsServerProject(string path) =>
        File.Exists(Path.Combine(path, "Server.csproj")) &&
        File.Exists(Path.Combine(path, "Config", "Settings.json")) &&
        File.Exists(Path.Combine(path, "Config", "Spells.json"));

    sealed class SequenceRandom : Random {
        readonly int[] values;
        int index;

        public SequenceRandom(params int[] values) {
            this.values = values;
        }

        public int Consumed => index;

        public override int Next(int minValue, int maxValue) {
            if (index >= values.Length) {
                throw new InvalidOperationException("Scripted dice exhausted.");
            }

            var face = values[index++];
            if (face < minValue || face >= maxValue) {
                throw new InvalidOperationException($"Scripted face {face} is outside [{minValue}, {maxValue}).");
            }

            return face;
        }

        public override int Next() =>
            throw new InvalidOperationException("Dice must use Next(min, max).");
    }
}

/// <summary>Settings load rejects an invalid ground-effect cap and keeps the default when the key is omitted.</summary>
public sealed class GroundEffectCapSettingsTests {
    [Fact]
    public async Task OmittedCap_DefaultsTo80_AndFactorIsGone() {
        Assert.Null(typeof(SettingsConfig).GetProperty("GroundEffectDamageFactor"));
        var settingsPath = Path.Combine(GroundEffectDamageCapTests_ServerDir(), "Config", "Settings.json");
        var text = await File.ReadAllTextAsync(settingsPath);
        Assert.DoesNotContain("groundEffectDamageFactor", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("groundEffectMaxDamagePerTick", text, StringComparison.OrdinalIgnoreCase);

        var previous = Directory.GetCurrentDirectory();
        try {
            Directory.SetCurrentDirectory(GroundEffectDamageCapTests_ServerDir());
            var settings = await Config.LoadSettings();
            Assert.Equal(80, settings.GroundEffectMaxDamagePerTick);
        } finally {
            Directory.SetCurrentDirectory(previous);
        }
    }

    [Theory]
    [InlineData(1)]
    [InlineData(80)]
    [InlineData(81)]
    [InlineData(int.MaxValue)]
    public async Task ExplicitCap_BindsAndLoads(int cap) {
        var settings = await LoadWithCap(JsonValue.Create(cap));
        Assert.Equal(cap, settings.GroundEffectMaxDamagePerTick);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task InvalidIntegerCap_FailsValidation(int cap) {
        var ex = await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => LoadWithCap(JsonValue.Create(cap)));
        Assert.Equal(nameof(SettingsConfig.GroundEffectMaxDamagePerTick), ex.ParamName);
        Assert.Contains("at least 1", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task FractionalCap_FailsClosed() {
        await Assert.ThrowsAsync<JsonException>(() => LoadWithCap(JsonValue.Create(1.5)));
    }

    static async Task<SettingsConfig> LoadWithCap(JsonNode? cap) {
        var serverDir = GroundEffectDamageCapTests_ServerDir();
        var node = JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(serverDir, "Config", "Settings.json")))!.AsObject();
        node["groundEffectMaxDamagePerTick"] = cap;
        var temp = Directory.CreateTempSubdirectory("ground-effect-cap-");
        var previous = Directory.GetCurrentDirectory();
        try {
            var configDir = Path.Combine(temp.FullName, "Config");
            Directory.CreateDirectory(configDir);
            await File.WriteAllTextAsync(Path.Combine(configDir, "Settings.json"), node.ToJsonString());
            Directory.SetCurrentDirectory(temp.FullName);
            return await Config.LoadSettings();
        } finally {
            Directory.SetCurrentDirectory(previous);
            temp.Delete(recursive: true);
        }
    }

    static string GroundEffectDamageCapTests_ServerDir() {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        for (var i = 0; i < 8 && dir is not null; i++) {
            var sibling = Path.Combine(dir.FullName, "server");
            if (File.Exists(Path.Combine(sibling, "Server.csproj"))) {
                return sibling;
            }

            if (File.Exists(Path.Combine(dir.FullName, "Server.csproj"))) {
                return dir.FullName;
            }

            dir = dir.Parent;
        }

        throw new InvalidOperationException("Could not locate multiplayer/server.");
    }
}
