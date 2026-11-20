/** Essen: Reiter Rezepte (gemeinsame Sammlung mit Fotos, Suche, Filter nach Mahlzeit und Favoriten) und Restaurants (wollen wir hin / waren wir, mit Sternen). */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { ScrollView, View } from 'react-native';

import { usePrefs } from '@/data/prefs';
import { usePhotos, useRecipes, useRestaurants } from '@/data/provider';
import type { Meal, Recipe } from '@/data/types';
import { searchKey } from '@/lib/birthdays';
import { formatMinutes, MEALS } from '@/lib/recipe';
import { fonts, useTheme } from '@/theme';
import { IconFork, IconHeart, IconPlus, IconRight, IconX } from '@/ui/icons';
import { Banner, Button, Card, Input, Press, Screen, Segmented, T } from '@/ui/kit';
import { usePhotoUrls } from '@/ui/photo-urls';
import { RestaurantsView } from '@/ui/restaurants-view';

type Seg = 'alle' | 'fav' | Meal;
type Tab = 'rezepte' | 'restaurants';

export default function Essen() {
  const t = useTheme();
  const params = useLocalSearchParams<{ seg?: string }>();
  const [tab, setTab] = useState<Tab>(params.seg === 'restaurants' ? 'restaurants' : 'rezepte');
  useEffect(() => {
    if (params.seg === 'restaurants' || params.seg === 'rezepte') setTab(params.seg);
  }, [params.seg]);
  const { items: recipes } = useRecipes();
  const { items: places } = useRestaurants();
  const add = () => router.push(tab === 'rezepte' ? '/rezept-bearbeiten' : '/restaurant');
  const count = tab === 'rezepte'
    ? (recipes.length === 1 ? '1 Rezept' : `${recipes.length} Rezepte`)
    : (places.length === 1 ? '1 Restaurant' : `${places.length} Restaurants`);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View>
          <T v="eyebrow">{count}</T>
          <T v="display">Essen</T>
        </View>
        <Button small title={tab === 'rezepte' ? 'Rezept' : 'Restaurant'} icon={<IconPlus color={t.onAccent} size={18} />} onPress={add} testID={tab === 'rezepte' ? 'add-recipe' : 'add-restaurant'} />
      </View>
      <Segmented<Tab> value={tab} onChange={setTab} options={[{ key: 'rezepte', label: 'Rezepte' }, { key: 'restaurants', label: 'Restaurants' }]} />
      {tab === 'rezepte' ? <RecipesView /> : <RestaurantsView />}
    </Screen>
  );
}

function RecipesView() {
  const t = useTheme();
  const { items, loaded, error } = useRecipes();
  const [q, setQ] = useState('');
  const [seg, setSeg] = useState<Seg>('alle');
  const sort = usePrefs().prefs.rezepte.sort;
  const recipes = useMemo(
    () => [...items].sort((a, b) => (sort === 'neu' ? b.updatedAt.localeCompare(a.updatedAt) : 0) || a.title.localeCompare(b.title, 'de')),
    [items, sort],
  );
  const favCount = recipes.filter((r) => r.favorite).length;
  const filters = [
    ...MEALS.map((m) => ({ key: m.key as Seg, label: m.short, n: recipes.filter((r) => r.meals.includes(m.key)).length })),
    { key: 'fav' as Seg, label: 'Favoriten', n: favCount },
  ].filter((f) => f.n > 0 || f.key === seg);
  const key = searchKey(q);
  const hits = recipes
    .filter((r) => seg === 'alle' || (seg === 'fav' ? r.favorite : r.meals.includes(seg)))
    .filter((r) => !key || searchKey(`${r.title} ${r.ingredients}`).includes(key));
  const add = () => router.push('/rezept-bearbeiten');
  const { items: photos } = usePhotos();
  const shownPhotos = useMemo(() => photos.filter((p) => hits.some((r) => r.photoId === p.id)), [photos, hits]);
  const urls = usePhotoUrls(shownPhotos);

  return (
    <>
      {error ? <Banner warn>Rezepte konnten gerade nicht geladen werden.</Banner> : null}

      {recipes.length > 3 ? (
        <View style={{ justifyContent: 'center' }}>
          <Input value={q} onChangeText={setQ} placeholder="Rezept oder Zutat suchen …" autoCorrect={false} returnKeyType="search" accessibilityLabel="Rezepte durchsuchen" style={{ backgroundColor: t.surface2, borderColor: 'transparent', paddingRight: 42 }} testID="recipe-search" />
          {q ? (
            <Press onPress={() => setQ('')} accessibilityLabel="Suche leeren" style={{ position: 'absolute', right: 6, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <IconX color={t.muted} size={16} />
            </Press>
          ) : null}
        </View>
      ) : null}
      {filters.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} accessibilityRole="tablist">
          {[{ key: 'alle' as Seg, label: 'Alle' }, ...filters].map((f) => {
            const on = seg === f.key;
            return (
              <Press key={f.key} onPress={() => setSeg(f.key)} scale={0.94} accessibilityRole="tab" accessibilityState={{ selected: on }} testID={`recipe-filter-${f.key}`}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: on ? t.blue : t.surface2 }}>
                <T style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: on ? t.onAccent : t.ink }}>{f.label}</T>
              </Press>
            );
          })}
        </ScrollView>
      ) : null}

      {recipes.length ? (
        hits.length ? (
          <Card style={{ paddingVertical: 4, gap: 0 }}>
            {hits.map((r, i) => <RecipeRow key={r.id} r={r} first={i === 0} photo={r.photoId ? urls[r.photoId] : undefined} />)}
          </Card>
        ) : (
          <T v="muted">Nichts gefunden.</T>
        )
      ) : loaded ? (
        <View style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.lineStrong, borderRadius: 16, padding: 20, gap: 10, alignItems: 'center' }}>
          <T v="muted" style={{ textAlign: 'center' }}>
            Sammelt hier eure Lieblingsrezepte. Mengen lassen sich auf jede Portionenzahl umrechnen, und die Zutaten kommen mit einem Tipp auf die Einkaufsliste.
          </T>
          <Button small title="Erstes Rezept" onPress={add} />
        </View>
      ) : null}
    </>
  );
}

function RecipeRow({ r, first, photo }: { r: Recipe; first: boolean; photo?: string }) {
  const t = useTheme();
  const n = r.ingredients ? r.ingredients.split('\n').filter((l) => l.trim() && !l.trim().endsWith(':')).length : 0;
  const meta = [`${r.servings} ${r.servings === 1 ? 'Portion' : 'Portionen'}`, r.minutes ? formatMinutes(r.minutes) : null, n ? `${n} Zutaten` : null].filter(Boolean).join(' · ');
  return (
    <Press
      onPress={() => router.push({ pathname: '/rezept', params: { id: r.id } })}
      scale={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${r.title}${r.favorite ? ', Favorit' : ''}, ${meta}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, paddingVertical: 10, borderTopWidth: first ? 0 : 1, borderTopColor: t.line }}>
      <View style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center' }}>
        {photo ? (
          <Image source={{ uri: photo, cacheKey: r.photoId ?? undefined }} style={{ width: 52, height: 52 }} contentFit="cover" transition={150} recyclingKey={r.photoId ?? undefined} />
        ) : (
          <IconFork color={t.muted} size={22} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontFamily: fonts.bodySemi, fontSize: 16 }} numberOfLines={2}>{r.title}</T>
        <T v="small">{meta}</T>
      </View>
      {r.favorite ? <IconHeart color={t.pink} size={16} /> : null}
      <IconRight color={t.lineStrong} size={16} />
    </Press>
  );
}
