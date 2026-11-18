/** Kalender: Monatsansicht mit farbigen Punkten pro Person, darunter die Termine des gewählten Tages. */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { useApp, useEvents } from '@/data/provider';
import { cmpEvent, longDay, monthGrid, MONTHS, parse, WD_SHORT, ymd } from '@/lib/dates';
import { fonts, personColors, useTheme } from '@/theme';
import { EventRow } from '@/ui/event-row';
import { IconLeft, IconPlus, IconRight } from '@/ui/icons';
import { Banner, Button, Card, Press, Screen, T } from '@/ui/kit';

export default function Kalender() {
  const t = useTheme();
  const { couple } = useApp();
  const { items, error } = useEvents();
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [sel, setSel] = useState(ymd(now));
  const todayIso = ymd(now);

  const byDay = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const e of [...items].sort(cmpEvent)) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [items]);
  const colorOf = (who: string | null) => couple?.members.find((m) => m.id === who)?.color;
  const cells = monthGrid(month.y, month.m);
  const shift = (d: number) => setMonth(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }));
  const dayEvents = byDay.get(sel) ?? [];
  const members = couple?.members ?? [];

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View>
          <T v="eyebrow">Gemeinsam planen</T>
          <T v="display">Kalender</T>
        </View>
        <Button small title="Termin" icon={<IconPlus color={t.onAccent} size={18} />} onPress={() => router.push({ pathname: '/termin', params: { date: sel } })} testID="add-event" />
      </View>
      {error ? <Banner warn>Termine konnten gerade nicht geladen werden.</Banner> : null}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Press onPress={() => shift(-1)} accessibilityLabel="Vorheriger Monat" style={{ backgroundColor: t.surface2, width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
            <IconLeft color={t.ink} size={18} />
          </Press>
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: t.ink }}>{MONTHS[month.m]} {month.y}</Text>
          <Press onPress={() => shift(1)} accessibilityLabel="Nächster Monat" style={{ backgroundColor: t.surface2, width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
            <IconRight color={t.ink} size={18} />
          </Press>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {WD_SHORT.map((w) => (
            <Text key={w} style={{ flex: 1, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 11, color: t.muted, textTransform: 'uppercase' }}>{w}</Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((d, i) => {
            if (!d) return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1 / 1.05 }} />;
            const iso = ymd(d);
            const evs = byDay.get(iso) ?? [];
            const isSel = iso === sel;
            const isToday = iso === todayIso;
            const we = d.getDay() === 0 || d.getDay() === 6;
            return (
              <Press
                key={i}
                onPress={() => setSel(iso)}
                scale={0.86}
                accessibilityLabel={`${longDay(d)}${evs.length ? `, ${evs.length} Termin${evs.length > 1 ? 'e' : ''}` : ''}`}
                style={{ width: `${100 / 7}%`, aspectRatio: 1 / 1.05, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 12, backgroundColor: isSel ? t.blueSoft : 'transparent' }}>
                <View style={[{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }, isToday && { backgroundColor: t.ink }]}>
                  <Text style={{ fontFamily: fonts.bodySemi, color: isToday ? t.bg : we ? t.muted : t.ink }}>{d.getDate()}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 3, height: 6 }}>
                  {evs.slice(0, 3).map((e) => (
                    <View key={e.id} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: personColors(t, colorOf(e.who)).dot }} />
                  ))}
                </View>
              </Press>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {members.map((m) => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: personColors(t, m.color).dot }} />
              <T v="small" style={{ fontFamily: fonts.bodySemi }}>{m.displayName}</T>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <T v="h2">{longDay(parse(sel))}</T>
        {dayEvents.length ? (
          dayEvents.map((e, i) => <EventRow key={e.id} e={e} members={members} first={i === 0} />)
        ) : (
          <T v="muted">Nichts eingetragen.</T>
        )}
      </Card>
    </Screen>
  );
}
