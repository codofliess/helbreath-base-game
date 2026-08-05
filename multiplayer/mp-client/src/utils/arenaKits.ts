/**
 * Arena Pre-Ready fighter kits (4 slots per wallet).
 * localStorage v1; server dual-write later.
 */

import {
    ARENA_CATALOG,
    ARENA_HERO_SET_PREVIEW,
    ARENA_POTION_POOL,
    ARENA_PVP_SKILL_IDS,
    ARENA_SKILLS_100,
    ARENA_SKILLS_50,
    ARENA_STARTER_CREDITS,
    ARENA_STAT_MIN,
    ARENA_STAT_TOTAL,
    computeCatalogSpend,
    getArenaCatalogSku,
    type ArenaMageFreeSpell,
    type ArenaPath,
} from '../constants/ArenaKitCatalog';
import { getItemById } from '../constants/Items';
import { OLYMPIA_SKILLS } from '../constants/OlympiaSkills';
import { getStoredWalletPubkey } from './walletAuth';

export type ArenaSlotIndex = 0 | 1 | 2 | 3;

export interface ArenaKitStats {
    str: number;
    vit: number;
    dex: number;
    int: number;
    mag: number;
    chr: number;
}

export interface ArenaPotionPick {
    red: number;
    blue: number;
    greenCandy: number;
}

export interface ArenaCatalogPurchase {
    sku: string;
    qty: number;
}

export interface ArenaKit {
    id: string;
    slotIndex: ArenaSlotIndex;
    name: string;
    path: ArenaPath;
    gender: 'male' | 'female';
    hairStyleIndex: number;
    underwearColorIndex: number;
    skinColor: number;
    stats: ArenaKitStats;
    skills100: number[];
    skills50: number[];
    freeMageSpell?: ArenaMageFreeSpell;
    potions: ArenaPotionPick;
    catalogPurchases: ArenaCatalogPurchase[];
    completed: boolean;
    updatedAt: number;
}

const STORAGE_KEY = 'helbreath.arenaKits.v1';

function storageKeyForWallet(wallet?: string | null): string {
    const w = (wallet ?? getStoredWalletPubkey() ?? 'guest').trim() || 'guest';
    return `${STORAGE_KEY}:${w}`;
}

export function emptyStats(): ArenaKitStats {
    return { str: ARENA_STAT_MIN, vit: ARENA_STAT_MIN, dex: ARENA_STAT_MIN, int: ARENA_STAT_MIN, mag: ARENA_STAT_MIN, chr: ARENA_STAT_MIN };
}

export function statsSum(s: ArenaKitStats): number {
    return s.str + s.vit + s.dex + s.int + s.mag + s.chr;
}

export function remainingStatPoints(s: ArenaKitStats): number {
    return ARENA_STAT_TOTAL - statsSum(s);
}

export function defaultPotionPick(): ArenaPotionPick {
    return { red: 10, blue: 15, greenCandy: 5 };
}

export function potionSum(p: ArenaPotionPick): number {
    return p.red + p.blue + p.greenCandy;
}

export function createBlankArenaKit(slotIndex: ArenaSlotIndex, name = ''): ArenaKit {
    return {
        id: `kit-${slotIndex}-${Date.now().toString(36)}`,
        slotIndex,
        name: name.trim() || `Fighter ${slotIndex + 1}`,
        path: 'mage',
        gender: 'male',
        hairStyleIndex: 0,
        underwearColorIndex: 0,
        skinColor: 0,
        stats: emptyStats(),
        skills100: [],
        skills50: [],
        freeMageSpell: 'blizzard',
        potions: defaultPotionPick(),
        catalogPurchases: [],
        completed: false,
        updatedAt: Date.now(),
    };
}

export function getPvpSkills() {
    return OLYMPIA_SKILLS.filter((s) => (ARENA_PVP_SKILL_IDS as readonly number[]).includes(s.id));
}

/**
 * Hard errors block Create PVP Duel.
 * Soft warnings (skills incomplete / unknown) never block start.
 */
