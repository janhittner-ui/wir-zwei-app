-- Paarweise: Testkonto für die Apple-Prüfung (App Review)
--
-- Legt zwei fertig gekoppelte Konten an (Jonas & Lea) und füllt jeden Bereich mit Beispieldaten.
-- Alle Termine hängen am heutigen Tag, die Daten sehen also immer frisch aus.
--
-- Ausführen: im Supabase SQL Editor einfügen und einmal „Run“. Kann beliebig oft wiederholt werden:
-- Das alte Testpaar wird dabei komplett gelöscht und neu angelegt (praktisch nach der Prüfung).
--
-- Das Passwort steht NICHT in dieser Datei (das Repo ist öffentlich), nur sein bcrypt-Hash.
-- Das Passwort selbst steht in App Store Connect unter „App-Prüfungsinformationen“.
--
-- KEINE Migration: Diese Datei gehört absichtlich nicht nach supabase/migrations/.

do $$
declare
  jonas  constant uuid := '9dcb0522-3b9e-43c2-bf1b-2666972afeea';  -- Konto für den Prüfer
  lea    constant uuid := 'e571644a-3a0a-4938-9de5-0cb7eb7ff98b';
  c      constant uuid := 'ab84d52b-3b28-47b3-837e-161265bb066a';  -- Paar (bestimmt auch die Quiz-Fragen)
  pw_hash constant text := '$2a$12$PQblTso3Z2wmKy530Rn36ekII.bdT6hO8ji2daRqCdzkycCc3LIca';
  d      constant date := current_date;
  bd     date;
  trip1  uuid;
  r1     uuid;
  r2     uuid;
