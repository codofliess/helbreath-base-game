/**
 * Rules policy for the headless client, modeled on AcademyCombatAi's scripted priority
 * (nearest threat, then a cast or a swing, then survival). Randomness is not used here.
 * Human-like delays live in the session loop.
 *
 * The bot may use every field the server sends via protocol to any client: monster and
 * player positions, HP, attacks, casts, potions, and the item directory. Internal state
 * a client does not receive (server memory, admin sockets, the database, a side channel)
 * is refused, including on localhost. Server logs are not an input; score them afterward
 * with player-bot-eval.ts, which is not imported here.
 */

export const HP_LOW_RATIO = 0.5;
export const HP_CRITICAL_RATIO = 0.25;
export const MAGE_CAST_RANGE_CELLS = 5;
export const ACTION_DELAY_MIN_MS = 250;
export const ACTION_DELAY_MAX_MS = 900;

const FORBIDDEN_STATE_KEYS = new Set([
    'serverstate',
    'serverlog',
    'servermemory',
    'adminsocket',
    'database',
    'telemetry',
    'processmemory',
    'evalfeedback',
]);

export interface GridPoint {
    x: number;
    y: number;
}

export interface VisibleMonster {
    id: string;
    name: string;
    sprite: string;
    x: number;
    y: number;
    dead: boolean;
}

export interface BagStack {
    uid: string;
    itemId: number;
    quantity: number;
}

export interface ItemNameEntry {
    name: string;
    consumable: boolean;
}

export type PlayerBotClassName = 'mage' | 'melee';

/** A warp pad from InitialGameWorldState. Source cells and the destination world are client packets. */
export interface ClientTeleport {
    sources: readonly GridPoint[];
    targetWorldId: string;
}

/**
 * Slime field south of the Aresden/Elvine farm entrance. The beginner quest says the slimes
 * are south of the farm. This anchor is a waypoint on the client map, not a server-memory read.
 */
export const FARM_SLIME_SOUTH: GridPoint = { x: 127, y: 91 };

/** Aresden farm gate (the arefarm warp the city snapshot lists around x 279, y 203–210). */
export const ARESDEN_FARM_GATE: GridPoint = { x: 279, y: 206 };

export interface PlayerBotView {
    className: PlayerBotClassName;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    /** True after this session's HP fell, or after PlayerReceiveDamage for this character. */
    tookDamage: boolean;
    dead: boolean;
    attackMode: boolean;
    attackRangeCells: number;
    canMove: boolean;
    potionLocked: boolean;
    fireStrikeSpellId: number | null;
    recallSpellId: number | null;
    recallFailures: number;
    potions: ReadonlyArray<{ uid: string; quantity: number }>;
    recallScrollUid: string | null;
    equippedWeaponUid: string | null;
    equippedWeaponBlocksCast: boolean;
    monsters: readonly VisibleMonster[];
    worldId: string;
    teleports: readonly ClientTeleport[];
    teleportLocs: readonly GridPoint[];
    inTown: boolean;
    dryRetreatDone: boolean;
}

export interface PlayerBotNav {
    isOpen: (x: number, y: number) => boolean;
}

export type PlayerBotAction =
    | { type: 'wait' }
    | { type: 'resurrect' }
    | { type: 'attack-mode' }
    | { type: 'unequip-weapon'; itemUid: string }
    | { type: 'drink'; itemUid: string }
    | { type: 'move'; x: number; y: number }
    | { type: 'melee'; monsterId: string }
    | { type: 'cast'; spellId: number; x: number; y: number; monsterId: string }
    | { type: 'recall'; spellId: number }
    | { type: 'recall-scroll'; itemUid: string }
    | { type: 'warp'; worldId: string; gameWorldId: string };

/**
 * When the bot is standing on the route's warp pad, ask to change world the way the
 * game client does (`WorldChangeRequest` with `validateTeleport`). Walking onto the cell
 * does not transfer by itself.
 */
export function warpTarget(view: Pick<PlayerBotView, 'worldId' | 'x' | 'y' | 'teleports'>): string | null {
    const goal = huntRouteGoal(view);
    if (!goal) {
        return null;
    }
    const here = view.worldId.trim().toLowerCase();
    for (const pad of view.teleports) {
        const target = pad.targetWorldId.trim();
        if (!target || target.toLowerCase() === here) {
            continue;
        }
        const onPad = pad.sources.some((source) => source.x === view.x && source.y === view.y);
        const goalOnPad = pad.sources.some((source) => source.x === goal.x && source.y === goal.y);
        if (onPad && goalOnPad) {
            return target;
        }
    }
    return null;
}

