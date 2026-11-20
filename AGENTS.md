This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## CoPlanning (früher Paarweise, davor Wir Zwei): Projektregeln
- App-Name nur in `src/config.ts` und `app.json`. Repo heißt weiterhin wir-zwei-app.
- Sprache der App und der Doku: Deutsch, einfach erklärt. Jan arbeitet unter Windows ohne Mac, testet per Expo Go auf dem iPhone.
- Datenzugriff nur über `src/data/store.ts` (DataStore). Jede neue Funktion in `SupabaseStore` UND `MemoryStore` bauen, Prüfungen in `validate.ts` spiegeln die DB-Constraints.
- Jede DB-Änderung als neue Datei in `supabase/migrations/`, mit RLS, und in `tests/db.test.ts` testen (PGlite mit nachgebauter Supabase-Umgebung). Vor jedem Commit: `npm test` und `npm run typecheck`.
- Optionale Ladevorgänge (Zusatzinfos) in try/catch, sie dürfen Hauptdaten nie blockieren.
- Datenschutz: keine Tracking-, Analyse- oder Werbe-Pakete. Nur der publishable key in der App.
- `docs.expo.dev` ist aus der Cloud-Umgebung nicht erreichbar; Paketversionen aus `node_modules/expo/bundledNativeModules.json` nehmen (`npx expo install` braucht Netz zu api.expo.dev).
- Design: an iOS orientieren (Apple Human Interface Guidelines), einfach bedienbar, schlicht und ansprechend. Native Muster bevorzugen (Wischen zum Löschen, Aktionsblätter, Systempicker).
