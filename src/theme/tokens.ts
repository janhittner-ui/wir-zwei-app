/** Farben und Schriften aus Wir Zwei v40 (hell/dunkel). */
import type { PersonColor } from '@/data/types';

export const light = {
  bg: '#F2F4F8', surface: '#FFFFFF', surface2: '#E8ECF3', ink: '#1A2130', muted: '#5E677A',
  line: '#DCE1EA', lineStrong: '#B9C1CF',
  blue: '#1C76E4', blueSoft: '#DDEBFD', red: '#CF3B30', redSoft: '#FBE5E2', green: '#2E7D57',
  pink: '#FF8DC1', pinkSoft: '#FFE6F1', pinkInk: '#C2387A',
  yellow: '#FF8A1F', yellowSoft: '#FFE9D4', yellowInk: '#B05200',
  onAccent: '#FFFFFF',
  g1: 'rgba(28,118,228,0.26)', g2: 'rgba(255,141,193,0.34)', g3: 'rgba(255,138,31,0.2)', g4: 'rgba(150,120,255,0.14)',
  heart: 'rgba(204,60,130,0.09)',
  shadow: '#16203A',
  dark: false,
};
export type Theme = typeof light;

export const dark: Theme = {
  bg: '#0E121A', surface: '#171D29', surface2: '#212938', ink: '#E6EAF2', muted: '#98A1B4',
  line: '#2A3345', lineStrong: '#465169',
  blue: '#6DB3FF', blueSoft: '#15294A', red: '#F08273', redSoft: '#3B201E', green: '#7CCB9F',
  pink: '#FF9ECB', pinkSoft: '#3D2131', pinkInk: '#FFB6D8',
  yellow: '#FF9D45', yellowSoft: '#3B2716', yellowInk: '#FFB772',
  onAccent: '#0E121A',
  g1: 'rgba(60,140,255,0.22)', g2: 'rgba(255,120,190,0.18)', g3: 'rgba(255,150,60,0.12)', g4: 'rgba(140,110,255,0.16)',
  heart: 'rgba(255,190,225,0.06)',
  shadow: '#000000',
  dark: true,
};

export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  displayHeavy: 'BricolageGrotesque_800ExtraBold',
  displaySemi: 'BricolageGrotesque_600SemiBold',
  body: 'Figtree_400Regular',
  bodyMedium: 'Figtree_500Medium',
  bodySemi: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
  hand: 'Caveat_600SemiBold',
};

/** Farbe einer Person: Jan blau, Vanessa rosa (frei wählbar im Profil). */
export function personColors(t: Theme, c: PersonColor | null | undefined) {
  return c === 'pink'
    ? { dot: t.pink, soft: t.pinkSoft, ink: t.pinkInk }
    : { dot: t.blue, soft: t.blueSoft, ink: t.blue };
}
