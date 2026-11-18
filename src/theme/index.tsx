import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { dark, light, type Theme } from './tokens';

const Ctx = createContext<Theme>(light);

export function ThemeRoot({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  return <Ctx.Provider value={scheme === 'dark' ? dark : light}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
export { fonts, personColors, type Theme } from './tokens';
