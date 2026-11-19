/** Meilenstein anlegen oder bearbeiten: Vorlage, Titel, Symbol, Datum, Notiz und Foto aus dem Album. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useMilestones } from '@/data/provider';
import type { MilestoneIcon } from '@/data/types';
import { ymd } from '@/lib/dates';
import { ICON_KEYS, MILESTONE_ICONS, MILESTONE_PRESETS } from '@/lib/milestones';
import { fonts, useTheme } from '@/theme';
import { AlbumPicker } from '@/ui/album-picker';
import { DatePicker, FormRow } from '@/ui/date-field';
import { IconX } from '@/ui/icons';
import { Banner, Button, Card, Input, Press, Screen, T } from '@/ui/kit';

export default function Meilenstein() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { store } = useApp();
  const { items, loaded } = useMilestones();
  const t = useTheme();
  const existing = id ? items.find((m) => m.id === id) : undefined;

  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState<MilestoneIcon>('heart');
  const [date, setDate] = useState(ymd(new Date()));
  const [note, setNote] = useState('');
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (existing && !filled) {
      setTitle(existing.title);
      setIcon(existing.icon);
      setDate(existing.date);
      setNote(existing.note ?? '');
      setPhotoId(existing.photoId);
      setFilled(true);
    }
  }, [existing, filled]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/meilensteine'));

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const input = { title, icon, date, note, photoId };
      if (existing) await store.updateMilestone(existing.id, input);
      else await store.addMilestone(input);
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
        await store.deleteMilestone(existing.id);
        close();
      } catch (e) {
        setErr(friendlyError(e));
      }
    };
    if (Platform.OS === 'web') return void go();
    Alert.alert('Meilenstein löschen?', existing.title, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: go },
    ]);
  };

  if (id && loaded && !existing) {
    return (
      <Screen padTop={false}>
        <T v="h2">Dieser Meilenstein wurde gelöscht.</T>
        <Button title="Zurück" onPress={close} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen padTop={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          <T v="h2" style={{ fontSize: 22 }}>{existing ? 'Meilenstein' : 'Neuer Meilenstein'}</T>
          <Press onPress={close} accessibilityLabel="Schließen" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <IconX color={t.muted} size={20} />
          </Press>
        </View>

        {!existing ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
            {MILESTONE_PRESETS.map((p) => {
              const on = title === p.title;
              return (
                <Press key={p.title} onPress={() => { setTitle(p.title); setIcon(p.icon); }} scale={0.92} accessibilityRole="button" accessibilityState={{ selected: on }} testID={`ms-preset-${p.icon}`}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: on ? t.blue : t.surface2, flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14 }}>{MILESTONE_ICONS[p.icon]}</Text>
                  <T style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: on ? t.onAccent : t.ink }}>{p.title}</T>
                </Press>
              );
            })}
          </ScrollView>
        ) : null}

        <Input label="Was war es?" value={title} onChangeText={setTitle} maxLength={80} placeholder="z. B. Unser erstes Date" autoFocus={!existing} testID="ms-title" />

        <View style={{ gap: 8 }}>
          <T v="label">Symbol</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
            {ICON_KEYS.map((k) => {
              const on = icon === k;
              return (
                <Press key={k} onPress={() => setIcon(k)} scale={0.88} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`Symbol ${MILESTONE_ICONS[k]}`}
                  style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.blueSoft : t.surface2, borderWidth: 2, borderColor: on ? t.blue : 'transparent' }}>
                  <Text style={{ fontSize: 20 }}>{MILESTONE_ICONS[k]}</Text>
                </Press>
              );
            })}
          </View>
        </View>

        <Card style={{ paddingVertical: 6, gap: 0 }}>
          <FormRow label="Datum" first>
            <DatePicker value={date} onChange={setDate} testID="ms-date" />
          </FormRow>
        </Card>
        <T v="small" style={{ marginTop: -10 }}>Auch ein Datum in der Zukunft geht, dann zählt die App die Tage bis dahin.</T>

        <Input label="Notiz (optional)" value={note} onChangeText={setNote} multiline maxLength={500} placeholder="Wo war das? Was ist euch in Erinnerung geblieben?" testID="ms-note" />

        <View style={{ gap: 8 }}>
          <T v="label">Foto aus eurem Album (optional)</T>
          <AlbumPicker value={photoId} onChange={setPhotoId} testID="ms-photo" />
        </View>

        {err ? <Banner warn>{err}</Banner> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          {existing ? <Button kind="link" title="Löschen" onPress={remove} testID="ms-delete" /> : <View />}
          <Button title="Speichern" busy={busy} onPress={save} testID="ms-save" />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
