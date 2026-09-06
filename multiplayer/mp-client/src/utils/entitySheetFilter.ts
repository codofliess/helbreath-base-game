/**
 * Helbreath monster/NPC `.spr` layout: 8 directional sheets per anim state.
 * Idle 0–7, move 8–15, attack 16–23, take-damage 24–31, dead 32–39.
 * Pad combat must not decode the whole pack (40 Canvas textures) for every slime in view.
 */

export const ENTITY_SHEETS_PER_STATE = 8;
export const ENTITY_IDLE_SHEET_BASE = 0;
export const ENTITY_MOVE_SHEET_BASE = 8;
export const ENTITY_ATTACK_SHEET_BASE = 16;
export const ENTITY_TAKE_DAMAGE_SHEET_BASE = 24;
export const ENTITY_DEAD_SHEET_BASE = 32;

export type EntityAnimState = 'idle' | 'move' | 'attack' | 'takeDamage' | 'dead';

const STATE_BASE: Record<EntityAnimState, number> = {
    idle: ENTITY_IDLE_SHEET_BASE,
    move: ENTITY_MOVE_SHEET_BASE,
    attack: ENTITY_ATTACK_SHEET_BASE,
    takeDamage: ENTITY_TAKE_DAMAGE_SHEET_BASE,
    dead: ENTITY_DEAD_SHEET_BASE,
};

/** Local sheet indexes for one animation state (all 8 facings). */
export function entitySheetsForState(state: EntityAnimState): number[] {
    const base = STATE_BASE[state];
    const sheets: number[] = [];
    for (let d = 0; d < ENTITY_SHEETS_PER_STATE; d += 1) {
        sheets.push(base + d);
    }
    return sheets;
}

/** First-paint set: idle only. Combat/death sheets decode when that state is first used. */
export function idleEntitySheetIndices(): Set<number> {
    return new Set(entitySheetsForState('idle'));
}

export function entitySheetsForStateSet(state: EntityAnimState): Set<number> {
    return new Set(entitySheetsForState(state));
}

/**
 * Phaser texture keys `sprite-{name}-{n}` (or `{assetKey}-{n}`) that are outside `keepLocalSheets`.
 */
export function entityTextureKeysToEvict(
    textureKeys: Iterable<string>,
    assetKey: string,
    keepLocalSheets: ReadonlySet<number>,
): string[] {
    const prefix = `${assetKey}-`;
    const evict: string[] = [];
    for (const key of textureKeys) {
        if (!key.startsWith(prefix)) {
            continue;
        }
        const suffix = key.slice(prefix.length);
        if (!/^\d+$/.test(suffix)) {
            continue;
        }
        const local = Number(suffix);
        if (!keepLocalSheets.has(local)) {
            evict.push(key);
        }
    }
    return evict;
}
