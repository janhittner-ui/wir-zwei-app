# Datenschutz in Paarweise

Stand: 18.11.2026. Das ist eine technische Übersicht, keine Rechtsberatung. Datenschutzerklärung und Impressum
schreiben wir vor der Veröffentlichung gesondert (z. B. mit einem Generator wie e-recht24 oder mit anwaltlicher Hilfe).

## Was die App speichert

| Daten | Wozu | Wo |
|---|---|---|
| E-Mail-Adresse, Passwort (nur als sicherer Hash) | Anmeldung | Supabase Auth (Frankfurt) |
| Vorname, Farbe (blau/rosa) | Zeigen, wer was eingetragen hat | Tabelle `profiles` |
| „Zusammen seit“, Paar-Namen | Startseite | Tabelle `couples` |
| Termine (Titel, Datum, Uhrzeit, Notiz, für wen) | Kalender | Tabelle `events` |
| Einkaufseinträge | Einkaufsliste | Tabelle `shopping_items` |

Nicht gespeichert: Passwörter im Klartext, Telefonnummer, Standort, Kontakte, Geräte-IDs, Werbe-IDs, Nutzungsstatistiken.

## Was die App bewusst nicht macht
- **Kein Tracking, keine Analyse-Tools, keine Werbung, keine Crash-Reporter von Drittanbietern.** Es ist kein solches Paket installiert.
- Keine Weitergabe an Dritte außer dem Hoster (Supabase) als Auftragsverarbeiter.
- Keine Fonts oder Bilder von fremden Servern zur Laufzeit: die Schriften sind in die App eingebaut.

## Wie die Daten geschützt sind
- **Row Level Security** in der Datenbank: Jede Abfrage wird auf dem Server geprüft. Ein Konto sieht nur sein eigenes Paar, selbst wenn
  die App einen Fehler hätte oder jemand die App nachbaut. Das ist mit automatischen Tests abgesichert (`npm run test:db`).
- Paar-Kopplung nur über einen 8-stelligen Einladungscode, der nach 48 Stunden abläuft und nur einmal gilt. Ein Paar hat höchstens zwei Mitglieder.
- Verbindung immer verschlüsselt (HTTPS/TLS), Daten beim Hoster verschlüsselt gespeichert (Encryption at Rest).
- Die Anmeldung liegt auf dem iPhone im **Schlüsselbund** (nur dieses Gerät, nicht im Backup auf andere Geräte übertragbar).
- In der App steckt nur der öffentliche „publishable key“. Der geheime Schlüssel wird nirgends in der App verwendet.

## Löschen (DSGVO Art. 17, Apple-Richtlinie 5.1.1(v))
- **Einstellungen → Konto löschen** löscht sofort und endgültig: Konto, E-Mail, Profil.
- Gemeinsame Einträge bleiben beim Partner, aber ohne Verweis auf das gelöschte Konto.
- Ist niemand mehr im Paar, werden alle Paar-Daten mitgelöscht.
- **Paar verlassen** funktioniert genauso, nur ohne das Konto zu löschen.

## Empfehlung: Ende-zu-Ende-Verschlüsselung (E2E)

**Meine Empfehlung: für den Start keine E2E-Verschlüsselung, aber so gebaut, dass sie später möglich ist.**

Warum nicht gleich:
1. **Datenverlust-Risiko.** Bei E2E liegt der Schlüssel nur auf euren Handys. Verlieren beide ihr Handy (oder installiert ihr neu), sind alle Daten weg. Für eine Paar-App mit Jahren an Erinnerungen ist das ein echtes Risiko, und Support kann dann nicht helfen.
2. **Deutlich mehr Aufwand und Fehlerquellen**: Schlüsselaustausch beim Koppeln, Schlüssel-Backup, Wiederherstellung, neues Handy. Das ist der Teil, an dem solche Apps am häufigsten scheitern.
3. **Für die DSGVO nicht nötig.** Server in der EU, Zugriffsschutz pro Paar (RLS), Verschlüsselung bei Übertragung und Speicherung, Datenminimierung und Löschfunktion erfüllen die Anforderungen für diese Art Daten.
4. Funktionen wie Suche, Erinnerungen per Push oder geteilte Fotos werden mit E2E aufwendiger.

Wann es sich lohnt: wenn ihr später sehr persönliche Inhalte anbietet (z. B. Tagebuch, Gebetsanliegen, private Notizen). Dann kann man **gezielt nur diese Bereiche** E2E-verschlüsseln, mit Wiederherstellungsschlüssel zum Ausdrucken. Die App spricht nur über eine Schnittstelle (`src/data/store.ts`) mit Daten, deshalb geht das später ohne die Bildschirme umzubauen. Das wäre auch ein gutes Premium- und Vertrauensargument.

## Vor der Veröffentlichung noch zu erledigen
- [ ] Mit Supabase den **Auftragsverarbeitungsvertrag (DPA/AVV)** abschließen (im Dashboard unter Organization → Legal/Documents).
      Hinweis: Supabase ist ein US-Unternehmen; die Daten liegen in Frankfurt, der Vertrag enthält EU-Standardvertragsklauseln. Das in der Datenschutzerklärung nennen.
- [ ] **Eigenen E-Mail-Versand** einrichten (SMTP eines EU-Anbieters, z. B. Brevo oder Mailjet, beide Frankreich) statt des Supabase-Testversands. Ebenfalls AVV abschließen.
      Danach: „Confirm email“ wieder einschalten, Vorlagen auf Deutsch, „Passwort vergessen“ einbauen, optional Anmeldung per Code (`EXPO_PUBLIC_EMAIL_CODES=1`, Vorlage mit `{{ .Token }}`).
- [ ] Datenschutzerklärung + Impressum als Webseite, Link in der App (Einstellungen) und im App Store.
- [ ] Apple **App Privacy** („Datenschutz-Etiketten“) ausfüllen, voraussichtlich:
  - Kontaktinformationen → E-Mail-Adresse: *mit dir verknüpft*, Zweck *App-Funktionalität*, **kein Tracking**
  - Benutzerinhalte → Sonstige Benutzerinhalte: *mit dir verknüpft*, Zweck *App-Funktionalität*, **kein Tracking**
  - Alles andere: nicht erhoben
- [ ] Für die Apple-Prüfung ein Test-Konto (E-Mail + Passwort) anlegen und in App Store Connect hinterlegen.