export function assertNoServerState(value: object): void {
    for (const key of Object.keys(value)) {
        const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
        if (FORBIDDEN_STATE_KEYS.has(normalized)) {
            throw new Error(
                `Refusing to decide from "${key}". The bot only uses packets a normal client receives.`,
            );
        }
    }
}

export function chebyshev(ax: number, ay: number, bx: number, by: number): number {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

export function isSlimeIdentity(name: string, sprite: string): boolean {
    const normalizedName = name.trim().toLowerCase();
    const normalizedSprite = sprite.trim().toLowerCase();
    if (normalizedName === 'slime' || normalizedName.startsWith('slime ')) {
        return true;
    }
    return normalizedSprite === 'slm' || normalizedSprite === 'slime' || normalizedSprite.includes('slime');
}

export function isHpPotionName(name: string): boolean {
    const normalized = name.trim().toLowerCase();
    if (!normalized.includes('potion')) {
        return false;
    }
    if (/blue|green|mana|\bmp\b|\bsp\b|stamina|invis/.test(normalized)) {
        return false;
    }
    return /red|\bhp\b|health|heal/.test(normalized);
}

export function isRecallItemName(name: string): boolean {
    return name.trim().toLowerCase().includes('recall');
}

export function weaponBlocksCast(name: string): boolean {
    const normalized = name.trim().toLowerCase();
    if (normalized.length === 0) {
        return false;
    }
    if (/wand|staff|short sword|fencing|rapier|dagger/.test(normalized)) {
        return false;
    }
    return /hammer|axe|bow|mace|spear|two-hand|blade|sword/.test(normalized);
}

const NEIGHBORS: readonly GridPoint[] = [
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
];

function cellKey(x: number, y: number): string {
    return `${x},${y}`;
}

/**
 * First step of a bounded BFS toward `target`. Prefers a cell already inside `range`.
 * Otherwise steps toward the reachable cell closest to the target.
 */
export function stepToward(
    from: GridPoint,
    target: GridPoint,
    range: number,
    isOpen: (x: number, y: number) => boolean,
    maxDepth = 48,
): GridPoint | null {
    if (chebyshev(from.x, from.y, target.x, target.y) <= range) {
        return null;
    }

    const queue: Array<{ point: GridPoint; depth: number; first: GridPoint }> = [];
    const seen = new Set<string>([cellKey(from.x, from.y)]);
    let best: { point: GridPoint; first: GridPoint; distance: number; depth: number } | null = null;

    for (const offset of NEIGHBORS) {
        const next = { x: from.x + offset.x, y: from.y + offset.y };
        if (!isOpen(next.x, next.y)) {
            continue;
        }
        const key = cellKey(next.x, next.y);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        queue.push({ point: next, depth: 1, first: next });
    }

    let cursor = 0;
    while (cursor < queue.length) {
        const current = queue[cursor];
        cursor += 1;
        const distance = chebyshev(current.point.x, current.point.y, target.x, target.y);
        if (
            best === null ||
            distance < best.distance ||
            (distance === best.distance && current.depth < best.depth)
        ) {
            best = { point: current.point, first: current.first, distance, depth: current.depth };
        }
        if (distance <= range) {
            return current.first;
        }
        if (current.depth >= maxDepth) {
            continue;
        }
        for (const offset of NEIGHBORS) {
            const next = { x: current.point.x + offset.x, y: current.point.y + offset.y };
            const key = cellKey(next.x, next.y);
            if (seen.has(key) || !isOpen(next.x, next.y)) {
                continue;
            }
            seen.add(key);
            queue.push({ point: next, depth: current.depth + 1, first: current.first });
        }
    }

    return best?.first ?? null;
}

function nearestSlime(view: PlayerBotView): VisibleMonster | null {
    let best: VisibleMonster | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const monster of view.monsters) {
        if (monster.dead || !isSlimeIdentity(monster.name, monster.sprite)) {
            continue;
        }
        const distance = chebyshev(view.x, view.y, monster.x, monster.y);
        if (
            distance < bestDistance ||
            (distance === bestDistance && best !== null && monster.id < best.id)
        ) {
            best = monster;
            bestDistance = distance;
        }
    }
    return best;
}

