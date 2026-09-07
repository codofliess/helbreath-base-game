import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useStore } from '@tanstack/react-store';
import { connectDialogStore } from '../store/ConnectDialog.store';
import { characterDialogStore } from '../store/CharacterDialog.store';
import { beginnerPathStore } from '../store/BeginnerPath.store';
import { arenaSlimModeStore } from '../store/ArenaSlimMode.store';
import {
    appendMentorMessage,
    playerMentorStore,
    setMentorMinimized,
    setMentorPending,
} from '../store/PlayerMentor.store';
import { postMentorChat } from '../../utils/mentorApi';
import { MENTOR_GUIDE_STARTER } from '../../utils/mentorHeuristics';

/**
 * Minimizable new-player mentor rail (hub + in-world).
 * Side tab when collapsed — same family as DeskModeJumpTab.
 */
export function PlayerMentorPanel() {
    const connectOpen = useStore(connectDialogStore, (s) => s.isOpen);
    const phaserWorld = useStore(connectDialogStore, (s) => s.phaserWorldSession);
    const playerName = useStore(characterDialogStore, (s) => s.stats.playerName);
    const level = useStore(characterDialogStore, (s) => s.stats.level);
    const beginner = useStore(beginnerPathStore);
    const worldId = useStore(arenaSlimModeStore, (s) => s.currentWorldId);
    const minimized = useStore(playerMentorStore, (s) => s.minimized);
    const pending = useStore(playerMentorStore, (s) => s.pending);
    const messages = useStore(playerMentorStore, (s) => s.messages);
    const [draft, setDraft] = useState('');
    const listRef = useRef<HTMLDivElement | null>(null);

    const isHubMode = connectOpen;
    const isInWorld = phaserWorld;
    const show = isHubMode || isInWorld;

    useEffect(() => {
        const el = listRef.current;
        if (!el) {
            return;
        }
        el.scrollTop = el.scrollHeight;
    }, [messages, pending, minimized]);

    if (!show) {
        return null;
    }

    const context = {
        playerName,
        level,
        worldId,
        enrolled: beginner.enrolled && !beginner.abandoned,
        activeTitle: beginner.activeQuestTitle,
        activeHint: beginner.activeQuestHint,
    };

    const send = async (text: string) => {
        const message = text.trim();
        if (!message || pending) {
            return;
        }
        setDraft('');
        appendMentorMessage({ role: 'user', text: message });
        setMentorPending(true);
        try {
            const result = await postMentorChat({ ...context, message });
            appendMentorMessage({
                role: 'mentor',
                text: result.reply,
                source: result.source,
            });
        } catch (err) {
            console.warn('[mentor] chat failed', err);
            appendMentorMessage({
                role: 'mentor',
                text: 'No pude responder ahora. Prueba Guíame o pregunta de nuevo en un momento.',
                source: 'client',
            });
        } finally {
            setMentorPending(false);
        }
    };

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        e.stopPropagation();
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void send(draft);
        }
    };

    if (minimized) {
        return (
            <button
                type="button"
                className="player-mentor player-mentor--min"
                onClick={() => setMentorMinimized(false)}
                title="Abrir mentor de nuevos jugadores"
                aria-label="Abrir mentor"
            >
                <span className="player-mentor__tab-arrow" aria-hidden>
                    ◂
                </span>
                <span className="player-mentor__tab-label">Mentor</span>
            </button>
        );
    }

    return (
        <aside className="player-mentor" role="complementary" aria-label="Mentor de nuevos jugadores">
            <header className="player-mentor__head">
                <div className="player-mentor__titles">
                    <span className="player-mentor__kicker">Chain Lords</span>
                    <h2 className="player-mentor__title">Mentor</h2>
                </div>
                <button
                    type="button"
                    className="player-mentor__icon-btn"
                    onClick={() => setMentorMinimized(true)}
                    title="Minimizar"
                    aria-label="Minimizar mentor"
                >
                    —
                </button>
            </header>
            <p className="player-mentor__lead">
                Pregunta lo que quieras. Precios del mercado son aproximados.
            </p>
            <div className="player-mentor__log" ref={listRef} role="log" aria-live="polite">
                {messages.length === 0 && (
                    <p className="player-mentor__empty">
                        Pulsa <strong>Guíame</strong> para el siguiente paso, o pregunta por un ítem del
                        tablero.
                    </p>
                )}
                {messages.map((line) => (
                    <div
                        key={line.id}
                        className={`player-mentor__bubble player-mentor__bubble--${line.role}`}
                    >
                        <span className="player-mentor__who">
                            {line.role === 'user' ? 'Tú' : line.source === 'grok' ? 'Mentor (Grok)' : 'Mentor'}
                        </span>
                        <p className="player-mentor__text">{line.text}</p>
                    </div>
                ))}
                {pending && <p className="player-mentor__pending">Pensando…</p>}
            </div>
            <div className="player-mentor__actions">
                <button
                    type="button"
                    className="player-mentor__guide"
                    disabled={pending}
                    onClick={() => void send(MENTOR_GUIDE_STARTER)}
                >
                    Guíame
                </button>
            </div>
            <div className="player-mentor__compose">
                <textarea
                    className="player-mentor__input"
                    rows={2}
                    maxLength={500}
                    value={draft}
                    disabled={pending}
                    placeholder="Pregunta lo que quieras…"
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKeyDown}
                    onKeyUp={(e) => e.stopPropagation()}
                />
                <button
                    type="button"
                    className="player-mentor__send"
                    disabled={pending || draft.trim().length === 0}
                    onClick={() => void send(draft)}
                >
                    Enviar
                </button>
            </div>
        </aside>
    );
}
