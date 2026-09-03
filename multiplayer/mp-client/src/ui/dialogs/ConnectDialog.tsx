import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import {
    IN_UI_CONNECT_TO_SERVER,
    IN_UI_SUPPRESS_POINTER_INPUT,
    OUT_UI_ARENA_ACTION,
    OUT_UI_ARENA_BACK,
    OUT_UI_CREATECHAR_CANCEL,
    OUT_UI_CREATECHAR_CONFIRM,
    OUT_UI_SELECTCHAR_ACTION,
    OUT_UI_SELECTCHAR_BACK,
    TOAST_REQUESTED,
    type ArenaDeskActionPayload,
    type ConnectToServerPayload,
    type CreateCharConfirmPayload,
    type SelectCharActionPayload,
} from '../../constants/EventNames';
import {
    connectDialogStore,
    enterPlayWorldPhase,
    setArenaDeskIndex,
    setCharacterListLoading,
    setCharacterSlots,
    setReferralInfo,
    setConnectDialogOpen,
    setConnectGatePhase,
    setConnectWalletSession,
    setLastConnectAttempt,
    setSelectedSlotIndex,
} from '../store/ConnectDialog.store';
import {
    openArenaPactWithKit,
    setPendingArenaPactRespond,
} from '../store/ArenaPactDialog.store';
import {
    clearWalletDeepLink,
    connectWalletAndAuthenticate,
    consumeAutoEnterWorldFlag,
    consumeWalletDeepLink,
    getStoredWalletPubkey,
    getStoredWalletToken,
    releaseAutoEnterWorldLock,
    tryAcquireAutoEnterWorldLock,
} from '../../utils/walletAuth';
import {
    fetchCharacterList,
    type CharacterSlotSummary,
} from '../../utils/characterListApi';
import { declineArenaPactFromHub, fetchArenaPactInbox } from '../../utils/arenaPactInboxApi';
import type { ArenaPactState } from '../../proto/generated/network';
import { getDefaultGameHost, getDefaultGamePort } from '../../utils/serverDefaults';
import { getPreferredInitialWorldId } from '../../utils/playerMode';
import { type ArenaDeskIndex } from '../../utils/tournamentBuilds';
import {
    createBlankArenaKit,
    deleteArenaKit,
    getArenaKitForSlot,
    isArenaKitComplete,
    loadArenaKits,
    type ArenaSlotIndex,
} from '../../utils/arenaKits';
import { openArenaKitBuilder } from '../store/ArenaKitBuilder.store';
import {
    createPlaytestWalletSession,
    isPlaytestClient,
    PLAYTEST_CHARACTER_NAME,
} from '../../utils/playtestMode';
import { ARENA_CLOSED_MESSAGE, ARENA_ENTRY_ENABLED } from '../../constants/ArenaGate';
import { ARENA_BLEEDING_WORLD_ID } from '../../constants/ArenaKitCatalog';
import { openDuelWatch } from '../store/DuelWatch.store';
import { HubGlobalPvpRail, HubWorldStreamersRail } from '../components/HubCarteleraRails';
import { HubWorldRankingButtons } from '../components/HubWorldRankingButtons';

interface ConnectDialogProps {
    zIndex?: number;
}

function slotForIndex(slots: CharacterSlotSummary[], index: number): CharacterSlotSummary | undefined {
    return slots.find((s) => s.slotIndex === index);
}

/**
 * Login gate: hub (World | Goddesses | Arena portals).
 * World SELECTCHAR / Create Character / Arena kits are Phaser-only desks (wallet stays on the hub).
 * Host/port are hardcoded under the hood (never shown on World flow).
 */
