/**
 * Marketplace side door — public search, mobile buy orders, delivery desk.
 *
 * Flow: landing/Discord/in-game Grok → search → quote → reserve → pay (USDC/$HELL) → desk → claim in-game.
 * Combat tools intentionally absent. Grok 4.1 Fast (or static NL) builds orders only.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { verifyToken } = require('./auth');

const COMMISSION_PERCENT = Number(process.env.MARKET_FEE_PERCENT || 5);
const RESERVE_TTL_MS = Number(process.env.MARKET_RESERVE_TTL_MS || 15 * 60 * 1000);
const ORDER_TTL_MS = Number(process.env.MARKET_ORDER_TTL_MS || 20 * 60 * 1000);
// Default LIVE for launch safety. Local soft pay: MARKET_PAY_MODE=dev AND ALLOW_MARKET_DEV_PAY=1.
const PAY_MODE = (process.env.MARKET_PAY_MODE || 'live').toLowerCase(); // dev | live
const ALLOW_DEV_PAY =
  PAY_MODE === 'dev' &&
  (process.env.ALLOW_MARKET_DEV_PAY === '1' || process.env.ALLOW_MARKET_DEV_PAY === 'true');
const TREASURY = (process.env.MARKET_TREASURY_WALLET || '').trim();
const SYNC_SECRET = (process.env.MARKET_SYNC_SECRET || process.env.REALM_STATS_SECRET || '').trim();
// Default require wallet auth on paid routes (set MARKET_REQUIRE_AUTH=0 only for local demos).
const REQUIRE_AUTH = process.env.MARKET_REQUIRE_AUTH !== '0' && process.env.MARKET_REQUIRE_AUTH !== 'false';
/** @type {Set<string>} */
const usedPaySignatures = new Set();
const DATA_DIR = process.env.MARKET_DATA_DIR || path.join(__dirname, 'data');
const PERSIST_PATH = path.join(DATA_DIR, 'market-state.json');
const AUCTION_JSON = process.env.AUCTION_BOARD_JSON || '';

/** @type {Map<string, object>} */
const listings = new Map();
/** @type {Map<string, object>} */
const orders = new Map();
/** @type {Map<string, object>} */
const deskClaims = new Map();

const ALIASES = [
  { re: /merien\s*stone|stone\s*of\s*merien|piedra\s*merien/i, itemIds: [657], names: ['StoneOfMerien', 'Stone of Merien'] },
  { re: /xelima\s*stone|stone\s*of\s*xelima|piedra\s*xelima/i, itemIds: [656], names: ['StoneOfXelima', 'Stone of Xelima'] },
  { re: /merien\s*plate|plate\s*mail\s*merien/i, itemIds: [621, 622], names: ['MerienPlateMailM', 'MerienPlateMailW'] },
  { re: /merien\s*shield/i, itemIds: [620], names: ['MerienShield'] },
  { re: /devastator/i, itemIds: [761], names: ['Devastator'] },
  { re: /gold|oro/i, itemIds: [90], names: ['Gold'] },
];

function now() {
  return Date.now();
}

function uid(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function ensureDataDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
}

function persist() {
  ensureDataDir();
  const payload = {
    listings: [...listings.values()],
    orders: [...orders.values()],
    deskClaims: [...deskClaims.values()],
    savedAt: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(PERSIST_PATH + '.tmp', JSON.stringify(payload, null, 2));
    fs.copyFileSync(PERSIST_PATH + '.tmp', PERSIST_PATH);
    fs.unlinkSync(PERSIST_PATH + '.tmp');
  } catch (e) {
    console.warn('[market] persist failed', e.message);
  }
}

function loadPersist() {
  try {
    if (!fs.existsSync(PERSIST_PATH)) return false;
    const raw = JSON.parse(fs.readFileSync(PERSIST_PATH, 'utf8'));
    for (const l of raw.listings || []) {
      if (l?.listingId) listings.set(l.listingId, l);
    }
    for (const o of raw.orders || []) {
      if (o?.orderId) orders.set(o.orderId, o);
    }
    for (const c of raw.deskClaims || []) {
      if (c?.claimId) deskClaims.set(c.claimId, c);
    }
    console.log(
      `[market] loaded state listings=${listings.size} orders=${orders.size} desk=${deskClaims.size}`,
    );
    return listings.size > 0;
  } catch (e) {
    console.warn('[market] load failed', e.message);
    return false;
  }
}

