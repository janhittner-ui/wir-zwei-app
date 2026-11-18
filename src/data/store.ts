import type {
  CalendarEvent, Couple, EventInput, PersonColor, Profile, Session, ShoppingInput, ShoppingItem,
} from './types';

export type Unsubscribe = () => void;

/**
 * Die eine Schnittstelle, über die die App mit Daten spricht.
 * Heute: Supabase (EU). Später austauschbar (z. B. iCloud oder Ende-zu-Ende-verschlüsselt),
 * ohne die Bildschirme anzufassen.
 */
export interface DataStore {
  readonly kind: 'supabase' | 'demo';

  // Anmeldung (E-Mail + Einmal-Code, kein Passwort)
  getSession(): Promise<Session | null>;
  onSessionChange(cb: (s: Session | null) => void): Unsubscribe;
  sendLoginCode(email: string): Promise<void>;
  verifyLoginCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;

  // Profil & Paar
  getMyProfile(): Promise<Profile | null>;
  saveMyProfile(p: { displayName: string; color: PersonColor }): Promise<Profile>;
  getMyCouple(): Promise<Couple | null>;
  createCouple(): Promise<void>;
  createInvite(): Promise<string>;
  joinCouple(code: string): Promise<void>;
  leaveCouple(): Promise<void>;
  updateCouple(p: { togetherSince: string | null; names: string | null }): Promise<void>;
  deleteAccount(): Promise<void>;

  // Kalender
  listEvents(): Promise<CalendarEvent[]>;
  addEvent(e: EventInput): Promise<CalendarEvent>;
  updateEvent(id: string, e: EventInput): Promise<void>;
  deleteEvent(id: string): Promise<void>;

  // Einkauf
  listShopping(): Promise<ShoppingItem[]>;
  addShopping(i: ShoppingInput): Promise<ShoppingItem>;
  setShoppingDone(id: string, done: boolean): Promise<void>;
  updateShopping(id: string, i: ShoppingInput): Promise<void>;
  deleteShopping(id: string): Promise<void>;
  clearDoneShopping(): Promise<void>;

  /** Meldet Änderungen vom Partner (Live-Sync). */
  subscribe(table: 'events' | 'shopping' | 'couple', cb: () => void): Unsubscribe;
}
