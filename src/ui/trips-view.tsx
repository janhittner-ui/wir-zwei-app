/** Reiter "Reisen" im Kalender: geplante Reisen mit Countdown, Wunschziele, vergangene Reisen. */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useTripItems, useTrips } from '@/data/provider';
import type { Trip, TripItem } from '@/data/types';
import { groupTrips, tripCountdown, tripRange, tripStatus } from '@/lib/trips';
import { fonts, useTheme } from '@/theme';
import { IconPlus, IconRight } from '@/ui/icons';
import { Banner, Button, Card, CardHead, Press, T } from '@/ui/kit';

export function TripsView() {
  const t = useTheme();
  const { items, loaded, error } = useTrips();
  const { items: packing } = useTripItems();
  const [showPast, setShowPast] = useState(false);
  const { planned, wishes, past } = useMemo(() => groupTrips(items), [items]);
  const add = (wish?: boolean) => router.push({ pathname: '/reise-bearbeiten', params: wish ? { wish: '1' } : {} });

  if (loaded && !items.length) {
    return (
      <Card>
        <CardHead title="Reisen" />
        {error ? <Banner warn>Reisen konnten gerade nicht geladen werden.</Banner> : null}
        <View style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.lineStrong, borderRadius: 16, padding: 20, gap: 10, alignItems: 'center' }}>
          <T v="muted" style={{ textAlign: 'center' }}>
            Sammelt hier Orte, die ihr irgendwann sehen wollt, und plant eure nächsten Reisen mit gemeinsamer Packliste.
          </T>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button small title="Reise planen" onPress={() => add()} testID="add-trip-empty" />
            <Button small kind="ghost" title="Wunschziel" onPress={() => add(true)} />
          </View>
        </View>
      </Card>
    );
  }

  return (
    <>
      {error ? <Banner warn>Reisen konnten gerade nicht geladen werden.</Banner> : null}
      <Card style={{ gap: 4 }}>
        <CardHead title="Geplant" action={<Button small title="Reise" icon={<IconPlus color={t.onAccent} size={18} />} onPress={() => add()} testID="add-trip" />} />
        {planned.length ? planned.map((tr, i) => <TripRow key={tr.id} tr={tr} first={i === 0} packing={packing} />) : <T v="muted" style={{ paddingVertical: 8 }}>Noch keine Reise geplant.</T>}
      </Card>
      <Card style={{ gap: 4 }}>
        <CardHead title="Wunschziele" action={<Button kind="link" title="Hinzufügen" onPress={() => add(true)} testID="add-wish" />} />
        {wishes.length ? wishes.map((tr, i) => <TripRow key={tr.id} tr={tr} first={i === 0} packing={packing} />) : <T v="muted" style={{ paddingVertical: 8 }}>Wohin wollt ihr irgendwann einmal?</T>}
      </Card>
      {past.length ? (
        <Card style={{ gap: 4 }}>
          <CardHead title={`Vergangene Reisen (${past.length})`} action={<Button kind="link" title={showPast ? 'Ausblenden' : 'Anzeigen'} onPress={() => setShowPast((v) => !v)} />} />
          {showPast ? past.map((tr, i) => <TripRow key={tr.id} tr={tr} first={i === 0} packing={packing} />) : null}
        </Card>
      ) : null}
    </>
  );
}

function TripRow({ tr, first, packing }: { tr: Trip; first: boolean; packing: TripItem[] }) {
  const t = useTheme();
  const status = tripStatus(tr);
  const mine = packing.filter((p) => p.tripId === tr.id);
  const packed = mine.filter((p) => p.done).length;
  const sub = tr.startDate ? tripRange(tr) : tr.note ?? '';
  const badge = status === 'upcoming' || status === 'now' ? tripCountdown(tr) : null;
  return (
    <Press
      onPress={() => router.push({ pathname: '/reise', params: { id: tr.id } })}
      scale={0.98}
      accessibilityRole="button"
      accessibilityLabel={[tr.title, sub, badge, mine.length ? `${packed} von ${mine.length} gepackt` : null].filter(Boolean).join(', ')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 10, borderTopWidth: first ? 0 : 1, borderTopColor: t.line }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontFamily: fonts.bodySemi, fontSize: 16 }} numberOfLines={1}>{tr.title}</T>
        {sub ? <T v="small" numberOfLines={1}>{sub}{mine.length ? ` · ${packed}/${mine.length} gepackt` : ''}</T> : null}
      </View>
      {badge ? (
        <View style={{ backgroundColor: status === 'now' ? t.pinkSoft : t.blueSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
          <T style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: status === 'now' ? t.pinkInk : t.blue }}>{badge}</T>
        </View>
      ) : null}
      <IconRight color={t.lineStrong} size={16} />
    </Press>
  );
}
