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
    enterPlayWorldPhase,
    openConnectDialogForLogin,
    setConnectDialogOpen,
    setConnectGatePhase,
    setConnectWalletSession,
} from '../../ui/store/ConnectDialog.store';
import { getPreferredInitialWorldId } from '../../utils/playerMode';
import { clearWalletDeepLink, consumeWalletDeepLink, getStoredWalletPubkey } from '../../utils/walletAuth';
import { forceClearLoginDeskCanvasPresentation } from '../ui/loginDeskPresentation';
import { SelectCharDesk } from '../ui/SelectCharDesk';
import { CreateCharDesk } from '../ui/CreateCharDesk';
import { ArenaSelectCharDesk } from '../ui/ArenaSelectCharDesk';
import { loadArenaKits } from '../../utils/arenaKits';
import { toClientMapFileName } from '../../utils/MapAssets';

/**
 * Login screen. Hub is React; after Enter Helbreath World / Arena, Phaser owns the
 * SELECTCHAR desks. Transitions to GameWorld after connect.
 */
export class LoginScreen extends Scene {
    private backgroundImage!: Phaser.GameObjects.Image;
    private selectCharDesk: SelectCharDesk | undefined;
    private createCharDesk: CreateCharDesk | undefined;
    private arenaSelectCharDesk: ArenaSelectCharDesk | undefined;
    private storeUnsubscribe: (() => void) | undefined;
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
        this.teardownDesks();
        this.isConnecting = false;

        this.cameras.main.setBackgroundColor(0x000000);
        document.body.classList.remove('game-world-active');

        const width = this.scale.width;
        const height = this.scale.height;
        const loginBgKey = getLoginScreenBgKey(this);

        // Hub atmosphere only — SELECTCHAR / Create Character replace this when open.
        if (loginBgKey && this.textures.exists(loginBgKey)) {
            this.backgroundImage = this.add.image(width / 2, height / 2, loginBgKey);
            const scaleX = width / this.backgroundImage.width;
            const scaleY = height / this.backgroundImage.height;
            const scale = Math.max(scaleX, scaleY) * 1.18;
            this.backgroundImage.setScale(scale);
            this.backgroundImage.setDepth(0);
        }

        createGameStateManager(this.game);

