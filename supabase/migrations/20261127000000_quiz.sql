-- Paar-Quiz: Abwechselnd bekommt einer von euch eine Frage und beantwortet sie.
-- Die Fragen selbst stecken in der App (src/lib/quiz-questions.ts); hier landen nur die Antworten.
-- Pro Runde wird jede Frage genau einmal beantwortet (oder übersprungen: answer = null).

create table public.quiz_answers (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples (id) on delete cascade,
  round       smallint not null default 1 check (round between 1 and 1000),
  question_id text not null check (question_id ~ '^[a-z0-9-]{1,40}$'),
  -- wer dran war (muss zum Paar gehören)
  player      uuid references auth.users (id) on delete set null,
  answer      text check (answer is null or char_length(btrim(answer)) between 1 and 1000),
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  constraint quiz_once unique (couple_id, round, question_id)
);
create index quiz_answers_couple on public.quiz_answers (couple_id, round, created_at);

create function public.quiz_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.player is null or not exists (
       select 1 from public.couple_members where couple_id = new.couple_id and user_id = new.player) then
    raise exception 'quiz_player_invalid' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.quiz_check() from anon, public;

create trigger quiz_check before insert on public.quiz_answers
  for each row execute function public.quiz_check();
create trigger quiz_guard before insert or update on public.quiz_answers
  for each row execute function public.guard_row();

alter table public.quiz_answers enable row level security;
create policy quiz_all on public.quiz_answers for all to authenticated
  using (public.is_member(couple_id)) with check (public.is_member(couple_id));
-- Antworten bleiben, wie sie gegeben wurden: nur lesen, eintragen und (beim Aufräumen) löschen
grant select, insert, delete on public.quiz_answers to authenticated;
revoke all on public.quiz_answers from anon;

alter publication supabase_realtime add table public.quiz_answers;
