-- Fotoalbum: Fotos liegen in einem PRIVATEN Speicher-Bucket "photos" (nur das Paar kommt heran),
-- in der Tabelle "photos" stehen nur Bildunterschrift, Größe, wer und wann.
-- Dateipfad: <couple_id>/<photo_id>.jpg – wird von der Datenbank selbst gebildet und kann nicht gefälscht werden.

create table public.photos (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  path       text generated always as (couple_id::text || '/' || id::text || '.jpg') stored,
  caption    text check (caption is null or char_length(caption) <= 200),
  width      integer not null check (width between 1 and 10000),
  height     integer not null check (height between 1 and 10000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index photos_couple_created on public.photos (couple_id, created_at desc);

create trigger photos_guard before insert or update on public.photos
  for each row execute function public.guard_row();

alter table public.photos enable row level security;
create policy photos_all on public.photos for all to authenticated
  using (public.is_member(couple_id)) with check (public.is_member(couple_id));
grant select, insert, delete on public.photos to authenticated;
grant update (caption) on public.photos to authenticated;
revoke all on public.photos from anon;

alter publication supabase_realtime add table public.photos;

-- Speicher: privat, nur JPEG, höchstens 5 MB pro Bild (die App verkleinert vorher auf ca. 0,3 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- Zugriff nur auf den Ordner des eigenen Paares: erster Ordner im Pfad = eigene couple_id.
create policy photos_read on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.my_couple_id()::text);
-- Hochladen nur, wenn es den passenden Eintrag im Album schon gibt (keine "versteckten" Dateien).
create policy photos_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos' and (storage.foldername(name))[1] = public.my_couple_id()::text
    and exists (select 1 from public.photos p where p.path = name)
  );
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.my_couple_id()::text);