begin
  -- ---------------------------------------------------------------- Aufräumen
  delete from public.couples where id = c;
  delete from auth.users
    where id in (jonas, lea) or email in ('apple.pruefung@example.com', 'lea.pruefung@example.com');

  -- ---------------------------------------------------------------- Konten (E-Mail bereits bestätigt)
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values
    ('00000000-0000-0000-0000-000000000000', jonas, 'authenticated', 'authenticated',
     'apple.pruefung@example.com', pw_hash, now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', lea, 'authenticated', 'authenticated',
     'lea.pruefung@example.com', pw_hash, now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), jonas, jonas::text,
     jsonb_build_object('sub', jonas::text, 'email', 'apple.pruefung@example.com', 'email_verified', true),
     'email', now(), now(), now()),
    (gen_random_uuid(), lea, lea::text,
     jsonb_build_object('sub', lea::text, 'email', 'lea.pruefung@example.com', 'email_verified', true),
     'email', now(), now(), now());

  -- ---------------------------------------------------------------- Ab hier als Jonas (wie in der App)
  perform set_config('request.jwt.claim.sub', jonas::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', jonas, 'role', 'authenticated')::text, true);

  insert into public.profiles (id, display_name, color) values (jonas, 'Jonas', 'blue');
  insert into public.couples (id, together_since, names) values (c, d - 2245, 'Jonas & Lea');
  insert into public.profiles (id, display_name, color) values (lea, 'Lea', 'pink');
  insert into public.couple_members (couple_id, user_id, joined_at) values
    (c, jonas, now() - interval '1 minute'),
    (c, lea, now());

  -- Kalender
  insert into public.events (couple_id, title, date, time, note, who) values
    (c, 'Wocheneinkauf', d - 2, '17:00', null, null),
    (c, 'Gemeinsam joggen', d + 1, '07:00', 'Runde um den See', null),
    (c, 'Zahnarzt', d + 2, '10:30', null, lea),
    (c, 'Abendessen bei Lea''s Eltern', d + 4, '18:30', 'Nachtisch mitbringen', null),
    (c, 'Hauskreis', d + 6, '19:30', 'Wir bringen den Salat mit', null),
    (c, 'Fußballtraining', d + 8, '19:00', null, jonas),
    (c, 'Kino', d + 10, '20:15', null, null),
    (c, 'Gottesdienst und Brunch', d + 13, '10:00', null, null),
    (c, 'Auto in die Werkstatt', d + 17, '08:00', 'Winterreifen', jonas);

  -- Geburtstage (rund um heute verteilt)
  bd := d + 5;
  insert into public.birthdays (couple_id, name, month, day, year, note)
    values (c, 'Mama (Lea)', extract(month from bd), extract(day from bd), 1966, 'Mag Orchideen');
  bd := d + 19;
  insert into public.birthdays (couple_id, name, month, day, year, note)
    values (c, 'Tim', extract(month from bd), extract(day from bd), 1994, null);
  bd := d + 47;
  insert into public.birthdays (couple_id, name, month, day, year, note)
    values (c, 'Oma Gisela', extract(month from bd), extract(day from bd), 1941, 'Anrufen!');
  bd := d + 96;
  insert into public.birthdays (couple_id, name, month, day, year, note)
    values (c, 'Lea', extract(month from bd), extract(day from bd), 1997, null);
  bd := d + 160;
  insert into public.birthdays (couple_id, name, month, day, year, note)
    values (c, 'Jonas', extract(month from bd), extract(day from bd), 1995, null);
  bd := d + 230;
  insert into public.birthdays (couple_id, name, month, day, year, note)
    values (c, 'Papa (Jonas)', extract(month from bd), extract(day from bd), 1963, null);

  -- Einkauf
  insert into public.shopping_items (couple_id, text, qty, done) values
    (c, 'Milch', '2 l', false),
    (c, 'Eier', '10', false),
    (c, 'Vollkornbrot', null, false),
    (c, 'Bananen', '6', false),
    (c, 'Tomaten', '500 g', false),
    (c, 'Mozzarella', '2', false),
    (c, 'Basilikum', null, false),
    (c, 'Kaffeebohnen', '1 kg', true),
    (c, 'Spülmittel', null, true);

  -- Notizen
  insert into public.notes (couple_id, title, body, color) values
    (c, 'WLAN für Gäste', E'Name: Zuhause-Gast\nPasswort steht auf dem Router', 'n1'),
    (c, 'Ideen fürs Wochenende', E'Flohmarkt am Samstag\nFahrradtour zum Badesee\nPizza selber machen', 'n2'),
    (c, 'Gebetsanliegen', E'Für Oma Giselas Gesundheit\nFür Tims neue Arbeitsstelle\nDankbar für unsere Wohnung', 'n3'),
    (c, 'Putzplan', E'Bad: Jonas\nKüche: Lea\nStaubsaugen: abwechselnd', 'n4');

  -- Rezepte
  insert into public.recipes (couple_id, title, servings, minutes, ingredients, steps, favorite) values
    (c, 'Spaghetti Bolognese', 4, 45,
     E'400 g Spaghetti\n500 g Hackfleisch\n1 Zwiebel\n2 Zehen Knoblauch\n1 Dose Tomaten\n2 EL Tomatenmark\n1 TL Oregano\nSalz und Pfeffer\nParmesan',
     E'Zwiebel und Knoblauch fein hacken und in Olivenöl anschwitzen.\nHackfleisch dazugeben und krümelig braten.\nTomatenmark kurz mitrösten, dann die Tomaten und Oregano dazugeben.\nAlles 20 Minuten leise köcheln lassen und abschmecken.\nSpaghetti kochen und mit der Soße und Parmesan servieren.',
     true),
    (c, 'Ofengemüse mit Feta', 2, 35,
     E'2 Paprika\n1 Zucchini\n1 rote Zwiebel\n200 g Feta\n3 EL Olivenöl\n1 TL Thymian\nSalz',
     E'Ofen auf 200 Grad vorheizen.\nGemüse in Stücke schneiden, mit Öl, Thymian und Salz mischen.\nAuf einem Blech 20 Minuten backen.\nFeta darüberbröseln und weitere 10 Minuten backen.',
     false),
    (c, 'Pfannkuchen', 2, 20,
     E'250 g Mehl\n500 ml Milch\n3 Eier\n1 Prise Salz\n1 EL Zucker\nButter zum Braten',
     E'Mehl, Milch, Eier, Salz und Zucker zu einem glatten Teig verrühren.\nTeig 10 Minuten ruhen lassen.\nIn einer heißen Pfanne mit etwas Butter dünne Pfannkuchen ausbacken.',
     true);

  -- Reisen
  insert into public.trips (couple_id, title, start_date, end_date, note)
    values (c, 'Wochenende an der Ostsee', d + 30, d + 32, 'Ferienwohnung in Warnemünde, Schlüssel beim Nachbarn')
    returning id into trip1;
  insert into public.trip_items (couple_id, trip_id, text, done) values
    (c, trip1, 'Fahrkarten buchen', true),
    (c, trip1, 'Wanderschuhe', true),
    (c, trip1, 'Regenjacken', false),
    (c, trip1, 'Ladekabel', false),
    (c, trip1, 'Spiele für den Abend', false);
  insert into public.trips (couple_id, title, start_date, end_date, note)
    values (c, 'Sommerurlaub am Gardasee', d + 200, d + 211, 'Campingplatz direkt am See');

  -- Filme & Serien
  insert into public.media (couple_id, title, kind, platform, note, done, rating) values
    (c, 'The Chosen', 'serie', null, 'Staffel 4 weiterschauen', false, null),
    (c, 'Ziemlich beste Freunde', 'film', null, null, true, 5),
    (c, 'Paddington 2', 'film', null, 'Für einen gemütlichen Sonntag', false, null),
    (c, 'Der Herr der Ringe', 'film', null, 'Extended Edition!', true, 4),
    (c, 'Gilmore Girls', 'serie', null, null, false, null);

  -- Geschenke: Jonas' Ideen (Lea sieht die Ideen für sich nicht) und sein Wunsch
  insert into public.gifts (couple_id, kind, title, for_user, for_name, occasion, note) values
    (c, 'idea', 'Silberkette mit Anhänger', lea, null, 'Geburtstag', 'Sie mag schlichten Schmuck'),
    (c, 'idea', 'Fotobuch vom letzten Urlaub', null, 'Mama (Lea)', 'Weihnachten', null),
    (c, 'wish', 'Neue Laufschuhe', null, null, null, 'Größe 44');

  -- Date-Ideen
  insert into public.date_ideas (couple_id, title, category, note, done_on) values
    (c, 'Picknick im Park', 'draussen', 'Decke und Thermoskanne', null),
    (c, 'Zusammen Sushi machen', 'zuhause', null, null),
    (c, 'Museumsbesuch', 'kultur', 'War schön, nächstes Mal mit Führung', d - 20),
    (c, 'Sonnenaufgang anschauen', 'draussen', null, null),
    (c, 'Bowling', 'aktiv', null, d - 45),
    (c, 'Tagesausflug in die Berge', 'ausflug', null, null);

  -- Restaurants
  insert into public.restaurants (couple_id, name, cuisine, place, price, note, visited_on)
    values (c, 'Trattoria da Marco', 'Italienisch', 'Altstadt', 2, 'Die Trüffelpasta probieren', d - 14)
    returning id into r1;
  insert into public.restaurants (couple_id, name, cuisine, place, price, note, visited_on)
    values (c, 'Café Herzstück', 'Café', 'Am Marktplatz', 1, 'Bester Käsekuchen', d - 40)
    returning id into r2;
  insert into public.restaurants (couple_id, name, cuisine, place, price, note, visited_on)
    values (c, 'Sushi Kyoto', 'Japanisch', 'Bahnhofstraße', 3, 'Für den Jahrestag reservieren', null);
  insert into public.restaurant_ratings (restaurant_id, user_id, couple_id, stars) values
    (r1, jonas, c, 5), (r2, jonas, c, 4);

  -- Meilensteine (Hochzeitstag in drei Wochen, damit die Paar-Karte etwas anzeigt)
  insert into public.milestones (couple_id, title, icon, date, note) values
    (c, 'Erstes Date', 'date', d - 2245, 'Eis essen am Fluss'),
    (c, 'Erster Kuss', 'kiss', d - 2231, null),
    (c, 'Erster gemeinsamer Urlaub', 'travel', d - 1880, 'Zelten in Schweden'),
    (c, 'Zusammengezogen', 'home', d - 1320, null),
    (c, 'Verlobung', 'ring', d - 1080, 'Am Strand bei Sonnenuntergang'),
    (c, 'Hochzeit', 'wedding', ((d + 21) - interval '2 years')::date, null);

  -- Quiz: die ersten vier Fragen von Runde 1 (Reihenfolge ergibt sich aus der Paar-ID)
  insert into public.quiz_answers (couple_id, round, question_id, player, answer, created_at) values
    (c, 1, 'gla-1dymuve', jonas, 'Gottes Treue. Sie sagt oft, dass Gott sie nie loslässt.', now() - interval '3 days'),
    (c, 1, 'lus-avu07t', jonas, 'Wer wird Millionär, sie weiß einfach alles über Tiere.', now() - interval '2 days');

  -- Persönliche Einstellungen: Quiz als Tab, damit alles direkt zu sehen ist
  insert into public.user_prefs (user_id, prefs) values
    (jonas, '{"areas":{"order":["kalender","listen","rezepte","quiz","album"],"hidden":["album"]}}');

  -- ---------------------------------------------------------------- Ab hier als Lea
  perform set_config('request.jwt.claim.sub', lea::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', lea, 'role', 'authenticated')::text, true);

  insert into public.notes (couple_id, title, body, color) values
    (c, 'Geschenkideen Hochzeitstag', E'Kochkurs\nWochenende im Hotel\nAltes Fotoalbum digitalisieren', 'n2');

  insert into public.gifts (couple_id, kind, title, for_user, for_name, occasion, note) values
    (c, 'wish', 'Kochkurs für zwei', null, null, null, null),
    (c, 'idea', 'Konzertkarten', jonas, null, 'Hochzeitstag', 'Seine Lieblingsband spielt im Frühjahr');

  insert into public.restaurant_ratings (restaurant_id, user_id, couple_id, stars) values
    (r1, lea, c, 4), (r2, lea, c, 5);

  insert into public.quiz_answers (couple_id, round, question_id, player, answer, created_at) values
    (c, 1, 'gla-qg1ta6', lea, 'Psalm 23, den übt er gerade beim Joggen.', now() - interval '2 days 12 hours'),
    (c, 1, 'tra-qmy93i', lea, 'Einmal zusammen einen Halbmarathon laufen.', now() - interval '1 day');

  -- Zyklus: gehört Lea, für Jonas freigegeben
  insert into public.cycle_settings (user_id, share) values (lea, true);
  insert into public.cycle_periods (user_id, start_date, end_date) values
    (lea, d - 85, d - 81),
    (lea, d - 57, d - 52),
    (lea, d - 29, d - 25);

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Kontrolle: sollte zwei Zeilen zeigen (Jonas und Lea im selben Paar)
select p.display_name, u.email, m.couple_id
from public.couple_members m
join public.profiles p on p.id = m.user_id
join auth.users u on u.id = m.user_id
where m.couple_id = 'ab84d52b-3b28-47b3-837e-161265bb066a';
