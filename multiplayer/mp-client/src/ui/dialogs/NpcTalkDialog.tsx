import { useStore } from '@tanstack/react-store';
import { useEffect } from 'react';
import { OlympiaDialogShell } from '../components/OlympiaDialogShell';
import { OlympiaSpriteButton } from '../components/OlympiaSpriteButton';
import {
    DIALOG_BTN_OK,
    DIALOG_BTN_OK_HOVER,
    LEVELSET_DIALOG_BG,
} from '../../constants/SpriteKeys';
import {
    applyCityNpcServiceResult,
    npcTalkDialogStore,
    setNpcTalkDialogOpen,
    setNpcTalkStatusMessage,
} from '../store/NpcTalkDialog.store';
import { progressionStore } from '../store/Progression.store';
import { getNetworkManager } from '../../utils/RegistryUtils';
import type { IRefPhaserGame } from '../../PhaserGame';
import { EventBus } from '../../game/EventBus';
import { SERVER_CITY_NPC_SERVICE_RESULT } from '../../constants/EventNames';

interface NpcTalkDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
    phaserRef: React.RefObject<IRefPhaserGame | null>;
}

type CityNpcResultPayload = Parameters<typeof applyCityNpcServiceResult>[0];

/**
 * Live city NPC desks: Howard (guild interest), Kennedy (city hall), Gail (heal/bless/donate/angels), Perry (crusade + angels).
 */
