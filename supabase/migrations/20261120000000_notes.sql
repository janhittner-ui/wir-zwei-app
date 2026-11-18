-- Notizen: geteilte, farbige Notizen des Paares (nur für das Paar sichtbar).

create table public.notes (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  title      text check (title is null or char_length(title) <= 120),
  body       text not null check (char_length(btrim(body)) between 1 and 5000),
  color      text not null default 'n1' check (color in ('n1', 'n2', 'n3', 'n4')),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  -- wer zuletzt geändert hat (für "zuletzt von …"); wird automatisch gesetzt
  updated_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_couple_updated on public.notes (couple_id, updated_at desc);

create function public.notes_touch() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  -- "zuletzt von" ist immer die Person, die gerade ändert (nicht fälschbar).
  -- Ausnahme: Beim Löschen eines Kontos setzt die Datenbank selbst auf null; das Konto existiert dann nicht mehr.
  if exists (select 1 from auth.users where id = auth.uid()) then
    new.updated_by := auth.uid();
  end if;
  return new;
end $$;
revoke execute on function public.notes_touch() from anon, public;

create trigger notes_touch before update on public.notes
  for each row execute function public.notes_touch();
create trigger notes_guard before insert or update on public.notes
  for each row execute function public.guard_row();

alter table public.notes enable row level security;
create policy notes_all on public.notes for all to authenticated
  using (public.is_member(couple_id)) with check (public.is_member(couple_id));

grant select, insert, update, delete on public.notes to authenticated;
revoke all on public.notes from anon;

alter publication supabase_realtime add table public.notes;
