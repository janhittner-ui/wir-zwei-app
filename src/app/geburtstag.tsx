/** Geburtstag anlegen oder bearbeiten. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useBirthdays } from '@/data/provider';
import { MSHORT } from '@/lib/dates';
import { fonts, useTheme } from '@/theme';
import { IconX } from '@/ui/icons';
import { Banner, Button, Input, Press, Screen, T } from '@/ui/kit';

export default function Geburtstag() {
  const { id, month: monthParam, day: dayParam } = useLocalSearchParams<{ id?: string; month?: string; day?: string }>();
  const { store } = useApp();
  const { items, loaded } = useBirthdays();
  const t = useTheme();
  const existing = id ? items.find((b) => b.id === id) : undefined;

  const [name, setName] = useState('');
  const [day, setDay] = useState(dayParam ?? '');
  const [month, setMonth] = useState(Number(monthParam) || new Date().getMonth() + 1);
  const [year, setYear] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (existing && !filled) {
      setName(existing.name);
      setDay(String(existing.day));
      setMonth(existing.month);
      setYear(existing.year ? String(existing.year) : '');
      setNote(existing.note ?? '');
      setFilled(true);
    }
  }, [existing, filled]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/kalender'));

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const input = { name, month, day: Number(day.trim() || NaN), year: year.trim() ? Number(year) : null, note };
      if (existing) await store.updateBirthday(existing.id, input);
      else await store.addBirthday(input);
      close();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Geburtstag löschen?', existing.name, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive',
        onPress: async () => {
          try {
            await store.deleteBirthday(existing.id);
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
        <T v="h2">Dieser Geburtstag wurde gelöscht.</T>
        <Button title="Zurück" onPress={close} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen padTop={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          <T v="h2" style={{ fontSize: 22 }}>{existing ? 'Geburtstag bearbeiten' : 'Neuer Geburtstag'}</T>
          <Press onPress={close} accessibilityLabel="Schließen" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <IconX color={t.muted} size={20} />
          </Press>
        </View>

        <Input label="Name" value={name} onChangeText={setName} maxLength={80} placeholder="z. B. Oma Helga" autoFocus={!existing} testID="bd-name" />

        <T v="label">Monat</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityRole="radiogroup">
          {MSHORT.map((m, i) => {
            const on = month === i + 1;
            return (
              <Press
                key={m}
                onPress={() => setMonth(i + 1)}
                scale={0.9}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={m}
                testID={`bd-month-${i + 1}`}
                style={{ width: '15%', minWidth: 48, flexGrow: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', borderColor: on ? t.yellow : t.line, backgroundColor: on ? t.yellowSoft : 'transparent' }}>
                <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: on ? t.yellowInk : t.muted }}>{m}</Text>
              </Press>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Input label="Tag" value={day} onChangeText={(v) => setDay(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="14" maxLength={2} testID="bd-day" />
          </View>
          <View style={{ flex: 2 }}>
            <Input label="Geburtsjahr (optional)" value={year} onChangeText={(v) => setYear(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder="1990" maxLength={4} testID="bd-year" />
          </View>
        </View>

        <Input label="Notiz (optional)" value={note} onChangeText={setNote} maxLength={300} placeholder="Geschenkidee, Adresse …" />
        {err ? <Banner warn>{err}</Banner> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          {existing ? <Button kind="link" title="Löschen" onPress={remove} /> : <View />}
          <Button title="Speichern" busy={busy} onPress={save} testID="bd-save" />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
