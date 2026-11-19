-- Reisen: Wunschziele (ohne Datum) und geplante Reisen (mit Datum), dazu je eine gemeinsame Packliste.
-- Nur für das Paar sichtbar.

create table public.trips (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  start_date date,
  end_date   date,
  note       text check (note is null or char_length(note) <= 2000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Wunschziel: kein Datum. Geplant: Startdatum, Ende optional, nicht vor dem Start, höchstens ein Jahr lang.
  constraint trips_dates check (
    (start_date is null and end_date is null)
    or (start_date is not null and (end_date is null or end_date between start_date and start_date + 366))
  )
);
create index trips_couple_start on public.trips (couple_id, start_date);

create trigger trips_touch before update on public.trips
  for each row execute function public.touch_updated_at();
create trigger trips_guard before insert or update on public.trips
  for each row execute function public.guard_row();

alter table public.trips enable row level security;
create policy trips_all on public.trips for all to authenticated
  using (public.is_member(couple_id)) with check (public.is_member(couple_id));
grant select, insert, update, delete on public.trips to authenticated;
revoke all on public.trips from anon;

-- Packliste einer Reise
create table public.trip_items (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  trip_id    uuid not null references public.trips (id) on delete cascade,
  text       text not null check (char_length(btrim(text)) between 1 and 120),
  done       boolean not null default false,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index trip_items_trip on public.trip_items (trip_id, created_at);

-- Ein Eintrag gehört immer zu einer Reise desselben Paares und kann nicht zu einer anderen Reise wandern.
create function public.trip_items_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.trip_id is distinct from old.trip_id then
    raise exception 'immutable_column' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.trips where id = new.trip_id and couple_id = new.couple_id) then
    raise exception 'trip_mismatch' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.trip_items_check() from anon, public;

create trigger trip_items_guard before insert or update on public.trip_items
  for each row execute function public.guard_row();
create trigger trip_items_check before insert or update on public.trip_items
  for each row execute function public.trip_items_check();

alter table public.trip_items enable row level security;
create policy trip_items_all on public.trip_items for all to authenticated
  using (public.is_member(couple_id)) with check (public.is_member(couple_id));
grant select, insert, update, delete on public.trip_items to authenticated;
revoke all on public.trip_items from anon;

alter publication supabase_realtime add table public.trips, public.trip_items;
