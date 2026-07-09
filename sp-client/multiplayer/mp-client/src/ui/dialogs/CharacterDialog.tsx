import { useState, type PointerEvent } from 'react';
import { useStore } from '@tanstack/react-store';
import { HeadlessDraggableDialog } from './HeadlessDraggableDialog';
import { EquippedSlotsGrid } from '../components/EquippedSlotsGrid';
import { appStore } from '../store/App.store';
import { guildStore } from '../store/Guild.store';
import {
    characterDialogStore,
    setCharacterSubPanel,
    adjustLevelUpStat,
    resetLevelUpDraft,
    type CharacterSubPanel,
} from '../store/CharacterDialog.store';
import {
    CHARACTER_DIALOG_BG,
    DIALOG_BTN_QUEST,
    DIALOG_BTN_QUEST_HOVER,
    DIALOG_BTN_LEVELSET,
    DIALOG_BTN_LEVELSET_HOVER,
} from '../../constants/SpriteKeys';

interface CharacterDialogProps {
    position: { x: number; y: number };
    onClose: () => void;
    zIndex?: number;
    onBringToFront?: () => void;
}

function formatNum(n: number): string {
    return n.toLocaleString('en-US');
}

function stopDialogPointer(e: PointerEvent) {
    e.stopPropagation();
}

function CharacterTextButton({
    title,
    onClick,
    className,
}: {
    title: string;
    onClick: () => void;
    className?: string;
}) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            onPointerDown={stopDialogPointer}
            className={className ?? 'character-dialog-text-btn'}
        >
            {title}
        </button>
    );
}

function SpriteButton({
    normalKey,
    hoverKey,
    title,
    onClick,
    className,
}: {
    normalKey: string;
    hoverKey: string;
    title: string;
    onClick: () => void;
    className?: string;
}) {
    const spriteFrameMap = useStore(appStore, (s) => s.spriteFrameMap);
    const [hovered, setHovered] = useState(false);
    const [imgFailed, setImgFailed] = useState(false);
    const src = spriteFrameMap.get(hovered ? hoverKey : normalKey) ?? spriteFrameMap.get(normalKey);

    if (src && !imgFailed) {
        return (
            <button
                type="button"
                title={title}
                onClick={onClick}
                onPointerDown={stopDialogPointer}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                className={className ?? 'character-sprite-btn'}
                style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                }}
            >
                <img
                    src={src}
                    alt={title}
                    className="character-sprite-btn-img"
                    draggable={false}
                    onError={() => setImgFailed(true)}
                />
            </button>
        );
    }

    return (
        <CharacterTextButton title={title} onClick={onClick} className={className} />
    );
}

function StatRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
    return (
        <div className="character-stat-row">
            <span className="character-stat-label">{label}</span>
            <span className="character-stat-value" style={valueColor ? { color: valueColor } : undefined}>{value}</span>
        </div>
    );
}

function SubPanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
    return (
        <div className="character-subpanel-header">
            <button type="button" className="character-dialog-text-btn" onClick={onBack} onPointerDown={stopDialogPointer}>
                ← Volver
            </button>
            <span className="character-subpanel-title">{title}</span>
        </div>
    );
}

function QuestPanel({ onBack }: { onBack: () => void }) {
    return (
        <div className="character-subpanel">
            <SubPanelHeader title="Quests" onBack={onBack} />
            <p className="character-subpanel-body">No estás en ninguna quest activa.</p>
            <p className="character-subpanel-hint">Las quests Olympia se portarán en la siguiente fase.</p>
        </div>
    );
}

function PartyPanel({ onBack }: { onBack: () => void }) {
    return (
        <div className="character-subpanel">
            <SubPanelHeader title="Party" onBack={onBack} />
            <p className="character-subpanel-body">No pertenecés a ningún party.</p>
            <p className="character-subpanel-hint">Invitá jugadores cercanos o unite a un party existente.</p>
        </div>
    );
}

