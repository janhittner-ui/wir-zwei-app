/**
 * Echte iPhone-Tab-Leiste (UITabBarController, auf iOS 26 mit "Liquid Glass") mit SF-Symbolen.
 * Welche Bereiche als Tab erscheinen und in welcher Reihenfolge, legt jede Person unter „Anpassen“ fest.
 * Start ist immer vorne; ausgeblendete Bereiche erreicht man über die Startseite.
 */
import { NativeTabs } from 'expo-router/native-tabs';

import { usePrefs } from '@/data/prefs';
import { AREA_LABEL, type Area } from '@/lib/prefs';
import { useTheme } from '@/theme';

const ICONS: Record<Area, string | { default: string; selected: string }> = {
  kalender: 'calendar',
  listen: { default: 'checklist', selected: 'checklist' },
  rezepte: 'fork.knife',
  album: { default: 'photo.on.rectangle', selected: 'photo.fill.on.rectangle.fill' },
};

export default function TabsLayout() {
  const t = useTheme();
  const { prefs } = usePrefs();
  return (
    <NativeTabs tintColor={t.blue}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Start</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
      </NativeTabs.Trigger>
      {prefs.areas.order.map((a) => (
        <NativeTabs.Trigger key={a} name={a} hidden={prefs.areas.hidden.includes(a)}>
          <NativeTabs.Trigger.Label>{AREA_LABEL[a]}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={ICONS[a] as never} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
