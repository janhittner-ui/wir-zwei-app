/**
 * App-Logik gegen die strenge Mock-DB (MemoryStore) und Helfer.
 * Start: npm run test:app
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { MemoryBackend, MemoryStore } from '../src/data/memory-store';
import { friendlyError } from '../src/data/errors';
import { checkEvent, normalizeInviteCode, normalizeTime } from '../src/data/validate';
import { dayVerse, fromGerman, monthGrid, together, toGerman } from '../src/lib/dates';
import { splitQty } from '../src/lib/qty';
import { birthdayIn, nextBirthday, searchKey, upcomingBirthdays } from '../src/lib/birthdays';
import { shopEmoji } from '../src/lib/shop-emoji';
import { VERSES } from '../src/lib/verses';
import { groupTrips, nextTrip, tripCountdown, tripDays, tripRange, tripStatus } from '../src/lib/trips';
import type { Trip } from '../src/data/types';
import { base64ToBytes } from '../src/lib/base64';
import { cycleHeadline, cycleInfo, cycleMarks } from '../src/lib/cycle';
import { checkDateIdea, checkPeriod, checkRestaurant, checkStars } from '../src/data/validate';
import { avgStars, dateTitleFor, priceText, restaurantSub, splitRestaurants, starsText } from '../src/lib/restaurants';
import { DATE_CATEGORY, DATE_SUGGESTIONS, openSuggestions, pickKey, randomDate, splitDates } from '../src/lib/date-ideas';
import { dots, specialDays, specialText, sortTimeline } from '../src/lib/milestones';
import { questionOrder, questionText, quizState } from '../src/lib/quiz';
import { QUIZ_QUESTIONS, QUIZ_TOPICS } from '../src/lib/quiz-questions';
import { DEFAULT_PREFS, move, normalizePrefs, toggleHidden, visible } from '../src/lib/prefs';
import { amountText, formatAmount, formatMinutes, parseIngredient, parseIngredients, parseSteps, scaleLine, toShopping } from '../src/lib/recipe';

async function login(store: MemoryStore, email: string) {
  await store.signUpWithPassword(email, 'geheim123');
}

describe('Paar-Ablauf mit zwei Handys (Mock-DB)', () => {
  const db = new MemoryBackend();
  const jan = new MemoryStore(db);
  const vanessa = new MemoryStore(db);
  const fremd = new MemoryStore(db);

  test('Anmeldung: falscher Code wird abgelehnt', async () => {
    await jan.sendLoginCode('code@example.org');
    await assert.rejects(() => jan.verifyLoginCode('code@example.org', '000000'), /invalid/);
    assert.equal(await jan.getSession(), null);
  });

  test('Anmeldung mit Passwort: Regeln und Fehlermeldungen', async () => {
    const s = new MemoryStore(db);
    await assert.rejects(() => s.signUpWithPassword('pw@example.org', 'kurz'), /mindestens 8/);
    await s.signUpWithPassword('PW@example.org', 'richtig123');
    await s.signOut();
    await assert.rejects(() => s.signUpWithPassword('pw@example.org', 'nochmal123'), (e) => /schon ein Konto/.test(friendlyError(e)));
    await assert.rejects(() => s.signInWithPassword('pw@example.org', 'falsch123'), (e) => /stimmt nicht/.test(friendlyError(e)));
    await s.signInWithPassword(' pw@example.org ', 'richtig123');
    await s.signInWithPassword('pw@example.org', 'richtig123\n'); // eingefügt mit Zeilenumbruch
    assert.equal((await s.getSession())?.email, 'pw@example.org');
  });

  test('Kopplung per Code und Live-Sync', async () => {
    await login(jan, ' Jan@Example.org ');
    await login(vanessa, 'vanessa@example.org');
    await login(fremd, 'x@example.org');
    await jan.saveMyProfile({ displayName: ' Jan ', color: 'blue' });
    await vanessa.saveMyProfile({ displayName: 'Vanessa', color: 'pink' });
    await fremd.saveMyProfile({ displayName: 'X', color: 'blue' });

    await jan.createCouple();
    const code = await jan.createInvite();
    await assert.rejects(() => fremd.joinCouple('ABCD-EFGH'), /invalid_code/);
    await vanessa.joinCouple(`${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`);
    await assert.rejects(() => fremd.joinCouple(code), /invalid_code/);
    await assert.rejects(() => jan.createInvite(), /couple_full/);

    const c = await vanessa.getMyCouple();
    assert.deepEqual(c?.members.map((m) => m.displayName).sort(), ['Jan', 'Vanessa']);
    assert.equal(c?.inviteCode, null);

    let pings = 0;
    const off = vanessa.subscribe('shopping', () => pings++);
    await jan.addShopping({ text: 'Milch', qty: '2 l' });
    off();
    assert.equal(pings, 1);
    assert.equal((await vanessa.listShopping()).length, 1);
    await assert.rejects(() => fremd.listShopping(), /not_in_couple/);
  });

  test('Termine: Prüfungen wie in der echten DB', async () => {
    const me = (await jan.getSession())!.userId;
    const fremdId = (await fremd.getSession())!.userId;
    const e = await jan.addEvent({ title: ' Kino ', date: '2026-12-01', time: '19.30', note: '', who: me });
    assert.equal(e.title, 'Kino');
    assert.equal(e.time, '19:30');
    assert.equal(e.note, null);
    await assert.rejects(() => jan.addEvent({ title: 'x', date: '2026-02-30', time: null, note: null, who: null }), /Datum/);
    await assert.rejects(() => jan.addEvent({ title: 'x', date: '2026-12-01', time: '25:00', note: null, who: null }), /Uhrzeit/);
    await assert.rejects(() => jan.addEvent({ title: '', date: '2026-12-01', time: null, note: null, who: null }), /Titel/);
    await assert.rejects(() => jan.addEvent({ title: 'x', date: '2026-12-01', time: null, note: null, who: fremdId }), /who_not_member/);
    // Fremde können nichts ändern oder löschen (still ignoriert wie RLS)
    await fremd.createCouple();
    await fremd.updateEvent(e.id, { title: 'gehackt', date: '2026-12-01', time: null, note: null, who: null });
    await fremd.deleteEvent(e.id);
    assert.equal((await vanessa.listEvents())[0].title, 'Kino');
  });

  test('Geburtstage: anlegen, prüfen, teilen', async () => {
    const b = await jan.addBirthday({ name: ' Oma  Helga ', month: 3, day: 14, year: 1941, note: '' });
    assert.equal(b.name, 'Oma Helga');
    assert.equal(b.note, null);
    await assert.rejects(() => jan.addBirthday({ name: 'X', month: 4, day: 31, year: null, note: null }), /zwischen 1 und 30/);
    await assert.rejects(() => jan.addBirthday({ name: 'X', month: 2, day: 30, year: null, note: null }), /zwischen 1 und 29/);
    await assert.rejects(() => jan.addBirthday({ name: 'X', month: 1, day: 1, year: 2999, note: null }), /Jahr/);
    await assert.rejects(() => jan.addBirthday({ name: '', month: 1, day: 1, year: null, note: null }), /Namen/);
    await assert.rejects(() => jan.addBirthday({ name: 'X', month: 1, day: NaN, year: null, note: null }), /Tag/);
    let pings = 0;
    const off = vanessa.subscribe('birthdays', () => pings++);
    await jan.updateBirthday(b.id, { name: 'Oma Helga', month: 3, day: 15, year: 1941, note: 'Pralinen' });
    off();
    assert.equal(pings, 1);
    assert.equal((await vanessa.listBirthdays())[0].day, 15);
    assert.equal((await fremd.listBirthdays()).length, 0); // eigenes Paar, sieht nichts vom anderen
  });

  test('Notizen: anlegen, "zuletzt von", sortiert, geprüft', async () => {
    const janId = (await jan.getSession())!.userId;
    const vId = (await vanessa.getSession())!.userId;
    const a = await jan.addNote({ title: '  ', body: 'WLAN: sonne123\n', color: 'n2' });
    assert.equal(a.title, null);
    assert.equal(a.body, 'WLAN: sonne123');
    assert.equal(a.updatedBy, janId);
    const b = await vanessa.addNote({ title: 'Geschenke', body: 'Kochbuch', color: 'n4' });
    await vanessa.updateNote(a.id, { title: 'WLAN', body: 'WLAN: mond456', color: 'n2' });
    const list = await jan.listNotes();
    assert.deepEqual(list.map((n) => n.id), [a.id, b.id]); // zuletzt geändert zuerst
    assert.equal(list[0].updatedBy, vId);
    await assert.rejects(() => jan.addNote({ title: null, body: '   ', color: 'n1' }), /leer/);
    await assert.rejects(() => jan.addNote({ title: null, body: 'x', color: 'n9' as never }), /Farbe/);
    await assert.rejects(() => jan.addNote({ title: null, body: 'x'.repeat(5001), color: 'n1' }), /5000/);
    assert.equal((await fremd.listNotes()).length, 0);
    await fremd.deleteNote(a.id);
    assert.equal((await jan.listNotes()).length, 2);
  });

  test('Reisen: Wunschziel, geplant, Packliste, Prüfungen, Fremde sehen nichts', async () => {
    const wish = await jan.addTrip({ title: ' Lofoten ', startDate: '2027-01-01', endDate: null, note: '' });
    assert.equal(wish.title, 'Lofoten');
    await jan.updateTrip(wish.id, { title: 'Lofoten', startDate: null, endDate: '2027-01-05', note: null });
    assert.equal((await vanessa.listTrips())[0].endDate, null); // ohne Start kein Ende
    const trip = await vanessa.addTrip({ title: 'Toskana', startDate: '2027-06-01', endDate: '2027-06-14', note: 'Ferienhaus' });
    await assert.rejects(() => jan.addTrip({ title: 'X', startDate: '2027-06-10', endDate: '2027-06-01', note: null }), /Rückreise/);
    await assert.rejects(() => jan.addTrip({ title: 'X', startDate: '2027-01-01', endDate: '2028-06-01', note: null }), /ein Jahr/);
    await assert.rejects(() => jan.addTrip({ title: ' ', startDate: null, endDate: null, note: null }), /Wohin/);
    const it = await jan.addTripItem(trip.id, ' Sonnencreme ');
    await vanessa.setTripItemDone(it.id, true);
    assert.deepEqual((await jan.listTripItems(trip.id)).map((x) => [x.text, x.done]), [['Sonnencreme', true]]);
    await assert.rejects(() => jan.addTripItem(trip.id, '  '), /Was soll mit/);
    assert.equal((await fremd.listTrips()).length, 0);
    assert.equal((await fremd.listTripItems()).length, 0);
    await assert.rejects(() => fremd.addTripItem(trip.id, 'Einbruch'), /trip_mismatch/);
    await fremd.deleteTrip(trip.id);
    await fremd.setTripItemDone(it.id, false);
    assert.equal((await jan.listTripItems()).length, 1);
    assert.equal((await jan.listTripItems())[0].done, true);
    await jan.deleteTrip(trip.id);
    assert.equal((await jan.listTripItems()).length, 0); // Packliste geht mit
  });

  test('Fotos: hochladen, Bildunterschrift, Links nur fürs eigene Paar, löschen', async () => {
    const img = 'A'.repeat(400);
    const p1 = await jan.addPhoto({ base64: img, width: 1600, height: 1200, caption: ' Strand ' });
    assert.equal(p1.caption, 'Strand');
    assert.match(p1.path, /^[0-9a-f-]+\/[0-9a-f-]+\.jpg$/);
    const p2 = await vanessa.addPhoto({ base64: img, width: 900, height: 1600 });
    assert.deepEqual((await jan.listPhotos()).map((x) => x.id), [p2.id, p1.id]); // neueste zuerst
    await vanessa.updatePhotoCaption(p1.id, 'Am Strand');
    assert.equal((await jan.listPhotos())[1].caption, 'Am Strand');
    const urls = await jan.photoUrls(await jan.listPhotos());
    assert.match(urls[p1.id], /^data:image\/jpeg;base64,/);
    await assert.rejects(() => jan.addPhoto({ base64: img, width: 0, height: 10 }), /nicht gelesen/);
    await assert.rejects(() => jan.updatePhotoCaption(p1.id, 'x'.repeat(201)), /200 Zeichen/);
    assert.equal((await fremd.listPhotos()).length, 0);
    assert.deepEqual(await fremd.photoUrls([p1]), {});
    await fremd.deletePhoto(p1.id);
    assert.equal((await jan.listPhotos()).length, 2);
    await jan.deletePhoto(p2.id);
    assert.deepEqual((await vanessa.listPhotos()).map((x) => x.id), [p1.id]);
  });

  test('Filme & Serien: Watchlist, gesehen, Bewertung nur wenn gesehen, Fremde sehen nichts', async () => {
    const m = await jan.addMedia({ title: ' Dune ', kind: 'film', platform: ' Kino ', note: '', rating: 4 });
    assert.deepEqual([m.title, m.platform, m.note, m.rating, m.done], ['Dune', 'Kino', null, null, false]);
    await vanessa.updateMedia(m.id, { title: 'Dune', kind: 'film', platform: 'Kino', note: null, rating: 5 });
    assert.equal((await jan.listMedia())[0].rating, null); // noch nicht gesehen
    await vanessa.setMediaDone(m.id, true);
    await jan.updateMedia(m.id, { title: 'Dune', kind: 'film', platform: 'Kino', note: null, rating: 5 });
    const seen = (await vanessa.listMedia())[0];
    assert.equal(seen.done, true);
    assert.ok(seen.doneAt);
    assert.equal(seen.rating, 5);
    await jan.setMediaDone(m.id, false);
    assert.equal((await jan.listMedia())[0].rating, null);
    await assert.rejects(() => jan.addMedia({ title: 'X', kind: 'buch' as 'film', platform: null, note: null, rating: null }), /Film oder Serie/);
    await assert.rejects(() => jan.updateMedia(m.id, { title: 'X', kind: 'film', platform: null, note: null, rating: 6 }), /1 bis 5/);
    assert.equal((await fremd.listMedia()).length, 0);
    await fremd.deleteMedia(m.id);
    assert.equal((await jan.listMedia()).length, 1);
  });

  test('Geschenke: Ideen für den Partner bleiben geheim, Wünsche sehen beide', async () => {
    const janId = (await jan.getSession())!.userId;
    const vId = (await vanessa.getSession())!.userId;
    const secret = await jan.addGift({ kind: 'idea', title: 'Konzertkarten', forUser: vId, forName: 'ignoriert', occasion: 'Geburtstag', link: null, note: null });
    assert.equal(secret.forName, null);
    await jan.addGift({ kind: 'idea', title: 'Schal', forUser: null, forName: ' Mama ', occasion: null, link: null, note: null });
    const wish = await vanessa.addGift({ kind: 'wish', title: 'Kochbuch', forUser: janId, forName: null, occasion: 'x', link: 'https://example.org', note: null });
    assert.deepEqual([wish.forUser, wish.occasion], [null, null]);
    const got = await jan.addGift({ kind: 'idea', title: 'Kochbuch', forUser: vId, forName: null, occasion: null, link: null, note: null, wishId: wish.id });
    assert.equal(got.wishId, wish.id);
    assert.deepEqual((await vanessa.listGifts()).map((g) => g.title).sort(), ['Kochbuch', 'Schal']); // nichts Geheimes
    assert.equal((await jan.listGifts()).length, 4);
    await vanessa.updateGift(secret.id, { kind: 'idea', title: 'gespickt', forUser: vId, forName: null, occasion: null, link: null, note: null });
    await vanessa.deleteGift(secret.id);
    assert.equal((await jan.listGifts()).find((g) => g.id === secret.id)?.title, 'Konzertkarten');
    await jan.setGiftDone(secret.id, true);
    assert.equal((await jan.listGifts()).find((g) => g.id === secret.id)?.done, true);
    await assert.rejects(() => jan.addGift({ kind: 'idea', title: 'X', forUser: janId, forName: null, occasion: null, link: null, note: null }), /gift_for_invalid/);
    await assert.rejects(() => jan.addGift({ kind: 'idea', title: 'X', forUser: null, forName: ' ', occasion: null, link: null, note: null }), /Für wen/);
    await vanessa.deleteGift(wish.id);
    assert.equal((await jan.listGifts()).find((g) => g.id === got.id)?.wishId, null);
    assert.equal((await fremd.listGifts()).length, 0);
  });

  test('Rezepte: anlegen, Favorit, geprüft, Fremde sehen nichts', async () => {
    const r = await jan.addRecipe({ title: '  Lasagne ', servings: 4, minutes: 60, ingredients: '500 g Hackfleisch\n\n', steps: '\n1. Ofen an\n', source: '' });
    assert.equal(r.title, 'Lasagne');
    assert.equal(r.ingredients, '500 g Hackfleisch');
    assert.equal(r.steps, '1. Ofen an');
    assert.equal(r.source, null);
    await vanessa.addRecipe({ title: 'Apfelkuchen', servings: 12, minutes: null, ingredients: '', steps: '', source: null });
    await vanessa.setRecipeFavorite(r.id, true);
    const list = await jan.listRecipes();
    assert.deepEqual(list.map((x) => x.title), ['Apfelkuchen', 'Lasagne']);
    assert.equal(list[1].favorite, true);
    await assert.rejects(() => jan.addRecipe({ title: ' ', servings: 2, minutes: null, ingredients: '', steps: '', source: null }), /heißt/);
    await assert.rejects(() => jan.addRecipe({ title: 'X', servings: 0, minutes: null, ingredients: '', steps: '', source: null }), /Portionen/);
    await assert.rejects(() => jan.addRecipe({ title: 'X', servings: 2, minutes: 2000, ingredients: '', steps: '', source: null }), /Minuten/);
    assert.equal((await fremd.listRecipes()).length, 0);
    await fremd.deleteRecipe(r.id);
    await fremd.updateRecipe(r.id, { title: 'gehackt', servings: 2, minutes: null, ingredients: '', steps: '', source: null });
    assert.equal((await jan.listRecipes()).find((x) => x.id === r.id)?.title, 'Lasagne');
  });

  test('Konto löschen: Partner behält Einträge ohne Verweis', async () => {
    const janId = (await jan.getSession())!.userId;
    await jan.deleteAccount();
    assert.equal(await jan.getSession(), null);
    const evs = await vanessa.listEvents();
    assert.equal(evs[0].who, null);
    assert.equal(evs[0].createdBy, null);
    const c = await vanessa.getMyCouple();
    assert.deepEqual(c?.members.map((m) => m.displayName), ['Vanessa']);
    assert.ok(!db.users.has(janId));
    assert.ok(!db.profiles.has(janId));
  });

  test('Letzte Person geht: alles ist gelöscht', async () => {
    await vanessa.deleteAccount();
    assert.equal([...db.events.values()].length, 0);
    assert.equal([...db.shopping.values()].length, 0);
    assert.equal([...db.birthdays.values()].length, 0);
    assert.equal([...db.notes.values()].length, 0);
    assert.equal(db.couples.size, 1); // nur noch das Paar von "fremd"
  });

  test('Abgelaufener Einladungscode', async () => {
    const code = await fremd.createInvite();
    const later = new MemoryStore(db);
    await login(later, 'spaeter@example.org');
    const realNow = db.now;
    db.now = () => realNow() + 49 * 3600e3;
    await assert.rejects(() => later.joinCouple(code), /invalid_code/);
    db.now = realNow;
  });
});

describe('Helfer', () => {
  test('Zusammen seit', () => {
    const now = new Date(2026, 10, 18);
    const r = together('2023-05-20', now)!;
    assert.equal(r.text, '3 Jahre, 5 Monate und 29 Tage');
    assert.equal(r.anniv, '4. Jahrestag in 183 Tagen');
    assert.equal(together('2025-11-18', now)!.anniv, 'Heute ist euer 1. Jahrestag!');
    assert.equal(together('2027-01-01', now), null);
  });

  test('Tagesvers: gleich für den ganzen Tag, gültig', () => {
    assert.equal(VERSES.length, 107);
    const a = dayVerse(new Date('2026-11-18T00:30:00+01:00'));
    const b = dayVerse(new Date('2026-11-18T23:30:00+01:00'));
    assert.deepEqual(a, b);
    assert.ok(a[0].length > 5 && a[1].length > 3);
  });

  test('Kalender-Raster beginnt Montag', () => {
    const g = monthGrid(2026, 10); // November 2026 beginnt an einem Sonntag
    assert.equal(g.slice(0, 6).every((x) => x === null), true);
    assert.equal(g[6]!.getDate(), 1);
    assert.equal(g.length % 7, 0);
  });

  test('Geburtstage: nächster Termin, Alter, 29. Februar', () => {
    const now = new Date(2026, 10, 18);
    const oma = { id: '1', name: 'Oma', month: 3, day: 14, year: 1941, note: null, createdBy: null };
    const heute = { id: '2', name: 'Ändi', month: 11, day: 18, year: 1990, note: null, createdBy: null };
    const leap = { id: '3', name: 'Lea', month: 2, day: 29, year: 2000, note: null, createdBy: null };
    assert.deepEqual(nextBirthday(heute, now), { date: new Date(2026, 10, 18), days: 0, age: 36 });
    const o = nextBirthday(oma, now);
    assert.equal(o.date.getFullYear(), 2027);
    assert.equal(o.age, 86);
    assert.equal(birthdayIn(leap, 2027).getDate(), 28);
    assert.equal(birthdayIn(leap, 2028).getDate(), 29);
    assert.deepEqual(upcomingBirthdays([oma, leap, heute], now).map((b) => b.name), ['Ändi', 'Lea', 'Oma']);
    assert.equal(nextBirthday({ ...oma, year: null }, now).age, null);
    assert.ok(searchKey('Ändi').includes('andi'));
  });

  test('Datum deutsch ↔ ISO', () => {
    assert.equal(fromGerman('1.5.2023'), '2023-05-01');
    assert.equal(fromGerman('2023-05-01'), null);
    assert.equal(toGerman('2023-05-01'), '01.05.2023');
  });

  test('Uhrzeit-Eingaben', () => {
    assert.equal(normalizeTime('9'), '09:00');
    assert.equal(normalizeTime('9:5'), '09:05');
    assert.equal(normalizeTime('1930'), '19:30');
    assert.equal(normalizeTime(' '), null);
    assert.throws(() => normalizeTime('abends'));
    assert.equal(checkEvent({ title: 'a', date: '2028-02-29', time: null, note: null, who: null }).date, '2028-02-29');
  });

  test('Einladungscode normalisieren', () => {
    assert.equal(normalizeInviteCode(' k7mb-q2xd '), 'K7MBQ2XD');
    assert.throws(() => normalizeInviteCode('K7MB-Q2X0'));
  });

  test('Menge erkennen', () => {
    assert.deepEqual(splitQty('2 l Milch'), { qty: '2 l', text: 'Milch' });
    assert.deepEqual(splitQty('Eier 10'), { text: 'Eier', qty: '10' });
    assert.deepEqual(splitQty('3 Dosen Tomaten'), { qty: '3 Dosen', text: 'Tomaten' });
    assert.deepEqual(splitQty('Brot'), { text: 'Brot', qty: null });
  });

  test('Einkaufs-Emoji', () => {
    assert.equal(shopEmoji('Milch'), '🥛');
    assert.equal(shopEmoji('Eier'), '🥚');
    assert.equal(shopEmoji('Katzenfutter'), '🐱');
    assert.equal(shopEmoji('Xyzzy'), '🛒');
  });

  test('Fehlermeldungen sind deutsch', () => {
    assert.match(friendlyError(new Error('invalid_code')), /Einladungscode/);
    assert.match(friendlyError(new Error('irgendwas')), /schiefgegangen.*irgendwas/);
    assert.match(friendlyError(new Error('Invalid API key')), /Schlüssel/);
    assert.match(friendlyError(new Error('email rate limit exceeded')), /Zu viele/);
  });

  test('Rezept: Zutaten lesen und umrechnen', () => {
    const mehl = parseIngredient('200 g Mehl');
    assert.deepEqual([mehl.amount, mehl.unit, mehl.name], [200, 'g', 'Mehl']);
    assert.equal(scaleLine(mehl, 1.5), '300 g Mehl');
    assert.equal(scaleLine(parseIngredient('600 g Mehl'), 2), '1,2 kg Mehl');
    assert.equal(scaleLine(parseIngredient('1/2 TL Salz'), 2), '1 TL Salz');
    assert.equal(scaleLine(parseIngredient('1½ l Milch'), 0.5), '¾ l Milch');
    assert.equal(scaleLine(parseIngredient('1 1/2 Tassen Reis'), 1), '1 1/2 Tassen Reis');
    assert.equal(scaleLine(parseIngredient('2-3 Zwiebeln'), 2), '4-6 Zwiebeln');
    assert.equal(scaleLine(parseIngredient('3 Eier'), 0.5), '1½ Eier');
    assert.equal(scaleLine(parseIngredient('Salz und Pfeffer'), 3), 'Salz und Pfeffer');
    assert.equal(scaleLine(parseIngredient('1,5 EL Öl'), 2), '3 EL Öl');
    assert.equal(parseIngredient('Gläser spülen').amount, null);
    assert.equal(parseIngredient('Für die Soße:').heading, true);
    assert.equal(parseIngredients('a\n\n b \n').length, 2);
    assert.equal(amountText(parseIngredient('Prise Salz')), null);
    assert.deepEqual(toShopping(parseIngredient('400 g Spaghetti'), 0.5), { text: 'Spaghetti', qty: '200 g' });
    assert.deepEqual(toShopping(parseIngredient('Basilikum')), { text: 'Basilikum', qty: null });
    assert.equal(formatAmount(0.333), '⅓');
    assert.equal(formatAmount(2.4), '2,4');
    assert.equal(formatAmount(12.6), '13');
    assert.deepEqual(parseSteps('1. Wasser kochen\n\n2) Nudeln rein\n- Abgießen'), ['Wasser kochen', 'Nudeln rein', 'Abgießen']);
    assert.equal(formatMinutes(75), '1 Std. 15 Min.');
    assert.equal(formatMinutes(45), '45 Min.');
  });

  test('Reisen: Status, Zeitraum, Countdown', () => {
    const tr = (startDate: string | null, endDate: string | null = null, title = 'X'): Trip => ({ id: title, title, startDate, endDate, note: null, createdBy: null });
    const now = new Date(2027, 5, 3, 15, 0); // 3. Juni 2027
    assert.equal(tripStatus(tr(null), now), 'wish');
    assert.equal(tripStatus(tr('2027-06-10'), now), 'upcoming');
    assert.equal(tripStatus(tr('2027-06-01', '2027-06-14'), now), 'now');
    assert.equal(tripStatus(tr('2027-06-03'), now), 'now');
    assert.equal(tripStatus(tr('2027-05-01', '2027-06-02'), now), 'past');
    assert.equal(tripCountdown(tr('2027-06-26'), now), 'in 23 Tagen');
    assert.equal(tripCountdown(tr('2027-06-04'), now), 'morgen geht’s los');
    assert.equal(tripCountdown(tr('2027-06-01', '2027-06-14'), now), 'Tag 3 von 14');
    assert.equal(tripCountdown(tr('2027-06-03'), now), 'heute');
    assert.equal(tripDays(tr('2027-06-01', '2027-06-14')), 14);
    assert.equal(tripRange(tr('2027-06-01', '2027-06-14')), '1.–14. Juni 2027');
    assert.equal(tripRange(tr('2027-06-28', '2027-07-03')), '28. Juni – 3. Juli 2027');
    assert.equal(tripRange(tr('2026-12-30', '2027-01-02')), '30. Dezember 2026 – 2. Januar 2027');
    assert.equal(tripRange(tr('2027-05-05')), '5. Mai 2027');
    const g = groupTrips([tr(null, null, 'Rom'), tr('2027-08-01', null, 'B'), tr('2027-06-10', null, 'A'), tr('2027-01-01', null, 'Alt'), tr(null, null, 'Island')], now);
    assert.deepEqual(g.planned.map((x) => x.title), ['A', 'B']);
    assert.deepEqual(g.wishes.map((x) => x.title), ['Island', 'Rom']);
    assert.deepEqual(g.past.map((x) => x.title), ['Alt']);
    assert.equal(nextTrip([tr(null)], now), null);
  });

  test('Base64 → Bytes', () => {
    assert.deepEqual([...base64ToBytes('SGFsbG8=')], [...Buffer.from('Hallo')]);
    assert.deepEqual([...base64ToBytes('data:image/jpeg;base64,/9j/4A==')], [0xff, 0xd8, 0xff, 0xe0]);
    const raw = Buffer.from(Array.from({ length: 1000 }, (_, i) => (i * 37) % 256));
    assert.deepEqual(Buffer.from(base64ToBytes(raw.toString('base64'))), raw);
  });
});

describe('Anpassen (persönliche Einstellungen)', () => {
  test('normalizePrefs macht aus allem gültige Einstellungen', () => {
    assert.deepEqual(normalizePrefs(null), DEFAULT_PREFS);
    assert.deepEqual(normalizePrefs('kaputt'), DEFAULT_PREFS);
    const p = normalizePrefs({
      areas: { order: ['album', 'album', 'quatsch', 'listen'], hidden: ['rezepte', 'start'] },
      home: { order: ['shopping'], hidden: ['verse'], heroPhotoId: 'nicht-uuid' },
      look: { mode: 'dark', accent: 'neon' },
      lists: { hidden: ['einkauf', 'notizen', 'filme', 'geschenke', 'dates'] },
      kalender: { showBirthdays: 'ja' },
      rezepte: { sort: 'neu' },
      album: { cols: 7 },
      fremd: { x: 1 },
    });
    // Reihenfolge bleibt, fehlende hinten dran, Doppeltes und Unbekanntes fliegt raus
    assert.deepEqual(p.areas.order, ['album', 'listen', 'kalender', 'rezepte', 'quiz']);
    // neuer Bereich (Quiz) kommt bei bestehenden Einstellungen nicht ungefragt in die Tab-Leiste
    assert.deepEqual(p.areas.hidden, ['rezepte', 'quiz']);
    assert.deepEqual(visible(p.areas), ['album', 'listen', 'kalender']);
    assert.equal(p.home.order[0], 'shopping');
    assert.equal(p.home.order.length, 7);
    // Zyklus-Karte ist privat: auch bei bestehenden Einstellungen erst einmal aus
    assert.ok(p.home.hidden.includes('cycle'));
    assert.deepEqual(p.kalender, { showBirthdays: true, showCycle: true, cycleInMonth: true });
    assert.equal(p.home.heroPhotoId, null);
    assert.deepEqual(p.look, { mode: 'dark', accent: 'blau' });
    // Listen: mindestens ein Reiter bleibt sichtbar
    assert.deepEqual(p.lists.hidden, []);
    // Dates kamen später dazu und erscheinen bei bestehenden Einstellungen hinten
    assert.deepEqual(visible(normalizePrefs({ lists: { order: ['filme', 'einkauf', 'notizen', 'geschenke'], hidden: ['notizen'] } }).lists), ['filme', 'einkauf', 'geschenke', 'dates']);
    assert.equal(p.kalender.showBirthdays, true);
    assert.equal(p.rezepte.sort, 'neu');
    assert.equal(p.album.cols, 3);
    assert.ok(!('fremd' in p));
    // Standard und Obergrenze: höchstens 4 Bereiche neben Start
    assert.deepEqual(visible(normalizePrefs({}).areas), ['kalender', 'listen', 'rezepte', 'album']);
    assert.deepEqual(visible(normalizePrefs({ areas: { order: ['quiz', 'kalender', 'listen', 'rezepte', 'album'], hidden: [] } }).areas), ['quiz', 'kalender', 'listen', 'rezepte']);
    const full = normalizePrefs({}).areas;
    assert.equal(toggleHidden(full, 'quiz', 0, 4), full);
    assert.deepEqual(visible(toggleHidden(toggleHidden(full, 'album', 0, 4), 'quiz', 0, 4)), ['kalender', 'listen', 'rezepte', 'quiz']);
    const id = '0f8c2f0a-1b2c-4d3e-8f90-123456789abc';
    assert.equal(normalizePrefs({ home: { heroPhotoId: id } }).home.heroPhotoId, id);
  });

  test('Verschieben und Ausblenden', () => {
    const o = DEFAULT_PREFS.lists;
    assert.deepEqual(move(o, 'filme', -1).order, ['einkauf', 'filme', 'notizen', 'geschenke', 'dates']);
    assert.equal(move(o, 'einkauf', -1), o);
    assert.equal(move(o, 'dates', 1), o);
    let h = toggleHidden(o, 'einkauf', 1);
    h = toggleHidden(h, 'notizen', 1);
    h = toggleHidden(h, 'filme', 1);
    h = toggleHidden(h, 'dates', 1);
    assert.deepEqual(visible(h), ['geschenke']);
    // der letzte sichtbare bleibt
    assert.equal(toggleHidden(h, 'geschenke', 1), h);
    assert.deepEqual(visible(toggleHidden(h, 'filme', 1)), ['filme', 'geschenke']);
  });

  test('Mock-DB: jede Person hat eigene Einstellungen, Größe begrenzt, Konto löschen räumt auf', async () => {
    const db = new MemoryBackend();
    const a = new MemoryStore(db);
    const b = new MemoryStore(db);
    await login(a, 'a@example.org');
    await login(b, 'b@example.org');
    assert.equal(await a.getMyPrefs(), null);
    await a.saveMyPrefs({ ...DEFAULT_PREFS, look: { mode: 'dark', accent: 'lila' } });
    assert.equal(await b.getMyPrefs(), null);
    const got = normalizePrefs(await a.getMyPrefs());
    assert.equal(got.look.accent, 'lila');
    await assert.rejects(() => a.saveMyPrefs({ x: 'a'.repeat(9000) }), /prefs_invalid/);
    await assert.rejects(() => a.saveMyPrefs([] as unknown as object), /prefs_invalid/);
    await a.deleteAccount();
    assert.equal(db.prefs.size, 0);
  });
});

describe('Paar-Quiz', () => {
  test('Fragenliste ist gültig (eindeutige ids im erlaubten Format)', () => {
    assert.equal(QUIZ_QUESTIONS.length, 1000);
    assert.equal(new Set(QUIZ_QUESTIONS.map((q) => q.id)).size, QUIZ_QUESTIONS.length);
    // kein Text doppelt (auch nicht mit anderer Groß-/Kleinschreibung)
    assert.equal(new Set(QUIZ_QUESTIONS.map((q) => q.text.toLowerCase().replace(/\s+/g, ' '))).size, QUIZ_QUESTIONS.length);
    for (const q of QUIZ_QUESTIONS) {
      assert.match(q.id, /^[a-z0-9-]{1,40}$/);
      assert.ok(q.text.length >= 10 && q.text.length <= 160, q.text);
      assert.match(q.text, /\?$/, q.text);
      assert.ok(q.topic && QUIZ_TOPICS[q.topic], q.text);
      // nur bekannte Platzhalter
      assert.equal(q.text.replace(/\{partner\}|\{ich\}/g, '').includes('{'), false, q.text);
    }
    // jedes Thema hat 125 Fragen
    for (const k of Object.keys(QUIZ_TOPICS)) assert.equal(QUIZ_QUESTIONS.filter((q) => q.topic === k).length, 125, k);
  });

  test('Runden: 20 Fragen, auf beiden Handys gleich, keine Wiederholung bis alle 1000 dran waren', () => {
    const a = questionOrder('paar-1', 1).map((q) => q.id);
    assert.equal(a.length, 20);
    assert.deepEqual(questionOrder('paar-1', 1).map((q) => q.id), a);
    assert.notDeepEqual(questionOrder('paar-2', 1).map((q) => q.id), a);
    const seen = new Set<string>();
    for (let r = 1; r <= 50; r++) for (const q of questionOrder('paar-1', r)) seen.add(q.id);
    assert.equal(seen.size, 1000);
    // Runde 51 beginnt einen neuen Durchgang, wieder ohne Doppelte in der Runde
    const r51 = questionOrder('paar-1', 51).map((q) => q.id);
    assert.equal(new Set(r51).size, 20);
    // wenige Fragen: Runde hat alle
    const few = QUIZ_QUESTIONS.slice(0, 7);
    assert.equal(questionOrder('x', 3, few).length, 7);
    // die Themen sind gemischt
    assert.ok(new Set(questionOrder('paar-1', 1).map((q) => q.topic)).size >= 4);
  });

  test('Abwechselnd dran, nächste offene Frage, Runde geschafft', async () => {
    const db = new MemoryBackend();
    const jan = new MemoryStore(db);
    const van = new MemoryStore(db);
    const fremd = new MemoryStore(db);
    await login(jan, 'q1@example.org');
    await login(van, 'q2@example.org');
    await login(fremd, 'q3@example.org');
    for (const [s, n] of [[jan, 'Jan'], [van, 'Vanessa'], [fremd, 'X']] as const) await s.saveMyProfile({ displayName: n, color: 'blue' });
    await jan.createCouple();
    await van.joinCouple(await jan.createInvite());
    await fremd.createCouple();
    const ids = (await jan.getMyCouple())!.members.map((m) => m.id).sort();
    const seed = (await jan.getMyCouple())!.id;

    let st = quizState(await jan.listQuizAnswers(), ids, seed);
    assert.equal(st.player, ids[0]);
    assert.equal(st.done, 0);
    const realNow = db.now;
    let t = 0;
    db.now = () => 1_800_000_000_000 + t++ * 1000;
    const first = st.question!;
    await jan.addQuizAnswer({ round: st.round, questionId: first.id, player: st.player, answer: '  Lasagne ' });
    st = quizState(await van.listQuizAnswers(), ids, seed);
    assert.equal(st.player, ids[1]);
    assert.notEqual(st.question!.id, first.id);
    assert.equal(st.answers[0].answer, 'Lasagne');
    // dieselbe Frage nicht zweimal, Fremde dürfen nicht mitspielen
    await assert.rejects(() => van.addQuizAnswer({ round: 1, questionId: first.id, player: ids[1], answer: 'Pizza' }), /quiz_once/);
    const fremdId = (await fremd.getMyProfile())!.id;
    const open = st.question!.id;
    await assert.rejects(() => jan.addQuizAnswer({ round: 1, questionId: open, player: fremdId, answer: 'x' }), /quiz_player_invalid/);
    assert.equal((await fremd.listQuizAnswers()).length, 0);
    // überspringen zählt auch
    await van.addQuizAnswer({ round: 1, questionId: st.question!.id, player: st.player, answer: '' });
    st = quizState(await jan.listQuizAnswers(), ids, seed);
    assert.equal(st.answers[0].answer, null);
    assert.equal(st.player, ids[0]);
    while (st.question) {
      await jan.addQuizAnswer({ round: st.round, questionId: st.question.id, player: st.player, answer: 'ok' });
      st = quizState(await jan.listQuizAnswers(), ids, seed);
    }
    assert.equal(st.done, 20);
    assert.equal(st.total, 20);
    // neue Runde
    const r2 = quizState(await jan.listQuizAnswers(), ids, seed, 2);
    assert.equal(r2.round, 2);
    assert.equal(r2.done, 0);
    assert.ok(r2.question);
    db.now = realNow;
  });

  test('Namen in der Frage', () => {
    assert.equal(questionText({ id: 'x', text: 'Was mag {partner}? Sagt {ich}.' }, 'Jan', 'Vanessa'), 'Was mag Vanessa? Sagt Jan.');
  });
});

describe('Meilensteine', () => {
  const ms = (id: string, title: string, date: string, icon: 'wedding' | 'ring' | 'heart' = 'heart') =>
    ({ id, title, icon, date, note: null, photoId: null, createdBy: null, createdAt: '2026-01-01T00:00:00Z' });

  test('Besondere Tage: Jahrestag, runde Zahl, Meilenstein-Jahrestage, Zukunft', () => {
    const now = new Date(2026, 10, 19);
    const list = specialDays('2023-12-01', [ms('h', 'Hochzeit', '2025-11-29', 'wedding'), ms('v', 'Verlobung', '2027-02-14', 'ring'), ms('alt', 'Erstes Date', '2023-11-19')], now);
    assert.equal(list[0].title, 'Erstes Date · 3. Jahrestag');
    assert.equal(list[0].days, 0);
    assert.equal(specialText(list[0]), 'Heute: Erstes Date · 3. Jahrestag!');
    // 1.084 Tage zusammen → nächste runde Zahl 1.500 erst nach dem Jahrestag
    const titles = list.map((d) => d.title);
    assert.ok(titles.includes('3. Jahrestag'));
    assert.ok(titles.includes('1. Hochzeitstag'));
    assert.ok(titles.includes('Verlobung'));
    assert.equal(list.find((d) => d.title === '1. Hochzeitstag')!.days, 10);
    assert.equal(list.find((d) => d.title === '3. Jahrestag')!.days, 12);
    assert.deepEqual(list.map((d) => d.days), [...list.map((d) => d.days)].sort((a, b) => a - b));
  });

  test('Runde Zahlen und Sonderfälle', () => {
    const now = new Date(2026, 10, 19);
    const d = specialDays('2024-02-29', [], now);
    // 994 Tage → 1.000 Tage in 6 Tagen
    assert.equal(d[0].title, '1.000 Tage zusammen');
    assert.equal(d[0].days, 6);
    assert.equal(specialText(d[0]), '1.000 Tage zusammen in 6 Tagen');
    assert.equal(specialDays(null, [], now).length, 0);
    assert.equal(specialDays('2030-01-01', [], now).length, 0);
    // 29. Februar feiert man in Nicht-Schaltjahren am 28.
    const leap = specialDays(null, [ms('x', 'Kennengelernt', '2024-02-29')], new Date(2027, 1, 1));
    assert.equal(leap[0].date.getDate(), 28);
    assert.equal(dots(12500), '12.500');
  });

  test('Zeitleiste sortiert, Mock-DB prüft Eingaben und Album-Foto', async () => {
    assert.deepEqual(sortTimeline([ms('b', 'B', '2025-01-01'), ms('a', 'A', '2020-05-05')]).map((m) => m.id), ['a', 'b']);
    const db = new MemoryBackend();
    const a = new MemoryStore(db);
    await login(a, 'm1@example.org');
    await a.saveMyProfile({ displayName: 'A', color: 'blue' });
    await a.createCouple();
    await assert.rejects(() => a.addMilestone({ title: ' ', icon: 'heart', date: '2024-01-01', note: null, photoId: null }), /Wie heißt/);
    await assert.rejects(() => a.addMilestone({ title: 'X', icon: 'heart', date: '2024-02-30', note: null, photoId: null }), /gültiges Datum/);
    await assert.rejects(() => a.addMilestone({ title: 'X', icon: 'heart', date: '2099-01-01', note: null, photoId: null }), /zu weit/);
    await assert.rejects(() => a.addMilestone({ title: 'X', icon: 'heart', date: '2024-01-01', note: null, photoId: '0f8c2f0a-1b2c-4d3e-8f90-123456789abc' }), /milestone_photo_invalid/);
    const m = await a.addMilestone({ title: '  Hochzeit ', icon: 'wedding', date: '2025-06-07', note: ' Am See ', photoId: null });
    assert.equal(m.title, 'Hochzeit');
    assert.equal(m.note, 'Am See');
    await a.updateMilestone(m.id, { ...m, title: 'Unsere Hochzeit' });
    assert.equal((await a.listMilestones())[0].title, 'Unsere Hochzeit');
    await a.deleteMilestone(m.id);
    assert.equal((await a.listMilestones()).length, 0);
  });
});

describe('Zyklus', () => {
  const per = (start: string, end: string | null, userId = 'u') => ({ id: start, userId, start, end, createdAt: start });

  test('Vorhersage aus eigenen Einträgen', () => {
    const now = new Date(2026, 10, 19);
    const none = cycleInfo([], now);
    assert.equal(cycleHeadline(none), 'Noch nichts eingetragen');
    // eine Periode: Standardwerte (28/5)
    const one = cycleInfo([per('2026-11-10', '2026-11-14')], now);
    assert.equal(one.learned, false);
    assert.equal(one.cycleLength, 28);
    assert.equal(one.daysUntil, 19);
    assert.equal(cycleHeadline(one), 'Periode in etwa 19 Tagen');
    assert.equal(one.ovulation!.getDate(), 24);
    // drei Perioden mit 30 Tagen Abstand, 4 Tage lang
    const l = [per('2026-08-21', '2026-08-24'), per('2026-09-20', '2026-09-23'), per('2026-10-20', '2026-10-23')];
    const i = cycleInfo(l, now);
    assert.equal(i.learned, true);
    assert.equal(i.cycleLength, 30);
    assert.equal(i.periodLength, 4);
    assert.equal(i.daysUntil, 0);
    assert.equal(cycleHeadline(i), 'Periode heute erwartet');
    assert.equal(cycleHeadline(cycleInfo(l, new Date(2026, 10, 22))), 'Periode seit 3 Tagen erwartet');
    // läuft gerade
    const run = cycleInfo([...l, per('2026-11-18', null)], now);
    assert.equal(run.ongoingDay, 2);
    assert.equal(cycleHeadline(run), 'Periode, Tag 2');
    // unplausible Abstände (z. B. vergessener Monat) zählen nicht
    assert.equal(cycleInfo([per('2026-05-01', null), per('2026-08-01', null), per('2026-08-29', null)], now).cycleLength, 28);
  });

  test('Markierungen im Monat', () => {
    const now = new Date(2026, 10, 19);
    const m = cycleMarks([per('2026-11-10', '2026-11-14')], now);
    assert.equal(m.get('2026-11-10'), 'period');
    assert.equal(m.get('2026-11-14'), 'period');
    assert.equal(m.get('2026-11-15'), undefined);
    assert.equal(m.get('2026-12-08'), 'predicted');
    assert.equal(m.get('2026-11-24'), 'ovulation');
    assert.equal(m.get('2026-11-20'), 'fertile');
    assert.equal(cycleMarks([], now).size, 0);
  });

  test('Eingaben prüfen: kein Datum in der Zukunft, Dauer, keine Überschneidung', () => {
    const now = new Date(2026, 10, 19);
    assert.throws(() => checkPeriod({ start: '2026-11-25', end: null }, [], now), /Zukunft/);
    assert.throws(() => checkPeriod({ start: '2026-11-10', end: '2026-11-09' }, [], now), /vor dem Beginn/);
    assert.throws(() => checkPeriod({ start: '2026-10-01', end: '2026-10-25' }, [], now), /21 Tage/);
    assert.throws(() => checkPeriod({ start: '2026-11-12', end: null }, [{ start: '2026-11-10', end: '2026-11-14' }], now), /schon eine Periode/);
    assert.deepEqual(checkPeriod({ start: '2026-11-15', end: null }, [{ start: '2026-11-10', end: '2026-11-14' }], now), { start: '2026-11-15', end: null });
  });

  test('Mock-DB: privat, bis die Person selbst teilt; Partner kann nichts ändern', async () => {
    const db = new MemoryBackend();
    const a = new MemoryStore(db);
    const b = new MemoryStore(db);
    const c = new MemoryStore(db);
    await login(a, 'z1@example.org');
    await login(b, 'z2@example.org');
    await login(c, 'z3@example.org');
    for (const [s, n] of [[a, 'A'], [b, 'B'], [c, 'C']] as const) await s.saveMyProfile({ displayName: n, color: 'blue' });
    await a.createCouple();
    await b.joinCouple(await a.createInvite());
    await c.createCouple();
    const p = await b.addCyclePeriod({ start: '2026-10-20', end: '2026-10-24' });
    assert.equal((await a.listCyclePeriods()).length, 0);
    assert.equal(await b.getCycleSharing(), false);
    await b.setCycleSharing(true);
    assert.equal((await a.listCyclePeriods()).length, 1);
    assert.equal((await c.listCyclePeriods()).length, 0);
    await a.updateCyclePeriod(p.id, { start: '2026-10-21', end: null });
    await a.deleteCyclePeriod(p.id);
    assert.equal((await b.listCyclePeriods())[0].start, '2026-10-20');
    await b.setCycleSharing(false);
    assert.equal((await a.listCyclePeriods()).length, 0);
    await b.deleteAccount();
    assert.equal(db.periods.size, 0);
  });
});

describe('Date-Liste', () => {
  const idea = (id: string, title: string, doneOn: string | null = null) =>
    ({ id, title, category: 'zuhause' as const, note: null, doneOn, photoId: null, createdBy: null, createdAt: `2026-01-0${id.length}T00:00:00Z` });

  test('Vorschläge sind gültig und eindeutig', () => {
    assert.ok(DATE_SUGGESTIONS.length >= 20);
    assert.equal(new Set(DATE_SUGGESTIONS.map((s) => s.title.toLowerCase())).size, DATE_SUGGESTIONS.length);
    for (const s of DATE_SUGGESTIONS) {
      assert.ok(s.title.length <= 80, s.title);
      assert.ok(DATE_CATEGORY[s.category], s.title);
      assert.deepEqual(checkDateIdea({ title: s.title, category: s.category, note: null, doneOn: null, photoId: null }).title, s.title);
    }
    const left = openSuggestions([idea('a', ' picknick  im PARK ')]);
    assert.equal(left.length, DATE_SUGGESTIONS.length - 1);
    assert.ok(!left.some((s) => s.title === 'Picknick im Park'));
  });

  test('Zufälliges Date: offene Ideen zuerst, nicht zweimal dasselbe, sonst Vorschlag', () => {
    const list = [idea('a', 'Kino'), idea('bb', 'Eis'), idea('ccc', 'Wandern', '2026-05-01')];
    const first = randomDate(list, null, () => 0);
    assert.equal(first?.kind, 'idea');
    assert.equal(pickKey(first), 'a');
    // der vorige Treffer kommt nicht direkt wieder
    for (const r of [0, 0.5, 0.99]) assert.equal(pickKey(randomDate(list, 'a', () => r)), 'bb');
    // nur eine offene Idee: die darf wieder kommen
    assert.equal(pickKey(randomDate([idea('a', 'Kino')], 'a', () => 0.3)), 'a');
    // alles erledigt → Vorschlag, der nicht auf der Liste steht
    const s = randomDate([idea('a', 'Picknick im Park', '2026-01-01')], null, () => 0);
    assert.equal(s?.kind, 'suggestion');
    assert.notEqual(pickKey(s), 'Picknick im Park');
    const { open, done } = splitDates([idea('a', 'A', '2026-01-01'), idea('bb', 'B'), idea('ccc', 'C', '2026-03-01')]);
    assert.deepEqual(open.map((d) => d.id), ['bb']);
    assert.deepEqual(done.map((d) => d.id), ['ccc', 'a']);
  });

  test('Eingaben prüfen: Titel, Art, Datum nicht in der Zukunft, Foto nur wenn erledigt', () => {
    const now = new Date(2026, 10, 19);
    const base = { title: 'Kino', category: 'kultur' as const, note: null, doneOn: null, photoId: null };
    assert.throws(() => checkDateIdea({ ...base, title: '  ' }), /Was wollt ihr/);
    assert.throws(() => checkDateIdea({ ...base, title: 'x'.repeat(81) }), /80 Zeichen/);
    assert.equal(checkDateIdea({ ...base, category: 'rakete' as never }).category, 'sonstiges');
    assert.throws(() => checkDateIdea({ ...base, doneOn: '2026-02-30' }, now), /gültiges Datum/);
    assert.throws(() => checkDateIdea({ ...base, doneOn: '2026-11-25' }, now), /Zukunft/);
    assert.equal(checkDateIdea({ ...base, doneOn: '2026-11-19' }, now).doneOn, '2026-11-19');
    // Foto ohne „gemacht“ wird verworfen
    assert.equal(checkDateIdea({ ...base, photoId: '0f8c2f0a-1b2c-4d3e-8f90-123456789abc' }, now).photoId, null);
  });

  test('Mock-DB: Paar teilt die Liste, Foto aus eigenem Album, Fremde sehen nichts', async () => {
    const db = new MemoryBackend();
    const a = new MemoryStore(db);
    const b = new MemoryStore(db);
    const c = new MemoryStore(db);
    await login(a, 'd1@example.org');
    await login(b, 'd2@example.org');
    await login(c, 'd3@example.org');
    for (const [s, n] of [[a, 'A'], [b, 'B'], [c, 'C']] as const) await s.saveMyProfile({ displayName: n, color: 'blue' });
    await a.createCouple();
    await b.joinCouple(await a.createInvite());
    await c.createCouple();
    const d = await a.addDateIdea({ title: ' Picknick  am See ', category: 'draussen', note: null, doneOn: null, photoId: null });
    assert.equal(d.title, 'Picknick am See');
    assert.equal((await b.listDateIdeas()).length, 1);
    assert.equal((await c.listDateIdeas()).length, 0);
    await c.updateDateIdea(d.id, { ...d, title: 'gehackt' });
    await c.deleteDateIdea(d.id);
    assert.equal((await a.listDateIdeas())[0].title, 'Picknick am See');
    const img = 'A'.repeat(200);
    const foreign = await c.addPhoto({ base64: img, width: 800, height: 600 });
    await assert.rejects(() => b.updateDateIdea(d.id, { ...d, doneOn: '2026-01-10', photoId: foreign.id }), /date_photo_invalid/);
    const own = await a.addPhoto({ base64: img, width: 800, height: 600 });
    await b.updateDateIdea(d.id, { ...d, doneOn: '2026-01-10', photoId: own.id, note: 'Schön war es' });
    assert.equal((await a.listDateIdeas())[0].photoId, own.id);
    await a.deletePhoto(own.id);
    const after = (await a.listDateIdeas())[0];
    assert.equal(after.photoId, null);
    assert.equal(after.doneOn, '2026-01-10');
    // zurück auf „noch nicht gemacht“
    await a.updateDateIdea(d.id, { ...after, doneOn: null });
    assert.equal((await b.listDateIdeas())[0].doneOn, null);
    await b.deleteDateIdea(d.id);
    assert.equal((await a.listDateIdeas()).length, 0);
  });
});

describe('Restaurants', () => {
  const rest = (id: string, name: string, visitedOn: string | null, stars: number[] = []) =>
    ({ id, name, cuisine: null, place: null, price: null, note: null, visitedOn, photoId: null, ratings: stars.map((s, i) => ({ userId: `u${i}`, stars: s })), createdBy: null, createdAt: `2026-01-0${id.length}T00:00:00Z` });

  test('Durchschnitt, Preis, Sortierung', () => {
    assert.equal(avgStars(rest('a', 'A', '2026-01-01')), null);
    assert.equal(avgStars(rest('a', 'A', '2026-01-01', [4, 5])), 4.5);
    assert.equal(avgStars(rest('a', 'A', '2026-01-01', [3, 4, 4])), 3.5);
    assert.equal(starsText(4.5), '4,5');
    assert.equal(priceText(3), '€€€');
    assert.equal(restaurantSub({ cuisine: 'Italienisch', place: 'Köln', price: 2 }), 'Italienisch · Köln · €€');
    const { wish, visited } = splitRestaurants([rest('a', 'Gut', '2026-01-01', [4]), rest('bb', 'Wunsch', null), rest('ccc', 'Top', '2025-05-01', [5, 5]), rest('dddd', 'Neu', '2026-02-01')]);
    assert.deepEqual(wish.map((r) => r.id), ['bb']);
    assert.deepEqual(visited.map((r) => r.name), ['Top', 'Gut', 'Neu']);
    assert.equal(dateTitleFor('Da Mario'), 'Essen gehen: Da Mario');
    assert.ok(dateTitleFor('x'.repeat(100)).length <= 80);
  });

  test('Eingaben prüfen', () => {
    const now = new Date(2026, 10, 19);
    const base = { name: 'Da Mario', cuisine: null, place: null, price: null, note: null, visitedOn: null, photoId: null };
    assert.throws(() => checkRestaurant({ ...base, name: ' ' }), /Wie heißt/);
    assert.throws(() => checkRestaurant({ ...base, price: 5 }), /1 bis 4/);
    assert.throws(() => checkRestaurant({ ...base, visitedOn: '2026-12-24' }, now), /Zukunft/);
    assert.equal(checkRestaurant({ ...base, cuisine: '  ' }).cuisine, null);
    assert.equal(checkRestaurant({ ...base, photoId: '0f8c2f0a-1b2c-4d3e-8f90-123456789abc' }, now).photoId, null);
    assert.throws(() => checkStars(0), /1 bis 5/);
    assert.equal(checkStars(null), null);
  });

  test('Mock-DB: eigene Sterne pro Person, nur wenn besucht, Fremde sehen nichts', async () => {
    const db = new MemoryBackend();
    const a = new MemoryStore(db);
    const b = new MemoryStore(db);
    const c = new MemoryStore(db);
    await login(a, 'r1@example.org');
    await login(b, 'r2@example.org');
    await login(c, 'r3@example.org');
    for (const [s, n] of [[a, 'A'], [b, 'B'], [c, 'C']] as const) await s.saveMyProfile({ displayName: n, color: 'blue' });
    await a.createCouple();
    await b.joinCouple(await a.createInvite());
    await c.createCouple();
    const r = await a.addRestaurant({ name: ' Da  Mario ', cuisine: 'Italienisch', place: 'Köln', price: 2, note: null, visitedOn: null, photoId: null });
    assert.equal(r.name, 'Da Mario');
    await assert.rejects(() => a.rateRestaurant(r.id, 4), /restaurant_not_visited/);
    await b.updateRestaurant(r.id, { ...r, visitedOn: '2026-11-01' });
    await a.rateRestaurant(r.id, 4);
    await b.rateRestaurant(r.id, 5);
    await a.rateRestaurant(r.id, 3);
    const [got] = await b.listRestaurants();
    assert.equal(got.ratings.length, 2);
    assert.equal(avgStars(got), 4);
    assert.equal((await c.listRestaurants()).length, 0);
    await assert.rejects(() => c.rateRestaurant(r.id, 1), /restaurant_mismatch/);
    await c.deleteRestaurant(r.id);
    // eigene Sterne entfernen
    await b.rateRestaurant(r.id, null);
    assert.equal((await a.listRestaurants())[0].ratings.length, 1);
    // zurück auf "wollen wir hin" löscht die Sterne
    await a.updateRestaurant(r.id, { ...got, visitedOn: null });
    assert.equal((await b.listRestaurants())[0].ratings.length, 0);
    await a.deleteRestaurant(r.id);
    assert.equal((await b.listRestaurants()).length, 0);
  });
});
