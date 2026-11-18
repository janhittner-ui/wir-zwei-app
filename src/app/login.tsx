/**
 * Anmelden mit E-Mail + Passwort. Das klappt ohne eigenen E-Mail-Versand.
 * Sobald ein eigener SMTP-Versand eingerichtet ist (EXPO_PUBLIC_EMAIL_CODES=1), gibt es zusätzlich
 * die Anmeldung per Einmal-Code aus der E-Mail.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { APP_NAME } from '@/config';
import { friendlyError } from '@/data/errors';
import { useApp } from '@/data/provider';
import { useTheme } from '@/theme';
import { Banner, Button, Card, Input, Screen, T } from '@/ui/kit';
import { IconHeart } from '@/ui/icons';

type Mode = 'signin' | 'signup' | 'confirm' | 'codeEmail' | 'code';
const CODES_ENABLED = process.env.EXPO_PUBLIC_EMAIL_CODES === '1';

export default function Login() {
  const { store } = useApp();
  const t = useTheme();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = (m: Mode) => {
    setMode(m);
    setErr(null);
  };
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

  const signIn = () => run(() => store.signInWithPassword(email, password));
  const signUp = () =>
    run(async () => {
      const r = await store.signUpWithPassword(email, password);
      if (r === 'confirm') go('confirm');
    });

  const emailInput = (
    <Input
      label="E-Mail"
      value={email}
      onChangeText={setEmail}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="email"
      keyboardType="email-address"
      textContentType={mode === 'signup' ? 'username' : 'emailAddress'}
      placeholder="name@beispiel.de"
      testID="email"
    />
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ alignItems: 'center', gap: 10, paddingTop: 40, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 2 }}>
            <IconHeart color={t.blue} size={34} />
            <IconHeart color={t.pink} size={34} />
          </View>
          <T v="display">{APP_NAME}</T>
          <T v="muted" style={{ textAlign: 'center' }}>Euer gemeinsamer Ort für Termine, Einkauf und alles, was euch wichtig ist.</T>
        </View>

        {store.kind === 'demo' ? (
          <Banner>Demo-Modus: Es ist noch kein Server eingerichtet. Nichts wird gespeichert. Leg einfach ein Konto mit irgendeiner E-Mail an.</Banner>
        ) : null}

        <Card>
          {mode === 'signin' || mode === 'signup' ? (
            <>
              <T v="h2">{mode === 'signin' ? 'Anmelden' : 'Neues Konto'}</T>
              {emailInput}
              <Input
                label={mode === 'signup' ? 'Passwort (mindestens 8 Zeichen)' : 'Passwort'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                passwordRules="minlength: 8;"
                returnKeyType="go"
                onSubmitEditing={mode === 'signin' ? signIn : signUp}
                testID="password"
              />
              <Button
                title={mode === 'signin' ? 'Anmelden' : 'Konto anlegen'}
                busy={busy}
                onPress={mode === 'signin' ? signIn : signUp}
                testID={mode === 'signin' ? 'sign-in' : 'sign-up'}
              />
              <Button
                kind="link"
                title={mode === 'signin' ? 'Noch kein Konto? Neu registrieren' : 'Schon ein Konto? Anmelden'}
                onPress={() => go(mode === 'signin' ? 'signup' : 'signin')}
                testID="switch-mode"
              />
              {CODES_ENABLED && mode === 'signin' ? <Button kind="link" title="Stattdessen Code per E-Mail" onPress={() => go('codeEmail')} /> : null}
            </>
          ) : mode === 'confirm' ? (
            <>
              <T v="h2">Fast geschafft</T>
              <T v="muted">
                Wir haben dir an {email.trim()} einen Bestätigungslink geschickt. Tippe auf den Link in der E-Mail und melde dich danach hier an.
              </T>
              <Button title="Zur Anmeldung" onPress={() => go('signin')} />
            </>
          ) : mode === 'codeEmail' ? (
            <>
              <T v="h2">Code per E-Mail</T>
              {emailInput}
              <Button title="Code schicken" busy={busy} onPress={() => run(async () => { await store.sendLoginCode(email); go('code'); })} />
              <Button kind="link" title="Mit Passwort anmelden" onPress={() => go('signin')} />
            </>
          ) : (
            <>
              <T v="h2">Code eingeben</T>
              <T v="muted">Wir haben dir an {email.trim()} einen Code geschickt. Schau auch im Spam-Ordner nach.</T>
              <Input label="Code aus der E-Mail" value={code} onChangeText={setCode} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={10} placeholder="123456" />
              <Button title="Anmelden" busy={busy} onPress={() => run(() => store.verifyLoginCode(email, code))} />
              <Button kind="link" title="Andere E-Mail" onPress={() => { go('codeEmail'); setCode(''); }} />
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