export function validateArenaKit(kit: ArenaKit): string[] {
    const errors: string[] = [];
    if (!kit.name.trim() || kit.name.trim().length < 2) {
        errors.push('Name must be at least 2 characters.');
    }
    if (kit.name.trim().length > 10) {
        errors.push('Name max 10 characters.');
    }
    const sum = statsSum(kit.stats);
    if (sum !== ARENA_STAT_TOTAL) {
        errors.push(`Stats must total ${ARENA_STAT_TOTAL} (now ${sum}, ${ARENA_STAT_TOTAL - sum} left).`);
    }
    for (const [k, v] of Object.entries(kit.stats) as [keyof ArenaKitStats, number][]) {
        if (v < ARENA_STAT_MIN) {
            errors.push(`${k.toUpperCase()} min ${ARENA_STAT_MIN}.`);
        }
    }
    // Skills are optional picks — incomplete slots do NOT block PVP start.
    if (potionSum(kit.potions) !== ARENA_POTION_POOL) {
        errors.push(`Potions must total ${ARENA_POTION_POOL} (now ${potionSum(kit.potions)}).`);
    }
    if (kit.path === 'mage' && !kit.freeMageSpell) {
        errors.push('Mages must pick free spell: Blizzard or ESW.');
    }
    // Drop removed SKUs (e.g. set-hp50-war) before spend/unknown checks — they are free bag now.
    const purchases = sanitizeCatalogPurchases(kit.catalogPurchases);
    const spend = computeCatalogSpend(purchases);
    if (spend > ARENA_STARTER_CREDITS) {
        errors.push(`Catalog over budget: ${spend} / ${ARENA_STARTER_CREDITS} credits.`);
    }
    for (const p of purchases) {
        if (p.qty < 1) {
            errors.push(`Invalid qty for ${p.sku}`);
        }
    }
    return errors;
}

/**
 * Strip catalog lines that no longer exist (legacy HP sets, typos, renamed skus).
 * HP/MP armor is free in bag — old `set-hp50-*` purchases must not block Complete fighter.
 */
export function sanitizeCatalogPurchases(
    purchases: ReadonlyArray<ArenaCatalogPurchase>,
): ArenaCatalogPurchase[] {
    const out: ArenaCatalogPurchase[] = [];
    for (const p of purchases) {
        if (!p?.sku || p.qty < 1) {
            continue;
        }
        const sku = p.sku.trim();
        if (!getArenaCatalogSku(sku)) {
            continue; // removed / unknown — drop silently
        }
        const existing = out.find((x) => x.sku === sku);
        if (existing) {
            existing.qty += Math.max(1, Math.floor(p.qty));
        } else {
            out.push({ sku, qty: Math.max(1, Math.floor(p.qty)) });
        }
    }
    return out;
}

/** Soft tips only — never used as Create PVP Duel gate. */
export function arenaKitSoftHints(kit: ArenaKit): string[] {
    const hints: string[] = [];
    if (kit.skills100.length < ARENA_SKILLS_100) {
        hints.push(
            `You can still pick ${ARENA_SKILLS_100 - kit.skills100.length} more skill(s) at 100% (optional).`,
        );
    }
    if (kit.skills50.length < ARENA_SKILLS_50) {
        hints.push(
            `You can still pick ${ARENA_SKILLS_50 - kit.skills50.length} more skill(s) at 50% (optional).`,
        );
    }
    const skillSet = new Set([...kit.skills100, ...kit.skills50]);
    if (skillSet.size !== kit.skills100.length + kit.skills50.length) {
        hints.push('Some skills appear in both 100% and 50% — only 100% will apply.');
    }
    for (const id of skillSet) {
        if (!(ARENA_PVP_SKILL_IDS as readonly number[]).includes(id)) {
            const name = OLYMPIA_SKILLS.find((s) => s.id === id)?.name ?? `id ${id}`;
            // Skill 15 = Physical Absorption (gathering-style / excluded) — strip on apply, do not block.
            hints.push(`“${name}” is not used in Arena and will be ignored.`);
        }
    }
    return hints;
}

