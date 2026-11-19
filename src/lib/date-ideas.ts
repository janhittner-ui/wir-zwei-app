/** Date-Liste: Arten, Vorschläge zum Start und das „Zufällige Date“. */
import type { DateCategory, DateIdea } from '@/data/types';

export const DATE_CATEGORIES: readonly DateCategory[] = ['zuhause', 'draussen', 'essen', 'kultur', 'aktiv', 'ausflug', 'sonstiges'];
export const DATE_CATEGORY: Record<DateCategory, { emoji: string; label: string }> = {
  zuhause: { emoji: '🏠', label: 'Zuhause' },
  draussen: { emoji: '🌳', label: 'Draußen' },
  essen: { emoji: '🍝', label: 'Essen' },
  kultur: { emoji: '🎭', label: 'Kultur' },
  aktiv: { emoji: '🚴', label: 'Aktiv' },
  ausflug: { emoji: '🚗', label: 'Ausflug' },
  sonstiges: { emoji: '✨', label: 'Sonstiges' },
};

export interface DateSuggestion {
  title: string;
  category: DateCategory;
}

/** Vorschläge zum Start: mit einem Tipp auf eure Liste */
export const DATE_SUGGESTIONS: readonly DateSuggestion[] = [
  { title: 'Picknick im Park', category: 'draussen' },
  { title: 'Kochabend mit einem Gericht, das ihr noch nie gekocht habt', category: 'zuhause' },
  { title: 'Restaurant ausprobieren, in dem ihr noch nie wart', category: 'essen' },
  { title: 'Gottesdienst in einer anderen Gemeinde besuchen', category: 'kultur' },
  { title: 'Minigolf oder Bowling', category: 'aktiv' },
  { title: 'Tagesausflug in eine Stadt, die ihr nicht kennt', category: 'ausflug' },
  { title: 'Sterne gucken mit Decke und Tee', category: 'draussen' },
  { title: 'Spieleabend zu zweit', category: 'zuhause' },
  { title: 'Eis essen gehen', category: 'essen' },
  { title: 'Konzert oder Lobpreisabend', category: 'kultur' },
  { title: 'Neue Wanderroute ausprobieren', category: 'aktiv' },
  { title: 'Zum See oder ans Meer fahren', category: 'ausflug' },
  { title: 'Briefe aneinander schreiben und vorlesen', category: 'zuhause' },
  { title: 'Sonnenaufgang anschauen', category: 'draussen' },
  { title: 'Wochenmarkt bummeln und daraus kochen', category: 'essen' },
  { title: 'Museum oder Ausstellung', category: 'kultur' },
  { title: 'Zusammen Fahrrad fahren und irgendwo einkehren', category: 'aktiv' },
  { title: 'Freizeitpark oder Zoo', category: 'ausflug' },
  { title: 'Zusammen eine Andacht oder einen Psalm lesen und darüber reden', category: 'zuhause' },
  { title: 'Kino mit Popcorn', category: 'kultur' },
  { title: 'Fotoalbum von eurem letzten Jahr gestalten', category: 'zuhause' },
  { title: 'Frühstück im Bett', category: 'zuhause' },
  { title: 'Gemeinsam ehrenamtlich helfen', category: 'sonstiges' },
  { title: 'Ein Tag ohne Handy', category: 'sonstiges' },
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Vorschläge, die noch nicht auf der Liste stehen */
export function openSuggestions(items: DateIdea[]): DateSuggestion[] {
  const have = new Set(items.map((i) => norm(i.title)));
  return DATE_SUGGESTIONS.filter((s) => !have.has(norm(s.title)));
}

export type RandomPick = { kind: 'idea'; idea: DateIdea } | { kind: 'suggestion'; suggestion: DateSuggestion } | null;

/**
 * Zufälliges Date: zuerst aus euren offenen Ideen, sonst ein Vorschlag, der noch nicht auf der Liste steht.
 * Der vorige Treffer kommt nicht gleich noch einmal (außer er ist der einzige).
 */
export function randomDate(items: DateIdea[], lastKey: string | null = null, rand: () => number = Math.random): RandomPick {
  const open = items.filter((i) => !i.doneOn);
  if (open.length) {
    const pool = open.length > 1 ? open.filter((i) => i.id !== lastKey) : open;
    return { kind: 'idea', idea: pool[Math.floor(rand() * pool.length)] };
  }
  const sugg = openSuggestions(items);
  if (!sugg.length) return null;
  const pool = sugg.length > 1 ? sugg.filter((s) => s.title !== lastKey) : sugg;
  return { kind: 'suggestion', suggestion: pool[Math.floor(rand() * pool.length)] };
}

export const pickKey = (p: RandomPick) => (p ? (p.kind === 'idea' ? p.idea.id : p.suggestion.title) : null);

/** Offene Ideen (älteste zuerst) und erledigte (neueste zuerst) */
export function splitDates(items: DateIdea[]) {
  const open = items.filter((i) => !i.doneOn);
  const done = items.filter((i) => i.doneOn).sort((a, b) => b.doneOn!.localeCompare(a.doneOn!) || b.createdAt.localeCompare(a.createdAt));
  return { open, done };
}
