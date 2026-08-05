const { getPool } = require('./persistence');
const { requireWalletToken } = require('./auth');

const DECAY_GRACE_DAYS = 28;
const DECAY_POINTS_PER_WEEK = 25;
const DECAY_FLOOR = 1000;
const CHAMPION_BONUS = 100;
const FINALIST_BONUS = 50;
const DEFAULT_ARENA_WORLD = 'colosseum';

/** Express middleware: when ADMIN_API_KEY is set, require matching X-Admin-Key header. */
function requireAdmin(req, res, next) {
    const expected = process.env.ADMIN_API_KEY?.trim();
    if (!expected) {
        next();
        return;
    }

    const provided = String(req.headers['x-admin-key'] || '').trim();
    if (provided !== expected) {
        res.status(401).json({ success: false, error: 'Admin key required or invalid' });
        return;
    }

    next();
}

function requireDb(res) {
    const db = getPool();
    if (!db) {
        res.status(503).json({ success: false, error: 'PostgreSQL not configured' });
        return null;
    }
    return db;
}

/** Lazy ATP-style inactivity decay: −25/week after 28 idle days, floor 1000. */
function applyLazyDecay(rating, lastMatchAt) {
    const raw = Number(rating) || 1200;
    if (!lastMatchAt) {
        return Math.max(DECAY_FLOOR, raw);
    }

    const idleMs = Date.now() - new Date(lastMatchAt).getTime();
    if (!Number.isFinite(idleMs) || idleMs <= 0) {
        return raw;
    }

    const idleDays = idleMs / (24 * 60 * 60 * 1000);
    if (idleDays <= DECAY_GRACE_DAYS) {
        return raw;
    }

    const weeksBeyond = Math.floor((idleDays - DECAY_GRACE_DAYS) / 7);
    return Math.max(DECAY_FLOOR, raw - weeksBeyond * DECAY_POINTS_PER_WEEK);
}

/**
 * Persists inactivity decay into `pvp_ratings` + `rating_events` for rows whose stored rating
 * is above the lazy-decayed value. Safe to run periodically; no-op when Postgres is unset.
 * @returns {{ scanned: number, updated: number, totalDelta: number }}
 */
async function persistInactivityDecay(db) {
    const { rows } = await db.query(
        `SELECT wallet, mode, display_name, rating, last_match_at
         FROM pvp_ratings
         WHERE rating > $1`,
        [DECAY_FLOOR],
    );

    let updated = 0;
    let totalDelta = 0;
    for (const row of rows) {
        const raw = Number(row.rating);
        const decayed = applyLazyDecay(raw, row.last_match_at);
        const delta = decayed - raw;
        if (delta >= 0) {
            continue;
        }

        await db.query(
            `UPDATE pvp_ratings
             SET rating = $1, last_decay_at = NOW()
             WHERE wallet = $2 AND mode = $3`,
            [decayed, row.wallet, row.mode],
        );
        await db.query(
            `INSERT INTO rating_events (wallet, mode, delta, rating_after, reason)
             VALUES ($1, $2, $3, $4, 'inactivity_decay')`,
            [row.wallet, row.mode, delta, decayed],
        );
        updated += 1;
        totalDelta += delta;
    }

    return { scanned: rows.length, updated, totalDelta };
}

/**
 * Starts a background timer that persists Elo inactivity decay.
 * Interval defaults to 1h; override with DECAY_JOB_INTERVAL_MS (min 60s). Set 0 to disable.
 * @returns {NodeJS.Timeout | null}
 */
function startEloDecayJob() {
    const rawInterval = process.env.DECAY_JOB_INTERVAL_MS;
    const intervalMs = rawInterval === undefined || rawInterval === ''
        ? 60 * 60 * 1000
        : Number.parseInt(String(rawInterval), 10);
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
        console.log('[tournaments] Elo decay job disabled (DECAY_JOB_INTERVAL_MS<=0)');
        return null;
    }

    const safeInterval = Math.max(60_000, intervalMs);
    console.log(`[tournaments] Elo decay job every ${Math.round(safeInterval / 1000)}s (lazy read-path still applies)`);

    const tick = async () => {
        const db = getPool();
        if (!db) {
            return;
        }
        try {
            const result = await persistInactivityDecay(db);
            if (result.updated > 0) {
                console.log(
                    `[tournaments] Elo decay: updated ${result.updated}/${result.scanned} ratings (Δ ${result.totalDelta})`,
                );
            }
        } catch (error) {
            console.error('[tournaments] Elo decay job failed:', error);
        }
    };

    // First pass shortly after boot so idle ratings catch up without waiting a full interval.
    setTimeout(() => {
        void tick();
    }, 15_000);

    return setInterval(() => {
        void tick();
    }, safeInterval);
}

function nextPowerOfTwo(n) {
    let p = 1;
    while (p < n) {
        p *= 2;
    }
    return p;
}

