# Wir Zwei

Die Paar-App von Jan & Vanessa, neu gebaut als echte iPhone-App (React Native + Expo) mit Supabase (EU) als Datenbank.

**Los geht's:** [Anleitung für Windows](docs/ANLEITUNG-WINDOWS.md) · **Datenschutz:** [Übersicht und E2E-Empfehlung](docs/DATENSCHUTZ.md)

## Was schon geht
- Anmelden mit E-Mail + Passwort (Code per E-Mail vorbereitet, sobald eigener E-Mail-Versand steht)
- Paar-Kopplung per Einladungscode (8 Zeichen, 48 Stunden gültig, max. 2 Personen)
- **Start:** Zusammen seit, Jahrestag, Tagesvers, nächste Termine, offene Einkäufe
- **Kalender:** Monatsansicht mit Farbpunkten pro Person, Termine anlegen/bearbeiten/löschen
- **Einkauf:** schnell eintragen („2 l Milch“ erkennt die Menge), abhaken, automatische Emojis
- Live-Sync zwischen beiden Handys
- Einstellungen: Profil, Paar verlassen, Abmelden, **Konto löschen**
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
