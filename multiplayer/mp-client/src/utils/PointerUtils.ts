import { getObjectsNearPixel } from './SpatialGrid';
import { convertPixelPosToWorldPos } from './CoordinateUtils';
import { TILE_SIZE } from '../game/assets/HBMap';
import { MonsterAllegiance } from '../Types';
import type { Monster } from '../game/objects/Monster';
import type { NPC } from '../game/objects/NPC';
import type { Player } from '../game/objects/Player';
import type { GroundItem } from '../game/objects/GroundItem';

/**
 * Extra hit volume for tall monsters (Ogre, etc.): body/head sit 1–3 tiles above feet.
 * Same idea as player pots/buffs — click on chest must register the entity, not the cell north of feet.
 */
const MONSTER_POINTER_HIT_PAD_X = 16;
const MONSTER_POINTER_HIT_PAD_Y_TOP = 28;
const MONSTER_POINTER_HIT_PAD_Y_BOTTOM = 12;
/** Search cells from feet pivot; large sprites extend several tiles north. */
const MONSTER_POINTER_SEARCH_CELLS = 4;

/**
 * True when world-pixel is over a monster body (sprite bounds + tall pad / feet column fallback).
 */
export function isMonsterBodyUnderWorldPixel(
    monster: Monster,
    worldPixelX: number,
    worldPixelY: number,
): boolean {
    const feetX = monster.getAnimatedPixelX();
    const feetY = monster.getAnimatedPixelY();
    const halfW = TILE_SIZE / 2 + MONSTER_POINTER_HIT_PAD_X;
    if (worldPixelX < feetX - halfW || worldPixelX > feetX + halfW) {
        // Still allow wide sprite bounds (some mobs are broader than 1 tile).
        const bounds = monster.getBounds();
        if (
            !bounds ||
            worldPixelX < bounds.x - MONSTER_POINTER_HIT_PAD_X ||
            worldPixelX > bounds.x + bounds.width + MONSTER_POINTER_HIT_PAD_X
        ) {
            return false;
        }
    }

    const bounds = monster.getBounds();
    if (bounds && bounds.width > 0 && bounds.height > 0) {
        return (
            worldPixelY >= bounds.y - MONSTER_POINTER_HIT_PAD_Y_TOP &&
            worldPixelY <= bounds.y + bounds.height + MONSTER_POINTER_HIT_PAD_Y_BOTTOM
        );
    }
    // Fallback: feet + up to ~3 tiles up (head of tall mobs) + a bit below.
    return (
        worldPixelY >= feetY - TILE_SIZE * 3 - MONSTER_POINTER_HIT_PAD_Y_TOP &&
        worldPixelY <= feetY + TILE_SIZE / 2 + MONSTER_POINTER_HIT_PAD_Y_BOTTOM
    );
}

/**
 * Pointer / hover hit testing in world pixel space (shared by GameWorld input and UI hover polling).
 */
export function getMonsterUnderWorldPixel(
    monsters: Monster[],
    worldPixelX: number,
    worldPixelY: number,
): Monster | undefined {
    const candidates = getObjectsNearPixel(
        monsters,
        (m) => ({ x: m.getAnimatedPixelX(), y: m.getAnimatedPixelY() }),
        worldPixelX,
        worldPixelY,
        MONSTER_POINTER_SEARCH_CELLS,
    );

    let topMonster: Monster | undefined;
    let topDepth = -Infinity;

    for (const monster of candidates) {
        if (monster.isDead()) {
            continue;
        }
        if (!isMonsterBodyUnderWorldPixel(monster, worldPixelX, worldPixelY)) {
            continue;
        }
        const depth = monster.getDepth();
        if (depth > topDepth) {
            topDepth = depth;
            topMonster = monster;
        }
    }
    return topMonster;
}

