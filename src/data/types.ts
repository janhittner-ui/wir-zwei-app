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
  /** Foto vom Gericht (liegt im Album), optional */
  photoId: string | null;
  /** Passende Mahlzeiten; leer = keine Angabe */
  meals: Meal[];
  createdBy: string | null;
  /** ISO-Zeitpunkt */
  updatedAt: string;
}
export type Meal = 'fruehstueck' | 'mittag' | 'abend';
export type RecipeInput = Pick<Recipe, 'title' | 'servings' | 'minutes' | 'ingredients' | 'steps' | 'source'> & Partial<Pick<Recipe, 'photoId' | 'meals'>>;

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
/** Periode (Zyklus): nur Beginn und Ende; gehört der Person, die sie einträgt */
export interface CyclePeriod {
  id: string;
  userId: string;
  /** ISO-Datum */
  start: string;
  /** ISO-Datum oder null, solange sie läuft */
  end: string | null;
  createdAt: string;
}
export type CyclePeriodInput = Pick<CyclePeriod, 'start' | 'end'>;

/** Restaurant: besucht (mit Datum) oder auf der „Wollen wir hin“-Liste */
export interface Restaurant {
  id: string;
  name: string;
  /** Küche, z. B. Italienisch */
  cuisine: string | null;
  /** Ort oder Adresse */
  place: string | null;
  /** 1–4 (€ bis €€€€) */
  price: number | null;
  note: string | null;
  /** ISO-Datum des (letzten) Besuchs; null = wollen wir hin */
  visitedOn: string | null;
  /** Foto aus dem Album (nur wenn besucht) */
  photoId: string | null;
  /** Sterne pro Person (nur wenn besucht) */
  ratings: { userId: string; stars: number }[];
  createdBy: string | null;
  createdAt: string;
}
export type RestaurantInput = Pick<Restaurant, 'name' | 'cuisine' | 'place' | 'price' | 'note' | 'visitedOn' | 'photoId'>;

export type DateCategory = 'zuhause' | 'draussen' | 'essen' | 'kultur' | 'aktiv' | 'ausflug' | 'sonstiges';
/** Idee auf der gemeinsamen Date-Liste; erledigt, sobald es ein Datum gibt */
export interface DateIdea {
  id: string;
  title: string;
  category: DateCategory;
  note: string | null;
  /** ISO-Datum, an dem ihr es gemacht habt; null = noch offen */
  doneOn: string | null;
  /** Foto aus dem Album (nur wenn erledigt) */
  photoId: string | null;
  createdBy: string | null;
  createdAt: string;
}
export type DateIdeaInput = Pick<DateIdea, 'title' | 'category' | 'note' | 'doneOn' | 'photoId'>;

export type MilestoneIcon = 'heart' | 'date' | 'kiss' | 'travel' | 'home' | 'ring' | 'wedding' | 'baby' | 'star';
/** Meilenstein des Paares (Zeitleiste hinter der Paar-Karte) */
export interface Milestone {
  id: string;
  title: string;
  icon: MilestoneIcon;
  /** ISO-Datum JJJJ-MM-TT */
  date: string;
  note: string | null;
  /** Foto aus dem Album (optional) */
  photoId: string | null;
  createdBy: string | null;
  createdAt: string;
}
export type MilestoneInput = Pick<Milestone, 'title' | 'icon' | 'date' | 'note' | 'photoId'>;

/** Antwort im Paar-Quiz; answer = null heißt übersprungen */
export interface QuizAnswer {
  id: string;
  round: number;
  questionId: string;
  /** wer dran war */
  player: string | null;
  answer: string | null;
  createdBy: string | null;
  createdAt: string;
}
export type QuizAnswerInput = Pick<QuizAnswer, 'round' | 'questionId' | 'player' | 'answer'>;

export type MediaInput = Pick<Media, 'title' | 'kind' | 'platform' | 'note' | 'rating'>;

export type GiftKind = 'idea' | 'wish';
/**
 * Geschenk: eine Idee (für den Partner oder jemand anderen) oder ein eigener Wunsch.
 * Ideen FÜR einen selbst bekommt man nie zu sehen (Überraschung, von der Datenbank geprüft).
 */
export interface Gift {
  id: string;
  kind: GiftKind;
  title: string;
  /** Idee für den Partner (Nutzer-ID) */
  forUser: string | null;
  /** Idee für jemand anderen, z. B. "Mama" */
  forName: string | null;
  occasion: string | null;
  link: string | null;
  note: string | null;
  /** Idee schon besorgt */
  done: boolean;
  /** Idee, die aus diesem Wunsch des Partners entstand */
  wishId: string | null;
  createdBy: string | null;
  createdAt: string;
}
export type GiftInput = Pick<Gift, 'kind' | 'title' | 'forUser' | 'forName' | 'occasion' | 'link' | 'note'> & { wishId?: string | null };

export type EventInput = Omit<CalendarEvent, 'id' | 'createdBy'>;
export type ShoppingInput = Pick<ShoppingItem, 'text' | 'qty'>;

export interface Session {
  userId: string;
  email: string | null;
}
