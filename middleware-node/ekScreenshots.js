/**
 * In-memory EK screenshot gallery stub (MVP).
 * POST accepts base64 JPEG + metadata; GET lists entries for the landing gallery.
 */

const MAX_ENTRIES = 200;
const entries = [];

function rarityFromRank(rank) {
  if (rank == null || !Number.isFinite(Number(rank)) || Number(rank) < 1) return 'unspecified';
  const r = Number(rank);
  if (r <= 10) return 'legendary';
  if (r <= 50) return 'rare';
  if (r <= 200) return 'common';
  return 'unspecified';
}

function registerEkScreenshotRoutes(app) {
  app.get('/ek-screenshots', (req, res) => {
    const rarity = String(req.query.rarity || '').toLowerCase();
    let list = entries;
    if (rarity && rarity !== 'all') {
      list = entries.filter((e) => e.rarity === rarity);
    }
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 48));
    res.json({
      ok: true,
      count: list.length,
      rarityRules: {
        legendary: 'opposing-city killer rank 1-10',
        rare: '11-50',
        common: '51-200',
      },
      items: list.slice(0, limit).map((e) => ({
        id: e.id,
        fileName: e.fileName,
        victimName: e.victimName,
        killerName: e.killerName,
        mapName: e.mapName,
        victimCityKillerRank: e.victimCityKillerRank,
        rarity: e.rarity,
        capturedAtMs: e.capturedAtMs,
        imageUrl: `/ek-screenshots/${e.id}/image`,
      })),
    });
  });

  app.get('/ek-screenshots/:id/image', (req, res) => {
    const entry = entries.find((e) => e.id === req.params.id);
    if (!entry) {
      res.status(404).json({ ok: false, error: 'not_found' });
      return;
    }
    const buf = Buffer.from(entry.imageBase64, 'base64');
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.send(buf);
  });

  app.post('/ek-screenshots', (req, res) => {
    const body = req.body || {};
    const imageBase64 = String(body.imageBase64 || '');
    if (!imageBase64 || imageBase64.length < 32) {
      res.status(400).json({ ok: false, error: 'imageBase64_required' });
      return;
    }
    const rank = body.victimCityKillerRank != null ? Number(body.victimCityKillerRank) : undefined;
    let rarity = String(body.rarity || '').toLowerCase();
    if (!['common', 'rare', 'legendary'].includes(rarity)) {
      rarity = rarityFromRank(rank);
    }
    const id = `ek_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const entry = {
      id,
      fileName: String(body.fileName || `${body.victimName || 'unknown'}_000.jpg`),
      victimName: String(body.victimName || ''),
      victimPlayerId: String(body.victimPlayerId || ''),
      killerName: String(body.killerName || ''),
      mapName: String(body.mapName || ''),
      victimCityKillerRank: Number.isFinite(rank) ? rank : undefined,
      rarity,
      capturedAtMs: Number(body.capturedAtMs) || Date.now(),
      imageBase64,
    };
    entries.unshift(entry);
    if (entries.length > MAX_ENTRIES) {
      entries.length = MAX_ENTRIES;
    }
    res.status(201).json({
      ok: true,
      id: entry.id,
      rarity: entry.rarity,
      imageUrl: `/ek-screenshots/${entry.id}/image`,
    });
  });
}

module.exports = { registerEkScreenshotRoutes };