function potionCharges(view: PlayerBotView): number {
    return view.potions.reduce((sum, potion) => sum + Math.max(0, potion.quantity), 0);
}

function firstPotionUid(view: PlayerBotView): string | null {
    for (const potion of view.potions) {
        if (potion.quantity > 0) {
            return potion.uid;
        }
    }
    return null;
}

/** HP / max HP from the packets. A missing or shorter max than the current HP is a full bar, not a wound. */
export function hpRatio(view: Pick<PlayerBotView, 'hp' | 'maxHp'>): number {
    if (view.maxHp <= 0 || view.hp >= view.maxHp) {
        return 1;
    }
    if (view.hp <= 0) {
        return 0;
    }
    return view.hp / view.maxHp;
}

/**
 * Next waypoint when no slime is in view. City → farm warp from the world snapshot.
 * Farm → the southern slime field. Other worlds keep the local explore step.
 */
export function huntRouteGoal(view: Pick<PlayerBotView, 'worldId' | 'x' | 'y' | 'teleports'>): GridPoint | null {
    const world = view.worldId.trim().toLowerCase();
    if (world === 'arefarm' || world === 'elvfarm') {
        if (chebyshev(view.x, view.y, FARM_SLIME_SOUTH.x, FARM_SLIME_SOUTH.y) <= 8) {
            return null;
        }
        return FARM_SLIME_SOUTH;
    }
    if (world !== 'aresden' && world !== 'elvine') {
        return null;
    }
    const farmId = world === 'elvine' ? 'elvfarm' : 'arefarm';
    let best: GridPoint | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const pad of view.teleports) {
        if (pad.targetWorldId.trim().toLowerCase() !== farmId) {
            continue;
        }
        for (const source of pad.sources) {
            const distance = chebyshev(view.x, view.y, source.x, source.y);
            if (distance < bestDistance) {
                best = source;
                bestDistance = distance;
            }
        }
    }
    if (best) {
        return best;
    }
    return world === 'aresden' ? ARESDEN_FARM_GATE : null;
}

function exploreStep(view: PlayerBotView, nav: PlayerBotNav, visits: Map<string, number>): GridPoint | null {
    const queue: Array<{ point: GridPoint; depth: number; first: GridPoint }> = [];
    const seen = new Set<string>([cellKey(view.x, view.y)]);
    let best: { first: GridPoint; visits: number; depth: number; y: number; x: number } | null = null;

    for (const offset of NEIGHBORS) {
        const next = { x: view.x + offset.x, y: view.y + offset.y };
        if (!nav.isOpen(next.x, next.y)) {
            continue;
        }
        seen.add(cellKey(next.x, next.y));
        queue.push({ point: next, depth: 1, first: next });
    }

    let cursor = 0;
    while (cursor < queue.length) {
        const current = queue[cursor];
        cursor += 1;
        const visitsHere = visits.get(cellKey(current.point.x, current.point.y)) ?? 0;
        if (
            best === null ||
            visitsHere < best.visits ||
            (visitsHere === best.visits && current.depth < best.depth) ||
            (visitsHere === best.visits && current.depth === best.depth && current.point.y < best.y) ||
            (visitsHere === best.visits &&
                current.depth === best.depth &&
                current.point.y === best.y &&
                current.point.x < best.x)
        ) {
            best = {
                first: current.first,
                visits: visitsHere,
                depth: current.depth,
                y: current.point.y,
                x: current.point.x,
            };
        }
        if (current.depth >= 24) {
            continue;
        }
        for (const offset of NEIGHBORS) {
            const next = { x: current.point.x + offset.x, y: current.point.y + offset.y };
            const key = cellKey(next.x, next.y);
            if (seen.has(key) || !nav.isOpen(next.x, next.y)) {
                continue;
            }
            seen.add(key);
            queue.push({ point: next, depth: current.depth + 1, first: current.first });
        }
    }

    return best?.first ?? null;
}

