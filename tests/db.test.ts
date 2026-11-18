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
      (select count(*) from public.birthdays) +
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
