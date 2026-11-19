/** Restaurants: Durchschnitt, Preis, Sortierung und Vorschläge für die Küche. */
import type { Restaurant } from '@/data/types';

export const CUISINES = ['Italienisch', 'Deutsch', 'Griechisch', 'Asiatisch', 'Indisch', 'Mexikanisch', 'Burger', 'Café', 'Vegetarisch'];

/** Durchschnitt der Sterne, auf halbe Sterne gerundet; null ohne Bewertung */
export function avgStars(r: Pick<Restaurant, 'ratings'>): number | null {
  if (!r.ratings.length) return null;
  const a = r.ratings.reduce((s, x) => s + x.stars, 0) / r.ratings.length;
  return Math.round(a * 2) / 2;
}

/** 4,5 statt 4.5 */
export const starsText = (n: number) => String(n).replace('.', ',');

export const priceText = (p: number | null) => (p ? '€'.repeat(p) : '');

/** Untertitel: Küche · Ort · €€ */
export const restaurantSub = (r: Pick<Restaurant, 'cuisine' | 'place' | 'price'>) => [r.cuisine, r.place, priceText(r.price)].filter(Boolean).join(' · ');

/** „Wollen wir hin“ (älteste zuerst) und „Waren wir“ (beste zuerst, dann zuletzt besucht) */
export function splitRestaurants(items: Restaurant[]) {
  const wish = items.filter((r) => !r.visitedOn);
  const visited = items
    .filter((r) => r.visitedOn)
    .sort((a, b) => (avgStars(b) ?? 0) - (avgStars(a) ?? 0) || b.visitedOn!.localeCompare(a.visitedOn!) || a.name.localeCompare(b.name, 'de'));
  return { wish, visited };
}

/** Titel für die Date-Liste */
export const dateTitleFor = (name: string) => `Essen gehen: ${name}`.slice(0, 80);