function fleeStep(view: PlayerBotView, nav: PlayerBotNav, threat: VisibleMonster): GridPoint | null {
    let best: GridPoint | null = null;
    let bestDistance = -1;
    for (const offset of NEIGHBORS) {
        const next = { x: view.x + offset.x, y: view.y + offset.y };
        if (!nav.isOpen(next.x, next.y)) {
            continue;
        }
        const distance = chebyshev(next.x, next.y, threat.x, threat.y);
        if (distance > bestDistance || (distance === bestDistance && best !== null && (next.y < best.y || (next.y === best.y && next.x < best.x)))) {
            best = next;
            bestDistance = distance;
        }
    }
    return best;
}

/**
 * Packet-derived world. The session copies protobuf fields in; nothing here opens a socket
 * or a server log.
 */
export class PlayerBotObservation {
    x = 0;
    y = 0;
    hp = 0;
    maxHp = 0;
    /** False until the first positive hp and maxHp pair. A rescale of a full bar is not damage. */
    private vitalsReady = false;
    tookDamage = false;
    dead = false;
    worldId = '';
    readonly teleports: ClientTeleport[] = [];
    attackMode = false;
    attackRangeCells = 1;
    castSpeedMs = 700;
    fireStrikeSpellId: number | null = null;
    recallSpellId: number | null = null;
    recallScrollUid: string | null = null;
    equippedWeaponUid: string | null = null;
    equippedItemId = -1;
    equippedWeaponName = '';
    readonly monsters = new Map<string, VisibleMonster>();
    readonly bag = new Map<string, BagStack>();
    readonly itemNames = new Map<number, ItemNameEntry>();
    readonly teleportLocs: GridPoint[] = [];
    readonly slimeKillBaseline = new Map<number, number>();
    /** True after ProgressionState. Monster ids missing from that snapshot start at 0. */
    killBaselineReady = false;
    slimeKillsThisRun = 0;
    readonly signals: string[] = [];

    public notePosition(x: number, y: number): void {
        this.x = x;
        this.y = y;
    }

    /**
     * Applies an HP packet. A full bar that changes scale (1000/1000 → 40/40) is not a hit.
     * A 0–100 percent update is ignored once an absolute pool above 100 is already known.
     * HP above the claimed max means the max field is short, so the bar is full.
     */
    public noteVitals(hp: number, maxHp: number): void {
        let nextMax = maxHp > 0 ? maxHp : this.maxHp;
        const nextHp = Math.max(0, hp);
        // A 0–100 bar must not replace an absolute pool, including a full bar reported as 40/40.
        if (this.vitalsReady && nextMax === 100 && this.maxHp !== 100 && this.hp >= this.maxHp && nextHp <= 100) {
            return;
        }
        if (nextMax > 0 && nextHp > nextMax) {
            nextMax = nextHp;
        }
        if (!this.vitalsReady) {
            this.hp = nextHp;
            if (nextMax > 0) {
                this.maxHp = nextMax;
            }
            this.vitalsReady = this.maxHp > 0 && this.hp > 0;
            this.tookDamage = false;
            return;
        }
        const prevHp = this.hp;
        const prevMax = this.maxHp;
        const prevRatio = prevMax > 0 ? prevHp / prevMax : 1;
        const nextRatio = nextMax > 0 ? nextHp / nextMax : 1;
        const rescaled =
            nextHp !== prevHp && nextMax !== prevMax && nextMax > 0 && Math.abs(prevRatio - nextRatio) <= 0.02;
        if (!rescaled && nextHp < prevHp) {
            this.tookDamage = true;
        }
        this.hp = nextHp;
        if (nextMax > 0) {
            this.maxHp = nextMax;
        }
        if (this.maxHp > 0 && this.hp >= this.maxHp) {
            this.tookDamage = false;
        }
    }

    /** PlayerReceiveDamage for this character. A hit counts even before the HP packet arrives. */
    public noteDamageTaken(): void {
        this.tookDamage = true;
    }

    public noteSpells(spells: ReadonlyArray<{ id: number; name: string }>): void {
        // World transfer sends an empty spell directory on purpose. Keep the book the client already has.
        if (spells.length === 0 && (this.fireStrikeSpellId !== null || this.recallSpellId !== null)) {
            return;
        }
        this.fireStrikeSpellId = null;
        this.recallSpellId = null;
        for (const spell of spells) {
            const name = spell.name.trim().toLowerCase();
            if (name === 'fire strike') {
                this.fireStrikeSpellId = spell.id;
            } else if (name === 'recall') {
                this.recallSpellId = spell.id;
            }
        }
    }

