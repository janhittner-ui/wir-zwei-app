/** Ein Rezept ansehen: Portionen umrechnen, Zutaten auf die Einkaufsliste, Kochmodus starten. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, useRecipes } from '@/data/provider';
import { searchKey } from '@/lib/birthdays';
import { formatMinutes, parseIngredients, parseSteps, scaleLine, toShopping } from '@/lib/recipe';
import { goArea } from '@/lib/nav';
import { fonts, useTheme } from '@/theme';
import { IconCart, IconClock, IconHeart, IconHeartLine, IconLeft, IconPencil } from '@/ui/icons';
import { Banner, Button, Card, CardHead, Press, Screen, T } from '@/ui/kit';
import { Stepper } from '@/ui/stepper';

export default function RezeptAnsicht() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store } = useApp();
  const { items, loaded, setItems } = useRecipes();
  const t = useTheme();
  const r = items.find((x) => x.id === id);
  const [servings, setServings] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ text: string; warn?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // Startet mit der Portionenzahl des Rezepts; ändert der Partner sie, ziehen wir nach, solange hier nichts verstellt wurde.
  useEffect(() => setServings(null), [r?.servings]);
  const n = servings ?? r?.servings ?? 1;
  const factor = r ? n / r.servings : 1;
  const ings = useMemo(() => parseIngredients(r?.ingredients ?? ''), [r?.ingredients]);
  const steps = useMemo(() => parseSteps(r?.steps ?? ''), [r?.steps]);

  const back = () => (router.canGoBack() ? router.back() : goArea('rezepte', {}, 'replace'));

  if (!r) {
    return (
      <Screen>
        <Press onPress={back} accessibilityLabel="Zurück" style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <IconLeft color={t.blue} size={22} />
          <T style={{ color: t.blue }}>Rezepte</T>
        </Press>
        {loaded ? <T v="h2">Dieses Rezept wurde gelöscht.</T> : null}
      </Screen>
    );
  }

  const toggleFav = async () => {
    const fav = !r.favorite;
    setItems((l) => l.map((x) => (x.id === r.id ? { ...x, favorite: fav } : x)));
    try {
      await store.setRecipeFavorite(r.id, fav);
    } catch (e) {
      setItems((l) => l.map((x) => (x.id === r.id ? { ...x, favorite: !fav } : x)));
      setMsg({ text: friendlyError(e), warn: true });
    }
  };

  const shoppable = ings.filter((i) => !i.heading);
  const addToList = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const open = new Set((await store.listShopping()).filter((s) => !s.done).map((s) => searchKey(s.text)));
      const todo = shoppable.map((i) => toShopping(i, factor)).filter((s) => !open.has(searchKey(s.text)));
      for (const s of todo) await store.addShopping(s);
      const skipped = shoppable.length - todo.length;
      setMsg({
        text: todo.length
          ? `${todo.length === 1 ? '1 Zutat steht' : `${todo.length} Zutaten stehen`} jetzt auf der Einkaufsliste.${skipped ? ` ${skipped} stand${skipped === 1 ? '' : 'en'} schon drauf.` : ''}`
          : 'Alle Zutaten stehen schon auf der Einkaufsliste.',
      });
    } catch (e) {
      setMsg({ text: friendlyError(e), warn: true });
    } finally {
      setBusy(false);
    }
  };
  const isUrl = r.source ? /^https?:\/\/\S+$/i.test(r.source) : false;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Press onPress={back} accessibilityLabel="Zurück zu Rezepte" style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -6, minHeight: 44 }}>
          <IconLeft color={t.blue} size={22} />
          <Text style={{ color: t.blue, fontFamily: fonts.body, fontSize: 17 }}>Rezepte</Text>
        </Press>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Press onPress={toggleFav} scale={0.8} accessibilityRole="button" accessibilityLabel={r.favorite ? 'Kein Favorit mehr' : 'Als Favorit merken'} accessibilityState={{ selected: r.favorite }} testID="recipe-fav" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            {r.favorite ? <IconHeart color={t.pink} size={22} /> : <IconHeartLine color={t.blue} size={22} />}
          </Press>
          <Press onPress={() => router.push({ pathname: '/rezept-bearbeiten', params: { id: r.id } })} accessibilityRole="button" accessibilityLabel="Bearbeiten" testID="recipe-edit" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <IconPencil color={t.blue} size={21} />
          </Press>
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <T v="display" accessibilityRole="header">{r.title}</T>
        {r.minutes ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <IconClock color={t.muted} size={15} />
            <T v="muted">{formatMinutes(r.minutes)}</T>
          </View>
        ) : null}
      </View>
      {msg ? <Banner warn={msg.warn}>{msg.text}</Banner> : null}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <T v="h2">Zutaten</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T v="small">{n === 1 ? 'Portion' : 'Portionen'}</T>
            <Stepper value={n} onChange={setServings} label="Portionen" testID="recipe-portions" />
          </View>
        </View>
        {ings.length ? (
          <View>
            {ings.map((ing, i) =>
              ing.heading ? (
                <T key={i} v="label" style={{ marginTop: i ? 12 : 0, marginBottom: 2 }}>{ing.name}</T>
              ) : (
                <View key={i} style={{ flexDirection: 'row', gap: 10, paddingVertical: 7, borderTopWidth: i && !ings[i - 1].heading ? 1 : 0, borderTopColor: t.line }}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.lineStrong, marginTop: 9 }} />
                  <T style={{ flex: 1 }}>{scaleLine(ing, factor)}</T>
                </View>
              ),
            )}
          </View>
        ) : (
          <T v="muted">Noch keine Zutaten eingetragen.</T>
        )}
        {shoppable.length ? (
          <Button kind="ghost" title="Auf die Einkaufsliste" icon={<IconCart color={t.ink} size={18} />} busy={busy} onPress={addToList} testID="recipe-to-list" />
        ) : null}
      </Card>

      <Card>
        <CardHead title="Zubereitung" />
        {steps.length ? (
          steps.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: t.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: t.blue }}>{i + 1}</Text>
              </View>
              <T style={{ flex: 1, paddingTop: 2 }}>{s}</T>
            </View>
          ))
        ) : (
          <T v="muted">Noch keine Schritte eingetragen.</T>
        )}
      </Card>
      {steps.length ? (
        <Button title="Kochmodus starten" onPress={() => router.push({ pathname: '/kochen', params: { id: r.id, servings: String(n) } })} testID="recipe-cook" />
      ) : null}

      {r.source ? (
        isUrl ? (
          <Press onPress={() => Linking.openURL(r.source!)} accessibilityRole="link">
            <T v="small">Quelle: <Text style={{ color: t.blue }}>{r.source}</Text></T>
          </Press>
        ) : (
          <T v="small">Quelle: {r.source}</T>
        )
      ) : null}
    </Screen>
  );
}
