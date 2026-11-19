-- Persönliche Einstellungen ("Anpassen"): Tabs, Startseite, Aussehen, Schalter pro Bereich.
-- Gehören nur einer Person: weder der Partner noch sonst jemand kann sie lesen oder ändern.
-- Inhalt ist ein kleines JSON-Objekt, das die App selbst prüft; die Datenbank begrenzt nur Form und Größe.

create table public.user_prefs (
  user_id    uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  prefs      jsonb not null default '{}'::jsonb
               check (jsonb_typeof(prefs) = 'object' and octet_length(prefs::text) <= 8192),
  updated_at timestamptz not null default now()
);

create trigger user_prefs_touch before update on public.user_prefs
  for each row execute function public.touch_updated_at();

alter table public.user_prefs enable row level security;
create policy user_prefs_own on public.user_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.user_prefs to authenticated;
revoke all on public.user_prefs from anon;
