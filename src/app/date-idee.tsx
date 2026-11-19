/** Date-Idee anlegen oder bearbeiten: Titel, Art, Notiz; wenn gemacht: Datum und Foto aus dem Album. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Switch, Text, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useDateIdeas } from '@/data/provider';
import type { DateCategory } from '@/data/types';
import { DATE_CATEGORIES, DATE_CATEGORY } from '@/lib/date-ideas';
import { ymd } from '@/lib/dates';
import { goArea } from '@/lib/nav';
import { fonts, useTheme } from '@/theme';
import { AlbumPicker } from '@/ui/album-picker';
import { DatePicker, FormRow } from '@/ui/date-field';
import { IconX } from '@/ui/icons';
import { Banner, Button, Card, Input, Press, Screen, T } from '@/ui/kit';

export default function DateIdee() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { store } = useApp();
  const { items, loaded } = useDateIdeas();
  const t = useTheme();
  const existing = id ? items.find((d) => d.id === id) : undefined;

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DateCategory>('sonstiges');
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const [doneOn, setDoneOn] = useState(ymd(new Date()));
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (existing && !filled) {
      setTitle(existing.title);
      setCategory(existing.category);
      setNote(existing.note ?? '');
      setDone(!!existing.doneOn);
      if (existing.doneOn) setDoneOn(existing.doneOn);
      setPhotoId(existing.photoId);
      setFilled(true);
    }
  }, [existing, filled]);

  const close = () => (router.canGoBack() ? router.back() : goArea('listen', { seg: 'dates' }, 'replace'));

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const input = { title, category, note, doneOn: done ? doneOn : null, photoId: done ? photoId : null };
      if (existing) await store.updateDateIdea(existing.id, input);
      else await store.addDateIdea(input);
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
        await store.deleteDateIdea(existing.id);
        close();
      } catch (e) {
        setErr(friendlyError(e));
      }
    };
    if (Platform.OS === 'web') return void go();
    Alert.alert('Löschen?', existing.title, [
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
          <T v="h2" style={{ fontSize: 22 }}>{existing ? 'Date' : 'Neue Date-Idee'}</T>
          <Press onPress={close} accessibilityLabel="Schließen" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <IconX color={t.muted} size={20} />
          </Press>
        </View>

        <Input label="Was wollt ihr machen?" value={title} onChangeText={setTitle} maxLength={80} placeholder="z. B. Picknick am See" autoFocus={!existing} testID="date-title" />

        <View style={{ gap: 8 }}>
          <T v="label">Art</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityRole="radiogroup">
            {DATE_CATEGORIES.map((k) => {
              const on = category === k;
              return (
                <Press key={k} onPress={() => setCategory(k)} scale={0.92} accessibilityRole="radio" accessibilityState={{ selected: on }} testID={`date-cat-${k}`}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: on ? t.blue : t.surface2, flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14 }}>{DATE_CATEGORY[k].emoji}</Text>
                  <T style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: on ? t.onAccent : t.ink }}>{DATE_CATEGORY[k].label}</T>
                </Press>
              );
            })}
          </View>
        </View>

        <Card style={{ paddingVertical: 6, gap: 0 }}>
          <FormRow label="Schon gemacht" first>
            <Switch value={done} onValueChange={setDone} trackColor={{ true: t.green, false: t.lineStrong }} accessibilityLabel="Schon gemacht" testID="date-done" />
          </FormRow>
          {done ? (
            <FormRow label="Am">
              <DatePicker value={doneOn} onChange={setDoneOn} maximumDate={new Date()} testID="date-done-on" />
            </FormRow>
          ) : null}
        </Card>

        <Input
          label="Notiz (optional)"
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
          placeholder={done ? 'Wie war es? Was wollt ihr nicht vergessen?' : 'Wo? Was braucht ihr dafür?'}
          testID="date-note"
        />

        {done ? (
          <View style={{ gap: 8 }}>
            <T v="label">Foto aus eurem Album (optional)</T>
            <AlbumPicker value={photoId} onChange={setPhotoId} testID="date-photo" />
          </View>
        ) : null}

        {err ? <Banner warn>{err}</Banner> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          {existing ? <Button kind="link" title="Löschen" onPress={remove} testID="date-delete" /> : <View />}
          <Button title="Speichern" busy={busy} onPress={save} testID="date-save" />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