function LevelSetPanel({ onBack }: { onBack: () => void }) {
    const stats = useStore(characterDialogStore, (s) => s.stats);
    const draft = useStore(characterDialogStore, (s) => s.levelUpDraft);

    const rows: Array<{ key: 'str' | 'vit' | 'dex' | 'int' | 'mag' | 'chr'; label: string; base: number }> = [
        { key: 'str', label: 'Str', base: stats.str },
        { key: 'vit', label: 'Vit', base: stats.vit },
        { key: 'dex', label: 'Dex', base: stats.dex },
        { key: 'int', label: 'Int', base: stats.int },
        { key: 'mag', label: 'Mag', base: stats.mag },
        { key: 'chr', label: 'Chr', base: stats.chr },
    ];

    return (
        <div className="character-subpanel">
            <SubPanelHeader title="Level Set" onBack={onBack} />
            <p className="character-subpanel-body">
                Puntos disponibles: <strong style={{ color: draft.pointsLeft > 0 ? '#80ff80' : '#ccc' }}>{draft.pointsLeft}</strong>
            </p>
            <div className="character-levelset-grid">
                {rows.map(({ key, label, base }) => (
                    <div key={key} className="character-levelset-row">
                        <span className="character-stat-label">{label}</span>
                        <span>{base}</span>
                        <span style={{ color: draft[key] > 0 ? '#ff8080' : '#ccc' }}>{base + draft[key]}</span>
                        <button type="button" className="character-levelset-btn" disabled={draft.pointsLeft <= 0} onClick={() => adjustLevelUpStat(key, 1)} onPointerDown={stopDialogPointer}>+</button>
                        <button type="button" className="character-levelset-btn" disabled={draft[key] <= 0} onClick={() => adjustLevelUpStat(key, -1)} onPointerDown={stopDialogPointer}>−</button>
                    </div>
                ))}
            </div>
            <button type="button" className="character-dialog-text-btn" onClick={resetLevelUpDraft} onPointerDown={stopDialogPointer} style={{ marginTop: 8 }}>
                Reiniciar
            </button>
        </div>
    );
}

function StubPanel({ title, body, onBack }: { title: string; body: string; onBack: () => void }) {
    return (
        <div className="character-subpanel">
            <SubPanelHeader title={title} onBack={onBack} />
            <p className="character-subpanel-body">{body}</p>
        </div>
    );
}

function GuildPanel({ onBack }: { onBack: () => void }) {
    const guild = useStore(guildStore);
    return (
        <div className="character-subpanel">
            <SubPanelHeader title={`Guild — ${guild.guildName}`} onBack={onBack} />
            <p className="character-subpanel-body">
                {guild.isGuildMaster ? 'Sos Guild Master.' : 'Miembro del guild.'}
            </p>
            <p className="character-subpanel-hint">
                Tax oro: {guild.tax.goldTax}% · Party: {guild.tax.partyGoldTax}% · Quest rewards: {guild.tax.questRewardTax}%
            </p>
        </div>
    );
}

