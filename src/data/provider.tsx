/**
 * Hält Anmeldung, Profil und Paar für die ganze App bereit und liefert Listen mit Live-Sync.
 * Regel aus der alten App: Nebensachen (z. B. Partnerprofil) dürfen die Hauptdaten nie blockieren.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { createStore } from './index';
import type { DataStore } from './store';
import type { CalendarEvent, Couple, Profile, Session, ShoppingItem } from './types';

type Status = 'booting' | 'signedOut' | 'loading' | 'needsProfile' | 'needsCouple' | 'ready' | 'error';

interface AppData {
  store: DataStore;
  status: Status;
  session: Session | null;
  profile: Profile | null;
  couple: Couple | null;
  /** Lädt Profil und Paar neu (z. B. nach Kopplung). */
  refresh: () => Promise<void>;
}

const Ctx = createContext<AppData | null>(null);

export function DataProvider({ children, store: injected }: { children: ReactNode; store?: DataStore }) {
  const store = useMemo(() => injected ?? createStore(), [injected]);
  const [status, setStatus] = useState<Status>('booting');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const loadId = useRef(0);
  const userRef = useRef<string | null | undefined>(undefined);

  const load = useCallback(async (s: Session | null) => {
    const id = ++loadId.current;
    userRef.current = s?.userId ?? null;
    setSession(s);
    if (!s) {
      setProfile(null);
      setCouple(null);
      setStatus('signedOut');
      return;
    }
    setStatus((st) => (st === 'ready' ? st : 'loading'));
    try {
      const p = await store.getMyProfile();
      const c = p ? await store.getMyCouple() : null;
      if (id !== loadId.current) return;
      setProfile(p);
      setCouple(c);
      setStatus(!p ? 'needsProfile' : !c ? 'needsCouple' : 'ready');
    } catch (e) {
      console.warn('Laden fehlgeschlagen', e);
      if (id === loadId.current) setStatus('error');
    }
  }, [store]);

  useEffect(() => {
    let alive = true;
    store.getSession()
      .then((s) => {
        if (alive && userRef.current === undefined) load(s);
      })
      .catch(() => {
        if (alive && userRef.current === undefined) load(null);
      });
    const off = store.onSessionChange((s) => {
      // Token-Erneuerungen ändern nichts am Konto – nur bei Kontowechsel neu laden.
      if (userRef.current !== (s?.userId ?? null)) load(s);

    });
    return () => {
      alive = false;
      off();
    };
  }, [store, load]);

  const refresh = useCallback(async () => {
    await load(await store.getSession());
  }, [load, store]);

  // Paar-Änderungen des Partners (Name, "Zusammen seit", Beitritt) live übernehmen
  useEffect(() => {
    if (status !== 'ready' && status !== 'needsCouple') return;
    return store.subscribe('couple', () => {
      store.getMyCouple().then(setCouple).catch(() => {});
    });
  }, [store, status]);

  const value = useMemo(() => ({ store, status, session, profile, couple, refresh }), [store, status, session, profile, couple, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp außerhalb von DataProvider');
  return v;
}

/** Lädt eine Liste, hört auf Live-Änderungen und lädt beim Zurückkehren in die App neu. */
function useLiveList<T>(table: 'events' | 'shopping', fetcher: (s: DataStore) => Promise<T[]>) {
  const { store, status } = useApp();
  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  const reload = useCallback(async () => {
    try {
      const r = await fetchRef.current(store);
      setItems(r);
      setError(false);
    } catch (e) {
      console.warn(`${table} laden fehlgeschlagen`, e);
      setError(true);
    } finally {
      setLoaded(true);
    }
  }, [store, table]);

  useEffect(() => {
    if (status !== 'ready') return;
    reload();
    const off = store.subscribe(table, reload);
    const app = AppState.addEventListener('change', (s) => s === 'active' && reload());
    return () => {
      off();
      app.remove();
    };
  }, [status, store, table, reload]);

  return { items, setItems, loaded, error, reload };
}

export const useEvents = () => useLiveList<CalendarEvent>('events', (s) => s.listEvents());
export const useShopping = () => useLiveList<ShoppingItem>('shopping', (s) => s.listShopping());
