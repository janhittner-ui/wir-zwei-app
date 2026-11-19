/**
 * Strenger Datenbank-Test: spielt die echte Migration in eine Postgres-Instanz (PGlite, läuft im
 * Prozess) mit nachgebauter Supabase-Umgebung (Rollen anon/authenticated, auth.users, auth.uid())
 * und prüft Row Level Security, Paar-Kopplung und Konto-Löschung.
 *
 * Start: npm run test:db
 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, test } from 'node:test';

const MIGRATIONS = join(__dirname, '..', 'supabase', 'migrations');

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create schema extensions;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth, extensions, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  -- Schlimmster Fall: anon bekäme automatisch alles, authenticated nichts. Die Migration muss beides regeln.
  alter default privileges in schema public grant all on tables to anon;
  alter default privileges in schema public grant execute on functions to anon;
  create publication supabase_realtime;
  -- Speicher (Storage) wie bei Supabase: Buckets, Objekte mit RLS, foldername()
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text not null, owner uuid default auth.uid(), unique (bucket_id, name));
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to anon, authenticated;
  grant execute on function storage.foldername(text) to anon, authenticated;
`;

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';

let db: PGlite;

/** Führt SQL als angemeldeter Nutzer (oder anon bei null) aus – genau wie die App über die API. */
async function as<T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false);`);
  await db.exec(user ? 'set role authenticated' : 'set role anon');
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}
async function fails(user: string | null, sql: string, msg: RegExp, params: unknown[] = []) {
  await assert.rejects(() => as(user, sql, params), msg);
}

before(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUB);
  for (const f of readdirSync(MIGRATIONS).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'));
  }
  await db.exec(`insert into auth.users (id, email) values
    ('${A}', 'a@example.org'), ('${B}', 'b@example.org'), ('${C}', 'c@example.org');`);
});

describe('Datenbank (strenge Prüfung)', () => {
  let couple = '';
  let code = '';

  test('nicht angemeldet: kein Zugriff auf irgendwas', async () => {
    await fails(null, 'select * from public.events', /permission denied/);
    await fails(null, 'select * from public.profiles', /permission denied/);
    await fails(null, 'select public.create_couple()', /permission denied/);
  });

  test('Profil anlegen: nur eigenes, Name und Farbe werden geprüft', async () => {
    await as(A, `insert into public.profiles (id, display_name, color) values ($1, 'Jan', 'blue')`, [A]);
    await as(B, `insert into public.profiles (id, display_name, color) values ($1, 'Vanessa', 'pink')`, [B]);
    await as(C, `insert into public.profiles (id, display_name) values ($1, 'Fremd')`, [C]);
    await fails(A, `insert into public.profiles (id, display_name) values ($1, 'Fake')`, /row-level security/, [B]);
    await fails(A, `update public.profiles set color = 'grün' where id = $1`, /check constraint/, [A]);
    await fails(A, `update public.profiles set display_name = '   ' where id = $1`, /check constraint/, [A]);
    // Ohne Paar sieht man nur sich selbst
    assert.equal((await as(A, 'select * from public.profiles')).length, 1);
  });

  test('Paar anlegen und Einladungscode erzeugen', async () => {
    couple = (await as<{ c: string }>(A, 'select public.create_couple() as c'))[0].c;
    assert.match(couple, /[0-9a-f-]{36}/);
    await fails(A, 'select public.create_couple()', /already_in_couple/);
    code = (await as<{ c: string }>(A, 'select public.create_invite() as c'))[0].c;
    assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
    // Fremde sehen den Code nicht
    assert.equal((await as(C, 'select * from public.couple_invites')).length, 0);
    // Direktes Schreiben in Kopplungs-Tabellen ist verboten
    await fails(C, `insert into public.couple_members (couple_id, user_id) values ($1, $2)`, /permission denied/, [couple, C]);
    await fails(C, `insert into public.couples default values`, /permission denied/);
  });

  test('falscher oder abgelaufener Code wird abgelehnt', async () => {
    await fails(B, `select public.join_couple('AAAAAAAA')`, /invalid_code/);
    await fails(B, `select public.join_couple(null)`, /invalid_code/);
  });

  test('Partner tritt mit Code bei (Kleinbuchstaben und Leerzeichen egal), Code ist danach verbraucht', async () => {
    const pretty = code.toLowerCase().slice(0, 4) + ' ' + code.toLowerCase().slice(4);
    const joined = (await as<{ c: string }>(B, 'select public.join_couple($1) as c', [pretty]))[0].c;
    assert.equal(joined, couple);
    await fails(C, 'select public.join_couple($1)', /invalid_code/, [code]);
    // Paar ist voll
    await fails(A, 'select public.create_invite()', /couple_full/);
    // Partner sehen sich gegenseitig
    assert.equal((await as(A, 'select * from public.profiles')).length, 2);
    assert.equal((await as(C, 'select * from public.profiles')).length, 1);
  });

  test('Termine: Paar sieht und ändert sie, Fremde nicht', async () => {
    await as(A, `insert into public.events (couple_id, title, date, time, who) values ($1, 'Kino', '2026-12-01', '19:30', $2)`, [couple, B]);
    const [ev] = await as<{ id: string; created_by: string }>(B, 'select * from public.events');
    assert.equal(ev.created_by, A);
    await as(B, `update public.events set title = 'Kino mit Popcorn' where id = $1`, [ev.id]);
    assert.equal((await as(C, 'select * from public.events')).length, 0);
    assert.equal((await as(C, `update public.events set title = 'x' where id = $1 returning id`, [ev.id])).length, 0);
    assert.equal((await as(C, `delete from public.events where id = $1 returning id`, [ev.id])).length, 0);
    await fails(C, `insert into public.events (couple_id, title, date) values ($1, 'Einbruch', '2026-12-01')`, /row-level security/, [couple]);
  });

  test('Termine: Prüfungen gegen kaputte oder gefälschte Daten', async () => {
    await fails(A, `insert into public.events (couple_id, title, date) values ($1, '', '2026-12-01')`, /check constraint/, [couple]);
    await fails(A, `insert into public.events (couple_id, title, date) values ($1, $2, '2026-12-01')`, /check constraint/, [couple, 'x'.repeat(121)]);
    await fails(A, `insert into public.events (couple_id, title, date, who) values ($1, 'Fremd', '2026-12-01', $2)`, /who_not_member/, [couple, C]);
    await fails(A, `insert into public.events (couple_id, title, date, created_by) values ($1, 'Fake', '2026-12-01', $2)`, /created_by_mismatch/, [couple, B]);
    const [ev] = await as<{ id: string }>(A, 'select id from public.events limit 1');
    await fails(A, `update public.events set created_by = $2 where id = $1`, /immutable_column/, [ev.id, B]);
  });

  test('Notizen: Paar teilt sie, "zuletzt von" stimmt, Fremde sehen nichts', async () => {
    const [n] = await as<{ id: string; updated_by: string }>(A, `insert into public.notes (couple_id, title, body, color) values ($1, 'WLAN', 'Gast: sonne123', 'n2') returning id, updated_by`, [couple]);
    assert.equal(n.updated_by, A);
    const [u] = await as<{ updated_by: string; body: string }>(B, `update public.notes set body = 'Gast: mond456' where id = $1 returning updated_by, body`, [n.id]);
    assert.equal(u.updated_by, B);
    const [spoof] = await as<{ updated_by: string }>(A, `update public.notes set updated_by = $2 where id = $1 returning updated_by`, [n.id, C]);
    assert.equal(spoof.updated_by, A);
    await fails(A, `insert into public.notes (couple_id, body, color) values ($1, 'x', 'lila')`, /check constraint/, [couple]);
    await fails(A, `insert into public.notes (couple_id, body) values ($1, '   ')`, /check constraint/, [couple]);
    await fails(A, `insert into public.notes (couple_id, body) values ($1, $2)`, /check constraint/, [couple, 'x'.repeat(5001)]);
    assert.equal((await as(C, 'select * from public.notes')).length, 0);
    await fails(C, `insert into public.notes (couple_id, body) values ($1, 'Einbruch')`, /row-level security/, [couple]);
    assert.equal((await as(C, `update public.notes set body = 'x' returning id`)).length, 0);
    await fails(null, 'select * from public.notes', /permission denied/);
  });

  test('Rezepte: Paar teilt sie, Prüfungen greifen, Fremde sehen nichts', async () => {
    const [r] = await as<{ id: string; servings: number; created_by: string }>(A,
      `insert into public.recipes (couple_id, title, servings, minutes, ingredients, steps) values ($1, 'Lasagne', 4, 60, '500 g Hackfleisch', 'Ofen vorheizen') returning id, servings, created_by`, [couple]);
    assert.equal(r.created_by, A);
    await as(B, `update public.recipes set favorite = true, servings = 6 where id = $1`, [r.id]);
    const [seen] = await as<{ favorite: boolean; servings: number }>(A, 'select * from public.recipes');
    assert.equal(seen.favorite, true);
    assert.equal(seen.servings, 6);
    await fails(A, `insert into public.recipes (couple_id, title) values ($1, '  ')`, /check constraint/, [couple]);
    await fails(A, `insert into public.recipes (couple_id, title, servings) values ($1, 'X', 0)`, /check constraint/, [couple]);
    await fails(A, `insert into public.recipes (couple_id, title, minutes) values ($1, 'X', 2000)`, /check constraint/, [couple]);
    await fails(A, `insert into public.recipes (couple_id, title, steps) values ($1, 'X', $2)`, /check constraint/, [couple, 'x'.repeat(10001)]);
    await fails(A, `update public.recipes set created_by = $2 where id = $1`, /immutable_column|created_by/, [r.id, B]);
    assert.equal((await as(C, 'select * from public.recipes')).length, 0);
    await fails(C, `insert into public.recipes (couple_id, title) values ($1, 'Einbruch')`, /row-level security/, [couple]);
    assert.equal((await as(C, `delete from public.recipes returning id`)).length, 0);
    await fails(null, 'select * from public.recipes', /permission denied/);
  });

  test('Reisen + Packliste: Paar teilt sie, Daten geprüft, nichts landet bei fremden Reisen', async () => {
    const [wish] = await as<{ id: string }>(A, `insert into public.trips (couple_id, title) values ($1, 'Lofoten') returning id`, [couple]);
    const [trip] = await as<{ id: string }>(B, `insert into public.trips (couple_id, title, start_date, end_date) values ($1, 'Toskana', '2027-06-01', '2027-06-14') returning id`, [couple]);
    assert.equal((await as(A, 'select * from public.trips')).length, 2);
    await fails(A, `insert into public.trips (couple_id, title, end_date) values ($1, 'X', '2027-01-01')`, /trips_dates/, [couple]);
    await fails(A, `insert into public.trips (couple_id, title, start_date, end_date) values ($1, 'X', '2027-01-10', '2027-01-01')`, /trips_dates/, [couple]);
    await fails(A, `insert into public.trips (couple_id, title, start_date, end_date) values ($1, 'X', '2027-01-01', '2029-01-01')`, /trips_dates/, [couple]);
    await fails(A, `insert into public.trips (couple_id, title) values ($1, '  ')`, /check constraint/, [couple]);
    const [it] = await as<{ id: string }>(A, `insert into public.trip_items (couple_id, trip_id, text) values ($1, $2, 'Sonnencreme') returning id`, [couple, trip.id]);
    await as(B, `update public.trip_items set done = true where id = $1`, [it.id]);
    assert.equal((await as<{ done: boolean }>(A, 'select done from public.trip_items'))[0].done, true);
    await fails(A, `update public.trip_items set trip_id = $2 where id = $1`, /immutable_column/, [it.id, wish.id]);
    // Reise eines anderen Paares (direkt angelegt): kein Eintrag darf dort landen
    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
    const other = (await db.query<{ id: string }>(`insert into public.couples default values returning id`)).rows[0].id;
    const ot = (await db.query<{ id: string }>(`insert into public.trips (couple_id, title, created_by) values ($1, 'Fremd', null) returning id`, [other])).rows[0].id;
    await fails(A, `insert into public.trip_items (couple_id, trip_id, text) values ($1, $2, 'x')`, /trip_mismatch/, [couple, ot]);
    await db.exec(`delete from public.couples where id = '${other}'`);
    assert.equal((await as(C, 'select * from public.trips')).length, 0);
    assert.equal((await as(C, 'select * from public.trip_items')).length, 0);
    await fails(C, `insert into public.trips (couple_id, title) values ($1, 'Einbruch')`, /row-level security/, [couple]);
    await fails(null, 'select * from public.trip_items', /permission denied/);
    // Reise löschen nimmt die Packliste mit
    await as(A, `delete from public.trips where id = $1`, [wish.id]);
    assert.equal((await as(A, 'select * from public.trip_items')).length, 1);
  });

  test('Fotos: Pfad automatisch, Speicher nur im eigenen Ordner, Fremde sehen nichts', async () => {
    const [ph] = await as<{ id: string; path: string }>(A, `insert into public.photos (couple_id, caption, width, height) values ($1, 'Strand', 1600, 1200) returning id, path`, [couple]);
    assert.equal(ph.path, `${couple}/${ph.id}.jpg`);
    await fails(A, `insert into public.photos (couple_id, path, width, height) values ($1, 'x/y.jpg', 1, 1)`, /generated|cannot insert/, [couple]);
    await fails(A, `insert into public.photos (couple_id, width, height) values ($1, 0, 10)`, /check constraint/, [couple]);
    await as(B, `update public.photos set caption = 'Am Strand' where id = $1`, [ph.id]);
    await fails(B, `update public.photos set width = 5 where id = $1`, /permission denied/, [ph.id]);
    // Datei hochladen: nur mit passendem Album-Eintrag und nur im eigenen Ordner
    await as(A, `insert into storage.objects (bucket_id, name) values ('photos', $1)`, [ph.path]);
    await fails(A, `insert into storage.objects (bucket_id, name) values ('photos', $1)`, /row-level security/, [`${couple}/heimlich.jpg`]);
    await fails(A, `insert into storage.objects (bucket_id, name) values ('photos', $1)`, /row-level security/, [`00000000-0000-4000-8000-000000000999/${ph.id}.jpg`]);
    assert.equal((await as(B, `select * from storage.objects where bucket_id = 'photos'`)).length, 1);
    assert.equal((await as(C, `select * from storage.objects`)).length, 0);
    assert.equal((await as(C, 'select * from public.photos')).length, 0);
    assert.equal((await as(C, `delete from storage.objects returning id`)).length, 0);
    await fails(C, `insert into storage.objects (bucket_id, name) values ('photos', $1)`, /row-level security/, [ph.path]);
    await fails(null, 'select * from public.photos', /permission denied/);
    assert.equal((await as(null, `select * from storage.objects`)).length, 0);
    // Löschen: Datei und Eintrag
    assert.equal((await as(B, `delete from storage.objects where name = $1 returning id`, [ph.path])).length, 1);
    await as(B, `delete from public.photos where id = $1`, [ph.id]);
    const bucket = (await db.query<{ public: boolean }>(`select public from storage.buckets where id = 'photos'`)).rows[0];
    assert.equal(bucket.public, false);
  });

  test('Geburtstage: Paar teilt sie, Prüfungen greifen, Fremde sehen nichts', async () => {
    await as(A, `insert into public.birthdays (couple_id, name, month, day, year) values ($1, 'Oma Helga', 3, 14, 1941)`, [couple]);
    await as(B, `insert into public.birthdays (couple_id, name, month, day) values ($1, 'Schaltjahr-Kind', 2, 29)`, [couple]);
    assert.equal((await as(B, 'select * from public.birthdays')).length, 2);
    assert.equal((await as(C, 'select * from public.birthdays')).length, 0);
    await fails(A, `insert into public.birthdays (couple_id, name, month, day) values ($1, 'X', 4, 31)`, /birthdays_valid_day/, [couple]);
    await fails(A, `insert into public.birthdays (couple_id, name, month, day) values ($1, 'X', 13, 1)`, /check constraint/, [couple]);
    await fails(A, `insert into public.birthdays (couple_id, name, month, day, year) values ($1, 'X', 1, 1, 3000)`, /check constraint/, [couple]);
    await fails(A, `insert into public.birthdays (couple_id, name, month, day) values ($1, '  ', 1, 1)`, /check constraint/, [couple]);
    await fails(C, `insert into public.birthdays (couple_id, name, month, day) values ($1, 'Einbruch', 1, 1)`, /row-level security/, [couple]);
    assert.equal((await as(C, `delete from public.birthdays returning id`)).length, 0);
    await fails(null, 'select * from public.birthdays', /permission denied/);
  });

  test('Einkaufsliste: Paar teilt sie, Fremde sehen nichts', async () => {
    await as(B, `insert into public.shopping_items (couple_id, text, qty) values ($1, 'Milch', '2 l')`, [couple]);
    await as(A, `update public.shopping_items set done = true`);
    const rows = await as<{ done: boolean }>(B, 'select * from public.shopping_items');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].done, true);
    assert.equal((await as(C, 'select * from public.shopping_items')).length, 0);
  });

  test('"Zusammen seit" ändern ja, andere Spalten nein', async () => {
    await as(B, `update public.couples set together_since = '2023-05-20', names = 'Jan & Vanessa' where id = $1`, [couple]);
    await fails(B, `update public.couples set created_at = now() where id = $1`, /permission denied/, [couple]);
    await fails(B, `update public.couples set together_since = current_date + 30 where id = $1`, /check constraint/, [couple]);
    assert.equal((await as(C, 'select * from public.couples')).length, 0);
  });

  test('Konto löschen: Konto weg, Partner behält gemeinsame Daten ohne Verweis', async () => {
    await as(B, 'select public.delete_my_account()');
    const users = (await db.query<{ id: string }>('select id from auth.users')).rows.map((r) => r.id);
    assert.ok(!users.includes(B));
    const evs = await as<{ who: string | null }>(A, 'select * from public.events');
    assert.equal(evs.length, 1);
    assert.equal(evs[0].who, null);
    const items = await as<{ created_by: string | null }>(A, 'select * from public.shopping_items');
    assert.equal(items[0].created_by, null);
    assert.equal((await as(A, 'select * from public.profiles')).length, 1);
    // Ein neuer Partner kann wieder eingeladen werden
    assert.match((await as<{ c: string }>(A, 'select public.create_invite() as c'))[0].c, /^[A-Z2-9]{8}$/);
  });

  test('Letztes Mitglied löscht Konto: alle Paar-Daten sind weg', async () => {
    await as(A, 'select public.delete_my_account()');
    const left = await db.query<{ n: number }>(`select
      (select count(*) from public.couples) + (select count(*) from public.events) +
      (select count(*) from public.shopping_items) + (select count(*) from public.couple_invites) +
      (select count(*) from public.birthdays) + (select count(*) from public.notes) +
      (select count(*) from public.recipes) + (select count(*) from public.trips) + (select count(*) from public.trip_items) + (select count(*) from public.photos) +
      (select count(*) from public.profiles where id = '${A}') as n`);
    assert.equal(Number(left.rows[0].n), 0);
  });

  test('Abgelaufener Code wird abgelehnt', async () => {
    await as(C, 'select public.create_couple()');
    const c2 = (await as<{ c: string }>(C, 'select public.create_invite() as c'))[0].c;
    await db.exec(`update public.couple_invites set expires_at = now() - interval '1 minute'`);
    await db.exec(`insert into auth.users (id) values ('${A}')`);
    await fails(A, 'select public.join_couple($1)', /invalid_code/, [c2]);
  });
});
