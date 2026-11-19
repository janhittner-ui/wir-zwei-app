/**
 * Fragen für das Paar-Quiz: 1000 Fragen in 8 Themen (je 125), in src/lib/quiz-fragen/.
 *
 * So änderst du sie:
 * - Eine Frage ergänzen: einfach eine neue Zeile in die passende Datei schreiben.
 * - Eine Frage löschen oder umformulieren geht auch. Bereits beantwortete alte Fragen zeigt die App
 *   dann als „Frage aus einer älteren Version“ an.
 * - {partner} wird durch den Namen des Partners ersetzt (der Person, die gerade NICHT dran ist),
 *   {ich} durch den Namen der Person, die dran ist.
 *
 * Die id jeder Frage ergibt sich aus Thema und Text (z. B. „vor-1x2abc“). Gleicher Text = gleiche id,
 * deshalb spielt die Reihenfolge in den Dateien keine Rolle.
 */
import { ALLTAG } from './quiz-fragen/alltag';
import { BEZIEHUNG } from './quiz-fragen/beziehung';
import { ERINNERUNGEN } from './quiz-fragen/erinnerungen';
import { GLAUBE } from './quiz-fragen/glaube';
import { KINDHEIT } from './quiz-fragen/kindheit';
import { LUSTIG } from './quiz-fragen/lustig';
import { TRAEUME } from './quiz-fragen/traeume';
import { VORLIEBEN } from './quiz-fragen/vorlieben';

export type QuizTopic = 'vor' | 'eri' | 'kin' | 'tra' | 'all' | 'bez' | 'lus' | 'gla';

export const QUIZ_TOPICS: Record<QuizTopic, { label: string; emoji: string }> = {
  vor: { label: 'Vorlieben', emoji: '💛' },
  eri: { label: 'Erinnerungen', emoji: '📸' },
  kin: { label: 'Kindheit', emoji: '🧸' },
  tra: { label: 'Träume', emoji: '✨' },
  all: { label: 'Alltag', emoji: '☕' },
  bez: { label: 'Wir zwei', emoji: '❤️' },
  lus: { label: 'Zum Lachen', emoji: '😄' },
  gla: { label: 'Glaube', emoji: '🙏' },
};

export interface QuizQuestion {
  id: string;
  text: string;
  topic?: QuizTopic;
}

/** Kurzer, stabiler Name aus dem Text (FNV-1a, Base 36) */
function textId(text: string) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return h.toString(36);
}

const SOURCES: [QuizTopic, string[]][] = [
  ['vor', VORLIEBEN], ['eri', ERINNERUNGEN], ['kin', KINDHEIT], ['tra', TRAEUME],
  ['all', ALLTAG], ['bez', BEZIEHUNG], ['lus', LUSTIG], ['gla', GLAUBE],
];

export const QUIZ_QUESTIONS: QuizQuestion[] = SOURCES.flatMap(([topic, list]) =>
  list.map((text) => ({ id: `${topic}-${textId(text.trim())}`, text: text.trim(), topic })));
