/** Geschenkidee oder eigenen Wunsch anlegen/bearbeiten. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useGifts } from '@/data/provider';
import type { GiftKind } from '@/data/types';
import { goArea } from '@/lib/nav';
import { fonts, personColors, useTheme } from '@/theme';
import { IconX } from '@/ui/icons';
import { Banner, Button, Input, Press, Screen, T } from '@/ui/kit';

const OCCASIONS = ['Geburtstag', 'Weihnachten', 'Jahrestag', 'Valentinstag', 'Einfach so'];

export default function Geschenk() {
  const params = useLocalSearchParams<{ id?: string; kind?: string; forUser?: string; forName?: string }>();
  const { store, couple, profile } = useApp();
  const { items, loaded } = useGifts();
  const t = useTheme();
  const existing = params.id ? items.find((g) => g.id === params.id) : undefined;
  const partner = couple?.members.find((m) => m.id !== profile?.id);
  // Wünsche ändert nur, wer sie sich wünscht; Ideen dürfen beide bearbeiten
  const mine = !existing || existing.kind === 'idea' || existing.createdBy === profile?.id;

  const [kind, setKind] = useState<GiftKind>(params.kind === 'wish' ? 'wish' : 'idea');
  const [title, setTitle] = useState('');
  const [forUser, setForUser] = useState<string | null>(params.forUser ?? (params.forName ? null : partner?.id ?? null));
  const [forName, setForName] = useState(params.forName ?? '');
  const [occasion, setOccasion] = useState('');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (existing && !filled) {
      setKind(existing.kind);
      setTitle(existing.title);
      setForUser(existing.forUser);
      setForName(existing.forName ?? '');
      setOccasion(existing.occasion ?? '');
      setLink(existing.link ?? '');
      setNote(existing.note ?? '');
      setFilled(true);
    }
  }, [existing, filled]);

  // Namen, für die es schon Ideen gibt, als Schnellauswahl
  const names = useMemo(() => [...new Set(items.filter((g) => g.forName).map((g) => g.forName!))].sort((a, b) => a.localeCompare(b, 'de')), [items]);

  const close = () => (router.canGoBack() ? router.back() : goArea('listen', { seg: 'geschenke' }, 'replace'));

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const input = { kind, title, forUser: kind === 'idea' ? forUser : null, forName: kind === 'idea' && !forUser ? forName : null, occasion, link, note, wishId: existing?.wishId ?? null };
      if (existing) await store.updateGift(existing.id, input);
      else await store.addGift(input);
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
            await store.deleteGift(existing.id);
            close();
          } catch (e) {
            setErr(friendlyError(e));
          }
        },
      },
    ]);
  };

  if (params.id && loaded && !existing) {
    return (
      <Screen padTop={false}>
        <T v="h2">Dieser Eintrag wurde gelöscht.</T>
        <Button title="Zurück" onPress={close} />
      </Screen>
    );
  }

  const chip = (label: string, on: boolean, onPress: () => void, color?: string, testID?: string) => (
    <Press key={label} onPress={onPress} scale={0.92} accessibilityRole="radio" accessibilityState={{ selected: on }} testID={testID}
      style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: on ? color ?? t.blue : t.surface2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <T style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: on ? t.onAccent : t.ink }}>{label}</T>
    </Press>
  );
  const isUrl = /^https?:\/\/\S+$/i.test(link.trim());

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen padTop={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          <T v="h2" style={{ fontSize: 22 }}>{existing ? (kind === 'wish' ? 'Wunsch' : 'Geschenkidee') : kind === 'wish' ? 'Neuer Wunsch' : 'Neue Geschenkidee'}</T>
          <Press onPress={close} accessibilityLabel="Schließen" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <IconX color={t.muted} size={20} />
          </Press>
        </View>
        <Input label={kind === 'wish' ? 'Was wünschst du dir?' : 'Idee'} value={title} onChangeText={setTitle} maxLength={120} editable={mine} placeholder={kind === 'wish' ? 'z. B. Kochbuch von Ottolenghi' : 'z. B. Konzertkarten'} autoFocus={!existing} testID="gift-title" />

        {kind === 'idea' ? (
          <View style={{ gap: 8 }}>
            <T v="label">Für wen?</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
              {partner ? chip(partner.displayName, forUser === partner.id, () => setForUser(partner.id), personColors(t, partner.color).dot, 'gift-for-partner') : null}
              {names.map((n) => chip(n, !forUser && forName === n, () => { setForUser(null); setForName(n); }))}
              {chip('Jemand anderes', !forUser && !names.includes(forName), () => { setForUser(null); setForName(''); }, undefined, 'gift-for-other')}
            </ScrollView>
            {forUser ? (
              <T v="small">🔒 {partner?.displayName} sieht diese Idee nicht.</T>
            ) : !names.includes(forName) || !forName ? (
              <Input value={forName} onChangeText={setForName} maxLength={60} placeholder="Name, z. B. Mama" testID="gift-for-name" />
            ) : null}
            <T v="label" style={{ marginTop: 6 }}>Anlass (optional)</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
              {OCCASIONS.map((o) => chip(o, occasion === o, () => setOccasion(occasion === o ? '' : o)))}
            </ScrollView>
          </View>
        ) : partner ? (
          <T v="small">{partner.displayName} sieht deine Wünsche, aber nicht, ob jemand sie schon besorgt.</T>
        ) : null}

        <View style={{ gap: 6 }}>
          <Input label="Link (optional)" value={link} onChangeText={setLink} maxLength={500} editable={mine} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" testID="gift-link" />
          {isUrl ? <Button kind="link" title="Link öffnen" onPress={() => Linking.openURL(link.trim())} /> : null}
        </View>
        <Input label="Notiz (optional)" value={note} onChangeText={setNote} multiline maxLength={500} editable={mine} placeholder={kind === 'wish' ? 'Größe, Farbe, …' : 'Wo gesehen? Preis?'} testID="gift-note" />
        {!mine ? <T v="small">Diesen Wunsch kann nur {partner?.displayName ?? 'dein Schatz'} ändern.</T> : null}
        {err ? <Banner warn>{err}</Banner> : null}
        {mine ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            {existing ? <Button kind="link" title="Löschen" onPress={remove} /> : <View />}
            <Button title="Speichern" busy={busy} onPress={save} testID="gift-save" />
          </View>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
