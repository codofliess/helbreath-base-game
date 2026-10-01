// STAFF-ONLY UI. Built into dist/admin and served ONLY by the admin API host.
import { useEffect, useMemo, useState } from 'react';
import type { AuditEntry, FlagKind, FullKill, InvestigationFlag } from '../../src/shared/private-types';
import { EkBadge, LootChips, StatusChip } from '../public/components';
import { fmtTime, tzShort } from '../public/format';

const KIND_LABEL: Record<FlagKind, string> = {
  repeated_pair: 'Repeated pair kills', victim_same_killer: 'Same victim ← same killer',
  map_cluster: 'Kills clustered in one map spot', loot_funneling: 'Loot funneling (gold/item gifting)',
  top_rank_death_selling: 'Top-rank death selling (EK 3×/2×)',
};

export function AdminApp() {
  const [token, setToken] = useState(sessionStorage.getItem('ops_token') ?? '');
  const [tab, setTab] = useState<'flags' | 'kills' | 'audit' | 'payout'>('flags');
  const [payout, setPayout] = useState<any>(null);
  const [kills, setKills] = useState<FullKill[]>([]);
  const [flags, setFlags] = useState<InvestigationFlag[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [who, setWho] = useState<string>('');
  const [q, setQ] = useState(''); const [mapId, setMapId] = useState('');
  const [active, setActive] = useState<InvestigationFlag | null>(null);
  const [kindFilter, setKindFilter] = useState<FlagKind | ''>('');
  const [err, setErr] = useState('');

  const call = async <T,>(p: string): Promise<T> => {
    const r = await fetch(p, { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`${r.status} ${(await r.json().catch(() => ({}))).error ?? ''}`);
    return r.json();
  };
  const load = async () => {
    setErr('');
    try {
      sessionStorage.setItem('ops_token', token);
      const w = await call<{ staff: { sub: string; email: string | null } }>('/admin/api/whoami');
      setWho(w.staff.email ?? w.staff.sub);
      setFlags((await call<{ flags: InvestigationFlag[] }>('/admin/api/flags')).flags);
      setKills((await call<{ items: FullKill[] }>(`/admin/api/kills?limit=500&q=${encodeURIComponent(q)}&map_id=${encodeURIComponent(mapId)}`)).items);
      setPayout(await call<any>('/admin/api/payout-preview?period_id=SAMPLE-2026-09-A').catch((e) => ({ error: String(e) })));
      setAudit((await call<{ items: AuditEntry[] }>('/admin/api/audit')).items);
    } catch (e) { setErr(String(e)); }
  };
  useEffect(() => { if (token) void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hl = useMemo(() => new Set(active?.combat_ids ?? []), [active]);
  const shownKills = active ? kills.filter((k) => hl.has(k.combat_id)) : kills;
  const maps = useMemo(() => [...new Set(kills.map((k) => k.location?.map_id).filter(Boolean) as string[])].sort(), [kills]);
  const shownFlags = kindFilter ? flags.filter((f) => f.kind === kindFilter) : flags;

  return (
    <div className="page">
      <div className="ops-banner">STAFF ONLY · Every read of location data is written to internal_ops.audit_log {who && `· signed in as ${who}`}</div>
      <header className="hero">
        <div className="crest" aria-hidden>🜲</div>
        <div><h1>ChainLords <span>Ops · Kill Investigation</span></h1>
          <p className="sub">Private slice: map &amp; coordinates per combat_id (server DB only — never on-chain, never public).</p></div>
        <div className="tz">Local times · <b>{tzShort}</b></div>
      </header>
      <div className="token">
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Staff OIDC access token (Bearer)" aria-label="Staff token" />
        <button onClick={load}>Load</button>
      </div>
      {err && <p className="error">Error: {err}</p>}
      <div className="tabs">
        {(['flags', 'kills', 'payout', 'audit'] as const).map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
          {t === 'flags' ? `Flags (${flags.length})` : t === 'kills' ? `Full rows (${kills.length})` : t === 'payout' ? 'Payout preview' : `Audit log (${audit.length})`}</button>)}
      </div>

      {tab === 'flags' && (
        <section className="panel">
          <div className="panel-head"><h2>Investigation flags</h2>
            <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as FlagKind | '')}>
              <option value="">All kinds</option>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></div>
          <div className="flags">
            {shownFlags.map((f, i) => (
              <div key={i} className={`flag ${f.severity} ${active === f ? 'active' : ''}`} onClick={() => { setActive(active === f ? null : f); setTab('kills'); }}>
                <div className="kind"><span>{KIND_LABEL[f.kind]}</span><span>{f.severity}</span></div>
                <div className="pair">{f.attacker_name} → {f.victim_name}</div>
                <p>{f.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'kills' && (
        <section className="panel">
          <div className="panel-head">
            <h2>{active ? `Flag: ${KIND_LABEL[active.kind]} — ${active.attacker_name} → ${active.victim_name}` : 'Full kill rows (incl. location)'}</h2>
            {active && <button className="close" onClick={() => setActive(null)}>clear flag ✕</button>}
          </div>
          <div className="toolbar">
            <div className="search"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Character…" /></div>
            <select value={mapId} onChange={(e) => setMapId(e.target.value)}><option value="">All maps</option>{maps.map((m) => <option key={m}>{m}</option>)}</select>
            <button className="close" onClick={load}>Apply (audited)</button>
          </div>
          <div className="scroll">
            <table className="full">
              <thead><tr><th>Time</th><th>Attacker</th><th>Victim</th><th>Status</th><th>EK</th><th>Map (x,y)</th><th>Drops</th><th>combat_id</th></tr></thead>
              <tbody>{shownKills.map((k) => (
                <tr key={k.combat_id} className={hl.has(k.combat_id) ? 'hl' : ''}>
                  <td>{fmtTime(k.killed_at)}</td>
                  <td>{k.attacker_name} <span className="lvl">Lv {k.attacker_level}</span></td>
                  <td>{k.victim_name} <span className="lvl">Lv {k.victim_level}</span></td>
                  <td><StatusChip s={k.status} /></td>
                  <td><EkBadge ek={k.ek} /></td>
                  <td className="mapcell">{k.location ? `${k.location.map_id} (${k.location.x},${k.location.y})` : '—'}</td>
                  <td><LootChips drops={k.drops} compact /></td>
                  <td className="mono">{k.combat_id.slice(0, 10)}…</td>
                </tr>))}</tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'payout' && payout && (
        <section className="panel">
          <div className="panel-head"><h2>Payout preview — read-only (emitir = false)</h2><span className="count">{payout.period?.period_id} · rules {payout.rules_version}</span></div>
          {payout.error ? <p className="error">{payout.error}</p> : <>
            <p className="mono" style={{ fontSize: 12 }}>{payout.formula}</p>
            <p className="muted">rate_per_ek: <b>{payout.rate_per_ek ?? 'not set (no default) → amounts not computed'}</b>. No money movement exists in this system.</p>
            <table className="full"><thead><tr><th>Character</th><th>Σ EK (frozen)</th><th>Preview amount</th></tr></thead>
              <tbody>{payout.rows.slice(0, 40).map((r: any) => <tr key={r.pubkey}><td>{r.name}</td><td>{r.ek_sum}</td><td className="mono">{r.preview_amount ?? '— (rate × Σ EK)'}</td></tr>)}</tbody></table>
          </>}
        </section>
      )}

      {tab === 'audit' && (
        <section className="panel">
          <div className="panel-head"><h2>Audit log (append-only)</h2></div>
          <table className="full"><thead><tr><th>When</th><th>Who</th><th>IP</th><th>Action</th><th>Params</th><th>Rows</th></tr></thead>
            <tbody>{audit.map((a, i) => <tr key={i}><td>{fmtTime(a.at)}</td><td>{a.actor_email ?? a.actor_sub}</td><td className="mono">{a.actor_ip}</td>
              <td>{a.action}</td><td className="mono">{JSON.stringify(a.params)}</td><td>{a.rows_returned}</td></tr>)}</tbody></table>
        </section>
      )}
    </div>
  );
}
