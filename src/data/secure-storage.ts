/**
 * Speichert die Anmeldung im iOS-Schlüsselbund (expo-secure-store) statt im normalen App-Speicher.
 * Große Werte werden in Stücke geteilt, weil der Schlüsselbund pro Eintrag begrenzt ist.
 */
import * as SecureStore from 'expo-secure-store';

const CHUNK = 1800;
const opts: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
const safeKey = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, '_');

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = safeKey(key);
    const n = Number(await SecureStore.getItemAsync(`${k}.n`, opts));
    if (!n) return null;
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      const p = await SecureStore.getItemAsync(`${k}.${i}`, opts);
      if (p == null) return null;
      parts.push(p);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    const k = safeKey(key);
    await this.removeItem(key);
    const n = Math.max(1, Math.ceil(value.length / CHUNK));
    for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK), opts);
    await SecureStore.setItemAsync(`${k}.n`, String(n), opts);
  },
  async removeItem(key: string): Promise<void> {
    const k = safeKey(key);
    const n = Number(await SecureStore.getItemAsync(`${k}.n`, opts)) || 0;
    await SecureStore.deleteItemAsync(`${k}.n`, opts);
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${k}.${i}`, opts);
  },
};
