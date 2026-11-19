-- Filme & Serien: gemeinsame Watchlist des Paares (nur für das Paar sichtbar).

create table public.media (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  kind       text not null default 'film' check (kind in ('film', 'serie')),
  -- wo es läuft, z. B. "Netflix" oder "Kino" (optional)
  platform   text check (platform is null or char_length(platform) <= 40),
  note       text check (note is null or char_length(note) <= 500),
  done       boolean not null default false,
  -- gemeinsame Bewertung 1–5 Sterne, nur wenn gesehen
  rating     smallint check (rating is null or rating between 1 and 5),
  done_at    timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint media_rating_done check (rating is null or done)
);
create index media_couple_created on public.media (couple_id, created_at);

-- "Gesehen am" setzt die Datenbank selbst
create function public.media_done_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.done and (tg_op = 'INSERT' or not old.done) then
    new.done_at := now();
  elsif not new.done then
    new.done_at := null;
    new.rating := null;
  end if;
  return new;
end $$;
revoke execute on function public.media_done_at() from anon, public;

create trigger media_done before insert or update on public.media
  for each row execute function public.media_done_at();
create trigger media_guard before insert or update on public.media
  for each row execute function public.guard_row();

alter table public.media enable row level security;
create policy media_all on public.media for all to authenticated
  using (public.is_member(couple_id)) with check (public.is_member(couple_id));
grant select, insert, update, delete on public.media to authenticated;
revoke all on public.media from anon;

alter publication supabase_realtime add table public.media;