/** Sanitize skill picks: drop unknowns, drop overlaps (100% wins), cap at pick limits. */
export function sanitizeArenaSkills(kit: ArenaKit): { skills100: number[]; skills50: number[] } {
    const allowed = new Set(ARENA_PVP_SKILL_IDS as readonly number[]);
    const skills100: number[] = [];
    for (const id of kit.skills100) {
        if (allowed.has(id) && !skills100.includes(id) && skills100.length < ARENA_SKILLS_100) {
            skills100.push(id);
        }
    }
    const skills50: number[] = [];
    for (const id of kit.skills50) {
        if (allowed.has(id) && !skills100.includes(id) && !skills50.includes(id) && skills50.length < ARENA_SKILLS_50) {
            skills50.push(id);
        }
    }
    return { skills100, skills50 };
}

export function isArenaKitComplete(kit: ArenaKit): boolean {
    // Soft skill tips do not block PVP. Name/stats/pots/catalog are the only hard gates.
    // `completed` flag is UI convenience only — not required to start a duel.
    return validateArenaKit(kit).length === 0;
}

export function kitCreditSpend(kit: ArenaKit): number {
    return computeCatalogSpend(kit.catalogPurchases);
}

export function kitCreditsLeft(kit: ArenaKit): number {
    return Math.max(0, ARENA_STARTER_CREDITS - kitCreditSpend(kit));
}

/** Human-readable catalog lines for desk detail / screenshot (qty × label · cost). */
export function formatArenaCatalogLines(kit: ArenaKit): string[] {
    if (!kit.catalogPurchases.length) {
        return ['(no catalog purchases)'];
    }
    return kit.catalogPurchases.map((p) => {
        const row = getArenaCatalogSku(p.sku);
        const label = row?.label ?? p.sku;
        const unit = row?.cost ?? 0;
        const total = unit * Math.max(1, p.qty);
        return `${p.qty}× ${label}  (${total}c)`;
    });
}

/**
 * Equipped rows for walk avatar: Hero set for path/gender, then catalog overrides
 * (weapon / shield / cape / armor pieces). Rings/pots/spells are not visual.
 */
export function resolveArenaKitEquippedPreview(kit: ArenaKit): Array<{ slot: string; itemId: number }> {
    const path = kit.path === 'war' ? 'war' : 'mage';
    const gender = kit.gender === 'female' ? 'female' : 'male';
    const bySlot = new Map<string, number>();
    for (const e of ARENA_HERO_SET_PREVIEW[path][gender]) {
        bySlot.set(e.slot, e.itemId);
    }

    const expandSku = (sku: string): string[] => {
        const row = getArenaCatalogSku(sku);
        if (row?.bundleSkus?.length) {
            return row.bundleSkus.flatMap((s) => expandSku(s));
        }
        return [sku];
    };

    const applyPieceSku = (sku: string) => {
        const key = sku.toLowerCase();
        // Catalog DR/MR pieces go to BAG on server — do NOT overwrite Hero set preview on the avatar.
        // (Old code wrongly mapped hat → War Helm 403 and broke mage Cap look.)
        if (
            key.startsWith('piece-dr50-') ||
            key.startsWith('piece-mr50-') ||
            key.startsWith('cape-mcon') ||
            key === 'piece-hp50' ||
            key === 'set-hp50-war' ||
            key === 'set-hp50-mage' ||
            key === 'set-dr50' ||
            key === 'set-mr50'
        ) {
            return;
        }

        const row = getArenaCatalogSku(sku);
        if (!row?.itemId || row.itemId <= 0) {
            return;
        }
        const item = getItemById(row.itemId);
        const type = (item?.itemType ?? '').toString().toLowerCase();
        if (type === 'weapon' || row.tags.includes('weapon') || row.tags.includes('rapier')) {
            bySlot.set('weapon', row.itemId);
            return;
        }
        if (type === 'shield' || row.tags.includes('shield')) {
            bySlot.set('shield', row.itemId);
            return;
        }
        if (type === 'cape') {
            bySlot.set('cape', row.itemId);
            return;
        }
        if (type === 'helmet' || type === 'helm') {
            bySlot.set('helmet', row.itemId);
            return;
        }
        if (type === 'armor') {
            bySlot.set('armor', row.itemId);
            return;
        }
        if (type === 'hauberk') {
            bySlot.set('hauberk', row.itemId);
            return;
        }
        if (type === 'leggings') {
            bySlot.set('leggings', row.itemId);
            return;
        }
        if (type === 'boots') {
            bySlot.set('boots', row.itemId);
            return;
        }
        // Rings / consumables / spells: no body layer
    };

    for (const p of kit.catalogPurchases) {
        if (p.qty < 1) {
            continue;
        }
        for (const sku of expandSku(p.sku)) {
            applyPieceSku(sku);
        }
    }

    return [...bySlot.entries()].map(([slot, itemId]) => ({ slot, itemId }));
}

