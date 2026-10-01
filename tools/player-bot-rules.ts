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

export interface PlayerBotView {
    className: PlayerBotClassName;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
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
    | { type: 'recall-scroll'; itemUid: string };

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

function hpRatio(view: PlayerBotView): number {
    if (view.maxHp <= 0) {
        return 1;
    }
    return view.hp / view.maxHp;
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
    dead = false;
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

    public noteVitals(hp: number, maxHp: number): void {
        if (maxHp > 0) {
            this.maxHp = maxHp;
        }
        this.hp = hp;
    }

    public noteSpells(spells: ReadonlyArray<{ id: number; name: string }>): void {
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
    private readonly visits = new Map<string, number>();

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
        const potionUid = firstPotionUid(view);
        if (ratio <= HP_LOW_RATIO && potionUid && !view.potionLocked) {
            return { type: 'drink', itemUid: potionUid };
        }

        // Critical health always recalls. Empty potions recall only once health is already low,
        // so a full-HP character whose potion stacks are unnamed in the item directory still hunts.
        // After one town latch, dryRetreatDone lets the loop fight again.
        const lowAndDry = ratio <= HP_LOW_RATIO && charges === 0 && !this.dryRetreatDone;
        const mustRetreat = ratio <= HP_CRITICAL_RATIO || lowAndDry;
        if (mustRetreat) {
            return this.retreat(view, nav);
        }

        if (this.inTown) {
            if (ratio <= HP_CRITICAL_RATIO) {
                return { type: 'wait' };
            }
            this.inTown = false;
        }

        const slime = nearestSlime(view);
        if (!slime) {
            if (!view.canMove) {
                return { type: 'wait' };
            }
            const step = exploreStep(view, nav, this.visits);
            if (!step) {
                return { type: 'wait' };
            }
            this.visits.set(cellKey(view.x, view.y), (this.visits.get(cellKey(view.x, view.y)) ?? 0) + 1);
            return { type: 'move', x: step.x, y: step.y };
        }

        const range = view.className === 'mage' ? MAGE_CAST_RANGE_CELLS : Math.max(1, view.attackRangeCells);
        const distance = chebyshev(view.x, view.y, slime.x, slime.y);
        if (distance <= range) {
            if (view.className === 'mage') {
                if (view.fireStrikeSpellId === null) {
                    return { type: 'wait' };
                }
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
        teleportLocs: observation.teleportLocs,
        inTown: false,
        dryRetreatDone: false,
    };
}
