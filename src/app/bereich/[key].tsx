/**
 * Ein Bereich, der in „Anpassen“ aus der Tab-Leiste genommen wurde, als eigene Seite mit „Zurück“.
 * Zeigt genau denselben Bildschirm wie der Tab.
 */
import { router, useLocalSearchParams } from 'expo-router';
import type { ComponentType } from 'react';
import { Text } from 'react-native';

import Album from '@/app/(tabs)/album';
import Kalender from '@/app/(tabs)/kalender';
import Listen from '@/app/(tabs)/listen';
import Quiz from '@/app/(tabs)/quiz';
import Rezepte from '@/app/(tabs)/rezepte';
import { AREAS, type Area } from '@/lib/prefs';
import { fonts, useTheme } from '@/theme';
import { IconLeft } from '@/ui/icons';
import { Press, ScreenTop } from '@/ui/kit';

const SCREENS: Record<Area, ComponentType> = { kalender: Kalender, listen: Listen, rezepte: Rezepte, album: Album, quiz: Quiz };

export default function Bereich() {
  const { key } = useLocalSearchParams<{ key?: string }>();
  const t = useTheme();
  const area: Area = AREAS.includes(key as Area) ? (key as Area) : 'listen';
  const Comp = SCREENS[area];
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <ScreenTop.Provider
      value={
        <Press onPress={back} accessibilityRole="button" accessibilityLabel="Zurück zu Start" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginBottom: -8 }} testID="area-back">
          <IconLeft color={t.blue} size={22} />
          <Text style={{ color: t.blue, fontFamily: fonts.body, fontSize: 17 }}>Start</Text>
        </Press>
      }>
      <Comp />
    </ScreenTop.Provider>
  );
}
