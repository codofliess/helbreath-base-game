import { useEffect } from 'react';
import { useStore } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { OUT_UI_SET_MUSIC_VOLUME, OUT_UI_SET_SOUND_VOLUME } from '../../constants/EventNames';
import { DIALOG_VOLUME_SLIDER, SYS_MENU_DIALOG_BG, SYS_MENU_DIALOG_TITLE } from '../../constants/SpriteKeys';
import { performLogoutCleanup } from '../../utils/LogoutUtils';
import type { IRefPhaserGame } from '../../PhaserGame';
import { getNetworkManager } from '../../utils/RegistryUtils';
import { OlympiaDialogShell } from '../components/OlympiaDialogShell';
import { appStore } from '../store/App.store';
import { soundDialogStore, setMusicVolume, setSoundVolume } from '../store/SoundDialog.store';
import {
    setDetailLevel,
    setGuideMapEnabled,
    setMusicEnabled,
    setRainSoundsEnabled,
    setShoutEnabled,
    setSoundEnabled,
    setSysMenuDialogOpen,
    setTransparencyEnabled,
    setWhisperEnabled,
    SYS_MENU_SHORTCUTS,
    sysMenuDialogStore,
    type DetailLevel,
} from '../store/SysMenuDialog.store';
import {
    chatTranslationStore,
    setPreferredChatLanguageId,
    setShowSpeakerLanguageTag,
} from '../store/ChatTranslation.store';
import { CHAT_LANGUAGE_OPTIONS } from '../../constants/ChatLanguages';
import { setMinimapDialogOpen } from '../store/MinimapDialog.store';
import { setTrainingDialogOpen } from '../store/TrainingDialog.store';
import { openAuctionBoard } from '../store/AuctionBoardDialog.store';
import { setAntiBotToolsDialogOpen } from '../store/AntiBotToolsDialog.store';
import { hellMiningStore } from '../store/HellMining.store';
import { showGmSandboxUi } from '../../utils/playerMode';
import { setCharacterDialogOpen, setCharacterSubPanel } from '../store/CharacterDialog.store';
import { mapDialogStore, setDisplayGrid } from '../store/MapDialog.store';

interface SysMenuDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
    onPositionChange?: (position: { x: number; y: number }) => void;
    phaserRef?: React.RefObject<IRefPhaserGame | null>;
}

/** Shortcut chip left of the control (On/Off or detail buttons). */
function ShortcutBadge({ keys }: { keys?: string }) {
    if (!keys) {
        return <span className="sys-menu-shortcut sys-menu-shortcut--empty" aria-hidden />;
    }
    return (
        <span className="sys-menu-shortcut" title={`Shortcut: ${keys}`}>
            {keys}
        </span>
    );
}

function ToggleRow({
    label,
    shortcut,
    enabled,
    onToggle,
}: {
    label: string;
    shortcut?: string;
    enabled: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="sys-menu-row">
            <span className="sys-menu-label">{label}</span>
            <span className="sys-menu-row-end">
                <ShortcutBadge keys={shortcut} />
                <button type="button" className="sys-menu-toggle" onClick={onToggle} title={shortcut ? `${label} (${shortcut})` : label}>
                    {enabled ? 'On' : 'Off'}
                </button>
            </span>
        </div>
    );
}

