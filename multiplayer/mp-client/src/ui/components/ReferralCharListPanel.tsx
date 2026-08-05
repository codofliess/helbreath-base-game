import React, { useMemo, useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { connectDialogStore } from '../store/ConnectDialog.store';
import {
    applyReferralCodeFromUser,
    buildShareUrl,
    copyTextToClipboard,
    getStoredReferralCode,
} from '../../utils/referral';
import { EventBus } from '../../game/EventBus';
import { TOAST_REQUESTED } from '../../constants/EventNames';

/**
 * Overlay on Character List (play-world desk): copy your NAME-XXXX link + paste a friend's code.
 * Lifetime once per wallet is enforced server-side; client first-touch stores the code for auth.
 */
export function ReferralCharListPanel() {
    const phase = useStore(connectDialogStore, (s) => s.phase);
    const isOpen = useStore(connectDialogStore, (s) => s.isOpen);
    const referralInfo = useStore(connectDialogStore, (s) => s.referralInfo);
    const [paste, setPaste] = useState(() => getStoredReferralCode() ?? '');
    const [copied, setCopied] = useState(false);

    const show = isOpen && phase === 'play-world';
    const myCode = referralInfo?.code ?? '';
    const shareUrl = useMemo(
        () => referralInfo?.shareUrl || (myCode ? buildShareUrl(myCode) : ''),
        [referralInfo?.shareUrl, myCode],
    );
    const already = referralInfo?.alreadyAttributed ?? false;
    const stored = getStoredReferralCode();

    if (!show) {
        return null;
    }

    const toast = (message: string, severity: 'info' | 'success' | 'warning' = 'info') => {
        EventBus.emit(TOAST_REQUESTED, { message, severity, autoClose: 3500 });
    };

    const onCopy = async () => {
        if (!shareUrl) {
            toast('Create a character first to mint your NAME-XXXX code.', 'warning');
            return;
        }
        const ok = await copyTextToClipboard(shareUrl);
        setCopied(ok);
        toast(ok ? 'Referral link copied!' : 'Could not copy — select and copy manually.', ok ? 'success' : 'warning');
        window.setTimeout(() => setCopied(false), 2000);
    };

    const onApply = () => {
        if (already) {
            toast('This wallet already used a referral (once per lifetime).', 'warning');
            return;
        }
        const result = applyReferralCodeFromUser(paste);
        toast(result.message, result.ok ? 'success' : 'warning');
        if (result.ok && result.code) {
            setPaste(result.code);
        }
    };

    return (
        <div className="cl-ref-panel" role="region" aria-label="Referral">
            <div className="cl-ref-panel__glow" aria-hidden />
            <div className="cl-ref-panel__inner">
                <div className="cl-ref-panel__brand">
                    <span className="cl-ref-panel__kicker">Recruitment</span>
                    <h3 className="cl-ref-panel__title">Referral link</h3>
                    <p className="cl-ref-panel__hint">
                        One benefit per wallet, lifetime. Friend gets starter gold + tablets; you earn locked $HELL
                        when they hit 150.
                    </p>
                </div>

                <div className="cl-ref-panel__row">
                    <div className="cl-ref-panel__field">
                        <label className="cl-ref-panel__label">Your code</label>
                        <div className="cl-ref-panel__code-row">
                            <code className="cl-ref-panel__code">{myCode || '— create a character —'}</code>
                            <button
                                type="button"
                                className="cl-ref-panel__btn cl-ref-panel__btn--gold"
                                onClick={() => void onCopy()}
                                disabled={!shareUrl}
                            >
                                {copied ? 'Copied' : 'Copy link'}
                            </button>
                        </div>
                        {shareUrl ? (
                            <div className="cl-ref-panel__url" title={shareUrl}>
                                {shareUrl}
                            </div>
                        ) : null}
                    </div>

                    <div className="cl-ref-panel__field">
                        <label className="cl-ref-panel__label" htmlFor="cl-ref-paste">
                            Paste a friend&apos;s code
                        </label>
                        <div className="cl-ref-panel__code-row">
                            <input
                                id="cl-ref-paste"
                                className="cl-ref-panel__input"
                                type="text"
                                spellCheck={false}
                                autoComplete="off"
                                placeholder="NAME-XXXX or full ?ref= link"
                                value={paste}
                                disabled={already}
                                onChange={(e) => setPaste(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        onApply();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                className="cl-ref-panel__btn"
                                onClick={onApply}
                                disabled={already}
                            >
                                Apply
                            </button>
                        </div>
                        <div className="cl-ref-panel__status">
                            {already
                                ? 'This wallet already claimed a referral benefit.'
                                : stored
                                  ? `Applied: ${stored} (activates when you Start)`
                                  : 'Optional — works even if you already have levels.'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