function seedDemoListings() {
  if (listings.size > 0) return;
  const t = now();
  const demo = [
    {
      listingId: 'demo_merien_1',
      itemId: 657,
      itemName: 'Stone of Merien',
      quantity: 5,
      listPriceGold: 500,
      priceUsdc: 2.5,
      priceHell: 0,
      sellerName: 'DemoSeller',
      sellerWallet: 'DemoSeller1111111111111111111111111',
      sellerCity: 'Aresden',
      mode: 'limit',
      status: 'active',
      source: 'seed',
      createdAtMs: t,
      expiresAtMs: t + 7 * 86400000,
    },
    {
      listingId: 'demo_merien_2',
      itemId: 657,
      itemName: 'Stone of Merien',
      quantity: 1,
      listPriceGold: 120,
      priceUsdc: 0.6,
      priceHell: 0,
      sellerName: 'StoneBroker',
      sellerWallet: 'DemoSeller2222222222222222222222222',
      sellerCity: 'Elvine',
      mode: 'limit',
      status: 'active',
      source: 'seed',
      createdAtMs: t,
      expiresAtMs: t + 7 * 86400000,
    },
    {
      listingId: 'demo_merien_3',
      itemId: 657,
      itemName: 'Stone of Merien',
      quantity: 10,
      listPriceGold: 900,
      priceUsdc: 4.5,
      priceHell: 0,
      sellerName: 'BulkAH',
      sellerWallet: 'DemoSeller3333333333333333333333333',
      sellerCity: 'Aresden',
      mode: 'limit',
      status: 'active',
      source: 'seed',
      createdAtMs: t,
      expiresAtMs: t + 7 * 86400000,
    },
    {
      listingId: 'demo_xelima_1',
      itemId: 656,
      itemName: 'Stone of Xelima',
      quantity: 3,
      listPriceGold: 600,
      priceUsdc: 3.0,
      priceHell: 0,
      sellerName: 'FireVendor',
      sellerWallet: 'DemoSeller4444444444444444444444444',
      sellerCity: 'Elvine',
      mode: 'limit',
      status: 'active',
      source: 'seed',
      createdAtMs: t,
      expiresAtMs: t + 7 * 86400000,
    },
    {
      listingId: 'demo_shield_1',
      itemId: 620,
      itemName: 'Merien Shield',
      quantity: 1,
      listPriceGold: 5000,
      priceUsdc: 25,
      priceHell: 0,
      sellerName: 'TankShop',
      sellerWallet: 'DemoSeller5555555555555555555555555',
      sellerCity: 'Aresden',
      mode: 'limit',
      status: 'active',
      source: 'seed',
      createdAtMs: t,
      expiresAtMs: t + 7 * 86400000,
    },
  ];
  for (const l of demo) listings.set(l.listingId, l);
  console.log('[market] seeded demo listings', demo.length);
  persist();
}

function importAuctionBoardJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return 0;
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const arr = raw.listings || raw.Listings || [];
    let n = 0;
    for (const L of arr) {
      const status = (L.status || L.Status || '').toLowerCase();
      if (status && status !== 'active') continue;
      const listingId = L.listingId || L.ListingId;
      if (!listingId) continue;
      const itemId = Number(L.itemId ?? L.ItemId ?? 0);
      const qty = Number(L.quantity ?? L.Quantity ?? 1);
      const gold = Number(L.listPriceGold ?? L.ListPriceGold ?? L.minBidGold ?? L.MinBidGold ?? 0);
      const itemName = L.itemName || L.ItemName || `Item ${itemId}`;
      // Rough USDC quote from gold for mobile rail (config override later)
      const priceUsdc = Number(L.priceUsdc) || Math.max(0.05, Math.round((gold / 200) * 100) / 100);
      listings.set(listingId, {
        listingId,
        itemId,
        itemName,
        quantity: qty,
        listPriceGold: gold,
        priceUsdc,
        priceHell: Number(L.priceHell || 0),
        sellerName: L.sellerName || L.SellerName || '?',
        sellerWallet: L.sellerWallet || L.SellerWallet || '',
        sellerCity: L.sellerCity || L.SellerCity || '',
        mode: (L.mode || L.Mode || 'limit').toString().toLowerCase(),
        status: 'active',
        source: 'game-auction',
        createdAtMs: Number(L.createdAtMs ?? L.CreatedAtMs ?? now()),
        expiresAtMs: Number(L.expiresAtMs ?? L.ExpiresAtMs ?? 0),
        itemAttribute: L.itemAttribute ?? L.ItemAttribute,
        itemColor: L.itemColor ?? L.ItemColor,
        curLifeSpan: L.curLifeSpan ?? L.CurLifeSpan,
        maxLifeSpan: L.maxLifeSpan ?? L.MaxLifeSpan,
        itemUid: L.itemUid ?? L.ItemUid,
      });
      n++;
    }
    if (n) {
      console.log(`[market] imported ${n} listings from auction board JSON`);
      persist();
    }
    return n;
  } catch (e) {
    console.warn('[market] auction import failed', e.message);
    return 0;
  }
}