export function SysMenuDialog({
    position,
    zIndex,
    onBringToFront,
    onPositionChange,
    phaserRef,
}: SysMenuDialogProps) {
    const isOpen = useStore(sysMenuDialogStore, (s) => s.isOpen);
    const state = useStore(sysMenuDialogStore, (s) => s);
    const hellMining = useStore(hellMiningStore);
    const displayGrid = useStore(mapDialogStore, (s) => s.displayGrid);
    const preferredLanguageId = useStore(chatTranslationStore, (s) => s.preferredLanguageId);
    const showSpeakerLanguageTag = useStore(chatTranslationStore, (s) => s.showSpeakerLanguageTag);
    const musicVolume = useStore(soundDialogStore, (s) => s.musicVolume);
    const soundVolume = useStore(soundDialogStore, (s) => s.soundVolume);
    const sliderSprite = useStore(appStore, (s) => s.spriteFrameMap.get(DIALOG_VOLUME_SLIDER));
    const titleOverlay = useStore(appStore, (s) => s.spriteFrameMap.get(SYS_MENU_DIALOG_TITLE));

    const network = () => {
        const game = phaserRef?.current?.game;
        return game ? getNetworkManager(game) : undefined;
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        network()?.sendHellMiningStatusRequest();
    }, [isOpen, phaserRef]);

    if (!isOpen) {
        return null;
    }

    const now = new Date();
    const stamp = `${now.getMonth() + 1}:${now.getDate()}:${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;

    const setDetail = (level: DetailLevel) => {
        setDetailLevel(level);
    };

    const handleVolumeChange = (kind: 'music' | 'sound', value: number) => {
        if (kind === 'music') {
            setMusicVolume(value, true);
            EventBus.emit(OUT_UI_SET_MUSIC_VOLUME, value);
        } else {
            setSoundVolume(value, true);
            EventBus.emit(OUT_UI_SET_SOUND_VOLUME, value);
        }
    };

    return (
        <OlympiaDialogShell
            id="sys-menu-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onPositionChange={onPositionChange}
            onContextMenu={(ev) => {
                ev.preventDefault();
                setSysMenuDialogOpen(false);
            }}
            width={Math.round(258 * 1.2)}
            minHeight={Math.round(360 * 1.2)}
            bgSpriteKey={SYS_MENU_DIALOG_BG}
            rootClassName="sys-menu-dialog-root"
        >
            {titleOverlay && (
                <div
                    className="olympia-dialog-title-overlay"
                    style={{ backgroundImage: `url(${titleOverlay})` }}
                    aria-hidden
                />
            )}
            <div className="olympia-dialog-title-bar sys-menu-dialog-title hb-nemesis-dialog-title">
                System Menu
                <span className="sys-menu-title-shortcut">{SYS_MENU_SHORTCUTS.sysMenu}</span>
            </div>
            <div className="sys-menu-body">
                <div className="sys-menu-row">
                    <span className="sys-menu-label">Detail Level</span>
                    <span className="sys-menu-row-end">
                        <ShortcutBadge keys={SYS_MENU_SHORTCUTS.detailLevel} />
                        <span className="sys-menu-detail-group" title={`Cycle: ${SYS_MENU_SHORTCUTS.detailLevel}`}>
                            <button type="button" className={`sys-menu-detail-btn${state.detailLevel === 0 ? ' active' : ''}`} onClick={() => setDetail(0)}>Low</button>
                            <button type="button" className={`sys-menu-detail-btn${state.detailLevel === 1 ? ' active' : ''}`} onClick={() => setDetail(1)}>Normal</button>
                            <button type="button" className={`sys-menu-detail-btn${state.detailLevel === 2 ? ' active' : ''}`} onClick={() => setDetail(2)}>High</button>
                        </span>
                    </span>
                </div>

                <ToggleRow
                    label="Sound"
                    shortcut={SYS_MENU_SHORTCUTS.sound}
                    enabled={state.soundEnabled}
                    onToggle={() => setSoundEnabled(!state.soundEnabled)}
                />
                <ToggleRow
                    label="Music"
                    shortcut={SYS_MENU_SHORTCUTS.music}
                    enabled={state.musicEnabled}
                    onToggle={() => setMusicEnabled(!state.musicEnabled)}
                />
                <ToggleRow
                    label="Rain sounds"
                    shortcut={SYS_MENU_SHORTCUTS.rainSounds}
                    enabled={state.rainSoundsEnabled}
                    onToggle={() => setRainSoundsEnabled(!state.rainSoundsEnabled)}
                />
                <ToggleRow
                    label="Whisper"
                    shortcut={SYS_MENU_SHORTCUTS.whisper}
                    enabled={state.whisperEnabled}
                    onToggle={() => setWhisperEnabled(!state.whisperEnabled)}
                />
                <ToggleRow
                    label="Shout"
                    shortcut={SYS_MENU_SHORTCUTS.shout}
                    enabled={state.shoutEnabled}
                    onToggle={() => setShoutEnabled(!state.shoutEnabled)}
                />

                <div className="sys-menu-row">
                    <span className="sys-menu-label">Sound Volume</span>
                    <span className="sys-menu-row-end sys-menu-row-end--slider">
                        <ShortcutBadge />
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={soundVolume}
                            disabled={!state.soundEnabled}
                            className="sys-menu-slider"
                            onChange={(ev) => handleVolumeChange('sound', Number(ev.target.value))}
                        />
                        {sliderSprite && <img src={sliderSprite} alt="" className="sys-menu-slider-knob" draggable={false} />}
                    </span>
                </div>

                <div className="sys-menu-row">
                    <span className="sys-menu-label">Music Volume</span>
                    <span className="sys-menu-row-end sys-menu-row-end--slider">
                        <ShortcutBadge />
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={musicVolume}
                            disabled={!state.musicEnabled}
                            className="sys-menu-slider"
                            onChange={(ev) => handleVolumeChange('music', Number(ev.target.value))}
                        />
                    </span>
                </div>

                <ToggleRow
                    label="Transparency"
                    shortcut={SYS_MENU_SHORTCUTS.transparency}
                    enabled={state.transparencyEnabled}
                    onToggle={() => setTransparencyEnabled(!state.transparencyEnabled)}
                />
                <ToggleRow
                    label="Guide Map"
                    shortcut={SYS_MENU_SHORTCUTS.guideMap}
                    enabled={state.guideMapEnabled}
                    onToggle={() => {
                        const next = !state.guideMapEnabled;
                        setGuideMapEnabled(next);
                        setMinimapDialogOpen(next);
                    }}
                />

                <div className="sys-menu-row">
                    <span className="sys-menu-label">Language</span>
                    <span className="sys-menu-row-end">
                        <ShortcutBadge />
                        <select
                            className="sys-menu-select"
                            value={preferredLanguageId}
                            title="UI + chat language (bag labels, Holy Spirit incoming chat). Ctrl+L cycles tag display."
                            aria-label="Language"
                            onChange={(ev) => setPreferredChatLanguageId(ev.target.value)}
                        >
                            {CHAT_LANGUAGE_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </span>
                </div>
                <ToggleRow
                    label="Lang Tag"
                    shortcut={SYS_MENU_SHORTCUTS.langTag}
                    enabled={showSpeakerLanguageTag}
                    onToggle={() => setShowSpeakerLanguageTag(!showSpeakerLanguageTag)}
                />
                <ToggleRow
                    label="Show Grid"
                    shortcut={SYS_MENU_SHORTCUTS.showGrid}
                    enabled={displayGrid}
                    onToggle={() => setDisplayGrid(!displayGrid)}
                />

                <div className="sys-menu-stamp">{stamp}</div>

                <button
                    type="button"
                    className="olympia-text-btn sys-menu-training"
                    title={`Training (${SYS_MENU_SHORTCUTS.training})`}
                    onClick={() => {
                        setSysMenuDialogOpen(false);
                        setTrainingDialogOpen(true);
                    }}
                >
                    <span className="sys-menu-action-shortcut">{SYS_MENU_SHORTCUTS.training}</span>
                    Training
                </button>

                <button
                    type="button"
                    className="olympia-text-btn sys-menu-auction"
                    onClick={() => {
                        setSysMenuDialogOpen(false);
                        openAuctionBoard();
                    }}
                >
                    Auction Board
                </button>

                <div className="sys-menu-hell-mining" title={hellMining.note || undefined}>
                    <div className="sys-menu-row">
                        <span className="sys-menu-label">$HELL pending</span>
                        <span className="sys-menu-hell-value">{hellMining.pendingHell.toLocaleString()}</span>
                    </div>
                    <div className="sys-menu-row">
                        <span className="sys-menu-label">Today credits</span>
                        <span className="sys-menu-hell-value">
                            {hellMining.todayCredits}
                            {hellMining.todayMonsterCreditGranted ? ' · 500 kills ✓' : ` · kills ${hellMining.todayMonsterKills}/500`}
                        </span>
                    </div>
                    {hellMining.lastClaimMessage ? (
                        <div className="sys-menu-hell-note">{hellMining.lastClaimMessage}</div>
                    ) : hellMining.note ? (
                        <div className="sys-menu-hell-note">{hellMining.note}</div>
                    ) : null}
                    <button
                        type="button"
                        className="olympia-text-btn sys-menu-hell-refresh"
                        onClick={() => network()?.sendHellMiningStatusRequest()}
                    >
                        Refresh mining
                    </button>
                    {hellMining.claimAvailable && hellMining.pendingHell > 0 ? (
                        <button
                            type="button"
                            className="olympia-text-btn sys-menu-hell-claim"
                            onClick={() => network()?.sendHellMiningClaimRequest(0)}
                        >
                            Claim info
                        </button>
                    ) : null}
                </div>

                {showGmSandboxUi() ? (
                    <button
                        type="button"
                        className="olympia-text-btn sys-menu-antibot"
                        onClick={() => {
                            setSysMenuDialogOpen(false);
                            setAntiBotToolsDialogOpen(true);
                        }}
                    >
                        Anti-Bot / Ops
                    </button>
                ) : null}

                <button
                    type="button"
                    className="olympia-text-btn sys-menu-feedback"
                    onClick={() => {
                        setSysMenuDialogOpen(false);
                        setCharacterDialogOpen(true);
                        setCharacterSubPanel('feedback');
                    }}
                >
                    Feedback
                </button>

                <button
                    type="button"
                    className="olympia-text-btn sys-menu-logout"
                    onClick={() => {
                        setSysMenuDialogOpen(false);
                        performLogoutCleanup();
                    }}
                >
                    Log out
                </button>
            </div>
        </OlympiaDialogShell>
    );
}
