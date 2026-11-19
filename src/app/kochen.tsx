/** Kochmodus: ein Schritt nach dem anderen, große Schrift, der Bildschirm bleibt an. */
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRecipes } from '@/data/provider';
import { parseIngredients, parseSteps, scaleLine } from '@/lib/recipe';
import { goArea } from '@/lib/nav';
import { fonts, useTheme } from '@/theme';
import { IconX } from '@/ui/icons';
import { Button, Press, Segmented, T } from '@/ui/kit';

type Seg = 'schritte' | 'zutaten';

/** Hält den Bildschirm an, solange der Kochmodus offen ist (nur auf dem Handy). */
function KeepAwake() {
  useKeepAwake();
  return null;
}

export default function Kochen() {
  const { id, servings } = useLocalSearchParams<{ id: string; servings?: string }>();
  const { items } = useRecipes();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const r = items.find((x) => x.id === id);
  const [i, setI] = useState(0);
  const [seg, setSeg] = useState<Seg>('schritte');

  const steps = useMemo(() => parseSteps(r?.steps ?? ''), [r?.steps]);
  const ings = useMemo(() => parseIngredients(r?.ingredients ?? ''), [r?.ingredients]);
  const n = Math.max(1, Number(servings) || r?.servings || 1);
  const factor = r ? n / r.servings : 1;
  const close = () => (router.canGoBack() ? router.back() : goArea('rezepte', {}, 'replace'));
  const step = Math.min(i, Math.max(0, steps.length - 1));
  const last = step >= steps.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12, paddingHorizontal: 20, gap: 16 }}>
      {Platform.OS !== 'web' ? <KeepAwake /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <T v="eyebrow">Kochmodus</T>
          <T v="h2" numberOfLines={1}>{r?.title ?? ''}</T>
        </View>
        <Press onPress={close} accessibilityLabel="Kochmodus beenden" testID="cook-close" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center' }}>
          <IconX color={t.ink} size={18} />
        </Press>
      </View>
      <Segmented<Seg> value={seg} onChange={setSeg} options={[{ key: 'schritte', label: 'Schritte' }, { key: 'zutaten', label: `Zutaten (${n} ${n === 1 ? 'Portion' : 'Port.'})` }]} />

      {seg === 'schritte' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {steps.map((_, k) => (
              <View key={k} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: k <= step ? t.blue : t.line }} />
            ))}
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingVertical: 8 }}>
            <T v="label">Schritt {step + 1} von {steps.length}</T>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 26, lineHeight: 36, color: t.ink }} maxFontSizeMultiplier={1.4} accessibilityLiveRegion="polite" testID="cook-step">
              {steps[step] ?? 'Für dieses Rezept sind noch keine Schritte eingetragen.'}
            </Text>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button kind="ghost" title="Zurück" disabled={step === 0} onPress={() => setI(step - 1)} testID="cook-prev" />
            </View>
            <View style={{ flex: 1 }}>
              {last ? <Button title="Fertig" onPress={close} testID="cook-done" /> : <Button title="Weiter" onPress={() => setI(step + 1)} testID="cook-next" />}
            </View>
          </View>
        </>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>
          {ings.map((ing, k) =>
            ing.heading ? (
              <T key={k} v="label" style={{ marginTop: k ? 14 : 0 }}>{ing.name}</T>
            ) : (
              <Text key={k} style={{ fontFamily: fonts.body, fontSize: 20, lineHeight: 28, color: t.ink, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.line }} maxFontSizeMultiplier={1.4}>
                {scaleLine(ing, factor)}
              </Text>
            ),
          )}
        </ScrollView>
      )}
    </View>
  );
}
