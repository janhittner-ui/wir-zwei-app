-- Geburtstage: Familie und Freunde des Paares (nur für das Paar sichtbar).
-- Gespeichert wird nur Tag/Monat, das Geburtsjahr ist freiwillig (für "wird 30").

create table public.birthdays (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  month      smallint not null check (month between 1 and 12),
  day        smallint not null check (day between 1 and 31),
  year       smallint check (year is null or year between 1900 and extract(year from current_date)::int),
  note       text check (note is null or char_length(note) <= 300),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- kein 31. April usw.; der 29. Februar ist erlaubt
  constraint birthdays_valid_day check (
    day <= case when month = 2 then 29 when month in (4, 6, 9, 11) then 30 else 31 end
  )
);
create index birthdays_couple on public.birthdays (couple_id, month, day);

create trigger birthdays_touch before update on public.birthdays
  for each row execute function public.touch_updated_at();
create trigger birthdays_guard before insert or update on public.birthdays
  for each row execute function public.guard_row();

alter table public.birthdays enable row level security;
create policy birthdays_all on public.birthdays for all to authenticated
  using (public.is_member(couple_id)) with check (public.is_member(couple_id));

grant select, insert, update, delete on public.birthdays to authenticated;
revoke all on public.birthdays from anon;

alter publication supabase_realtime add table public.birthdays;
