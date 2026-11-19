/** Termin anlegen oder bearbeiten. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useEvents } from '@/data/provider';
import { ymd } from '@/lib/dates';
import { goArea } from '@/lib/nav';
import { fonts, personColors, useTheme } from '@/theme';
import { IconX } from '@/ui/icons';
import { AllDaySwitch, DatePicker, FormRow, TimePicker } from '@/ui/date-field';
import { Banner, Button, Card, Input, Press, Screen, T } from '@/ui/kit';

export default function Termin() {
  const { id, date } = useLocalSearchParams<{ id?: string; date?: string }>();
  const { store, couple, profile } = useApp();
  const { items, loaded } = useEvents();
  const t = useTheme();
  const existing = id ? items.find((e) => e.id === id) : undefined;

  const [title, setTitle] = useState('');
  const [day, setDay] = useState(date ?? ymd(new Date()));
  const [time, setTime] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [who, setWho] = useState<string | null>(profile?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (existing && !filled) {
      setTitle(existing.title);
      setDay(existing.date);
      setTime(existing.time ?? null);
      setNote(existing.note ?? '');
      setWho(existing.who);
      setFilled(true);
    }
  }, [existing, filled]);

  const close = () => (router.canGoBack() ? router.back() : goArea('kalender', {}, 'replace'));

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const input = { title, date: day, time: time ?? '', note, who };
      if (existing) await store.updateEvent(existing.id, input);
      else await store.addEvent(input);
      close();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Termin löschen?', existing.title, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive',
        onPress: async () => {
          try {
            await store.deleteEvent(existing.id);
            close();
          } catch (e) {
            setErr(friendlyError(e));
          }
        },
      },
    ]);
  };

  if (id && loaded && !existing) {
    return (
      <Screen padTop={false}>
        <T v="h2">Dieser Termin wurde gelöscht.</T>
        <Button title="Zurück" onPress={close} />
      </Screen>
    );
  }

  const choices: { id: string | null; label: string; color: 'blue' | 'pink' | null }[] = [
    ...(couple?.members ?? []).map((m) => ({ id: m.id, label: m.displayName, color: m.color })),
    { id: null, label: 'Beide', color: null },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen padTop={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          <T v="h2" style={{ fontSize: 22 }}>{existing ? 'Termin bearbeiten' : 'Neuer Termin'}</T>
          <Press onPress={close} accessibilityLabel="Schließen" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <IconX color={t.muted} size={20} />
          </Press>
        </View>
        <Input label="Was?" value={title} onChangeText={setTitle} maxLength={120} placeholder="z. B. Essen bei Oma" autoFocus={!existing} testID="ev-title" />
        <Card>
          <FormRow label="Datum" first>
            <DatePicker value={day} onChange={setDay} testID="ev-date" />
          </FormRow>
          <FormRow label="Ganztägig">
            <AllDaySwitch value={time === null} onChange={(on) => setTime(on ? null : '19:00')} />
          </FormRow>
          {time !== null ? (
            <FormRow label="Uhrzeit">
              <TimePicker value={time} onChange={setTime} testID="ev-time" />
            </FormRow>
          ) : null}
        </Card>
        <T v="label">Für wen?</T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {choices.map((c) => {
            const on = who === c.id;
            const pc = c.color ? personColors(t, c.color) : { dot: t.ink, soft: t.surface2, ink: t.ink };
            return (
              <Press
                key={c.id ?? 'both'}
                onPress={() => setWho(c.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={{ flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderColor: on ? pc.dot : t.line, backgroundColor: on ? pc.soft : 'transparent' }}>
                {c.color ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: pc.dot }} /> : null}
                <T style={{ fontFamily: fonts.bodyBold, color: on ? pc.ink : t.muted }} numberOfLines={1}>{c.label}</T>
              </Press>
            );
          })}
        </View>
        <Input label="Notiz (optional)" value={note} onChangeText={setNote} multiline maxLength={500} />
        {err ? <Banner warn>{err}</Banner> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          {existing ? <Button kind="link" title="Löschen" onPress={remove} /> : <View />}
          <Button title="Speichern" busy={busy} onPress={save} testID="ev-save" />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
