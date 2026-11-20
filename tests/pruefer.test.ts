/**
 * Prüft das SQL-Skript für das Apple-Testkonto (supabase/scripts/pruefer-testkonto.sql):
 * Läuft es fehlerfrei über alle Migrationen, sieht der Prüfer in der App überall Daten,
 * und lässt es sich wiederholen?
 *
 * Start: npx tsx --test tests/pruefer.test.ts
 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, test } from 'node:test';

import type { QuizAnswer } from '../src/data/types';
import { normalizePrefs } from '../src/lib/prefs';
import { questionOrder, quizState } from '../src/lib/quiz';
import { SUPABASE_STUB } from './supabase-stub';

const ROOT = join(__dirname, '..', 'supabase');
const SCRIPT = readFileSync(join(ROOT, 'scripts', 'pruefer-testkonto.sql'), 'utf8');
const JONAS = '9dcb0522-3b9e-43c2-bf1b-2666972afeea';
const LEA = 'e571644a-3a0a-4938-9de5-0cb7eb7ff98b';
const COUPLE = 'ab84d52b-3b28-47b3-837e-161265bb066a';

// Spalten von auth.users / auth.identities, die das Skript wie bei Supabase befüllt
const AUTH_EXTRA = `
  alter table auth.users
    add column instance_id uuid, add column aud text, add column role text,
    add column encrypted_password text, add column email_confirmed_at timestamptz,
    add column raw_app_meta_data jsonb, add column raw_user_meta_data jsonb,
    add column created_at timestamptz, add column updated_at timestamptz,
    add column confirmation_token text, add column recovery_token text,
    add column email_change_token_new text, add column email_change text;
  create table auth.identities (
    id uuid primary key, user_id uuid not null references auth.users (id) on delete cascade,
    provider_id text not null, identity_data jsonb not null, provider text not null,
    last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz,
    unique (provider_id, provider));
`;

let db: PGlite;

async function as<T = Record<string, unknown>>(user: string, sql: string) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user}', false); set role authenticated;`);
  try {
    return (await db.query<T>(sql)).rows;
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
const count = async (user: string, table: string) =>
  Number((await as<{ n: number }>(user, `select count(*)::int n from public.${table}`))[0].n);

before(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUB);
  for (const f of readdirSync(join(ROOT, 'migrations')).sort()) {
    await db.exec(readFileSync(join(ROOT, 'migrations', f), 'utf8'));
  }
  await db.exec(AUTH_EXTRA);
  // ein fremdes Paar, das vom Skript unberührt bleiben muss
  await db.exec(`insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a', 'a@example.org')`);
});

describe('Apple-Testkonto', () => {
  test('Skript läuft fehlerfrei und zweimal hintereinander', async () => {
    const first = await db.exec(SCRIPT);
    assert.equal(first.at(-1)?.rows.length, 2);
    const second = await db.exec(SCRIPT);
    assert.equal(second.at(-1)?.rows.length, 2);
    const users = await db.query<{ n: number }>(`select count(*)::int n from auth.users`);
    assert.equal(users.rows[0].n, 3);
    const idents = await db.query<{ n: number }>(`select count(*)::int n from auth.identities`);
    assert.equal(idents.rows[0].n, 2);
  });

  test('Konten sind bestätigt, Passwort ist nur als bcrypt-Hash gespeichert', async () => {
    const r = await db.query<{ email: string; encrypted_password: string; email_confirmed_at: string | null; confirmation_token: string }>(
      `select email, encrypted_password, email_confirmed_at, confirmation_token from auth.users where id in ('${JONAS}', '${LEA}') order by email`);
    assert.deepEqual(r.rows.map((u) => u.email), ['apple.pruefung@example.com', 'lea.pruefung@example.com']);
    for (const u of r.rows) {
      assert.match(u.encrypted_password, /^\$2a\$12\$.{53}$/);
      assert.ok(u.email_confirmed_at);
      assert.equal(u.confirmation_token, '');
    }
  });

  test('Prüfer (Jonas) sieht in jedem Bereich Daten, im Paar mit Lea', async () => {
    const members = await as<{ user_id: string }>(JONAS, `select user_id from public.couple_members order by user_id`);
    assert.deepEqual(members.map((m) => m.user_id), [JONAS, LEA]);
    const profiles = await as<{ display_name: string }>(JONAS, `select display_name from public.profiles order by display_name`);
    assert.deepEqual(profiles.map((p) => p.display_name), ['Jonas', 'Lea']);
    for (const t of ['events', 'birthdays', 'shopping_items', 'notes', 'recipes', 'trips', 'trip_items', 'media',
      'gifts', 'date_ideas', 'restaurants', 'restaurant_ratings', 'milestones', 'quiz_answers', 'cycle_periods']) {
      assert.ok((await count(JONAS, t)) > 0, `${t} ist leer`);
    }
    // Geschenkidee von Lea für Jonas bleibt für Jonas geheim
    assert.equal(await count(JONAS, 'gifts'), 4);
    assert.equal(await count(LEA, 'gifts'), 4);
    // Termine liegen überwiegend in der Zukunft
    const upcoming = await as<{ n: number }>(JONAS, `select count(*)::int n from public.events where date >= current_date`);
    assert.ok(upcoming[0].n >= 5);
  });

  test('Quiz: Antworten passen zu Runde 1, Jonas ist als Nächstes dran', async () => {
    const rows = await as<{ id: string; round: number; question_id: string; player: string; answer: string; created_by: string; created_at: Date }>(
      JONAS, `select * from public.quiz_answers`);
    const answers: QuizAnswer[] = rows.map((r) => ({
      id: r.id, round: r.round, questionId: r.question_id, player: r.player, answer: r.answer, createdBy: r.created_by,
      createdAt: new Date(r.created_at).toISOString(),
    }));
    const first4 = questionOrder(COUPLE, 1).slice(0, 4).map((q) => q.id);
    assert.deepEqual(answers.map((a) => a.questionId).sort(), [...first4].sort());
    const st = quizState(answers, [JONAS, LEA].sort(), COUPLE);
    assert.equal(st.done, 4);
    assert.equal(st.player, JONAS);
  });

  test('Einstellungen: Quiz ist als Tab sichtbar', async () => {
    const r = await as<{ prefs: unknown }>(JONAS, `select prefs from public.user_prefs`);
    const p = normalizePrefs(r[0].prefs);
    assert.ok(!p.areas.hidden.includes('quiz'));
    assert.ok(p.areas.order.includes('quiz'));
  });
});