function parseKit(raw: unknown): ArenaKit | undefined {
    if (!raw || typeof raw !== 'object') {
        return undefined;
    }
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.name !== 'string') {
        return undefined;
    }
    const slotIndex = typeof r.slotIndex === 'number' ? (Math.max(0, Math.min(3, Math.floor(r.slotIndex))) as ArenaSlotIndex) : 0;
    const statsRaw = (r.stats ?? {}) as Record<string, number>;
    const stats: ArenaKitStats = {
        str: Math.max(ARENA_STAT_MIN, Math.floor(statsRaw.str ?? ARENA_STAT_MIN)),
        vit: Math.max(ARENA_STAT_MIN, Math.floor(statsRaw.vit ?? ARENA_STAT_MIN)),
        dex: Math.max(ARENA_STAT_MIN, Math.floor(statsRaw.dex ?? ARENA_STAT_MIN)),
        int: Math.max(ARENA_STAT_MIN, Math.floor(statsRaw.int ?? ARENA_STAT_MIN)),
        mag: Math.max(ARENA_STAT_MIN, Math.floor(statsRaw.mag ?? ARENA_STAT_MIN)),
        chr: Math.max(ARENA_STAT_MIN, Math.floor(statsRaw.chr ?? ARENA_STAT_MIN)),
    };
    const pots = (r.potions ?? {}) as Record<string, number>;
    const potions: ArenaPotionPick = {
        red: Math.max(0, Math.floor(pots.red ?? 0)),
        blue: Math.max(0, Math.floor(pots.blue ?? 0)),
        greenCandy: Math.max(0, Math.floor(pots.greenCandy ?? 0)),
    };
    const skills100 = Array.isArray(r.skills100) ? r.skills100.filter((x): x is number => typeof x === 'number') : [];
    const skills50 = Array.isArray(r.skills50) ? r.skills50.filter((x): x is number => typeof x === 'number') : [];
    const rawPurchases: ArenaCatalogPurchase[] = Array.isArray(r.catalogPurchases)
        ? r.catalogPurchases
              .map((p) => {
                  if (!p || typeof p !== 'object') {
                      return null;
                  }
                  const row = p as Record<string, unknown>;
                  if (typeof row.sku !== 'string') {
                      return null;
                  }
                  return { sku: row.sku, qty: Math.max(1, Math.floor(Number(row.qty) || 1)) };
              })
              .filter((x): x is ArenaCatalogPurchase => x !== null)
        : [];
    // Strip legacy SKUs (set-hp50-war/mage, etc.) so old drafts can still Complete.
    const catalogPurchases = sanitizeCatalogPurchases(rawPurchases);
    const path: ArenaPath = r.path === 'war' ? 'war' : 'mage';
    const freeMageSpell: ArenaMageFreeSpell | undefined =
        r.freeMageSpell === 'esw' || r.freeMageSpell === 'blizzard' ? r.freeMageSpell : path === 'mage' ? 'blizzard' : undefined;

    return {
        id: r.id,
        slotIndex,
        name: String(r.name).trim().slice(0, 10) || `Fighter ${slotIndex + 1}`,
        path,
        gender: r.gender === 'female' ? 'female' : 'male',
        hairStyleIndex: Math.max(0, Math.floor(Number(r.hairStyleIndex) || 0)),
        underwearColorIndex: Math.max(0, Math.floor(Number(r.underwearColorIndex) || 0)),
        skinColor: Math.max(0, Math.floor(Number(r.skinColor) || 0)),
        stats,
        skills100,
        skills50,
        freeMageSpell,
        potions,
        catalogPurchases,
        completed: r.completed === true,
        updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : Date.now(),
    };
}

