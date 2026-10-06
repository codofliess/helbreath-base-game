const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const dtf = new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
export const viewerTz = tz;
export const tzShort = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? tz;
export const fmtTime = (iso: string) => dtf.format(new Date(iso));
export const fmtDay = (d: Date) => dayFmt.format(d);
/** Local calendar day key (viewer timezone). */
export const localDayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fmtZem = (n: number) => n.toLocaleString();
