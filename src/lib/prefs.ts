/**
 * Persönliche Einstellungen aus „Anpassen“: welche Bereiche als Tab erscheinen, Startseite,
 * Aussehen und kleine Schalter pro Bereich. Jede Person hat ihre eigenen.
 *
 * Gespeichert wird ein kleines JSON-Objekt. normalizePrefs macht aus allem, was ankommt
 * (alte Version, kaputte Daten, fremde Schlüssel), immer gültige Einstellungen.
 */

export const AREAS = ['kalender', 'listen', 'rezepte', 'album', 'quiz'] as const;
export type Area = (typeof AREAS)[number];
export const AREA_LABEL: Record<Area, string> = { kalender: 'Kalender', listen: 'Listen', rezepte: 'Rezepte', album: 'Album', quiz: 'Quiz' };
/** Bereiche, die nach der ersten Version von „Anpassen“ dazukamen */
const LATER_AREAS: readonly Area[] = ['quiz'];
/** Neben Start passen höchstens 4 Bereiche in die Tab-Leiste (iPhone zeigt 5 Tabs) */
export const MAX_TABS = 4;

export const HOME_CARDS = ['hero', 'verse', 'upcoming', 'birthday', 'trip', 'shopping', 'cycle'] as const;
/** Karten, die später dazukamen und erst einmal aus sind (Zyklus ist privat: nur wer will, zeigt ihn) */
const LATER_HOME: readonly HomeCard[] = ['cycle'];
export type HomeCard = (typeof HOME_CARDS)[number];
export const HOME_LABEL: Record<HomeCard, string> = {
  hero: 'Paar-Bild', verse: 'Tagesvers', upcoming: 'Demnächst', birthday: 'Nächster Geburtstag', trip: 'Nächste Reise', shopping: 'Einkauf', cycle: 'Zyklus',
};

export const LIST_SEGS = ['einkauf', 'notizen', 'filme', 'geschenke'] as const;
export type ListSeg = (typeof LIST_SEGS)[number];
export const LIST_LABEL: Record<ListSeg, string> = { einkauf: 'Einkauf', notizen: 'Notizen', filme: 'Filme', geschenke: 'Geschenke' };

export const ACCENTS = ['blau', 'rosa', 'lila', 'gruen', 'petrol', 'orange'] as const;
export type AccentKey = (typeof ACCENTS)[number];
export const ACCENT_LABEL: Record<AccentKey, string> = { blau: 'Blau', rosa: 'Rosa', lila: 'Lila', gruen: 'Grün', petrol: 'Petrol', orange: 'Orange' };

export type Mode = 'system' | 'light' | 'dark';
export type RecipeSort = 'name' | 'neu';

/** Reihenfolge plus ausgeblendete Einträge; neue Einträge späterer Versionen erscheinen hinten. */
export interface Ordered<K extends string> {
  order: K[];
  hidden: K[];
}

export interface Prefs {
  /** Bereiche in der Tab-Leiste (Start ist immer vorne); ausgeblendete sind über die Startseite erreichbar */
  areas: Ordered<Area>;
  home: Ordered<HomeCard> & { heroPhotoId: string | null };
  look: { mode: Mode; accent: AccentKey };
  lists: Ordered<ListSeg>;
  kalender: { showBirthdays: boolean; showCycle: boolean; cycleInMonth: boolean };
  rezepte: { sort: RecipeSort };
  album: { cols: 3 | 4 };
}

export const DEFAULT_PREFS: Prefs = {
  areas: { order: [...AREAS], hidden: ['quiz'] },
  home: { order: [...HOME_CARDS], hidden: ['cycle'], heroPhotoId: null },
  look: { mode: 'system', accent: 'blau' },
  lists: { order: [...LIST_SEGS], hidden: [] },
  kalender: { showBirthdays: true, showCycle: true, cycleInMonth: true },
  rezepte: { sort: 'name' },
  album: { cols: 3 },
};

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const pick = <K extends string>(all: readonly K[], v: unknown, fallback: K): K => (all.includes(v as K) ? (v as K) : fallback);
const keys = <K extends string>(all: readonly K[], v: unknown): K[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is K => all.includes(x as K)))] : [];

