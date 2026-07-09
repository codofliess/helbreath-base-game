import type { HBMap } from '../assets/HBMap';
import {
    isInteriorMapId,
    isKnownWarpCell,
    isTownMapId,
    normalizeMapId,
    resolveTeleportDestination,
} from '../../../../../sp-client/src/constants/MapTeleportLocs';
import { resolveOlympiaServerWorldTransfer } from '../../utils/OlympiaTeleportResolver';

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
    public beginPostLoadGrace(ms = 1500): void {
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
     * Olympia-style warp: idle on a configured teleport tile.
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
        if (!isKnownWarpCell(normalizedMapId, tileX, tileY)) {
            const tile = map?.getTile(tileX, tileY);
            if (tile?.isTeleport) {
                console.warn(
                    `[MapWarpSystem] Blue tile without Olympia destination: ${normalizedMapId}(${tileX},${tileY})`,
                );
            }
            return null;
        }

        const transfer = resolveOlympiaServerWorldTransfer(gameWorldId, normalizedMapId, tileX, tileY);
        if (!transfer || transfer.worldId === gameWorldId) {
            return null;
        }

        const destination = resolveTeleportDestination(normalizedMapId, tileX, tileY);
        if (!destination) {
            return null;
        }

        if (isTownMapId(normalizedMapId) && isInteriorMapId(destination.targetMap)) {
            // entering interior — spawn handled by server InitialGameWorldState
        }

        return transfer;
    }
}