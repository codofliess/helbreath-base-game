/**
 * Local MVP for pre-saved tournament draft builds (brackets 160 / 90).
 * Up to 2 builds per bracket; the Arena SELECTCHAR desk maps all 4 slots:
 * desk 0–1 = Lv 160 A/B, desk 2–3 = Lv 90 A/B.
 * Persists JSON in localStorage only — no server lock / point-buy yet.
 * @see docs/TOURNAMENT-BUILD-CREDITS.md
 */

export type TournamentBracketId = 'tier-90' | 'tier-160';

/** Slot index within a bracket (build A / B). */
export type TournamentBuildSlot = 0 | 1;

/** Classic desk index 0–3 spanning both brackets (2 kits × 2 levels). */
export type ArenaDeskIndex = 0 | 1 | 2 | 3;

export interface SavedTournamentBuild {
    id: string;
    name: string;
    bracket: TournamentBracketId;
    /** Which of the 2 slots this build occupies inside its bracket. */
    slot: TournamentBuildSlot;
    /** Item IDs stub for a future draft lock. */
    itemIds: number[];
    /** Placeholder credit spend; not validated against a real budget yet. */
    creditSpendStub: number;
    updatedAt: number;
}

/** Legacy key (brackets 60/120/160 × 3 kits). Migrated once into STORAGE_KEY. */
const LEGACY_STORAGE_KEY = 'olympia.tournamentBuilds.v1';
const STORAGE_KEY = 'helbreath.tournamentBuilds.v2';
const PREFERRED_SLOT_KEY = `${STORAGE_KEY}.preferredSlots`;
const LEGACY_PREFERRED_SLOT_KEY = `${LEGACY_STORAGE_KEY}.preferredSlots`;

export const MAX_BUILDS_PER_BRACKET = 2;

export const TOURNAMENT_BRACKETS: ReadonlyArray<{
    id: TournamentBracketId;
    label: string;
    /** Display level shown on Arena desk slots. */
    level: 90 | 160;
}> = [
    { id: 'tier-160', label: 'Tier 160', level: 160 },
    { id: 'tier-90', label: 'Tier 90', level: 90 },
];

/** Maps a classic desk index to bracket + kit slot. */
export function arenaDeskToBuild(desk: ArenaDeskIndex): {
    bracket: TournamentBracketId;
    slot: TournamentBuildSlot;
    level: 90 | 160;
    kitLabel: 'A' | 'B';
} {
    if (desk <= 1) {
        return {
            bracket: 'tier-160',
            slot: desk as TournamentBuildSlot,
            level: 160,
            kitLabel: desk === 0 ? 'A' : 'B',
        };
    }
    return {
        bracket: 'tier-90',
        slot: (desk - 2) as TournamentBuildSlot,
        level: 90,
        kitLabel: desk === 2 ? 'A' : 'B',
    };
}

/** Inverse of {@link arenaDeskToBuild}. */
export function buildToArenaDesk(bracket: TournamentBracketId, slot: TournamentBuildSlot): ArenaDeskIndex {
    if (bracket === 'tier-160') {
        return slot;
    }
    return (2 + slot) as ArenaDeskIndex;
}

function isBracketId(value: unknown): value is TournamentBracketId {
    return value === 'tier-90' || value === 'tier-160';
}

function isBuildSlot(value: unknown): value is TournamentBuildSlot {
    return value === 0 || value === 1;
}

function isArenaDeskIndex(value: unknown): value is ArenaDeskIndex {
    return value === 0 || value === 1 || value === 2 || value === 3;
}

/** Maps legacy v1 bracket ids onto the 160/90 product set. */
function migrateLegacyBracket(raw: unknown): TournamentBracketId | undefined {
    if (raw === 'tier-160') {
        return 'tier-160';
    }
    // Dropped mid tiers: keep early kits as 90; discard 120 unless no 60 exists (handled in migrate).
    if (raw === 'tier-60' || raw === 'tier-90') {
        return 'tier-90';
    }
    if (raw === 'tier-120') {
        return 'tier-90';
    }
    return undefined;
}

