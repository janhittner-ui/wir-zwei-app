/** Rezept anlegen oder bearbeiten. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useRecipes } from '@/data/provider';
import { InputError } from '@/data/validate';
import { goArea } from '@/lib/nav';
import type { Meal } from '@/data/types';
import { MEALS } from '@/lib/recipe';
import { fonts, useTheme } from '@/theme';
import { FormRow } from '@/ui/date-field';
import { DishPhotoField } from '@/ui/dish-photo';
import { IconX } from '@/ui/icons';
import { Banner, Button, Card, Input, Press, Screen, T } from '@/ui/kit';
import { Stepper } from '@/ui/stepper';

export default function RezeptBearbeiten() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { store } = useApp();
  const { items, loaded } = useRecipes();
  const t = useTheme();
  const existing = id ? items.find((r) => r.id === id) : undefined;

  const [title, setTitle] = useState('');
  const [servings, setServings] = useState(2);
  const [minutes, setMinutes] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [steps, setSteps] = useState('');
  const [source, setSource] = useState('');
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (existing && !filled) {
      setTitle(existing.title);
      setServings(existing.servings);
      setMinutes(existing.minutes ? String(existing.minutes) : '');
      setIngredients(existing.ingredients);
      setSteps(existing.steps);
      setSource(existing.source ?? '');
      setPhotoId(existing.photoId);
      setMeals(existing.meals);
      setFilled(true);
    }
  }, [existing, filled]);

  const close = () => (router.canGoBack() ? router.back() : goArea('rezepte', {}, 'replace'));

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const m = minutes.trim();
      if (m && !/^\d+$/.test(m)) throw new InputError('Die Zeit bitte nur als Zahl in Minuten, z. B. 45.');
      const input = { title, servings, minutes: m ? Number(m) : null, ingredients, steps, source, photoId, meals };
      if (existing) await store.updateRecipe(existing.id, input);
      else await store.addRecipe(input);
      close();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Rezept löschen?', existing.title, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive',
        onPress: async () => {
          try {
            await store.deleteRecipe(existing.id);
            goArea('rezepte', {}, 'dismissTo');
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
        <T v="h2">Dieses Rezept wurde gelöscht.</T>
        <Button title="Zurück" onPress={close} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen padTop={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          <T v="h2" style={{ fontSize: 22 }}>{existing ? 'Rezept bearbeiten' : 'Neues Rezept'}</T>
          <Press onPress={close} accessibilityLabel="Schließen" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <IconX color={t.muted} size={20} />
          </Press>
        </View>
        <Input label="Name" value={title} onChangeText={setTitle} maxLength={120} placeholder="z. B. Omas Lasagne" autoFocus={!existing} testID="recipe-title" />
        <View style={{ gap: 8 }}>
          <T v="label">Mahlzeit (optional)</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {MEALS.map((m) => {
              const on = meals.includes(m.key);
              return (
                <Press key={m.key} onPress={() => setMeals((l) => (on ? l.filter((x) => x !== m.key) : [...l, m.key]))} scale={0.94}
                  accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={m.label} testID={`recipe-meal-${m.key}`}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12, backgroundColor: on ? t.blue : t.surface2 }}>
                  <T style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: on ? t.onAccent : t.ink }}>{m.short}</T>
                </Press>
              );
            })}
          </View>
        </View>
        <DishPhotoField value={photoId} onChange={setPhotoId} caption={title} />
        <Card style={{ paddingVertical: 6, gap: 0 }}>
          <FormRow label="Portionen" first>
            <Stepper value={servings} onChange={setServings} label="Portionen" testID="recipe-servings" />
          </FormRow>
          <FormRow label="Zeit (Minuten)">
            <View style={{ width: 90 }}>
              <Input value={minutes} onChangeText={(v) => setMinutes(v.replace(/[^\d]/g, '').slice(0, 4))} placeholder="45" keyboardType="number-pad" accessibilityLabel="Zeit in Minuten" style={{ textAlign: 'right', minHeight: 38, paddingVertical: 6 }} testID="recipe-minutes" />
            </View>
          </FormRow>
        </Card>
        <Input
          label="Zutaten"
          hint="Eine Zutat pro Zeile, Menge vorne (z. B. 200 g Mehl). Eine Zeile mit Doppelpunkt wird zur Überschrift, z. B. Für die Soße:"
          value={ingredients}
          onChangeText={setIngredients}
          multiline
          maxLength={5000}
          placeholder={'500 g Spaghetti\n2 Zwiebeln\n1 Dose Tomaten\nSalz'}
          style={{ minHeight: 150 }}
          testID="recipe-ingredients"
        />
        <Input
          label="Zubereitung"
          hint="Ein Schritt pro Zeile. Im Kochmodus siehst du dann Schritt für Schritt."
          value={steps}
          onChangeText={setSteps}
          multiline
          maxLength={10000}
          placeholder={'Wasser zum Kochen bringen und salzen.\nZwiebeln würfeln und anbraten.'}
          style={{ minHeight: 150 }}
          testID="recipe-steps"
        />
        <Input label="Quelle (optional)" value={source} onChangeText={setSource} maxLength={500} placeholder="Link oder Kochbuch" autoCapitalize="none" testID="recipe-source" />
        {err ? <Banner warn>{err}</Banner> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          {existing ? <Button kind="link" title="Löschen" onPress={remove} /> : <View />}
          <Button title="Speichern" busy={busy} onPress={save} testID="recipe-save" />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