/** Hover UI: hostile invisible monsters are not shown; friendly invisible remain semi-visible. */
export function getMonsterUnderWorldPixelForHoverUi(
    monsters: Monster[],
    worldPixelX: number,
    worldPixelY: number,
): Monster | undefined {
    const m = getMonsterUnderWorldPixel(monsters, worldPixelX, worldPixelY);
    if (!m || m.isDead()) {
        return undefined;
    }
    if (m.hasInvisibilityBuff() && m.getAllegiance() !== MonsterAllegiance.Friendly) {
        return undefined;
    }
    return m;
}

export function getNpcUnderWorldPixelForHover(
    npcs: NPC[],
    worldPixelX: number,
    worldPixelY: number,
): NPC | undefined {
    // Generous search — city NPC sprites are tall; 10px was too tight for Magic Tower clicks.
    const candidates = getObjectsNearPixel(
        npcs.filter((n) => !n.isDead()),
        (n) => ({ x: n.getAnimatedPixelX(), y: n.getAnimatedPixelY() }),
        worldPixelX,
        worldPixelY,
        56,
    );

    let topNpc: NPC | undefined;
    let topDepth = -Infinity;

    for (const npc of candidates) {
        const bounds = npc.getBounds();
        // Fallback hit pad around sprite center when bounds missing or tight.
        const pad = 28;
        const cx = npc.getAnimatedPixelX();
        const cy = npc.getAnimatedPixelY();
        const inBounds = bounds
            ? worldPixelX >= bounds.x - pad &&
              worldPixelX <= bounds.x + bounds.width + pad &&
              worldPixelY >= bounds.y - pad &&
              worldPixelY <= bounds.y + bounds.height + pad
            : Math.abs(worldPixelX - cx) <= 40 && Math.abs(worldPixelY - cy) <= 56;

        if (inBounds) {
            const depth = npc.getDepth();
            if (depth > topDepth) {
                topDepth = depth;
                topNpc = npc;
            }
        }
    }
    return topNpc;
}

/**
 * Extra pixels around player body for melee/spell aim.
 * Olympia: pot/heal/buff lands on chest/head, not only the feet tile — tall pad upward.
 */
const PLAYER_POINTER_HIT_PAD_X = 12;
/** Extra reach above sprite bounds (head / tall frames). */
const PLAYER_POINTER_HIT_PAD_Y_TOP = 20;
const PLAYER_POINTER_HIT_PAD_Y_BOTTOM = 10;
/**
 * Search radius in cells from feet anchor. Body extends ~2 tiles north of feet center,
 * so radius 2 missed head clicks; use 3.
 */
const PLAYER_POINTER_SEARCH_CELLS = 3;

/**
 * True when the world-pixel is over a player's body hit volume (sprite bounds + Olympia pad).
 * Feet sit near cell center; torso/head occupy pixels above the feet cell.
 */
export function isPlayerBodyUnderWorldPixel(
    player: Player,
    worldPixelX: number,
    worldPixelY: number,
): boolean {
    const bounds = player.getBounds();
    const feetX = player.getAnimatedPixelX();
    const feetY = player.getAnimatedPixelY();
    // Full-width column through the character (Olympia body click), not only tight sprite AABB.
    const halfW = TILE_SIZE / 2 + PLAYER_POINTER_HIT_PAD_X;
    if (worldPixelX < feetX - halfW || worldPixelX > feetX + halfW) {
        return false;
    }
    if (bounds && bounds.width > 0 && bounds.height > 0) {
        // Prefer full sprite bounds (chest/head), expanded upward.
        return (
            worldPixelY >= bounds.y - PLAYER_POINTER_HIT_PAD_Y_TOP &&
            worldPixelY <= bounds.y + bounds.height + PLAYER_POINTER_HIT_PAD_Y_BOTTOM
        );
    }
    // Fallback: feet + ~2 tiles up (head) + a bit below.
    return (
        worldPixelY >= feetY - TILE_SIZE * 2 - PLAYER_POINTER_HIT_PAD_Y_TOP &&
        worldPixelY <= feetY + TILE_SIZE / 2 + PLAYER_POINTER_HIT_PAD_Y_BOTTOM
    );
}

