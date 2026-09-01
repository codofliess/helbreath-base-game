import { useRef, useState, useEffect } from 'react';
import { useStore } from '@tanstack/react-store';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { toast } from 'react-toastify';
import type { Id } from 'react-toastify';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { ControlsDialog } from './ui/dialogs/ControlsDialog';
import { MapDialog } from './ui/dialogs/MapDialog';
import { CameraDialog } from './ui/dialogs/CameraDialog';
import { AssetDebugOverlay } from './ui/overlays/AssetDebugOverlay';
import { InventoryItemHoverOverlay } from './ui/overlays/InventoryItemHoverOverlay';
import { MonsterHoverOverlay } from './ui/overlays/MonsterHoverOverlay';
import { NpcHoverOverlay } from './ui/overlays/NpcHoverOverlay';
import { PlayerHoverOverview } from './ui/overlays/PlayerHoverOverview';
import { QuestTrackerHud } from './ui/overlays/QuestTrackerHud';
import { SystemLogOverlay } from './ui/overlays/SystemLogOverlay';
import { ChatComposeBar } from './ui/overlays/ChatComposeBar';
import { ChatWorldLog } from './ui/overlays/ChatWorldLog';
import { CornerMinimapHud } from './ui/overlays/CornerMinimapHud';
import { HudTutorialOverlay } from './ui/overlays/HudTutorialOverlay';
import { TestnetHud } from './ui/overlays/TestnetHud';
import { tryStartHudTutorial } from './ui/store/HudTutorial.store';
import { progressionStore } from './ui/store/Progression.store';
import {
    discordPresenceClear,
    discordPresenceEnterWorld,
    installDiscordPresenceLifecycle,
} from './utils/DiscordPresence';
import { SoundDialog } from './ui/dialogs/SoundDialog';
import { MonsterDialog } from './ui/dialogs/MonsterDialog';
import { NPCDialog } from './ui/dialogs/NPCDialog';
import { EffectDialog } from './ui/dialogs/EffectDialog';
import { CastDialog } from './ui/dialogs/CastDialog';
import { PlayerDialog } from './ui/dialogs/PlayerDialog';
import { CharacterDialog } from './ui/dialogs/CharacterDialog';
import { InventoryDialog } from './ui/dialogs/InventoryDialog';
import { HotkeyBar } from './ui/components/HotkeyBar';
import { ItemDialog } from './ui/dialogs/ItemDialog';
import { ServerDialog } from './ui/dialogs/ServerDialog';
import { PerformanceDialog } from './ui/dialogs/PerformanceDialog';
import { ConnectDialog } from './ui/dialogs/ConnectDialog';
import { ReferralCharListPanel } from './ui/components/ReferralCharListPanel';
import { DeskModeJumpTab } from './ui/components/DeskModeJumpTab';
import { BleedingOnlineStrip } from './ui/components/BleedingOnlineStrip';
import { CitySelectDialog } from './ui/dialogs/CitySelectDialog';
import { ShopDialog } from './ui/dialogs/ShopDialog';
import { MagicShopDialog } from './ui/dialogs/MagicShopDialog';
import { CashShopDialog } from './ui/dialogs/CashShopDialog';
import { WarehouseDialog } from './ui/dialogs/WarehouseDialog';
import { BlacksmithDialog } from './ui/dialogs/BlacksmithDialog';
import { NpcTalkDialog } from './ui/dialogs/NpcTalkDialog';
import { DeathDialog } from './ui/dialogs/DeathDialog';
import { ConnectingDialog } from './ui/dialogs/ConnectingDialog';
import { ServerMessageDialog } from './ui/dialogs/ServerMessageDialog';
import { ChatDialog } from './ui/dialogs/ChatDialog';
import { SkillDialog } from './ui/dialogs/SkillDialog';
import { EnchantBagDialog } from './ui/dialogs/EnchantBagDialog';
import { SysMenuDialog } from './ui/dialogs/SysMenuDialog';
import { MobKillsDialog } from './ui/dialogs/MobKillsDialog';
import { TournamentDialog } from './ui/dialogs/TournamentDialog';
import { ArenaPactDialog } from './ui/dialogs/ArenaPactDialog';
import { DuelWatchDialog } from './ui/dialogs/DuelWatchDialog';
import { openDuelWatch } from './ui/store/DuelWatch.store';
import { ArenaKitBuilderDialog } from './ui/dialogs/ArenaKitBuilderDialog';
import { TrainingDialog } from './ui/dialogs/TrainingDialog';
import { AuctionBoardDialog } from './ui/dialogs/AuctionBoardDialog';
import { GuildWarehouseDialog } from './ui/dialogs/GuildWarehouseDialog';
import { AntiBotToolsDialog } from './ui/dialogs/AntiBotToolsDialog';
import { EventBus, type ToastRequestedEvent } from './game/EventBus';
import {
    CURRENT_SCENE_READY,
    IN_UI_CHANGE_MAP,
    OUT_MAP_LOADED,
    OUT_UI_OPEN_MAGIC_SHOP,
    OUT_UI_OPEN_CASH_SHOP,
    OUT_UI_OPEN_SHOP,
    OUT_UI_OPEN_BLACKSMITH,
    OUT_UI_OPEN_WAREHOUSE,
    OUT_UI_OPEN_NPC_TALK,
    TOAST_DISMISS_LOGOUT_COUNTDOWN,
    TOAST_REQUESTED,
} from './constants/EventNames';
import { DIALOG_START_X, DIALOG_START_Y } from './Config';
import { mapDialogStore, setMapDialogOpen } from './ui/store/MapDialog.store';
import { cameraDialogStore, setCameraDialogOpen } from './ui/store/CameraDialog.store';
import { setMinimapDialogOpen } from './ui/store/MinimapDialog.store';
import { setGuideMapEnabled } from './ui/store/SysMenuDialog.store';
import { soundDialogStore, setSoundDialogOpen } from './ui/store/SoundDialog.store';
import { monsterDialogStore } from './ui/store/MonsterDialog.store';
import { npcDialogStore } from './ui/store/NPCDialog.store';
import { effectDialogStore } from './ui/store/EffectDialog.store';
import { castDialogStore } from './ui/store/CastDialog.store';
import { controlsDialogStore, setControlsDialogOpen } from './ui/store/ControlsDialog.store';
import { playerDialogStore, setPlayerDialogOpen } from './ui/store/PlayerDialog.store';
import { characterDialogStore, setCharacterDialogOpen } from './ui/store/CharacterDialog.store';
import {
    citySelectDialogStore,
    setCitySelectDialogOpen,
} from './ui/store/CitySelectDialog.store';
import { openShopDialog, shopDialogStore } from './ui/store/ShopDialog.store';
import { magicShopDialogStore, setMagicShopOpen } from './ui/store/MagicShopDialog.store';
import { cashShopDialogStore, openCashShopDialog } from './ui/store/CashShopDialog.store';
import { openWarehouseDialog, warehouseDialogStore } from './ui/store/WarehouseDialog.store';
import { openBlacksmithDialog, blacksmithDialogStore } from './ui/store/BlacksmithDialog.store';
import { openNpcTalkDialog, npcTalkDialogStore, type NpcTalkRole } from './ui/store/NpcTalkDialog.store';
import { getNetworkManager } from './utils/RegistryUtils';
import { getTravelerWorldId, isTravelerPlayerMode, showGmSandboxUi } from './utils/playerMode';
import { inventoryDialogStore, setInventoryDialogOpen } from './ui/store/InventoryDialog.store';
import { arenaSlimModeStore } from './ui/store/ArenaSlimMode.store';
import { itemDialogStore, setItemDialogOpen } from './ui/store/ItemDialog.store';
import { serverDialogStore, setServerDialogOpen } from './ui/store/ServerDialog.store';
import { performanceDialogStore, setPerformanceDialogOpen } from './ui/store/PerformanceDialog.store';
import { appStore, setCursorSpriteKey } from './ui/store/App.store';
import { CURSOR_GRAB_1, CURSOR_GRAB_2 } from './constants/SpriteKeys';
import { buildCssCursorValue, type CombatCursorMode } from './utils/CursorPresentation';
import { deathDialogStore } from './ui/store/DeathDialog.store';
import { connectingDialogStore } from './ui/store/ConnectingDialog.store';
import { connectDialogStore } from './ui/store/ConnectDialog.store';
import { serverMessageDialogStore, setServerMessageDialogOpen } from './ui/store/ServerMessageDialog.store';
import { chatDialogStore, setChatDialogOpen } from './ui/store/ChatDialog.store';

