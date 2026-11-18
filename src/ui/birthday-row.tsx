import { router } from 'expo-router';
import { View } from 'react-native';

import type { Birthday } from '@/data/types';
import { rel } from '@/lib/dates';
import { nextBirthday } from '@/lib/birthdays';
import { fonts, useTheme } from '@/theme';
import { DateBadge, Press, T } from '@/ui/kit';

/** Eine Zeile mit orangem Datum, Name, "wird 30 · in 12 Tagen". */
export function BirthdayRow({ b, first, onDate }: { b: Birthday; first?: boolean; onDate?: Date }) {
  const t = useTheme();
  const n = nextBirthday(b);
  const date = onDate ?? n.date;
  const age = b.year ? date.getFullYear() - b.year : null;
  const parts = [age && age > 0 ? `wird ${age}` : null, onDate ? null : rel(n.days), b.note].filter(Boolean);
  return (
    <Press
      onPress={() => router.push({ pathname: '/geburtstag', params: { id: b.id } })}
      scale={0.98}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: first ? 0 : 10, borderTopWidth: first ? 0 : 1, borderTopColor: t.line }}>
      <DateBadge date={date} tone={{ soft: t.yellowSoft, ink: t.yellowInk }} />
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontFamily: fonts.bodySemi }}>{onDate ? `Geburtstag: ${b.name}` : b.name}</T>
        {parts.length ? <T v="small" numberOfLines={2}>{parts.join(' · ')}</T> : null}
      </View>
    </Press>
  );
}