export function getOtherPlayerUnderWorldPixel(
    localPlayer: Player | undefined,
    playersById: Map<string, Player>,
    worldPixelX: number,
    worldPixelY: number,
): Player | undefined {
    const candidates = getObjectsNearPixel(
        Array.from(playersById.values()).filter((player) => player !== localPlayer && !player.isDead()),
        (player) => ({ x: player.getAnimatedPixelX(), y: player.getAnimatedPixelY() }),
        worldPixelX,
        worldPixelY,
        PLAYER_POINTER_SEARCH_CELLS,
    );

    let topPlayer: Player | undefined;
    let topDepth = -Infinity;
    for (const player of candidates) {
        if (!isPlayerBodyUnderWorldPixel(player, worldPixelX, worldPixelY)) {
            continue;
        }
        const depth = player.getDepth();
        if (depth > topDepth) {
            topDepth = depth;
            topPlayer = player;
        }
    }

    return topPlayer;
}

/** All players under the cursor (including local) for UI hover / self buff+heal aim. */
export function getPlayerUnderWorldPixelForHover(
    playersById: Map<string, Player>,
    worldPixelX: number,
    worldPixelY: number,
): Player | undefined {
    const candidates = getObjectsNearPixel(
        Array.from(playersById.values()).filter(
            (player) => !player.isDead() && (player.isLocalCharacter() || !player.hasInvisibilityBuff()),
        ),
        (player) => ({ x: player.getAnimatedPixelX(), y: player.getAnimatedPixelY() }),
        worldPixelX,
        worldPixelY,
        PLAYER_POINTER_SEARCH_CELLS,
    );

    let topPlayer: Player | undefined;
    let topDepth = -Infinity;
    for (const player of candidates) {
        if (!isPlayerBodyUnderWorldPixel(player, worldPixelX, worldPixelY)) {
            continue;
        }
        const depth = player.getDepth();
        if (depth > topDepth) {
            topDepth = depth;
            topPlayer = player;
        }
    }

    return topPlayer;
}

export function getGroundItemUnderWorldCell(
    groundItems: GroundItem[],
    worldPixelX: number,
    worldPixelY: number,
): GroundItem | undefined {
    const cellX = convertPixelPosToWorldPos(worldPixelX);
    const cellY = convertPixelPosToWorldPos(worldPixelY);

    // Exact cell first, then Chebyshev radius 1 so a 1-tile visual shift still picks loot.
    for (let radius = 0; radius <= 1; radius++) {
        let topItem: GroundItem | undefined;
        let topDepth = -Infinity;
        let bestDist = Infinity;
        for (const g of groundItems) {
            const dx = Math.abs(g.worldX - cellX);
            const dy = Math.abs(g.worldY - cellY);
            const d = Math.max(dx, dy);
            if (d > radius) {
                continue;
            }
            const depth = g.getDepth();
            // Prefer closer cell; tie-break by draw depth.
            if (d < bestDist || (d === bestDist && depth > topDepth)) {
                bestDist = d;
                topDepth = depth;
                topItem = g;
            }
        }
        if (topItem) {
            return topItem;
        }
    }
    return undefined;
}

/**
 * World-pixel position under the pointer — single source of truth for clicks, loot, spells.
 *
 * CRITICAL: never use `pointer.x + scrollX` alone under zoom / Scale.ENVELOP; that desyncs
 * the visible tile from the logical cell (hard to click ground items, wrong warp pads).
 * Prefer Phaser camera matrix (`getWorldPoint` / `pointer.worldX`).
 */
