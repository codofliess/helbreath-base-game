import { useEffect, useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { connectDialogStore } from '../store/ConnectDialog.store';
import { getDefaultGameHost, getDefaultGamePort } from '../../utils/serverDefaults';

interface BiPlayer {
    name: string;
}

/**
 * Under Arena Pre-Ready footer: live list of fighters on Bleeding Island lobby
 * so others can see who is ON and enter to offer duels.
 */
export function BleedingOnlineStrip() {
    const isOpen = useStore(connectDialogStore, (s) => s.isOpen);
    const phase = useStore(connectDialogStore, (s) => s.phase);
    const [players, setPlayers] = useState<BiPlayer[]>([]);
    const [count, setCount] = useState(0);
    const [err, setErr] = useState<string | null>(null);

    const show = isOpen && phase === 'arena-lobby';

    useEffect(() => {
        if (!show) {
            return;
        }
        let cancelled = false;
        const poll = async () => {
            try {
                const host = getDefaultGameHost();
                const port = getDefaultGamePort();
                // Prefer same-origin proxy / play host; fall back to game HTTP API.
                const urls = [
                    `https://play.chainlords.net/api/arena/bleeding-online`,
                    `http://${host}:${port}/api/arena/bleeding-online`,
                ];
                let data: { players?: BiPlayer[]; count?: number } | null = null;
                for (const url of urls) {
                    try {
                        const res = await fetch(url, { cache: 'no-store' });
                        if (!res.ok) {
                            continue;
                        }
                        data = (await res.json()) as { players?: BiPlayer[]; count?: number };
                        break;
                    } catch {
                        /* try next */
                    }
                }
                if (cancelled) {
                    return;
                }
                if (!data) {
                    setErr('offline');
                    return;
                }
                setErr(null);
                setPlayers(Array.isArray(data.players) ? data.players : []);
                setCount(typeof data.count === 'number' ? data.count : data.players?.length ?? 0);
            } catch {
                if (!cancelled) {
                    setErr('offline');
                }
            }
        };
        void poll();
        const t = window.setInterval(() => void poll(), 5000);
        return () => {
            cancelled = true;
            window.clearInterval(t);
        };
    }, [show]);

    if (!show) {
        return null;
    }

    return (
        <div className="bi-online-strip" role="status" aria-live="polite">
            <div className="bi-online-strip__head">
                <span className="bi-online-strip__dot" aria-hidden />
                <strong>Bleeding Island</strong>
                <span className="bi-online-strip__count">
                    {err ? '—' : `${count} online`}
                </span>
            </div>
            <div className="bi-online-strip__list">
                {err ? (
                    <span className="bi-online-strip__empty">No se pudo leer el lobby…</span>
                ) : players.length === 0 ? (
                    <span className="bi-online-strip__empty">Nadie en BI — entrá y esperá rivales</span>
                ) : (
                    players.map((p) => (
                        <span key={p.name} className="bi-online-strip__name" title={`${p.name} en Bleeding Island`}>
                            {p.name}
                        </span>
                    ))
                )}
            </div>
            <p className="bi-online-strip__hint">
                Si ves a alguien ON, entrá con <em>Enter Bleeding Island</em> y ofrecé duel.
            </p>
        </div>
    );
}