    public noteItems(items: ReadonlyArray<{ id: number; name: string; consumable: boolean }>): void {
        this.itemNames.clear();
        for (const item of items) {
            this.itemNames.set(item.id, { name: item.name, consumable: item.consumable });
        }
        this.refreshDerivedItems();
    }

    public noteBag(items: readonly BagStack[]): void {
        this.bag.clear();
        for (const item of items) {
            this.bag.set(item.uid, { ...item, quantity: item.quantity > 0 ? item.quantity : 1 });
        }
        this.refreshDerivedItems();
    }

    public noteBagAdded(item: BagStack): void {
        this.bag.set(item.uid, { ...item, quantity: item.quantity > 0 ? item.quantity : 1 });
        this.refreshDerivedItems();
    }

    public noteBagRemoved(uid: string): void {
        this.bag.delete(uid);
        this.refreshDerivedItems();
    }

    public noteEquipped(slot: string, item: { uid: string; itemId: number } | null): void {
        if (slot !== 'weapon') {
            return;
        }
        if (!item) {
            this.equippedWeaponUid = null;
            this.equippedItemId = -1;
            this.equippedWeaponName = '';
            return;
        }
        this.equippedWeaponUid = item.uid;
        this.equippedItemId = item.itemId;
        this.equippedWeaponName = this.itemNames.get(item.itemId)?.name ?? '';
    }

    public noteMonsters(monsters: readonly VisibleMonster[]): void {
        for (const monster of monsters) {
            this.monsters.set(monster.id, { ...monster });
        }
    }

    public noteMonsterMoved(id: string, x: number, y: number): void {
        const existing = this.monsters.get(id);
        if (existing) {
            existing.x = x;
            existing.y = y;
            return;
        }
        this.monsters.set(id, { id, name: '', sprite: '', x, y, dead: false });
    }

    public noteMonstersLeft(ids: readonly string[]): void {
        for (const id of ids) {
            this.monsters.delete(id);
        }
    }

    public noteMonsterDied(id: string): void {
        const existing = this.monsters.get(id);
        if (existing) {
            existing.dead = true;
        }
    }

    public noteTeleportLocs(locs: readonly GridPoint[]): void {
        this.teleportLocs.length = 0;
        this.teleportLocs.push(...locs);
    }

    /** World id and warp pads from InitialGameWorldState. */
    public noteWorld(worldId: string, teleports: readonly ClientTeleport[]): void {
        this.worldId = worldId;
        this.teleports.length = 0;
        this.teleportLocs.length = 0;
        for (const pad of teleports) {
            const sources = pad.sources.map((source) => ({ x: source.x, y: source.y }));
            this.teleports.push({ sources, targetWorldId: pad.targetWorldId });
            this.teleportLocs.push(...sources);
        }
    }

    public noteKillBaseline(monsterId: number, kills: number): void {
        if (!this.slimeKillBaseline.has(monsterId)) {
            this.slimeKillBaseline.set(monsterId, kills);
        }
    }

    /** ProgressionState arrived. Ids it omitted have zero historical kills. */
    public markKillBaselineReady(): void {
        this.killBaselineReady = true;
    }

    /** Returns the number of new slime kills credited by this packet (0 when it is not a slime). */
    public noteSlimeKills(monsterId: number, monsterName: string, kills: number): number {
        let previous = this.slimeKillBaseline.get(monsterId);
        if (previous === undefined && this.killBaselineReady) {
            previous = 0;
        }
        this.slimeKillBaseline.set(monsterId, kills);
        if (!isSlimeIdentity(monsterName, '')) {
            return 0;
        }
        if (previous === undefined) {
            return 0;
        }
        const delta = kills - previous;
        if (delta <= 0) {
            return 0;
        }
        this.slimeKillsThisRun += delta;
        return delta;
    }

    public pushSignal(signal: string): void {
        this.signals.push(signal);
    }

    public drainSignals(): string[] {
        return this.signals.splice(0, this.signals.length);
    }

    private refreshDerivedItems(): void {
        this.recallScrollUid = null;
        if (this.equippedItemId >= 0) {
            const equippedName = this.itemNames.get(this.equippedItemId)?.name;
            if (equippedName) {
                this.equippedWeaponName = equippedName;
            }
        }
        for (const stack of this.bag.values()) {
            const entry = this.itemNames.get(stack.itemId);
            if (entry && isRecallItemName(entry.name)) {
                this.recallScrollUid = stack.uid;
                break;
            }
        }
    }