function expireStale() {
  const t = now();
  for (const o of orders.values()) {
    if (o.status === 'reserved' || o.status === 'quoted' || o.status === 'awaiting_payment') {
      if (o.expiresAtMs && t > o.expiresAtMs) {
        releaseOrderReservations(o);
        o.status = 'expired';
      }
    }
  }
  for (const l of listings.values()) {
    if (l.status === 'reserved' && l.reserveExpiresAtMs && t > l.reserveExpiresAtMs) {
      l.status = 'active';
      delete l.reservedByOrderId;
      delete l.reserveExpiresAtMs;
    }
  }
}

function releaseOrderReservations(order) {
  const fills = order.plan?.fills || order.fills || [];
  for (const fill of fills) {
    const l = listings.get(fill.listingId);
    if (l && (l.reservedByOrderId === order.orderId || l.status === 'reserved')) {
      l.status = 'active';
      delete l.reservedByOrderId;
      delete l.reserveExpiresAtMs;
    }
  }
}

function publicListing(l) {
  return {
    listingId: l.listingId,
    itemId: l.itemId,
    itemName: l.itemName,
    quantity: l.quantity,
    listPriceGold: l.listPriceGold,
    priceUsdc: l.priceUsdc,
    priceHell: l.priceHell || 0,
    unitUsdc: l.quantity > 0 ? Math.round((l.priceUsdc / l.quantity) * 10000) / 10000 : l.priceUsdc,
    sellerName: l.sellerName,
    sellerCity: l.sellerCity,
    mode: l.mode,
    status: l.status,
    source: l.source,
    expiresAtMs: l.expiresAtMs,
    createdAtMs: l.createdAtMs,
  };
}

function matchQuery(q) {
  const query = String(q || '').trim();
  if (!query) return { itemIds: null, text: '' };
  for (const a of ALIASES) {
    if (a.re.test(query)) {
      return { itemIds: new Set(a.itemIds), text: query, aliasNames: a.names };
    }
  }
  return { itemIds: null, text: query };
}

function searchListings({ q, maxUsdc, minUsdc, city, limit = 40, status = 'active' }) {
  expireStale();
  const { itemIds, text } = matchQuery(q);
  const lim = Math.min(100, Math.max(1, Number(limit) || 40));
  let rows = [...listings.values()].filter((l) => {
    if (status === 'active') {
      if (l.status !== 'active' && l.status !== 'reserved') return false;
    } else if (status && l.status !== status) return false;
    if (itemIds) {
      if (!itemIds.has(Number(l.itemId))) return false;
    } else if (text) {
      const hay = `${l.itemName} ${l.listingId} ${l.sellerName}`.toLowerCase();
      if (!hay.includes(text.toLowerCase())) return false;
    }
    if (city && String(l.sellerCity || '').toLowerCase() !== String(city).toLowerCase()) return false;
    if (maxUsdc != null && Number(l.priceUsdc) > Number(maxUsdc)) return false;
    if (minUsdc != null && Number(l.priceUsdc) < Number(minUsdc)) return false;
    return true;
  });
  rows.sort((a, b) => {
    const ua = a.quantity > 0 ? a.priceUsdc / a.quantity : a.priceUsdc;
    const ub = b.quantity > 0 ? b.priceUsdc / b.quantity : b.priceUsdc;
    return ua - ub;
  });
  return rows.slice(0, lim).map(publicListing);
}

/**
 * Greedy fill by cheapest unit USDC.
 */
function buildFillPlan({ q, qty, maxUnitUsdc, asset = 'USDC' }) {
  expireStale();
  const want = Math.max(1, Math.min(500, Number(qty) || 1));
  const maxU = maxUnitUsdc != null ? Number(maxUnitUsdc) : Infinity;
  const candidates = searchListings({ q, limit: 100, status: 'active' })
    .map((p) => listings.get(p.listingId))
    .filter((l) => l && l.status === 'active')
    .filter((l) => {
      const unit = l.quantity > 0 ? l.priceUsdc / l.quantity : l.priceUsdc;
      return unit <= maxU + 1e-9;
    })
    .sort((a, b) => {
      const ua = a.quantity > 0 ? a.priceUsdc / a.quantity : a.priceUsdc;
      const ub = b.quantity > 0 ? b.priceUsdc / b.quantity : b.priceUsdc;
      return ua - ub;
    });

  const fills = [];
  let remaining = want;
  let subtotal = 0;
  for (const l of candidates) {
    if (remaining <= 0) break;
    const avail = Math.max(1, Number(l.quantity) || 1);
    const take = Math.min(avail, remaining);
    const unit = avail > 0 ? l.priceUsdc / avail : l.priceUsdc;
    const priceUsdc = Math.round(unit * take * 10000) / 10000;
    const goldUnit = avail > 0 ? (Number(l.listPriceGold) || 0) / avail : 0;
    fills.push({
      listingId: l.listingId,
      itemId: l.itemId,
      itemName: l.itemName,
      quantity: take,
      listingQty: avail,
      partialStack: take < avail,
      priceUsdc,
      unitUsdc: Math.round(unit * 10000) / 10000,
      listPriceGold: Math.max(0, Math.round(goldUnit * take)),
      sellerName: l.sellerName,
      sellerCity: l.sellerCity,
    });
    subtotal += priceUsdc;
    remaining -= take;
  }

  const fee = Math.round(subtotal * (COMMISSION_PERCENT / 100) * 10000) / 10000;
  const total = Math.round((subtotal + fee) * 10000) / 10000;
  return {
    query: q,
    requestedQty: want,
    filledQty: want - remaining,
    partial: remaining > 0,
    remainingQty: remaining,
    asset: asset.toUpperCase() === 'HELL' ? 'HELL' : 'USDC',
    fills,
    subtotalUsdc: Math.round(subtotal * 10000) / 10000,
    feePercent: COMMISSION_PERCENT,
    feeUsdc: fee,
    totalUsdc: total,
    treasury: TREASURY || null,
    payMode: PAY_MODE,
  };
}

