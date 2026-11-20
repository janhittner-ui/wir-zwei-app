/**
 * Strenge Nachbildung der Datenbank im Speicher.
 * - Demo-Modus: App läuft sofort in Expo Go, auch ohne Supabase-Projekt (nichts wird gespeichert).
 * - Tests: mehrere Nutzer teilen sich ein MemoryBackend, alle Regeln der echten DB gelten hier auch.
 */
import type { DataStore, LiveTable, Unsubscribe } from './store';
import type {
  Birthday, BirthdayInput, Note, NoteInput, Recipe, RecipeInput, Trip, TripInput, TripItem, Photo, PhotoUpload, Media, MediaInput, Gift, GiftInput, QuizAnswer, QuizAnswerInput, Milestone, MilestoneInput, DateIdea, DateIdeaInput, Restaurant, RestaurantInput, CyclePeriod, CyclePeriodInput, CalendarEvent, Couple, EventInput, PersonColor, Profile, Session, ShoppingInput, ShoppingItem,
} from './types';
import {
  checkBirthday, checkColor, checkNote, checkRecipe, checkTrip, checkTripItem, checkCaption, checkPhoto, checkMedia, checkGift, checkPrefs, checkQuizAnswer, checkMilestone, checkDateIdea, checkRestaurant, checkStars, checkPeriod, checkCouple, checkDisplayName, checkEmail, checkEvent, checkLoginCode, checkPassword, checkShopping,
  normalizeInviteCode,
} from './validate';

