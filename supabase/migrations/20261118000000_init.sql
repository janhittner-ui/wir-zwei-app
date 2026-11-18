-- Wir Zwei: Grundschema
-- Prinzipien: Datenminimierung, jede Tabelle mit Row Level Security,
-- Paar-Daten sind nur für die (max. zwei) Mitglieder des Paares sichtbar.
-- Schreiben in Kopplungs-Tabellen nur über geprüfte Funktionen (RPC).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

-- Profil: nur Anzeigename und Farbe. Die E-Mail liegt ausschließlich in auth.users.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  color        text not null default 'blue' check (color in ('blue', 'pink')),
  created_at   timestamptz not null default now()
);

create table public.couples (
  id             uuid primary key default gen_random_uuid(),
  together_since date check (together_since is null or together_since <= current_date + 1),
  names          text check (names is null or char_length(names) <= 60),
  created_at     timestamptz not null default now()
);

-- Ein Konto gehört zu höchstens einem Paar (unique user_id), ein Paar hat höchstens zwei Mitglieder (Trigger).
create table public.couple_members (
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id   uuid not null unique references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

-- Einladungscodes laufen nach 48 Stunden ab und gelten einmal.
create table public.couple_invites (
  code       text primary key check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  couple_id  uuid not null unique references public.couples (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '48 hours'
);

create table public.events (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  date       date not null,
  time       time,
  note       text check (note is null or char_length(note) <= 500),
  who        uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_couple_date on public.events (couple_id, date);

create table public.shopping_items (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  text       text not null check (char_length(btrim(text)) between 1 and 120),
  qty        text check (qty is null or char_length(qty) <= 30),
  done       boolean not null default false,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shopping_couple on public.shopping_items (couple_id, done);

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------------

-- Paar des angemeldeten Kontos (oder null). security definer, damit die RLS-Prüfung nicht rekursiv wird.
create function public.my_couple_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select couple_id from public.couple_members where user_id = auth.uid()
$$;

create function public.is_member(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.couple_members where couple_id = c and user_id = auth.uid())
$$;

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();
create trigger shopping_touch before update on public.shopping_items
  for each row execute function public.touch_updated_at();

-- Höchstens zwei Mitglieder pro Paar.
create function public.limit_couple_size() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.couples where id = new.couple_id for update;
  if (select count(*) from public.couple_members where couple_id = new.couple_id) >= 2 then
    raise exception 'couple_full' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger couple_members_limit before insert on public.couple_members
  for each row execute function public.limit_couple_size();

-- couple_id und created_by dürfen nach dem Anlegen nicht mehr geändert werden;
-- "who" muss ein Mitglied desselben Paares sein.
create function public.guard_row() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    -- created_by darf nur auf null fallen (passiert automatisch, wenn ein Konto gelöscht wird)
    if new.couple_id is distinct from old.couple_id
       or (new.created_by is distinct from old.created_by and new.created_by is not null) then
      raise exception 'immutable_column' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'INSERT' and new.created_by is distinct from auth.uid() then
    raise exception 'created_by_mismatch' using errcode = 'P0001';
  end if;
  return new;
end $$;

create function public.guard_event_who() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.who is not null and not exists (
       select 1 from public.couple_members where couple_id = new.couple_id and user_id = new.who) then
    raise exception 'who_not_member' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger events_guard before insert or update on public.events
  for each row execute function public.guard_row();
create trigger shopping_guard before insert or update on public.shopping_items
  for each row execute function public.guard_row();
create trigger events_who before insert or update of who on public.events
  for each row execute function public.guard_event_who();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.couples        enable row level security;
alter table public.couple_members enable row level security;
alter table public.couple_invites enable row level security;
alter table public.events         enable row level security;
alter table public.shopping_items enable row level security;

-- Profile: eigenes Profil und das des Partners lesen; nur das eigene schreiben.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or exists (
    select 1 from public.couple_members m where m.user_id = profiles.id and m.couple_id = public.my_couple_id()));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Paar: lesen und "Zusammen seit"/Namen ändern nur als Mitglied. Anlegen/Löschen nur per Funktion.
create policy couples_select on public.couples for select to authenticated using (public.is_member(id));
create policy couples_update on public.couples for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));

create policy members_select on public.couple_members for select to authenticated using (public.is_member(couple_id));

-- Einladungen: nur das eigene Paar sieht seinen Code. Einlösen läuft über join_couple().
create policy invites_select on public.couple_invites for select to authenticated using (public.is_member(couple_id));

create policy events_all on public.events for all to authenticated
  using (public.is_member(couple_id)) with check (public.is_member(couple_id));
create policy shopping_all on public.shopping_items for all to authenticated
  using (public.is_member(couple_id)) with check (public.is_member(couple_id));

-- Rechte ausdrücklich vergeben (unabhängig von der Projekt-Einstellung "Tabellen automatisch freigeben").
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.couples, public.couple_members, public.couple_invites to authenticated;
grant select, insert, update, delete on public.events, public.shopping_items to authenticated;

-- Nicht angemeldete Zugriffe bekommen nichts.
revoke all on all tables in schema public from anon;

-- Spalten, die die App nicht direkt schreiben darf.
revoke insert, update, delete on public.couples from authenticated;
grant update (together_since, names) on public.couples to authenticated;
revoke insert, update, delete on public.couple_members, public.couple_invites from authenticated;

-- ---------------------------------------------------------------------------
-- Funktionen für die App (RPC)
-- ---------------------------------------------------------------------------

create function public.create_couple() returns uuid
language plpgsql security definer set search_path = '' as $$
declare c uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if public.my_couple_id() is not null then raise exception 'already_in_couple' using errcode = 'P0001'; end if;
  insert into public.couples default values returning id into c;
  insert into public.couple_members (couple_id, user_id) values (c, auth.uid());
  return c;
end $$;

-- Neuer Code (ersetzt einen alten). 8 Zeichen ohne verwechselbare Zeichen (kein I, O, 0, 1).
create function public.create_invite() returns text
language plpgsql security definer set search_path = '' as $$
declare
  c uuid := public.my_couple_id();
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  b bytea := extensions.gen_random_bytes(8);
begin
  if c is null then raise exception 'not_in_couple' using errcode = 'P0001'; end if;
  if (select count(*) from public.couple_members where couple_id = c) >= 2 then
    raise exception 'couple_full' using errcode = 'P0001';
  end if;
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  delete from public.couple_invites where couple_id = c;
  insert into public.couple_invites (code, couple_id) values (code, c);
  return code;
end $$;

create function public.join_couple(invite_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare inv public.couple_invites;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if public.my_couple_id() is not null then raise exception 'already_in_couple' using errcode = 'P0001'; end if;
  select * into inv from public.couple_invites
    where code = upper(regexp_replace(coalesce(invite_code, ''), '[^A-Za-z0-9]', '', 'g'))
    for update;
  if not found or inv.expires_at < now() then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;
  insert into public.couple_members (couple_id, user_id) values (inv.couple_id, auth.uid());
  delete from public.couple_invites where code = inv.code;
  return inv.couple_id;
end $$;

-- Paar verlassen. Ist danach niemand mehr im Paar, werden alle Paar-Daten gelöscht.
create function public.leave_couple() returns void
language plpgsql security definer set search_path = '' as $$
declare c uuid := public.my_couple_id();
begin
  if c is null then return; end if;
  update public.events set who = null where couple_id = c and who = auth.uid();
  delete from public.couple_members where user_id = auth.uid();
  if not exists (select 1 from public.couple_members where couple_id = c) then
    delete from public.couples where id = c;
  end if;
end $$;

-- Konto endgültig löschen (Apple-Pflicht, DSGVO Art. 17).
-- Profil und Mitgliedschaft verschwinden per Fremdschlüssel; eigene Einträge in einem
-- weiterbestehenden Paar bleiben für den Partner, ohne Verweis auf das gelöschte Konto.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  perform public.leave_couple();
  delete from auth.users where id = me;
end $$;

-- Supabase gibt neuen Funktionen standardmäßig "anon"-Rechte; die nehmen wir zurück.
revoke execute on all functions in schema public from anon, public;
grant execute on function public.my_couple_id(), public.is_member(uuid), public.create_couple(),
  public.create_invite(), public.join_couple(text), public.leave_couple(), public.delete_my_account()
  to authenticated;

-- ---------------------------------------------------------------------------
-- Live-Sync (Supabase Realtime beachtet RLS)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.events, public.shopping_items, public.couples, public.couple_members;