export function CharacterDialog({
    position,
    onClose,
    zIndex,
    onBringToFront,
}: CharacterDialogProps) {
    const spriteFrameMap = useStore(appStore, (s) => s.spriteFrameMap);
    const stats = useStore(characterDialogStore, (s) => s.stats);
    const activeSubPanel = useStore(characterDialogStore, (s) => s.activeSubPanel);
    const guild = useStore(guildStore);

    const dialogBg = spriteFrameMap.get(CHARACTER_DIALOG_BG);
    const openSubPanel = (panel: CharacterSubPanel) => setCharacterSubPanel(panel);
    const backToMain = () => setCharacterSubPanel('main');

    const headerLine = `${stats.playerName} : Enemy Kills ${stats.enemyKills}  Contribution ${stats.contribution}`;
    const statusLine = `${stats.faction} (${guild.guildName})`;

    return (
        <HeadlessDraggableDialog
            position={position}
            id="character-dialog"
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(e) => { e.preventDefault(); onClose(); }}
            renderHeader={(listeners, attributes, isDragging) => (
                <div
                    className="character-dialog-drag-handle"
                    title="Arrastrar ventana"
                    {...listeners}
                    {...attributes}
                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                />
            )}
        >
            <div
                className="olympia-dialog-root character-dialog-root"
                style={dialogBg ? {
                    backgroundImage: `url(${dialogBg})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '100% 100%',
                } : undefined}
            >
                {activeSubPanel === 'main' && (
                    <>
                        <div className="character-dialog-header">
                            <div className="character-dialog-name">{headerLine}</div>
                            <div className="character-dialog-status">{statusLine}</div>
                        </div>

                        <div className="character-dialog-body">
                            <div className="character-dialog-equip">
                                <EquippedSlotsGrid className="inventory-equipped-area character-equipped-compact" />
                                <p className="character-equip-hint">Doble clic en un item para desequiparlo</p>
                            </div>

                            <div className="character-dialog-stats">
                                <StatRow label="Level" value={String(stats.level)} />
                                <StatRow label="Exp" value={formatNum(stats.exp)} />
                                <StatRow label="Next Exp" value={formatNum(stats.nextExp)} />
                                <StatRow label="Rested Exp" value={formatNum(stats.restedExp)} />
                                <StatRow label="Majestics" value={String(stats.majestics)} />
                                <div className="character-stat-divider" />
                                <StatRow label="HP" value={`${stats.hp}/${stats.maxHp}`} valueColor="#ff8080" />
                                <StatRow label="MP" value={`${stats.mp}/${stats.maxMp}`} valueColor="#80a0ff" />
                                <StatRow label="SP" value={`${stats.sp}/${stats.maxSp}`} valueColor="#80ff80" />
                                <div className="character-stat-divider" />
                                <StatRow label="Weight" value={`${stats.weight}/${stats.maxWeight}`} />
                                <StatRow label="Enemy Kills" value={String(stats.enemyKills)} />
                                <StatRow label="Reputation" value={String(stats.reputation)} />
                                <div className="character-stat-divider" />
                                <div className="character-stats-grid">
                                    <StatRow label="Str" value={String(stats.str)} />
                                    <StatRow label="Int" value={String(stats.int)} />
                                    <StatRow label="Dex" value={String(stats.dex)} />
                                    <StatRow label="Mag" value={String(stats.mag)} />
                                    <StatRow label="Vit" value={String(stats.vit)} />
                                    <StatRow label="Chr" value={String(stats.chr)} />
                                </div>
                                {stats.talents && (
                                    <div className="character-talents">Talents: {stats.talents}</div>
                                )}
                            </div>
                        </div>

                        <div className="character-dialog-footer">
                            <div className="character-dialog-footer-row character-dialog-footer-sprites">
                                <SpriteButton
                                    normalKey={DIALOG_BTN_QUEST}
                                    hoverKey={DIALOG_BTN_QUEST_HOVER}
                                    title="Quests"
                                    className="character-footer-btn character-footer-btn-quest"
                                    onClick={() => openSubPanel('quest')}
                                />
                                <CharacterTextButton
                                    title="Statistics"
                                    className="character-footer-btn character-footer-btn-stats character-dialog-text-btn"
                                    onClick={() => openSubPanel('statistics')}
                                />
                                <SpriteButton
                                    normalKey={DIALOG_BTN_LEVELSET}
                                    hoverKey={DIALOG_BTN_LEVELSET_HOVER}
                                    title="Level Set"
                                    className="character-footer-btn character-footer-btn-levelset"
                                    onClick={() => openSubPanel('levelSet')}
                                />
                            </div>
                            <div className="character-dialog-footer-row character-dialog-footer-extra">
                                <CharacterTextButton title="Achievements" onClick={() => openSubPanel('achievements')} />
                                <CharacterTextButton title="Guild" onClick={() => openSubPanel('guild')} />
                                <CharacterTextButton title="Party" onClick={() => openSubPanel('party')} />
                                <CharacterTextButton title="Feedback" onClick={() => openSubPanel('feedback')} />
                            </div>
                        </div>
                    </>
                )}

                {activeSubPanel === 'quest' && <QuestPanel onBack={backToMain} />}
                {activeSubPanel === 'party' && <PartyPanel onBack={backToMain} />}
                {activeSubPanel === 'levelSet' && <LevelSetPanel onBack={backToMain} />}
                {activeSubPanel === 'guild' && <GuildPanel onBack={backToMain} />}
                {activeSubPanel === 'statistics' && (
                    <StubPanel title="Statistics" body="Estadísticas de combate y progreso — próximamente." onBack={backToMain} />
                )}
                {activeSubPanel === 'achievements' && (
                    <StubPanel title="Achievements" body="Logros desbloqueados — próximamente." onBack={backToMain} />
                )}
                {activeSubPanel === 'feedback' && (
                    <StubPanel title="Feedback" body="Enviá sugerencias y reportes de bugs — próximamente." onBack={backToMain} />
                )}
            </div>
        </HeadlessDraggableDialog>
    );
}