function entryKey(format, participant) {
    if (format === 'team') {
        return participant.team_name || participant.wallet;
    }
    return participant.wallet;
}

async function seedParticipants(db, tournamentId, format, mode) {
    const { rows: participants } = await db.query(
        `SELECT tp.*, COALESCE(pr.rating, 1200) AS rating
         FROM tournament_participants tp
         LEFT JOIN pvp_ratings pr ON pr.wallet = tp.wallet AND pr.mode = $2
         WHERE tp.tournament_id = $1
         ORDER BY COALESCE(pr.rating, 1200) DESC, tp.created_at ASC`,
        [tournamentId, mode],
    );

    if (format === 'team') {
        const byTeam = new Map();
        for (const p of participants) {
            const key = p.team_name || p.wallet;
            const existing = byTeam.get(key);
            if (!existing || Number(p.rating) > Number(existing.rating)) {
                byTeam.set(key, p);
            }
        }
        const teams = [...byTeam.values()].sort((a, b) => Number(b.rating) - Number(a.rating));
        for (let i = 0; i < teams.length; i++) {
            await db.query(
                `UPDATE tournament_participants SET seed = $1
                 WHERE tournament_id = $2 AND team_name IS NOT DISTINCT FROM $3`,
                [i + 1, tournamentId, teams[i].team_name],
            );
        }
        return teams.map((t, i) => ({ ...t, seed: i + 1, entry: entryKey('team', t) }));
    }

    for (let i = 0; i < participants.length; i++) {
        await db.query(
            `UPDATE tournament_participants SET seed = $1 WHERE id = $2`,
            [i + 1, participants[i].id],
        );
        participants[i].seed = i + 1;
        participants[i].entry = entryKey('solo', participants[i]);
    }
    return participants;
}

/**
 * Tennis / ATP-style seed order for a bracket of `size` (power of 2).
 * Recursive pairing keeps #1 and #2 in opposite halves, #3/#4 in different quarters, etc.
 * Example size 8 → [1,8,4,5,2,7,3,6] so R1 is 1v8, 4v5, 2v7, 3v6.
 */
function tennisSeedOrder(size) {
    let order = [1, 2];
    while (order.length < size) {
        const m = order.length * 2;
        const next = [];
        for (const s of order) {
            next.push(s);
            next.push(m + 1 - s);
        }
        order = next;
    }
    return order;
}

/**
 * Place ranked entries into a tennis bracket, then pair adjacent slots for R1.
 * entries must already be sorted best→worst (seed 1 = index 0).
 * Empty slots become byes (null).
 */
function buildRoundOneSlots(entries) {
    const size = nextPowerOfTwo(Math.max(2, entries.length));
    const seedOrder = tennisSeedOrder(size);
    const bySeed = new Map();
    entries.forEach((e, i) => {
        bySeed.set(i + 1, e);
    });

    const bracket = new Array(size).fill(null);
    for (let pos = 0; pos < size; pos++) {
        const seedNum = seedOrder[pos];
        if (bySeed.has(seedNum)) {
            bracket[pos] = bySeed.get(seedNum);
        }
    }

    const slots = [];
    for (let i = 0; i < size; i += 2) {
        slots.push({
            entryA: bracket[i]?.entry ?? null,
            entryB: bracket[i + 1]?.entry ?? null,
            seedA: bracket[i] ? (entries.indexOf(bracket[i]) + 1) : null,
            seedB: bracket[i + 1] ? (entries.indexOf(bracket[i + 1]) + 1) : null,
        });
    }
    return slots;
}

/** Preview projected R1 matches without writing DB (for inscription page). */
function previewTennisBracket(entriesSorted) {
    const withEntry = entriesSorted.map((e, i) => ({
        ...e,
        entry: e.entry || e.team_name || e.wallet || `entry-${i}`,
        seed: i + 1,
    }));
    return buildRoundOneSlots(withEntry);
}

