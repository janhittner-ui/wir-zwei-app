/** Datums-Helfer (deutsch). Alles in lokaler Zeit, Datumswerte als "JJJJ-MM-TT". */
import { VERSES } from './verses';

export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const MSHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const WD_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const today = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), now.getDate());
export const diffDays = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 864e5);
export const rel = (n: number) =>
  n === 0 ? 'heute' : n === 1 ? 'morgen' : n === -1 ? 'gestern' : n > 0 ? `in ${n} Tagen` : `vor ${-n} Tagen`;

/** "Mittwoch, 18. November" */
export const longDay = (d: Date) => `${WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
/** "18. November 2026" */
export const fullDate = (d: Date) => `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
/** "TT.MM.JJJJ" ↔ ISO, für Eingabefelder */
export const toGerman = (iso: string | null) => (iso ? iso.split('-').reverse().join('.') : '');
export function fromGerman(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? `${m[3]}-${pad(+m[2])}-${pad(+m[1])}` : null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Wie lange zusammen: Jahre/Monate/Tage, Gesamttage und nächster Jahrestag. */
export function together(sinceIso: string, now = new Date()) {
  const s = parse(sinceIso);
  const t = today(now);
  if (isNaN(s.getTime()) || s > t) return null;
  let y = t.getFullYear() - s.getFullYear();
  let m = t.getMonth() - s.getMonth();
  let d = t.getDate() - s.getDate();
  if (d < 0) {
    m--;
    d += new Date(t.getFullYear(), t.getMonth(), 0).getDate();
  }
  if (m < 0) {
    y--;
    m += 12;
  }
  let an = new Date(t.getFullYear(), s.getMonth(), s.getDate());
  if (an < t) an = new Date(t.getFullYear() + 1, s.getMonth(), s.getDate());
  const parts: string[] = [];
  if (y) parts.push(plural(y, 'Jahr', 'Jahre'));
  if (m) parts.push(plural(m, 'Monat', 'Monate'));
  if (d || !parts.length) parts.push(plural(d, 'Tag', 'Tage'));
  const text = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' und ' + parts[parts.length - 1] : parts[0];
  const annivN = an.getFullYear() - s.getFullYear();
  const annivIn = diffDays(t, an);
  const anniv = annivIn === 0 && annivN > 0 ? `Heute ist euer ${annivN}. Jahrestag!` : annivN > 0 ? `${annivN}. Jahrestag ${rel(annivIn)}` : '';
  return { y, m, d, total: diffDays(s, t), text, anniv };
}

/** Der Vers wechselt um Mitternacht deutscher Zeit, auf beiden Handys gleich. */
export function berlinYMD(now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return ymd(now);
  }
}
export function dayVerse(now = new Date()) {
  const [by, bm, bd] = berlinYMD(now).split('-').map(Number);
  const dayNum = Math.floor(Date.UTC(by, bm - 1, bd) / 864e5);
  return VERSES[(((dayNum * 31 + 7) % VERSES.length) + VERSES.length) % VERSES.length];
}

/** Kalender-Raster: Wochen ab Montag, null = Tag außerhalb des Monats. */
export function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export const cmpEvent = (a: { date: string; time: string | null }, b: { date: string; time: string | null }) =>
  (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99'));
