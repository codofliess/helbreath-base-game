import { useStore } from '@tanstack/react-store';
import { DraggableDialog } from './DraggableDialog';
import { RpgButton } from '../components/RpgButton';
import {
    acceptQuest,
    closeQuestDialog,
    getAvailableQuestsForPerson,
    getQuestProgressLabel,
    isQuestReadyToTurnIn,
    questStore,
    turnInQuest,
} from '../store/Quest.store';
import { getPersonById } from '../../constants/Persons';
import { formatQuestObjectives } from '../../constants/Quests';

interface QuestDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
}

export function QuestDialog({ position, zIndex, onBringToFront }: QuestDialogProps) {
    const personId = useStore(questStore, (s) => s.dialogPersonId);
    const statusMessage = useStore(questStore, (s) => s.statusMessage);
    const activeQuests = useStore(questStore, (s) => s.activeQuests);

    if (personId === null) return null;

    const person = getPersonById(personId);
    const quests = getAvailableQuestsForPerson(personId);

    const handleAccept = (questId: number) => {
        acceptQuest(questId);
    };

    const handleTurnIn = (questId: number) => {
        turnInQuest(questId);
    };

    return (
        <DraggableDialog
            title={`Misiones — ${person?.name ?? 'NPC'}`}
            position={position}
            id="quest-dialog"
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(e) => {
                e.preventDefault();
                closeQuestDialog();
            }}
        >
            <div style={{ minWidth: 320, maxWidth: 400, fontFamily: 'Courier New, monospace', color: '#ddd' }}>
                {quests.length === 0 && (
                    <p style={{ color: '#888', fontSize: 13 }}>No hay misiones disponibles en este momento.</p>
                )}

                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {quests.map((quest) => {
                        const active = activeQuests.find((q) => q.questId === quest.id);
                        const ready = active ? isQuestReadyToTurnIn(quest.id) : false;

                        return (
                            <div
                                key={quest.id}
                                style={{
                                    marginBottom: 8,
                                    padding: 8,
                                    background: active ? '#1a2a1a' : '#1a1a2e',
                                    border: `1px solid ${ready ? '#4a8' : '#5c4033'}`,
                                    borderRadius: 4,
                                }}
                            >
                                <div style={{ color: '#ffe8a3', fontWeight: 'bold', fontSize: 13 }}>
                                    {quest.name}
                                    {quest.period ? ' (Daily)' : ''}
                                </div>
                                {quest.text && (
                                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{quest.text}</div>
                                )}
                                <div style={{ fontSize: 11, color: '#80a0ff', marginTop: 4 }}>
                                    {formatQuestObjectives(quest).join(' · ')}
                                </div>
                                {active && (
                                    <div style={{ fontSize: 11, color: ready ? '#80ff80' : '#ffcc80', marginTop: 4 }}>
                                        Progreso: {getQuestProgressLabel(quest, active)}
                                    </div>
                                )}
                                {quest.reward.experience && (
                                    <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                                        Recompensa: {quest.reward.experience.toLocaleString()} EXP
                                        {quest.reward.contribution ? `, +${quest.reward.contribution} contrib.` : ''}
                                    </div>
                                )}
                                <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                                    {!active && (
                                        <RpgButton
                                            onClick={() => handleAccept(quest.id)}
                                            style={{ padding: '2px 10px', fontSize: 11 }}
                                        >
                                            Aceptar
                                        </RpgButton>
                                    )}
                                    {active && ready && (
                                        <RpgButton
                                            onClick={() => handleTurnIn(quest.id)}
                                            style={{ padding: '2px 10px', fontSize: 11 }}
                                        >
                                            Entregar
                                        </RpgButton>
                                    )}
                                    {active && !ready && (
                                        <span style={{ fontSize: 11, color: '#888' }}>En progreso…</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {statusMessage && (
                    <div style={{
                        marginTop: 8,
                        padding: 6,
                        background: '#111',
                        border: '1px solid #5c4033',
                        fontSize: 12,
                        color: '#ccc',
                    }}>
                        {statusMessage}
                    </div>
                )}

                <div style={{ marginTop: 8, textAlign: 'right' }}>
                    <RpgButton onClick={closeQuestDialog} style={{ padding: '4px 14px', fontSize: 12 }}>
                        Cerrar
                    </RpgButton>
                </div>
            </div>
        </DraggableDialog>
    );
}