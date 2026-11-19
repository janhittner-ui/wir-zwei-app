/** Rezepte: eure gemeinsame Rezeptsammlung. Liste wie in iOS, mit Suche und Favoriten. */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useRecipes } from '@/data/provider';
import type { Recipe } from '@/data/types';
import { searchKey } from '@/lib/birthdays';
import { formatMinutes } from '@/lib/recipe';
import { fonts, useTheme } from '@/theme';
import { IconHeart, IconPlus, IconRight, IconX } from '@/ui/icons';
import { Banner, Button, Card, Input, Press, Screen, Segmented, T } from '@/ui/kit';

type Seg = 'alle' | 'fav';

export default function Rezepte() {
  const t = useTheme();
  const { items, loaded, error } = useRecipes();
  const [q, setQ] = useState('');
  const [seg, setSeg] = useState<Seg>('alle');
  const recipes = useMemo(() => [...items].sort((a, b) => a.title.localeCompare(b.title, 'de')), [items]);
  const favCount = recipes.filter((r) => r.favorite).length;
  const key = searchKey(q);
  const hits = recipes
    .filter((r) => seg === 'alle' || r.favorite)
    .filter((r) => !key || searchKey(`${r.title} ${r.ingredients}`).includes(key));
  const add = () => router.push('/rezept-bearbeiten');

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View>
          <T v="eyebrow">{recipes.length === 1 ? '1 Rezept' : `${recipes.length} Rezepte`}</T>
          <T v="display">Rezepte</T>
        </View>
        <Button small title="Rezept" icon={<IconPlus color={t.onAccent} size={18} />} onPress={add} testID="add-recipe" />
      </View>
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
      {favCount ? <Segmented<Seg> value={seg} onChange={setSeg} options={[{ key: 'alle', label: 'Alle' }, { key: 'fav', label: `Favoriten (${favCount})` }]} /> : null}

      {recipes.length ? (
        hits.length ? (
          <Card style={{ paddingVertical: 4, gap: 0 }}>
            {hits.map((r, i) => <RecipeRow key={r.id} r={r} first={i === 0} />)}
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
    </Screen>
  );
}

function RecipeRow({ r, first }: { r: Recipe; first: boolean }) {
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
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontFamily: fonts.bodySemi, fontSize: 16 }} numberOfLines={2}>{r.title}</T>
        <T v="small">{meta}</T>
      </View>
      {r.favorite ? <IconHeart color={t.pink} size={16} /> : null}
      <IconRight color={t.lineStrong} size={16} />
    </Press>
  );
}
