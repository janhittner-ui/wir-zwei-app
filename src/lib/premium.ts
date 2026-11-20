/**
 * Zentrale Stelle für „Was darf dieses Paar nutzen?“ (Abo / Vollzugang).
 *
 * Stand Version 1: Es gibt noch KEIN Abo. Darum ist ABO_AKTIV = false und alles ist für alle frei.
 * Sobald das Abo gebaut ist, wird ABO_AKTIV auf true gestellt und hasPremium() zusätzlich das Abo prüfen.
 *
 * Vollzugang (couples.full_access) setzt nur Jan im Supabase SQL Editor:
 *   select admin.vollzugang('email@beispiel.de', true);
 * Paare mit Vollzugang bekommen alles dauerhaft gratis, auch wenn das Abo kommt.
 *
 * Neue Sperren immer über canUse() / photoLimit() einbauen, nie eigene Abfragen im Bildschirm-Code.
 */
import type { Couple } from '../data/types';

/** Abo-Sperren eingeschaltet? Bis das Abo gebaut ist: false (nichts wird gesperrt). */
export const ABO_AKTIV = false;

/** Fotos im Album ohne Abo (das 11. Foto braucht das Abo). */
export const FREE_PHOTO_LIMIT = 10;

/** Bereiche, die später das Abo brauchen. Alles andere ist immer gratis. */
export const PREMIUM_FEATURES = ['kochmodus', 'filme', 'reisen', 'zyklus', 'restaurants', 'meilensteine', 'quiz', 'fotos-unbegrenzt'] as const;
export type PremiumFeature = (typeof PREMIUM_FEATURES)[number];

/** Hat das Paar Vollzugang oder (später) ein aktives Abo? */
export function hasPremium(couple: Pick<Couple, 'fullAccess'> | null | undefined): boolean {
  if (!couple) return false;
  if (couple.fullAccess) return true;
  // Später hier: aktives Abo des Paares prüfen.
  return false;
}

/** Darf das Paar diese Funktion nutzen? Solange ABO_AKTIV false ist: immer ja. */
export function canUse(feature: PremiumFeature, couple: Pick<Couple, 'fullAccess'> | null | undefined, aboAktiv = ABO_AKTIV): boolean {
  if (!aboAktiv) return true;
  if (!PREMIUM_FEATURES.includes(feature)) return true;
  return hasPremium(couple);
}

/** Wie viele Album-Fotos sind erlaubt? null = unbegrenzt. */
export function photoLimit(couple: Pick<Couple, 'fullAccess'> | null | undefined, aboAktiv = ABO_AKTIV): number | null {
  return canUse('fotos-unbegrenzt', couple, aboAktiv) ? null : FREE_PHOTO_LIMIT;
}