type Table = LiveTable;

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${(++seq).toString(16).padStart(12, '0')}`;
const fail = (code: string): never => {
  throw new Error(code);
};

interface CoupleRow { id: string; togetherSince: string | null; names: string | null }
interface Invite { code: string; coupleId: string; expiresAt: number }
type EventRow = CalendarEvent & { coupleId: string };
type ShopRow = ShoppingItem & { coupleId: string };
type BdRow = Birthday & { coupleId: string };
type NoteRow = Note & { coupleId: string };
type RecipeRow = Recipe & { coupleId: string };
type TripRow = Trip & { coupleId: string };
type TripItemRow = TripItem & { coupleId: string };
type PhotoRow = Photo & { coupleId: string };
type MediaRow = Media & { coupleId: string };
type GiftRow = Gift & { coupleId: string };
type QuizRow = QuizAnswer & { coupleId: string };
type MilestoneRow = Milestone & { coupleId: string };
type DateRow = DateIdea & { coupleId: string };
type RestaurantRow = Omit<Restaurant, 'ratings'> & { coupleId: string; ratings: Map<string, number> };

export class MemoryBackend {
  users = new Map<string, string>(); // id -> email
  passwords = new Map<string, string>(); // nur Demo/Test, nie echt so speichern
  profiles = new Map<string, Profile>();
  couples = new Map<string, CoupleRow>();
  members = new Map<string, string>(); // userId -> coupleId
  invites = new Map<string, Invite>();
  events = new Map<string, EventRow>();
  shopping = new Map<string, ShopRow>();
  birthdays = new Map<string, BdRow>();
  notes = new Map<string, NoteRow>();
  recipes = new Map<string, RecipeRow>();
  trips = new Map<string, TripRow>();
  tripItems = new Map<string, TripItemRow>();
  photos = new Map<string, PhotoRow>();
  media = new Map<string, MediaRow>();
  gifts = new Map<string, GiftRow>();
  quiz = new Map<string, QuizRow>();
  milestones = new Map<string, MilestoneRow>();
  dates = new Map<string, DateRow>();
  restaurants = new Map<string, RestaurantRow>();
  periods = new Map<string, CyclePeriod>();
  cycleShare = new Map<string, boolean>(); // userId -> teilt mit Partner
  prefs = new Map<string, Record<string, unknown>>(); // userId -> Einstellungen
  /** Bilddateien (Pfad → data:-URL), wie der private Speicher */
  files = new Map<string, string>();
  /** Nur für Tests: feste Uhrzeit */
  now = () => Date.now();
  /** Der Code, den die "E-Mail" enthalten würde */
  readonly loginCode = '123456';
  private listeners = new Set<{ table: Table; coupleId: () => string | null; cb: () => void }>();

  listen(table: Table, coupleId: () => string | null, cb: () => void): Unsubscribe {
    const l = { table, coupleId, cb };
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  emit(table: Table, coupleId: string) {
    for (const l of [...this.listeners]) if (l.table === table && l.coupleId() === coupleId) l.cb();
  }
  membersOf(coupleId: string) {
    return [...this.members].filter(([, c]) => c === coupleId).map(([u]) => u);
  }
}

export class MemoryStore implements DataStore {
  readonly kind = 'demo' as const;
  private session: Session | null = null;
  private sessionListeners = new Set<(s: Session | null) => void>();
  private pendingEmail: string | null = null;

  constructor(private db: MemoryBackend = new MemoryBackend()) {}

  // ---------- Anmeldung ----------
  async getSession() {
    return this.session;
  }
  onSessionChange(cb: (s: Session | null) => void): Unsubscribe {
    this.sessionListeners.add(cb);
    return () => this.sessionListeners.delete(cb);
  }
  private setSession(s: Session | null) {
    this.session = s;
    this.sessionListeners.forEach((cb) => cb(s));
  }
  async signUpWithPassword(email: string, password: string) {
    const e = checkEmail(email);
    checkPassword(password);
    if ([...this.db.users.values()].includes(e)) fail('User already registered');
    const id = uuid();
    this.db.users.set(id, e);
    this.db.passwords.set(id, password);
    this.setSession({ userId: id, email: e });
    return 'signedIn' as const;
  }
  async signInWithPassword(email: string, password: string) {
    const e = checkEmail(email);
    const id = [...this.db.users].find(([, m]) => m === e)?.[0];
    const pw = id ? this.db.passwords.get(id) : undefined;
    if (!id || (pw !== password && pw !== password.trim())) fail('Invalid login credentials');
    this.setSession({ userId: id!, email: e });
  }
  async sendLoginCode(email: string) {
    this.pendingEmail = checkEmail(email);
  }
  async verifyLoginCode(email: string, code: string) {
    const e = checkEmail(email);
    if (e !== this.pendingEmail || checkLoginCode(code) !== this.db.loginCode) fail('Token has expired or is invalid');
    let id = [...this.db.users].find(([, m]) => m === e)?.[0];
    if (!id) {
      id = uuid();
      this.db.users.set(id, e);
    }
    this.pendingEmail = null;
    this.setSession({ userId: id, email: e });
  }
  async signOut() {
    this.setSession(null);
  }

  private uid(): string {
    if (!this.session || !this.db.users.has(this.session.userId)) return fail('not_authenticated');
    return this.session.userId;
  }
  private coupleId(): string {
    return this.db.members.get(this.uid()) ?? fail('not_in_couple');
  }
  private myCoupleOrNull = () => (this.session ? this.db.members.get(this.session.userId) ?? null : null);

  // ---------- Profil & Paar ----------
  async getMyProfile() {
    return this.db.profiles.get(this.uid()) ?? null;
  }
  async saveMyProfile(p: { displayName: string; color: PersonColor }) {
    const prof: Profile = { id: this.uid(), displayName: checkDisplayName(p.displayName), color: checkColor(p.color) };
    this.db.profiles.set(prof.id, prof);
    const c = this.myCoupleOrNull();
    if (c) this.db.emit('couple', c);
    return { ...prof };
  }
  async getMyPrefs() {
    const p = this.db.prefs.get(this.uid());
    return p ? structuredClone(p) : null;
  }
  async saveMyPrefs(prefs: object) {
    this.db.prefs.set(this.uid(), checkPrefs(prefs));
  }
  async getMyCouple(): Promise<Couple | null> {
    const cid = this.db.members.get(this.uid());
    if (!cid) return null;
    const c = this.db.couples.get(cid)!;
    const inv = [...this.db.invites.values()].find((i) => i.coupleId === cid && i.expiresAt > this.db.now());
    return {
      id: c.id,
      togetherSince: c.togetherSince,
      names: c.names,
      members: this.db.membersOf(cid).map((u) => this.db.profiles.get(u)).filter((p): p is Profile => !!p).map((p) => ({ ...p })),
      inviteCode: inv?.code ?? null,
    };
  }
  async createCouple() {
    const me = this.uid();
    if (this.db.members.has(me)) fail('already_in_couple');
    const id = uuid();
    this.db.couples.set(id, { id, togetherSince: null, names: null });
    this.db.members.set(me, id);
  }
  async createInvite() {
    const cid = this.coupleId();
    if (this.db.membersOf(cid).length >= 2) fail('couple_full');
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += A[Math.floor(Math.random() * 32)];
    for (const [k, v] of this.db.invites) if (v.coupleId === cid) this.db.invites.delete(k);
    this.db.invites.set(code, { code, coupleId: cid, expiresAt: this.db.now() + 48 * 3600e3 });
    return code;
  }
  async joinCouple(raw: string) {
    const me = this.uid();
    if (this.db.members.has(me)) fail('already_in_couple');
    const code = normalizeInviteCode(raw);
    const inv = this.db.invites.get(code);
    if (!inv || inv.expiresAt < this.db.now()) return fail('invalid_code');
    if (this.db.membersOf(inv.coupleId).length >= 2) fail('couple_full');
    this.db.members.set(me, inv.coupleId);
    this.db.invites.delete(code);
    this.db.emit('couple', inv.coupleId);
  }
  async leaveCouple() {
    const me = this.uid();
    const cid = this.db.members.get(me);
    if (!cid) return;
    for (const e of this.db.events.values()) if (e.coupleId === cid && e.who === me) e.who = null;
    this.db.members.delete(me);
    if (this.db.membersOf(cid).length === 0) {
      this.db.couples.delete(cid);
      for (const [k, v] of this.db.events) if (v.coupleId === cid) this.db.events.delete(k);
      for (const [k, v] of this.db.shopping) if (v.coupleId === cid) this.db.shopping.delete(k);
      for (const [k, v] of this.db.birthdays) if (v.coupleId === cid) this.db.birthdays.delete(k);
      for (const [k, v] of this.db.notes) if (v.coupleId === cid) this.db.notes.delete(k);
      for (const [k, v] of this.db.recipes) if (v.coupleId === cid) this.db.recipes.delete(k);
      for (const [k, v] of this.db.trips) if (v.coupleId === cid) this.db.trips.delete(k);
      for (const [k, v] of this.db.tripItems) if (v.coupleId === cid) this.db.tripItems.delete(k);
      for (const [k, v] of this.db.media) if (v.coupleId === cid) this.db.media.delete(k);
      for (const [k, v] of this.db.gifts) if (v.coupleId === cid) this.db.gifts.delete(k);
      for (const [k, v] of this.db.dates) if (v.coupleId === cid) this.db.dates.delete(k);
      for (const [k, v] of this.db.restaurants) if (v.coupleId === cid) this.db.restaurants.delete(k);
      for (const [k, v] of this.db.photos) if (v.coupleId === cid) {
        this.db.photos.delete(k);
        this.db.files.delete(v.path);
      }
      for (const [k, v] of this.db.invites) if (v.coupleId === cid) this.db.invites.delete(k);
    } else {
      this.db.emit('couple', cid);
    }
  }
  async updateCouple(p: { togetherSince: string | null; names: string | null }) {
    const cid = this.coupleId();
    Object.assign(this.db.couples.get(cid)!, checkCouple(p));
    this.db.emit('couple', cid);
  }
  async deleteAccount() {
    const me = this.uid();
    await this.leaveCouple();
    for (const e of this.db.events.values()) if (e.createdBy === me) e.createdBy = null;
    for (const s of this.db.shopping.values()) if (s.createdBy === me) s.createdBy = null;
    for (const b of this.db.birthdays.values()) if (b.createdBy === me) b.createdBy = null;
    for (const r of this.db.recipes.values()) if (r.createdBy === me) r.createdBy = null;
    for (const r of this.db.trips.values()) if (r.createdBy === me) r.createdBy = null;
    for (const r of this.db.tripItems.values()) if (r.createdBy === me) r.createdBy = null;
    for (const r of this.db.photos.values()) if (r.createdBy === me) r.createdBy = null;
    for (const r of this.db.media.values()) if (r.createdBy === me) r.createdBy = null;
    for (const r of this.db.milestones.values()) if (r.createdBy === me) r.createdBy = null;
    for (const r of this.db.dates.values()) if (r.createdBy === me) r.createdBy = null;
    for (const r of this.db.restaurants.values()) if (r.createdBy === me) r.createdBy = null;
    for (const r of this.db.quiz.values()) {
      if (r.createdBy === me) r.createdBy = null;
      if (r.player === me) r.player = null;
    }
    for (const [k, r] of this.db.gifts) {
      if (r.forUser === me) this.db.gifts.delete(k); // Ideen für das gelöschte Konto verschwinden
      else if (r.createdBy === me) r.createdBy = null;
    }
    for (const n of this.db.notes.values()) {
      if (n.createdBy === me) n.createdBy = null;
      if (n.updatedBy === me) n.updatedBy = null;
    }
    this.db.prefs.delete(me);
    for (const [k, p] of this.db.periods) if (p.userId === me) this.db.periods.delete(k);
    this.db.cycleShare.delete(me);
    this.db.profiles.delete(me);
    this.db.users.delete(me);
    this.db.passwords.delete(me);
    this.setSession(null);
  }

  // ---------- Kalender ----------
  private ownEvent(id: string) {
    const e = this.db.events.get(id);
    return e && e.coupleId === this.coupleId() ? e : null;
  }
  private checkWho(cid: string, who: string | null) {
    if (who && this.db.members.get(who) !== cid) fail('who_not_member');
  }
  async listEvents() {
    const cid = this.coupleId();
    return [...this.db.events.values()].filter((e) => e.coupleId === cid).map(({ coupleId, ...e }) => e);
  }
  async addEvent(input: EventInput) {
    const cid = this.coupleId();
    const v = checkEvent(input);
    this.checkWho(cid, v.who);
    const row: EventRow = { ...v, id: uuid(), coupleId: cid, createdBy: this.uid() };
    this.db.events.set(row.id, row);
    this.db.emit('events', cid);
    const { coupleId, ...e } = row;
    return { ...e };
  }
  async updateEvent(id: string, input: EventInput) {
    const e = this.ownEvent(id);
    if (!e) return; // wie RLS: fremde/gelöschte Zeilen werden still ignoriert
    const v = checkEvent(input);
    this.checkWho(e.coupleId, v.who);
    Object.assign(e, v);
    this.db.emit('events', e.coupleId);
  }
  async deleteEvent(id: string) {
    const e = this.ownEvent(id);
    if (!e) return;
    this.db.events.delete(id);
    this.db.emit('events', e.coupleId);
  }

  // ---------- Geburtstage ----------
  private ownBirthday(id: string) {
    const b = this.db.birthdays.get(id);
    return b && b.coupleId === this.coupleId() ? b : null;
  }
  async listBirthdays() {
    const cid = this.coupleId();
    return [...this.db.birthdays.values()].filter((b) => b.coupleId === cid).map(({ coupleId, ...b }) => ({ ...b }));
  }
  async addBirthday(input: BirthdayInput) {
    const cid = this.coupleId();
    const row: BdRow = { ...checkBirthday(input), id: uuid(), coupleId: cid, createdBy: this.uid() };
    this.db.birthdays.set(row.id, row);
    this.db.emit('birthdays', cid);
    const { coupleId, ...b } = row;
    return { ...b };
  }
  async updateBirthday(id: string, input: BirthdayInput) {
    const b = this.ownBirthday(id);
    if (!b) return;
    Object.assign(b, checkBirthday(input));
    this.db.emit('birthdays', b.coupleId);
  }
  async deleteBirthday(id: string) {
    const b = this.ownBirthday(id);
    if (!b) return;
    this.db.birthdays.delete(id);
    this.db.emit('birthdays', b.coupleId);
  }

  // ---------- Notizen ----------
  private ownNote(id: string) {
    const n = this.db.notes.get(id);
    return n && n.coupleId === this.coupleId() ? n : null;
  }
  private stamp() {
    // streng steigend, damit "zuletzt geändert" eindeutig sortiert
    return new Date(this.db.now() + ++seq).toISOString();
  }
  async listNotes() {
    const cid = this.coupleId();
    return [...this.db.notes.values()].filter((n) => n.coupleId === cid)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(({ coupleId, ...n }) => ({ ...n }));
  }
  async addNote(input: NoteInput) {
    const cid = this.coupleId();
    const me = this.uid();
    const row: NoteRow = { ...checkNote(input), id: uuid(), coupleId: cid, createdBy: me, updatedBy: me, updatedAt: this.stamp() };
    this.db.notes.set(row.id, row);
    this.db.emit('notes', cid);
    const { coupleId, ...n } = row;
    return { ...n };
  }
  async updateNote(id: string, input: NoteInput) {
    const n = this.ownNote(id);
    if (!n) return;
    Object.assign(n, checkNote(input), { updatedBy: this.uid(), updatedAt: this.stamp() });
    this.db.emit('notes', n.coupleId);
  }
  async deleteNote(id: string) {
    const n = this.ownNote(id);
    if (!n) return;
    this.db.notes.delete(id);
    this.db.emit('notes', n.coupleId);
  }

  // ---------- Rezepte ----------
  private ownRecipe(id: string) {
    const r = this.db.recipes.get(id);
    return r && r.coupleId === this.coupleId() ? r : null;
  }
  async listRecipes() {
    const cid = this.coupleId();
    return [...this.db.recipes.values()].filter((r) => r.coupleId === cid)
      .sort((a, b) => a.title.localeCompare(b.title, 'de')).map(({ coupleId, ...r }) => ({ ...r, meals: [...r.meals] }));
  }
  async addRecipe(input: RecipeInput) {
    const cid = this.coupleId();
    const v = checkRecipe(input);
    if (v.photoId && this.db.photos.get(v.photoId)?.coupleId !== cid) fail('recipe_photo_invalid');
    const row: RecipeRow = { ...v, photoId: v.photoId ?? null, meals: v.meals ?? [], id: uuid(), coupleId: cid, favorite: false, createdBy: this.uid(), updatedAt: this.stamp() };
    this.db.recipes.set(row.id, row);
    this.db.emit('recipes', cid);
    const { coupleId, ...r } = row;
    return { ...r };
  }
  async updateRecipe(id: string, input: RecipeInput) {
    const r = this.ownRecipe(id);
    if (!r) return;
    const v = checkRecipe(input);
    if (v.photoId && v.photoId !== r.photoId && this.db.photos.get(v.photoId)?.coupleId !== r.coupleId) fail('recipe_photo_invalid');
    Object.assign(r, v, { updatedAt: this.stamp() });
    this.db.emit('recipes', r.coupleId);
  }
  async setRecipeFavorite(id: string, favorite: boolean) {
    const r = this.ownRecipe(id);
    if (!r) return;
    Object.assign(r, { favorite: !!favorite, updatedAt: this.stamp() });
    this.db.emit('recipes', r.coupleId);
  }
  async deleteRecipe(id: string) {
    const r = this.ownRecipe(id);
    if (!r) return;
    this.db.recipes.delete(id);
    this.db.emit('recipes', r.coupleId);
  }

  // ---------- Reisen ----------
  private ownTrip(id: string) {
    const r = this.db.trips.get(id);
    return r && r.coupleId === this.coupleId() ? r : null;
  }
  private ownTripItem(id: string) {
    const r = this.db.tripItems.get(id);
    return r && r.coupleId === this.coupleId() ? r : null;
  }
  async listTrips() {
    const cid = this.coupleId();
    return [...this.db.trips.values()].filter((r) => r.coupleId === cid)
      .sort((a, b) => (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999')).map(({ coupleId, ...r }) => ({ ...r }));
  }
  async addTrip(input: TripInput) {
    const cid = this.coupleId();
    const row: TripRow = { ...checkTrip(input), id: uuid(), coupleId: cid, createdBy: this.uid() };
    this.db.trips.set(row.id, row);
    this.db.emit('trips', cid);
    const { coupleId, ...r } = row;
    return { ...r };
  }
  async updateTrip(id: string, input: TripInput) {
    const r = this.ownTrip(id);
    if (!r) return;
    Object.assign(r, checkTrip(input));
    this.db.emit('trips', r.coupleId);
  }
  async deleteTrip(id: string) {
    const r = this.ownTrip(id);
    if (!r) return;
    this.db.trips.delete(id);
    for (const [k, v] of this.db.tripItems) if (v.tripId === id) this.db.tripItems.delete(k);
    this.db.emit('trips', r.coupleId);
  }
  async listTripItems(tripId?: string) {
    const cid = this.coupleId();
    return [...this.db.tripItems.values()].filter((r) => r.coupleId === cid && (!tripId || r.tripId === tripId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(({ coupleId, ...r }) => ({ ...r }));
  }
  async addTripItem(tripId: string, text: string) {
    const cid = this.coupleId();
    if (!this.ownTrip(tripId)) throw new Error('trip_mismatch');
    const row: TripItemRow = { id: uuid(), tripId, text: checkTripItem(text), done: false, coupleId: cid, createdBy: this.uid(), createdAt: this.stamp() };
    this.db.tripItems.set(row.id, row);
    this.db.emit('trips', cid);
    const { coupleId, ...r } = row;
    return { ...r };
  }
  async setTripItemDone(id: string, done: boolean) {
    const r = this.ownTripItem(id);
    if (!r) return;
    r.done = !!done;
    this.db.emit('trips', r.coupleId);
  }
  async deleteTripItem(id: string) {
    const r = this.ownTripItem(id);
    if (!r) return;
    this.db.tripItems.delete(id);
    this.db.emit('trips', r.coupleId);
  }

  // ---------- Fotoalbum ----------
  private ownPhoto(id: string) {
    const r = this.db.photos.get(id);
    return r && r.coupleId === this.coupleId() ? r : null;
  }
  async listPhotos() {
    const cid = this.coupleId();
    return [...this.db.photos.values()].filter((r) => r.coupleId === cid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(({ coupleId, ...r }) => ({ ...r }));
  }
  async addPhoto(p: PhotoUpload) {
    const cid = this.coupleId();
    const v = checkPhoto(p);
    const id = uuid();
    const row: PhotoRow = { id, path: `${cid}/${id}.jpg`, caption: v.caption ?? null, width: v.width, height: v.height, album: v.album !== false, coupleId: cid, createdBy: this.uid(), createdAt: this.stamp() };
    this.db.photos.set(id, row);
    this.db.files.set(row.path, v.base64.startsWith('data:') ? v.base64 : `data:image/jpeg;base64,${v.base64}`);
    this.db.emit('photos', cid);
    const { coupleId, ...r } = row;
    return { ...r };
  }
  async updatePhotoCaption(id: string, caption: string | null) {
    const r = this.ownPhoto(id);
    if (!r) return;
    r.caption = checkCaption(caption);
    this.db.emit('photos', r.coupleId);
  }
  async deletePhoto(id: string) {
    const r = this.ownPhoto(id);
    if (!r) return;
    this.db.photos.delete(id);
    this.db.files.delete(r.path);
    for (const m of this.db.milestones.values()) if (m.photoId === id) m.photoId = null;
    for (const d of this.db.dates.values()) if (d.photoId === id) d.photoId = null;
    for (const d of this.db.restaurants.values()) if (d.photoId === id) d.photoId = null;
    for (const d of this.db.recipes.values()) if (d.photoId === id) d.photoId = null;
    this.db.emit('photos', r.coupleId);
    this.db.emit('recipes', r.coupleId);
    this.db.emit('milestones', r.coupleId);
    this.db.emit('dates', r.coupleId);
    this.db.emit('restaurants', r.coupleId);
  }
  async photoUrls(photos: Photo[]) {
    const cid = this.coupleId();
    const out: Record<string, string> = {};
    for (const p of photos) {
      const f = this.db.files.get(p.path);
      if (f && p.path.startsWith(`${cid}/`)) out[p.id] = f;
    }
    return out;
  }

  // ---------- Filme & Serien ----------
  private ownMedia(id: string) {
    const r = this.db.media.get(id);
    return r && r.coupleId === this.coupleId() ? r : null;
  }
  async listMedia() {
    const cid = this.coupleId();
    return [...this.db.media.values()].filter((r) => r.coupleId === cid)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(({ coupleId, ...r }) => ({ ...r }));
  }
  async addMedia(m: MediaInput) {
    const cid = this.coupleId();
    const v = checkMedia(m);
    const row: MediaRow = { ...v, rating: null, id: uuid(), coupleId: cid, done: false, doneAt: null, createdBy: this.uid(), createdAt: this.stamp() };
    this.db.media.set(row.id, row);
    this.db.emit('media', cid);
    const { coupleId, ...r } = row;
    return { ...r };
  }
  async updateMedia(id: string, m: MediaInput) {
    const r = this.ownMedia(id);
    if (!r) return;
    const v = checkMedia(m);
    Object.assign(r, v, { rating: r.done ? v.rating : null });
    this.db.emit('media', r.coupleId);
  }
  async setMediaDone(id: string, done: boolean) {
    const r = this.ownMedia(id);
    if (!r) return;
    if (done && !r.done) r.doneAt = this.stamp();
    if (!done) Object.assign(r, { doneAt: null, rating: null });
    r.done = !!done;
    this.db.emit('media', r.coupleId);
  }
  async deleteMedia(id: string) {
    const r = this.ownMedia(id);
    if (!r) return;
    this.db.media.delete(id);
    this.db.emit('media', r.coupleId);
  }

  // ---------- Geschenke ----------
  /** Wie die Datenbank: nur eigenes Paar, und nie Ideen FÜR mich */
  private ownGift(id: string) {
    const r = this.db.gifts.get(id);
    return r && r.coupleId === this.coupleId() && r.forUser !== this.uid() ? r : null;
  }
  private checkGiftTarget(cid: string, v: GiftInput) {
    if (v.forUser && (v.forUser === this.uid() || this.db.members.get(v.forUser) !== cid)) throw new Error('gift_for_invalid');
    if (v.wishId) {
      const w = this.db.gifts.get(v.wishId);
      if (!w || w.coupleId !== cid || w.kind !== 'wish') throw new Error('gift_wish_invalid');
    }
  }
  async listGifts() {
    const cid = this.coupleId();
    const me = this.uid();
    return [...this.db.gifts.values()].filter((r) => r.coupleId === cid && r.forUser !== me)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(({ coupleId, ...r }) => ({ ...r }));
  }
  async addGift(g: GiftInput) {
    const cid = this.coupleId();
    const v = checkGift(g);
    this.checkGiftTarget(cid, v);
    const row: GiftRow = {
      id: uuid(), kind: v.kind, title: v.title, forUser: v.forUser, forName: v.forName, occasion: v.occasion, link: v.link, note: v.note,
      done: false, wishId: v.wishId ?? null, coupleId: cid, createdBy: this.uid(), createdAt: this.stamp(),
    };
    this.db.gifts.set(row.id, row);
    this.db.emit('gifts', cid);
    const { coupleId, ...r } = row;
    return { ...r };
  }
  async updateGift(id: string, g: GiftInput) {
    const r = this.ownGift(id);
    if (!r) return;
    const v = checkGift({ ...g, kind: r.kind });
    if (v.forUser !== r.forUser) this.checkGiftTarget(r.coupleId, { ...v, wishId: null });
    Object.assign(r, { title: v.title, forUser: v.forUser, forName: v.forName, occasion: v.occasion, link: v.link, note: v.note });
    this.db.emit('gifts', r.coupleId);
  }

  // ---------- Zyklus ----------
  private cycleVisible(owner: string) {
    const me = this.uid();
    if (owner === me) return true;
    const cid = this.db.members.get(me);
    return !!this.db.cycleShare.get(owner) && !!cid && this.db.members.get(owner) === cid;
  }
  private emitCycle() {
    const cid = this.myCoupleOrNull();
    if (cid) this.db.emit('cycle', cid);
  }
  async listCyclePeriods() {
    return [...this.db.periods.values()].filter((p) => this.cycleVisible(p.userId))
      .sort((a, b) => a.start.localeCompare(b.start)).map((p) => ({ ...p }));
  }
  private mine(except?: string) {
    const me = this.uid();
    return [...this.db.periods.values()].filter((p) => p.userId === me && p.id !== except);
  }
  async addCyclePeriod(p: CyclePeriodInput) {
    const v = checkPeriod(p, this.mine());
    const row: CyclePeriod = { ...v, id: uuid(), userId: this.uid(), createdAt: this.stamp() };
    this.db.periods.set(row.id, row);
    this.emitCycle();
    return { ...row };
  }
  async updateCyclePeriod(id: string, p: CyclePeriodInput) {
    const r = this.db.periods.get(id);
    if (!r || r.userId !== this.uid()) return;
    Object.assign(r, checkPeriod(p, this.mine(id)));
    this.emitCycle();
  }
  async deleteCyclePeriod(id: string) {
    const r = this.db.periods.get(id);
    if (!r || r.userId !== this.uid()) return;
    this.db.periods.delete(id);
    this.emitCycle();
  }
  async getCycleSharing() {
    return !!this.db.cycleShare.get(this.uid());
  }
  async setCycleSharing(share: boolean) {
    this.db.cycleShare.set(this.uid(), !!share);
    this.emitCycle();
  }

  // ---------- Restaurants ----------
  private ownRestaurant(id: string) {
    const r = this.db.restaurants.get(id);
    return r && r.coupleId === this.coupleId() ? r : null;
  }
  private pubRestaurant({ coupleId, ratings, ...r }: RestaurantRow): Restaurant {
    // wie die Datenbank: Sterne von Personen, die nicht mehr im Paar sind, gibt es nicht
    const members = this.db.membersOf(coupleId);
    return { ...r, ratings: [...ratings].filter(([u]) => members.includes(u)).map(([userId, stars]) => ({ userId, stars })) };
  }
  async listRestaurants() {
    const cid = this.coupleId();
    return [...this.db.restaurants.values()].filter((r) => r.coupleId === cid)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((r) => this.pubRestaurant(r));
  }
  async addRestaurant(r: RestaurantInput) {
    const cid = this.coupleId();
    const v = checkRestaurant(r);
    if (v.photoId && this.db.photos.get(v.photoId)?.coupleId !== cid) fail('restaurant_photo_invalid');
    const row: RestaurantRow = { ...v, id: uuid(), coupleId: cid, ratings: new Map(), createdBy: this.uid(), createdAt: this.stamp() };
    this.db.restaurants.set(row.id, row);
    this.db.emit('restaurants', cid);
    return this.pubRestaurant(row);
  }
  async updateRestaurant(id: string, r: RestaurantInput) {
    const row = this.ownRestaurant(id);
    if (!row) return;
    const v = checkRestaurant(r);
    if (v.photoId && v.photoId !== row.photoId && this.db.photos.get(v.photoId)?.coupleId !== row.coupleId) fail('restaurant_photo_invalid');
    if (!v.visitedOn) row.ratings.clear();
    Object.assign(row, v);
    this.db.emit('restaurants', row.coupleId);
  }
  async deleteRestaurant(id: string) {
    const row = this.ownRestaurant(id);
    if (!row) return;
    this.db.restaurants.delete(id);
    this.db.emit('restaurants', row.coupleId);
  }
  async rateRestaurant(id: string, stars: number | null) {
    const s = checkStars(stars);
    const row = this.ownRestaurant(id);
    if (!row) {
      if (s != null) fail('restaurant_mismatch');
      return;
    }
    if (s == null) row.ratings.delete(this.uid());
    else {
      if (!row.visitedOn) fail('restaurant_not_visited');
      row.ratings.set(this.uid(), s);
    }
    this.db.emit('restaurants', row.coupleId);
  }

  // ---------- Date-Liste ----------
  private ownDate(id: string) {
    const r = this.db.dates.get(id);
    return r && r.coupleId === this.coupleId() ? r : null;
  }
  private checkDatePhoto(cid: string, v: DateIdeaInput) {
    if (v.photoId && this.db.photos.get(v.photoId)?.coupleId !== cid) fail('date_photo_invalid');
  }
  async listDateIdeas() {
    const cid = this.coupleId();
    return [...this.db.dates.values()].filter((r) => r.coupleId === cid)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(({ coupleId, ...r }) => ({ ...r }));
  }
  async addDateIdea(d: DateIdeaInput) {
    const cid = this.coupleId();
    const v = checkDateIdea(d);
    this.checkDatePhoto(cid, v);
    const row: DateRow = { ...v, id: uuid(), coupleId: cid, createdBy: this.uid(), createdAt: this.stamp() };
    this.db.dates.set(row.id, row);
    this.db.emit('dates', cid);
    const { coupleId, ...r } = row;
    return { ...r };
  }
  async updateDateIdea(id: string, d: DateIdeaInput) {
    const r = this.ownDate(id);
    if (!r) return;
    const v = checkDateIdea(d);
    if (v.photoId !== r.photoId) this.checkDatePhoto(r.coupleId, v);
    Object.assign(r, v);
    this.db.emit('dates', r.coupleId);
  }
  async deleteDateIdea(id: string) {
    const r = this.ownDate(id);
    if (!r) return;
    this.db.dates.delete(id);
    this.db.emit('dates', r.coupleId);
  }

  // ---------- Meilensteine ----------
  private checkMilestonePhoto(cid: string, v: MilestoneInput) {
    if (v.photoId && this.db.photos.get(v.photoId)?.coupleId !== cid) fail('milestone_photo_invalid');
  }
  private ownMilestone(id: string) {
    const r = this.db.milestones.get(id);
    return r && r.coupleId === this.coupleId() ? r : null;
  }
  async listMilestones() {
    const cid = this.coupleId();
    return [...this.db.milestones.values()].filter((r) => r.coupleId === cid)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)).map(({ coupleId, ...r }) => ({ ...r }));
  }
  async addMilestone(m: MilestoneInput) {
    const cid = this.coupleId();
    const v = checkMilestone(m);
    this.checkMilestonePhoto(cid, v);
    const row: MilestoneRow = { ...v, id: uuid(), coupleId: cid, createdBy: this.uid(), createdAt: this.stamp() };
    this.db.milestones.set(row.id, row);
    this.db.emit('milestones', cid);
    const { coupleId, ...out } = row;
    return out;
  }
  async updateMilestone(id: string, m: MilestoneInput) {
    const r = this.ownMilestone(id);
    if (!r) return;
    const v = checkMilestone(m);
    if (v.photoId !== r.photoId) this.checkMilestonePhoto(r.coupleId, v);
    Object.assign(r, v);
    this.db.emit('milestones', r.coupleId);
  }
  async deleteMilestone(id: string) {
    const r = this.ownMilestone(id);
    if (!r) return;
    this.db.milestones.delete(id);
    this.db.emit('milestones', r.coupleId);
  }

  // ---------- Paar-Quiz ----------
  async listQuizAnswers() {
    const cid = this.coupleId();
    return [...this.db.quiz.values()].filter((r) => r.coupleId === cid)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(({ coupleId, ...r }) => ({ ...r }));
  }
  async addQuizAnswer(a: QuizAnswerInput) {
    const cid = this.coupleId();
    const v = checkQuizAnswer(a);
    if (!this.db.membersOf(cid).includes(v.player!)) fail('quiz_player_invalid');
    if ([...this.db.quiz.values()].some((r) => r.coupleId === cid && r.round === v.round && r.questionId === v.questionId)) fail('quiz_once');
    const row: QuizRow = { ...v, id: uuid(), coupleId: cid, createdBy: this.uid(), createdAt: this.stamp() };
    this.db.quiz.set(row.id, row);
    this.db.emit('quiz', cid);
    const { coupleId, ...out } = row;
    return out;
  }
  async setGiftDone(id: string, done: boolean) {
    const r = this.ownGift(id);
    if (!r || r.kind !== 'idea') return;
    r.done = !!done;
    this.db.emit('gifts', r.coupleId);
  }
  async deleteGift(id: string) {
    const r = this.ownGift(id);
    if (!r) return;
    this.db.gifts.delete(id);
    for (const x of this.db.gifts.values()) if (x.wishId === id) x.wishId = null;
    this.db.emit('gifts', r.coupleId);
  }

  // ---------- Einkauf ----------
  private ownItem(id: string) {
    const s = this.db.shopping.get(id);
    return s && s.coupleId === this.coupleId() ? s : null;
  }
  async listShopping() {
    const cid = this.coupleId();
    return [...this.db.shopping.values()].filter((s) => s.coupleId === cid).map(({ coupleId, ...s }) => s);
  }
  async addShopping(i: ShoppingInput) {
    const cid = this.coupleId();
    const row: ShopRow = {
      ...checkShopping(i), id: uuid(), coupleId: cid, done: false, createdBy: this.uid(),
      createdAt: new Date(this.db.now() + seq).toISOString(),
    };
    this.db.shopping.set(row.id, row);
    this.db.emit('shopping', cid);
    const { coupleId, ...s } = row;
    return { ...s };
  }
  async setShoppingDone(id: string, done: boolean) {
    const s = this.ownItem(id);
    if (!s) return;
    s.done = done;
    this.db.emit('shopping', s.coupleId);
  }
  async updateShopping(id: string, i: ShoppingInput) {
    const s = this.ownItem(id);
    if (!s) return;
    Object.assign(s, checkShopping(i));
    this.db.emit('shopping', s.coupleId);
  }
  async deleteShopping(id: string) {
    const s = this.ownItem(id);
    if (!s) return;
    this.db.shopping.delete(id);
    this.db.emit('shopping', s.coupleId);
  }
  async clearDoneShopping() {
    const cid = this.coupleId();
    for (const [k, v] of this.db.shopping) if (v.coupleId === cid && v.done) this.db.shopping.delete(k);
    this.db.emit('shopping', cid);
  }

  subscribe(table: Table, cb: () => void): Unsubscribe {
    return this.db.listen(table, this.myCoupleOrNull, cb);
  }
}
