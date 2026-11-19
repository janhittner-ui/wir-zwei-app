/**
 * Persönliche Einstellungen („Anpassen“) für die ganze App.
 *
 * - Sofort da: Beim Start kommen sie aus dem Gerätespeicher (Schlüsselbund), damit Farbe und Tabs
 *   nicht erst nach dem Laden umspringen.
 * - Pro Person gespeichert: Sobald jemand angemeldet ist, gelten die Einstellungen aus der Datenbank
 *   (Tabelle user_prefs, nur für einen selbst lesbar). Änderungen werden kurz gesammelt und dann gespeichert.
 * - Beim Abmelden zurück auf Standard.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { DEFAULT_PREFS, normalizePrefs, setCurrentPrefs, type Prefs } from '@/lib/prefs';

import { useApp } from './provider';
import { secureStorage } from './secure-storage';

const CACHE = 'pw-prefs';
const SAVE_DELAY = 600;

type Saver = (p: Prefs) => Promise<void>;
interface Control {
  prefs: Prefs;
  /** Ändert Einstellungen (wird gleich angewendet und kurz danach gespeichert) */
  update: (fn: (p: Prefs) => Prefs) => void;
  /** intern: Synchronisierung mit der Datenbank */
  sync: {
    attach: (userId: string, saver: Saver) => void;
    detach: () => void;
    fromServer: (raw: unknown | null) => void;
    reset: () => void;
  };
}

const Ctx = createContext<Control | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const ref = useRef<Prefs>(DEFAULT_PREFS);
  const owner = useRef<string | null>(null); // wem die Einstellungen gehören
  const saver = useRef<Saver | null>(null);
  const dirty = useRef(false); // lokal geändert, aber noch nicht gespeichert
  const touched = useRef(false); // schon etwas Neueres als der Gerätespeicher da
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = useCallback((p: Prefs, cache = true) => {
    ref.current = p;
    setCurrentPrefs(p);
    setPrefs(p);
    if (cache) {
      const v = owner.current ? JSON.stringify({ u: owner.current, p }) : null;
      (v ? secureStorage.setItem(CACHE, v) : secureStorage.removeItem(CACHE)).catch(() => {});
    }
  }, []);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const save = saver.current;
    if (!save || !dirty.current) return;
    dirty.current = false;
    save(ref.current).catch((e) => {
      console.warn('Einstellungen speichern fehlgeschlagen', e);
      dirty.current = true; // beim nächsten Mal erneut versuchen
    });
  }, []);

  // Gerätespeicher beim Start
  useEffect(() => {
    secureStorage.getItem(CACHE)
      .then((v) => {
        if (!v || touched.current) return;
        const c = JSON.parse(v) as { u?: unknown; p?: unknown };
        if (typeof c.u !== 'string') return;
        owner.current = c.u;
        apply(normalizePrefs(c.p), false);
      })
      .catch(() => {});
  }, [apply]);

  const update = useCallback((fn: (p: Prefs) => Prefs) => {
    touched.current = true;
    apply(normalizePrefs(fn(ref.current)));
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
  }, [apply, flush]);

  const sync = useMemo<Control['sync']>(() => ({
    attach(userId, s) {
      if (owner.current !== userId) {
        // anderes Konto auf diesem Gerät: nichts übernehmen
        owner.current = userId;
        dirty.current = false;
        touched.current = true;
        apply(DEFAULT_PREFS);
      }
      saver.current = s;
    },
    detach() {
      flush();
      saver.current = null;
    },
    fromServer(raw) {
      touched.current = true;
      if (raw != null && !dirty.current) apply(normalizePrefs(raw));
      else if (raw == null && ref.current !== DEFAULT_PREFS) dirty.current = true; // Gerätestand erstmals speichern
      flush();
    },
    reset() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      saver.current = null;
      dirty.current = false;
      touched.current = true;
      owner.current = null;
      apply(DEFAULT_PREFS);
    },
  }), [apply, flush]);

  const value = useMemo(() => ({ prefs, update, sync }), [prefs, update, sync]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Einstellungen lesen und ändern */
export function usePrefs() {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePrefs außerhalb von PrefsProvider');
  return { prefs: v.prefs, update: v.update };
}

/** Verbindet die Einstellungen mit dem angemeldeten Konto (innerhalb von DataProvider einsetzen). */
export function PrefsSync() {
  const { store, status, session } = useApp();
  const v = useContext(Ctx);
  if (!v) throw new Error('PrefsSync außerhalb von PrefsProvider');
  const { sync } = v;
  const userId = session?.userId ?? null;
  const signedOut = status === 'signedOut';

  useEffect(() => {
    if (signedOut) {
      sync.reset();
      return;
    }
    if (!userId) return;
    let alive = true;
    sync.attach(userId, (p) => store.saveMyPrefs(p));
    store.getMyPrefs()
      .then((raw) => alive && sync.fromServer(raw))
      .catch((e) => console.warn('Einstellungen laden fehlgeschlagen', e));
    return () => {
      alive = false;
      sync.detach();
    };
  }, [store, userId, signedOut, sync]);

  return null;
}