export function pointerWorldPixel(
    pointer: {
        x: number;
        y: number;
        worldX?: number;
        worldY?: number;
    },
    camera?: {
        scrollX: number;
        scrollY: number;
        zoom?: number;
        width?: number;
        height?: number;
        midPoint?: { x: number; y: number };
        getWorldPoint?: (x: number, y: number, out?: { x: number; y: number }) => { x: number; y: number };
    },
): { x: number; y: number } {
    // 1) Authoritative camera transform (handles zoom + scroll correctly).
    if (camera && typeof camera.getWorldPoint === 'function') {
        try {
            const p = camera.getWorldPoint(pointer.x, pointer.y);
            if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
                return { x: p.x, y: p.y };
            }
        } catch {
            // fall through
        }
    }

    // 2) Phaser pointer.world* (updated from the same camera matrix when input is bound).
    if (
        typeof pointer.worldX === 'number' &&
        typeof pointer.worldY === 'number' &&
        Number.isFinite(pointer.worldX) &&
        Number.isFinite(pointer.worldY)
    ) {
        return { x: pointer.worldX, y: pointer.worldY };
    }

    // 3) Manual: midPoint + (screen - center) / zoom
    if (camera) {
        const zoom = camera.zoom && camera.zoom > 0 ? camera.zoom : 1;
        const w = camera.width ?? 0;
        const h = camera.height ?? 0;
        if (w > 0 && h > 0) {
            const midX = camera.midPoint?.x ?? camera.scrollX + w / (2 * zoom);
            const midY = camera.midPoint?.y ?? camera.scrollY + h / (2 * zoom);
            return {
                x: midX + (pointer.x - w / 2) / zoom,
                y: midY + (pointer.y - h / 2) / zoom,
            };
        }
        return { x: pointer.x + camera.scrollX, y: pointer.y + camera.scrollY };
    }
    return { x: pointer.x, y: pointer.y };
}

/**
 * Ground loot under cursor: prefer sprite hit pad (forgiving), then exact cell under pixel.
 * Returns the item whose cell the player should walk to / pick from.
 */
export function getGroundItemUnderPointer(
    groundItems: GroundItem[],
    pointer: { x: number; y: number; worldX?: number; worldY?: number },
    camera: { scrollX: number; scrollY: number; zoom?: number; width?: number; height?: number },
): GroundItem | undefined {
    const { x: worldPixelX, y: worldPixelY } = pointerWorldPixel(pointer, camera);

    // Primary: cell under cursor (authoritative ground stack position).
    const cellHit = getGroundItemUnderWorldCell(groundItems, worldPixelX, worldPixelY);
    if (cellHit) {
        return cellHit;
    }

    // Secondary: sprite bounds with generous pad — icons can straddle cell edges after scale.
    const near = getObjectsNearPixel(
        groundItems,
        (g) => {
            const bounds = g.getBounds();
            if (bounds && bounds.width > 0 && bounds.height > 0) {
                return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
            }
            return {
                x: g.worldX * TILE_SIZE + TILE_SIZE / 2,
                y: g.worldY * TILE_SIZE + TILE_SIZE / 2,
            };
        },
        worldPixelX,
        worldPixelY,
        2,
    );

    let topItem: GroundItem | undefined;
    let topDepth = -Infinity;
    // ~half tile pad so the whole visible icon (and some edge) is clickable.
    const pad = Math.max(16, TILE_SIZE / 2);
    for (const g of near) {
        const bounds = g.getBounds();
        let inBounds = false;
        if (bounds && bounds.width > 0 && bounds.height > 0) {
            inBounds =
                worldPixelX >= bounds.x - pad &&
                worldPixelX <= bounds.x + bounds.width + pad &&
                worldPixelY >= bounds.y - pad &&
                worldPixelY <= bounds.y + bounds.height + pad;
        } else {
            // Fallback: full cell under item
            const cx = g.worldX * TILE_SIZE;
            const cy = g.worldY * TILE_SIZE;
            inBounds =
                worldPixelX >= cx - pad &&
                worldPixelX < cx + TILE_SIZE + pad &&
                worldPixelY >= cy - pad &&
                worldPixelY < cy + TILE_SIZE + pad;
        }
        if (!inBounds) {
            continue;
        }
        const depth = g.getDepth();
        if (depth > topDepth) {
            topDepth = depth;
            topItem = g;
        }
    }
    return topItem;
}
