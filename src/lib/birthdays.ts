/** Rechnet aus, wann jemand als Nächstes Geburtstag hat und wie alt er/sie wird. */
import type { Birthday } from '@/data/types';
import { diffDays, today } from './dates';

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Der Geburtstag in einem bestimmten Jahr. Wer am 29.2. geboren ist, feiert sonst am 28.2. */
export function birthdayIn(b: Pick<Birthday, 'month' | 'day'>, year: number): Date {
  const day = b.month === 2 && b.day === 29 && !isLeap(year) ? 28 : b.day;
  return new Date(year, b.month - 1, day);
}

export function nextBirthday(b: Birthday, now = new Date()) {
  const t = today(now);
  let date = birthdayIn(b, t.getFullYear());
  if (date < t) date = birthdayIn(b, t.getFullYear() + 1);
  const age = b.year ? date.getFullYear() - b.year : null;
  return { date, days: diffDays(t, date), age: age && age > 0 ? age : null };
}

/** Nach dem nächsten Termin sortiert, mit Datum und Alter. */
export function upcomingBirthdays(list: Birthday[], now = new Date()) {
  return list.map((b) => ({ ...b, ...nextBirthday(b, now) })).sort((a, b) => a.days - b.days || a.name.localeCompare(b.name, 'de'));
}

/** Für Suche: Groß/klein und Akzente egal */
export const searchKey = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
