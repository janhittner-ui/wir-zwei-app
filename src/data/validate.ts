/**
 * Prüfungen, die exakt den Regeln der Datenbank entsprechen (supabase/migrations).
 * Die App prüft vorher, damit Jan & Vanessa eine verständliche Meldung bekommen statt eines Serverfehlers.
 */
import type { BirthdayInput, GiftInput, MediaInput, QuizAnswerInput, NoteInput, PhotoUpload, RecipeInput, TripInput, EventInput, PersonColor, ShoppingInput } from './types';

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

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function checkBirthday(b: BirthdayInput, now = new Date()): BirthdayInput {
  const name = clean(b.name);
  if (!name) throw new InputError('Bitte gib einen Namen ein.');
  if (name.length > 80) throw new InputError('Der Name darf höchstens 80 Zeichen haben.');
  const month = Number(b.month);
  const day = Number(b.day);
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new InputError('Bitte wähle einen Monat.');
  if (!Number.isInteger(day) || day < 1 || day > DAYS_IN_MONTH[month - 1]) {
    throw new InputError(`Der Tag muss zwischen 1 und ${DAYS_IN_MONTH[month - 1]} liegen.`);
  }
  let year: number | null = null;
  if (b.year !== null && b.year !== undefined && String(b.year).trim() !== '') {
    year = Number(b.year);
    if (!Number.isInteger(year) || year < 1900 || year > now.getFullYear()) {
      throw new InputError(`Das Jahr muss zwischen 1900 und ${now.getFullYear()} liegen (oder leer bleiben).`);
    }
  }
  const note = (b.note ?? '').trim() || null;
  if (note && note.length > 300) throw new InputError('Die Notiz darf höchstens 300 Zeichen haben.');
  return { name, month, day, year, note };
}

export function checkNote(n: NoteInput): NoteInput {
  const title = clean(n.title) || null;
  if (title && title.length > 120) throw new InputError('Der Titel darf höchstens 120 Zeichen haben.');
  const body = (n.body ?? '').replace(/\s+$/g, '').replace(/^\s*\n/, '');
  if (!body.trim()) throw new InputError('Die Notiz ist noch leer.');
  if (body.length > 5000) throw new InputError('Die Notiz darf höchstens 5000 Zeichen haben.');
  if (!['n1', 'n2', 'n3', 'n4'].includes(n.color)) throw new InputError('Unbekannte Farbe.');
  return { title, body, color: n.color };
}

/** Mehrzeiligen Text aufräumen: Leerzeichen am Zeilenende und leere Zeilen am Anfang/Ende weg. */
function lines(s: string | null | undefined) {
  return (s ?? '').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/^\n+|\n+$/g, '');
}

export function checkRecipe(r: RecipeInput): RecipeInput {
  const title = clean(r.title);
  if (!title) throw new InputError('Wie heißt das Rezept?');
  if (title.length > 120) throw new InputError('Der Name darf höchstens 120 Zeichen haben.');
  const servings = Number(r.servings);
  if (!Number.isInteger(servings) || servings < 1 || servings > 99) throw new InputError('Portionen bitte als Zahl von 1 bis 99.');
  const minutes = r.minutes == null ? null : Number(r.minutes);
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440)) throw new InputError('Die Zeit bitte in Minuten (1 bis 1440).');
  const ingredients = lines(r.ingredients);
  if (ingredients.length > 5000) throw new InputError('Die Zutaten dürfen höchstens 5000 Zeichen haben.');
  const steps = lines(r.steps);
  if (steps.length > 10000) throw new InputError('Die Zubereitung darf höchstens 10000 Zeichen haben.');
  const source = clean(r.source) || null;
  if (source && source.length > 500) throw new InputError('Die Quelle darf höchstens 500 Zeichen haben.');
  return { title, servings, minutes, ingredients, steps, source };
}

export function checkTrip(tr: TripInput): TripInput {
  const title = clean(tr.title);
  if (!title) throw new InputError('Wohin soll es gehen?');
  if (title.length > 120) throw new InputError('Das Ziel darf höchstens 120 Zeichen haben.');
  const startDate = tr.startDate || null;
  const endDate = startDate ? tr.endDate || null : null;
  if (startDate && !isValidDate(startDate)) throw new InputError('Das Startdatum stimmt nicht.');
  if (endDate && !isValidDate(endDate)) throw new InputError('Das Enddatum stimmt nicht.');
  if (startDate && endDate) {
    const days = (Date.parse(endDate) - Date.parse(startDate)) / 86400000;
    if (days < 0) throw new InputError('Die Rückreise kann nicht vor der Abreise sein.');
    if (days > 366) throw new InputError('Eine Reise darf höchstens ein Jahr dauern.');
  }
  const note = (tr.note ?? '').trim() || null;
  if (note && note.length > 2000) throw new InputError('Die Notiz darf höchstens 2000 Zeichen haben.');
  return { title, startDate, endDate, note };
}

