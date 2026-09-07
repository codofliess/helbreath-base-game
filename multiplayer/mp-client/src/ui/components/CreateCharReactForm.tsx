import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import {
    OUT_UI_CREATECHAR_CANCEL,
    OUT_UI_CREATECHAR_CONFIRM,
    TOAST_REQUESTED,
} from '../../constants/EventNames';
import { connectDialogStore } from '../store/ConnectDialog.store';
import { checkCharacterNameAvailable } from '../../utils/characterNameApi';
import { getDefaultGameHost, getDefaultGamePort } from '../../utils/serverDefaults';
import {
    applyReferralCodeFromUser,
    getStoredReferralCode,
} from '../../utils/referral';
import {
    CREATE_NAME_MAX_LEN,
    CREATE_STAT_KEYS,
    CREATE_STAT_LABELS,
    adjustCreateCharStat,
    createCharVitals,
    initialCreateCharStats,
    remainingCreateStatPoints,
    sanitizeCreateCharName,
    validateCreateCharName,
} from '../../utils/createCharDraft';

const SKIN = ['light', 'tanned', 'dark'] as const;
const NAME_CHECK_MS = 350;

interface CreateCharReactFormProps {
    zIndex: number;
    slotIndex: number;
}

/**
 * RH / Phantom create must not depend on Phaser chips (letterboxed canvas hid
 * gender and stats — only the DOM name field was usable). React owns the form.
 */
