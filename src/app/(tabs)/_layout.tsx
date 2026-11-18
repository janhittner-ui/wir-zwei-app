import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, useTheme } from '@/theme';
import { IconCalendar, IconCart, IconHome } from '@/ui/icons';
import { Press } from '@/ui/kit';

const TABS = [
  { name: 'index', label: 'Start', Icon: IconHome },
  { name: 'kalender', label: 'Kalender', Icon: IconCalendar },
  { name: 'einkauf', label: 'Einkauf', Icon: IconCart },
] as const;

/** Tab-Leiste wie in der Web-App: aktive Seite blau mit weicher Pille dahinter. */
function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: t.surface, borderTopWidth: 1, borderTopColor: t.line,
        paddingTop: 6, paddingBottom: Math.max(6, insets.bottom), paddingHorizontal: 8, alignItems: 'center',
      }}>
      <View style={{ flexDirection: 'row', maxWidth: 520, width: '100%' }}>
        {state.routes.map((route, i) => {
          const tab = TABS.find((x) => x.name === route.name);
          if (!tab) return null;
          const on = state.index === i;
          const color = on ? t.blue : t.muted;
          return (
            <Press
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={tab.label}
              onPress={() => {
                if (!on) navigateToTab(route.key);
              }}
              scale={0.9}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 5, gap: 2 }}>
              <View style={{ position: 'absolute', top: 0, bottom: 0, left: '12%', right: '12%', borderRadius: 14, backgroundColor: on ? t.blueSoft : 'transparent' }} />
              <tab.Icon color={color} size={24} />
              <Text style={{ color, fontFamily: fonts.bodySemi, fontSize: 11.5 }}>{tab.label}</Text>
            </Press>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.bg } }}>
      {TABS.map((x) => <Tabs.Screen key={x.name} name={x.name} options={{ title: x.label }} />)}
    </Tabs>
  );
}
