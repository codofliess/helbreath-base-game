import { type PointerEvent, type ReactNode, useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { DialogDragHandle, HeadlessDraggableDialog } from './HeadlessDraggableDialog';
import { CharacterPaperDoll } from '../components/CharacterPaperDoll';
import { OlympiaSpriteButton } from '../components/OlympiaSpriteButton';
import { appStore } from '../store/App.store';
import { guildStore } from '../store/Guild.store';
import { openGuildWarehouseDialog } from '../store/GuildWarehouseDialog.store';
import { progressionStore } from '../store/Progression.store';
import { partyStore } from '../store/Party.store';
import { EventBus } from '../../game/EventBus';
import {
    IN_UI_BEGINNER_PATH_ABANDON,
    IN_UI_BEGINNER_PATH_ENROLL,
    IN_UI_BEGINNER_PATH_UI_ACTION,
    IN_UI_CREATE_PARTY,
    IN_UI_JOIN_PARTY,
    IN_UI_LEAVE_PARTY,
    IN_UI_LEVEL_UP_SETTINGS,
    IN_UI_REQUEST_REBIRTH,
    IN_UI_REQUEST_REBIRTH_ROLLBACK,
    IN_UI_SET_LEVEL_BLOCK,
    TOAST_REQUESTED,
} from '../../constants/EventNames';
import { BEGINNER_PATH_UI_ACTION } from '../../constants/BeginnerPathQuests';
import {
    characterDialogStore,
    setCharacterSubPanel,
    adjustLevelUpStat,
    resetLevelUpDraft,
    clearCharacterTitle,
    type CharacterSubPanel,
} from '../store/CharacterDialog.store';
import { inventoryDialogStore } from '../store/InventoryDialog.store';
import { beginnerPathStore } from '../store/BeginnerPath.store';
import {
    CHARACTER_DIALOG_BG,
    DIALOG_BTN_QUEST,
    DIALOG_BTN_QUEST_HOVER,
    DIALOG_BTN_PARTY,
    DIALOG_BTN_PARTY_HOVER,
    DIALOG_BTN_LEVELSET,
    DIALOG_BTN_LEVELSET_HOVER,
    DIALOG_BTN_OK_CLASSIC,
    DIALOG_BTN_OK_CLASSIC_HOVER,
    QUEST_DIALOG_BG,
    QUEST_DIALOG_TITLE,
    PARTY_DIALOG_BG,
    PARTY_DIALOG_TITLE,
    LEVELSET_DIALOG_BG,
    LEVELSET_DIALOG_TITLE,
    GUILD_DIALOG_BG,
    GUILD_DIALOG_TITLE,
    STATISTICS_DIALOG_BG,
    STATISTICS_DIALOG_TITLE,
    ACHIEVEMENTS_DIALOG_BG,
    ACHIEVEMENTS_DIALOG_TITLE,
} from '../../constants/SpriteKeys';

interface CharacterDialogProps {
    position: { x: number; y: number };
    onClose: () => void;
    zIndex?: number;
    onBringToFront?: () => void;
    onPositionChange?: (position: { x: number; y: number }) => void;
}

function formatNum(n: number): string {
    return n.toLocaleString('en-US');
}

/** Normalize city label for CSS class + display (Olympia Elvine / Aresden palette). */
function cityKeyFromFaction(faction: string | undefined): 'elvine' | 'aresden' | 'traveler' {
    const f = (faction ?? '').trim().toLowerCase();
    if (f.includes('elv')) return 'elvine';
    if (f.includes('ares')) return 'aresden';
    return 'traveler';
}

function displayCityName(faction: string | undefined): string {
    const key = cityKeyFromFaction(faction);
    if (key === 'elvine') return 'Elvine';
    if (key === 'aresden') return 'Aresden';
    const raw = (faction ?? '').trim();
    if (!raw || raw.toLowerCase() === 'traveller') return 'Traveler';
    return raw;
}

function stopDialogPointer(e: PointerEvent) {
    e.stopPropagation();
}

function uiToast(message: string) {
    EventBus.emit(TOAST_REQUESTED, { message, severity: 'info' });
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

/** Absolute value; `label` feeds Nemesis chrome when parchment sprites are suppressed. */
function OlympiaValue({
    className,
    children,
    color,
    label,
    title,
}: {
    className: string;
    children: string;
    color?: string;
    label?: string;
    title?: string;
}) {
    return (
        <span
            className={`character-olympia-val ${className}`}
            style={color ? { color } : undefined}
            data-label={label}
            title={title}
        >
            {children}
        </span>
    );
}

/** Olympia 315 / classic Client.cpp derived-stat hover formulas. */
function attrTooltip(
    key: 'str' | 'vit' | 'dex' | 'int' | 'mag' | 'chr',
    stats: {
        level: number;
        str: number;
        vit: number;
        dex: number;
        int: number;
        mag: number;
        chr: number;
        maxHp: number;
        maxMp: number;
        maxSp: number;
        maxWeight: number;
    },
): string {
    const { level, str, vit, dex, int: intel, mag, chr, maxHp, maxMp, maxSp, maxWeight } = stats;
    const formulaHp = vit * 3 + level * 2 + Math.floor(str / 2);
    const formulaMp = mag * 2 + level * 2 + Math.floor(intel / 2);
    const formulaSp = level * 2 + str * 2;
    const formulaLoad = str * 5 + level * 5;
    switch (key) {
        case 'str':
            return [
                'Strength',
                `SP cap ≈ Lv×2 + Str×2 → ${formulaSp} (server ${maxSp})`,
                `Weight ≈ Str×5 + Lv×5 → ${formulaLoad} (server ${maxWeight})`,
                'Raises physical weapon damage.',
            ].join('\n');
        case 'vit':
            return [
                'Vitality',
                `HP cap ≈ Vit×3 + Lv×2 + Str/2 → ${formulaHp} (server ${maxHp})`,
                'Raises max HP and survivability.',
            ].join('\n');
        case 'dex':
            return [
                'Dexterity',
                `Dex ${dex}: hit ratio & physical evasion`,
                'Higher Dex → land hits more often / dodge more.',
            ].join('\n');
        case 'int':
            return [
                'Intelligence',
                `MP contrib Int/2 → +${Math.floor(intel / 2)} to MP cap`,
                'Magic success / learning; pairs with Mag.',
            ].join('\n');
        case 'mag':
            return [
                'Magic',
                `MP cap ≈ Mag×2 + Lv×2 + Int/2 → ${formulaMp} (server ${maxMp})`,
                'Raises magic damage and mana pool.',
            ].join('\n');
        case 'chr':
            return [
                'Luck / Charisma',
                `Chr ${chr}: shop prices, party invite, rare luck`,
                'Guild founding needs Charisma ≥ 20 (classic).',
            ].join('\n');
        default:
            return '';
    }
}

/**
 * Opaque Olympia sub-panel covering the F5 sheet.
 * Cause of translucency was missing ND_GAME2/ND_TEXT fill — text sat on Character frame 0.
 * z-index above the title drag-handle so OK / menu rows receive clicks.
 */
function CharacterSubPanelShell({
    bgKey,
    titleKey,
    onClose,
    children,
}: {
    bgKey: string;
    titleKey: string;
    onClose: () => void;
    children: ReactNode;
}) {
    const spriteFrameMap = useStore(appStore, (s) => s.spriteFrameMap);
    const bg = spriteFrameMap.get(bgKey);
    const title = spriteFrameMap.get(titleKey);

    return (
        <div
            className={`character-subpanel${bg ? '' : ' character-subpanel-fallback'}`}
            style={bg ? {
                backgroundImage: `url(${bg})`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'left top',
                backgroundSize: '100% 100%',
            } : undefined}
            onPointerDown={stopDialogPointer}
        >
            {title && (
                <div
                    className="character-subpanel-title-overlay"
                    style={{ backgroundImage: `url(${title})` }}
                    aria-hidden
                />
            )}
            <div className="character-subpanel-content">
                {children}
            </div>
            {/* ND_BUTTON OK at classic right slot — below drag-handle strip */}
            <OlympiaSpriteButton
                normalKey={DIALOG_BTN_OK_CLASSIC}
                hoverKey={DIALOG_BTN_OK_CLASSIC_HOVER}
                title="OK"
                className="character-subpanel-ok"
                fallbackLabel="OK"
                onClick={onClose}
            />
        </div>
    );
}

function QuestPanel({ onBack }: { onBack: () => void }) {
    const path = useStore(beginnerPathStore);
    const progressLabel =
        path.activeQuestId && path.required > 0
            ? `${path.progress} / ${path.required}`
            : null;
    const showUiContinue =
        path.objectiveKind === 'ui_action' &&
        !!path.uiActionId &&
        path.enrolled &&
        !path.abandoned &&
        !!path.activeQuestId;

    return (
        <CharacterSubPanelShell bgKey={QUEST_DIALOG_BG} titleKey={QUEST_DIALOG_TITLE} onClose={onBack}>
            <div className="character-subpanel-body beginner-path-panel">
                <p className="character-subpanel-hint">{path.statusMessage}</p>
                {path.activeQuestId ? (
                    <>
                        <p className="beginner-path-title">{path.activeQuestTitle}</p>
                        <p className="beginner-path-hint">{path.activeQuestHint}</p>
                        {progressLabel && (
                            <p className="beginner-path-progress">Progress: {progressLabel}</p>
                        )}
                    </>
                ) : (
                    <p className="character-subpanel-centered">
                        {path.enrolled && !path.abandoned
                            ? 'Beginner path complete — no active quest.'
                            : 'You are not on a beginner quest.'}
                    </p>
                )}
                {path.nextStubTitle ? (
                    <p className="beginner-path-stub">Next (stub): {path.nextStubTitle}</p>
                ) : null}
                <p className="beginner-path-meta">
                    Completed: {path.completedQuestIds.length}
                    {path.abandoned ? ' · Abandoned' : path.enrolled ? ' · Enrolled' : ''}
                </p>
                <div className="beginner-path-actions">
                    {path.canEnroll && (
                        <CharacterTextButton
                            title="Enroll"
                            className="character-dialog-text-btn beginner-path-btn"
                            onClick={() => EventBus.emit(IN_UI_BEGINNER_PATH_ENROLL)}
                        />
                    )}
                    {showUiContinue && (
                        <CharacterTextButton
                            title={path.uiActionId === BEGINNER_PATH_UI_ACTION.readEk ? 'Continue' : 'Mark done'}
                            className="character-dialog-text-btn beginner-path-btn"
                            onClick={() =>
                                EventBus.emit(IN_UI_BEGINNER_PATH_UI_ACTION, { actionId: path.uiActionId })
                            }
                        />
                    )}
                    {path.enrolled && !path.abandoned && path.activeQuestId && (
                        <CharacterTextButton
                            title="Abandon"
                            className="character-dialog-text-btn beginner-path-btn"
                            onClick={() => EventBus.emit(IN_UI_BEGINNER_PATH_ABANDON)}
                        />
                    )}
                </div>
            </div>
        </CharacterSubPanelShell>
    );
}

function PartyPanel({ onBack }: { onBack: () => void }) {
    const party = useStore(partyStore);
    const selfName = useStore(characterDialogStore, (s) => s.stats.playerName);
    const selfHp = useStore(characterDialogStore, (s) => s.stats.hp);
    const selfMaxHp = useStore(characterDialogStore, (s) => s.stats.maxHp);
    const [joinCode, setJoinCode] = useState('');

    return (
        <CharacterSubPanelShell bgKey={PARTY_DIALOG_BG} titleKey={PARTY_DIALOG_TITLE} onClose={onBack}>
            {party.inParty ? (
                <>
                    <p className="character-subpanel-body character-subpanel-centered">
                        Party code: <strong>{party.partyCode}</strong>
                        {party.isLeader ? ' (leader)' : ''}
                    </p>
                    <ul className="party-member-list" aria-label="Party members">
                        {party.members.map((member) => {
                            const isSelf =
                                member.name.length > 0 &&
                                member.name.localeCompare(selfName, undefined, { sensitivity: 'accent' }) === 0;
                            const hp = isSelf ? selfHp : member.hp;
                            const maxHp = isSelf ? selfMaxHp : member.maxHp;
                            const ratio = maxHp > 0 ? Math.min(100, (hp / maxHp) * 100) : 0;
                            const showHp = maxHp > 0;
                            return (
                                <li key={member.name} className="party-member-row">
                                    <div className="party-member-head">
                                        <span className="party-member-name">
                                            {member.name}
                                            {member.isLeader ? ' ★' : ''}
                                            {isSelf ? ' (you)' : ''}
                                        </span>
                                        {showHp ? (
                                            <span className="party-member-hp-text">
                                                {hp}/{maxHp}
                                            </span>
                                        ) : null}
                                    </div>
                                    {showHp ? (
                                        <div className="party-member-hp-track" aria-hidden>
                                            <div
                                                className="party-member-hp-fill"
                                                style={{ width: `${ratio}%` }}
                                            />
                                        </div>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                    <button
                        type="button"
                        className="character-dialog-text-btn"
                        onClick={() => EventBus.emit(IN_UI_LEAVE_PARTY)}
                        onPointerDown={stopDialogPointer}
                    >
                        Leave party
                    </button>
                </>
            ) : (
                <>
                    <p className="character-subpanel-hint character-subpanel-centered">
                        You are not in a party.
                    </p>
                    <button
                        type="button"
                        className="character-dialog-text-btn"
                        onClick={() => EventBus.emit(IN_UI_CREATE_PARTY)}
                        onPointerDown={stopDialogPointer}
                    >
                        Create a party
                    </button>
                    <div className="character-levelset-row" style={{ marginTop: 8 }}>
                        <input
                            type="text"
                            value={joinCode}
                            maxLength={8}
                            placeholder="Code"
                            aria-label="Party code"
                            onChange={(e) => setJoinCode(e.target.value)}
                            onPointerDown={stopDialogPointer}
                            style={{ width: 72 }}
                        />
                        <button
                            type="button"
                            className="character-dialog-text-btn"
                            onClick={() =>
                                EventBus.emit(IN_UI_JOIN_PARTY, { partyCode: joinCode.trim() })
                            }
                            onPointerDown={stopDialogPointer}
                        >
                            Join
                        </button>
                    </div>
                </>
            )}
        </CharacterSubPanelShell>
    );
}

/** Olympia angel: equip accessory 1108–1111; bonus = (attr high nibble) + 1. */
function getEquippedAngelicBonuses(
    equipped: Partial<Record<string, { itemId: number; itemAttribute?: number } | undefined>>,
): { str: number; dex: number; int: number; mag: number } {
    const out = { str: 0, dex: 0, int: 0, mag: 0 };
    const map: Record<number, keyof typeof out> = {
        1108: 'str',
        1109: 'dex',
        1110: 'int',
        1111: 'mag',
    };
    for (const item of Object.values(equipped)) {
        if (!item) continue;
        const key = map[item.itemId];
        if (!key) continue;
        const upgrade = ((item.itemAttribute ?? 0) >>> 28) & 0xf;
        const bonus = upgrade + 1;
        if (bonus > out[key]) {
            out[key] = bonus;
        }
    }
    return out;
}

function LevelSetPanel({ onBack }: { onBack: () => void }) {
    const stats = useStore(characterDialogStore, (s) => s.stats);
    const draft = useStore(characterDialogStore, (s) => s.levelUpDraft);

    const rows: Array<{ key: 'str' | 'vit' | 'dex' | 'int' | 'mag' | 'chr'; label: string; base: number }> = [
        { key: 'str', label: 'Strength', base: stats.str },
        { key: 'vit', label: 'Vitality', base: stats.vit },
        { key: 'dex', label: 'Dexterity', base: stats.dex },
        { key: 'int', label: 'Intelligence', base: stats.int },
        { key: 'mag', label: 'Magic', base: stats.mag },
        { key: 'chr', label: 'Charisma', base: stats.chr },
    ];

    const onPlus = (key: typeof rows[number]['key']) => {
        if (draft.pointsLeft <= 0) {
            uiToast('No hay puntos de level-up disponibles');
            return;
        }
        adjustLevelUpStat(key, 1);
    };

    const onMinus = (key: typeof rows[number]['key']) => {
        if (draft[key] <= 0) {
            return;
        }
        adjustLevelUpStat(key, -1);
    };

    const onConfirm = () => {
        const spent = draft.str + draft.vit + draft.dex + draft.int + draft.mag + draft.chr;
        if (spent <= 0) {
            uiToast('No hay cambios para aplicar');
            return;
        }
        EventBus.emit(IN_UI_LEVEL_UP_SETTINGS, {
            str: draft.str,
            vit: draft.vit,
            dex: draft.dex,
            intel: draft.int,
            mag: draft.mag,
            chr: draft.chr,
        });
    };

    return (
        <CharacterSubPanelShell bgKey={LEVELSET_DIALOG_BG} titleKey={LEVELSET_DIALOG_TITLE} onClose={onBack}>
            <p className="character-subpanel-body character-subpanel-centered">
                Level-up setting
            </p>
            <p className="character-subpanel-body">
                Points Left:{' '}
                <strong style={{ color: draft.pointsLeft > 0 ? '#7dff7d' : undefined }}>{draft.pointsLeft}</strong>
            </p>
            <div className="character-levelset-grid">
                {rows.map(({ key, label, base }) => (
                    <div key={key} className="character-levelset-row">
                        <span className="character-stat-label">{label}</span>
                        <span>{base}</span>
                        <span style={{ color: draft[key] > 0 ? '#ffb4b4' : undefined }}>{base + draft[key]}</span>
                        <button
                            type="button"
                            className="character-levelset-btn"
                            title="+"
                            onClick={() => onPlus(key)}
                            onPointerDown={stopDialogPointer}
                        >
                            +
                        </button>
                        <button
                            type="button"
                            className="character-levelset-btn"
                            title="−"
                            disabled={draft[key] <= 0}
                            onClick={() => onMinus(key)}
                            onPointerDown={stopDialogPointer}
                        >
                            −
                        </button>
                    </div>
                ))}
            </div>
            <button
                type="button"
                className="character-dialog-text-btn character-levelset-reset"
                onClick={() => {
                    resetLevelUpDraft();
                    uiToast('Level Set reiniciado');
                }}
                onPointerDown={stopDialogPointer}
            >
                Reiniciar
            </button>
            <button
                type="button"
                className="character-dialog-text-btn"
                onClick={onConfirm}
                onPointerDown={stopDialogPointer}
                style={{ marginLeft: 8 }}
            >
                OK
            </button>
        </CharacterSubPanelShell>
    );
}

function StubPanel({
    title,
    body,
    onBack,
    bgKey = QUEST_DIALOG_BG,
    titleKey = QUEST_DIALOG_TITLE,
}: {
    title: string;
    body: string;
    onBack: () => void;
    bgKey?: string;
    titleKey?: string;
}) {
    return (
        <CharacterSubPanelShell bgKey={bgKey} titleKey={titleKey} onClose={onBack}>
            <p className="character-subpanel-title-text">{title}</p>
            <p className="character-subpanel-body">{body}</p>
        </CharacterSubPanelShell>
    );
}

/** F5 → Statistics: Olympia-style mob specialty (species list + selected detail). */
function StatisticsPanel({ onBack }: { onBack: () => void }) {
    const progression = useStore(progressionStore);
    const killRows = Object.values(progression.killsByMonsterId).sort((a, b) => b.kills - a.kills);
    const top = killRows[0];
    const stakeBonus =
        killRows.find((r) => r.stakeBonusLevels > 0)?.stakeBonusLevels ??
        Math.floor(Math.max(0, progression.stakedHell) / 100_000);

    return (
        <CharacterSubPanelShell
            bgKey={STATISTICS_DIALOG_BG}
            titleKey={STATISTICS_DIALOG_TITLE}
            onClose={onBack}
        >
            <p className="character-subpanel-title-text">Statistics · Mobs</p>
            <p className="character-subpanel-body" style={{ marginBottom: 6, fontSize: 12 }}>
                Total kills: <strong>{progression.totalKills.toLocaleString()}</strong>
                {' · '}
                Stake: <strong>{progression.stakedHell.toLocaleString()}</strong>
                {stakeBonus > 0 ? ` (+${stakeBonus} final)` : ' · 100k $HELL = +1 final tier'}
            </p>
            {top ? (
                <p className="character-subpanel-body" style={{ marginBottom: 6, fontSize: 12 }}>
                    <strong>
                        {top.monsterName} Specialty Level {top.effectiveLevel}
                    </strong>
                    <br />
                    Real L{top.specialtyLevel}
                    {top.stakeBonusLevels > 0 ? ` + stake ${top.stakeBonusLevels}` : ''}
                    {' · '}
                    {top.bonusSummary && top.bonusSummary !== '—'
                        ? top.bonusSummary
                        : 'No bonuses yet'}
                    {top.nextKills > 0
                        ? ` · next real ${top.kills.toLocaleString()}/${top.nextKills.toLocaleString()}`
                        : ''}
                </p>
            ) : null}
            <div
                className="mob-kills-list-header"
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 4rem 2.5rem 2.5rem',
                    gap: 4,
                    fontSize: 11,
                    opacity: 0.85,
                    marginBottom: 4,
                }}
            >
                <span>Species</span>
                <span>Kills</span>
                <span title="From kills only">Real</span>
                <span title="Real + stake">Final</span>
            </div>
            <div className="mob-kills-list" style={{ maxHeight: 200, overflowY: 'auto' }}>
                {killRows.length === 0 ? (
                    <p className="character-subpanel-body">
                        Kill monsters to unlock specialty tiers (per species).
                    </p>
                ) : (
                    killRows.map((row) => (
                        <div
                            key={row.monsterId}
                            title={
                                [
                                    `${row.monsterName} Specialty Level ${row.effectiveLevel}`,
                                    row.bonusSummary || 'No bonuses yet',
                                    row.nextKills > 0
                                        ? `${row.kills.toLocaleString()} / ${row.nextKills.toLocaleString()} to next real`
                                        : 'Max real ladder',
                                ]
                                    .filter(Boolean)
                                    .join(' · ')
                            }
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 4rem 2.5rem 2.5rem',
                                gap: 4,
                                fontSize: 12,
                                padding: '2px 0',
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                            }}
                        >
                            <span>{row.monsterName}</span>
                            <span>{row.kills.toLocaleString()}</span>
                            <span>{row.specialtyLevel}</span>
                            <span style={{ fontWeight: 600 }}>{row.effectiveLevel}</span>
                        </div>
                    ))
                )}
            </div>
            <p className="character-subpanel-body" style={{ marginTop: 6, fontSize: 11, opacity: 0.85 }}>
                Full panel: Shift+F11 · Real = kills · Final = combat/drop tier
            </p>
        </CharacterSubPanelShell>
    );
}

function GuildPanel({ onBack }: { onBack: () => void }) {
    const guild = useStore(guildStore);
    const menuItems: Array<{
        label: string;
        enabled: boolean;
        action?: 'guild-warehouse';
    }> = [
        { label: 'Make a Guild', enabled: !guild.isGuildMaster && guild.guildName.length === 0 },
        { label: 'Break up Guild', enabled: guild.isGuildMaster },
        { label: 'Join a Guild', enabled: !guild.isGuildMaster && guild.guildName.length === 0 },
        { label: 'Withdraw from Guild', enabled: guild.guildName.length > 0 && !guild.isGuildMaster },
        { label: 'Summon Guild Members', enabled: guild.isGuildMaster },
        { label: 'Reserve Fightzone', enabled: guild.isGuildMaster },
        { label: 'Guild Warehouse', enabled: true, action: 'guild-warehouse' },
    ];

    return (
        <CharacterSubPanelShell bgKey={GUILD_DIALOG_BG} titleKey={GUILD_DIALOG_TITLE} onClose={onBack}>
            <ul className="guild-menu-list">
                {menuItems.map((item) => (
                    <li key={item.label}>
                        <button
                            type="button"
                            className={`guild-menu-item-btn${item.enabled ? '' : ' guild-menu-item-disabled'}`}
                            disabled={!item.enabled}
                            onClick={() => {
                                if (!item.enabled) {
                                    return;
                                }
                                if (item.action === 'guild-warehouse') {
                                    openGuildWarehouseDialog();
                                    return;
                                }
                                uiToast(`${item.label} — próximamente`);
                            }}
                            onPointerDown={stopDialogPointer}
                        >
                            {item.label}
                        </button>
                    </li>
                ))}
            </ul>
            {guild.guildName.length > 0 && (
                <p className="character-subpanel-hint character-subpanel-centered">
                    {guild.guildName}
                    {guild.isGuildMaster ? ' (Guildmaster)' : ''}
                </p>
            )}
        </CharacterSubPanelShell>
    );
}

/**
 * F5 Character — DialogText panel (270×376).
 * Labels baked in ND_TEXT frame 0; Quest/Party/LevelSet ND_BUTTON at (15|98|180, 340).
 */
export function CharacterDialog({
    position,
    onClose,
    zIndex,
    onBringToFront,
    onPositionChange,
}: CharacterDialogProps) {
    const spriteFrameMap = useStore(appStore, (s) => s.spriteFrameMap);
    const stats = useStore(characterDialogStore, (s) => s.stats);
    const activeSubPanel = useStore(characterDialogStore, (s) => s.activeSubPanel);
    const progression = useStore(progressionStore);
    const equippedItems = useStore(inventoryDialogStore, (s) => s.equippedItems);
    // Angelic pendant bonuses (equip accessory 1108–1111) — effective stats for display + tooltips.
    const angel = getEquippedAngelicBonuses(equippedItems);
    const displayStats = {
        ...stats,
        str: stats.str + angel.str,
        dex: stats.dex + angel.dex,
        int: stats.int + angel.int,
        mag: stats.mag + angel.mag,
    };

    const dialogBg = spriteFrameMap.get(CHARACTER_DIALOG_BG);
    const openSubPanel = (panel: CharacterSubPanel) => setCharacterSubPanel(panel);
    const backToMain = () => setCharacterSubPanel('main');
    const showingSubPanel = activeSubPanel !== 'main';

    return (
        <HeadlessDraggableDialog
            position={position}
            id="character-dialog"
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onPositionChange={onPositionChange}
            onContextMenu={(e) => { e.preventDefault(); onClose(); }}
        >
            <div
                className={`olympia-dialog-root hb-nemesis-dialog character-dialog-root${dialogBg ? '' : ' olympia-dialog-fallback'}`}
                style={dialogBg ? {
                    backgroundImage: `url(${dialogBg})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'left top',
                    backgroundSize: '100% 100%',
                } : undefined}
            >
                {/* Hide title drag strip while a sub-panel covers the sheet (OK owns that zone). */}
                {!showingSubPanel && (
                    <DialogDragHandle className="character-dialog-drag-handle" title="Arrastrar ventana" />
                )}
                {/*
                  CDO layout contract (Olympia 315 + CL):
                  Band A — title: Character (L) · Block Level full-size (R)
                  Band B — city centered, faction color (Elvine cyan / Aresden red)
                  Band C — Player: Name (L) · Contribution (R), same type color
                  Body starts below Band C with clear gap (no overlaps).
                */}
                <div className="character-f5-chrome" aria-hidden={showingSubPanel}>
                    <div className="character-f5-band character-f5-band-title">
                        <span className="character-f5-title-text hb-nemesis-dialog-title olympia-dialog-title-bar">
                            Character
                        </span>
                        {!showingSubPanel && activeSubPanel === 'main' && (
                            <button
                                type="button"
                                className={`character-f5-block-level character-dialog-text-btn${
                                    progression.levelBlocked ? ' is-blocked' : ''
                                }`}
                                title={
                                    progression.levelBlocked
                                        ? 'Unblock Level — resume gaining experience'
                                        : 'Block Level — freeze level, farm majestics'
                                }
                                onClick={() =>
                                    EventBus.emit(IN_UI_SET_LEVEL_BLOCK, {
                                        blocked: !progression.levelBlocked,
                                    })
                                }
                                onPointerDown={stopDialogPointer}
                            >
                                {progression.levelBlocked ? 'Unblock Level' : 'Block Level'}
                            </button>
                        )}
                    </div>
                    {!showingSubPanel && (
                        <>
                            <div className="character-f5-band character-f5-band-city">
                                <span
                                    className={`character-f5-city is-city-${cityKeyFromFaction(stats.faction)}`}
                                    title="Ciudad / ciudadanía"
                                >
                                    {displayCityName(stats.faction)}
                                </span>
                            </div>
                            <div className="character-f5-band character-f5-band-meta">
                                <span className="character-f5-player">
                                    {`Player: ${stats.playerName?.trim() || '—'}`}
                                </span>
                                <span className="character-f5-contrib">
                                    {`Contribution: ${formatNum(stats.contribution)}`}
                                </span>
                            </div>
                            {(stats.title || stats.titleIsStub) && (
                                <div className="character-f5-band character-f5-band-title-extra">
                                    <span
                                        className="character-olympia-title"
                                        title={stats.titleIsStub ? 'Title system TBD' : undefined}
                                    >
                                        {stats.title
                                            ? stats.title
                                            : stats.titleIsStub
                                              ? 'Title: — (TBD)'
                                              : 'Title: —'}
                                    </span>
                                    <button
                                        type="button"
                                        className="character-olympia-clear-title"
                                        title="Clear Title"
                                        onClick={() => {
                                            clearCharacterTitle();
                                            uiToast('Title cleared (local stub)');
                                        }}
                                        onPointerDown={stopDialogPointer}
                                    >
                                        Clear Title
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
                <div className="character-olympia-stage">
                    {activeSubPanel === 'main' && (
                        <>
                            <div className="character-olympia-equip">
                                <CharacterPaperDoll />
                            </div>

                            <div className="character-olympia-stats-col" aria-label="Character stats">
                                <OlympiaValue
                                    className="character-olympia-level"
                                    label="Level:"
                                >{`${stats.level}${progression.rebirth > 0 ? ` (+${progression.rebirth})` : ''}${progression.majesticPoints > 0 ? ` · Maj ${progression.majesticPoints}` : ''}`}</OlympiaValue>
                                <OlympiaValue
                                    className="character-olympia-talents"
                                    label="Talents:"
                                >
                                    {stats.talents ||
                                        [stats.str, stats.vit, stats.dex, stats.int, stats.mag, stats.chr]
                                            .map((v, i) => ({ n: ['Str', 'Vit', 'Dex', 'Int', 'Mag', 'Chr'][i], v: v ?? 0 }))
                                            .sort((a, b) => b.v - a.v)
                                            .slice(0, 3)
                                            .map((x) => x.n)
                                            .join('/') ||
                                        '—'}
                                </OlympiaValue>
                                <OlympiaValue className="character-olympia-exp" label="Exp:">{formatNum(stats.exp)}</OlympiaValue>
                                <OlympiaValue className="character-olympia-nextexp" label="Next Exp:">{formatNum(stats.nextExp)}</OlympiaValue>
                                <OlympiaValue
                                    className="character-olympia-rested"
                                    label="Rested Exp:"
                                    title={
                                        progression.restedExp === 0
                                            ? 'Rested Exp pool — server TBD (wired to Progression.store)'
                                            : undefined
                                    }
                                >
                                    {formatNum(progression.restedExp)}
                                </OlympiaValue>
                                {progression.expChangeLast10s !== 0 ? (
                                    <OlympiaValue
                                        className="character-olympia-exp-ticker"
                                        label="Exp (10s):"
                                        title="Client ticker — also logged to System Log every 10s"
                                    >
                                        {`${progression.expChangeLast10s > 0 ? '+' : ''}${formatNum(progression.expChangeLast10s)}${
                                            progression.expRestedBonusLast10s > 0
                                                ? ` (+${formatNum(progression.expRestedBonusLast10s)} rested)`
                                                : ''
                                        }`}
                                    </OlympiaValue>
                                ) : null}
                                <OlympiaValue className="character-olympia-majestics" label="Majestics:">{formatNum(stats.majestics)}</OlympiaValue>
                                <OlympiaValue className="character-olympia-weight" label="Weight:">{`${stats.weight}/${stats.maxWeight}`}</OlympiaValue>
                                <OlympiaValue
                                    className="character-olympia-ek"
                                    label="Enemy Kills:"
                                >
                                    {`${formatNum(stats.enemyKills)}/${formatNum(Math.max(stats.enemyKillsTotal, stats.enemyKills))}`}
                                </OlympiaValue>
                                <OlympiaValue className="character-olympia-reputation" label="Reputation:">{formatNum(stats.reputation)}</OlympiaValue>
                                <OlympiaValue
                                    className="character-olympia-hunger"
                                    label="Hunger:"
                                    color={stats.hungerIsStub ? '#8a7060' : undefined}
                                >
                                    {`${Math.max(0, Math.min(100, stats.hunger))}%${stats.hungerIsStub ? ' (TBD)' : ''}`}
                                </OlympiaValue>
                                <OlympiaValue
                                    className="character-olympia-super-attack"
                                    label="Crit Charge:"
                                    title="Super Attack charges (Olympia). Filled by time + Charge Critical armor; spent for bonus melee damage."
                                >
                                    {`${Math.max(0, stats.superAttackLeft ?? 0)}/${Math.max(1, stats.maxSuperAttack ?? 1)}`}
                                </OlympiaValue>
                            </div>

                            {/* Olympia 315: slash text under avatar; HP green / MP cyan / SP warm — no bars. */}
                            <div className="character-olympia-vitals" aria-label="Vitals">
                                <OlympiaValue
                                    className="character-olympia-hp"
                                    label="HP:"
                                    color={stats.isPoisoned ? '#9ad14a' : '#3ddc3d'}
                                    title={stats.isPoisoned ? 'Poisoned' : 'Hit Points'}
                                >
                                    {`${stats.hp}/${stats.maxHp}`}
                                </OlympiaValue>
                                <OlympiaValue
                                    className="character-olympia-mp"
                                    label="MP:"
                                    color="#4ec8ff"
                                    title="Mana Points"
                                >
                                    {`${stats.mp}/${stats.maxMp}`}
                                </OlympiaValue>
                                <OlympiaValue
                                    className="character-olympia-sp"
                                    label="SP:"
                                    color="#ff6b6b"
                                    title="Stamina Points"
                                >
                                    {`${stats.sp}/${stats.maxSp}`}
                                </OlympiaValue>
                            </div>

                            {/* Str Vit Dex | Int Mag Luk — effective = base + angel pendant */}
                            <div className="character-olympia-attrs" aria-label="Attributes">
                                <OlympiaValue
                                    className="character-olympia-str character-olympia-attr"
                                    label="Str"
                                    title={
                                        attrTooltip('str', displayStats) +
                                        (angel.str ? `\nAngelic +${angel.str} (base ${stats.str})` : '')
                                    }
                                >
                                    {String(displayStats.str)}
                                </OlympiaValue>
                                <OlympiaValue
                                    className="character-olympia-int character-olympia-attr"
                                    label="Int"
                                    title={
                                        attrTooltip('int', displayStats) +
                                        (angel.int ? `\nAngelic +${angel.int} (base ${stats.int})` : '')
                                    }
                                >
                                    {String(displayStats.int)}
                                </OlympiaValue>
                                <OlympiaValue
                                    className="character-olympia-vit character-olympia-attr"
                                    label="Vit"
                                    title={attrTooltip('vit', displayStats)}
                                >
                                    {String(displayStats.vit)}
                                </OlympiaValue>
                                <OlympiaValue
                                    className="character-olympia-mag character-olympia-attr"
                                    label="Mag"
                                    title={
                                        attrTooltip('mag', displayStats) +
                                        (angel.mag ? `\nAngelic +${angel.mag} (base ${stats.mag})` : '')
                                    }
                                >
                                    {String(displayStats.mag)}
                                </OlympiaValue>
                                <OlympiaValue
                                    className="character-olympia-dex character-olympia-attr"
                                    label="Dex"
                                    title={
                                        attrTooltip('dex', displayStats) +
                                        (angel.dex ? `\nAngelic +${angel.dex} (base ${stats.dex})` : '')
                                    }
                                >
                                    {String(displayStats.dex)}
                                </OlympiaValue>
                                <OlympiaValue
                                    className="character-olympia-chr character-olympia-attr"
                                    label="Luk"
                                    title={attrTooltip('chr', stats)}
                                >
                                    {String(stats.chr)}
                                </OlympiaValue>
                            </div>

                            {progression.levelBlocked ? (
                                <span
                                    className="character-olympia-block-hint"
                                    title="Same exp-per-majestic as full max level (Olympia)"
                                >
                                    L{progression.level} frozen · maj unit = max-L
                                </span>
                            ) : null}

                            {(() => {
                                const canRebirth =
                                    progression.level >= progression.maxLevel &&
                                    progression.rebirth < progression.maxRebirth &&
                                    !progression.levelBlocked;
                                const canCancelRb = (progression.rebirth ?? 0) > 0;
                                // Olympia wiki: next rebirth costs next×5 maj, min(next×200k, 1M) gold.
                                const nextRb = progression.rebirth + 1;
                                const majCost = nextRb * 5;
                                const goldCost = Math.min(nextRb * 200_000, 1_000_000);
                                const goldLabel =
                                    goldCost >= 1_000_000
                                        ? '1M g'
                                        : goldCost >= 1000
                                          ? `${Math.round(goldCost / 1000)}k g`
                                          : `${goldCost} g`;
                                const haveMaj = progression.majesticPoints ?? 0;
                                const ready = haveMaj >= majCost;
                                if (!canRebirth && !canCancelRb) {
                                    return null;
                                }
                                return (
                                    <>
                                        {canRebirth ? (
                                            <CharacterTextButton
                                                title={
                                                    ready
                                                        ? `Rebirth ${nextRb} (${majCost} maj · ${goldLabel}) → L79 · cancelable from F5`
                                                        : `Need ${majCost} maj (have ${haveMaj}) + ${goldLabel}`
                                                }
                                                className="character-olympia-rebirth character-dialog-text-btn"
                                                onClick={() => EventBus.emit(IN_UI_REQUEST_REBIRTH)}
                                            />
                                        ) : null}
                                        {canCancelRb ? (
                                            <CharacterTextButton
                                                title={`Cancel Rebirth → RB${(progression.rebirth ?? 1) - 1} L${progression.maxLevel} (restore saved progress)`}
                                                className="character-olympia-rebirth-cancel character-dialog-text-btn"
                                                onClick={() =>
                                                    EventBus.emit(IN_UI_REQUEST_REBIRTH_ROLLBACK)
                                                }
                                            />
                                        ) : null}
                                    </>
                                );
                            })()}

                            <div className="character-olympia-btn-grid" aria-label="Character panels">
                                <CharacterTextButton
                                    title="Quests"
                                    className="character-olympia-btn character-olympia-btn-quest character-dialog-text-btn"
                                    onClick={() => openSubPanel('quest')}
                                />
                                <CharacterTextButton
                                    title="Statistics"
                                    className="character-olympia-btn character-olympia-btn-stats character-dialog-text-btn"
                                    onClick={() => openSubPanel('statistics')}
                                />
                                <CharacterTextButton
                                    title="Achievements"
                                    className="character-olympia-btn character-olympia-btn-achievements character-dialog-text-btn"
                                    onClick={() => openSubPanel('achievements')}
                                />
                                <CharacterTextButton
                                    title="Guild"
                                    className="character-olympia-btn character-olympia-btn-guild character-dialog-text-btn"
                                    onClick={() => openSubPanel('guild')}
                                />
                                <CharacterTextButton
                                    title="Party"
                                    className="character-olympia-btn character-olympia-btn-party character-dialog-text-btn"
                                    onClick={() => openSubPanel('party')}
                                />
                                <CharacterTextButton
                                    title="Level Set."
                                    className="character-olympia-btn character-olympia-btn-levelset character-dialog-text-btn"
                                    onClick={() => openSubPanel('levelSet')}
                                />
                            </div>
                        </>
                    )}

                    {activeSubPanel === 'quest' && <QuestPanel onBack={backToMain} />}
                    {activeSubPanel === 'party' && <PartyPanel onBack={backToMain} />}
                    {activeSubPanel === 'levelSet' && <LevelSetPanel onBack={backToMain} />}
                    {activeSubPanel === 'guild' && <GuildPanel onBack={backToMain} />}
                    {activeSubPanel === 'statistics' && <StatisticsPanel onBack={backToMain} />}
                    {activeSubPanel === 'achievements' && (
                        <StubPanel
                            title="Achievements"
                            body="Logros desbloqueados — próximamente."
                            onBack={backToMain}
                            bgKey={ACHIEVEMENTS_DIALOG_BG}
                            titleKey={ACHIEVEMENTS_DIALOG_TITLE}
                        />
                    )}
                    {activeSubPanel === 'feedback' && (
                        <StubPanel title="Feedback" body="Enviá sugerencias y reportes de bugs — próximamente." onBack={backToMain} />
                    )}
                </div>
            </div>
        </HeadlessDraggableDialog>
    );
}