function createOrder({ wallet, q, qty, maxUnitUsdc, asset, delivery = 'pickup_desk', partialOk = true }) {
  expireStale();
  const buyer = String(wallet || '').trim();
  if (!buyer || buyer.length < 32) {
    return { error: 'wallet required (Solana base58)', status: 400 };
  }
  const plan = buildFillPlan({ q, qty, maxUnitUsdc, asset });
  if (plan.filledQty <= 0) {
    return { error: 'No matching stock at that max unit price', status: 404, plan };
  }
  if (plan.partial && !partialOk) {
    return { error: `Only ${plan.filledQty}/${plan.requestedQty} available`, status: 409, plan };
  }

  const orderId = uid('ord');
  const expiresAtMs = now() + ORDER_TTL_MS;
  // Reserve listings (support partial stack: shrink active remainder + reserve fill qty)
  for (const f of plan.fills) {
    const l = listings.get(f.listingId);
    if (!l || l.status !== 'active') {
      releaseOrderReservations({ orderId, fills: plan.fills.filter((x) => x.listingId !== f.listingId) });
      return { error: 'Stock changed during reserve — retry', status: 409 };
    }
    if (f.quantity > l.quantity) {
      releaseOrderReservations({ orderId, fills: plan.fills.filter((x) => x.listingId !== f.listingId) });
      return { error: 'Stock changed during reserve — retry', status: 409 };
    }
    if (f.partialStack && f.quantity < l.quantity) {
      // Split: keep remainder active under new id; original listing becomes reserved fill
      const remainQty = l.quantity - f.quantity;
      const unitUsdc = l.quantity > 0 ? l.priceUsdc / l.quantity : l.priceUsdc;
      const unitGold = l.quantity > 0 ? (l.listPriceGold || 0) / l.quantity : 0;
      const remainId = `${l.listingId}_r${remainQty}_${crypto.randomBytes(3).toString('hex')}`;
      listings.set(remainId, {
        ...l,
        listingId: remainId,
        quantity: remainQty,
        priceUsdc: Math.round(unitUsdc * remainQty * 10000) / 10000,
        listPriceGold: Math.max(0, Math.round(unitGold * remainQty)),
        status: 'active',
        parentListingId: l.listingId,
        source: l.source || 'split',
      });
      l.quantity = f.quantity;
      l.priceUsdc = f.priceUsdc;
      l.listPriceGold = f.listPriceGold;
      l.splitRemainId = remainId;
    }
    l.status = 'reserved';
    l.reservedByOrderId = orderId;
    l.reserveExpiresAtMs = now() + RESERVE_TTL_MS;
    f.listingId = l.listingId;
  }

  const order = {
    orderId,
    buyerWallet: buyer,
    status: 'awaiting_payment',
    createdAtMs: now(),
    expiresAtMs,
    delivery: delivery === 'warehouse' ? 'warehouse' : 'pickup_desk',
    query: q,
    plan,
    payAsset: plan.asset,
    totalUsdc: plan.totalUsdc,
    txSignature: null,
    paidAtMs: null,
    claimIds: [],
  };
  orders.set(orderId, order);
  persist();
  return { order: publicOrder(order) };
}

function publicOrder(o) {
  return {
    orderId: o.orderId,
    buyerWallet: o.buyerWallet,
    status: o.status,
    createdAtMs: o.createdAtMs,
    expiresAtMs: o.expiresAtMs,
    delivery: o.delivery,
    query: o.query,
    plan: o.plan,
    payAsset: o.payAsset,
    totalUsdc: o.totalUsdc,
    treasury: TREASURY || null,
    payMode: PAY_MODE,
    payMemo: o.orderId,
    txSignature: o.txSignature,
    paidAtMs: o.paidAtMs,
    claimIds: o.claimIds,
    message:
      o.status === 'awaiting_payment'
        ? PAY_MODE === 'dev'
          ? 'Dev mode: POST /market/orders/:id/pay-dev with wallet auth to complete (or use landing Confirm).'
          : `Send ${o.totalUsdc} ${o.payAsset} to treasury with memo ${o.orderId}, then POST /market/orders/:id/confirm-pay`
        : o.status === 'paid'
          ? 'Paid. Items at Auction House delivery desk — claim in-game.'
          : o.status,
  };
}

