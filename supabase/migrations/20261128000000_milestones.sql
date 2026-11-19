-- Meilensteine: eure besonderen Tage (erstes Date, Verlobung, Hochzeit, erste Wohnung, …),
-- als Zeitleiste hinter der Paar-Karte auf der Startseite. Optional mit einem Foto aus eurem Album.

create table public.milestones (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 80),
  icon       text not null default 'heart'
               check (icon in ('heart', 'date', 'kiss', 'travel', 'home', 'ring', 'wedding', 'baby', 'star')),
  date       date not null check (date between '1900-01-01' and current_date + 3650),
  note       text check (note is null or char_length(note) <= 500),
  -- Foto aus dem gemeinsamen Album; wird es gelöscht, bleibt der Meilenstein ohne Foto
  photo_id   uuid references public.photos (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index milestones_couple_date on public.milestones (couple_id, date);

-- Das Foto muss aus dem Album desselben Paares stammen.
create function public.milestones_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.photo_id is not null and (tg_op = 'INSERT' or new.photo_id is distinct from old.photo_id) and not exists (
       select 1 from public.photos where id = new.photo_id and couple_id = new.couple_id) then
    raise exception 'milestone_photo_invalid' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.milestones_check() from anon, public;

create trigger milestones_check before insert or update of photo_id, couple_id on public.milestones
  for each row execute function public.milestones_check();
create trigger milestones_guard before insert or update on public.milestones
  for each row execute function public.guard_row();

alter table public.milestones enable row level security;
create policy milestones_all on public.milestones for all to authenticated
  using (public.is_member(couple_id)) with check (public.is_member(couple_id));
grant select, insert, update, delete on public.milestones to authenticated;
revoke all on public.milestones from anon;

alter publication supabase_realtime add table public.milestones;
