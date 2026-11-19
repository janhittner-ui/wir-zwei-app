/** Datenmodell der App. Bewusst klein gehalten (Datenminimierung). */

export type PersonColor = 'blue' | 'pink';

export interface Profile {
  id: string;
  displayName: string;
  color: PersonColor;
}

export interface Couple {
  id: string;
  /** ISO-Datum JJJJ-MM-TT */
  togetherSince: string | null;
  names: string | null;
  members: Profile[];
  /** Offener Einladungscode, falls der Partner noch fehlt */
  inviteCode: string | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  /** JJJJ-MM-TT */
  date: string;
  /** HH:MM oder null */
  time: string | null;
  note: string | null;
  /** Profil-ID der Person, für die der Termin ist (null = beide/unbekannt) */
  who: string | null;
  createdBy: string | null;
}

export interface ShoppingItem {
  id: string;
  text: string;
  qty: string | null;
  done: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface Birthday {
  id: string;
  name: string;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
  /** Geburtsjahr, freiwillig */
  year: number | null;
  note: string | null;
  createdBy: string | null;
}
export type BirthdayInput = Omit<Birthday, 'id' | 'createdBy'>;

export type NoteColor = 'n1' | 'n2' | 'n3' | 'n4';
export interface Note {
  id: string;
  title: string | null;
  body: string;
  color: NoteColor;
  createdBy: string | null;
  updatedBy: string | null;
  /** ISO-Zeitpunkt */
  updatedAt: string;
}
export type NoteInput = Pick<Note, 'title' | 'body' | 'color'>;

export interface Recipe {
  id: string;
  title: string;
  /** Für wie viele Personen die Mengen gelten */
  servings: number;
  /** Zeit in Minuten (optional) */
  minutes: number | null;
  /** Eine Zutat pro Zeile, z. B. "200 g Mehl" */
  ingredients: string;
  /** Ein Schritt pro Zeile */
  steps: string;
  /** Woher das Rezept stammt (Link oder Buch), optional */
  source: string | null;
  favorite: boolean;
  createdBy: string | null;
  /** ISO-Zeitpunkt */
  updatedAt: string;
}
export type RecipeInput = Pick<Recipe, 'title' | 'servings' | 'minutes' | 'ingredients' | 'steps' | 'source'>;

/** Reise: ohne Datum ein Wunschziel, mit Datum geplant. */
export interface Trip {
  id: string;
  title: string;
  /** ISO-Datum, null = Wunschziel */
  startDate: string | null;
  endDate: string | null;
  note: string | null;
  createdBy: string | null;
}
export type TripInput = Pick<Trip, 'title' | 'startDate' | 'endDate' | 'note'>;
export interface TripItem {
  id: string;
  tripId: string;
  text: string;
  done: boolean;
  createdBy: string | null;
  createdAt: string;
}

/** Foto im gemeinsamen Album. Die Bilddatei liegt im privaten Speicher unter "path". */
export interface Photo {
  id: string;
  path: string;
  caption: string | null;
  width: number;
  height: number;
  createdBy: string | null;
  /** ISO-Zeitpunkt */
  createdAt: string;
}
/** Fertig verkleinertes JPEG zum Hochladen */
export interface PhotoUpload {
  base64: string;
  width: number;
  height: number;
  caption?: string | null;
}

export type MediaKind = 'film' | 'serie';
/** Film oder Serie auf der gemeinsamen Watchlist */
export interface Media {
  id: string;
  title: string;
  kind: MediaKind;
  /** Wo es läuft, z. B. Netflix */
  platform: string | null;
  note: string | null;
  done: boolean;
  /** 1–5 Sterne, nur wenn gesehen */
  rating: number | null;
  doneAt: string | null;
  createdBy: string | null;
  createdAt: string;
}
export type MediaInput = Pick<Media, 'title' | 'kind' | 'platform' | 'note' | 'rating'>;

export type EventInput = Omit<CalendarEvent, 'id' | 'createdBy'>;
export type ShoppingInput = Pick<ShoppingItem, 'text' | 'qty'>;

export interface Session {
  userId: string;
  email: string | null;
}
