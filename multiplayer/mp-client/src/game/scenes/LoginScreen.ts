import { Scene } from 'phaser';
import {
    appendPendingPlayerItemAppearancePrefetch,
    clearPendingPlayerItemAppearancePrefetch,
    createGameStateManager,
    getGameStateManager,
    getInventoryManager,
    getLoginScreenBgKey,
    setInitialGameWorldState,
    setNetworkManager,
} from '../../utils/RegistryUtils';
import {
    CURRENT_SCENE_READY,
    INITIAL_GAME_WORLD_STATE_RECEIVED,
    IN_UI_CONNECT_TO_SERVER,
    OUT_UI_SET_SELECTED_MAP,
    PLAYER_ITEM_APPEARANCE_PREFETCH_REQUESTED,
    SOCKET_DISCONNECTED,
} from '../../constants/EventNames';
import type { ConnectToServerPayload, PlayerItemAppearancePrefetchEventData } from '../../constants/EventNames';
import { EventBus } from '../EventBus';
import { NetworkManager } from '../../utils/NetworkManager';
import type { InitialGameWorldStateEventData } from '../../Types';
import { setConnectingDialogOpen } from '../../ui/store/ConnectingDialog.store';
import {
    connectDialogStore,
    setConnectDialogOpen,
    takePendingWorldEnter,
    setConnectGatePhase,
    clearPhaserWorldSession,
} from '../../ui/store/ConnectDialog.store';
import { getPreferredInitialWorldId } from '../../utils/playerMode';
import { catalogAmdFileName } from '../../utils/mapCatalogLookup';
import { forceClearLoginDeskCanvasPresentation } from '../ui/loginDeskPresentation';

/**
 * Phaser login scene is connect-only. Hub / SELECTCHAR / Arena stay React.
 * Do not import SelectCharDesk / CreateCharDesk / ArenaSelectCharDesk here —
 * those constructors plus paper-doll `.spr` decode are the KindGem Error 9
 * path if this scene ever boots before Occupied paints.
 */
export class LoginScreen extends Scene {
    private backgroundImage!: Phaser.GameObjects.Image;
    private isConnecting = false;
    private pendingInitialGameWorldStateListener: ((data: InitialGameWorldStateEventData) => void) | undefined;
    /** When set, login is waiting for initial state after TCP connect; auth failure closes the socket first. */
    private loginPendingDisconnectHandler: (() => void) | undefined;
    private connectToServerHandler: ((payload: ConnectToServerPayload) => void) | undefined;
    private prefetchPlayerItemAppearanceHandler: ((payload: PlayerItemAppearancePrefetchEventData) => void) | undefined;

    constructor() {
        super('LoginScreen');
    }

    public init() {
        this.clearPendingInitialGameWorldStateListener();
        this.clearLoginPendingDisconnectListener();
        this.clearConnectToServerListener();
        this.isConnecting = false;

        this.cameras.main.setBackgroundColor(0x000000);
        document.body.classList.remove('game-world-active', 'helbreath-game-active');

        const width = this.scale.width;
        const height = this.scale.height;
        const loginBgKey = getLoginScreenBgKey(this);

        if (loginBgKey && this.textures.exists(loginBgKey)) {
            this.backgroundImage = this.add.image(width / 2, height / 2, loginBgKey);
            const scaleX = width / this.backgroundImage.width;
            const scaleY = height / this.backgroundImage.height;
            const scale = Math.max(scaleX, scaleY) * 1.18;
            this.backgroundImage.setScale(scale);
            this.backgroundImage.setDepth(0);
            this.backgroundImage.setVisible(false);
        }

        createGameStateManager(this.game);
        forceClearLoginDeskCanvasPresentation(this);

        this.events.once('shutdown', () => {
            this.clearPendingInitialGameWorldStateListener();
            this.clearLoginPendingDisconnectListener();
            this.clearConnectToServerListener();
            this.clearPrefetchPlayerItemAppearanceListener();
            this.isConnecting = false;
            setConnectingDialogOpen(false);
        });
    }