function ordered<K extends string>(all: readonly K[], v: unknown, minVisible = 0, maxVisible = Infinity, later: readonly K[] = []): Ordered<K> {
  const o = obj(v);
  const order = keys(all, o.order);
  let hidden = keys(all, o.hidden);
  for (const k of all) {
    if (order.includes(k)) continue;
    order.push(k);
    // später dazugekommene Bereiche erst einmal nicht in die Tab-Leiste
    if (later.includes(k) && !hidden.includes(k)) hidden.push(k);
  }
  if (all.length - hidden.length < minVisible) hidden = [];
  for (const k of [...order].reverse()) {
    if (order.length - hidden.length <= maxVisible) break;
    if (!hidden.includes(k)) hidden.push(k);
  }
  return { order, hidden };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizePrefs(raw: unknown): Prefs {
  const r = obj(raw);
  const home = obj(r.home);
  const look = obj(r.look);
  const kal = obj(r.kalender);
  const rez = obj(r.rezepte);
  const alb = obj(r.album);
  return {
    areas: ordered(AREAS, r.areas, 0, MAX_TABS, LATER_AREAS),
    home: { ...ordered(HOME_CARDS, home, 0, Infinity, LATER_HOME), heroPhotoId: typeof home.heroPhotoId === 'string' && UUID.test(home.heroPhotoId) ? home.heroPhotoId : null },
    look: { mode: pick(['system', 'light', 'dark'] as const, look.mode, 'system'), accent: pick(ACCENTS, look.accent, 'blau') },
    lists: ordered(LIST_SEGS, r.lists, 1),
    kalender: {
      showBirthdays: typeof kal.showBirthdays === 'boolean' ? kal.showBirthdays : true,
      showCycle: typeof kal.showCycle === 'boolean' ? kal.showCycle : true,
      cycleInMonth: typeof kal.cycleInMonth === 'boolean' ? kal.cycleInMonth : true,
    },
    rezepte: { sort: pick(['name', 'neu'] as const, rez.sort, 'name') },
    album: { cols: alb.cols === 4 ? 4 : 3 },
  };
}

/** Sichtbare Einträge in der gewählten Reihenfolge */
export const visible = <K extends string>(o: Ordered<K>): K[] => o.order.filter((k) => !o.hidden.includes(k));

/** Ein-/Ausblenden; bei minVisible bleibt mindestens so viel sichtbar */
export function toggleHidden<K extends string>(o: Ordered<K>, k: K, minVisible = 0, maxVisible = Infinity): Ordered<K> {
  if (o.hidden.includes(k)) {
    if (o.order.length - o.hidden.length + 1 > maxVisible) return o;
    return { ...o, hidden: o.hidden.filter((x) => x !== k) };
  }
  if (o.order.length - o.hidden.length - 1 < minVisible) return o;
  return { ...o, hidden: [...o.hidden, k] };
}

/** Verschiebt einen Eintrag um eine Stelle nach oben (-1) oder unten (+1) */
export function move<K extends string>(o: Ordered<K>, k: K, dir: -1 | 1): Ordered<K> {
  const i = o.order.indexOf(k);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= o.order.length) return o;
  const order = [...o.order];
  [order[i], order[j]] = [order[j], order[i]];
  return { ...o, order };
}

// ---------------------------------------------------------------------------------------------
// Aktueller Stand für Code außerhalb von React (z. B. „Zurück“-Ziele in Bildschirmen)

let current: Prefs = DEFAULT_PREFS;
export const currentPrefs = () => current;
export const setCurrentPrefs = (p: Prefs) => {
  current = p;
};
/** Ist der Bereich gerade ein Tab? Sonst wird er als eigene Seite geöffnet (/bereich/…). */
export const isTab = (a: Area, p: Prefs = current) => !p.areas.hidden.includes(a);
