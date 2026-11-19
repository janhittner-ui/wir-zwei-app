/**
 * Zyklus-Vorhersage aus Beginn und Ende der bisherigen Perioden (nur Schätzung, keine Verhütungsmethode).
 *
 * - Zykluslänge: Durchschnitt der letzten bis zu 6 Abstände zwischen zwei Periodenbeginnen
 *   (nur plausible Abstände von 15 bis 60 Tagen), sonst 28 Tage.
 * - Periodendauer: Durchschnitt der eingetragenen Dauern, sonst 5 Tage.
 * - Eisprung: etwa 14 Tage vor der nächsten Periode; fruchtbar: 5 Tage davor bis 1 Tag danach.
 */
import type { CyclePeriod } from '@/data/types';

import { diffDays, parse, today, ymd } from './dates';

export const DEFAULT_CYCLE = 28;
export const DEFAULT_PERIOD = 5;
const LUTEAL = 14;

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const avg = (l: number[]) => Math.round(l.reduce((a, b) => a + b, 0) / l.length);

export interface CycleInfo {
  /** Anzahl eingetragener Perioden */
  count: number;
  cycleLength: number;
  periodLength: number;
  /** true, wenn die Längen aus euren Einträgen stammen (sonst Standardwerte) */
  learned: boolean;
  /** läuft gerade eine Periode? Tag 1 = erster Tag */
  ongoingDay: number | null;
  /** Tag im aktuellen Zyklus (1 = erster Periodentag) */
  cycleDay: number | null;
  nextStart: Date | null;
  /** Tage bis zur nächsten Periode (negativ = überfällig) */
  daysUntil: number | null;
  ovulation: Date | null;
  fertileStart: Date | null;
  fertileEnd: Date | null;
  fertileNow: boolean;
}

export function cycleInfo(periods: CyclePeriod[], now = new Date()): CycleInfo {
  const t = today(now);
  const list = [...periods].sort((a, b) => a.start.localeCompare(b.start));
  const gaps: number[] = [];
  for (let i = 1; i < list.length; i++) {
    const g = diffDays(parse(list[i - 1].start), parse(list[i].start));
    if (g >= 15 && g <= 60) gaps.push(g);
  }
  const lens = list.filter((p) => p.end).map((p) => diffDays(parse(p.start), parse(p.end!)) + 1);
  const cycleLength = gaps.length ? avg(gaps.slice(-6)) : DEFAULT_CYCLE;
  const periodLength = lens.length ? avg(lens.slice(-6)) : DEFAULT_PERIOD;
  const last = list[list.length - 1];
  const empty: CycleInfo = {
    count: list.length, cycleLength, periodLength, learned: gaps.length > 0, ongoingDay: null, cycleDay: null,
    nextStart: null, daysUntil: null, ovulation: null, fertileStart: null, fertileEnd: null, fertileNow: false,
  };
  if (!last) return empty;
  const ls = parse(last.start);
  const sinceLast = diffDays(ls, t);
  const lastEnd = last.end ? parse(last.end) : addDays(ls, periodLength - 1);
  // läuft gerade: Ende eingetragen und heute davor, oder ohne Ende innerhalb von 10 Tagen
  const ongoing = sinceLast >= 0 && (last.end ? t <= lastEnd : sinceLast < 10);
  const nextStart = addDays(ls, cycleLength);
  const ovulation = addDays(nextStart, -LUTEAL);
  const fertileStart = addDays(ovulation, -5);
  const fertileEnd = addDays(ovulation, 1);
  return {
    ...empty,
    ongoingDay: ongoing ? sinceLast + 1 : null,
    cycleDay: sinceLast >= 0 ? sinceLast + 1 : null,
    nextStart,
    daysUntil: diffDays(t, nextStart),
    ovulation,
    fertileStart,
    fertileEnd,
    fertileNow: t >= fertileStart && t <= fertileEnd,
  };
}

export type DayMark = 'period' | 'predicted' | 'fertile' | 'ovulation';

/**
 * Markierungen für die Monatsansicht: eingetragene Periodentage, vorhergesagte Perioden
 * und fruchtbare Tage für die nächsten Zyklen (ISO-Datum → Art).
 */
export function cycleMarks(periods: CyclePeriod[], now = new Date(), cycles = 4): Map<string, DayMark> {
  const map = new Map<string, DayMark>();
  if (!periods.length) return map;
  const info = cycleInfo(periods, now);
  const t = today(now);
  for (const p of periods) {
    const s = parse(p.start);
    // ohne Ende: bis heute (wenn sie läuft) bzw. typische Dauer
    const e = p.end ? parse(p.end) : addDays(s, Math.min(info.periodLength - 1, Math.max(0, diffDays(s, t))));
    for (let d = s; d <= e; d = addDays(d, 1)) map.set(ymd(d), 'period');
    if (!p.end && info.ongoingDay) {
      for (let d = addDays(e, 1); d <= addDays(s, info.periodLength - 1); d = addDays(d, 1)) if (!map.has(ymd(d))) map.set(ymd(d), 'predicted');
    }
  }
  if (!info.nextStart) return map;
  let start = info.nextStart;
  // überfällige Vorhersage nicht in die Vergangenheit malen
  if (start < t) start = t;
  for (let c = 0; c < cycles; c++) {
    const ns = addDays(start, c * info.cycleLength);
    const ov = addDays(ns, -LUTEAL);
    for (let d = addDays(ov, -5); d <= addDays(ov, 1); d = addDays(d, 1)) {
      const k = ymd(d);
      if (d >= t && !map.has(k)) map.set(k, ymd(d) === ymd(ov) ? 'ovulation' : 'fertile');
    }
    for (let i = 0; i < info.periodLength; i++) {
      const k = ymd(addDays(ns, i));
      if (!map.has(k)) map.set(k, 'predicted');
    }
  }
  return map;
}

/** Kurzer Satz, z. B. „Periode in etwa 12 Tagen“ */
export function cycleHeadline(i: CycleInfo): string {
  if (!i.count) return 'Noch nichts eingetragen';
  if (i.ongoingDay) return `Periode, Tag ${i.ongoingDay}`;
  if (i.daysUntil == null) return '';
  if (i.daysUntil < 0) return `Periode seit ${-i.daysUntil} ${-i.daysUntil === 1 ? 'Tag' : 'Tagen'} erwartet`;
  if (i.daysUntil === 0) return 'Periode heute erwartet';
  if (i.daysUntil === 1) return 'Periode etwa morgen';
  return `Periode in etwa ${i.daysUntil} Tagen`;
}