function parseBuild(raw: unknown, allowLegacyBracket = false): SavedTournamentBuild | undefined {
    if (!raw || typeof raw !== 'object') {
        return undefined;
    }

    const row = raw as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.name !== 'string') {
        return undefined;
    }

    const bracket = allowLegacyBracket
        ? migrateLegacyBracket(row.bracket)
        : isBracketId(row.bracket)
          ? row.bracket
          : undefined;
    if (!bracket) {
        return undefined;
    }

    const itemIds = Array.isArray(row.itemIds)
        ? row.itemIds.filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
        : [];
    const creditSpendStub =
        typeof row.creditSpendStub === 'number' && Number.isFinite(row.creditSpendStub)
            ? Math.max(0, Math.floor(row.creditSpendStub))
            : 0;
    const updatedAt =
        typeof row.updatedAt === 'number' && Number.isFinite(row.updatedAt) ? row.updatedAt : Date.now();
    // Legacy had slots 0–2; clamp to 0–1 (slot 2 dropped).
    const rawSlot = typeof row.slot === 'number' && Number.isFinite(row.slot) ? Math.floor(row.slot) : 0;
    const slot: TournamentBuildSlot = rawSlot <= 0 ? 0 : 1;

    return {
        id: row.id,
        name: row.name.trim() || 'Untitled build',
        bracket,
        slot,
        itemIds,
        creditSpendStub,
        updatedAt,
    };
}

/**
 * Prefer tier-60→90 over tier-120→90 when both exist so early kits win the 90 band.
 * Drops excess builds past MAX_BUILDS_PER_BRACKET after slot normalize.
 */
function preferLegacyNinetySource(builds: SavedTournamentBuild[], legacyRaw: unknown[]): SavedTournamentBuild[] {
    const hadTierSixty = legacyRaw.some(
        (row) => row && typeof row === 'object' && (row as Record<string, unknown>).bracket === 'tier-60',
    );
    if (!hadTierSixty) {
        return builds;
    }
    // When both 60 and 120 migrated to 90, keep builds that came from 60 first by re-parsing with source tag.
    const fromSixty: SavedTournamentBuild[] = [];
    const fromOther: SavedTournamentBuild[] = [];
    for (const row of legacyRaw) {
        if (!row || typeof row !== 'object') {
            continue;
        }
        const bracketRaw = (row as Record<string, unknown>).bracket;
        const parsed = parseBuild(row, true);
        if (!parsed || parsed.bracket !== 'tier-90') {
            continue;
        }
        if (bracketRaw === 'tier-60') {
            fromSixty.push(parsed);
        } else if (bracketRaw === 'tier-120' || bracketRaw === 'tier-90') {
            fromOther.push(parsed);
        }
    }
    const mergedNinety = [...fromSixty, ...fromOther];
    const kept160 = builds.filter((b) => b.bracket === 'tier-160');
    return [...kept160, ...mergedNinety];
}

/** Assigns missing/duplicate slots so each bracket has at most one build per slot 0–1. */
function normalizeBracketSlots(builds: SavedTournamentBuild[]): SavedTournamentBuild[] {
    const byBracket = new Map<TournamentBracketId, SavedTournamentBuild[]>();
    for (const build of builds) {
        const list = byBracket.get(build.bracket) ?? [];
        list.push(build);
        byBracket.set(build.bracket, list);
    }

    const normalized: SavedTournamentBuild[] = [];
    for (const [, list] of byBracket) {
        const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
        const used = new Set<TournamentBuildSlot>();
        for (const build of sorted.slice(0, MAX_BUILDS_PER_BRACKET)) {
            let slot = build.slot;
            if (used.has(slot)) {
                const free = ([0, 1] as TournamentBuildSlot[]).find((s) => !used.has(s));
                if (free === undefined) {
                    continue;
                }
                slot = free;
            }
            used.add(slot);
            normalized.push(slot === build.slot ? build : { ...build, slot });
        }
    }

    return normalized.sort((a, b) => b.updatedAt - a.updatedAt);
}

function migrateLegacyBuilds(): SavedTournamentBuild[] {
    try {
        const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
            return [];
        }
        const migrated = parsed
            .map((row) => parseBuild(row, true))
            .filter((b): b is SavedTournamentBuild => b !== undefined);
        const preferred = preferLegacyNinetySource(migrated, parsed);
        return normalizeBracketSlots(preferred);
    } catch (error) {
        console.warn('[tournamentBuilds] Failed to migrate legacy builds.', error);
        return [];
    }
}

