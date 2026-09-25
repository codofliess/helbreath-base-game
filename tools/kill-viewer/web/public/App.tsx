import { useEffect, useMemo, useState } from 'react';
import type { CharacterResponse, CharacterSummary, KillListResponse, KillStatus, RankingsResponse } from '../../src/shared/public-types';
import { api, type PublicConfig } from './apiClient';
import { DeathsChart, KillRow } from './components';
import { COPY } from './copy';
import { fmtZem, tzShort, viewerTz } from './format';

const nameFromHash = () => decodeURIComponent(window.location.hash.match(/^#\/c\/(.+)$/)?.[1] ?? '');
const isRankings = () => window.location.hash.startsWith('#/rankings');

export function App() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<KillStatus | ''>('');
  const [list, setList] = useState<(KillListResponse & PublicConfig) | null>(null);
  const [offset, setOffset] = useState(0);
  const [suggest, setSuggest] = useState<CharacterSummary[]>([]);
  const [selected, setSelected] = useState(nameFromHash());
  const [char, setChar] = useState<CharacterResponse | null>(null);
  const [err, setErr] = useState('');
  const [route, setRoute] = useState(isRankings() ? 'rankings' : 'ledger');
  const [cities, setCities] = useState<Record<string, string>>({});
  const [cfg, setCfg] = useState<PublicConfig | null>(null);

  useEffect(() => { api.health().then(setCfg).catch(() => {}); }, []);
  useEffect(() => { api.cities().then((r) => setCities(Object.fromEntries(r.items.map((c) => [c.city_id, c.name])))).catch(() => {}); }, []);
  useEffect(() => { const f = () => setRoute(isRankings() ? 'rankings' : 'ledger'); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  useEffect(() => { const f = () => setSelected(nameFromHash()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  useEffect(() => { setOffset(0); }, [q, status]);
  useEffect(() => {
    const t = setTimeout(() => {
      api.kills(q, status, offset).then(setList).catch((e) => setErr(String(e)));
      api.characters(q).then((r) => setSuggest(r.items)).catch(() => {});
    }, 180);
    return () => clearTimeout(t);
  }, [q, status, offset]);
  useEffect(() => {
    if (!selected) { setChar(null); return; }
    api.character(selected).then(setChar).catch(() => setChar(null));
  }, [selected]);

  const pick = (n: string) => { window.location.hash = `#/c/${encodeURIComponent(n)}`; window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const sample = list?.sample || char?.sample || cfg?.sample;
  const onchain = cfg?.onchain_deployed ?? list?.onchain_deployed ?? false;
  const delay = cfg?.delay_phrase ?? list?.delay_phrase ?? '{delay}';
  const lootDelay = cfg?.loot_delay_phrase ?? list?.loot_delay_phrase ?? '{delay}';

  return (
    <div className="page">
      {sample && <div className="sample-banner">{COPY.sampleBanner}</div>}
      <header className="hero">
        <div className="crest" aria-hidden>⚔</div>
        <div>
          <h1>ChainLords <span>Kill Ledger</span></h1>
          <p className="sub">{onchain ? COPY.subtitleOnchain : COPY.subtitle}</p>
          <p className="sub delay">{COPY.delayLine(delay)}</p>
        </div>
        <div className="tz" title={viewerTz}>Times in your local zone · <b>{tzShort}</b></div>
      </header>

      <nav className="nav">
        <a href="#/" className={route === 'ledger' ? 'on' : ''}>⚔ Kill Ledger</a>
        <a href="#/rankings" className={route === 'rankings' ? 'on' : ''}>🏰 City Rankings</a>
      </nav>

      {route === 'rankings' ? <Rankings onPick={pick} /> : <>
      <section className="toolbar">
        <div className="search">
          <span aria-hidden>🔍</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={COPY.search} aria-label={COPY.search} maxLength={32} />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as KillStatus | '')} aria-label="Filter by status">
          <option value="">All outcomes</option>
          <option value="credited">{COPY.statuses.credited.label}</option>
          <option value="pair_limit_reached">{COPY.statuses.pair_limit_reached.label}</option>
          <option value="kill_burned">{COPY.statuses.kill_burned.label}</option>
          <option value="rejected_level_gap">{COPY.statuses.rejected_level_gap.label}</option>
        </select>
      </section>

      {q && suggest.length > 0 && (
        <nav className="roster" aria-label="Matching characters">
          {suggest.map((c) => (
            <button key={c.pubkey} className="hero-card" onClick={() => pick(c.name)}>
              <b>{c.name}</b><span>{cities[c.city_id ?? ''] ?? '—'} · Lv {c.level} · {c.kills_credited} {COPY.statKills.toLowerCase()} · {c.ek_total} {COPY.statKillScore.toLowerCase()} · {c.deaths} {COPY.statDeaths.toLowerCase()}</span>
            </button>
          ))}
        </nav>
      )}

      {char && <CharacterPanel data={char} cities={cities} onPick={pick} lootDelay={lootDelay} onClose={() => { window.location.hash = ''; }} />}

      <section className="panel">
        <div className="panel-head">
          <h2>{q ? `Ledger entries for “${q}”` : 'Latest kills across the realm'}</h2>
          <span className="count">{list ? `${list.total} entries` : '…'}</span>
        </div>
        {err && <p className="error">Could not reach the ledger ({err}).</p>}
        <ul className="kills">{list?.items.map((k) => <KillRow key={k.combat_id} k={k} onPick={pick} lootDelay={lootDelay} />)}</ul>
        {list && list.total > 40 && (
          <div className="pager">
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 40))}>‹ Newer</button>
            <span>{offset + 1}–{Math.min(offset + 40, list.total)}</span>
            <button disabled={offset + 40 >= list.total} onClick={() => setOffset(offset + 40)}>Older ›</button>
          </div>
        )}
      </section>

      </>}

      <footer>{onchain ? COPY.footerOnchain : COPY.footer}</footer>
    </div>
  );
}

function CharacterPanel({ data, cities, onPick, onClose, lootDelay }: { data: CharacterResponse; cities: Record<string, string>; onPick: (n: string) => void; onClose: () => void; lootDelay: string }) {
  const { character: c, deaths, kills } = data;
  const lootTaken = useMemo(() => kills.reduce((s, k) => s + (k.loot_revealed && k.drops.zem.dropped ? k.drops.zem.amount : 0), 0), [kills]);
  return (
    <section className="panel character">
      <div className="panel-head">
        <h2><span className="crest-sm">🛡</span>{c.name} <span className="lvl">Lv {c.level}</span></h2>
        <button className="close" onClick={onClose} aria-label="Close character">✕</button>
      </div>
      <div className="char-grid">
        <div className="stats">
          <div className="city">🏰 <b>{cities[c.city_id ?? ''] ?? 'No city'}</b> · {c.city_rank ? COPY.rank(c.city_rank) : COPY.unranked}</div>
          <div><b>{c.kills_credited}</b><span>{COPY.statKills}</span></div>
          <div><b>{c.ek_total}</b><span>{COPY.statKillScore}</span></div>
          <div><b>{c.deaths}</b><span>{COPY.statDeaths}</span></div>
          <div><b>{fmtZem(lootTaken)}</b><span>{COPY.statZemLooted}</span></div>
          <div><b>{kills.filter((k) => k.ek.weight >= 3).length}</b><span>{COPY.statTop10}</span></div>
          <div><b>{kills.filter((k) => k.ek.weight === 2).length}</b><span>{COPY.statTop30}</span></div>
        </div>
        <DeathsChart deaths={deaths} />
      </div>
      <div className="cols">
        <div>
          <h3>☠ Slain by</h3>
          {deaths.length === 0 ? <p className="muted">{COPY.neverFallen}</p> :
            <ul className="kills">{deaths.map((k) => <KillRow key={k.combat_id} k={k} onPick={onPick} perspective="death" lootDelay={lootDelay} />)}</ul>}
        </div>
        <div>
          <h3>⚔ Kills made</h3>
          {kills.length === 0 ? <p className="muted">{COPY.noKillsYet}</p> :
            <ul className="kills">{kills.map((k) => <KillRow key={k.combat_id} k={k} onPick={onPick} perspective="kill" lootDelay={lootDelay} />)}</ul>}
        </div>
      </div>
    </section>
  );
}

function Rankings({ onPick }: { onPick: (n: string) => void }) {
  const [r, setR] = useState<RankingsResponse | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.rankings().then(setR).catch((e) => setErr(String(e))); }, []);
  if (err) return <p className="error">Could not load rankings ({err}).</p>;
  if (!r) return <p className="muted">Loading rankings…</p>;
  const bandOf = (rank: number) => r.rules.bands.find((b) => rank >= b.rank_from && (b.rank_to === null || rank <= b.rank_to));
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{COPY.rankingsTitle}</h2>
        <span className="count">{COPY.rankingsWindow}</span>
      </div>
      <div className="legend">{COPY.explainer}</div>
      <div className="rank-grid">
        {r.cities.map((c) => (
          <div key={c.city_id}>
            <h3><span className="city-crest">🏰</span> {c.city_name}</h3>
            <table className="rank-table">
              <thead><tr><th>#</th><th>Character</th><th className="num">{COPY.colKills}</th><th className="num">{COPY.colKillScore}</th><th>{COPY.colWorth}</th></tr></thead>
              <tbody>
                {c.rows.map((row) => {
                  const b = bandOf(row.rank);
                  const cls = `${row.weighted_ek !== undefined && b && b.weight >= 3 ? 'band-top10' : b && b.weight >= 2 ? 'band-top30' : ''}${row.rank === 11 ? ' band-sep' : ''}`;
                  return (
                    <tr key={row.pubkey} className={cls}>
                      <td>{row.rank}</td>
                      <td><button className="name" onClick={() => onPick(row.name)}>{row.name}</button> <span className="lvl">Lv {row.level}</span></td>
                      <td className="num">{row.credited_kills}</td>
                      <td className="num ekv">{row.weighted_ek}</td>
                      <td>{b && <span className={`ek ek-${b.weight >= 3 ? 'top10' : b.weight >= 2 ? 'top30' : 'base'}`}><b>×{b.weight}</b></span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12 }}>As of {new Date(r.cities[0]?.as_of ?? Date.now()).toLocaleString()} ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p>
    </section>
  );
}
