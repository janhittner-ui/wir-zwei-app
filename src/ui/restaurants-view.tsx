/**
 * Restaurants (Reiter im Tab „Essen“): „Wollen wir hin“ und „Waren wir“.
 * Abhaken = heute dort gewesen, danach öffnet sich das Restaurant zum Bewerten. Jede Person vergibt eigene Sterne.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { useApp, usePhotos, useRestaurants } from '@/data/provider';
import type { Restaurant } from '@/data/types';
import { ymd } from '@/lib/dates';
import { avgStars, restaurantSub, splitRestaurants, starsText } from '@/lib/restaurants';
import { fonts, useTheme } from '@/theme';
import { IconRight, IconStar } from '@/ui/icons';
import { Banner, Button, Card, Press, Segmented, T } from '@/ui/kit';
import { usePhotoUrls } from '@/ui/photo-urls';
import { SwipeToDelete } from '@/ui/swipe-row';

type Seg = 'wish' | 'visited';

export function RestaurantsView() {
  const t = useTheme();
  const { store, couple } = useApp();
  const { items, setItems, loaded, error, reload } = useRestaurants();
  const { items: photos } = usePhotos();
  const [seg, setSeg] = useState<Seg>('wish');
  const [err, setErr] = useState<string | null>(null);

  const { wish, visited } = useMemo(() => splitRestaurants(items), [items]);
  const withPhoto = useMemo(() => photos.filter((p) => visited.some((r) => r.photoId === p.id)), [photos, visited]);
  const urls = usePhotoUrls(withPhoto);
  const name = (uid: string) => couple?.members.find((m) => m.id === uid)?.displayName ?? '';

  const visit = async (r: Restaurant) => {
    setErr(null);
    const visitedOn = ymd(new Date());
    setItems((l) => l.map((x) => (x.id === r.id ? { ...x, visitedOn } : x)));
    try {
      await store.updateRestaurant(r.id, { name: r.name, cuisine: r.cuisine, place: r.place, price: r.price, note: r.note, visitedOn, photoId: null });
      setSeg('visited');
      router.push({ pathname: '/restaurant', params: { id: r.id } });
    } catch (e) {
      setErr(friendlyError(e));
      reload();
    }
  };
  const remove = async (r: Restaurant) => {
    setErr(null);
    setItems((l) => l.filter((x) => x.id !== r.id));
    try {
      await store.deleteRestaurant(r.id);
    } catch (e) {
      setErr(friendlyError(e));
      reload();
    }
  };

  if (loaded && !items.length) {
    return (
      <View style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.lineStrong, borderRadius: 16, padding: 20, gap: 10, alignItems: 'center' }}>
        {error ? <Banner warn>Die Liste konnte gerade nicht geladen werden.</Banner> : null}
        <Text style={{ fontSize: 34 }}>🍽️</Text>
        <T v="muted" style={{ textAlign: 'center' }}>
          Sammelt Restaurants, in die ihr mal wollt, und bewertet die, in denen ihr wart. Jeder vergibt seine eigenen Sterne.
        </T>
        <Button small title="Erstes Restaurant" onPress={() => router.push('/restaurant')} testID="add-restaurant-empty" />
      </View>
    );
  }

  const list = seg === 'wish' ? wish : visited;
  return (
    <>
      {error ? <Banner warn>Die Liste konnte gerade nicht geladen werden.</Banner> : null}
      <Segmented<Seg> value={seg} onChange={setSeg} options={[{ key: 'wish', label: `Wollen wir hin (${wish.length})` }, { key: 'visited', label: `Waren wir (${visited.length})` }]} />
      {err ? <Banner warn>{err}</Banner> : null}
      <Card style={{ gap: 4 }}>
        {list.length ? (
          <>
            {list.map((r, i) => (
              <RestaurantRow key={r.id} r={r} first={i === 0} photo={r.photoId ? urls[r.photoId] : undefined} name={name} onVisit={visit} onDelete={remove} />
            ))}
            <T v="small" style={{ textAlign: 'center', paddingTop: 6 }}>
              {seg === 'wish' ? 'Abhaken, wenn ihr dort wart. Zum Löschen nach links wischen.' : 'Zum Löschen nach links wischen.'}
            </T>
          </>
        ) : (
          <T v="muted" style={{ paddingVertical: 8 }}>
            {seg === 'wish' ? 'Noch keine Wünsche. Wo wollt ihr mal essen gehen?' : 'Noch nichts bewertet. Hakt ein Restaurant ab, wenn ihr dort wart.'}
          </T>
        )}
      </Card>
    </>
  );
}

function RestaurantRow({ r, first, photo, name, onVisit, onDelete }: {
  r: Restaurant; first: boolean; photo?: string; name: (uid: string) => string; onVisit: (r: Restaurant) => void; onDelete: (r: Restaurant) => void;
}) {
  const t = useTheme();
  const avg = avgStars(r);
  const sub = restaurantSub(r);
  const who = r.ratings.map((x) => `${name(x.userId) || 'Ihr'}: ${x.stars} ★`).join(' · ');
  const open = () => router.push({ pathname: '/restaurant', params: { id: r.id } });
  return (
    <View style={{ borderTopWidth: first ? 0 : 1, borderTopColor: t.line, paddingTop: first ? 0 : 6 }}>
      <SwipeToDelete onDelete={() => onDelete(r)}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.surface, paddingVertical: 4 }}
          accessible
          accessibilityLabel={`${r.name}${sub ? `, ${sub}` : ''}${avg ? `, ${starsText(avg)} Sterne` : ''}`}
          accessibilityActions={[...(r.visitedOn ? [] : [{ name: 'activate', label: 'Waren wir' }]), { name: 'delete', label: 'Löschen' }, { name: 'edit', label: 'Öffnen' }]}
          onAccessibilityAction={(e) => {
            const a = e.nativeEvent.actionName;
            if (a === 'delete') onDelete(r);
            else if (a === 'activate' && !r.visitedOn) onVisit(r);
            else open();
          }}>
          {!r.visitedOn ? (
            <Press onPress={() => onVisit(r)} scale={0.82} hitSlop={8} accessibilityRole="checkbox" accessibilityLabel={`${r.name}: waren wir`} accessibilityState={{ checked: false }} testID="restaurant-visit"
              style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: t.lineStrong }} />
          ) : null}
          {photo ? (
            <Image source={{ uri: photo, cacheKey: r.photoId ?? undefined }} style={{ width: 44, height: 44, borderRadius: 10 }} contentFit="cover" />
          ) : (
            <View style={{ width: r.visitedOn ? 44 : 26, height: r.visitedOn ? 44 : 26, borderRadius: 10, backgroundColor: r.visitedOn ? t.surface2 : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 20 }}>🍽️</Text>
            </View>
          )}
          <Press onPress={open} scale={0.98} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }} testID="restaurant-row">
            <View style={{ flex: 1, gap: 2 }}>
              <T style={{ fontFamily: fonts.bodySemi }} numberOfLines={2}>{r.name}</T>
              {sub ? <T v="small" numberOfLines={1}>{sub}</T> : null}
              {r.visitedOn && who ? <T v="small" numberOfLines={1}>{who}</T> : null}
            </View>
            {avg ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: t.surface2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                <IconStar color={t.yellow} filled size={14} />
                <T style={{ fontFamily: fonts.bodySemi, fontSize: 14 }}>{starsText(avg)}</T>
              </View>
            ) : null}
            <IconRight color={t.lineStrong} size={14} />
          </Press>
        </View>
      </SwipeToDelete>
    </View>
  );
}
