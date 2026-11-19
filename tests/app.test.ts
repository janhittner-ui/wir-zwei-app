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
});
