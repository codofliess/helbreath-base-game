-- ============================================================================
-- ChainLords Kill Viewer — Postgres schema (DRAFT, not applied anywhere)
--   public_ledger : public slice (mirrors on-chain Kill Ledger events + server-published drops)
--   internal_ops  : PRIVATE slice (kill location) + append-only audit_log. Never exposed publicly.
-- Passwords are NOT set here. Set them out-of-band from a secret manager:
--   ALTER ROLE viewer_ro PASSWORD :'VIEWER_RO_PASSWORD';  (psql -v, value from env/secret store)
-- ============================================================================

-- ---------- roles (NOLOGIN groups + LOGIN users would be the prod pattern; kept simple) ----------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'viewer_ro')      THEN CREATE ROLE viewer_ro LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ops_admin')      THEN CREATE ROLE ops_admin LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ledger_indexer') THEN CREATE ROLE ledger_indexer LOGIN; END IF; -- writes public_ledger from chain events + server drops
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'game_server_ops') THEN CREATE ROLE game_server_ops LOGIN; END IF; -- writes kill_location only
END $$;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA IF NOT EXISTS public_ledger;
CREATE SCHEMA IF NOT EXISTS internal_ops;
REVOKE ALL ON SCHEMA public_ledger FROM PUBLIC;
REVOKE ALL ON SCHEMA internal_ops  FROM PUBLIC;

-- ============================== PUBLIC SLICE ==============================
CREATE TYPE public_ledger.kill_status AS ENUM ('credited', 'pair_limit_reached', 'kill_burned', 'rejected_level_gap');

