/** Periode eintragen oder bearbeiten: nur Beginn und (wenn schon vorbei) Ende. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Switch, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useCyclePeriods } from '@/data/provider';
import { ymd } from '@/lib/dates';
import { goArea } from '@/lib/nav';
import { useTheme } from '@/theme';
import { DatePicker, FormRow } from '@/ui/date-field';
import { IconX } from '@/ui/icons';
import { Banner, Button, Card, Press, Screen, T } from '@/ui/kit';

export default function Periode() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { store, profile } = useApp();
  const { items, loaded } = useCyclePeriods();
  const t = useTheme();
  const existing = id ? items.find((p) => p.id === id && p.userId === profile?.id) : undefined;
  const todayIso = ymd(new Date());

  const [start, setStart] = useState(todayIso);
  const [over, setOver] = useState(false);
  const [end, setEnd] = useState(todayIso);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (existing && !filled) {
      setStart(existing.start);
      setOver(!!existing.end);
      setEnd(existing.end ?? todayIso);
      setFilled(true);
    }
  }, [existing, filled, todayIso]);

  const close = () => (router.canGoBack() ? router.back() : goArea('kalender', { seg: 'zyklus' }, 'replace'));

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const input = { start, end: over ? end : null };
      if (existing) await store.updateCyclePeriod(existing.id, input);
      else await store.addCyclePeriod(input);
      close();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!existing) return;
    const go = async () => {
      try {
        await store.deleteCyclePeriod(existing.id);
        close();
      } catch (e) {
        setErr(friendlyError(e));
      }
    };
    if (Platform.OS === 'web') return void go();
    Alert.alert('Eintrag löschen?', 'Die Vorhersage wird danach neu berechnet.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: go },
    ]);
  };

  if (id && loaded && !existing) {
    return (
      <Screen padTop={false}>
        <T v="h2">Dieser Eintrag wurde gelöscht.</T>
        <Button title="Zurück" onPress={close} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen padTop={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          <T v="h2" style={{ fontSize: 22 }}>{existing ? 'Periode bearbeiten' : 'Periode eintragen'}</T>
          <Press onPress={close} accessibilityLabel="Schließen" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <IconX color={t.muted} size={20} />
          </Press>
        </View>
        <Card style={{ paddingVertical: 6, gap: 0 }}>
          <FormRow label="Erster Tag" first>
            <DatePicker value={start} onChange={setStart} maximumDate={new Date()} testID="period-start" />
          </FormRow>
          <FormRow label="Schon vorbei">
            <Switch value={over} onValueChange={setOver} trackColor={{ true: t.green, false: t.lineStrong }} accessibilityLabel="Schon vorbei" testID="period-over" />
          </FormRow>
          {over ? (
            <FormRow label="Letzter Tag">
              <DatePicker value={end} onChange={setEnd} maximumDate={new Date()} testID="period-end" />
            </FormRow>
          ) : null}
        </Card>
        <T v="small">Gespeichert werden nur diese Daten, sonst nichts.</T>
        {err ? <Banner warn>{err}</Banner> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          {existing ? <Button kind="link" title="Löschen" onPress={remove} testID="period-delete" /> : <View />}
          <Button title="Speichern" busy={busy} onPress={save} testID="period-save" />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
