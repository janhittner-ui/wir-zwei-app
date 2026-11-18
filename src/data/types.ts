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

export type EventInput = Omit<CalendarEvent, 'id' | 'createdBy'>;
export type ShoppingInput = Pick<ShoppingItem, 'text' | 'qty'>;

export interface Session {
  userId: string;
  email: string | null;
}
