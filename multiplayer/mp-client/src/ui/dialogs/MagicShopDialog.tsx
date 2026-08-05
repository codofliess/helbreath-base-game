import { useEffect, type MouseEvent, type PointerEvent } from 'react';
import { useStore } from '@tanstack/react-store';
import { OlympiaDialogShell } from '../components/OlympiaDialogShell';
import { LEVELSET_DIALOG_BG } from '../../constants/SpriteKeys';
import {
    countBagGoldFromInventory,
    isSpellLearned,
    magicShopDialogStore,
    setMagicShopCircle,
    setMagicShopOpen,
    setMagicShopStatusMessage,
} from '../store/MagicShopDialog.store';
import { getMagicShopPrice, getMagicShopSpells, MAGIC_SHOP_SPELL_IDS } from '../../constants/SpellAcquisition';
import { getSpellCircles, SPELLS } from '../../constants/Spells';
import { getNetworkManager } from '../../utils/RegistryUtils';
import type { IRefPhaserGame } from '../../PhaserGame';
import { inventoryDialogStore } from '../store/InventoryDialog.store';

interface MagicShopDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
    phaserRef: React.RefObject<IRefPhaserGame | null>;
}

function stopBubble(e: PointerEvent | MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
}

/**
 * Wizard Tower (Gandalf): explicit Learn / Unlearn text buttons.
 * Actions encode spell id in the string (`learn:1`) so the server never depends on optional donate_gold.
 */
