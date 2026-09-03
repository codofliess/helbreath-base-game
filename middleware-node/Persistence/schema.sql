-- Helbreath Phase 2: accounts, characters, drop ledger (PostgreSQL)
-- Run once: psql -f schema.sql

CREATE TABLE IF NOT EXISTS accounts (
    wallet_pubkey TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_wallet TEXT NOT NULL REFERENCES accounts(wallet_pubkey) ON DELETE CASCADE,
    name TEXT NOT NULL,
    world_id TEXT NOT NULL,
    pos_x INT NOT NULL,
    pos_y INT NOT NULL,
    state_json JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (account_wallet, name)
);

CREATE INDEX IF NOT EXISTS idx_characters_account ON characters(account_wallet);

-- Global display-name uniqueness (case-insensitive) across wallets for Create Character.
CREATE UNIQUE INDEX IF NOT EXISTS idx_characters_name_ci ON characters (LOWER(name));

-- SELECTCHAR desk: slot 0–3 and cumulative hours played (defaults for existing rows).
ALTER TABLE characters ADD COLUMN IF NOT EXISTS slot_index INT NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS hours_played DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS drop_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_wallet TEXT NOT NULL REFERENCES accounts(wallet_pubkey),
    character_name TEXT NOT NULL,
    item_uid BIGINT NOT NULL,
    item_id INT NOT NULL,
    item_attribute INT NOT NULL DEFAULT 0,
    item_color INT NOT NULL DEFAULT 0,
    quantity INT NOT NULL DEFAULT 1,
    source_monster_id INT,
    source_map TEXT,
    is_nft_candidate BOOLEAN NOT NULL DEFAULT FALSE,
    nft_tier TEXT NOT NULL DEFAULT 'none',
    nft_claimed_at TIMESTAMPTZ,
    nft_mint_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drop_ledger_wallet ON drop_ledger(account_wallet);
CREATE INDEX IF NOT EXISTS idx_drop_ledger_unclaimed ON drop_ledger(account_wallet) WHERE nft_claimed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_drop_ledger_wallet_item_uid ON drop_ledger(account_wallet, item_uid);

-- Phase 2 migration: tier column for Rare vs Legendary cNFT collections.
ALTER TABLE drop_ledger ADD COLUMN IF NOT EXISTS nft_tier TEXT NOT NULL DEFAULT 'none';
UPDATE drop_ledger SET nft_tier = 'rare' WHERE is_nft_candidate = TRUE AND nft_tier = 'none';

-- Claim lease: held before on-chain mint so multi-replica middleware cannot double-mint.
-- Expired leases (nft_claim_lease_until < NOW()) are free for another worker to acquire.
ALTER TABLE drop_ledger ADD COLUMN IF NOT EXISTS nft_claim_lease_until TIMESTAMPTZ;

-- ============================================================
-- Phase 3: PvP, tournaments, world rankings, hall of fame
-- ============================================================

-- Every player-vs-player kill recorded by the game server (source of truth for match results and ratings).
CREATE TABLE IF NOT EXISTS pvp_kills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id TEXT NOT NULL,
    killer_wallet TEXT NOT NULL,
    killer_name TEXT NOT NULL,
    victim_wallet TEXT NOT NULL,
    victim_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pvp_kills_world_time ON pvp_kills(world_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pvp_kills_killer ON pvp_kills(killer_wallet, created_at DESC);

-- Tournament directory. format: 'solo' | 'team'. status: 'draft' | 'registration' | 'running' | 'finished' | 'cancelled'.
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'solo',
    team_size INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'registration',
    max_entries INT NOT NULL DEFAULT 32,
    starts_at TIMESTAMPTZ,
    -- Prize pool description, e.g. [{"asset":"USDC","amount":500},{"asset":"HBGOV","amount":10000}]
    prizes_json JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per registered entrant (a wallet in solo, or a wallet that belongs to team_name in team format).
CREATE TABLE IF NOT EXISTS tournament_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    wallet TEXT NOT NULL,
    character_name TEXT NOT NULL DEFAULT '',
    team_name TEXT,
    seed INT,
    placement INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tournament_id, wallet)
);

CREATE INDEX IF NOT EXISTS idx_tournament_participants_tid ON tournament_participants(tournament_id);

-- Single-elimination bracket slots. entry_a/entry_b reference an entry key:
-- solo => participant wallet; team => team_name. status: 'pending' | 'live' | 'done'.
CREATE TABLE IF NOT EXISTS tournament_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round INT NOT NULL,
    position INT NOT NULL,
    entry_a TEXT,
    entry_b TEXT,
    winner TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    arena_world_id TEXT,
    reported_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tournament_id, round, position)
);

-- World ranking per wallet and mode ('solo' | 'team'). Elo-style rating with inactivity decay
-- (boxing/tennis model: you must keep competing to hold your rank).
CREATE TABLE IF NOT EXISTS pvp_ratings (
    wallet TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'solo',
    display_name TEXT NOT NULL DEFAULT '',
    rating INT NOT NULL DEFAULT 1200,
    peak_rating INT NOT NULL DEFAULT 1200,
    matches INT NOT NULL DEFAULT 0,
    wins INT NOT NULL DEFAULT 0,
    losses INT NOT NULL DEFAULT 0,
    last_match_at TIMESTAMPTZ,
    last_decay_at TIMESTAMPTZ,
    PRIMARY KEY (wallet, mode)
);

CREATE INDEX IF NOT EXISTS idx_pvp_ratings_leaderboard ON pvp_ratings(mode, rating DESC);

-- Append-only audit of every rating change (match result, tournament bonus, inactivity decay).
CREATE TABLE IF NOT EXISTS rating_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet TEXT NOT NULL,
    mode TEXT NOT NULL,
    delta INT NOT NULL,
    rating_after INT NOT NULL,
    reason TEXT NOT NULL,
    ref_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rating_events_wallet ON rating_events(wallet, created_at DESC);

-- Legendary honor board: champions and notable finishes per tournament.
CREATE TABLE IF NOT EXISTS hall_of_fame (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
    entry TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Custodial prize ledger: what each winner is owed / has been paid. status: 'pending' | 'paid'.
CREATE TABLE IF NOT EXISTS tournament_prizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    wallet TEXT NOT NULL,
    asset TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    placement INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    tx_signature TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_prizes_wallet ON tournament_prizes(wallet, status);

-- ============================================================
-- Auction board MVP (optional dual-write; primary store is Chars/auction-board.json)
-- ============================================================

CREATE TABLE IF NOT EXISTS auction_listings (
    listing_id TEXT PRIMARY KEY,
    seller_wallet TEXT NOT NULL,
    seller_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    mode TEXT NOT NULL,
    listing_json JSONB NOT NULL,
    expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auction_listings_status ON auction_listings(status, expires_at);

CREATE TABLE IF NOT EXISTS auction_fee_debts (
    account_wallet TEXT NOT NULL,
    character_name TEXT NOT NULL,
    amount_gold INT NOT NULL DEFAULT 0,
    due_at TIMESTAMPTZ,
    last_known_ip TEXT,
    blocked BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (account_wallet, character_name)
);