    public hpPotions(): Array<{ uid: string; quantity: number }> {
        const potions: Array<{ uid: string; quantity: number }> = [];
        for (const stack of this.bag.values()) {
            const entry = this.itemNames.get(stack.itemId);
            if (!entry || !isHpPotionName(entry.name)) {
                continue;
            }
            potions.push({ uid: stack.uid, quantity: stack.quantity });
        }
        potions.sort((left, right) => left.uid.localeCompare(right.uid));
        return potions;
    }
}

/**
 * Mutable policy flags that are still client-side (town latch, visit counts, failed recalls).
 * They are not read from the server.
 */
export class PlayerBotBrain {
    inTown = false;
    dryRetreatDone = false;
    recallFailures = 0;
    /** Set when a potion is used. Cleared once HP rises, or suppressed if it does not. */
    private awaitingHeal = false;
    private hpAtDrink = 0;
    /** HP at which a potion failed to heal. Another drink waits for a further drop. */
    private healFailedAtHp: number | null = null;
    private readonly visits = new Map<string, number>();

    public noteDrink(hp: number): void {
        this.awaitingHeal = true;
        this.hpAtDrink = hp;
    }

    public noteTown(potionCharges: number): void {
        this.inTown = true;
        if (potionCharges <= 0) {
            this.dryRetreatDone = true;
        }
    }

    public noteRecallFailed(): void {
        this.recallFailures += 1;
    }

    public decide(view: PlayerBotView, nav: PlayerBotNav): PlayerBotAction {
        assertNoServerState(view);
        assertNoServerState(nav);
        const merged: PlayerBotView = {
            ...view,
            inTown: this.inTown,
            dryRetreatDone: this.dryRetreatDone,
            recallFailures: this.recallFailures,
        };
        return this.decideMerged(merged, nav);
    }

    private decideMerged(view: PlayerBotView, nav: PlayerBotNav): PlayerBotAction {
        if (view.dead) {
            return { type: 'resurrect' };
        }
        if (!view.attackMode) {
            return { type: 'attack-mode' };
        }
        if (view.className === 'mage' && view.equippedWeaponBlocksCast && view.equippedWeaponUid) {
            return { type: 'unequip-weapon', itemUid: view.equippedWeaponUid };
        }

        const ratio = hpRatio(view);
        const charges = potionCharges(view);
        if (charges > 0) {
            this.dryRetreatDone = false;
        }
        if (this.awaitingHeal && !view.potionLocked) {
            if (view.hp > this.hpAtDrink) {
                this.awaitingHeal = false;
            } else {
                this.awaitingHeal = false;
                this.healFailedAtHp = view.hp;
            }
        }
        const furtherDrop = this.healFailedAtHp === null || view.hp < this.healFailedAtHp;
        const potionUid = firstPotionUid(view);
        // Potions only after a real HP drop. A low ratio with no drop (wrong max, or a full bar) does not drink.
        if (
            view.tookDamage &&
            furtherDrop &&
            ratio <= HP_LOW_RATIO &&
            potionUid &&
            !view.potionLocked &&
            !this.awaitingHeal
        ) {
            return { type: 'drink', itemUid: potionUid };
        }

        // Retreat only after real damage. An undamaged character with a bogus low ratio keeps hunting.
        // Empty potions recall only once health is already low. After one town latch, dryRetreatDone lets it fight again.
        const lowAndDry = view.tookDamage && ratio <= HP_LOW_RATIO && charges === 0 && !this.dryRetreatDone;
        const mustRetreat = (view.tookDamage && ratio <= HP_CRITICAL_RATIO) || lowAndDry;
        if (mustRetreat) {
            return this.retreat(view, nav);
        }

        if (this.inTown) {
            if (view.tookDamage && ratio <= HP_CRITICAL_RATIO) {
                return { type: 'wait' };
            }
            this.inTown = false;
        }

        const slime = nearestSlime(view);
        if (!slime) {
            const warpWorldId = warpTarget(view);
            if (warpWorldId) {
                return { type: 'warp', worldId: warpWorldId, gameWorldId: view.worldId };
            }
            if (!view.canMove) {
                return { type: 'wait' };
            }
            const goal = huntRouteGoal(view);
            const step = goal
                ? stepToward({ x: view.x, y: view.y }, goal, 0, nav.isOpen, 64)
                : exploreStep(view, nav, this.visits);
            if (!step) {
                return { type: 'wait' };
            }
            this.visits.set(cellKey(view.x, view.y), (this.visits.get(cellKey(view.x, view.y)) ?? 0) + 1);
            return { type: 'move', x: step.x, y: step.y };
        }

        const canCast = view.className === 'mage' && view.fireStrikeSpellId !== null;
        const range = canCast ? MAGE_CAST_RANGE_CELLS : Math.max(1, view.attackRangeCells);
        const distance = chebyshev(view.x, view.y, slime.x, slime.y);
        if (distance <= range) {
            if (canCast && view.fireStrikeSpellId !== null) {
                return {
                    type: 'cast',
                    spellId: view.fireStrikeSpellId,
                    x: slime.x,
                    y: slime.y,
                    monsterId: slime.id,
                };
            }
            return { type: 'melee', monsterId: slime.id };
        }
        if (!view.canMove) {
            return { type: 'wait' };
        }
        const step = stepToward({ x: view.x, y: view.y }, slime, range, nav.isOpen);
        if (!step) {
            return { type: 'wait' };
        }
        this.visits.set(cellKey(view.x, view.y), (this.visits.get(cellKey(view.x, view.y)) ?? 0) + 1);
        return { type: 'move', x: step.x, y: step.y };
    }

