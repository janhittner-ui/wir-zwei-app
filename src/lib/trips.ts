/** Reise-Helfer: Status, Zeitraum als Text, Countdown. */
import type { Trip } from '@/data/types';
import { diffDays, MONTHS, parse, today } from './dates';

export type TripStatus = 'wish' | 'upcoming' | 'now' | 'past';

const endOf = (tr: Trip) => tr.endDate ?? tr.startDate;

export function tripStatus(tr: Trip, now = new Date()): TripStatus {
  if (!tr.startDate) return 'wish';
  const d = today(now);
  if (diffDays(d, parse(tr.startDate)) > 0) return 'upcoming';
  if (diffDays(d, parse(endOf(tr)!)) >= 0) return 'now';
  return 'past';
}

/** Anzahl Tage inkl. An- und Abreisetag (1 bei Tagesausflug) */
export function tripDays(tr: Trip): number | null {
  if (!tr.startDate) return null;
  return diffDays(parse(tr.startDate), parse(endOf(tr)!)) + 1;
}

/** "1.–14. Juni 2027", "28. Juni – 3. Juli 2027", "30. Dez. 2026 – 2. Jan. 2027", "5. Mai 2027" */
export function tripRange(tr: Trip): string {
  if (!tr.startDate) return '';
  const a = parse(tr.startDate);
  const b = parse(endOf(tr)!);
  const full = (d: Date) => `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (+a === +b) return full(a);
  if (a.getFullYear() !== b.getFullYear()) return `${full(a)} – ${full(b)}`;
  if (a.getMonth() !== b.getMonth()) return `${a.getDate()}. ${MONTHS[a.getMonth()]} – ${full(b)}`;
  return `${a.getDate()}.–${full(b)}`;
}

/** "in 23 Tagen", "morgen geht's los", "Tag 3 von 14", "vorbei" */
export function tripCountdown(tr: Trip, now = new Date()): string {
  if (!tr.startDate) return 'Wunschziel';
  const d = today(now);
  const until = diffDays(d, parse(tr.startDate));
  if (until > 1) return `in ${until} Tagen`;
  if (until === 1) return 'morgen geht’s los';
  const status = tripStatus(tr, now);
  if (status === 'now') {
    const total = tripDays(tr)!;
    return total === 1 ? 'heute' : `Tag ${1 - until} von ${total}`;
  }
  return 'vorbei';
}

/** Geplante zuerst (nächste oben), dann Wunschziele (alphabetisch), dann vergangene (neueste oben) */
export function groupTrips(trips: Trip[], now = new Date()) {
  const planned = trips.filter((t) => ['upcoming', 'now'].includes(tripStatus(t, now))).sort((a, b) => a.startDate!.localeCompare(b.startDate!));
  const wishes = trips.filter((t) => !t.startDate).sort((a, b) => a.title.localeCompare(b.title, 'de'));
  const past = trips.filter((t) => tripStatus(t, now) === 'past').sort((a, b) => b.startDate!.localeCompare(a.startDate!));
  return { planned, wishes, past };
}

/** Die nächste (oder gerade laufende) Reise */
export const nextTrip = (trips: Trip[], now = new Date()) => groupTrips(trips, now).planned[0] ?? null;
