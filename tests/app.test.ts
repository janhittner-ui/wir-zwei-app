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
import { shopEmoji } from '../src/lib/shop-emoji';
import { VERSES } from '../src/lib/verses';

async function login(store: MemoryStore, email: string) {
  await store.sendLoginCode(email);
  await store.verifyLoginCode(email, '123 456');
}

describe('Paar-Ablauf mit zwei Handys (Mock-DB)', () => {
  const db = new MemoryBackend();
  const jan = new MemoryStore(db);
  const vanessa = new MemoryStore(db);
  const fremd = new MemoryStore(db);

  test('Anmeldung: falscher Code wird abgelehnt', async () => {
    await jan.sendLoginCode('jan@example.org');
    await assert.rejects(() => jan.verifyLoginCode('jan@example.org', '000000'), /invalid/);
    assert.equal(await jan.getSession(), null);
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
    assert.match(friendlyError(new Error('irgendwas')), /schiefgegangen/);
  });
});
