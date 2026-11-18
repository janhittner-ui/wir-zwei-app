import { router } from 'expo-router';
import { View } from 'react-native';

import type { CalendarEvent, Profile } from '@/data/types';
import { parse, WEEKDAYS } from '@/lib/dates';
import { fonts, personColors, useTheme } from '@/theme';
import { DateBadge, Press, T, Who } from '@/ui/kit';

export function EventRow({ e, members, first }: { e: CalendarEvent; members: Profile[]; first?: boolean }) {
  const t = useTheme();
  const d = parse(e.date);
  const who = members.find((m) => m.id === e.who);
  const pc = personColors(t, who?.color);
  return (
    <Press
      onPress={() => router.push({ pathname: '/termin', params: { id: e.id } })}
      scale={0.98}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: first ? 0 : 10, borderTopWidth: first ? 0 : 1, borderTopColor: t.line }}>
      <DateBadge date={d} tone={{ soft: pc.soft, ink: pc.ink }} />
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontFamily: fonts.bodySemi }}>{e.title}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {who ? <Who name={who.displayName} color={pc.dot} /> : <T v="small">Beide</T>}
          <T v="small">· {WEEKDAYS[d.getDay()]}{e.time ? ` · ${e.time} Uhr` : ''}</T>
        </View>
        {e.note ? <T v="small" numberOfLines={2}>{e.note}</T> : null}
      </View>
    </Press>
  );
}