async function createBracket(db, tournamentId, entries) {
    await db.query(`DELETE FROM tournament_matches WHERE tournament_id = $1`, [tournamentId]);

    const roundOne = buildRoundOneSlots(entries);
    const totalRounds = Math.log2(roundOne.length * 2);
    const created = [];

    for (let position = 0; position < roundOne.length; position++) {
        const slot = roundOne[position];
        let winner = null;
        let status = 'pending';
        if (slot.entryA && !slot.entryB) {
            winner = slot.entryA;
            status = 'done';
        } else if (slot.entryB && !slot.entryA) {
            winner = slot.entryB;
            status = 'done';
        }

        const { rows } = await db.query(
            `INSERT INTO tournament_matches
                (tournament_id, round, position, entry_a, entry_b, winner, status, arena_world_id, reported_at)
             VALUES ($1, 1, $2, $3, $4, $5, $6, $7, CASE WHEN $6 = 'done' THEN NOW() ELSE NULL END)
             RETURNING *`,
            [tournamentId, position, slot.entryA, slot.entryB, winner, status, DEFAULT_ARENA_WORLD],
        );
        created.push(rows[0]);
    }

    let matchesInRound = roundOne.length / 2;
    for (let round = 2; round <= totalRounds; round++) {
        for (let position = 0; position < matchesInRound; position++) {
            const { rows } = await db.query(
                `INSERT INTO tournament_matches
                    (tournament_id, round, position, status, arena_world_id)
                 VALUES ($1, $2, $3, 'pending', $4)
                 RETURNING *`,
                [tournamentId, round, position, DEFAULT_ARENA_WORLD],
            );
            created.push(rows[0]);
        }
        matchesInRound /= 2;
    }

    // Advance automatic bye winners into round 2.
    for (const match of created.filter((m) => m.round === 1 && m.status === 'done' && m.winner)) {
        await advanceWinner(db, tournamentId, match);
    }

    const { rows: allMatches } = await db.query(
        `SELECT * FROM tournament_matches WHERE tournament_id = $1 ORDER BY round, position`,
        [tournamentId],
    );
    return allMatches;
}

async function advanceWinner(db, tournamentId, match) {
    const nextRound = match.round + 1;
    const nextPosition = Math.floor(match.position / 2);
    const { rows: nextRows } = await db.query(
        `SELECT * FROM tournament_matches
         WHERE tournament_id = $1 AND round = $2 AND position = $3
         LIMIT 1`,
        [tournamentId, nextRound, nextPosition],
    );
    const next = nextRows[0];
    if (!next) {
        return null;
    }

    const isA = match.position % 2 === 0;
    if (isA) {
        await db.query(`UPDATE tournament_matches SET entry_a = $1 WHERE id = $2`, [match.winner, next.id]);
    } else {
        await db.query(`UPDATE tournament_matches SET entry_b = $1 WHERE id = $2`, [match.winner, next.id]);
    }

    const { rows } = await db.query(`SELECT * FROM tournament_matches WHERE id = $1`, [next.id]);
    return rows[0] ?? null;
}

async function ensureRatingRow(db, wallet, mode, displayName) {
    await db.query(
        `INSERT INTO pvp_ratings (wallet, mode, display_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (wallet, mode) DO UPDATE SET display_name = EXCLUDED.display_name`,
        [wallet, mode, displayName || ''],
    );
}

