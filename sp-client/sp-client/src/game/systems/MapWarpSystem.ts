import { EventBus } from '../EventBus';
import type { HBMap } from '../assets/HBMap';
import {
    isInteriorMapId,
    isTownMapId,
    normalizeMapId,
    resolveTeleportDestination,
} from '../../constants/MapTeleportLocs';

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

    /** Call when a map finishes loading to avoid instant chain-warps on spawn tiles. */
    public beginPostLoadGrace(ms = 1500): void {
        this.postLoadGraceUntil = Date.now() + ms;
    }

    public resetForNewScene(): void {
        this.warpCooldownUntil = 0;
        this.beginPostLoadGrace();
    }

    /**
     * Checks whether the player is standing on a teleport tile and is idle (Helbreath: command count 0).
     */
    public checkWarp(
        map: HBMap,
        mapId: string,
        tileX: number,
        tileY: number,
        isMoving: boolean,
        lastOutdoorMap?: string,
    ): boolean {
        if (isMoving || Date.now() < this.warpCooldownUntil || Date.now() < this.postLoadGraceUntil) {
            return false;
        }

        const tile = map.getTile(tileX, tileY);
        if (!tile?.isTeleport) {
            return false;
        }

        const normalizedMapId = normalizeMapId(mapId);
        const destination = resolveTeleportDestination(normalizedMapId, tileX, tileY, lastOutdoorMap);
        if (!destination) {
            console.warn(
                `[MapWarpSystem] Teleport tile sin destino: map="${normalizedMapId}" pos=(${tileX}, ${tileY})`,
            );
            return false;
        }

        console.log(
            `🚪 WARP → ${normalizedMapId}(${tileX},${tileY}) → ${destination.targetMap}(${destination.targetX},${destination.targetY})`,
        );
        this.warpCooldownUntil = Date.now() + 2000;
        EventBus.emit('change-map', {
            targetMap: destination.targetMap,
            targetX: destination.targetX,
            targetY: destination.targetY,
            fromTownMap: isTownMapId(normalizedMapId) ? normalizedMapId : undefined,
            enteringInterior: isTownMapId(normalizedMapId) && isInteriorMapId(destination.targetMap),
        });
        return true;
    }
}