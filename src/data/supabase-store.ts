/**
 * Verbindung zu Supabase (Server in der EU). Alle Zugriffsregeln liegen in der Datenbank (RLS),
 * die App kann also auch bei einem Fehler nie fremde Daten sehen.
 */
import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { secureStorage } from './secure-storage';
import type { DataStore, LiveTable, Unsubscribe } from './store';
import type {
  Birthday, BirthdayInput, Note, NoteInput, CalendarEvent, Couple, EventInput, PersonColor, Profile, Session, ShoppingInput, ShoppingItem,
} from './types';
import {
  checkBirthday, checkColor, checkNote, checkCouple, checkDisplayName, checkEmail, checkEvent, checkLoginCode, checkPassword, checkShopping,
  normalizeInviteCode,
} from './validate';

type Row = Record<string, any>;

function must<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}
/** Wie must(), aber es muss genau eine Zeile zurückkommen. */
function one(res: { data: Row | null; error: unknown }): Row {
  const r = must(res);
  if (!r) throw new Error('not_found');
  return r;
}

const toProfile = (r: Row): Profile => ({ id: r.id, displayName: r.display_name, color: r.color });
const toEvent = (r: Row): CalendarEvent => ({
  id: r.id, title: r.title, date: r.date, time: r.time ? String(r.time).slice(0, 5) : null,
  note: r.note, who: r.who, createdBy: r.created_by,
});
const toItem = (r: Row): ShoppingItem => ({
  id: r.id, text: r.text, qty: r.qty, done: r.done, createdBy: r.created_by, createdAt: r.created_at,
});
const toBirthday = (r: Row): Birthday => ({
  id: r.id, name: r.name, month: r.month, day: r.day, year: r.year, note: r.note, createdBy: r.created_by,
});
const toNote = (r: Row): Note => ({
  id: r.id, title: r.title, body: r.body, color: r.color, createdBy: r.created_by, updatedBy: r.updated_by, updatedAt: r.updated_at,
});
const NOTE_COLS = 'id, title, body, color, created_by, updated_by, updated_at';
const BD_COLS = 'id, name, month, day, year, note, created_by';
const eventRow = (e: EventInput) => ({ title: e.title, date: e.date, time: e.time, note: e.note, who: e.who });

