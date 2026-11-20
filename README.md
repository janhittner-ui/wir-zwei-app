# CoPlanning

Die Paar-App von Jan & Vanessa (früher „Wir Zwei“), neu gebaut als echte iPhone-App (React Native + Expo) mit Supabase (EU) als Datenbank.

**Los geht's:** [Anleitung für Windows](docs/ANLEITUNG-WINDOWS.md) · **Datenschutz:** [Übersicht und E2E-Empfehlung](docs/DATENSCHUTZ.md)

## Was schon geht
- Anmelden mit E-Mail + Passwort (Code per E-Mail vorbereitet, sobald eigener E-Mail-Versand steht)
- Paar-Kopplung per Einladungscode (8 Zeichen, 48 Stunden gültig, max. 2 Personen)
- **Start:** Zusammen seit, Jahrestag, Tagesvers, nächste Termine, offene Einkäufe
- **Kalender:** Monatsansicht mit Farbpunkten pro Person, Termine anlegen/bearbeiten/löschen
- **Geburtstage:** Liste mit Suche, nächster Geburtstag auf der Startseite, orange Punkte im Kalender, „wird 30“ bei bekanntem Jahr, 29. Februar wird in Nicht-Schaltjahren am 28. gefeiert
- **Notizen:** farbige Zettel (gelb, grün, blau, rosa), Suche ab 4 Notizen, „zuletzt geändert von“, live auf beiden Handys
- **Essen** (Tab, früher „Rezepte“) mit zwei Reitern.
- **Restaurants:** „Wollen wir hin“ und „Waren wir“; Küche, Ort, Preis (€–€€€€), Notiz, Foto aus dem Album; jede Person vergibt eigene Sterne, angezeigt mit Durchschnitt; Wunsch-Restaurants mit einem Tipp auf die Date-Liste
- **Rezepte:** Reiter mit Suche und Favoriten; Portionen umrechnen (Mengen wie „1/2 TL“ oder „1½ l“ werden erkannt), Zutaten mit einem Tipp auf die Einkaufsliste (ohne Doppelte), Kochmodus Schritt für Schritt mit großer Schrift, Bildschirm bleibt an
- **Reisen** (Kalender, Reiter „Reisen“): geplante Reisen mit Countdown, Wunschziele ohne Datum, vergangene Reisen; je Reise eine gemeinsame Packliste (abhaken, wischen zum Löschen, Vorschläge); nächste Reise auf der Startseite
- **Album** (eigener Tab): gemeinsame Fotos, nach Monat sortiert; bis zu 20 auf einmal aus der Mediathek oder direkt mit der Kamera; verkleinert und ohne Aufnahmeort gespeichert; großes Ansehen mit Wischen und Zoomen, Bildunterschrift, Löschen. Privater Speicher, Links laufen nach einer Stunde ab
- **Listen** (Tab): Reiter Einkauf, Notizen, **Geschenke** (Ideen nach Person, Ideen für den Partner bleiben vor ihm geheim – von der Datenbank geprüft; eigene Wünsche, „Besorge ich“ legt eine geheime Idee an) und **Filme & Serien** (gemeinsame Watchlist mit Filter Film/Serie, „Wo läuft es?“, abhaken wenn gesehen, 1–5 Sterne, wischen zum Löschen) und **Dates** (gemeinsame Date-Ideen mit Art, Vorschläge zum Antippen, „Zufälliges Date“, abhaken wenn gemacht, dann mit Datum, Notiz und Foto aus dem Album; „In den Kalender“)
- **Einkauf:** schnell eintragen („2 l Milch“ erkennt die Menge), abhaken, automatische Emojis
- Live-Sync zwischen beiden Handys
- Einstellungen: Profil, Paar verlassen, Abmelden, **Konto löschen**
- **Zyklus** (Kalender, Reiter „Zyklus“): nur Beginn/Ende der Periode eintragen, Vorhersage nächste Periode, Eisprung und fruchtbare Tage (Schätzung, keine Verhütungsmethode), dezente Markierungen im Monat, optional Startseiten-Karte; privat, bis man selbst „teilen“ einschaltet (vom Server geprüft)
- **Meilensteine** (Tipp auf die Paar-Karte der Startseite): Zusammen seit in Tagen/Wochen/Monaten, kommende besondere Tage (Jahrestag, runde Zahlen wie „1.000 Tage“, Hochzeitstag und Jahrestage eigener Meilensteine), Zeitleiste mit Vorlagen (erstes Date, Verlobung, Hochzeit, …), Notiz und Foto aus dem Album; der nächste besondere Tag steht direkt auf der Paar-Karte
- **Quiz** (Bereich, standardmäßig über „Weitere Bereiche“ auf der Startseite, in „Anpassen“ als Tab wählbar): Spiel für zwei, abwechselnd bekommt einer eine Frage über den Partner, antwortet oder überspringt, dann „Nächste Frage“; klappt an einem Handy oder live auf beiden; 1000 Fragen in 8 Themen (Vorlieben, Erinnerungen, Kindheit, Träume, Alltag, Wir zwei, Zum Lachen, Glaube), Runden mit 20 gemischten Fragen ohne Wiederholung, bis alle dran waren; „Eure Antworten“. Fragen ändern: `src/lib/quiz-fragen/`
- **Anpassen** (Einstellungen → Anpassen, auch unten auf der Startseite), pro Person gespeichert: Akzentfarbe, Hell/Dunkel/Auto, Bereiche in der Tab-Leiste wählen und sortieren (ausgeblendete Bereiche bleiben über die Startseite erreichbar), Karten der Startseite ein-/ausblenden und sortieren, Paar-Bild aus dem Album, Listen-Reiter, Geburtstage im Kalender, Rezept-Sortierung, Fotos pro Reihe
- Hell/Dunkel, Schriften und Farben wie in Wir Zwei v40
- Demo-Modus ohne Server (startet automatisch, solange keine `.env` existiert)

## Aufbau
```
src/app/            Bildschirme (Expo Router)
src/data/store.ts   Die eine Schnittstelle zu den Daten
src/data/supabase-store.ts   Supabase-Anbindung
src/data/memory-store.ts     Strenge Nachbildung der DB (Demo + Tests)
src/data/validate.ts         Eingabeprüfungen (gleich wie die DB-Regeln)
src/lib/            Datum, Tagesvers, Einkaufs-Emojis
src/theme/          Farben und Schriften
supabase/migrations Datenbank inkl. Row Level Security
tests/              npm test (DB-Regeln + App-Logik)
```

## Befehle
```
npm start           App starten (QR-Code für Expo Go)
npm test            alle Tests
npm run typecheck   TypeScript prüfen
```
