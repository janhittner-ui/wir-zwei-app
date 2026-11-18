/** Anmelden ohne Passwort: E-Mail eingeben, Code aus der E-Mail eintippen. */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp } from '@/data/provider';
import { useTheme } from '@/theme';
import { Banner, Button, Card, Input, Screen, T } from '@/ui/kit';
import { IconHeart } from '@/ui/icons';

export default function Login() {
  const { store } = useApp();
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ alignItems: 'center', gap: 10, paddingTop: 40, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 2 }}>
            <IconHeart color={t.blue} size={34} />
            <IconHeart color={t.pink} size={34} />
          </View>
          <T v="display">Wir Zwei</T>
          <T v="muted" style={{ textAlign: 'center' }}>Euer gemeinsamer Ort für Termine, Einkauf und alles, was euch wichtig ist.</T>
        </View>

        {store.kind === 'demo' ? (
          <Banner>Demo-Modus: Es ist noch kein Server eingerichtet. Nichts wird gespeichert. Der Code ist immer 123456.</Banner>
        ) : null}

        <Card>
          {step === 'email' ? (
            <>
              <T v="h2">Anmelden</T>
              <T v="muted">Du bekommst einen Code per E-Mail. Ein Passwort brauchst du nicht.</T>
              <Input
                label="E-Mail"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="name@beispiel.de"
                returnKeyType="send"
                onSubmitEditing={() => run(async () => { await store.sendLoginCode(email); setStep('code'); })}
                testID="email"
              />
              <Button
                title="Code schicken"
                busy={busy}
                testID="send-code"
                onPress={() => run(async () => { await store.sendLoginCode(email); setStep('code'); })}
              />
            </>
          ) : (
            <>
              <T v="h2">Code eingeben</T>
              <T v="muted">Wir haben dir an {email.trim()} einen Code geschickt. Schau auch im Spam-Ordner nach.</T>
              <Input
                label="Code aus der E-Mail"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={10}
                placeholder="123456"
                testID="code"
                onSubmitEditing={() => run(() => store.verifyLoginCode(email, code))}
              />
              <Button title="Anmelden" busy={busy} testID="verify" onPress={() => run(() => store.verifyLoginCode(email, code))} />
              <Button title="Andere E-Mail" kind="link" onPress={() => { setStep('email'); setCode(''); setErr(null); }} />
            </>
          )}
          {err ? <Banner warn>{err}</Banner> : null}
        </Card>

        <T v="small" style={{ textAlign: 'center' }}>
          Keine Werbung, kein Tracking. Eure Daten liegen verschlüsselt auf Servern in der EU und gehören nur euch beiden.
        </T>
      </Screen>
    </KeyboardAvoidingView>
  );
}