function fulfillPaidOrder(order, txSignature) {
  const claimIds = [];
  for (const f of order.plan.fills) {
    const l = listings.get(f.listingId);
    if (l) {
      l.status = 'sold';
      l.soldAtMs = now();
      l.soldToWallet = order.buyerWallet;
      l.soldOrderId = order.orderId;
      delete l.reservedByOrderId;
      delete l.reserveExpiresAtMs;
    }
    const claimId = uid('claim');
    const claim = {
      claimId,
      orderId: order.orderId,
      buyerWallet: order.buyerWallet,
      listingId: f.listingId,
      itemId: f.itemId,
      itemName: f.itemName,
      quantity: f.quantity,
      listPriceGold: f.listPriceGold,
      delivery: order.delivery,
      status: 'ready',
      createdAtMs: now(),
      claimedAtMs: null,
      claimedCharacter: null,
    };
    deskClaims.set(claimId, claim);
    claimIds.push(claimId);
  }
  order.status = 'paid';
  order.paidAtMs = now();
  order.txSignature = txSignature || `dev_${order.orderId}`;
  order.claimIds = claimIds;
  persist();
  return order;
}

function payDev(orderId, wallet) {
  expireStale();
  const order = orders.get(orderId);
  if (!order) return { error: 'order not found', status: 404 };
  if (order.buyerWallet !== wallet) return { error: 'wallet mismatch', status: 403 };
  if (order.status === 'paid') return { order: publicOrder(order) };
  if (order.status !== 'awaiting_payment' && order.status !== 'reserved' && order.status !== 'quoted') {
    return { error: `order status ${order.status}`, status: 409 };
  }
  if (order.expiresAtMs && now() > order.expiresAtMs) {
    releaseOrderReservations(order);
    order.status = 'expired';
    persist();
    return { error: 'order expired', status: 410 };
  }
  if (!ALLOW_DEV_PAY) {
    return {
      error: 'pay-dev disabled (set MARKET_PAY_MODE=dev and ALLOW_MARKET_DEV_PAY=1 for local only)',
      status: 403,
    };
  }
  fulfillPaidOrder(order, `devpay_${Date.now()}`);
  return { order: publicOrder(order) };
}

function confirmPay(orderId, wallet, txSignature) {
  expireStale();
  const order = orders.get(orderId);
  if (!order) return { error: 'order not found', status: 404 };
  if (order.buyerWallet !== wallet) return { error: 'wallet mismatch', status: 403 };
  if (order.status === 'paid') return { order: publicOrder(order) };
  if (!txSignature || String(txSignature).length < 40) {
    return { error: 'txSignature required', status: 400 };
  }
  // Live mode: refuse unsigned free grants until RPC verifies SPL transfer to treasury.
  // Accepting any ≥40-char string was a free-item exploit.
  if (PAY_MODE === 'live' || !ALLOW_DEV_PAY) {
    return {
      error:
        'On-chain payment verification is not enabled yet — mobile market purchases are paused. Use in-game auction gold for now.',
      status: 503,
    };
  }
  const sig = String(txSignature);
  if (usedPaySignatures.has(sig)) {
    return { error: 'txSignature already used', status: 409 };
  }
  usedPaySignatures.add(sig);
  fulfillPaidOrder(order, sig);
  return { order: publicOrder(order) };
}

function deskForWallet(wallet) {
  expireStale();
  const w = String(wallet || '').trim();
  return [...deskClaims.values()]
    .filter((c) => c.buyerWallet === w && c.status === 'ready')
    .map((c) => ({
      claimId: c.claimId,
      orderId: c.orderId,
      itemId: c.itemId,
      itemName: c.itemName,
      quantity: c.quantity,
      delivery: c.delivery,
      status: c.status,
      createdAtMs: c.createdAtMs,
    }));
}

function claimDesk({ wallet, claimId, characterName, toWarehouse = false }) {
  const c = deskClaims.get(claimId);
  if (!c) return { error: 'claim not found', status: 404 };
  if (c.buyerWallet !== wallet) return { error: 'wallet mismatch', status: 403 };
  if (c.status !== 'ready') return { error: `claim ${c.status}`, status: 409 };
  c.status = 'claimed';
  c.claimedAtMs = now();
  c.claimedCharacter = characterName || '';
  c.toWarehouse = !!toWarehouse;
  persist();
  return {
    claim: {
      claimId: c.claimId,
      itemId: c.itemId,
      itemName: c.itemName,
      quantity: c.quantity,
      listPriceGold: c.listPriceGold,
      delivery: toWarehouse ? 'warehouse' : c.delivery,
      toWarehouse: !!toWarehouse,
    },
  };
}