export class SupabaseStore implements DataStore {
  readonly kind = 'supabase' as const;
  private sb: SupabaseClient;
  private coupleCache: string | null = null;

  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey, {
      auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });
    // Token nur erneuern, solange die App im Vordergrund ist (Supabase-Empfehlung für React Native)
    AppState.addEventListener('change', (s) => {
      if (s === 'active') this.sb.auth.startAutoRefresh();
      else this.sb.auth.stopAutoRefresh();
    });
  }

  // ---------- Anmeldung ----------
  async getSession(): Promise<Session | null> {
    const { data } = await this.sb.auth.getSession();
    const u = data.session?.user;
    return u ? { userId: u.id, email: u.email ?? null } : null;
  }
  onSessionChange(cb: (s: Session | null) => void): Unsubscribe {
    const { data } = this.sb.auth.onAuthStateChange((_ev, s) => {
      this.coupleCache = null;
      cb(s?.user ? { userId: s.user.id, email: s.user.email ?? null } : null);
    });
    return () => data.subscription.unsubscribe();
  }
  async signUpWithPassword(email: string, password: string) {
    const { data, error } = await this.sb.auth.signUp({ email: checkEmail(email), password: checkPassword(password) });
    if (error) throw error;
    // Bei bestehender, bestätigter E-Mail liefert Supabase (gegen Konten-Ausspähen) einen Nutzer ohne Identitäten.
    if (data.user && data.user.identities && data.user.identities.length === 0) throw new Error('User already registered');
    return data.session ? 'signedIn' : 'confirm';
  }
  async signInWithPassword(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email: checkEmail(email), password });
    if (error) throw error;
  }
  async sendLoginCode(email: string) {
    const { error } = await this.sb.auth.signInWithOtp({ email: checkEmail(email), options: { shouldCreateUser: true } });
    if (error) throw error;
  }
  async verifyLoginCode(email: string, code: string) {
    const { error } = await this.sb.auth.verifyOtp({ email: checkEmail(email), token: checkLoginCode(code), type: 'email' });
    if (error) throw error;
  }
  async signOut() {
    await this.sb.auth.signOut();
  }

  private async uid(): Promise<string> {
    const s = await this.getSession();
    if (!s) throw new Error('not_authenticated');
    return s.userId;
  }
  private async coupleId(): Promise<string> {
    if (this.coupleCache) return this.coupleCache;
    const id = must(await this.sb.rpc('my_couple_id')) as string | null;
    if (!id) throw new Error('not_in_couple');
    return (this.coupleCache = id);
  }

  // ---------- Profil & Paar ----------
  async getMyProfile() {
    const me = await this.uid();
    const r = must(await this.sb.from('profiles').select('id, display_name, color').eq('id', me).maybeSingle());
    return r ? toProfile(r) : null;
  }
  async saveMyProfile(p: { displayName: string; color: PersonColor }) {
    const me = await this.uid();
    const r = one(await this.sb.from('profiles')
      .upsert({ id: me, display_name: checkDisplayName(p.displayName), color: checkColor(p.color) })
      .select('id, display_name, color').single());
    return toProfile(r);
  }
  async getMyCouple(): Promise<Couple | null> {
    const id = must(await this.sb.rpc('my_couple_id')) as string | null;
    this.coupleCache = id;
    if (!id) return null;
    const c = one(await this.sb.from('couples').select('id, together_since, names').eq('id', id).single());
    // Mitglieder und Einladung sind Zusatzinfos: ein Fehler hier darf den Rest nicht blockieren.
    let members: Profile[] = [];
    let inviteCode: string | null = null;
    try {
      const m = must(await this.sb.from('couple_members').select('user_id').eq('couple_id', id)) as Row[];
      const ids = m.map((x) => x.user_id);
      if (ids.length) members = (must(await this.sb.from('profiles').select('id, display_name, color').in('id', ids)) as Row[]).map(toProfile);
    } catch (e) {
      console.warn('Mitglieder konnten nicht geladen werden', e);
    }
    try {
      const inv = must(await this.sb.from('couple_invites').select('code, expires_at').eq('couple_id', id).maybeSingle()) as Row | null;
      if (inv && new Date(inv.expires_at).getTime() > Date.now()) inviteCode = inv.code;
    } catch (e) {
      console.warn('Einladung konnte nicht geladen werden', e);
    }
    return { id: c.id, togetherSince: c.together_since, names: c.names, members, inviteCode };
  }
  async createCouple() {
    this.coupleCache = must(await this.sb.rpc('create_couple')) as string;
  }
  async createInvite() {
    return must(await this.sb.rpc('create_invite')) as string;
  }
  async joinCouple(code: string) {
    this.coupleCache = must(await this.sb.rpc('join_couple', { invite_code: normalizeInviteCode(code) })) as string;
  }
  async leaveCouple() {
    must(await this.sb.rpc('leave_couple'));
    this.coupleCache = null;
  }
  async updateCouple(p: { togetherSince: string | null; names: string | null }) {
    const v = checkCouple(p);
    must(await this.sb.from('couples').update({ together_since: v.togetherSince, names: v.names }).eq('id', await this.coupleId()));
  }
  async deleteAccount() {
    must(await this.sb.rpc('delete_my_account'));
    this.coupleCache = null;
    // Lokale Anmeldung entfernen (das Konto existiert serverseitig nicht mehr)
    await this.sb.auth.signOut({ scope: 'local' });
  }

  // ---------- Kalender ----------
  async listEvents() {
    const r = must(await this.sb.from('events').select('id, title, date, time, note, who, created_by')
      .eq('couple_id', await this.coupleId()).order('date').order('time', { nullsFirst: true })) as Row[];
    return r.map(toEvent);
  }
  async addEvent(e: EventInput) {
    const r = one(await this.sb.from('events').insert({ ...eventRow(checkEvent(e)), couple_id: await this.coupleId() })
      .select('id, title, date, time, note, who, created_by').single());
    return toEvent(r);
  }
  async updateEvent(id: string, e: EventInput) {
    must(await this.sb.from('events').update(eventRow(checkEvent(e))).eq('id', id));
  }
  async deleteEvent(id: string) {
    must(await this.sb.from('events').delete().eq('id', id));
  }

  // ---------- Geburtstage ----------
  async listBirthdays() {
    const r = must(await this.sb.from('birthdays').select(BD_COLS).eq('couple_id', await this.coupleId())
      .order('month').order('day')) as Row[];
    return r.map(toBirthday);
  }
  async addBirthday(b: BirthdayInput) {
    const v = checkBirthday(b);
    return toBirthday(one(await this.sb.from('birthdays').insert({ ...v, couple_id: await this.coupleId() }).select(BD_COLS).single()));
  }
  async updateBirthday(id: string, b: BirthdayInput) {
    must(await this.sb.from('birthdays').update(checkBirthday(b)).eq('id', id));
  }
  async deleteBirthday(id: string) {
    must(await this.sb.from('birthdays').delete().eq('id', id));
  }

  // ---------- Notizen ----------
  async listNotes() {
    const r = must(await this.sb.from('notes').select(NOTE_COLS).eq('couple_id', await this.coupleId())
      .order('updated_at', { ascending: false })) as Row[];
    return r.map(toNote);
  }
  async addNote(n: NoteInput) {
    return toNote(one(await this.sb.from('notes').insert({ ...checkNote(n), couple_id: await this.coupleId() }).select(NOTE_COLS).single()));
  }
  async updateNote(id: string, n: NoteInput) {
    must(await this.sb.from('notes').update(checkNote(n)).eq('id', id));
  }
  async deleteNote(id: string) {
    must(await this.sb.from('notes').delete().eq('id', id));
  }

  // ---------- Einkauf ----------
  async listShopping() {
    const r = must(await this.sb.from('shopping_items').select('id, text, qty, done, created_by, created_at')
      .eq('couple_id', await this.coupleId()).order('created_at')) as Row[];
    return r.map(toItem);
  }
  async addShopping(i: ShoppingInput) {
    const v = checkShopping(i);
    const r = one(await this.sb.from('shopping_items').insert({ text: v.text, qty: v.qty, couple_id: await this.coupleId() })
      .select('id, text, qty, done, created_by, created_at').single());
    return toItem(r);
  }
  async setShoppingDone(id: string, done: boolean) {
    must(await this.sb.from('shopping_items').update({ done }).eq('id', id));
  }
  async updateShopping(id: string, i: ShoppingInput) {
    const v = checkShopping(i);
    must(await this.sb.from('shopping_items').update({ text: v.text, qty: v.qty }).eq('id', id));
  }
  async deleteShopping(id: string) {
    must(await this.sb.from('shopping_items').delete().eq('id', id));
  }
  async clearDoneShopping() {
    must(await this.sb.from('shopping_items').delete().eq('couple_id', await this.coupleId()).eq('done', true));
  }

  // ---------- Live-Sync ----------
  subscribe(table: LiveTable, cb: () => void): Unsubscribe {
    const tables = { events: ['events'], shopping: ['shopping_items'], birthdays: ['birthdays'], notes: ['notes'], couple: ['couples', 'couple_members'] }[table];
    const ch = this.sb.channel(`wz-${table}-${Math.random().toString(36).slice(2)}`);
    // RLS filtert serverseitig: es kommen nur Änderungen des eigenen Paares an.
    for (const t of tables) ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => cb());
    ch.subscribe();
    return () => {
      this.sb.removeChannel(ch);
    };
  }
}
