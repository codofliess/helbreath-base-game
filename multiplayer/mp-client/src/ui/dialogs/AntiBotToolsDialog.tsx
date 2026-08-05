import { useEffect } from 'react';
import { useStore } from '@tanstack/react-store';
import { toast } from 'react-toastify';
import { TOURNAMENT_DIALOG_BG } from '../../constants/SpriteKeys';
import type { IRefPhaserGame } from '../../PhaserGame';
import { isTravelerPlayerMode } from '../../utils/playerMode';
import { getNetworkManager } from '../../utils/RegistryUtils';
import { OlympiaDialogShell } from '../components/OlympiaDialogShell';
import {
    antiBotToolsDialogStore,
    setAntiBotToolsDialogOpen,
    setAntiBotToolsDraftFlag,
    setAntiBotToolsLoading,
    setAntiBotToolsSaving,
    setAntiBotToolsStatusMessage,
    type AntiBotToolsFlags,
} from '../store/AntiBotToolsDialog.store';

interface AntiBotToolsDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
    onPositionChange?: (position: { x: number; y: number }) => void;
    phaserRef?: React.RefObject<IRefPhaserGame | null>;
}

interface ToolRowDef {
    key: keyof AntiBotToolsFlags;
    label: string;
    description: string;
    note?: string;
}

const TOOL_ROWS: ToolRowDef[] = [
    {
        key: 'guildPriorityIngress',
        label: 'Guild-priority ingress',
        description: 'Near capacity, prefer proven guild members for main-shard slots.',
    },
    {
        key: 'newPlayerSegment',
        label: 'New-player segment',
        description: 'Ultra-new / unknown accounts use overflow, queue, or delayed claim.',
    },
    {
        key: 'claimTimeSybilGate',
        label: 'Claim-time sybil gate',
        description: 'Passport / score gate on Helvet or airdrop claim (not login).',
    },
    {
        key: 'industrialMultiBoxLimits',
        label: 'Industrial multi-box limits',
        description: 'Cap concurrent sessions, action-rate ceilings, wallet-clustering hooks.',
    },
    {
        key: 'afkOnMapAllowed',
        label: 'AFK-on-map allowed',
        description: 'When OFF, long idle players get warn then kick. Default ON (social AFK OK).',
    },
    {
        key: 'tournamentInhumanPlayTelemetry',
        label: 'Tournament inhuman-play telemetry',
        description: 'Log cast / move anomaly signals in rated coliseum arenas.',
    },
    {
        key: 'tournamentHighStakesMode',
        label: 'Tournament high-stakes mode',
        description: 'Require stream / identity stubs before prize payout.',
        note: 'Flag + ops note only — no live KYC/stream check yet.',
    },
    {
        key: 'softOfflineProgression',
        label: 'Soft offline progression',
        description: 'Worker-friendly XP drip while AFK / soft offline when enabled.',
    },
];

/**
 * GM-only Anti-Bot / Ops control panel (:8080). Traveler builds must not mount this dialog.
 */
export function AntiBotToolsDialog({
    position,
    zIndex,
    onBringToFront,
    onPositionChange,
    phaserRef,
}: AntiBotToolsDialogProps) {
    const isOpen = useStore(antiBotToolsDialogStore, (s) => s.isOpen);
    const draft = useStore(antiBotToolsDialogStore, (s) => s.draft);
    const server = useStore(antiBotToolsDialogStore, (s) => s.server);
    const loading = useStore(antiBotToolsDialogStore, (s) => s.loading);
    const saving = useStore(antiBotToolsDialogStore, (s) => s.saving);
    const statusMessage = useStore(antiBotToolsDialogStore, (s) => s.statusMessage);

    useEffect(() => {
        if (!isOpen || isTravelerPlayerMode()) {
            return;
        }
        const game = phaserRef?.current?.game;
        const networkManager = game ? getNetworkManager(game) : undefined;
        if (!networkManager) {
            setAntiBotToolsStatusMessage('Not connected — join a world first.');
            return;
        }
        setAntiBotToolsLoading(true);
        setAntiBotToolsStatusMessage('Loading…');
        networkManager.requestGetAntiBotTools();
    }, [isOpen, phaserRef]);

    if (!isOpen || isTravelerPlayerMode()) {
        return null;
    }

    const handleSave = () => {
        const game = phaserRef?.current?.game;
        const networkManager = game ? getNetworkManager(game) : undefined;
        if (!networkManager) {
            toast.error('Not connected — join a world first.');
            return;
        }
        setAntiBotToolsSaving(true);
        setAntiBotToolsStatusMessage('Saving…');
        networkManager.requestSetAntiBotTools(draft);
    };

    return (
        <OlympiaDialogShell
            id="anti-bot-tools-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onPositionChange={onPositionChange}
            onContextMenu={(ev) => {
                ev.preventDefault();
                setAntiBotToolsDialogOpen(false);
            }}
            width={420}
            minHeight={420}
            bgSpriteKey={TOURNAMENT_DIALOG_BG}
            rootClassName="anti-bot-tools-dialog-root"
        >
            <div className="olympia-dialog-title-bar anti-bot-tools-title">Anti-Bot / Ops</div>
            <div className="anti-bot-tools-body">
                <p className="anti-bot-tools-intro">
                    Toggle capacity, sybil, AFK, and tournament-AI controls. Changes persist on the server.
                </p>
                {TOOL_ROWS.map((row) => (
                    <div key={row.key} className="anti-bot-tools-row">
                        <div className="anti-bot-tools-row-text">
                            <div className="anti-bot-tools-label">{row.label}</div>
                            <div className="anti-bot-tools-desc">{row.description}</div>
                            {row.note ? <div className="anti-bot-tools-note">{row.note}</div> : null}
                        </div>
                        <button
                            type="button"
                            className="sys-menu-toggle"
                            disabled={loading || saving}
                            onClick={() => setAntiBotToolsDraftFlag(row.key, !draft[row.key])}
                        >
                            {draft[row.key] ? 'On' : 'Off'}
                        </button>
                    </div>
                ))}
                {server ? (
                    <div className="anti-bot-tools-meta">
                        Cap sessions {server.maxConcurrentSessions} · rate {server.actionRateCeilingPerMin}/min · AFK
                        warn {Math.round(server.afkWarnAfterMs / 1000)}s / kick{' '}
                        {Math.round(server.afkKickAfterMs / 1000)}s
                        {server.updatedBy ? ` · last ${server.updatedBy}` : ''}
                    </div>
                ) : null}
                <div className="anti-bot-tools-status">{statusMessage}</div>
                <div className="anti-bot-tools-actions">
                    <button
                        type="button"
                        className="olympia-text-btn"
                        disabled={loading || saving}
                        onClick={handleSave}
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                        type="button"
                        className="olympia-text-btn"
                        onClick={() => setAntiBotToolsDialogOpen(false)}
                    >
                        Close
                    </button>
                </div>
            </div>
        </OlympiaDialogShell>
    );
}
