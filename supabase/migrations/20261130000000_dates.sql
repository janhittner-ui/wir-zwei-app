-- Date-Liste: gemeinsame Ideen für Dates (nur für das Paar sichtbar).
-- Erledigt heißt: es gibt ein Datum, an dem ihr es gemacht habt. Dann geht auch ein Foto aus eurem Album dazu.

create table public.date_ideas (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 80),
  category   text not null default 'sonstiges'
               check (category in ('zuhause', 'draussen', 'essen', 'kultur', 'aktiv', 'ausflug', 'sonstiges')),
  note       text check (note is null or char_length(note) <= 500),
  -- wann ihr es gemacht habt (null = noch offen)
  done_on    date check (done_on is null or done_on between '1900-01-01' and current_date + 1),
  -- Foto aus dem gemeinsamen Album; wird es gelöscht, bleibt das Date ohne Foto
  photo_id   uuid references public.photos (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint date_ideas_photo_done check (photo_id is null or done_on is not null)
);
create index date_ideas_couple_created on public.date_ideas (couple_id, created_at);

-- Das Foto muss aus dem Album desselben Paares stammen.
create function public.date_ideas_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.photo_id is not null and (tg_op = 'INSERT' or new.photo_id is distinct from old.photo_id) and not exists (
       select 1 from public.photos where id = new.photo_id and couple_id = new.couple_id) then
    raise exception 'date_photo_invalid' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.date_ideas_check() from anon, public;

create trigger date_ideas_check before insert or update of photo_id, couple_id on public.date_ideas
  for each row execute function public.date_ideas_check();
create trigger date_ideas_guard before insert or update on public.date_ideas
  for each row execute function public.guard_row();

alter table public.date_ideas enable row level security;
create policy date_ideas_all on public.date_ideas for all to authenticated
  using (public.is_member(couple_id)) with check (public.is_member(couple_id));
grant select, insert, update, delete on public.date_ideas to authenticated;
revoke all on public.date_ideas from anon;

alter publication supabase_realtime add table public.date_ideas;
