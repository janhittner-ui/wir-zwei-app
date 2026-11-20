-- Rezepte: Foto vom Gericht und Mahlzeit (Frühstück, Mittagessen, Abendessen).
-- Das Foto liegt wie bei Restaurants im gemeinsamen Album (privater Speicher);
-- wird es dort gelöscht, bleibt das Rezept einfach ohne Foto.

alter table public.recipes
  add column photo_id uuid references public.photos (id) on delete set null,
  -- leer = keine Angabe; ein Gericht kann zu mehreren Mahlzeiten passen
  add column meals text[] not null default '{}'
    check (meals <@ array['fruehstueck', 'mittag', 'abend']::text[]);

-- Das Foto muss aus dem Album desselben Paares stammen.
create function public.recipes_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.photo_id is not null and (tg_op = 'INSERT' or new.photo_id is distinct from old.photo_id) and not exists (
       select 1 from public.photos where id = new.photo_id and couple_id = new.couple_id) then
    raise exception 'recipe_photo_invalid' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.recipes_check() from anon, public;

create trigger recipes_check before insert or update of photo_id, couple_id on public.recipes
  for each row execute function public.recipes_check();
