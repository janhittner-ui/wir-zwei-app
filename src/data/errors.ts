import { InputError } from './validate';

/** Übersetzt technische Fehler in kurze deutsche Sätze. */
const KNOWN: Record<string, string> = {
  gift_for_invalid: 'Ideen kannst du nur für deinen Schatz oder für andere Menschen anlegen.',
  gift_wish_invalid: 'Diesen Wunsch gibt es nicht mehr.',
  restaurant_photo_invalid: 'Dieses Foto gibt es nicht mehr im Album.',
  restaurant_mismatch: 'Dieses Restaurant gibt es nicht mehr.',
  restaurant_not_visited: 'Bewerten könnt ihr, sobald ihr dort wart.',
  date_photo_invalid: 'Dieses Foto gibt es nicht mehr im Album.',
  milestone_photo_invalid: 'Dieses Foto gibt es nicht mehr im Album.',
  quiz_once: 'Diese Frage wurde gerade schon beantwortet.',
  quiz_player_invalid: 'Mitspielen könnt nur ihr beide.',
  prefs_invalid: 'Die Einstellungen konnten nicht gespeichert werden.',
  trip_mismatch: 'Diese Reise gibt es nicht mehr.',
  trips_dates: 'Die Reisedaten passen nicht zusammen.',
  invalid_code: 'Dieser Einladungscode stimmt nicht oder ist abgelaufen.',
  couple_full: 'Ihr seid schon zu zweit.',
  already_in_couple: 'Du bist schon mit jemandem verbunden.',
  not_in_couple: 'Du bist noch mit niemandem verbunden.',
  not_authenticated: 'Bitte melde dich neu an.',
  who_not_member: 'Diese Person gehört nicht zu eurem Paar.',
  'Invalid login credentials': 'E-Mail oder Passwort stimmt nicht.',
  'User already registered': 'Für diese E-Mail gibt es schon ein Konto. Bitte melde dich an.',
  'Email not confirmed': 'Bitte bestätige zuerst deine E-Mail über den Link, den du bekommen hast.',
  'Password should be': 'Das Passwort ist zu schwach. Bitte nimm mindestens 8 Zeichen.',
  weak_password: 'Das Passwort ist zu schwach. Bitte nimm mindestens 8 Zeichen.',
  'Signups not allowed': 'Neue Konten sind gerade nicht erlaubt.',
  'Token has expired or is invalid': 'Der Code stimmt nicht oder ist abgelaufen.',
  'rate limit exceeded': 'Zu viele Versuche in kurzer Zeit. Bitte warte ein paar Minuten.',
  'Database error saving new user': 'Die Datenbank konnte das Konto nicht anlegen.',
  'For security purposes': 'Bitte warte kurz, bevor du einen neuen Code anforderst.',
  'Network request failed': 'Keine Verbindung. Bist du online?',
  'Failed to fetch': 'Keine Verbindung. Bist du online?',
};

function describe(e: unknown): string {
  if (e instanceof Error) {
    const x = e as Error & { code?: unknown; status?: unknown };
    const extra = [x.code, x.status].filter((v) => v !== undefined && v !== null && v !== '').join(', ');
    return extra ? `${e.message} (${extra})` : e.message;
  }
  if (typeof e === 'object' && e && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}

export function friendlyError(e: unknown): string {
  if (e instanceof InputError) return e.message;
  const msg = describe(e);
  const low = msg.toLowerCase();
  for (const [k, v] of Object.entries(KNOWN)) if (low.includes(k.toLowerCase())) return v;
  if (low.includes('invalid api key') || low.includes('no api key') || low.includes('apikey')) {
    return 'Die App kann sich nicht mit Supabase verbinden: Der Schlüssel in der Datei .env stimmt nicht.';
  }
  if (low.includes('json') || low.includes('unexpected token') || low.includes('404')) {
    return 'Die App kann sich nicht mit Supabase verbinden: Die Adresse (URL) in der Datei .env stimmt vermutlich nicht.';
  }
  // Unbekannter Fehler: echten Text mitzeigen, damit man die Ursache findet.
  console.warn('Fehler:', e);
  return `Da ist etwas schiefgegangen. Technischer Hinweis: ${msg.slice(0, 200)}`;
}