export function CreateCharReactForm({ zIndex, slotIndex }: CreateCharReactFormProps) {
    const walletSession = useStore(connectDialogStore, (s) => s.walletSession);
    const [name, setName] = useState('');
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [skin, setSkin] = useState<(typeof SKIN)[number]>('light');
    const [hair, setHair] = useState(0);
    const [cloth, setCloth] = useState(0);
    const [stats, setStats] = useState(initialCreateCharStats);
    const [nameStatus, setNameStatus] = useState('Type a unique name (2–10 letters/numbers).');
    const [nameOk, setNameOk] = useState(false);
    const [busy, setBusy] = useState(false);
    const [refPaste, setRefPaste] = useState(() => getStoredReferralCode() ?? '');
    const [refNote, setRefNote] = useState(() => {
        const stored = getStoredReferralCode();
        return stored ? `Applied: ${stored} (activates when you enter the World).` : '';
    });

    const left = remainingCreateStatPoints(stats);
    const vitals = createCharVitals(stats);

    useEffect(() => {
        document.body.classList.add('createchar-react-open');
        return () => {
            document.body.classList.remove('createchar-react-open');
        };
    }, []);

    useEffect(() => {
        const local = validateCreateCharName(name);
        if (!local.ok) {
            setNameOk(false);
            setNameStatus(local.message);
            return;
        }
        setNameOk(false);
        setNameStatus('Checking availability…');
        const session = walletSession;
        if (!session) {
            setNameOk(true);
            setNameStatus('Name will be re-checked when you create.');
            return;
        }
        let cancelled = false;
        const timer = window.setTimeout(() => {
            void checkCharacterNameAvailable(
                getDefaultGameHost(),
                getDefaultGamePort(),
                session.wallet,
                session.token,
                name,
            )
                .then((result) => {
                    if (cancelled) {
                        return;
                    }
                    setNameOk(result.available);
                    setNameStatus(result.message || (result.available ? 'Name is available.' : 'That name is taken.'));
                })
                .catch(() => {
                    if (cancelled) {
                        return;
                    }
                    setNameOk(true);
                    setNameStatus('Could not verify online — server will re-check on Create.');
                });
        }, NAME_CHECK_MS);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [name, walletSession]);

    const onCreate = () => {
        const local = validateCreateCharName(name);
        if (!local.ok) {
            EventBus.emit(TOAST_REQUESTED, { message: local.message, severity: 'warning' });
            return;
        }
        if (!nameOk) {
            EventBus.emit(TOAST_REQUESTED, { message: nameStatus, severity: 'warning' });
            return;
        }
        if (left > 0) {
            EventBus.emit(TOAST_REQUESTED, {
                message: `Allocate remaining ${left} point${left === 1 ? '' : 's'} first.`,
                severity: 'warning',
            });
            return;
        }
        if (refPaste.trim()) {
            const saved = applyReferralCodeFromUser(refPaste);
            if (saved.ok && saved.code) {
                setRefPaste(saved.code);
                setRefNote(`Applied: ${saved.code} (activates when you enter the World).`);
            } else if (!getStoredReferralCode()) {
                EventBus.emit(TOAST_REQUESTED, { message: saved.message, severity: 'warning' });
                return;
            }
        }
        setBusy(true);
        EventBus.emit(OUT_UI_CREATECHAR_CONFIRM, {
            slotIndex,
            characterName: name,
            gender,
            skinColor: skin,
            hairStyleIndex: hair,
            underwearColorIndex: cloth,
            str: stats.str,
            vit: stats.vit,
            dex: stats.dex,
            int: stats.int,
            mag: stats.mag,
            chr: stats.chr,
        });
    };

    const onApplyRef = () => {
        const result = applyReferralCodeFromUser(refPaste);
        setRefNote(result.ok && result.code
            ? `Applied: ${result.code} (activates when you enter the World).`
            : result.message);
        EventBus.emit(TOAST_REQUESTED, {
            message: result.message,
            severity: result.ok ? 'success' : 'warning',
        });
        if (result.ok && result.code) {
            setRefPaste(result.code);
        }
    };

    return createPortal(
        <div
            className="createchar-react"
            style={{ zIndex: Math.max(zIndex + 40, 2147483000) }}
            data-dialog-id="create-char-react"
        >
            <div className="createchar-react__panel">
                <p className="createchar-react__kicker">Helbreath World</p>
                <h2 className="createchar-react__title">Create Character</h2>
                <p className="createchar-react__lead">
                    Name, gender, look, and attributes. Paste a friend&apos;s referral before you seal.
                </p>

                <label className="createchar-react__label" htmlFor="createchar-name">
                    Name
                </label>
                <input
                    id="createchar-name"
                    className="createchar-react__input"
                    type="text"
                    maxLength={CREATE_NAME_MAX_LEN}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(sanitizeCreateCharName(e.target.value))}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            onCreate();
                        }
                    }}
                />
                <p className="createchar-react__status">{nameStatus}</p>

                <div className="createchar-react__row">
                    <span className="createchar-react__label">Gender</span>
                    <button
                        type="button"
                        className={`createchar-react__chip${gender === 'male' ? ' is-on' : ''}`}
                        onClick={() => setGender('male')}
                    >
                        Male
                    </button>
                    <button
                        type="button"
                        className={`createchar-react__chip${gender === 'female' ? ' is-on' : ''}`}
                        onClick={() => setGender('female')}
                    >
                        Female
                    </button>
                </div>

                <div className="createchar-react__row">
                    <span className="createchar-react__label">Skin</span>
                    {SKIN.map((tone) => (
                        <button
                            key={tone}
                            type="button"
                            className={`createchar-react__chip${skin === tone ? ' is-on' : ''}`}
                            onClick={() => setSkin(tone)}
                        >
                            {tone[0].toUpperCase() + tone.slice(1)}
                        </button>
                    ))}
                </div>

                <div className="createchar-react__row">
                    <span className="createchar-react__label">Hair</span>
                    <button type="button" className="createchar-react__chip" onClick={() => setHair((h) => (h + 7) % 8)}>
                        ◀
                    </button>
                    <span className="createchar-react__value">Style {hair + 1}</span>
                    <button type="button" className="createchar-react__chip" onClick={() => setHair((h) => (h + 1) % 8)}>
                        ▶
                    </button>
                    <span className="createchar-react__label">Cloth</span>
                    <button type="button" className="createchar-react__chip" onClick={() => setCloth((c) => (c + 7) % 8)}>
                        ◀
                    </button>
                    <span className="createchar-react__value">Color {cloth + 1}</span>
                    <button type="button" className="createchar-react__chip" onClick={() => setCloth((c) => (c + 1) % 8)}>
                        ▶
                    </button>
                </div>

                <p className="createchar-react__points">
                    {left > 0 ? `${left} points left — spend all 10 before Create.` : 'All points sealed.'}
                </p>
                <div className="createchar-react__stats">
                    {CREATE_STAT_KEYS.map((key) => (
                        <div key={key} className="createchar-react__stat">
                            <span>{CREATE_STAT_LABELS[key]}</span>
                            <button
                                type="button"
                                className="createchar-react__chip"
                                onClick={() => setStats((s) => adjustCreateCharStat(s, key, -1))}
                            >
                                −
                            </button>
                            <strong>{stats[key]}</strong>
                            <button
                                type="button"
                                className="createchar-react__chip"
                                onClick={() => setStats((s) => adjustCreateCharStat(s, key, 1))}
                            >
                                +
                            </button>
                        </div>
                    ))}
                </div>
                <p className="createchar-react__vitals">
                    HP {vitals.hp} · MP {vitals.mp} · SP {vitals.sp}
                </p>

                <label className="createchar-react__label" htmlFor="createchar-ref">
                    Friend&apos;s referral (optional)
                </label>
                <div className="createchar-react__ref-row">
                    <input
                        id="createchar-ref"
                        className="createchar-react__input"
                        type="text"
                        spellCheck={false}
                        autoComplete="off"
                        placeholder="NAME-XXXX or full ?ref= link"
                        value={refPaste}
                        onChange={(e) => setRefPaste(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                onApplyRef();
                            }
                        }}
                    />
                    <button type="button" className="createchar-react__btn" onClick={onApplyRef}>
                        Apply
                    </button>
                </div>
                {refNote ? <p className="createchar-react__status">{refNote}</p> : null}
                <p className="createchar-react__hint">
                    One benefit per wallet. Friend gets starter gold + tablets; you earn locked $HELL when they hit 150.
                </p>

                <div className="createchar-react__actions">
                    <button
                        type="button"
                        className="createchar-react__btn createchar-react__btn--gold"
                        disabled={busy}
                        onClick={onCreate}
                    >
                        Create Character
                    </button>
                    <button
                        type="button"
                        className="createchar-react__btn"
                        disabled={busy}
                        onClick={() => EventBus.emit(OUT_UI_CREATECHAR_CANCEL)}
                    >
                        Back
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
