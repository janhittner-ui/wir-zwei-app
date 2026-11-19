/** Album: gemeinsame Fotos, nach Monat gruppiert, Raster wie in der iPhone-Fotos-App. */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActionSheetIOS, Platform, useWindowDimensions, View } from 'react-native';

import { friendlyError } from '@/data/errors';
import { usePrefs } from '@/data/prefs';
import { useApp, usePhotos } from '@/data/provider';
import type { Photo } from '@/data/types';
import { MONTHS } from '@/lib/dates';
import { MAX_PER_UPLOAD, pickPhotos, PickError, preparePhoto } from '@/lib/photo-pick';
import { useTheme } from '@/theme';
import { IconPlus } from '@/ui/icons';
import { Banner, Button, Press, Screen, T } from '@/ui/kit';
import { usePhotoUrls } from '@/ui/photo-urls';

const GAP = 2;

export default function Album() {
  const t = useTheme();
  const { store } = useApp();
  const { items, setItems, loaded, error } = usePhotos();
  const urls = usePhotoUrls(items);
  const { width } = useWindowDimensions();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; warn?: boolean } | null>(null);

  const pref = usePrefs().prefs.album.cols;
  const cols = width >= 700 ? pref + 2 : pref;
  const size = Math.floor((Math.min(width, 760) - 32 - GAP * (cols - 1)) / cols);

  const months = useMemo(() => {
    const groups: { key: string; label: string; photos: Photo[] }[] = [];
    for (const p of items) {
      const d = new Date(p.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) groups.push((g = { key, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, photos: [] }));
      g.photos.push(p);
    }
    return groups;
  }, [items]);

  const upload = async (source: 'library' | 'camera') => {
    setMsg(null);
    try {
      const assets = await pickPhotos(source);
      let done = 0;
      for (const a of assets) {
        setBusy(assets.length > 1 ? `Lade ${done + 1} von ${assets.length} hoch …` : 'Lade hoch …');
        const p = await store.addPhoto(await preparePhoto(a));
        setItems((l) => (l.some((x) => x.id === p.id) ? l : [p, ...l]));
        done++;
      }
      if (done > 1) setMsg({ text: `${done} Fotos sind im Album.` });
    } catch (e) {
      setMsg({ text: e instanceof PickError ? e.message : friendlyError(e), warn: true });
    } finally {
      setBusy(null);
    }
  };

  const add = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Abbrechen', 'Foto aufnehmen', 'Aus Fotos auswählen'], cancelButtonIndex: 0, title: 'Fotos ins Album legen' },
        (i) => (i === 1 ? upload('camera') : i === 2 ? upload('library') : undefined),
      );
    } else {
      upload('library');
    }
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View>
          <T v="eyebrow">{items.length === 1 ? '1 Foto' : `${items.length} Fotos`}</T>
          <T v="display">Album</T>
        </View>
        <Button small title="Fotos" icon={<IconPlus color={t.onAccent} size={18} />} onPress={add} busy={!!busy} testID="add-photo" />
      </View>
      {error ? <Banner warn>Das Album konnte gerade nicht geladen werden.</Banner> : null}
      {busy ? <Banner>{busy}</Banner> : null}
      {msg ? <Banner warn={msg.warn}>{msg.text}</Banner> : null}

      {items.length ? (
        months.map((g) => (
          <View key={g.key} style={{ gap: 8 }}>
            <T v="h2">{g.label}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
              {g.photos.map((p) => (
                <Press
                  key={p.id}
                  onPress={() => router.push({ pathname: '/foto', params: { id: p.id } })}
                  scale={0.97}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={p.caption ?? 'Foto'}
                  testID="photo-tile"
                  style={{ width: size, height: size, backgroundColor: t.surface2, borderRadius: 4, overflow: 'hidden' }}>
                  {urls[p.id] ? (
                    <Image source={{ uri: urls[p.id], cacheKey: p.id }} style={{ width: size, height: size }} contentFit="cover" transition={150} recyclingKey={p.id} />
                  ) : null}
                </Press>
              ))}
            </View>
          </View>
        ))
      ) : loaded ? (
        <View style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.lineStrong, borderRadius: 16, padding: 20, gap: 10, alignItems: 'center' }}>
          <T v="muted" style={{ textAlign: 'center' }}>
            Euer gemeinsames Album. Nur ihr beide könnt die Fotos sehen. Bis zu {MAX_PER_UPLOAD} auf einmal, sie werden dabei platzsparend verkleinert.
          </T>
          <Button small title="Erste Fotos hinzufügen" onPress={add} testID="add-photo-empty" />
        </View>
      ) : null}
    </Screen>
  );
}