export function MagicShopDialog({
    position,
    zIndex,
    onBringToFront,
    phaserRef,
}: MagicShopDialogProps) {
    const isOpen = useStore(magicShopDialogStore, (s) => s.isOpen);
    const activeCircle = useStore(magicShopDialogStore, (s) => s.activeCircle);
    const storeGold = useStore(magicShopDialogStore, (s) => s.gold);
    const learnedSpellIds = useStore(magicShopDialogStore, (s) => s.learnedSpellIds);
    const npcId = useStore(magicShopDialogStore, (s) => s.npcId);
    const npcName = useStore(magicShopDialogStore, (s) => s.npcName);
    const statusMessage = useStore(magicShopDialogStore, (s) => s.statusMessage);
    const bagItems = useStore(inventoryDialogStore, (s) => s.baggedItems);
    const bagGold = bagItems.reduce(
        (sum, item) => (item.itemId === 90 ? sum + Math.max(0, item.quantity ?? 1) : sum),
        0,
    );
    const gold = Math.max(storeGold, bagGold);

    useEffect(() => {
        if (!isOpen || !npcId) {
            return;
        }
        const game = phaserRef.current?.game;
        const nm = game ? getNetworkManager(game) : undefined;
        if (!nm?.getCurrentGameWorldId()) {
            setMagicShopStatusMessage('World not ready — wait a second and reopen.');
            return;
        }
        console.info('[MagicShop] open', { npcId, world: nm.getCurrentGameWorldId(), bagGold: countBagGoldFromInventory() });
        nm.sendCityNpcServiceRequest(npcId, 'open');
        const fromBag = countBagGoldFromInventory();
        magicShopDialogStore.setState((s) => ({
            ...s,
            gold: Math.max(s.gold, fromBag),
            statusMessage: fromBag > 0 ? `Bag gold: ${fromBag}. Click Learn on a spell.` : s.statusMessage,
        }));
    }, [isOpen, npcId, phaserRef]);

    if (!isOpen) {
        return null;
    }

    const circleSpells = getMagicShopSpells().filter((s) => s.circle === activeCircle);

    const getNm = () => {
        const game = phaserRef.current?.game;
        return game ? getNetworkManager(game) : undefined;
    };

    const handleLearn = (spellId: number, e: MouseEvent | PointerEvent) => {
        stopBubble(e);
        console.info('[MagicShop] Learn click', { spellId, npcId, gold });
        if (!MAGIC_SHOP_SPELL_IDS.includes(spellId)) {
            setMagicShopStatusMessage('Spell not sold here.');
            return;
        }
        if (isSpellLearned(spellId)) {
            setMagicShopStatusMessage('Already learned — use Unlearn to remove it.');
            return;
        }
        const { cost } = getMagicShopPrice(spellId);
        const have = Math.max(storeGold, countBagGoldFromInventory());
        if (have < cost) {
            setMagicShopStatusMessage(`Need ${cost} gold (you have ${have}).`);
            return;
        }
        if (!npcId) {
            setMagicShopStatusMessage('ERROR: no NPC id — close and click Gandalf again.');
            return;
        }
        const nm = getNm();
        if (!nm) {
            setMagicShopStatusMessage('ERROR: no network manager.');
            return;
        }
        if (!nm.getCurrentGameWorldId()) {
            setMagicShopStatusMessage('ERROR: no game world id — rejoin world.');
            return;
        }
        const name = SPELLS.find((s) => s.id === spellId)?.name ?? `spell ${spellId}`;
        setMagicShopStatusMessage(`Sending Learn ${name} (${cost}g)…`);
        // Spell id in action string (reliable). Also pass donateGold as backup.
        nm.sendCityNpcServiceRequest(npcId, `learn:${spellId}`, spellId);
    };

    const handleUnlearn = (spellId: number, e: MouseEvent | PointerEvent) => {
        stopBubble(e);
        console.info('[MagicShop] Unlearn click', { spellId, npcId });
        if (!isSpellLearned(spellId)) {
            setMagicShopStatusMessage('You do not have that spell.');
            return;
        }
        if (!npcId) {
            setMagicShopStatusMessage('ERROR: no NPC id — close and click Gandalf again.');
            return;
        }
        const nm = getNm();
        if (!nm?.getCurrentGameWorldId()) {
            setMagicShopStatusMessage('ERROR: no connection / world.');
            return;
        }
        const name = SPELLS.find((s) => s.id === spellId)?.name ?? `spell ${spellId}`;
        setMagicShopStatusMessage(`Sending Unlearn ${name}…`);
        magicShopDialogStore.setState((s) => ({
            ...s,
            learnedSpellIds: s.learnedSpellIds.filter((id) => id !== spellId),
        }));
        nm.sendCityNpcServiceRequest(npcId, `unlearn:${spellId}`, spellId);
    };

    return (
        <OlympiaDialogShell
            id="magic-shop-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(ev) => {
                ev.preventDefault();
                setMagicShopOpen(false);
            }}
            width={400}
            minHeight={380}
            bgSpriteKey={LEVELSET_DIALOG_BG}
            rootClassName="magic-shop-dialog-root"
        >
            <div className="olympia-dialog-title-bar">Magic Tower — {npcName || 'Gandalf'}</div>
            <div className="magic-shop-dialog-content">
                <div className="magic-shop-dialog-gold">
                    Gold: <strong>{gold.toLocaleString()}</strong>
                    <span className="magic-shop-dialog-learned"> · {learnedSpellIds.length} learned</span>
                    {npcId ? (
                        <span className="magic-shop-dialog-npcid"> · npc ok</span>
                    ) : (
                        <span className="magic-shop-dialog-npcid magic-shop-dialog-npcid--bad"> · NO NPC</span>
                    )}
                </div>
                <div className="magic-shop-dialog-circles">
                    {getSpellCircles().map((circle) => (
                        <button
                            key={circle}
                            type="button"
                            className={
                                activeCircle === circle
                                    ? 'magic-shop-circle-btn magic-shop-circle-btn--active'
                                    : 'magic-shop-circle-btn'
                            }
                            onPointerDown={stopBubble}
                            onClick={(e) => {
                                stopBubble(e);
                                setMagicShopCircle(circle);
                            }}
                        >
                            {circle === 10 ? '0' : circle}
                        </button>
                    ))}
                </div>
                <div className="magic-shop-dialog-list">
                    {circleSpells.length === 0 && (
                        <div className="magic-shop-dialog-empty">No spells in this circle.</div>
                    )}
                    {circleSpells.map((spell) => {
                        const { reqInt, cost } = getMagicShopPrice(spell.id);
                        const learned = isSpellLearned(spell.id);
                        const canAfford = gold >= cost;
                        return (
                            <div
                                key={spell.id}
                                className={
                                    learned
                                        ? 'magic-shop-dialog-row magic-shop-dialog-row--learned'
                                        : 'magic-shop-dialog-row'
                                }
                            >
                                <div className="magic-shop-spell-meta">
                                    <span className="magic-shop-spell-name">
                                        {spell.name}
                                        {learned ? ' ✓' : ''}
                                    </span>
                                    <span className="magic-shop-spell-sub">
                                        INT {reqInt} · {cost}g
                                    </span>
                                </div>
                                <div className="magic-shop-dialog-actions">
                                    <button
                                        type="button"
                                        className="magic-shop-action-btn magic-shop-action-btn--learn"
                                        disabled={learned}
                                        onPointerDown={stopBubble}
                                        onMouseDown={stopBubble}
                                        onClick={(e) => handleLearn(spell.id, e)}
                                    >
                                        {learned ? 'Learned' : canAfford ? 'Learn' : `Need ${cost}g`}
                                    </button>
                                    <button
                                        type="button"
                                        className="magic-shop-action-btn magic-shop-action-btn--unlearn"
                                        disabled={!learned}
                                        onPointerDown={stopBubble}
                                        onMouseDown={stopBubble}
                                        onClick={(e) => handleUnlearn(spell.id, e)}
                                    >
                                        Unlearn
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="magic-shop-dialog-status" role="status">
                    {statusMessage || 'Pick a circle, then Learn or Unlearn.'}
                </div>
                <p className="magic-shop-dialog-hint">
                    Stay next to Gandalf. Circle 1: Heal / Create Food (100g). Right-click closes.
                </p>
            </div>
        </OlympiaDialogShell>
    );
}