export function ConnectDialog({ zIndex = 10018 }: ConnectDialogProps) {
    const {
        isOpen,
        defaultCharacterName,
        lastAttempt,
        phase,
        walletSession,
        characterSlots,
        selectedSlotIndex,
    } = useStore(connectDialogStore, (s) => s);

    const [, setCharacterName] = useState('');
    const host = getDefaultGameHost();
    const port = getDefaultGamePort();
    const [walletBusy, setWalletBusy] = useState(false);
    /** Inline hub error — toasts alone can be easy to miss over the full-bleed hub. */
    const [hubError, setHubError] = useState<string | undefined>(undefined);
    /** Pending PVP duel invites for this wallet (world names + arena kit names). */
    const [pvpInvites, setPvpInvites] = useState<ArenaPactState[]>([]);
    const [pvpInboxBusy, setPvpInboxBusy] = useState(false);
    const playtestAutoEnteredRef = useRef(false);

    const collectInboxNames = useCallback((): string[] => {
        const wallet = walletSession?.wallet ?? getStoredWalletPubkey();
        const names = new Set<string>();
        for (const s of characterSlots) {
            if (s.name?.trim()) {
                names.add(s.name.trim());
            }
        }
        for (const kit of loadArenaKits(wallet)) {
            if (kit?.name?.trim()) {
                names.add(kit.name.trim());
            }
        }
        return [...names];
    }, [walletSession, characterSlots]);

    const refreshPvpInbox = useCallback(async () => {
        if (isPlaytestClient() || !walletSession?.wallet || !walletSession.token) {
            setPvpInvites([]);
            return;
        }
        const names = collectInboxNames();
        if (names.length === 0) {
            setPvpInvites([]);
            return;
        }
        setPvpInboxBusy(true);
        try {
            const invites = await fetchArenaPactInbox(host, port, walletSession.wallet, walletSession.token, names);
            setPvpInvites(invites);
        } catch {
            // Silent — hub still works without inbox.
        } finally {
            setPvpInboxBusy(false);
        }
    }, [walletSession, collectInboxNames, host, port]);

    useEffect(() => {
        if (!isOpen || phase !== 'hub' || !walletSession) {
            return;
        }
        void refreshPvpInbox();
        const id = window.setInterval(() => void refreshPvpInbox(), 20_000);
        return () => window.clearInterval(id);
    }, [isOpen, phase, walletSession, refreshPvpInbox]);

    const findKitForInvite = (invite: ArenaPactState) => {
        const wallet = walletSession?.wallet ?? getStoredWalletPubkey();
        const kits = loadArenaKits(wallet);
        const myNames = new Set(collectInboxNames().map((n) => n.toLowerCase()));
        const invitee = (invite.fighters ?? []).find(
            (f) => f.invitePending && myNames.has((f.characterName ?? '').toLowerCase()),
        );
        const targetName = invitee?.characterName ?? '';
        const byName = kits.find(
            (k) => k.name.toLowerCase() === targetName.toLowerCase() && isArenaKitComplete(k),
        );
        if (byName) {
            return { kit: byName, slot: byName.slotIndex, name: targetName };
        }
        const any = kits.find((k) => isArenaKitComplete(k));
        if (any) {
            return { kit: any, slot: any.slotIndex, name: targetName || any.name };
        }
        return null;
    };

    const handleHubAccept = (invite: ArenaPactState, mode: 'accept' | 'honor') => {
        if (!walletSession) {
            EventBus.emit(TOAST_REQUESTED, { message: 'Connect wallet first.', severity: 'warning' });
            return;
        }
        const found = findKitForInvite(invite);
        if (!found) {
            EventBus.emit(TOAST_REQUESTED, {
                message: 'Need a complete Arena Pre-Ready kit to accept. Enter Arena and create one.',
                severity: 'warning',
            });
            return;
        }
        const kitJson = JSON.stringify(found.kit);
        setPendingArenaPactRespond({
            matchId: invite.matchId,
            mode,
            mapId: invite.mapId,
        });
        openArenaPactWithKit(kitJson, found.kit.name, invite.mapId || 'colosseum');
        EventBus.emit(IN_UI_CONNECT_TO_SERVER, {
            host,
            port,
            characterName: found.kit.name,
            slotIndex: found.slot,
            preferredInitialWorldId: invite.mapId || 'colosseum',
            gender: found.kit.gender === 'female' ? 'female' : 'male',
            skinColor: found.kit.skinColor === 1 ? 'tanned' : found.kit.skinColor === 2 ? 'dark' : 'light',
            hairStyleIndex: found.kit.hairStyleIndex ?? 0,
            underwearColorIndex: found.kit.underwearColorIndex ?? 0,
            str: 14,
            vit: 12,
            dex: 12,
            int: 11,
            mag: 11,
            chr: 10,
            walletSession,
            arenaKitJson: kitJson,
        } satisfies ConnectToServerPayload);
        EventBus.emit(TOAST_REQUESTED, {
            message:
                mode === 'honor'
                    ? `Entering ${invite.mapId} — accepting for Honor vs ${invite.hostName}.`
                    : `Entering ${invite.mapId} — accepting duel vs ${invite.hostName}.`,
            severity: 'info',
        });
    };

    const handleHubDecline = async (invite: ArenaPactState) => {
        if (!walletSession?.wallet || !walletSession.token) {
            return;
        }
        const found = findKitForInvite(invite);
        const inviteeName =
            found?.name ||
            (invite.fighters ?? []).find((f) => f.invitePending)?.characterName ||
            '';
        if (!inviteeName) {
            EventBus.emit(TOAST_REQUESTED, { message: 'Could not resolve invitee name.', severity: 'warning' });
            return;
        }
        setPvpInboxBusy(true);
        try {
            const remaining = await declineArenaPactFromHub(
                host,
                port,
                walletSession.wallet,
                walletSession.token,
                invite.matchId,
                inviteeName,
                collectInboxNames(),
            );
            setPvpInvites(remaining);
            EventBus.emit(TOAST_REQUESTED, {
                message: `Declined duel from ${invite.hostName}.`,
                severity: 'info',
            });
        } catch (err) {
            EventBus.emit(TOAST_REQUESTED, {
                message: err instanceof Error ? err.message : 'Decline failed.',
                severity: 'error',
            });
        } finally {
            setPvpInboxBusy(false);
        }
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const init = lastAttempt ?? {
            characterName: defaultCharacterName,
            host,
            port,
        };
        setCharacterName(init.characterName);

        if (!walletSession) {
            const pubkey = getStoredWalletPubkey();
            const token = getStoredWalletToken();
            if (pubkey && token) {
                setConnectWalletSession({
                    wallet: pubkey,
                    token,
                    expiresAt: Date.now() + 60 * 60 * 1000,
                });
            }
        }
    }, [isOpen, defaultCharacterName, lastAttempt, walletSession, host, port]);

    /**
     * Landing Play Now recovery on hub:
     * 1) Token deep-link still in sessionStorage → SELECTCHAR
     * 2) ?autologin=1 / mode=world without token → Phantom then SELECTCHAR
     *
     * Strict Mode remounts must not cancel a started enter (sessionStorage lock).
     */
    useEffect(() => {
        if (!isOpen || phase !== 'hub') {
            return;
        }

        const deepLink = consumeWalletDeepLink();
        if (deepLink && deepLink.mode === 'world') {
            console.info('[ConnectDialog] Applying landing deep link → SELECTCHAR');
            setConnectWalletSession(deepLink.session);
            enterPlayWorldPhase(deepLink.session);
            clearWalletDeepLink();
            return;
        }

        // Already mid auto-enter from a previous Strict Mode pass — do not re-fire Phantom.
        if (!tryAcquireAutoEnterWorldLock()) {
            return;
        }
        if (!consumeAutoEnterWorldFlag()) {
            releaseAutoEnterWorldLock();
            return;
        }

        console.info('[ConnectDialog] Auto-enter World from landing → Phantom / SELECTCHAR');
        void handleEnterWorldFromHub()
            .catch((err) => {
                console.warn('[ConnectDialog] Auto-enter World failed', err);
            })
            .finally(() => {
                releaseAutoEnterWorldLock();
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, phase]);

    /** Loads SELECTCHAR metadata once when the desk opens. */
    useEffect(() => {
        if (!isOpen || phase !== 'play-world' || !walletSession) {
            return;
        }

        let cancelled = false;
        setCharacterListLoading(true);
        void fetchCharacterList(host, port, walletSession.wallet, walletSession.token)
            .then((result) => {
                if (cancelled) {
                    return;
                }
                const slots = result.slots;
                setCharacterSlots(slots);
                setReferralInfo(result.referral ?? null);
                const firstOccupied = slots[0];
                if (isPlaytestClient() && walletSession) {
                    const slotIndex = firstOccupied?.slotIndex ?? 0;
                    setSelectedSlotIndex(slotIndex);
                    setCharacterName(PLAYTEST_CHARACTER_NAME);
                    setConnectDialogOpen(false);
                    EventBus.emit(IN_UI_CONNECT_TO_SERVER, {
                        host,
                        port,
                        characterName: PLAYTEST_CHARACTER_NAME,
                        slotIndex,
                        preferredInitialWorldId: getPreferredInitialWorldId(),
                        walletSession: {
                            wallet: walletSession.wallet,
                            token: walletSession.token,
                            expiresAt: walletSession.expiresAt,
                        },
                    });
                } else if (firstOccupied) {
                    setSelectedSlotIndex(firstOccupied.slotIndex);
                    setCharacterName(firstOccupied.name);
                } else {
                    // No playable character yet → Create Character is step 1 (cannot Start).
                    setSelectedSlotIndex(0);
                    setCharacterName('');
                    setConnectGatePhase('create-char');
                    EventBus.emit(TOAST_REQUESTED, {
                        message: 'Create your character first (name, looks, stats), then Start.',
                        severity: 'info',
                        autoClose: 4500,
                    });
                }
            })
            .catch((error) => {
                if (cancelled) {
                    return;
                }
                setCharacterSlots([]);
                setReferralInfo(null);
                const message = error instanceof Error ? error.message : 'Failed to load characters.';
                console.warn('[ConnectDialog] Character list failed:', message);
                if (isPlaytestClient() && walletSession) {
                    setSelectedSlotIndex(0);
                    setCharacterName(PLAYTEST_CHARACTER_NAME);
                    setConnectDialogOpen(false);
                    EventBus.emit(IN_UI_CONNECT_TO_SERVER, {
                        host,
                        port,
                        characterName: PLAYTEST_CHARACTER_NAME,
                        slotIndex: 0,
                        preferredInitialWorldId: getPreferredInitialWorldId(),
                        walletSession: {
                            wallet: walletSession.wallet,
                            token: walletSession.token,
                            expiresAt: walletSession.expiresAt,
                        },
                    });
                    return;
                }
                EventBus.emit(TOAST_REQUESTED, {
                    message,
                    severity: 'warning',
                    autoClose: 4000,
                });
            })
            .finally(() => {
                if (!cancelled) {
                    setCharacterListLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isOpen, phase, walletSession, host, port]);

    /** Phaser SELECTCHAR Start / Create / Back → connect, create desk, or hub. */
    useEffect(() => {
        if (!isOpen || phase !== 'play-world') {
            return;
        }

        const onAction = (payload: SelectCharActionPayload) => {
            setSelectedSlotIndex(payload.slotIndex);
            const occupied = slotForIndex(characterSlots, payload.slotIndex);
            if (payload.kind === 'start' && occupied) {
                setCharacterName(occupied.name);
                emitConnect({
                    characterName: occupied.name,
                    slotIndex: occupied.slotIndex,
                });
                return;
            }
            // Empty slot / Create New → classic Create Character desk (never reuse another slot's name).
            setConnectGatePhase('create-char');
        };

        const onBack = () => {
            setConnectGatePhase('hub');
        };

        EventBus.on(OUT_UI_SELECTCHAR_ACTION, onAction);
        EventBus.on(OUT_UI_SELECTCHAR_BACK, onBack);
        return () => {
            EventBus.off(OUT_UI_SELECTCHAR_ACTION, onAction);
            EventBus.off(OUT_UI_SELECTCHAR_BACK, onBack);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, phase, characterSlots, walletSession]);

    /** Phaser Create Character confirm / cancel. */
    useEffect(() => {
        if (!isOpen || phase !== 'create-char') {
            return;
        }

        const onConfirm = (payload: CreateCharConfirmPayload) => {
            setSelectedSlotIndex(payload.slotIndex);
            setCharacterName(payload.characterName);
            emitConnect({
                characterName: payload.characterName,
                slotIndex: payload.slotIndex,
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
            });
        };

        const onCancel = () => {
            setConnectGatePhase('play-world');
        };

        EventBus.on(OUT_UI_CREATECHAR_CONFIRM, onConfirm);
        EventBus.on(OUT_UI_CREATECHAR_CANCEL, onCancel);
        return () => {
            EventBus.off(OUT_UI_CREATECHAR_CONFIRM, onConfirm);
            EventBus.off(OUT_UI_CREATECHAR_CANCEL, onCancel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, phase, walletSession]);

    /** Phaser Arena desk → Pre-Ready kit builder / tournament board / hub. */
    useEffect(() => {
        if (!isOpen || phase !== 'arena-lobby') {
            return;
        }

        const refreshDesk = () => setArenaDeskIndex(connectDialogStore.state.arenaDeskIndex);

        const onAction = (payload: ArenaDeskActionPayload) => {
            const desk = Math.max(0, Math.min(3, payload.deskIndex)) as ArenaDeskIndex;
            setArenaDeskIndex(desk);
            const slot = desk as ArenaSlotIndex;
            const wallet = walletSession?.wallet ?? getStoredWalletPubkey();
            const existing = getArenaKitForSlot(slot, wallet);

            if (payload.kind === 'select') {
                return;
            }

            if (payload.kind === 'enter' || payload.kind === 'enter-bleeding') {
                if (!walletSession) {
                    EventBus.emit(TOAST_REQUESTED, {
                        message: 'Connect your wallet first for Arena & Tournaments.',
                        severity: 'warning',
                    });
                    return;
                }
                if (!existing) {
                    EventBus.emit(TOAST_REQUESTED, {
                        message: 'Empty slot — use Create Character / Edit Fighter first.',
                        severity: 'warning',
                    });
                    return;
                }
                if (!isArenaKitComplete(existing)) {
                    EventBus.emit(TOAST_REQUESTED, {
                        message: 'Finish the Pre-Ready kit (Edit Fighter) first.',
                        severity: 'warning',
                    });
                    return;
                }
                const kitJson = JSON.stringify(existing);

                // Enter Bleeding Island social lobby (kit applied, open PvP outside safe).
                if (payload.kind === 'enter-bleeding') {
                    const skin =
                        existing.skinColor === 1 ? 'tanned' : existing.skinColor === 2 ? 'dark' : 'light';
                    EventBus.emit(IN_UI_CONNECT_TO_SERVER, {
                        host: getDefaultGameHost(),
                        port: getDefaultGamePort(),
                        characterName: existing.name,
                        slotIndex: 0,
                        preferredInitialWorldId: ARENA_BLEEDING_WORLD_ID,
                        gender: existing.gender === 'female' ? 'female' : 'male',
                        skinColor: skin,
                        hairStyleIndex: existing.hairStyleIndex ?? 0,
                        underwearColorIndex: existing.underwearColorIndex ?? 0,
                        str: 14,
                        vit: 12,
                        dex: 12,
                        int: 11,
                        mag: 11,
                        chr: 10,
                        walletSession,
                        arenaKitJson: kitJson,
                    });
                    EventBus.emit(TOAST_REQUESTED, {
                        message: `Entering Bleeding Island as "${existing.name}" — hang out, arrange duels, fight outside the safe.`,
                        severity: 'info',
                        autoClose: 4500,
                    });
                    return;
                }

                // Create PVP Duel panel (schedule / ready).
                openArenaPactWithKit(kitJson, existing.name, 'colosseum');
                EventBus.emit(TOAST_REQUESTED, {
                    message: `Create PVP Duel — set open date/time for "${existing.name}".`,
                    severity: 'info',
                });
                return;
            }

            if (payload.kind === 'save') {
                // Edit Fighter / Create Character only — never Start / duel flow.
                openArenaKitBuilder(slot, existing ?? createBlankArenaKit(slot));
                return;
            }

            if (payload.kind === 'delete') {
                if (!existing) {
                    EventBus.emit(TOAST_REQUESTED, {
                        message: 'No Pre-Ready fighter in this slot.',
                        severity: 'info',
                    });
                    return;
                }
                deleteArenaKit(slot, wallet);
                EventBus.emit(TOAST_REQUESTED, {
                    message: `Deleted: ${existing.name}`,
                    severity: 'success',
                });
                refreshDesk();
                return;
            }

            if (payload.kind === 'load') {
                if (!existing) {
                    EventBus.emit(TOAST_REQUESTED, {
                        message: 'Empty slot — Create a Pre-Ready fighter first.',
                        severity: 'info',
                    });
                    return;
                }
                openArenaKitBuilder(slot, existing);
            }
        };

        const onBack = () => {
            setConnectGatePhase('hub');
        };

        const onKitsChanged = () => refreshDesk();

        EventBus.on(OUT_UI_ARENA_ACTION, onAction);
        EventBus.on(OUT_UI_ARENA_BACK, onBack);
        window.addEventListener('arena-kits-changed', onKitsChanged);
        return () => {
            EventBus.off(OUT_UI_ARENA_ACTION, onAction);
            EventBus.off(OUT_UI_ARENA_BACK, onBack);
            window.removeEventListener('arena-kits-changed', onKitsChanged);
        };
    }, [isOpen, phase, walletSession]);

    /** Keep selected name in sync when Phaser changes the selected occupied slot. */
    useEffect(() => {
        if (phase !== 'play-world') {
            return;
        }
        const occupied = slotForIndex(characterSlots, selectedSlotIndex);
        if (occupied) {
            setCharacterName(occupied.name);
        }
    }, [phase, characterSlots, selectedSlotIndex]);

    const emitConnect = (
        opts: {
            characterName: string;
            slotIndex: number;
            gender?: ConnectToServerPayload['gender'];
            skinColor?: ConnectToServerPayload['skinColor'];
            hairStyleIndex?: number;
            underwearColorIndex?: number;
            str?: number;
            vit?: number;
            dex?: number;
            int?: number;
            mag?: number;
            chr?: number;
            session?: ConnectToServerPayload['walletSession'];
            preferredInitialWorldId?: string;
            arenaKitJson?: string;
        },
    ) => {
        const trimmedName = opts.characterName.trim();
        if (trimmedName.length === 0) {
            EventBus.emit(TOAST_REQUESTED, { message: 'Character name is required.', severity: 'warning' });
            return;
        }

        const sessionToUse = opts.session ?? walletSession ?? undefined;
        setLastConnectAttempt({
            characterName: trimmedName,
            host,
            port,
            slotIndex: opts.slotIndex,
        });
        setConnectDialogOpen(false);
        EventBus.emit(IN_UI_CONNECT_TO_SERVER, {
            host,
            port,
            characterName: trimmedName,
            slotIndex: opts.slotIndex,
            preferredInitialWorldId: opts.preferredInitialWorldId ?? getPreferredInitialWorldId(),
            gender: opts.gender,
            skinColor: opts.skinColor,
            hairStyleIndex: opts.hairStyleIndex,
            underwearColorIndex: opts.underwearColorIndex,
            str: opts.str,
            vit: opts.vit,
            dex: opts.dex,
            int: opts.int,
            mag: opts.mag,
            chr: opts.chr,
            walletSession: sessionToUse,
            arenaKitJson: opts.arenaKitJson,
        } satisfies ConnectToServerPayload);
    };

    const handleWalletConnect = async (): Promise<typeof walletSession> => {
        setWalletBusy(true);
        setHubError(undefined);
        try {
            const session = await connectWalletAndAuthenticate();
            setConnectWalletSession(session);
            EventBus.emit(TOAST_REQUESTED, {
                message: `Wallet connected: ${session.wallet.slice(0, 4)}…${session.wallet.slice(-4)}`,
                severity: 'success',
            });
            return session;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Wallet connection failed';
            setHubError(message);
            EventBus.emit(TOAST_REQUESTED, { message, severity: 'error' });
            return null;
        } finally {
            setWalletBusy(false);
        }
    };

    /**
     * Opens a Phaser desk after the hub. Phantom close often synthesizes a late click and
     * a focus/layout pass — suppress long enough, then enter play-world atomically so the
     * hub never unmounts without SELECTCHAR phase (avoids a stuck black stage).
     */
    const enterPhaserDeskPhase = (phase: 'play-world' | 'arena-lobby', afterWalletAuth: boolean) => {
        EventBus.emit(IN_UI_SUPPRESS_POINTER_INPUT, afterWalletAuth ? 1200 : 400);
        const applyPhase = () => {
            if (phase === 'play-world') {
                const session = connectDialogStore.state.walletSession;
                if (session) {
                    enterPlayWorldPhase(session);
                    return;
                }
            }
            setConnectGatePhase(phase);
        };
        if (!afterWalletAuth) {
            applyPhase();
            return;
        }
        // Let Phantom's closing layout settle one tick, then pin SELECTCHAR.
        window.setTimeout(applyPhase, 50);
    };

    /** One click: Phantom sign (if needed) → classic SELECTCHAR desk. */
    const handleEnterWorldFromHub = async () => {
        setHubError(undefined);
        if (isPlaytestClient()) {
            const session = createPlaytestWalletSession();
            setConnectWalletSession(session);
            enterPhaserDeskPhase('play-world', false);
            return;
        }
        let session = walletSession;
        let justAuthed = false;
        if (!session) {
            session = await handleWalletConnect();
            if (!session) {
                return;
            }
            justAuthed = true;
        }
        enterPhaserDeskPhase('play-world', justAuthed);
    };

    useEffect(() => {
        if (!isOpen || phase !== 'hub' || !isPlaytestClient() || playtestAutoEnteredRef.current) {
            return;
        }
        playtestAutoEnteredRef.current = true;
        void handleEnterWorldFromHub();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, phase]);

    const handleEnterArenaFromHub = () => {
        if (isPlaytestClient()) {
            const message = 'Arena is not part of this playtest door.';
            setHubError(message);
            EventBus.emit(TOAST_REQUESTED, { message, severity: 'info', autoClose: 5000 });
            return;
        }
        if (!ARENA_ENTRY_ENABLED) {
            setHubError(ARENA_CLOSED_MESSAGE);
            EventBus.emit(TOAST_REQUESTED, {
                message: ARENA_CLOSED_MESSAGE,
                severity: 'info',
                autoClose: 6000,
            });
            return;
        }
        if (!walletSession) {
            const message = 'Connect your wallet first to enter Helbreath Arena.';
            setHubError(message);
            EventBus.emit(TOAST_REQUESTED, {
                message,
                severity: 'warning',
            });
            return;
        }
        setHubError(undefined);
        setArenaDeskIndex(0);
        enterPhaserDeskPhase('arena-lobby', false);
    };

    if (!isOpen) {
        return null;
    }

    const walletShort = walletSession
        ? `${walletSession.wallet.slice(0, 4)}…${walletSession.wallet.slice(-4)}`
        : undefined;

    // Phaser owns SELECTCHAR / Create Character / Arena — no React chrome over the classic desks.
    if (phase === 'play-world' || phase === 'create-char' || phase === 'arena-lobby') {
        return null;
    }

    return (
        <div
            className="login-hub"
            style={{ zIndex }}
            data-dialog-id="connect-dialog"
            onContextMenu={(ev) => ev.preventDefault()}
        >
            <div className="login-hub-atmosphere" aria-hidden="true" />

            <div className="login-hub-columns">
                {/* LEFT — World CTA high · Aresden/Elendiel · World Streamers (tall) */}
                <section className="login-hub-path login-hub-world" aria-labelledby="hub-world-title">
                    <div className="login-hub-path-veil" aria-hidden="true" />
                    <div className="login-hub-path-body login-hub-path-body--stack-top">
                        <div className="login-hub-path-portal login-hub-path-portal--compact">
                            <p className="login-hub-path-kicker">
                                {isPlaytestClient() ? 'Playtest door — not live' : 'Under the goddesses'}
                            </p>
                            <h2 id="hub-world-title" className="login-hub-path-title">
                                Helbreath World
                            </h2>
                            <p className="login-hub-path-lead">
                                {isPlaytestClient()
                                    ? `No Phantom. Character ${PLAYTEST_CHARACTER_NAME}. Kill a mob on this isolated host.`
                                    : 'Pledge your seal, then choose a hero under Aresden or Elendiel.'}
                            </p>
                            {walletShort && (
                                <div className="login-gate-wallet-chip">Seal {walletShort}</div>
                            )}
                            <button
                                type="button"
                                className="login-gate-primary-btn login-hub-path-cta"
                                disabled={walletBusy}
                                onClick={() => void handleEnterWorldFromHub()}
                            >
                                {isPlaytestClient()
                                    ? `Enter as ${PLAYTEST_CHARACTER_NAME}`
                                    : walletBusy
                                      ? 'Binding seal…'
                                      : walletSession
                                        ? 'Enter Helbreath World'
                                        : 'Bind seal & enter'}
                            </button>
                        </div>

                        <div className="hub-nation-row" aria-label="Cities">
                            <button
                                type="button"
                                className="hub-nation-btn hub-nation-btn--aresden"
                                disabled={walletBusy}
                                onClick={() => void handleEnterWorldFromHub()}
                                title="Enter World · Aresden"
                            >
                                <span className="hub-nation-sigil" aria-hidden="true" />
                                <span className="hub-nation-name">Aresden</span>
                                <span className="hub-nation-epithet">War</span>
                            </button>
                            <button
                                type="button"
                                className="hub-nation-btn hub-nation-btn--elendiel"
                                disabled={walletBusy}
                                onClick={() => void handleEnterWorldFromHub()}
                                title="Enter World · Elendiel"
                            >
                                <span className="hub-nation-sigil" aria-hidden="true" />
                                <span className="hub-nation-name">Elendiel</span>
                                <span className="hub-nation-epithet">Grace</span>
                            </button>
                        </div>

                        <HubWorldStreamersRail />

                        {/* Bottom-left: My PVP Challenges (was center) */}
                        <section className="login-hub-pvp-inbox login-hub-pvp-inbox--left" aria-label="PVP challenges">
                            <div className="login-hub-pvp-inbox-head">
                                <h3 className="login-hub-pvp-inbox-title">My PVP Challenges</h3>
                                <button
                                    type="button"
                                    className="login-hub-pvp-inbox-refresh"
                                    disabled={pvpInboxBusy || !walletSession}
                                    onClick={() => void refreshPvpInbox()}
                                >
                                    {pvpInboxBusy ? '…' : 'Refresh'}
                                </button>
                            </div>
                            {!walletSession ? (
                                <p className="login-hub-pvp-inbox-empty">
                                    Connect your wallet to see challenges when someone invites you to a
                                    duel.
                                </p>
                            ) : pvpInvites.length === 0 ? (
                                <p className="login-hub-pvp-inbox-empty">
                                    No pending challenges. When someone invites you, ACCEPT / DECLINE /
                                    4HONOR appear here.
                                </p>
                            ) : (
                                <ul className="login-hub-pvp-inbox-list">
                                    {pvpInvites.map((inv) => {
                                        const stake =
                                            inv.stakeAmount && Number(inv.stakeAmount) > 0
                                                ? `${String(inv.stakeAmount)} ${inv.stakeAssetId || 'USDT'} each`
                                                : 'Honor (no $)';
                                        const when = inv.opensAtMs
                                            ? new Date(Number(inv.opensAtMs)).toLocaleString()
                                            : inv.status;
                                        return (
                                            <li key={inv.matchId} className="login-hub-pvp-inbox-row">
                                                <div className="login-hub-pvp-inbox-meta">
                                                    <strong>{inv.hostName}</strong>
                                                    <span>
                                                        {inv.mapId} · {stake}
                                                    </span>
                                                    <span className="login-hub-pvp-inbox-when">{when}</span>
                                                </div>
                                                <div className="login-hub-pvp-inbox-actions">
                                                    <button
                                                        type="button"
                                                        className="login-hub-pvp-btn login-hub-pvp-btn--accept"
                                                        disabled={pvpInboxBusy}
                                                        onClick={() => handleHubAccept(inv, 'accept')}
                                                    >
                                                        ACCEPT
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="login-hub-pvp-btn login-hub-pvp-btn--decline"
                                                        disabled={pvpInboxBusy}
                                                        onClick={() => void handleHubDecline(inv)}
                                                    >
                                                        DECLINE
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="login-hub-pvp-btn login-hub-pvp-btn--honor"
                                                        disabled={pvpInboxBusy}
                                                        title="Jugar por el Honor — sin bolsa de $"
                                                        onClick={() => handleHubAccept(inv, 'honor')}
                                                    >
                                                        4HONOR
                                                    </button>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>
                    </div>
                </section>

                {/* CENTER — wallpaper faces + small kicker only */}
                <section className="login-hub-goddesses" aria-label="Helbreath center">
                    <div className="login-hub-goddesses-art" aria-hidden="true" />
                    <div className="login-hub-goddesses-veil" aria-hidden="true" />

                    <div className="login-hub-goddesses-brand login-hub-goddesses-brand--compact">
                        <p className="login-hub-kicker">Helbreath - Chain Lords</p>
                    </div>
                </section>

                {/* RIGHT — Arena CTA high · Rankings · PVP/Duels/Tournaments schedule */}
                <section className="login-hub-path login-hub-arenas" aria-labelledby="hub-arena-title">
                    <div className="login-hub-path-veil" aria-hidden="true" />
                    <div className="login-hub-path-body login-hub-path-body--stack-top">
                        <div className="login-hub-path-portal login-hub-path-portal--compact">
                            <p className="login-hub-path-kicker">The Coliseum</p>
                            <h2 id="hub-arena-title" className="login-hub-path-title">
                                Helbreath Arena
                            </h2>
                            <p className="login-hub-path-lead">
                                {ARENA_ENTRY_ENABLED
                                    ? 'Fair trials — Coliseum kit (Lv150 + 1000 gear credits).'
                                    : 'Under production. Entry closed until ready.'}
                            </p>
                            {!ARENA_ENTRY_ENABLED ? (
                                <button
                                    type="button"
                                    className="login-gate-primary-btn login-hub-path-cta"
                                    disabled
                                    title={ARENA_CLOSED_MESSAGE}
                                    onClick={handleEnterArenaFromHub}
                                >
                                    Coming soon — Arena closed
                                </button>
                            ) : !walletSession ? (
                                <button
                                    type="button"
                                    className="login-gate-primary-btn login-hub-path-cta"
                                    disabled={walletBusy}
                                    onClick={() => void handleWalletConnect()}
                                >
                                    {walletBusy ? 'Binding seal…' : 'Bind wallet seal'}
                                </button>
                            ) : (
                                <>
                                    <div className="login-gate-wallet-chip">Seal {walletShort}</div>
                                    <button
                                        type="button"
                                        className="login-gate-primary-btn login-hub-path-cta"
                                        onClick={handleEnterArenaFromHub}
                                    >
                                        Enter Helbreath Arena
                                    </button>
                                </>
                            )}
                        </div>

                        <HubWorldRankingButtons />
                        <HubGlobalPvpRail />
                    </div>
                </section>
            </div>

            <div className="login-hub-watch-bar login-hub-watch-bar--below">
                <button
                    type="button"
                    className="login-hub-watch-btn"
                    onClick={() => openDuelWatch('streams')}
                >
                    📺 Full CHAIN LORDS TV guide
                </button>
            </div>

            {hubError && (
                <p className="login-hub-error" role="alert">
                    {hubError}
                </p>
            )}
        </div>
    );
}
