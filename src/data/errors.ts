import { InputError } from './validate';

/** Übersetzt technische Fehler in kurze deutsche Sätze. */
const KNOWN: Record<string, string> = {
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
  'Email rate limit exceeded': 'Zu viele Codes angefordert. Bitte warte ein paar Minuten.',
  'For security purposes': 'Bitte warte kurz, bevor du einen neuen Code anforderst.',
  'Network request failed': 'Keine Verbindung. Bist du online?',
  'Failed to fetch': 'Keine Verbindung. Bist du online?',
};

export function friendlyError(e: unknown): string {
  if (e instanceof InputError) return e.message;
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  for (const [k, v] of Object.entries(KNOWN)) if (msg.includes(k)) return v;
  return 'Da ist etwas schiefgegangen. Bitte versuch es noch einmal.';
}
