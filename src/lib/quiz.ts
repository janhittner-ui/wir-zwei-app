/**
 * Spielregeln des Paar-Quiz: Wer ist dran, welche Frage kommt als Nächstes, ist die Runde geschafft?
 * Beide Handys rechnen mit denselben Daten dasselbe aus, deshalb sehen beide immer dieselbe Frage.
 */
import type { QuizAnswer } from '@/data/types';

import { QUIZ_QUESTIONS, type QuizQuestion } from './quiz-questions';

/** Fragen pro Runde */
export const ROUND_SIZE = 20;

/** Gemischte Reihenfolge aller Fragen, fest pro Paar (und Durchgang durch alle Fragen) */
function shuffled(seed: string, questions: QuizQuestion[]): QuizQuestion[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rnd = () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return h / 2 ** 32;
  };
  const out = [...questions];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Die Fragen einer Runde: Alle Fragen werden pro Paar einmal gemischt, jede Runde nimmt die nächsten 20.
 * So kommt keine Frage doppelt, bis alle durch sind (bei 1000 Fragen also 50 Runden). Danach neu gemischt.
 * Gleich auf beiden Handys.
 */
export function questionOrder(seed: string, round: number, questions: QuizQuestion[] = QUIZ_QUESTIONS): QuizQuestion[] {
  const n = questions.length;
  if (!n) return [];
  const size = Math.min(ROUND_SIZE, n);
  const out: QuizQuestion[] = [];
  const cache = new Map<number, QuizQuestion[]>();
  for (let i = (Math.max(1, round) - 1) * size; out.length < size; i++) {
    const pass = Math.floor(i / n);
    if (!cache.has(pass)) cache.set(pass, shuffled(`${seed}:${pass + 1}`, questions));
    const q = cache.get(pass)![i % n];
    if (!out.some((x) => x.id === q.id)) out.push(q);
  }
  return out;
}

export interface QuizState {
  round: number;
  /** nächste offene Frage, null = Runde geschafft */
  question: QuizQuestion | null;
  /** wer dran ist */
  player: string | null;
  /** Antworten dieser Runde, neueste zuerst */
  answers: QuizAnswer[];
  done: number;
  total: number;
}

/**
 * @param members  Mitglieder des Paares in fester Reihenfolge (wer das Paar angelegt hat, beginnt)
 * @param round    gewünschte Runde (z. B. nach „Neue Runde“); sonst die neueste
 */
export function quizState(all: QuizAnswer[], members: string[], seed: string, round?: number, questions: QuizQuestion[] = QUIZ_QUESTIONS): QuizState {
  const latest = all.reduce((m, a) => Math.max(m, a.round), 1);
  const r = Math.max(round ?? latest, latest);
  const answers = all.filter((a) => a.round === r).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const asked = new Set(answers.map((a) => a.questionId));
  const list = questionOrder(seed, r, questions);
  const valid = new Set(list.map((q) => q.id));
  const question = list.find((q) => !asked.has(q.id)) ?? null;
  // abwechselnd: dran ist, wer nicht zuletzt dran war (über alle Runden hinweg)
  const last = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  let player: string | null = members[0] ?? null;
  if (members.length >= 2 && last?.player) player = members.find((m) => m !== last.player) ?? members[0];
  return { round: r, question, player, answers, done: answers.filter((a) => valid.has(a.questionId)).length, total: list.length };
}

/** Setzt Namen in die Frage ein */
export function questionText(q: QuizQuestion, me: string, partner: string) {
  return q.text.replaceAll('{partner}', partner).replaceAll('{ich}', me);
}

export const questionById = (id: string, questions: QuizQuestion[] = QUIZ_QUESTIONS) => questions.find((q) => q.id === id) ?? null;