    public create() {
        const gsm = getGameStateManager(this.game);
        setConnectDialogOpen(false);
        forceClearLoginDeskCanvasPresentation(this);
        console.info('[LoginScreen] Phaser ready for queued world enter (no SELECTCHAR desks)');

        const returnToReactSelectChar = () => {
            this.isConnecting = false;
            setConnectingDialogOpen(false);
            setConnectGatePhase('play-world');
            clearPhaserWorldSession();
            setConnectDialogOpen(true);
            setNetworkManager(this.game, undefined);
        };

        const handleConnectToServer = async (payload: ConnectToServerPayload) => {
            if (this.isConnecting) {
                return;
            }

            this.isConnecting = true;
            clearPendingPlayerItemAppearancePrefetch(this.game);
            this.clearPendingInitialGameWorldStateListener();
            setConnectingDialogOpen(true);
            forceClearLoginDeskCanvasPresentation(this);
            if (this.backgroundImage) {
                this.backgroundImage.setVisible(false);
            }

            const handleSocketDisconnectedDuringLogin = () => {
                if (!this.pendingInitialGameWorldStateListener) {
                    return;
                }
                this.clearPendingInitialGameWorldStateListener();
                this.clearLoginPendingDisconnectListener();
                returnToReactSelectChar();
                console.warn('[LoginScreen] Connection closed before initial game world state (e.g. auth rejected / name taken).');
            };

            const handleInitialGameWorldStateReceived = (data: InitialGameWorldStateEventData) => {
                this.clearLoginPendingDisconnectListener();
                this.pendingInitialGameWorldStateListener = undefined;
                this.isConnecting = false;
                setConnectingDialogOpen(false);
                gsm.setCharacterName(payload.characterName);
                setInitialGameWorldState(this.game, {
                    gameWorldId: data.gameWorldId,
                    mapName: catalogAmdFileName(data.mapName),
                    musicFile: data.musicFile || undefined,
                    playerX: data.playerX,
                    playerY: data.playerY,
                    playerId: data.playerId,
                    movementSpeedMs: data.movementSpeedMs,
                    runMode: data.runMode,
                    attackMode: data.attackMode,
                    safeAttackMode: data.safeAttackMode,
                    citizenshipSide: data.citizenshipSide,
                    teleportLocs: data.teleportLocs,
                    attackRangeCells: data.attackRangeCells,
                    attackDamage: data.attackDamage,
                    attackSpeedMs: data.attackSpeedMs,
                    attackStunDurationMs: data.attackStunDurationMs,
                    castSpeedMs: data.castSpeedMs,
                    arrowSpeedPxPerSec: data.arrowSpeedPxPerSec,
                    hp: data.hp,
                    maxHp: data.maxHp,
                    playerPickupAnimationTimeMs: data.playerPickupAnimationTimeMs,
                    playerBowAnimationDurationMs: data.playerBowAnimationDurationMs,
                    dead: data.dead,
                    playerDirection: data.playerDirection,
                    gender: data.gender,
                    skinColor: data.skinColor,
                    hairStyleIndex: data.hairStyleIndex,
                    underwearColorIndex: data.underwearColorIndex,
                    weather: data.weather,
                });
                if (data.gameWorldId) {
                    EventBus.emit(OUT_UI_SET_SELECTED_MAP, data.gameWorldId);
                }
                getInventoryManager(this.game);
                forceClearLoginDeskCanvasPresentation(this);
                this.scene.start('GameWorld');
            };

            this.pendingInitialGameWorldStateListener = handleInitialGameWorldStateReceived;
            EventBus.once(INITIAL_GAME_WORLD_STATE_RECEIVED, handleInitialGameWorldStateReceived);

            if (payload.walletSession) {
                gsm.setWalletSession(
                    payload.walletSession.wallet,
                    payload.walletSession.token,
                    payload.walletSession.expiresAt,
                );
            }

            const networkManager = new NetworkManager(gsm.getNetworkId(), gsm.getAuthToken());
            setNetworkManager(this.game, networkManager);

            try {
                await networkManager.connect(
                    payload.host,
                    payload.port,
                    payload.characterName,
                    payload.walletSession?.token,
                    payload.preferredInitialWorldId ?? getPreferredInitialWorldId(),
                    payload.slotIndex,
                    {
                        gender: payload.gender,
                        skinColor: payload.skinColor,
                        hairStyleIndex: payload.hairStyleIndex,
                        underwearColorIndex: payload.underwearColorIndex,
                        str: payload.str,
                        vit: payload.vit,
                        dex: payload.dex,
                        int: payload.int,
                        mag: payload.mag,
                        chr: payload.chr,
                    },
                    payload.arenaKitJson,
                );
                this.loginPendingDisconnectHandler = handleSocketDisconnectedDuringLogin;
                EventBus.on(SOCKET_DISCONNECTED, handleSocketDisconnectedDuringLogin);
            } catch (error) {
                this.clearPendingInitialGameWorldStateListener();
                this.clearLoginPendingDisconnectListener();
                console.error('[LoginScreen] Failed to connect to the server.', error);
                returnToReactSelectChar();
            }
        };

        this.connectToServerHandler = handleConnectToServer;
        EventBus.on(IN_UI_CONNECT_TO_SERVER, handleConnectToServer);

        const queued = takePendingWorldEnter();
        if (queued && connectDialogStore.state.phase === 'entering-world') {
            void handleConnectToServer(queued);
        }

        const queuePrefetch = (prefetch: PlayerItemAppearancePrefetchEventData) => {
            appendPendingPlayerItemAppearancePrefetch(this.game, prefetch.spriteNames);
        };
        this.prefetchPlayerItemAppearanceHandler = queuePrefetch;
        EventBus.on(PLAYER_ITEM_APPEARANCE_PREFETCH_REQUESTED, queuePrefetch);

        EventBus.emit(CURRENT_SCENE_READY, this);
    }

    private clearConnectToServerListener(): void {
        if (!this.connectToServerHandler) {
            return;
        }

        EventBus.off(IN_UI_CONNECT_TO_SERVER, this.connectToServerHandler);
        this.connectToServerHandler = undefined;
    }

    private clearPendingInitialGameWorldStateListener(): void {
        if (!this.pendingInitialGameWorldStateListener) {
            return;
        }

        EventBus.off(INITIAL_GAME_WORLD_STATE_RECEIVED, this.pendingInitialGameWorldStateListener);
        this.pendingInitialGameWorldStateListener = undefined;
    }

    private clearLoginPendingDisconnectListener(): void {
        if (!this.loginPendingDisconnectHandler) {
            return;
        }

        EventBus.off(SOCKET_DISCONNECTED, this.loginPendingDisconnectHandler);
        this.loginPendingDisconnectHandler = undefined;
    }

    private clearPrefetchPlayerItemAppearanceListener(): void {
        if (!this.prefetchPlayerItemAppearanceHandler) {
            return;
        }

        EventBus.off(PLAYER_ITEM_APPEARANCE_PREFETCH_REQUESTED, this.prefetchPlayerItemAppearanceHandler);
        this.prefetchPlayerItemAppearanceHandler = undefined;
    }
}
