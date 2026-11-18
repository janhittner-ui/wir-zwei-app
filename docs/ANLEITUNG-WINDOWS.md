# Wir Zwei auf dem iPhone starten (Anleitung für Windows)

Du brauchst etwa 30 Minuten. Am Ende läuft Wir Zwei auf deinem iPhone, zuerst im Demo-Modus, danach mit echter Datenbank.

---

## Teil A: Einmalig vorbereiten

### 1. Node.js installieren
1. Öffne [nodejs.org](https://nodejs.org) und lade die Version mit **LTS** herunter.
2. Installer starten und immer auf **Next** klicken. Die Häkchen so lassen, wie sie sind.

### 2. Git installieren
1. Öffne [git-scm.com/download/win](https://git-scm.com/download/win) und lade **Git for Windows** herunter.
2. Installer starten und ebenfalls immer **Next**.

### 3. Expo-Konto anlegen und Expo Go aufs iPhone
1. Auf [expo.dev/signup](https://expo.dev/signup) ein kostenloses Konto anlegen (Benutzername + Passwort merken). Dieses Konto brauchen wir später auch für den App Store.
2. Im App Store nach **Expo Go** suchen und installieren.
3. Expo Go öffnen, unten auf **Profil** bzw. **Settings** tippen und mit dem gerade angelegten Konto **anmelden**.

---

## Teil B: Die App holen und im Demo-Modus starten

### 4. PowerShell öffnen und einmalig freischalten
Startmenü öffnen, **PowerShell** tippen, Enter. (Ein normales Fenster reicht, „Als Administrator“ ist nicht nötig.)

Windows blockiert in PowerShell anfangs die Befehle `npm` und `npx` (Fehler *„Ausführung von Skripts auf diesem System deaktiviert“*). Einmalig diese Zeile eingeben, Enter, und die Frage mit **J** (bzw. **A** für „Alle“) bestätigen:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Das gilt nur für dein Benutzerkonto und erlaubt Skripte von deinem eigenen Rechner. Danach PowerShell schließen und neu öffnen.

*Alternative ohne Einstellung:* überall `npm.cmd` statt `npm` und `npx.cmd` statt `npx` schreiben, z. B. `npm.cmd install`.

### 5. Projekt herunterladen
Diese Zeilen nacheinander eintippen (oder kopieren) und jeweils mit Enter bestätigen:

```powershell
cd $HOME\Documents
git clone https://github.com/janhittner-ui/wir-zwei-app.git
cd wir-zwei-app
npm install
```

Beim ersten `git clone` öffnet sich ein Fenster zur GitHub-Anmeldung. Melde dich dort an, das Projekt ist privat.
`npm install` dauert ein paar Minuten.

### 6. Am Laptop bei Expo anmelden (einmalig)
```powershell
npx expo login
```
Benutzername und Passwort vom Expo-Konto eingeben (beim Passwort sieht man beim Tippen nichts, das ist normal). Ohne diesen Schritt zeigt Expo Go auf dem iPhone: *„You need to be signed in to Expo Go and Expo CLI“*.

### 7. Starten
```powershell
npx expo start
```

Es erscheint ein großer QR-Code in der PowerShell.

- Falls Windows fragt, ob Node.js im Netzwerk erlaubt sein soll: **Private Netzwerke** erlauben.
- Laptop und iPhone müssen im **gleichen WLAN** sein.

### 8. Auf dem iPhone öffnen
Öffne die normale **Kamera-App** auf dem iPhone, halte sie auf den QR-Code und tippe auf **In Expo Go öffnen**.

Die App startet im **Demo-Modus** (blauer Hinweis oben). Tippe auf **Neu registrieren** und leg ein Konto mit irgendeiner E-Mail und einem Passwort an. Es wird nichts gespeichert.

**Klappt es nicht?** Drücke in der PowerShell `Strg + C` und starte so:
```powershell
npx expo start --tunnel
```
Das funktioniert auch, wenn das WLAN den direkten Weg blockiert.

---

## Teil C: Echte Datenbank einrichten (Supabase)

### 9. Konto und Projekt anlegen
1. Öffne [supabase.com](https://supabase.com) und registriere dich (kostenloser Plan reicht).
2. Klicke auf **New project**.
   - **Name:** `wir-zwei`
   - **Database Password:** auf **Generate** klicken und das Passwort sicher aufheben (z. B. im Passwort-Manager).
   - **Region:** **Central EU (Frankfurt)** wählen. Wichtig für den Datenschutz.
3. **Create new project** klicken und 1 bis 2 Minuten warten.

### 10. Datenbank-Tabellen anlegen
1. Links im Menü **SQL Editor** öffnen.
2. Auf deinem Laptop die Datei `wir-zwei-app\supabase\migrations\20261118000000_init.sql` mit dem Editor öffnen (Rechtsklick → Öffnen mit → Editor), alles markieren (`Strg + A`) und kopieren.
3. Im SQL Editor einfügen und unten rechts auf **Run** klicken.
4. Es sollte **Success. No rows returned** erscheinen.

### 11. E-Mail-Bestätigung ausschalten (nur für die Testphase)
Im kostenlosen Plan kann man die E-Mail-Vorlagen nicht ändern und Supabase verschickt nur sehr wenige E-Mails. Darum meldet ihr euch zum Testen mit **E-Mail und Passwort** an, ganz ohne E-Mail.
1. Links **Authentication** → **Sign In / Providers** (bzw. **Providers**) öffnen.
2. Auf **Email** klicken.
3. Den Schalter **Confirm email** **ausschalten**.
4. Falls es das Feld **Minimum password length** gibt: `8` eintragen.
5. **Save** klicken.

Die E-Mail-Vorlagen unter „Emails“ musst du nicht anfassen. Vor der Veröffentlichung richten wir einen eigenen E-Mail-Versand ein und schalten die Bestätigung wieder ein.

### 12. Zugangsdaten in die App eintragen
1. In Supabase links **Project Settings** (Zahnrad) → **API Keys** öffnen. Den **Publishable key** kopieren (beginnt mit `sb_publishable_`). Falls dort nur „anon key“ steht, nimm den.
2. Unter **Data API** (oder auf der Projekt-Startseite) die **Project URL** kopieren (`https://….supabase.co`).
3. Im Ordner `wir-zwei-app` die Datei `.env.example` kopieren und die Kopie **`.env`** nennen. In PowerShell geht das so:
   ```powershell
   copy .env.example .env
   notepad .env
   ```
4. Die beiden Werte eintragen, speichern, Editor schließen.

Den **Secret key** oder **service_role key** bitte niemals in die App oder in die `.env` eintragen.

### 13. Neu starten
```powershell
npx expo start -c
```
QR-Code wieder mit der Kamera scannen. Der Demo-Hinweis ist jetzt weg. Tippe auf **Neu registrieren** und leg dein Konto mit deiner E-Mail und einem Passwort an (mindestens 8 Zeichen).

### 14. Vanessa dazuholen
1. Du: anmelden, Namen eingeben, **Gemeinsames Konto anlegen**. Auf der Startseite steht ein Code wie `K7MB-Q2XD`.
2. Vanessa: Expo Go installieren, dort mit **deinem** Expo-Konto anmelden, denselben QR-Code scannen (dein Laptop muss dabei laufen), mit ihrer E-Mail und einem eigenen Passwort **neu registrieren**, **Ich habe einen Code** wählen und den Code eingeben.
3. Fertig: Termine und Einkaufsliste erscheinen jetzt sofort auf beiden Handys.

---

## Später: Neue Version holen
Wenn ich etwas am Code geändert habe:
```powershell
cd $HOME\Documents\wir-zwei-app
git pull
npm install
npx expo start -c
```

## Gut zu wissen
- **Solange „Confirm email“ aus ist, prüft niemand, ob eine E-Mail-Adresse echt ist.** Für eure Testphase ist das in Ordnung. Vor der Veröffentlichung kommen eigener E-Mail-Versand, Bestätigung und „Passwort vergessen“ dazu.
- Kostenlose Supabase-Projekte werden nach einer Woche ohne Nutzung pausiert. Auf supabase.com kannst du sie mit einem Klick wieder starten.
- In Expo Go läuft die App nur, solange `npx expo start` auf dem Laptop läuft. Für eine richtige App auf dem Home-Bildschirm (ohne Laptop) bauen wir später mit EAS eine Testversion für TestFlight.
