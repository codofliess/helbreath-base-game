import type { HBMap } from '../assets/HBMap';
import {
    isInteriorMapId,
    isKnownWarpCell,
    isTownMapId,
    normalizeMapId,
    resolveTeleportDestination,
} from '../../../../../sp-client/src/constants/MapTeleportLocs';
import { resolveOlympiaServerWorldTransfer, getLastOutdoorMapForInterior } from '../../utils/OlympiaTeleportResolver';

export interface MapWarpTransfer {
    worldId: string;
    mapName: string;
    spawnX: number;
    spawnY: number;
}

export class MapWarpSystem {
    private static instance: MapWarpSystem;
    private warpCooldownUntil = 0;
    private postLoadGraceUntil = 0;

    private constructor() {}

    public static getInstance(): MapWarpSystem {
        if (!MapWarpSystem.instance) {
            MapWarpSystem.instance = new MapWarpSystem();
        }
        return MapWarpSystem.instance;
    }

    /** Avoid chain-warps immediately after a map loads (spawn tiles, exit doors). */
    public beginPostLoadGrace(ms = 4000): void {
        this.postLoadGraceUntil = Date.now() + ms;
    }

    public resetForNewScene(): void {
        this.warpCooldownUntil = 0;
        this.beginPostLoadGrace();
    }

    public markWarpTriggered(): void {
        this.warpCooldownUntil = Date.now() + 2000;
    }

    /**
     * Olympia-style warp: idle on a configured teleport tile (or its doorstep).
     * Returns the multiplayer server world transfer when a warp should fire.
     */
    public checkWarp(
        map: HBMap | undefined,
        gameWorldId: string,
        mapName: string,
        tileX: number,
        tileY: number,
        isMoving: boolean,
    ): MapWarpTransfer | null {
        if (isMoving || Date.now() < this.warpCooldownUntil || Date.now() < this.postLoadGraceUntil) {
            return null;
        }

        const normalizedMapId = normalizeMapId(mapName);
        const warpCell = findNearestKnownWarpCell(normalizedMapId, tileX, tileY);
        if (!warpCell) {
            const tile = map?.getTile(tileX, tileY);
            if (tile?.isTeleport) {
                console.warn(
                    `[MapWarpSystem] Blue tile without Olympia destination: ${normalizedMapId}(${tileX},${tileY})`,
                );
            }
            return null;
        }

        const transfer = resolveOlympiaServerWorldTransfer(
            gameWorldId,
            normalizedMapId,
            warpCell.x,
            warpCell.y,
        );
        if (!transfer || transfer.worldId === gameWorldId) {
            return null;
        }

        const lastOutdoorMap = getLastOutdoorMapForInterior(gameWorldId);
        const destination = resolveTeleportDestination(
            normalizedMapId,
            warpCell.x,
            warpCell.y,
            lastOutdoorMap,
        );
        if (!destination) {
            return null;
        }

        if (isTownMapId(normalizedMapId) && isInteriorMapId(destination.targetMap)) {
            // entering interior — spawn handled by server InitialGameWorldState
        }

        return transfer;
    }
}

/**
 * Exact warp cell, or Chebyshev-1 doorstep (street south of guild/shop pads).
 * Server validates with radius 3 — doorstep matches how players stand at building doors.
 */
function findNearestKnownWarpCell(
    mapId: string,
    tileX: number,
    tileY: number,
): { x: number; y: number } | null {
    if (isKnownWarpCell(mapId, tileX, tileY)) {
        return { x: tileX, y: tileY };
    }

    let best: { x: number; y: number } | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) {
                continue;
            }
            const x = tileX + dx;
            const y = tileY + dy;
            if (!isKnownWarpCell(mapId, x, y)) {
                continue;
            }
            const dist = Math.max(Math.abs(dx), Math.abs(dy));
            if (dist < bestDist) {
                bestDist = dist;
                best = { x, y };
            }
        }
    }
    return best;
}