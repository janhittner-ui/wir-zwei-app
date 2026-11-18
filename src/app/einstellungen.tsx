/** Einstellungen: euer Paar, dein Profil, Datenschutz, Abmelden und Konto löschen. */
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp } from '@/data/provider';
import type { PersonColor } from '@/data/types';
import { InputError } from '@/data/validate';
import { fromGerman, toGerman } from '@/lib/dates';
import { fonts, personColors, useTheme } from '@/theme';
import { IconX } from '@/ui/icons';
import { Banner, Button, Card, Divider, Input, Press, Screen, T } from '@/ui/kit';

export default function Einstellungen() {
  const { store, couple, profile, session, refresh } = useApp();
  const t = useTheme();
  const [since, setSince] = useState(toGerman(couple?.togetherSince ?? null));
  const [names, setNames] = useState(couple?.names ?? '');
  const [name, setName] = useState(profile?.displayName ?? '');
  const [color, setColor] = useState<PersonColor>(profile?.color ?? 'blue');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; warn?: boolean } | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const run = (key: string, fn: () => Promise<void>, ok?: string) => async () => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg({ text: ok });
    } catch (e) {
      setMsg({ text: friendlyError(e), warn: true });
    } finally {
      setBusy(null);
    }
  };

  const saveCouple = run('couple', async () => {
    const iso = since.trim() ? fromGerman(since) : null;
    if (since.trim() && !iso) throw new InputError('Bitte das Datum so eingeben: 20.05.2023');
    await store.updateCouple({ togetherSince: iso, names });
    await refresh();
    close();
  });

  const saveProfile = run('profile', async () => {
    await store.saveMyProfile({ displayName: name, color });
    await refresh();
  }, 'Gespeichert.');

  const partner = couple?.members.find((m) => m.id !== profile?.id);

  const leave = () =>
    Alert.alert(
      'Paar wirklich verlassen?',
      partner
        ? `Du bist danach nicht mehr mit ${partner.displayName} verbunden. Eure gemeinsamen Einträge bleiben bei ${partner.displayName}.`
        : 'Da du allein bist, werden alle Einträge gelöscht.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Verlassen', style: 'destructive', onPress: run('leave', async () => { await store.leaveCouple(); await refresh(); }) },
      ],
    );

  const deleteAccount = () =>
    Alert.alert(
      'Konto endgültig löschen?',
      'Dein Konto, deine E-Mail-Adresse und dein Profil werden sofort und unwiderruflich gelöscht.' +
        (partner ? ` Eure gemeinsamen Einträge bleiben bei ${partner.displayName}, ohne deinen Namen.` : ' Alle Einträge werden ebenfalls gelöscht.'),
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Endgültig löschen', style: 'destructive',
          onPress: run('delete', async () => {
            await store.deleteAccount();
          }),
        },
      ],
    );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen padTop={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          <T v="h2" style={{ fontSize: 22 }}>Einstellungen</T>
          <Press onPress={close} accessibilityLabel="Schließen" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <IconX color={t.muted} size={20} />
          </Press>
        </View>
        {msg ? <Banner warn={msg.warn}>{msg.text}</Banner> : null}

        <Card>
          <T v="h2">Euer Paar</T>
          <Input label="Zusammen seit" value={since} onChangeText={setSince} placeholder="20.05.2023" keyboardType="numbers-and-punctuation" testID="since" />
          <Input label="Eure Namen (optional)" value={names} onChangeText={setNames} placeholder="Jan & Vanessa" maxLength={60} />
          <Button title="Speichern" busy={busy === 'couple'} onPress={saveCouple} testID="save-couple" />
          <Divider />
          {partner ? (
            <T v="muted">Verbunden mit <T style={{ fontFamily: fonts.bodyBold, color: personColors(t, partner.color).ink }}>{partner.displayName}</T>.</T>
          ) : (
            <T v="muted">Dein Schatz ist noch nicht dabei. Den Einladungscode findest du auf der Startseite.</T>
          )}
          <Button kind="link" title="Paar verlassen" onPress={leave} busy={busy === 'leave'} />
        </Card>

        <Card>
          <T v="h2">Du</T>
          <Input label="Vorname" value={name} onChangeText={setName} maxLength={40} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['blue', 'pink'] as const).map((c) => {
              const pc = personColors(t, c);
              const on = color === c;
              return (
                <Press key={c} onPress={() => setColor(c)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                  style={{ flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 2, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderColor: on ? pc.dot : t.line, backgroundColor: on ? pc.soft : 'transparent' }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: pc.dot }} />
                  <T style={{ fontFamily: fonts.bodyBold, color: on ? pc.ink : t.muted }}>{c === 'blue' ? 'Blau' : 'Rosa'}</T>
                </Press>
              );
            })}
          </View>
          <Button kind="ghost" title="Profil speichern" busy={busy === 'profile'} onPress={saveProfile} />
          {session?.email ? <T v="small">Angemeldet mit {session.email}</T> : null}
        </Card>

        <Card>
          <T v="h2">Datenschutz</T>
          <T v="muted">
            Wir Zwei speichert nur, was ihr selbst eintragt, dazu deine E-Mail-Adresse für die Anmeldung. Die Daten liegen auf Servern in
            der EU und sind nur für euch beide sichtbar. Es gibt keine Werbung, kein Tracking und keine Weitergabe an Dritte.
          </T>
          {store.kind === 'demo' ? <Banner>Demo-Modus: Es wird gerade gar nichts gespeichert.</Banner> : null}
        </Card>

        <Card>
          <Button kind="ghost" title="Abmelden" onPress={() => store.signOut()} />
          <Button kind="danger" title="Konto löschen" busy={busy === 'delete'} onPress={deleteAccount} testID="delete-account" />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