function migrateLegacyPreferredSlots(): PreferredSlotMap {
    try {
        const raw = localStorage.getItem(LEGACY_PREFERRED_SLOT_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const out: PreferredSlotMap = {};
        const mapKey = (legacyId: string, target: TournamentBracketId) => {
            const value = parsed[legacyId];
            if (typeof value === 'number' && Number.isFinite(value)) {
                out[target] = value <= 0 ? 0 : 1;
            }
        };
        mapKey('tier-160', 'tier-160');
        // Prefer 60 over 120 for the 90 band preferred slot.
        if (parsed['tier-60'] !== undefined) {
            mapKey('tier-60', 'tier-90');
        } else if (parsed['tier-90'] !== undefined) {
            mapKey('tier-90', 'tier-90');
        } else {
            mapKey('tier-120', 'tier-90');
        }
        return out;
    } catch {
        return {};
    }
}

/** Loads all saved tournament builds from localStorage (migrates v1 → v2 once). */
export function loadTournamentBuilds(): SavedTournamentBuild[] {
    if (typeof window === 'undefined') {
        return [];
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as unknown;
            if (!Array.isArray(parsed)) {
                return [];
            }
            const builds = parsed
                .map((row) => parseBuild(row, false))
                .filter((b): b is SavedTournamentBuild => b !== undefined);
            return normalizeBracketSlots(builds);
        }

        const migrated = migrateLegacyBuilds();
        if (migrated.length > 0) {
            persistBuilds(migrated);
            const preferred = migrateLegacyPreferredSlots();
            if (Object.keys(preferred).length > 0) {
                try {
                    localStorage.setItem(PREFERRED_SLOT_KEY, JSON.stringify(preferred));
                } catch {
                    /* ignore */
                }
            }
        }
        return migrated;
    } catch (error) {
        console.warn('[tournamentBuilds] Failed to load builds.', error);
        return [];
    }
}

function persistBuilds(builds: SavedTournamentBuild[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(builds));
}

/** Builds for one bracket, ordered by slot 0 → 1. */
export function getBuildsForBracket(
    builds: SavedTournamentBuild[],
    bracket: TournamentBracketId,
): SavedTournamentBuild[] {
    return builds
        .filter((b) => b.bracket === bracket)
        .sort((a, b) => a.slot - b.slot);
}

/** First free slot in a bracket, or undefined if both are taken. */
export function findFreeBuildSlot(
    builds: SavedTournamentBuild[],
    bracket: TournamentBracketId,
): TournamentBuildSlot | undefined {
    const used = new Set(getBuildsForBracket(builds, bracket).map((b) => b.slot));
    return ([0, 1] as TournamentBuildSlot[]).find((s) => !used.has(s));
}

export type PreferredSlotMap = Partial<Record<TournamentBracketId, TournamentBuildSlot>>;

/** Which kit (A/B) is the preferred build per bracket on the Arena desk. */
export function loadPreferredBuildSlots(): PreferredSlotMap {
    if (typeof window === 'undefined') {
        return {};
    }

    try {
        // Ensure v1→v2 migration ran (also migrates preferred slots).
        loadTournamentBuilds();
        const raw = localStorage.getItem(PREFERRED_SLOT_KEY);
        if (!raw) {
            return migrateLegacyPreferredSlots();
        }
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const out: PreferredSlotMap = {};
        for (const bracket of TOURNAMENT_BRACKETS) {
            const value = parsed[bracket.id];
            if (isBuildSlot(value)) {
                out[bracket.id] = value;
            } else if (typeof value === 'number' && Number.isFinite(value)) {
                out[bracket.id] = value <= 0 ? 0 : 1;
            }
        }
        return out;
    } catch (error) {
        console.warn('[tournamentBuilds] Failed to load preferred slots.', error);
        return {};
    }
}

export function setPreferredBuildSlot(bracket: TournamentBracketId, slot: TournamentBuildSlot): PreferredSlotMap {
    const next = { ...loadPreferredBuildSlots(), [bracket]: slot };
    try {
        localStorage.setItem(PREFERRED_SLOT_KEY, JSON.stringify(next));
    } catch (error) {
        console.warn('[tournamentBuilds] Failed to persist preferred slots.', error);
    }
    return next;
}

/** Preferred (or first) build for a bracket — drives Arena desk highlight. */
export function getPreferredBuildForBracket(
    builds: SavedTournamentBuild[],
    bracket: TournamentBracketId,
    preferredSlots?: PreferredSlotMap,
): SavedTournamentBuild | undefined {
    const list = getBuildsForBracket(builds, bracket);
    if (list.length === 0) {
        return undefined;
    }
    const preferred = preferredSlots?.[bracket];
    if (preferred !== undefined) {
        const match = list.find((b) => b.slot === preferred);
        if (match) {
            return match;
        }
    }
    return list[0];
}

