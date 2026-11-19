import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { Caveat_600SemiBold } from '@expo-google-fonts/caveat';
import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold } from '@expo-google-fonts/figtree';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PrefsProvider, PrefsSync } from '@/data/prefs';
import { DataProvider, useApp } from '@/data/provider';
import { ThemeRoot, useTheme } from '@/theme';
import { Aurora, Button, Loading, T } from '@/ui/kit';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold,
    Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Caveat_600SemiBold,
  });
  // Schriften sind schön, aber nicht wichtig: nach spätestens 3 Sekunden geht es ohne sie weiter.
  const [timeout, setTimedOut] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(id);
  }, []);
  const ready = fontsLoaded || !!fontError || timeout;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PrefsProvider>
          <ThemeRoot>
            <DataProvider>
              <PrefsSync />
              <Root />
            </DataProvider>
          </ThemeRoot>
        </PrefsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Root() {
  const { status, refresh } = useApp();
  const t = useTheme();

  if (status === 'booting' || status === 'loading') return <Loading />;
  if (status === 'error') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
        <Aurora />
        <T v="h2">Keine Verbindung</T>
        <T v="muted" style={{ textAlign: 'center' }}>Eure Daten konnten gerade nicht geladen werden. Bist du online?</T>
        <Button title="Nochmal versuchen" onPress={refresh} />
      </View>
    );
  }

  const onboarding = status === 'needsProfile' || status === 'needsCouple';
  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Protected guard={onboarding}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'ready'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="termin" options={{ presentation: 'modal' }} />
          <Stack.Screen name="geburtstag" options={{ presentation: 'modal' }} />
          <Stack.Screen name="notiz" options={{ presentation: 'modal' }} />
          <Stack.Screen name="rezept" />
          <Stack.Screen name="rezept-bearbeiten" options={{ presentation: 'modal' }} />
          <Stack.Screen name="reise" />
          <Stack.Screen name="reise-bearbeiten" options={{ presentation: 'modal' }} />
          <Stack.Screen name="foto" options={{ presentation: 'fullScreenModal', animation: 'fade', contentStyle: { backgroundColor: '#000' } }} />
          <Stack.Screen name="film" options={{ presentation: 'modal' }} />
          <Stack.Screen name="geschenk" options={{ presentation: 'modal' }} />
          <Stack.Screen name="kochen" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="einstellungen" options={{ presentation: 'modal' }} />
          <Stack.Screen name="anpassen" options={{ presentation: 'modal' }} />
          <Stack.Screen name="bereich/[key]" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
