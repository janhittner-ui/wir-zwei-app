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