-- Cities are DATA (the second city's name may change): never hardcode names in code/rules.
CREATE TABLE public_ledger.cities (
  city_id    text PRIMARY KEY CHECK (city_id ~ '^[a-z0-9_]+$'),
  name       text NOT NULL,
  sort_order int  NOT NULL DEFAULT 0
);

CREATE TABLE public_ledger.characters (
  pubkey      text PRIMARY KEY,            -- NFT asset / player pubkey used on-chain
  name        text NOT NULL UNIQUE,        -- in-game name (published by game server)
  city_id     text REFERENCES public_ledger.cities(city_id),
  level       int  NOT NULL DEFAULT 1,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public_ledger.kills (
  combat_id       text PRIMARY KEY CHECK (combat_id ~ '^[0-9a-f]{64}$'), -- hex(combat_id [u8;32])
  batch_id        text NOT NULL,           -- server-signed report batch (~10 kills)
  tx_signature    text,                    -- Solana tx that carried report_kill
  slot            bigint,
  attacker_pubkey text NOT NULL REFERENCES public_ledger.characters(pubkey),
  victim_pubkey   text NOT NULL REFERENCES public_ledger.characters(pubkey),
  attacker_level  int  NOT NULL,           -- from CombatReport instruction args
  victim_level    int  NOT NULL,
  killed_at       timestamptz NOT NULL,    -- CombatReport.killed_at
  day             date GENERATED ALWAYS AS ((killed_at AT TIME ZONE 'UTC')::date) STORED,
  status          public_ledger.kill_status NOT NULL,
  indexed_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kills_victim_time   ON public_ledger.kills (victim_pubkey, killed_at DESC);
CREATE INDEX kills_attacker_time ON public_ledger.kills (attacker_pubkey, killed_at DESC);
CREATE INDEX kills_time          ON public_ledger.kills (killed_at DESC);

-- Loot: PUBLIC, server-populated, deliberately NOT in the on-chain batch.
-- Zem = in-game currency (assumption: "SEM" in the request == Zem).
CREATE TABLE public_ledger.kill_drops (
  combat_id    text PRIMARY KEY REFERENCES public_ledger.kills(combat_id) ON DELETE CASCADE,
  zem_dropped  boolean NOT NULL DEFAULT false,
  zem_amount   bigint  NOT NULL DEFAULT 0 CHECK (zem_amount >= 0),
  CHECK (zem_dropped OR zem_amount = 0)
);
CREATE TABLE public_ledger.kill_drop_items (
  combat_id  text NOT NULL REFERENCES public_ledger.kills(combat_id) ON DELETE CASCADE,
  line_no    smallint NOT NULL,
  item_id    int  NOT NULL,
  item_name  text NOT NULL,
  qty        int  NOT NULL CHECK (qty > 0),
  bound      boolean NOT NULL,
  rarity     text NOT NULL CHECK (rarity IN ('common','rare','epic','legendary')),
  category   text NOT NULL,
  PRIMARY KEY (combat_id, line_no)
);

-- ============================== WEIGHTED EK (server-side only, nothing on-chain) ==============================
-- Rules version: one row per version. ranking_window_days is FIXED at 30 (Martín, 2026-09-25: rolling 30 days of
-- CREDITED kills per city; no lifetime / season mode). Kept as a column only for traceability of each version.
CREATE TABLE public_ledger.ek_rules_versions (
  version             text PRIMARY KEY,
  effective_from      timestamptz NOT NULL UNIQUE,  -- applies to kills with killed_at >= effective_from (until next version)
  ranking_window_days int NOT NULL DEFAULT 30 CHECK (ranking_window_days = 30),
  same_city_weight    numeric(6,2) CHECK (same_city_weight IS NULL OR same_city_weight >= 0),  -- UNSET: owner decision (fail closed => 0 EK)
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version, effective_from)
);

-- Multiplier bands (city-agnostic). Bands must start at 1, be contiguous, last one open-ended (rank_to NULL).
-- Unranked victims (no credited kill in the window) fall into the open-ended band.
CREATE TABLE public_ledger.ek_weight_bands (
  version        text NOT NULL,
  effective_from timestamptz NOT NULL,
  rank_from      int NOT NULL CHECK (rank_from >= 1),
  rank_to        int CHECK (rank_to IS NULL OR rank_to >= rank_from),
  weight         numeric(6,2) NOT NULL CHECK (weight >= 0),
  label          text NOT NULL,
  PRIMARY KEY (version, rank_from),
  FOREIGN KEY (version, effective_from) REFERENCES public_ledger.ek_rules_versions(version, effective_from)
);

INSERT INTO public_ledger.ek_rules_versions (version, effective_from, ranking_window_days, same_city_weight, notes)
VALUES ('ek-v1', '2026-01-01T00:00:00Z', 30, NULL, 'Initial bands: top10 opposing = 3, 11-30 = 2, else 1. same_city_weight unset (owner decision).');
INSERT INTO public_ledger.ek_weight_bands (version, effective_from, rank_from, rank_to, weight, label) VALUES
  ('ek-v1', '2026-01-01T00:00:00Z',  1,   10, 3, 'Top 10 kill'),
  ('ek-v1', '2026-01-01T00:00:00Z', 11,   30, 2, 'Top 30 kill'),
  ('ek-v1', '2026-01-01T00:00:00Z', 31, NULL, 1, 'Standard');

-- Payout periods. Closing a period freezes the rules_version used for its payout.
CREATE TABLE public_ledger.payout_periods (
  period_id     text PRIMARY KEY,
  period_start  timestamptz NOT NULL,
  period_end    timestamptz NOT NULL,
  closed_at     timestamptz,
  rules_version text REFERENCES public_ledger.ek_rules_versions(version),
  CHECK (period_end > period_start),
  CHECK ((closed_at IS NULL) = (rules_version IS NULL))
);

-- One row per (kill, rules_version). Deterministically rebuilt by recompute_weights().
CREATE TABLE public_ledger.kill_weights (
  combat_id            text NOT NULL REFERENCES public_ledger.kills(combat_id) ON DELETE CASCADE,
  rules_version        text NOT NULL REFERENCES public_ledger.ek_rules_versions(version),
  attacker_pubkey      text NOT NULL,
  killed_at            timestamptz NOT NULL,
  attacker_city        text,
  victim_city          text,
  cross_city           boolean NOT NULL,
  victim_rank_snapshot int,              -- victim's rank in OWN city over credited kills in [killed_at - 30d, killed_at)
  band_label           text,
  weight               numeric(6,2) NOT NULL CHECK (weight >= 0),  -- 0 for pair-limit / level-gap / burned
  computed_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (combat_id, rules_version)
);
CREATE INDEX kill_weights_attacker ON public_ledger.kill_weights (rules_version, attacker_pubkey, killed_at);
CREATE INDEX kills_status_time ON public_ledger.kills (status, killed_at);

-- City ranking as of p_at (exclusive): credited kills in [p_at - 30d, p_at) by attackers of p_city.
-- Ties: more kills first; then earliest to reach the count (= time of latest in-window credited kill); then pubkey (C collation).
CREATE FUNCTION public_ledger.city_ranking(p_city text, p_at timestamptz, p_window_days int DEFAULT 30)
RETURNS TABLE (rank int, pubkey text, credited_kills int, reached_at timestamptz)
LANGUAGE sql STABLE AS $$
  SELECT (row_number() OVER (ORDER BY count(*) DESC, max(k.killed_at) ASC, k.attacker_pubkey COLLATE "C" ASC))::int,
         k.attacker_pubkey, count(*)::int, max(k.killed_at)
  FROM public_ledger.kills k
  JOIN public_ledger.characters a ON a.pubkey = k.attacker_pubkey
  WHERE k.status = 'credited' AND a.city_id = p_city
    AND k.killed_at >= p_at - make_interval(hours => p_window_days * 24) AND k.killed_at < p_at
  GROUP BY k.attacker_pubkey
$$;

CREATE FUNCTION public_ledger.assert_bands_valid(p_version text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE b record; expected int := 1; open_seen boolean := false; n int := 0;
BEGIN
  FOR b IN SELECT rank_from, rank_to FROM public_ledger.ek_weight_bands WHERE version = p_version ORDER BY rank_from LOOP
    n := n + 1;
    IF open_seen OR b.rank_from <> expected THEN RAISE EXCEPTION 'bands for % must be contiguous from 1', p_version; END IF;
    IF b.rank_to IS NULL THEN open_seen := true; ELSE expected := b.rank_to + 1; END IF;
  END LOOP;
  IF n = 0 OR NOT open_seen THEN RAISE EXCEPTION 'bands for % need a final open-ended band', p_version; END IF;
END $$;

-- Deterministic rebuild of kill_weights for one rules version over [p_from, p_to). Ranking context = full raw ledger.
CREATE FUNCTION public_ledger.recompute_weights(p_version text, p_from timestamptz, p_to timestamptz)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE v public_ledger.ek_rules_versions; n int;
BEGIN
  SELECT * INTO v FROM public_ledger.ek_rules_versions WHERE version = p_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown rules version %', p_version; END IF;
  PERFORM public_ledger.assert_bands_valid(p_version);
  IF EXISTS (SELECT 1 FROM public_ledger.payout_periods p WHERE p.closed_at IS NOT NULL AND p.rules_version = p_version
             AND p.period_start < p_to AND p.period_end > p_from) THEN
    RAISE EXCEPTION 'range overlaps a closed payout period frozen with %; publish a new rules version instead', p_version;
  END IF;
  DELETE FROM public_ledger.kill_weights WHERE rules_version = p_version AND killed_at >= p_from AND killed_at < p_to;
  INSERT INTO public_ledger.kill_weights (combat_id, rules_version, attacker_pubkey, killed_at, attacker_city, victim_city,
                                          cross_city, victim_rank_snapshot, band_label, weight)
  SELECT x.combat_id, p_version, x.attacker_pubkey, x.killed_at, x.ac, x.vc, x.cross_city, x.rnk,
         CASE WHEN x.status <> 'credited' THEN NULL WHEN x.cross_city THEN b.label ELSE 'Same city' END,
         CASE WHEN x.status <> 'credited' THEN 0    WHEN x.cross_city THEN b.weight ELSE COALESCE(v.same_city_weight, 0) END
  FROM (
    SELECT k.combat_id, k.attacker_pubkey, k.killed_at, k.status, ac.city_id AS ac, vc.city_id AS vc,
           (ac.city_id IS NOT NULL AND vc.city_id IS NOT NULL AND ac.city_id <> vc.city_id) AS cross_city,
           (SELECT cr.rank FROM public_ledger.city_ranking(vc.city_id, k.killed_at, v.ranking_window_days) cr
             WHERE cr.pubkey = k.victim_pubkey) AS rnk
    FROM public_ledger.kills k
    JOIN public_ledger.characters ac ON ac.pubkey = k.attacker_pubkey
    JOIN public_ledger.characters vc ON vc.pubkey = k.victim_pubkey
    WHERE k.killed_at >= p_from AND k.killed_at < p_to
  ) x
  LEFT JOIN LATERAL (
    SELECT bb.weight, bb.label FROM public_ledger.ek_weight_bands bb
    WHERE bb.version = p_version
      AND ((x.rnk IS NULL AND bb.rank_to IS NULL) OR (x.rnk >= bb.rank_from AND (bb.rank_to IS NULL OR x.rnk <= bb.rank_to)))
    ORDER BY bb.rank_from LIMIT 1
  ) b ON true;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Freeze: weights of a closed period (for its frozen version) can never change; nor can that version's bands/config.
CREATE FUNCTION public_ledger.kill_weights_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF EXISTS (SELECT 1 FROM public_ledger.payout_periods p WHERE p.closed_at IS NOT NULL AND p.rules_version = r.rules_version
             AND r.killed_at >= p.period_start AND r.killed_at < p.period_end) THEN
    RAISE EXCEPTION 'kill_weights frozen: % falls in a closed payout period (version %)', r.combat_id, r.rules_version;
  END IF;
  RETURN r;
END $$;
CREATE TRIGGER kill_weights_frozen BEFORE INSERT OR UPDATE OR DELETE ON public_ledger.kill_weights
  FOR EACH ROW EXECUTE FUNCTION public_ledger.kill_weights_guard();

CREATE FUNCTION public_ledger.rules_frozen_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ver text;
BEGIN
  ver := CASE WHEN TG_OP = 'DELETE' THEN OLD.version ELSE NEW.version END;
  IF EXISTS (SELECT 1 FROM public_ledger.payout_periods p WHERE p.closed_at IS NOT NULL AND p.rules_version = ver) THEN
    RAISE EXCEPTION 'rules version % is frozen by a closed payout period; create a new version', ver;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER ek_bands_frozen BEFORE INSERT OR UPDATE OR DELETE ON public_ledger.ek_weight_bands
  FOR EACH ROW EXECUTE FUNCTION public_ledger.rules_frozen_guard();
CREATE TRIGGER ek_rules_frozen BEFORE UPDATE OR DELETE ON public_ledger.ek_rules_versions
  FOR EACH ROW EXECUTE FUNCTION public_ledger.rules_frozen_guard();

-- Close a period: freeze the rules version. Requires weights present for every kill in the period.
CREATE FUNCTION public_ledger.close_payout_period(p_period_id text, p_version text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE p public_ledger.payout_periods;
BEGIN
  SELECT * INTO p FROM public_ledger.payout_periods WHERE period_id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown period %', p_period_id; END IF;
  IF p.closed_at IS NOT NULL THEN RAISE EXCEPTION 'period % already closed', p_period_id; END IF;
  IF p.period_end > now() THEN RAISE EXCEPTION 'period % has not ended', p_period_id; END IF;
  IF EXISTS (SELECT 1 FROM public_ledger.kills k WHERE k.killed_at >= p.period_start AND k.killed_at < p.period_end
             AND NOT EXISTS (SELECT 1 FROM public_ledger.kill_weights w WHERE w.combat_id = k.combat_id AND w.rules_version = p_version)) THEN
    RAISE EXCEPTION 'run recompute_weights(%, ...) for the whole period before closing', p_version;
  END IF;
  UPDATE public_ledger.payout_periods SET closed_at = now(), rules_version = p_version WHERE period_id = p_period_id;
END $$;

-- The ONLY relation the public API reads for kills. No location columns exist in this schema at all.
-- EK shown = weight under the rules version applicable at killed_at.
CREATE VIEW public_ledger.v_kills_public AS
SELECT k.combat_id, k.batch_id, k.tx_signature,
       k.attacker_pubkey, a.name AS attacker_name, k.attacker_level,
       k.victim_pubkey,   v.name AS victim_name,   k.victim_level,
       k.killed_at, k.day, k.status,
       jsonb_build_object(
         'zem',   jsonb_build_object('dropped', COALESCE(d.zem_dropped,false), 'amount', COALESCE(d.zem_amount,0)),
         'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('item_id',i.item_id,'name',i.item_name,'qty',i.qty,
                                                               'bound',i.bound,'rarity',i.rarity,'category',i.category)
                                             ORDER BY i.line_no)
                            FROM public_ledger.kill_drop_items i WHERE i.combat_id = k.combat_id), '[]'::jsonb)
       ) AS drops,
       a.city_id AS attacker_city, v.city_id AS victim_city,
       jsonb_build_object('weight', COALESCE(w.weight, 0), 'victim_rank_snapshot', w.victim_rank_snapshot,
                          'band_label', w.band_label, 'cross_city', COALESCE(w.cross_city, false),
                          'rules_version', w.rules_version) AS ek
