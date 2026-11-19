-- Zyklus (Periodenkalender): Gesundheitsdaten nach Art. 9 DSGVO, deshalb so sparsam wie möglich.
-- Gespeichert werden NUR Beginn und Ende der Periode. Alles andere (Vorhersage, Eisprung,
-- fruchtbare Tage) rechnet die App selbst aus und speichert es nicht.
--
-- Die Einträge gehören der Person, die sie macht, nicht dem Paar. Der Partner sieht sie nur,
-- wenn die Person das selbst einschaltet (cycle_settings.share). Das prüft die Datenbank.
-- Ändern und löschen kann sie nur die Person selbst. Konto löschen löscht alles mit.

create table public.cycle_periods (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  start_date date not null check (start_date between '2000-01-01' and current_date + 1),
  end_date   date,
  created_at timestamptz not null default now(),
  constraint cycle_period_length check (end_date is null or end_date between start_date and start_date + 20),
  constraint cycle_once unique (user_id, start_date)
);
create index cycle_periods_user on public.cycle_periods (user_id, start_date);

create table public.cycle_settings (
  user_id    uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  share      boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger cycle_settings_touch before update on public.cycle_settings
  for each row execute function public.touch_updated_at();

-- Darf das angemeldete Konto die Einträge von "owner" sehen?
-- Ja, wenn es die eigenen sind, oder wenn owner zum selben Paar gehört UND Teilen eingeschaltet hat.
create function public.cycle_visible(owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select owner = auth.uid() or (
    exists (select 1 from public.cycle_settings s where s.user_id = owner and s.share)
    and exists (
      select 1 from public.couple_members a
      join public.couple_members b on b.couple_id = a.couple_id
      where a.user_id = auth.uid() and b.user_id = owner))
$$;
revoke execute on function public.cycle_visible(uuid) from anon, public;
grant execute on function public.cycle_visible(uuid) to authenticated;

alter table public.cycle_periods enable row level security;
create policy cycle_read on public.cycle_periods for select to authenticated using (public.cycle_visible(user_id));
create policy cycle_insert on public.cycle_periods for insert to authenticated with check (user_id = auth.uid());
create policy cycle_update on public.cycle_periods for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cycle_delete on public.cycle_periods for delete to authenticated using (user_id = auth.uid());
grant select, insert, delete on public.cycle_periods to authenticated;
grant update (start_date, end_date) on public.cycle_periods to authenticated;
revoke all on public.cycle_periods from anon;

alter table public.cycle_settings enable row level security;
create policy cycle_settings_own on public.cycle_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.cycle_settings to authenticated;
revoke all on public.cycle_settings from anon;

alter publication supabase_realtime add table public.cycle_periods;
