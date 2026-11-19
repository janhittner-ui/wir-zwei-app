/**
 * Kalender: Monatsansicht mit farbigen Punkten pro Person (orange = Geburtstag),
 * darunter die Einträge des gewählten Tages. Weitere Reiter: Geburtstagsliste mit Suche, Reisen.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { usePrefs } from '@/data/prefs';
import { useApp, useBirthdays, useEvents } from '@/data/provider';
import type { Birthday } from '@/data/types';
import { birthdayIn, searchKey, upcomingBirthdays } from '@/lib/birthdays';
import { cmpEvent, longDay, monthGrid, MONTHS, parse, WD_SHORT, ymd } from '@/lib/dates';
import { fonts, personColors, useTheme } from '@/theme';
import { BirthdayRow } from '@/ui/birthday-row';
import { EventRow } from '@/ui/event-row';
import { IconLeft, IconPlus, IconRight, IconX } from '@/ui/icons';
import { Banner, Button, Card, CardHead, Input, Press, Screen, Segmented, T } from '@/ui/kit';
import { TripsView } from '@/ui/trips-view';

type Seg = 'monat' | 'geb' | 'reisen';

export default function Kalender() {
  const t = useTheme();
  const params = useLocalSearchParams<{ seg?: string }>();
  const [seg, setSeg] = useState<Seg>(params.seg === 'geb' || params.seg === 'reisen' ? params.seg : 'monat');
  useEffect(() => {
    if (params.seg === 'geb' || params.seg === 'monat' || params.seg === 'reisen') setSeg(params.seg);
  }, [params.seg]);

  return (
    <Screen>
      <View style={{ gap: 12 }}>
        <View>
          <T v="eyebrow">Gemeinsam planen</T>
          <T v="display">Kalender</T>
        </View>
        <Segmented<Seg> value={seg} onChange={setSeg} options={[{ key: 'monat', label: 'Monat' }, { key: 'geb', label: 'Geburtstage' }, { key: 'reisen', label: 'Reisen' }]} />
      </View>
      {seg === 'monat' ? <MonthView /> : seg === 'geb' ? <BirthdayList /> : <TripsView />}
    </Screen>
  );
}

const NO_BIRTHDAYS: Birthday[] = [];

function MonthView() {
  const t = useTheme();
  const { couple } = useApp();
  const { items, error } = useEvents();
  const { items: allBirthdays } = useBirthdays();
  const { prefs } = usePrefs();
  const showBd = prefs.kalender.showBirthdays;
  const birthdays = showBd ? allBirthdays : NO_BIRTHDAYS;
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [sel, setSel] = useState(ymd(now));
  const todayIso = ymd(now);

  const byDay = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const e of [...items].sort(cmpEvent)) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [items]);
  // Geburtstage des angezeigten Jahres (und des Jahres vom gewählten Tag) nach Datum
  const bdByDay = useMemo(() => {
    const map = new Map<string, Birthday[]>();
    const years = new Set([month.y, Number(sel.slice(0, 4))]);
    for (const y of years) for (const b of birthdays) {
      const iso = ymd(birthdayIn(b, y));
      map.set(iso, [...(map.get(iso) ?? []), b]);
    }
    return map;
  }, [birthdays, month.y, sel]);

  const colorOf = (who: string | null) => couple?.members.find((m) => m.id === who)?.color;
  const cells = monthGrid(month.y, month.m);
  const shift = (d: number) => setMonth(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }));
  const dayEvents = byDay.get(sel) ?? [];
  const dayBirthdays = bdByDay.get(sel) ?? [];
  const members = couple?.members ?? [];
  const selDate = parse(sel);

  return (
    <>
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
            const bds = bdByDay.get(iso) ?? [];
            const isSel = iso === sel;
            const isToday = iso === todayIso;
            const we = d.getDay() === 0 || d.getDay() === 6;
            const dots = [...evs.slice(0, 3).map((e) => personColors(t, colorOf(e.who)).dot), ...(bds.length ? [t.yellow] : [])].slice(0, 4);
            const label = [
              longDay(d),
              evs.length ? `${evs.length} Termin${evs.length > 1 ? 'e' : ''}` : null,
              bds.length ? `Geburtstag von ${bds.map((b) => b.name).join(', ')}` : null,
            ].filter(Boolean).join(', ');
            return (
              <Press
                key={i}
                onPress={() => setSel(iso)}
                scale={0.86}
                accessibilityLabel={label}
                style={{ width: `${100 / 7}%`, aspectRatio: 1 / 1.05, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 12, backgroundColor: isSel ? t.blueSoft : 'transparent' }}>
                <View style={[{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }, isToday && { backgroundColor: t.ink }]}>
                  <Text style={{ fontFamily: fonts.bodySemi, color: isToday ? t.bg : we ? t.muted : t.ink }}>{d.getDate()}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 3, height: 6 }}>
                  {dots.map((c, k) => <View key={k} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />)}
                </View>
              </Press>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {members.map((m) => (
            <Legend key={m.id} color={personColors(t, m.color).dot} label={m.displayName} />
          ))}
          {showBd ? <Legend color={t.yellow} label="Geburtstag" /> : null}
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <T v="h2" style={{ flexShrink: 1 }}>{longDay(selDate)}</T>
          <Button small title="Termin" icon={<IconPlus color={t.onAccent} size={18} />} onPress={() => router.push({ pathname: '/termin', params: { date: sel } })} testID="add-event" />
        </View>
        {dayBirthdays.map((b, i) => <BirthdayRow key={b.id} b={b} first={i === 0} onDate={selDate} />)}
        {dayEvents.map((e, i) => <EventRow key={e.id} e={e} members={members} first={i === 0 && !dayBirthdays.length} />)}
        {!dayEvents.length && !dayBirthdays.length ? <T v="muted">Nichts eingetragen.</T> : null}
      </Card>
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <T v="small" style={{ fontFamily: fonts.bodySemi }}>{label}</T>
    </View>
  );
}

function BirthdayList() {
  const t = useTheme();
  const { items, loaded, error } = useBirthdays();
  const [q, setQ] = useState('');
  const list = useMemo(() => upcomingBirthdays(items), [items]);
  const key = searchKey(q);
  const hits = key ? list.filter((b) => searchKey(`${b.name} ${b.note ?? ''}`).includes(key)) : list;
  const add = () => router.push('/geburtstag');

  return (
    <Card>
      <CardHead title="Geburtstagsliste" action={<Button small title="Neu" icon={<IconPlus color={t.onAccent} size={18} />} onPress={add} testID="add-birthday" />} />
      {error ? <Banner warn>Geburtstage konnten gerade nicht geladen werden.</Banner> : null}
      {list.length ? (
        <>
          <View style={{ justifyContent: 'center' }}>
            <Input value={q} onChangeText={setQ} placeholder="Name suchen …" autoCorrect={false} returnKeyType="search" accessibilityLabel="Geburtstage nach Namen durchsuchen" style={{ backgroundColor: t.surface2, borderColor: 'transparent', paddingRight: 42 }} testID="bd-search" />
            {q ? (
              <Press onPress={() => setQ('')} accessibilityLabel="Suche leeren" style={{ position: 'absolute', right: 6, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                <IconX color={t.muted} size={16} />
              </Press>
            ) : null}
          </View>
          {hits.length ? hits.map((b, i) => <BirthdayRow key={b.id} b={b} first={i === 0} />) : <T v="muted">Niemand gefunden.</T>}
        </>
      ) : loaded ? (
        <View style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.lineStrong, borderRadius: 16, padding: 20, gap: 10, alignItems: 'center' }}>
          <T v="muted" style={{ textAlign: 'center' }}>
            Tragt Familie und Freunde ein. Ihr seht dann immer, wer als Nächstes Geburtstag hat, und die Tage erscheinen im Kalender.
          </T>
          <Button small title="Ersten Geburtstag eintragen" onPress={add} />
        </View>
      ) : null}
    </Card>
  );
}
