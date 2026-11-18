/**
 * Prüfungen, die exakt den Regeln der Datenbank entsprechen (supabase/migrations).
 * Die App prüft vorher, damit Jan & Vanessa eine verständliche Meldung bekommen statt eines Serverfehlers.
 */
import type { EventInput, PersonColor, ShoppingInput } from './types';

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputError';
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** "9:5", "9.30", "0930", "19 30" → "09:30"; leer → null; Unsinn → Fehler */
export function normalizeTime(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})\s*[:.\s]\s*(\d{1,2})$/);
  if (!m) m = s.match(/^(\d{2})(\d{2})$/);
  if (!m) m = s.match(/^(\d{1,2})$/) ? [s, s, '0'] : null;
  if (!m) throw new InputError('Die Uhrzeit bitte so eingeben: 19:30');
  const t = `${m[1].padStart(2, '0')}:${m[2].padStart(2, '0')}`;
  if (!TIME.test(t)) throw new InputError('Die Uhrzeit bitte so eingeben: 19:30');
  return t;
}

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const optional = (s: string | null | undefined) => clean(s) || null;

export function checkDisplayName(name: string): string {
  const n = clean(name);
  if (n.length < 1) throw new InputError('Bitte gib deinen Namen ein.');
  if (n.length > 40) throw new InputError('Der Name darf höchstens 40 Zeichen haben.');
  return n;
}

export function checkColor(c: string): PersonColor {
  if (c !== 'blue' && c !== 'pink') throw new InputError('Unbekannte Farbe.');
  return c;
}

export function checkEvent(e: EventInput): EventInput {
  const title = clean(e.title);
  if (!title) throw new InputError('Bitte gib dem Termin einen Titel.');
  if (title.length > 120) throw new InputError('Der Titel darf höchstens 120 Zeichen haben.');
  if (!isValidDate(e.date)) throw new InputError('Das Datum ist ungültig.');
  const note = (e.note ?? '').trim() || null;
  if (note && note.length > 500) throw new InputError('Die Notiz darf höchstens 500 Zeichen haben.');
  return { title, date: e.date, time: normalizeTime(e.time), note, who: e.who || null };
}

export function checkShopping(i: ShoppingInput): ShoppingInput {
  const text = clean(i.text);
  if (!text) throw new InputError('Was soll auf die Liste?');
  if (text.length > 120) throw new InputError('Höchstens 120 Zeichen bitte.');
  const qty = optional(i.qty);
  if (qty && qty.length > 30) throw new InputError('Die Menge darf höchstens 30 Zeichen haben.');
  return { text, qty };
}

export function checkCouple(p: { togetherSince: string | null; names: string | null }) {
  const names = optional(p.names);
  if (names && names.length > 60) throw new InputError('Die Namen dürfen höchstens 60 Zeichen haben.');
  const since = p.togetherSince || null;
  if (since) {
    if (!isValidDate(since)) throw new InputError('Das Datum ist ungültig.');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (new Date(since + 'T00:00:00') > tomorrow) throw new InputError('Das Datum liegt in der Zukunft.');
  }
  return { togetherSince: since, names };
}

export function checkEmail(raw: string): string {
  const e = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) throw new InputError('Bitte gib eine gültige E-Mail-Adresse ein.');
  return e;
}

export function checkLoginCode(raw: string): string {
  const c = raw.replace(/\D/g, '');
  if (c.length < 6 || c.length > 10) throw new InputError('Der Code besteht aus Ziffern aus der E-Mail.');
  return c;
}

export function normalizeInviteCode(raw: string): string {
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(c)) throw new InputError('Der Einladungscode hat 8 Zeichen, z. B. K7MB-Q2XD.');
  return c;
}
