import { useMemo, useState, type MouseEvent, type PointerEvent } from 'react';
import { useStore } from '@tanstack/react-store';
import { OlympiaDialogShell } from '../components/OlympiaDialogShell';
import { LEVELSET_DIALOG_BG } from '../../constants/SpriteKeys';
import {
    CASH_SHOP_CATEGORIES,
    CASH_SHOP_SKUS,
    formatStablePrice,
    skuAcceptsHell,
    type CashShopSku,
    GENUINE_STABLECOIN_MINTS,
} from '../../constants/CashShopCatalog';
import {
    cashCurrencyFromMarket,
    cashShopDialogStore,
    setCashShopCategory,
    setCashShopMarket,
    setCashShopOpen,
    setCashShopStablecoinMint,
    setCashShopStatusMessage,
} from '../store/CashShopDialog.store';
import { getNetworkManager } from '../../utils/RegistryUtils';
import type { IRefPhaserGame } from '../../PhaserGame';
import { appStore } from '../store/App.store';
import { getItemById, getItemInventorySpriteKeyWithOverrides } from '../../constants/Items';
import { Gender } from '../../Types';
import { inventoryDialogStore } from '../store/InventoryDialog.store';

interface CashShopDialogProps {
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
 * Cash Shop — dual market USDC/USDT vs $HELL. Open via Cashier NPC or green F12 Cash.
 */
export function CashShopDialog({
    position,
    zIndex,
    onBringToFront,
    phaserRef,
}: CashShopDialogProps) {
    const isOpen = useStore(cashShopDialogStore, (s) => s.isOpen);
    const npcId = useStore(cashShopDialogStore, (s) => s.npcId);
    const npcName = useStore(cashShopDialogStore, (s) => s.npcName);
    const market = useStore(cashShopDialogStore, (s) => s.market);
    const category = useStore(cashShopDialogStore, (s) => s.category);
    const stablecoinMint = useStore(cashShopDialogStore, (s) => s.stablecoinMint);
    const statusMessage = useStore(cashShopDialogStore, (s) => s.statusMessage);
    const spriteFrameMap = useStore(appStore, (s) => s.spriteFrameMap);
    const playerGender = useStore(inventoryDialogStore, (s) => s.playerGender) ?? Gender.MALE;
    const [qty, setQty] = useState(1);

    const rows = useMemo(() => {
        const inCat = CASH_SHOP_SKUS.filter((s) => s.category === category);
        if (market === 'hell') {
            return inCat.filter(skuAcceptsHell);
        }
        return inCat;
    }, [category, market]);

    const skuIconUrl = (sku: CashShopSku): string | undefined => {
        const item = getItemById(sku.itemId);
        if (!item) return undefined;
        const key = getItemInventorySpriteKeyWithOverrides(item, playerGender);
        return key ? spriteFrameMap.get(key) : undefined;
    };

    if (!isOpen) {
        return null;
    }

    const buy = (sku: CashShopSku) => {
        const game = phaserRef.current?.game;
        const nm = game ? getNetworkManager(game) : undefined;
        // npcId '0' = remote F12 Cash (server AllowRemoteOpen)
        if (!nm || npcId === null || npcId === undefined) {
            setCashShopStatusMessage('Not connected.');
            return;
        }
        const world = nm.getCurrentGameWorldId();
        if (!world) {
            setCashShopStatusMessage('Join a world first.');
            return;
        }
        if (market === 'hell' && !skuAcceptsHell(sku)) {
            setCashShopStatusMessage('Stablecoin only (USDC/USDT) — this product does not accept $HELL.');
            return;
        }
        const currency = cashCurrencyFromMarket(market);
        const priceLabel =
            market === 'hell'
                ? `${sku.priceHell * qty} $HELL`
                : `${formatStablePrice(sku.priceStableUsdCents * qty)} stable`;
        setCashShopStatusMessage(`Buying ${sku.name} for ${priceLabel}…`);
        nm.requestBuyCashShopItem({
            npcId,
            skuId: sku.skuId,
            quantity: qty,
            currency,
            stablecoinMint: market === 'stablecoin' ? stablecoinMint : '',
            paymentTxSignature: '', // Dev: server may grant without chain tx when AllowDevGrantWithoutChainTx
        });
    };

    return (
        <OlympiaDialogShell
            id="cash-shop-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(ev) => {
                ev.preventDefault();
                setCashShopOpen(false);
            }}
            width={460}
            minHeight={440}
            bgSpriteKey={LEVELSET_DIALOG_BG}
            rootClassName="cash-shop-dialog-root"
        >
            <div className="olympia-dialog-title-bar">Cash Shop — {npcName}</div>
            <div style={{ padding: '8px 12px', fontFamily: 'Tahoma, sans-serif', fontSize: 13 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <button
                        type="button"
                        onPointerDown={stopBubble}
                        onClick={(e) => {
                            stopBubble(e);
                            setCashShopMarket('stablecoin');
                        }}
                        style={{
                            flex: 1,
                            fontWeight: market === 'stablecoin' ? 700 : 400,
                            background: market === 'stablecoin' ? '#2a5a2a' : '#333',
                            color: '#eee',
                            border: '1px solid #888',
                            padding: '6px',
                            cursor: 'pointer',
                        }}
                    >
                        USDT / USDC
                    </button>
                    <button
                        type="button"
                        onPointerDown={stopBubble}
                        onClick={(e) => {
                            stopBubble(e);
                            setCashShopMarket('hell');
                        }}
                        style={{
                            flex: 1,
                            fontWeight: market === 'hell' ? 700 : 400,
                            background: market === 'hell' ? '#5a2a2a' : '#333',
                            color: '#eee',
                            border: '1px solid #888',
                            padding: '6px',
                            cursor: 'pointer',
                        }}
                    >
                        $HELL Market
                    </button>
                </div>

                <p style={{ margin: '0 0 8px', color: '#ccc', fontSize: 12 }}>
                    {market === 'stablecoin'
                        ? 'List prices in USDT (or USDC). Bound gear is stablecoin-only.'
                        : '$HELL market (design FDV +20%). Gear may be stable-only.'}
                </p>

                {market === 'stablecoin' && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <button
                            type="button"
                            onPointerDown={stopBubble}
                            onClick={(e) => {
                                stopBubble(e);
                                setCashShopStablecoinMint(GENUINE_STABLECOIN_MINTS.mainnet.USDC);
                            }}
                            style={{
                                flex: 1,
                                background:
                                    stablecoinMint === GENUINE_STABLECOIN_MINTS.mainnet.USDC
                                        ? '#1a4a6a'
                                        : '#333',
                                color: '#eee',
                                border: '1px solid #666',
                                padding: 4,
                                cursor: 'pointer',
                            }}
                        >
                            USDC
                        </button>
                        <button
                            type="button"
                            onPointerDown={stopBubble}
                            onClick={(e) => {
                                stopBubble(e);
                                setCashShopStablecoinMint(GENUINE_STABLECOIN_MINTS.mainnet.USDT);
                            }}
                            style={{
                                flex: 1,
                                background:
                                    stablecoinMint === GENUINE_STABLECOIN_MINTS.mainnet.USDT
                                        ? '#1a4a6a'
                                        : '#333',
                                color: '#eee',
                                border: '1px solid #666',
                                padding: 4,
                                cursor: 'pointer',
                            }}
                        >
                            USDT
                        </button>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                    {CASH_SHOP_CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            onPointerDown={stopBubble}
                            onClick={(e) => {
                                stopBubble(e);
                                setCashShopCategory(cat.id);
                            }}
                            style={{
                                flex: '1 1 18%',
                                minWidth: 68,
                                textTransform: 'capitalize',
                                background: category === cat.id ? '#4a4a20' : '#2a2a2a',
                                color: '#ddd',
                                border: '1px solid #666',
                                padding: 4,
                                cursor: 'pointer',
                            }}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                <div style={{ marginBottom: 8 }}>
                    Qty:{' '}
                    <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                        −
                    </button>{' '}
                    <strong>{qty}</strong>{' '}
                    <button type="button" onClick={() => setQty((q) => Math.min(20, q + 1))}>
                        +
                    </button>
                </div>

                <div
                    style={{
                        maxHeight: 220,
                        overflowY: 'auto',
                        border: '1px solid #555',
                        padding: 4,
                        background: 'rgba(0,0,0,0.35)',
                    }}
                >
                    {rows.length === 0 ? (
                        <div style={{ padding: 12, color: '#aaa', fontSize: 12 }}>
                            No products in this tab for $HELL. Switch to Stablecoin Market for
                            shoes / boots / capes / seals.
                        </div>
                    ) : (
                        rows.map((sku) => {
                            const hellOk = skuAcceptsHell(sku);
                            const price =
                                market === 'hell'
                                    ? `${sku.priceHell * qty} $HELL`
                                    : `${formatStablePrice(sku.priceStableUsdCents * qty)}`;
                            const alt =
                                market === 'hell'
                                    ? `(vs ${formatStablePrice(sku.priceStableUsdCents * qty)} stable)`
                                    : hellOk
                                      ? `(or ${sku.priceHell * qty} $HELL)`
                                      : '(stablecoin only)';
                            const icon = skuIconUrl(sku);
                            return (
                                <div
                                    key={sku.skuId}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '4px 2px',
                                        borderBottom: '1px solid #333',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 32,
                                            height: 32,
                                            flex: '0 0 32px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            imageRendering: 'pixelated',
                                        }}
                                    >
                                        {icon ? (
                                            <img
                                                src={icon}
                                                alt=""
                                                width={28}
                                                height={28}
                                                draggable={false}
                                                style={{ imageRendering: 'pixelated', objectFit: 'contain' }}
                                            />
                                        ) : (
                                            <span style={{ color: '#666', fontSize: 14 }}>?</span>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, color: '#f0e6c8' }}>
                                        <div>{sku.name}</div>
                                        <div style={{ fontSize: 11, color: '#9ab' }}>
                                            {price}{' '}
                                            <span style={{ color: '#888' }}>{alt}</span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onPointerDown={stopBubble}
                                        onClick={(e) => {
                                            stopBubble(e);
                                            buy(sku);
                                        }}
                                        style={{
                                            background: '#3a5a3a',
                                            color: '#fff',
                                            border: '1px solid #8a8',
                                            padding: '4px 10px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Buy
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>

                <div role="status" style={{ marginTop: 8, minHeight: 32, color: '#cde' }}>
                    {statusMessage}
                </div>
                <p style={{ fontSize: 11, color: '#888', margin: '6px 0 0' }}>
                    Right-click closes. Fake mints rejected. Boosts soulbound. Seals &amp; single
                    boosts = USDC/USDT only; combos, stones &amp; utility (Zem, greens, balls) also
                    $HELL.
                </p>
            </div>
        </OlympiaDialogShell>
    );
}
