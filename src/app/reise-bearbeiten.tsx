/** Reise oder Wunschziel anlegen/bearbeiten. Ohne Datum ist es ein Wunschziel. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Switch, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useTrips } from '@/data/provider';
import { parse, ymd } from '@/lib/dates';
import { useTheme } from '@/theme';
import { DatePicker, FormRow } from '@/ui/date-field';
import { IconX } from '@/ui/icons';
import { Banner, Button, Card, Input, Press, Screen, T } from '@/ui/kit';

const plusDays = (iso: string, n: number) => {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

export default function ReiseBearbeiten() {
  const { id, wish } = useLocalSearchParams<{ id?: string; wish?: string }>();
  const { store } = useApp();
  const { items, loaded } = useTrips();
  const t = useTheme();
  const existing = id ? items.find((x) => x.id === id) : undefined;

  const [title, setTitle] = useState('');
  const [dated, setDated] = useState(wish !== '1');
  const [start, setStart] = useState(plusDays(ymd(new Date()), 30));
  const [end, setEnd] = useState<string | null>(plusDays(ymd(new Date()), 37));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (existing && !filled) {
      setTitle(existing.title);
      setDated(!!existing.startDate);
      if (existing.startDate) {
        setStart(existing.startDate);
        setEnd(existing.endDate);
      }
      setNote(existing.note ?? '');
      setFilled(true);
    }
  }, [existing, filled]);

  const close = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/kalender', params: { seg: 'reisen' } }));

  // Abreise verschoben: Rückreise wandert mit, damit die Dauer gleich bleibt
  const changeStart = (iso: string) => {
    if (end) {
      const len = Math.round((parse(end).getTime() - parse(start).getTime()) / 864e5);
      setEnd(plusDays(iso, Math.max(0, len)));
    }
    setStart(iso);
  };

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const input = { title, startDate: dated ? start : null, endDate: dated ? end : null, note };
      if (existing) await store.updateTrip(existing.id, input);
      else await store.addTrip(input);
      close();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Reise löschen?', `${existing.title} und die Packliste werden gelöscht.`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive',
        onPress: async () => {
          try {
            await store.deleteTrip(existing.id);
            router.dismissTo({ pathname: '/kalender', params: { seg: 'reisen' } });
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
        <T v="h2">Diese Reise wurde gelöscht.</T>
        <Button title="Zurück" onPress={close} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen padTop={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          <T v="h2" style={{ fontSize: 22 }}>{existing ? 'Reise bearbeiten' : dated ? 'Neue Reise' : 'Neues Wunschziel'}</T>
          <Press onPress={close} accessibilityLabel="Schließen" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <IconX color={t.muted} size={20} />
          </Press>
        </View>
        <Input label="Wohin?" value={title} onChangeText={setTitle} maxLength={120} placeholder="z. B. Toskana" autoFocus={!existing} testID="trip-title" />
        <Card style={{ paddingVertical: 6, gap: 0 }}>
          <FormRow label="Datum steht fest" first>
            <Switch value={dated} onValueChange={setDated} trackColor={{ true: t.green, false: t.lineStrong }} accessibilityLabel="Datum steht fest" testID="trip-dated" />
          </FormRow>
          {dated ? (
            <>
              <FormRow label="Abreise">
                <DatePicker value={start} onChange={changeStart} testID="trip-start" />
              </FormRow>
              <FormRow label="Rückreise">
                {end ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <DatePicker value={end} onChange={setEnd} testID="trip-end" />
                    <Press onPress={() => setEnd(null)} accessibilityLabel="Rückreise entfernen" hitSlop={8} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                      <IconX color={t.muted} size={16} />
                    </Press>
                  </View>
                ) : (
                  <Button kind="link" title="Datum wählen" onPress={() => setEnd(start)} testID="trip-end-add" />
                )}
              </FormRow>
            </>
          ) : null}
        </Card>
        {!dated ? <T v="small">Ohne Datum landet der Ort bei euren Wunschzielen. Sobald ihr plant, schaltet das Datum ein.</T> : null}
        <Input label="Notiz (optional)" value={note} onChangeText={setNote} multiline maxLength={2000} placeholder="Unterkunft, Ideen, Buchungsnummer …" testID="trip-note" />
        {err ? <Banner warn>{err}</Banner> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          {existing ? <Button kind="link" title="Löschen" onPress={remove} /> : <View />}
          <Button title="Speichern" busy={busy} onPress={save} testID="trip-save" />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