async function applyTournamentRatingBonus(db, wallet, mode, displayName, delta, reason, tournamentId) {
    await ensureRatingRow(db, wallet, mode, displayName);
    const { rows } = await db.query(
        `UPDATE pvp_ratings SET
            rating = GREATEST($4, rating + $3),
            peak_rating = GREATEST(peak_rating, GREATEST($4, rating + $3)),
            display_name = CASE WHEN $5 <> '' THEN $5 ELSE display_name END,
            last_match_at = NOW()
         WHERE wallet = $1 AND mode = $2
         RETURNING rating`,
        [wallet, mode, delta, DECAY_FLOOR, displayName || ''],
    );
    const ratingAfter = rows[0]?.rating ?? 1200;
    await db.query(
        `INSERT INTO rating_events (wallet, mode, delta, rating_after, reason, ref_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [wallet, mode, delta, ratingAfter, reason, tournamentId],
    );
}

async function finalizeTournament(db, tournament, finalMatch) {
    const mode = tournament.format === 'team' ? 'team' : 'solo';
    const champion = finalMatch.winner;
    const finalist = finalMatch.entry_a === champion ? finalMatch.entry_b : finalMatch.entry_a;

    const { rows: participants } = await db.query(
        `SELECT * FROM tournament_participants WHERE tournament_id = $1`,
        [tournament.id],
    );

    const displayFor = (entry) => {
        const hit = participants.find((p) => entryKey(tournament.format, p) === entry);
        return hit?.character_name || hit?.team_name || entry || '';
    };

    const walletsFor = (entry) => {
        if (tournament.format === 'team') {
            return participants.filter((p) => (p.team_name || p.wallet) === entry).map((p) => p);
        }
        return participants.filter((p) => p.wallet === entry);
    };

    if (champion) {
        await db.query(
            `UPDATE tournament_participants SET placement = 1
             WHERE tournament_id = $1 AND (
                ($2 = 'solo' AND wallet = $3) OR
                ($2 = 'team' AND team_name IS NOT DISTINCT FROM $3)
             )`,
            [tournament.id, tournament.format, champion],
        );
        await db.query(
            `INSERT INTO hall_of_fame (tournament_id, entry, display_name, title)
             VALUES ($1, $2, $3, 'Champion')`,
            [tournament.id, champion, displayFor(champion)],
        );
        for (const p of walletsFor(champion)) {
            await applyTournamentRatingBonus(
                db, p.wallet, mode, p.character_name || displayFor(champion),
                CHAMPION_BONUS, 'tournament_champion', tournament.id,
            );
        }
    }

    if (finalist) {
        await db.query(
            `UPDATE tournament_participants SET placement = 2
             WHERE tournament_id = $1 AND (
                ($2 = 'solo' AND wallet = $3) OR
                ($2 = 'team' AND team_name IS NOT DISTINCT FROM $3)
             )`,
            [tournament.id, tournament.format, finalist],
        );
        await db.query(
            `INSERT INTO hall_of_fame (tournament_id, entry, display_name, title)
             VALUES ($1, $2, $3, 'Finalist')`,
            [tournament.id, finalist, displayFor(finalist)],
        );
        for (const p of walletsFor(finalist)) {
            await applyTournamentRatingBonus(
                db, p.wallet, mode, p.character_name || displayFor(finalist),
                FINALIST_BONUS, 'tournament_finalist', tournament.id,
            );
        }
    }

    const prizes = Array.isArray(tournament.prizes_json) ? tournament.prizes_json : [];
    if (champion && prizes.length > 0) {
        for (const prize of prizes) {
            const asset = String(prize.asset || '').trim();
            const amount = Number(prize.amount);
            if (!asset || !Number.isFinite(amount) || amount <= 0) {
                continue;
            }
            for (const p of walletsFor(champion)) {
                await db.query(
                    `INSERT INTO tournament_prizes (tournament_id, wallet, asset, amount, placement, status)
                     VALUES ($1, $2, $3, $4, 1, 'pending')`,
                    [tournament.id, p.wallet, asset, amount],
                );
            }
        }
    }

    await db.query(`UPDATE tournaments SET status = 'finished' WHERE id = $1`, [tournament.id]);
}

function registerTournamentRoutes(app) {
    app.get('/leaderboard', async (req, res) => {
        try {
            const db = requireDb(res);
            if (!db) {
                return;
            }

            const mode = String(req.query.mode || 'solo').trim() === 'team' ? 'team' : 'solo';
            const limit = Math.min(200, Math.max(1, Number.parseInt(String(req.query.limit || '50'), 10) || 50));
            const { rows } = await db.query(
                `SELECT wallet, display_name, rating, peak_rating, matches, wins, losses, last_match_at
                 FROM pvp_ratings
                 WHERE mode = $1
                 ORDER BY rating DESC
                 LIMIT $2`,
                [mode, limit],
            );

            const entries = rows
                .map((row) => {
                    const rawRating = Number(row.rating);
                    const rating = applyLazyDecay(rawRating, row.last_match_at);
                    return {
                        wallet: row.wallet,
                        display_name: row.display_name,
                        rating,
                        raw_rating: rawRating,
                        peak_rating: Number(row.peak_rating),
                        matches: Number(row.matches),
                        wins: Number(row.wins),
                        losses: Number(row.losses),
                        last_match_at: row.last_match_at,
                    };
                })
                .sort((a, b) => b.rating - a.rating || b.peak_rating - a.peak_rating);

            res.json({ success: true, mode, entries });
        } catch (error) {
            console.error('[tournaments] leaderboard failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/tournaments', async (_req, res) => {
        try {
            const db = requireDb(res);
            if (!db) {
                return;
            }

            const { rows } = await db.query(
                `SELECT * FROM tournaments ORDER BY created_at DESC LIMIT 100`,
            );
            res.json({ success: true, tournaments: rows });
        } catch (error) {
            console.error('[tournaments] list failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/tournaments/:id', async (req, res) => {
        try {
            const db = requireDb(res);
            if (!db) {
                return;
            }

            const { rows: tournaments } = await db.query(
                `SELECT * FROM tournaments WHERE id = $1 LIMIT 1`,
                [req.params.id],
            );
            const tournament = tournaments[0];
            if (!tournament) {
                res.status(404).json({ success: false, error: 'Tournament not found' });
                return;
            }

            const { rows: participants } = await db.query(
                `SELECT * FROM tournament_participants WHERE tournament_id = $1 ORDER BY seed NULLS LAST, created_at`,
                [tournament.id],
            );
            const { rows: matches } = await db.query(
                `SELECT * FROM tournament_matches WHERE tournament_id = $1 ORDER BY round, position`,
                [tournament.id],
            );

            res.json({ success: true, tournament, participants, matches });
        } catch (error) {
            console.error('[tournaments] detail failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/tournaments', requireAdmin, async (req, res) => {
        try {
            const db = requireDb(res);
            if (!db) {
                return;
            }

            const name = String(req.body?.name || '').trim();
            if (!name) {
                res.status(400).json({ success: false, error: 'name required' });
                return;
            }

            const format = String(req.body?.format || 'solo').trim() === 'team' ? 'team' : 'solo';
            const teamSize = Math.max(1, Number.parseInt(String(req.body?.team_size ?? (format === 'team' ? 2 : 1)), 10) || 1);
            const maxEntries = Math.max(2, Number.parseInt(String(req.body?.max_entries ?? '32'), 10) || 32);
            const startsAt = req.body?.starts_at ? new Date(req.body.starts_at) : null;
            const prizesJson = Array.isArray(req.body?.prizes_json) ? req.body.prizes_json : [];

            const { rows } = await db.query(
                `INSERT INTO tournaments (name, format, team_size, status, max_entries, starts_at, prizes_json)
                 VALUES ($1, $2, $3, 'registration', $4, $5, $6::jsonb)
                 RETURNING *`,
                [name, format, teamSize, maxEntries, startsAt, JSON.stringify(prizesJson)],
            );

            res.json({ success: true, tournament: rows[0] });
        } catch (error) {
            console.error('[tournaments] create failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/tournaments/:id/register', requireWalletToken, async (req, res) => {
        try {
            const db = requireDb(res);
            if (!db) {
                return;
            }

            const wallet = String(req.body?.wallet || req.query.wallet || '').trim();
            const characterName = String(req.body?.character_name || '').trim();
            const teamName = req.body?.team_name != null ? String(req.body.team_name).trim() : null;
            if (!wallet) {
                res.status(400).json({ success: false, error: 'wallet required' });
                return;
            }

            const { rows: tournaments } = await db.query(
                `SELECT * FROM tournaments WHERE id = $1 LIMIT 1`,
                [req.params.id],
            );
            const tournament = tournaments[0];
            if (!tournament) {
                res.status(404).json({ success: false, error: 'Tournament not found' });
                return;
            }
            if (tournament.status !== 'registration') {
                res.status(409).json({ success: false, error: 'Tournament is not open for registration' });
                return;
            }

            const { rows: countRows } = await db.query(
                `SELECT COUNT(*)::int AS count FROM tournament_participants WHERE tournament_id = $1`,
                [tournament.id],
            );
            if (countRows[0].count >= tournament.max_entries) {
                res.status(409).json({ success: false, error: 'Tournament is full' });
                return;
            }

            if (tournament.format === 'team' && !teamName) {
                res.status(400).json({ success: false, error: 'team_name required for team tournaments' });
                return;
            }

            const { rows } = await db.query(
                `INSERT INTO tournament_participants (tournament_id, wallet, character_name, team_name)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (tournament_id, wallet) DO UPDATE
                   SET character_name = EXCLUDED.character_name,
                       team_name = EXCLUDED.team_name
                 RETURNING *`,
                [tournament.id, wallet, characterName, tournament.format === 'team' ? teamName : null],
            );

            res.json({ success: true, participant: rows[0] });
        } catch (error) {
            console.error('[tournaments] register failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/tournaments/:id/start', requireAdmin, async (req, res) => {
        try {
            const db = requireDb(res);
            if (!db) {
                return;
            }

            const { rows: tournaments } = await db.query(
                `SELECT * FROM tournaments WHERE id = $1 LIMIT 1`,
                [req.params.id],
            );
            const tournament = tournaments[0];
            if (!tournament) {
                res.status(404).json({ success: false, error: 'Tournament not found' });
                return;
            }
            if (tournament.status !== 'registration' && tournament.status !== 'draft') {
                res.status(409).json({ success: false, error: 'Tournament cannot be started from current status' });
                return;
            }

            const mode = tournament.format === 'team' ? 'team' : 'solo';
            const seeded = await seedParticipants(db, tournament.id, tournament.format, mode);
            if (seeded.length < 2) {
                res.status(400).json({ success: false, error: 'Need at least 2 entrants to start' });
                return;
            }

            const matches = await createBracket(db, tournament.id, seeded);
            await db.query(`UPDATE tournaments SET status = 'running' WHERE id = $1`, [tournament.id]);

            res.json({
                success: true,
                tournament: { ...tournament, status: 'running' },
                matches,
            });
        } catch (error) {
            console.error('[tournaments] start failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/tournaments/:id/matches/:matchId/report', requireAdmin, async (req, res) => {
        try {
            const db = requireDb(res);
            if (!db) {
                return;
            }

            const winner = String(req.body?.winner || '').trim();
            if (!winner) {
                res.status(400).json({ success: false, error: 'winner required' });
                return;
            }

            const { rows: tournaments } = await db.query(
                `SELECT * FROM tournaments WHERE id = $1 LIMIT 1`,
                [req.params.id],
            );
            const tournament = tournaments[0];
            if (!tournament) {
                res.status(404).json({ success: false, error: 'Tournament not found' });
                return;
            }
            if (tournament.status !== 'running') {
                res.status(409).json({ success: false, error: 'Tournament is not running' });
                return;
            }

            const { rows: matchRows } = await db.query(
                `SELECT * FROM tournament_matches WHERE id = $1 AND tournament_id = $2 LIMIT 1`,
                [req.params.matchId, tournament.id],
            );
            const match = matchRows[0];
            if (!match) {
                res.status(404).json({ success: false, error: 'Match not found' });
                return;
            }
            if (match.status === 'done') {
                res.status(409).json({ success: false, error: 'Match already reported' });
                return;
            }
            if (winner !== match.entry_a && winner !== match.entry_b) {
                res.status(400).json({ success: false, error: 'winner must be entry_a or entry_b' });
                return;
            }

            const { rows: updatedRows } = await db.query(
                `UPDATE tournament_matches
                 SET winner = $1, status = 'done', reported_at = NOW()
                 WHERE id = $2
                 RETURNING *`,
                [winner, match.id],
            );
            const updated = updatedRows[0];
            const nextMatch = await advanceWinner(db, tournament.id, updated);

            const { rows: remaining } = await db.query(
                `SELECT COUNT(*)::int AS count FROM tournament_matches
                 WHERE tournament_id = $1 AND status <> 'done'`,
                [tournament.id],
            );
            if (remaining[0].count === 0) {
                await finalizeTournament(db, tournament, updated);
            }

            res.json({ success: true, match: updated, next_match: nextMatch });
        } catch (error) {
            console.error('[tournaments] report failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ----- Weekly Sunday Arena inscription (landing pages 1v1 / 3v3) -----
    // In-memory fallback when Postgres is unset so the landing always works.
    const memWeeks = {
        solo: { id: 'mem-solo', name: '', format: 'solo', team_size: 1, status: 'registration', max_entries: 64, participants: [], starts_at: null, prizes_json: [{ asset: 'USDT', amount: 0, note: 'TBD' }] },
        team: { id: 'mem-team', name: '', format: 'team', team_size: 3, status: 'registration', max_entries: 32, participants: [], starts_at: null, prizes_json: [{ asset: 'USDT', amount: 0, note: 'TBD' }] },
    };

    function sundayLabel() {
        const now = new Date();
        const day = now.getUTCDay();
        const daysUntil = (7 - day) % 7;
        const next = new Date(now);
        next.setUTCDate(now.getUTCDate() + (daysUntil === 0 ? 0 : daysUntil));
        next.setUTCHours(20, 0, 0, 0);
        return next;
    }

    function weekKey(format) {
        const d = sundayLabel();
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${format}-${y}-${m}-${day}`;
    }

    function ensureMemWeek(format) {
        const key = format === 'team' ? 'team' : 'solo';
        const label = sundayLabel();
        const name = key === 'team'
            ? `Sunday Coliseum 3v3 — ${label.toISOString().slice(0, 10)}`
            : `Sunday Coliseum 1v1 — ${label.toISOString().slice(0, 10)}`;
        const wk = memWeeks[key];
        if (wk.name !== name) {
            wk.name = name;
            wk.participants = [];
            wk.starts_at = label.toISOString();
            wk.id = `mem-${weekKey(key)}`;
        }
        return wk;
    }

    async function ensureDbWeek(db, format) {
        const isTeam = format === 'team';
        const label = sundayLabel();
        const name = isTeam
            ? `Sunday Coliseum 3v3 — ${label.toISOString().slice(0, 10)}`
            : `Sunday Coliseum 1v1 — ${label.toISOString().slice(0, 10)}`;
        const { rows: existing } = await db.query(
            `SELECT * FROM tournaments
             WHERE name = $1 AND status = 'registration'
             ORDER BY created_at DESC LIMIT 1`,
            [name],
        );
        if (existing[0]) {
            return existing[0];
        }
        const { rows } = await db.query(
            `INSERT INTO tournaments (name, format, team_size, status, max_entries, starts_at, prizes_json)
             VALUES ($1, $2, $3, 'registration', $4, $5, $6::jsonb)
             RETURNING *`,
            [
                name,
                isTeam ? 'team' : 'solo',
                isTeam ? 3 : 1,
                isTeam ? 32 : 64,
                label,
                JSON.stringify([{ asset: 'USDT', amount: 0, note: 'Prize pool TBD' }]),
            ],
        );
        return rows[0];
    }

    function rankEntries(list) {
        return [...list]
            .map((p) => ({
                ...p,
                rating: Number(p.rating) || 1200,
                peak_rating: Number(p.peak_rating) || Number(p.rating) || 1200,
                wins: Number(p.wins) || 0,
                losses: Number(p.losses) || 0,
                matches: Number(p.matches) || 0,
            }))
            .sort((a, b) => b.rating - a.rating || b.peak_rating - a.peak_rating || String(a.display_name || '').localeCompare(String(b.display_name || '')))
            .map((p, i) => ({
                ...p,
                seed: i + 1,
                preclassified: i + 1,
                entry: p.team_name || p.wallet,
            }));
    }

    /** GET /arena/week?format=solo|team — open Sunday tournament + ranked field + tennis preview */
    app.get('/arena/week', async (req, res) => {
        try {
            const format = String(req.query.format || 'solo').trim() === 'team' ? 'team' : 'solo';
            const mode = format === 'team' ? 'team' : 'solo';
            const db = getPool();

            if (!db) {
                const week = ensureMemWeek(format);
                const ranked = rankEntries(
                    week.participants.map((p) => ({
                        ...p,
                        rating: p.rating ?? 1200,
                        display_name: p.character_name || p.team_name || p.wallet,
                    })),
                );
                const preview = previewTennisBracket(ranked);
                res.json({
                    success: true,
                    source: 'memory',
                    tournament: {
                        id: week.id,
                        name: week.name,
                        format: week.format,
                        team_size: week.team_size,
                        status: week.status,
                        max_entries: week.max_entries,
                        starts_at: week.starts_at,
                        prizes_json: week.prizes_json,
                        entry_count: ranked.length,
                    },
                    entries: ranked,
                    bracket_preview: preview,
                    seeding_note:
                        'Tennis-style seeding: #1 and #2 opposite halves; early rounds protect top seeds from each other.',
                });
                return;
            }

            const tournament = await ensureDbWeek(db, format);
            const { rows: participants } = await db.query(
                `SELECT tp.*,
                        COALESCE(pr.rating, 1200) AS rating,
                        COALESCE(pr.peak_rating, 1200) AS peak_rating,
                        COALESCE(pr.wins, 0) AS wins,
                        COALESCE(pr.losses, 0) AS losses,
                        COALESCE(pr.matches, 0) AS matches,
                        pr.last_match_at AS rating_last_match_at,
                        pr.display_name AS rating_display_name
                 FROM tournament_participants tp
                 LEFT JOIN pvp_ratings pr ON pr.wallet = tp.wallet AND pr.mode = $2
                 WHERE tp.tournament_id = $1`,
                [tournament.id, mode],
            );

            const ranked = rankEntries(
                participants.map((p) => ({
                    id: p.id,
                    wallet: p.wallet,
                    character_name: p.character_name,
                    team_name: p.team_name,
                    team_members: p.character_name,
                    created_at: p.created_at,
                    rating: applyLazyDecay(Number(p.rating), p.rating_last_match_at),
                    peak_rating: Number(p.peak_rating) || 1200,
                    wins: Number(p.wins) || 0,
                    losses: Number(p.losses) || 0,
                    matches: Number(p.matches) || 0,
                    display_name: p.team_name || p.character_name || p.rating_display_name || p.wallet,
                })),
            );

            // Persist provisional seeds for display (does not start the bracket).
            for (const e of ranked) {
                if (format === 'team') {
                    await db.query(
                        `UPDATE tournament_participants SET seed = $1
                         WHERE tournament_id = $2 AND team_name IS NOT DISTINCT FROM $3`,
                        [e.seed, tournament.id, e.team_name],
                    );
                } else if (e.id) {
                    await db.query(
                        `UPDATE tournament_participants SET seed = $1 WHERE id = $2`,
                        [e.seed, e.id],
                    );
                }
            }

            const preview = previewTennisBracket(ranked);
            res.json({
                success: true,
                source: 'postgres',
                tournament: {
                    ...tournament,
                    entry_count: ranked.length,
                },
                entries: ranked,
                bracket_preview: preview,
                seeding_note:
                    'Tennis-style seeding: #1 and #2 opposite halves; early rounds protect top seeds from each other.',
            });
        } catch (error) {
            console.error('[tournaments] arena week failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    /** POST /arena/week/register — wallet-signed inscription for current Sunday event */
    app.post('/arena/week/register', requireWalletToken, async (req, res) => {
        try {
            const format = String(req.body?.format || 'solo').trim() === 'team' ? 'team' : 'solo';
            const wallet = String(req.body?.wallet || req.query.wallet || '').trim();
            const characterName = String(req.body?.character_name || '').trim();
            const teamName = req.body?.team_name != null ? String(req.body.team_name).trim() : '';
            const members = Array.isArray(req.body?.members)
                ? req.body.members.map((m) => String(m || '').trim()).filter(Boolean)
                : [];

            if (!wallet) {
                res.status(400).json({ success: false, error: 'wallet required' });
                return;
            }
            if (format === 'solo' && !characterName) {
                res.status(400).json({ success: false, error: 'character_name required for 1v1' });
                return;
            }
            if (format === 'team') {
                if (!teamName) {
                    res.status(400).json({ success: false, error: 'team_name required for 3v3' });
                    return;
                }
                if (members.length < 2) {
                    res.status(400).json({
                        success: false,
                        error: '3v3 requires team_name + at least 2 teammate names (captain is you)',
                    });
                    return;
                }
            }

            const db = getPool();
            if (!db) {
                const week = ensureMemWeek(format);
                if (week.participants.length >= week.max_entries) {
                    res.status(409).json({ success: false, error: 'Tournament is full' });
                    return;
                }
                const existing = week.participants.findIndex((p) => p.wallet === wallet);
                const row = {
                    wallet,
                    character_name: characterName || teamName,
                    team_name: format === 'team' ? teamName : null,
                    team_members: format === 'team' ? [characterName || 'Captain', ...members].slice(0, 3) : null,
                    rating: 1200,
                    peak_rating: 1200,
                    wins: 0,
                    losses: 0,
                    matches: 0,
                    created_at: new Date().toISOString(),
                };
                if (existing >= 0) {
                    week.participants[existing] = { ...week.participants[existing], ...row };
                } else {
                    week.participants.push(row);
                }
                const ranked = rankEntries(
                    week.participants.map((p) => ({
                        ...p,
                        display_name: p.team_name || p.character_name || p.wallet,
                    })),
                );
                res.json({
                    success: true,
                    source: 'memory',
                    participant: row,
                    entries: ranked,
                    tournament: { id: week.id, name: week.name, format: week.format, entry_count: ranked.length },
                });
                return;
            }

            const tournament = await ensureDbWeek(db, format);
            if (tournament.status !== 'registration') {
                res.status(409).json({ success: false, error: 'Tournament is not open for registration' });
                return;
            }

            const { rows: countRows } = await db.query(
                `SELECT COUNT(*)::int AS count FROM tournament_participants WHERE tournament_id = $1`,
                [tournament.id],
            );
            if (countRows[0].count >= tournament.max_entries) {
                res.status(409).json({ success: false, error: 'Tournament is full' });
                return;
            }

            const mode = format === 'team' ? 'team' : 'solo';
            await ensureRatingRow(db, wallet, mode, characterName || teamName);

            // team_name column used; stash members in character_name as "Captain | A | B" when no JSON column
            const memberBlob = format === 'team'
                ? [characterName || 'Captain', ...members].slice(0, 3).join(' | ')
                : characterName;

            const { rows } = await db.query(
                `INSERT INTO tournament_participants (tournament_id, wallet, character_name, team_name)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (tournament_id, wallet) DO UPDATE
                   SET character_name = EXCLUDED.character_name,
                       team_name = EXCLUDED.team_name
                 RETURNING *`,
                [
                    tournament.id,
                    wallet,
                    format === 'team' ? memberBlob : characterName,
                    format === 'team' ? teamName : null,
                ],
            );

            res.json({ success: true, source: 'postgres', participant: rows[0], tournament_id: tournament.id });
        } catch (error) {
            console.error('[tournaments] arena register failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/hall-of-fame', async (_req, res) => {
        try {
            const db = requireDb(res);
            if (!db) {
                return;
            }

            const { rows } = await db.query(
                `SELECT * FROM hall_of_fame ORDER BY awarded_at DESC LIMIT 100`,
            );
            res.json({ success: true, entries: rows });
        } catch (error) {
            console.error('[tournaments] hall-of-fame failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/prizes', async (req, res) => {
        try {
            const db = requireDb(res);
            if (!db) {
                return;
            }

            const wallet = String(req.query.wallet || '').trim();
            if (!wallet) {
                res.status(400).json({ success: false, error: 'wallet query param required' });
                return;
            }

            const { rows } = await db.query(
                `SELECT * FROM tournament_prizes WHERE wallet = $1 ORDER BY created_at DESC`,
                [wallet],
            );
            res.json({ success: true, wallet, prizes: rows });
        } catch (error) {
            console.error('[tournaments] prizes list failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/admin/decay-run', requireAdmin, async (_req, res) => {
        try {
            const db = requireDb(res);
            if (!db) {
                return;
            }

            const result = await persistInactivityDecay(db);
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('[tournaments] manual decay failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/prizes/:id/paid', requireAdmin, async (req, res) => {
        try {
            const db = requireDb(res);
            if (!db) {
                return;
            }

            const txSignature = String(req.body?.tx_signature || '').trim();
            if (!txSignature) {
                res.status(400).json({ success: false, error: 'tx_signature required' });
                return;
            }

            const { rows } = await db.query(
                `UPDATE tournament_prizes
                 SET status = 'paid', tx_signature = $2, paid_at = NOW()
                 WHERE id = $1 AND status = 'pending'
                 RETURNING *`,
                [req.params.id, txSignature],
            );
            if (!rows[0]) {
                res.status(404).json({ success: false, error: 'Pending prize not found' });
                return;
            }

            res.json({ success: true, prize: rows[0] });
        } catch (error) {
            console.error('[tournaments] prize paid failed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
}

module.exports = {
    registerTournamentRoutes,
    applyLazyDecay,
    persistInactivityDecay,
    startEloDecayJob,
    requireAdmin,
};