const DIALOG_STACK_POSITION = { x: DIALOG_START_X, y: DIALOG_START_Y };
/** Position for dialogs opened from Controls - placed next to ControlsDialog (min-width 350px at x=20), ~310px from left */
const CHILD_DIALOG_POSITION = { x: 310, y: DIALOG_START_Y };
const CONNECTING_DIALOG_Z_INDEX = 9999;
const SERVER_MESSAGE_DIALOG_Z_INDEX = 19000;

/** Stashed id for the logout countdown info toast; cleared when dismissed or countdown ends. */
let logoutCountdownToastId: Id | undefined;

function App()
{
    // PhaserGame ref — exposes `game` and active `scene`
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [dialogPosition, setDialogPosition] = useState(DIALOG_STACK_POSITION);
    const [mapDialogPosition, setMapDialogPosition] = useState(CHILD_DIALOG_POSITION);
    const [cameraDialogPosition, setCameraDialogPosition] = useState(CHILD_DIALOG_POSITION);
    const [playerDialogPosition, setPlayerDialogPosition] = useState(CHILD_DIALOG_POSITION);
    const [characterDialogPosition, setCharacterDialogPosition] = useState(CHILD_DIALOG_POSITION);
    const [soundDialogPosition, setSoundDialogPosition] = useState(CHILD_DIALOG_POSITION);
    const [monsterDialogPosition, setMonsterDialogPosition] = useState(CHILD_DIALOG_POSITION);
    const [npcDialogPosition, setNPCDialogPosition] = useState(CHILD_DIALOG_POSITION);
    const [effectDialogPosition, setEffectDialogPosition] = useState(CHILD_DIALOG_POSITION);
    const [castDialogPosition, setCastDialogPosition] = useState(CHILD_DIALOG_POSITION);
    const [inventoryDialogPosition, setInventoryDialogPosition] = useState(CHILD_DIALOG_POSITION);
    const [itemDialogPosition, setItemDialogPosition] = useState(CHILD_DIALOG_POSITION);
    const [serverDialogPosition, setServerDialogPosition] = useState(CHILD_DIALOG_POSITION);
    const [performanceDialogPosition, setPerformanceDialogPosition] = useState(CHILD_DIALOG_POSITION);
    const [chatDialogPosition, setChatDialogPosition] = useState(CHILD_DIALOG_POSITION);
    const [olympiaMenuPosition, setOlympiaMenuPosition] = useState(CHILD_DIALOG_POSITION);
    const [connectingDialogPosition, setConnectingDialogPosition] = useState(() => {
        if (typeof window === 'undefined') {
            return { x: 0, y: 0 };
        }
        const dialogWidth = 280;
        const dialogHeight = 80;
        return {
            x: Math.max(0, (window.innerWidth - dialogWidth) / 2),
            y: Math.max(0, (window.innerHeight - dialogHeight) / 2)
        };
    });
    const [serverMessageDialogPosition, setServerMessageDialogPosition] = useState(() => {
        if (typeof window === 'undefined') {
            return { x: 0, y: 0 };
        }
        const dialogWidth = 400;
        const dialogHeight = 120;
        return {
            x: Math.max(0, (window.innerWidth - dialogWidth) / 2),
            y: Math.max(0, (window.innerHeight - dialogHeight) / 2)
        };
    });
    // Z-index state for bringing dialogs to front
    const [dialogZIndex, setDialogZIndex] = useState(10000);
    const [mapDialogZIndex, setMapDialogZIndex] = useState(10001);
    const [cameraDialogZIndex, setCameraDialogZIndex] = useState(10002);
    const [playerDialogZIndex, setPlayerDialogZIndex] = useState(10003);
    const [characterDialogZIndex, setCharacterDialogZIndex] = useState(10003);
    const [soundDialogZIndex, setSoundDialogZIndex] = useState(10005);
    const [monsterDialogZIndex, setMonsterDialogZIndex] = useState(10006);
    const [npcDialogZIndex, setNPCDialogZIndex] = useState(10007);
    const [effectDialogZIndex, setEffectDialogZIndex] = useState(10008);
    const [castDialogZIndex, setCastDialogZIndex] = useState(10009);
    const [inventoryDialogZIndex, setInventoryDialogZIndex] = useState(10010);
    const [itemDialogZIndex, setItemDialogZIndex] = useState(10011);
    const [serverDialogZIndex, setServerDialogZIndex] = useState(10014);
    const [performanceDialogZIndex, setPerformanceDialogZIndex] = useState(10016);
    const [chatDialogZIndex, setChatDialogZIndex] = useState(10019);
    const [olympiaMenuZIndex, setOlympiaMenuZIndex] = useState(10020);
    const [deathDialogZIndex, setDeathDialogZIndex] = useState(10013);
    const [connectDialogZIndex, setConnectDialogZIndex] = useState(10018);
    const nextZIndexRef = useRef(10020);
    const showControlsDialog = useStore(controlsDialogStore, (state) => state.isOpen);
    const showMapDialog = useStore(mapDialogStore, (state) => state.isOpen);
    const showCameraDialog = useStore(cameraDialogStore, (state) => state.isOpen);
    const showPlayerDialog = useStore(playerDialogStore, (state) => state.isOpen);
    const showCharacterDialog = useStore(characterDialogStore, (state) => state.isOpen);
    const showSoundDialog = useStore(soundDialogStore, (state) => state.isOpen);
    const showMonsterDialog = useStore(monsterDialogStore, (state) => state.isOpen);
    const showNPCDialog = useStore(npcDialogStore, (state) => state.isOpen);
    const showEffectDialog = useStore(effectDialogStore, (state) => state.isOpen);
    const showCastDialog = useStore(castDialogStore, (state) => state.isOpen);
    const showInventoryDialog = useStore(inventoryDialogStore, (state) => state.isOpen);
    const showItemDialog = useStore(itemDialogStore, (state) => state.isOpen);
    const showServerDialog = useStore(serverDialogStore, (state) => state.isOpen);
    const showPerformanceDialog = useStore(performanceDialogStore, (state) => state.isOpen);
    const showChatDialog = useStore(chatDialogStore, (state) => state.isOpen);
    const chatMessages = useStore(chatDialogStore, (state) => state.messages);
    const showDeathDialog = useStore(deathDialogStore, (state) => state.isOpen);
    const showConnectingDialog = useStore(connectingDialogStore, (state) => state.isOpen);
    const showConnectDialog = useStore(connectDialogStore, (state) => state.isOpen);
    const showCitySelectDialog = useStore(citySelectDialogStore, (state) => state.isOpen);
    const showServerMessageDialog = useStore(serverMessageDialogStore, (state) => state.isOpen);
    const serverMessageDialogMessage = useStore(serverMessageDialogStore, (state) => state.message);
    const spriteFrameMap = useStore(appStore, (state) => state.spriteFrameMap);
    const cursorSpriteKey = useStore(appStore, (state) => state.cursorSpriteKey);
    const cursorImage = spriteFrameMap.get(cursorSpriteKey);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    /** True only while Phaser GameWorld is the active scene — never during SELECTCHAR / hub. */
    const [isInGameWorld, setIsInGameWorld] = useState(false);
    const travelerMode = isTravelerPlayerMode();
    const gmSandboxUi = showGmSandboxUi();
    /** World HUDs (dock, minimap, quest log) must never paint over login desks. */
    const showWorldHud = isMapLoaded && isInGameWorld;
    /** Duel-focused HUD: bag + combat only (see ArenaSlimMode.store). */
    const arenaSlim = useStore(
        arenaSlimModeStore,
        (s) => s.forceEnabled || s.worldIsArena,
    );
    const showFullWorldChrome = showWorldHud && !arenaSlim;

    const dialogDragSensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 4 },
        }),
    );

    const hasInitialMapLoadRef = useRef(false);
    const [citySelectDialogPosition] = useState({ x: Math.max(40, DIALOG_START_X), y: Math.max(80, DIALOG_START_Y) });
    const [citySelectDialogZIndex, setCitySelectDialogZIndex] = useState(10020);
    const [shopDialogPosition] = useState({ x: 320, y: DIALOG_START_Y });
    const [shopDialogZIndex, setShopDialogZIndex] = useState(10021);
    const [magicShopDialogPosition] = useState({ x: 360, y: DIALOG_START_Y });
    const [magicShopDialogZIndex, setMagicShopDialogZIndex] = useState(10022);
    const [cashShopDialogPosition] = useState({ x: 380, y: DIALOG_START_Y });
    const [cashShopDialogZIndex, setCashShopDialogZIndex] = useState(10023);
    const [warehouseDialogPosition] = useState({ x: 280, y: DIALOG_START_Y });
    const [warehouseDialogZIndex, setWarehouseDialogZIndex] = useState(10023);
    const [blacksmithDialogPosition] = useState({ x: 340, y: DIALOG_START_Y + 20 });
    const [blacksmithDialogZIndex, setBlacksmithDialogZIndex] = useState(10024);
    const [npcTalkDialogPosition] = useState({ x: 400, y: DIALOG_START_Y + 40 });
    const [npcTalkDialogZIndex, setNpcTalkDialogZIndex] = useState(10025);
    const showShopDialog = useStore(shopDialogStore, (state) => state.isOpen);
    const showMagicShopDialog = useStore(magicShopDialogStore, (state) => state.isOpen);
    const showCashShopDialog = useStore(cashShopDialogStore, (state) => state.isOpen);
    const showWarehouseDialog = useStore(warehouseDialogStore, (state) => state.isOpen);
    const showBlacksmithDialog = useStore(blacksmithDialogStore, (state) => state.isOpen);
    const showNpcTalkDialog = useStore(npcTalkDialogStore, (state) => state.isOpen);

    // Discord Rich Presence lifecycle (local Discord desktop RPC when available).
    useEffect(() => {
        installDiscordPresenceLifecycle();
    }, []);

    // Deep link: ?watch=matchId opens multi-cam Watch cartelera.
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const watchId = params.get('watch')?.trim();
            if (watchId) {
                openDuelWatch(watchId);
            }
        } catch {
            // ignore
        }
    }, []);

    // Listen to map loaded events from Phaser via EventBus
    useEffect(() => {
        const handleMapLoaded = () => {
            setIsMapLoaded(true);
            setIsInGameWorld(true);
            if (gmSandboxUi) {
                setControlsDialogOpen(true);
            }
            if (!hasInitialMapLoadRef.current) {
                hasInitialMapLoadRef.current = true;
                setMinimapDialogOpen(true);
                setGuideMapEnabled(true);
            }

            // Discord: "Playing Helbreath Chain Lords" under username (Discord desktop must be open).
            window.setTimeout(() => {
                try {
                    const name =
                        characterDialogStore.state.stats.playerName?.trim() ||
                        (localStorage.getItem('gameState') &&
                            (JSON.parse(localStorage.getItem('gameState') || '{}') as { characterName?: string })
                                .characterName) ||
                        '';
                    const level = progressionStore.state.level || characterDialogStore.state.stats.level || 0;
                    const mapName =
                        (typeof localStorage !== 'undefined' &&
                            (JSON.parse(localStorage.getItem('gameState') || '{}') as { mapName?: string }).mapName) ||
                        undefined;
                    void discordPresenceEnterWorld({
                        characterName: typeof name === 'string' ? name : undefined,
                        level,
                        mapName,
                    });
                } catch {
                    void discordPresenceEnterWorld();
                }
            }, 400);

            // First-run HUD tour for new low-level travelers (once per character).
            // Delay until dock is painted so spotlight can find fullscreen button.
            window.setTimeout(() => {
                try {
                    const name =
                        characterDialogStore.state.stats.playerName?.trim() ||
                        localStorage.getItem('gameState') &&
                            (JSON.parse(localStorage.getItem('gameState') || '{}') as { characterName?: string })
                                .characterName ||
                        '';
                    const level = progressionStore.state.level || characterDialogStore.state.stats.level || 1;
                    if (typeof name === 'string' && name.length > 0 && name !== 'Player') {
                        tryStartHudTutorial(name, level);
                    } else if (level <= 5) {
                        // Fallback key if name not yet synced
                        tryStartHudTutorial(`anon-lv${level}`, level);
                    }
                } catch {
                    // ignore
                }
            }, 900);

            if (!travelerMode || gmSandboxUi) {
                return;
            }

            const game = phaserRef.current?.game;
            const networkManager = game ? getNetworkManager(game) : undefined;
            if (!networkManager) {
                return;
            }

            const travelerWorldId = getTravelerWorldId();
            const currentWorldId = networkManager.getCurrentGameWorldId();
            // Set from server citizenship on InitialState (markCityChosen) and city pick UI.
            // Never force-warp citizens back to traveler — that was wiping Elvine/Aresden logins.
            const { hasChosenCity } = citySelectDialogStore.state;

            if (!hasChosenCity && currentWorldId === travelerWorldId) {
                setCitySelectDialogOpen(true);
            } else {
                setCitySelectDialogOpen(false);
            }
        };

        EventBus.on(OUT_MAP_LOADED, handleMapLoaded);

        return () => {
            EventBus.off(OUT_MAP_LOADED, handleMapLoaded);
        };
    }, [travelerMode, gmSandboxUi]);

    /**
     * SELECTCHAR / Create Character live on LoginScreen. If isMapLoaded stayed true after
     * a prior world session, HotkeyBar + dock would paint under/over the classic desk.
     * Reset world HUD ownership whenever we leave GameWorld.
     */
    useEffect(() => {
        const handleSceneReady = (sceneInstance: { scene?: { key?: string } }) => {
            const key = sceneInstance?.scene?.key ?? '';
            if (key === 'LoginScreen' || key === 'LoadingScreen' || key === 'Boot') {
                setIsMapLoaded(false);
                setIsInGameWorld(false);
                hasInitialMapLoadRef.current = false;
                document.body.classList.remove('game-world-active');
                discordPresenceClear();
                // Right-side event letters must not stick on Character List / hub.
                toast.dismiss();
                logoutCountdownToastId = undefined;
                return;
            }
            if (key === 'GameWorld') {
                setIsInGameWorld(true);
            }
        };

        EventBus.on(CURRENT_SCENE_READY, handleSceneReady);
        return () => {
            EventBus.off(CURRENT_SCENE_READY, handleSceneReady);
        };
    }, []);

    useEffect(() => {
        /** Dedupe identical letters (double level-up packet / double-click) within this window. */
        const recentToastKeys = new Map<string, number>();
        const DEDUPE_MS = 900;

        const handleToastRequested = ({
            message,
            severity,
            autoClose,
            trackForLogoutDismiss,
        }: ToastRequestedEvent) => {
            const text = (message ?? '').trim();
            if (!text) {
                return;
            }

            const now = Date.now();
            const dedupeKey = `${severity}:${text}`;
            const last = recentToastKeys.get(dedupeKey) ?? 0;
            if (now - last < DEDUPE_MS && trackForLogoutDismiss !== true) {
                return;
            }
            recentToastKeys.set(dedupeKey, now);
            // Prune map so it does not grow forever
            if (recentToastKeys.size > 40) {
                for (const [k, t] of recentToastKeys) {
                    if (now - t > 10_000) {
                        recentToastKeys.delete(k);
                    }
                }
            }

            const toastMessage = <span className="rpg-toast-message">{text}</span>;
            // Event letters (level-up, tips, etc.): hard 3s lifetime unless logout countdown.
            // Always a finite number — never leave green/gold letters stuck on screen.
            const closeMs: number | false =
                trackForLogoutDismiss === true
                    ? (typeof autoClose === 'number' && autoClose > 0 ? autoClose : false)
                    : Math.min(
                          typeof autoClose === 'number' && autoClose > 0 ? autoClose : 3000,
                          3000,
                      );

            const options = {
                hideProgressBar: true,
                autoClose: closeMs,
                pauseOnHover: false,
                pauseOnFocusLoss: false,
                closeOnClick: true,
                draggable: false,
                // Force unmount after exit so transparent letter toasts cannot linger.
                onClose: undefined as (() => void) | undefined,
            };

            let id: Id | undefined;
            switch (severity) {
                case 'success':
                    id = toast.success(toastMessage, options);
                    break;
                case 'warning':
                    id = toast.warning(toastMessage, options);
                    break;
                case 'error':
                    id = toast.error(toastMessage, options);
                    break;
                case 'info':
                default: {
                    id = toast.info(toastMessage, options);
                    if (trackForLogoutDismiss) {
                        logoutCountdownToastId = id;
                    }
                    break;
                }
            }

            // Hard failsafe: if toastify fails to auto-dismiss (CSS/animation), kill it.
            if (id !== undefined && closeMs !== false && typeof closeMs === 'number') {
                const toastId = id;
                window.setTimeout(() => {
                    toast.dismiss(toastId);
                }, closeMs + 400);
            }
        };

        const handleDismissLogoutCountdown = () => {
            if (logoutCountdownToastId === undefined) {
                return;
            }

            toast.dismiss(logoutCountdownToastId);
            logoutCountdownToastId = undefined;
        };

        EventBus.on(TOAST_REQUESTED, handleToastRequested);
        EventBus.on(TOAST_DISMISS_LOGOUT_COUNTDOWN, handleDismissLogoutCountdown);

        return () => {
            EventBus.off(TOAST_REQUESTED, handleToastRequested);
            EventBus.off(TOAST_DISMISS_LOGOUT_COUNTDOWN, handleDismissLogoutCountdown);
        };
    }, []);

    useEffect(() => {
        const handleOpenShop = (data: { npcId: string; npcName: string }) => {
            openShopDialog(data.npcId, data.npcName);
        };
        const handleOpenMagicShop = (data?: { npcId?: string; npcName?: string }) => {
            setMagicShopOpen(true, {
                npcId: data?.npcId,
                npcName: data?.npcName,
            });
        };
        const handleOpenCashShop = (data: { npcId: string; npcName: string }) => {
            openCashShopDialog(data.npcId, data.npcName);
        };
        const handleOpenBlacksmith = (data: { npcId: string; npcName: string }) => {
            openBlacksmithDialog(data.npcId, data.npcName);
        };
        const handleOpenWarehouse = (data: { npcId: string; npcName: string }) => {
            openWarehouseDialog(data.npcId, data.npcName);
        };
        const handleOpenNpcTalk = (data: {
            npcId: string;
            npcName: string;
            role: NpcTalkRole;
            title: string;
        }) => {
            openNpcTalkDialog(data);
        };
        EventBus.on(OUT_UI_OPEN_SHOP, handleOpenShop);
        EventBus.on(OUT_UI_OPEN_MAGIC_SHOP, handleOpenMagicShop);
        EventBus.on(OUT_UI_OPEN_CASH_SHOP, handleOpenCashShop);
        EventBus.on(OUT_UI_OPEN_BLACKSMITH, handleOpenBlacksmith);
        EventBus.on(OUT_UI_OPEN_WAREHOUSE, handleOpenWarehouse);
        EventBus.on(OUT_UI_OPEN_NPC_TALK, handleOpenNpcTalk);
        return () => {
            EventBus.off(OUT_UI_OPEN_SHOP, handleOpenShop);
            EventBus.off(OUT_UI_OPEN_MAGIC_SHOP, handleOpenMagicShop);
            EventBus.off(OUT_UI_OPEN_CASH_SHOP, handleOpenCashShop);
            EventBus.off(OUT_UI_OPEN_BLACKSMITH, handleOpenBlacksmith);
            EventBus.off(OUT_UI_OPEN_WAREHOUSE, handleOpenWarehouse);
            EventBus.off(OUT_UI_OPEN_NPC_TALK, handleOpenNpcTalk);
        };
    }, []);

    // Bring dialogs to front when they're opened
    useEffect(() => {
        if (showMapDialog) {
            bringDialogToFront('map-dialog');
        }
    }, [showMapDialog]);

    useEffect(() => {
        if (showCameraDialog) {
            bringDialogToFront('camera-dialog');
        }
    }, [showCameraDialog]);

    useEffect(() => {
        if (showPlayerDialog) {
            bringDialogToFront('player-dialog');
        }
    }, [showPlayerDialog]);

    useEffect(() => {
        if (showCharacterDialog) {
            bringDialogToFront('character-dialog');
        }
    }, [showCharacterDialog]);

    useEffect(() => {
        if (showSoundDialog) {
            bringDialogToFront('sound-dialog');
        }
    }, [showSoundDialog]);

    useEffect(() => {
        if (showMonsterDialog) {
            bringDialogToFront('monster-dialog');
        }
    }, [showMonsterDialog]);

    useEffect(() => {
        if (showNPCDialog) {
            bringDialogToFront('npc-dialog');
        }
    }, [showNPCDialog]);

    useEffect(() => {
        if (showEffectDialog) {
            bringDialogToFront('effect-dialog');
        }
    }, [showEffectDialog]);

    useEffect(() => {
        if (showCastDialog) {
            bringDialogToFront('cast-dialog');
        }
    }, [showCastDialog]);

    useEffect(() => {
        if (showInventoryDialog) {
            bringDialogToFront('inventory-dialog');
        }
    }, [showInventoryDialog]);

    useEffect(() => {
        if (showItemDialog) {
            bringDialogToFront('item-dialog');
        }
    }, [showItemDialog]);

    useEffect(() => {
        if (showServerDialog) {
            bringDialogToFront('server-dialog');
        }
    }, [showServerDialog]);

    useEffect(() => {
        if (showPerformanceDialog) {
            bringDialogToFront('performance-dialog');
        }
    }, [showPerformanceDialog]);

    useEffect(() => {
        if (showChatDialog) {
            bringDialogToFront('chat-dialog');
        }
    }, [showChatDialog]);

    useEffect(() => {
        if (showConnectDialog) {
            bringDialogToFront('connect-dialog');
        }
    }, [showConnectDialog]);

    useEffect(() => {
        if (showDeathDialog) {
            bringDialogToFront('death-dialog');
        }
    }, [showDeathDialog]);

    useEffect(() => {
        if (showShopDialog) {
            bringDialogToFront('shop-dialog');
        }
    }, [showShopDialog]);

    useEffect(() => {
        if (showMagicShopDialog) {
            bringDialogToFront('magic-shop-dialog');
        }
    }, [showMagicShopDialog]);
    useEffect(() => {
        if (showCashShopDialog) {
            bringDialogToFront('cash-shop-dialog');
        }
    }, [showCashShopDialog]);

    useEffect(() => {
        if (showWarehouseDialog) {
            bringDialogToFront('warehouse-dialog');
        }
    }, [showWarehouseDialog]);

    useEffect(() => {
        if (showBlacksmithDialog) {
            bringDialogToFront('blacksmith-dialog');
        }
    }, [showBlacksmithDialog]);

    useEffect(() => {
        if (showNpcTalkDialog) {
            bringDialogToFront('npc-talk-dialog');
        }
    }, [showNpcTalkDialog]);

    // Center Connecting dialog on viewport when shown or window resizes
    useEffect(() => {
        if (!showConnectingDialog) {
            return;
        }

        const centerDialog = () => {
            const dialogElement = document.querySelector('[data-dialog-id="connecting-dialog"]');
            if (dialogElement instanceof HTMLElement) {
                const rect = dialogElement.getBoundingClientRect();
                const dialogWidth = rect.width || dialogElement.offsetWidth || 280;
                const dialogHeight = rect.height || dialogElement.offsetHeight || 80;
                const newX = (window.innerWidth - dialogWidth) / 2;
                const newY = (window.innerHeight - dialogHeight) / 2;
                setConnectingDialogPosition({
                    x: Math.max(0, newX),
                    y: Math.max(0, newY)
                });
            } else {
                const dialogWidth = 280;
                const dialogHeight = 80;
                setConnectingDialogPosition({
                    x: Math.max(0, (window.innerWidth - dialogWidth) / 2),
                    y: Math.max(0, (window.innerHeight - dialogHeight) / 2)
                });
            }
        };

        const rafId = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                centerDialog();
            });
        });
        window.addEventListener('resize', centerDialog);
        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', centerDialog);
        };
    }, [showConnectingDialog]);

    // Center Server Message dialog on viewport when shown or window resizes
    useEffect(() => {
        if (!showServerMessageDialog) {
            return;
        }

        const centerDialog = () => {
            const dialogElement = document.querySelector('[data-dialog-id="server-message-dialog"]');
            if (dialogElement instanceof HTMLElement) {
                const rect = dialogElement.getBoundingClientRect();
                const dialogWidth = rect.width || dialogElement.offsetWidth || 400;
                const dialogHeight = rect.height || dialogElement.offsetHeight || 120;
                const newX = (window.innerWidth - dialogWidth) / 2;
                const newY = (window.innerHeight - dialogHeight) / 2;
                setServerMessageDialogPosition({
                    x: Math.max(0, newX),
                    y: Math.max(0, newY)
                });
            } else {
                const dialogWidth = 400;
                const dialogHeight = 120;
                setServerMessageDialogPosition({
                    x: Math.max(0, (window.innerWidth - dialogWidth) / 2),
                    y: Math.max(0, (window.innerHeight - dialogHeight) / 2)
                });
            }
        };

        const rafId = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                centerDialog();
            });
        });
        window.addEventListener('resize', centerDialog);
        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', centerDialog);
        };
    }, [showServerMessageDialog]);

    const bringDialogToFront = (dialogId: string) => {
        const currentZIndex = nextZIndexRef.current;
        nextZIndexRef.current += 1;
        
        switch (dialogId) {
            case 'main-dialog':
                setDialogZIndex(currentZIndex);
                break;
            case 'map-dialog':
                setMapDialogZIndex(currentZIndex);
                break;
            case 'camera-dialog':
                setCameraDialogZIndex(currentZIndex);
                break;
            case 'player-dialog':
                setPlayerDialogZIndex(currentZIndex);
                break;
            case 'character-dialog':
                setCharacterDialogZIndex(currentZIndex);
                break;
            case 'sound-dialog':
                setSoundDialogZIndex(currentZIndex);
                break;
            case 'monster-dialog':
                setMonsterDialogZIndex(currentZIndex);
                break;
            case 'npc-dialog':
                setNPCDialogZIndex(currentZIndex);
                break;
            case 'effect-dialog':
                setEffectDialogZIndex(currentZIndex);
                break;
            case 'cast-dialog':
                setCastDialogZIndex(currentZIndex);
                break;
            case 'inventory-dialog':
                setInventoryDialogZIndex(currentZIndex);
                break;
            case 'item-dialog':
                setItemDialogZIndex(currentZIndex);
                break;
            case 'server-dialog':
                setServerDialogZIndex(currentZIndex);
                break;
            case 'performance-dialog':
                setPerformanceDialogZIndex(currentZIndex);
                break;
            case 'chat-dialog':
                setChatDialogZIndex(currentZIndex);
                break;
            case 'skill-dialog':
            case 'sys-menu-dialog':
            case 'mob-kills-dialog':
            case 'tournament-dialog':
            case 'training-dialog':
            case 'auction-board-dialog':
                setOlympiaMenuZIndex(currentZIndex);
                break;
            case 'connect-dialog':
                setConnectDialogZIndex(currentZIndex);
                break;
            case 'city-select-dialog':
                setCitySelectDialogZIndex(currentZIndex);
                break;
            case 'shop-dialog':
                setShopDialogZIndex(currentZIndex);
                break;
            case 'magic-shop-dialog':
                setMagicShopDialogZIndex(currentZIndex);
                break;
            case 'cash-shop-dialog':
                setCashShopDialogZIndex(currentZIndex);
                break;
            case 'warehouse-dialog':
                setWarehouseDialogZIndex(currentZIndex);
                break;
            case 'blacksmith-dialog':
                setBlacksmithDialogZIndex(currentZIndex);
                break;
            case 'npc-talk-dialog':
                setNpcTalkDialogZIndex(currentZIndex);
                break;
            case 'death-dialog':
                setDeathDialogZIndex(currentZIndex);
                break;
        }
    };

    const handleDragEnd = (event: any) => {
        const { active, delta } = event;
        const dialogId = active.id;
        const GRID_SIZE = 10; // 10x10 pixel snap grid
        
        // Get dialog element and its dimensions
        const dialogElement = document.querySelector(`[data-dialog-id="${dialogId}"]`);
        if (!(dialogElement instanceof HTMLElement)) return;
        
        const dialogWidth = dialogElement.offsetWidth || 200;
        const dialogHeight = dialogElement.offsetHeight || 150;
        
        // Determine which dialog is being dragged and get its current position
        let currentPosition: { x: number; y: number };
        switch (dialogId) {
            case 'main-dialog':
                currentPosition = dialogPosition;
                break;
            case 'map-dialog':
                currentPosition = mapDialogPosition;
                break;
            case 'camera-dialog':
                currentPosition = cameraDialogPosition;
                break;
            case 'player-dialog':
                currentPosition = playerDialogPosition;
                break;
            case 'character-dialog':
                currentPosition = characterDialogPosition;
                break;
            case 'sound-dialog':
                currentPosition = soundDialogPosition;
                break;
            case 'monster-dialog':
                currentPosition = monsterDialogPosition;
                break;
            case 'npc-dialog':
                currentPosition = npcDialogPosition;
                break;
            case 'effect-dialog':
                currentPosition = effectDialogPosition;
                break;
            case 'cast-dialog':
                currentPosition = castDialogPosition;
                break;
            case 'inventory-dialog':
                currentPosition = inventoryDialogPosition;
                break;
            case 'item-dialog':
                currentPosition = itemDialogPosition;
                break;
            case 'server-dialog':
                currentPosition = serverDialogPosition;
                break;
            case 'performance-dialog':
                currentPosition = performanceDialogPosition;
                break;
            case 'chat-dialog':
                currentPosition = chatDialogPosition;
                break;
            case 'skill-dialog':
            case 'sys-menu-dialog':
            case 'mob-kills-dialog':
            case 'tournament-dialog':
            case 'training-dialog':
            case 'auction-board-dialog':
                currentPosition = olympiaMenuPosition;
                break;
            case 'connecting-dialog':
                currentPosition = connectingDialogPosition;
                break;
            case 'server-message-dialog':
                currentPosition = serverMessageDialogPosition;
                break;
            default:
                const rect = dialogElement.getBoundingClientRect();
                currentPosition = { x: rect.left, y: rect.top };
        }
        
        // Calculate new position
        let newX = currentPosition.x + delta.x;
        let newY = currentPosition.y + delta.y;
        
        // Snap to grid (10x10 pixels)
        newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
        newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
        
        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Clamp position to keep dialog fully within viewport
        newX = Math.max(0, Math.min(newX, viewportWidth - dialogWidth));
        newY = Math.max(0, Math.min(newY, viewportHeight - dialogHeight));
        
        // Update the appropriate dialog position
        const position = { x: newX, y: newY };
        switch (dialogId) {
            case 'main-dialog':
                setDialogPosition(position);
                break;
            case 'map-dialog':
                setMapDialogPosition(position);
                break;
            case 'camera-dialog':
                setCameraDialogPosition(position);
                break;
            case 'player-dialog':
                setPlayerDialogPosition(position);
                break;
            case 'character-dialog':
                setCharacterDialogPosition(position);
                break;
            case 'sound-dialog':
                setSoundDialogPosition(position);
                break;
            case 'monster-dialog':
                setMonsterDialogPosition(position);
                break;
            case 'npc-dialog':
                setNPCDialogPosition(position);
                break;
            case 'effect-dialog':
                setEffectDialogPosition(position);
                break;
            case 'cast-dialog':
                setCastDialogPosition(position);
                break;
            case 'inventory-dialog':
                setInventoryDialogPosition(position);
                break;
            case 'item-dialog':
                setItemDialogPosition(position);
                break;
            case 'server-dialog':
                setServerDialogPosition(position);
                break;
            case 'performance-dialog':
                setPerformanceDialogPosition(position);
                break;
            case 'chat-dialog':
                setChatDialogPosition(position);
                break;
            case 'skill-dialog':
            case 'sys-menu-dialog':
            case 'mob-kills-dialog':
            case 'tournament-dialog':
            case 'training-dialog':
            case 'auction-board-dialog':
                setOlympiaMenuPosition(position);
                break;
            case 'connecting-dialog':
                setConnectingDialogPosition(position);
                break;
            case 'server-message-dialog':
                setServerMessageDialogPosition(position);
                break;
        }
    };


    // Apply scaled cursor + pivot hotspot; cast cursors tint to Peace / Attack / Safe.
    useEffect(() => {
        let cancelled = false;
        const apply = async () => {
            if (!cursorImage) {
                return;
            }
            const { attackMode, safeAttackMode } = playerDialogStore.state;
            const combatMode: CombatCursorMode = !attackMode ? 'peace' : safeAttackMode ? 'safe' : 'attack';
            try {
                const css = await buildCssCursorValue(cursorSpriteKey, cursorImage, { combatMode });
                if (!cancelled) {
                    document.documentElement.style.setProperty('--custom-cursor', css);
                }
            } catch {
                if (!cancelled) {
                    document.documentElement.style.setProperty('--custom-cursor', `url(${cursorImage}), auto`);
                }
            }
        };
        void apply();
        return () => {
            cancelled = true;
            document.documentElement.style.removeProperty('--custom-cursor');
        };
    }, [cursorImage, cursorSpriteKey]);

    // Re-tint cast cursor when combat mode changes while casting.
    useEffect(() => {
        const unsub = playerDialogStore.subscribe(() => {
            const { cursorSpriteKey: key, spriteFrameMap: map } = appStore.state;
            const raw = map.get(key);
            if (!raw) {
                return;
            }
            const { attackMode, safeAttackMode } = playerDialogStore.state;
            const combatMode: CombatCursorMode = !attackMode ? 'peace' : safeAttackMode ? 'safe' : 'attack';
            void buildCssCursorValue(key, raw, { combatMode }).then((css) => {
                document.documentElement.style.setProperty('--custom-cursor', css);
            });
        });
        return () => {
            unsub();
        };
    }, []);

    // Re-apply cursor every 500ms to recover from browser reverting to default, and animate grab cursor.
    // In fullscreen, hovering the browser's "exit fullscreen" toast resets cursor to OS default.
    // Force a brief state change (grab for 1ms then back) to kick the browser into re-applying our cursor.
    useEffect(() => {
        let forceRefreshTimeout: ReturnType<typeof setTimeout> | null = null;
        let applyGen = 0;

        const applyCursorKey = (key: string, map: Map<string, string>) => {
            const image = map.get(key);
            if (!image) {
                return;
            }
            const gen = ++applyGen;
            const { attackMode, safeAttackMode } = playerDialogStore.state;
            const combatMode: CombatCursorMode = !attackMode ? 'peace' : safeAttackMode ? 'safe' : 'attack';
            void buildCssCursorValue(key, image, { combatMode }).then((css) => {
                if (gen !== applyGen) {
                    return;
                }
                document.documentElement.style.setProperty('--custom-cursor', css);
            });
        };

        const interval = setInterval(() => {
            const { cursorSpriteKey: key, spriteFrameMap: map } = appStore.state;
            const isFullscreen = !!document.fullscreenElement;

            const isGrabCursor = key === CURSOR_GRAB_1 || key === CURSOR_GRAB_2;

            if (isFullscreen && !isGrabCursor) {
                // Non-grab cursor in fullscreen: browser toast can reset cursor to OS default when hovered.
                // Force a state change (grab for 1ms then back) to kick the browser into re-applying our cursor.
                if (forceRefreshTimeout) clearTimeout(forceRefreshTimeout);
                const correctKey = key;
                const flashImage = map.get(CURSOR_GRAB_1);
                if (flashImage) {
                    setCursorSpriteKey(CURSOR_GRAB_1);
                    applyCursorKey(CURSOR_GRAB_1, map);
                }
                forceRefreshTimeout = setTimeout(() => {
                    setCursorSpriteKey(correctKey);
                    applyCursorKey(correctKey, map);
                    forceRefreshTimeout = null;
                }, 1);
            } else {
                // Normal: animate grab cursor (toggle every 500ms) and re-apply. Also recovers from OS default in fullscreen.
                let imageKey = key;
                if (key === CURSOR_GRAB_1) {
                    imageKey = CURSOR_GRAB_2;
                    setCursorSpriteKey(CURSOR_GRAB_2);
                } else if (key === CURSOR_GRAB_2) {
                    imageKey = CURSOR_GRAB_1;
                    setCursorSpriteKey(CURSOR_GRAB_1);
                }
                applyCursorKey(imageKey, map);
            }
        }, 500);

        return () => {
            clearInterval(interval);
            if (forceRefreshTimeout) clearTimeout(forceRefreshTimeout);
        };
    }, []);

    return (
        <DndContext sensors={dialogDragSensors} onDragEnd={handleDragEnd}>
            <div id="app">
                <PhaserGame ref={phaserRef} />
                
                {showControlsDialog && gmSandboxUi && (
                    <ControlsDialog
                        position={dialogPosition}
                        phaserRef={phaserRef}
                        zIndex={dialogZIndex}
                        onBringToFront={() => bringDialogToFront('main-dialog')}
                    />
                )}
                
                {showMapDialog && gmSandboxUi && (
                    <MapDialog
                        position={mapDialogPosition}
                        onClose={() => setMapDialogOpen(false)}
                        zIndex={mapDialogZIndex}
                        onBringToFront={() => bringDialogToFront('map-dialog')}
                    />
                )}
                
                {showCameraDialog && gmSandboxUi && (
                    <CameraDialog
                        position={cameraDialogPosition}
                        onClose={() => setCameraDialogOpen(false)}
                        zIndex={cameraDialogZIndex}
                        onBringToFront={() => bringDialogToFront('camera-dialog')}
                    />
                )}
                
                {showPlayerDialog && gmSandboxUi && (
                    <PlayerDialog
                        position={playerDialogPosition}
                        onClose={() => setPlayerDialogOpen(false)}
                        zIndex={playerDialogZIndex}
                        onBringToFront={() => bringDialogToFront('player-dialog')}
                    />
                )}

                {showCharacterDialog && !arenaSlim && (
                    <CharacterDialog
                        position={characterDialogPosition}
                        onClose={() => setCharacterDialogOpen(false)}
                        zIndex={characterDialogZIndex}
                        onBringToFront={() => bringDialogToFront('character-dialog')}
                        onPositionChange={setCharacterDialogPosition}
                    />
                )}
                
                {/* Minimap: toolbar only captures clicks; map body is click-through (CornerMinimapHud). */}
                {showWorldHud && <CornerMinimapHud />}
                {showFullWorldChrome && <TestnetHud phaserRef={phaserRef} />}
                
                {showSoundDialog && gmSandboxUi && (
                    <SoundDialog
                        position={soundDialogPosition}
                        onClose={() => setSoundDialogOpen(false)}
                        zIndex={soundDialogZIndex}
                        onBringToFront={() => bringDialogToFront('sound-dialog')}
                    />
                )}
                
                {showMonsterDialog && gmSandboxUi && (
                    <MonsterDialog
                        position={monsterDialogPosition}
                        phaserRef={phaserRef}
                        zIndex={monsterDialogZIndex}
                        onBringToFront={() => bringDialogToFront('monster-dialog')}
                    />
                )}
                
                {showNPCDialog && gmSandboxUi && (
                    <NPCDialog
                        position={npcDialogPosition}
                        zIndex={npcDialogZIndex}
                        onBringToFront={() => bringDialogToFront('npc-dialog')}
                    />
                )}
                
                {showEffectDialog && gmSandboxUi && (
                    <EffectDialog
                        position={effectDialogPosition}
                        zIndex={effectDialogZIndex}
                        onBringToFront={() => bringDialogToFront('effect-dialog')}
                    />
                )}
                
                {showCastDialog && (
                    <CastDialog
                        position={castDialogPosition}
                        zIndex={castDialogZIndex}
                        onBringToFront={() => bringDialogToFront('cast-dialog')}
                        onPositionChange={setCastDialogPosition}
                    />
                )}
                
                {showInventoryDialog && (
                    <InventoryDialog
                        position={inventoryDialogPosition}
                        onClose={() => setInventoryDialogOpen(false)}
                        zIndex={inventoryDialogZIndex}
                        onBringToFront={() => bringDialogToFront('inventory-dialog')}
                        onPositionChange={setInventoryDialogPosition}
                        phaserRef={phaserRef}
                        simpleBagOnly={arenaSlim}
                    />
                )}
                
                {showItemDialog && gmSandboxUi && !arenaSlim && (
                    <ItemDialog
                        position={itemDialogPosition}
                        onClose={() => setItemDialogOpen(false)}
                        zIndex={itemDialogZIndex}
                        onBringToFront={() => bringDialogToFront('item-dialog')}
                    />
                )}
                
                {showServerDialog && gmSandboxUi && (
                    <ServerDialog
                        position={serverDialogPosition}
                        onClose={() => setServerDialogOpen(false)}
                        zIndex={serverDialogZIndex}
                        onBringToFront={() => bringDialogToFront('server-dialog')}
                    />
                )}
                
                {showPerformanceDialog && gmSandboxUi && (
                    <PerformanceDialog
                        position={performanceDialogPosition}
                        onClose={() => setPerformanceDialogOpen(false)}
                        zIndex={performanceDialogZIndex}
                        onBringToFront={() => bringDialogToFront('performance-dialog')}
                    />
                )}

                {showChatDialog && (
                    <ChatDialog
                        messages={chatMessages}
                        position={chatDialogPosition}
                        phaserRef={phaserRef}
                        onClose={() => setChatDialogOpen(false)}
                        zIndex={chatDialogZIndex}
                        onBringToFront={() => bringDialogToFront('chat-dialog')}
                    />
                )}

                {!arenaSlim && (
                    <>
                        <SkillDialog
                            position={olympiaMenuPosition}
                            zIndex={olympiaMenuZIndex}
                            onBringToFront={() => bringDialogToFront('skill-dialog')}
                            onPositionChange={setOlympiaMenuPosition}
                            phaserRef={phaserRef}
                        />
                        <EnchantBagDialog
                            position={olympiaMenuPosition}
                            zIndex={olympiaMenuZIndex}
                            onBringToFront={() => bringDialogToFront('enchant-bag-dialog')}
                            onPositionChange={setOlympiaMenuPosition}
                            phaserRef={phaserRef}
                        />
                        <SysMenuDialog
                            position={olympiaMenuPosition}
                            zIndex={olympiaMenuZIndex}
                            onBringToFront={() => bringDialogToFront('sys-menu-dialog')}
                            onPositionChange={setOlympiaMenuPosition}
                            phaserRef={phaserRef}
                        />
                        <MobKillsDialog
                            position={olympiaMenuPosition}
                            zIndex={olympiaMenuZIndex}
                            onBringToFront={() => bringDialogToFront('mob-kills-dialog')}
                            onPositionChange={setOlympiaMenuPosition}
                        />
                        <TournamentDialog
                            position={olympiaMenuPosition}
                            zIndex={olympiaMenuZIndex}
                            onBringToFront={() => bringDialogToFront('tournament-dialog')}
                            onPositionChange={setOlympiaMenuPosition}
                        />
                        <DuelWatchDialog
                            position={olympiaMenuPosition}
                            zIndex={olympiaMenuZIndex}
                            onBringToFront={() => bringDialogToFront('duel-watch-dialog')}
                            onPositionChange={setOlympiaMenuPosition}
                            phaserRef={phaserRef}
                        />
                        <TrainingDialog
                            position={olympiaMenuPosition}
                            zIndex={olympiaMenuZIndex}
                            onBringToFront={() => bringDialogToFront('training-dialog')}
                            onPositionChange={setOlympiaMenuPosition}
                            phaserRef={phaserRef}
                        />
                        <AuctionBoardDialog
                            position={olympiaMenuPosition}
                            zIndex={olympiaMenuZIndex}
                            onBringToFront={() => bringDialogToFront('auction-board-dialog')}
                            onPositionChange={setOlympiaMenuPosition}
                            phaserRef={phaserRef}
                        />
                        <GuildWarehouseDialog
                            position={olympiaMenuPosition}
                            zIndex={olympiaMenuZIndex}
                            onBringToFront={() => bringDialogToFront('guild-warehouse-dialog')}
                            onPositionChange={setOlympiaMenuPosition}
                        />
                        {gmSandboxUi ? (
                            <AntiBotToolsDialog
                                position={olympiaMenuPosition}
                                zIndex={olympiaMenuZIndex}
                                onBringToFront={() => bringDialogToFront('anti-bot-tools-dialog')}
                                onPositionChange={setOlympiaMenuPosition}
                                phaserRef={phaserRef}
                            />
                        ) : null}
                    </>
                )}
                {/* Duel panel always available in arena (create/ready/bag stake). */}
                <ArenaPactDialog
                    position={olympiaMenuPosition}
                    zIndex={Math.max(olympiaMenuZIndex, 10080)}
                    onBringToFront={() => bringDialogToFront('arena-pact-dialog')}
                    onPositionChange={setOlympiaMenuPosition}
                    phaserRef={phaserRef}
                />
                
                {showWorldHud && <HotkeyBar phaserRef={phaserRef} />}
                {showFullWorldChrome && <HudTutorialOverlay />}
                {showFullWorldChrome && <QuestTrackerHud />}
                {/* System log: duel-only strip in slim (DC, bag, kills) — still useful. */}
                {showWorldHud && <SystemLogOverlay />}
                {showWorldHud && <ChatWorldLog duelOnly={arenaSlim} />}
                {showWorldHud && <ChatComposeBar phaserRef={phaserRef} duelOnly={arenaSlim} />}

                {gmSandboxUi && !arenaSlim && <AssetDebugOverlay />}
                <InventoryItemHoverOverlay />
                {/* Monster/NPC hover: skip in slim — less work mid-duel (players still hoverable). */}
                {showFullWorldChrome && <MonsterHoverOverlay />}
                {showFullWorldChrome && <NpcHoverOverlay />}
                <PlayerHoverOverview />
                
                {showDeathDialog && (
                    <DeathDialog
                        zIndex={deathDialogZIndex}
                        onBringToFront={() => bringDialogToFront('death-dialog')}
                    />
                )}

                {showConnectingDialog && (
                    <ConnectingDialog
                        position={connectingDialogPosition}
                        zIndex={CONNECTING_DIALOG_Z_INDEX}
                    />
                )}

                {showConnectDialog && (
                    <ConnectDialog zIndex={connectDialogZIndex} />
                )}
                <ArenaKitBuilderDialog zIndex={10050} />
                <ReferralCharListPanel />
                <DeskModeJumpTab />
                <BleedingOnlineStrip />
                {showCitySelectDialog && travelerMode && (
                    <CitySelectDialog
                        position={citySelectDialogPosition}
                        zIndex={citySelectDialogZIndex}
                        onBringToFront={() => bringDialogToFront('city-select-dialog')}
                        phaserRef={phaserRef}
                    />
                )}
                {showShopDialog && (
                    <ShopDialog
                        position={shopDialogPosition}
                        zIndex={shopDialogZIndex}
                        onBringToFront={() => bringDialogToFront('shop-dialog')}
                        phaserRef={phaserRef}
                    />
                )}
                {showCashShopDialog && (
                    <CashShopDialog
                        position={cashShopDialogPosition}
                        zIndex={cashShopDialogZIndex}
                        onBringToFront={() => bringDialogToFront('cash-shop-dialog')}
                        phaserRef={phaserRef}
                    />
                )}
                {showMagicShopDialog && (
                    <MagicShopDialog
                        position={magicShopDialogPosition}
                        zIndex={magicShopDialogZIndex}
                        onBringToFront={() => bringDialogToFront('magic-shop-dialog')}
                        phaserRef={phaserRef}
                    />
                )}
                {showWarehouseDialog && (
                    <WarehouseDialog
                        position={warehouseDialogPosition}
                        zIndex={warehouseDialogZIndex}
                        onBringToFront={() => bringDialogToFront('warehouse-dialog')}
                        phaserRef={phaserRef}
                    />
                )}
                {showBlacksmithDialog && (
                    <BlacksmithDialog
                        position={blacksmithDialogPosition}
                        zIndex={blacksmithDialogZIndex}
                        onBringToFront={() => bringDialogToFront('blacksmith-dialog')}
                        phaserRef={phaserRef}
                    />
                )}
                {showNpcTalkDialog && (
                    <NpcTalkDialog
                        position={npcTalkDialogPosition}
                        zIndex={npcTalkDialogZIndex}
                        onBringToFront={() => bringDialogToFront('npc-talk-dialog')}
                        phaserRef={phaserRef}
                    />
                )}
                {showServerMessageDialog && (
                    <ServerMessageDialog
                        message={serverMessageDialogMessage}
                        position={serverMessageDialogPosition}
                        onClose={() => setServerMessageDialogOpen(false)}
                        zIndex={SERVER_MESSAGE_DIALOG_Z_INDEX}
                    />
                )}
            </div>
        </DndContext>
    )
}

export default App