FROM public_ledger.kills k
JOIN public_ledger.characters a ON a.pubkey = k.attacker_pubkey
JOIN public_ledger.characters v ON v.pubkey = k.victim_pubkey
LEFT JOIN public_ledger.kill_drops d ON d.combat_id = k.combat_id
LEFT JOIN LATERAL (
  SELECT kw.* FROM public_ledger.kill_weights kw JOIN public_ledger.ek_rules_versions rv ON rv.version = kw.rules_version
  WHERE kw.combat_id = k.combat_id AND rv.effective_from <= k.killed_at
  ORDER BY rv.effective_from DESC LIMIT 1
) w ON true;

-- ============================== PRIVATE SLICE ==============================
-- Location is NEVER on-chain (not even hashed/encrypted: small map set => brute-forceable).
CREATE TABLE internal_ops.kill_location (
  combat_id   text PRIMARY KEY CHECK (combat_id ~ '^[0-9a-f]{64}$'),  -- joins logically to public_ledger.kills
  map_id      text NOT NULL,
  x           int  NOT NULL,
  y           int  NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
-- (No FK to public_ledger on purpose: location is written by the game server at kill time,
--  before the on-chain batch is indexed. Orphans are cleaned by a retention job.)

-- Append-only audit log of every staff read of location data.
CREATE TABLE internal_ops.audit_log (
  id            bigserial PRIMARY KEY,
  at            timestamptz NOT NULL DEFAULT now(),
  actor_sub     text NOT NULL,           -- OIDC subject
  actor_email   text,
  actor_ip      inet NOT NULL,
  action        text NOT NULL,           -- e.g. 'list_full_kills', 'investigation_flags'
  params        jsonb NOT NULL DEFAULT '{}'::jsonb,
  rows_returned int NOT NULL DEFAULT 0
);
CREATE OR REPLACE FUNCTION internal_ops.audit_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'internal_ops.audit_log is append-only'; END $$;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE OR TRUNCATE ON internal_ops.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION internal_ops.audit_log_immutable();

-- The join lives ONLY in internal_ops.
CREATE VIEW internal_ops.v_kill_full AS
SELECT p.*, l.map_id, l.x, l.y, l.recorded_at AS location_recorded_at
FROM public_ledger.v_kills_public p
LEFT JOIN internal_ops.kill_location l ON l.combat_id = p.combat_id;

-- READ-ONLY payout preview (emitir = false). No money movement anywhere. p_rate_per_ek has NO default on purpose:
-- pass NULL to get EK sums + NULL amounts (formula only). Only closed (frozen) periods.
CREATE FUNCTION internal_ops.payout_preview(p_period_id text, p_rate_per_ek numeric)
RETURNS TABLE (pubkey text, name text, ek_sum numeric, rules_version text, preview_amount numeric, emitir boolean)
LANGUAGE plpgsql STABLE AS $$
#variable_conflict use_column
DECLARE p public_ledger.payout_periods;
BEGIN
  SELECT * INTO p FROM public_ledger.payout_periods pp WHERE pp.period_id = p_period_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown period %', p_period_id; END IF;
  IF p.closed_at IS NULL THEN RAISE EXCEPTION 'period % not closed: preview only on closed, frozen periods', p_period_id; END IF;
  RETURN QUERY
    SELECT w.attacker_pubkey, c.name, sum(w.weight), p.rules_version, sum(w.weight) * p_rate_per_ek, false
    FROM public_ledger.kill_weights w JOIN public_ledger.characters c ON c.pubkey = w.attacker_pubkey
    WHERE w.rules_version = p.rules_version AND w.killed_at >= p.period_start AND w.killed_at < p.period_end AND w.weight > 0
    GROUP BY w.attacker_pubkey, c.name
    ORDER BY sum(w.weight) DESC, w.attacker_pubkey COLLATE "C";
END $$;

-- ============================== GRANTS ==============================
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public_ledger FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA internal_ops FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_ledger.city_ranking(text, timestamptz, int) TO viewer_ro, ops_admin, ledger_indexer;
GRANT EXECUTE ON FUNCTION public_ledger.recompute_weights(text, timestamptz, timestamptz), public_ledger.assert_bands_valid(text) TO ledger_indexer;
GRANT EXECUTE ON FUNCTION internal_ops.payout_preview(text, numeric) TO ops_admin;
-- close_payout_period: owner/migration role only (deliberately not granted).
-- viewer_ro: SELECT on public_ledger only. No USAGE on internal_ops at all.
GRANT USAGE  ON SCHEMA public_ledger TO viewer_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public_ledger TO viewer_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public_ledger GRANT SELECT ON TABLES TO viewer_ro;
REVOKE ALL ON SCHEMA internal_ops FROM viewer_ro;

-- ops_admin: read both; may only INSERT into audit_log (no UPDATE/DELETE anywhere).
GRANT USAGE  ON SCHEMA public_ledger, internal_ops TO ops_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA public_ledger TO ops_admin;
GRANT SELECT ON internal_ops.kill_location, internal_ops.v_kill_full, internal_ops.audit_log TO ops_admin;
GRANT INSERT ON internal_ops.audit_log TO ops_admin;
GRANT USAGE  ON SEQUENCE internal_ops.audit_log_id_seq TO ops_admin;

-- writers
GRANT USAGE ON SCHEMA public_ledger TO ledger_indexer;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public_ledger TO ledger_indexer;
GRANT DELETE ON public_ledger.kill_weights TO ledger_indexer;  -- recompute_weights rebuilds rows (frozen periods protected by trigger)
GRANT USAGE ON SCHEMA internal_ops TO game_server_ops;
GRANT INSERT ON internal_ops.kill_location TO game_server_ops;

-- Defense in depth: make sure no role accidentally inherits access via PUBLIC.
REVOKE ALL ON ALL TABLES IN SCHEMA internal_ops FROM PUBLIC;