    private retreat(view: PlayerBotView, nav: PlayerBotNav): PlayerBotAction {
        if (view.recallSpellId !== null && view.recallFailures < 3) {
            return { type: 'recall', spellId: view.recallSpellId };
        }
        if (view.recallScrollUid) {
            return { type: 'recall-scroll', itemUid: view.recallScrollUid };
        }
        if (!view.canMove) {
            return { type: 'wait' };
        }
        if (view.teleportLocs.length > 0) {
            let nearest = view.teleportLocs[0];
            let nearestDistance = chebyshev(view.x, view.y, nearest.x, nearest.y);
            for (const loc of view.teleportLocs) {
                const distance = chebyshev(view.x, view.y, loc.x, loc.y);
                if (distance < nearestDistance) {
                    nearest = loc;
                    nearestDistance = distance;
                }
            }
            if (nearestDistance <= 1) {
                this.inTown = true;
                if (potionCharges(view) === 0) {
                    this.dryRetreatDone = true;
                }
                return { type: 'wait' };
            }
            const step = stepToward({ x: view.x, y: view.y }, nearest, 1, nav.isOpen);
            if (step) {
                return { type: 'move', x: step.x, y: step.y };
            }
        }
        const threat = nearestSlime(view) ?? view.monsters.find((monster) => !monster.dead) ?? null;
        if (threat) {
            const step = fleeStep(view, nav, threat);
            if (step) {
                return { type: 'move', x: step.x, y: step.y };
            }
        }
        this.inTown = true;
        if (potionCharges(view) === 0) {
            this.dryRetreatDone = true;
        }
        return { type: 'wait' };
    }
}

export function buildPlayerBotView(
    observation: PlayerBotObservation,
    className: PlayerBotClassName,
    canMove: boolean,
    potionLocked: boolean,
): PlayerBotView {
    return {
        className,
        x: observation.x,
        y: observation.y,
        hp: observation.hp,
        maxHp: observation.maxHp,
        tookDamage: observation.tookDamage,
        dead: observation.dead,
        attackMode: observation.attackMode,
        attackRangeCells: observation.attackRangeCells,
        canMove,
        potionLocked,
        fireStrikeSpellId: observation.fireStrikeSpellId,
        recallSpellId: observation.recallSpellId,
        recallFailures: 0,
        potions: observation.hpPotions(),
        recallScrollUid: observation.recallScrollUid,
        equippedWeaponUid: observation.equippedWeaponUid,
        equippedWeaponBlocksCast: weaponBlocksCast(observation.equippedWeaponName),
        monsters: [...observation.monsters.values()],
        worldId: observation.worldId,
        teleports: observation.teleports,
        teleportLocs: observation.teleportLocs,
        inTown: false,
        dryRetreatDone: false,
    };
}
