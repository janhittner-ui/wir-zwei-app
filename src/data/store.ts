import type {
  Birthday, BirthdayInput, Note, NoteInput, Recipe, RecipeInput, Trip, TripInput, TripItem, Photo, PhotoUpload, Media, MediaInput, CalendarEvent, Couple, EventInput, PersonColor, Profile, Session, ShoppingInput, ShoppingItem,
} from './types';

export type Unsubscribe = () => void;
export type LiveTable = 'events' | 'shopping' | 'birthdays' | 'notes' | 'recipes' | 'trips' | 'photos' | 'media' | 'couple';

/**
 * Die eine Schnittstelle, über die die App mit Daten spricht.
 * Heute: Supabase (EU). Später austauschbar (z. B. iCloud oder Ende-zu-Ende-verschlüsselt),
 * ohne die Bildschirme anzufassen.
 */
export interface DataStore {
  readonly kind: 'supabase' | 'demo';

  // Anmeldung: E-Mail + Passwort (funktioniert ohne eigenen E-Mail-Versand).
  getSession(): Promise<Session | null>;
  onSessionChange(cb: (s: Session | null) => void): Unsubscribe;
  /** Legt ein Konto an. 'confirm' = Supabase verlangt erst die Bestätigung per E-Mail-Link. */
  signUpWithPassword(email: string, password: string): Promise<'signedIn' | 'confirm'>;
  signInWithPassword(email: string, password: string): Promise<void>;
  // Alternative: Einmal-Code per E-Mail (braucht eigenen SMTP-Versand mit {{ .Token }} in der Vorlage)
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

  // Geburtstage
  listBirthdays(): Promise<Birthday[]>;
  addBirthday(b: BirthdayInput): Promise<Birthday>;
  updateBirthday(id: string, b: BirthdayInput): Promise<void>;
  deleteBirthday(id: string): Promise<void>;

  // Notizen
  listNotes(): Promise<Note[]>;
  addNote(n: NoteInput): Promise<Note>;
  updateNote(id: string, n: NoteInput): Promise<void>;
  deleteNote(id: string): Promise<void>;

  // Rezepte
  listRecipes(): Promise<Recipe[]>;
  addRecipe(r: RecipeInput): Promise<Recipe>;
  updateRecipe(id: string, r: RecipeInput): Promise<void>;
  setRecipeFavorite(id: string, favorite: boolean): Promise<void>;
  deleteRecipe(id: string): Promise<void>;

  // Reisen (Live-Sync 'trips' meldet auch Änderungen an Packlisten)
  listTrips(): Promise<Trip[]>;
  addTrip(t: TripInput): Promise<Trip>;
  updateTrip(id: string, t: TripInput): Promise<void>;
  deleteTrip(id: string): Promise<void>;
  /** Packlisten-Einträge; ohne tripId alle des Paares */
  listTripItems(tripId?: string): Promise<TripItem[]>;
  addTripItem(tripId: string, text: string): Promise<TripItem>;
  setTripItemDone(id: string, done: boolean): Promise<void>;
  deleteTripItem(id: string): Promise<void>;

  // Fotoalbum (neueste zuerst)
  listPhotos(): Promise<Photo[]>;
  addPhoto(p: PhotoUpload): Promise<Photo>;
  updatePhotoCaption(id: string, caption: string | null): Promise<void>;
  deletePhoto(id: string): Promise<void>;
  /** Zeitlich begrenzte Links zum Anzeigen (privater Speicher), je Foto-ID */
  photoUrls(photos: Photo[]): Promise<Record<string, string>>;

  // Filme & Serien (Bewertung zählt nur, wenn gesehen)
  listMedia(): Promise<Media[]>;
  addMedia(m: MediaInput): Promise<Media>;
  updateMedia(id: string, m: MediaInput): Promise<void>;
  setMediaDone(id: string, done: boolean): Promise<void>;
  deleteMedia(id: string): Promise<void>;

  // Einkauf
  listShopping(): Promise<ShoppingItem[]>;
  addShopping(i: ShoppingInput): Promise<ShoppingItem>;
  setShoppingDone(id: string, done: boolean): Promise<void>;
  updateShopping(id: string, i: ShoppingInput): Promise<void>;
  deleteShopping(id: string): Promise<void>;
  clearDoneShopping(): Promise<void>;

  /** Meldet Änderungen vom Partner (Live-Sync). */
  subscribe(table: LiveTable, cb: () => void): Unsubscribe;
}