        this.events.once('shutdown', () => {
            this.clearPendingInitialGameWorldStateListener();
            this.clearLoginPendingDisconnectListener();
            this.clearConnectToServerListener();
            this.clearPrefetchPlayerItemAppearanceListener();
            this.teardownDesks();
            this.isConnecting = false;
            setConnectingDialogOpen(false);
            setConnectDialogOpen(false);
        });
    }

    public create() {
        const gsm = getGameStateManager(this.game);

        // Desks + store subscription first so play-world phase is applied onto SELECTCHAR.
        this.ensureDesks();

        // Landing Play Now: ?wallet=&token=&mode=world → character list (SELECTCHAR).
        // Deep-link stays in sessionStorage until desk is shown (Strict Mode safe).
        const deepLink = consumeWalletDeepLink();
        if (deepLink) {
            gsm.setWalletSession(
                deepLink.session.wallet,
                deepLink.session.token,
                deepLink.session.expiresAt,
            );
            if (deepLink.mode === 'world') {
                console.info('[LoginScreen] Entering SELECTCHAR from landing deep link');
                enterPlayWorldPhase(deepLink.session);
            } else if (deepLink.mode === 'arena') {
                // Arena entry gated until kit builder ships (see ArenaGate.ts).
                setConnectWalletSession(deepLink.session);
                openConnectDialogForLogin(gsm.getCharacterName() ?? '');
                console.info('[LoginScreen] Arena deep link ignored — arena entry closed');
            } else {
                setConnectWalletSession(deepLink.session);
                openConnectDialogForLogin(gsm.getCharacterName() ?? '');
            }
        } else {
            openConnectDialogForLogin(gsm.getCharacterName() ?? '');
        }

        this.syncDesksFromStore();
        // Re-apply after React ConnectDialog mounts + canvas presentation settles.
        this.time.delayedCall(80, () => this.syncDesksFromStore());
        this.time.delayedCall(350, () => {
            this.syncDesksFromStore();
            // Desk is up — drop deep-link so refresh doesn't re-enter mid-session oddly.
            if (connectDialogStore.state.phase === 'play-world') {
                clearWalletDeepLink();
            }
        });
        this.time.delayedCall(900, () => this.syncDesksFromStore());
        // Safety: never leave a black stage if SELECTCHAR failed to appear.
        this.time.delayedCall(2000, () => {
            const st = connectDialogStore.state;
            if (st.isOpen && st.phase === 'play-world' && !this.selectCharDesk) {
                console.warn('[LoginScreen] SELECTCHAR missing after deep link — rebuilding desks');
                this.ensureDesks();
                this.syncDesksFromStore();
            }
        });

        const handleConnectToServer = async (payload: ConnectToServerPayload) => {
            if (this.isConnecting) {
                return;
            }

            this.isConnecting = true;
            clearPendingPlayerItemAppearancePrefetch(this.game);
            this.clearPendingInitialGameWorldStateListener();
            setConnectingDialogOpen(true);
            // Destroy desks immediately so SELECTCHAR never composites under GameWorld / City Select.
            this.destroyDeskInstances();
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
                this.isConnecting = false;
                setConnectingDialogOpen(false);
                setConnectDialogOpen(true);
                setNetworkManager(this.game, undefined);
                this.ensureDesks();
                this.syncDesksFromStore();
                // Name-taken / auth errors also arrive as SERVER_MESSAGE_RECEIVED (toast).
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
                    mapName: toClientMapFileName(data.mapName, data.gameWorldId),
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
                this.destroyDeskInstances();
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
                this.isConnecting = false;
                setConnectingDialogOpen(false);
                setConnectDialogOpen(true);
                this.ensureDesks();
                this.syncDesksFromStore();
                console.error('[LoginScreen] Failed to connect to the server.', error);
                setNetworkManager(this.game, undefined);
            }
        };

        this.connectToServerHandler = handleConnectToServer;
        EventBus.on(IN_UI_CONNECT_TO_SERVER, handleConnectToServer);

        const queuePrefetch = (prefetch: PlayerItemAppearancePrefetchEventData) => {
            appendPendingPlayerItemAppearancePrefetch(this.game, prefetch.spriteNames);
        };
        this.prefetchPlayerItemAppearanceHandler = queuePrefetch;
        EventBus.on(PLAYER_ITEM_APPEARANCE_PREFETCH_REQUESTED, queuePrefetch);

        EventBus.emit(CURRENT_SCENE_READY, this);
    }

    /** Mirrors connectDialogStore desk phases onto Phaser SELECTCHAR / Create / Arena. */
    private syncDesksFromStore(): void {
        // Recreate after destroyDeskInstances (connect attempt) — never leave play-world with
        // hub unmounted and no desks (black login-selectchar stage / empty camera).
        if (!this.selectCharDesk || !this.createCharDesk || !this.arenaSelectCharDesk) {
            if (this.isConnecting) {
                return;
            }
            this.ensureDesks();
        }

        const selectDesk = this.selectCharDesk;
        const createDesk = this.createCharDesk;
        const arenaDesk = this.arenaSelectCharDesk;
        // World SELECTCHAR only needs selectDesk; arena/create optional if construct failed.
        if (!selectDesk && !createDesk && !arenaDesk) {
            return;
        }

        const state = connectDialogStore.state;
        const showSelect = state.isOpen && state.phase === 'play-world' && !this.isConnecting;
        const showCreate = state.isOpen && state.phase === 'create-char' && !this.isConnecting;
        const showArena = state.isOpen && state.phase === 'arena-lobby' && !this.isConnecting;

        // Activate the incoming desk before hiding the others so shared canvas presentation
        // does not briefly restore 800×600 between SELECTCHAR ↔ Create Character ↔ Arena.
        if (showCreate && createDesk) {
            createDesk.setVisible(true, state.selectedSlotIndex);
            selectDesk?.setVisible(false);
            arenaDesk?.setVisible(false);
        } else if (showSelect && selectDesk) {
            selectDesk.setVisible(true);
            createDesk?.setVisible(false);
            arenaDesk?.setVisible(false);
            selectDesk.setCharacterSlots(state.characterSlots);
            selectDesk.setSelectedSlotIndex(state.selectedSlotIndex);
            selectDesk.setLoading(state.characterListLoading);
        } else if (showArena && arenaDesk) {
            arenaDesk.setVisible(true);
            selectDesk?.setVisible(false);
            createDesk?.setVisible(false);
            // Pre-Ready arena kits — same CL full-bleed list as World SELECTCHAR.
            const wallet =
                state.walletSession?.wallet?.trim() || getStoredWalletPubkey()?.trim() || undefined;
            arenaDesk.setKits(loadArenaKits(wallet));
            arenaDesk.setSelectedDeskIndex(state.arenaDeskIndex);
        } else {
            selectDesk?.setVisible(false);
            createDesk?.setVisible(false);
            arenaDesk?.setVisible(false);
        }

        if (this.backgroundImage) {
            this.backgroundImage.setVisible(!showSelect && !showCreate && !showArena);
        }
    }

    /** Creates SELECTCHAR / Create / Arena desks and store subscription if missing. */
    private ensureDesks(): void {
        // Create independently so one desk constructor crash cannot kill World SELECTCHAR.
        if (!this.selectCharDesk) {
            try {
                this.selectCharDesk = new SelectCharDesk(this);
            } catch (err) {
                console.error('[LoginScreen] SelectCharDesk failed to construct', err);
            }
        }
        if (!this.createCharDesk) {
            try {
                this.createCharDesk = new CreateCharDesk(this);
            } catch (err) {
                console.error('[LoginScreen] CreateCharDesk failed to construct', err);
            }
        }
        if (!this.arenaSelectCharDesk) {
            try {
                this.arenaSelectCharDesk = new ArenaSelectCharDesk(this);
            } catch (err) {
                console.error('[LoginScreen] ArenaSelectCharDesk failed to construct', err);
            }
        }
        if (!this.storeUnsubscribe) {
            this.storeUnsubscribe = connectDialogStore.subscribe(() => {
                this.syncDesksFromStore();
            });
        }
    }

    /** Destroys desk GameObjects and restores canvas; keeps the store subscription for reconnect. */
    private destroyDeskInstances(): void {
        this.selectCharDesk?.destroy();
        this.selectCharDesk = undefined;
        this.createCharDesk?.destroy();
        this.createCharDesk = undefined;
        this.arenaSelectCharDesk?.destroy();
        this.arenaSelectCharDesk = undefined;
        forceClearLoginDeskCanvasPresentation(this);
    }

    private teardownDesks(): void {
        this.storeUnsubscribe?.();
        this.storeUnsubscribe = undefined;
        this.destroyDeskInstances();
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