export function NpcTalkDialog({
    position,
    zIndex,
    onBringToFront,
    phaserRef,
}: NpcTalkDialogProps) {
    const isOpen = useStore(npcTalkDialogStore, (s) => s.isOpen);
    const npcId = useStore(npcTalkDialogStore, (s) => s.npcId);
    const npcName = useStore(npcTalkDialogStore, (s) => s.npcName);
    const title = useStore(npcTalkDialogStore, (s) => s.title);
    const role = useStore(npcTalkDialogStore, (s) => s.role);
    const statusMessage = useStore(npcTalkDialogStore, (s) => s.statusMessage);
    const guildInterestRegistered = useStore(npcTalkDialogStore, (s) => s.guildInterestRegistered);
    const citizenshipSide = useStore(npcTalkDialogStore, (s) => s.citizenshipSide);
    const cityServicesSummary = useStore(npcTalkDialogStore, (s) => s.cityServicesSummary);
    const crusadeStatus = useStore(npcTalkDialogStore, (s) => s.crusadeStatus);
    const hp = useStore(npcTalkDialogStore, (s) => s.hp);
    const maxHp = useStore(npcTalkDialogStore, (s) => s.maxHp);
    const blessed = useStore(npcTalkDialogStore, (s) => s.blessed);
    const majesticPoints = useStore(progressionStore, (s) => s.majesticPoints ?? 0);
    const level = useStore(progressionStore, (s) => s.level ?? 1);
    const levelBlocked = useStore(progressionStore, (s) => s.levelBlocked ?? false);
    const canClaimAngel = majesticPoints >= 5 && (level >= 150 || levelBlocked);

    useEffect(() => {
        if (!isOpen || !npcId) {
            return;
        }

        const game = phaserRef.current?.game;
        const nm = game ? getNetworkManager(game) : undefined;
        if (nm) {
            setNpcTalkStatusMessage('Connecting…');
            nm.sendCityNpcServiceRequest(npcId, 'open');
        } else {
            setNpcTalkStatusMessage('Cannot reach the desk right now.');
        }

        const onResult = (payload: CityNpcResultPayload) => {
            applyCityNpcServiceResult(payload);
        };
        EventBus.on(SERVER_CITY_NPC_SERVICE_RESULT, onResult);
        return () => {
            EventBus.off(SERVER_CITY_NPC_SERVICE_RESULT, onResult);
        };
    }, [isOpen, npcId, phaserRef]);

    if (!isOpen) {
        return null;
    }

    const sendAction = (action: string, donateGold?: number) => {
        const game = phaserRef.current?.game;
        const nm = game ? getNetworkManager(game) : undefined;
        if (!nm || !npcId) {
            setNpcTalkStatusMessage('Cannot reach the desk right now.');
            return;
        }
        setNpcTalkStatusMessage('Working…');
        nm.sendCityNpcServiceRequest(npcId, action, donateGold);
    };

    return (
        <OlympiaDialogShell
            id="npc-talk-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(ev) => {
                ev.preventDefault();
                setNpcTalkDialogOpen(false);
            }}
            width={360}
            minHeight={220}
            bgSpriteKey={LEVELSET_DIALOG_BG}
            rootClassName="shop-dialog-root"
        >
            <div className="olympia-dialog-title-bar">
                {npcName}
                {title ? ` — ${title}` : ''}
            </div>
            <div className="shop-dialog-content">
                {role === 'guild-hall' ? (
                    <>
                        <p className="shop-dialog-intro">
                            Guild registry desk. Full create/join is Fase H — register interest for
                            beginner training.
                        </p>
                        <p className="shop-dialog-status">
                            Interest: {guildInterestRegistered ? 'registered' : 'not registered'}
                        </p>
                        <div className="shop-dialog-list">
                            <div className="shop-dialog-row">
                                <span className="shop-dialog-item-name">Register guild interest</span>
                                <OlympiaSpriteButton
                                    normalKey={DIALOG_BTN_OK}
                                    hoverKey={DIALOG_BTN_OK_HOVER}
                                    title="Register interest"
                                    fallbackLabel="OK"
                                    onClick={() => sendAction('register_guild_interest')}
                                    className="shop-dialog-buy-btn"
                                />
                            </div>
                        </div>
                    </>
                ) : null}

                {role === 'garden-warden' ? (
                    <>
                        <p className="shop-dialog-intro">
                            Olympia Garden quests: Unicorns (50) or Trolls (500). Reward: +50 contribution + 1000
                            pending $HELL.
                        </p>
                        {cityServicesSummary ? (
                            <p className="shop-dialog-hint">{cityServicesSummary}</p>
                        ) : null}
                        <div className="shop-dialog-list">
                            <div className="shop-dialog-row">
                                <span className="shop-dialog-item-name">Hunt Unicorns (50)</span>
                                <OlympiaSpriteButton
                                    normalKey={DIALOG_BTN_OK}
                                    hoverKey={DIALOG_BTN_OK_HOVER}
                                    title="Accept unicorn quest"
                                    fallbackLabel="OK"
                                    onClick={() => sendAction('accept_unicorn')}
                                    className="shop-dialog-buy-btn"
                                />
                            </div>
                            <div className="shop-dialog-row">
                                <span className="shop-dialog-item-name">Hunt Trolls (500)</span>
                                <OlympiaSpriteButton
                                    normalKey={DIALOG_BTN_OK}
                                    hoverKey={DIALOG_BTN_OK_HOVER}
                                    title="Accept troll quest"
                                    fallbackLabel="OK"
                                    onClick={() => sendAction('accept_troll')}
                                    className="shop-dialog-buy-btn"
                                />
                            </div>
                            <div className="shop-dialog-row">
                                <span className="shop-dialog-item-name">Abandon quest</span>
                                <OlympiaSpriteButton
                                    normalKey={DIALOG_BTN_OK}
                                    hoverKey={DIALOG_BTN_OK_HOVER}
                                    title="Abandon"
                                    fallbackLabel="OK"
                                    onClick={() => sendAction('abandon')}
                                    className="shop-dialog-buy-btn"
                                />
                            </div>
                        </div>
                    </>
                ) : null}

                {role === 'city-hall' ? (
                    <>
                        <p className="shop-dialog-intro">
                            City Hall (Olympia Kennedy): citizenship, municipal teleports, and William
                            for warehouse storage in this hall.
                        </p>
                        {citizenshipSide ? (
                            <p className="shop-dialog-status">Side: {citizenshipSide}</p>
                        ) : null}
                        {cityServicesSummary ? (
                            <p className="shop-dialog-hint">{cityServicesSummary}</p>
                        ) : null}
                        <div className="shop-dialog-list" style={{ maxHeight: 360, overflowY: 'auto' }}>
                            <div className="shop-dialog-row">
                                <span className="shop-dialog-item-name">Citizenship brief</span>
                                <OlympiaSpriteButton
                                    normalKey={DIALOG_BTN_OK}
                                    hoverKey={DIALOG_BTN_OK_HOVER}
                                    title="Ask Kennedy"
                                    fallbackLabel="OK"
                                    onClick={() => sendAction('city_brief')}
                                    className="shop-dialog-buy-btn"
                                />
                            </div>
                            <div className="shop-dialog-row">
                                <span className="shop-dialog-item-name">Warehouse (William)</span>
                                <OlympiaSpriteButton
                                    normalKey={DIALOG_BTN_OK}
                                    hoverKey={DIALOG_BTN_OK_HOVER}
                                    title="Where is storage?"
                                    fallbackLabel="OK"
                                    onClick={() => sendAction('open_warehouse_hint')}
                                    className="shop-dialog-buy-btn"
                                />
                            </div>
                            <p className="shop-dialog-hint">
                                Free tester teleports (dry pads + auto snap). Scroll for all maps.
                            </p>
                            {(
                                [
                                    // Home city
                                    ['teleport:city', 'Home · City plaza'],
                                    ['teleport:farm', 'Home · Farm'],
                                    ['teleport:cityhall', 'Home · City Hall'],
                                    ['teleport:shop', 'Home · Shop'],
                                    ['teleport:blacksmith', 'Home · Blacksmith'],
                                    ['teleport:warehouse', 'Home · Warehouse'],
                                    ['teleport:cathedral', 'Home · Cathedral'],
                                    ['teleport:guildhall', 'Home · Guild Hall'],
                                    ['teleport:commandhall', 'Home · Command Hall'],
                                    ['teleport:garden', 'Home · Garden'],
                                    ['teleport:barracks', 'Home · Barracks'],
                                    ['teleport:city_dungeon', 'Home · City Dungeon'],
                                    ['teleport:other_city', 'Enemy · City plaza'],
                                    ['teleport:other_farm', 'Enemy · Farm'],
                                    // Wild
                                    ['teleport:middleland', 'Wild · Middleland'],
                                    ['teleport:promiseland', 'Wild · Promiseland'],
                                    ['teleport:middled1n', 'Dungeon · PL D1 North'],
                                    ['teleport:middled1x', 'Dungeon · PL D1 South'],
                                    ['teleport:huntzone1', 'Hunt · Zone 1'],
                                    ['teleport:huntzone2', 'Hunt · Zone 2'],
                                    ['teleport:huntzone3', 'Hunt · Zone 3'],
                                    ['teleport:huntzone4', 'Hunt · Zone 4'],
                                    ['teleport:icebound', 'Wild · Icebound'],
                                    ['teleport:toh1', 'Wild · TOH 1'],
                                    ['teleport:toh2', 'Wild · TOH 2'],
                                    ['teleport:toh3', 'Wild · TOH 3'],
                                    ['teleport:abaddon', 'Wild · Abaddon'],
                                    ['teleport:infernia_a', 'Wild · Infernia A'],
                                    ['teleport:infernia_b', 'Wild · Infernia B'],
                                    ['teleport:procella', 'Wild · Procella'],
                                    ['teleport:druncncity', 'Wild · Druncnian'],
                                    ['teleport:dglv2', 'Dungeon · Lv2'],
                                    ['teleport:dglv3', 'Dungeon · Lv3'],
                                    ['teleport:dglv4', 'Dungeon · Lv4'],
                                    ['teleport:bisle', 'Wild · Bleeding Island'],
                                    ['teleport:maze', 'Wild · Maze'],
                                    ['teleport:btfield', 'Event · Battlefield'],
                                    ['teleport:godh', 'Event · God Heldenian'],
                                    ['teleport:hrampart', 'Event · Heldenian Rampart'],
                                    // Soft
                                    ['teleport:traveler', 'Soft · Traveler Zone'],
                                    ['teleport:training', 'Soft · Training Arena'],
                                    ['teleport:colosseum', 'Soft · Colosseum'],
                                    ['teleport:arena1', 'Soft · Arena 1'],
                                    ['teleport:resurr1', 'Soft · Resurrection Zone'],
                                ] as const
                            ).map(([action, label]) => (
                                <div key={action} className="shop-dialog-row">
                                    <span className="shop-dialog-item-name">{label}</span>
                                    <span className="shop-dialog-item-price">free</span>
                                    <OlympiaSpriteButton
                                        normalKey={DIALOG_BTN_OK}
                                        hoverKey={DIALOG_BTN_OK_HOVER}
                                        title={label}
                                        fallbackLabel="OK"
                                        onClick={() => sendAction(action)}
                                        className="shop-dialog-buy-btn"
                                    />
                                </div>
                            ))}
                        </div>
                    </>
                ) : null}

                {role === 'cathedral' ? (
                    <>
                        <p className="shop-dialog-intro">
                            Cathedral: heal (50g), bless PFM 60s (100g), donate (100g). Tutelary Angels cost 5
                            majestics each (L150+). Equip as accessory; bag RMB upgrades with majestics to +15.
                        </p>
                        {maxHp > 0 ? (
                            <p className="shop-dialog-status">
                                HP {hp}/{maxHp}
                                {blessed ? ' · blessed' : ''}
                                {` · Maj ${majesticPoints}`}
                            </p>
                        ) : (
                            <p className="shop-dialog-status">Majestics: {majesticPoints}</p>
                        )}
                        <div className="shop-dialog-list">
                            <div className="shop-dialog-row">
                                <span className="shop-dialog-item-name">Heal</span>
                                <span className="shop-dialog-item-price">50g</span>
                                <OlympiaSpriteButton
                                    normalKey={DIALOG_BTN_OK}
                                    hoverKey={DIALOG_BTN_OK_HOVER}
                                    title="Heal"
                                    fallbackLabel="OK"
                                    onClick={() => sendAction('heal')}
                                    className="shop-dialog-buy-btn"
                                />
                            </div>
                            <div className="shop-dialog-row">
                                <span className="shop-dialog-item-name">Bless (PFM)</span>
                                <span className="shop-dialog-item-price">100g</span>
                                <OlympiaSpriteButton
                                    normalKey={DIALOG_BTN_OK}
                                    hoverKey={DIALOG_BTN_OK_HOVER}
                                    title="Bless"
                                    fallbackLabel="OK"
                                    onClick={() => sendAction('bless')}
                                    className="shop-dialog-buy-btn"
                                />
                            </div>
                            <div className="shop-dialog-row">
                                <span className="shop-dialog-item-name">Donate</span>
                                <span className="shop-dialog-item-price">100g</span>
                                <OlympiaSpriteButton
                                    normalKey={DIALOG_BTN_OK}
                                    hoverKey={DIALOG_BTN_OK_HOVER}
                                    title="Donate"
                                    fallbackLabel="OK"
                                    onClick={() => sendAction('donate', 100)}
                                    className="shop-dialog-buy-btn"
                                />
                            </div>
                            {(
                                [
                                    ['claim_angel_str', 'Angel STR'],
                                    ['claim_angel_dex', 'Angel DEX'],
                                    ['claim_angel_int', 'Angel INT'],
                                    ['claim_angel_mag', 'Angel MAG'],
                                ] as const
                            ).map(([action, label]) => (
                                <div key={action} className="shop-dialog-row">
                                    <span className="shop-dialog-item-name">{label}</span>
                                    <span className="shop-dialog-item-price">5 maj</span>
                                    <OlympiaSpriteButton
                                        normalKey={DIALOG_BTN_OK}
                                        hoverKey={DIALOG_BTN_OK_HOVER}
                                        title={
                                            canClaimAngel
                                                ? `Claim ${label}`
                                                : 'Need L150+ and 5 majestics'
                                        }
                                        fallbackLabel="OK"
                                        onClick={() => sendAction(action)}
                                        className="shop-dialog-buy-btn"
                                    />
                                </div>
                            ))}
                        </div>
                    </>
                ) : null}

                {role === 'command-hall' ? (
                    <>
                        <p className="shop-dialog-intro">
                            War command desk (Olympia CMD Hall). Crusade brief + Tutelary Angels (5 maj each).
                        </p>
                        {crusadeStatus ? (
                            <p className="shop-dialog-status">Crusade: {crusadeStatus}</p>
                        ) : null}
                        <p className="shop-dialog-status">Majestics: {majesticPoints}</p>
                        <div className="shop-dialog-list">
                            <div className="shop-dialog-row">
                                <span className="shop-dialog-item-name">Crusade brief</span>
                                <OlympiaSpriteButton
                                    normalKey={DIALOG_BTN_OK}
                                    hoverKey={DIALOG_BTN_OK_HOVER}
                                    title="Ask Perry"
                                    fallbackLabel="OK"
                                    onClick={() => sendAction('crusade_brief')}
                                    className="shop-dialog-buy-btn"
                                />
                            </div>
                            {(
                                [
                                    ['claim_angel_str', 'Angel STR'],
                                    ['claim_angel_dex', 'Angel DEX'],
                                    ['claim_angel_int', 'Angel INT'],
                                    ['claim_angel_mag', 'Angel MAG'],
                                ] as const
                            ).map(([action, label]) => (
                                <div key={action} className="shop-dialog-row">
                                    <span className="shop-dialog-item-name">{label}</span>
                                    <span className="shop-dialog-item-price">5 maj</span>
                                    <OlympiaSpriteButton
                                        normalKey={DIALOG_BTN_OK}
                                        hoverKey={DIALOG_BTN_OK_HOVER}
                                        title={
                                            canClaimAngel
                                                ? `Claim ${label}`
                                                : 'Need L150+ and 5 majestics'
                                        }
                                        fallbackLabel="OK"
                                        onClick={() => sendAction(action)}
                                        className="shop-dialog-buy-btn"
                                    />
                                </div>
                            ))}
                        </div>
                    </>
                ) : null}

                {role === 'academy-learning' ? (
                    <>
                        <p className="shop-dialog-intro">
                            PvP Learning — Guards and drills teach common sequences. No Elo. Fight starts here in
                            the cathedral grounds / open world (not tournament).
                        </p>
                        <div className="shop-dialog-list">
                            {(
                                [
                                    ['learn_guards', 'Guards waves (1→2→2→2→3)'],
                                    ['learn_darkelves', 'Dark Elves (invi + PFA)'],
                                    ['learn_skills', 'Skills CC (Chill→Para→DS)'],
                                ] as const
                            ).map(([action, label]) => (
                                <div key={action} className="shop-dialog-row">
                                    <span className="shop-dialog-item-name">{label}</span>
                                    <OlympiaSpriteButton
                                        normalKey={DIALOG_BTN_OK}
                                        hoverKey={DIALOG_BTN_OK_HOVER}
                                        title={label}
                                        fallbackLabel="OK"
                                        onClick={() => sendAction(action)}
                                        className="shop-dialog-buy-btn"
                                    />
                                </div>
                            ))}
                        </div>
                    </>
                ) : null}

                {role === 'academy-challenge' ? (
                    <>
                        <p className="shop-dialog-intro">
                            Challenge desk (GM). Easy→Elite ladder. Rewards scale with performance; high-EK
                            players cannot farm low tiers. Hero-set duelists TBD — Guards scaffold for now.
                        </p>
                        {cityServicesSummary ? (
                            <pre
                                className="shop-dialog-hint"
                                style={{
                                    whiteSpace: 'pre-wrap',
                                    fontSize: 11,
                                    maxHeight: 120,
                                    overflow: 'auto',
                                }}
                            >
                                {cityServicesSummary}
                            </pre>
                        ) : null}
                        <div className="shop-dialog-list">
                            {(
                                [
                                    ['challenge_easy', 'Challenge · Easy'],
                                    ['challenge_intermediate', 'Challenge · Intermediate'],
                                    ['challenge_hard', 'Challenge · Hard'],
                                    ['challenge_elite', 'Challenge · Elite'],
                                    ['board_easy', 'Board · Easy'],
                                    ['board_intermediate', 'Board · Intermediate'],
                                    ['board_hard', 'Board · Hard'],
                                    ['board_elite', 'Board · Elite'],
                                    ['handicap', 'My EK handicap'],
                                ] as const
                            ).map(([action, label]) => (
                                <div key={action} className="shop-dialog-row">
                                    <span className="shop-dialog-item-name">{label}</span>
                                    <OlympiaSpriteButton
                                        normalKey={DIALOG_BTN_OK}
                                        hoverKey={DIALOG_BTN_OK_HOVER}
                                        title={label}
                                        fallbackLabel="OK"
                                        onClick={() => sendAction(action)}
                                        className="shop-dialog-buy-btn"
                                    />
                                </div>
                            ))}
                        </div>
                    </>
                ) : null}

                {statusMessage ? <div className="shop-dialog-status">{statusMessage}</div> : null}
                <p className="shop-dialog-hint">Right-click dialog to close.</p>
            </div>
        </OlympiaDialogShell>
    );
}
