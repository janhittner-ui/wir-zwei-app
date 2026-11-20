-- Fotos von Rezepten und Restaurants gehören nicht ins Album.
-- Sie liegen weiter sicher im privaten Speicher des Paares, werden aber mit album = false markiert
-- und im Album nicht angezeigt (und zählen später nicht zur Gratis-Grenze des Albums).
alter table public.photos add column album boolean not null default true;
create index photos_couple_album on public.photos (couple_id, album, created_at desc);