/** Game server pulls claim payload and marks claimed atomically via secret. */
function gameClaimDesk({ secret, wallet, claimId, characterName, toWarehouse }) {
  if (!SYNC_SECRET || !timingSafeSecretEqual(secret, SYNC_SECRET)) {
    return { error: 'unauthorized', status: 401 };
  }
  return claimDesk({ wallet, claimId, characterName, toWarehouse });
}

function upsertListingsFromGame(body, secret) {
  if (!SYNC_SECRET || !timingSafeSecretEqual(secret, SYNC_SECRET)) {
    return { error: 'unauthorized', status: 401 };
  }
  const arr = body.listings || [];
  let n = 0;
  for (const L of arr) {
    if (!L.listingId) continue;
    const prev = listings.get(L.listingId);
    if (prev && (prev.status === 'reserved' || prev.status === 'sold')) {
      // Don't clobber mobile reserves/sales unless game says sold
      if (L.status === 'sold' || L.status === 'cancelled' || L.status === 'expired') {
        prev.status = L.status;
        n++;
      }
      continue;
    }
    listings.set(L.listingId, {
      ...(prev || {}),
      ...L,
      source: 'game-sync',
      priceUsdc:
        L.priceUsdc ??
        prev?.priceUsdc ??
        Math.max(0.05, Math.round(((Number(L.listPriceGold) || 0) / 200) * 100) / 100),
    });
    n++;
  }
  persist();
  return { ok: true, upserted: n, total: listings.size };
}

/**
 * Static NL advisor (no combat). Optional xAI upgrade via env in route handler.
 */
function staticAdvisor(message) {
  const text = String(message || '').trim();
  const es = /[áéíóúñ¿¡]|\b(busca|comprame|comprá|piedra|ofertas|cuanto)\b/i.test(text);

  // Block combat
  if (/\b(kill|mata|attack|atac|farm|hunt|mob|player|pk)\b/i.test(text)) {
    return {
      mode: 'refuse',
      reply: es
        ? 'No peleo ni farmeo por vos. Solo market, bag operativa y dudas del test.'
        : 'I do not fight or farm for you. Market ops and test help only.',
    };
  }

  // Buy intent — require price clause when present so non-greedy item name does not stop at 1 char
  const buy =
    text.match(
      /(?:buy|compr[aá]|comprame|order)\s+(\d+)\s+(.+?)\s+(?:at|a|max|≤|<=|under|por)\s*\$?\s*([\d.]+)\s*$/i,
    ) ||
    text.match(/(?:buy|compr[aá]|comprame|order)\s+(\d+)\s+(.+)$/i) ||
    text.match(/(\d+)\s+(.+?)\s+(?:at|a|max|≤|<=|under|por)\s*\$?\s*([\d.]+)\s*$/i);

  if (buy) {
    const qty = Number(buy[1]);
    const itemQ = buy[2]
      .replace(/\s+usdc.*$/i, '')
      .replace(/\s+(?:at|a|max|≤|<=|under|por)\s*\$?\s*[\d.]+\s*$/i, '')
      .trim();
    const maxUnit = buy[3] != null && buy[3] !== '' ? Number(buy[3]) : undefined;
    const plan = buildFillPlan({ q: itemQ, qty, maxUnitUsdc: maxUnit });
    return {
      mode: 'buy_plan',
      reply: es
        ? `Plan: **${plan.filledQty}/${plan.requestedQty}** × «${itemQ}» · subtotal **${plan.subtotalUsdc} USDC** + fee ${plan.feePercent}% = **${plan.totalUsdc} USDC**. ${plan.partial ? 'Stock parcial.' : 'Stock completo.'} Confirmá en landing/market o POST /market/orders.`
        : `Plan: **${plan.filledQty}/${plan.requestedQty}** × "${itemQ}" · subtotal **${plan.subtotalUsdc} USDC** + ${plan.feePercent}% fee = **${plan.totalUsdc} USDC**. ${plan.partial ? 'Partial stock.' : 'Full fill.'} Confirm on /market or POST /market/orders.`,
      plan,
      suggestedOrder: {
        q: itemQ,
        qty,
        maxUnitUsdc: maxUnit,
        asset: 'USDC',
        delivery: 'pickup_desk',
        partialOk: true,
      },
    };
  }

  // Search intent
  if (/busca|search|find|ofertas|listings|stock|market|merien|xelima|stone/i.test(text)) {
    const qMatch = text.match(/(?:busca(?:me)?|search|find|ofertas de|listings? (?:for|de)?)\s+(.+)/i);
    const q =
      (qMatch && qMatch[1]) ||
      ( /merien/i.test(text) ? 'merien stone' : /xelima/i.test(text) ? 'xelima stone' : text);
    const results = searchListings({ q, limit: 15 });
    const lines = results
      .slice(0, 8)
      .map(
        (r) =>
          `• ${r.quantity}× ${r.itemName} @ ${r.priceUsdc} USDC (${r.unitUsdc}/u) — ${r.sellerCity || '?'} · ${r.listingId}`,
      );
    return {
      mode: 'search',
      reply:
        (es ? `Encontré **${results.length}** ofertas:\n` : `Found **${results.length}** offers:\n`) +
        (lines.join('\n') || (es ? '(vacío)' : '(none)')),
      results,
    };
  }

  return {
    mode: 'help',
    reply: es
      ? 'Puedo **buscar** ofertas («buscame merien stones») o **armar compra** («comprame 10 merien stones a 0.6»). Pago wallet → **mesa de entrega** del AH. No combate.'
      : 'I can **search** offers ("find merien stones") or **build a buy** ("buy 10 merien stones at 0.6"). Wallet pay → **AH delivery desk**. No combat.',
  };
}

