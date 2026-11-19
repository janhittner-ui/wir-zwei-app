import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';

import { usePrefs } from '@/data/prefs';

import { dark, light, withAccent, type Theme } from './tokens';

const Ctx = createContext<Theme>(light);

/** Hell/Dunkel (oder wie das iPhone) und Akzentfarbe aus „Anpassen“. */
export function ThemeRoot({ children }: { children: ReactNode }) {
  const { prefs } = usePrefs();
  const { mode, accent } = prefs.look;
  // Auch native Teile (Tab-Leiste, Datumsauswahl, Hinweise) sollen hell/dunkel mitwechseln
  useEffect(() => {
    if (Platform.OS === 'web') return;
    try {
      Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
    } catch {
      // ältere Systeme: dann nur die App selbst
    }
  }, [mode]);
  const scheme = useColorScheme();
  const isDark = mode === 'system' ? scheme === 'dark' : mode === 'dark';
  const theme = useMemo(() => withAccent(isDark ? dark : light, accent), [isDark, accent]);
  return <Ctx.Provider value={theme}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
export { ACCENT_COLORS, fonts, personColors, type Theme } from './tokens';
