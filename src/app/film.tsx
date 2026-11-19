/** Film oder Serie eintragen oder bearbeiten. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Switch, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useMedia } from '@/data/provider';
import type { MediaKind } from '@/data/types';
import { goArea } from '@/lib/nav';
import { fonts, useTheme } from '@/theme';
import { FormRow } from '@/ui/date-field';
import { IconX } from '@/ui/icons';
import { Banner, Button, Card, Input, Press, Screen, Segmented, T } from '@/ui/kit';
import { Stars } from '@/ui/stars';

const PLATFORMS = ['Netflix', 'Prime Video', 'Disney+', 'Apple TV+', 'Mediathek', 'Kino'];

export default function Film() {
  const { id, kind: kindParam } = useLocalSearchParams<{ id?: string; kind?: string }>();
  const { store } = useApp();
  const { items, loaded } = useMedia();
  const t = useTheme();
  const existing = id ? items.find((m) => m.id === id) : undefined;

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<MediaKind>(kindParam === 'serie' ? 'serie' : 'film');
  const [platform, setPlatform] = useState('');
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (existing && !filled) {
      setTitle(existing.title);
      setKind(existing.kind);
      setPlatform(existing.platform ?? '');
      setNote(existing.note ?? '');
      setDone(existing.done);
      setRating(existing.rating);
      setFilled(true);
    }
  }, [existing, filled]);

  const close = () => (router.canGoBack() ? router.back() : goArea('listen', { seg: 'filme' }, 'replace'));

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const input = { title, kind, platform, note, rating: done ? rating : null };
      if (existing) {
        if (existing.done !== done) await store.setMediaDone(existing.id, done);
        await store.updateMedia(existing.id, input);
      } else {
        const m = await store.addMedia(input);
        if (done) {
          await store.setMediaDone(m.id, true);
          if (rating) await store.updateMedia(m.id, input);
        }
      }
      close();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Löschen?', existing.title, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive',
        onPress: async () => {
          try {
            await store.deleteMedia(existing.id);
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
        <T v="h2">Dieser Eintrag wurde gelöscht.</T>
        <Button title="Zurück" onPress={close} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen padTop={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          <T v="h2" style={{ fontSize: 22 }}>{existing ? 'Bearbeiten' : kind === 'serie' ? 'Neue Serie' : 'Neuer Film'}</T>
          <Press onPress={close} accessibilityLabel="Schließen" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <IconX color={t.muted} size={20} />
          </Press>
        </View>
        <Segmented<MediaKind> value={kind} onChange={setKind} options={[{ key: 'film', label: 'Film' }, { key: 'serie', label: 'Serie' }]} />
        <Input label="Titel" value={title} onChangeText={setTitle} maxLength={120} placeholder={kind === 'serie' ? 'z. B. Downton Abbey' : 'z. B. Dune'} autoFocus={!existing} testID="media-title" />
        <View style={{ gap: 8 }}>
          <Input label="Wo läuft es? (optional)" value={platform} onChangeText={setPlatform} maxLength={40} placeholder="z. B. Netflix" testID="media-platform" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
            {PLATFORMS.map((p) => {
              const on = platform.trim().toLowerCase() === p.toLowerCase();
              return (
                <Press key={p} onPress={() => setPlatform(on ? '' : p)} scale={0.92} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: on ? t.blue : t.surface2 }}>
                  <T style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: on ? t.onAccent : t.ink }}>{p}</T>
                </Press>
              );
            })}
          </ScrollView>
        </View>
        <Card style={{ paddingVertical: 6, gap: 0 }}>
          <FormRow label="Schon gesehen" first>
            <Switch value={done} onValueChange={setDone} trackColor={{ true: t.green, false: t.lineStrong }} accessibilityLabel="Schon gesehen" testID="media-done" />
          </FormRow>
          {done ? (
            <FormRow label="Bewertung">
              <Stars value={rating} onChange={setRating} size={22} testID="media-star" />
            </FormRow>
          ) : null}
        </Card>
        <Input label="Notiz (optional)" value={note} onChangeText={setNote} multiline maxLength={500} placeholder="Wer hat's empfohlen? Ab welcher Folge?" testID="media-note" />
        {err ? <Banner warn>{err}</Banner> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          {existing ? <Button kind="link" title="Löschen" onPress={remove} /> : <View />}
          <Button title="Speichern" busy={busy} onPress={save} testID="media-save" />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