async function llmAdvisor(message, apiKey) {
  if (!apiKey) return staticAdvisor(message);
  const { chatCompletion, modelMarket } = require('./xaiUsage');
  const model = modelMarket();
  const system = `You are Chain Lords Market Advisor (cheap FAQ-tier Grok). Help with auction/marketplace only.
NO combat, farming, killing players/mobs, exploits, or investment advice.
Official site chainlords.net. Fee ${COMMISSION_PERCENT}% on marketplace. Delivery default: pickup desk.
Reply short EN or ES matching user. If user wants to buy, output a final JSON block:
{"action":"buy_plan","q":"item","qty":N,"maxUnitUsdc":number|null}
If search: {"action":"search","q":"..."}
If refuse: {"action":"refuse"}
Before JSON, one short human line.`;

  try {
    const { content } = await chatCompletion({
      apiKey,
      model,
      channel: 'market',
      system,
      user: message,
      temperature: 0.3,
      maxTokens: 400,
    });
    const jsonMatch = content.match(/\{[\s\S]*"action"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.action === 'search') {
        const results = searchListings({ q: parsed.q || message, limit: 15 });
        return {
          mode: 'search',
          reply: content.replace(jsonMatch[0], '').trim() || staticAdvisor(`search ${parsed.q}`).reply,
          results,
          llm: true,
          model,
        };
      }
      if (parsed.action === 'buy_plan') {
        const plan = buildFillPlan({
          q: parsed.q,
          qty: parsed.qty || 1,
          maxUnitUsdc: parsed.maxUnitUsdc,
        });
        return {
          mode: 'buy_plan',
          reply: content.replace(jsonMatch[0], '').trim() || staticAdvisor(message).reply,
          plan,
          suggestedOrder: {
            q: parsed.q,
            qty: parsed.qty || 1,
            maxUnitUsdc: parsed.maxUnitUsdc,
            asset: 'USDC',
            delivery: 'pickup_desk',
            partialOk: true,
          },
          llm: true,
          model,
        };
      }
      if (parsed.action === 'refuse') {
        return { mode: 'refuse', reply: content.replace(jsonMatch[0], '').trim(), llm: true, model };
      }
    }
    return { mode: 'llm', reply: content, llm: true, model };
  } catch (e) {
    console.warn('[market] llm fallback', e.message);
    return { ...staticAdvisor(message), llmFallback: true };
  }
}

function requireWallet(req) {
  const wallet = (req.body?.wallet || req.query?.wallet || req.headers['x-wallet'] || '').toString().trim();
  const token = (req.headers['x-auth-token'] || req.body?.token || '').toString().trim();
  if (!wallet) return { error: 'wallet required' };
  // If token present must verify always.
  if (token && !verifyToken(wallet, token)) {
    return { error: 'invalid auth token' };
  }
  // Default: require valid wallet auth token (disable only with MARKET_REQUIRE_AUTH=0).
  if (REQUIRE_AUTH && !verifyToken(wallet, token)) {
    return { error: 'auth required' };
  }
  return { wallet };
}

