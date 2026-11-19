/** Notiz schreiben oder bearbeiten. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useNotes } from '@/data/provider';
import type { NoteColor } from '@/data/types';
import { fullDate } from '@/lib/dates';
import { goArea } from '@/lib/nav';
import { useTheme } from '@/theme';
import { IconCheck, IconX } from '@/ui/icons';
import { Banner, Button, Input, Press, Screen, T } from '@/ui/kit';

const COLORS: { key: NoteColor; label: string }[] = [
  { key: 'n1', label: 'Gelb' },
  { key: 'n2', label: 'Grün' },
  { key: 'n3', label: 'Blau' },
  { key: 'n4', label: 'Rosa' },
];

export default function Notiz() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { store, couple } = useApp();
  const { items, loaded } = useNotes();
  const t = useTheme();
  const existing = id ? items.find((n) => n.id === id) : undefined;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [color, setColor] = useState<NoteColor>('n1');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (existing && !filled) {
      setTitle(existing.title ?? '');
      setBody(existing.body);
      setColor(existing.color);
      setFilled(true);
    }
  }, [existing, filled]);

  const close = () => (router.canGoBack() ? router.back() : goArea('listen', { seg: 'notizen' }, 'replace'));

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const input = { title, body, color };
      if (existing) await store.updateNote(existing.id, input);
      else await store.addNote(input);
      close();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Notiz löschen?', existing.title ?? existing.body.slice(0, 60), [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive',
        onPress: async () => {
          try {
            await store.deleteNote(existing.id);
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
        <T v="h2">Diese Notiz wurde gelöscht.</T>
        <Button title="Zurück" onPress={close} />
      </Screen>
    );
  }

  const by = existing ? couple?.members.find((m) => m.id === existing.updatedBy) : undefined;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen padTop={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          <T v="h2" style={{ fontSize: 22 }}>{existing ? 'Notiz' : 'Neue Notiz'}</T>
          <Press onPress={close} accessibilityLabel="Schließen" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <IconX color={t.muted} size={20} />
          </Press>
        </View>
        <Input label="Titel (optional)" value={title} onChangeText={setTitle} maxLength={120} placeholder="z. B. Geschenkideen" testID="note-title" />
        <Input
          label="Text"
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={5000}
          autoFocus={!existing}
          placeholder="Was möchtest du festhalten?"
          style={{ minHeight: 180, backgroundColor: t[color] }}
          testID="note-body"
        />
        <T v="label">Farbe</T>
        <View style={{ flexDirection: 'row', gap: 10 }} accessibilityRole="radiogroup">
          {COLORS.map((c) => {
            const on = color === c.key;
            return (
              <Press
                key={c.key}
                onPress={() => setColor(c.key)}
                scale={0.82}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={c.label}
                testID={`note-color-${c.key}`}
                style={{ width: 40, height: 40, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: t[c.key], borderColor: on ? t.ink : t.line }}>
                {on ? <IconCheck color={t.ink} size={16} /> : null}
              </Press>
            );
          })}
        </View>
        {existing ? (
          <T v="small">Zuletzt geändert am {fullDate(new Date(existing.updatedAt))}{by ? ` von ${by.displayName}` : ''}</T>
        ) : null}
        {err ? <Banner warn>{err}</Banner> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          {existing ? <Button kind="link" title="Löschen" onPress={remove} /> : <View />}
          <Button title="Speichern" busy={busy} onPress={save} testID="note-save" />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
