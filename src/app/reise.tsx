/** Eine Reise ansehen: Zeitraum, Countdown, Notiz und gemeinsame Packliste. */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Text, View, type TextInputInstance } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useTripItems, useTrips } from '@/data/provider';
import type { TripItem } from '@/data/types';
import { tripCountdown, tripDays, tripRange, tripStatus } from '@/lib/trips';
import { fonts, personColors, useTheme } from '@/theme';
import { IconCheck, IconLeft, IconPencil, IconPlus } from '@/ui/icons';
import { Banner, Button, Card, CardHead, Input, Press, Screen, T } from '@/ui/kit';
import { SwipeToDelete } from '@/ui/swipe-row';

/** Vorschläge für eine leere Packliste */
const BASICS = ['Ausweis', 'Ladekabel', 'Zahnbürste', 'Medikamente', 'Sonnencreme', 'Kopfhörer'];

export default function ReiseAnsicht() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store, couple } = useApp();
  const { items: trips, loaded } = useTrips();
  const { items: all, setItems, reload } = useTripItems();
  const t = useTheme();
  const tr = trips.find((x) => x.id === id);
  const items = useMemo(() => all.filter((x) => x.tripId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [all, id]);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<TextInputInstance>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/kalender', params: { seg: 'reisen' } }));

  if (!tr) {
    return (
      <Screen>
        <BackLink onPress={back} />
        {loaded ? <T v="h2">Diese Reise wurde gelöscht.</T> : null}
      </Screen>
    );
  }

  const add = async (text = draft) => {
    if (!text.trim()) return;
    setErr(null);
    if (text === draft) setDraft('');
    try {
      const it = await store.addTripItem(tr.id, text);
      setItems((l) => (l.some((x) => x.id === it.id) ? l : [...l, it]));
    } catch (e) {
      if (text === draft) setDraft(text);
      setErr(friendlyError(e));
    }
    input.current?.focus();
  };
  const addBasics = async () => {
    setErr(null);
    try {
      for (const b of BASICS) await store.addTripItem(tr.id, b);
    } catch (e) {
      setErr(friendlyError(e));
    }
    reload();
  };
  const act = async (optimistic: (l: TripItem[]) => TripItem[], fn: () => Promise<unknown>) => {
    setErr(null);
    setItems(optimistic);
    try {
      await fn();
    } catch (e) {
      setErr(friendlyError(e));
      reload();
    }
  };
  const toggle = (it: TripItem) => act((l) => l.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)), () => store.setTripItemDone(it.id, !it.done));
  const remove = (it: TripItem) => act((l) => l.filter((x) => x.id !== it.id), () => store.deleteTripItem(it.id));

  const status = tripStatus(tr);
  const days = tripDays(tr);
  const packed = items.filter((x) => x.done).length;
  const colorOf = (uid: string | null) => personColors(t, couple?.members.find((m) => m.id === uid)?.color).dot;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <BackLink onPress={back} />
        <Press onPress={() => router.push({ pathname: '/reise-bearbeiten', params: { id: tr.id } })} accessibilityRole="button" accessibilityLabel="Bearbeiten" testID="trip-edit" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <IconPencil color={t.blue} size={21} />
        </Press>
      </View>

      <View style={{ gap: 6 }}>
        <T v="eyebrow">{status === 'wish' ? 'Wunschziel' : status === 'past' ? 'Vergangene Reise' : 'Geplante Reise'}</T>
        <T v="display" accessibilityRole="header">{tr.title}</T>
        {tr.startDate ? <T v="muted">{tripRange(tr)}{days && days > 1 ? ` · ${days} Tage` : ''}</T> : null}
        {status === 'upcoming' || status === 'now' ? (
          <View style={{ alignSelf: 'flex-start', backgroundColor: status === 'now' ? t.pinkSoft : t.blueSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginTop: 4 }}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: status === 'now' ? t.pinkInk : t.blue }}>{tripCountdown(tr)}</Text>
          </View>
        ) : null}
      </View>
      {tr.note ? (
        <Card>
          <T>{tr.note}</T>
        </Card>
      ) : null}

      <Card>
        <CardHead title="Packliste" action={items.length ? <T v="small">{packed} von {items.length} gepackt</T> : undefined} />
        {items.length ? (
          <View style={{ height: 5, borderRadius: 3, backgroundColor: t.line, overflow: 'hidden' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={{ width: `${(packed / items.length) * 100}%`, height: 5, backgroundColor: t.green }} />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Input ref={input} value={draft} onChangeText={setDraft} placeholder="Was soll mit?" returnKeyType="done" submitBehavior="submit" onSubmitEditing={() => add()} maxLength={120} testID="pack-input" />
          </View>
          <Press onPress={() => add()} accessibilityLabel="Hinzufügen" testID="pack-add" style={{ backgroundColor: t.blue, borderRadius: 12, width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}>
            <IconPlus color={t.onAccent} size={22} />
          </Press>
        </View>
        {err ? <Banner warn>{err}</Banner> : null}
        {items.length ? (
          <>
            {items.map((it, i) => <PackRow key={it.id} it={it} first={i === 0} dot={colorOf(it.createdBy)} onToggle={toggle} onDelete={remove} />)}
            <T v="small" style={{ textAlign: 'center' }}>Zum Löschen nach links wischen</T>
          </>
        ) : (
          <View style={{ gap: 8 }}>
            <T v="muted">Noch nichts auf der Packliste. Was einer einträgt, sieht der andere sofort.</T>
            <View style={{ alignSelf: 'flex-start' }}>
              <Button small kind="ghost" title="Das Wichtigste vorschlagen" onPress={addBasics} testID="pack-basics" />
            </View>
          </View>
        )}
      </Card>
    </Screen>
  );
}

function BackLink({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  return (
    <Press onPress={onPress} accessibilityLabel="Zurück zu Reisen" style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -6, minHeight: 44 }}>
      <IconLeft color={t.blue} size={22} />
      <Text style={{ color: t.blue, fontFamily: fonts.body, fontSize: 17 }}>Reisen</Text>
    </Press>
  );
}

function PackRow({ it, first, dot, onToggle, onDelete }: { it: TripItem; first: boolean; dot: string; onToggle: (it: TripItem) => void; onDelete: (it: TripItem) => void }) {
  const t = useTheme();
  return (
    <View style={{ borderTopWidth: first ? 0 : 1, borderTopColor: t.line, paddingTop: first ? 0 : 6 }}>
      <SwipeToDelete onDelete={() => onDelete(it)}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.surface, paddingVertical: 4 }}
          accessible
          accessibilityLabel={`${it.text}${it.done ? ', eingepackt' : ''}`}
          accessibilityActions={[{ name: 'activate', label: it.done ? 'Wieder auspacken' : 'Abhaken' }, { name: 'delete', label: 'Löschen' }]}
          onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'delete' ? onDelete(it) : onToggle(it))}>
          <Press
            onPress={() => onToggle(it)}
            scale={0.82}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityLabel={it.text}
            accessibilityState={{ checked: it.done }}
            style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', borderColor: it.done ? t.green : t.lineStrong, backgroundColor: it.done ? t.green : 'transparent' }}>
            {it.done ? <IconCheck color={t.onAccent} size={14} /> : null}
          </Press>
          <T style={[{ flex: 1, fontFamily: fonts.bodyMedium }, it.done && { textDecorationLine: 'line-through', color: t.muted }]}>{it.text}</T>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
        </View>
      </SwipeToDelete>
    </View>
  );
}
