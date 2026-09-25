import type { ItemCategory, KillDrops, KillStatus, PublicEk, PublicKill } from '../../src/shared/public-types';
import { COPY } from './copy';
import { fmtDay, fmtTime, fmtZem, localDayKey } from './format';

export function StatusChip({ s }: { s: KillStatus }) {
  const { label, hint } = COPY.statuses[s];
  return <span className={`status status-${s}`} title={hint}>{label}</span>;
}

const ICON: Record<ItemCategory, string> = { weapon: '⚔', armor: '🛡', jewel: '💍', potion: '⚗', scroll: '📜', material: '🜨' };
export function LootChips({ drops, compact = false, revealed = true, lootDelay = '{delay}' }: { drops: KillDrops; compact?: boolean; revealed?: boolean; lootDelay?: string }) {
  if (!revealed) {
    return <div className="loot"><span className="chip chip-empty" title={COPY.lootDelayLine(lootDelay)}>{COPY.lootDelayLine(lootDelay)}</span></div>;
  }
  const none = !drops.zem.dropped && drops.items.length === 0;
  return (
    <div className="loot">
      {none && <span className="chip chip-empty">{COPY.noLoot}</span>}
      {drops.zem.dropped && (
        <span className="chip chip-zem" title={`${fmtZem(drops.zem.amount)} Zem dropped`}>
          <span className="ico">◆</span>{fmtZem(drops.zem.amount)}{!compact && ' Zem'}
        </span>
      )}
      {drops.items.map((i, n) => (
        <span key={n} className={`chip chip-${i.rarity}`} title={`${i.name} ×${i.qty}${i.bound ? ` · ${COPY.bound}` : ''}`}>
          <span className="ico">{ICON[i.category] ?? '✦'}</span>
          {i.name}{i.qty > 1 && <b>×{i.qty}</b>}{i.bound && <span className="bound" aria-label={COPY.bound} title={COPY.bound}>⛓</span>}
        </span>
      ))}
    </div>
  );
}

export function EkBadge({ ek }: { ek: PublicEk }) {
  const tier = ek.weight === 0 ? 'zero' : ek.weight >= 3 ? 'top10' : ek.weight >= 2 ? 'top30' : 'base';
  const why = ek.weight === 0 ? "This kill doesn't count toward kill score"
    : ek.cross_city ? `${ek.band_label ?? ''}: victim was #${ek.victim_rank_snapshot ?? '—'} in their city when they fell`
    : 'Same-city kill (value unset until the owner decides)';
  return (
    <span className={`ek ek-${tier}`} title={why}>
      <b>×{ek.weight}</b>{ek.weight >= 2 && <span>{ek.band_label}</span>}
      {ek.weight >= 2 && ek.victim_rank_snapshot !== null && <i>#{ek.victim_rank_snapshot}</i>}
    </span>
  );
}

export function Name({ name, level, onPick }: { name: string; level: number; onPick: (n: string) => void }) {
  return (
    <button className="name" onClick={() => onPick(name)} title={`View ${name}`}>
      {name} <span className="lvl">Lv {level}</span>
    </button>
  );
}

export function KillRow({ k, onPick, perspective, lootDelay }: { k: PublicKill; onPick: (n: string) => void; perspective?: 'death' | 'kill'; lootDelay?: string }) {
  return (
    <li className={`kill ${perspective ? 'p-' + perspective : ''}`}>
      <div className="when">
        <time dateTime={k.killed_at}>{fmtTime(k.killed_at)}</time>
        <span className="day">day {k.day} UTC</span>
      </div>
      <div className="who">
        <Name name={k.attacker_name} level={k.attacker_level} onPick={onPick} />
        <span className="slew" aria-hidden>⟶ slew ⟶</span>
        <Name name={k.victim_name} level={k.victim_level} onPick={onPick} />
      </div>
      <div className="badges"><EkBadge ek={k.ek} /><StatusChip s={k.status} /></div>
      <LootChips drops={k.drops} revealed={k.loot_revealed} lootDelay={lootDelay} />
    </li>
  );
}

export function DeathsChart({ deaths, days = 14 }: { deaths: PublicKill[]; days?: number }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (days - 1 - i));
    return { d, key: localDayKey(d), n: 0 };
  });
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  deaths.forEach((k) => { const i = idx.get(localDayKey(new Date(k.killed_at))); if (i !== undefined) buckets[i].n++; });
  const max = Math.max(1, ...buckets.map((b) => b.n));
  const W = 28, H = 90;
  return (
    <figure className="chart">
      <svg viewBox={`0 -14 ${days * W} ${H + 36}`} role="img" aria-label="Deaths per day, last 14 days">
        {buckets.map((b, i) => {
          const h = (b.n / max) * H;
          return (
            <g key={b.key}>
              <title>{`${fmtDay(b.d)}: ${b.n} death${b.n === 1 ? '' : 's'}`}</title>
              <rect x={i * W + 5} y={H - h} width={W - 10} height={Math.max(h, 1.5)} rx="2" className={b.n ? 'bar' : 'bar bar-zero'} />
              {b.n > 0 && <text x={i * W + W / 2} y={H - h - 4} className="bar-n">{b.n}</text>}
              <text x={i * W + W / 2} y={H + 15} className="bar-l">{b.d.getDate()}</text>
            </g>
          );
        })}
      </svg>
      <figcaption>Deaths per day · last {days} days (your local days)</figcaption>
    </figure>
  );
}
