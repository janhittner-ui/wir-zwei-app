/**
 * Rezept-Helfer: Zutatenzeilen lesen, Mengen auf andere Portionen umrechnen, Schritte aufteilen.
 * Eine Zutat pro Zeile, z. B. "200 g Mehl", "1/2 TL Salz", "1½ l Milch", "2-3 Zwiebeln", "Salz".
 * Zeilen mit Doppelpunkt am Ende ("Für die Soße:") sind Zwischenüberschriften.
 */
import type { Meal } from '@/data/types';

const FRAC: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
const NUM = String.raw`(?:\d+\s+\d+/\d+|\d+/\d+|\d+(?:[.,]\d+)?\s*[½¼¾⅓⅔⅛]?|[½¼¾⅓⅔⅛])`;
const UNITS = [
  'kg', 'g', 'mg', 'l', 'ml', 'cl', 'dl', 'el', 'tl', 'msp', 'prise(?:n)?', 'pck', 'pkg', 'päckchen', 'packung(?:en)?',
  'dose(?:n)?', 'becher', 'bund', 'stk', 'stück', 'scheibe(?:n)?', 'zehe(?:n)?', 'tasse(?:n)?', 'glas', 'gläser', 'handvoll',
  'zweig(?:e)?', 'blatt', 'blätter', 'tropfen', 'schuss', 'würfel', 'flasche(?:n)?', 'kugel(?:n)?', 'stange(?:n)?', 'knolle(?:n)?',
];
const LINE = new RegExp(String.raw`^(${NUM})(?:\s*[-–]\s*(${NUM}))?\s*(?:(${UNITS.join('|')})\.?(?=\s|$))?\s*(.*)$`, 'i');

export interface Ingredient {
  /** Die Zeile, wie sie eingegeben wurde */
  raw: string;
  /** Zwischenüberschrift, z. B. "Für die Soße" */
  heading?: boolean;
  amount: number | null;
  /** Obergrenze bei "2-3 Zwiebeln" */
  amountTo: number | null;
  unit: string | null;
  name: string;
}

function num(s: string): number {
  const t = s.replace(/\s+/g, ' ').trim();
  let m = t.match(/^(\d+) (\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = t.match(/^(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  m = t.match(/^(\d+(?:[.,]\d+)?)?\s*([½¼¾⅓⅔⅛])?$/);
  if (m) return (m[1] ? Number(m[1].replace(',', '.')) : 0) + (m[2] ? FRAC[m[2]] : 0);
  return NaN;
}

export function parseIngredient(line: string): Ingredient {
  const raw = line.trim();
  if (/:$/.test(raw)) return { raw, heading: true, amount: null, amountTo: null, unit: null, name: raw.slice(0, -1).trim() };
  const m = raw.match(LINE);
  if (m) {
    const amount = num(m[1]);
    const amountTo = m[2] ? num(m[2]) : null;
    if (Number.isFinite(amount) && amount > 0 && m[4]) {
      return { raw, amount, amountTo: amountTo && Number.isFinite(amountTo) ? amountTo : null, unit: m[3] ?? null, name: m[4].trim() };
    }
  }
  return { raw, amount: null, amountTo: null, unit: null, name: raw };
}

export function parseIngredients(text: string): Ingredient[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map(parseIngredient);
}

/** Zahl hübsch auf Deutsch: 0.5 → "½", 1.5 → "1½", 2.25 → "2¼", 0.3 → "0,3", 12.4 → "12" */
export function formatAmount(n: number): string {
  if (n >= 10) return String(Math.round(n));
  const whole = Math.floor(n);
  const rest = n - whole;
  for (const [ch, v] of Object.entries(FRAC)) {
    if (ch === '⅛') continue;
    if (Math.abs(rest - v) < 0.03) return `${whole || ''}${ch}`;
  }
  if (rest < 0.03) return String(whole);
  if (rest > 0.97) return String(whole + 1);
  return String(Math.round(n * 10) / 10).replace('.', ',');
}

/** Große Mengen in die nächste Einheit: 1500 g → 1,5 kg, 1000 ml → 1 l */
function tidyUnit(amount: number, to: number | null, unit: string | null) {
  const u = unit?.toLowerCase();
  if ((u === 'g' || u === 'ml') && amount >= 1000) {
    return { amount: amount / 1000, to: to ? to / 1000 : null, unit: u === 'g' ? 'kg' : 'l' };
  }
  return { amount, to, unit };
}

/** Menge als Text, z. B. "300 g" oder "2-3" (null, wenn die Zeile keine Menge hat) */
export function amountText(ing: Ingredient, factor = 1): string | null {
  if (ing.amount == null) return null;
  const { amount, to, unit } = tidyUnit(ing.amount * factor, ing.amountTo != null ? ing.amountTo * factor : null, ing.unit);
  const a = formatAmount(amount) + (to != null ? `-${formatAmount(to)}` : '');
  return unit ? `${a} ${unit}` : a;
}

/** Ganze Zeile umgerechnet, z. B. "300 g Mehl" */
export function scaleLine(ing: Ingredient, factor = 1): string {
  if (ing.heading || ing.amount == null || factor === 1) return ing.heading ? ing.name : ing.raw;
  return `${amountText(ing, factor)} ${ing.name}`;
}

/** Für die Einkaufsliste: Name als Text, Menge separat */
export function toShopping(ing: Ingredient, factor = 1): { text: string; qty: string | null } {
  return { text: ing.name.slice(0, 120), qty: amountText(ing, factor)?.slice(0, 30) ?? null };
}

/** Schritte: eine Zeile = ein Schritt; Nummerierung wie "1." oder "2)" am Anfang wird entfernt */
export function parseSteps(text: string): string[] {
  return text.split('\n').map((l) => l.trim().replace(/^(\d{1,2}[.)]|[-•*])\s+/, '')).filter(Boolean);
}

/** "75" → "1 Std. 15 Min." */
export function formatMinutes(m: number): string {
  if (m < 60) return `${m} Min.`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} Std. ${r} Min.` : `${h} Std.`;
}

/** Mahlzeiten in fester Reihenfolge, mit Namen für Auswahl und Filter */
export const MEALS: { key: Meal; label: string; short: string }[] = [
  { key: 'fruehstueck', label: 'Frühstück', short: 'Frühstück' },
  { key: 'mittag', label: 'Mittagessen', short: 'Mittag' },
  { key: 'abend', label: 'Abendessen', short: 'Abend' },
];

/** ["mittag", "abend"] → "Mittagessen · Abendessen" */
export function mealsText(meals: Meal[]): string {
  return MEALS.filter((m) => meals.includes(m.key)).map((m) => m.label).join(' · ');
}
