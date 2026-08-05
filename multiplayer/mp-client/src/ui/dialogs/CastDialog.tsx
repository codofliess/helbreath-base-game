import { useStore } from '@tanstack/react-store';
import type { WheelEvent } from 'react';
import { RpgCheckbox } from '../components/RpgCheckbox';
import { OlympiaDialogShell } from '../components/OlympiaDialogShell';
import {
    castDialogStore,
    castSpellById,
    setUseCastAnimation,
    setActiveCircle,
    setCastDialogOpen,
} from '../store/CastDialog.store';
import { setRecentShortCut } from '../store/ShortCut.store';
import { getSpellCircles } from '../../constants/Spells';
import { getCastableSpells, magicShopDialogStore } from '../store/MagicShopDialog.store';
import { MAGIC_DIALOG_BG, MAGIC_DIALOG_TITLE } from '../../constants/SpriteKeys';
import { appStore } from '../store/App.store';
import { characterDialogStore } from '../store/CharacterDialog.store';
import { progressionStore } from '../store/Progression.store';
import { getSkillLevel, skillDialogStore } from '../store/SkillDialog.store';
import { computeMagicCastSuccessPercent } from '../../utils/MagicCastSuccess';

interface CastDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
    onPositionChange?: (position: { x: number; y: number }) => void;
}

const CIRCLE_LABELS = [
    'Circle One',
    'Circle Two',
    'Circle Three',
    'Circle Four',
    'Circle Five',
    'Circle Six',
    'Circle Seven',
    'Circle Eight',
    'Circle Nine',
    'Circle Ten',
];

/**
 * Classic DlgBoxClick_Magic circle strip (Client.cpp ~37366–37385).
 * Hit widths are relative flex weights matching sX+16..239 / sY+240..268.
 */
const CIRCLE_STRIP: ReadonlyArray<{ circle: number; label: string; flex: number }> = [
    { circle: 1, label: '1', flex: 22 },
    { circle: 2, label: '2', flex: 17 },
    { circle: 3, label: '3', flex: 24 },
    { circle: 4, label: '4', flex: 19 },
    { circle: 5, label: '5', flex: 14 },
    { circle: 6, label: '6', flex: 20 },
    { circle: 7, label: '7', flex: 27 },
    { circle: 8, label: '8', flex: 31 },
    { circle: 9, label: '9', flex: 19 },
    { circle: 10, label: '10', flex: 21 },
];

export function CastDialog({
    position,
    zIndex,
    onBringToFront,
    onPositionChange,
}: CastDialogProps) {
    const activeCircle = useStore(castDialogStore, (state) => state.activeCircle);
    const useCastAnimation = useStore(castDialogStore, (state) => state.useCastAnimation);
    useStore(magicShopDialogStore, (state) => state.learnedSpellIds);
    useStore(skillDialogStore, (s) => s.levelsById);
    const titleOverlay = useStore(appStore, (s) => s.spriteFrameMap.get(MAGIC_DIALOG_TITLE));
    const charStats = useStore(characterDialogStore, (s) => s.stats);
    const level = useStore(progressionStore, (s) => s.level);

    const circleSpells = getCastableSpells().filter((s) => s.circle === activeCircle);
    const circleLabel = CIRCLE_LABELS[activeCircle - 1] ?? `Circle ${activeCircle}`;

    // Olympia Magic skill (id 4); stub fallback 20 matches free baseline.
    const magicSkill = getSkillLevel(4, 20);
    const intStat = charStats.int ?? 10;
    const sp = charStats.sp ?? 1;
    const successPct = computeMagicCastSuccessPercent(
        magicSkill,
        intStat,
        level,
        activeCircle,
        'dry',
        sp < 1,
    );

    const prevCircle = () => {
        const circles = getSpellCircles();
        const idx = circles.indexOf(activeCircle);
        setActiveCircle(circles[(idx - 1 + circles.length) % circles.length]);
    };

    const nextCircle = () => {
        const circles = getSpellCircles();
        const idx = circles.indexOf(activeCircle);
        setActiveCircle(circles[(idx + 1) % circles.length]);
    };

    const onMagicBookWheel = (e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.deltaY < 0) {
            nextCircle();
        } else if (e.deltaY > 0) {
            prevCircle();
        }
    };

    return (
        <OlympiaDialogShell
            id="cast-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onPositionChange={onPositionChange}
            onContextMenu={(e) => {
                e.preventDefault();
                setCastDialogOpen(false);
            }}
            width={258}
            minHeight={328}
            bgSpriteKey={MAGIC_DIALOG_BG}
            rootClassName="cast-dialog-root"
        >
            {titleOverlay && (
                <div
                    className="olympia-dialog-title-overlay"
                    style={{ backgroundImage: `url(${titleOverlay})` }}
                    aria-hidden
                />
            )}
            <div className="olympia-dialog-title-bar hb-nemesis-dialog-title">Magic</div>
            <div className="cast-dialog-content" onWheel={onMagicBookWheel}>
                <div className="cast-dialog-circle-title">{circleLabel}</div>

                <div className="cast-dialog-spell-list">
                    {circleSpells.length === 0 && (
                        <div className="cast-dialog-empty">No spells in this circle.</div>
                    )}
                    {circleSpells.map((spell) => (
                        <button
                            key={spell.id}
                            type="button"
                            className="cast-dialog-spell-row"
                            onClick={() => {
                                setRecentShortCut({ kind: 'spell', spellId: spell.id });
                                castSpellById(spell.id);
                            }}
                        >
                            <span className="cast-dialog-spell-name">{spell.name.replace(/-/g, ' ')}</span>
                            <span className="cast-dialog-spell-mp">{spell.mpCost}</span>
                        </button>
                    ))}
                </div>

                <div className="cast-dialog-circle-strip" aria-label="Magic circles">
                    {CIRCLE_STRIP.map(({ circle, label, flex }) => (
                        <button
                            key={circle}
                            type="button"
                            className={`cast-dialog-circle-hit${activeCircle === circle ? ' is-active' : ''}`}
                            style={{ flexGrow: flex, flexBasis: 0 }}
                            title={CIRCLE_LABELS[circle - 1]}
                            onClick={() => setActiveCircle(circle)}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="cast-dialog-success" title={`Magic skill ${magicSkill}% · INT ${intStat} · L${level}`}>
                    Success Ratio: {successPct}%
                </div>

                <div className="cast-dialog-footer">
                    <RpgCheckbox
                        id="cast-animation-checkbox"
                        checked={useCastAnimation}
                        onCheckedChange={(checked) => setUseCastAnimation(checked === true)}
                        label="Cast animation"
                    />
                </div>
            </div>
        </OlympiaDialogShell>
    );
}
