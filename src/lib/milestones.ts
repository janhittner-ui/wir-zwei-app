/**
 * Meilensteine und besondere Tage: Jahrestage, runde Zahlen („1.000 Tage“) und eure eigenen
 * Meilensteine (Verlobung, Hochzeit, …) mit ihren Jahrestagen.
 */
import type { Milestone, MilestoneIcon } from '@/data/types';

import { diffDays, parse, rel, today } from './dates';

export const MILESTONE_ICONS: Record<MilestoneIcon, string> = {
  heart: '❤️', date: '🌹', kiss: '💋', travel: '✈️', home: '🏡', ring: '💍', wedding: '💒', baby: '👶', star: '⭐',
};
export const ICON_KEYS = Object.keys(MILESTONE_ICONS) as MilestoneIcon[];

/** Vorlagen zum schnellen Anlegen */
export const MILESTONE_PRESETS: { title: string; icon: MilestoneIcon }[] = [
  { title: 'Erstes Date', icon: 'date' },
  { title: 'Erster Kuss', icon: 'kiss' },
  { title: 'Erster gemeinsamer Urlaub', icon: 'travel' },
  { title: 'Zusammengezogen', icon: 'home' },
  { title: 'Verlobung', icon: 'ring' },
  { title: 'Hochzeit', icon: 'wedding' },
  { title: 'Nachwuchs', icon: 'baby' },
];

/** Runde Zahlen, die einen eigenen kleinen Moment verdienen */
const ROUND_DAYS = [100, 200, 300, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 7500, 8000, 9000, 10000, 12500, 15000, 20000];


/** 1000 → „1.000“ (unabhängig von der Sprache des Geräts) */
export const dots = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export interface SpecialDay {
  key: string;
  date: Date;
  /** Tage bis dahin (0 = heute) */
  days: number;
  title: string;
  emoji: string;
  /** zugehöriger Meilenstein, falls es einer ist */
  milestoneId?: string;
}

function nextYearly(start: Date, from: Date) {
  let d = new Date(from.getFullYear(), start.getMonth(), start.getDate());
  // 29. Februar: in Nicht-Schaltjahren am 28.
  if (start.getMonth() === 1 && start.getDate() === 29 && d.getMonth() !== 1) d = new Date(from.getFullYear(), 1, 28);
  if (d < from) {
    d = new Date(from.getFullYear() + 1, start.getMonth(), start.getDate());
    if (start.getMonth() === 1 && start.getDate() === 29 && d.getMonth() !== 1) d = new Date(from.getFullYear() + 1, 1, 28);
  }
  return d;
}

/**
 * Kommende besondere Tage innerhalb eines Jahres, nächster zuerst.
 * @param since „Zusammen seit“ (ISO) oder null
 */
export function specialDays(since: string | null, milestones: Milestone[], now = new Date()): SpecialDay[] {
  const t = today(now);
  const out: SpecialDay[] = [];
  if (since) {
    const s = parse(since);
    if (!isNaN(s.getTime()) && s <= t) {
      const total = diffDays(s, t);
      const an = nextYearly(s, t);
      const n = an.getFullYear() - s.getFullYear();
      if (n > 0) out.push({ key: 'anniv', date: an, days: diffDays(t, an), title: `${n}. Jahrestag`, emoji: '🥂' });
      const round = ROUND_DAYS.find((r) => r >= total);
      if (round) {
        const d = new Date(s.getFullYear(), s.getMonth(), s.getDate() + round);
        out.push({ key: `days-${round}`, date: d, days: round - total, title: `${dots(round)} Tage zusammen`, emoji: '✨' });
      }
    }
  }
  for (const m of milestones) {
    const d = parse(m.date);
    if (isNaN(d.getTime())) continue;
    const emoji = MILESTONE_ICONS[m.icon] ?? '❤️';
    if (d >= t) {
      out.push({ key: `m-${m.id}`, date: d, days: diffDays(t, d), title: m.title, emoji, milestoneId: m.id });
    } else {
      const an = nextYearly(d, t);
      const n = an.getFullYear() - d.getFullYear();
      const title = m.icon === 'wedding' ? `${n}. Hochzeitstag` : `${m.title} · ${n}. Jahrestag`;
      out.push({ key: `ma-${m.id}`, date: an, days: diffDays(t, an), title, emoji, milestoneId: m.id });
    }
  }
  return out.filter((x) => x.days >= 0 && x.days <= 366).sort((a, b) => a.days - b.days || a.title.localeCompare(b.title, 'de'));
}

/** Kurzer Satz für die Paar-Karte, z. B. „1.000 Tage zusammen in 12 Tagen“ oder „Heute: 3. Hochzeitstag!“ */
export function specialText(d: SpecialDay) {
  return d.days === 0 ? `Heute: ${d.title}!` : `${d.title} ${rel(d.days)}`;
}

/** Zeitleiste: älteste zuerst */
export const sortTimeline = (l: Milestone[]) => [...l].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
