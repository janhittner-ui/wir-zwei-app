-- Rezepte: gemeinsame Rezeptsammlung des Paares (nur für das Paar sichtbar).
-- Zutaten und Schritte sind einfacher Text, je eine Zeile pro Zutat bzw. Schritt.

create table public.recipes (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  servings    integer not null default 2 check (servings between 1 and 99),
  minutes     integer check (minutes is null or minutes between 1 and 1440),
  ingredients text not null default '' check (char_length(ingredients) <= 5000),
  steps       text not null default '' check (char_length(steps) <= 10000),
  source      text check (source is null or char_length(source) <= 500),
  favorite    boolean not null default false,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index recipes_couple_title on public.recipes (couple_id, title);

create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();
create trigger recipes_guard before insert or update on public.recipes
  for each row execute function public.guard_row();

alter table public.recipes enable row level security;
create policy recipes_all on public.recipes for all to authenticated
  using (public.is_member(couple_id)) with check (public.is_member(couple_id));

grant select, insert, update, delete on public.recipes to authenticated;
revoke all on public.recipes from anon;

alter publication supabase_realtime add table public.recipes;
