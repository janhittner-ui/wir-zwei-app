/** Nachgebaute Supabase-Umgebung für die PGlite-Datenbanktests (Rollen, auth, storage). */
export const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create schema extensions;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth, extensions, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  -- Schlimmster Fall: anon bekäme automatisch alles, authenticated nichts. Die Migration muss beides regeln.
  alter default privileges in schema public grant all on tables to anon;
  alter default privileges in schema public grant execute on functions to anon;
  create publication supabase_realtime;
  -- Speicher (Storage) wie bei Supabase: Buckets, Objekte mit RLS, foldername()
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text not null, owner uuid default auth.uid(), unique (bucket_id, name));
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to anon, authenticated;
  grant execute on function storage.foldername(text) to anon, authenticated;
`;
