/** Erste Schritte: Name und Farbe wählen, dann Paar gründen oder mit Code beitreten. */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp } from '@/data/provider';
import type { PersonColor } from '@/data/types';
import { fonts, personColors, useTheme } from '@/theme';
import { Banner, Button, Card, Input, Press, Screen, T } from '@/ui/kit';

export default function Onboarding() {
  const { status, store, profile, refresh } = useApp();
  const t = useTheme();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [color, setColor] = useState<PersonColor>(profile?.color ?? 'blue');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = (key: string, fn: () => Promise<void>) => async () => {
    setBusy(key);
    setErr(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ gap: 4, paddingTop: 20 }}>
          <T v="eyebrow">{status === 'needsProfile' ? 'Schritt 1 von 2' : 'Schritt 2 von 2'}</T>
          <T v="display">{status === 'needsProfile' ? 'Wer bist du?' : 'Verbindet euch'}</T>
        </View>

        {status === 'needsProfile' ? (
          <Card>
            <Input label="Dein Vorname" value={name} onChangeText={setName} maxLength={40} autoComplete="given-name" testID="name" placeholder="z. B. Jan" />
            <T v="label">Deine Farbe</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['blue', 'pink'] as const).map((c) => {
                const pc = personColors(t, c);
                const on = color === c;
                return (
                  <Press
                    key={c}
                    onPress={() => setColor(c)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={{
                      flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 2, flexDirection: 'row', gap: 8,
                      alignItems: 'center', justifyContent: 'center',
                      borderColor: on ? pc.dot : t.line, backgroundColor: on ? pc.soft : 'transparent',
                    }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: pc.dot }} />
                    <T style={{ fontFamily: fonts.bodyBold, color: on ? pc.ink : t.muted }}>{c === 'blue' ? 'Blau' : 'Rosa'}</T>
                  </Press>
                );
              })}
            </View>
            <T v="small">Nur dein Vorname und deine Farbe werden gespeichert, damit ihr seht, wer was eingetragen hat.</T>
            <Button title="Weiter" testID="save-profile" busy={busy === 'p'} onPress={run('p', async () => { await store.saveMyProfile({ displayName: name, color }); })} />
          </Card>
        ) : (
          <>
            <Card>
              <T v="h2">Ich fange an</T>
              <T v="muted">Du legst euer gemeinsames Konto an und bekommst einen Einladungscode für deinen Schatz.</T>
              <Button title="Gemeinsames Konto anlegen" testID="create-couple" busy={busy === 'c'} onPress={run('c', async () => { await store.createCouple(); await store.createInvite(); })} />
            </Card>
            <Card>
              <T v="h2">Ich habe einen Code</T>
              <T v="muted">Dein Schatz hat schon angefangen? Dann gib hier den Code ein, den er oder sie dir geschickt hat.</T>
              <Input value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} maxLength={12} placeholder="K7MB-Q2XD" testID="invite-code"
                style={{ fontFamily: fonts.display, fontSize: 20, letterSpacing: 2, textAlign: 'center' }} />
              <Button title="Verbinden" kind="ghost" testID="join" busy={busy === 'j'} onPress={run('j', () => store.joinCouple(code))} />
            </Card>
          </>
        )}
        {err ? <Banner warn>{err}</Banner> : null}
        <Button title="Abmelden" kind="link" onPress={() => store.signOut()} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
