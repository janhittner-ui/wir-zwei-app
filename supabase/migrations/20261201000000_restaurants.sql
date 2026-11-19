-- Restaurants: wo ihr wart und wo ihr hinwollt (nur für das Paar sichtbar).
-- Jede Person vergibt eigene Sterne; die App zeigt beide und den Durchschnitt.

create table public.restaurants (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  -- Küche, z. B. "Italienisch" (optional)
  cuisine    text check (cuisine is null or char_length(cuisine) <= 40),
  -- Ort oder Adresse (optional)
  place      text check (place is null or char_length(place) <= 120),
  -- Preis 1–4 (€ bis €€€€), optional
  price      smallint check (price is null or price between 1 and 4),
  note       text check (note is null or char_length(note) <= 500),
  -- wann ihr zuletzt dort wart (null = "wollen wir hin")
  visited_on date check (visited_on is null or visited_on between '1900-01-01' and current_date + 1),
  -- Foto aus dem gemeinsamen Album; wird es gelöscht, bleibt das Restaurant ohne Foto
  photo_id   uuid references public.photos (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint restaurants_photo_visited check (photo_id is null or visited_on is not null)
);
create index restaurants_couple_created on public.restaurants (couple_id, created_at);

-- Das Foto muss aus dem Album desselben Paares stammen.
create function public.restaurants_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.photo_id is not null and (tg_op = 'INSERT' or new.photo_id is distinct from old.photo_id) and not exists (
       select 1 from public.photos where id = new.photo_id and couple_id = new.couple_id) then
    raise exception 'restaurant_photo_invalid' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.restaurants_check() from anon, public;

create trigger restaurants_check before insert or update of photo_id, couple_id on public.restaurants
  for each row execute function public.restaurants_check();
create trigger restaurants_guard before insert or update on public.restaurants
  for each row execute function public.guard_row();

alter table public.restaurants enable row level security;
create policy restaurants_all on public.restaurants for all to authenticated
  using (public.is_member(couple_id)) with check (public.is_member(couple_id));
grant select, insert, update, delete on public.restaurants to authenticated;
revoke all on public.restaurants from anon;

-- ---------------------------------------------------------------------------
-- Sterne: eine Bewertung pro Person und Restaurant. Sehen können beide, ändern nur man selbst.
-- ---------------------------------------------------------------------------
create table public.restaurant_ratings (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade default auth.uid(),
  couple_id     uuid not null references public.couples (id) on delete cascade,
  stars         smallint not null check (stars between 1 and 5),
  updated_at    timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);
create index restaurant_ratings_couple on public.restaurant_ratings (couple_id);

-- Bewertung gehört zum Restaurant desselben Paares, und nur wenn ihr dort wart.
create function public.restaurant_ratings_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.restaurants where id = new.restaurant_id and couple_id = new.couple_id) then
    raise exception 'restaurant_mismatch' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.restaurants where id = new.restaurant_id and visited_on is not null) then
    raise exception 'restaurant_not_visited' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke execute on function public.restaurant_ratings_check() from anon, public;

create trigger restaurant_ratings_check before insert or update on public.restaurant_ratings
  for each row execute function public.restaurant_ratings_check();

alter table public.restaurant_ratings enable row level security;
create policy restaurant_ratings_read on public.restaurant_ratings for select to authenticated
  using (public.is_member(couple_id));
create policy restaurant_ratings_insert on public.restaurant_ratings for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(couple_id));
create policy restaurant_ratings_update on public.restaurant_ratings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(couple_id));
create policy restaurant_ratings_delete on public.restaurant_ratings for delete to authenticated
  using (user_id = auth.uid());
grant select, insert, delete on public.restaurant_ratings to authenticated;
grant update (stars) on public.restaurant_ratings to authenticated;
revoke all on public.restaurant_ratings from anon;

-- Zurück auf "wollen wir hin": Sterne gelten nicht mehr.
create function public.restaurants_unvisit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.visited_on is null and old.visited_on is not null then
    delete from public.restaurant_ratings where restaurant_id = new.id;
  end if;
  return null;
end $$;
revoke execute on function public.restaurants_unvisit() from anon, public;
create trigger restaurants_unvisit after update of visited_on on public.restaurants
  for each row execute function public.restaurants_unvisit();

-- Wer das Paar verlässt, nimmt seine Sterne mit.
create function public.restaurant_ratings_leave() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.restaurant_ratings where user_id = old.user_id and couple_id = old.couple_id;
  return null;
end $$;
revoke execute on function public.restaurant_ratings_leave() from anon, public;
create trigger restaurant_ratings_leave after delete on public.couple_members
  for each row execute function public.restaurant_ratings_leave();

alter publication supabase_realtime add table public.restaurants, public.restaurant_ratings;