export function checkTripItem(text: string): string {
  const v = clean(text);
  if (!v) throw new InputError('Was soll mit?');
  if (v.length > 120) throw new InputError('Höchstens 120 Zeichen bitte.');
  return v;
}

export function checkCaption(c: string | null | undefined): string | null {
  const v = clean(c) || null;
  if (v && v.length > 200) throw new InputError('Die Bildunterschrift darf höchstens 200 Zeichen haben.');
  return v;
}

export function checkPhoto(p: PhotoUpload): PhotoUpload {
  const ok = (n: number) => Number.isInteger(n) && n >= 1 && n <= 10000;
  if (!ok(p.width) || !ok(p.height)) throw new InputError('Dieses Bild konnte nicht gelesen werden.');
  if (!p.base64 || p.base64.length < 100) throw new InputError('Dieses Bild konnte nicht gelesen werden.');
  // ca. 5 MB Datei (Base64 ist ein Drittel größer) – die App verkleinert vorher deutlich
  if (p.base64.length > 6_900_000) throw new InputError('Das Bild ist zu groß.');
  return { ...p, caption: checkCaption(p.caption) };
}

export function checkMedia(m: MediaInput): MediaInput {
  const title = clean(m.title);
  if (!title) throw new InputError('Wie heißt der Film oder die Serie?');
  if (title.length > 120) throw new InputError('Der Titel darf höchstens 120 Zeichen haben.');
  if (m.kind !== 'film' && m.kind !== 'serie') throw new InputError('Bitte Film oder Serie wählen.');
  const platform = optional(m.platform);
  if (platform && platform.length > 40) throw new InputError('„Wo läuft es?“ darf höchstens 40 Zeichen haben.');
  const note = (m.note ?? '').trim() || null;
  if (note && note.length > 500) throw new InputError('Die Notiz darf höchstens 500 Zeichen haben.');
  const rating = m.rating == null ? null : Number(m.rating);
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) throw new InputError('Bewertung bitte mit 1 bis 5 Sternen.');
  return { title, kind: m.kind, platform, note, rating };
}

export function checkGift(g: GiftInput): GiftInput {
  if (g.kind !== 'idea' && g.kind !== 'wish') throw new InputError('Unbekannte Art.');
  const title = clean(g.title);
  if (!title) throw new InputError(g.kind === 'wish' ? 'Was wünschst du dir?' : 'Was ist die Idee?');
  if (title.length > 120) throw new InputError('Höchstens 120 Zeichen bitte.');
  let forUser = g.kind === 'idea' ? g.forUser || null : null;
  let forName = g.kind === 'idea' ? optional(g.forName) : null;
  if (forUser) forName = null;
  if (g.kind === 'idea' && !forUser && !forName) throw new InputError('Für wen ist die Idee?');
  if (forName && forName.length > 60) throw new InputError('Der Name darf höchstens 60 Zeichen haben.');
  if (g.kind === 'wish') forUser = null;
  const occasion = g.kind === 'idea' ? optional(g.occasion) : null;
  if (occasion && occasion.length > 40) throw new InputError('Der Anlass darf höchstens 40 Zeichen haben.');
  const link = optional(g.link);
  if (link && link.length > 500) throw new InputError('Der Link darf höchstens 500 Zeichen haben.');
  const note = (g.note ?? '').trim() || null;
  if (note && note.length > 500) throw new InputError('Die Notiz darf höchstens 500 Zeichen haben.');
  return { kind: g.kind, title, forUser, forName, occasion, link, note, wishId: g.kind === 'idea' ? g.wishId ?? null : null };
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

export function checkPassword(raw: string): string {
  if (raw.length < 8) throw new InputError('Das Passwort braucht mindestens 8 Zeichen.');
  if (raw.length > 72) throw new InputError('Das Passwort darf höchstens 72 Zeichen haben.');
  return raw;
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

/** Persönliche Einstellungen: ein JSON-Objekt, höchstens 8 KB (wie in der Datenbank) */
export function checkPrefs(p: unknown): Record<string, unknown> {
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('prefs_invalid');
  const json = JSON.stringify(p);
  if (new TextEncoder().encode(json).length > 8192) throw new Error('prefs_invalid');
  return JSON.parse(json);
}

/** Quiz-Antwort: leere Antwort = übersprungen */
export function checkQuizAnswer(a: QuizAnswerInput): QuizAnswerInput {
  const round = Number(a.round);
  if (!Number.isInteger(round) || round < 1 || round > 1000) throw new InputError('Diese Runde gibt es nicht.');
  if (!/^[a-z0-9-]{1,40}$/.test(a.questionId)) throw new InputError('Diese Frage gibt es nicht.');
  if (!a.player) throw new InputError('Wer ist dran?');
  const answer = (a.answer ?? '').trim() || null;
  if (answer && answer.length > 1000) throw new InputError('Die Antwort darf höchstens 1000 Zeichen haben.');
  return { round, questionId: a.questionId, player: a.player, answer };
}
