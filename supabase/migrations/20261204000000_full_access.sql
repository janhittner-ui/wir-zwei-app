-- Vollzugang: Jan kann einzelne Paare (Familie, Freunde, Tester) dauerhaft und gratis für alles
-- freischalten, auch wenn es später ein Abo gibt.
--
-- Sicherheit:
--  * Die Spalte full_access kann die App LESEN (damit sie weiß, was freigeschaltet ist),
--    aber NICHT ändern: Paar-Mitglieder dürfen an couples nur together_since und names ändern
--    (Spaltenrechte aus der Grundmigration), neue Spalten sind damit automatisch gesperrt.
--  * Die Admin-Funktionen liegen im eigenen Schema "admin", das die App-Schnittstelle nicht kennt,
--    und nur der Datenbank-Besitzer (Supabase SQL Editor) darf sie ausführen.
--
-- Freischalten im Supabase SQL Editor (E-Mail einer der beiden Personen):
--   select admin.vollzugang('mama@example.com', true);
-- Wieder wegnehmen:
--   select admin.vollzugang('mama@example.com', false);
-- Liste aller freigeschalteten Paare:
--   select * from admin.vollzugang_liste();

alter table public.couples add column full_access boolean not null default false;
comment on column public.couples.full_access is
  'Vollzugang: alle Abo-Funktionen dauerhaft gratis. Nur per admin.vollzugang() setzen, nie aus der App.';

-- Zur Sicherheit noch einmal ausdrücklich: Nutzer dürfen nur diese zwei Spalten ändern.
revoke insert, update, delete on public.couples from authenticated, anon;
grant update (together_since, names) on public.couples to authenticated;

create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

create function admin.vollzugang(e_mail text, an boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid;
  c   uuid;
begin
  select u.id into uid from auth.users u where lower(u.email) = lower(btrim(e_mail));
  if uid is null then
    return 'Kein Konto mit der E-Mail ' || e_mail || ' gefunden.';
  end if;
  select m.couple_id into c from public.couple_members m where m.user_id = uid;
  if c is null then
    return 'Das Konto ' || e_mail || ' ist noch mit keinem Partner gekoppelt (kein Paar). Erst in der App ein Paar anlegen.';
  end if;
  update public.couples set full_access = an where id = c;
  return case when an then 'Vollzugang AN für das Paar von ' || e_mail
              else 'Vollzugang AUS für das Paar von ' || e_mail end;
end $$;

create function admin.vollzugang_liste()
returns table (paar_id uuid, namen text, mitglieder text, seit timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.names,
         (select string_agg(u.email, ', ' order by u.email)
            from public.couple_members m join auth.users u on u.id = m.user_id
           where m.couple_id = c.id),
         c.created_at
    from public.couples c
   where c.full_access
   order by c.created_at
$$;

revoke all on function admin.vollzugang(text, boolean) from public, anon, authenticated;
revoke all on function admin.vollzugang_liste() from public, anon, authenticated;