export function loadArenaKits(wallet?: string | null): ArenaKit[] {
    try {
        const raw = localStorage.getItem(storageKeyForWallet(wallet));
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.map(parseKit).filter((k): k is ArenaKit => !!k);
    } catch {
        return [];
    }
}

export function getArenaKitForSlot(slotIndex: ArenaSlotIndex, wallet?: string | null): ArenaKit | undefined {
    return loadArenaKits(wallet).find((k) => k.slotIndex === slotIndex);
}

export function saveArenaKit(kit: ArenaKit, wallet?: string | null): { ok: true; kit: ArenaKit } | { ok: false; error: string } {
    const cleanedSkills = sanitizeArenaSkills(kit);
    const cleaned: ArenaKit = {
        ...kit,
        ...cleanedSkills,
        catalogPurchases: sanitizeCatalogPurchases(kit.catalogPurchases),
    };
    const errors = validateArenaKit({ ...cleaned, completed: true });
    // Allow incomplete drafts only if completed flag false
    if (cleaned.completed && errors.length) {
        return { ok: false, error: errors[0] };
    }
    if (!cleaned.completed && !cleaned.name.trim()) {
        return { ok: false, error: 'Name required.' };
    }
    const list = loadArenaKits(wallet).filter((k) => k.slotIndex !== kit.slotIndex && k.id !== kit.id);
    // one kit per slot
    const next: ArenaKit = {
        ...cleaned,
        name: cleaned.name.trim().slice(0, 10),
        updatedAt: Date.now(),
    };
    list.push(next);
    list.sort((a, b) => a.slotIndex - b.slotIndex);
    try {
        localStorage.setItem(storageKeyForWallet(wallet), JSON.stringify(list));
    } catch {
        return { ok: false, error: 'Could not save kit (storage full?).' };
    }
    return { ok: true, kit: next };
}

export function deleteArenaKit(slotIndex: ArenaSlotIndex, wallet?: string | null): void {
    const list = loadArenaKits(wallet).filter((k) => k.slotIndex !== slotIndex);
    localStorage.setItem(storageKeyForWallet(wallet), JSON.stringify(list));
}

export function deskKitsAsTournamentCompat(wallet?: string | null): Array<{
    id: string;
    name: string;
    slot: number;
    completed: boolean;
    creditsLeft: number;
    path: ArenaPath;
}> {
    return [0, 1, 2, 3].map((slot) => {
        const kit = getArenaKitForSlot(slot as ArenaSlotIndex, wallet);
        if (!kit) {
            return {
                id: `empty-${slot}`,
                name: '',
                slot,
                completed: false,
                creditsLeft: ARENA_STARTER_CREDITS,
                path: 'mage' as ArenaPath,
            };
        }
        return {
            id: kit.id,
            name: kit.name,
            slot: kit.slotIndex,
            completed: isArenaKitComplete(kit),
            creditsLeft: kitCreditsLeft(kit),
            path: kit.path,
        };
    });
}

/**
 * Adapt kits for {@link ArenaSelectCharDesk} which still reads SavedTournamentBuild shape
 * (desk 0–1 → tier-160 A/B, desk 2–3 → tier-90 A/B).
 */
export function loadArenaKitsAsDeskBuilds(wallet?: string | null): Array<{
    id: string;
    name: string;
    bracket: 'tier-160' | 'tier-90';
    slot: 0 | 1;
    itemIds: number[];
    creditSpendStub: number;
    updatedAt: number;
}> {
    return loadArenaKits(wallet).map((kit) => {
        const bracket = kit.slotIndex <= 1 ? ('tier-160' as const) : ('tier-90' as const);
        const slot = (kit.slotIndex % 2 === 0 ? 0 : 1) as 0 | 1;
        return {
            id: kit.id,
            name: kit.completed ? kit.name : `${kit.name}*`,
            bracket,
            slot,
            itemIds: kit.catalogPurchases.flatMap((p) => Array(p.qty).fill(0)),
            creditSpendStub: kitCreditSpend(kit),
            updatedAt: kit.updatedAt,
        };
    });
}
