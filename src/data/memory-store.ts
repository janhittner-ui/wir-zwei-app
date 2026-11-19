/**
 * Strenge Nachbildung der Datenbank im Speicher.
 * - Demo-Modus: App läuft sofort in Expo Go, auch ohne Supabase-Projekt (nichts wird gespeichert).
 * - Tests: mehrere Nutzer teilen sich ein MemoryBackend, alle Regeln der echten DB gelten hier auch.
 */
import type { DataStore, LiveTable, Unsubscribe } from './store';
import type {
  Birthday, BirthdayInput, Note, NoteInput, Recipe, RecipeInput, CalendarEvent, Couple, EventInput, PersonColor, Profile, Session, ShoppingInput, ShoppingItem,
} from './types';
import {
  checkBirthday, checkColor, checkNote, checkRecipe, checkCouple, checkDisplayName, checkEmail, checkEvent, checkLoginCode, checkPassword, checkShopping,
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
    if (!id || this.db.passwords.get(id) !== password) fail('Invalid login credentials');
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
    for (const n of this.db.notes.values()) {
      if (n.createdBy === me) n.createdBy = null;
      if (n.updatedBy === me) n.updatedBy = null;
    }
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
      .sort((a, b) => a.title.localeCompare(b.title, 'de')).map(({ coupleId, ...r }) => ({ ...r }));
  }
  async addRecipe(input: RecipeInput) {
    const cid = this.coupleId();
    const row: RecipeRow = { ...checkRecipe(input), id: uuid(), coupleId: cid, favorite: false, createdBy: this.uid(), updatedAt: this.stamp() };
    this.db.recipes.set(row.id, row);
    this.db.emit('recipes', cid);
    const { coupleId, ...r } = row;
    return { ...r };
  }
  async updateRecipe(id: string, input: RecipeInput) {
    const r = this.ownRecipe(id);
    if (!r) return;
    Object.assign(r, checkRecipe(input), { updatedAt: this.stamp() });
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
