import { useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { DraggableDialog } from './DraggableDialog';
import { RpgButton } from '../components/RpgButton';
import {
    buySpell,
    isSpellLearned,
    magicShopDialogStore,
    setMagicShopCircle,
} from '../store/MagicShopDialog.store';
import { getMagicShopPrice, getMagicShopSpells } from '../../constants/SpellAcquisition';
import { getSpellCircles } from '../../constants/Spells';

interface MagicShopDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
}

export function MagicShopDialog({
    position,
    zIndex,
    onBringToFront,
}: MagicShopDialogProps) {
    const activeCircle = useStore(magicShopDialogStore, (s) => s.activeCircle);
    const gold = useStore(magicShopDialogStore, (s) => s.gold);
    const learnedSpellIds = useStore(magicShopDialogStore, (s) => s.learnedSpellIds);
    const [statusMessage, setStatusMessage] = useState('');

    const circleSpells = getMagicShopSpells().filter((s) => s.circle === activeCircle);

    const handleBuy = (spellId: number) => {
        const result = buySpell(spellId);
        setStatusMessage(result.message);
    };

    return (
        <DraggableDialog
            title="Tienda de Magia"
            position={position}
            id="magic-shop-dialog"
            zIndex={zIndex}
            onBringToFront={onBringToFront}
        >
            <div style={{ color: '#ffd700', fontSize: '13px', marginBottom: '8px', fontFamily: 'Courier New, monospace' }}>
                Oro: {gold.toLocaleString()}
                {learnedSpellIds.length > 0 && (
                    <span style={{ color: '#80a0ff', marginLeft: '12px' }}>
                        {learnedSpellIds.length} hechizo(s) aprendido(s)
                    </span>
                )}
            </div>

            <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {getSpellCircles().map((circle) => (
                    <button
                        key={circle}
                        type="button"
                        onClick={() => setMagicShopCircle(circle)}
                        style={{
                            padding: '6px 14px',
                            backgroundColor: activeCircle === circle ? '#4a2a6b' : '#222',
                            color: activeCircle === circle ? '#c8a0ff' : '#ccc',
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
                display: 'grid',
                gridTemplateColumns: '1fr 60px 70px 80px',
                gap: '4px',
                padding: '6px 8px',
                background: '#1a1a2e',
                border: '1px solid #5c4033',
                color: '#a0a0ff',
                fontSize: '12px',
                fontFamily: 'Courier New, monospace',
                marginBottom: '4px',
            }}>
                <span>Hechizo</span>
                <span>INT</span>
                <span>Costo</span>
                <span />
            </div>

            <div style={{
                maxHeight: '300px',
                overflowY: 'auto',
                backgroundColor: '#111',
                padding: '4px',
                border: '3px solid #5c4033',
                borderRadius: '6px',
            }}>
                {circleSpells.length === 0 && (
                    <div style={{ color: '#888', padding: '12px' }}>Sin hechizos en este círculo.</div>
                )}
                {circleSpells.map((spell) => {
                    const { reqInt, cost } = getMagicShopPrice(spell.id);
                    const learned = isSpellLearned(spell.id);
                    return (
                        <div
                            key={spell.id}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 60px 70px 80px',
                                gap: '4px',
                                alignItems: 'center',
                                padding: '6px 8px',
                                marginBottom: '2px',
                                backgroundColor: learned ? '#1a2e1a' : '#1f1f1f',
                                color: learned ? '#80ff80' : '#ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                            }}
                        >
                            <span>{spell.name}{learned ? ' ✓' : ''}</span>
                            <span style={{ color: '#aaa' }}>{reqInt}</span>
                            <span style={{ color: '#ffd700' }}>{cost}</span>
                            <RpgButton
                                onClick={() => handleBuy(spell.id)}
                                disabled={learned}
                                style={{ padding: '2px 6px', fontSize: '11px' }}
                            >
                                {learned ? '—' : 'Comprar'}
                            </RpgButton>
                        </div>
                    );
                })}
            </div>

            {statusMessage && (
                <div style={{
                    marginTop: '8px',
                    padding: '6px',
                    background: '#1a1a1a',
                    border: '1px solid #5c4033',
                    color: '#ccc',
                    fontSize: '12px',
                    fontFamily: 'Courier New, monospace',
                }}>
                    {statusMessage}
                </div>
            )}

            <div style={{ marginTop: '8px', fontSize: '11px', color: '#888' }}>
                Habla con Gandalf en la Torre del Mago (wzdtwr) para abrir esta tienda.
            </div>
        </DraggableDialog>
    );
}