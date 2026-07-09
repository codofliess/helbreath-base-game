import { useStore } from '@tanstack/react-store';
import { DraggableDialog } from './DraggableDialog';
import { RpgCheckbox } from '../components/RpgCheckbox';
import {
    castDialogStore,
    castSpellById,
    setUseCastAnimation,
    setActiveCircle,
    setCastDialogOpen,
} from '../store/CastDialog.store';
import { getSpellCircles } from '../../constants/Spells';
import { getCastableSpells, magicShopDialogStore } from '../store/MagicShopDialog.store';

interface CastDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
}

export function CastDialog({
    position,
    zIndex,
    onBringToFront,
}: CastDialogProps) {
    const activeCircle = useStore(castDialogStore, (state) => state.activeCircle);
    const useCastAnimation = useStore(castDialogStore, (state) => state.useCastAnimation);
    useStore(magicShopDialogStore, (state) => state.learnedSpellIds);

    const circleSpells = getCastableSpells().filter((s) => s.circle === activeCircle);

    return (
        <DraggableDialog
            title="Libro de Magias"
            position={position}
            id="cast-dialog"
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(e) => {
                e.preventDefault();
                setCastDialogOpen(false);
            }}
        >
            <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {getSpellCircles().map((circle) => (
                    <button
                        key={circle}
                        type="button"
                        onClick={() => setActiveCircle(circle)}
                        style={{
                            padding: '6px 14px',
                            backgroundColor: activeCircle === circle ? '#8b5a2b' : '#222',
                            color: activeCircle === circle ? '#ffd700' : '#ccc',
                            border: '2px solid #5c4033',
                            minWidth: '36px',
                            fontWeight: activeCircle === circle ? 'bold' : 'normal',
                            cursor: 'pointer',
                        }}
                    >
                        {circle === 10 ? '0' : circle}
                    </button>
                ))}
            </div>

            <div style={{
                color: '#a0ff80',
                fontSize: '13px',
                marginBottom: '8px',
                fontFamily: 'Courier New, monospace',
            }}>
                Círculo {activeCircle === 10 ? '10' : activeCircle} — {circleSpells.length} hechizo(s)
            </div>

            <div style={{
                maxHeight: '340px',
                overflowY: 'auto',
                backgroundColor: '#111',
                padding: '8px',
                border: '3px solid #5c4033',
                borderRadius: '6px',
            }}>
                {circleSpells.length === 0 && (
                    <div style={{ color: '#888', padding: '12px' }}>Sin hechizos en este círculo.</div>
                )}
                {circleSpells.map((spell) => (
                    <div
                        key={spell.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => castSpellById(spell.id)}
                        onKeyDown={(e) => e.key === 'Enter' && castSpellById(spell.id)}
                        style={{
                            padding: '8px 12px',
                            marginBottom: '4px',
                            backgroundColor: '#1f1f1f',
                            color: '#ddd',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            fontSize: '14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '8px',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#8b5a2b';
                            e.currentTarget.style.color = '#ffd700';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#1f1f1f';
                            e.currentTarget.style.color = '#ddd';
                        }}
                    >
                        <span>{spell.name}</span>
                        <span style={{ color: '#80a0ff', fontSize: '12px' }}>{spell.mpCost} MP</span>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <RpgCheckbox
                    id="cast-animation-checkbox"
                    label="Animación de casteo"
                    checked={useCastAnimation}
                    onCheckedChange={(checked) => setUseCastAnimation(checked === true)}
                />
            </div>

            <div style={{ marginTop: '8px', fontSize: '12px', color: '#888' }}>
                Clic en un hechizo para lanzarlo (como Olympia). Ctrl+1..9 / Ctrl+0 abre el círculo indicado.
            </div>
        </DraggableDialog>
    );
}