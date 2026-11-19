-- Geschenke: Ideen (für den Partner oder andere Menschen) und eigene Wünsche.
--
-- Überraschung bleibt Überraschung: Eine Idee FÜR den Partner (for_user) kann der Partner nicht sehen,
-- nicht ändern und nicht löschen. Das prüft die Datenbank (Row Level Security), nicht nur die App.
-- Ideen für andere (for_name, z. B. "Mama") und Wünsche sehen beide.

create table public.gifts (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  kind       text not null check (kind in ('idea', 'wish')),
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  -- Für wen (nur bei Ideen): ein Mitglied des Paares ODER ein Name
  for_user   uuid references auth.users (id) on delete cascade,
  for_name   text check (for_name is null or char_length(btrim(for_name)) between 1 and 60),
  occasion   text check (occasion is null or char_length(occasion) <= 40),
  link       text check (link is null or char_length(link) <= 500),
  note       text check (note is null or char_length(note) <= 500),
  -- bei Ideen: schon besorgt
  done       boolean not null default false,
  -- Idee, die aus einem Wunsch des Partners entstand ("Besorge ich")
  wish_id    uuid references public.gifts (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint gifts_target check (
    (kind = 'wish' and for_user is null and for_name is null and not done and wish_id is null)
    or (kind = 'idea' and num_nonnulls(for_user, for_name) = 1)
  )
);
create index gifts_couple_created on public.gifts (couple_id, created_at);

-- "Für" muss das andere Mitglied des Paares sein (nicht man selbst); ein Wunsch-Bezug nur auf Wünsche desselben Paares.
create function public.gifts_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- (nur wenn "für" neu gesetzt wird; z. B. beim automatischen Lösen eines Wunsch-Bezugs nicht)
  if new.for_user is not null and (tg_op = 'INSERT' or new.for_user is distinct from old.for_user) and (
       new.for_user = auth.uid()
       or not exists (select 1 from public.couple_members where couple_id = new.couple_id and user_id = new.for_user)) then
    raise exception 'gift_for_invalid' using errcode = 'P0001';
  end if;
  if new.wish_id is not null and (tg_op = 'INSERT' or new.wish_id is distinct from old.wish_id) and not exists (
       select 1 from public.gifts where id = new.wish_id and couple_id = new.couple_id and kind = 'wish') then
    raise exception 'gift_wish_invalid' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.gifts_check() from anon, public;

create trigger gifts_check before insert or update of for_user, wish_id, couple_id on public.gifts
  for each row execute function public.gifts_check();
create trigger gifts_guard before insert or update on public.gifts
  for each row execute function public.guard_row();

alter table public.gifts enable row level security;
create policy gifts_all on public.gifts for all to authenticated
  using (public.is_member(couple_id) and for_user is distinct from auth.uid())
  with check (public.is_member(couple_id) and for_user is distinct from auth.uid());
grant select, insert, update, delete on public.gifts to authenticated;
revoke all on public.gifts from anon;

alter publication supabase_realtime add table public.gifts;