function timingSafeSecretEqual(a, b) {
  try {
    const ba = Buffer.from(String(a || ''));
    const bb = Buffer.from(String(b || ''));
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function registerMarketRoutes(app) {
  loadPersist();
  if (AUCTION_JSON) importAuctionBoardJson(AUCTION_JSON);
  seedDemoListings();

  // Optional poll import of game auction file
  if (AUCTION_JSON) {
    setInterval(() => {
      try {
        importAuctionBoardJson(AUCTION_JSON);
      } catch {
        /* ignore */
      }
    }, 30_000).unref?.();
  }

  app.get('/market/health', (_req, res) => {
    expireStale();
    res.json({
      ok: true,
      listings: listings.size,
      active: [...listings.values()].filter((l) => l.status === 'active').length,
      orders: orders.size,
      deskReady: [...deskClaims.values()].filter((c) => c.status === 'ready').length,
      payMode: PAY_MODE,
      feePercent: COMMISSION_PERCENT,
      treasury: TREASURY || null,
    });
  });

  app.get('/market/search', (req, res) => {
    const results = searchListings({
      q: req.query.q,
      maxUsdc: req.query.maxUsdc,
      minUsdc: req.query.minUsdc,
      city: req.query.city,
      limit: req.query.limit,
    });
    res.json({
      ok: true,
      q: req.query.q || '',
      count: results.length,
      feePercent: COMMISSION_PERCENT,
      results,
    });
  });

  app.get('/market/listings', (req, res) => {
    const results = searchListings({ q: '', limit: req.query.limit || 50 });
    res.json({ ok: true, count: results.length, results });
  });

  app.post('/market/quote', (req, res) => {
    const { q, qty, maxUnitUsdc, asset } = req.body || {};
    if (!q) return res.status(400).json({ error: 'q required' });
    const plan = buildFillPlan({ q, qty, maxUnitUsdc, asset });
    res.json({ ok: true, plan });
  });

  app.post('/market/orders', (req, res) => {
    const auth = requireWallet(req);
    if (auth.error) return res.status(400).json({ error: auth.error });
    const { q, qty, maxUnitUsdc, asset, delivery, partialOk } = req.body || {};
    if (!q) return res.status(400).json({ error: 'q required' });
    const result = createOrder({
      wallet: auth.wallet,
      q,
      qty,
      maxUnitUsdc,
      asset,
      delivery,
      partialOk: partialOk !== false,
    });
    if (result.error) return res.status(result.status || 400).json(result);
    res.json({ ok: true, ...result });
  });

  app.get('/market/orders/:id', (req, res) => {
    const order = orders.get(req.params.id);
    if (!order) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true, order: publicOrder(order) });
  });

  app.post('/market/orders/:id/pay-dev', (req, res) => {
    const auth = requireWallet(req);
    if (auth.error) return res.status(400).json({ error: auth.error });
    const result = payDev(req.params.id, auth.wallet);
    if (result.error) return res.status(result.status || 400).json(result);
    res.json({ ok: true, ...result });
  });

  app.post('/market/orders/:id/confirm-pay', (req, res) => {
    const auth = requireWallet(req);
    if (auth.error) return res.status(400).json({ error: auth.error });
    const result = confirmPay(req.params.id, auth.wallet, req.body?.txSignature);
    if (result.error) return res.status(result.status || 400).json(result);
    res.json({ ok: true, ...result });
  });

  app.get('/market/desk/:wallet', (req, res) => {
    const claims = deskForWallet(req.params.wallet);
    res.json({ ok: true, wallet: req.params.wallet, claims });
  });

  app.post('/market/desk/claim', (req, res) => {
    const auth = requireWallet(req);
    if (auth.error) return res.status(400).json({ error: auth.error });
    const result = claimDesk({
      wallet: auth.wallet,
      claimId: req.body?.claimId,
      characterName: req.body?.characterName,
      toWarehouse: req.body?.toWarehouse,
    });
    if (result.error) return res.status(result.status || 400).json(result);
    res.json({ ok: true, ...result });
  });

  /** Game server authoritative claim (secret). */
  app.post('/market/game/desk-claim', (req, res) => {
    const result = gameClaimDesk({
      secret: (req.headers['x-market-sync-secret'] || req.body?.secret || '').toString(),
      wallet: req.body?.wallet,
      claimId: req.body?.claimId,
      characterName: req.body?.characterName,
      toWarehouse: req.body?.toWarehouse,
    });
    if (result.error) return res.status(result.status || 400).json(result);
    res.json({ ok: true, ...result });
  });

  app.get('/market/game/desk/:wallet', (req, res) => {
    const secret = (req.headers['x-market-sync-secret'] || req.query.secret || '').toString();
    if (!SYNC_SECRET || !timingSafeSecretEqual(secret, SYNC_SECRET)) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    res.json({ ok: true, claims: deskForWallet(req.params.wallet) });
  });

  app.post('/market/game/sync-listings', (req, res) => {
    const secret = (req.headers['x-market-sync-secret'] || req.body?.secret || '').toString();
    const result = upsertListingsFromGame(req.body || {}, secret);
    if (result.error) return res.status(result.status || 401).json(result);
    res.json(result);
  });

  app.post('/market/advisor', async (req, res) => {
    const message = (req.body?.message || req.body?.text || '').toString();
    if (!message.trim()) return res.status(400).json({ error: 'message required' });
    const apiKey = (process.env.XAI_API_KEY || '').trim();
    const out = await llmAdvisor(message, apiKey.length > 8 ? apiKey : '');
    res.json({ ok: true, ...out });
  });

  console.log('✅ Market side door: GET /market/search, POST /market/orders, /market/advisor, desk claims');
}

module.exports = {
  registerMarketRoutes,
  searchListings,
  buildFillPlan,
  staticAdvisor,
};
