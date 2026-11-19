/**
 * Verbindung zu Supabase (Server in der EU). Alle Zugriffsregeln liegen in der Datenbank (RLS),
 * die App kann also auch bei einem Fehler nie fremde Daten sehen.
 */
import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { secureStorage } from './secure-storage';
import { base64ToBytes } from '../lib/base64';
import type { DataStore, LiveTable, Unsubscribe } from './store';
import type {
  Birthday, BirthdayInput, Note, NoteInput, Recipe, RecipeInput, Trip, TripInput, TripItem, Photo, PhotoUpload, Media, MediaInput, Gift, GiftInput, QuizAnswer, QuizAnswerInput, CalendarEvent, Couple, EventInput, PersonColor, Profile, Session, ShoppingInput, ShoppingItem,
} from './types';
import {
  checkBirthday, checkColor, checkNote, checkRecipe, checkTrip, checkTripItem, checkCaption, checkPhoto, checkMedia, checkGift, checkPrefs, checkQuizAnswer, checkCouple, checkDisplayName, checkEmail, checkEvent, checkLoginCode, checkPassword, checkShopping,
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
const toRecipe = (r: Row): Recipe => ({
  id: r.id, title: r.title, servings: r.servings, minutes: r.minutes, ingredients: r.ingredients, steps: r.steps,
  source: r.source, favorite: r.favorite, createdBy: r.created_by, updatedAt: r.updated_at,
});
const RECIPE_COLS = 'id, title, servings, minutes, ingredients, steps, source, favorite, created_by, updated_at';
const toTrip = (r: Row): Trip => ({
  id: r.id, title: r.title, startDate: r.start_date, endDate: r.end_date, note: r.note, createdBy: r.created_by,
});
const TRIP_COLS = 'id, title, start_date, end_date, note, created_by';
const toTripItem = (r: Row): TripItem => ({
  id: r.id, tripId: r.trip_id, text: r.text, done: r.done, createdBy: r.created_by, createdAt: r.created_at,
});
const TRIP_ITEM_COLS = 'id, trip_id, text, done, created_by, created_at';
const tripRow = (v: TripInput) => ({ title: v.title, start_date: v.startDate, end_date: v.endDate, note: v.note });
const toPhoto = (r: Row): Photo => ({
  id: r.id, path: r.path, caption: r.caption, width: r.width, height: r.height, createdBy: r.created_by, createdAt: r.created_at,
});
const PHOTO_COLS = 'id, path, caption, width, height, created_by, created_at';
const toMedia = (r: Row): Media => ({
  id: r.id, title: r.title, kind: r.kind, platform: r.platform, note: r.note, done: r.done, rating: r.rating,
  doneAt: r.done_at, createdBy: r.created_by, createdAt: r.created_at,
});
const MEDIA_COLS = 'id, title, kind, platform, note, done, rating, done_at, created_by, created_at';
const toGift = (r: Row): Gift => ({
  id: r.id, kind: r.kind, title: r.title, forUser: r.for_user, forName: r.for_name, occasion: r.occasion, link: r.link,
  note: r.note, done: r.done, wishId: r.wish_id, createdBy: r.created_by, createdAt: r.created_at,
});
const GIFT_COLS = 'id, kind, title, for_user, for_name, occasion, link, note, done, wish_id, created_by, created_at';
const giftRow = (v: GiftInput) => ({ title: v.title, for_user: v.forUser, for_name: v.forName, occasion: v.occasion, link: v.link, note: v.note });
const toQuiz = (r: Row): QuizAnswer => ({
  id: r.id, round: r.round, questionId: r.question_id, player: r.player, answer: r.answer, createdBy: r.created_by, createdAt: r.created_at,
});
const QUIZ_COLS = 'id, round, question_id, player, answer, created_by, created_at';
const NOTE_COLS = 'id, title, body, color, created_by, updated_by, updated_at';
const BD_COLS = 'id, name, month, day, year, note, created_by';
const eventRow = (e: EventInput) => ({ title: e.title, date: e.date, time: e.time, note: e.note, who: e.who });

export class SupabaseStore implements DataStore {
  readonly kind = 'supabase' as const;
  private sb: SupabaseClient;
  private coupleCache: string | null = null;
  /** Signierte Links (1 Stunde gültig) zwischenspeichern, damit Bilder nicht ständig neu laden */
  private urlCache = new Map<string, { url: string; until: number }>();

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
  async getMyPrefs() {
    const me = await this.uid();
    const r = must(await this.sb.from('user_prefs').select('prefs').eq('user_id', me).maybeSingle());
    return r ? (r.prefs as unknown) : null;
  }
  async saveMyPrefs(prefs: object) {
    const me = await this.uid();
    must(await this.sb.from('user_prefs').upsert({ user_id: me, prefs: checkPrefs(prefs) }, { onConflict: 'user_id' }));
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
  /**
   * Wer als Letzter das Paar verlässt oder sein Konto löscht, nimmt die Fotodateien mit.
   * (Dateien im Speicher kann die Datenbank nicht selbst löschen, das geht nur über die Storage-API.)
   */
  private async purgePhotosIfLast() {
    let cid: string;
    try {
      cid = await this.coupleId();
    } catch {
      return; // kein Paar, keine Fotos
    }
    const members = must(await this.sb.from('couple_members').select('user_id').eq('couple_id', cid)) as Row[];
    if (members.length > 1) return;
    const rows = must(await this.sb.from('photos').select('path').eq('couple_id', cid)) as Row[];
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await this.sb.storage.from('photos').remove(rows.slice(i, i + 100).map((r) => r.path as string));
      if (error) throw error;
    }
  }

  async leaveCouple() {
    await this.purgePhotosIfLast();
    must(await this.sb.rpc('leave_couple'));
    this.coupleCache = null;
  }
  async updateCouple(p: { togetherSince: string | null; names: string | null }) {
    const v = checkCouple(p);
    must(await this.sb.from('couples').update({ together_since: v.togetherSince, names: v.names }).eq('id', await this.coupleId()));
  }
  async deleteAccount() {
    await this.purgePhotosIfLast();
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

  // ---------- Rezepte ----------
  async listRecipes() {
    const r = must(await this.sb.from('recipes').select(RECIPE_COLS).eq('couple_id', await this.coupleId())
      .order('title', { ascending: true })) as Row[];
    return r.map(toRecipe);
  }
  async addRecipe(input: RecipeInput) {
    return toRecipe(one(await this.sb.from('recipes').insert({ ...checkRecipe(input), couple_id: await this.coupleId() }).select(RECIPE_COLS).single()));
  }
  async updateRecipe(id: string, input: RecipeInput) {
    must(await this.sb.from('recipes').update(checkRecipe(input)).eq('id', id));
  }
  async setRecipeFavorite(id: string, favorite: boolean) {
    must(await this.sb.from('recipes').update({ favorite }).eq('id', id));
  }
  async deleteRecipe(id: string) {
    must(await this.sb.from('recipes').delete().eq('id', id));
  }

  // ---------- Reisen ----------
  async listTrips() {
    const r = must(await this.sb.from('trips').select(TRIP_COLS).eq('couple_id', await this.coupleId())
      .order('start_date', { ascending: true, nullsFirst: false }).order('created_at')) as Row[];
    return r.map(toTrip);
  }
  async addTrip(input: TripInput) {
    return toTrip(one(await this.sb.from('trips').insert({ ...tripRow(checkTrip(input)), couple_id: await this.coupleId() }).select(TRIP_COLS).single()));
  }
  async updateTrip(id: string, input: TripInput) {
    must(await this.sb.from('trips').update(tripRow(checkTrip(input))).eq('id', id));
  }
  async deleteTrip(id: string) {
    must(await this.sb.from('trips').delete().eq('id', id));
  }
  async listTripItems(tripId?: string) {
    let q = this.sb.from('trip_items').select(TRIP_ITEM_COLS).eq('couple_id', await this.coupleId());
    if (tripId) q = q.eq('trip_id', tripId);
    const r = must(await q.order('created_at')) as Row[];
    return r.map(toTripItem);
  }
  async addTripItem(tripId: string, text: string) {
    return toTripItem(one(await this.sb.from('trip_items').insert({ trip_id: tripId, text: checkTripItem(text), couple_id: await this.coupleId() })
      .select(TRIP_ITEM_COLS).single()));
  }
  async setTripItemDone(id: string, done: boolean) {
    must(await this.sb.from('trip_items').update({ done }).eq('id', id));
  }
  async deleteTripItem(id: string) {
    must(await this.sb.from('trip_items').delete().eq('id', id));
  }

  // ---------- Fotoalbum ----------
  async listPhotos() {
    const r = must(await this.sb.from('photos').select(PHOTO_COLS).eq('couple_id', await this.coupleId())
      .order('created_at', { ascending: false })) as Row[];
    return r.map(toPhoto);
  }
  async addPhoto(p: PhotoUpload) {
    const v = checkPhoto(p);
    // Erst den Album-Eintrag anlegen (die Datenbank bestimmt den Dateipfad), dann die Datei hochladen.
    const row = toPhoto(one(await this.sb.from('photos')
      .insert({ caption: v.caption, width: v.width, height: v.height, couple_id: await this.coupleId() }).select(PHOTO_COLS).single()));
    const { error } = await this.sb.storage.from('photos').upload(row.path, base64ToBytes(v.base64), { contentType: 'image/jpeg', upsert: false });
    if (error) {
      await this.sb.from('photos').delete().eq('id', row.id);
      throw error;
    }
    return row;
  }
  async updatePhotoCaption(id: string, caption: string | null) {
    must(await this.sb.from('photos').update({ caption: checkCaption(caption) }).eq('id', id));
  }
  async deletePhoto(id: string) {
    const r = (must(await this.sb.from('photos').select('path').eq('id', id)) as Row[])[0];
    if (!r) return;
    const { error } = await this.sb.storage.from('photos').remove([r.path]);
    if (error) throw error;
    must(await this.sb.from('photos').delete().eq('id', id));
    this.urlCache.delete(r.path);
  }
  async photoUrls(photos: Photo[]) {
    const now = Date.now();
    const out: Record<string, string> = {};
    const missing: Photo[] = [];
    for (const p of photos) {
      const c = this.urlCache.get(p.path);
      if (c && c.until > now) out[p.id] = c.url;
      else missing.push(p);
    }
    for (let i = 0; i < missing.length; i += 100) {
      const part = missing.slice(i, i + 100);
      const { data, error } = await this.sb.storage.from('photos').createSignedUrls(part.map((p) => p.path), 3600);
      if (error) throw error;
      for (const d of data ?? []) {
        const p = part.find((x) => x.path === d.path);
        if (p && d.signedUrl) {
          out[p.id] = d.signedUrl;
          this.urlCache.set(p.path, { url: d.signedUrl, until: now + 50 * 60 * 1000 });
        }
      }
    }
    return out;
  }

  // ---------- Filme & Serien ----------
  async listMedia() {
    const r = must(await this.sb.from('media').select(MEDIA_COLS).eq('couple_id', await this.coupleId()).order('created_at')) as Row[];
    return r.map(toMedia);
  }
  async addMedia(m: MediaInput) {
    const v = checkMedia(m);
    return toMedia(one(await this.sb.from('media').insert({ title: v.title, kind: v.kind, platform: v.platform, note: v.note, couple_id: await this.coupleId() })
      .select(MEDIA_COLS).single()));
  }
  async updateMedia(id: string, m: MediaInput) {
    const v = checkMedia(m);
    must(await this.sb.from('media').update({ title: v.title, kind: v.kind, platform: v.platform, note: v.note, rating: v.rating }).eq('id', id));
  }
  async setMediaDone(id: string, done: boolean) {
    must(await this.sb.from('media').update({ done }).eq('id', id));
  }
  async deleteMedia(id: string) {
    must(await this.sb.from('media').delete().eq('id', id));
  }

  // ---------- Geschenke ----------
  async listGifts() {
    const r = must(await this.sb.from('gifts').select(GIFT_COLS).eq('couple_id', await this.coupleId()).order('created_at')) as Row[];
    return r.map(toGift);
  }
  async addGift(g: GiftInput) {
    const v = checkGift(g);
    return toGift(one(await this.sb.from('gifts').insert({ ...giftRow(v), kind: v.kind, wish_id: v.wishId ?? null, couple_id: await this.coupleId() })
      .select(GIFT_COLS).single()));
  }
  async updateGift(id: string, g: GiftInput) {
    must(await this.sb.from('gifts').update(giftRow(checkGift(g))).eq('id', id));
  }
  async setGiftDone(id: string, done: boolean) {
    must(await this.sb.from('gifts').update({ done }).eq('id', id).eq('kind', 'idea'));
  }
  async deleteGift(id: string) {
    must(await this.sb.from('gifts').delete().eq('id', id));
  }

  // ---------- Paar-Quiz ----------
  async listQuizAnswers() {
    const r = must(await this.sb.from('quiz_answers').select(QUIZ_COLS).eq('couple_id', await this.coupleId()).order('created_at')) as Row[];
    return r.map(toQuiz);
  }
  async addQuizAnswer(a: QuizAnswerInput) {
    const v = checkQuizAnswer(a);
    return toQuiz(one(await this.sb.from('quiz_answers')
      .insert({ round: v.round, question_id: v.questionId, player: v.player, answer: v.answer, couple_id: await this.coupleId() })
      .select(QUIZ_COLS).single()));
  }

  // ---------- Live-Sync ----------
  subscribe(table: LiveTable, cb: () => void): Unsubscribe {
    const tables = { events: ['events'], shopping: ['shopping_items'], birthdays: ['birthdays'], notes: ['notes'], recipes: ['recipes'], trips: ['trips', 'trip_items'], photos: ['photos'], media: ['media'], gifts: ['gifts'], quiz: ['quiz_answers'], couple: ['couples', 'couple_members'] }[table];
    const ch = this.sb.channel(`wz-${table}-${Math.random().toString(36).slice(2)}`);
    // RLS filtert serverseitig: es kommen nur Änderungen des eigenen Paares an.
    for (const t of tables) ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => cb());
    ch.subscribe();
    return () => {
      this.sb.removeChannel(ch);
    };
  }
}