/** Upserts a build by id (or fills a free slot) and returns the full list. */
export function saveTournamentBuild(
    input: Omit<SavedTournamentBuild, 'id' | 'updatedAt' | 'slot'> & {
        id?: string;
        slot?: TournamentBuildSlot;
    },
): { builds: SavedTournamentBuild[]; error?: string } {
    const builds = loadTournamentBuilds();
    const id = input.id?.trim() || `build_${Date.now().toString(36)}`;
    const existingIndex = builds.findIndex((b) => b.id === id);

    let slot = input.slot;
    if (existingIndex >= 0) {
        slot = input.slot ?? builds[existingIndex].slot;
    } else if (slot === undefined) {
        slot = findFreeBuildSlot(builds, input.bracket);
        if (slot === undefined) {
            return {
                builds,
                error: `Bracket ${input.bracket} already has ${MAX_BUILDS_PER_BRACKET} builds.`,
            };
        }
    } else {
        const clash = builds.find(
            (b) => b.bracket === input.bracket && b.slot === slot && b.id !== id,
        );
        if (clash) {
            return {
                builds,
                error: `Slot ${slot + 1} in ${input.bracket} is already used.`,
            };
        }
        const count = getBuildsForBracket(builds, input.bracket).length;
        if (count >= MAX_BUILDS_PER_BRACKET) {
            return {
                builds,
                error: `Bracket ${input.bracket} already has ${MAX_BUILDS_PER_BRACKET} builds.`,
            };
        }
    }

    const next: SavedTournamentBuild = {
        id,
        name: input.name.trim() || 'Untitled build',
        bracket: input.bracket,
        slot: slot as TournamentBuildSlot,
        itemIds: [...input.itemIds],
        creditSpendStub: Math.max(0, Math.floor(input.creditSpendStub)),
        updatedAt: Date.now(),
    };

    if (existingIndex >= 0) {
        builds[existingIndex] = next;
    } else {
        builds.unshift(next);
    }

    persistBuilds(normalizeBracketSlots(builds));
    return { builds: loadTournamentBuilds() };
}

/** Renames a build in place (stub for Arena desk edit). */
export function renameTournamentBuild(id: string, name: string): SavedTournamentBuild[] {
    const trimmed = name.trim();
    if (!trimmed) {
        return loadTournamentBuilds();
    }

    const builds = loadTournamentBuilds();
    const index = builds.findIndex((b) => b.id === id);
    if (index < 0) {
        return builds;
    }

    builds[index] = { ...builds[index], name: trimmed, updatedAt: Date.now() };
    persistBuilds(builds);
    return loadTournamentBuilds();
}

/** Removes a build by id and returns the remaining list. */
export function deleteTournamentBuild(id: string): SavedTournamentBuild[] {
    const builds = loadTournamentBuilds().filter((b) => b.id !== id);
    persistBuilds(builds);
    return builds;
}

/**
 * Stub “Load build”: returns the build JSON and stores it as the last-loaded draft
 * so a future arena enter can read it without re-picking.
 */
export function loadTournamentBuildStub(id: string): SavedTournamentBuild | undefined {
    const build = loadTournamentBuilds().find((b) => b.id === id);
    if (!build) {
        return undefined;
    }

    try {
        localStorage.setItem(`${STORAGE_KEY}.lastLoaded`, JSON.stringify(build));
        setPreferredBuildSlot(build.bracket, build.slot);
    } catch (error) {
        console.warn('[tournamentBuilds] Failed to persist last-loaded stub.', error);
    }

    return build;
}

/** Returns the last build selected via Load build stub, if any. */
export function getLastLoadedTournamentBuild(): SavedTournamentBuild | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }

    try {
        const raw = localStorage.getItem(`${STORAGE_KEY}.lastLoaded`);
        if (!raw) {
            // Fall back to legacy last-loaded once.
            const legacy = localStorage.getItem(`${LEGACY_STORAGE_KEY}.lastLoaded`);
            if (!legacy) {
                return undefined;
            }
            return parseBuild(JSON.parse(legacy) as unknown, true);
        }
        return parseBuild(JSON.parse(raw) as unknown, false);
    } catch {
        return undefined;
    }
}

/** Resolves which Arena desk index should start selected from preferred slots. */
export function resolvePreferredArenaDesk(
    builds: SavedTournamentBuild[],
    preferredSlots?: PreferredSlotMap,
): ArenaDeskIndex {
    const preferred160 = getPreferredBuildForBracket(builds, 'tier-160', preferredSlots);
    if (preferred160) {
        return buildToArenaDesk(preferred160.bracket, preferred160.slot);
    }
    const preferred90 = getPreferredBuildForBracket(builds, 'tier-90', preferredSlots);
    if (preferred90) {
        return buildToArenaDesk(preferred90.bracket, preferred90.slot);
    }
    return 0;
}

export function clampArenaDeskIndex(value: number): ArenaDeskIndex {
    if (isArenaDeskIndex(value)) {
        return value;
    }
    return 0;
}
