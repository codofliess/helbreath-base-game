/**
 * PRIVATE (internal_ops) types. STAFF/ADMIN SIDE ONLY.
 * Must never be imported from src/server/public/** or web/public/** (enforced by tests/import-boundary.test.ts).
 */
import type { PublicKill } from './public-types';

export interface KillLocation {
  combat_id: string;
  map_id: string;
  x: number;
  y: number;
  recorded_at: string;
}

export type FullKill = PublicKill & { location: Omit<KillLocation, 'combat_id'> | null };

export type FlagKind = 'repeated_pair' | 'victim_same_killer' | 'map_cluster' | 'loot_funneling' | 'top_rank_death_selling';

export interface InvestigationFlag {
  kind: FlagKind;
  severity: 'low' | 'medium' | 'high';
  attacker_name: string;
  victim_name: string;
  detail: string;
  combat_ids: string[];
  metrics: Record<string, number | string>;
}

export interface AuditEntry {
  id?: number;
  at: string;
  actor_sub: string;
  actor_email: string | null;
  actor_ip: string;
  action: string;
  params: Record<string, unknown>;
  rows_returned: number;
}
