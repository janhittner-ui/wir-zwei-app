/**
 * Echte iPhone-Tab-Leiste (UITabBarController, auf iOS 26 mit "Liquid Glass") mit SF-Symbolen.
 * Aktiver Reiter in Paarweise-Blau.
 */
import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <NativeTabs tintColor={t.blue}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Start</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="kalender">
        <NativeTabs.Trigger.Label>Kalender</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="listen">
        <NativeTabs.Trigger.Label>Listen</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'checklist', selected: 'checklist' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="rezepte">
        <NativeTabs.Trigger.Label>Rezepte</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="fork.knife" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="album">
        <NativeTabs.Trigger.Label>Album</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'photo.on.rectangle', selected: 'photo.fill.on.rectangle.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
