import { MemoryStore } from './memory-store';
import type { DataStore } from './store';
import { SupabaseStore } from './supabase-store';

/**
 * Wählt die Datenquelle. Ohne Supabase-Zugangsdaten in der Datei .env startet die App im Demo-Modus.
 */
export function createStore(): DataStore {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  if (url && key && /^https:\/\//.test(url)) return new SupabaseStore(url, key);
  return new MemoryStore();
}

export type { DataStore } from './store';
export * from './types';
